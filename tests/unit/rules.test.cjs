"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rules = require("../../js/rules/index.cjs");
const domain = require("../../js/domain/index.cjs");

// ============================================================================
// 1. Definición Canónica y Estructuras Inmutables (M1.8)
// ============================================================================

test("Canonical rules: contains exactly six valid elements in canonical order", () => {
  const expected = ["FUEGO", "AGUA", "TIERRA", "ELECTRICO", "HIELO", "DRAGON"];
  assert.deepEqual([...rules.ELEMENTS], expected);
  assert.deepEqual([...rules.TIPOS], expected);
  assert.equal(rules.ELEMENTS.length, 6);
  assert.equal(new Set(rules.ELEMENTS).size, 6, "Cada elemento debe ser único.");
  assert.ok(Object.isFrozen(rules.ELEMENTS), "ELEMENTS debe estar congelado.");
});

test("Canonical rules: attack IDs map deterministically to elements", () => {
  const expectedMap = {
    botonFuego: "FUEGO",
    botonAgua: "AGUA",
    botonTierra: "TIERRA",
    botonElectrico: "ELECTRICO",
    botonHielo: "HIELO",
    botonDragon: "DRAGON",
  };
  assert.deepEqual(rules.ATTACK_TO_ELEMENT, expectedMap);
  assert.deepEqual(rules.LEGACY_ABILITY_ELEMENTS, expectedMap);
  assert.ok(Object.isFrozen(rules.ATTACK_TO_ELEMENT));
});

test("Canonical rules: species default affinities match game lore", () => {
  const expectedAffinities = {
    Neptuno: "AGUA",
    Salamander: "FUEGO",
    Tierrudo: "TIERRA",
  };
  assert.deepEqual(rules.SPECIES_DEFAULT_AFFINITIES, expectedAffinities);
  assert.deepEqual(rules.AFINIDAD_ANIMAL, expectedAffinities);
  assert.ok(Object.isFrozen(rules.SPECIES_DEFAULT_AFFINITIES));
});

test("Canonical rules: deep immutability protects all structures from mutation", () => {
  assert.ok(Object.isFrozen(rules.TYPE_MATCHUP));
  for (const element of rules.ELEMENTS) {
    const matchup = rules.TYPE_MATCHUP[element];
    assert.ok(Object.isFrozen(matchup), `TYPE_MATCHUP.${element} debe estar congelado.`);
    assert.ok(Object.isFrozen(matchup.strong), `TYPE_MATCHUP.${element}.strong debe estar congelado.`);
    assert.ok(Object.isFrozen(matchup.weak), `TYPE_MATCHUP.${element}.weak debe estar congelado.`);
  }
  assert.ok(Object.isFrozen(rules.DRAGON_RESISTANCES));
  assert.ok(Object.isFrozen(rules.ELEMENTAL_METADATA));
  for (const meta of rules.ELEMENTAL_METADATA) {
    assert.ok(Object.isFrozen(meta));
  }
});

// ============================================================================
// 2. Cross-Runtime Parity: Node CJS vs Browser ESM (M1.8)
// ============================================================================

test("Cross-runtime parity: CJS and ESM wrappers expose identical canonical data", async () => {
  const cjsRules = require("../../js/rules/index.cjs");
  const esmRules = await import("../../js/rules/index.mjs");

  assert.deepEqual([...cjsRules.ELEMENTS], [...esmRules.ELEMENTS]);
  assert.deepEqual(cjsRules.ATTACK_TO_ELEMENT, esmRules.ATTACK_TO_ELEMENT);
  assert.deepEqual(cjsRules.SPECIES_DEFAULT_AFFINITIES, esmRules.SPECIES_DEFAULT_AFFINITIES);
  assert.deepEqual(cjsRules.TYPE_MATCHUP, esmRules.TYPE_MATCHUP);
  assert.deepEqual([...cjsRules.DRAGON_RESISTANCES], [...esmRules.DRAGON_RESISTANCES]);
  assert.equal(cjsRules.DRAGON_RESIST_MULT, esmRules.DRAGON_RESIST_MULT);

  for (const atk of cjsRules.ELEMENTS) {
    for (const def of cjsRules.ELEMENTS) {
      assert.equal(
        cjsRules.typeMultiplier(atk, def),
        esmRules.typeMultiplier(atk, def),
        `Multiplicador discrepante entre CJS y ESM para ${atk} -> ${def}`
      );
    }
  }
});

// ============================================================================
// 3. Balance Characterization: 6x6 Full Matchup Matrix (M1.8)
// ============================================================================

test("Balance characterization: full 36-combination 6x6 matchup matrix behaves deterministically", () => {
  const expectedMultipliers = {
    FUEGO: {
      FUEGO: 1.0,
      AGUA: 0.7,
      TIERRA: 1.5,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 0.75, // Resistencia Dragón
    },
    AGUA: {
      FUEGO: 1.5,
      AGUA: 1.0,
      TIERRA: 0.7,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 0.75, // Resistencia Dragón
    },
    TIERRA: {
      FUEGO: 0.7,
      AGUA: 1.5,
      TIERRA: 1.0,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 1.0,
    },
    ELECTRICO: {
      FUEGO: 1.0,
      AGUA: 1.5,
      TIERRA: 0.7,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 0.75, // Resistencia Dragón
    },
    HIELO: {
      FUEGO: 0.7,
      AGUA: 1.0,
      TIERRA: 1.5,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 1.5,
    },
    DRAGON: {
      FUEGO: 1.0,
      AGUA: 1.0,
      TIERRA: 1.0,
      ELECTRICO: 1.0,
      HIELO: 1.0,
      DRAGON: 1.5,
    },
  };

  for (const attacker of rules.ELEMENTS) {
    for (const defender of rules.ELEMENTS) {
      const actual = rules.typeMultiplier(attacker, defender);
      const expected = expectedMultipliers[attacker][defender];
      assert.equal(
        actual,
        expected,
        `typeMultiplier(${attacker}, ${defender}) debe ser ${expected}, pero fue ${actual}`
      );
    }
  }

  // Elementos inválidos retornan neutro (1.0)
  assert.equal(rules.typeMultiplier("UNKNOWN", "FUEGO"), 1.0);
  assert.equal(rules.typeMultiplier("FUEGO", "UNKNOWN"), 1.0);
  assert.equal(rules.typeMultiplier("", ""), 1.0);
  assert.equal(rules.typeMultiplier(null, undefined), 1.0);
});

test("Balance characterization: charged attack effects and emojis map correctly", () => {
  const expectedEffects = {
    FUEGO: "QUEMADO",
    AGUA: "CONGELADO",
    TIERRA: "ENVENENADO",
    ELECTRICO: "PARALIZADO",
    HIELO: "CONGELADO",
    DRAGON: "DRAGONICO",
  };
  for (const [el, eff] of Object.entries(expectedEffects)) {
    assert.equal(rules.getEffectForCharged(el), eff);
  }
  assert.equal(rules.getEffectForCharged("OTRO"), "NINGUNO");

  const expectedEmojis = {
    FUEGO: "🔥",
    AGUA: "💧",
    TIERRA: "🌱",
    ELECTRICO: "⚡",
    HIELO: "❄️",
    DRAGON: "🐉",
  };
  for (const [el, emoji] of Object.entries(expectedEmojis)) {
    assert.equal(rules.emojiForTipo(el), emoji);
  }
  assert.equal(rules.emojiForTipo("OTRO"), "⚔️");
});

// ============================================================================
// 4. Consumer Derivation Parity (M1.9)
// ============================================================================

test("Consumer derivation: domain VALID_AFFINITIES and LEGACY_ABILITY_ELEMENTS derive from rules", () => {
  assert.equal(domain.VALID_AFFINITIES, rules.ELEMENTS);
  assert.equal(domain.LEGACY_ABILITY_ELEMENTS, rules.ATTACK_TO_ELEMENT);
});

test("Consumer derivation: defaultSpecies affinities match canonical rule values", () => {
  assert.equal(domain.neptunoSpecies.affinity, rules.SPECIES_DEFAULT_AFFINITIES.Neptuno);
  assert.equal(domain.tierrudoSpecies.affinity, rules.SPECIES_DEFAULT_AFFINITIES.Tierrudo);
  assert.equal(domain.salamanderSpecies.affinity, rules.SPECIES_DEFAULT_AFFINITIES.Salamander);
});

// ============================================================================
// 5. Duplication Guard: Source-Level Anti-Duplication Enforcement (M1.9)
// ============================================================================

test("Duplication guard: no permanent duplicate elemental matrix in index.js", () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, "../../index.js"), "utf8");
  // Verificar que requiere js/rules
  assert.ok(
    indexSource.includes("./js/rules/index.cjs") || indexSource.includes("./js/rules"),
    "index.js debe consumir js/rules"
  );
  // Verificar que no declara su propio TYPE_MATCHUP literal
  const cleanSource = indexSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.ok(
    !cleanSource.includes("const TYPE_MATCHUP = {"),
    "index.js no debe contener una declaración literal independiente de TYPE_MATCHUP."
  );
});

test("Duplication guard: no permanent duplicate elemental matrix in Animal.js", () => {
  const animalSource = fs.readFileSync(path.resolve(__dirname, "../../js/entities/Animal.js"), "utf8");
  assert.ok(
    animalSource.includes("../rules/index.mjs") || animalSource.includes("../rules/elementalRules.mjs"),
    "Animal.js debe consumir js/rules"
  );
  const cleanSource = animalSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.ok(
    !cleanSource.includes("export const AFINIDAD_ANIMAL = {"),
    "Animal.js no debe contener una declaración literal independiente de AFINIDAD_ANIMAL."
  );
  assert.ok(
    !cleanSource.includes("export const ELEMENTOS_DISPONIBLES = ["),
    "Animal.js no debe contener una declaración literal independiente de ELEMENTOS_DISPONIBLES."
  );
});

test("Duplication guard: no permanent duplicate elemental matrix in typeChart.js", () => {
  const typeChartSource = fs.readFileSync(path.resolve(__dirname, "../../js/core/typeChart.js"), "utf8");
  assert.ok(
    typeChartSource.includes("../rules/index.mjs") || typeChartSource.includes("../rules/elementalRules.mjs"),
    "typeChart.js debe consumir js/rules"
  );
  const cleanSource = typeChartSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.ok(
    !cleanSource.includes("export const TYPE_MATCHUP = {"),
    "typeChart.js no debe contener una declaración literal independiente de TYPE_MATCHUP."
  );
  assert.ok(
    !cleanSource.includes("export const TIPOS = ["),
    "typeChart.js no debe contener una declaración literal independiente de TIPOS."
  );
});

test("Duplication guard: constants.mjs derives from canonical rules without literal duplicate", () => {
  const constantsSource = fs.readFileSync(path.resolve(__dirname, "../../js/domain/constants.mjs"), "utf8");
  assert.ok(
    constantsSource.includes("../rules/index.mjs") || constantsSource.includes("../rules/elementalRules.mjs"),
    "constants.mjs debe consumir js/rules"
  );
  const cleanSource = constantsSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.ok(
    !cleanSource.includes("export const VALID_AFFINITIES = Object.freeze(["),
    "constants.mjs no debe redeclarar un array literal de VALID_AFFINITIES."
  );
});

test("Source derivation: server imports canonical charged effect resolver instead of defining another", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../index.js"), "utf8");
  assert.match(source, /getEffectForCharged\s*,[\s\S]*?require\(["']\.\/js\/rules\/index\.cjs["']\)/);
  assert.doesNotMatch(source, /function\s+getEffectForCharged\s*\(/);
});

test("Presentation consumers derive elemental species affinities and base visuals from canonical rules", () => {
  const arena = fs.readFileSync(path.resolve(__dirname, "../../js/3d/Arena3D.js"), "utf8");
  const ui = fs.readFileSync(path.resolve(__dirname, "../../js/ui/UIManager.js"), "utf8");
  assert.match(arena, /SPECIES_DEFAULT_AFFINITIES/);
  assert.match(arena, /ELEMENTAL_METADATA/);
  assert.doesNotMatch(arena, /const\s+PET_ELEMENT\s*=\s*\{/);
  assert.match(ui, /SPECIES_DEFAULT_AFFINITIES/);
  assert.match(ui, /ELEMENTAL_METADATA/);
  assert.doesNotMatch(ui, /const\s+elementMap\s*=\s*\{/);
});

test("Cross-runtime wrapper exposes same canonical module instance and legacy 6x6 regression anchors behavior", async () => {
  const esm = await import("../../js/rules/index.mjs");
  const cjs = require("../../js/rules/index.cjs");
  assert.equal(cjs.TYPE_MATCHUP, esm.TYPE_MATCHUP);
  assert.equal(cjs.getEffectForCharged, esm.getEffectForCharged);
  assert.equal(cjs.SPECIES_DEFAULT_AFFINITIES, esm.SPECIES_DEFAULT_AFFINITIES);
  assert.equal(cjs.typeMultiplier("FUEGO", "DRAGON"), 0.75);
  assert.equal(cjs.typeMultiplier("TIERRA", "DRAGON"), 1);
  assert.equal(cjs.typeMultiplier("HIELO", "DRAGON"), 1.5);
});

test("Server damage classification retains canonical dragon resistance multiplier import", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../index.js"), "utf8");
  const canonicalImport = source.match(/const\s*\{([^}]+)\}\s*=\s*require\(["']\.\/js\/rules\/index\.cjs["']\)/);
  assert.ok(canonicalImport, "Server must import canonical rules via CJS bridge");
  assert.match(canonicalImport[1], /\bDRAGON_RESIST_MULT\b/, "calcDamage must have the dragon-resistance constant in scope");
  assert.match(source, /mult === DRAGON_RESIST_MULT/);
});
