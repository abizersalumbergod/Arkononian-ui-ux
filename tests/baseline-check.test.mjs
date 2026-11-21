// Tests for scripts/baseline-check.mjs. Fixture projects are built in the OS temp directory at run time;
// fake secrets are assembled from pieces so this file itself never contains a secret-like string.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineCheck, classify, findSecrets, EXIT } from '../scripts/baseline-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'baseline-check.mjs');
const made = [];
after(async () => { for (const d of made) await rm(d, { recursive: true, force: true }); });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FAKE_STRIPE = ['sk_', 'live_', 'a1B2c3D4e5F6g7H8i9J0'].join('');
const FAKE_AWS = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const FAKE_SERVICE_JWT = [b64u({ alg: 'HS256', typ: 'JWT' }), b64u({ role: 'service_role', iss: 'supabase' }), 'abcdefghijklmnop'].join('.');
const FAKE_DB_URL = ['postgres://app:', 'hunter2xyz', '@db.internal.test:5432/app'].join('');

async function project(files) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'baseline-'));
  made.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}
const status = (report, id) => report.checks.find((c) => c.id === id)?.status;

const CLEAN = {
  'package.json': JSON.stringify({ name: 'clean', scripts: { test: 'node --test' }, dependencies: { zod: '^3.0.0' } }),
  'package-lock.json': '{}',
  '.gitignore': 'node_modules\n.env\n.env.*\n!.env.example\n',
  '.env.example': 'API_URL=https://api.example.test\n',
  'index.html': '<!doctype html><title>Clean</title><a href="/privacy">Privacy</a><a href="https://example.test" target="_blank" rel="noopener noreferrer">x</a>',
  'privacy/index.html': '<h1>Privacy</h1>',
  'next.config.js': "module.exports = { async headers() { return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: \"default-src 'self'; frame-ancestors 'none'\" }, { key: 'Strict-Transport-Security', value: 'max-age=31536000' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Permissions-Policy', value: 'camera=()' }] }]; } };",
};

test('classify sorts files by role and ignores lockfiles, maps and minified files', () => {
  assert.equal(classify('.env'), 'env');
  assert.equal(classify('.env.local'), 'env');
  assert.equal(classify('.env.example'), 'envexample');
  assert.equal(classify('src/app/page.tsx'), 'code');
  assert.equal(classify('db/migrations/001.sql'), 'sql');
  assert.equal(classify('Dockerfile'), 'config');
  assert.equal(classify('README.md'), 'doc');
  assert.equal(classify('package-lock.json'), null);
  assert.equal(classify('dist/app.js.map'), null);
  assert.equal(classify('vendor.min.js'), null);
});

test('findSecrets reports patterns and lines but never values; placeholders are ignored', () => {
  const text = [`const a = "${FAKE_STRIPE}";`, `const b = "${FAKE_AWS}";`, `const c = "${FAKE_DB_URL}";`, 'const ok = "postgres://user:password@localhost:5432/db";', `const jwt = "${FAKE_SERVICE_JWT}";`].join('\n');
  const hits = findSecrets(text);
  const patterns = hits.map((h) => h.pattern);
  assert.ok(patterns.includes('stripe-secret-key'), patterns.join(','));
  assert.ok(patterns.includes('aws-access-key-id'));
  assert.ok(patterns.includes('database-url-with-password'));
  assert.ok(patterns.includes('supabase-service-role-jwt'));
  assert.equal(hits.filter((h) => h.pattern === 'database-url-with-password').length, 1, 'the placeholder URL must not be reported');
  assert.ok(!JSON.stringify(hits).includes(FAKE_STRIPE));
});

test('a tidy tier-0 site has no failures', async () => {
  const dir = await project(CLEAN);
  const report = await baselineCheck({ root: dir, tier: 0 });
  assert.equal(report.summary.fail, 0, JSON.stringify(report.checks.filter((c) => c.status === 'fail')));
  assert.equal(status(report, 'headers'), 'pass');
  assert.equal(status(report, 'ci'), 'skipped');
});

test('a leaky project fails the expected checks and never leaks the secret values', async () => {
  const dir = await project({
    'package.json': JSON.stringify({ name: 'leaky', dependencies: { next: 'latest' } }),
    '.env': `STRIPE_KEY=${FAKE_STRIPE}\n`,
    'src/app/page.tsx': [
      "'use client';",
      'export default function Page({ html }) {',
      `  const key = process.env.NEXT_PUBLIC_SECRET_TOKEN; const sr = process.env.SUPABASE_SERVICE_ROLE_KEY; const aws = "${FAKE_AWS}";`,
      '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
      '}',
    ].join('\n'),
    'src/server.js': "app.use(cors({ origin: '*', credentials: true }));",
  });
  const report = await baselineCheck({ root: dir, tier: 1 });
  for (const id of ['env-files', 'secrets', 'public-env', 'service-role', 'dependencies', 'cors']) assert.equal(status(report, id), 'fail', `${id}: ${JSON.stringify(report.checks.find((c) => c.id === id))}`);
  assert.equal(status(report, 'sinks'), 'warn');
  const printed = JSON.stringify(report);
  assert.ok(!printed.includes(FAKE_STRIPE) && !printed.includes(FAKE_AWS), 'secret values must not appear in the report');
});

test('tiers gate the operational checks', async () => {
  const dir = await project(CLEAN);
  assert.equal(status(await baselineCheck({ root: dir, tier: 1 }), 'ci'), 'skipped');
  assert.notEqual(status(await baselineCheck({ root: dir, tier: 2 }), 'ci'), 'skipped');
  assert.equal(status(await baselineCheck({ root: dir, tier: 0 }), 'api-surface'), 'skipped');
});

test('row-level security: unsecured Supabase tables fail at tier 2 and warn at tier 1; secured ones pass', async () => {
  const unsecured = await project({
    'package.json': JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2.0.0' } }),
    'package-lock.json': '{}',
    'supabase/migrations/001.sql': 'create table public.orders (id uuid primary key, owner_id uuid);\ncreate table notes (id int);',
  });
  assert.equal(status(await baselineCheck({ root: unsecured, tier: 2 }), 'row-level-security'), 'fail');
  assert.equal(status(await baselineCheck({ root: unsecured, tier: 1 }), 'row-level-security'), 'warn');
  const secured = await project({
    'package.json': JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2.0.0' } }),
    'package-lock.json': '{}',
    'supabase/migrations/001.sql': 'create table public.orders (id uuid primary key, owner_id uuid);\nalter table public.orders enable row level security;\ncreate policy own on public.orders for select using (owner_id = auth.uid());',
  });
  assert.equal(status(await baselineCheck({ root: secured, tier: 2 }), 'row-level-security'), 'pass');
  const open = await project({ 'supabase/migrations/001.sql': 'create table t (id int);\nalter table t enable row level security;\ncreate policy everyone on t for select using (true);' });
  assert.equal(status(await baselineCheck({ root: open, tier: 1 }), 'row-level-security'), 'warn');
});

test('Firebase rules that are open to everyone fail', async () => {
  const dir = await project({ 'firestore.rules': "rules_version = '2';\nservice cloud.firestore { match /databases/{db}/documents { match /{doc=**} { allow read, write: if true; } } }" });
  assert.equal(status(await baselineCheck({ root: dir, tier: 1 }), 'row-level-security'), 'fail');
});

test('state-changing handlers without authentication or a signature are flagged', async () => {
  const dir = await project({
    'package.json': JSON.stringify({ dependencies: { zod: '^3.0.0' } }),
    'package-lock.json': '{}',
    'app/api/orders/route.ts': 'export async function POST(request) { const body = await request.json(); return Response.json(body); }',
    'app/api/me/route.ts': 'export async function POST(request) { const session = await getServerSession(); return Response.json(session); }',
    'app/api/webhook/route.ts': 'export async function POST(request) { const event = stripe.webhooks.constructEvent(await request.text(), sig, secret); return Response.json({}); }',
  });
  const report = await baselineCheck({ root: dir, tier: 1 });
  const api = report.checks.find((c) => c.id === 'api-surface');
  assert.equal(api.status, 'warn');
  const files = api.findings.map((f) => f.file).filter(Boolean);
  assert.deepEqual(files, ['app/api/orders/route.ts']);
  assert.ok(api.findings.some((f) => /rate-limiting/.test(f.detail)), 'missing rate limiting is reported');
});

test('built output: a source map and a secret fail; a clean build passes', async () => {
  const clean = await project({ 'index.html': '<h1>ok</h1>', 'app.js': 'console.log("hi")' });
  const dirty = await project({ 'app.js': `const k = "${FAKE_STRIPE}";`, 'app.js.map': '{}', '.env': 'A=1\n' });
  const src = await project(CLEAN);
  const ok = await baselineCheck({ root: src, tier: 1, built: clean });
  assert.equal(status(ok, 'built-output'), 'pass');
  const bad = await baselineCheck({ root: src, tier: 1, built: dirty });
  assert.equal(status(bad, 'built-output'), 'fail');
  const details = bad.checks.find((c) => c.id === 'built-output').findings.map((f) => f.detail).join(' | ');
  assert.match(details, /source map/);
  assert.match(details, /environment file/);
  assert.match(details, /secret-like/);
  assert.ok(!JSON.stringify(bad).includes(FAKE_STRIPE));
});

test('CLI: exit codes, JSON output and usage errors', async () => {
  const clean = await project(CLEAN);
  const leaky = await project({ '.env': `K=${FAKE_STRIPE}\n`, 'a.js': `const k = "${FAKE_STRIPE}";` });
  const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const ok = run(['--project', clean, '--tier', '0', '--json']);
  assert.equal(ok.status, EXIT.PASS, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(ok.stdout).tool, 'baseline-check');
  const bad = run(['--project', leaky, '--tier', '1']);
  assert.equal(bad.status, EXIT.FAIL);
  assert.match(bad.stdout, /Limit: A pass is not a security audit/);
  assert.ok(!bad.stdout.includes(FAKE_STRIPE));
  assert.equal(run(['--project', clean, '--tier', '9']).status, EXIT.USAGE);
  assert.equal(run(['--project', path.join(clean, 'missing')]).status, EXIT.USAGE);
  assert.equal(run(['--bogus']).status, EXIT.USAGE);
  assert.equal(run(['--help']).status, EXIT.PASS);
  const strict = run(['--project', clean, '--tier', '2', '--strict']);
  assert.equal(strict.status, EXIT.FAIL, 'warnings fail under --strict');
});
