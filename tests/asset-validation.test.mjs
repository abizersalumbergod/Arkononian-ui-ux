// Tests for scripts/asset-validation.mjs (Gate G). Binary fixtures are generated in code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { validateManifest, resolveAssetPath, DEFAULT_BUDGETS, EXIT } from '../scripts/asset-validation.mjs';

// ---------------------------------------------------------------------------------------------
// Fixture generators
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Valid RGB PNG. `noisy` fills pixels with random bytes (incompressible, for budget tests). */
function makePng(width, height, { noisy = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const row = width * 3 + 1;
  const raw = noisy ? randomBytes(row * height) : Buffer.alloc(row * height, 0x80);
  for (let y = 0; y < height; y++) raw[y * row] = 0; // filter type none
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: noisy ? 0 : 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Minimal baseline JPEG header (SOI, APP0/JFIF, SOF0, EOI) carrying the dimensions. */
function makeJpeg(width, height) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof0 = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])]);
}

/** 1-colour GIF89a with the given logical screen size. */
function makeGif(width, height) {
  const header = Buffer.from('GIF89a', 'ascii');
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(width, 0);
  lsd.writeUInt16LE(height, 2);
  lsd[4] = 0x80; // global colour table, 2 entries
  const gct = Buffer.from([0, 0, 0, 255, 255, 255]);
  const img = Buffer.alloc(10);
  img[0] = 0x2c;
  img.writeUInt16LE(width, 5);
  img.writeUInt16LE(height, 7);
  return Buffer.concat([header, lsd, gct, img, Buffer.from([0x02, 0x02, 0x44, 0x01, 0x00, 0x3b])]);
}

/** PCM WAV: mono, 8-bit, `rate` Hz, `seconds` long. */
function makeWav(seconds, rate = 8000) {
  const dataLen = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + dataLen, 0x80);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + dataLen, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28); // byte rate
  b.writeUInt16LE(1, 32); // block align
  b.writeUInt16LE(8, 34); // bits per sample
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(dataLen, 40);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

let root;

before(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'uiux-assets-'));
  writeFileSync(path.join(root, 'photo.png'), makePng(32, 18));
  writeFileSync(path.join(root, 'photo.jpg'), makeJpeg(64, 48));
  writeFileSync(path.join(root, 'spinner.gif'), makeGif(16, 16));
  writeFileSync(path.join(root, 'click.wav'), makeWav(1));
  writeFileSync(path.join(root, 'huge.png'), makePng(400, 440, { noisy: true }));
});

after(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function asset(overrides = {}) {
  return {
    id: 'a1',
    type: 'image',
    role: 'content',
    path: 'photo.png',
    source: 'original',
    format: 'png',
    license: 'original (project-owned)',
    critical: false,
    loading: 'lazy',
    optimization: 'optimized',
    alt: '',
    validation: { status: 'pending' },
    ...overrides,
  };
}

const manifest = (...assets) => ({ version: '1.0', project: 'asset-tests', assets });
const run = (m) => validateManifest(m, root, { ffprobe: false });
const check = (report, assetId, checkId) => report.assets.find((a) => a.id === assetId)?.checks.find((c) => c.id === checkId);

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test('valid generated PNG, JPEG, GIF and WAV pass', async () => {
  const wav = asset({ id: 'wav', type: 'audio', role: 'ui-sound', path: 'click.wav', format: 'wav', durationSec: 1 });
  delete wav.alt;
  const report = await run(manifest(
    asset({ id: 'png', dimensions: { width: 32, height: 18 }, aspectRatio: '16:9' }),
    asset({ id: 'jpeg', path: 'photo.jpg', format: 'jpeg', dimensions: { width: 64, height: 48 }, aspectRatio: '4:3' }),
    asset({ id: 'gif', path: 'spinner.gif', format: 'gif', dimensions: { width: 16, height: 16 }, aspectRatio: 1 }),
    wav,
  ));
  assert.deepEqual(report.manifestChecks.filter((c) => c.status !== 'pass'), []);
  for (const a of report.assets) {
    assert.equal(a.status, 'pass', `${a.id}: ${JSON.stringify(a.checks.filter((c) => c.status !== 'pass'))}`);
  }
  assert.equal(report.overall, 'PASS');
  assert.equal(report.exitCode, EXIT.PASS);
  assert.equal(report.assets.find((a) => a.id === 'png').measured.format, 'png');
  assert.equal(report.assets.find((a) => a.id === 'jpeg').measured.width, 64);
  assert.equal(report.assets.find((a) => a.id === 'gif').measured.height, 16);
  assert.equal(report.assets.find((a) => a.id === 'wav').measured.durationSec, 1);
});

test('a missing file fails', async () => {
  const report = await run(manifest(asset({ id: 'gone', path: 'missing.png' })));
  assert.equal(check(report, 'gone', 'exists').status, 'fail');
  assert.equal(report.overall, 'FAIL');
  assert.equal(report.exitCode, EXIT.FAIL);
});

test('an oversized image fails the default image budget', async () => {
  const report = await run(manifest(asset({ id: 'big', path: 'huge.png', dimensions: { width: 400, height: 440 } })));
  const budget = check(report, 'big', 'budget');
  assert.equal(budget.status, 'fail', budget.message);
  assert.ok(report.assets[0].measured.bytes > DEFAULT_BUDGETS.image);
  assert.equal(report.overall, 'FAIL');
});

test('a manifest budget override is enforced', async () => {
  const m = { ...manifest(asset({ id: 'small' })), budgets: { image: 50 } };
  const report = await run(m);
  assert.equal(check(report, 'small', 'budget').status, 'fail');
});

test('a wrong aspect ratio fails', async () => {
  const report = await run(manifest(asset({ id: 'ratio', aspectRatio: '4:3' })));
  const ar = check(report, 'ratio', 'aspect-ratio');
  assert.equal(ar.status, 'fail', ar.message);
  assert.equal(report.overall, 'FAIL');
});

test('a missing or placeholder licence fails', async () => {
  const noLicense = asset({ id: 'nolic' });
  delete noLicense.license;
  const report = await run(manifest(noLicense, asset({ id: 'unknownlic', license: 'unknown' })));
  assert.equal(check(report, 'nolic', 'license').status, 'fail');
  assert.equal(check(report, 'unknownlic', 'license').status, 'fail');
  assert.equal(report.manifestChecks.find((c) => c.id === 'schema').status, 'fail');
  assert.equal(report.overall, 'FAIL');
});

test('a placeholder asset with a real licence statement warns instead of passing', async () => {
  const report = await run(manifest(asset({ id: 'slot', source: 'placeholder', license: 'placeholder; project-owned SVG' })));
  assert.equal(report.manifestChecks.find((c) => c.id === 'schema').status, 'pass');
  assert.equal(check(report, 'slot', 'license').status, 'pass');
  assert.equal(check(report, 'slot', 'placeholder').status, 'warn');
  assert.equal(report.assets[0].status, 'warn');
});

test('a critical asset without a fallback fails; with one it passes', async () => {
  const report = await run(manifest(
    asset({ id: 'hero', role: 'hero', critical: true, loading: 'eager' }),
    asset({ id: 'hero2', role: 'hero', critical: true, loading: 'eager', fallback: 'solid #111 background' }),
  ));
  assert.equal(check(report, 'hero', 'fallback').status, 'fail');
  assert.equal(check(report, 'hero2', 'fallback').status, 'pass');
  assert.equal(report.overall, 'FAIL');
});

test('../ traversal and absolute paths outside the root are rejected', async () => {
  const report = await run(manifest(asset({ id: 'escape', path: '../outside.png' }), asset({ id: 'escape2', path: '..\\..\\outside.png' })));
  for (const id of ['escape', 'escape2']) {
    const p = check(report, id, 'path');
    assert.equal(p.status, 'fail');
    assert.match(p.message, /traversal/);
    assert.equal(check(report, id, 'exists'), undefined, 'a rejected path must not be read');
  }
  assert.equal(resolveAssetPath(root, '../x.png').ok, false);
  assert.equal(resolveAssetPath(root, path.join(os.tmpdir(), 'elsewhere-uiux.png')).ok, false);
  assert.equal(resolveAssetPath(root, 'https://example.com/a.png').ok, false);
  assert.equal(resolveAssetPath(root, 'sub/../photo.png').ok, true);
});

test('declared format that does not match the content fails', async () => {
  const report = await run(manifest(asset({ id: 'liar', path: 'photo.jpg', format: 'png' })));
  assert.equal(check(report, 'liar', 'format').status, 'fail');
});
