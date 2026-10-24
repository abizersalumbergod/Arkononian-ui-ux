// Tests for scripts/lib/schema.mjs and the bundled schemas/templates. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { validate, formatErrors, checkFormat, deepEqual } from '../scripts/lib/schema.mjs';
import { PACKAGE_ROOT } from '../scripts/lib/fsutil.mjs';

const loadJson = (...parts) => JSON.parse(readFileSync(path.join(PACKAGE_ROOT, ...parts), 'utf8').replace(/^﻿/, ''));
const ok = (schema, data) => validate(schema, data).valid;
const keywords = (schema, data) => validate(schema, data).errors.map((e) => e.keyword);
const SCHEMAS = ['asset-manifest', 'capability-registry', 'preset', 'quality-report', 'routes'];

function collectRefs(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') out.push(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

function resolvePointer(root, ref) {
  if (ref === '#') return root;
  if (!ref.startsWith('#/')) return undefined;
  let node = root;
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

test('type: single, union, integer vs number, null', () => {
  assert.equal(ok({ type: 'string' }, 'a'), true);
  assert.equal(ok({ type: 'string' }, 1), false);
  assert.equal(ok({ type: ['string', 'null'] }, null), true);
  assert.equal(ok({ type: ['string', 'null'] }, 0), false);
  assert.equal(ok({ type: 'integer' }, 1.5), false);
  assert.equal(ok({ type: 'integer' }, 2), true);
  assert.equal(ok({ type: 'number' }, 2), true);
  assert.equal(ok({ type: 'array' }, {}), false);
  assert.equal(ok({ type: 'object' }, []), false);
  assert.equal(ok({ type: 'object' }, null), false);
  assert.equal(ok({ type: 'boolean' }, 'true'), false);
});

test('objects: required, properties, additionalProperties false and schema', () => {
  const s = { type: 'object', required: ['a'], properties: { a: { type: 'string' } }, additionalProperties: false };
  assert.equal(ok(s, { a: 'x' }), true);
  const missing = validate(s, {});
  assert.equal(missing.valid, false);
  assert.equal(missing.errors[0].keyword, 'required');
  assert.equal(missing.errors[0].params.missingProperty, 'a');
  assert.deepEqual(keywords(s, { a: 'x', b: 1 }), ['additionalProperties']);
  assert.deepEqual(keywords(s, { a: 2 }), ['type']);
  const typed = { type: 'object', additionalProperties: { type: 'integer' } };
  assert.equal(ok(typed, { x: 1, y: 2 }), true);
  assert.equal(ok(typed, { x: 'no' }), false);
});

test('strings: enum, const, pattern, minLength/maxLength count code points', () => {
  assert.equal(ok({ enum: ['a', 'b'] }, 'b'), true);
  assert.equal(ok({ enum: ['a', 'b'] }, 'c'), false);
  assert.equal(ok({ const: { k: [1, 2] } }, { k: [1, 2] }), true);
  assert.equal(ok({ const: 'x' }, 'y'), false);
  assert.equal(ok({ type: 'string', pattern: '^[a-z]+$' }, 'abc'), true);
  assert.equal(ok({ type: 'string', pattern: '^[a-z]+$' }, 'aBc'), false);
  assert.equal(ok({ type: 'string', minLength: 1 }, ''), false);
  assert.equal(ok({ type: 'string', maxLength: 2 }, '\u{1D49C}\u{1D49C}'), true); // 2 code points, 4 UTF-16 units
  assert.equal(ok({ type: 'string', maxLength: 2 }, 'abc'), false);
});

test('numbers and arrays: minimum, maximum, items, minItems, maxItems, uniqueItems', () => {
  assert.equal(ok({ type: 'number', minimum: 1, maximum: 3 }, 3), true);
  assert.equal(ok({ type: 'number', minimum: 1 }, 0), false);
  assert.equal(ok({ type: 'number', maximum: 3 }, 3.1), false);
  const list = { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3, uniqueItems: true };
  assert.equal(ok(list, [1, 2]), true);
  assert.deepEqual(keywords(list, []), ['minItems']);
  assert.deepEqual(keywords(list, [1, 2, 3, 4]), ['maxItems']);
  assert.deepEqual(keywords(list, [1, 1]), ['uniqueItems']);
  assert.equal(ok(list, [1, 'x']), false);
  assert.equal(ok({ uniqueItems: true }, [{ a: 1 }, { a: 1 }]), false);
});

test('anyOf, oneOf and $ref to #/$defs', () => {
  const s = { $defs: { id: { type: 'string', pattern: '^[a-z-]+$' } }, anyOf: [{ $ref: '#/$defs/id' }, { type: 'integer' }] };
  assert.equal(ok(s, 'abc-d'), true);
  assert.equal(ok(s, 7), true);
  assert.equal(ok(s, 'ABC'), false);
  const one = { oneOf: [{ type: 'integer' }, { type: 'number' }] };
  assert.equal(ok(one, 1.5), true);
  assert.equal(ok(one, 2), false, 'an integer matches both branches, so oneOf fails');
  const bad = validate({ $ref: '#/$defs/missing' }, 1);
  assert.equal(bad.valid, false);
  assert.match(bad.errors[0].message, /does not resolve/);
});

test('formats: date, date-time and uri (basic)', () => {
  assert.equal(checkFormat('date', '2026-02-29'), false);
  assert.equal(checkFormat('date', '2028-02-29'), true);
  assert.equal(checkFormat('date-time', '2026-10-24T13:45:00Z'), true);
  assert.equal(checkFormat('date-time', '2026-10-24T25:00:00Z'), false);
  assert.equal(checkFormat('uri', 'https://example.com/a?b=1'), true);
  assert.equal(checkFormat('uri', 'not a uri'), false);
  assert.equal(ok({ type: 'string', format: 'date' }, '2026-13-01'), false);
  assert.equal(ok({ type: ['string', 'null'], format: 'date' }, null), true);
});

test('errors carry JSON-pointer paths and format as "path: message"', () => {
  const s = { type: 'object', properties: { list: { type: 'array', items: { type: 'object', required: ['id'] } } } };
  const { errors } = validate(s, { list: [{ id: 1 }, {}] });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, '/list/1');
  assert.deepEqual(formatErrors(errors), ['/list/1: must have required property "id"']);
  assert.deepEqual(formatErrors(validate({ type: 'string' }, 1).errors), ['(root): must be string (got integer)']);
  assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
  assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
  assert.throws(() => validate(null, {}), TypeError);
});

test('every bundled schema parses, targets draft 2020-12 and resolves all $refs', () => {
  for (const name of SCHEMAS) {
    const schema = loadJson('schemas', `${name}.schema.json`);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name);
    const refs = collectRefs(schema);
    for (const ref of refs) assert.notEqual(resolvePointer(schema, ref), undefined, `${name}: ${ref} does not resolve`);
    const { errors } = validate(schema, {});
    assert.ok(!errors.some((e) => e.keyword === '$ref' || e.keyword === 'schema'), `${name}: ${formatErrors(errors).join('; ')}`);
  }
});

test('templates validate against their schemas', () => {
  const pairs = [
    ['templates/asset-manifest.json', 'asset-manifest'],
    ['templates/quality-report.json', 'quality-report'],
  ];
  for (const [file, name] of pairs) {
    const data = loadJson(...file.split('/'));
    const res = validate(loadJson('schemas', `${name}.schema.json`), data);
    assert.equal(res.valid, true, `${file}: ${formatErrors(res.errors).join('; ')}`);
    assert.equal(data.example, true, `${file} must be marked as an example`);
  }
});

test('asset-manifest schema: license required, path or uri required, enums and ratios enforced', () => {
  const schema = loadJson('schemas', 'asset-manifest.schema.json');
  const base = {
    id: 'a', type: 'image', role: 'hero', path: 'public/a.png', source: 'original', format: 'png',
    license: 'CC0-1.0', critical: false, loading: 'lazy', optimization: 'none', validation: { status: 'pending' },
  };
  const m = (asset) => ({ version: '1.0', project: 'p', assets: [asset] });
  assert.equal(ok(schema, m(base)), true);
  const { license: _license, ...noLicense } = base;
  assert.ok(validate(schema, m(noLicense)).errors.some((e) => e.keyword === 'required' && e.params?.missingProperty === 'license'));
  const { path: _path, ...noPath } = base;
  assert.equal(ok(schema, m(noPath)), false);
  assert.equal(ok(schema, m({ ...noPath, uri: 'https://cdn.example.com/a.png' })), true);
  assert.equal(ok(schema, m({ ...base, type: 'gif' })), false);
  assert.equal(ok(schema, m({ ...base, aspectRatio: '16:9' })), true);
  assert.equal(ok(schema, m({ ...base, aspectRatio: 1.5 })), true);
  assert.equal(ok(schema, m({ ...base, aspectRatio: 'wide' })), false);
  assert.equal(ok(schema, m({ ...base, validation: { status: 'passed', checkedOn: '2026-10-24' } })), true);
  assert.equal(ok(schema, m({ ...base, validation: { status: 'ok' } })), false);
});

test('quality-report schema: PASS needs evidence, other statuses need a reason, gates are A-H only', () => {
  const schema = loadJson('schemas', 'quality-report.schema.json');
  const gate = (over = {}) => ({ name: 'Gate', status: 'NOT_TESTED', required: true, evidence: [], findings: [], reason: 'not run', ...over });
  const report = (pick) => ({
    project: 'p', scope: 's', generatedOn: '2026-10-24', environment: 'test', limitations: [],
    gates: Object.fromEntries('ABCDEFGH'.split('').map((k) => [k, pick(k)])),
  });
  const { reason: _reason, ...noReason } = gate();
  const evidence = [{ check: 'build', tool: 'npm run build', result: 'exit 0' }];
  assert.equal(ok(schema, report(() => gate())), true);
  assert.equal(ok(schema, report((k) => (k === 'B' ? gate({ status: 'PASS' }) : gate()))), false, 'PASS without evidence');
  assert.equal(ok(schema, report((k) => (k === 'B' ? gate({ status: 'PASS', evidence }) : gate()))), true);
  assert.equal(ok(schema, report((k) => (k === 'C' ? noReason : gate()))), false, 'NOT_TESTED without reason');
  assert.equal(ok(schema, report((k) => (k === 'C' ? gate({ reason: '' }) : gate()))), false, 'empty reason');
  assert.equal(ok(schema, report((k) => (k === 'D' ? gate({ status: 'DONE' }) : gate()))), false, 'unknown status');
  const extra = report(() => gate());
  extra.gates.I = gate();
  assert.equal(ok(schema, extra), false, 'gate I is not allowed');
});
