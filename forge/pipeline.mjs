import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadArtBible } from "./art-bible.mjs";
import { loadArchetypes, validateArchetype } from "./archetypes.mjs";
import { loadSpeciesVisuals, validateSpeciesVisual, validateApprovalLock } from "./species-registry.mjs";
import { loadVariants, validateVariant } from "./variants.mjs";
import { loadEvolutions, validateEvolutions } from "./evolutions.mjs";
import { loadWorldAssets, validateWorldAsset, verifyAssetFiles } from "./world-registry.mjs";
import { loadDomainSpeciesIds } from "./domain-link.mjs";
import { importH3CSalamander } from "./adapters/h3cSalamander.mjs";
import { sha256File } from "./core/hash.mjs";

export const FORGE_ROOT = fileURLToPath(new URL(".", import.meta.url));

export function loadForgeData(root = process.cwd(), forgeRoot = FORGE_ROOT) {
  const artBible = loadArtBible(join(forgeRoot, "data/art-bible.json"));
  const archetypes = loadArchetypes(join(forgeRoot, "data/archetypes"));
  const species = loadSpeciesVisuals(join(forgeRoot, "data/species"));
  const variants = loadVariants(join(forgeRoot, "data/variants"));
  const evolutions = loadEvolutions(join(forgeRoot, "data/evolutions"));
  const world = loadWorldAssets(join(forgeRoot, "data/world"));
  return { artBible, archetypes, species, variants, evolutions, world, root, forgeRoot };
}

export function runValidation({ root = process.cwd(), forgeRoot = FORGE_ROOT } = {}) {
  const data = loadForgeData(root, forgeRoot);
  const errors = [
    ...data.artBible.errors,
    ...data.archetypes.errors,
    ...data.species.errors,
    ...data.variants.errors,
    ...data.evolutions.errors,
    ...data.world.errors,
  ];
  const warnings = [];

  const artBible = data.artBible.data;
  const archetypeMap = data.archetypes.archetypes;
  const speciesList = data.species.species.map(({ __file, ...s }) => s);
  const variantList = data.variants.variants.map(({ __file, ...v }) => v);
  const evolutionList = data.evolutions.evolutions.map(({ __file, ...e }) => e);
  const worldList = data.world.assets.map(({ __file, ...a }) => a);

  for (const archetype of archetypeMap.values()) errors.push(...validateArchetype(archetype, artBible));

  const speciesById = new Map();
  for (const species of speciesList) {
    if (speciesById.has(species.visualId)) errors.push({ code: "SPECIES_DUPLICATE", path: `species.${species.visualId}`, message: "duplicate visualId" });
    speciesById.set(species.visualId, species);
  }

  const domainSpeciesIds = loadDomainSpeciesIds();
  for (const species of speciesList) {
    errors.push(...validateSpeciesVisual(species, { archetypes: archetypeMap, artBible, domainSpeciesIds, root }));
  }

  let approvalLock = { approved: {} };
  try {
    approvalLock = JSON.parse(readFileSync(join(forgeRoot, "data/approval-lock.json"), "utf8"));
  } catch {
    errors.push({ code: "APPROVAL_LOCK_MISSING", path: "forge/data/approval-lock.json", message: "approval lock is missing or invalid" });
  }
  for (const species of speciesList) errors.push(...validateApprovalLock(species, approvalLock));

  const variantsById = new Map(variantList.map((v) => [v.variantId, v]));
  for (const variant of variantList) {
    const species = speciesById.get(variant.speciesVisualId);
    const archetype = species && archetypeMap.get(species.archetypeId);
    errors.push(...validateVariant(variant, { species, archetype, variantsById }));
  }

  errors.push(...validateEvolutions(evolutionList, { speciesById, archetypes: archetypeMap }));

  for (const asset of worldList) errors.push(...validateWorldAsset(asset, { artBible }));
  errors.push(...verifyAssetFiles(worldList, root));

  // Single-source check: any species snapshot must match its adapter output exactly.
  for (const species of speciesList) {
    if (species.measurementsSource?.adapter !== "h3c-salamander") continue;
    const imported = importH3CSalamander({ dir: join(forgeRoot, "fixtures/h3c") });
    for (const discrepancy of imported.discrepancies) {
      errors.push({ code: `ADAPTER_${discrepancy.code}`, path: `species.${species.visualId}`, message: `${discrepancy.field}: ${discrepancy.message}` });
    }
    if (species.measurementsSource.sourceHash !== imported.sourceHash) {
      errors.push({ code: "SNAPSHOT_HASH", path: `species.${species.visualId}`, message: "measurementsSource.sourceHash does not match the adapter" });
    }
    for (const [key, value] of Object.entries(imported.measurements)) {
      if (JSON.stringify(species.measurements[key]) !== JSON.stringify(value)) {
        errors.push({ code: "SNAPSHOT_STALE", path: `species.${species.visualId}.measurements.${key}`, message: `snapshot ${JSON.stringify(species.measurements[key])} != adapter ${JSON.stringify(value)}` });
      }
    }
  }

  const fixtureManifest = join(forgeRoot, "data/asset-manifest.json");
  try {
    const manifest = JSON.parse(readFileSync(fixtureManifest, "utf8"));
    for (const entry of manifest.files || []) {
      const actual = sha256File(join(root, entry.path));
      if (actual !== entry.sha256) errors.push({ code: "HASH_MISMATCH", path: entry.path, message: `expected ${entry.sha256}, got ${actual}` });
    }
  } catch {
    errors.push({ code: "MANIFEST_MISSING", path: "forge/data/asset-manifest.json", message: "asset manifest is missing or invalid" });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      archetypes: archetypeMap.size,
      species: speciesList.length,
      variants: variantList.length,
      evolutions: evolutionList.length,
      worldAssets: worldList.length,
    },
    data: { artBible, archetypes: archetypeMap, species: speciesById, variants: variantsById, evolutions: evolutionList, world: worldList },
  };
}

export function verifyAssets({ root = process.cwd(), forgeRoot = FORGE_ROOT } = {}) {
  const data = loadForgeData(root, forgeRoot);
  const errors = [...verifyAssetFiles(data.world.assets, root)];
  for (const species of data.species.species) {
    for (const file of species.provenance?.sourceFiles || []) {
      try {
        readFileSync(join(root, file));
      } catch {
        errors.push({ code: "SOURCE_MISSING", path: `species.${species.visualId}`, message: `missing ${file}` });
      }
    }
    if (species.assets?.model) {
      try {
        readFileSync(join(root, species.assets.model));
      } catch {
        errors.push({ code: "MODEL_MISSING", path: `species.${species.visualId}`, message: `missing ${species.assets.model}` });
      }
    }
  }
  return { ok: errors.length === 0, errors, checked: data.world.assets.length + data.species.species.length };
}
