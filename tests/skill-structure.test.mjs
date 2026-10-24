// Tests for scripts/validate-skill.mjs (Gate A) on the mini-skill fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSkill, checkSkillFrontmatter, formatChecklist, EXIT } from '../scripts/validate-skill.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALID = path.join(ROOT, 'tests', 'fixtures', 'mini-skill-valid');
const BROKEN = path.join(ROOT, 'tests', 'fixtures', 'mini-skill-broken');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-skill.mjs');
// The fixture's fake key (AWS documentation example), assembled at runtime so this file itself
// does not trip the package secret scan.
const FAKE_KEY = ['AKIA', 'IOSFODNN7', 'EXAMPLE'].join('');

const byId = (result, id) => {
  const c = result.checks.find((x) => x.id === id);
  assert.ok(c, `check ${id} missing`);
  return c;
};

test('mini-skill-valid passes every check', async () => {
  const r = await validateSkill(VALID, { fixtureMode: true });
  assert.equal(r.ok, true, formatChecklist(r));
  assert.equal(r.mode, 'fixture');
  assert.equal(r.summary.fail, 0);
  for (const c of r.checks) assert.notEqual(c.status, 'fail', `${c.id}: ${c.details.join('; ')}`);
  for (const id of ['required-files', 'frontmatter', 'links', 'secrets', 'routes', 'reachability']) assert.equal(byId(r, id).status, 'pass', id);
});

test('mini-skill-broken fails overall', async () => {
  const r = await validateSkill(BROKEN, { fixtureMode: true });
  assert.equal(r.ok, false);
  assert.ok(r.summary.fail >= 4);
});

test('broken link is detected', async () => {
  const c = byId(await validateSkill(BROKEN, { fixtureMode: true }), 'links');
  assert.equal(c.status, 'fail');
  assert.ok(c.details.some((d) => d.includes('references/alpha.md') && d.includes('missing-module.md')), c.details.join('\n'));
});

test('bad front matter is detected (name and description)', async () => {
  const c = byId(await validateSkill(BROKEN, { fixtureMode: true }), 'frontmatter');
  assert.equal(c.status, 'fail');
  assert.ok(c.details.some((d) => /"name"/.test(d)), c.details.join('\n'));
  assert.ok(c.details.some((d) => /"description"/.test(d)), c.details.join('\n'));
});

test('fake secret pattern is detected without printing the value', async () => {
  const c = byId(await validateSkill(BROKEN, { fixtureMode: true }), 'secrets');
  assert.equal(c.status, 'fail');
  assert.ok(c.details.some((d) => d.includes('references/beta.md') && d.includes('aws-access-key-id')), c.details.join('\n'));
  assert.ok(!JSON.stringify(c).includes(FAKE_KEY), 'secret value must not appear in the result');
});

test('missing required file is detected', async () => {
  const r = await validateSkill(BROKEN, { fixtureMode: true });
  const c = byId(r, 'required-files');
  assert.equal(c.status, 'fail');
  assert.ok(c.details.some((d) => d.includes('MASTER_INSTRUCTIONS.md')), c.details.join('\n'));
});

test('checkSkillFrontmatter unit rules', () => {
  assert.deepEqual(checkSkillFrontmatter('---\nname: good-name-1\ndescription: Does a thing.\n---\n# x\n'), []);
  assert.ok(checkSkillFrontmatter(`---\nname: ${'a'.repeat(65)}\ndescription: ok\n---\n`).length > 0);
  assert.ok(checkSkillFrontmatter(`---\nname: ok-name\ndescription: ${'d'.repeat(1025)}\n---\n`).length > 0);
  assert.ok(checkSkillFrontmatter('# no front matter\n').length > 0);
});

test('validateSkill rejects a missing root', async () => {
  await assert.rejects(validateSkill(path.join(ROOT, 'tests', 'fixtures', 'does-not-exist')), (e) => e.code === 'ENOROOT');
});

test('CLI exit codes: 0 valid, 1 broken, 64 usage', () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 20000 });
  assert.equal(run('--root', VALID, '--fixture-mode').status, EXIT.PASS);
  const broken = run('--root', BROKEN, '--fixture-mode');
  assert.equal(broken.status, EXIT.FAIL);
  assert.ok(!broken.stdout.includes(FAKE_KEY));
  assert.equal(run('--bogus').status, EXIT.USAGE);
  assert.equal(run('--help').status, 0);
});
