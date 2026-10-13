/**
 * Value Objects y estructuras de datos puras del dominio (M1.4).
 * No dependen de DOM, Canvas, Image, WebSocket, Express ni localStorage.
 */

import { DEFAULT_TEMPERAMENTS } from "./constants.mjs";

/**
 * Identity: distingue el nombre de exhibición de la especie del nombre o apodo
 * propio del individuo. No infiere la identidad de un slug speciesId.
 */
export class Identity {
  /**
   * @param {Object} params
   * @param {string} params.speciesDisplayName
   * @param {string} [params.name]
   */
  constructor({ speciesDisplayName = "", name = null } = {}) {
    if (typeof speciesDisplayName !== "string" || !speciesDisplayName.trim()) {
      throw new TypeError("Identity: speciesDisplayName debe ser una cadena no vacía.");
    }

    const sName = speciesDisplayName.trim();
    const indName = typeof name === "string" && name.trim() ? name.trim() : sName;

    this.speciesDisplayName = sName;
    this.name = indName;

    Object.freeze(this);
  }

  get isCustomName() {
    return this.name !== this.speciesDisplayName;
  }
}

/**
 * Stats: distingue estadísticas base inmutables de la especie frente al estado
 * mutable actual del individuo (salud actual, máxima).
 * Encapsulado: el estado mutable solo puede cambiar mediante métodos de dominio validados.
 */
export class Stats {
  #baseHealth;
  #maxHealth;
  #currentHealth;
  #base;
  #max;

  /**
   * @param {Object} params
   * @param {number} params.baseHealth
   * @param {number} [params.currentHealth]
   * @param {number} [params.maxHealth]
   */
  constructor({ baseHealth, currentHealth = null, maxHealth = null } = {}) {
    // 1. baseHealth
    if (typeof baseHealth !== "number") {
      throw new TypeError("Stats: baseHealth debe ser un número.");
    }
    if (!Number.isFinite(baseHealth) || baseHealth <= 0) {
      throw new RangeError("Stats: baseHealth debe ser un número finito positivo mayor a 0.");
    }

    // 2. maxHealth
    let effectiveMax;
    if (maxHealth !== undefined && maxHealth !== null) {
      if (typeof maxHealth !== "number") {
        throw new TypeError("Stats: maxHealth debe ser un número.");
      }
      if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
        throw new RangeError("Stats: maxHealth debe ser un número finito mayor a 0.");
      }
      effectiveMax = maxHealth;
    } else {
      effectiveMax = baseHealth;
    }

    // 3. currentHealth
    let initialCurrent;
    if (currentHealth !== undefined && currentHealth !== null) {
      if (typeof currentHealth !== "number") {
        throw new TypeError("Stats: currentHealth debe ser un número.");
      }
      if (!Number.isFinite(currentHealth)) {
        throw new RangeError("Stats: currentHealth debe ser un número finito.");
      }
      if (currentHealth < 0) {
        throw new RangeError("Stats: currentHealth no puede ser negativo.");
      }
      if (currentHealth > effectiveMax) {
        throw new RangeError("Stats: currentHealth no puede exceder maxHealth.");
      }
      initialCurrent = currentHealth;
    } else {
      initialCurrent = effectiveMax;
    }

    this.#baseHealth = baseHealth;
    this.#maxHealth = effectiveMax;
    this.#currentHealth = initialCurrent;

    this.#base = Object.freeze({ health: baseHealth });
    this.#max = Object.freeze({ health: effectiveMax });
  }

  get base() {
    return this.#base;
  }

  get max() {
    return this.#max;
  }

  get current() {
    return Object.freeze({ health: this.#currentHealth });
  }

  get currentHealth() {
    return this.#currentHealth;
  }

  /**
   * Aplica daño al individuo reduciendo current.health sin alterar base o max.
   * @param {number} amount
   * @returns {number} nueva salud actual
   */
  takeDamage(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new TypeError("takeDamage requiere un número finito no negativo.");
    }
    this.#currentHealth = Math.max(0, this.#currentHealth - amount);
    return this.#currentHealth;
  }

  /**
   * Restaura salud al individuo hasta el tope de max.health.
   * @param {number} amount
   * @returns {number} nueva salud actual
   */
  heal(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new TypeError("heal requiere un número finito no negativo.");
    }
    this.#currentHealth = Math.min(this.#maxHealth, this.#currentHealth + amount);
    return this.#currentHealth;
  }

  get isFainted() {
    return this.#currentHealth <= 0;
  }

  clone() {
    return new Stats({
      baseHealth: this.#baseHealth,
      currentHealth: this.#currentHealth,
      maxHealth: this.#maxHealth,
    });
  }
}

/**
 * Traits: conjunto aislado de rasgos o características propias del individuo.
 */
export class Traits {
  #traits;

  /**
   * @param {string[]|Iterable<string>} [initialTraits]
   */
  constructor(initialTraits = []) {
    const list = Array.isArray(initialTraits) || (initialTraits && typeof initialTraits[Symbol.iterator] === "function")
      ? Array.from(initialTraits)
      : [];

    this.#traits = new Set(
      list
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
    );
  }

  has(trait) {
    return typeof trait === "string" && this.#traits.has(trait.trim());
  }

  add(trait) {
    if (typeof trait === "string" && trait.trim()) {
      this.#traits.add(trait.trim());
    }
    return this;
  }

  remove(trait) {
    if (typeof trait === "string") {
      this.#traits.delete(trait.trim());
    }
    return this;
  }

  toList() {
    return Array.from(this.#traits);
  }

  get size() {
    return this.#traits.size;
  }

  clone() {
    return new Traits(this.#traits);
  }
}

/**
 * Temperament: disposición conductual del individuo (ej. DOCIL, AGRESIVO, CAUTO).
 * No es una máquina de estados de IA ni un árbol de comportamiento.
 * Falla explícitamente si se provee una disposición desconocida.
 */
export class Temperament {
  /**
   * @param {string} [disposition="DOCIL"]
   */
  constructor(disposition = "DOCIL") {
    if (disposition === undefined || disposition === null) {
      this.disposition = "DOCIL";
      Object.freeze(this);
      return;
    }
    if (typeof disposition !== "string" || !disposition.trim()) {
      throw new TypeError("Temperament: disposition debe ser una cadena no vacía.");
    }
    const raw = disposition.toUpperCase().trim();
    if (!DEFAULT_TEMPERAMENTS.includes(raw)) {
      throw new RangeError(
        `Temperament: disposición desconocida '${disposition}'. Debe ser una de: ${DEFAULT_TEMPERAMENTS.join(", ")}.`
      );
    }
    this.disposition = raw;
    Object.freeze(this);
  }
}

/**
 * Progression: estado mínimo de nivel y experiencia del individuo.
 */
export class Progression {
  /**
   * @param {Object} [params]
   * @param {number} [params.level=1]
   * @param {number} [params.xp=0]
   */
  constructor({ level = 1, xp = 0 } = {}) {
    if (typeof level !== "number" || !Number.isFinite(level) || level < 1) {
      throw new TypeError("Progression: level debe ser un número entero >= 1.");
    }
    if (typeof xp !== "number" || !Number.isFinite(xp) || xp < 0) {
      throw new TypeError("Progression: xp debe ser un número finito no negativo >= 0.");
    }
    this.level = Math.floor(level);
    this.xp = Math.floor(xp);
  }

  addXp(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new TypeError("addXp requiere un número finito no negativo.");
    }
    this.xp += Math.floor(amount);
    return this.xp;
  }

  clone() {
    return new Progression({ level: this.level, xp: this.xp });
  }
}

/**
 * Position: coordenadas espaciales 2D mínimas en el dominio de simulación.
 */
export class Position {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   */
  constructor(x = 0, y = 0) {
    if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
      throw new TypeError("Position: las coordenadas x e y deben ser números finitos.");
    }
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
      throw new TypeError("Position: las coordenadas x e y deben ser números finitos.");
    }
    this.x = x;
    this.y = y;
    return this;
  }

  clone() {
    return new Position(this.x, this.y);
  }
}
