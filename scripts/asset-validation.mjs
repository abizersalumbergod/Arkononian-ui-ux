#!/usr/bin/env node
// Gate G (asset integrity) validator for the arkononion-ui-ux skill.
// Zero dependencies; Node >= 18 ESM; Windows and POSIX.
//
// Checks every asset in an asset manifest (schemas/asset-manifest.schema.json): path confined to
// --root, file exists, magic-byte format sniff, image dimensions, aspect ratio (1% tolerance),
// WAV duration from the header (ffprobe for other audio/video when installed, else not-tested),
// byte budgets, license, fallback for critical assets, and secret-like strings in prompts.
// Read-only except for an explicit --out target. Never prints secret values or env variables.

import { open, readFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { validate, formatErrors } from './lib/schema.mjs';
import {
  PACKAGE_ROOT,
  readJson,
  readText,
  statOrNull,
  isInside,
  relPosix,
  scanSecrets,
  writeFileSafe,
  isMainModule,
} from './lib/fsutil.mjs';

/** Process exit codes. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCOMPLETE: 2, INVALID: 3, USAGE: 64 });

/** Default byte budgets (schemas/asset-manifest.schema.json); a manifest "budgets" object overrides them. */
export const DEFAULT_BUDGETS = Object.freeze({
  image: 512000, // 500 KiB
  imageHero: 819200, // 800 KiB, roles containing "hero" or "background"
  video: 6291456, // 6 MiB
  audio: 1572864, // 1.5 MiB
  model3d: 5242880, // 5 MiB
});

/** Allowed relative difference between actual and declared aspect ratio. */
export const ASPECT_TOLERANCE = 0.01;

const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'schemas', 'asset-manifest.schema.json');
const FULL_READ_LIMIT = 16 * 1024 * 1024;
const HEAD_BYTES = 2 * 1024 * 1024;
const PROMPT_READ_LIMIT = 1024 * 1024;
const SNIFFABLE = new Set(['png', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'mp4', 'mov', 'm4a', 'webm', 'mkv', 'ogg', 'mp3', 'aac', 'wav', 'flac', 'glb', 'woff2', 'woff', 'ttf', 'otf', 'ico', 'bmp', 'heic', '3gp']);
const DIMENSION_FORMATS = new Set(['png', 'jpeg', 'gif', 'webp', 'avif', 'svg']);
const TIMED_FORMATS = new Set(['mp4', 'mov', 'm4a', 'webm', 'mkv', 'ogg', 'mp3', 'aac', 'wav', 'flac', '3gp']);
const ISO_BMFF_FAMILY = new Set(['mp4', 'm4a', '3gp']);
const ALT_TYPES = new Set(['image', 'illustration', 'icon']);
const LICENSE_PLACEHOLDER = /^(unknown|n\/?a|none|tbd|todo|unlicensed|unspecified|\?+|-+)$/i;
const FORMAT_ALIASES = Object.freeze({
  jpg: 'jpeg', jpe: 'jpeg', jfif: 'jpeg', pjpeg: 'jpeg', 'svg+xml': 'svg', m4v: 'mp4', mpeg4: 'mp4',
  qt: 'mov', quicktime: 'mov', oga: 'ogg', ogv: 'ogg', opus: 'ogg', vorbis: 'ogg', mpeg: 'mp3', mpga: 'mp3',
  wave: 'wav', 'vnd.wave': 'wav', 'gltf-binary': 'glb', matroska: 'mkv', truetype: 'ttf', opentype: 'otf',
  icon: 'ico', 'vnd.microsoft.icon': 'ico', '3gpp': '3gp', heif: 'heic',
});

// ---------------------------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------------------------

/**
 * Normalise a declared format or MIME type ("JPG", "image/svg+xml", "audio/x-wav") to a sniff id.
 * @param {string} format
 * @returns {string|null}
 */
export function normalizeFormat(format) {
  if (typeof format !== 'string' || !format.trim()) return null;
  let f = format.trim().toLowerCase().replace(/^\./, '');
  f = f.replace(/^(image|video|audio|model|font|application)\//, '');
  if (f.startsWith('x-')) f = f.slice(2);
  return FORMAT_ALIASES[f] ?? f;
}

/**
 * True when a declared format is satisfied by the sniffed one.
 * @param {string|null} declared normalised declared format
 * @param {string|null} sniffed
 * @returns {boolean}
 */
export function formatsCompatible(declared, sniffed) {
  if (!declared || !sniffed) return false;
  if (declared === sniffed) return true;
  if (ISO_BMFF_FAMILY.has(declared) && ISO_BMFF_FAMILY.has(sniffed)) return true;
  return declared === 'aac' && sniffed === 'm4a';
}

function latin1(buf, start, end) {
  return buf.toString('latin1', start, Math.min(end, buf.length));
}

function sniffFtyp(buf) {
  const size = buf.readUInt32BE(0);
  const major = latin1(buf, 8, 12);
  const end = Math.min(buf.length, size >= 16 && size <= 4096 ? size : 32);
  const brands = [major];
  for (let i = 16; i + 4 <= end; i += 4) brands.push(latin1(buf, i, i + 4));
  if (brands.includes('avif') || brands.includes('avis')) return 'avif';
  if (major === 'qt  ') return 'mov';
  if (['M4A ', 'M4B ', 'M4P '].includes(major)) return 'm4a';
  if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(major)) return 'heic';
  if (major.startsWith('3g')) return '3gp';
  return 'mp4';
}

function stripXmlProlog(text) {
  let t = text.replace(/^﻿/, '');
  for (;;) {
    const before = t;
    t = t
      .replace(/^\s+/, '')
      .replace(/^<\?[\s\S]*?\?>/, '')
      .replace(/^<!--[\s\S]*?-->/, '')
      .replace(/^<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/i, '');
    if (t === before) return t;
  }
}

function looksLikeSvg(buf) {
  const head = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  if (head.includes(0)) return false;
  return /^<svg[\s>/]/.test(stripXmlProlog(head.toString('utf8')));
}

/**
 * Identify a file format from its leading bytes (magic numbers), never from the extension.
 * @param {Uint8Array} input
 * @returns {string|null} png, jpeg, gif, webp, avif, heic, svg, mp4, mov, m4a, 3gp, webm, mkv, ogg,
 *   flac, mp3, aac, wav, avi, glb, woff2, woff, ttf, otf, ico, bmp, or null when unrecognised.
 */
export function sniffFormat(input) {
  if (!input || input.length < 2) return null;
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (b.length >= 8 && b[0] === 0x89 && latin1(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 6 && /^GIF8[79]a$/.test(latin1(b, 0, 6))) return 'gif';
  if (b.length >= 12 && latin1(b, 0, 4) === 'RIFF') {
    const form = latin1(b, 8, 12);
    if (form === 'WEBP') return 'webp';
    if (form === 'WAVE') return 'wav';
    if (form === 'AVI ') return 'avi';
    return null;
  }
  if (b.length >= 12 && latin1(b, 4, 8) === 'ftyp') return sniffFtyp(b);
  if (b.length >= 8 && ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(latin1(b, 4, 8))) return 'mov';
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return latin1(b, 0, 64).includes('webm') ? 'webm' : 'mkv';
  }
  if (b.length >= 4) {
    const sig = latin1(b, 0, 4);
    if (sig === 'OggS') return 'ogg';
    if (sig === 'fLaC') return 'flac';
    if (sig === 'glTF' && b.length >= 12) return 'glb';
    if (sig === 'wOF2') return 'woff2';
    if (sig === 'wOFF') return 'woff';
    if (sig === 'OTTO') return 'otf';
    if (b.length >= 12 && (sig === 'true' || (b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00))) return 'ttf';
    if (b.length >= 6 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'ico';
  }
  if (b.length >= 3 && latin1(b, 0, 3) === 'ID3') return 'mp3';
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return ((b[1] >> 1) & 0x03) === 0 ? 'aac' : 'mp3';
  if (b.length >= 18 && latin1(b, 0, 2) === 'BM' && [12, 40, 52, 56, 108, 124].includes(b.readUInt32LE(14))) return 'bmp';
  if (looksLikeSvg(b)) return 'svg';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Dimensions and duration
// ---------------------------------------------------------------------------------------------

/** @returns {{width: number, height: number}|null} */
export function pngDimensions(b) {
  if (b.length < 24 || latin1(b, 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** @returns {{width: number, height: number}|null} */
export function gifDimensions(b) {
  if (b.length < 10) return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

/** Walk JPEG marker segments to the first start-of-frame. @returns {{width: number, height: number}|null} */
export function jpegDimensions(b) {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    i += 2;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda || i + 2 > b.length) return null;
    const len = b.readUInt16BE(i);
    if (len < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 7 > b.length) return null;
      return { width: b.readUInt16BE(i + 5), height: b.readUInt16BE(i + 3) };
    }
    i += len;
  }
  return null;
}

/** VP8, VP8L and VP8X WebP headers. @returns {{width: number, height: number}|null} */
export function webpDimensions(b) {
  if (b.length < 30) return null;
  const chunk = latin1(b, 12, 16);
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  return null;
}

/** First "ispe" (image spatial extent) property of an AVIF/HEIF file. @returns {{width: number, height: number}|null} */
export function avifDimensions(b) {
  const idx = b.indexOf('ispe', 0, 'latin1');
  if (idx < 4 || idx + 16 > b.length) return null;
  return { width: b.readUInt32BE(idx + 8), height: b.readUInt32BE(idx + 12) };
}

function svgLength(value) {
  if (!value) return null;
  const m = /^([0-9]*\.?[0-9]+(?:e[-+]?\d+)?)\s*(px|pt|pc|mm|cm|in)?$/i.exec(value.trim());
  if (!m) return null; // %, em, rem, vw ... are relative: fall back to viewBox
  const factor = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 }[(m[2] || 'px').toLowerCase()];
  const px = Number(m[1]) * factor;
  return px > 0 ? px : null;
}

/**
 * Intrinsic SVG size from width/height (absolute units) or the viewBox.
 * @param {Uint8Array|string} input
 * @returns {{width: number, height: number, source: string}|null}
 */
export function svgDimensions(input) {
  const text = typeof input === 'string' ? input : Buffer.from(input).toString('utf8');
  const m = /^<svg\b([^>]*)>/.exec(stripXmlProlog(text).replace(/^<!--[\s\S]*?-->\s*/g, ''));
  if (!m) return null;
  const attr = (name) => {
    const r = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(m[1]);
    return r ? (r[1] ?? r[2]) : null;
  };
  const w = svgLength(attr('width'));
  const h = svgLength(attr('height'));
  if (w && h) return { width: w, height: h, source: 'width/height' };
  const vb = attr('viewBox');
  if (vb) {
    const n = vb.trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0) {
      if (w) return { width: w, height: (w * n[3]) / n[2], source: 'width+viewBox' };
      if (h) return { width: (h * n[2]) / n[3], height: h, source: 'height+viewBox' };
      return { width: n[2], height: n[3], source: 'viewBox' };
    }
  }
  return null;
}

/**
 * Pixel dimensions for png, jpeg, gif, webp, avif and svg data.
 * @param {Uint8Array} buf
 * @param {string} [format] sniffed format (sniffed when omitted)
 * @returns {{width: number, height: number, source?: string}|null}
 */
export function getDimensions(buf, format) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  switch (format ?? sniffFormat(b)) {
    case 'png': return pngDimensions(b);
    case 'jpeg': return jpegDimensions(b);
    case 'gif': return gifDimensions(b);
    case 'webp': return webpDimensions(b);
    case 'avif': return avifDimensions(b);
    case 'svg': return svgDimensions(b);
    default: return null;
  }
}

/**
 * Parse a RIFF/WAVE header. Duration = data bytes / byte rate.
 * @param {Uint8Array} buf leading bytes of the file (the header is enough)
 * @param {number} [fileSize] real file size, used for streaming or truncated data chunks
 * @returns {null|{audioFormat: number, channels: number, sampleRate: number, byteRate: number,
 *   blockAlign: number, bitsPerSample: number, dataBytes: number|null, durationSec: number|null, truncated: boolean}}
 */
export function wavInfo(buf, fileSize) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const total = fileSize ?? b.length;
  if (b.length < 12 || latin1(b, 0, 4) !== 'RIFF' || latin1(b, 8, 12) !== 'WAVE') return null;
  let i = 12;
  let fmt = null;
  let dataBytes = null;
  let truncated = false;
  while (i + 8 <= b.length) {
    const id = latin1(b, i, i + 4);
    const size = b.readUInt32LE(i + 4);
    const body = i + 8;
    if (id === 'fmt ' && body + 16 <= b.length) {
      fmt = {
        audioFormat: b.readUInt16LE(body),
        channels: b.readUInt16LE(body + 2),
        sampleRate: b.readUInt32LE(body + 4),
        byteRate: b.readUInt32LE(body + 8),
        blockAlign: b.readUInt16LE(body + 12),
        bitsPerSample: b.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      const remaining = Math.max(0, total - body);
      if (size === 0xffffffff || (size === 0 && remaining > 0)) dataBytes = remaining;
      else if (size > remaining) {
        dataBytes = remaining;
        truncated = true;
      } else dataBytes = size;
      break;
    }
    i = body + size + (size % 2);
  }
  if (!fmt) return null;
  const byteRate = fmt.byteRate || fmt.sampleRate * fmt.blockAlign;
  const durationSec = dataBytes !== null && byteRate > 0 ? dataBytes / byteRate : null;
  return { ...fmt, dataBytes, durationSec, truncated };
}

let ffprobeCache;

/**
 * Locate ffprobe on PATH (cached). Returns the command or null.
 * @param {boolean|string} [option] false disables probing; a string is used as the command.
 * @returns {string|null}
 */
export function findFfprobe(option) {
  if (option === false) return null;
  if (typeof option === 'string' && option) return option;
  if (ffprobeCache !== undefined) return ffprobeCache;
  const r = spawnSync('ffprobe', ['-version'], { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false });
  ffprobeCache = r.error || r.status !== 0 ? null : 'ffprobe';
  return ffprobeCache;
}

/**
 * Container duration in seconds via ffprobe (5 s timeout), or null.
 * @param {string} file absolute path
 * @param {string} ffprobe command
 * @returns {number|null}
 */
export function probeDuration(file, ffprobe) {
  const r = spawnSync(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.resolve(file)],
    { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false, maxBuffer: 1024 * 1024 },
  );
  if (r.error || r.status !== 0) return null;
  const n = Number.parseFloat(String(r.stdout).trim());
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

/**
 * Parse "16:9", "4/5", "1.5" or a positive number into width / height.
 * @param {string|number} value
 * @returns {number|null}
 */
export function parseAspectRatio(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:[:/]\s*(\d+(?:\.\d+)?))?\s*$/.exec(value);
  if (!m) return null;
  const ratio = m[2] === undefined ? Number(m[1]) : Number(m[1]) / Number(m[2]);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/**
 * Resolve a manifest path inside `root`. Rejects empty paths, URLs, ../ traversal and absolute
 * paths outside the root. Backslashes are treated as separators.
 * @param {string} root
 * @param {string} p
 * @returns {{ok: true, abs: string}|{ok: false, reason: string}}
 */
export function resolveAssetPath(root, p) {
  if (typeof p !== 'string' || p.trim() === '') return { ok: false, reason: 'path is empty' };
  if (p.includes('\0')) return { ok: false, reason: 'path contains a NUL byte' };
  const normalized = p.replace(/\\/g, '/');
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized)) return { ok: false, reason: 'path is a URL (use "uri" for remote assets)' };
  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, normalized);
  if (!isInside(rootAbs, abs)) {
    const absolute = path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized);
    return { ok: false, reason: absolute ? 'absolute path outside the root' : 'path escapes the root (../ traversal)' };
  }
  return { ok: true, abs };
}

/**
 * Budget category and byte limit for an asset.
 * @param {{type?: string, role?: string}} asset
 * @param {object} [budgets] manifest budgets (merged over DEFAULT_BUDGETS)
 * @returns {{category: string, limit: number|null}}
 */
export function budgetFor(asset, budgets = {}) {
  const b = { ...DEFAULT_BUDGETS, ...(budgets && typeof budgets === 'object' ? budgets : {}) };
  switch (asset?.type) {
    case 'video': return { category: 'video', limit: b.video ?? null };
    case 'audio': return { category: 'audio', limit: b.audio ?? null };
    case 'model3d': return { category: 'model3d', limit: b.model3d ?? null };
    case 'font': return { category: 'font', limit: b.font ?? null };
    default:
      return /hero|background/i.test(String(asset?.role ?? ''))
        ? { category: 'imageHero', limit: b.imageHero ?? null }
        : { category: 'image', limit: b.image ?? null };
  }
}

function formatBytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MiB (${n} B)`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB (${n} B)`;
  return `${n} B`;
}

function hasFallback(fb) {
  if (typeof fb === 'string') return fb.trim() !== '';
  if (fb && typeof fb === 'object' && !Array.isArray(fb)) {
    return Object.values(fb).some((v) => (typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined));
  }
  return false;
}

async function readHead(file, size) {
  if (size <= FULL_READ_LIMIT) return readFile(file);
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

async function confinedRealpath(root, abs) {
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(abs)]);
    return isInside(realRoot, realFile);
  } catch {
    return false;
  }
}

function round(n, digits = 3) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function checkFileContent(asset, abs, st, ctx, add, measured) {
  measured.bytes = st.size;
  const buf = await readHead(abs, st.size);
  const declared = normalizeFormat(asset.format);
  const sniffed = sniffFormat(buf);
  measured.format = sniffed;
  if (!sniffed) {
    if (declared && SNIFFABLE.has(declared)) add('format', 'fail', `content is not recognisable as ${declared} (magic bytes do not match)`);
    else add('format', 'not-tested', `format ${JSON.stringify(asset.format)} cannot be identified by this tool`);
  } else if (!declared) {
    add('format', 'warn', `format not declared; content is ${sniffed}`);
  } else if (!formatsCompatible(declared, sniffed)) {
    add('format', 'fail', `declared format ${asset.format} but the content is ${sniffed}`);
  } else {
    add('format', 'pass', `content is ${sniffed}`);
  }

  if (sniffed && DIMENSION_FORMATS.has(sniffed)) {
    const dims = getDimensions(buf, sniffed);
    const vector = sniffed === 'svg';
    if (!dims) {
      add('dimensions', vector ? 'warn' : 'fail', vector ? 'SVG has no absolute width/height or viewBox' : `could not read dimensions from the ${sniffed} header`);
    } else {
      measured.width = round(dims.width, 2);
      measured.height = round(dims.height, 2);
      const d = asset.dimensions;
      if (d && Number.isFinite(d.width) && Number.isFinite(d.height)) {
        const same = vector
          ? (a, e) => Math.abs(a - e) <= Math.max(0.5, e * ASPECT_TOLERANCE)
          : (a, e) => a === e;
        if (same(dims.width, d.width) && same(dims.height, d.height)) add('dimensions', 'pass', `${measured.width}x${measured.height}`);
        else add('dimensions', vector ? 'warn' : 'fail', `declared ${d.width}x${d.height} but the file is ${measured.width}x${measured.height}`);
      } else {
        add('dimensions', 'warn', `${measured.width}x${measured.height}; record "dimensions" so layouts can reserve space (CLS)`);
      }
    }
  } else if (asset.dimensions) {
    add('dimensions', 'not-tested', `dimensions are not read from ${sniffed ?? 'this'} content`);
  }

  if (['audio', 'video'].includes(asset.type) || (sniffed && TIMED_FORMATS.has(sniffed))) {
    let duration = null;
    let method = null;
    if (sniffed === 'wav') {
      const info = wavInfo(buf, st.size);
      if (info?.durationSec !== null && info?.durationSec !== undefined) {
        duration = info.durationSec;
        method = 'WAV header';
      }
      if (info?.truncated) add('wav-header', 'warn', 'WAV data chunk is longer than the file (truncated file)');
    } else {
      const ffprobe = ctx.probe();
      if (ffprobe) {
        duration = probeDuration(abs, ffprobe);
        method = 'ffprobe';
      }
    }
    if (duration === null) {
      const why = sniffed === 'wav' ? 'could not read the WAV header' : ctx.ffprobeOption === false ? 'ffprobe disabled' : 'ffprobe is not available';
      add('duration', 'not-tested', `${why}; duration not measured`);
    } else {
      measured.durationSec = round(duration);
      if (typeof asset.durationSec === 'number') {
        const tol = Math.max(0.1, asset.durationSec * 0.01);
        if (Math.abs(duration - asset.durationSec) <= tol) add('duration', 'pass', `${measured.durationSec} s (${method})`);
        else add('duration', 'warn', `declared ${asset.durationSec} s but measured ${measured.durationSec} s (${method})`);
      } else {
        add('duration', 'pass', `${measured.durationSec} s (${method}); not declared in the manifest`);
      }
    }
  }

  if (sniffed === 'svg') {
    const text = buf.toString('utf8');
    if (/<script\b|\son[a-z]+\s*=|javascript:/i.test(text)) add('svg-safety', 'warn', 'SVG contains script, event handlers or javascript: URLs; sanitise it before inlining');
  }
  if (Number.isInteger(asset.bytes) && asset.bytes !== st.size) add('bytes', 'warn', `declared ${asset.bytes} bytes but the file has ${st.size}`);
}

async function checkAsset(asset, ctx) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  const measured = {};
  const a = asset && typeof asset === 'object' && !Array.isArray(asset) ? asset : {};

  // License
  if (typeof a.license !== 'string' || a.license.trim() === '') add('license', 'fail', 'license is missing; record the license or ownership (e.g. "CC0-1.0", "original (project-owned)")');
  else if (LICENSE_PLACEHOLDER.test(a.license.trim())) add('license', 'fail', `license ${JSON.stringify(a.license)} is not a license; record the actual license or ownership`);
  else add('license', 'pass', a.license);

  // Fallback (required for critical assets; references must resolve)
  if (a.critical === true && !hasFallback(a.fallback)) {
    add('fallback', 'fail', 'critical asset has no fallback; describe what renders if it fails (poster, color, gradient, static image)');
  } else if (hasFallback(a.fallback)) {
    const fb = a.fallback;
    const problems = [];
    if (fb && typeof fb === 'object') {
      if (typeof fb.assetId === 'string' && fb.assetId && !ctx.ids.has(fb.assetId)) problems.push(`fallback assetId "${fb.assetId}" is not in the manifest`);
      if (typeof fb.assetId === 'string' && fb.assetId === a.id) problems.push('fallback assetId points to the asset itself');
      if (typeof fb.path === 'string' && fb.path) {
        const res = resolveAssetPath(ctx.root, fb.path);
        if (!res.ok) problems.push(`fallback path rejected: ${res.reason}`);
        else if (!ctx.example && !(await statOrNull(res.abs))?.isFile()) problems.push(`fallback file not found: ${fb.path}`);
      }
    }
    if (problems.length) add('fallback', a.critical === true ? 'fail' : 'warn', problems.join('; '));
    else add('fallback', 'pass', typeof fb === 'string' ? fb : JSON.stringify(fb));
  }

  // Secrets in prompts and generator metadata (values are never reported)
  const hits = scanSecrets(JSON.stringify(a));
  let promptRefHits = [];
  if (typeof a.promptRef === 'string' && /[/\\]|\.[A-Za-z0-9]+$/.test(a.promptRef)) {
    const res = resolveAssetPath(ctx.root, a.promptRef);
    if (!res.ok) add('prompt-ref', 'fail', `promptRef rejected: ${res.reason}`);
    else if (!ctx.example) {
      const st = await statOrNull(res.abs);
      if (st?.isFile() && st.size <= PROMPT_READ_LIMIT) promptRefHits = scanSecrets(await readText(res.abs));
      else if (!st) add('prompt-ref', 'warn', `promptRef file not found: ${a.promptRef}`);
    }
  }
  if (hits.length || promptRefHits.length) {
    const ids = [...new Set([...hits, ...promptRefHits].map((h) => h.pattern))].join(', ');
    add('secrets', 'fail', `secret-like value in ${hits.length ? 'asset metadata' : 'the promptRef file'} (pattern: ${ids}); remove credentials from prompts and generator params`);
  } else {
    add('secrets', 'pass', 'no secret-like values in prompt or generator metadata');
  }

  // File checks
  if (typeof a.path === 'string') {
    const res = resolveAssetPath(ctx.root, a.path);
    if (!res.ok) {
      add('path', 'fail', `${res.reason}: ${JSON.stringify(a.path)}`);
    } else if (ctx.example) {
      add('exists', 'not-tested', 'example manifest: file not checked');
    } else {
      const st = await statOrNull(res.abs);
      if (!st) add('exists', 'fail', `file not found: ${relPosix(ctx.root, res.abs)}`);
      else if (!st.isFile()) add('exists', 'fail', `not a regular file: ${relPosix(ctx.root, res.abs)}`);
      else if (!(await confinedRealpath(ctx.root, res.abs))) add('path', 'fail', 'file resolves outside the root through a symbolic link or junction');
      else {
        add('exists', 'pass', `${relPosix(ctx.root, res.abs)} (${formatBytes(st.size)})`);
        await checkFileContent(a, res.abs, st, ctx, add, measured);
      }
    }
  } else if (typeof a.uri === 'string') {
    add('exists', 'not-tested', 'remote/runtime uri is not fetched; verify it in the browser (visual-check)');
  } else {
    add('path', 'fail', 'asset has neither "path" nor "uri"');
  }

  // Aspect ratio (measured dimensions first, else declared ones)
  if (a.aspectRatio !== undefined) {
    const target = parseAspectRatio(a.aspectRatio);
    const src = measured.width && measured.height
      ? { w: measured.width, h: measured.height, from: 'file' }
      : a.dimensions && a.dimensions.width > 0 && a.dimensions.height > 0
        ? { w: a.dimensions.width, h: a.dimensions.height, from: 'declared dimensions' }
        : null;
    if (!target) add('aspect-ratio', 'fail', `aspectRatio ${JSON.stringify(a.aspectRatio)} is not a valid ratio`);
    else if (!src) add('aspect-ratio', 'not-tested', 'no measured or declared dimensions to compare');
    else {
      const actual = src.w / src.h;
      const diff = Math.abs(actual - target) / target;
      const msg = `${src.from} ${src.w}x${src.h} = ${actual.toFixed(4)} vs aspectRatio ${a.aspectRatio} = ${target.toFixed(4)} (${(diff * 100).toFixed(2)}% off; tolerance ${ASPECT_TOLERANCE * 100}%)`;
      add('aspect-ratio', diff <= ASPECT_TOLERANCE + 1e-9 ? 'pass' : 'fail', msg);
    }
  }

  // Budget (measured size, else declared bytes)
  const { category, limit } = budgetFor(a, ctx.budgets);
  const size = measured.bytes ?? (Number.isInteger(a.bytes) ? a.bytes : null);
  const sizeFrom = measured.bytes !== undefined ? 'file' : 'declared';
  if (limit === null) add('budget', 'skipped', `no ${category} budget configured`);
  else if (size === null) add('budget', 'not-tested', 'size unknown (no local file and no declared bytes)');
  else if (size > limit) add('budget', 'fail', `${formatBytes(size)} (${sizeFrom}) exceeds the ${category} budget of ${formatBytes(limit)}`);
  else add('budget', 'pass', `${formatBytes(size)} (${sizeFrom}) within the ${category} budget of ${formatBytes(limit)}`);

  // Advisory checks
  if (ALT_TYPES.has(a.type) && typeof a.alt !== 'string') add('alt', 'warn', 'no alt text recorded; use "" for decorative images');
  if (a.optimization === 'pending') add('optimization', 'warn', 'optimization is still pending');
  if (a.loading === 'lazy' && /hero/i.test(String(a.role ?? ''))) add('loading', 'warn', 'hero assets are usually the LCP element; do not lazy-load them');
  if (a.validation?.status === 'failed') add('recorded-validation', 'warn', 'the manifest records a failed validation for this asset');
  if (a.source === 'placeholder') add('placeholder', 'warn', 'placeholder asset: replace it before launch and list it in the final report');

  const status = checks.some((c) => c.status === 'fail') ? 'fail'
    : checks.some((c) => c.status === 'not-tested') ? 'not-tested'
      : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return {
    id: typeof a.id === 'string' ? a.id : null,
    type: a.type ?? null,
    role: a.role ?? null,
    path: typeof a.path === 'string' ? a.path : null,
    uri: typeof a.uri === 'string' ? a.uri : null,
    critical: a.critical === true,
    status,
    measured,
    checks,
    size: size ?? null,
  };
}

let cachedSchema = null;

/** Load the bundled asset-manifest schema (cached). @returns {Promise<object>} */
export async function loadManifestSchema() {
  if (!cachedSchema) cachedSchema = JSON.parse(await readText(SCHEMA_PATH));
  return cachedSchema;
}

/**
 * Validate a parsed asset manifest against files under `root`.
 * @param {any} manifest parsed manifest JSON
 * @param {string} root project root that asset paths are relative to
 * @param {{schema?: object, ffprobe?: boolean|string, manifestLabel?: string}} [options]
 *   ffprobe: false disables probing (deterministic runs); a string names the executable.
 * @returns {Promise<object>} JSON report with overall PASS | FAIL | INCOMPLETE and exitCode.
 */
export async function validateManifest(manifest, root, options = {}) {
  const rootAbs = path.resolve(root ?? process.cwd());
  const schema = options.schema ?? (await loadManifestSchema());
  const isObj = manifest !== null && typeof manifest === 'object' && !Array.isArray(manifest);
  const m = isObj ? manifest : {};
  const assets = Array.isArray(m.assets) ? m.assets : [];
  const manifestChecks = [];
  const addM = (id, status, message, details) => manifestChecks.push(details ? { id, status, message, details } : { id, status, message });

  const schemaErrors = formatErrors(validate(schema, manifest).errors);
  if (schemaErrors.length) addM('schema', 'fail', `${schemaErrors.length} schema error(s)`, schemaErrors);
  else addM('schema', 'pass', 'manifest matches schemas/asset-manifest.schema.json');

  const ids = new Set();
  const dupes = new Set();
  for (const asset of assets) {
    if (typeof asset?.id !== 'string') continue;
    if (ids.has(asset.id)) dupes.add(asset.id);
    ids.add(asset.id);
  }
  if (dupes.size) addM('unique-ids', 'fail', `duplicate asset ids: ${[...dupes].join(', ')}`);

  const { assets: _omit, ...topLevel } = m;
  const topHits = scanSecrets(JSON.stringify(topLevel));
  if (topHits.length) addM('secrets', 'fail', `secret-like value in manifest metadata (pattern: ${[...new Set(topHits.map((h) => h.pattern))].join(', ')})`);

  let ffprobeState = 'not-needed';
  const ctx = {
    root: rootAbs,
    ids,
    example: m.example === true,
    budgets: m.budgets && typeof m.budgets === 'object' ? m.budgets : {},
    ffprobeOption: options.ffprobe,
    probe() {
      const found = findFfprobe(options.ffprobe);
      ffprobeState = options.ffprobe === false ? 'disabled' : found ? 'available' : 'unavailable';
      return found;
    },
  };
  if (ctx.example) addM('example', 'not-tested', 'example manifest: file existence, format, dimensions and durations are not checked');

  const results = [];
  for (const asset of assets) results.push(await checkAsset(asset, ctx));

  const totalBytes = results.reduce((sum, r) => sum + (r.size ?? 0), 0);
  if (Number.isInteger(ctx.budgets.total)) {
    if (totalBytes > ctx.budgets.total) addM('total-budget', 'fail', `total ${formatBytes(totalBytes)} exceeds the total budget of ${formatBytes(ctx.budgets.total)}`);
    else addM('total-budget', 'pass', `total ${formatBytes(totalBytes)} within ${formatBytes(ctx.budgets.total)}`);
  }

  const all = [...manifestChecks, ...results.flatMap((r) => r.checks)];
  const criticalFailures = all.filter((c) => c.status === 'fail').length;
  const notTested = all.filter((c) => c.status === 'not-tested').length;
  const overall = criticalFailures ? 'FAIL' : notTested ? 'INCOMPLETE' : 'PASS';
  return {
    tool: 'asset-validation',
    gate: 'G',
    manifest: options.manifestLabel ?? null,
    root: rootAbs,
    example: ctx.example,
    generatedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, ffprobe: ffprobeState },
    overall,
    exitCode: EXIT[overall],
    summary: {
      assets: results.length,
      pass: results.filter((r) => r.status === 'pass').length,
      warn: results.filter((r) => r.status === 'warn').length,
      notTested: results.filter((r) => r.status === 'not-tested').length,
      fail: results.filter((r) => r.status === 'fail').length,
      criticalFailures,
      notTestedChecks: notTested,
      totalBytes,
    },
    budgets: { ...DEFAULT_BUDGETS, ...ctx.budgets },
    manifestChecks,
    assets: results.map(({ size, ...rest }) => rest),
  };
}

function summaryText(report) {
  const lines = [`asset-validation (Gate G): ${report.overall} (exit ${report.exitCode})`];
  for (const c of report.manifestChecks) if (c.status !== 'pass') lines.push(`  manifest ${c.id}: ${c.status} - ${c.message}`);
  for (const a of report.assets) {
    lines.push(`  ${a.id ?? '(no id)'}: ${a.status}`);
    for (const c of a.checks) if (c.status === 'fail' || c.status === 'warn' || c.status === 'not-tested') lines.push(`    ${c.id}: ${c.status} - ${c.message}`);
  }
  const s = report.summary;
  lines.push(`assets ${s.assets}: ${s.pass} pass, ${s.warn} warn, ${s.notTested} not-tested, ${s.fail} fail; ${s.criticalFailures} critical failure(s)`);
  return lines.join('\n');
}

const HELP = `Usage:
  node scripts/asset-validation.mjs --manifest <file> [--root <dir>] [--summary]
                                    [--out <file> [--force]] [--skip-ffprobe]

Gate G (asset integrity). Validates an asset manifest against
schemas/asset-manifest.schema.json, then checks every asset:
  path      relative to --root; ../ traversal, URLs and absolute paths outside the root
            are rejected; symbolic links may not leave the root
  exists    the file is present (example manifests: not-tested)
  format    magic-byte sniff (png, jpeg, gif, webp, avif, svg, mp4/mov/m4a, webm, ogg,
            mp3, wav, glb, fonts) must match the declared format
  dimensions png/jpeg/gif/webp/avif/svg header vs declared dimensions
  aspect-ratio  within 1% of the declared aspectRatio
  duration  WAV from the header; other audio/video via ffprobe when installed, else
            not-tested
  budget    bytes vs manifest budgets or defaults: image 500 KiB, hero/background image
            800 KiB, video 6 MiB, audio 1.5 MiB, model3d 5 MiB
  license   required; "unknown" and similar placeholders fail
  fallback  required for critical assets; assetId/path references must resolve
  secrets   prompts, generator params and promptRef files must hold no credentials
  placeholder  source "placeholder" warns until the asset is replaced
Statuses: fail = critical failure, warn = advisory, not-tested = not verified here.

Options:
  --manifest <file>  Asset manifest JSON (required).
  --root <dir>       Project root that asset paths are relative to (default: current dir).
  --summary          Print a text summary instead of the JSON report.
  --out <file>       Write the JSON report to this file and print the summary.
  --force            Allow --out to replace an existing file.
  --skip-ffprobe     Do not run ffprobe (durations of non-WAV media become not-tested).
  -h, --help         Show this help.

Exit codes:
  0   PASS (every check passed)
  1   FAIL (at least one critical failure, including schema errors)
  2   INCOMPLETE (no failures, but some checks are not-tested)
  3   invalid input (manifest unreadable or not JSON)
  64  usage error (bad arguments, root missing, refusing to overwrite --out)
`;

/**
 * CLI entry point.
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export async function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        manifest: { type: 'string' },
        root: { type: 'string' },
        summary: { type: 'boolean', default: false },
        out: { type: 'string' },
        force: { type: 'boolean', default: false },
        'skip-ffprobe': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n\n${HELP}`);
    return EXIT.USAGE;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return EXIT.PASS;
  }
  if (!args.manifest) {
    process.stderr.write(`Error: --manifest <file> is required.\n\n${HELP}`);
    return EXIT.USAGE;
  }
  if (args.force && !args.out) {
    process.stderr.write('Error: --force only applies together with --out.\n');
    return EXIT.USAGE;
  }
  const root = path.resolve(args.root ?? process.cwd());
  const rootStat = await statOrNull(root);
  if (!rootStat || !rootStat.isDirectory()) {
    process.stderr.write(`Error: --root is not a directory: ${root}\n`);
    return EXIT.USAGE;
  }
  const manifestPath = path.resolve(args.manifest);
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    return EXIT.INVALID;
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    process.stderr.write('Error: the manifest must be a JSON object.\n');
    return EXIT.INVALID;
  }
  const report = await validateManifest(manifest, root, {
    ffprobe: args['skip-ffprobe'] ? false : undefined,
    manifestLabel: manifestPath,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    const outPath = path.resolve(args.out);
    if (outPath.toLowerCase() === manifestPath.toLowerCase()) {
      process.stderr.write('Error: --out must not be the manifest itself.\n');
      return EXIT.USAGE;
    }
    try {
      await writeFileSafe(outPath, json, { force: args.force });
    } catch (e) {
      process.stderr.write(`Error: ${e.message}\n`);
      return EXIT.USAGE;
    }
    process.stdout.write(`${summaryText(report)}\nReport written to ${outPath}\n`);
  } else {
    process.stdout.write(args.summary ? `${summaryText(report)}\n` : json);
  }
  return report.exitCode;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`);
      process.exitCode = EXIT.FAIL;
    },
  );
}
