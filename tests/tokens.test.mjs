// Presets validate against the schema; build-tokens emits CSS + Tailwind v4 theme and enforces contrast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokens, validatePreset, checkContrastPairs } from '../scripts/build-tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS_DIR = path.join(ROOT, 'presets');
const presetFiles = readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json')).sort();
const loadPreset = (f) => JSON.parse(readFileSync(path.join(PRESETS_DIR, f), 'utf8').replace(/^﻿/, ''));

test('the four spec presets exist', () => {
  assert.deepEqual(presetFiles, ['cinematic-noir.json', 'monochrome-editorial.json', 'precision-saas.json', 'warm-commerce.json']);
});

for (const file of presetFiles) {
  test(`preset ${file} validates and builds with passing contrast pairs`, () => {
    const preset = loadPreset(file);
    const v = validatePreset(preset);
    assert.ok(v.valid, v.errors.join('\n'));

    const out = buildTokens(preset);
    assert.match(out.css, /:root\s*\{[^}]*--[a-z0-9-]+\s*:/, 'tokens.css needs :root custom properties');
    assert.match(out.tailwindTheme, /@theme\s*\{[^}]*--[a-z0-9-]+\s*:/, 'theme.tailwind.css needs an @theme block');
    if (preset.color.dark) assert.match(out.css, /\[data-theme="dark"\]/);

    assert.ok(out.contrastResults.length >= preset.contrastPairs.length);
    const failed = out.contrastResults.filter((r) => !r.pass);
    assert.deepEqual(failed, [], `declared contrast pairs must pass: ${JSON.stringify(failed)}`);
    assert.equal(out.ok, true);
  });
}

test('a deliberately bad contrast pair fails (API and CLI exit code)', () => {
  const preset = structuredClone(loadPreset('precision-saas.json'));
  preset.contrastPairs = [{ fg: '#777777', bg: '#888888', min: 4.5, theme: 'light', note: 'deliberately bad' }];
  assert.ok(validatePreset(preset).valid, 'bad-contrast preset should still be schema-valid');

  const results = checkContrastPairs(preset);
  assert.equal(results.length, 1);
  assert.equal(results[0].pass, false);
  assert.ok(results[0].ratio < 4.5, `ratio ${results[0].ratio}`);
  assert.equal(buildTokens(preset).ok, false);

  const dir = mkdtempSync(path.join(os.tmpdir(), 'uiux-tokens-'));
  try {
    const file = path.join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify(preset));
    const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-tokens.mjs'), '--preset', file, '--out', path.join(dir, 'out')], { encoding: 'utf8', timeout: 30000 });
    assert.equal(res.status, 1, `expected contrast failure exit 1, got ${res.status}: ${res.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a known pair measures the WCAG maximum', () => {
  const preset = structuredClone(loadPreset('precision-saas.json'));
  preset.contrastPairs = [{ fg: '#000000', bg: '#ffffff', min: 21, theme: 'light' }];
  const [r] = checkContrastPairs(preset);
  assert.equal(r.pass, true);
  assert.equal(r.ratio, 21);
});
