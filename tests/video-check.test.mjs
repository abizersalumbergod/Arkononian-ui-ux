// Tests for scripts/video-check.mjs (film plan, HyperFrames project scan, rendered-file duration).
// Every fixture is generated in code: synthetic MP4 boxes, HTML scene files and spec objects.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSpec, scanProject, probeRender, mp4Info, runChecks, EXIT, DEFAULTS } from '../scripts/video-check.mjs';
import { validate, formatErrors } from '../scripts/lib/schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'video-check.mjs');
const readJson = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), 'utf8'));

let tmp;
before(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'video-check-')); });
after(() => { rmSync(tmp, { recursive: true, force: true }); });

const codes = (r, level) => r.findings.filter((f) => !level || f.level === level).map((f) => f.code);

// ---------------------------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------------------------

const box = (type, payload) => {
  const b = Buffer.alloc(8 + payload.length);
  b.writeUInt32BE(b.length, 0);
  b.write(type, 4, 'latin1');
  payload.copy(b, 8);
  return b;
};

/** A minimal MP4: ftyp, moov(mvhd), mdat. `faststart: false` puts mdat first. */
function makeMp4(file, { seconds, timescale = 1000, faststart = true, version = 0, truncate = 0 }) {
  const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2avc1mp41', 'latin1'));
  const mvhdPayload = Buffer.alloc(version === 1 ? 112 : 100);
  mvhdPayload[0] = version;
  if (version === 1) {
    mvhdPayload.writeUInt32BE(timescale, 20);
    mvhdPayload.writeBigUInt64BE(BigInt(Math.round(seconds * timescale)), 24);
  } else {
    mvhdPayload.writeUInt32BE(timescale, 12);
    mvhdPayload.writeUInt32BE(Math.round(seconds * timescale), 16);
  }
  const moov = box('moov', box('mvhd', mvhdPayload));
  const mdat = box('mdat', Buffer.alloc(64, 7));
  let bytes = Buffer.concat(faststart ? [ftyp, moov, mdat] : [ftyp, mdat, moov]);
  if (truncate) bytes = bytes.subarray(0, bytes.length - truncate);
  writeFileSync(file, bytes);
  return file;
}

const sceneHtml = (id, { key = id, template = true, script = `tl.fromTo("#${id}-h", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.2);` } = {}) => {
  const inner = `<style>#root{position:absolute;inset:0}</style>
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
  <h1 id="${id}-h" class="clip" data-start="0.2" data-duration="3">Words</h1>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${script}
  window.__timelines["${key}"] = tl;
</script>`;
  return template ? `<template>\n${inner}\n</template>\n` : `${inner}\n`;
};

/** Build a project: scenes = [{id, start, duration, hostId?, compId?, file?, sceneOpts?}] */
function makeProject(name, { rootDuration = 75, scenes, rootScript = 'window.__timelines["main"] = gsap.timeline({ paused: true });', writeScenes = true }) {
  const dir = path.join(tmp, name);
  mkdirSync(path.join(dir, 'compositions'), { recursive: true });
  const hosts = scenes.map((s) => `  <div id="${s.hostId ?? s.id}" data-composition-id="${s.compId ?? s.id}" data-composition-src="compositions/${s.file ?? s.id}.html" data-start="${s.start}" data-duration="${s.duration}"></div>`).join('\n');
  writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="en"><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${rootDuration}" data-width="1920" data-height="1080">
${hosts}
</div>
<script>
  ${rootScript}
</script>
</body></html>
`);
  if (writeScenes) for (const s of scenes) writeFileSync(path.join(dir, 'compositions', `${s.file ?? s.id}.html`), sceneHtml(s.id, s.sceneOpts));
  return dir;
}

const goodScenes = [
  { id: 'hook', start: 0, duration: 10 },
  { id: 'body', start: 10, duration: 50 },
  { id: 'cta', start: 60, duration: 15 },
];

const spec = (patch = {}) => ({ ...structuredClone(readJson('templates', 'video-spec.json')), ...patch });

// ---------------------------------------------------------------------------------------------
// Schema and template
// ---------------------------------------------------------------------------------------------

test('the shipped template validates against its schema and passes the plan check with no findings', async () => {
  const template = readJson('templates', 'video-spec.json');
  const result = validate(readJson('schemas', 'video-spec.schema.json'), template);
  assert.ok(result.valid, formatErrors(result.errors).join('\n'));
  const r = await checkSpec(template);
  assert.equal(r.status, 'pass');
  assert.deepEqual(r.findings, []);
  assert.equal(r.data.totalSeconds, 75);
});

test('schema errors are reported and stop the numeric checks', async () => {
  const bad = spec({ kind: 'sitcom' });
  delete bad.scenes[0].visual;
  const r = await checkSpec(bad);
  assert.equal(r.status, 'fail');
  assert.ok(codes(r).every((c) => c === 'schema'));
  assert.ok(r.findings.length >= 2);
});

// ---------------------------------------------------------------------------------------------
// Plan rules
// ---------------------------------------------------------------------------------------------

test('a plan under 60 s fails the runtime floor', async () => {
  const s = spec();
  s.scenes = s.scenes.slice(0, 5).map((sc, i) => ({ ...sc, start: i * 10, duration: 10 }));
  s.scenes[4].role = 'cta';
  const r = await checkSpec(s);
  assert.ok(codes(r, 'error').includes('runtime'), codes(r).join(','));
  assert.equal((await checkSpec(s, { minSeconds: 40 })).findings.some((f) => f.code === 'runtime'), false);
});

test('gaps and large overlaps are errors; a short overlap is a transition', async () => {
  const gap = spec();
  gap.scenes[2].start += 2;
  assert.ok(codes(await checkSpec(gap), 'error').includes('gap'));

  const overlap = spec();
  overlap.scenes[3].start -= 2;
  assert.ok(codes(await checkSpec(overlap), 'error').includes('overlap'));

  const fade = spec();
  fade.scenes[3].start -= 0.5;
  const r = await checkSpec(fade);
  assert.ok(codes(r, 'info').includes('transition'));
  assert.equal(codes(r, 'error').includes('overlap'), false);
});

test('the film must open on a hook and demo films need a cta scene and cta text', async () => {
  const noHook = spec();
  noHook.scenes[0].role = 'problem';
  assert.ok(codes(await checkSpec(noHook), 'error').includes('hook-first'));

  const noCta = spec();
  noCta.scenes[noCta.scenes.length - 1].role = 'outro';
  assert.ok(codes(await checkSpec(noCta), 'error').includes('cta-missing'));

  const noText = spec();
  delete noText.cta;
  assert.ok(codes(await checkSpec(noText), 'error').includes('cta-text'));

  const tutorial = spec({ kind: 'tutorial' });
  tutorial.scenes[tutorial.scenes.length - 1].role = 'recap';
  delete tutorial.cta;
  const r = await checkSpec(tutorial);
  assert.equal(codes(r, 'error').includes('cta-missing'), false);
  assert.equal(codes(r, 'error').includes('cta-text'), false);
});

test('narration requires captions', async () => {
  const s = spec();
  s.scenes[1].narration = 'A spoken line.';
  assert.ok(codes(await checkSpec(s), 'error').includes('captions-required'));
  s.audio.captions = true;
  s.audio.voiceover = true;
  assert.equal(codes(await checkSpec(s), 'error').includes('captions-required'), false);
});

test('reading load: above 17 cps warns, above 25 cps is an error, and tiny windows warn', async () => {
  const s = spec();
  s.scenes[1].text = 'x'.repeat(130); // 130 / (11 - 0.8) is about 12.7 cps: fine
  assert.equal(codes(await checkSpec(s)).includes('reading-load'), false);
  s.scenes[1].text = 'x'.repeat(190); // about 18.6 cps
  assert.ok(codes(await checkSpec(s), 'warning').includes('reading-load'));
  s.scenes[1].text = 'x'.repeat(300); // about 29 cps
  assert.ok(codes(await checkSpec(s), 'error').includes('reading-load'));

  const short = spec();
  short.scenes[6].start = 62;
  short.scenes[6].duration = 2;
  short.scenes[7].start = 64;
  short.scenes[7].duration = 11;
  assert.ok(codes(await checkSpec(short)).includes('text-time'));
});

test('numbers and superlatives need claims with evidence', async () => {
  const s = spec();
  s.scenes[1].text = 'Twice as fast, 40% cheaper.';
  assert.ok(codes(await checkSpec(s), 'warning').includes('unsubstantiated-claim'));
  s.scenes[1].claims = [{ text: '40% cheaper', evidence: 'pricing page, 2026-10-01' }];
  assert.equal(codes(await checkSpec(s)).includes('unsubstantiated-claim'), false);
  s.scenes[1].claims = [{ text: '40% cheaper', evidence: '' }];
  assert.ok(codes(await checkSpec(s), 'error').includes('schema'));
});

test('odd canvas, missing music, generated media without approval and missing sources are flagged', async () => {
  const s = spec();
  s.canvas.width = 1921;
  s.audio = { captions: false };
  s.scenes[1].source = 'generated';
  s.scenes[2].source = 'stock';
  delete s.scenes[2].sourceRef;
  const r = await checkSpec(s);
  assert.ok(codes(r, 'error').includes('canvas-even'));
  assert.ok(codes(r, 'warning').includes('no-music'));
  assert.ok(codes(r, 'warning').includes('generated-approval'));
  assert.ok(codes(r, 'warning').includes('source-ref'));
  s.audio.silent = true;
  s.approvals.paidMedia = 'approved by the user for 2 stills, 2026-10-30';
  const r2 = await checkSpec(s);
  assert.equal(codes(r2).includes('no-music'), false);
  assert.equal(codes(r2).includes('generated-approval'), false);
});

test('pacing: a long beat with one shot warns, with enough shots it does not', async () => {
  const s = spec();
  s.scenes[3].shots = 1; // 11 s in one shot
  assert.ok(codes(await checkSpec(s), 'warning').includes('pacing'));
  s.scenes[3].shots = 2;
  assert.equal(codes(await checkSpec(s)).includes('pacing'), false);
});

// ---------------------------------------------------------------------------------------------
// Project scan
// ---------------------------------------------------------------------------------------------

test('a well-formed 75 s project passes', async () => {
  const dir = makeProject('ok', { scenes: goodScenes });
  const r = await scanProject(dir);
  assert.equal(r.status, 'pass', JSON.stringify(r.findings));
  assert.equal(r.data.rootDuration, 75);
  assert.equal(r.data.hosts.length, 3);
});

test('a root shorter than 60 s fails; --min-seconds can lower the floor', async () => {
  const dir = makeProject('short', { rootDuration: 30, scenes: [{ id: 'hook', start: 0, duration: 10 }, { id: 'body', start: 10, duration: 20 }] });
  assert.ok(codes(await scanProject(dir), 'error').includes('runtime'));
  assert.equal(codes(await scanProject(dir, { minSeconds: 30 })).includes('runtime'), false);
});

test('a scene slot that ends after the root is cut off', async () => {
  const dir = makeProject('past', { rootDuration: 75, scenes: [{ id: 'hook', start: 0, duration: 10 }, { id: 'body', start: 10, duration: 70 }] });
  assert.ok(codes(await scanProject(dir), 'error').includes('scene-past-root'));
});

test('host, scene root and timeline key must share one id', async () => {
  const hostMismatch = makeProject('hostid', { scenes: [{ id: 'hook', hostId: 'intro', start: 0, duration: 75 }] });
  assert.ok(codes(await scanProject(hostMismatch), 'error').includes('id-mismatch'));

  const keyMismatch = makeProject('key', { scenes: [{ id: 'hook', start: 0, duration: 75, sceneOpts: { key: 'other' } }] });
  assert.ok(codes(await scanProject(keyMismatch), 'error').includes('timeline-key'));
});

test('a missing scene file and a scene without <template> are reported', async () => {
  const missing = makeProject('missing', { scenes: [{ id: 'hook', start: 0, duration: 75 }], writeScenes: false });
  assert.ok(codes(await scanProject(missing), 'error').includes('scene-missing'));

  const bare = makeProject('bare', { scenes: [{ id: 'hook', start: 0, duration: 75, sceneOpts: { template: false } }] });
  const r = await scanProject(bare);
  assert.ok(codes(r, 'warning').includes('no-template'));
  assert.equal(r.status, 'pass');
});

test('gaps between scene slots and a blank tail warn', async () => {
  const dir = makeProject('gappy', { scenes: [{ id: 'hook', start: 0, duration: 10 }, { id: 'body', start: 14, duration: 50 }] });
  const r = await scanProject(dir);
  assert.ok(codes(r, 'warning').includes('gap'));
  assert.ok(codes(r, 'warning').includes('tail'));
});

test('forbidden patterns are errors with file and line; comments are ignored', async () => {
  const script = [
    'const n = Math.random();',
    'tl.to("#hook-h", { x: 10, repeat: -1 });',
    'setTimeout(() => {}, 10);',
    '// Date.now() mentioned only in a comment',
    '/* fetch("x") also only a comment */',
  ].join('\n  ');
  const dir = makeProject('bad', {
    scenes: [{ id: 'hook', start: 0, duration: 75, sceneOpts: { script } }],
    rootScript: 'window.__timelines["main"] = gsap.timeline({ paused: true }); const t = Date.now();',
  });
  const r = await scanProject(dir);
  const found = new Set(codes(r, 'error'));
  for (const c of ['math-random', 'infinite-repeat', 'timers', 'date-now']) assert.ok(found.has(c), `${c} in ${[...found].join(',')}`);
  assert.equal(found.has('network-fetch'), false, 'a commented fetch must not count');
  assert.equal(r.findings.filter((f) => f.code === 'date-now').length, 1, 'the commented Date.now must not count');
  assert.match(r.findings.find((f) => f.code === 'math-random').where, /^compositions\/hook\.html:\d+$/);
});

test('a leading-slash asset path and crossorigin media warn', async () => {
  const dir = makeProject('assets', { scenes: [{ id: 'hook', start: 0, duration: 75 }] });
  writeFileSync(path.join(dir, 'compositions', 'extra.html'), '<img src="/assets/logo.png" crossorigin="anonymous">');
  const r = await scanProject(dir);
  assert.ok(codes(r, 'warning').includes('asset-path'));
  assert.ok(codes(r, 'warning').includes('crossorigin'));
});

test('missing entry or root fails cleanly', async () => {
  const empty = path.join(tmp, 'empty');
  mkdirSync(empty);
  assert.ok(codes(await scanProject(empty), 'error').includes('entry-missing'));
  writeFileSync(path.join(empty, 'index.html'), '<html><body><p>no composition</p></body></html>');
  assert.ok(codes(await scanProject(empty), 'error').includes('no-root'));
});

// ---------------------------------------------------------------------------------------------
// Rendered file
// ---------------------------------------------------------------------------------------------

test('mp4Info reads version 0 and version 1 headers and the box order', async () => {
  const a = await mp4Info(makeMp4(path.join(tmp, 'v0.mp4'), { seconds: 75, timescale: 1000 }));
  assert.equal(a.durationSeconds, 75);
  assert.equal(a.brand, 'isom');
  assert.equal(a.faststart, true);
  const b = await mp4Info(makeMp4(path.join(tmp, 'v1.mp4'), { seconds: 61.5, timescale: 90000, version: 1, faststart: false }));
  assert.equal(b.durationSeconds, 61.5);
  assert.equal(b.faststart, false);
});

test('a 75 s render matches a 75 s plan; a 30 s render fails the floor and the plan', async () => {
  const ok = makeMp4(path.join(tmp, 'ok.mp4'), { seconds: 75.02 });
  const r = await probeRender(ok, { expectSeconds: 75 });
  assert.equal(r.status, 'pass', JSON.stringify(r.findings));
  assert.equal(r.data.source, 'mp4 header');

  const short = makeMp4(path.join(tmp, 'short.mp4'), { seconds: 30 });
  const rs = await probeRender(short, { expectSeconds: 75 });
  assert.equal(rs.status, 'fail');
  assert.ok(codes(rs, 'error').includes('runtime'));
  assert.ok(codes(rs, 'error').includes('duration-mismatch'));
});

test('a render a few seconds off the plan fails; within tolerance passes', async () => {
  const f = makeMp4(path.join(tmp, 'off.mp4'), { seconds: 78 });
  assert.ok(codes(await probeRender(f, { expectSeconds: 75 }), 'error').includes('duration-mismatch'));
  assert.equal((await probeRender(f, { expectSeconds: 75, toleranceSeconds: 3.5 })).status, 'pass');
});

test('faststart false warns but does not fail', async () => {
  const f = makeMp4(path.join(tmp, 'slow-start.mp4'), { seconds: 75, faststart: false });
  const r = await probeRender(f, { expectSeconds: 75 });
  assert.equal(r.status, 'pass');
  assert.ok(codes(r, 'warning').includes('faststart'));
});

test('empty, missing and truncated files fail', async () => {
  const empty = path.join(tmp, 'empty.mp4');
  writeFileSync(empty, '');
  assert.ok(codes(await probeRender(empty), 'error').includes('render-empty'));
  assert.ok(codes(await probeRender(path.join(tmp, 'nope.mp4')), 'error').includes('render-missing'));
  const cut = makeMp4(path.join(tmp, 'cut.mp4'), { seconds: 75, faststart: false, truncate: 50 });
  const r = await probeRender(cut, { expectSeconds: 75 });
  assert.equal(r.status, 'fail');
  assert.ok(codes(r, 'error').includes('truncated'));
});

test('a non-MP4 file is NOT_TESTED without ffprobe (incomplete, not a pass)', async () => {
  const webm = path.join(tmp, 'film.webm');
  writeFileSync(webm, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0, 0, 0, 0, 0, 0, 0]));
  const r = await probeRender(webm, { expectSeconds: 75, ffprobe: false });
  assert.equal(r.status, 'incomplete');
  assert.ok(codes(r, 'warning').includes('duration-not-tested'));
  assert.equal(r.data.durationSeconds, null);
});

// ---------------------------------------------------------------------------------------------
// Combination and CLI
// ---------------------------------------------------------------------------------------------

test('plan, composition and render are cross-checked', async () => {
  const template = readJson('templates', 'video-spec.json');
  const ids = template.scenes.map((s) => ({ id: s.id, start: s.start, duration: s.duration }));
  const dir = makeProject('combo', { scenes: ids });
  const good = makeMp4(path.join(tmp, 'combo.mp4'), { seconds: 75 });
  const ok = await runChecks({ spec: template, project: dir, render: good });
  assert.equal(ok.status, 'pass', JSON.stringify(ok.results.flatMap((r) => r.findings).concat(ok.cross)));
  assert.deepEqual(ok.cross, []);

  const drift = makeProject('combo-drift', { rootDuration: 80, scenes: ids });
  const r = await runChecks({ spec: template, project: drift });
  assert.equal(r.status, 'fail');
  assert.ok(r.cross.some((f) => f.code === 'plan-vs-composition'));

  const shortFile = makeMp4(path.join(tmp, 'combo-short.mp4'), { seconds: 40 });
  const r2 = await runChecks({ spec: template, render: shortFile });
  assert.equal(r2.status, 'fail');
});

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('CLI exit codes: 0 pass, 1 fail, 3 invalid input, 64 usage', () => {
  const templatePath = path.join(ROOT, 'templates', 'video-spec.json');
  assert.equal(run(['--spec', templatePath]).status, EXIT.PASS);
  assert.equal(run([]).status, EXIT.USAGE);
  assert.equal(run(['--bogus']).status, EXIT.USAGE);
  assert.equal(run(['--spec', templatePath, '--min-seconds', 'abc']).status, EXIT.USAGE);
  assert.equal(run(['--spec', path.join(tmp, 'missing.json')]).status, EXIT.INVALID);
  const notJson = path.join(tmp, 'bad.json');
  writeFileSync(notJson, '{ nope');
  assert.equal(run(['--spec', notJson]).status, EXIT.INVALID);
  const arrayJson = path.join(tmp, 'array.json');
  writeFileSync(arrayJson, '[]');
  assert.equal(run(['--spec', arrayJson]).status, EXIT.INVALID);
  assert.equal(run(['--render', path.join(tmp, 'short.mp4')]).status, EXIT.FAIL);
});

test('CLI --json prints a parseable report and --help exits 0', () => {
  const r = run(['--spec', path.join(ROOT, 'templates', 'video-spec.json'), '--json']);
  const report = JSON.parse(r.stdout);
  assert.equal(report.status, 'pass');
  assert.equal(report.errors, 0);
  assert.equal(run(['--help']).status, EXIT.PASS);
});

test('defaults match the numbers documented in the module', () => {
  assert.equal(DEFAULTS.minSeconds, 60);
  assert.equal(DEFAULTS.maxCharsPerSecond, 17);
  assert.equal(DEFAULTS.minTextSeconds, 1.5);
  assert.equal(DEFAULTS.textAllowanceSeconds, 0.8);
  assert.equal(DEFAULTS.toleranceSeconds, 0.5);
  const doc = readFileSync(path.join(ROOT, 'references', 'hyperframes-video.md'), 'utf8');
  for (const needle of ['17 characters per second', '1.5 s', '0.5 s', '60 s']) assert.ok(doc.includes(needle), `module should state "${needle}"`);
});
