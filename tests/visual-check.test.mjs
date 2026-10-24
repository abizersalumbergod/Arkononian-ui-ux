// Browser checks on local fixture pages. Skips (with the reason) when Playwright cannot be resolved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePlaywright, runVisualCheck, EXIT } from '../scripts/visual-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = path.join(ROOT, 'tests', 'fixtures', 'pages');
const VIEWPORTS = '375x812,1280x800';

const pw = await resolvePlaywright({ projectDir: ROOT });
const skipReason = pw.ok ? null : `${pw.reason} (tried: ${pw.tried.join('; ')})`;

function withTmp(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uiux-visual-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('ok.html has no critical issues at 375 and 1280 px', { timeout: 180000 }, async (t) => {
  if (skipReason) return t.skip(skipReason);
  await withTmp(async (dir) => {
    const summary = await runVisualCheck({ url: path.join(PAGES, 'ok.html'), viewports: VIEWPORTS, outDir: dir, playwright: pw, wait: 200 });
    if (summary.overall.status === 'blocked') return t.skip(summary.overall.reason);
    assert.equal(summary.viewports.length, 2);
    for (const v of summary.viewports) {
      assert.deepEqual(v.critical, [], `critical issues at ${JSON.stringify(v.viewport ?? v.label)}: ${v.critical.join('; ')}`);
      assert.equal(v.overflowX, false);
      assert.equal(v.brokenImages, 0);
      assert.equal(v.consoleErrors, 0);
    }
    assert.equal(summary.overall.exitCode, EXIT.OK);
  });
});

test('overflow.html reports overflow, a broken image, a console error and exits 1', { timeout: 180000 }, async (t) => {
  if (skipReason) return t.skip(skipReason);
  await withTmp(async (dir) => {
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'visual-check.mjs'), '--url', path.join(PAGES, 'overflow.html'), '--viewports', VIEWPORTS, '--out', dir, '--project', ROOT, '--wait', '200'],
      { encoding: 'utf8', timeout: 170000 },
    );
    if (res.status === EXIT.BLOCKED) return t.skip(`visual-check reported BLOCKED: ${res.stdout.slice(0, 300)}`);
    assert.equal(res.status, EXIT.CRITICAL, `expected exit 1, got ${res.status}: ${res.stderr}`);
    const summary = JSON.parse(res.stdout);
    assert.equal(summary.overall.exitCode, EXIT.CRITICAL);
    assert.equal(summary.viewports.length, 2);
    for (const v of summary.viewports) {
      assert.equal(v.overflowX, true, 'overflowX');
      assert.ok(v.brokenImages >= 1, `brokenImages ${v.brokenImages}`);
      assert.ok(v.consoleErrors >= 1, `consoleErrors ${v.consoleErrors}`);
      assert.ok(v.critical.length >= 1);
    }
  });
});
