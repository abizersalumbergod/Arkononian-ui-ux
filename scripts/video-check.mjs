#!/usr/bin/env node
// Video deliverable checks for the arkononion-ui-ux skill (feeds Gates B, C and G for films).
// Zero dependencies; Node >= 18 ESM; Windows and POSIX. Read-only: writes nothing, no network.
//
//   --spec <file>      validate a film plan (templates/video-spec.json shape) and its numeric rules
//   --project <dir>    statically scan a HyperFrames project: root duration, scene mounts, forbidden patterns
//   --render <file>    measure a rendered file's duration from its container (MP4/MOV header; no ffprobe needed)
//
// The modes can be combined; then plan, composition and render are cross-checked against each other.
// "At least one minute" is a floor on every duration found (default 60 s, --min-seconds to change).

import { open } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { validate, formatErrors } from './lib/schema.mjs';
import { PACKAGE_ROOT, readJson, readText, statOrNull, walk, relPosix, isMainModule } from './lib/fsutil.mjs';

/** Process exit codes. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCOMPLETE: 2, INVALID: 3, USAGE: 64 });

/** Numeric defaults (judgement defaults documented in references/hyperframes-video.md). */
export const DEFAULTS = Object.freeze({
  minSeconds: 60,
  toleranceSeconds: 0.5,
  gapSeconds: 0.05,
  maxOverlapSeconds: 1,
  maxCharsPerSecond: 17,
  hardCharsPerSecond: 25,
  minTextSeconds: 1.5,
  textAllowanceSeconds: 0.8,
  maxHookSeconds: 10,
  maxUnchangedSeconds: 6,
  longBeatSeconds: 8,
  longHoldSeconds: 15,
  minEndCardSeconds: 3,
  musicFromSeconds: 15,
});

const CTA_KINDS = new Set(['demo', 'launch', 'promo', 'teaser']);
const SCAN_EXCLUDES = ['node_modules', '.git', '.hyperframes', 'renders', 'dist'];
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const finding = (level, code, message, where) => ({ level, code, message, ...(where ? { where } : {}) });
const err = (code, message, where) => finding('error', code, message, where);
const warn = (code, message, where) => finding('warning', code, message, where);
const info = (code, message, where) => finding('info', code, message, where);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function statusOf(findings, incomplete = false) {
  if (findings.some((f) => f.level === 'error')) return 'fail';
  return incomplete ? 'incomplete' : 'pass';
}

// ---------------------------------------------------------------------------------------------
// Mode 1: the plan
// ---------------------------------------------------------------------------------------------

/** Load and parse schemas/video-spec.schema.json. */
export async function loadSpecSchema() {
  return readJson(path.join(PACKAGE_ROOT, 'schemas', 'video-spec.schema.json'));
}

/**
 * Check a film plan. Schema errors stop the numeric checks (the numbers would be unreliable).
 * @param {object} spec Parsed video spec.
 * @param {{schema?: object, minSeconds?: number}} [options]
 * @returns {Promise<{mode: 'spec', status: string, findings: object[], data: object}>}
 */
export async function checkSpec(spec, options = {}) {
  const schema = options.schema ?? (await loadSpecSchema());
  const findings = formatErrors(validate(schema, spec).errors).map((m) => err('schema', m));
  if (findings.length) return { mode: 'spec', status: 'fail', findings, data: {} };

  const T = DEFAULTS;
  const floor = options.minSeconds ?? spec.minDurationSeconds;
  const scenes = spec.scenes;
  const total = Math.max(...scenes.map((s) => s.start + s.duration));

  if (total + 1e-9 < floor) {
    findings.push(err('runtime', `The plan runs ${round(total)} s, below the ${floor} s floor. Add a real chapter (setup, workflow, outcome); do not pad with holds or filler.`));
  }
  if (spec.targetDurationSeconds !== undefined) {
    if (Math.abs(spec.targetDurationSeconds - total) > 1) {
      findings.push(warn('target', `targetDurationSeconds is ${spec.targetDurationSeconds} but the scenes add up to ${round(total)} s.`));
    }
    if (spec.targetDurationSeconds < floor) findings.push(warn('target', `targetDurationSeconds ${spec.targetDurationSeconds} is below the ${floor} s floor.`));
  }

  if (spec.canvas.width % 2 || spec.canvas.height % 2) {
    findings.push(err('canvas-even', `Canvas ${spec.canvas.width}x${spec.canvas.height} has an odd side; H.264 yuv420p needs even dimensions.`));
  }
  if (!spec.engine?.version) findings.push(warn('engine-unpinned', 'engine.version is not set; pin the HyperFrames CLI version the project was built with.'));

  const ids = new Set();
  scenes.forEach((s, i) => {
    const where = `scenes[${i}] (${s.id})`;
    if (ids.has(s.id)) findings.push(err('duplicate-id', `Scene id "${s.id}" is used twice.`, where));
    ids.add(s.id);
    if (i > 0 && s.start < scenes[i - 1].start) findings.push(err('order', 'Scenes must be listed in start order.', where));
  });

  if (Math.abs(scenes[0].start) > T.gapSeconds) findings.push(err('first-start', `The first scene starts at ${scenes[0].start} s; the film must start at 0.`, 'scenes[0]'));
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const gap = scenes[i].start - (prev.start + prev.duration);
    const where = `scenes[${i}] (${scenes[i].id})`;
    if (gap > T.gapSeconds) findings.push(err('gap', `${round(gap)} s of empty time before this scene (blank frames).`, where));
    else if (gap < -T.maxOverlapSeconds) findings.push(err('overlap', `Overlaps the previous scene by ${round(-gap)} s (more than ${T.maxOverlapSeconds} s).`, where));
    else if (gap < -T.gapSeconds) findings.push(info('transition', `Overlaps the previous scene by ${round(-gap)} s (treated as a transition).`, where));
  }

  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  if (first.role !== 'hook') findings.push(err('hook-first', `The film opens with role "${first.role}"; open on a hook (the concrete promise or the problem).`, 'scenes[0]'));
  if (first.role === 'hook' && first.duration > T.maxHookSeconds) findings.push(warn('hook-length', `The hook runs ${first.duration} s; keep it to ${T.maxHookSeconds} s or less.`, 'scenes[0]'));
  const hasCtaScene = scenes.some((s) => s.role === 'cta');
  if (CTA_KINDS.has(spec.kind)) {
    if (!hasCtaScene) findings.push(err('cta-missing', `A ${spec.kind} film needs a scene with role "cta".`));
    if (!spec.cta || !spec.cta.trim()) findings.push(err('cta-text', `A ${spec.kind} film needs a "cta" field naming the one action.`));
  }
  if (!['cta', 'outro', 'recap'].includes(last.role)) findings.push(warn('ending', `The film ends on role "${last.role}"; end on a call to action, outro or recap.`, `scenes[${scenes.length - 1}]`));
  if (['cta', 'outro'].includes(last.role) && last.duration < T.minEndCardSeconds) {
    findings.push(warn('end-card', `The closing scene is ${last.duration} s; hold the end card for at least ${T.minEndCardSeconds} s.`, `scenes[${scenes.length - 1}]`));
  }

  const hasNarration = scenes.some((s) => s.narration && s.narration.trim());
  if (hasNarration && spec.audio?.captions !== true) findings.push(err('captions-required', 'Scenes carry narration but audio.captions is not true (WCAG 1.2.2).'));
  if (hasNarration && spec.audio?.voiceover === false) findings.push(warn('voiceover-flag', 'Scenes carry narration but audio.voiceover is false.'));
  if (total >= T.musicFromSeconds && !spec.audio?.music && spec.audio?.silent !== true) {
    findings.push(warn('no-music', `A film over ${T.musicFromSeconds} s needs a music bed and sound on actions unless the user asked for silence (audio.silent).`));
  }

  const approvedPaid = spec.approvals?.paidMedia && !/^\s*(none|n\/a|no)?\s*$/i.test(spec.approvals.paidMedia);
  scenes.forEach((s, i) => {
    const where = `scenes[${i}] (${s.id})`;
    const text = (s.text ?? '').replace(/\s+/g, ' ').trim();
    if (s.duration < 1.5) findings.push(warn('short-scene', `${s.duration} s is too short to register; merge it into a neighbour.`, where));
    if (s.duration > T.longHoldSeconds) findings.push(warn('long-hold', `${s.duration} s in one beat; split it or add shots.`, where));
    const shots = s.shots ?? 1;
    if (s.duration > T.longBeatSeconds && s.duration / shots > T.maxUnchangedSeconds) {
      findings.push(warn('pacing', `${s.duration} s over ${shots} shot(s) is ${round(s.duration / shots, 1)} s per shot; show a visible change every ${T.maxUnchangedSeconds} s or less.`, where));
    }
    if (text) {
      const visible = s.duration - T.textAllowanceSeconds;
      if (visible < T.minTextSeconds) {
        findings.push(warn('text-time', `Text is visible for about ${round(Math.max(visible, 0), 1)} s; keep it up at least ${T.minTextSeconds} s.`, where));
      } else {
        const cps = text.length / visible;
        if (cps > T.hardCharsPerSecond) findings.push(err('reading-load', `${round(cps, 1)} characters per second cannot be read (hard limit ${T.hardCharsPerSecond}).`, where));
        else if (cps > T.maxCharsPerSecond) findings.push(warn('reading-load', `${round(cps, 1)} characters per second is above the ${T.maxCharsPerSecond} default; shorten the text or lengthen the beat.`, where));
      }
    }
    if (/\d|%|\b(best|fastest|#1|leading|guaranteed|trusted by|used by|award[- ]winning)\b/i.test(`${text} ${s.narration ?? ''}`) && !(s.claims && s.claims.length)) {
      findings.push(warn('unsubstantiated-claim', 'Text or narration contains a number or a superlative but the scene has no claims[] with evidence.', where));
    }
    if ((s.source === 'real' || s.source === 'stock') && !s.sourceRef) findings.push(warn('source-ref', `source "${s.source}" has no sourceRef (file, URL or manifest id).`, where));
    if (s.source === 'generated' && !approvedPaid) {
      findings.push(warn('generated-approval', 'Generated media is planned but approvals.paidMedia records no approval; ask first (SKILL.md section 1).', where));
    }
  });

  return {
    mode: 'spec',
    status: statusOf(findings),
    findings,
    data: { totalSeconds: round(total), sceneCount: scenes.length, minSeconds: floor, kind: spec.kind, sceneIds: scenes.map((s) => s.id) },
  };
}

// ---------------------------------------------------------------------------------------------
// Mode 2: the HyperFrames project (static scan)
// ---------------------------------------------------------------------------------------------

const blank = (s) => s.replace(/[^\n]/g, ' ');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function parseAttrs(source) {
  const attrs = new Map();
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(source))) attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** All opening tags of an HTML document, with attributes and 1-based line. Script and style bodies and comments are ignored. */
function htmlTags(html) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (_m, openTag, _t, body, closeTag) => openTag + blank(body) + closeTag);
  const tags = [];
  const re = /<([A-Za-z][\w:-]*)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?>/g;
  let m;
  while ((m = re.exec(cleaned))) tags.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2] ?? ''), line: lineOf(cleaned, m.index) });
  return tags;
}

/** Script bodies of an HTML document with the line their text starts on. */
function scriptBodies(html) {
  const out = [];
  const re = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ code: m[2], line: lineOf(html, m.index + m[1].length) });
  return out;
}

const FORBIDDEN = Object.freeze([
  { code: 'date-now', re: /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)/, message: 'Wall-clock time makes frames differ between renders; derive everything from timeline time.' },
  { code: 'math-random', re: /\bMath\.random\s*\(/, message: 'Unseeded randomness makes frames differ between renders; use a seeded generator.' },
  { code: 'infinite-repeat', re: /\brepeat\s*:\s*-1\b/, message: 'An infinite repeat never ends under seeking; use a finite repeat that fits the scene.' },
  { code: 'timers', re: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, message: 'Timers and frame callbacks run on wall-clock time; animate on the paused timeline instead.' },
  { code: 'network-fetch', re: /\bfetch\s*\(|\bXMLHttpRequest\b/, message: 'Renders must not fetch; put the file in assets/ and reference it locally.' },
  { code: 'media-control', re: /\.\s*(play|pause)\s*\(\s*\)/, message: 'Never play() or pause() timelines or media; the renderer seeks them.' },
]);

function stripCodeComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:\w"'`])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));
}

function scanForbidden(code, startLine, file, findings) {
  const lines = stripCodeComments(code).split('\n');
  lines.forEach((line, i) => {
    for (const rule of FORBIDDEN) if (rule.re.test(line)) findings.push(err(rule.code, rule.message, `${file}:${startLine + i}`));
  });
}

/**
 * Statically scan a HyperFrames project. It does not run Chrome; `npx hyperframes check` is the runtime gate.
 * @param {string} dir Project folder.
 * @param {{entry?: string, minSeconds?: number}} [options]
 */
export async function scanProject(dir, options = {}) {
  const T = DEFAULTS;
  const findings = [];
  const root = path.resolve(dir);
  const entryRel = options.entry ?? 'index.html';
  const entryPath = path.join(root, entryRel);
  const floor = options.minSeconds ?? T.minSeconds;
  if (!(await statOrNull(entryPath))) {
    return { mode: 'project', status: 'fail', findings: [err('entry-missing', `${entryRel} not found in ${root}.`)], data: {} };
  }
  const html = await readText(entryPath);
  const tags = htmlTags(html);
  const rootTag = tags.find((t) => t.attrs.has('data-composition-id') && !t.attrs.has('data-composition-src'));
  if (!rootTag) {
    return { mode: 'project', status: 'fail', findings: [err('no-root', `${entryRel} has no element with data-composition-id (the root composition).`)], data: {} };
  }
  const rootDuration = Number(rootTag.attrs.get('data-duration'));
  const data = {
    entry: entryRel,
    rootId: rootTag.attrs.get('data-composition-id'),
    rootDuration: Number.isFinite(rootDuration) ? rootDuration : null,
    width: Number(rootTag.attrs.get('data-width')) || null,
    height: Number(rootTag.attrs.get('data-height')) || null,
    hosts: [],
    filesScanned: 0,
  };
  if (!Number.isFinite(rootDuration) || rootDuration <= 0) {
    findings.push(err('root-duration', `The root element needs a positive data-duration in seconds (got ${JSON.stringify(rootTag.attrs.get('data-duration'))}); it is the film's length.`, `${entryRel}:${rootTag.line}`));
  } else if (rootDuration + 1e-9 < floor) {
    findings.push(err('runtime', `The root data-duration is ${rootDuration} s, below the ${floor} s floor.`, `${entryRel}:${rootTag.line}`));
  }
  if (data.width && data.height && (data.width % 2 || data.height % 2)) findings.push(err('canvas-even', `Canvas ${data.width}x${data.height} has an odd side; H.264 needs even dimensions.`));

  const slots = [];
  for (const tag of tags.filter((t) => t.attrs.has('data-composition-src'))) {
    const src = tag.attrs.get('data-composition-src');
    const id = tag.attrs.get('id') ?? null;
    const compId = tag.attrs.get('data-composition-id') ?? null;
    const startRaw = tag.attrs.get('data-start') ?? '0';
    const start = Number(startRaw);
    const duration = Number(tag.attrs.get('data-duration'));
    const where = `${entryRel}:${tag.line}`;
    const host = { id, compositionId: compId, src, start: Number.isFinite(start) ? start : null, duration: Number.isFinite(duration) ? duration : null };
    data.hosts.push(host);
    if (id && compId && id !== compId) findings.push(err('id-mismatch', `Host id "${id}" differs from data-composition-id "${compId}"; each render waits about 45 s per scene and then shows static frames.`, where));
    if (!Number.isFinite(duration)) findings.push(warn('host-duration', `Scene host "${id ?? src}" has no numeric data-duration.`, where));
    if (!Number.isFinite(start)) findings.push(info('host-start', `Scene host "${id ?? src}" starts at "${startRaw}", a reference this scan cannot add up; snapshot it.`, where));
    else if (Number.isFinite(duration)) {
      slots.push({ start, end: start + duration, name: id ?? src });
      if (Number.isFinite(rootDuration) && start + duration > rootDuration + T.gapSeconds) {
        findings.push(err('scene-past-root', `Scene "${id ?? src}" ends at ${round(start + duration)} s, after the root's ${rootDuration} s; the end is cut off.`, where));
      }
    }
    const scenePath = path.resolve(root, src);
    const sceneRel = relPosix(root, scenePath);
    if (sceneRel.startsWith('..')) { findings.push(err('scene-outside', `Scene path "${src}" points outside the project.`, where)); continue; }
    if (!(await statOrNull(scenePath))) { findings.push(err('scene-missing', `Scene file "${src}" does not exist.`, where)); continue; }
    const sceneHtml = await readText(scenePath);
    if (!/<template\b/i.test(sceneHtml)) findings.push(warn('no-template', `${sceneRel} has no <template>; styles and scripts outside it are dropped.`, sceneRel));
    const sceneRoot = htmlTags(sceneHtml).find((t) => t.attrs.has('data-composition-id'));
    const sceneId = sceneRoot?.attrs.get('data-composition-id');
    if (!sceneId) findings.push(err('scene-root', `${sceneRel} has no element with data-composition-id.`, sceneRel));
    else if (compId && sceneId !== compId) findings.push(err('id-mismatch', `${sceneRel} declares "${sceneId}" but its host declares "${compId}".`, sceneRel));
    const keys = [...sceneHtml.matchAll(/__timelines\s*\[\s*["']([^"']+)["']\s*\]/g)].map((m) => m[1]);
    if (!keys.length) findings.push(err('timeline-key', `${sceneRel} never registers window.__timelines["<id>"]; the scene would show static frames.`, sceneRel));
    else if (sceneId && !keys.includes(sceneId)) findings.push(err('timeline-key', `${sceneRel} registers "${keys.join('", "')}" but its root id is "${sceneId}".`, sceneRel));
  }

  if (slots.length && Number.isFinite(rootDuration)) {
    slots.sort((a, b) => a.start - b.start);
    if (slots[0].start > T.gapSeconds) findings.push(warn('gap', `Nothing is mounted before ${round(slots[0].start)} s (blank frames at the start).`));
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i].start - slots[i - 1].end;
      if (gap > T.gapSeconds) findings.push(warn('gap', `${round(gap)} s with no scene between "${slots[i - 1].name}" and "${slots[i].name}" (blank frames).`));
    }
    const lastEnd = Math.max(...slots.map((s) => s.end));
    if (lastEnd < rootDuration - T.gapSeconds) findings.push(warn('tail', `The last scene ends at ${round(lastEnd)} s but the root runs to ${rootDuration} s; the tail is blank or holds the last frame.`));
  }

  const files = (await walk(root, { exclude: SCAN_EXCLUDES })).filter((f) => /\.(html?|m?js)$/i.test(f));
  data.filesScanned = files.length;
  for (const file of files) {
    const rel = relPosix(root, file);
    const text = await readText(file);
    if (/\.html?$/i.test(file)) {
      for (const body of scriptBodies(text)) scanForbidden(body.code, body.line, rel, findings);
      for (const tag of htmlTags(text)) {
        const ref = tag.attrs.get('src') ?? tag.attrs.get('href');
        if (ref && /^\/(?!\/)/.test(ref)) findings.push(warn('asset-path', `Asset path "${ref}" starts with "/"; use a project-relative path such as assets/....`, `${rel}:${tag.line}`));
        if (tag.attrs.has('crossorigin') && ['video', 'audio', 'img'].includes(tag.name)) findings.push(warn('crossorigin', 'crossorigin on media breaks preview and render; remove it.', `${rel}:${tag.line}`));
      }
    } else {
      scanForbidden(text, 1, rel, findings);
    }
  }

  return { mode: 'project', status: statusOf(findings), findings, data };
}

// ---------------------------------------------------------------------------------------------
// Mode 3: the rendered file
// ---------------------------------------------------------------------------------------------

async function readAt(fh, position, length) {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buf, 0, length, position);
  return buf.subarray(0, bytesRead);
}

/** Read the duration and layout of an MP4 or MOV file from its boxes (no ffprobe). */
export async function mp4Info(file) {
  const fh = await open(file, 'r');
  try {
    const { size } = await fh.stat();
    const order = [];
    let pos = 0;
    let brand = null;
    let moov = null;
    let truncated = false;
    while (pos + 8 <= size) {
      const head = await readAt(fh, pos, 16);
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      let header = 8;
      if (len === 1) {
        if (head.length < 16) { truncated = true; break; }
        len = Number(head.readBigUInt64BE(8));
        header = 16;
      } else if (len === 0) {
        len = size - pos;
      }
      if (len < header) { truncated = true; break; }
      if (pos + len > size) truncated = true;
      order.push(type);
      if (type === 'ftyp') brand = (await readAt(fh, pos + header, 4)).toString('latin1');
      if (type === 'moov' && len - header <= MAX_MOOV_BYTES && pos + len <= size) moov = await readAt(fh, pos + header, len - header);
      if (truncated) break;
      pos += len;
    }
    let durationSeconds = null;
    if (moov) {
      let p = 0;
      while (p + 8 <= moov.length) {
        const len = moov.readUInt32BE(p);
        const type = moov.toString('latin1', p + 4, p + 8);
        if (len < 8) break;
        if (type === 'mvhd') {
          const payload = moov.subarray(p + 8, p + len);
          const version = payload[0];
          const timescale = version === 1 ? payload.readUInt32BE(20) : payload.readUInt32BE(12);
          const units = version === 1 ? Number(payload.readBigUInt64BE(24)) : payload.readUInt32BE(16);
          if (timescale > 0) durationSeconds = units / timescale;
          break;
        }
        p += len;
      }
    }
    const moovAt = order.indexOf('moov');
    const mdatAt = order.indexOf('mdat');
    return { size, brand, order, truncated, durationSeconds, faststart: moovAt !== -1 && mdatAt !== -1 ? moovAt < mdatAt : null };
  } finally {
    await fh.close();
  }
}

function sniff(head) {
  if (head.length >= 8 && head.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  if (head.length >= 4 && head.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  return 'unknown';
}

function ffprobeSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (r.error || r.status !== 0) return { available: !r.error || r.error.code !== 'ENOENT', seconds: null };
  const seconds = Number.parseFloat(r.stdout);
  return { available: true, seconds: Number.isFinite(seconds) ? seconds : null };
}

/**
 * Measure a rendered file against the length it should have.
 * @param {string} file
 * @param {{expectSeconds?: number, toleranceSeconds?: number, minSeconds?: number, ffprobe?: boolean}} [options]
 *   `ffprobe: true` also asks ffprobe (cross-check for MP4, the only reader for other formats); `false` never runs it.
 */
export async function probeRender(file, options = {}) {
  const T = DEFAULTS;
  const findings = [];
  const abs = path.resolve(file);
  const st = await statOrNull(abs);
  if (!st || !st.isFile()) return { mode: 'render', status: 'fail', findings: [err('render-missing', `Render file not found: ${abs}`)], data: {} };
  if (st.size === 0) return { mode: 'render', status: 'fail', findings: [err('render-empty', 'The render file is empty (0 bytes).')], data: { bytes: 0 } };

  const fh = await open(abs, 'r');
  let head;
  try { head = await readAt(fh, 0, 16); } finally { await fh.close(); }
  const format = sniff(head);
  const data = { file: path.basename(abs), bytes: st.size, format, durationSeconds: null, source: null };
  let incomplete = false;

  if (format === 'mp4') {
    const m = await mp4Info(abs);
    data.brand = m.brand;
    data.faststart = m.faststart;
    if (m.truncated) findings.push(err('truncated', 'The file is cut off in the middle of a box (incomplete render or copy).'));
    if (m.durationSeconds === null) findings.push(err('no-moov', 'No movie header (moov/mvhd) found: the file is truncated or not a finished MP4.'));
    else { data.durationSeconds = round(m.durationSeconds, 3); data.source = 'mp4 header'; }
    if (m.faststart === false) findings.push(warn('faststart', 'The moov box comes after the media data; progressive web playback waits for the whole file (remux with +faststart, see video-pipelines).'));
  }
  if (options.ffprobe === true || (format !== 'mp4' && options.ffprobe !== false)) {
    const probe = ffprobeSeconds(abs);
    if (probe.seconds !== null) {
      if (data.durationSeconds === null) { data.durationSeconds = round(probe.seconds, 3); data.source = 'ffprobe'; }
      else if (Math.abs(probe.seconds - data.durationSeconds) > 0.25) findings.push(warn('probe-disagrees', `ffprobe reports ${round(probe.seconds, 3)} s, the header says ${data.durationSeconds} s.`));
    } else if (format !== 'mp4') {
      incomplete = true;
      findings.push(warn('duration-not-tested', `Cannot read the duration of a ${format} file without ffprobe (${probe.available ? 'it returned nothing' : 'not installed'}); the length claim is NOT_TESTED.`));
    }
  } else if (format !== 'mp4') {
    incomplete = true;
    findings.push(warn('duration-not-tested', `Cannot read the duration of a ${format} file without ffprobe; the length claim is NOT_TESTED.`));
  }

  if (data.durationSeconds !== null) {
    const floor = options.minSeconds ?? T.minSeconds;
    const tol = options.toleranceSeconds ?? T.toleranceSeconds;
    if (data.durationSeconds + 1e-9 < floor) findings.push(err('runtime', `The render is ${data.durationSeconds} s, below the ${floor} s floor.`));
    if (options.expectSeconds !== undefined) {
      data.expectSeconds = options.expectSeconds;
      if (Math.abs(data.durationSeconds - options.expectSeconds) > tol) {
        findings.push(err('duration-mismatch', `The render is ${data.durationSeconds} s but ${options.expectSeconds} s was planned (tolerance ${tol} s).`));
      }
    }
  }
  return { mode: 'render', status: statusOf(findings, incomplete), findings, data };
}

// ---------------------------------------------------------------------------------------------
// Combination, reporting and CLI
// ---------------------------------------------------------------------------------------------

function crossCheck(results, tolerance) {
  const by = Object.fromEntries(results.map((r) => [r.mode, r]));
  const findings = [];
  const specTotal = by.spec?.data?.totalSeconds;
  const rootDuration = by.project?.data?.rootDuration;
  const rendered = by.render?.data?.durationSeconds;
  if (specTotal != null && rootDuration != null && Math.abs(specTotal - rootDuration) > tolerance) {
    findings.push(err('plan-vs-composition', `The plan adds up to ${specTotal} s but the root data-duration is ${rootDuration} s.`));
  }
  if (by.spec && by.project?.data?.hosts?.length) {
    const hostIds = new Set(by.project.data.hosts.map((h) => h.id ?? h.compositionId));
    for (const id of by.spec.data.sceneIds ?? []) if (!hostIds.has(id)) findings.push(warn('scene-not-mounted', `Planned scene "${id}" has no mounted host in the composition.`));
    const planned = new Set(by.spec.data.sceneIds ?? []);
    for (const id of hostIds) if (id && !planned.has(id)) findings.push(info('scene-not-planned', `Mounted scene "${id}" is not in the plan.`));
  }
  if (specTotal != null && rendered != null && by.render?.data?.expectSeconds === undefined && Math.abs(specTotal - rendered) > tolerance) {
    findings.push(err('plan-vs-render', `The plan adds up to ${specTotal} s but the render is ${rendered} s.`));
  }
  return findings;
}

/** Run the requested modes and combine them. */
export async function runChecks(request) {
  const tolerance = request.toleranceSeconds ?? DEFAULTS.toleranceSeconds;
  const results = [];
  if (request.spec) results.push(await checkSpec(request.spec, { minSeconds: request.minSeconds }));
  if (request.project) results.push(await scanProject(request.project, { entry: request.entry, minSeconds: request.minSeconds }));
  const specTotal = results.find((r) => r.mode === 'spec')?.data?.totalSeconds;
  const rootDuration = results.find((r) => r.mode === 'project')?.data?.rootDuration;
  if (request.render) {
    const expectSeconds = request.expectSeconds ?? rootDuration ?? specTotal;
    results.push(await probeRender(request.render, { expectSeconds, toleranceSeconds: tolerance, minSeconds: request.minSeconds, ffprobe: request.ffprobe }));
  }
  const cross = results.length > 1 ? crossCheck(results, tolerance) : [];
  const all = [...results.flatMap((r) => r.findings), ...cross];
  const errors = all.filter((f) => f.level === 'error').length;
  const warnings = all.filter((f) => f.level === 'warning').length;
  const incomplete = results.some((r) => r.status === 'incomplete');
  const status = errors ? 'fail' : incomplete ? 'incomplete' : 'pass';
  return { status, errors, warnings, results, cross };
}

export function formatReport(report) {
  const lines = [`video-check: ${report.results.map((r) => r.mode).join(' + ')}`, ''];
  const label = (s) => `[${s.toUpperCase()}]`;
  for (const r of report.results) {
    const d = r.data ?? {};
    const facts = [
      d.totalSeconds !== undefined && `${d.totalSeconds} s planned, ${d.sceneCount} scenes`,
      d.rootDuration != null && `root ${d.rootDuration} s, ${d.hosts?.length ?? 0} scene hosts, ${d.filesScanned} files scanned`,
      d.durationSeconds != null && `${d.durationSeconds} s (${d.source}), ${d.bytes} bytes`,
    ].filter(Boolean).join('; ');
    lines.push(`${label(r.status)} ${r.mode}${facts ? ` - ${facts}` : ''}`);
    for (const f of r.findings) lines.push(`    ${f.level.padEnd(7)} ${f.code}: ${f.message}${f.where ? ` (${f.where})` : ''}`);
  }
  if (report.cross.length) {
    lines.push(`${label(report.cross.some((f) => f.level === 'error') ? 'fail' : 'pass')} cross-check`);
    for (const f of report.cross) lines.push(`    ${f.level.padEnd(7)} ${f.code}: ${f.message}`);
  }
  lines.push('', `Result: ${report.status.toUpperCase()} (${report.errors} errors, ${report.warnings} warnings)`);
  return lines.join('\n');
}

const HELP = `Usage:
  node scripts/video-check.mjs --spec <video-spec.json> [--project <dir>] [--render <file>] [options]
  node scripts/video-check.mjs --project <dir> [--entry index.html] [--min-seconds 60]
  node scripts/video-check.mjs --render <file> [--expect-seconds <n>] [--tolerance 0.5]

Checks a demo or marketing film. Read-only; no network.
  --spec <file>          film plan (templates/video-spec.json shape): schema, contiguous scenes, runtime floor,
                         hook first, call to action, reading load, claims, captions
  --project <dir>        HyperFrames project: root data-duration, scene mounts and ids, timeline keys,
                         forbidden patterns (Date.now, Math.random, repeat -1, timers, fetch, play/pause)
  --entry <file>         root composition inside --project (default index.html)
  --render <file>        measure the finished file's duration (MP4/MOV from its header; other formats need ffprobe)
  --expect-seconds <n>   planned length for --render (default: the project's root duration, else the plan's total)
  --tolerance <s>        allowed difference between planned and measured length (default ${DEFAULTS.toleranceSeconds})
  --min-seconds <n>      floor for every duration found (default: the plan's minDurationSeconds, else ${DEFAULTS.minSeconds})
  --ffprobe              also ask ffprobe for the duration (cross-check)
  --json                 print the full result as JSON
  -h, --help             show this help

Exit codes: 0 pass (warnings allowed), 1 fail, 2 incomplete (a length could not be measured), 3 unreadable or invalid input, 64 usage error.
`;

/** CLI entry point. @param {string[]} argv @returns {Promise<number>} exit code */
export async function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        spec: { type: 'string' },
        project: { type: 'string' },
        entry: { type: 'string' },
        render: { type: 'string' },
        'expect-seconds': { type: 'string' },
        tolerance: { type: 'string' },
        'min-seconds': { type: 'string' },
        ffprobe: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
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
  if (!args.spec && !args.project && !args.render) {
    process.stderr.write(`Error: give at least one of --spec, --project or --render.\n\n${HELP}`);
    return EXIT.USAGE;
  }
  const num = (name) => {
    if (args[name] === undefined) return undefined;
    const n = Number(args[name]);
    if (!Number.isFinite(n) || n < 0) throw new TypeError(`--${name} must be a non-negative number (got ${JSON.stringify(args[name])})`);
    return n;
  };
  let request;
  try {
    request = {
      project: args.project,
      entry: args.entry,
      render: args.render,
      expectSeconds: num('expect-seconds'),
      toleranceSeconds: num('tolerance'),
      minSeconds: num('min-seconds'),
      ffprobe: args.ffprobe ? true : undefined,
    };
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    return EXIT.USAGE;
  }
  if (args.spec) {
    try {
      request.spec = await readJson(path.resolve(args.spec));
    } catch (e) {
      process.stderr.write(`Error: ${e.message}\n`);
      return EXIT.INVALID;
    }
    if (request.spec === null || typeof request.spec !== 'object' || Array.isArray(request.spec)) {
      process.stderr.write('Error: the spec must be a JSON object.\n');
      return EXIT.INVALID;
    }
  }
  const report = await runChecks(request);
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
  return { pass: EXIT.PASS, fail: EXIT.FAIL, incomplete: EXIT.INCOMPLETE }[report.status];
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`); process.exitCode = EXIT.FAIL; },
  );
}
