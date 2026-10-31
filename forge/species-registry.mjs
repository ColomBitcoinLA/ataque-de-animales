import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSchema } from "./core/schema.mjs";
import { listJsonFiles } from "./core/fsutil.mjs";
import { idErrors } from "./core/ids.mjs";
import { checkMeasurements } from "./archetypes.mjs";

const SCHEMA_URL = new URL("./schemas/species-visual.schema.json", import.meta.url);

export function loadSpeciesVisuals(dir) {
  const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
  const species = [];
  const errors = [];
  for (const file of listJsonFiles(dir)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const err of validateSchema(data, schema, `species:${file}`)) errors.push(err);
    species.push({ ...data, __file: file });
  }
  return { species, errors };
}

export function validateSpeciesVisual(species, { archetypes, artBible, domainSpeciesIds, root } = {}) {
  const errors = [];
  const add = (path, message, code = "SPECIES") => errors.push({ code, path, message });

  for (const err of idErrors(species.visualId, "species.visualId")) errors.push(err);
  for (const err of idErrors(species.speciesId, "species.speciesId")) errors.push(err);

  if (domainSpeciesIds && !domainSpeciesIds.includes(species.speciesId)) {
    add("species.speciesId", `speciesId ${species.speciesId} does not exist in the domain registry`, "SPECIES_DOMAIN_LINK");
  }
  const archetype = archetypes?.get(species.archetypeId);
  if (!archetype) add("species.archetypeId", `unknown archetype ${species.archetypeId}`, "SPECIES_ARCHETYPE");

  const approval = species.approval || {};
  if (species.status === "APPROVED") {
    if (approval.artApproved !== true) add("species.approval.artApproved", "APPROVED requires artApproved=true");
    if (!approval.approvedBy) add("species.approval.approvedBy", "APPROVED requires a human approver");
    if (!approval.approvedAt) add("species.approval.approvedAt", "APPROVED requires an approval date");
    if (!approval.evidence) add("species.approval.evidence", "APPROVED requires review evidence");
    if (typeof approval.score !== "number" || approval.score < 0 || approval.score > 10) add("species.approval.score", "APPROVED requires a 0-10 human score");
  } else {
    if (approval.artApproved === true) add("species.approval.artApproved", "DRAFT/REVIEW/REJECTED cannot be artApproved");
    if (approval.approvedBy || approval.approvedAt || approval.evidence || approval.score !== null) add("species.approval", "non-approved species must not carry approval data");
  }

  if (archetype) {
    for (const err of checkMeasurements(archetype, species.measurements)) errors.push(err);
    for (const trait of archetype.identity.requiredTraits) {
      if (!species.identity.immutableTraits.includes(trait)) add("species.identity.immutableTraits", `missing required identity trait ${trait}`, "SPECIES_IDENTITY");
    }
  }

  if (artBible) {
    if (!artBible.palettes?.[species.visualParams.paletteId]) add("species.visualParams.paletteId", `unknown palette ${species.visualParams.paletteId}`, "SPECIES_PALETTE");
    for (const material of species.visualParams.materialIds) {
      if (!artBible.materials?.[material]) add("species.visualParams.materialIds", `unknown material ${material}`, "SPECIES_MATERIAL");
    }
  }
  if (species.visualParams.crestCount !== species.measurements.crestMainCount) add("species.visualParams.crestCount", "crestCount must equal measurements.crestMainCount", "SPECIES_CREST");

  if (!species.provenance.origin || !species.provenance.license) add("species.provenance", "origin and license are required", "SPECIES_PROVENANCE");
  if (["UNKNOWN", "TBD", ""].includes(String(species.provenance.license).toUpperCase())) add("species.provenance.license", "license must be documented", "SPECIES_LICENSE");
  for (const file of species.provenance.sourceFiles || []) {
    if (root) {
      try {
        readFileSync(join(root, file));
      } catch {
        add("species.provenance.sourceFiles", `missing source file ${file}`, "SPECIES_SOURCE_MISSING");
      }
    }
  }

  if (root && species.assets.model) {
    try {
      readFileSync(join(root, species.assets.model));
    } catch {
      add("species.assets.model", `missing model file ${species.assets.model}`, "SPECIES_MODEL_MISSING");
    }
  }
  for (const texture of species.assets.textures || []) {
    if (root) {
      try {
        readFileSync(join(root, texture));
      } catch {
        add("species.assets.textures", `missing texture ${texture}`, "SPECIES_TEXTURE_MISSING");
      }
    }
  }
  return errors;
}

export function canPublish(species, validation, { root } = {}) {
  const reasons = [];
  if (!validation || !validation.ok) reasons.push("validation has errors");
  if (species.status !== "APPROVED") reasons.push(`status is ${species.status}, not APPROVED`);
  if (species.approval?.artApproved !== true) reasons.push("artApproved is false");
  if (!species.approval?.approvedBy) reasons.push("missing human approver");
  if (!species.approval?.approvedAt) reasons.push("missing approval date");
  if (!species.approval?.evidence) reasons.push("missing approval evidence");
  if (!species.assets?.model) reasons.push("no model asset to publish");
  if (root && species.assets?.model) {
    try {
      readFileSync(join(root, species.assets.model));
    } catch {
      reasons.push("model file is missing on disk");
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
