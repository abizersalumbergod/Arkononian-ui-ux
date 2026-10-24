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
  'shader-and-creative-coding.md', 'asset-generation.md', 'image-pipelines.md', 'video-pipelines.md', 'audio-pipelines.md',
  'responsive-design.md', 'accessibility.md', 'performance.md', 'visual-testing.md', 'visual-critique.md',
  'frontend-architecture.md', 'security-and-privacy.md', 'troubleshooting.md', 'quality-gates.md',
].map((f) => `references/${f}`);
const SPEC_WORKFLOWS = [
  'new-product.md', 'existing-project.md', 'landing-page.md', 'dashboard.md', 'ecommerce.md', 'cinematic-3d.md',
  'design-system.md', 'asset-production.md', 'visual-regression.md',
].map((f) => `workflows/${f}`);

const routeIds = new Set(routes.routes.map((r) => r.id));
const approvalIds = new Set(routes.approvalTriggers.map((a) => a.id));
const warningIds = new Set(routes.warningPatterns.map((w) => w.id));

test('scenarios file is well-formed and uses ids defined in routes.json', () => {
  assert.equal(scenarios.length, 16);
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
