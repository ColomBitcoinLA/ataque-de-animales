"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const forge = require("../../forge/index.cjs");
const domain = require("../../js/domain/index.cjs");

const ROOT = path.resolve(__dirname, "../..");

test("schema: required, enum, pattern and additionalProperties", () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["id", "status"],
    properties: {
      id: { type: "string", pattern: "^[a-z]+$" },
      status: { enum: ["DRAFT", "APPROVED"] },
    },
  };
  assert.deepEqual(forge.validateSchema({ id: "abc", status: "DRAFT" }, schema), []);
  assert.equal(forge.validateSchema({ id: "ABC", status: "DRAFT" }, schema).length, 1);
  assert.equal(forge.validateSchema({ id: "abc", status: "NOPE" }, schema).length, 1);
  assert.equal(forge.validateSchema({ id: "abc", status: "DRAFT", extra: 1 }, schema).length, 1);
});

test("ids: accepts stable ids and rejects malformed ones", () => {
  assert.equal(forge.isValidId("salamander.v3"), true);
  assert.equal(forge.isValidId("cali.lamp.poste-01"), true);
  assert.equal(forge.isValidId("Salamander V3"), false);
  assert.equal(forge.isValidId("salamander..v3"), false);
});

test("hash: stableStringify is key-order independent and deterministic", () => {
  const a = forge.hashObject({ b: 2, a: 1 });
  const b = forge.hashObject({ a: 1, b: 2 });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("art bible and quadruped archetype load with valid measurements", () => {
  const artBible = forge.loadArtBible(path.join(ROOT, "forge/data/art-bible.json"));
  assert.equal(artBible.ok, true, JSON.stringify(artBible.errors));
  const archetypes = forge.loadArchetypes(path.join(ROOT, "forge/data/archetypes"));
  assert.equal(archetypes.errors.length, 0);
  const quadruped = archetypes.archetypes.get("quadruped");
  assert.ok(quadruped);
  const measurements = {
    heightM: 1.0,
    shoulderHeightM: 0.55,
    lengthM: 1.845,
    bodyWidthM: 0.64,
    eyeDiameterM: 0.09,
    eyeGapM: 0.08,
    tailOffsetM: 0.12,
    crestMainCount: 5,
    toesPerPaw: { "front.L": 4, "front.R": 4, "hind.L": 4, "hind.R": 4 },
    feetY: 0,
    up: "+Y",
    forward: "+Z",
  };
  assert.deepEqual(forge.checkMeasurements(quadruped, measurements), []);
  assert.ok(forge.checkMeasurements(quadruped, { ...measurements, heightM: 1.1 }).some((e) => e.code === "MEASUREMENT_RANGE"));
  assert.ok(forge.checkMeasurements(quadruped, { ...measurements, feetY: 0.1 }).some((e) => e.code === "MEASUREMENT_RANGE"));
});

test("validation pipeline is green and reports expected counts", () => {
  const result = forge.runValidation({ root: ROOT });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.counts.archetypes, 1);
  assert.equal(result.counts.species, 2);
  assert.equal(result.counts.variants, 2);
  assert.equal(result.counts.evolutions, 1);
  assert.equal(result.counts.worldAssets, 4);
});

test("domain contracts are intact and AF does not mutate the registry", () => {
  const before = domain.getDefaultSpeciesDefinitions().list.map((s) => s.speciesId).sort();
  assert.deepEqual(before, ["neptuno", "salamander", "tierrudo"]);

  const spec = new domain.SpeciesDefinition({
    speciesId: "salamander",
    displayName: "Salamander",
    affinity: "FUEGO",
    baseStats: { health: 3 },
  });
  assert.ok(Object.isFrozen(spec));
  assert.equal(spec.affinity, "FUEGO");

  const individual = new domain.CreatureIndividual({
    entityId: "af-test-1",
    speciesId: "salamander",
    identity: { speciesDisplayName: "Salamander", name: "Test" },
    stats: { baseHealth: 3 },
  });
  assert.equal(individual.speciesId, "salamander");
  assert.equal(individual.stats.currentHealth, 3);
  assert.throws(() => { individual.entityId = "other"; }, /read only|Cannot assign/i);

  const after = domain.getDefaultSpeciesDefinitions().list.map((s) => s.speciesId).sort();
  assert.deepEqual(after, before);
});

test("publish gate: a DRAFT species is never publishable even when all measurements pass", () => {
  const result = forge.runValidation({ root: ROOT });
  const species = result.data.species.get("salamander.v3");
  const publish = forge.canPublish(species, result, { root: ROOT });
  assert.equal(publish.allowed, false);
  assert.ok(publish.reasons.some((reason) => reason.includes("DRAFT")));
});

test("publish gate: APPROVED without human evidence is rejected by validation", () => {
  const result = forge.runValidation({ root: ROOT });
  const species = result.data.species.get("salamander.v3");
  const forged = {
    ...species,
    status: "APPROVED",
    approval: { artApproved: true, approvedBy: null, approvedAt: null, evidence: null, score: null },
  };
  const errors = forge.validateSpeciesVisual(forged, {
    archetypes: result.data.archetypes,
    artBible: result.data.artBible.data,
    domainSpeciesIds: ["salamander"],
    root: ROOT,
  });
  assert.ok(errors.some((e) => e.code === "SPECIES" && e.path.includes("approvedBy")));
  assert.ok(errors.some((e) => e.code === "SPECIES" && e.path.includes("evidence")));
  const publish = forge.canPublish(forged, { ok: true, errors: [] }, { root: ROOT });
  assert.equal(publish.allowed, false);
});
