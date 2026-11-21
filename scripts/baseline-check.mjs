#!/usr/bin/env node
// Production baseline check for sites and apps built with the arkononion-ui-ux skill
// (feeds Gate H and readiness-checklist rows 11 and 12 in references/production-readiness.md).
// Zero dependencies; Node >= 18 ESM; Windows and POSIX. Read-only: writes nothing, makes no network call.
//
//   --project <dir>   project root to scan (default: the current directory)
//   --tier <0-3>      risk tier; decides which checks apply (default 1)
//   --built <dir>     also scan a production build output for secrets, source maps and stray files
//   --strict          treat warnings as failures (exit 1)
//   --json            print a JSON report instead of text
//   --max-findings n  findings printed per check in text mode (default 8)
//
// This is a fast heuristic scan of source text. It is NOT a security audit: a pass does not mean the
// project is secure. It never prints secret values (file, line and pattern name only).

import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { walk, relPosix, isMainModule, scanSecrets } from './lib/fsutil.mjs';

/** Process exit codes. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, USAGE: 64 });

const SKIP_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.vercel', '.netlify',
  '.svelte-kit', '.nuxt', '.output', '.cache', '.parcel-cache', 'venv', '.venv', '__pycache__', 'vendor'];
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
const MAX_FILE_BYTES = 1_000_000;
const MAX_FILES = 6000;
const LIMITATIONS = [
  'Heuristic scan of source text: it does not run code, call the network, read git history, or verify that package names exist.',
  'A pass is not a security audit. Run the dependency audit, a secret scan of git history, authorisation tests and a header check on the deployed preview as well.',
  'Monorepos: only the root package.json and the files under the given directory are examined.',
];

// ---------------------------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------------------------

/**
 * Classify a project file by its role, or null when it should be ignored.
 * @param {string} rel Forward-slash path relative to the project root.
 * @returns {'env'|'envexample'|'code'|'sql'|'config'|'doc'|null}
 */
export function classify(rel) {
  const base = rel.split('/').pop() ?? rel;
  if (LOCKFILES.has(base) || /\.min\.(js|css)$/.test(base) || /\.map$/.test(base)) return null;
  if (/^\.env(\..+)?$/.test(base)) return /\.(example|sample|template|dist)$/.test(base) ? 'envexample' : 'env';
  if (/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|svelte|astro|html|htm)$/.test(base)) return 'code';
  if (/\.sql$/.test(base)) return 'sql';
  if (/\.(json|ya?ml|toml|rules|conf)$/.test(base) || /^Dockerfile(\..+)?$/.test(base) || base === '.dockerignore' || base === '.gitignore' || base === '_headers') return 'config';
  if (/\.(md|mdx|txt)$/.test(base)) return 'doc';
  return null;
}

const isTestPath = (rel) => /(^|\/)(__tests__|__mocks__|tests?|e2e|cypress|fixtures)\//.test(rel) || /\.(test|spec)\.[a-z]+$/.test(rel);

async function loadProject(root) {
  const all = await walk(root, { exclude: SKIP_DIRS });
  const files = [];
  const rootNames = [];
  let truncated = false;
  for (const abs of all) {
    const rel = relPosix(root, abs);
    if (!rel.includes('/')) rootNames.push(rel);
    const kind = classify(rel);
    if (!kind) continue;
    if (files.length >= MAX_FILES) { truncated = true; continue; }
    let info;
    try { info = await stat(abs); } catch { continue; }
    if (!info.isFile() || info.size > MAX_FILE_BYTES) continue;
    let text;
    try { text = await readFile(abs, 'utf8'); } catch { continue; }
    files.push({ rel, kind, text, test: isTestPath(rel) });
  }
  return { files, rootNames, truncated };
}

function gitTracked(root) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return null;
  return new Set(r.stdout.split('\0').filter(Boolean));
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const lines = (f) => f.text.split(/\r?\n/);
const F = (level, file, line, detail) => ({ level, file, line, detail });

// ---------------------------------------------------------------------------------------------
// Checks. Each returns findings: { level: 'fail' | 'warn', file, line, detail }.
// ---------------------------------------------------------------------------------------------

const PLACEHOLDER_PASSWORD = /(password|passwd|pass\b|changeme|your[-_ ]|example|xxxx|\*\*\*|<|\$\{|%s|secret)/i;
const EXTRA_SECRETS = [
  { id: 'stripe-secret-key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { id: 'stripe-webhook-secret', re: /\bwhsec_[A-Za-z0-9]{16,}\b/g },
  { id: 'sendgrid-key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g },
  { id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'database-url-with-password', re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?):\/\/[^\s:@/'"`]+:[^\s@/'"`]+@[^\s'"`]+/g, placeholderCheck: true },
];
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}\b/g;

/** Secret-like strings in text, with no values: [{ pattern, line }]. */
export function findSecrets(text) {
  const hits = scanSecrets(text).map((h) => ({ pattern: h.pattern, line: h.line }));
  for (const { id, re, placeholderCheck } of EXTRA_SECRETS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (placeholderCheck && PLACEHOLDER_PASSWORD.test(m[0].split('@')[0])) continue;
      hits.push({ pattern: id, line: lineOf(text, m.index) });
    }
  }
  JWT_RE.lastIndex = 0;
  for (const m of text.matchAll(JWT_RE)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload && payload.role === 'service_role') hits.push({ pattern: 'supabase-service-role-jwt', line: lineOf(text, m.index) });
    } catch { /* not a decodable JWT */ }
  }
  return hits.sort((a, b) => a.line - b.line);
}

function checkEnvFiles(ctx) {
  const out = [];
  const envFiles = ctx.files.filter((f) => f.kind === 'env');
  for (const f of envFiles) {
    if (!isIgnored(ctx, f.rel)) out.push(F('fail', f.rel, null, 'environment file is not covered by a .gitignore rule'));
    if (ctx.tracked && ctx.tracked.has(f.rel)) out.push(F('fail', f.rel, null, 'environment file is tracked by git: remove it from the index and have the user rotate any secret it held'));
  }
  if (ctx.tracked) {
    for (const rel of ctx.tracked) {
      const base = rel.split('/').pop();
      if (/^\.env(\..+)?$/.test(base) && !/\.(example|sample|template|dist)$/.test(base) && !envFiles.some((f) => f.rel === rel)) {
        out.push(F('fail', rel, null, 'environment file is tracked by git'));
      }
    }
  }
  const hasExample = ctx.files.some((f) => f.kind === 'envexample');
  const usesEnv = ctx.files.some((f) => f.kind === 'code' && !f.test && /\b(process\.env|import\.meta\.env|Deno\.env)\b/.test(f.text));
  if (usesEnv && !hasExample) out.push(F('warn', '.env.example', null, 'code reads environment variables but no .env.example of placeholders is committed'));
  return out;
}

const envRuleIn = (text) => text.split(/\r?\n/).map((l) => l.trim())
  .some((l) => l && !l.startsWith('#') && !l.startsWith('!') && /^(\/|\*\*\/)?(\.env(\*|\.\*|\.local)?|\*\.env)$/.test(l));

/** Is this project file ignored by git? Uses git when available, else the nearest .gitignore files. */
function isIgnored(ctx, rel) {
  const r = spawnSync('git', ['-C', ctx.root, 'check-ignore', '-q', '--', rel], { encoding: 'utf8' });
  if (!r.error && (r.status === 0 || r.status === 1)) return r.status === 0;
  const parts = rel.split('/');
  for (let n = parts.length - 1; n >= 0; n--) {
    const dir = parts.slice(0, n).join('/');
    const gi = ctx.files.find((f) => f.rel === (dir ? `${dir}/.gitignore` : '.gitignore'));
    if (gi && envRuleIn(gi.text)) return true;
  }
  return false;
}

function checkSecrets(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind === 'env') continue;
    const level = f.kind === 'doc' ? 'warn' : 'fail';
    for (const h of findSecrets(f.text)) out.push(F(level, f.rel, h.line, `secret-like string (${h.pattern}); value not shown`));
  }
  return out;
}

const PUBLIC_ENV_RE = /\b((?:NEXT_PUBLIC|VITE|REACT_APP|PUBLIC|EXPO_PUBLIC|NUXT_PUBLIC|GATSBY|VUE_APP|PLASMO_PUBLIC)_[A-Z0-9_]+)\b/g;
const PUBLIC_ENV_FAIL = /(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|PASSWD|DATABASE_URL|DB_URL|WEBHOOK|SIGNING|ENCRYPTION)/;
const PUBLIC_ENV_WARN = /(TOKEN|API_KEY|APIKEY|_KEY\b|AUTH_KEY)/;
const PUBLIC_ENV_SAFE = /(PUBLISHABLE|ANON|PUBLIC_KEY|SITE_KEY|MEASUREMENT|CLIENT_ID|DSN|MAPS|POSTHOG|ALGOLIA_SEARCH|SEARCH_ONLY|APP_ID|PROJECT_ID)/;

function checkPublicEnv(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind === 'doc' || f.test) continue;
    const seen = new Set();
    for (const m of f.text.matchAll(PUBLIC_ENV_RE)) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      const line = lineOf(f.text, m.index);
      if (PUBLIC_ENV_FAIL.test(name)) out.push(F('fail', f.rel, line, `${name} is public-prefixed but its name says secret: it will be inlined into the browser bundle`));
      else if (PUBLIC_ENV_WARN.test(name) && !PUBLIC_ENV_SAFE.test(name)) out.push(F('warn', f.rel, line, `${name} is public-prefixed: confirm it is a publishable key, not a private one`));
    }
  }
  return out;
}

function checkServiceRoleInClient(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind !== 'code' || f.test) continue;
    if (!/(SERVICE_ROLE|service_role)/.test(f.text)) continue;
    const clientish = /^\s*['"]use client['"]/m.test(f.text) || (/(^|\/)(components|hooks|public)\//.test(f.rel) && !/(^|\/)api\//.test(f.rel)) || /\.(vue|svelte|astro|html?)$/.test(f.rel);
    if (clientish) out.push(F('fail', f.rel, lineOf(f.text, f.text.search(/(SERVICE_ROLE|service_role)/)), 'service-role key referenced in code that can reach the browser: it bypasses row-level security'));
  }
  return out;
}

const SINKS = [
  [/dangerouslySetInnerHTML/, 'dangerouslySetInnerHTML'],
  [/\.innerHTML\s*=(?!=)/, 'innerHTML assignment'],
  [/insertAdjacentHTML\s*\(/, 'insertAdjacentHTML'],
  [/document\.write\s*\(/, 'document.write'],
  [/(^|[^.\w])eval\s*\(/, 'eval'],
  [/new\s+Function\s*\(/, 'new Function'],
  [/\bsrcdoc\s*=/, 'srcdoc'],
];

function checkSinks(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind !== 'code' || f.test) continue;
    lines(f).forEach((text, i) => {
      for (const [re, label] of SINKS) if (re.test(text)) out.push(F('warn', f.rel, i + 1, `${label}: render as text or sanitise with an allow-list at this call site`));
    });
  }
  return out;
}

function checkInjection(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind !== 'code' || f.test) continue;
    lines(f).forEach((text, i) => {
      if (/\b(exec|execSync)\s*\(\s*(`[^`]*\$\{|[^)]*['"]\s*\+)/.test(text) || /\bspawn(Sync)?\s*\(\s*(?!['"][^'"$]*['"]\s*,)[^)]*shell\s*:\s*true/.test(text)) {
        out.push(F('warn', f.rel, i + 1, 'shell command built from variables: use execFile with an argument array'));
      }
      if (/\b(\$queryRawUnsafe|\$executeRawUnsafe)\b/.test(text) || (/\b(query|execute|raw)\s*\(/.test(text) && /(`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{|['"][^'"]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^'"]*['"]\s*\+)/i.test(text))) {
        out.push(F('warn', f.rel, i + 1, 'SQL built by string interpolation: use parameters or ORM binding'));
      }
    });
  }
  return out;
}

function checkCors(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.test || (f.kind !== 'code' && f.kind !== 'config')) continue;
    const credentials = /(credentials\s*:\s*true|Access-Control-Allow-Credentials)/i.test(f.text);
    lines(f).forEach((text, i) => {
      const wildcard = /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]?\*/i.test(text) || /origin\s*:\s*(?:['"]\*['"]|true\b)/.test(text) || /\bcors\(\s*\)/.test(text);
      if (wildcard) out.push(F(credentials ? 'fail' : 'warn', f.rel, i + 1, credentials ? 'wildcard or reflected CORS origin in a file that also allows credentials' : 'wildcard CORS origin: acceptable only for public data without credentials'));
    });
  }
  return out;
}

const HEADER_RULES = [
  ['Content-Security-Policy', /content-security-policy/i],
  ['Strict-Transport-Security', /strict-transport-security|\bhsts\b/i],
  ['X-Content-Type-Options', /x-content-type-options|nosniff/i],
  ['Referrer-Policy', /referrer-policy/i],
  ['frame-ancestors or X-Frame-Options', /frame-ancestors|x-frame-options/i],
  ['Permissions-Policy', /permissions-policy/i],
];

function checkHeaders(ctx) {
  const corpus = ctx.files.filter((f) => (f.kind === 'code' || f.kind === 'config') && !f.test).map((f) => f.text).join('\n');
  if (/\bhelmet\s*\(|from\s+['"]helmet['"]|require\(['"]helmet['"]\)/.test(corpus)) return [];
  const missing = HEADER_RULES.filter(([, re]) => !re.test(corpus)).map(([name]) => name);
  if (!missing.length) return [];
  const all = missing.length === HEADER_RULES.length;
  return [F('warn', null, null, `${all ? 'no security headers configured in the repository' : 'headers not found in the repository'}: ${missing.join(', ')}. The host may set them; confirm with curl -sI on the deployed preview`)];
}

function checkPackage(ctx) {
  const out = [];
  const pkgFile = ctx.files.find((f) => f.rel === 'package.json');
  if (!pkgFile) return out;
  let pkg;
  try { pkg = JSON.parse(pkgFile.text); } catch { return [F('warn', 'package.json', null, 'package.json does not parse')]; }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
  const hasLock = ctx.rootNames.some((n) => LOCKFILES.has(n));
  if (Object.keys(deps).length && !hasLock) out.push(F('fail', 'package.json', null, 'dependencies declared but no lockfile is committed: installs are not reproducible'));
  for (const [name, spec] of Object.entries(deps)) {
    if (/^(latest|\*|x)$/i.test(String(spec)) || /^(git\+|https?:|github:)/i.test(String(spec))) out.push(F('warn', 'package.json', null, `dependency ${name} uses an unpinned or non-registry spec (${String(spec).slice(0, 40)})`));
  }
  for (const key of ['preinstall', 'install', 'postinstall', 'prepare']) {
    const script = pkg.scripts?.[key];
    if (script && /(curl|wget|Invoke-WebRequest|iwr|iex)\b[^|]*\|\s*(sh|bash|iex|powershell)/i.test(script)) out.push(F('fail', 'package.json', null, `${key} script downloads and runs remote code`));
  }
  return out;
}

function checkSourceMaps(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.test || (f.kind !== 'code' && f.kind !== 'config')) continue;
    lines(f).forEach((text, i) => {
      if (/productionBrowserSourceMaps\s*:\s*true/.test(text) || /\bGENERATE_SOURCEMAP\s*=\s*true/.test(text) || (/\bsourcemap\s*:\s*(true|['"]inline['"])/.test(text) && /(vite|rollup|esbuild|tsup|build)/i.test(f.rel + f.text.slice(0, 2000))) || /devtool\s*:\s*['"](?!eval)[a-z-]*source-map['"]/.test(text)) {
        out.push(F('warn', f.rel, i + 1, 'production source maps appear to be enabled: generate hidden maps for the error tracker only and keep them out of the deployed output'));
      }
    });
  }
  return out;
}

const REDIRECT_PARAM = /(searchParams\.get\(\s*['"](next|redirect|redirect_uri|returnTo|return_to|returnUrl|callback|url|continue)['"]|req(uest)?\.query\.(next|redirect|returnTo|url|continue)\b)/;
const REDIRECT_SINK = /(\bredirect\s*\(|res\.redirect\s*\(|location\.(href|assign|replace)\b|window\.location\s*=)/;

function checkRedirects(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind !== 'code' || f.test) continue;
    if (REDIRECT_PARAM.test(f.text) && REDIRECT_SINK.test(f.text)) {
      const idx = f.text.search(REDIRECT_PARAM);
      out.push(F('warn', f.rel, lineOf(f.text, idx), 'redirect target read from the request: validate it against an allow-list of paths or hosts'));
    }
  }
  return out;
}

function checkDebugLeftovers(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.test) continue;
    if (/(^|\/)(app\/api|pages\/api|api)\/(debug|test|env|dump|admin-test)(\/|\.|$)/.test(f.rel)) out.push(F('warn', f.rel, null, 'debug-style endpoint: remove it or guard it and exclude it from production'));
    if (f.kind !== 'code') continue;
    lines(f).forEach((text, i) => {
      if (/console\.(log|info|debug)\(.*\b(token|password|secret|authorization|api[_-]?key|cookie)\b/i.test(text)) out.push(F('warn', f.rel, i + 1, 'logging a value whose name suggests a credential'));
      if (/^\s*debugger\s*;?\s*$/.test(text)) out.push(F('warn', f.rel, i + 1, 'debugger statement'));
      if (/\b(password123|admin123|admin@admin|test@test\.com|changeme)\b/i.test(text)) out.push(F('warn', f.rel, i + 1, 'default or demo credential in code'));
    });
  }
  return out;
}

function checkTargetBlank(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.kind !== 'code' || f.test) continue;
    const all = lines(f);
    all.forEach((text, i) => {
      if (/target\s*=\s*["'{`]*_blank/.test(text) && !/rel\s*=/.test(text) && !/rel\s*=/.test(all[i + 1] ?? '') && !/rel\s*=/.test(all[i - 1] ?? '')) {
        out.push(F('warn', f.rel, i + 1, 'target="_blank" without rel="noopener noreferrer"'));
      }
    });
  }
  return out;
}

function checkRowLevelSecurity(ctx) {
  const out = [];
  const pkgText = ctx.files.find((f) => f.rel === 'package.json')?.text ?? '';
  const usesSupabase = /@supabase\/(supabase-js|ssr)/.test(pkgText) || ctx.files.some((f) => f.rel.startsWith('supabase/'));
  const created = new Map();
  const secured = new Set();
  for (const f of ctx.files.filter((x) => x.kind === 'sql')) {
    for (const m of f.text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:("?[a-z0-9_]+"?)\.)?"?([a-z0-9_]+)"?/gi)) {
      const schema = m[1]?.replace(/"/g, '').toLowerCase();
      if (schema && schema !== 'public') continue;
      if (!created.has(m[2].toLowerCase())) created.set(m[2].toLowerCase(), { file: f.rel, line: lineOf(f.text, m.index) });
    }
    for (const m of f.text.matchAll(/alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?\s+enable\s+row\s+level\s+security/gi)) secured.add(m[1].toLowerCase());
    for (const m of f.text.matchAll(/create\s+policy[\s\S]{0,400}?(?:using|with\s+check)\s*\(\s*true\s*\)/gi)) {
      out.push(F('warn', f.rel, lineOf(f.text, m.index), 'policy allows every row (using or with check true): scope it to the owner or tenant'));
    }
  }
  for (const [table, where] of created) {
    if (secured.has(table)) continue;
    const level = usesSupabase ? (ctx.tier >= 2 ? 'fail' : 'warn') : 'warn';
    out.push(F(level, where.file, where.line, `table ${table} has no ENABLE ROW LEVEL SECURITY in the migrations${usesSupabase ? ' (browser-reachable with the public key unless secured)' : ': confirm ownership checks in code'}`));
  }
  for (const f of ctx.files) {
    if (!/(firestore\.rules|storage\.rules|database\.rules\.json)$/.test(f.rel)) continue;
    lines(f).forEach((text, i) => {
      if (/allow\s+[a-z ,]*(read|write)[a-z ,]*:\s*if\s+true/i.test(text) || /if\s+request\.time\s*<\s*timestamp\.date/i.test(text) || /"\.(read|write)"\s*:\s*true/.test(text)) {
        out.push(F('fail', f.rel, i + 1, 'security rules are open to everyone (or in time-limited test mode)'));
      }
    });
  }
  return out;
}

const API_PATH = /(^|\/)(app\/.*\/route\.[jt]sx?|pages\/api\/.+|api\/.+\.[jt]sx?|netlify\/functions\/.+|functions\/.+\.[jt]sx?|server\/api\/.+|src\/routes\/.*\+server\.[jt]s)$/;
const AUTH_WORDS = /\b(auth|getServerSession|getSession|getUser|currentUser|requireUser|requireAuth|verifyToken|verifyJwt|jwtVerify|clerk|getToken|session|bearer)\b/i;
const SIGNATURE_WORDS = /\b(constructEvent|signature|hmac|svix|timingSafeEqual|x-hub-signature)\b/i;

function checkApiSurface(ctx) {
  const out = [];
  const pkgText = ctx.files.find((f) => f.rel === 'package.json')?.text ?? '';
  const code = ctx.files.filter((f) => f.kind === 'code' && !f.test);
  const apiFiles = code.filter((f) => API_PATH.test(f.rel) || /^\s*['"]use server['"]/m.test(f.text));
  if (!apiFiles.length) return out;
  const corpus = `${pkgText}\n${code.map((f) => f.text).join('\n')}`;
  if (!/(ratelimit|rate-limit|rate_limit|rate-limiter|ratelimiter|express-rate-limit|limiter)/i.test(corpus)) out.push(F('warn', null, null, `${apiFiles.length} endpoint file(s) found but no rate-limiting code or package: add limits to forms, authentication, message sending and paid calls`));
  if (!/\b(zod|valibot|yup|joi|ajv|superstruct|@sinclair\/typebox|class-validator|arktype)\b/.test(corpus)) out.push(F('warn', null, null, 'endpoint files found but no schema-validation library: validate every input with a strict schema'));
  for (const f of apiFiles) {
    const mutating = /export\s+(?:async\s+)?(?:function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(f.text) || /req\.method\s*[!=]==?\s*['"](POST|PUT|PATCH|DELETE)/.test(f.text) || /\bapp\.(post|put|patch|delete)\s*\(/.test(f.text) || /['"]use server['"]/.test(f.text) || (/pages\/api\//.test(f.rel) && /req\.body/.test(f.text));
    if (mutating && !AUTH_WORDS.test(f.text) && !SIGNATURE_WORDS.test(f.text)) {
      out.push(F('warn', f.rel, null, 'state-changing handler with no authentication or signature check visible: add one, or record it as a public form with spam control and a rate limit'));
    }
  }
  return out;
}

function checkOperations(ctx) {
  const out = [];
  const code = ctx.files.filter((f) => f.kind === 'code' && !f.test);
  const server = code.filter((f) => /\b(app\.listen|createServer|fastify\s*\(|Fastify\s*\(|Bun\.serve|Deno\.serve)\b/.test(f.text));
  const apiFiles = code.filter((f) => API_PATH.test(f.rel));
  const hasHealth = ctx.files.some((f) => /(health|healthz|readiness|liveness)/i.test(f.rel)) || code.some((f) => /['"`]\/(health|healthz|ready|live|api\/health)['"`]/.test(f.text));
  if ((server.length || apiFiles.length) && !hasHealth) out.push(F('warn', null, null, 'no health endpoint found: add liveness and readiness routes for balancers and uptime checks'));
  if (server.length && !code.some((g) => /SIGTERM/.test(g.text))) out.push(F('warn', server[0].rel, null, 'long-running server without a SIGTERM handler: add graceful shutdown'));
  return out;
}

function checkCi(ctx) {
  const out = [];
  const ci = ctx.files.filter((f) => /^(\.github\/workflows\/.+\.ya?ml|\.gitlab-ci\.yml|azure-pipelines\.yml|\.circleci\/config\.yml|bitbucket-pipelines\.yml)$/.test(f.rel));
  const pkg = ctx.files.find((f) => f.rel === 'package.json');
  if (!ci.length) out.push(F('warn', null, null, 'no CI configuration found: run type check, lint, tests, audit and secret scan before every deploy'));
  for (const f of ci) {
    if (/^\.github\/workflows\//.test(f.rel)) {
      if (!/^permissions:/m.test(f.text)) out.push(F('warn', f.rel, null, 'no top-level permissions block: the default token may be broader than needed'));
      if (/pull_request_target/.test(f.text)) out.push(F('warn', f.rel, null, 'pull_request_target: never run untrusted pull-request code with it'));
      const unpinned = [...f.text.matchAll(/uses:\s*(?!\.\/)([^\s@]+)@(?![0-9a-f]{40}\b)([^\s#]+)/g)].length;
      if (unpinned) out.push(F('warn', f.rel, null, `${unpinned} action reference(s) not pinned to a commit SHA`));
    }
    lines(f).forEach((text, i) => { if (/continue-on-error:\s*true/.test(text)) out.push(F('warn', f.rel, i + 1, 'continue-on-error: a failing step will not block the pipeline')); });
  }
  if (pkg) {
    try {
      const t = JSON.parse(pkg.text).scripts?.test;
      if (!t || /no test specified/i.test(t)) out.push(F('warn', 'package.json', null, 'no real test script'));
    } catch { /* reported by checkPackage */ }
  }
  return out;
}

function checkDocker(ctx) {
  const out = [];
  const dockerfiles = ctx.files.filter((f) => /(^|\/)Dockerfile(\..+)?$/.test(f.rel));
  for (const f of dockerfiles) {
    const aliases = new Set();
    lines(f).forEach((text, i) => {
      const m = text.match(/^\s*FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i);
      if (m) {
        const ref = m[1];
        if (m[2]) aliases.add(m[2].toLowerCase());
        if (ref.toLowerCase() !== 'scratch' && !aliases.has(ref.toLowerCase()) && !ref.includes('@') && (!ref.includes(':') || ref.endsWith(':latest'))) out.push(F('warn', f.rel, i + 1, `base image ${ref} is untagged or latest: pin a version or digest`));
      }
      if (/^\s*ADD\s+https?:\/\//i.test(text)) out.push(F('warn', f.rel, i + 1, 'ADD from a URL: download in a verified step instead'));
      if (/^\s*(ARG|ENV)\s+\w*(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY)\w*/i.test(text)) out.push(F('warn', f.rel, i + 1, 'secret-like ARG or ENV: build arguments and layers are readable, inject secrets at run time'));
    });
    if (!/^\s*USER\s+(?!root\b)\S+/im.test(f.text)) out.push(F('warn', f.rel, null, 'no non-root USER instruction: the container runs as root'));
    const dir = f.rel.includes('/') ? f.rel.slice(0, f.rel.lastIndexOf('/') + 1) : '';
    const ignore = ctx.files.find((g) => g.rel === `${dir}.dockerignore`);
    if (!ignore || !/(^|\n)\s*\.env/.test(ignore.text)) out.push(F('warn', f.rel, null, '.dockerignore is missing or does not exclude .env files'));
  }
  return out;
}

const TRACKER_RE = /(googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bfbq\s*\(|connect\.facebook\.net|static\.hotjar\.com|clarity\.ms|cdn\.segment\.com|mixpanel|posthog|plausible\.io|analytics\.tiktok\.com|snap\.licdn\.com|fullstory|hotjar)/i;
const CONSENT_RE = /(consent|cookie-?banner|cookieconsent|onetrust|cookiebot|klaro|termly|osano|iubenda)/i;

function checkPrivacy(ctx) {
  const out = [];
  const code = ctx.files.filter((f) => (f.kind === 'code' || f.kind === 'config') && !f.test);
  const hasPolicy = ctx.files.some((f) => /privacy/i.test(f.rel)) || code.some((f) => /href\s*=\s*["'{`]*\/?[\w/-]*privacy/i.test(f.text));
  if (!hasPolicy) out.push(F('warn', null, null, 'no privacy page or link found: a notice matching the real data practices is needed once any personal data or tracker is involved'));
  const trackers = code.filter((f) => TRACKER_RE.test(f.text));
  if (trackers.length && !code.some((f) => CONSENT_RE.test(f.text))) {
    out.push(F('warn', trackers[0].rel, null, `tracking code found in ${trackers.length} file(s) but no consent mechanism: load non-essential trackers only after consent where required`));
  }
  return out;
}

const CHECKS = [
  { id: 'env-files', title: 'Environment files are git-ignored; a placeholder example exists', minTier: 0, run: checkEnvFiles },
  { id: 'secrets', title: 'No secret-like strings in source, config or docs', minTier: 0, run: checkSecrets },
  { id: 'public-env', title: 'No secret-named variables with a browser-public prefix', minTier: 0, run: checkPublicEnv },
  { id: 'service-role', title: 'Service-role keys are not referenced from browser-reachable code', minTier: 0, run: checkServiceRoleInClient },
  { id: 'dependencies', title: 'Lockfile committed; dependency specs and install scripts are sane', minTier: 0, run: checkPackage },
  { id: 'headers', title: 'Security headers are configured in the repository', minTier: 0, run: checkHeaders },
  { id: 'sinks', title: 'Dangerous HTML and code sinks are reviewed', minTier: 0, run: checkSinks },
  { id: 'source-maps', title: 'Production source maps are not enabled', minTier: 0, run: checkSourceMaps },
  { id: 'target-blank', title: 'External links use rel="noopener noreferrer"', minTier: 0, run: checkTargetBlank },
  { id: 'debug', title: 'No debug endpoints, credential logging or demo credentials', minTier: 0, run: checkDebugLeftovers },
  { id: 'privacy', title: 'Privacy page exists and trackers sit behind consent', minTier: 1, run: checkPrivacy },
  { id: 'cors', title: 'CORS is not wildcard or reflected with credentials', minTier: 1, run: checkCors },
  { id: 'injection', title: 'No string-built SQL or shell commands', minTier: 1, run: checkInjection },
  { id: 'redirects', title: 'Redirect targets from the request are validated', minTier: 1, run: checkRedirects },
  { id: 'api-surface', title: 'Endpoints have rate limits, schema validation and authentication', minTier: 1, run: checkApiSurface },
  { id: 'row-level-security', title: 'Tables and rules are not open to everyone', minTier: 1, run: checkRowLevelSecurity },
  { id: 'operations', title: 'Health endpoint and graceful shutdown exist', minTier: 2, run: checkOperations },
  { id: 'ci', title: 'CI exists and is hardened', minTier: 2, run: checkCi },
  { id: 'docker', title: 'Containers are pinned, non-root and exclude secrets', minTier: 2, run: checkDocker },
];

// ---------------------------------------------------------------------------------------------
// Built output
// ---------------------------------------------------------------------------------------------

async function scanBuilt(builtDir, tier) {
  const out = [];
  const root = path.resolve(builtDir);
  const info = await stat(root).catch(() => null);
  if (!info || !info.isDirectory()) return { error: `--built is not a directory: ${builtDir}` };
  if (await stat(path.join(root, '.git')).then(() => true, () => false)) out.push(F('fail', '.git', null, 'a .git directory is inside the deployed output'));
  const all = await walk(root, { exclude: ['node_modules'] });
  let scanned = 0;
  for (const abs of all.slice(0, 20000)) {
    const rel = relPosix(root, abs);
    const base = rel.split('/').pop() ?? rel;
    if (/^\.env(\..+)?$/.test(base) && !/\.(example|sample|template|dist)$/.test(base)) out.push(F('fail', rel, null, 'environment file inside the deployed output'));
    if (/\.map$/.test(base)) out.push(F(tier >= 1 ? 'fail' : 'warn', rel, null, 'source map inside the deployed output'));
    if (!/\.(js|mjs|cjs|css|html?|json|txt|xml)$/.test(base)) continue;
    const s = await stat(abs).catch(() => null);
    if (!s || s.size > 5_000_000) continue;
    const text = await readFile(abs, 'utf8').catch(() => null);
    if (text == null) continue;
    scanned++;
    for (const h of findSecrets(text)) out.push(F('fail', rel, h.line, `secret-like string (${h.pattern}) in the built output; value not shown`));
    if (/service_role/.test(text)) out.push(F('warn', rel, null, 'the string service_role appears in the built output: confirm no service-role key is shipped'));
  }
  return { findings: out, scanned };
}

// ---------------------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------------------

/**
 * Run the baseline check.
 * @param {{root: string, tier?: number, built?: string}} options
 */
export async function baselineCheck({ root, tier = 1, built } = {}) {
  const abs = path.resolve(root ?? process.cwd());
  const info = await stat(abs).catch(() => null);
  if (!info || !info.isDirectory()) throw new Error(`project directory not found: ${root}`);
  const { files, rootNames, truncated } = await loadProject(abs);
  const ctx = { files, tier, root: abs, rootNames, tracked: gitTracked(abs) };

  const checks = [];
  for (const c of CHECKS) {
    if (tier < c.minTier) { checks.push({ id: c.id, title: c.title, status: 'skipped', note: `applies from tier ${c.minTier}`, findings: [] }); continue; }
    const findings = c.run(ctx);
    const status = findings.some((f) => f.level === 'fail') ? 'fail' : findings.length ? 'warn' : 'pass';
    checks.push({ id: c.id, title: c.title, status, findings });
  }
  let builtScan = null;
  if (built) {
    const r = await scanBuilt(built, tier);
    if (r.error) throw new Error(r.error);
    const status = r.findings.some((f) => f.level === 'fail') ? 'fail' : r.findings.length ? 'warn' : 'pass';
    checks.push({ id: 'built-output', title: `Built output has no secrets, source maps or stray files (${r.scanned} files scanned)`, status, findings: r.findings });
    builtScan = { scanned: r.scanned };
  }
  const count = (s) => checks.filter((c) => c.status === s).length;
  return {
    tool: 'baseline-check',
    root: abs,
    tier,
    filesScanned: files.length,
    truncated,
    gitTrackedCheck: ctx.tracked !== null,
    builtScan,
    summary: { fail: count('fail'), warn: count('warn'), pass: count('pass'), skipped: count('skipped') },
    checks,
    limitations: LIMITATIONS,
  };
}

function formatText(report, maxFindings) {
  const out = [`baseline-check (heuristic static scan): ${report.root}`, `tier: T${report.tier} | files scanned: ${report.filesScanned}${report.truncated ? ' (truncated)' : ''} | git tracked-files check: ${report.gitTrackedCheck ? 'yes' : 'no (not a git repository or git missing)'}`, ''];
  const tag = { fail: '[FAIL]', warn: '[WARN]', pass: '[PASS]', skipped: '[SKIP]' };
  for (const c of report.checks) {
    out.push(`${tag[c.status]} ${c.id.padEnd(18)} ${c.title}${c.note ? ` (${c.note})` : ''}`);
    for (const f of c.findings.slice(0, maxFindings)) {
      const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : '';
      out.push(`       - ${f.level === 'fail' ? 'FAIL ' : ''}${where}${f.detail}`);
    }
    if (c.findings.length > maxFindings) out.push(`       - ... ${c.findings.length - maxFindings} more (use --json for the full list)`);
  }
  const s = report.summary;
  out.push('', `Result: ${s.fail ? 'FAIL' : s.warn ? 'WARN' : 'PASS'} (${s.fail} failed, ${s.warn} with warnings, ${s.pass} passed, ${s.skipped} skipped)`, '');
  for (const l of report.limitations) out.push(`Limit: ${l}`);
  return out.join('\n');
}

const HELP = `Usage: node scripts/baseline-check.mjs [--project <dir>] [--tier <0-3>] [--built <dir>] [--strict] [--json] [--max-findings <n>]

Heuristic, read-only scan for common production-readiness defects (secrets, public env names, service-role keys,
dangerous sinks, CORS, headers, lockfile, source maps, row-level security, missing rate limits and validation,
health endpoints, CI and Docker hygiene). Exit codes: 0 no failures, 1 failures (or warnings with --strict), 64 usage.
A pass is not a security audit.`;

async function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        project: { type: 'string' }, tier: { type: 'string' }, built: { type: 'string' }, strict: { type: 'boolean' },
        json: { type: 'boolean' }, 'max-findings': { type: 'string' }, help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    }));
  } catch (e) {
    process.stderr.write(`${e.message}\n${HELP}\n`);
    return EXIT.USAGE;
  }
  if (values.help) { process.stdout.write(`${HELP}\n`); return EXIT.PASS; }
  const tier = values.tier === undefined ? 1 : Number(values.tier);
  if (!Number.isInteger(tier) || tier < 0 || tier > 3) { process.stderr.write(`--tier must be 0, 1, 2 or 3\n${HELP}\n`); return EXIT.USAGE; }
  const max = values['max-findings'] === undefined ? 8 : Number(values['max-findings']);
  if (!Number.isInteger(max) || max < 1) { process.stderr.write(`--max-findings must be a positive integer\n${HELP}\n`); return EXIT.USAGE; }
  let report;
  try {
    report = await baselineCheck({ root: values.project ?? process.cwd(), tier, built: values.built });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return EXIT.USAGE;
  }
  process.stdout.write(values.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatText(report, max)}\n`);
  return report.summary.fail || (values.strict && report.summary.warn) ? EXIT.FAIL : EXIT.PASS;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
