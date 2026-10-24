// Tests for scripts/quality-report.mjs (gates A-H honesty rules, overall logic, CLI, --init).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { evaluateReport, createTemplate, EXIT, GATES } from '../scripts/quality-report.mjs';
import { PACKAGE_ROOT } from '../scripts/lib/fsutil.mjs';

const SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'quality-report.mjs');
const run = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 60000, cwd });
const EVIDENCE = [{ check: 'production build', tool: 'npm run build', result: 'exit 0' }];
let tmp;

before(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'uiux quality test '));
});
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Every gate PASS with evidence, optionally overriding gates. */
function report(overrides = {}) {
  const gates = {};
  for (const [key, name] of Object.entries(GATES)) {
    gates[key] = { name, status: 'PASS', required: true, evidence: EVIDENCE, findings: [], ...(overrides[key] ?? {}) };
  }
  return { project: 'fixture', scope: 'unit test', generatedOn: '2026-10-24', environment: 'node --test', gates, limitations: [] };
}

function writeReport(name, data) {
  const file = path.join(tmp, name);
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return file;
}

const CRITICAL_OPEN = { id: 'D-1', severity: 'critical', location: '/pricing toggle', issue: 'no accessible name', status: 'open' };

test('a fully evidenced report passes with exit 0', () => {
  const ev = evaluateReport(report());
  assert.equal(ev.valid, true, [...ev.schemaErrors, ...ev.errors].join('; '));
  assert.equal(ev.overall, 'PASS');
  assert.equal(ev.exitCode, EXIT.PASS);
});

test('PASS without evidence is rejected', () => {
  const ev = evaluateReport(report({ C: { evidence: [] } }));
  assert.equal(ev.valid, false);
  assert.equal(ev.exitCode, EXIT.INVALID);
  assert.ok(ev.errors.some((e) => e.includes('gate C') && e.includes('without evidence')));
  assert.ok(ev.schemaErrors.some((e) => e.startsWith('/gates/C/evidence')));
});

test('PASS with only incomplete evidence (missing tool) is rejected', () => {
  const ev = evaluateReport(report({ E: { evidence: [{ check: 'lighthouse', tool: '', result: '98' }] } }));
  assert.equal(ev.valid, false);
  assert.equal(ev.gates.E.evidence, 0);
  assert.ok(ev.errors.some((e) => e.includes('gate E')));
});

test('an open critical finding forces FAIL even when the gate is declared PASS', () => {
  const ev = evaluateReport(report({ D: { findings: [CRITICAL_OPEN] } }));
  assert.equal(ev.valid, true, ev.errors.join('; '));
  assert.equal(ev.gates.D.declared, 'PASS');
  assert.equal(ev.gates.D.effective, 'FAIL');
  assert.deepEqual(ev.gates.D.openCritical, ['D-1']);
  assert.equal(ev.overall, 'FAIL');
  assert.equal(ev.exitCode, EXIT.FAIL);
  assert.ok(ev.overrides.some((o) => o.includes('D-1')));
});

test('fixed or non-critical findings do not force FAIL', () => {
  const fixed = { ...CRITICAL_OPEN, status: 'fixed', verification: 'axe re-run: 0 violations' };
  const high = { ...CRITICAL_OPEN, id: 'D-2', severity: 'high' };
  const ev = evaluateReport(report({ D: { findings: [fixed, high] } }));
  assert.equal(ev.valid, true);
  assert.equal(ev.overall, 'PASS');
  assert.ok(ev.warnings.some((w) => w.includes('high-severity')));
});

test('NOT_TESTED (and every other non-PASS status) needs a reason', () => {
  for (const status of ['NOT_TESTED', 'BLOCKED', 'FAIL', 'NOT_APPLICABLE']) {
    const missing = evaluateReport(report({ C: { status, evidence: [] } }));
    assert.equal(missing.valid, false, `${status} without reason must be invalid`);
    assert.ok(missing.errors.some((e) => e.includes('gate C') && e.includes('no reason')), status);
    const blank = evaluateReport(report({ C: { status, evidence: [], reason: '   ' } }));
    assert.equal(blank.valid, false, `${status} with a blank reason must be invalid`);
    const given = evaluateReport(report({ C: { status, evidence: [], reason: 'Playwright browsers not installed' } }));
    assert.equal(given.valid, true, `${status} with a reason: ${given.errors.join('; ')}`);
  }
});

test('overall: INCOMPLETE when a required gate is BLOCKED or NOT_TESTED; optional gates and N/A do not count', () => {
  const blocked = evaluateReport(report({ G: { status: 'BLOCKED', reason: 'ffprobe missing' } }));
  assert.equal(blocked.overall, 'INCOMPLETE');
  assert.equal(blocked.exitCode, EXIT.INCOMPLETE);
  const notTested = evaluateReport(report({ F: { status: 'NOT_TESTED', reason: 'not run', evidence: [] } }));
  assert.equal(notTested.overall, 'INCOMPLETE');
  const optional = evaluateReport(report({ A: { status: 'NOT_TESTED', required: false, reason: 'not a skill package', evidence: [] } }));
  assert.equal(optional.overall, 'PASS');
  const na = evaluateReport(report({ A: { status: 'NOT_APPLICABLE', reason: 'not a skill package', evidence: [] } }));
  assert.equal(na.overall, 'PASS');
  const failWins = evaluateReport(report({
    C: { status: 'FAIL', reason: 'contrast below 4.5:1' },
    G: { status: 'BLOCKED', reason: 'ffprobe missing' },
  }));
  assert.equal(failWins.overall, 'FAIL');
  assert.equal(failWins.exitCode, EXIT.FAIL);
});

test('a declared overall is recomputed, never trusted', () => {
  const ev = evaluateReport({ ...report({ H: { status: 'NOT_TESTED', reason: 'not run', evidence: [] } }), overall: 'PASS' });
  assert.equal(ev.overall, 'INCOMPLETE');
  assert.ok(ev.overrides.some((o) => o.includes('declares overall PASS')));
});

test('a missing gate or a non-object report is invalid', () => {
  const r = report();
  delete r.gates.H;
  const ev = evaluateReport(r);
  assert.equal(ev.valid, false);
  assert.ok(ev.errors.some((e) => e.includes('gate H')));
  assert.equal(evaluateReport(null).valid, false);
  assert.equal(evaluateReport([]).exitCode, EXIT.INVALID);
});

test('--init output validates: every gate has a reason, none is PASS, overall INCOMPLETE', () => {
  const res = run(['--init', '--project', 'demo shop', '--scope', 'home and checkout']);
  assert.equal(res.status, 0, res.stderr);
  const template = JSON.parse(res.stdout);
  assert.equal(template.project, 'demo shop');
  const ev = evaluateReport(template);
  assert.equal(ev.valid, true, [...ev.schemaErrors, ...ev.errors].join('; '));
  assert.equal(ev.overall, 'INCOMPLETE');
  for (const [key, gate] of Object.entries(template.gates)) {
    assert.notEqual(gate.status, 'PASS', `gate ${key}`);
    assert.ok(gate.reason && gate.reason.trim(), `gate ${key} needs a reason`);
  }
  assert.equal(evaluateReport(createTemplate({ date: '2026-10-24' })).valid, true);
});

test('--init --out writes once and refuses to overwrite without --force', () => {
  const out = path.join(tmp, 'nested dir', 'report.json');
  const first = run(['--init', '--out', out]);
  assert.equal(first.status, 0, first.stderr);
  const written = readFileSync(out, 'utf8');
  assert.equal(evaluateReport(JSON.parse(written)).valid, true);
  writeFileSync(out, '{"keep": true}');
  const second = run(['--init', '--out', out]);
  assert.equal(second.status, EXIT.USAGE);
  assert.equal(readFileSync(out, 'utf8'), '{"keep": true}', 'existing file must be untouched');
  const forced = run(['--init', '--out', out, '--force']);
  assert.equal(forced.status, 0, forced.stderr);
});

test('CLI --report exit codes: 0 pass, 1 fail, 2 incomplete, 3 invalid, 64 usage', () => {
  assert.equal(run(['--report', writeReport('pass.json', report())]).status, 0);
  assert.equal(run(['--report', writeReport('fail.json', report({ D: { findings: [CRITICAL_OPEN] } }))]).status, 1);
  assert.equal(run(['--report', writeReport('incomplete.json', report({ G: { status: 'BLOCKED', reason: 'ffprobe missing' } }))]).status, 2);
  assert.equal(run(['--report', writeReport('nopass.json', report({ B: { evidence: [] } }))]).status, 3);
  assert.equal(run(['--report', writeReport('broken.json', '{ not json')]).status, 3);
  assert.equal(run(['--report', path.join(tmp, 'does-not-exist.json')]).status, 3);
  assert.equal(run([]).status, EXIT.USAGE);
  assert.equal(run(['--init', '--report', 'x.json']).status, EXIT.USAGE);
  assert.equal(run(['--bogus']).status, EXIT.USAGE);
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Exit codes/);
  const json = run(['--report', writeReport('pass2.json', report()), '--json']);
  assert.equal(JSON.parse(json.stdout).overall, 'PASS');
});

test('templates/quality-report.json is a valid example with no unevidenced PASS', () => {
  const template = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'templates', 'quality-report.json'), 'utf8'));
  assert.equal(template.example, true);
  const ev = evaluateReport(template);
  assert.equal(ev.valid, true, [...ev.schemaErrors, ...ev.errors].join('; '));
  assert.equal(ev.overall, template.overall, 'declared overall matches the computed one');
  for (const [key, gate] of Object.entries(template.gates)) {
    if (gate.status === 'PASS') assert.ok(ev.gates[key].evidence > 0, `gate ${key} PASS needs evidence`);
    if (gate.evidence.length === 0) {
      assert.equal(gate.status, 'NOT_TESTED', `gate ${key} has no evidence, so it must be NOT_TESTED`);
      assert.ok(gate.reason.trim().length > 0, `gate ${key} needs a reason`);
    }
  }
});
