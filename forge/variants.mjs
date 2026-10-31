import { readFileSync } from "node:fs";
import { validateSchema } from "./core/schema.mjs";
import { listJsonFiles } from "./core/fsutil.mjs";
import { idErrors } from "./core/ids.mjs";

const SCHEMA_URL = new URL("./schemas/variant.schema.json", import.meta.url);

export function loadVariants(dir) {
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const variants = [];
  const errors = [];
  for (const file of listJsonFiles(dir)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const err of validateSchema(data, schema, `variant:${file}`)) errors.push(err);
    variants.push({ ...data, __file: file });
  }
  return { variants, errors };
}

export function validateVariant(variant, { species, archetype, variantsById } = {}) {
  const errors = [];
  const add = (path, message, code = "VARIANT") => errors.push({ code, path, message });

  for (const err of idErrors(variant.variantId, "variant.variantId")) errors.push(err);
  if (!species) add("variant.speciesVisualId", `unknown species visual ${variant.speciesVisualId}`, "VARIANT_SPECIES");
  if (!archetype) return errors;

  const allowed = new Set(archetype.variantPolicy.allowedParams);
  const immutable = new Set(archetype.variantPolicy.immutableTraits);
  for (const key of Object.keys(variant.overrides)) {
    if (!allowed.has(key)) add(`variant.overrides.${key}`, `parameter ${key} is not allowed by the archetype`, "VARIANT_PARAM_FORBIDDEN");
    if (immutable.has(key) || [...immutable].some((trait) => key.startsWith(`${trait}.`))) {
      add(`variant.overrides.${key}`, `parameter ${key} would modify an immutable identity trait`, "VARIANT_IDENTITY");
    }
  }

  for (const trait of archetype.identity.requiredTraits) {
    if (!variant.preservedTraits.includes(trait)) add("variant.preservedTraits", `variant must preserve ${trait}`, "VARIANT_PRESERVE");
  }

  if (variant.parentVariantId && variantsById && !variantsById.has(variant.parentVariantId)) {
    add("variant.parentVariantId", `unknown parent variant ${variant.parentVariantId}`, "VARIANT_PARENT");
  }

  if (!variant.provenance.origin || !variant.provenance.license) add("variant.provenance", "origin and license are required", "VARIANT_PROVENANCE");
  return errors;
}

export function canPublishVariant(variant, species, speciesPublishable) {
  const reasons = [];
  if (variant.status !== "APPROVED") reasons.push(`status is ${variant.status}, not APPROVED`);
  if (!speciesPublishable) reasons.push("parent species is not publishable");
  return { allowed: reasons.length === 0, reasons };
}
