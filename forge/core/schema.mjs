/**
 * Minimal, dependency-free JSON Schema validator for Animal Forge.
 * Supports the subset used by forge/schemas/*.json.
 */

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, type) {
  if (Array.isArray(type)) return type.some((t) => matchesType(value, t));
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isInteger(value);
  return typeOf(value) === type;
}

function push(errors, path, message, code = "SCHEMA") {
  errors.push({ code, path, message });
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

export function validateSchema(value, schema, path = "$") {
  const errors = [];
  visit(value, schema, path, errors);
  return errors;
}

function visit(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;

  if ("const" in schema && !deepEqual(value, schema.const)) {
    push(errors, path, `must be ${JSON.stringify(schema.const)}`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    push(errors, path, `must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`);
    return;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    push(errors, path, `expected ${Array.isArray(schema.type) ? schema.type.join("|") : schema.type}, got ${typeOf(value)}`);
    return;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      push(errors, path, `must be at least ${schema.minLength} characters`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      push(errors, path, `must match ${schema.pattern}`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) push(errors, path, `must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) push(errors, path, `must be <= ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) push(errors, path, `must be > ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) push(errors, path, `must be < ${schema.exclusiveMaximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) push(errors, path, `must have at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) push(errors, path, `must have at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => visit(item, schema.items, `${path}[${i}]`, errors));
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i += 1) {
        for (let j = i + 1; j < value.length; j += 1) {
          if (deepEqual(value[i], value[j])) push(errors, `${path}[${j}]`, "duplicate item", "SCHEMA_UNIQUE");
        }
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value)) push(errors, `${path}.${req}`, "is required");
    }
    for (const [key, val] of Object.entries(value)) {
      if (props[key]) {
        visit(val, props[key], `${path}.${key}`, errors);
      } else if (schema.additionalProperties === false) {
        push(errors, `${path}.${key}`, "is not allowed", "SCHEMA_EXTRA");
      }
    }
  }
}
