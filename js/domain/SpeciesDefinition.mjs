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
    const category = typeof options.category === "string" && options.category.trim()
      ? options.category.trim().toUpperCase()
      : "PET";

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
    const rawAbilities = Array.isArray(options.abilities) ? options.abilities : [];
    const normalizedAbilities = Object.freeze(
      rawAbilities.map((ab, index) => {
        let abId = "";
        let abName = null;
        let explicitElement = null;
        let power = undefined;
        let cost = undefined;

        if (typeof ab === "string") {
          abId = ab.trim();
          abName = abId;
        } else if (ab && typeof ab === "object") {
          abId = typeof ab.id === "string" && ab.id.trim() ? ab.id.trim() : `ability-${index}`;
          abName = typeof ab.name === "string" && ab.name.trim() ? ab.name.trim() : abId;
          if (typeof ab.element === "string" && ab.element.trim()) {
            const cand = ab.element.trim().toUpperCase();
            explicitElement = VALID_AFFINITIES.includes(cand) ? cand : null;
          }
          if (typeof ab.power === "number") power = ab.power;
          if (typeof ab.cost === "number") cost = ab.cost;
        } else {
          throw new TypeError("SpeciesDefinition: cada habilidad debe ser una cadena o un objeto descriptor.");
        }

        // Resolución elemental: si no se especificó elemento, usar mapeo canónico legacy.
        // Si no está mapeado, se asigna null. NUNCA se hereda de species.affinity.
        let resolvedElement = explicitElement;
        if (!resolvedElement && LEGACY_ABILITY_ELEMENTS[abId]) {
          resolvedElement = LEGACY_ABILITY_ELEMENTS[abId];
        }

        const abilityDescriptor = {
          id: abId,
          name: abName,
          element: resolvedElement,
          ...(power !== undefined ? { power } : {}),
          ...(cost !== undefined ? { cost } : {}),
        };

        return Object.freeze(abilityDescriptor);
      })
    );

    // 7. movementProfile (con soporte para anidación profunda inmutable)
    const baseSpeed = options.movementProfile && typeof options.movementProfile.baseSpeed === "number" && Number.isFinite(options.movementProfile.baseSpeed) && options.movementProfile.baseSpeed > 0
      ? options.movementProfile.baseSpeed
      : 180;
    const movementProfile = deepFreeze(deepClone({
      baseSpeed,
      ...(options.movementProfile && typeof options.movementProfile === "object" ? options.movementProfile : {}),
      baseSpeed, // garantiza baseSpeed válido
    }));

    // 8. Perfiles opcionales profundamente inmutables
    const sensesProfile = options.sensesProfile && typeof options.sensesProfile === "object"
      ? deepFreeze(deepClone(options.sensesProfile))
      : null;

    const behaviorProfile = options.behaviorProfile && typeof options.behaviorProfile === "object"
      ? deepFreeze(deepClone(options.behaviorProfile))
      : null;

    const habitatProfile = options.habitatProfile && typeof options.habitatProfile === "object"
      ? deepFreeze(deepClone(options.habitatProfile))
      : null;

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
