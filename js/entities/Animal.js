/**
 * Entidad de mascota / enemigo con hitbox e interpolación.
 * Refactorizado en M1-B: delega estado de dominio, movimiento y colisiones
 * en el LegacyAnimalAdapter y los subsistemas puros de simulación,
 * preservando intacta la API pública y el comportamiento de presentación/Canvas.
 */

import { LegacyAnimalAdapter } from "../compat/LegacyAnimalAdapter.mjs";

export class Animal {
  /**
   * @param {string} nombre
   * @param {string} foto
   * @param {number} vida
   * @param {string} fotoMapa
   * @param {number} [x=0]
   * @param {number} [y=0]
   */
  constructor(nombre, foto, vida, fotoMapa, x = 0, y = 0, adapter = null) {
    this.adapter = adapter instanceof LegacyAnimalAdapter
      ? adapter
      : new LegacyAnimalAdapter({
          nombre,
          foto,
          fotoMapa,
          x,
          y,
          vida,
        });
    Object.defineProperty(this, "adapter", {
      value: this.adapter,
      enumerable: true,
      writable: false,
      configurable: false,
    });

    this.foto = foto;
    /** @type {{ id: string }[]} */
    this.ataques = [...this.adapter.ataques];

    // Objeto de renderizado (exclusivo de navegador/presentación)
    this.mapaFoto = typeof Image !== "undefined" ? new Image() : { src: fotoMapa, complete: false };
    this.mapaFoto.src = fotoMapa;
    this.ready = false;
    this.mapaFoto.onload = () => {
      this.ready = true;
    };
    if (this.mapaFoto.complete) this.ready = true;
  }

  // --- Referencias de dominio sin duplicar estado ---
  get individual() {
    return this.adapter.individual;
  }

  get species() {
    return this.adapter.species;
  }

  // --- Superficie legacy de posición renderizada / objetivo lógico ---

  get x() {
    return this.adapter.x;
  }

  set x(val) {
    this.adapter.x = val;
  }

  get y() {
    return this.adapter.y;
  }

  set y(val) {
    this.adapter.y = val;
  }

  get targetX() {
    return this.adapter.targetX;
  }

  set targetX(val) {
    this.adapter.targetX = val;
  }

  get targetY() {
    return this.adapter.targetY;
  }

  set targetY(val) {
    this.adapter.targetY = val;
  }

  get velocidadX() {
    return this.adapter.velocidadX;
  }

  set velocidadX(val) {
    this.adapter.velocidadX = val;
  }

  get velocidadY() {
    return this.adapter.velocidadY;
  }

  set velocidadY(val) {
    this.adapter.velocidadY = val;
  }

  get speed() {
    return this.adapter.speed;
  }

  set speed(val) {
    this.adapter.speed = val;
  }

  get nombre() {
    return this.adapter.nombre;
  }

  set nombre(val) {
    if (val !== this.adapter.nombre) {
      throw new RangeError("Animal.nombre identifica la especie y no puede mutarse en M1.");
    }
  }

  get vida() {
    return this.adapter.vida;
  }

  set vida(val) {
    this.adapter.vida = val;
  }

  get ancho() {
    return this.adapter.ancho;
  }

  set ancho(val) {
    this.adapter.ancho = val;
  }

  get alto() {
    return this.adapter.alto;
  }

  set alto(val) {
    this.adapter.alto = val;
  }

  get anchoColision() {
    return this.adapter.anchoColision;
  }

  set anchoColision(val) {
    this.adapter.anchoColision = val;
  }

  get altoColision() {
    return this.adapter.altoColision;
  }

  set altoColision(val) {
    this.adapter.altoColision = val;
  }

  get offsetX() {
    return this.adapter.offsetX;
  }

  set offsetX(val) {
    this.adapter.offsetX = val;
  }

  get offsetY() {
    return this.adapter.offsetY;
  }

  set offsetY(val) {
    this.adapter.offsetY = val;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {boolean} [immediate=false]
   */
  setPosition(x, y, immediate = false) {
    this.adapter.setPosition(x, y, immediate);
  }

  /**
   * Interpola hacia target (útil para jugadores remotos).
   * @param {number} dt
   * @param {number} [lerpFactor=12]
   */
  interpolate(dt, lerpFactor = 12) {
    this.adapter.interpolate(dt, lerpFactor);
  }

  /**
   * Movimiento local por velocidad (jugador propio).
   * @param {number} dt
   * @param {number} mapW
   * @param {number} mapH
   */
  updateLocal(dt, mapW, mapH) {
    this.adapter.updateLocal(dt, mapW, mapH);
  }

  getHitbox() {
    return this.adapter.getHitbox();
  }

  /**
   * @param {Animal} other
   */
  collidesWith(other) {
    return this.adapter.collidesWith(other);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.mapaFoto.src) return;
    ctx.drawImage(this.mapaFoto, this.x, this.y, this.ancho, this.alto);
  }

  cloneAt(x, y) {
    const cloneAdapter = this.adapter.cloneAt(x, y);
    const copy = new Animal(
      this.nombre,
      this.foto,
      this.vida,
      this.mapaFoto.src,
      x,
      y,
      cloneAdapter
    );
    copy.ataques = [...this.ataques];
    copy.ancho = this.ancho;
    copy.alto = this.alto;
    copy.anchoColision = this.anchoColision;
    copy.altoColision = this.altoColision;
    copy.offsetX = this.offsetX;
    copy.offsetY = this.offsetY;
    return copy;
  }
}

export function createDefaultAnimals() {
  const neptuno = new Animal("Neptuno", "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp");
  const tierrudo = new Animal("Tierrudo", "./assets/tierra.webp", 3, "./assets/cabezaTierrudo.webp");
  const salamander = new Animal("Salamander", "./assets/fuego.webp", 3, "./assets/cabezaSalamander.webp");

  return { neptuno, tierrudo, salamander, list: [neptuno, tierrudo, salamander] };
}

/**
 * Aliases de compatibilidad transicionales (M1.8).
 * Derivados directamente de la fuente canónica única en js/rules/index.mjs.
 * @deprecated Consumir directamente desde js/rules/index.mjs.
 */
export {
  AFINIDAD_ANIMAL,
  ELEMENTS as ELEMENTOS_DISPONIBLES,
} from "../rules/index.mjs";
