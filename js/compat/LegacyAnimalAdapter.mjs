/**
 * LegacyAnimalAdapter: Adaptador de compatibilidad para Animal legacy (M1.5).
 * 
 * Responsabilidades:
 * - Conecta SpeciesDefinition y CreatureIndividual con la interfaz esperada por el código frontend.
 * - Dueño único de estado: CreatureIndividual.position es la verdad autoritativa para x e y.
 * - get x() y get y() delegan directamente en this.individual.position.
 * - Delega cálculo de movimiento en MovementSystem y colisiones en CollisionSystem.
 * - Delega suavizado de red en interpolatePosition.
 * - cloneAt() crea instancias aisladas de CreatureIndividual mediante fromSpecies.
 * - Libre de dependencias de DOM, Canvas, Image, WebSocket y Express.
 */

import { CreatureIndividual, SpeciesDefinition } from "../domain/index.mjs";
import { MovementSystem } from "../simulation/MovementSystem.mjs";
import { interpolatePosition } from "../simulation/interpolation.mjs";
import { CollisionSystem } from "../simulation/CollisionSystem.mjs";
import { resolveLegacySpecies } from "./speciesResolver.mjs";

let compatIdCounter = 0;

export function resetCompatIdCounter(val = 0) {
  compatIdCounter = val;
}

export function generateCompatId(speciesId) {
  compatIdCounter += 1;
  return `compat-${speciesId}-${compatIdCounter}`;
}

export class LegacyAnimalAdapter {
  /**
   * @param {Object} options
   * @param {SpeciesDefinition} [options.species]
   * @param {CreatureIndividual} [options.individual]
   * @param {string} [options.nombre]
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.speed]
   * @param {number} [options.ancho=80]
   * @param {number} [options.alto=80]
   * @param {number} [options.anchoColision=30]
   * @param {number} [options.altoColision=30]
   * @param {number|null} [options.offsetX=null]
   * @param {number|null} [options.offsetY=null]
   * @param {Array<{ id: string }>} [options.ataques=null]
   * @param {string} [options.foto=""]
   * @param {string} [options.fotoMapa=""]
   */
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
    // 1. Especie canónica
    const resolvedSpecies = species instanceof SpeciesDefinition
      ? species
      : resolveLegacySpecies(nombre || "neptuno");

    this.species = resolvedSpecies;

    // 2. CreatureIndividual: dueño autoritativo de posición y estado de individuo
    if (individual instanceof CreatureIndividual) {
      this.individual = individual;
    } else {
      const entityId = generateCompatId(resolvedSpecies.speciesId);
      const effectiveHealth = typeof vida === "number" && Number.isFinite(vida) && vida > 0
        ? vida
        : resolvedSpecies.baseStats.health;
      this.individual = CreatureIndividual.fromSpecies(resolvedSpecies, {
        entityId,
        position: { x: Number(x) || 0, y: Number(y) || 0 },
        currentHealth: effectiveHealth,
        maxHealth: Math.max(effectiveHealth, resolvedSpecies.baseStats.health),
      });
    }

    // 3. Simulación de movimiento
    this.velocidadX = 0;
    this.velocidadY = 0;
    this.speed = typeof speed === "number" && Number.isFinite(speed) && speed >= 0
      ? speed
      : resolvedSpecies.movementProfile.baseSpeed;

    // Posición destino para interpolación visual (targetX, targetY)
    this.targetX = this.individual.position.x;
    this.targetY = this.individual.position.y;

    // 4. Parámetros geométricos (visual vs colisionador)
    this.ancho = ancho;
    this.alto = alto;
    this.anchoColision = anchoColision;
    this.altoColision = altoColision;
    this.offsetX = offsetX !== null && offsetX !== undefined ? offsetX : (this.ancho - this.anchoColision) / 2;
    this.offsetY = offsetY !== null && offsetY !== undefined ? offsetY : (this.alto - this.altoColision) / 2;

    // 5. Parámetros de presentación
    this.foto = foto;
    this.fotoMapa = fotoMapa;

    // Ataques compatibles
    this.ataques = Array.isArray(ataques)
      ? [...ataques]
      : resolvedSpecies.abilities.map((ab) => ({ id: ab.id }));
  }

  // --- Posición Autoritativa: delega en this.individual.position ---

  get x() {
    return this.individual.position.x;
  }

  set x(val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      this.individual.position.set(val, this.individual.position.y);
    }
  }

  get y() {
    return this.individual.position.y;
  }

  set y(val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      this.individual.position.set(this.individual.position.x, val);
    }
  }

  get nombre() {
    return this.individual.identity.speciesDisplayName;
  }

  get vida() {
    return this.individual.stats.current.health;
  }

  set vida(val) {
    if (typeof val === "number" && Number.isFinite(val)) {
      const current = this.individual.stats.current.health;
      if (val < current) {
        this.individual.takeDamage(current - val);
      } else if (val > current) {
        this.individual.heal(val - current);
      }
    }
  }

  /**
   * Ajuste de posición directa y target para interpolación.
   * @param {number} x
   * @param {number} y
   * @param {boolean} [immediate=false]
   */
  setPosition(x, y, immediate = false) {
    this.targetX = x;
    this.targetY = y;
    if (immediate) {
      this.individual.position.set(x, y);
    }
  }

  /**
   * Integra movimiento local usando MovementSystem puro y actualiza targetX/targetY.
   * @param {number} dt
   * @param {number} mapW
   * @param {number} mapH
   */
  updateLocal(dt, mapW, mapH) {
    MovementSystem.updateLocal(
      this.individual.position,
      { x: this.velocidadX, y: this.velocidadY },
      this.speed,
      dt,
      { width: mapW, height: mapH },
      { width: this.ancho, height: this.alto }
    );
    this.targetX = this.individual.position.x;
    this.targetY = this.individual.position.y;
  }

  /**
   * Suaviza la posición hacia targetX/targetY para entidades remotas de red.
   * Clasificación: PRESENTATION / NETWORK SMOOTHING.
   * @param {number} dt
   * @param {number} [lerpFactor=12]
   */
  interpolate(dt, lerpFactor = 12) {
    interpolatePosition(
      this.individual.position,
      { x: this.targetX, y: this.targetY },
      dt,
      lerpFactor
    );
  }

  /**
   * Calcula la caja AABB usando CollisionSystem puro.
   * @returns {{ x: number, y: number, width: number, height: number, ancho: number, alto: number }}
   */
  getHitbox() {
    return CollisionSystem.getAabb(this.individual.position, {
      width: this.anchoColision,
      height: this.altoColision,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
  }

  /**
   * Determina si colisiona con otra entidad u obstáculo.
   * @param {{ getHitbox?: Function, x: number, y: number }} other
   * @returns {boolean}
   */
  collidesWith(other) {
    return CollisionSystem.checkCollision(this, other);
  }

  /**
   * Factory de clonación: crea una nueva entidad independiente a partir de fromSpecies.
   * @param {number} x
   * @param {number} y
   * @returns {LegacyAnimalAdapter}
   */
  cloneAt(x, y) {
    const cloneIndividual = CreatureIndividual.fromSpecies(this.species, {
      entityId: generateCompatId(this.species.speciesId),
      position: { x, y },
      currentHealth: this.individual.stats.current.health,
      maxHealth: this.individual.stats.max.health,
    });

    return new LegacyAnimalAdapter({
      species: this.species,
      individual: cloneIndividual,
      nombre: this.nombre,
      vida: this.vida,
      x,
      y,
      speed: this.speed,
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
