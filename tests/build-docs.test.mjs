// Tests for scripts/build-docs.mjs (derived docs never drift from their sources).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, appendFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRegistry, extractSection } from '../scripts/build-docs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'build-docs.mjs');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'mini-skill-valid');

let tmp;
let copy;

const REGISTRY = [
  { id: 'cli:alpha', name: 'Alpha CLI', category: 'cli', status: 'available-verified', evidence: 'alpha --version -> 1.0.0', verifiedOn: '2026-10-23', fallback: 'none needed' },
  { id: 'mcp:beta|pipe', name: 'Beta MCP', category: 'mcp', status: 'unknown', evidence: 'probe with the current agent tool-discovery interface', verifiedOn: null, failureModes: ['auth expired'] },
  { id: 'generator:gamma', name: 'Gamma', category: 'generator', status: 'requires-approval', evidence: ['balance read', 'models listed'], cost: 'credits' },
];

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 20000 });

before(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'uiux-docs-'));
  copy = path.join(tmp, 'skill');
  cpSync(FIXTURE, copy, { recursive: true });
  writeFileSync(path.join(copy, 'references', 'capability-registry.json'), `${JSON.stringify(REGISTRY, null, 2)}\n`);
});

after(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test('renderRegistry output contains every id of the shipped registry', () => {
  const entries = JSON.parse(readFileSync(path.join(ROOT, 'references', 'capability-registry.json'), 'utf8'));
  const md = renderRegistry(ROOT);
  assert.ok(entries.length > 0);
  for (const e of entries) assert.ok(md.includes(`\`${e.id.replace(/\|/g, '\\|')}\``), `missing ${e.id}`);
  for (const h of ['## Decision rules', '## Specifications', '## Verification', '## Sources']) assert.ok(md.includes(h), h);
});

test('renderRegistry escapes table cells and lists failure modes', () => {
  const md = renderRegistry(copy);
  for (const e of REGISTRY) assert.ok(md.includes(`\`${e.id.replace(/\|/g, '\\|')}\``), `missing ${e.id}`);
  assert.ok(md.includes('mcp:beta\\|pipe'));
  assert.match(md, /\*\*mcp:beta\\\|pipe\*\*: auth expired/);
  assert.ok(md.indexOf('cli:alpha') < md.indexOf('generator:gamma'), 'available-verified sorts first');
});

test('extractSection returns the right section and ignores headings inside code fences', () => {
  const md = [
    '# Title',
    '',
    '```md',
    '## Decision rules',
    'fenced decoy',
    '```',
    '',
    '## Decision rules',
    '',
    '1. Real rule.',
    '',
    '```js',
    '## not a heading',
    'const x = 1;',
    '```',
    '',
    '~~~',
    '## also not a heading',
    '~~~',
    '2. Second rule.',
    '',
    '### Subsection stays',
    '',
    '## Specifications',
    '',
    'Numbers.',
  ].join('\n');
  const body = extractSection(md, 'Decision rules');
  assert.ok(body.startsWith('1. Real rule.'), body);
  assert.ok(!body.includes('fenced decoy'));
  assert.ok(body.includes('## not a heading'));
  assert.ok(body.includes('## also not a heading'));
  assert.ok(body.includes('2. Second rule.'));
  assert.ok(body.includes('### Subsection stays'));
  assert.ok(!body.includes('Numbers.'));
  assert.equal(extractSection(md, 'specifications'), 'Numbers.');
  assert.equal(extractSection(md, 'Missing section'), null);
  assert.equal(extractSection('```\n## Steps\n```\n', 'Steps'), null);
});

test('--check exits 1 on stale MASTER_INSTRUCTIONS.md and 0 after regeneration', () => {
  const master = path.join(copy, 'MASTER_INSTRUCTIONS.md');
  assert.ok(existsSync(master));
  const stale = run('--root', copy, '--check');
  assert.equal(stale.status, 1, stale.stdout + stale.stderr);
  assert.match(stale.stdout, /STALE\s+MASTER_INSTRUCTIONS\.md/);
  const before = readFileSync(master, 'utf8');
  assert.equal(readFileSync(master, 'utf8'), before, '--check must not write');

  const gen = run('--root', copy);
  assert.equal(gen.status, 0, gen.stdout + gen.stderr);
  assert.ok(existsSync(path.join(copy, 'references', 'capability-registry.md')));

  const fresh = run('--root', copy, '--check');
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
  assert.match(fresh.stdout, /OK\s+MASTER_INSTRUCTIONS\.md/);

  appendFileSync(path.join(copy, 'SKILL.md'), '\nA new rule added after generation.\n');
  const again = run('--root', copy, '--check', '--only', 'master');
  assert.equal(again.status, 1, 'a source edit makes the generated file stale');
  assert.equal(run('--root', copy, '--only', 'master').status, 0);
  assert.ok(readFileSync(master, 'utf8').includes('A new rule added after generation.'));
  assert.equal(run('--root', copy, '--check').status, 0);
});

test('CLI usage errors exit 2', () => {
  assert.equal(run('--bogus').status, 2);
  assert.equal(run('--only', 'nothing').status, 2);
  assert.equal(run('--help').status, 0);
});
