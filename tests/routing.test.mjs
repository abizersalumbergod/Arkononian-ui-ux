// Deterministic routing evals: every scenario in evals/scenarios.json must route as expected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, loadRoutes, compileRoutes } from '../scripts/route.mjs';
import { validate, formatErrors } from '../scripts/lib/schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), 'utf8').replace(/^﻿/, ''));

const routes = loadRoutes();
const { scenarios } = readJson('evals', 'scenarios.json');

// BUILD-SPEC section 3 package file list (the only valid module and workflow targets).
const SPEC_REFERENCES = [
  'capability-registry.md', 'capability-registry.json', 'skill-audit.md', 'skill-delegation.md', 'design-intelligence.md',
  'product-discovery.md', 'visual-systems.md', 'typography-and-layout.md', 'design-tokens.md', 'dashboard-engineering.md',
  'landing-page-engineering.md', 'interaction-design.md', 'motion-engineering.md', 'three-dimensional-web.md',
  'shader-and-creative-coding.md', 'asset-generation.md', 'image-to-3d-pipeline.md', 'image-pipelines.md', 'video-pipelines.md', 'hyperframes-video.md', 'audio-pipelines.md',
  'responsive-design.md', 'accessibility.md', 'performance.md', 'visual-testing.md', 'visual-critique.md',
  'frontend-architecture.md', 'security-and-privacy.md', 'troubleshooting.md', 'quality-gates.md',
  'craft-library.md', 'test-driven-development.md', 'bug-diagnosis.md', 'codebase-design.md', 'domain-model.md',
  'prototyping.md', 'interview-and-specs.md', 'delivery-orchestration.md', 'review-and-handoff.md', 'repo-guardrails.md',
  'agent-writing.md', 'lean-code.md', 'prose-humanizing.md', 'terse-mode.md', 'copywriting.md', 'seo-and-discoverability.md',
  'site-structure-and-content.md', 'conversion-optimization.md', 'positioning-and-research.md', 'measurement-and-tracking.md',
  'launch-and-distribution.md', 'growth-channels.md',
  'production-readiness.md', 'security-hardening.md', 'api-protection.md', 'database-integrity.md', 'backend-performance.md', 'scalability-and-reliability.md', 'devsecops-and-deployment.md', 'observability-and-alerting.md', 'load-and-qa-testing.md', 'privacy-and-compliance.md',
].map((f) => `references/${f}`);
const SPEC_WORKFLOWS = [
  'new-product.md', 'existing-project.md', 'landing-page.md', 'dashboard.md', 'ecommerce.md', 'cinematic-3d.md',
  'design-system.md', 'asset-production.md', 'demo-video.md', 'visual-regression.md',
].map((f) => `workflows/${f}`);

const routeIds = new Set(routes.routes.map((r) => r.id));
const approvalIds = new Set(routes.approvalTriggers.map((a) => a.id));
const warningIds = new Set(routes.warningPatterns.map((w) => w.id));

test('scenarios file is well-formed and uses ids defined in routes.json', () => {
  assert.equal(scenarios.length, 17);
  const ids = scenarios.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'scenario ids must be unique');
  for (const s of scenarios) {
    for (const key of ['id', 'prompt', 'expectedPrimary', 'notes']) assert.equal(typeof s[key], 'string', `${s.id}.${key}`);
    for (const key of ['acceptableSecondary', 'mustIncludeModules', 'expectedApprovals', 'expectedWarnings', 'behaviorExpectations']) {
      assert.ok(Array.isArray(s[key]), `${s.id}.${key} must be an array`);
    }
    assert.ok(s.behaviorExpectations.length >= 3, `${s.id}: needs behaviour expectations`);
    assert.ok(routeIds.has(s.expectedPrimary), `${s.id}: unknown route ${s.expectedPrimary}`);
    for (const r of s.acceptableSecondary) assert.ok(routeIds.has(r), `${s.id}: unknown secondary ${r}`);
    for (const a of s.expectedApprovals) assert.ok(approvalIds.has(a), `${s.id}: unknown approval ${a}`);
    for (const w of s.expectedWarnings) assert.ok(warningIds.has(w), `${s.id}: unknown warning ${w}`);
    for (const m of s.mustIncludeModules) assert.ok(SPEC_REFERENCES.includes(m), `${s.id}: module ${m} not in spec file list`);
  }
});

for (const s of scenarios) {
  test(`scenario ${s.id} routes as expected`, () => {
    const r = route(s.prompt);
    const ctx = `scores=${JSON.stringify(r.scores)}`;
    assert.equal(r.primary, s.expectedPrimary, `${s.id}: primary ${ctx}`);
    for (const m of s.mustIncludeModules) assert.ok(r.modules.includes(m), `${s.id}: missing module ${m}; got ${r.modules.join(', ')}`);
    for (const a of s.expectedApprovals) assert.ok(r.approvals.includes(a), `${s.id}: missing approval ${a}; got ${r.approvals.join(', ')}`);
    for (const w of s.expectedWarnings) assert.ok(r.warnings.includes(w), `${s.id}: missing warning ${w}; got ${r.warnings.join(', ')}`);
    for (const sec of r.secondary) assert.notEqual(sec, r.primary);
  });
}

test('empty input routes to the new-product fallback', () => {
  for (const input of ['', '   ', undefined, null]) {
    const r = route(input);
    assert.equal(r.primary, 'new-product');
    assert.deepEqual(r.secondary, []);
    assert.ok(r.workflows.includes('workflows/new-product.md'));
    assert.ok(r.modules.includes('references/quality-gates.md'));
  }
});

test('"3D landing page" picks landing-page and immersive-3d as primary and secondary', () => {
  const r = route('3D landing page');
  const pair = ['landing-page', 'immersive-3d'];
  assert.ok(pair.includes(r.primary), `primary was ${r.primary}`);
  const other = pair.find((id) => id !== r.primary);
  assert.ok(r.secondary.includes(other), `secondary ${r.secondary.join(', ')} should include ${other}`);
  assert.ok(r.modules.includes('references/three-dimensional-web.md'));
  assert.ok(r.modules.includes('references/landing-page-engineering.md'));
});

test('a route scoring 2 or more joins secondary even under a strong primary', () => {
  const r = route("Generate a set of hero images for our bakery's landing page.");
  assert.equal(r.primary, 'asset-production');
  assert.ok(r.secondary.includes('landing-page'), `secondary ${r.secondary.join(', ')} scores=${JSON.stringify(r.scores)}`);
});

test('adding a feature to "our site" pulls in the existing-project route', () => {
  const r = route('Add scroll-triggered reveal animations to our portfolio site.');
  assert.equal(r.primary, 'portfolio-editorial');
  assert.ok(r.secondary.includes('existing-project'), `secondary ${r.secondary.join(', ')} scores=${JSON.stringify(r.scores)}`);
});

test('forms, waitlists and bookings carry the third-party data note', () => {
  for (const prompt of ['Landing page with a waitlist', 'Booking flow for yoga classes', 'One page with a contact section']) {
    const r = route(prompt);
    assert.ok(r.modifiers.includes('forms-auth-payments'), `${prompt}: ${r.modifiers.join(', ')}`);
    assert.ok(r.notes.some((n) => n.startsWith('modifier forms-auth-payments:')), `${prompt}: ${r.notes.join(' | ')}`);
  }
});

test('canvas-design is suggested for posters, not for product photography', () => {
  assert.ok(route('Design a poster for our gig').delegateSkills.includes('canvas-design'));
  assert.ok(!route('Generate 40 product photos for the catalog').delegateSkills.includes('canvas-design'));
});

test('craft modules reach site builds, copy, code quality, media and handoff', () => {
  const site = route('Build a landing page for our bakery with homepage copy and SEO');
  for (const m of ['references/copywriting.md', 'references/seo-and-discoverability.md', 'references/craft-library.md']) {
    assert.ok(site.modules.includes(m), `${m}: ${site.modules.join(', ')}`);
  }
  const copy = route('Make the about page copy sound human, it reads like AI slop');
  assert.ok(copy.modifiers.includes('copy-and-voice') && copy.modules.includes('references/prose-humanizing.md'), copy.modifiers.join(', '));
  const arch = route('Improve the architecture of my site and cut the tech debt');
  assert.ok(arch.modifiers.includes('architecture-design') && arch.modules.includes('references/codebase-design.md'), arch.modifiers.join(', '));
  assert.ok(route('Create background music for the site').delegateSkills.includes('media-use'));
  const session = route('Use caveman mode and remember this across sessions');
  assert.ok(session.modifiers.includes('terse-chat') && session.modifiers.includes('handoff-memory'), session.modifiers.join(', '));
  assert.ok(session.modules.includes('references/terse-mode.md') && session.modules.includes('references/review-and-handoff.md'), session.modules.join(', '));
});

const CRAFT_MODULES = [
  'craft-library', 'test-driven-development', 'bug-diagnosis', 'codebase-design', 'domain-model', 'prototyping',
  'interview-and-specs', 'delivery-orchestration', 'review-and-handoff', 'repo-guardrails', 'agent-writing', 'lean-code',
  'prose-humanizing', 'terse-mode', 'copywriting', 'seo-and-discoverability', 'site-structure-and-content',
  'conversion-optimization', 'positioning-and-research', 'measurement-and-tracking', 'launch-and-distribution', 'growth-channels',
].map((m) => `references/${m}.md`);

test('every craft module is routed, and none depends on an external skill', () => {
  const routed = new Set([
    ...routes.routes.flatMap((r) => r.modules ?? []),
    ...(routes.modifiers ?? []).flatMap((m) => m.modules ?? []),
    ...(routes.approvalTriggers ?? []).flatMap((a) => a.modules ?? []),
  ]);
  for (const m of CRAFT_MODULES) assert.ok(routed.has(m), `${m} is not reachable from any route, modifier or approval trigger`);
  const external = ['ponytail', 'humanizer', 'caveman', 'tdd', 'grill-me', 'seo-audit', 'copywriting', 'cro', 'schema', 'improve-codebase-architecture', 'claude-mem:mem-search'];
  const delegates = new Set([
    ...routes.routes.flatMap((r) => r.delegateSkills ?? []),
    ...(routes.modifiers ?? []).flatMap((m) => m.delegateSkills ?? []),
  ]);
  for (const s of external) assert.ok(!delegates.has(s), `routes.json still delegates to external skill ${s}`);
});

test('installing skills and publishing specs or tickets need approval', () => {
  assert.ok(route('Install skills with npx skills add mattpocock/skills').approvals.includes('system-install'));
  assert.ok(route('Turn this plan into tickets and create issues on GitHub').approvals.includes('tracker-or-pr'));
});

test('routes.json validates against schemas/routes.schema.json and compiles', () => {
  const result = validate(readJson('schemas', 'routes.schema.json'), routes);
  assert.ok(result.valid, formatErrors(result.errors).join('\n'));
  assert.doesNotThrow(() => compileRoutes(routes));
});

test('every module and workflow path in routes.json is in the spec file list', () => {
  const modules = [
    ...routes.always,
    ...routes.routes.flatMap((r) => r.modules ?? []),
    ...(routes.modifiers ?? []).flatMap((m) => m.modules ?? []),
    ...(routes.approvalTriggers ?? []).flatMap((a) => a.modules ?? []),
    ...(routes.warningPatterns ?? []).flatMap((w) => w.modules ?? []),
  ];
  for (const m of modules) assert.ok(SPEC_REFERENCES.includes(m), `module not in spec file list: ${m}`);
  const workflows = [...routes.routes.map((r) => r.workflow), routes.fallback?.workflow].filter(Boolean);
  for (const w of workflows) assert.ok(SPEC_WORKFLOWS.includes(w), `workflow not in spec file list: ${w}`);
});

const PRODUCTION_MODULES = [
  'production-readiness', 'security-hardening', 'api-protection', 'database-integrity', 'backend-performance',
  'scalability-and-reliability', 'devsecops-and-deployment', 'observability-and-alerting', 'load-and-qa-testing', 'privacy-and-compliance',
].map((m) => `references/${m}.md`);

test('every site and app route carries the production-readiness hub; app routes also carry the security modules', () => {
  for (const id of ['landing-page', 'dashboard-saas', 'ecommerce', 'portfolio-editorial', 'immersive-3d', 'existing-project', 'mobile-responsive', 'new-product']) {
    const r = routes.routes.find((x) => x.id === id);
    assert.ok(r.modules.includes('references/production-readiness.md'), `${id} is missing the production-readiness hub`);
  }
  for (const id of ['dashboard-saas', 'ecommerce']) {
    const r = routes.routes.find((x) => x.id === id);
    for (const m of ['security-hardening', 'api-protection', 'database-integrity', 'privacy-and-compliance']) assert.ok(r.modules.includes(`references/${m}.md`), `${id} lacks ${m}`);
  }
});

test('every production module is reachable from a route, modifier or approval trigger', () => {
  const routed = new Set([
    ...routes.routes.flatMap((r) => r.modules ?? []),
    ...(routes.modifiers ?? []).flatMap((m) => m.modules ?? []),
    ...(routes.approvalTriggers ?? []).flatMap((a) => a.modules ?? []),
  ]);
  for (const m of PRODUCTION_MODULES) assert.ok(routed.has(m), `${m} is not routed`);
});

test('production keywords load their modules, and risky production actions need an approval', () => {
  assert.ok(route('Harden my vibe coded app before launch').modules.includes('references/production-readiness.md'));
  assert.ok(route('Add rate limiting and webhook signature checks to our API endpoints').modules.includes('references/api-protection.md'));
  assert.ok(route('Review our Supabase row level security and migrations').modules.includes('references/database-integrity.md'));
  assert.ok(route('Why is the checkout API slow? Add Redis caching').modules.includes('references/backend-performance.md'));
  assert.ok(route('Plan autoscaling, load balancing and a background job queue').modules.includes('references/scalability-and-reliability.md'));
  assert.ok(route('Set up a CI pipeline with GitHub Actions and rollbacks').modules.includes('references/devsecops-and-deployment.md'));
  assert.ok(route('Add Sentry error tracking and uptime alerts').modules.includes('references/observability-and-alerting.md'));
  assert.ok(route('Make the site DPDP and GDPR compliant with a cookie banner').modules.includes('references/privacy-and-compliance.md'));
  assert.ok(route('Set up a k6 load test for the checkout').approvals.includes('security-or-load-test'));
  assert.ok(route('Rotate the leaked Stripe key').approvals.includes('credential-change'));
  assert.ok(route('Migrate the production database tables tonight').approvals.includes('production-data-change'));
  assert.ok(route('Provision a Redis cache and a load balancer').approvals.includes('infrastructure-provisioning'));
});

test('a login and form site pulls in the API, security and privacy modules', () => {
  const r = route('Build a marketing site with a contact form and a login');
  for (const m of ['references/production-readiness.md', 'references/api-protection.md', 'references/security-hardening.md', 'references/privacy-and-compliance.md']) {
    assert.ok(r.modules.includes(m), `${m}: ${r.modules.join(', ')}`);
  }
});
