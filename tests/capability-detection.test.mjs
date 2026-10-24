// Tests for scripts/environment-audit.mjs. Offline; probes only local commands with a 5 s timeout.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, formatErrors } from '../scripts/lib/schema.mjs';
import {
  audit,
  probeCommand,
  profileProject,
  parseVersion,
  redactPaths,
  STATUSES,
  IN_SESSION_EVIDENCE,
  EXIT,
} from '../scripts/environment-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'environment-audit.mjs');
const schema = JSON.parse(readFileSync(path.join(ROOT, 'schemas', 'capability-registry.schema.json'), 'utf8'));

let tmp;
let project;
let result;
let elapsedMs;

before(async () => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'uiux-audit-'));
  project = path.join(tmp, 'fixture-app');
  mkdirSync(path.join(project, 'app'), { recursive: true });
  writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    name: 'fixture-app',
    private: true,
    scripts: { dev: 'next dev', build: 'next build' },
    dependencies: {
      next: '15.1.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'framer-motion': '^11.0.0',
      gsap: '^3.12.5',
      three: '^0.170.0',
      '@react-three/fiber': '^9.0.0',
      '@radix-ui/react-dialog': '^1.1.0',
    },
    devDependencies: {
      tailwindcss: '^4.0.0',
      '@tailwindcss/postcss': '^4.0.0',
      typescript: '^5.6.0',
      vitest: '^2.1.0',
      '@playwright/test': '^1.49.0',
    },
  }, null, 2));
  writeFileSync(path.join(project, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  writeFileSync(path.join(project, 'components.json'), '{}\n');
  const t0 = Date.now();
  result = await audit({ project });
  elapsedMs = Date.now() - t0;
});

after(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test('audit() output validates against capability-registry.schema.json', () => {
  const { valid, errors } = validate(schema, result);
  assert.ok(valid, formatErrors(errors).join('\n'));
  assert.ok(Array.isArray(result.entries) && result.entries.length >= 20);
  assert.equal(typeof result.generatedAt, 'string');
  assert.ok(result.platform && typeof result.platform === 'object');
  assert.ok(Array.isArray(result.notes) && result.notes.some((n) => n.includes(IN_SESSION_EVIDENCE)));
  assert.ok(result.skills && Array.isArray(result.skills.roots));
});

test('every status is in the vocabulary and every entry has evidence', () => {
  const ids = new Set();
  for (const e of result.entries) {
    assert.ok(STATUSES.includes(e.status), `${e.id}: status ${e.status}`);
    assert.ok(typeof e.evidence === 'string' && e.evidence.length > 0, `${e.id}: evidence`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    if (e.status === 'available-verified' && ['cli', 'runtime'].includes(e.category)) assert.match(e.version, /^\d+\.\d+/, `${e.id}: version`);
  }
  for (const id of ['runtime:node', 'cli:npm', 'cli:git', 'cli:ffmpeg', 'cli:playwright', 'browser:chrome', 'browser:edge', 'browser:playwright-browsers']) {
    assert.ok(ids.has(id), `missing entry ${id}`);
  }
});

test('MCP servers and generators are unknown with the in-session probe as evidence', () => {
  const unseen = result.entries.filter((e) => e.category === 'mcp' || e.category === 'generator');
  assert.ok(unseen.length >= 4);
  for (const e of unseen) {
    assert.equal(e.status, 'unknown', e.id);
    assert.equal(e.evidence, IN_SESSION_EVIDENCE, e.id);
  }
});

test('the running Node.js is detected when it is on PATH', () => {
  const node = result.entries.find((e) => e.id === 'runtime:node');
  assert.notEqual(node.status, 'unknown');
  if (node.status === 'available-verified') assert.match(node.evidence, /node --version/);
});

test('a fake command is unavailable and unsafe names are refused', () => {
  const e = probeCommand({ name: 'uiux-no-such-command-7f3a9' });
  assert.equal(e.status, 'unavailable');
  assert.match(e.evidence, /not found/);
  assert.equal(e.version, undefined);
  for (const bad of ['node & calc', 'a;rm -rf', '../node', '', '$(id)']) {
    assert.throws(() => probeCommand({ name: bad }), TypeError, bad);
  }
});

test('parseVersion reads common version banners', () => {
  assert.equal(parseVersion('v24.13.0\n'), '24.13.0');
  assert.equal(parseVersion('gh version 2.96.0 (2026-01-01)\nhttps://github.com/cli/cli'), '2.96.0');
  assert.equal(parseVersion('ffmpeg version 7.1-full_build Copyright'), '7.1-full_build');
  assert.equal(parseVersion('Python was not found; run without arguments to install'), null);
});

test('project profile detects framework, router, styling, kits, libraries and package manager', () => {
  const p = result.project;
  assert.ok(p && p.packageJson);
  assert.equal(p.name, 'fixture-app');
  assert.equal(p.framework.name, 'next');
  assert.equal(p.framework.version, '15.1.0');
  assert.equal(p.router, 'next app router');
  assert.equal(p.styling.tailwind.major, 4);
  const names = (list) => list.map((x) => x.name);
  assert.ok(names(p.uiKits).includes('shadcn/ui'));
  assert.ok(names(p.uiKits).includes('radix-ui'));
  assert.deepEqual(names(p.animation).sort(), ['framer-motion', 'gsap']);
  assert.deepEqual(names(p.threeD).sort(), ['@react-three/fiber', 'three']);
  assert.ok(names(p.testTools).includes('vitest'));
  assert.ok(names(p.testTools).includes('@playwright/test'));
  assert.equal(p.packageManager.name, 'pnpm');
  assert.equal(p.typescript, true);
  assert.ok(result.skills.roots.some((r) => r.root.endsWith('fixture-app/.claude/skills')));
});

test('profileProject handles a directory without package.json', () => {
  const empty = path.join(tmp, 'static-site');
  mkdirSync(empty);
  writeFileSync(path.join(empty, 'index.html'), '<!doctype html><title>x</title>');
  const p = profileProject(empty);
  assert.equal(p.packageJson, false);
  assert.equal(p.static, true);
  assert.ok(p.notes.length > 0);
});

test('output never contains the raw home directory path', () => {
  const home = os.homedir();
  const text = JSON.stringify(result);
  for (const form of [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')]) {
    assert.ok(!text.toLowerCase().includes(form.toLowerCase()), 'home directory leaked into the audit output');
  }
  assert.equal(redactPaths(path.join(home, 'x', 'y')).startsWith('~') || redactPaths(path.join(home, 'x', 'y')).startsWith('%LOCALAPPDATA%'), true);
});

test('audit runs within 30 s', () => {
  assert.ok(elapsedMs < 30000, `audit took ${elapsedMs} ms`);
});

test('CLI: --help, bad flags and a missing --project', () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 20000 });
  const help = run('--help');
  assert.equal(help.status, EXIT.OK);
  assert.match(help.stdout, /--project <dir>/);
  assert.equal(run('--nope').status, EXIT.USAGE);
  assert.equal(run('--project', path.join(tmp, 'does-not-exist')).status, EXIT.USAGE);
  assert.equal(run('--force').status, EXIT.USAGE);
});
