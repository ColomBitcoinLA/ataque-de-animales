"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SpeciesDefinition,
  CreatureIndividual,
  Identity,
  Stats,
  Traits,
  Temperament,
  Progression,
  Position,
  VALID_AFFINITIES,
  LIFECYCLE_STATES,
  DEFAULT_TEMPERAMENTS,
  LEGACY_ABILITY_ELEMENTS,
  neptunoSpecies,
  tierrudoSpecies,
  salamanderSpecies,
  getDefaultSpeciesDefinitions,
} = require("../../js/domain/index.cjs");

// ============================================================================
// 1. SpeciesDefinition Contract Tests (M1.2)
// ============================================================================

test("SpeciesDefinition: creates a valid species definition with frozen invariants", () => {
  const spec = new SpeciesDefinition({
    speciesId: "neptuno",
    displayName: "Neptuno",
    category: "PET",
    affinity: "AGUA",
    baseStats: { health: 3 },
    abilities: [
      { id: "botonAgua", element: "AGUA" },
      { id: "botonTierra", element: "TIERRA" },
    ],
    movementProfile: { baseSpeed: 180 },
  });

  assert.equal(spec.speciesId, "neptuno");
  assert.equal(spec.displayName, "Neptuno");
  assert.equal(spec.category, "PET");
  assert.equal(spec.affinity, "AGUA");
  assert.equal(spec.baseStats.health, 3);
  assert.equal(spec.movementProfile.baseSpeed, 180);
  assert.equal(spec.abilities.length, 2);
  assert.equal(spec.abilities[0].id, "botonAgua");

  // Inmutabilidad verificada
  assert.ok(Object.isFrozen(spec));
  assert.ok(Object.isFrozen(spec.baseStats));
  assert.ok(Object.isFrozen(spec.abilities));
  assert.ok(Object.isFrozen(spec.abilities[0]));
  assert.ok(Object.isFrozen(spec.movementProfile));
});

test("SpeciesDefinition: rejects invalid speciesId", () => {
  assert.throws(() => new SpeciesDefinition({ speciesId: "", displayName: "Test", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "   ", displayName: "Test", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: null, displayName: "Test", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: 123, displayName: "Test", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
});

test("SpeciesDefinition: rejects invalid displayName", () => {
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "   ", affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: null, affinity: "AGUA", baseStats: { health: 3 } }), TypeError);
});

test("SpeciesDefinition: rejects invalid baseStats and health", () => {
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA" }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: {} }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: { health: 0 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: { health: -5 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: { health: NaN } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: { health: Infinity } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "AGUA", baseStats: { health: "3" } }), TypeError);
});

test("SpeciesDefinition: rejects invalid affinity", () => {
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "SOMBRA", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: "", baseStats: { health: 3 } }), TypeError);
  assert.throws(() => new SpeciesDefinition({ speciesId: "test", displayName: "Test", affinity: null, baseStats: { health: 3 } }), TypeError);
});

test("SpeciesDefinition: protects caller input from mutation", () => {
  const callerStats = { health: 3 };
  const callerAbilities = [{ id: "atk1", name: "Golpe" }];
  const callerMovement = { baseSpeed: 180 };

  const spec = new SpeciesDefinition({
    speciesId: "shield-test",
    displayName: "Shield",
    affinity: "TIERRA",
    baseStats: callerStats,
    abilities: callerAbilities,
    movementProfile: callerMovement,
  });

  // El llamador intenta mutar sus objetos originales posteriormente
  callerStats.health = 999;
  callerAbilities.push({ id: "atk2", name: "Invasión" });
  callerAbilities[0].name = "Mutado";
  callerMovement.baseSpeed = 999;

  assert.equal(spec.baseStats.health, 3, "baseStats.health no debe ser alterado por mutación externa");
  assert.equal(spec.abilities.length, 1, "abilities no debe recibir nuevos elementos de callerAbilities");
  assert.equal(spec.abilities[0].name, "Golpe", "nombre de habilidad interna no debe mutar");
  assert.equal(spec.movementProfile.baseSpeed, 180, "baseSpeed no debe ser alterado por mutación externa");
});

test("SpeciesDefinition: deep immutability protects nested configuration", () => {
  const deepMovement = { baseSpeed: 180, details: { friction: 0.9, bounds: [0, 100] } };
  const deepSenses = { vision: { range: 100, fov: 180 } };
  const deepBehavior = { aggression: { base: 0.5, triggers: ["enemy_seen"] } };

  const spec = new SpeciesDefinition({
    speciesId: "deep-test",
    displayName: "Deep Test",
    affinity: "AGUA",
    baseStats: { health: 3 },
    movementProfile: deepMovement,
    sensesProfile: deepSenses,
    behaviorProfile: deepBehavior,
  });

  // Mutación externa posterior no afecta la definición
  deepMovement.details.friction = 0.1;
  deepMovement.details.bounds.push(200);
  deepSenses.vision.range = 999;
  deepBehavior.aggression.triggers.push("noise");

  assert.equal(spec.movementProfile.details.friction, 0.9);
  assert.equal(spec.movementProfile.details.bounds.length, 2);
  assert.equal(spec.sensesProfile.vision.range, 100);
  assert.equal(spec.behaviorProfile.aggression.triggers.length, 1);

  // Todo objeto anidado está congelado
  assert.ok(Object.isFrozen(spec.movementProfile.details));
  assert.ok(Object.isFrozen(spec.movementProfile.details.bounds));
  assert.ok(Object.isFrozen(spec.sensesProfile.vision));
  assert.ok(Object.isFrozen(spec.behaviorProfile.aggression));
  assert.ok(Object.isFrozen(spec.behaviorProfile.aggression.triggers));
});

test("SpeciesDefinition: normalizes string abilities and object abilities correctly", () => {
  const spec = new SpeciesDefinition({
    speciesId: "norm-test",
    displayName: "Norm",
    affinity: "FUEGO",
    baseStats: { health: 5 },
    abilities: ["botonFuego", { id: "botonFuego", power: 25 }],
  });

  assert.equal(spec.abilities[0].id, "botonFuego");
  assert.equal("name" in spec.abilities[0], false, "No se debe fabricar un nombre de presentación");
  assert.equal(spec.abilities[0].element, "FUEGO");

  assert.equal(spec.abilities[1].id, "botonFuego");
  assert.equal("name" in spec.abilities[1], false, "No se debe fabricar un nombre de presentación");
  assert.equal(spec.abilities[1].power, 25);
  assert.equal(spec.abilities[1].element, "FUEGO");
});

test("SpeciesDefinition (H-2 Regression): botonTierra on AGUA species is TIERRA, not AGUA", () => {
  const spec = new SpeciesDefinition({
    speciesId: "neptuno",
    displayName: "Neptuno",
    affinity: "AGUA",
    baseStats: { health: 3 },
    abilities: [{ id: "botonTierra" }],
  });

  assert.equal(spec.abilities[0].element, "TIERRA");
  assert.notEqual(spec.abilities[0].element, "AGUA");
});

test("SpeciesDefinition (H-2 Regression): unknown ability ID does not inherit species affinity", () => {
  const spec = new SpeciesDefinition({
    speciesId: "neptuno",
    displayName: "Neptuno",
    affinity: "AGUA",
    baseStats: { health: 3 },
    abilities: [{ id: "habilidadDesconocida" }],
  });

  assert.equal(spec.abilities[0].element, null);
  assert.notEqual(spec.abilities[0].element, "AGUA");
});

test("SpeciesDefinition: rejects malformed ability descriptors and invalid explicit elements", () => {
  const base = {
    speciesId: "ability-validation",
    displayName: "Ability Validation",
    affinity: "AGUA",
    baseStats: { health: 3 },
  };

  assert.throws(() => new SpeciesDefinition({ ...base, abilities: "botonAgua" }), TypeError);
  assert.throws(() => new SpeciesDefinition({ ...base, abilities: ["   "] }), TypeError);
  assert.throws(() => new SpeciesDefinition({ ...base, abilities: [{}] }), TypeError);
  assert.throws(() => new SpeciesDefinition({ ...base, abilities: [{ id: "atk", element: "SOMBRA" }] }), RangeError);
});

test("SpeciesDefinition: rejects invalid explicit movement profiles instead of silently defaulting", () => {
  const base = {
    speciesId: "movement-validation",
    displayName: "Movement Validation",
    affinity: "TIERRA",
    baseStats: { health: 3 },
  };

  assert.throws(() => new SpeciesDefinition({ ...base, movementProfile: "fast" }), TypeError);
  assert.throws(() => new SpeciesDefinition({ ...base, movementProfile: { baseSpeed: 0 } }), RangeError);
  assert.throws(() => new SpeciesDefinition({ ...base, movementProfile: { baseSpeed: NaN } }), RangeError);
});

test("SpeciesDefinition: canonical default species match legacy gameplay facts without invented names", () => {
  const defaults = getDefaultSpeciesDefinitions();
  assert.equal(defaults.list.length, 3);

  // Neptuno
  assert.equal(neptunoSpecies.speciesId, "neptuno");
  assert.equal(neptunoSpecies.displayName, "Neptuno");
  assert.equal(neptunoSpecies.affinity, "AGUA");
  assert.equal(neptunoSpecies.baseStats.health, 3);
  assert.equal(neptunoSpecies.movementProfile.baseSpeed, 180);
  assert.equal(neptunoSpecies.abilities.length, 5);
  // Canonical abilities have legacy IDs and resolved elements, not invented display names
  assert.equal(neptunoSpecies.abilities[0].id, "botonAgua");
  assert.equal(neptunoSpecies.abilities[0].element, "AGUA");
  assert.equal(neptunoSpecies.abilities[3].id, "botonTierra");
  assert.equal(neptunoSpecies.abilities[3].element, "TIERRA");
  assert.equal(neptunoSpecies.abilities[4].id, "botonFuego");
  assert.equal(neptunoSpecies.abilities[4].element, "FUEGO");

  // Tierrudo
  assert.equal(tierrudoSpecies.speciesId, "tierrudo");
  assert.equal(tierrudoSpecies.displayName, "Tierrudo");
  assert.equal(tierrudoSpecies.affinity, "TIERRA");
  assert.equal(tierrudoSpecies.baseStats.health, 3);
  assert.equal(tierrudoSpecies.movementProfile.baseSpeed, 180);
  assert.equal(tierrudoSpecies.abilities.length, 5);
  assert.equal(tierrudoSpecies.abilities[0].id, "botonTierra");
  assert.equal(tierrudoSpecies.abilities[0].element, "TIERRA");
  assert.equal(tierrudoSpecies.abilities[3].id, "botonAgua");
  assert.equal(tierrudoSpecies.abilities[3].element, "AGUA");
  assert.equal(tierrudoSpecies.abilities[4].id, "botonFuego");
  assert.equal(tierrudoSpecies.abilities[4].element, "FUEGO");

  // Salamander
  assert.equal(salamanderSpecies.speciesId, "salamander");
  assert.equal(salamanderSpecies.displayName, "Salamander");
  assert.equal(salamanderSpecies.affinity, "FUEGO");
  assert.equal(salamanderSpecies.baseStats.health, 3);
  assert.equal(salamanderSpecies.movementProfile.baseSpeed, 180);
  assert.equal(salamanderSpecies.abilities.length, 5);
  assert.equal(salamanderSpecies.abilities[0].id, "botonFuego");
  assert.equal(salamanderSpecies.abilities[0].element, "FUEGO");
  assert.equal(salamanderSpecies.abilities[3].id, "botonTierra");
  assert.equal(salamanderSpecies.abilities[3].element, "TIERRA");
  assert.equal(salamanderSpecies.abilities[4].id, "botonAgua");
  assert.equal(salamanderSpecies.abilities[4].element, "AGUA");
});

// ============================================================================
// 2. Value Objects Contract Tests (M1.4)
// ============================================================================

test("Identity: distinguishes speciesDisplayName from individual nickname", () => {
  const defaultIdent = new Identity({ speciesDisplayName: "Neptuno" });
  assert.equal(defaultIdent.speciesDisplayName, "Neptuno");
  assert.equal(defaultIdent.name, "Neptuno");
  assert.equal(defaultIdent.isCustomName, false);
  assert.ok(Object.isFrozen(defaultIdent));

  const customIdent = new Identity({ speciesDisplayName: "Neptuno", name: "Tritón" });
  assert.equal(customIdent.speciesDisplayName, "Neptuno");
  assert.equal(customIdent.name, "Tritón");
  assert.equal(customIdent.isCustomName, true);
});

test("Identity: rejects invalid inputs without speciesDisplayName", () => {
  assert.throws(() => new Identity({ speciesDisplayName: "", name: "" }), TypeError);
  assert.throws(() => new Identity({ name: "Tritón" }), TypeError);
  assert.throws(() => new Identity({}), TypeError);
  assert.throws(() => new Identity({ speciesDisplayName: "Neptuno", name: "" }), TypeError);
  assert.throws(() => new Identity({ speciesDisplayName: "Neptuno", name: 123 }), TypeError);
});

test("Stats: manages base, max and mutable current health with boundaries", () => {
  const s = new Stats({ baseHealth: 3 });
  assert.equal(s.base.health, 3);
  assert.equal(s.max.health, 3);
  assert.equal(s.current.health, 3);
  assert.equal(s.currentHealth, 3);
  assert.equal(s.isFainted, false);

  // Daño
  s.takeDamage(1);
  assert.equal(s.current.health, 2);
  assert.equal(s.base.health, 3, "baseHealth no debe ser modificado por daño");

  // Daño excesivo (clamping a 0)
  s.takeDamage(10);
  assert.equal(s.current.health, 0);
  assert.equal(s.isFainted, true);

  // Curación con límite en max.health
  s.heal(2);
  assert.equal(s.current.health, 2);
  assert.equal(s.isFainted, false);

  s.heal(100);
  assert.equal(s.current.health, 3);
});

test("Stats: encapsulation prevents external mutation of current health", () => {
  const s = new Stats({ baseHealth: 3 });
  assert.equal(s.current.health, 3);

  // Intentar mutar s.current.health directamente no altera el estado interno
  // En strict mode esto arroja TypeError porque s.current está congelado
  assert.throws(() => {
    s.current.health = 999;
  }, TypeError);
  assert.equal(s.current.health, 3);

  // Intentar asignar a s.current arroja TypeError (getter sin setter)
  assert.throws(() => {
    s.current = { health: 999 };
  }, TypeError);
  assert.equal(s.current.health, 3);
});

test("Stats: rejects invalid baseHealth, maxHealth and currentHealth explicitly", () => {
  // baseHealth
  assert.throws(() => new Stats({ baseHealth: 0 }), RangeError);
  assert.throws(() => new Stats({ baseHealth: -3 }), RangeError);
  assert.throws(() => new Stats({ baseHealth: NaN }), RangeError);
  assert.throws(() => new Stats({ baseHealth: Infinity }), RangeError);
  assert.throws(() => new Stats({ baseHealth: "3" }), TypeError);
  assert.throws(() => new Stats({}), TypeError);

  // maxHealth
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: 0 }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: -5 }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: NaN }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: Infinity }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: "10" }), TypeError);

  // currentHealth
  assert.throws(() => new Stats({ baseHealth: 3, currentHealth: -1 }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, currentHealth: NaN }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, currentHealth: Infinity }), RangeError);
  assert.throws(() => new Stats({ baseHealth: 3, currentHealth: "2" }), TypeError);
  // currentHealth > maxHealth
  assert.throws(() => new Stats({ baseHealth: 3, maxHealth: 3, currentHealth: 5 }), RangeError);
});

test("Traits: maintains an isolated set of traits with clone", () => {
  const t = new Traits(["agil", "resistente"]);
  assert.equal(t.size, 2);
  assert.ok(t.has("agil"));
  assert.ok(t.has("resistente"));
  assert.ok(!t.has("feroz"));

  t.add("feroz");
  assert.ok(t.has("feroz"));
  assert.equal(t.size, 3);

  t.remove("agil");
  assert.ok(!t.has("agil"));
  assert.equal(t.size, 2);

  const cloned = t.clone();
  cloned.add("nuevo");
  assert.ok(cloned.has("nuevo"));
  assert.ok(!t.has("nuevo"), "Modificar el clon no altera el original");
});

test("Temperament: normalizes valid disposition and rejects invalid ones explicitly", () => {
  const d1 = new Temperament("AGRESIVO");
  assert.equal(d1.disposition, "AGRESIVO");

  const dDefault = new Temperament();
  assert.equal(dDefault.disposition, "DOCIL");
  assert.ok(Object.isFrozen(dDefault));

  // Rechazo explícito de valores no válidos (sin convertir silenciosamente a DOCIL)
  assert.throws(() => new Temperament("invalid"), RangeError);
  assert.throws(() => new Temperament("AGRESIV"), RangeError);
  assert.throws(() => new Temperament(123), TypeError);
});

test("Progression: tracks level and XP with validation", () => {
  const p = new Progression({ level: 1, xp: 0 });
  assert.equal(p.level, 1);
  assert.equal(p.xp, 0);

  p.addXp(120);
  assert.equal(p.xp, 120);

  assert.throws(() => p.addXp(-10), TypeError);
  assert.throws(() => new Progression({ level: 0 }), TypeError);
  assert.throws(() => new Progression({ xp: -5 }), TypeError);
  assert.throws(() => new Progression({ level: 1.5 }), TypeError);
  assert.throws(() => new Progression({ xp: 1.5 }), TypeError);
  assert.throws(() => p.addXp(1.5), TypeError);

  assert.throws(() => {
    p.xp = -999;
  }, TypeError);
  assert.throws(() => {
    p.level = 0;
  }, TypeError);

  const pClone = p.clone();
  pClone.addXp(50);
  assert.equal(pClone.xp, 170);
  assert.equal(p.xp, 120, "Modificar el clon no afecta al original");
});

test("Position: tracks 2D coordinates safely with clone", () => {
  const pos = new Position(10, 25);
  assert.equal(pos.x, 10);
  assert.equal(pos.y, 25);

  pos.set(50, 75);
  assert.equal(pos.x, 50);
  assert.equal(pos.y, 75);

  assert.throws(() => pos.set(NaN, 10), TypeError);
  assert.throws(() => new Position("10", 20), TypeError);
  assert.throws(() => {
    pos.x = NaN;
  }, TypeError);
  assert.throws(() => {
    pos.y = Infinity;
  }, TypeError);
  assert.equal(pos.x, 50);
  assert.equal(pos.y, 75);

  const posClone = pos.clone();
  posClone.set(100, 200);
  assert.equal(posClone.x, 100);
  assert.equal(pos.x, 50, "Modificar el clon no afecta al original");
});

// ============================================================================
// 3. CreatureIndividual Contract Tests (M1.3)
// ============================================================================

test("CreatureIndividual: creates an individual via direct constructor", () => {
  const creature = new CreatureIndividual({
    entityId: "creature-001",
    speciesId: "neptuno",
    identity: {
      speciesDisplayName: "Neptuno",
      name: "Neptuno Alfa",
    },
    stats: {
      baseHealth: 3,
    },
    traits: ["fiel", "veloz"],
    temperament: "VALIENTE",
    progression: { level: 1, xp: 10 },
    position: { x: 100, y: 150 },
  });

  assert.equal(creature.entityId, "creature-001");
  assert.equal(creature.speciesId, "neptuno");
  assert.throws(() => {
    creature.entityId = "rewritten";
  }, TypeError);
  assert.throws(() => {
    creature.speciesId = "salamander";
  }, TypeError);
  assert.equal(creature.identity.speciesDisplayName, "Neptuno");
  assert.equal(creature.identity.name, "Neptuno Alfa");
  assert.equal(creature.currentHealth, 3);
  assert.ok(creature.traits.has("fiel"));
  assert.equal(creature.temperament.disposition, "VALIENTE");
  assert.equal(creature.progression.level, 1);
  assert.equal(creature.progression.xp, 10);
  assert.equal(creature.position.x, 100);
  assert.equal(creature.position.y, 150);
  assert.equal(creature.lifecycle, "ACTIVE");

  assert.throws(() => {
    creature.stats = new Stats({ baseHealth: 99 });
  }, TypeError);
  assert.throws(() => {
    creature.position = new Position(999, 999);
  }, TypeError);
  assert.throws(() => {
    creature.lifecycle = "BROKEN";
  }, TypeError);
});

test("CreatureIndividual (H-3 Regression): direct constructor does not infer identity from speciesId", () => {
  // Sin identity explícita, el constructor directo debe fallar
  assert.throws(() => new CreatureIndividual({
    entityId: "creature-fail",
    speciesId: "neptuno",
    stats: { health: 3 },
  }), TypeError);

  // Con objeto identity vacío o sin speciesDisplayName debe fallar
  assert.throws(() => new CreatureIndividual({
    entityId: "creature-fail",
    speciesId: "neptuno",
    identity: {},
    stats: { health: 3 },
  }), TypeError);

  assert.throws(() => new CreatureIndividual({
    entityId: "creature-fail",
    speciesId: "neptuno",
    identity: { name: "SoloApodo" },
    stats: { health: 3 },
  }), TypeError);
});

test("CreatureIndividual (H-3 Regression): fromSpecies uses SpeciesDefinition.displayName and does not infer from speciesId slug", () => {
  const customSpec = new SpeciesDefinition({
    speciesId: "neptuno-slug-xyz",
    displayName: "Neptuno Sagrado",
    affinity: "AGUA",
    baseStats: { health: 3 },
  });

  const creature = CreatureIndividual.fromSpecies(customSpec, {
    entityId: "ind-1",
  });

  assert.equal(creature.identity.speciesDisplayName, "Neptuno Sagrado");
  assert.equal(creature.identity.name, "Neptuno Sagrado");
  assert.notEqual(creature.identity.speciesDisplayName, "neptuno-slug-xyz");
});

test("CreatureIndividual: fromSpecies rejects non-SpeciesDefinition", () => {
  assert.throws(() => CreatureIndividual.fromSpecies(null, { entityId: "c1" }), TypeError);
  assert.throws(() => CreatureIndividual.fromSpecies({}, { entityId: "c1" }), TypeError);
  assert.throws(() => CreatureIndividual.fromSpecies("neptuno", { entityId: "c1" }), TypeError);
});

test("CreatureIndividual: rejects invalid entityId or speciesId", () => {
  const validId = { speciesDisplayName: "Neptuno" };
  assert.throws(() => new CreatureIndividual({ entityId: "", speciesId: "neptuno", identity: validId, stats: { health: 3 } }), TypeError);
  assert.throws(() => new CreatureIndividual({ entityId: "   ", speciesId: "neptuno", identity: validId, stats: { health: 3 } }), TypeError);
  assert.throws(() => new CreatureIndividual({ entityId: null, speciesId: "neptuno", identity: validId, stats: { health: 3 } }), TypeError);
  assert.throws(() => new CreatureIndividual({ entityId: "id1", speciesId: "", identity: validId, stats: { health: 3 } }), TypeError);
  assert.throws(() => new CreatureIndividual({ entityId: "id1", speciesId: null, identity: validId, stats: { health: 3 } }), TypeError);
  assert.throws(() => new CreatureIndividual({ entityId: "id1", speciesId: "neptuno", identity: validId }), TypeError);
});

test("CreatureIndividual: lifecycle transitions on damage and preserves lifecycle on heal", () => {
  const creature = CreatureIndividual.fromSpecies(salamanderSpecies, {
    entityId: "sal-1",
  });

  assert.equal(creature.lifecycle, "ACTIVE");
  assert.equal(creature.isFainted, false);

  creature.takeDamage(2);
  assert.equal(creature.currentHealth, 1);
  assert.equal(creature.lifecycle, "ACTIVE");

  creature.takeDamage(1);
  assert.equal(creature.currentHealth, 0);
  assert.equal(creature.isFainted, true);
  assert.equal(creature.lifecycle, "FAINTED");

  // Curar a una criatura debilitada restaura salud pero PRESERVA el ciclo de vida (no revive automáticamente)
  creature.heal(2);
  assert.equal(creature.currentHealth, 2);
  assert.equal(creature.hasZeroHealth, false);
  assert.equal(creature.isFainted, true, "FAINTED es estado de ciclo de vida, no un alias de health === 0");
  assert.equal(creature.lifecycle, "FAINTED", "heal() no revive automáticamente; preserva el ciclo de vida FAINTED");
});

test("CreatureIndividual: lifecycle transitions are explicit and validated", () => {
  const creature = CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "lifecycle-transition",
  });

  assert.equal(creature.setLifecycle("RESTING"), "RESTING");
  assert.equal(creature.lifecycle, "RESTING");
  assert.throws(() => creature.setLifecycle("UNKNOWN"), RangeError);
  assert.throws(() => creature.setLifecycle(""), TypeError);
});

test("CreatureIndividual: initial current health 0 produces coherent FAINTED lifecycle", () => {
  const creature = CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "fainted-initial",
    currentHealth: 0,
  });

  assert.equal(creature.currentHealth, 0);
  assert.equal(creature.isFainted, true);
  assert.equal(creature.lifecycle, "FAINTED");
});

test("CreatureIndividual: rejects explicit invalid temperament", () => {
  assert.throws(() => CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "temp-test",
    temperament: "AGRESIV",
  }), RangeError);
});

test("CreatureIndividual: rejects invalid owner, position and lifecycle instead of silently coercing them", () => {
  const identity = { speciesDisplayName: "Neptuno" };
  const stats = { health: 3 };

  assert.throws(() => new CreatureIndividual({
    entityId: "bad-owner",
    speciesId: "neptuno",
    identity,
    stats,
    ownerId: 123,
  }), TypeError);

  assert.throws(() => new CreatureIndividual({
    entityId: "bad-position",
    speciesId: "neptuno",
    identity,
    stats,
    position: { x: NaN, y: 0 },
  }), TypeError);

  assert.throws(() => new CreatureIndividual({
    entityId: "bad-lifecycle",
    speciesId: "neptuno",
    identity,
    stats,
    lifecycle: "UNKNOWN",
  }), RangeError);
});

test("CreatureIndividual.fromSpecies: rejects identity metadata that contradicts the authoritative species", () => {
  assert.throws(() => CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "identity-mismatch",
    identity: new Identity({ speciesDisplayName: "Salamander" }),
  }), RangeError);

  assert.throws(() => CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "identity-mismatch-object",
    identity: { speciesDisplayName: "Salamander", name: "Alias" },
  }), RangeError);
});

// ============================================================================
// 4. Regression Tests: Defensive Cloning and Complete Isolation (H-1)
// ============================================================================

test("CreatureIndividual (H-1 Regression): same Stats instance supplied to two creatures does not share health", () => {
  const sharedStats = new Stats({ baseHealth: 5 });

  const c1 = new CreatureIndividual({
    entityId: "c1",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: sharedStats,
  });

  const c2 = new CreatureIndividual({
    entityId: "c2",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: sharedStats,
  });

  assert.notEqual(c1.stats, c2.stats, "Las instancias de stats deben ser distintas");

  c1.takeDamage(3);
  assert.equal(c1.currentHealth, 2, "c1 debe tener salud 2");
  assert.equal(c2.currentHealth, 5, "c2 debe preservar salud intacta en 5");
  assert.equal(sharedStats.current.health, 5, "sharedStats original debe permanecer intacto");
});

test("CreatureIndividual (H-1 Regression): same Traits instance supplied to two creatures does not share traits", () => {
  const sharedTraits = new Traits(["valiente"]);

  const c1 = new CreatureIndividual({
    entityId: "c1",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    traits: sharedTraits,
  });

  const c2 = new CreatureIndividual({
    entityId: "c2",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    traits: sharedTraits,
  });

  assert.notEqual(c1.traits, c2.traits, "Las instancias de traits deben ser distintas");

  c1.traits.add("agil");
  assert.ok(c1.traits.has("agil"));
  assert.ok(!c2.traits.has("agil"), "c2 no debe recibir el trait agregado a c1");
  assert.ok(!sharedTraits.has("agil"), "sharedTraits original no debe mutar");
});

test("CreatureIndividual (H-1 Regression): same Progression instance supplied to two creatures does not share XP", () => {
  const sharedProgression = new Progression({ level: 1, xp: 0 });

  const c1 = new CreatureIndividual({
    entityId: "c1",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    progression: sharedProgression,
  });

  const c2 = new CreatureIndividual({
    entityId: "c2",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    progression: sharedProgression,
  });

  assert.notEqual(c1.progression, c2.progression, "Las instancias de progression deben ser distintas");

  c1.progression.addXp(100);
  assert.equal(c1.progression.xp, 100);
  assert.equal(c2.progression.xp, 0, "c2 debe mantener su XP intacto en 0");
  assert.equal(sharedProgression.xp, 0, "sharedProgression original no debe alterarse");
});

test("CreatureIndividual (H-1 Regression): same Position instance supplied to two creatures does not share position", () => {
  const sharedPosition = new Position(10, 20);

  const c1 = new CreatureIndividual({
    entityId: "c1",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    position: sharedPosition,
  });

  const c2 = new CreatureIndividual({
    entityId: "c2",
    speciesId: "neptuno",
    identity: new Identity({ speciesDisplayName: "Neptuno" }),
    stats: new Stats({ baseHealth: 3 }),
    position: sharedPosition,
  });

  assert.notEqual(c1.position, c2.position, "Las instancias de position deben ser distintas");

  c1.position.set(200, 300);
  assert.equal(c1.position.x, 200);
  assert.equal(c1.position.y, 300);
  assert.equal(c2.position.x, 10, "c2 debe mantener sus coordenadas originales");
  assert.equal(c2.position.y, 20);
  assert.equal(sharedPosition.x, 10);
  assert.equal(sharedPosition.y, 20);
});

// ============================================================================
// 5. Parity Guard & Architectural Isolation Tests
// ============================================================================

test("Elemental parity guard: domain values match client, server and Animal legacy sources until M1.8", () => {
  const animalSource = fs.readFileSync(path.resolve(__dirname, "../../js/entities/Animal.js"), "utf8");
  const typeChartSource = fs.readFileSync(path.resolve(__dirname, "../../js/core/typeChart.js"), "utf8");
  const serverSource = fs.readFileSync(path.resolve(__dirname, "../../index.js"), "utf8");

  function extractStringArray(source, constName) {
    const match = source.match(new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
    assert.ok(match, `No se encontró array ${constName}`);
    return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  }

  function extractAffinity(source, displayName) {
    const match = source.match(new RegExp(`${displayName}\\s*:\\s*["']([^"']+)["']`));
    assert.ok(match, `No se encontró afinidad para ${displayName}`);
    return match[1];
  }

  assert.deepEqual(extractStringArray(animalSource, "ELEMENTOS_DISPONIBLES"), [...VALID_AFFINITIES]);
  assert.deepEqual(extractStringArray(typeChartSource, "TIPOS"), [...VALID_AFFINITIES]);
  assert.deepEqual(extractStringArray(serverSource, "TIPOS"), [...VALID_AFFINITIES]);

  for (const [displayName, species] of [
    ["Neptuno", neptunoSpecies],
    ["Salamander", salamanderSpecies],
    ["Tierrudo", tierrudoSpecies],
  ]) {
    assert.equal(extractAffinity(animalSource, displayName), species.affinity);
    assert.equal(extractAffinity(serverSource, displayName), species.affinity);
  }

  assert.deepEqual(
    LEGACY_ABILITY_ELEMENTS,
    {
      botonFuego: "FUEGO",
      botonAgua: "AGUA",
      botonTierra: "TIERRA",
      botonElectrico: "ELECTRICO",
      botonHielo: "HIELO",
      botonDragon: "DRAGON",
    }
  );
});

test("Domain isolation: source-level guard ensures pure domain modules contain zero forbidden APIs/imports", () => {
  const domainDir = path.resolve(__dirname, "../../js/domain");
  const domainFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith(".mjs"));

  const forbiddenTokens = [
    "window",
    "document",
    "navigator",
    "localStorage",
    "sessionStorage",
    "WebSocket",
    "HTMLImageElement",
    "HTMLCanvasElement",
    "CanvasRenderingContext2D",
    "new Image",
    "express",
    "child_process",
    "node:net",
    "node:http",
  ];

  for (const file of domainFiles) {
    const content = fs.readFileSync(path.join(domainDir, file), "utf8");
    // Eliminar comentarios para evitar falsos positivos con docstrings
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");

    for (const token of forbiddenTokens) {
      assert.ok(
        !cleanContent.includes(token),
        `Archivo de dominio puro '${file}' contiene símbolo/API prohibido: '${token}'`
      );
    }
  }
});
