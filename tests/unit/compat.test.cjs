"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLegacySpecies,
  LEGACY_SPECIES_MAP,
  LegacyAnimalAdapter,
  generateCompatId,
  resetCompatIdCounter,
} = require("../../js/compat/index.cjs");

const {
  neptunoSpecies,
  tierrudoSpecies,
  salamanderSpecies,
  CreatureIndividual,
} = require("../../js/domain/index.cjs");

// ============================================================================
// 1. Characterization Baseline Tests (M1.5)
// ============================================================================

test("Characterization: resolveLegacySpecies maps legacy names to canonical species definitions", () => {
  assert.equal(resolveLegacySpecies("Neptuno"), neptunoSpecies);
  assert.equal(resolveLegacySpecies("neptuno"), neptunoSpecies);
  assert.equal(resolveLegacySpecies("NEPTUNO"), neptunoSpecies);

  assert.equal(resolveLegacySpecies("Tierrudo"), tierrudoSpecies);
  assert.equal(resolveLegacySpecies("Salamander"), salamanderSpecies);

  // Especie desconocida falla predeciblemente
  assert.throws(() => resolveLegacySpecies("Desconocido"), /especie legacy desconocida/);
  assert.throws(() => resolveLegacySpecies(""), TypeError);
  assert.throws(() => resolveLegacySpecies(null), TypeError);
});

test("Characterization: deterministic compatibility ID generator is local-only and validated", () => {
  resetCompatIdCounter(0);
  assert.equal(generateCompatId("neptuno"), "compat-neptuno-1");
  assert.equal(generateCompatId("neptuno"), "compat-neptuno-2");
  assert.equal(generateCompatId("tierrudo"), "compat-tierrudo-3");
  assert.throws(() => generateCompatId(""), TypeError);
  assert.throws(() => resetCompatIdCounter(-1), RangeError);
  assert.throws(() => resetCompatIdCounter(1.5), RangeError);
});

test("Characterization: logical position owner is separated from render position", () => {
  const adapter = new LegacyAnimalAdapter({
    nombre: "Neptuno",
    x: 100,
    y: 200,
  });

  // 1. La instancia de CreatureIndividual existe y es autoritativa
  assert.ok(adapter.individual instanceof CreatureIndividual);
  assert.equal(adapter.species, neptunoSpecies);

  // 2. Lectura delegada
  assert.equal(adapter.x, 100);
  assert.equal(adapter.y, 200);
  assert.equal(adapter.individual.position.x, 100);
  assert.equal(adapter.individual.position.y, 200);

  // 3. Escritura delegada a través de adapter.x/y
  adapter.x = 150;
  adapter.y = 250;
  assert.equal(adapter.individual.position.x, 150, "Modificar adapter.x debe mutar individual.position.x");
  assert.equal(adapter.individual.position.y, 250, "Modificar adapter.y debe mutar individual.position.y");

  // 4. Cambiar la posición lógica no hace snap visual hasta interpolate()
  adapter.individual.position.set(300, 400);
  assert.equal(adapter.targetX, 300);
  assert.equal(adapter.targetY, 400);
  assert.equal(adapter.x, 150, "la posición de render no salta hasta interpolate()");
  assert.equal(adapter.y, 250);
});

test("Characterization: updateLocal updates authoritative position once and sets targetX/targetY", () => {
  const adapter = new LegacyAnimalAdapter({
    nombre: "Neptuno",
    x: 100,
    y: 100,
  });

  adapter.velocidadX = 1;
  adapter.velocidadY = 0;
  adapter.speed = 180;

  // dt = 0.5s -> dx = 90px
  adapter.updateLocal(0.5, 800, 600);

  assert.equal(adapter.x, 190);
  assert.equal(adapter.y, 100);
  assert.equal(adapter.individual.position.x, 190);
  assert.equal(adapter.individual.position.y, 100);
  assert.equal(adapter.targetX, 190);
  assert.equal(adapter.targetY, 100);
});

test("Characterization: updateLocal respects boundary clamping [0, mapW - ancho] and [0, mapH - alto]", () => {
  const adapter = new LegacyAnimalAdapter({
    nombre: "Tierrudo",
    x: 700,
    y: 500,
    ancho: 80,
    alto: 80,
  });

  adapter.velocidadX = 1;
  adapter.velocidadY = 1;
  adapter.speed = 200;

  // Movimiento grande que superaría el límite de 800x600
  adapter.updateLocal(1, 800, 600);

  // Clampeado a 800 - 80 = 720, 600 - 80 = 520
  assert.equal(adapter.x, 720);
  assert.equal(adapter.y, 520);
  assert.equal(adapter.targetX, 720);
  assert.equal(adapter.targetY, 520);
});

test("Compatibility: interpolation smooths render position without rewriting authoritative logical position", () => {
  const adapter = new LegacyAnimalAdapter({
    nombre: "Salamander",
    x: 0,
    y: 0,
  });

  adapter.setPosition(100, 100, false);
  assert.equal(adapter.x, 0);
  assert.equal(adapter.y, 0);
  assert.equal(adapter.targetX, 100);
  assert.equal(adapter.targetY, 100);
  assert.equal(adapter.individual.position.x, 100);
  assert.equal(adapter.individual.position.y, 100);

  adapter.interpolate(0.1, 12);
  assert.ok(adapter.x > 50 && adapter.x < 100, "render x debe avanzar hacia targetX");
  assert.ok(adapter.y > 50 && adapter.y < 100, "render y debe avanzar hacia targetY");
  assert.equal(adapter.individual.position.x, 100, "interpolation no debe alterar posición lógica x");
  assert.equal(adapter.individual.position.y, 100, "interpolation no debe alterar posición lógica y");
});

test("Characterization: getHitbox and collidesWith match exact legacy AABB semantics", () => {
  const a = new LegacyAnimalAdapter({
    nombre: "Neptuno",
    x: 10,
    y: 20,
    ancho: 80,
    alto: 80,
    anchoColision: 30,
    altoColision: 30,
    offsetX: 25,
    offsetY: 25,
  });

  const hitboxA = a.getHitbox();
  assert.equal(hitboxA.x, 35); // 10 + 25
  assert.equal(hitboxA.y, 45); // 20 + 25
  assert.equal(hitboxA.ancho, 30);
  assert.equal(hitboxA.alto, 30);

  // Entidad B superpuesta
  const b = new LegacyAnimalAdapter({
    nombre: "Tierrudo",
    x: 15,
    y: 25,
    ancho: 80,
    alto: 80,
    anchoColision: 30,
    altoColision: 30,
    offsetX: 25,
    offsetY: 25,
  });

  assert.equal(a.collidesWith(b), true);
  assert.equal(b.collidesWith(a), true);

  // Entidad C alejada
  const c = new LegacyAnimalAdapter({
    nombre: "Salamander",
    x: 300,
    y: 300,
  });

  assert.equal(a.collidesWith(c), false);
});

test("Characterization: cloneAt creates an isolated CreatureIndividual with independent state", () => {
  const original = new LegacyAnimalAdapter({
    nombre: "Neptuno",
    x: 50,
    y: 50,
    foto: "./assets/agua.webp",
  });

  const clone = original.cloneAt(200, 300);

  // 1. Instancias separadas
  assert.notEqual(original, clone);
  assert.notEqual(original.individual, clone.individual);
  assert.notEqual(original.individual.position, clone.individual.position);

  // 2. Misma especie inmutable compartida
  assert.equal(original.species, clone.species);
  assert.equal(clone.species, neptunoSpecies);

  // 3. Posiciones aisladas
  assert.equal(original.x, 50);
  assert.equal(original.y, 50);
  assert.equal(clone.x, 200);
  assert.equal(clone.y, 300);

  // 4. Mutar el clon no afecta al original
  clone.x = 999;
  clone.y = 888;
  assert.equal(original.x, 50);
  assert.equal(original.y, 50);

  // 5. Daño en el individuo del clon no afecta al original
  clone.individual.takeDamage(2);
  assert.equal(clone.individual.currentHealth, 1);
  assert.equal(original.individual.currentHealth, 3);
});

test("Compatibility: observable legacy properties (nombre, vida, ataques, speed) are preserved", () => {
  const adapter = new LegacyAnimalAdapter({
    nombre: "Neptuno",
    x: 0,
    y: 0,
  });

  assert.equal(adapter.nombre, "Neptuno");
  assert.equal(adapter.vida, 3);
  assert.equal(adapter.speed, 180);
  assert.ok(Array.isArray(adapter.ataques));
  assert.equal(adapter.ataques.length, 5);
  assert.equal(adapter.ataques[0].id, "botonAgua");

  // Speed mutable por power-up (main.js: mascotaJugador.speed *= 1.3)
  adapter.speed *= 1.3;
  assert.equal(Math.round(adapter.speed), Math.round(180 * 1.3));
});


test("Compatibility: invalid constructor/setter input fails instead of silently coercing to defaults", () => {
  assert.throws(() => new LegacyAnimalAdapter({}), TypeError);
  assert.throws(() => new LegacyAnimalAdapter({ nombre: "Neptuno", x: NaN, y: 0 }), TypeError);
  assert.throws(() => new LegacyAnimalAdapter({ nombre: "Neptuno", speed: -1 }), RangeError);
  assert.throws(() => new LegacyAnimalAdapter({ nombre: "Neptuno", ancho: 0 }), RangeError);

  const adapter = new LegacyAnimalAdapter({ nombre: "Neptuno" });
  assert.throws(() => {
    adapter.x = NaN;
  }, TypeError);
  assert.throws(() => {
    adapter.targetY = Infinity;
  }, TypeError);
  assert.throws(() => {
    adapter.velocidadX = "1";
  }, TypeError);
});

test("Compatibility: supplied individual must match the canonical species", () => {
  const individual = CreatureIndividual.fromSpecies(neptunoSpecies, {
    entityId: "compat-mismatch",
  });

  assert.throws(
    () => new LegacyAnimalAdapter({ species: salamanderSpecies, individual }),
    RangeError
  );
});

test("Compatibility: local writes synchronize logical and render positions while network targets do not snap render", () => {
  const adapter = new LegacyAnimalAdapter({ nombre: "Neptuno", x: 10, y: 20 });

  adapter.x = 30;
  adapter.y = 40;
  assert.equal(adapter.individual.position.x, 30);
  assert.equal(adapter.individual.position.y, 40);
  assert.equal(adapter.x, 30);
  assert.equal(adapter.y, 40);

  adapter.setPosition(200, 300, false);
  assert.equal(adapter.individual.position.x, 200);
  assert.equal(adapter.individual.position.y, 300);
  assert.equal(adapter.x, 30, "render position debe conservarse hasta interpolate()");
  assert.equal(adapter.y, 40, "render position debe conservarse hasta interpolate()");
});


test("Compatibility: legacy vida assignment revives lifecycle explicitly when health becomes positive", () => {
  const adapter = new LegacyAnimalAdapter({ nombre: "Neptuno" });
  adapter.vida = 0;
  assert.equal(adapter.individual.lifecycle, "FAINTED");
  assert.equal(adapter.individual.isFainted, true);

  adapter.vida = 3;
  assert.equal(adapter.vida, 3);
  assert.equal(adapter.individual.lifecycle, "ACTIVE");
  assert.equal(adapter.individual.isFainted, false);
});

test("Compatibility: cloneAt preserves legacy speed reset semantics", () => {
  const original = new LegacyAnimalAdapter({ nombre: "Neptuno" });
  original.speed = 250;
  const clone = original.cloneAt(10, 20);
  assert.equal(original.speed, 250);
  assert.equal(clone.speed, neptunoSpecies.movementProfile.baseSpeed);
});

test("Compatibility: explicit nombre cannot contradict supplied species", () => {
  assert.throws(
    () => new LegacyAnimalAdapter({ species: neptunoSpecies, nombre: "Tierrudo" }),
    RangeError
  );
});

test("Compatibility: canonical attack ID sequences remain identical to legacy defaults", () => {
  const cases = [
    ["Neptuno", ["botonAgua", "botonAgua", "botonAgua", "botonTierra", "botonFuego"]],
    ["Tierrudo", ["botonTierra", "botonTierra", "botonTierra", "botonAgua", "botonFuego"]],
    ["Salamander", ["botonFuego", "botonFuego", "botonFuego", "botonTierra", "botonAgua"]],
  ];
  for (const [nombre, expected] of cases) {
    const adapter = new LegacyAnimalAdapter({ nombre });
    assert.deepEqual(adapter.ataques.map((attack) => attack.id), expected);
  }
});
