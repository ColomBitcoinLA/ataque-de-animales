/**
 * Fuente única de la verdad para el árbol elemental (6 tipos).
 * Espejo del backend (index.js) para mantener consistencia en el daño local.
 */

export const TIPOS = ["FUEGO", "AGUA", "TIERRA", "ELECTRICO", "HIELO", "DRAGON"];

export const TIPOS_ELEMENTALES = [
  { nombre: "FUEGO", emoji: "🔥", color: "#ff5722", tooltip: "FUEGO: Fuerte contra TIERRA 🌱\nCargado: QUEMADURA 🔥 (daño por turno)" },
  { nombre: "AGUA", emoji: "💧", color: "#03a9f4", tooltip: "AGUA: Fuerte contra FUEGO 🔥\nCargado: CONGELACIÓN 💧 (reduce daño recibido)" },
  { nombre: "TIERRA", emoji: "🌱", color: "#8bc34a", tooltip: "TIERRA: Fuerte contra AGUA 💧\nCargado: ENVENENAMIENTO 🌱 (reduce ataque rival)" },
  { nombre: "ELECTRICO", emoji: "⚡", color: "#ffdd44", tooltip: "ELÉCTRICO: Fuerte contra AGUA 💧\nDébil contra TIERRA 🌱\nCargado: PARÁLISIS ⚡ (reduce daño rival 25%)" },
  { nombre: "HIELO", emoji: "❄️", color: "#80deea", tooltip: "HIELO: Fuerte contra TIERRA 🌱 y DRAGÓN 🐉\nDébil contra FUEGO 🔥\nCargado: CONGELACIÓN ❄️" },
  { nombre: "DRAGON", emoji: "🐉", color: "#ab47bc", tooltip: "DRAGÓN: Resiste FUEGO/AGUA/ELÉCTRICO (-25%)\nDébil contra HIELO ❄️\nCargado: MIEDO DRAGÓNICO 🐉" },
];

export const TYPE_MATCHUP = {
  FUEGO: { strong: ["TIERRA"], weak: ["AGUA"] },
  AGUA: { strong: ["FUEGO"], weak: ["TIERRA"] },
  TIERRA: { strong: ["AGUA"], weak: ["FUEGO"] },
  ELECTRICO: { strong: ["AGUA"], weak: ["TIERRA"] },
  HIELO: { strong: ["TIERRA", "DRAGON"], weak: ["FUEGO"] },
  DRAGON: { strong: ["DRAGON"], weak: [] },
};

export const DRAGON_RESISTANCES = ["FUEGO", "AGUA", "ELECTRICO"];
export const DRAGON_RESIST_MULT = 0.75;

/** Multiplicador de daño (attacker → defender). */
export function typeMultiplier(attacker, defender) {
  if (!TIPOS.includes(attacker) || !TIPOS.includes(defender)) return 1;
  const m = TYPE_MATCHUP[attacker];
  if (m.strong.includes(defender)) return 1.5;
  if (m.weak.includes(defender)) return 0.7;
  if (defender === "DRAGON" && DRAGON_RESISTANCES.includes(attacker)) return DRAGON_RESIST_MULT;
  return 1;
}

/** Efecto de estado que aplica el ataque cargado de cada tipo. */
export function getEffectForCharged(tipo) {
  if (tipo === "FUEGO") return "QUEMADO";
  if (tipo === "AGUA") return "CONGELADO";
  if (tipo === "TIERRA") return "ENVENENADO";
  if (tipo === "ELECTRICO") return "PARALIZADO";
  if (tipo === "HIELO") return "CONGELADO";
  if (tipo === "DRAGON") return "DRAGONICO";
  return "NINGUNO";
}

export function emojiForTipo(tipo) {
  return TIPOS_ELEMENTALES.find((t) => t.nombre === tipo)?.emoji || "⚔️";
}
