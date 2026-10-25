// Zero-dependency JSON Schema validator (draft 2020-12 subset) for the arkononion-ui-ui skill.
//
// Supported keywords: type (single or array), properties, required, additionalProperties
// (boolean or schema), patternProperties, propertyNames, minProperties, maxProperties,
// items, prefixItems, minItems, maxItems, uniqueItems, contains, enum, const, pattern,
// minLength, maxLength, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf,
// allOf, anyOf, oneOf, not, if/then/else, $ref (local "#..." JSON pointers such as
// "#/$defs/name"), format "date" | "date-time" | "uri" | "uri-reference" | "email" (basic).
// Annotation keywords ($schema, $id, title, description, default, examples, $comment) are ignored.
// Unknown formats are ignored (draft 2020-12 treats format as an annotation by default).

const MAX_DEPTH = 100;
const regexCache = new Map();

/**
 * @typedef {object} SchemaError
 * @property {string} path     JSON pointer to the offending value ("" is the root).
 * @property {string} keyword  Schema keyword that failed.
 * @property {string} message  Human-readable explanation.
 * @property {object} [params] Extra keyword details (e.g. missingProperty).
 */

/**
 * Validate `data` against `schema`.
 * @param {object|boolean} schema JSON Schema (draft 2020-12 subset, see file header).
 * @param {*} data Parsed JSON value.
 * @returns {{valid: boolean, errors: SchemaError[]}}
 */
export function validate(schema, data) {
  if (schema === null || (typeof schema !== 'object' && typeof schema !== 'boolean')) {
    throw new TypeError('validate(schema, data): schema must be an object or boolean');
  }
  const errors = check(schema, data, '', schema, 0);
  return { valid: errors.length === 0, errors };
}

/**
 * Format schema errors as "path: message" lines (root is shown as "(root)").
 * @param {SchemaError[]} errors
 * @returns {string[]}
 */
export function formatErrors(errors) {
  return errors.map((e) => `${e.path === '' ? '(root)' : e.path}: ${e.message}`);
}

/**
 * Deep structural equality for JSON values.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    if (Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Basic format checks used by the validator ("date", "date-time", "uri", "uri-reference", "email").
 * Returns true for unknown formats.
 * @param {string} format
 * @param {string} value
 * @returns {boolean}
 */
export function checkFormat(format, value) {
  switch (format) {
    case 'date':
      return isValidDate(value);
    case 'date-time': {
      const m = /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
      if (!m || !isValidDate(m[1])) return false;
      const [h, mi, s] = [Number(m[2]), Number(m[3]), Number(m[4])];
      if (h > 23 || mi > 59 || s > 60) return false;
      if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false;
      return true;
    }
    case 'uri':
      return /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/.test(value);
    case 'uri-reference':
      return !/\s/.test(value);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    default:
      return true;
  }
}

function isValidDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= days;
}

function err(path, keyword, message, params) {
  const e = { path, keyword, message };
  if (params) e.params = params;
  return e;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(type, v) {
  switch (type) {
    case 'null': return v === null;
    case 'array': return Array.isArray(v);
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'string': return typeof v === 'string';
    case 'boolean': return typeof v === 'boolean';
    default: return false;
  }
}

function getRegex(pattern) {
  if (regexCache.has(pattern)) return regexCache.get(pattern);
  let re;
  try {
    re = new RegExp(pattern, 'u');
  } catch {
    re = new RegExp(pattern); // throws for truly invalid patterns; caller reports it
  }
  regexCache.set(pattern, re);
  return re;
}

function escapePointer(key) {
  return String(key).replace(/~/g, '~0').replace(/\//g, '~1');
}

function resolveRef(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) {
    return { ok: false, message: `unsupported $ref "${ref}" (only local "#/..." references are supported)` };
  }
  if (ref === '#') return { ok: true, schema: root };
  if (!ref.startsWith('#/')) {
    return { ok: false, message: `unsupported $ref "${ref}" (anchors are not supported; use "#/$defs/...")` };
  }
  let node = root;
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return { ok: false, message: `$ref "${ref}" does not resolve inside the schema` };
    }
    node = node[key];
  }
  return { ok: true, schema: node };
}

function describe(v) {
  const s = JSON.stringify(v);
  return s && s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function bestBranch(path, branches) {
  // Prefer branches whose root type matched, then the fewest errors.
  let best = null;
  for (const b of branches) {
    const typeMiss = b.some((e) => e.path === path && e.keyword === 'type');
    const score = (typeMiss ? 1e6 : 0) + b.length;
    if (!best || score < best.score) best = { score, errors: b };
  }
  return best ? best.errors : [];
}

function check(schema, data, path, root, depth) {
  if (depth > MAX_DEPTH) return [err(path, '$ref', 'maximum schema depth exceeded (circular $ref?)')];
  if (schema === true || schema === undefined) return [];
  if (schema === false) return [err(path, 'false', 'no value is allowed here')];
  if (schema === null || typeof schema !== 'object') {
    return [err(path, 'schema', `invalid schema node (${typeof schema})`)];
  }
  const errors = [];

  if (schema.$ref !== undefined) {
    const target = resolveRef(root, schema.$ref);
    if (!target.ok) errors.push(err(path, '$ref', target.message));
    else errors.push(...check(target.schema, data, path, root, depth + 1));
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(t, data))) {
      errors.push(err(path, 'type', `must be ${types.join(' or ')} (got ${typeOf(data)})`, { type: types }));
      return errors; // further keyword errors would only be noise
    }
  }

  if (schema.const !== undefined && !deepEqual(schema.const, data)) {
    errors.push(err(path, 'const', `must be equal to ${describe(schema.const)}`));
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((v) => deepEqual(v, data))) {
    errors.push(err(path, 'enum', `must be one of: ${schema.enum.map(describe).join(', ')} (got ${describe(data)})`, { allowed: schema.enum }));
  }

  if (typeof data === 'string') {
    const len = [...data].length;
    if (typeof schema.minLength === 'number' && len < schema.minLength) {
      errors.push(err(path, 'minLength', schema.minLength === 1 ? 'must not be empty' : `must be at least ${schema.minLength} characters`));
    }
    if (typeof schema.maxLength === 'number' && len > schema.maxLength) {
      errors.push(err(path, 'maxLength', `must be at most ${schema.maxLength} characters (got ${len})`));
    }
    if (typeof schema.pattern === 'string') {
      let re;
      try {
        re = getRegex(schema.pattern);
      } catch (e) {
        errors.push(err(path, 'pattern', `schema pattern is not a valid regular expression: ${e.message}`));
      }
      if (re && !re.test(data)) errors.push(err(path, 'pattern', `must match pattern ${schema.pattern}`));
    }
    if (typeof schema.format === 'string' && !checkFormat(schema.format, data)) {
      errors.push(err(path, 'format', `must be a valid ${schema.format}`));
    }
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) errors.push(err(path, 'minimum', `must be >= ${schema.minimum}`));
    if (typeof schema.maximum === 'number' && data > schema.maximum) errors.push(err(path, 'maximum', `must be <= ${schema.maximum}`));
    if (typeof schema.exclusiveMinimum === 'number' && data <= schema.exclusiveMinimum) errors.push(err(path, 'exclusiveMinimum', `must be > ${schema.exclusiveMinimum}`));
    if (typeof schema.exclusiveMaximum === 'number' && data >= schema.exclusiveMaximum) errors.push(err(path, 'exclusiveMaximum', `must be < ${schema.exclusiveMaximum}`));
    if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
      const q = data / schema.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-9) errors.push(err(path, 'multipleOf', `must be a multiple of ${schema.multipleOf}`));
    }
  }

  if (Array.isArray(data)) {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) errors.push(err(path, 'minItems', `must have at least ${schema.minItems} item(s)`));
    if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) errors.push(err(path, 'maxItems', `must have at most ${schema.maxItems} item(s)`));
    if (schema.uniqueItems === true) {
      outer: for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          if (deepEqual(data[i], data[j])) {
            errors.push(err(path, 'uniqueItems', `must not contain duplicate items (items ${i} and ${j} are equal)`));
            break outer;
          }
        }
      }
    }
    let start = 0;
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((s, i) => {
        if (i < data.length) errors.push(...check(s, data[i], `${path}/${i}`, root, depth + 1));
      });
      start = schema.prefixItems.length;
    }
    if (schema.items !== undefined) {
      for (let i = start; i < data.length; i++) errors.push(...check(schema.items, data[i], `${path}/${i}`, root, depth + 1));
    }
    if (schema.contains !== undefined && !data.some((item, i) => check(schema.contains, item, `${path}/${i}`, root, depth + 1).length === 0)) {
      errors.push(err(path, 'contains', 'must contain at least one matching item'));
    }
  }

  if (matchesType('object', data)) {
    const keys = Object.keys(data);
    if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) errors.push(err(path, 'minProperties', `must have at least ${schema.minProperties} propert${schema.minProperties === 1 ? 'y' : 'ies'}`));
    if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) errors.push(err(path, 'maxProperties', `must have at most ${schema.maxProperties} properties`));
    if (Array.isArray(schema.required)) {
      for (const k of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) {
          errors.push(err(path, 'required', `must have required property "${k}"`, { missingProperty: k }));
        }
      }
    }
    const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const patternProps = schema.patternProperties && typeof schema.patternProperties === 'object' ? schema.patternProperties : {};
    for (const k of keys) {
      const childPath = `${path}/${escapePointer(k)}`;
      let matched = false;
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        matched = true;
        errors.push(...check(props[k], data[k], childPath, root, depth + 1));
      }
      for (const [p, s] of Object.entries(patternProps)) {
        let re;
        try {
          re = getRegex(p);
        } catch (e) {
          errors.push(err(childPath, 'patternProperties', `schema patternProperties key is not a valid regular expression: ${e.message}`));
          continue;
        }
        if (re.test(k)) {
          matched = true;
          errors.push(...check(s, data[k], childPath, root, depth + 1));
        }
      }
      if (!matched && schema.additionalProperties !== undefined) {
        if (schema.additionalProperties === false) {
          errors.push(err(childPath, 'additionalProperties', `property "${k}" is not allowed here`, { additionalProperty: k }));
        } else {
          errors.push(...check(schema.additionalProperties, data[k], childPath, root, depth + 1));
        }
      }
      if (schema.propertyNames !== undefined) {
        const nameErrors = check(schema.propertyNames, k, childPath, root, depth + 1);
        if (nameErrors.length) errors.push(err(childPath, 'propertyNames', `property name "${k}" is invalid: ${nameErrors[0].message}`));
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const s of schema.allOf) errors.push(...check(s, data, path, root, depth + 1));
  }
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.map((s) => check(s, data, path, root, depth + 1));
    if (!branches.some((b) => b.length === 0)) {
      errors.push(err(path, 'anyOf', 'must match at least one allowed shape (anyOf); closest match errors follow'));
      errors.push(...bestBranch(path, branches));
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const branches = schema.oneOf.map((s) => check(s, data, path, root, depth + 1));
    const passing = branches.filter((b) => b.length === 0).length;
    if (passing === 0) {
      errors.push(err(path, 'oneOf', 'must match exactly one allowed shape (oneOf); closest match errors follow'));
      errors.push(...bestBranch(path, branches));
    } else if (passing > 1) {
      errors.push(err(path, 'oneOf', `must match exactly one schema in oneOf (matched ${passing})`));
    }
  }
  if (schema.not !== undefined && check(schema.not, data, path, root, depth + 1).length === 0) {
    errors.push(err(path, 'not', 'must NOT match the disallowed schema'));
  }
  if (schema.if !== undefined) {
    const passes = check(schema.if, data, path, root, depth + 1).length === 0;
    if (passes && schema.then !== undefined) errors.push(...check(schema.then, data, path, root, depth + 1));
    if (!passes && schema.else !== undefined) errors.push(...check(schema.else, data, path, root, depth + 1));
  }
  return errors;
}
