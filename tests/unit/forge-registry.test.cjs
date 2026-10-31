"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const forge = require("../../forge/index.cjs");

const ROOT = path.resolve(__dirname, "../..");

function loadContext() {
  const result = forge.runValidation({ root: ROOT });
  const species = result.data.species.get("salamander.v3");
  const archetype = result.data.archetypes.get(species.archetypeId);
  return { result, species, archetype };
}

test("variant: accepts a cosmetic override allowed by the archetype", () => {
  const { species, archetype } = loadContext();
  const variant = {
    variantId: "salamander.v3.test",
    speciesVisualId: species.visualId,
    kind: "COSMETIC",
    status: "DRAFT",
    overrides: { "palette.id": "ash", "fire.intensity": 0.5 },
    preservedTraits: [...archetype.identity.requiredTraits],
    parentVariantId: null,
    provenance: { origin: "test", license: "ISC" },
  };
  assert.deepEqual(forge.validateVariant(variant, { species, archetype }), []);
});

test("variant: rejects an override of an immutable identity trait", () => {
  const { species, archetype } = loadContext();
  const variant = {
    variantId: "salamander.v3.bad",
    speciesVisualId: species.visualId,
    kind: "COSMETIC",
    status: "DRAFT",
    overrides: { "face.eye.integrated": false },
    preservedTraits: [...archetype.identity.requiredTraits],
    parentVariantId: null,
    provenance: { origin: "test", license: "ISC" },
  };
  const errors = forge.validateVariant(variant, { species, archetype });
  assert.ok(errors.some((e) => e.code === "VARIANT_PARAM_FORBIDDEN" || e.code === "VARIANT_IDENTITY"));
});

test("variant: rejects a variant that does not preserve required traits", () => {
  const { species, archetype } = loadContext();
  const variant = {
    variantId: "salamander.v3.bad2",
    speciesVisualId: species.visualId,
    kind: "COSMETIC",
    status: "DRAFT",
    overrides: {},
    preservedTraits: ["silhouette.quadruped"],
    parentVariantId: null,
    provenance: { origin: "test", license: "ISC" },
  };
  const errors = forge.validateVariant(variant, { species, archetype });
  assert.ok(errors.some((e) => e.code === "VARIANT_PRESERVE"));
});

test("evolution: rejects a cyclic lineage", () => {
  const { result } = loadContext();
  const speciesById = result.data.species;
  const archetypes = result.data.archetypes;
  const base = {
    schemaVersion: "1.0.0",
    stage: 2,
    preservedTraits: ["silhouette.quadruped", "face.eye.integrated", "crest.family.volcanic", "tail.s-curve", "proportions.height"],
    allowedMorphs: [],
    status: "DRAFT",
    provenance: { origin: "test", license: "ISC" },
  };
  const cyclic = [
    { ...base, evolutionId: "a.to.b", fromVisualId: "salamander.v3", toVisualId: "salamander.v3.stage2" },
    { ...base, evolutionId: "b.to.a", fromVisualId: "salamander.v3.stage2", toVisualId: "salamander.v3" },
  ];
  const errors = forge.validateEvolutions(cyclic, { speciesById, archetypes });
  assert.ok(errors.some((e) => e.code === "EVOLUTION_CYCLE"));
});

test("evolution: rejects a link that drops a required identity trait", () => {
  const { result } = loadContext();
  const edge = {
    schemaVersion: "1.0.0",
    evolutionId: "salamander.v3.to.stage2",
    fromVisualId: "salamander.v3",
    toVisualId: "salamander.v3.stage2",
    stage: 2,
    preservedTraits: ["silhouette.quadruped"],
    allowedMorphs: [],
    status: "DRAFT",
    provenance: { origin: "test", license: "ISC" },
  };
  const errors = forge.validateEvolutions([edge], { speciesById: result.data.species, archetypes: result.data.archetypes });
  assert.ok(errors.some((e) => e.code === "EVOLUTION_PRESERVE"));
});

test("world asset: rejects non-descending LODs and unknown materials", () => {
  const artBible = forge.loadArtBible(path.join(ROOT, "forge/data/art-bible.json")).data;
  const asset = {
    schemaVersion: "1.0.0",
    assetId: "cali.test.bad",
    category: "rock",
    dimensions: { x: 1, y: 1, z: 1 },
    pivot: "base",
    collision: { type: "box", size: [1, 1, 1] },
    materials: ["nope"],
    lods: [
      { level: 0, triangles: 100 },
      { level: 1, triangles: 200 },
    ],
    provenance: { origin: "test", license: "ISC" },
  };
  const errors = forge.validateWorldAsset(asset, { artBible });
  assert.ok(errors.some((e) => e.code === "WORLD_MATERIAL"));
  assert.ok(errors.some((e) => e.code === "WORLD_LOD_ORDER"));
});

test("adapter: detects a 1.865 vs 1.845 measurement drift", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "af-h3c-"));
  try {
    for (const file of ["MASTER_ANATOMY.json", "MASTER_CREST_MAP.json", "MASTER_MEASUREMENTS.json"]) {
      fs.copyFileSync(path.join(ROOT, "forge/fixtures/h3c", file), path.join(temp, file));
    }
    const measurementsFile = path.join(temp, "MASTER_MEASUREMENTS.json");
    const measurements = JSON.parse(fs.readFileSync(measurementsFile, "utf8"));
    measurements.length_m = 1.865;
    fs.writeFileSync(measurementsFile, JSON.stringify(measurements, null, 2));
    const imported = forge.importH3CSalamander({ dir: temp });
    assert.equal(imported.ok, false);
    assert.ok(imported.discrepancies.some((d) => d.code === "SNAPSHOT_DRIFT" && d.field === "lengthM"));
    assert.equal(imported.measurements.lengthM, 1.845);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("adapter: source hash is deterministic and matches the species snapshot", () => {
  const a = forge.importH3CSalamander();
  const b = forge.importH3CSalamander();
  assert.equal(a.sourceHash, b.sourceHash);
  const result = forge.runValidation({ root: ROOT });
  const species = result.data.species.get("salamander.v3");
  assert.equal(species.measurementsSource.sourceHash, a.sourceHash);
  assert.equal(species.measurements.lengthM, a.measurements.lengthM);
});
