/**
 * Fuente Canónica Única de Reglas Elementales (M1.8).
 *
 * Centraliza para todo el proyecto (browser, server, dominio, compatibilidad, tests):
 * - Elementos válidos (6 tipos del árbol elemental).
 * - Mapeo de botones de ataque legacy a elementos canónicos.
 * - Afinidades elementales por defecto de las especies base.
 * - Matriz de ventajas y debilidades elementales (TYPE_MATCHUP).
 * - Resistencias especiales (Dragón) y multiplicadores de combate.
 * - Cálculo puro de multiplicador de tipo (typeMultiplier).
 * - Metadatos de presentación visual (emojis, colores, tooltips, efectos de carga).
 *
 * Inmutable: todas las estructuras de datos están profundamente congeladas (Object.freeze).
 * Libre de dependencias de DOM, Canvas, Image, WebSocket, Express o red.
 */

// 1. Elementos Válidos (Árbol de 6 Tipos)
export const ELEMENTS = Object.freeze([
  "FUEGO",
  "AGUA",
  "TIERRA",
  "ELECTRICO",
  "HIELO",
  "DRAGON",
]);

// Alias canónico compatible
export const TIPOS = ELEMENTS;

// 2. Mapeo de IDs de Ataque / Habilidad a Elementos
export const ATTACK_TO_ELEMENT = Object.freeze({
  botonFuego: "FUEGO",
  botonAgua: "AGUA",
  botonTierra: "TIERRA",
  botonElectrico: "ELECTRICO",
  botonHielo: "HIELO",
  botonDragon: "DRAGON",
});

// Alias canónico compatible
export const LEGACY_ABILITY_ELEMENTS = ATTACK_TO_ELEMENT;

// 3. Afinidades Elementales por Defecto de Especies Base
export const SPECIES_DEFAULT_AFFINITIES = Object.freeze({
  Neptuno: "AGUA",
  Salamander: "FUEGO",
  Tierrudo: "TIERRA",
});

// Alias canónico compatible
export const AFINIDAD_ANIMAL = SPECIES_DEFAULT_AFFINITIES;

// 4. Matriz de Efectividad Elemental (Attacker -> Strong / Weak)
export const TYPE_MATCHUP = Object.freeze({
  FUEGO: Object.freeze({
    strong: Object.freeze(["TIERRA"]),
    weak: Object.freeze(["AGUA"]),
  }),
  AGUA: Object.freeze({
    strong: Object.freeze(["FUEGO"]),
    weak: Object.freeze(["TIERRA"]),
  }),
  TIERRA: Object.freeze({
    strong: Object.freeze(["AGUA"]),
    weak: Object.freeze(["FUEGO"]),
  }),
  ELECTRICO: Object.freeze({
    strong: Object.freeze(["AGUA"]),
    weak: Object.freeze(["TIERRA"]),
  }),
  HIELO: Object.freeze({
    strong: Object.freeze(["TIERRA", "DRAGON"]),
    weak: Object.freeze(["FUEGO"]),
  }),
  DRAGON: Object.freeze({
    strong: Object.freeze(["DRAGON"]),
    weak: Object.freeze([]),
  }),
});

// 5. Resistencias Especiales y Constantes de Daño
export const DRAGON_RESISTANCES = Object.freeze(["FUEGO", "AGUA", "ELECTRICO"]);
export const DRAGON_RESIST_MULT = 0.75;
export const STRONG_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.7;
export const NEUTRAL_MULTIPLIER = 1.0;

/**
 * Calcula el multiplicador de daño según el tipo del atacante y defensor.
 * Función pura compartida por el frontend y el backend para garantizar 100% de paridad.
 *
 * @param {string} attacker - Tipo elemental del ataque
 * @param {string} defender - Tipo elemental del defensor
 * @returns {number} Multiplicador de daño (1.5, 0.7, 0.75 o 1.0)
 */
export function typeMultiplier(attacker, defender) {
  if (!ELEMENTS.includes(attacker) || !ELEMENTS.includes(defender)) return NEUTRAL_MULTIPLIER;
  const m = TYPE_MATCHUP[attacker];
  if (m.strong.includes(defender)) return STRONG_MULTIPLIER;
  if (m.weak.includes(defender)) return WEAK_MULTIPLIER;
  if (defender === "DRAGON" && DRAGON_RESISTANCES.includes(attacker)) return DRAGON_RESIST_MULT;
  return NEUTRAL_MULTIPLIER;
}

// 6. Metadatos de Presentación Visual (UI / HUD)
export const ELEMENTAL_METADATA = Object.freeze([
  Object.freeze({
    nombre: "FUEGO",
    emoji: "🔥",
    color: "#ff5722",
    tooltip: "FUEGO: Fuerte contra TIERRA 🌱\nCargado: QUEMADURA 🔥 (daño por turno)",
  }),
  Object.freeze({
    nombre: "AGUA",
    emoji: "💧",
    color: "#03a9f4",
    tooltip: "AGUA: Fuerte contra FUEGO 🔥\nCargado: CONGELACIÓN 💧 (reduce daño recibido)",
  }),
  Object.freeze({
    nombre: "TIERRA",
    emoji: "🌱",
    color: "#8bc34a",
    tooltip: "TIERRA: Fuerte contra AGUA 💧\nCargado: ENVENENAMIENTO 🌱 (reduce ataque rival)",
  }),
  Object.freeze({
    nombre: "ELECTRICO",
    emoji: "⚡",
    color: "#ffdd44",
    tooltip: "ELÉCTRICO: Fuerte contra AGUA 💧\nDébil contra TIERRA 🌱\nCargado: PARÁLISIS ⚡ (reduce daño rival 25%)",
  }),
  Object.freeze({
    nombre: "HIELO",
    emoji: "❄️",
    color: "#80deea",
    tooltip: "HIELO: Fuerte contra TIERRA 🌱 y DRAGÓN 🐉\nDébil contra FUEGO 🔥\nCargado: CONGELACIÓN ❄️",
  }),
  Object.freeze({
    nombre: "DRAGON",
    emoji: "🐉",
    color: "#ab47bc",
    tooltip: "DRAGÓN: Resiste FUEGO/AGUA/ELÉCTRICO (-25%)\nDébil contra HIELO ❄️\nCargado: MIEDO DRAGÓNICO 🐉",
  }),
]);

// Alias para compatibilidad con código existente de frontend
export const TIPOS_ELEMENTALES = ELEMENTAL_METADATA;

/**
 * Devuelve el efecto de estado secundario para un ataque cargado según su tipo.
 * @param {string} tipo
 * @returns {string} Identificador de efecto ("QUEMADO", "CONGELADO", etc.)
 */
export function getEffectForCharged(tipo) {
  if (tipo === "FUEGO") return "QUEMADO";
  if (tipo === "AGUA") return "CONGELADO";
  if (tipo === "TIERRA") return "ENVENENADO";
  if (tipo === "ELECTRICO") return "PARALIZADO";
  if (tipo === "HIELO") return "CONGELADO";
  if (tipo === "DRAGON") return "DRAGONICO";
  return "NINGUNO";
}

/**
 * Devuelve el emoji representativo de un tipo elemental.
 * @param {string} tipo
 * @returns {string} Emoji o icono por defecto
 */
export function emojiForTipo(tipo) {
  return ELEMENTAL_METADATA.find((t) => t.nombre === tipo)?.emoji || "⚔️";
}
