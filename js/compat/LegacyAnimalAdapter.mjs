/**
 * LegacyAnimalAdapter: puente de compatibilidad entre Animal legacy y el dominio/simulación M1.
 *
 * Reglas clave:
 * - CreatureIndividual.position conserva la posición lógica/autoritativa conocida por el cliente.
 * - La posición interpolada de render es separada y privada: el suavizado visual nunca reescribe
 *   la posición lógica recibida por red.
 * - Para el jugador local, escrituras legacy x/y y updateLocal sincronizan posición lógica + render.
 * - Colisiones legacy y draw() observan la posición renderizada, preservando el comportamiento previo.
 * - El adaptador no depende de DOM, Canvas, Image, WebSocket ni Express.
 */

import {
  CreatureIndividual,
  SpeciesDefinition,
  Position,
} from "../domain/index.mjs";
import { MovementSystem } from "../simulation/MovementSystem.mjs";
import { interpolatePosition } from "../simulation/interpolation.mjs";
import { CollisionSystem } from "../simulation/CollisionSystem.mjs";
import { resolveLegacySpecies } from "./speciesResolver.mjs";

let compatIdCounter = 0;

function assertFiniteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`LegacyAnimalAdapter: ${fieldName} debe ser un número finito.`);
  }
  return value;
}

function assertNonNegative(value, fieldName) {
  assertFiniteNumber(value, fieldName);
  if (value < 0) {
    throw new RangeError(`LegacyAnimalAdapter: ${fieldName} no puede ser negativo.`);
  }
  return value;
}

function assertPositive(value, fieldName) {
  assertFiniteNumber(value, fieldName);
  if (value <= 0) {
    throw new RangeError(`LegacyAnimalAdapter: ${fieldName} debe ser mayor a 0.`);
  }
  return value;
}

function resolveAdapterSpecies({ species, individual, nombre }) {
  let resolvedSpecies;

  if (species !== null && species !== undefined) {
    if (!(species instanceof SpeciesDefinition)) {
      throw new TypeError("LegacyAnimalAdapter: species debe ser una SpeciesDefinition.");
    }
    resolvedSpecies = species;
  } else if (individual !== null && individual !== undefined) {
    if (!(individual instanceof CreatureIndividual)) {
      throw new TypeError("LegacyAnimalAdapter: individual debe ser un CreatureIndividual.");
    }
    resolvedSpecies = resolveLegacySpecies(individual.speciesId);
  } else {
    resolvedSpecies = resolveLegacySpecies(nombre);
  }

  if (
    individual instanceof CreatureIndividual &&
    individual.speciesId !== resolvedSpecies.speciesId
  ) {
    throw new RangeError(
      `LegacyAnimalAdapter: individual.speciesId '${individual.speciesId}' no coincide con species '${resolvedSpecies.speciesId}'.`
    );
  }

  return resolvedSpecies;
}

export function resetCompatIdCounter(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("resetCompatIdCounter requiere un entero seguro no negativo.");
  }
  compatIdCounter = value;
}

export function generateCompatId(speciesId) {
  if (typeof speciesId !== "string" || !speciesId.trim()) {
    throw new TypeError("generateCompatId requiere speciesId como cadena no vacía.");
  }
  compatIdCounter += 1;
  return `compat-${speciesId.trim().toLowerCase()}-${compatIdCounter}`;
}

export class LegacyAnimalAdapter {
  #renderPosition;
  #velocidadX;
  #velocidadY;
  #speed;

  constructor({
    species = null,
    individual = null,
    nombre = null,
    vida = null,
    x = 0,
    y = 0,
    speed = null,
    ancho = 80,
    alto = 80,
    anchoColision = 30,
    altoColision = 30,
    offsetX = null,
    offsetY = null,
    ataques = null,
    foto = "",
    fotoMapa = "",
  } = {}) {
    const resolvedSpecies = resolveAdapterSpecies({ species, individual, nombre });

    if (individual !== null && individual !== undefined && !(individual instanceof CreatureIndividual)) {
      throw new TypeError("LegacyAnimalAdapter: individual debe ser un CreatureIndividual.");
    }

    if (individual instanceof CreatureIndividual) {
      this.individual = individual;
    } else {
      assertFiniteNumber(x, "x");
      assertFiniteNumber(y, "y");

      const effectiveHealth = vida === null || vida === undefined
        ? resolvedSpecies.baseStats.health
        : assertNonNegative(vida, "vida");

      this.individual = CreatureIndividual.fromSpecies(resolvedSpecies, {
        entityId: generateCompatId(resolvedSpecies.speciesId),
        position: { x, y },
        currentHealth: effectiveHealth,
        maxHealth: Math.max(effectiveHealth, resolvedSpecies.baseStats.health),
      });
    }

    this.species = resolvedSpecies;
    this.#renderPosition = new Position(
      this.individual.position.x,
      this.individual.position.y
    );

    this.#velocidadX = 0;
    this.#velocidadY = 0;
    this.#speed = speed === null || speed === undefined
      ? resolvedSpecies.movementProfile.baseSpeed
      : assertNonNegative(speed, "speed");

    this.ancho = assertPositive(ancho, "ancho");
    this.alto = assertPositive(alto, "alto");
    this.anchoColision = assertNonNegative(anchoColision, "anchoColision");
    this.altoColision = assertNonNegative(altoColision, "altoColision");
    this.offsetX = offsetX === null || offsetX === undefined
      ? (this.ancho - this.anchoColision) / 2
      : assertFiniteNumber(offsetX, "offsetX");
    this.offsetY = offsetY === null || offsetY === undefined
      ? (this.alto - this.altoColision) / 2
      : assertFiniteNumber(offsetY, "offsetY");

    this.foto = typeof foto === "string" ? foto : "";
    this.fotoMapa = typeof fotoMapa === "string" ? fotoMapa : "";

    if (ataques !== null && ataques !== undefined && !Array.isArray(ataques)) {
      throw new TypeError("LegacyAnimalAdapter: ataques debe ser un array cuando se especifica.");
    }
    this.ataques = Array.isArray(ataques)
      ? ataques.map((attack) => ({ ...attack }))
      : resolvedSpecies.abilities.map((ability) => ({ id: ability.id }));

    Object.defineProperties(this, {
      species: { writable: false, configurable: false },
      individual: { writable: false, configurable: false },
    });
  }

  // x/y son coordenadas renderizadas para mantener la superficie legacy.
  // Las escrituras directas legacy representan movimiento local y sincronizan ambas posiciones.
  get x() {
    return this.#renderPosition.x;
  }

  set x(value) {
    assertFiniteNumber(value, "x");
    this.#renderPosition.set(value, this.#renderPosition.y);
    this.individual.position.set(value, this.individual.position.y);
  }

  get y() {
    return this.#renderPosition.y;
  }

  set y(value) {
    assertFiniteNumber(value, "y");
    this.#renderPosition.set(this.#renderPosition.x, value);
    this.individual.position.set(this.individual.position.x, value);
  }

  // targetX/targetY son aliases de la última posición lógica conocida por el cliente.
  get targetX() {
    return this.individual.position.x;
  }

  set targetX(value) {
    assertFiniteNumber(value, "targetX");
    this.individual.position.set(value, this.individual.position.y);
  }

  get targetY() {
    return this.individual.position.y;
  }

  set targetY(value) {
    assertFiniteNumber(value, "targetY");
    this.individual.position.set(this.individual.position.x, value);
  }

  get velocidadX() {
    return this.#velocidadX;
  }

  set velocidadX(value) {
    this.#velocidadX = assertFiniteNumber(value, "velocidadX");
  }

  get velocidadY() {
    return this.#velocidadY;
  }

  set velocidadY(value) {
    this.#velocidadY = assertFiniteNumber(value, "velocidadY");
  }

  get speed() {
    return this.#speed;
  }

  set speed(value) {
    this.#speed = assertNonNegative(value, "speed");
  }

  get nombre() {
    return this.species.displayName;
  }

  get vida() {
    return this.individual.stats.current.health;
  }

  set vida(value) {
    assertNonNegative(value, "vida");
    const maxHealth = this.individual.stats.max.health;
    if (value > maxHealth) {
      throw new RangeError(
        `LegacyAnimalAdapter: vida (${value}) no puede exceder maxHealth (${maxHealth}).`
      );
    }

    const current = this.individual.stats.current.health;
    if (value < current) {
      this.individual.takeDamage(current - value);
    } else if (value > current) {
      this.individual.heal(value - current);
    }
  }

  /**
   * Actualiza la posición lógica objetivo recibida por red.
   * Con immediate=true sincroniza también la posición de render.
   */
  setPosition(x, y, immediate = false) {
    assertFiniteNumber(x, "x");
    assertFiniteNumber(y, "y");
    if (typeof immediate !== "boolean") {
      throw new TypeError("LegacyAnimalAdapter: immediate debe ser boolean.");
    }

    this.individual.position.set(x, y);
    if (immediate) {
      this.#renderPosition.set(x, y);
    }
  }

  /**
   * Movimiento local: actualiza la posición lógica una vez y sincroniza render inmediatamente.
   * El footprint usado para clamp (ancho/alto) es compatibilidad legacy, no geometría física canónica.
   */
  updateLocal(dt, mapW, mapH) {
    MovementSystem.updateLocal(
      this.individual.position,
      { x: this.#velocidadX, y: this.#velocidadY },
      this.#speed,
      dt,
      { width: mapW, height: mapH },
      { width: this.ancho, height: this.alto }
    );
    this.#renderPosition.set(
      this.individual.position.x,
      this.individual.position.y
    );
  }

  /**
   * Suavizado exclusivo de presentación: NO modifica CreatureIndividual.position.
   */
  interpolate(dt, lerpFactor = 12) {
    const next = interpolatePosition(
      this.#renderPosition,
      this.individual.position,
      dt,
      lerpFactor
    );
    this.#renderPosition.set(next.x, next.y);
    return next;
  }

  /**
   * Preserva el contrato legacy: la colisión cliente sigue la posición renderizada.
   * La colisión espacial autoritativa del mundo pertenece a M2.
   */
  getHitbox() {
    return CollisionSystem.getAabb(this.#renderPosition, {
      width: this.anchoColision,
      height: this.altoColision,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
  }

  collidesWith(other) {
    return CollisionSystem.checkCollision(this, other);
  }

  cloneAt(x, y) {
    assertFiniteNumber(x, "cloneAt.x");
    assertFiniteNumber(y, "cloneAt.y");

    const cloneIndividual = CreatureIndividual.fromSpecies(this.species, {
      entityId: generateCompatId(this.species.speciesId),
      position: { x, y },
      currentHealth: this.individual.stats.current.health,
      maxHealth: this.individual.stats.max.health,
    });

    return new LegacyAnimalAdapter({
      species: this.species,
      individual: cloneIndividual,
      speed: this.#speed,
      ancho: this.ancho,
      alto: this.alto,
      anchoColision: this.anchoColision,
      altoColision: this.altoColision,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      ataques: this.ataques,
      foto: this.foto,
      fotoMapa: this.fotoMapa,
    });
  }
}
