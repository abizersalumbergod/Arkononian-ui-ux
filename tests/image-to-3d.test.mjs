// Optional image-to-3D toolkit, seen from the Node side: the router modifier and approval, the registry
// entries, and the manifest entry the Python toolkit writes (schema + the skill's own Gate G validator).
// The Python unit tests (tests/image-to-3d/) run here too when Python 3.9+ is installed; otherwise they skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from '../scripts/route.mjs';
import { validate, formatErrors } from '../scripts/lib/schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), 'utf8').replace(/^﻿/, ''));

function findPython() {
  for (const cmd of ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0 && /Python 3\.(9|[1-9]\d)/.test(`${r.stdout}${r.stderr}`)) return cmd;
  }
  return null;
}
const PY = findPython();
const NO_PY = PY ? false : 'Python 3.9+ not found';
const py = (args, opts = {}) => spawnSync(PY, ['-B', '-I', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000, ...opts });

test('python unit tests for the image-to-3D toolkit pass', { skip: NO_PY }, () => {
  const r = py(['-m', 'unittest', 'discover', '-s', 'tests/image-to-3d', '-p', 'test_*.py']);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /\nOK\s*$/);
});

const POSITIVE = [
  'Use TRELLIS to turn my product photo into a GLB for the hero',
  'Convert this sketch to 3D for my website',
  'I want a 3D model from this image of my lamp',
  'image to 3D for a landing page',
  'Make a glb out of my product photo',
];
const NEGATIVE = [
  'Build a dashboard for sales analytics',
  'Generate 40 product photos for the catalog',
  'Build a 3D landing page for headphones with Three.js and a scroll-driven reveal',
  'Add an image gallery to the portfolio',
];

test('image-to-3d modifier loads the module and flags the third-party upload', () => {
  for (const prompt of POSITIVE) {
    const r = route(prompt);
    assert.ok(r.modifiers.includes('image-to-3d'), `${prompt}: modifiers ${r.modifiers.join(', ')}`);
    assert.ok(r.modules.includes('references/image-to-3d-pipeline.md'), `${prompt}: modules ${r.modules.join(', ')}`);
    assert.ok(r.approvals.includes('third-party-upload'), `${prompt}: approvals ${r.approvals.join(', ')}`);
    assert.ok(r.notes.some((n) => n.startsWith('modifier image-to-3d:')), `${prompt}: notes`);
  }
});

test('the module stays opt-in: ordinary requests do not load it', () => {
  for (const prompt of NEGATIVE) {
    const r = route(prompt);
    assert.ok(!r.modules.includes('references/image-to-3d-pipeline.md'), `${prompt}: loaded the optional module`);
    assert.ok(!r.modifiers.includes('image-to-3d'), `${prompt}: modifier fired`);
    assert.ok(!r.modifiers.includes('gemini-media'), `${prompt}: gemini modifier fired`);
  }
});

test('registry entries for the optional pipeline are dated, evidenced and honest about approval', () => {
  const entries = readJson('references', 'capability-registry.json');
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const id of ['library:gradio_client', 'service:trellis-hf-space', 'service:hunyuan3d-hf-space']) {
    const e = byId.get(id);
    assert.ok(e, `${id} missing`);
    assert.match(e.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(String(e.evidence).length > 40, `${id}: evidence`);
    assert.ok(e.failureModes.length >= 2 && e.fallback, `${id}: failure modes and fallback`);
  }
  for (const id of ['service:trellis-hf-space', 'service:hunyuan3d-hf-space']) {
    assert.equal(byId.get(id).status, 'requires-approval', id);
    assert.match(String(byId.get(id).network), /external/, id);
  }
  assert.match(byId.get('service:hunyuan3d-hf-space').failureModes.join(' '), /European Union/);
  assert.notEqual(byId.get('library:gradio_client').status, 'available-verified', 'a bundled entry must not claim the library is installed');
});

const GEMINI_POSITIVE = [
  'Generate a hero image with Gemini for the bakery landing page',
  'Use Nano Banana to make background images for my static site',
  'Make a background video using Gemini',
  'Gemini images for the portfolio hero',
];

test('gemini-media loads the one media module and always flags the paid call', () => {
  for (const prompt of GEMINI_POSITIVE) {
    const r = route(prompt);
    assert.ok(r.modifiers.includes('gemini-media'), `${prompt}: modifiers ${r.modifiers.join(', ')}`);
    assert.ok(r.modules.includes('references/image-to-3d-pipeline.md'), `${prompt}: modules ${r.modules.join(', ')}`);
    assert.ok(r.approvals.includes('paid-generation-check'), `${prompt}: approvals ${r.approvals.join(', ')}`);
    assert.ok(r.notes.some((n) => n.startsWith('modifier gemini-media:') && /normal procedure/.test(n)), `${prompt}: note`);
  }
});

test('the Gemini registry entry is honest: paid, credentials needed, never exercised live', () => {
  const entry = readJson('references', 'capability-registry.json').find((e) => e.id === 'generator:gemini-interactions');
  assert.ok(entry, 'generator:gemini-interactions missing');
  assert.equal(entry.status, 'requires-credentials');
  assert.match(String(entry.network), /external/);
  assert.match(String(entry.cost), /Paid/);
  assert.match(String(entry.evidence), /No live request/);
  assert.match(entry.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(JSON.stringify(entry)), 'no key-like text in the registry');
});

// Builds a project with one promoted Gemini result (image or video) through the real promote() path.
const BUILD_GEMINI_PROJECT = String.raw`
import sys, tempfile, pathlib
sys.path.insert(0, 'scripts/image-to-3d'); sys.path.insert(0, 'tests/image-to-3d')
import gemini_media as gm
from test_pipeline import png_bytes
kind = sys.argv[1]
d = pathlib.Path(tempfile.mkdtemp(prefix='gem-node-'))
cands = d / '_sources' / 'gemini' / 'candidates'; cands.mkdir(parents=True)
if kind == 'image':
    cand = cands / 'hero-c1.png'; cand.write_bytes(png_bytes(320, 180))
    out = {'file': '_sources/gemini/candidates/hero-c1.png', 'bytes': cand.stat().st_size, 'sha256': gm.g3d.sha256_file(cand),
           'mime': 'image/png', 'format': 'png', 'dimensions': {'width': 320, 'height': 180}}
else:
    cand = cands / 'clip.mp4'; cand.write_bytes(b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 64)
    out = {'file': '_sources/gemini/candidates/clip.mp4', 'bytes': cand.stat().st_size, 'sha256': gm.g3d.sha256_file(cand),
           'mime': 'video/mp4', 'format': 'mp4'}
gm.JobStore(d).put({'job_id': 'abc123', 'kind': kind, 'model': 'example-model', 'prompt': 'A calm studio scene', 'params': {}, 'status': 'completed',
                    'interaction_id': 'int_1234', 'approved_by': 'user, 2026-10-29, "yes"', 'output': out, 'usage': {}})
if kind == 'image':
    gm.promote(d, cand, 'hero', role='background', alt='A calm studio scene', out_dir='public/images/generated', manifest='asset-manifest.json')
else:
    gm.promote(d, cand, 'hero-loop', role='ambient-loop', alt=None, out_dir='public/video', manifest='asset-manifest.json', fallback_asset='hero')
print(d)
`;

for (const kind of ['image', 'video']) {
  test(`a promoted Gemini ${kind} entry validates against the manifest schema${kind === 'image' ? " and passes the skill's Gate G validator" : ''}`, { skip: NO_PY }, () => {
    const built = py(['-c', BUILD_GEMINI_PROJECT, kind]);
    assert.equal(built.status, 0, built.stderr);
    const dir = built.stdout.trim().split(/\r?\n/).pop();
    try {
      const manifest = JSON.parse(readFileSync(path.join(dir, 'asset-manifest.json'), 'utf8'));
      const result = validate(readJson('schemas', 'asset-manifest.schema.json'), manifest);
      assert.ok(result.valid, formatErrors(result.errors).join('\n'));
      const asset = manifest.assets[0];
      assert.equal(asset.type, kind);
      assert.equal(asset.source, 'generated');
      assert.match(asset.license, /SynthID/);
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(JSON.stringify(manifest)), 'no key-like text in the manifest');
      if (kind === 'image') {
        const gate = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'asset-validation.mjs'), '--manifest', path.join(dir, 'asset-manifest.json'), '--root', dir],
          { encoding: 'utf8', timeout: 60000 });
        assert.equal(gate.status, 0, `${gate.stdout}\n${gate.stderr}`);
      } else {
        assert.equal(asset.fallback.assetId, 'hero');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

// Builds a project folder with a minimal GLB plus the manifest the toolkit would write, and prints its path.
const BUILD_PROJECT = `
import sys, json, tempfile, struct, pathlib
sys.path.insert(0, 'scripts/image-to-3d')
import image_to_glb as m
backend, space = sys.argv[1], sys.argv[2]
d = pathlib.Path(tempfile.mkdtemp(prefix='i23d-node-'))
js = json.dumps({"asset": {"version": "2.0"}}).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
body = struct.pack('<II', len(js), 0x4E4F534A) + js
(d / 'public' / 'models').mkdir(parents=True)
(d / 'public' / 'models' / 'lamp.glb').write_bytes(b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body)
e = m.build_manifest_entry(asset_id='lamp', rel_path='public/models/lamp.glb', role='hero', backend=backend, space=space, seed=7,
    params={'texture_size': 1024}, approved_by='user, 2026-10-29, "yes"', size=(d / 'public' / 'models' / 'lamp.glb').stat().st_size,
    processed=True, critical=True, loading='lazy', fallback='poster:public/images/lamp.webp', alt='A desk lamp', notes='n',
    blender='4.2.3', today='2026-10-29')
m.upsert_manifest(d / 'asset-manifest.json', 'site', e)
print(d)
`;

for (const [backend, space] of [['trellis', 'trellis-community/TRELLIS'], ['hunyuan3d', 'tencent/Hunyuan3D-2']]) {
  test(`manifest entry (${backend}) validates against the schema and passes the skill's Gate G validator`, { skip: NO_PY }, () => {
    const built = py(['-c', BUILD_PROJECT, backend, space]);
    assert.equal(built.status, 0, built.stderr);
    const dir = built.stdout.trim().split(/\r?\n/).pop();
    try {
      const manifest = JSON.parse(readFileSync(path.join(dir, 'asset-manifest.json'), 'utf8'));
      const result = validate(readJson('schemas', 'asset-manifest.schema.json'), manifest);
      assert.ok(result.valid, formatErrors(result.errors).join('\n'));
      assert.equal(manifest.assets[0].type, 'model3d');
      const gate = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'asset-validation.mjs'), '--manifest', path.join(dir, 'asset-manifest.json'), '--root', dir],
        { encoding: 'utf8', timeout: 60000 });
      assert.equal(gate.status, 0, `${gate.stdout}\n${gate.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
