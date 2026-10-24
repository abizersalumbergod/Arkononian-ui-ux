#!/usr/bin/env node
// Gate A (skill package integrity) validator for the ultimate-uiux skill.
// Zero dependencies; Node >= 18 ESM; Windows and POSIX.
//
// Checks: required files (build spec section 3), SKILL.md front matter, empty files, JSON parsing,
// schema conformance (templates, registry, presets, routes), relative Markdown links, routes.json
// targets, reachability of references/*.md and workflows/*.md, placeholder markers in shipped
// Markdown, secret-like strings, and MASTER_INSTRUCTIONS.md coverage.
// Read-only: never writes files. Never prints secret values or environment variables.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { validate, formatErrors } from './lib/schema.mjs';
import {
  PACKAGE_ROOT,
  readText,
  exists,
  statOrNull,
  walk,
  relPosix,
  toPosix,
  isInside,
  parseFrontmatter,
  extractLinks,
  headingSlugs,
  scanSecrets,
  isMainModule,
} from './lib/fsutil.mjs';
import { evaluateReport } from './quality-report.mjs';

/** Process exit codes. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, USAGE: 64 });

/** Package file list from the build spec section 3 (also the only allowed link targets). */
export const PACKAGE_FILES = Object.freeze({
  '': ['SKILL.md', 'README.md', 'MASTER_INSTRUCTIONS.md', 'CHANGELOG.md', 'LICENSES_AND_PROVENANCE.md'],
  references: [
    'capability-registry.md', 'capability-registry.json', 'skill-audit.md', 'skill-delegation.md',
    'design-intelligence.md', 'product-discovery.md', 'visual-systems.md', 'typography-and-layout.md',
    'design-tokens.md', 'dashboard-engineering.md', 'landing-page-engineering.md', 'interaction-design.md',
    'motion-engineering.md', 'three-dimensional-web.md', 'shader-and-creative-coding.md', 'asset-generation.md',
    'image-pipelines.md', 'video-pipelines.md', 'audio-pipelines.md', 'responsive-design.md', 'accessibility.md',
    'performance.md', 'visual-testing.md', 'visual-critique.md', 'frontend-architecture.md',
    'security-and-privacy.md', 'troubleshooting.md', 'quality-gates.md',
  ],
  workflows: [
    'new-product.md', 'existing-project.md', 'landing-page.md', 'dashboard.md', 'ecommerce.md',
    'cinematic-3d.md', 'design-system.md', 'asset-production.md', 'visual-regression.md',
  ],
  presets: ['README.md', 'cinematic-noir.json', 'monochrome-editorial.json', 'precision-saas.json', 'warm-commerce.json'],
  routing: ['routes.json'],
  schemas: [
    'capability-registry.schema.json', 'asset-manifest.schema.json', 'quality-report.schema.json',
    'routes.schema.json', 'preset.schema.json',
  ],
  scripts: [
    'README.md', 'lib/schema.mjs', 'lib/fsutil.mjs', 'environment-audit.mjs', 'route.mjs', 'validate-skill.mjs',
    'asset-validation.mjs', 'quality-report.mjs', 'build-tokens.mjs', 'visual-check.mjs',
  ],
  templates: ['design-brief.md', 'design-decision-record.md', 'asset-manifest.json', 'quality-report.json', 'acceptance-checklist.md'],
  evals: ['scenarios.json', 'README.md'],
});

/** Flattened section-3 file list (forward-slash paths relative to the package root). */
export const REQUIRED_FILES = Object.freeze(
  Object.entries(PACKAGE_FILES).flatMap(([dir, names]) => names.map((n) => (dir ? `${dir}/${n}` : n))),
);

/** Section-3 directories that must exist. */
export const REQUIRED_DIRS = Object.freeze(['tests/fixtures', 'evals/results']);

/** Section-3 patterns that must match at least one file. */
export const REQUIRED_PATTERNS = Object.freeze([{ dir: 'tests', suffix: '.test.mjs', label: 'tests/*.test.mjs' }]);

/** Minimal required set used by --fixture-mode (small test packages). */
export const FIXTURE_REQUIRED_FILES = Object.freeze(['SKILL.md', 'MASTER_INSTRUCTIONS.md', 'routing/routes.json']);

/** Links allowed to leave the package (sibling style skills), relative to the package root. */
export const ALLOWED_EXTERNAL_LINKS = Object.freeze([
  '../cinematic-noir-studio/SKILL.md',
  '../monochrome-editorial-portfolio/SKILL.md',
]);

/** JSON files checked against the bundled schemas (each only when present). */
export const SCHEMA_TARGETS = Object.freeze([
  { pattern: 'templates/asset-manifest.json', schema: 'asset-manifest.schema.json' },
  { pattern: 'templates/quality-report.json', schema: 'quality-report.schema.json', honesty: true },
  { pattern: 'references/capability-registry.json', schema: 'capability-registry.schema.json' },
  { pattern: 'presets/*.json', schema: 'preset.schema.json' },
  { pattern: 'routing/routes.json', schema: 'routes.schema.json' },
]);

/** Paths skipped by every scan. Test fixtures are intentionally broken, so they are excluded. */
export const SCAN_EXCLUDES = Object.freeze(['node_modules', '.git', 'tests/fixtures']);

const PACKAGE_DIRS = new Set([
  'references', 'workflows', 'presets', 'routing', 'schemas', 'scripts', 'scripts/lib', 'templates',
  'tests', 'tests/fixtures', 'evals', 'evals/results',
]);
const EMPTY_OK = new Set(['.gitkeep', '.keep']);
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_DETAILS_TEXT = 25;
const PLACEHOLDERS = Object.freeze([
  { label: 'TODO', re: /\bTODO\b/ },
  { label: 'TBD', re: /\bTBD\b/ },
  { label: 'lorem ipsum', re: /\blorem\s+ipsum\b/i },
]);

const MODE_LABEL = {
  package: 'package (required files from build spec section 3)',
  fixture: `fixture (required: ${FIXTURE_REQUIRED_FILES.join(', ')})`,
  custom: 'custom (--required-files)',
};

const keyOf = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
const arr = (v) => (Array.isArray(v) ? v : []);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function isFile(p) {
  const st = await statOrNull(p);
  return Boolean(st && st.isFile());
}

async function isDir(p) {
  const st = await statOrNull(p);
  return Boolean(st && st.isDirectory());
}

function makeCheck(id, title, failures, warnings = [], extra = {}) {
  const status = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';
  return { id, title, status, details: [...failures, ...warnings.map((w) => `warning: ${w}`)], ...extra };
}

function skipCheck(id, title, reason) {
  return { id, title, status: 'skip', details: [reason] };
}

// ---------------------------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------------------------

/**
 * Check SKILL.md front matter: name (lowercase letters, digits, hyphens; at most 64 characters;
 * no reserved words) and description (non-empty, at most 1024 characters, no XML tags).
 * @param {string} text Full SKILL.md contents.
 * @returns {string[]} Problems found (empty when valid).
 */
export function checkSkillFrontmatter(text) {
  const fm = parseFrontmatter(text);
  if (fm.error) return [`front matter is malformed: ${fm.error}`];
  if (!fm.data) return ['SKILL.md must start with a YAML front matter block ("---" ... "---") holding name and description'];
  const errors = [];
  const { name, description } = fm.data;
  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('"name" must be a non-empty string');
  } else {
    const len = [...name].length;
    if (len > 64) errors.push(`"name" has ${len} characters; the maximum is 64`);
    if (!/^[a-z0-9-]+$/.test(name)) errors.push(`"name" must use only lowercase letters, digits and hyphens (got ${JSON.stringify(name)})`);
    if (/anthropic|claude/.test(name)) errors.push('"name" must not contain the reserved words "anthropic" or "claude"');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    errors.push('"description" must be a non-empty string');
  } else {
    const len = [...description].length;
    if (len > 1024) errors.push(`"description" has ${len} characters; the maximum is 1024`);
    if (/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/.test(description)) errors.push('"description" must not contain XML/HTML tags');
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------

async function buildContext(root, options) {
  const files = await walk(root, { exclude: options.exclude ?? [...SCAN_EXCLUDES] });
  const textCache = new Map();
  const ctx = {
    root,
    files,
    conformance: options.conformance,
    json: new Map(),
    rel: (abs) => relPosix(root, abs),
    async text(abs) {
      const k = keyOf(abs);
      if (!textCache.has(k)) textCache.set(k, await readText(abs));
      return textCache.get(k);
    },
    childrenOf(dir, ext) {
      const parent = keyOf(path.join(root, dir));
      return files.filter((f) => keyOf(path.dirname(f)) === parent && f.toLowerCase().endsWith(ext));
    },
  };
  ctx.mdFiles = files.filter((f) => /\.md$/i.test(f));
  ctx.jsonFiles = files.filter((f) => /\.json$/i.test(f));
  return ctx;
}

function parseRequiredList(list) {
  const out = { files: [], dirs: [], patterns: [] };
  for (const raw of list) {
    const entry = String(raw).trim().replace(/\\/g, '/');
    if (!entry) continue;
    if (path.isAbsolute(entry) || /^[A-Za-z]:/.test(entry) || entry.split('/').includes('..')) {
      throw new TypeError(`required file entries must be relative paths inside the root (got ${JSON.stringify(raw)})`);
    }
    if (entry.endsWith('/')) out.dirs.push(entry.replace(/\/+$/, ''));
    else out.files.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

async function checkRequired(ctx, required) {
  const missing = [];
  for (const f of required.files) if (!(await isFile(path.join(ctx.root, f)))) missing.push(`missing file: ${f}`);
  for (const d of required.dirs) if (!(await isDir(path.join(ctx.root, d)))) missing.push(`missing directory: ${d}/`);
  for (const p of required.patterns) {
    let names = [];
    try {
      names = await readdir(path.join(ctx.root, p.dir));
    } catch {
      names = [];
    }
    if (!names.some((n) => n.endsWith(p.suffix))) missing.push(`no file matches ${p.label}`);
  }
  const total = required.files.length + required.dirs.length + required.patterns.length;
  return makeCheck('required-files', `Required files present (${total - missing.length}/${total})`, missing);
}

async function checkFrontmatter(ctx) {
  const skill = path.join(ctx.root, 'SKILL.md');
  if (!(await isFile(skill))) return makeCheck('frontmatter', 'SKILL.md front matter (name, description)', ['SKILL.md not found']);
  const problems = checkSkillFrontmatter(await ctx.text(skill)).map((p) => `SKILL.md: ${p}`);
  return makeCheck('frontmatter', 'SKILL.md front matter (name, description)', problems);
}

async function checkEmptyFiles(ctx) {
  const failures = [];
  for (const file of ctx.files) {
    if (EMPTY_OK.has(path.basename(file))) continue;
    const st = await statOrNull(file);
    if (!st) continue;
    if (st.size === 0) {
      failures.push(`${ctx.rel(file)}: empty file (0 bytes)`);
    } else if (st.size <= 4096) {
      const buf = await readFile(file);
      if (!buf.includes(0) && buf.toString('utf8').replace(/^﻿/, '').trim() === '') failures.push(`${ctx.rel(file)}: contains only whitespace`);
    }
  }
  return makeCheck('empty-files', `No empty files (${ctx.files.length} files scanned)`, failures);
}

async function checkJson(ctx) {
  const failures = [];
  for (const file of ctx.jsonFiles) {
    try {
      ctx.json.set(keyOf(file), JSON.parse(await ctx.text(file)));
    } catch (e) {
      failures.push(`${ctx.rel(file)}: ${e.message}`);
    }
  }
  return makeCheck('json-parse', `All JSON files parse (${ctx.jsonFiles.length} files)`, failures);
}

async function loadSchema(ctx, name) {
  for (const dir of [path.join(ctx.root, 'schemas'), path.join(PACKAGE_ROOT, 'schemas')]) {
    const p = path.join(dir, name);
    if (await isFile(p)) {
      try {
        return { schema: JSON.parse(await readText(p)) };
      } catch (e) {
        return { error: `schema ${name} is not valid JSON: ${e.message}` };
      }
    }
  }
  return { error: `schema ${name} not found in ${toPosix(path.join(ctx.root, 'schemas'))} or in the validator's own package` };
}

async function checkSchemas(ctx) {
  const failures = [];
  const results = [];
  for (const target of SCHEMA_TARGETS) {
    let files;
    if (target.pattern.includes('*')) {
      const dir = target.pattern.slice(0, target.pattern.indexOf('/'));
      files = ctx.childrenOf(dir, '.json');
    } else {
      const p = path.join(ctx.root, ...target.pattern.split('/'));
      files = (await isFile(p)) ? [p] : [];
    }
    if (!files.length) continue;
    const loaded = await loadSchema(ctx, target.schema);
    for (const file of files) {
      const rel = ctx.rel(file);
      if (loaded.error) {
        failures.push(`${rel}: ${loaded.error}`);
        results.push({ file: rel, schema: target.schema, valid: false, errors: [loaded.error] });
        continue;
      }
      const data = ctx.json.get(keyOf(file));
      if (data === undefined) {
        failures.push(`${rel}: not valid JSON (see json-parse)`);
        results.push({ file: rel, schema: target.schema, valid: false, errors: ['not valid JSON'] });
        continue;
      }
      const errors = formatErrors(validate(loaded.schema, data).errors);
      if (target.honesty) {
        const evaluation = evaluateReport(data, { schema: loaded.schema });
        errors.push(...evaluation.errors.map((e) => `honesty rule: ${e}`));
      }
      results.push({ file: rel, schema: target.schema, valid: errors.length === 0, errors });
      for (const e of errors.slice(0, 10)) failures.push(`${rel}: ${e}`);
      if (errors.length > 10) failures.push(`${rel}: ... ${errors.length - 10} more schema errors`);
    }
  }
  if (!results.length) return { ...skipCheck('schemas', 'Schema checks', 'no schema-checked JSON files present'), data: results };
  const title = `Schema checks (${results.filter((r) => r.valid).length}/${results.length} files valid)`;
  return makeCheck('schemas', title, failures, [], { data: results });
}

async function caseMismatch(root, abs, cache) {
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  let cur = root;
  for (const seg of rel.split(path.sep)) {
    if (seg === '' || seg === '.') continue;
    let names = cache.get(cur);
    if (!names) {
      try {
        names = await readdir(cur);
      } catch {
        return null;
      }
      cache.set(cur, names);
    }
    if (!names.includes(seg)) {
      const actual = names.find((n) => n.toLowerCase() === seg.toLowerCase());
      return actual ? { expected: seg, actual } : null;
    }
    cur = path.join(cur, seg);
  }
  return null;
}

function isListedTarget(rel) {
  const clean = rel.replace(/\/+$/, '');
  return clean === '' || REQUIRED_FILES.includes(clean) || PACKAGE_DIRS.has(clean)
    || clean.startsWith('tests/') || clean.startsWith('evals/results/');
}

async function checkLinks(ctx) {
  const failures = [];
  const warnings = [];
  const dirCache = new Map();
  let count = 0;
  for (const file of ctx.mdFiles) {
    for (const link of extractLinks(await ctx.text(file))) {
      if (!link.path) continue;
      count++;
      const where = `${ctx.rel(file)}:${link.line}`;
      const target = path.resolve(path.dirname(file), link.path);
      if (!isInside(ctx.root, target)) {
        const relToRoot = toPosix(path.relative(ctx.root, target));
        if (ALLOWED_EXTERNAL_LINKS.includes(relToRoot)) {
          if (!(await exists(target))) warnings.push(`${where} sibling skill not found on this machine: ${link.target}`);
        } else {
          failures.push(`${where} links outside the package: ${link.target}`);
        }
        continue;
      }
      if (!(await exists(target))) {
        failures.push(`${where} broken link: ${link.target}`);
        continue;
      }
      const mismatch = await caseMismatch(ctx.root, target, dirCache);
      if (mismatch) {
        failures.push(`${where} link uses "${mismatch.expected}" but the file on disk is "${mismatch.actual}" (breaks on case-sensitive file systems): ${link.target}`);
        continue;
      }
      if (link.anchor && /\.md$/i.test(target) && (await isFile(target))) {
        let anchor = link.anchor;
        try {
          anchor = decodeURIComponent(anchor);
        } catch {
          // keep the raw anchor
        }
        if (!headingSlugs(await ctx.text(target)).has(anchor.toLowerCase())) {
          warnings.push(`${where} anchor #${link.anchor} not found in ${ctx.rel(target)}`);
        }
      }
      if (ctx.conformance && !isListedTarget(ctx.rel(target))) {
        warnings.push(`${where} links to ${ctx.rel(target)}, which is not in the build-spec section 3 file list`);
      }
    }
  }
  return makeCheck('links', `Relative Markdown links resolve (${count} links in ${ctx.mdFiles.length} files)`, failures, warnings);
}

function resolveRouteRef(root, kind, ref) {
  const base = { module: 'references', workflow: 'workflows', preset: 'presets' }[kind];
  const defaultExt = kind === 'preset' ? '.json' : '.md';
  const clean = ref.replace(/\\/g, '/');
  const hasExt = /\.(md|json)$/i.test(clean);
  if (clean.includes('/')) {
    const abs = path.resolve(root, clean);
    return hasExt ? [abs] : [abs, `${abs}${defaultExt}`];
  }
  return [path.join(root, base, hasExt ? clean : `${clean}${defaultExt}`)];
}

async function checkRoutes(ctx) {
  const title = 'routes.json modules, workflows and presets exist';
  const file = path.join(ctx.root, 'routing', 'routes.json');
  if (!(await isFile(file))) return { check: skipCheck('routes', title, 'routing/routes.json not present'), targets: [] };
  const data = ctx.json.get(keyOf(file));
  if (data === undefined || data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { check: makeCheck('routes', title, ['routing/routes.json is not a valid JSON object (see json-parse / schemas)']), targets: [] };
  }
  const failures = [];
  const refs = [];
  const push = (kind, ref, where) => {
    if (typeof ref === 'string' && ref.trim()) refs.push({ kind, ref: ref.trim(), where });
  };
  arr(data.always).forEach((m, i) => push('module', m, `always[${i}]`));
  const ids = new Map();
  arr(data.routes).forEach((r, i) => {
    const label = `routes[${i}]${r && typeof r.id === 'string' ? ` (${r.id})` : ''}`;
    if (r && typeof r.id === 'string') {
      if (ids.has(r.id)) failures.push(`${label}: duplicate route id "${r.id}" (also routes[${ids.get(r.id)}])`);
      else ids.set(r.id, i);
    }
    push('workflow', r?.workflow, `${label}.workflow`);
    arr(r?.modules).forEach((m, j) => push('module', m, `${label}.modules[${j}]`));
    arr(r?.presets).forEach((p, j) => push('preset', p, `${label}.presets[${j}]`));
  });
  arr(data.modifiers).forEach((m, i) => arr(m?.modules).forEach((x, j) => push('module', x, `modifiers[${i}].modules[${j}]`)));
  const fb = data.fallback;
  if (typeof fb === 'string') {
    if (!ids.has(fb)) failures.push(`fallback: route id "${fb}" is not defined in routes[]`);
  } else if (fb && typeof fb === 'object') {
    if (typeof fb.route === 'string' && !ids.has(fb.route)) failures.push(`fallback.route: route id "${fb.route}" is not defined in routes[]`);
    push('workflow', fb.workflow, 'fallback.workflow');
    arr(fb.modules).forEach((m, j) => push('module', m, `fallback.modules[${j}]`));
  }

  const patterns = [];
  arr(data.routes).forEach((r, i) => arr(r?.triggers).forEach((t, j) => patterns.push([t?.pattern, `routes[${i}].triggers[${j}]`])));
  for (const key of ['modifiers', 'approvalTriggers', 'warningPatterns']) {
    arr(data[key]).forEach((m, i) => arr(m?.patterns).forEach((p, j) => patterns.push([p, `${key}[${i}].patterns[${j}]`])));
  }
  for (const [p, where] of patterns) {
    if (typeof p !== 'string') continue;
    try {
      new RegExp(p, 'i'); // eslint-disable-line no-new
    } catch (e) {
      failures.push(`${where}: invalid regular expression ${JSON.stringify(p)} (${e.message})`);
    }
  }

  const targets = [];
  for (const { kind, ref, where } of refs) {
    const candidates = resolveRouteRef(ctx.root, kind, ref);
    if (!candidates.every((c) => isInside(ctx.root, c))) {
      failures.push(`${where}: ${kind} "${ref}" points outside the package`);
      continue;
    }
    let found = null;
    for (const c of candidates) {
      if (await isFile(c)) {
        found = c;
        break;
      }
    }
    if (found) targets.push(found);
    else failures.push(`${where}: ${kind} "${ref}" -> missing file ${ctx.rel(candidates[candidates.length - 1])}`);
  }
  return { check: makeCheck('routes', `${title} (${refs.length} references)`, failures), targets };
}

async function checkReachability(ctx, routeTargets) {
  const workflows = ctx.childrenOf('workflows', '.md');
  const candidates = [...ctx.childrenOf('references', '.md'), ...workflows];
  const reached = new Set(routeTargets.map(keyOf));
  const sources = [path.join(ctx.root, 'SKILL.md'), path.join(ctx.root, 'MASTER_INSTRUCTIONS.md'), ...workflows];
  for (const src of sources) {
    if (!(await isFile(src))) continue;
    for (const link of extractLinks(await ctx.text(src))) {
      if (link.path) reached.add(keyOf(path.resolve(path.dirname(src), link.path)));
    }
  }
  const unreached = candidates
    .filter((f) => !reached.has(keyOf(f)))
    .map((f) => `${ctx.rel(f)} is not linked from SKILL.md, MASTER_INSTRUCTIONS.md, routing/routes.json or any workflow`);
  return makeCheck('reachability', `Every references/*.md and workflows/*.md is reachable (${candidates.length - unreached.length}/${candidates.length})`, unreached);
}

/** Replace fenced code blocks and inline code spans with blanks, keeping line numbers. */
function proseLines(markdown) {
  const out = [];
  let fence = null;
  for (const line of String(markdown).split(/\r?\n/)) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim().replace(/[`~]/g, '') === '') fence = null;
      out.push('');
      continue;
    }
    if (m) {
      fence = m[1];
      out.push('');
      continue;
    }
    out.push(line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (s) => ' '.repeat(s.length)));
  }
  return out;
}

async function checkPlaceholders(ctx) {
  const failures = [];
  const shipped = ctx.mdFiles.filter((f) => {
    const rel = ctx.rel(f);
    return !rel.startsWith('tests/') && !rel.startsWith('evals/results/');
  });
  for (const file of shipped) {
    proseLines(await ctx.text(file)).forEach((line, i) => {
      for (const { label, re } of PLACEHOLDERS) if (re.test(line)) failures.push(`${ctx.rel(file)}:${i + 1} placeholder marker "${label}"`);
    });
  }
  return makeCheck('placeholders', `No TODO/TBD/lorem ipsum in shipped Markdown prose (${shipped.length} files; code spans and fenced blocks exempt)`, failures);
}

async function checkSecrets(ctx) {
  const failures = [];
  const warnings = [];
  let scanned = 0;
  for (const file of ctx.files) {
    const st = await statOrNull(file);
    if (!st || st.size === 0) continue;
    if (st.size > MAX_TEXT_BYTES) {
      warnings.push(`${ctx.rel(file)}: not scanned (larger than ${MAX_TEXT_BYTES} bytes)`);
      continue;
    }
    const buf = await readFile(file);
    if (buf.subarray(0, 8192).includes(0)) continue; // binary file
    scanned++;
    for (const hit of scanSecrets(buf.toString('utf8'))) {
      failures.push(`${ctx.rel(file)}:${hit.line} matches secret pattern "${hit.pattern}" (value not shown)`);
    }
  }
  return makeCheck('secrets', `No secret-like strings (${scanned} text files scanned)`, failures, warnings);
}

async function checkMasterMentions(ctx) {
  const title = 'MASTER_INSTRUCTIONS.md mentions every reference and workflow file';
  const master = path.join(ctx.root, 'MASTER_INSTRUCTIONS.md');
  if (!(await isFile(master))) return skipCheck('master-mentions', title, 'MASTER_INSTRUCTIONS.md not present');
  const text = await ctx.text(master);
  const linked = new Set(extractLinks(text).filter((l) => l.path).map((l) => keyOf(path.resolve(ctx.root, l.path))));
  const files = [...ctx.childrenOf('references', '.md'), ...ctx.childrenOf('workflows', '.md')];
  const baseCounts = new Map();
  for (const f of files) baseCounts.set(path.basename(f), (baseCounts.get(path.basename(f)) ?? 0) + 1);
  const missing = [];
  for (const f of files) {
    if (linked.has(keyOf(f))) continue;
    const rel = ctx.rel(f);
    const noExt = rel.replace(/\.md$/i, '');
    const qualified = new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRe(noExt)}(\\.md)?(?![A-Za-z0-9_-])`);
    const base = path.basename(f);
    const bare = new RegExp(`(^|[^A-Za-z0-9_./-])${escapeRe(base)}(?![A-Za-z0-9_-])`);
    if (qualified.test(text) || (baseCounts.get(base) === 1 && bare.test(text))) continue;
    missing.push(`${rel} is not mentioned`);
  }
  return makeCheck('master-mentions', `${title} (${files.length - missing.length}/${files.length})`, missing);
}

// ---------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} CheckResult
 * @property {string} id
 * @property {string} title
 * @property {'pass'|'fail'|'warn'|'skip'} status
 * @property {string[]} details  Failures first, then "warning: ..." lines (or the skip reason).
 * @property {object[]} [data]   Structured per-file results (schemas check).
 */

/**
 * Validate a skill package (Gate A).
 * @param {string} [root] Package root (defaults to the package containing this script).
 * @param {{requiredFiles?: string[], fixtureMode?: boolean, exclude?: string[]}} [options]
 *   requiredFiles replaces the section-3 list (entries ending in "/" are directories);
 *   fixtureMode uses FIXTURE_REQUIRED_FILES; exclude replaces SCAN_EXCLUDES.
 * @returns {Promise<{ok: boolean, root: string, mode: 'package'|'fixture'|'custom',
 *   checks: CheckResult[], summary: {pass: number, fail: number, warn: number, skip: number}}>}
 */
export async function validateSkill(root = PACKAGE_ROOT, options = {}) {
  const rootAbs = path.resolve(root);
  if (!(await isDir(rootAbs))) {
    const error = new Error(`Skill root not found or not a directory: ${rootAbs}`);
    error.code = 'ENOROOT';
    throw error;
  }
  let mode = 'package';
  let required = { files: [...REQUIRED_FILES], dirs: [...REQUIRED_DIRS], patterns: [...REQUIRED_PATTERNS] };
  if (Array.isArray(options.requiredFiles)) {
    mode = 'custom';
    required = parseRequiredList(options.requiredFiles);
  } else if (options.fixtureMode) {
    mode = 'fixture';
    required = { files: [...FIXTURE_REQUIRED_FILES], dirs: [], patterns: [] };
  }
  const ctx = await buildContext(rootAbs, { exclude: options.exclude, conformance: mode === 'package' });
  const checks = [];
  checks.push(await checkRequired(ctx, required));
  checks.push(await checkFrontmatter(ctx));
  checks.push(await checkEmptyFiles(ctx));
  checks.push(await checkJson(ctx));
  checks.push(await checkSchemas(ctx));
  checks.push(await checkLinks(ctx));
  const routes = await checkRoutes(ctx);
  checks.push(routes.check);
  checks.push(await checkReachability(ctx, routes.targets));
  checks.push(await checkPlaceholders(ctx));
  checks.push(await checkSecrets(ctx));
  checks.push(await checkMasterMentions(ctx));
  const summary = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const c of checks) summary[c.status]++;
  return { ok: summary.fail === 0, root: rootAbs, mode, checks, summary };
}

/**
 * Render a validation result as a plain-text checklist.
 * @param {Awaited<ReturnType<typeof validateSkill>>} result
 * @returns {string}
 */
export function formatChecklist(result) {
  const lines = [`validate-skill (Gate A): ${result.root}`, `mode: ${MODE_LABEL[result.mode]}`, ''];
  for (const c of result.checks) {
    lines.push(`[${c.status.toUpperCase()}] ${c.id.padEnd(16)} ${c.title}`);
    const shown = c.details.slice(0, MAX_DETAILS_TEXT);
    for (const d of shown) lines.push(`       - ${d}`);
    if (c.details.length > shown.length) lines.push(`       - ... ${c.details.length - shown.length} more (use --json for the full list)`);
  }
  const s = result.summary;
  lines.push('', `Result: ${result.ok ? 'PASS' : 'FAIL'} (${s.fail} failed, ${s.warn} with warnings, ${s.pass} passed, ${s.skip} skipped)`);
  return lines.join('\n');
}

const HELP = `Usage:
  node scripts/validate-skill.mjs [--root <dir>] [--json] [--required-files <a,b,...> | --fixture-mode]

Gate A (skill package integrity). Read-only checks:
  required-files   files from build spec section 3 (or --required-files / --fixture-mode)
  frontmatter      SKILL.md name (lowercase letters, digits, hyphens, max 64) and
                   description (non-empty, max 1024, no XML tags)
  empty-files      no empty or whitespace-only files
  json-parse       every .json file parses
  schemas          templates/asset-manifest.json, templates/quality-report.json (plus
                   honesty rules), references/capability-registry.json, presets/*.json and
                   routing/routes.json against schemas/
  links            relative Markdown links resolve (exact case; anchors and section-3
                   targets are warnings)
  routes           routes.json modules, workflows and presets exist; patterns compile
  reachability     every references/*.md and workflows/*.md is linked from SKILL.md,
                   MASTER_INSTRUCTIONS.md, routes.json or a workflow
  placeholders     no TODO, TBD or lorem ipsum in shipped Markdown prose (inline code and
                   fenced blocks are exempt, so wrap intentional mentions in backticks)
  secrets          no API-key, token or private-key patterns (values are never printed)
  master-mentions  MASTER_INSTRUCTIONS.md mentions every reference and workflow file
tests/fixtures, node_modules and .git are excluded from scans.

Options:
  --root <dir>              Package root (default: the package containing this script).
  --json                    Print the full result as JSON.
  --required-files <list>   Comma-separated required paths relative to the root (a trailing
                            "/" marks a directory); replaces the section-3 list.
  --fixture-mode            Require only ${FIXTURE_REQUIRED_FILES.join(', ')} (test packages).
  -h, --help                Show this help.

Exit codes:
  0   every check passed (warnings allowed)
  1   at least one check failed
  64  usage error (bad arguments, root not found)
`;

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
        root: { type: 'string' },
        json: { type: 'boolean', default: false },
        'required-files': { type: 'string' },
        'fixture-mode': { type: 'boolean', default: false },
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
    return EXIT.PASS;
  }
  if (args['required-files'] !== undefined && args['fixture-mode']) {
    process.stderr.write('Error: use either --required-files or --fixture-mode, not both.\n');
    return EXIT.USAGE;
  }
  const options = {};
  if (args['required-files'] !== undefined) {
    const list = args['required-files'].split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length) {
      process.stderr.write('Error: --required-files needs at least one path.\n');
      return EXIT.USAGE;
    }
    options.requiredFiles = list;
  }
  if (args['fixture-mode']) options.fixtureMode = true;
  let result;
  try {
    result = await validateSkill(args.root ? path.resolve(args.root) : PACKAGE_ROOT, options);
  } catch (e) {
    if (e.code === 'ENOROOT' || e instanceof TypeError) {
      process.stderr.write(`Error: ${e.message}\n`);
      return EXIT.USAGE;
    }
    throw e;
  }
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatChecklist(result)}\n`);
  return result.ok ? EXIT.PASS : EXIT.FAIL;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`);
      process.exitCode = EXIT.FAIL;
    },
  );
}
