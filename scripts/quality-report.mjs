#!/usr/bin/env node
// Quality report validator and template generator for gates A-H (ultimate-uiux skill).
// Zero dependencies; Node >= 18.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { validate, formatErrors } from './lib/schema.mjs';
import { PACKAGE_ROOT, readJson, writeFileSafe, isMainModule } from './lib/fsutil.mjs';

/** Canonical gate names. */
export const GATES = Object.freeze({
  A: 'Skill package integrity',
  B: 'Functional correctness',
  C: 'Visual quality',
  D: 'Accessibility',
  E: 'Performance',
  F: 'Responsive behavior',
  G: 'Asset integrity',
  H: 'Reliability and security',
});

export const STATUSES = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED', 'NOT_APPLICABLE']);

/** Process exit codes. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCOMPLETE: 2, INVALID: 3, USAGE: 64 });

const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'schemas', 'quality-report.schema.json');
let cachedSchema = null;

/**
 * Load the bundled quality-report schema (cached).
 * @returns {object}
 */
export function loadReportSchema() {
  if (!cachedSchema) {
    const text = readFileSync(SCHEMA_PATH, 'utf8').replace(/^﻿/, '');
    cachedSchema = JSON.parse(text);
  }
  return cachedSchema;
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * @typedef {object} GateResult
 * @property {string} name        Canonical gate name.
 * @property {string|null} declared Status written in the report.
 * @property {string} effective   Status after honesty rules (open critical finding => FAIL).
 * @property {boolean} required
 * @property {number} evidence    Count of complete evidence items.
 * @property {string[]} openCritical Ids of open critical findings.
 */

/**
 * Evaluate a parsed quality report: schema validation, honesty rules and overall result.
 *
 * Rules: PASS needs >= 1 complete evidence item {check, tool, result}; every non-PASS status
 * needs a non-empty reason; a gate with an open critical finding is counted as FAIL; overall is
 * FAIL if any gate fails, INCOMPLETE if any required gate is BLOCKED or NOT_TESTED, else PASS.
 *
 * @param {any} report Parsed report JSON.
 * @param {{schema?: object}} [options]
 * @returns {{valid: boolean, overall: 'PASS'|'FAIL'|'INCOMPLETE'|null, declaredOverall: string|null,
 *   exitCode: number, schemaErrors: string[], errors: string[], overrides: string[],
 *   warnings: string[], gates: Record<string, GateResult>}}
 */
export function evaluateReport(report, options = {}) {
  const result = {
    valid: false,
    overall: null,
    declaredOverall: null,
    exitCode: EXIT.INVALID,
    schemaErrors: [],
    errors: [],
    overrides: [],
    warnings: [],
    gates: {},
  };
  if (!isObject(report)) {
    result.errors.push('report must be a JSON object');
    return result;
  }
  const schema = options.schema ?? loadReportSchema();
  result.schemaErrors = formatErrors(validate(schema, report).errors);
  result.declaredOverall = typeof report.overall === 'string' ? report.overall : null;

  const gates = isObject(report.gates) ? report.gates : {};
  if (!isObject(report.gates)) result.errors.push('"gates" must be an object with keys A-H');

  for (const [key, canonical] of Object.entries(GATES)) {
    const gate = gates[key];
    if (!isObject(gate)) {
      result.errors.push(`gate ${key} (${canonical}) is missing; add it with status NOT_TESTED and a reason if it was not run`);
      result.gates[key] = { name: canonical, declared: null, effective: 'NOT_TESTED', required: true, evidence: 0, openCritical: [] };
      continue;
    }
    const declared = typeof gate.status === 'string' ? gate.status : null;
    const required = gate.required !== false; // anything but an explicit false counts as required
    const evidence = Array.isArray(gate.evidence) ? gate.evidence : [];
    const findings = Array.isArray(gate.findings) ? gate.findings : [];
    const complete = evidence.filter((e) => isObject(e) && nonEmpty(e.check) && nonEmpty(e.tool) && nonEmpty(e.result));
    const openCritical = findings
      .filter((f) => isObject(f) && f.severity === 'critical' && f.status === 'open')
      .map((f, i) => (nonEmpty(f.id) ? f.id : `#${i + 1}`));
    const openHigh = findings.filter((f) => isObject(f) && f.severity === 'high' && f.status === 'open');
    let effective = STATUSES.includes(declared) ? declared : 'NOT_TESTED';

    if (!STATUSES.includes(declared)) {
      result.errors.push(`gate ${key} status must be one of ${STATUSES.join(', ')} (got ${JSON.stringify(gate.status)})`);
    }
    if (typeof gate.required !== 'boolean') {
      result.errors.push(`gate ${key} "required" must be true or false`);
    }
    if (nonEmpty(gate.name) && gate.name.trim() !== canonical) {
      result.warnings.push(`gate ${key} is named "${gate.name}"; the canonical name is "${canonical}"`);
    }
    if (evidence.length !== complete.length) {
      result.warnings.push(`gate ${key} has ${evidence.length - complete.length} incomplete evidence item(s); each needs non-empty check, tool and result`);
    }
    if (declared === 'PASS' && complete.length === 0) {
      result.errors.push(`gate ${key} (${canonical}) is PASS without evidence; add at least one {check, tool, result} item from a real run, or set status NOT_TESTED with a reason`);
    }
    if (declared !== null && declared !== 'PASS' && !nonEmpty(gate.reason)) {
      result.errors.push(`gate ${key} (${canonical}) is ${declared} but has no reason; explain what failed, what blocked it or why it was not tested`);
    }
    if (openCritical.length && effective !== 'FAIL') {
      result.overrides.push(`gate ${key} (${canonical}) declared ${declared} but has open critical finding(s) ${openCritical.join(', ')}; counted as FAIL`);
      effective = 'FAIL';
    }
    if (declared === 'PASS' && openHigh.length) {
      result.warnings.push(`gate ${key} passes with ${openHigh.length} open high-severity finding(s); confirm they were accepted by the user or fix them`);
    }
    for (const f of findings) {
      if (isObject(f) && f.status === 'fixed' && !nonEmpty(f.verification)) {
        result.warnings.push(`gate ${key} finding ${f.id ?? '(no id)'} is marked fixed without a verification note`);
      }
      if (isObject(f) && f.status === 'accepted' && f.severity === 'critical') {
        result.warnings.push(`gate ${key} finding ${f.id ?? '(no id)'} is a critical finding marked accepted; make sure the user explicitly accepted this risk`);
      }
    }
    result.gates[key] = { name: canonical, declared, effective, required, evidence: complete.length, openCritical };
  }

  const effectives = Object.values(result.gates);
  if (effectives.some((g) => g.effective === 'FAIL')) result.overall = 'FAIL';
  else if (effectives.some((g) => g.required && (g.effective === 'BLOCKED' || g.effective === 'NOT_TESTED'))) result.overall = 'INCOMPLETE';
  else result.overall = 'PASS';

  if (result.declaredOverall !== null && result.declaredOverall !== result.overall) {
    result.overrides.push(`report declares overall ${result.declaredOverall} but the gate statuses support ${result.overall}; ${result.overall} is used`);
  }

  result.valid = result.schemaErrors.length === 0 && result.errors.length === 0;
  result.exitCode = result.valid ? EXIT[result.overall] : EXIT.INVALID;
  return result;
}

/**
 * Build an empty report template: every gate NOT_TESTED with a reason (gate A NOT_APPLICABLE
 * and not required, because most projects are not skill packages).
 * @param {{project?: string, scope?: string, date?: string}} [options]
 * @returns {object}
 */
export function createTemplate(options = {}) {
  const now = new Date();
  const date = options.date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const gates = {};
  for (const [key, name] of Object.entries(GATES)) {
    gates[key] = key === 'A'
      ? {
          name,
          status: 'NOT_APPLICABLE',
          required: false,
          evidence: [],
          findings: [],
          reason: 'The deliverable is not a skill package. If it is, set status NOT_TESTED, required true, and run scripts/validate-skill.mjs.',
        }
      : { name, status: 'NOT_TESTED', required: true, evidence: [], findings: [], reason: 'Not run yet.' };
  }
  return {
    project: options.project ?? 'unnamed-project',
    scope: options.scope ?? 'Describe the pages, components, viewports and build that were reviewed.',
    generatedOn: date,
    environment: {
      os: process.platform,
      node: process.version,
      browsers: [],
      tools: [],
    },
    gates,
    overall: 'INCOMPLETE',
    limitations: ['Template generated by scripts/quality-report.mjs --init; no checks have been run yet.'],
  };
}

const HELP = `Usage:
  node scripts/quality-report.mjs --report <file> [--json]
  node scripts/quality-report.mjs --init [--project <name>] [--scope <text>] [--out <file> [--force]]

Validates a quality report (gates A-H) against schemas/quality-report.schema.json and
enforces honesty rules:
  - PASS requires at least one evidence item {check, tool, result}
  - FAIL, BLOCKED, NOT_TESTED and NOT_APPLICABLE require a non-empty reason
  - a gate with an open critical finding is counted as FAIL
  - overall = FAIL if any gate fails, INCOMPLETE if any required gate is BLOCKED or
    NOT_TESTED, otherwise PASS (a declared "overall" is recomputed, never trusted)

Options:
  --report <file>   Report JSON to evaluate.
  --json            Print the evaluation as JSON instead of a text summary.
  --init            Print a template report (all gates NOT_TESTED with reasons).
  --project <name>  Project name for --init.
  --scope <text>    Scope description for --init.
  --out <file>      Write the --init template to this file instead of stdout.
  --force           Allow --out to replace an existing file.
  -h, --help        Show this help.

Exit codes:
  0  overall PASS (or --init succeeded)
  1  overall FAIL
  2  overall INCOMPLETE (a required gate is BLOCKED or NOT_TESTED)
  3  invalid report (unreadable, bad JSON, schema or honesty-rule violations)
  64 usage error (bad arguments, refusing to overwrite an existing --out file)
`;

function printText(evaluation, file) {
  const lines = [`quality-report: ${file}`];
  for (const [key, g] of Object.entries(evaluation.gates)) {
    const shown = g.declared === g.effective || g.declared === null ? g.effective : `${g.effective} (declared ${g.declared})`;
    lines.push(`  ${key} ${g.name.padEnd(26)} ${shown.padEnd(16)} ${g.required ? 'required' : 'optional'}  evidence:${g.evidence}`);
  }
  const section = (title, items) => {
    if (items.length) lines.push(`${title}:`, ...items.map((m) => `  - ${m}`));
  };
  section('Schema errors', evaluation.schemaErrors);
  section('Honesty errors', evaluation.errors);
  section('Overrides', evaluation.overrides);
  section('Warnings', evaluation.warnings);
  lines.push(evaluation.valid ? `Overall: ${evaluation.overall}` : `Report INVALID (exit ${EXIT.INVALID}); computed overall would be ${evaluation.overall}`);
  return lines.join('\n');
}

/**
 * CLI entry point.
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export async function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        report: { type: 'string' },
        json: { type: 'boolean', default: false },
        init: { type: 'boolean', default: false },
        project: { type: 'string' },
        scope: { type: 'string' },
        out: { type: 'string' },
        force: { type: 'boolean', default: false },
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
    return 0;
  }
  if (args.init && args.report) {
    process.stderr.write('Error: use either --init or --report, not both.\n');
    return EXIT.USAGE;
  }
  if (args.init) {
    const template = createTemplate({ project: args.project, scope: args.scope });
    const text = `${JSON.stringify(template, null, 2)}\n`;
    if (args.out) {
      try {
        await writeFileSafe(path.resolve(args.out), text, { force: args.force });
      } catch (e) {
        process.stderr.write(`Error: ${e.message}\n`);
        return EXIT.USAGE;
      }
      process.stderr.write(`Wrote template report to ${path.resolve(args.out)}\n`);
    } else {
      process.stdout.write(text);
    }
    return 0;
  }
  if (!args.report) {
    process.stderr.write(`Error: --report <file> or --init is required.\n\n${HELP}`);
    return EXIT.USAGE;
  }
  if (args.out || args.force || args.project || args.scope) {
    process.stderr.write('Error: --out, --force, --project and --scope only apply to --init.\n');
    return EXIT.USAGE;
  }
  const file = path.resolve(args.report);
  let report;
  try {
    report = await readJson(file);
  } catch (e) {
    const evaluation = { valid: false, exitCode: EXIT.INVALID, errors: [e.message] };
    if (args.json) process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
    else process.stderr.write(`Error: ${e.message}\n`);
    return EXIT.INVALID;
  }
  const evaluation = evaluateReport(report);
  if (args.json) process.stdout.write(`${JSON.stringify({ file, ...evaluation }, null, 2)}\n`);
  else process.stdout.write(`${printText(evaluation, file)}\n`);
  return evaluation.exitCode;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`);
      process.exitCode = EXIT.INVALID;
    },
  );
}
