/**
 * SpeciesDefinition: Definición pura e inmutable de una especie de criatura (M1.2).
 * Responde a la pregunta: "¿Qué tipo de criatura es esta?"
 * 
 * Invariantes:
 * - speciesId no vacío, estable y normalizado.
 * - displayName no vacío.
 * - baseStats.health número finito positivo > 0.
 * - affinity pertenece a los elementos válidos del dominio.
 * - abilities normalizado en array inmutable con mapeo canónico de elementos.
 *   NUNCA hereda la afinidad de la especie por omisión.
 * - Inmutabilidad profunda: configuración anidada totalmente congelada contra mutación externa.
 * - Libre de objetos de renderizado (Image, Canvas, Three.js, DOM).
 * - Libre de estado mutable personal (sin vida actual, XP ni historial individual).
 */

import { VALID_AFFINITIES, LEGACY_ABILITY_ELEMENTS } from "./constants.mjs";

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const copy = {};
  for (const [key, val] of Object.entries(obj)) {
    copy[key] = deepClone(val);
  }
  return copy;
}

function deepFreeze(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return Object.freeze(obj);
}

export class SpeciesDefinition {
  /**
   * @param {Object} options
   * @param {string} options.speciesId
   * @param {string} options.displayName
   * @param {string} [options.category="PET"]
   * @param {Object} options.baseStats
   * @param {number} options.baseStats.health
   * @param {string} options.affinity
   * @param {Array<Object|string>} [options.abilities=[]]
   * @param {Object} [options.movementProfile]
   * @param {number} [options.movementProfile.baseSpeed=180]
   * @param {Object} [options.sensesProfile=null]
   * @param {Object} [options.behaviorProfile=null]
   * @param {Object} [options.habitatProfile=null]
   */
  constructor(options = {}) {
    if (!options || typeof options !== "object") {
      throw new TypeError("SpeciesDefinition requiere un objeto de configuración.");
    }

    // 1. speciesId
    if (typeof options.speciesId !== "string" || !options.speciesId.trim()) {
      throw new TypeError("SpeciesDefinition: speciesId debe ser una cadena no vacía.");
    }
    const speciesId = options.speciesId.trim().toLowerCase();

    // 2. displayName
    if (typeof options.displayName !== "string" || !options.displayName.trim()) {
      throw new TypeError("SpeciesDefinition: displayName debe ser una cadena no vacía.");
    }
    const displayName = options.displayName.trim();

    // 3. category
    let category = "PET";
    if (options.category !== undefined && options.category !== null) {
      if (typeof options.category !== "string" || !options.category.trim()) {
        throw new TypeError("SpeciesDefinition: category debe ser una cadena no vacía cuando se especifica.");
      }
      category = options.category.trim().toUpperCase();
    }

    // 4. affinity
    if (typeof options.affinity !== "string" || !VALID_AFFINITIES.includes(options.affinity.trim().toUpperCase())) {
      throw new TypeError(
        `SpeciesDefinition: affinity debe ser una de: ${VALID_AFFINITIES.join(", ")}.`
      );
    }
    const affinity = options.affinity.trim().toUpperCase();

    // 5. baseStats
    if (!options.baseStats || typeof options.baseStats !== "object") {
      throw new TypeError("SpeciesDefinition: baseStats debe ser un objeto.");
    }
    const { health } = options.baseStats;
    if (typeof health !== "number" || !Number.isFinite(health) || health <= 0) {
      throw new TypeError("SpeciesDefinition: baseStats.health debe ser un número finito positivo mayor a 0.");
    }

    const baseStats = deepFreeze(deepClone({
      health,
    }));

    // 6. abilities (normalización y aislamiento defensivo)
    // Invariante: las habilidades NUNCA heredan por omisión la afinidad de la especie.
    if (options.abilities !== undefined && options.abilities !== null && !Array.isArray(options.abilities)) {
      throw new TypeError("SpeciesDefinition: abilities debe ser un array cuando se especifica.");
    }
    const rawAbilities = options.abilities ?? [];
    const normalizedAbilities = Object.freeze(
      rawAbilities.map((ab) => {
        let abId;
        let abName = null;
        let explicitElement = null;
        let power;
        let cost;

        if (typeof ab === "string") {
          abId = ab.trim();
          if (!abId) {
            throw new TypeError("SpeciesDefinition: una habilidad string no puede estar vacía.");
          }
        } else if (ab && typeof ab === "object" && !Array.isArray(ab)) {
          if (typeof ab.id !== "string" || !ab.id.trim()) {
            throw new TypeError("SpeciesDefinition: cada habilidad objeto requiere id no vacío.");
          }
          abId = ab.id.trim();

          if (ab.name !== undefined && ab.name !== null) {
            if (typeof ab.name !== "string" || !ab.name.trim()) {
              throw new TypeError("SpeciesDefinition: ability.name debe ser una cadena no vacía cuando se especifica.");
            }
            abName = ab.name.trim();
          }

          if (ab.element !== undefined && ab.element !== null) {
            if (typeof ab.element !== "string" || !ab.element.trim()) {
              throw new TypeError("SpeciesDefinition: ability.element debe ser una cadena no vacía cuando se especifica.");
            }
            const candidate = ab.element.trim().toUpperCase();
            if (!VALID_AFFINITIES.includes(candidate)) {
              throw new RangeError(`SpeciesDefinition: ability.element desconocido '${ab.element}'.`);
            }
            explicitElement = candidate;
          }

          if (ab.power !== undefined) {
            if (typeof ab.power !== "number" || !Number.isFinite(ab.power) || ab.power < 0) {
              throw new RangeError("SpeciesDefinition: ability.power debe ser un número finito no negativo.");
            }
            power = ab.power;
          }

          if (ab.cost !== undefined) {
            if (typeof ab.cost !== "number" || !Number.isFinite(ab.cost) || ab.cost < 0) {
              throw new RangeError("SpeciesDefinition: ability.cost debe ser un número finito no negativo.");
            }
            cost = ab.cost;
          }
        } else {
          throw new TypeError("SpeciesDefinition: cada habilidad debe ser una cadena o un objeto descriptor.");
        }

        const resolvedElement = explicitElement ?? LEGACY_ABILITY_ELEMENTS[abId] ?? null;
        const abilityDescriptor = {
          id: abId,
          element: resolvedElement,
          ...(abName !== null ? { name: abName } : {}),
          ...(power !== undefined ? { power } : {}),
          ...(cost !== undefined ? { cost } : {}),
        };

        return Object.freeze(abilityDescriptor);
      })
    );

    // 7. movementProfile (con soporte para anidación profunda inmutable)
    let baseSpeed = 180;
    let movementInput = {};
    if (options.movementProfile !== undefined && options.movementProfile !== null) {
      if (typeof options.movementProfile !== "object" || Array.isArray(options.movementProfile)) {
        throw new TypeError("SpeciesDefinition: movementProfile debe ser un objeto cuando se especifica.");
      }
      movementInput = options.movementProfile;
      if (options.movementProfile.baseSpeed !== undefined) {
        if (
          typeof options.movementProfile.baseSpeed !== "number" ||
          !Number.isFinite(options.movementProfile.baseSpeed) ||
          options.movementProfile.baseSpeed <= 0
        ) {
          throw new RangeError("SpeciesDefinition: movementProfile.baseSpeed debe ser finito y mayor a 0.");
        }
        baseSpeed = options.movementProfile.baseSpeed;
      }
    }
    const movementProfile = deepFreeze(deepClone({
      ...movementInput,
      baseSpeed,
    }));

    // 8. Perfiles opcionales profundamente inmutables
    const normalizeOptionalProfile = (value, fieldName) => {
      if (value === undefined || value === null) return null;
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`SpeciesDefinition: ${fieldName} debe ser un objeto cuando se especifica.`);
      }
      return deepFreeze(deepClone(value));
    };

    const sensesProfile = normalizeOptionalProfile(options.sensesProfile, "sensesProfile");
    const behaviorProfile = normalizeOptionalProfile(options.behaviorProfile, "behaviorProfile");
    const habitatProfile = normalizeOptionalProfile(options.habitatProfile, "habitatProfile");

    // Asignación inmutable profunda
    this.speciesId = speciesId;
    this.displayName = displayName;
    this.category = category;
    this.affinity = affinity;
    this.baseStats = baseStats;
    this.abilities = normalizedAbilities;
    this.movementProfile = movementProfile;
    this.sensesProfile = sensesProfile;
    this.behaviorProfile = behaviorProfile;
    this.habitatProfile = habitatProfile;

    Object.freeze(this);
  }
}
