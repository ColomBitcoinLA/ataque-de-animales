import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSchema } from "./core/schema.mjs";
import { listJsonFiles } from "./core/fsutil.mjs";
import { idErrors } from "./core/ids.mjs";

const SCHEMA_URL = new URL("./schemas/archetype.schema.json", import.meta.url);

export function loadArchetypes(dir) {
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const archetypes = new Map();
  const errors = [];
  for (const file of listJsonFiles(dir)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const err of validateSchema(data, schema, `archetype:${file}`)) errors.push(err);
    for (const err of idErrors(data.id, `archetype:${file}.id`)) errors.push(err);
    if (archetypes.has(data.id)) errors.push({ code: "ARCHETYPE_DUPLICATE", path: `archetype:${file}`, message: `duplicate archetype ${data.id}` });
    archetypes.set(data.id, data);
  }
  return { archetypes, errors };
}

export function validateArchetype(archetype, artBible) {
  const errors = [];
  const add = (path, message, code = "ARCHETYPE") => errors.push({ code, path, message });

  if (!artBible.families?.[archetype.family]) add(`archetype.${archetype.id}.family`, `unknown family ${archetype.family}`);
  if (!archetype.skeleton.compatibleWith.includes(archetype.family)) add(`archetype.${archetype.id}.skeleton`, "skeleton must be compatible with its own family");

  for (const [metric, range] of Object.entries(archetype.measurementRanges || {})) {
    if (!Array.isArray(range) || range.length !== 2) add(`archetype.${archetype.id}.measurementRanges.${metric}`, "range must be [min,max]");
    else if (range[0] > range[1]) add(`archetype.${archetype.id}.measurementRanges.${metric}`, "min > max");
    else if (range[0] < 0) add(`archetype.${archetype.id}.measurementRanges.${metric}`, "range cannot be negative");
  }

  const required = new Set(archetype.identity.requiredTraits);
  for (const trait of archetype.variantPolicy.immutableTraits) {
    if (!required.has(trait)) add(`archetype.${archetype.id}.variantPolicy.immutableTraits`, `immutable trait ${trait} is not an identity trait`);
  }
  for (const trait of archetype.evolutionPolicy.mustPreserve) {
    if (!required.has(trait)) add(`archetype.${archetype.id}.evolutionPolicy.mustPreserve`, `preserved trait ${trait} is not an identity trait`);
  }
  return errors;
}

export function checkMeasurements(archetype, measurements) {
  const errors = [];
  const add = (metric, message) => errors.push({ code: "MEASUREMENT_RANGE", path: `measurements.${metric}`, message });
  const ranges = archetype.measurementRanges;

  const scalar = ["heightM", "shoulderHeightM", "lengthM", "bodyWidthM", "eyeDiameterM", "eyeGapM", "tailOffsetM"];
  for (const metric of scalar) {
    const range = ranges[metric];
    const value = measurements[metric];
    if (!Number.isFinite(value)) add(metric, "must be a finite number");
    else if (value < range[0] || value > range[1]) add(metric, `${value} outside [${range[0]}, ${range[1]}]`);
  }

  const count = measurements.crestMainCount;
  if (!Number.isInteger(count) || count < ranges.crestMainCount[0] || count > ranges.crestMainCount[1]) {
    add("crestMainCount", `${count} outside [${ranges.crestMainCount[0]}, ${ranges.crestMainCount[1]}]`);
  }

  for (const [paw, toes] of Object.entries(measurements.toesPerPaw || {})) {
    if (!Number.isInteger(toes) || toes < ranges.toesPerPaw[0] || toes > ranges.toesPerPaw[1]) add(`toesPerPaw.${paw}`, `${toes} outside [${ranges.toesPerPaw[0]}, ${ranges.toesPerPaw[1]}]`);
  }
  if (Object.keys(measurements.toesPerPaw || {}).length !== 4) add("toesPerPaw", "quadruped requires four paws");

  if (measurements.up !== "+Y") add("up", "up must be +Y");
  if (measurements.forward !== "+Z") add("forward", "forward must be +Z");
  if (Math.abs(measurements.feetY) > 1e-9) add("feetY", "feet must be on Y=0");
  return errors;
}
