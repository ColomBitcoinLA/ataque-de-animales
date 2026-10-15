/**
 * CreatureIndividual: Representación de una criatura INDIVIDUAL única (M1.3).
 * Responde a la pregunta: "¿Quién es esta criatura en particular?"
 * 
 * Reglas arquitectónicas:
 * - entityId representa al individuo único.
 * - speciesId representa a la especie.
 * - La salud mutable actual y la experiencia pertenecen al individuo,
 *   y NUNCA modifican SpeciesDefinition.baseStats.
 * - Dos instancias de la misma especie tienen estados aislados e independientes.
 * - Aislamiento defensivo: clona instancias de Stats, Traits, Progression y Position
 *   para garantizar que dos criaturas nunca compartan estado mutable por reutilización de objetos.
 * - La identidad individual no se infiere del slug de speciesId en el constructor directo.
 * - No conoce Image, Canvas, DOM, WebSocket, Express, Three.js ni localStorage.
 */

import { SpeciesDefinition } from "./SpeciesDefinition.mjs";
import {
  Identity,
  Stats,
  Traits,
  Temperament,
  Progression,
  Position,
} from "./valueObjects.mjs";
import { LIFECYCLE_STATES } from "./constants.mjs";

export class CreatureIndividual {
  #lifecycle;

  /**
   * @param {Object} options
   * @param {string} options.entityId
   * @param {string} options.speciesId
   * @param {string|null} [options.ownerId=null]
   * @param {Identity|Object} options.identity
   * @param {Stats|Object} options.stats
   * @param {Traits|string[]|Iterable<string>} [options.traits]
   * @param {Temperament|string} [options.temperament]
   * @param {Progression|Object} [options.progression]
   * @param {Position|Object} [options.position]
   * @param {string} [options.lifecycle="ACTIVE"]
   */
  constructor(options = {}) {
    if (!options || typeof options !== "object") {
      throw new TypeError("CreatureIndividual requiere un objeto de configuración.");
    }

    // 1. entityId
    if (typeof options.entityId !== "string" || !options.entityId.trim()) {
      throw new TypeError("CreatureIndividual: entityId debe ser una cadena no vacía.");
    }
    const entityId = options.entityId.trim();

    // 2. speciesId
    if (typeof options.speciesId !== "string" || !options.speciesId.trim()) {
      throw new TypeError("CreatureIndividual: speciesId debe ser una cadena no vacía.");
    }
    const speciesId = options.speciesId.trim().toLowerCase();

    // La identidad estructural de la entidad no debe poder reescribirse después de construirla.
    Object.defineProperties(this, {
      entityId: { value: entityId, enumerable: true, writable: false, configurable: false },
      speciesId: { value: speciesId, enumerable: true, writable: false, configurable: false },
    });

    // 3. ownerId
    if (
      options.ownerId !== undefined &&
      options.ownerId !== null &&
      (typeof options.ownerId !== "string" || !options.ownerId.trim())
    ) {
      throw new TypeError("CreatureIndividual: ownerId debe ser una cadena no vacía cuando se especifica.");
    }
    this.ownerId = typeof options.ownerId === "string" ? options.ownerId.trim() : null;

    // 4. Identity (el constructor directo exige identidad explícita; NO infiere de speciesId)
    if (options.identity instanceof Identity) {
      this.identity = options.identity;
    } else if (options.identity && typeof options.identity === "object") {
      if (typeof options.identity.speciesDisplayName !== "string" || !options.identity.speciesDisplayName.trim()) {
        throw new TypeError("CreatureIndividual: identity.speciesDisplayName es requerido y no se infiere de speciesId.");
      }
      this.identity = new Identity({
        speciesDisplayName: options.identity.speciesDisplayName,
        name: options.identity.name,
      });
    } else {
      throw new TypeError("CreatureIndividual: identity es requerido en el constructor directo y no se infiere de speciesId.");
    }

    // 5. Stats (aislamiento defensivo: clone() para prevenir mutable aliasing)
    if (options.stats instanceof Stats) {
      this.stats = options.stats.clone();
    } else if (options.stats && typeof options.stats === "object") {
      const bHealth = options.stats.baseHealth ?? options.stats.health;
      this.stats = new Stats({
        baseHealth: bHealth,
        currentHealth: options.stats.currentHealth ?? options.stats.current?.health ?? bHealth,
        maxHealth: options.stats.maxHealth ?? options.stats.max?.health ?? bHealth,
      });
    } else {
      throw new TypeError("CreatureIndividual: stats es requerido y debe proveer baseHealth o health.");
    }

    // 6. Traits (aislamiento defensivo: clone())
    if (options.traits instanceof Traits) {
      this.traits = options.traits.clone();
    } else {
      this.traits = new Traits(options.traits || []);
    }

    // 7. Temperament (valida disposición explícita sin convertir silenciosamente a DOCIL)
    if (options.temperament instanceof Temperament) {
      this.temperament = options.temperament;
    } else if (typeof options.temperament === "string") {
      this.temperament = new Temperament(options.temperament);
    } else if (options.temperament && typeof options.temperament.disposition === "string") {
      this.temperament = new Temperament(options.temperament.disposition);
    } else if (options.temperament === undefined || options.temperament === null) {
      this.temperament = new Temperament("DOCIL");
    } else {
      throw new TypeError("CreatureIndividual: temperament inválido.");
    }

    // 8. Progression (aislamiento defensivo: clone())
    if (options.progression instanceof Progression) {
      this.progression = options.progression.clone();
    } else if (options.progression && typeof options.progression === "object") {
      this.progression = new Progression(options.progression);
    } else {
      this.progression = new Progression();
    }

    // 9. Position (aislamiento defensivo: clone())
    if (options.position instanceof Position) {
      this.position = options.position.clone();
    } else if (options.position && typeof options.position === "object") {
      this.position = new Position(options.position.x ?? 0, options.position.y ?? 0);
    } else {
      this.position = new Position(0, 0);
    }

    // 10. Lifecycle: los valores explícitos inválidos fallan; no se degradan silenciosamente.
    let lifecycle = "ACTIVE";
    if (options.lifecycle !== undefined && options.lifecycle !== null) {
      if (typeof options.lifecycle !== "string" || !options.lifecycle.trim()) {
        throw new TypeError("CreatureIndividual: lifecycle debe ser una cadena no vacía cuando se especifica.");
      }
      lifecycle = options.lifecycle.toUpperCase().trim();
      if (!LIFECYCLE_STATES.includes(lifecycle)) {
        throw new RangeError(`CreatureIndividual: lifecycle desconocido '${options.lifecycle}'.`);
      }
    }
    this.#lifecycle = this.stats.isFainted ? "FAINTED" : lifecycle;

    // Las referencias estructurales no pueden reemplazarse desde consumidores externos.
    for (const field of ["identity", "stats", "traits", "temperament", "progression", "position"]) {
      Object.defineProperty(this, field, { writable: false, configurable: false });
    }
  }

  get lifecycle() {
    return this.#lifecycle;
  }

  /**
   * Transición explícita y validada de ciclo de vida.
   * Las políticas que deciden CUÁNDO transicionar pertenecen a simulación/combate.
   */
  setLifecycle(nextLifecycle) {
    if (typeof nextLifecycle !== "string" || !nextLifecycle.trim()) {
      throw new TypeError("CreatureIndividual: lifecycle debe ser una cadena no vacía.");
    }
    const normalized = nextLifecycle.toUpperCase().trim();
    if (!LIFECYCLE_STATES.includes(normalized)) {
      throw new RangeError(`CreatureIndividual: lifecycle desconocido '${nextLifecycle}'.`);
    }
    this.#lifecycle = normalized;
    return this.#lifecycle;
  }

  /**
   * Atajo para obtener la salud actual.
   * @returns {number}
   */
  get currentHealth() {
    return this.stats.current.health;
  }

  /**
   * Aplica daño y actualiza el ciclo de vida a FAINTED si cae a 0.
   * @param {number} amount
   * @returns {number} salud restante
   */
  takeDamage(amount) {
    const remaining = this.stats.takeDamage(amount);
    if (remaining <= 0) {
      this.#lifecycle = "FAINTED";
    }
    return remaining;
  }

  /**
   * Aplica curación a la salud actual.
   * Preserva el ciclo de vida: curar una criatura debilitada NO la revive automáticamente.
   * Las reglas de reanimación/revitalización pertenecen a la política de simulación/combate posterior.
   * @param {number} amount
   * @returns {number} salud resultante
   */
  heal(amount) {
    return this.stats.heal(amount);
  }

  get isFainted() {
    return this.#lifecycle === "FAINTED";
  }

  get hasZeroHealth() {
    return this.stats.isFainted;
  }

  /**
   * Factory para instanciar un individuo a partir de una SpeciesDefinition.
   * Utiliza la información autoritativa de la especie (SpeciesDefinition.displayName)
   * para inicializar la identidad base del individuo.
   * @param {SpeciesDefinition} speciesDef
   * @param {Object} options
   * @param {string} options.entityId
   * @param {string} [options.name]
   * @param {string|null} [options.ownerId]
   * @param {Object} [options.position]
   * @param {string[]|Iterable<string>} [options.traits]
   * @param {string} [options.temperament]
   * @param {Object} [options.progression]
   * @param {number} [options.currentHealth]
   * @param {number} [options.maxHealth]
   * @param {string} [options.lifecycle]
   * @returns {CreatureIndividual}
   */
  static fromSpecies(speciesDef, options = {}) {
    if (!(speciesDef instanceof SpeciesDefinition)) {
      throw new TypeError("fromSpecies requiere una instancia de SpeciesDefinition válida.");
    }
    if (!options || typeof options.entityId !== "string" || !options.entityId.trim()) {
      throw new TypeError("fromSpecies requiere options.entityId como cadena no vacía.");
    }

    if (
      options.identity instanceof Identity &&
      options.identity.speciesDisplayName !== speciesDef.displayName
    ) {
      throw new RangeError("fromSpecies: identity.speciesDisplayName debe coincidir con SpeciesDefinition.displayName.");
    }
    if (
      options.identity &&
      !(options.identity instanceof Identity) &&
      options.identity.speciesDisplayName !== undefined &&
      options.identity.speciesDisplayName !== speciesDef.displayName
    ) {
      throw new RangeError("fromSpecies: identity.speciesDisplayName debe coincidir con SpeciesDefinition.displayName.");
    }

    const identity = options.identity instanceof Identity
      ? options.identity
      : new Identity({
          speciesDisplayName: speciesDef.displayName,
          name: options.name ?? (options.identity && options.identity.name) ?? speciesDef.displayName,
        });

    const stats = new Stats({
      baseHealth: speciesDef.baseStats.health,
      currentHealth: options.currentHealth ?? speciesDef.baseStats.health,
      maxHealth: options.maxHealth ?? speciesDef.baseStats.health,
    });

    return new CreatureIndividual({
      entityId: options.entityId,
      speciesId: speciesDef.speciesId,
      ownerId: options.ownerId ?? null,
      identity,
      stats,
      traits: options.traits,
      temperament: options.temperament,
      progression: options.progression,
      position: options.position,
      lifecycle: options.lifecycle,
    });
  }
}
