/**
 * Constantes fundamentales del dominio de Animal Combat (M1-A / M1.8).
 * Módulo puro: libre de dependencias de DOM, Browser, Canvas, Red o Servidor.
 *
 * Reglas elementales consolidadas (M1.8):
 * VALID_AFFINITIES y LEGACY_ABILITY_ELEMENTS derivan directamente de
 * la fuente canónica única en js/rules/index.mjs.
 */

import {
  ELEMENTS as CANONICAL_ELEMENTS,
  ATTACK_TO_ELEMENT as CANONICAL_ATTACK_TO_ELEMENT,
} from "../rules/index.mjs";

export const VALID_AFFINITIES = CANONICAL_ELEMENTS;

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

export const LEGACY_ABILITY_ELEMENTS = CANONICAL_ATTACK_TO_ELEMENT;
