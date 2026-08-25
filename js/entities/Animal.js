/**
 * Entidad de mascota / enemigo con hitbox e interpolación.
 */
export class Animal {
  /**
   * @param {string} nombre
   * @param {string} foto
   * @param {number} vida
   * @param {string} fotoMapa
   * @param {number} [x=0]
   * @param {number} [y=0]
   */
  constructor(nombre, foto, vida, fotoMapa, x = 0, y = 0) {
    this.nombre = nombre;
    this.foto = foto;
    this.vida = vida;
    /** @type {{ id: string }[]} */
    this.ataques = [];

    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;

    this.ancho = 80;
    this.alto = 80;
    this.velocidadX = 0;
    this.velocidadY = 0;
    this.speed = 180; // px/s (delta-time based)

    this.anchoColision = 30;
    this.altoColision = 30;
    this.offsetX = (this.ancho - this.anchoColision) / 2;
    this.offsetY = (this.alto - this.altoColision) / 2;

    this.mapaFoto = new Image();
    this.mapaFoto.src = fotoMapa;
    this.ready = false;
    this.mapaFoto.onload = () => {
      this.ready = true;
    };
    if (this.mapaFoto.complete) this.ready = true;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {boolean} [immediate=false]
   */
  setPosition(x, y, immediate = false) {
    this.targetX = x;
    this.targetY = y;
    if (immediate) {
      this.x = x;
      this.y = y;
    }
  }

  /**
   * Interpola hacia target (útil para jugadores remotos).
   * @param {number} dt
   * @param {number} [lerpFactor=12]
   */
  interpolate(dt, lerpFactor = 12) {
    const t = 1 - Math.exp(-lerpFactor * dt);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
  }

  /**
   * Movimiento local por velocidad (jugador propio).
   * @param {number} dt
   * @param {number} mapW
   * @param {number} mapH
   */
  updateLocal(dt, mapW, mapH) {
    this.x += this.velocidadX * this.speed * dt;
    this.y += this.velocidadY * this.speed * dt;
    this.x = Math.max(0, Math.min(mapW - this.ancho, this.x));
    this.y = Math.max(0, Math.min(mapH - this.alto, this.y));
    this.targetX = this.x;
    this.targetY = this.y;
  }

  getHitbox() {
    return {
      x: this.x + this.offsetX,
      y: this.y + this.offsetY,
      ancho: this.anchoColision,
      alto: this.altoColision,
    };
  }

  /**
   * @param {Animal} other
   */
  collidesWith(other) {
    const a = this.getHitbox();
    const b = other.getHitbox();
    return !(
      a.x + a.ancho < b.x ||
      a.x > b.x + b.ancho ||
      a.y + a.alto < b.y ||
      a.y > b.y + b.alto
    );
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.mapaFoto.src) return;
    ctx.drawImage(this.mapaFoto, this.x, this.y, this.ancho, this.alto);
  }

  cloneAt(x, y) {
    const copy = new Animal(this.nombre, this.foto, this.vida, this.mapaFoto.src, x, y);
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
  const neptunoAtaques = [
    { id: "botonAgua" },
    { id: "botonAgua" },
    { id: "botonAgua" },
    { id: "botonTierra" },
    { id: "botonFuego" },
  ];

  const neptuno = new Animal("Neptuno", "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp");
  const tierrudo = new Animal("Tierrudo", "./assets/tierra.webp", 3, "./assets/cabezaTierrudo.webp");
  const salamander = new Animal("Salamander", "./assets/fuego.webp", 3, "./assets/cabezaSalamander.webp");

  neptuno.ataques = neptunoAtaques;
  tierrudo.ataques = [
    { id: "botonTierra" },
    { id: "botonTierra" },
    { id: "botonTierra" },
    { id: "botonAgua" },
    { id: "botonFuego" },
  ];
  salamander.ataques = [
    { id: "botonFuego" },
    { id: "botonFuego" },
    { id: "botonFuego" },
    { id: "botonTierra" },
    { id: "botonAgua" },
  ];

  return { neptuno, tierrudo, salamander, list: [neptuno, tierrudo, salamander] };
}
