#!/usr/bin/env node
// Deterministic request router for the arkononion-ui-ux skill (BUILD-SPEC section 6).
//
// Scores every route in routing/routes.json by the summed weights of its matched trigger
// patterns (each trigger counts once), picks the primary route (highest score >= 1, ties go
// to the earlier route) and the secondary routes (score >= min(2, max(1, 0.5 x primary))), then
// adds the always-on modules, keyword modifiers, approval checkpoints and warnings. Falls back to
// the table's fallback route (new-product) when nothing matches. Offline, zero dependencies.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { PACKAGE_ROOT, isMainModule, SECRET_PATTERNS } from './lib/fsutil.mjs';

export const ROUTES_FILE = path.join(PACKAGE_ROOT, 'routing', 'routes.json');
export const EXIT = Object.freeze({ OK: 0, INVALID_ROUTES: 2, USAGE: 64 });
/** Only the first MAX_INPUT_CHARS characters of a request are analysed. */
export const MAX_INPUT_CHARS = 100_000;
const ECHO_CHARS = 1_000;
const SECRET_WARNING = Object.freeze({
  id: 'secret-in-input',
  modules: ['references/security-and-privacy.md'],
  note: 'The request contains a credential-like string. It was redacted from this output; do not repeat, log or commit it, and suggest rotating it if it was real.',
});

function routesError(message) {
  const error = new Error(message);
  error.code = 'EROUTES';
  return error;
}

/**
 * Read and parse a routes file (default: routing/routes.json).
 * @param {string} [file]
 * @returns {object}
 */
export function loadRoutes(file = ROUTES_FILE) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    throw routesError(e.code === 'ENOENT' ? `routes file not found: ${file}` : `cannot read routes file ${file}: ${e.message}`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw routesError(`invalid JSON in routes file ${file}: ${e.message}`);
  }
}

let defaultTable = null;
function getDefaultRoutes() {
  defaultTable ??= loadRoutes();
  return defaultTable;
}

/** Normalise a module reference: bare ids become references/<id>.md. */
export function modulePath(ref) {
  const s = String(ref).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  return s.includes('/') || /\.(md|json)$/.test(s) ? s : `references/${s}.md`;
}

/** Normalise a workflow reference: bare ids become workflows/<id>.md. */
export function workflowPath(ref) {
  const s = String(ref).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  return s.includes('/') || s.endsWith('.md') ? s : `workflows/${s}.md`;
}

const compiledTables = new WeakMap();

/**
 * Compile a routes table (regexes, normalised paths). Cached per table object.
 * Throws an Error with code 'EROUTES' when the table is structurally unusable or a pattern
 * is not a valid regular expression.
 * @param {object} table Parsed routes.json.
 */
export function compileRoutes(table) {
  if (!table || typeof table !== 'object' || !Array.isArray(table.routes) || table.routes.length === 0) {
    throw routesError('routes table must be an object with a non-empty "routes" array');
  }
  const cached = compiledTables.get(table);
  if (cached) return cached;

  const list = (v) => (Array.isArray(v) ? v : []);
  const regex = (source, where) => {
    if (typeof source !== 'string' || source === '') throw routesError(`${where}: pattern must be a non-empty string`);
    try {
      return new RegExp(source, 'i');
    } catch (e) {
      throw routesError(`${where}: invalid regular expression: ${e.message}`);
    }
  };

  const ids = new Set();
  const routes = table.routes.map((r, i) => {
    if (!r || typeof r.id !== 'string' || r.id === '') throw routesError(`routes[${i}]: missing "id"`);
    if (ids.has(r.id)) throw routesError(`routes[${i}]: duplicate route id "${r.id}"`);
    ids.add(r.id);
    return {
      id: r.id,
      index: i,
      workflow: r.workflow ? workflowPath(r.workflow) : null,
      modules: list(r.modules).map(modulePath),
      delegateSkills: list(r.delegateSkills),
      presets: list(r.presets),
      triggers: list(r.triggers).map((t, j) => {
        const weight = Number(t?.weight);
        if (!Number.isFinite(weight) || weight < 0) throw routesError(`routes[${i}].triggers[${j}]: weight must be a non-negative number`);
        return { re: regex(t?.pattern, `routes[${i}].triggers[${j}]`), weight };
      }),
    };
  });
  const byId = new Map(routes.map((r) => [r.id, r]));

  const group = (items, name) =>
    list(items).map((item, i) => {
      if (!item || typeof item.id !== 'string') throw routesError(`${name}[${i}]: missing "id"`);
      return {
        id: item.id,
        note: typeof item.note === 'string' ? item.note : '',
        modules: list(item.modules).map(modulePath),
        delegateSkills: list(item.delegateSkills),
        patterns: list(item.patterns).map((p, j) => regex(p, `${name}[${i}].patterns[${j}]`)),
      };
    });

  const fb = table.fallback;
  const fallbackId = typeof fb === 'string' ? fb : fb && typeof fb === 'object' ? fb.route : undefined;
  let fallback = fallbackId ? byId.get(fallbackId) : undefined;
  if (fallbackId && !fallback && typeof fb === 'string') {
    throw routesError(`fallback route "${fallbackId}" is not defined in routes[]`);
  }
  if (!fallback) {
    // An object fallback without a matching route describes its own workflow/modules.
    fallback = {
      id: fallbackId ?? 'new-product',
      index: -1,
      workflow: fb?.workflow ? workflowPath(fb.workflow) : null,
      modules: list(fb?.modules).map(modulePath),
      delegateSkills: [],
      presets: [],
      triggers: [],
    };
  }

  const compiled = {
    always: list(table.always).map(modulePath),
    routes,
    byId,
    modifiers: group(table.modifiers, 'modifiers'),
    approvals: group(table.approvalTriggers, 'approvalTriggers'),
    warnings: group(table.warningPatterns, 'warningPatterns'),
    fallback,
  };
  compiledTables.set(table, compiled);
  return compiled;
}

/**
 * Normalise request text for matching: Unicode NFKC, strip zero-width characters (they are
 * used to dodge keyword filters), straighten quotes and dashes, collapse whitespace.
 * @param {*} text
 * @returns {string}
 */
export function normalizeText(text) {
  let s = typeof text === 'string' ? text : text == null ? '' : String(text);
  if (s.length > MAX_INPUT_CHARS) s = s.slice(0, MAX_INPUT_CHARS);
  return s
    .normalize('NFKC')
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/[‘’‛′ʼ]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Replace credential-like strings (fsutil SECRET_PATTERNS) with "[redacted]".
 * @param {string} text
 * @returns {{text: string, found: boolean}}
 */
export function redactSecrets(text) {
  let found = false;
  let out = text;
  for (const { re } of SECRET_PATTERNS) {
    out = out.replace(re, () => {
      found = true;
      return '[redacted]';
    });
  }
  return { text: out, found };
}

const uniq = (values) => [...new Set(values.filter(Boolean))];

/**
 * Route a request.
 * @param {string} text Request text (empty or missing routes to the fallback).
 * @param {object} [routesJson] Parsed routes table; defaults to routing/routes.json.
 * @returns {{input: string, primary: string, secondary: string[], workflows: string[],
 *   modules: string[], delegateSkills: string[], presets: string[], approvals: string[],
 *   warnings: string[], modifiers: string[], scores: Record<string, number>, notes: string[]}}
 */
export function route(text, routesJson) {
  const table = compileRoutes(routesJson ?? getDefaultRoutes());
  const rawLength = typeof text === 'string' ? text.length : 0;
  const { text: subject, found: secretFound } = redactSecrets(normalizeText(text));

  const scores = {};
  for (const r of table.routes) {
    scores[r.id] = r.triggers.reduce((sum, t) => (t.re.test(subject) ? sum + t.weight : sum), 0);
  }

  let primary = null;
  for (const r of table.routes) {
    if (scores[r.id] >= 1 && (primary === null || scores[r.id] > scores[primary.id])) primary = r;
  }
  let secondary = [];
  if (primary) {
    // Half the primary's score, capped at 2 so a strong primary does not hide a real second concern.
    const threshold = Math.min(2, Math.max(1, 0.5 * scores[primary.id]));
    secondary = table.routes
      .filter((r) => r !== primary && scores[r.id] >= threshold)
      .sort((a, b) => scores[b.id] - scores[a.id] || a.index - b.index);
  } else {
    primary = table.fallback;
  }

  const fired = (items) => items.filter((item) => item.patterns.some((re) => re.test(subject)));
  const modifiers = fired(table.modifiers);
  const approvals = fired(table.approvals);
  const warnings = fired(table.warnings);
  if (secretFound) warnings.push(SECRET_WARNING);

  const chosen = [primary, ...secondary];
  const notes = [
    ...approvals.map((a) => `approval ${a.id}: ${a.note}`.trim()),
    ...warnings.map((w) => `warning ${w.id}: ${w.note}`.trim()),
    ...modifiers.filter((m) => m.note).map((m) => `modifier ${m.id}: ${m.note}`),
  ];
  if (rawLength > MAX_INPUT_CHARS) notes.push(`input longer than ${MAX_INPUT_CHARS} characters: only the beginning was analysed`);

  const delegateSkills = uniq([...chosen.flatMap((r) => r.delegateSkills), ...modifiers.flatMap((m) => m.delegateSkills)]);
  if (delegateSkills.length) notes.push('delegateSkills: use if installed (check the capability registry or the session skill list); otherwise follow the listed modules');

  return {
    input: subject.length > ECHO_CHARS ? `${subject.slice(0, ECHO_CHARS)}…` : subject,
    primary: primary.id,
    secondary: secondary.map((r) => r.id),
    workflows: uniq(chosen.map((r) => r.workflow)),
    modules: uniq([
      ...table.always,
      ...chosen.flatMap((r) => r.modules),
      ...modifiers.flatMap((m) => m.modules),
      ...approvals.flatMap((a) => a.modules),
      ...warnings.flatMap((w) => w.modules),
    ]),
    delegateSkills,
    presets: uniq(chosen.flatMap((r) => r.presets)),
    approvals: approvals.map((a) => a.id),
    warnings: warnings.map((w) => w.id),
    modifiers: modifiers.map((m) => m.id),
    scores,
    notes,
  };
}

const HELP = `Usage: node scripts/route.mjs [options] [--] "request text"
       <text> | node scripts/route.mjs [options]

Routes a UI/UX request to a primary workflow, secondary routes, reference modules,
delegate skills ("use if installed"), approval checkpoints and warnings using the
weighted patterns in routing/routes.json. Deterministic and offline.

Output (JSON): input (whitespace-normalised, credentials redacted, first 1000 chars),
primary, secondary[], workflows[], modules[], delegateSkills[], presets[], approvals[],
warnings[], modifiers[], scores{}, notes[].

Options:
  --pretty          Pretty-print the JSON.
  --routes <file>   Use another routes file (default: routing/routes.json).
  -h, --help        Show this help.

Use "--" before request text that starts with "-". Empty text routes to new-product.

Exit codes:
  0   routed
  2   routes file unreadable or invalid
  64  usage error (unknown option, no text on the command line or stdin)
`;

async function readStdin(limitBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
    size += chunk.length;
    if (size >= limitBytes) break;
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * CLI entry point.
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        pretty: { type: 'boolean', default: false },
        routes: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: true,
    });
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n\n${HELP}`);
    return EXIT.USAGE;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }

  let table;
  try {
    table = values.routes ? loadRoutes(path.resolve(values.routes)) : loadRoutes();
    compileRoutes(table);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    return EXIT.INVALID_ROUTES;
  }

  let text;
  if (positionals.length > 0) {
    text = positionals.join(' ');
  } else if (process.stdin.isTTY) {
    process.stderr.write(`Error: pass the request text as an argument or on stdin.\n\n${HELP}`);
    return EXIT.USAGE;
  } else {
    text = await readStdin(MAX_INPUT_CHARS * 4);
  }

  const result = route(text, table);
  process.stdout.write(`${JSON.stringify(result, null, values.pretty ? 2 : 0)}\n`);
  return EXIT.OK;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`);
      process.exitCode = EXIT.INVALID_ROUTES;
    },
  );
}
