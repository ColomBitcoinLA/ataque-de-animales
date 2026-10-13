/**
 * Constantes fundamentales del dominio de Animal Combat (M1-A).
 * Módulo puro: libre de dependencias de DOM, Browser, Canvas, Red o Servidor.
 */

export const VALID_AFFINITIES = Object.freeze([
  "FUEGO",
  "AGUA",
  "TIERRA",
  "ELECTRICO",
  "HIELO",
  "DRAGON",
]);

export const LIFECYCLE_STATES = Object.freeze([
  "ACTIVE",
  "FAINTED",
  "RESTING",
  "STORED",
]);

export const DEFAULT_TEMPERAMENTS = Object.freeze([
  "DOCIL",
  "AGRESIVO",
  "CAUTO",
  "CURIOSO",
  "TERRITORIAL",
  "VALIENTE",
]);

/**
 * Mapeo canónico temporal de IDs de habilidad legacy a elementos.
 * Mantiene la paridad con mokepon.js y Animal.js hasta la consolidación M1.8.
 */
export const LEGACY_ABILITY_ELEMENTS = Object.freeze({
  botonFuego: "FUEGO",
  botonAgua: "AGUA",
  botonTierra: "TIERRA",
  botonElectrico: "ELECTRICO",
  botonHielo: "HIELO",
  botonDragon: "DRAGON",
});

