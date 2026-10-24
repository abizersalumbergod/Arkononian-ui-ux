// Zero-dependency file-system and Markdown helpers for the ultimate-uiux skill scripts.
// Node >= 18, ESM. Cross-platform: all returned paths are absolute native paths unless noted;
// helpers named *Posix return forward-slash relative paths for stable reporting.

import { readFile, readdir, stat, access, writeFile, mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the skill package root (two levels above scripts/lib). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * True when the module with this `import.meta.url` is the script Node was started with.
 * Resolves symlinks/junctions on both sides (skills are often linked into ~/.claude/skills).
 * @param {string} importMetaUrl
 * @returns {boolean}
 */
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const a = real(process.argv[1]);
  const b = real(fileURLToPath(importMetaUrl));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Directory names skipped by walk() unless the caller overrides `exclude`. */
export const DEFAULT_EXCLUDES = Object.freeze(['node_modules', '.git']);

/**
 * Read a UTF-8 text file and strip a leading byte-order mark.
 * @param {string} file
 * @returns {Promise<string>}
 */
export async function readText(file) {
  const text = await readFile(file, 'utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Read and parse a JSON file. Errors carry `code` ('ENOENT' | 'EJSONPARSE' | fs code)
 * and a message that names the file.
 * @param {string} file
 * @returns {Promise<any>}
 */
export async function readJson(file) {
  let text;
  try {
    text = await readText(file);
  } catch (e) {
    const error = new Error(e.code === 'ENOENT' ? `File not found: ${file}` : `Cannot read ${file}: ${e.message}`);
    error.code = e.code;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const error = new Error(`Invalid JSON in ${file}: ${e.message}`);
    error.code = 'EJSONPARSE';
    throw error;
  }
}

/**
 * True when the path exists (file or directory). Never throws.
 * @param {string} p
 * @returns {Promise<boolean>}
 */
export async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stat a path, returning null instead of throwing when it does not exist.
 * @param {string} p
 * @returns {Promise<import('node:fs').Stats|null>}
 */
export async function statOrNull(p) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

/**
 * Convert a path to forward slashes.
 * @param {string} p
 * @returns {string}
 */
export function toPosix(p) {
  return p.split(path.sep).join('/').replace(/\\/g, '/');
}

/**
 * Relative forward-slash path from `root` to `p`.
 * @param {string} root
 * @param {string} p
 * @returns {string}
 */
export function relPosix(root, p) {
  return toPosix(path.relative(root, p));
}

/**
 * True when `p` is `root` itself or inside it (after resolution). Case-insensitive on Windows.
 * @param {string} root
 * @param {string} p
 * @returns {boolean}
 */
export function isInside(root, p) {
  const rel = path.relative(path.resolve(root), path.resolve(p));
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Recursively list files under `dir` (absolute paths, sorted). Symbolic links and junctions
 * are not followed. `exclude` entries are either bare directory/file names (matched at any
 * depth, e.g. "node_modules") or forward-slash paths relative to `dir` (e.g. "tests/fixtures").
 * @param {string} dir
 * @param {{exclude?: string[], includeDirs?: boolean}} [options]
 * @returns {Promise<string[]>}
 */
export async function walk(dir, options = {}) {
  const exclude = options.exclude ?? DEFAULT_EXCLUDES;
  const names = new Set(exclude.filter((e) => !e.includes('/')));
  const rels = exclude.filter((e) => e.includes('/')).map((e) => e.replace(/\/+$/, ''));
  const out = [];
  const root = path.resolve(dir);

  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (e) {
      if (current === root) throw e;
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const rel = relPosix(root, full);
      if (names.has(entry.name) || rels.some((r) => rel === r || rel.startsWith(`${r}/`))) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (options.includeDirs) out.push(full);
        await visit(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }

  await visit(root);
  return out;
}

/**
 * Write a file, creating parent directories. Refuses to overwrite an existing file unless
 * `force` is true (scripts only pass force for an explicit --out target plus --force).
 * @param {string} file
 * @param {string|Uint8Array} content
 * @param {{force?: boolean}} [options]
 * @returns {Promise<void>}
 */
export async function writeFileSafe(file, content, options = {}) {
  if (!options.force && (await exists(file))) {
    const error = new Error(`Refusing to overwrite existing file: ${file} (pass --force to replace it)`);
    error.code = 'EEXIST';
    throw error;
  }
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, content);
}

// ---------------------------------------------------------------------------------------------
// Front matter (YAML subset)
// ---------------------------------------------------------------------------------------------

/**
 * Parse a leading YAML front-matter block ("---" ... "---").
 * Supports maps, nested maps, block lists ("- item"), flow lists ("[a, b]"), single- and
 * double-quoted scalars, plain (multi-line) scalars, and block scalars (">", ">-", "|", "|-").
 * @param {string} text Full Markdown file contents.
 * @returns {{data: object|null, body: string, error: string|null, endLine: number}}
 *   `data` is null when there is no front matter; `error` describes a malformed block;
 *   `endLine` is the 1-based line number of the closing delimiter (0 when absent).
 */
export function parseFrontmatter(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const lines = src.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { data: null, body: src, error: null, endLine: 0 };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '---' || t === '...') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { data: null, body: src, error: 'front matter is not closed (missing closing "---" line)', endLine: 0 };
  }
  const body = lines.slice(end + 1).join('\n');
  try {
    const data = parseYamlSubset(lines.slice(1, end));
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, body, error: 'front matter must be a mapping of key: value pairs', endLine: end + 1 };
    }
    return { data, body, error: null, endLine: end + 1 };
  } catch (e) {
    return { data: null, body, error: e.message, endLine: end + 1 };
  }
}

function lineInfo(raw, index) {
  if (/^\s*\t/.test(raw) && raw.trim() !== '') {
    throw new Error(`front matter line ${index + 2}: tabs are not allowed for indentation`);
  }
  const indent = raw.length - raw.trimStart().length;
  const trimmed = raw.trim();
  return { raw, indent, text: trimmed, blank: trimmed === '' || trimmed.startsWith('#'), n: index + 2 };
}

function parseYamlSubset(rawLines) {
  const lines = rawLines.map(lineInfo);
  const state = { lines, i: 0 };
  skipBlank(state);
  if (state.i >= lines.length) return {};
  const first = lines[state.i];
  const value = first.text.startsWith('- ') || first.text === '-'
    ? parseList(state, first.indent)
    : parseMap(state, first.indent);
  skipBlank(state);
  if (state.i < lines.length) {
    throw new Error(`front matter line ${lines[state.i].n}: unexpected indentation or structure`);
  }
  return value;
}

function skipBlank(state) {
  while (state.i < state.lines.length && state.lines[state.i].blank) state.i++;
}

function parseMap(state, indent) {
  const obj = {};
  while (true) {
    skipBlank(state);
    if (state.i >= state.lines.length) break;
    const line = state.lines[state.i];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`front matter line ${line.n}: unexpected indentation`);
    const m = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:#'"][^:]*?|[^\s:#][^:]*?)\s*:(?:\s+(.*)|\s*)$/.exec(line.text);
    if (!m) throw new Error(`front matter line ${line.n}: expected "key: value" but found "${truncate(line.text)}"`);
    const key = unquoteKey(m[1]);
    if (Object.prototype.hasOwnProperty.call(obj, key)) throw new Error(`front matter line ${line.n}: duplicate key "${key}"`);
    state.i++;
    obj[key] = parseValue(state, line, (m[2] ?? '').trim());
  }
  return obj;
}

function parseList(state, indent) {
  const arr = [];
  while (true) {
    skipBlank(state);
    if (state.i >= state.lines.length) break;
    const line = state.lines[state.i];
    if (line.indent < indent) break;
    if (line.indent > indent || !(line.text.startsWith('- ') || line.text === '-')) {
      if (line.indent === indent) break;
      throw new Error(`front matter line ${line.n}: unexpected indentation in list`);
    }
    const rest = line.text === '-' ? '' : line.text.slice(2).trim();
    const kv = /^([^\s:#'"][^:]*?)\s*:(?:\s+(.*)|\s*)$/.exec(rest);
    if (kv && !/^[[{"']/.test(rest)) {
      // "- key: value" starts a map item; continue the map at the item's content indent.
      const itemIndent = line.indent + (line.raw.trimStart().length - line.raw.trimStart().slice(1).trimStart().length);
      state.lines[state.i] = { ...line, indent: itemIndent, text: rest };
      arr.push(parseMap(state, itemIndent));
    } else {
      state.i++;
      arr.push(parseValue(state, line, rest));
    }
  }
  return arr;
}

function parseValue(state, ownerLine, value) {
  if (value === '' || value.startsWith('#')) {
    skipBlank(state);
    const next = state.lines[state.i];
    if (!next) return null;
    if (next.indent > ownerLine.indent) {
      return next.text.startsWith('- ') || next.text === '-' ? parseList(state, next.indent) : parseMap(state, next.indent);
    }
    if (next.indent === ownerLine.indent && (next.text.startsWith('- ') || next.text === '-')) {
      return parseList(state, next.indent);
    }
    return null;
  }
  const block = /^([>|])([+-]?)(\d?)([+-]?)\s*(#.*)?$/.exec(value);
  if (block) return parseBlockScalar(state, ownerLine, block[1], block[2] || block[4]);
  if (value.startsWith('"')) return parseDoubleQuoted(state, value, ownerLine);
  if (value.startsWith("'")) return parseSingleQuoted(state, value, ownerLine);
  if (value.startsWith('[')) return parseFlowList(value, ownerLine);
  if (value.startsWith('{')) return value;
  // Plain scalar, possibly continued on more-indented lines.
  let text = stripComment(value);
  while (state.i < state.lines.length) {
    const next = state.lines[state.i];
    if (next.text === '' ) {
      state.i++;
      continue;
    }
    if (next.indent <= ownerLine.indent) break;
    text += ` ${stripComment(next.text)}`;
    state.i++;
  }
  return coerceScalar(text.trim());
}

function parseBlockScalar(state, ownerLine, style, chomp) {
  const collected = [];
  let blockIndent = -1;
  while (state.i < state.lines.length) {
    const line = state.lines[state.i];
    if (line.raw.trim() === '') {
      collected.push('');
      state.i++;
      continue;
    }
    if (line.indent <= ownerLine.indent) break;
    if (blockIndent === -1) blockIndent = line.indent;
    if (line.indent < blockIndent) break;
    collected.push(line.raw.slice(blockIndent));
    state.i++;
  }
  // Trailing blank lines belong to chomping, not content.
  let trailing = 0;
  while (collected.length && collected[collected.length - 1] === '') {
    collected.pop();
    trailing++;
  }
  let out;
  if (style === '|') {
    out = collected.join('\n');
  } else {
    out = '';
    for (let i = 0; i < collected.length; i++) {
      const cur = collected[i];
      if (i === 0) out = cur;
      else if (cur === '') out += '\n';
      else if (collected[i - 1] === '' || /^\s/.test(cur)) out += (out.endsWith('\n') ? '' : '\n') + cur;
      else out += ` ${cur}`;
    }
  }
  if (chomp === '-') return out;
  if (chomp === '+') return `${out}\n${'\n'.repeat(trailing)}`;
  return collected.length ? `${out}\n` : '';
}

function parseDoubleQuoted(state, first, ownerLine) {
  let text = first;
  while (!closesQuote(text, '"')) {
    const next = state.lines[state.i];
    if (!next || next.indent <= ownerLine.indent && next.text !== '') {
      throw new Error(`front matter line ${ownerLine.n}: unterminated double-quoted string`);
    }
    text += ` ${next.text}`;
    state.i++;
  }
  const end = findClosingQuote(text, '"');
  const rest = text.slice(end + 1).trim();
  if (rest && !rest.startsWith('#')) throw new Error(`front matter line ${ownerLine.n}: unexpected text after quoted string`);
  return text.slice(1, end).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, c) => {
    if (c[0] === 'u' || c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', ' ': ' ' }[c] ?? c;
  });
}

function parseSingleQuoted(state, first, ownerLine) {
  let text = first;
  while (!closesQuote(text, "'")) {
    const next = state.lines[state.i];
    if (!next || next.indent <= ownerLine.indent && next.text !== '') {
      throw new Error(`front matter line ${ownerLine.n}: unterminated single-quoted string`);
    }
    text += ` ${next.text}`;
    state.i++;
  }
  const end = findClosingQuote(text, "'");
  const rest = text.slice(end + 1).trim();
  if (rest && !rest.startsWith('#')) throw new Error(`front matter line ${ownerLine.n}: unexpected text after quoted string`);
  return text.slice(1, end).replace(/''/g, "'");
}

function findClosingQuote(text, q) {
  for (let i = 1; i < text.length; i++) {
    if (q === '"' && text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === q) {
      if (q === "'" && text[i + 1] === "'") {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

function closesQuote(text, q) {
  return findClosingQuote(text, q) !== -1;
}

function parseFlowList(value, ownerLine) {
  const close = value.lastIndexOf(']');
  if (close === -1) throw new Error(`front matter line ${ownerLine.n}: unterminated flow list`);
  const inner = value.slice(1, close).trim();
  if (inner === '') return [];
  const items = [];
  let cur = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ',') {
      items.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  items.push(cur.trim());
  return items.map((item) => {
    if (item.startsWith('"') && item.endsWith('"')) return item.slice(1, -1).replace(/\\"/g, '"');
    if (item.startsWith("'") && item.endsWith("'")) return item.slice(1, -1).replace(/''/g, "'");
    return coerceScalar(item);
  });
}

function stripComment(value) {
  const idx = value.search(/\s#/);
  return idx === -1 ? value : value.slice(0, idx).trimEnd();
}

function unquoteKey(key) {
  if (key.startsWith('"') && key.endsWith('"')) return key.slice(1, -1);
  if (key.startsWith("'") && key.endsWith("'")) return key.slice(1, -1).replace(/''/g, "'");
  return key.trim();
}

function coerceScalar(text) {
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  if (/^(null|Null|NULL|~)$/.test(text)) return null;
  if (/^[-+]?\d+$/.test(text) && Number.isSafeInteger(Number(text))) return Number(text);
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(text)) return Number(text);
  return text;
}

function truncate(s, n = 50) {
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
}

// ---------------------------------------------------------------------------------------------
// Markdown links
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} MarkdownLink
 * @property {string} target   Raw link destination as written.
 * @property {string} path     Decoded path part (no #anchor or ?query); '' for same-file anchors.
 * @property {string|null} anchor Fragment without '#', or null.
 * @property {string} text     Link text (or reference label).
 * @property {number} line     1-based line number.
 * @property {'inline'|'image'|'reference'|'html'} kind
 */

/**
 * Extract relative links from Markdown. Ignores links inside fenced code blocks and inline
 * code spans, absolute URLs (http:, https:, mailto: and any other scheme), protocol-relative
 * URLs ("//host"), and pure same-file anchors ("#section").
 * @param {string} markdown
 * @returns {MarkdownLink[]}
 */
export function extractLinks(markdown) {
  const links = [];
  const lines = String(markdown ?? '').split(/\r?\n/);
  let fence = null;
  const inline = /(!?)\[((?:[^[\]\\]|\\.|\[[^[\]]*\])*)\]\(\s*(<[^>\n]*>|(?:[^\s()\\]|\\.|\([^\s()]*\))+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  const refDef = /^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/;
  const html = /<(?:a|img|source|video|audio|link)\b[^>]*?\s(?:href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  lines.forEach((rawLine, idx) => {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(rawLine);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length && rawLine.trim().replace(/[`~]/g, '') === '') fence = null;
      return;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      return;
    }
    const line = stripInlineCode(rawLine);
    const n = idx + 1;
    const def = refDef.exec(line);
    if (def) {
      pushLink(links, def[2], def[1], n, 'reference');
      return;
    }
    for (const m of line.matchAll(inline)) pushLink(links, m[3], m[2], n, m[1] ? 'image' : 'inline');
    for (const m of line.matchAll(html)) pushLink(links, m[2] ?? m[3] ?? '', '', n, 'html');
  });
  return links;
}

function stripInlineCode(line) {
  return line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (s) => ' '.repeat(s.length));
}

function pushLink(links, rawTarget, text, line, kind) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1).trim();
  if (target === '' || target.startsWith('#') || target.startsWith('//')) return;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) && !/^[A-Za-z]:[\\/]/.test(target)) return; // any URL scheme
  const hashIdx = target.indexOf('#');
  const anchor = hashIdx === -1 ? null : target.slice(hashIdx + 1);
  let p = hashIdx === -1 ? target : target.slice(0, hashIdx);
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw path when it is not valid percent-encoding
  }
  links.push({ target, path: p.replace(/\\([()[\]])/g, '$1'), anchor, text, line, kind });
}

/**
 * GitHub-style heading slugs present in a Markdown document (for anchor checks).
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function headingSlugs(markdown) {
  const slugs = new Set();
  const counts = new Map();
  let fence = null;
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0]) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!h) continue;
    const base = h[1]
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s/g, '-');
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    slugs.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return slugs;
}

// ---------------------------------------------------------------------------------------------
// Secret scanning
// ---------------------------------------------------------------------------------------------

/** Secret patterns shared by validate-skill and asset-validation. Values are never printed. */
export const SECRET_PATTERNS = Object.freeze([
  { id: 'openai-anthropic-style-key', re: /\bsk-(?:ant-|proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g },
  { id: 'aws-access-key-id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g },
  { id: 'github-fine-grained-pat', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { id: 'bearer-hex-token', re: /\bBearer\s+[A-Fa-f0-9]{32,}\b/g },
  { id: 'private-key-block', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
]);

/**
 * Find secret-like strings in text. Returned previews are redacted (first 4 characters only).
 * @param {string} text
 * @returns {{pattern: string, line: number, column: number, preview: string}[]}
 */
export function scanSecrets(text) {
  const hits = [];
  const src = String(text ?? '');
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  for (const { id, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= m.index) lo = mid;
        else hi = mid - 1;
      }
      hits.push({ pattern: id, line: lo + 1, column: m.index - lineStarts[lo] + 1, preview: `${m[0].slice(0, 4)}…[redacted]` });
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.column - b.column);
}
