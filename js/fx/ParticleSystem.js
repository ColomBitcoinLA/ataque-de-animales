/**
 * Motor de partículas Canvas + Screen Shake.
 * Renderiza explosiones de FUEGO, salpicaduras de AGUA y escombros de TIERRA.
 */

const GRAVITY = 320;

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity = 0, fadeRate = 1) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
    this.fadeRate = fadeRate;
    this.alive = true;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    if (!this.alive) return;
    const alpha = Math.max(0, this.life / this.maxLife) * this.fadeRate;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class ParticleSystem {
  constructor() {
    /** @type {Particle[]} */
    this.particles = [];
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakeIntensity = 0;
    this._shakeDuration = 0;
    this._shakeTimer = 0;
    this._shakeDecay = 0;
  }

  get isShaking() {
    return this._shakeTimer > 0;
  }

  /**
   * Activa sacudida de pantalla.
   * @param {number} intensity - Amplitud máxima en px (default 6)
   * @param {number} duration - Duración en segundos (default 0.3)
   */
  triggerShake(intensity = 6, duration = 0.3) {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeTimer = duration;
    this._shakeDecay = 1 / duration;
  }

  /** @param {number} dt */
  updateShake(dt) {
    if (this._shakeTimer <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    this._shakeTimer -= dt;
    const progress = Math.max(0, this._shakeTimer / this._shakeDuration);
    const mag = this._shakeIntensity * progress;
    this.shakeX = (Math.random() * 2 - 1) * mag;
    this.shakeY = (Math.random() * 2 - 1) * mag;
  }

  /**
   * Explosión de FUEGO: chispas naranjas/rojas.
   * @param {number} x
   * @param {number} y
   * @param {number} [count=24]
   */
  emitFire(x, y, count = 24) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60;
      const life = 0.3 + Math.random() * 0.5;
      const hue = Math.random() < 0.5 ? 15 + Math.random() * 25 : 30 + Math.random() * 20;
      const color = hsl(hue, 90 + Math.random() * 10, 50 + Math.random() * 20);
      const size = 1.5 + Math.random() * 3;
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, GRAVITY * 0.4, 0.9));
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 30;
      const life = 0.5 + Math.random() * 0.6;
      const color = hsl(0 + Math.random() * 10, 100, 20 + Math.random() * 15);
      this.particles.push(new Particle(x, y, vx, vy, life, color, 2 + Math.random() * 2, GRAVITY * 0.2));
    }
    this.triggerShake(5, 0.25);
  }

  /**
   * Salpicadura de AGUA: gotas azules con gravedad.
   * @param {number} x
   * @param {number} y
   * @param {number} [count=20]
   */
  emitWater(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 100 + Math.random() * 160;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.4 + Math.random() * 0.6;
      const hue = 195 + Math.random() * 30;
      const color = hsl(hue, 75 + Math.random() * 20, 50 + Math.random() * 20);
      const size = 1.5 + Math.random() * 3;
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, GRAVITY, 0.85));
    }
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random() - 0.5) * 40;
      const vy = -40 - Math.random() * 60;
      const life = 0.6 + Math.random() * 0.4;
      const color = hsl(200 + Math.random() * 20, 100, 85, 0.5);
      this.particles.push(new Particle(x, y, vx, vy, life, color, 4 + Math.random() * 3, GRAVITY * 0.5));
    }
    this.triggerShake(4, 0.2);
  }

  /**
   * Escombros de TIERRA: fragmentos verdes/marrones.
   * @param {number} x
   * @param {number} y
   * @param {number} [count=18]
   */
  emitEarth(x, y, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 50;
      const life = 0.4 + Math.random() * 0.5;
      const hue = Math.random() < 0.5 ? 80 + Math.random() * 40 : 25 + Math.random() * 15;
      const sat = 30 + Math.random() * 40;
      const light = 25 + Math.random() * 25;
      const color = hsl(hue, sat, light);
      const size = 1.5 + Math.random() * 3.5;
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, GRAVITY * 0.8));
    }
    for (let i = 0; i < 5; i++) {
      const vx = (Math.random() - 0.5) * 80;
      const vy = -20 - Math.random() * 40;
      const life = 0.6 + Math.random() * 0.5;
      const color = hsl(40 + Math.random() * 20, 20, 35, 0.6);
      this.particles.push(new Particle(x, y, vx, vy, life, color, 3 + Math.random() * 4, GRAVITY * 0.3));
    }
    this.triggerShake(6, 0.3);
  }

  /**
   * Emite partículas según tipo de ataque.
   * @param {'FUEGO'|'AGUA'|'TIERRA'} tipo
   * @param {number} x
   * @param {number} y
   */
  emitForAttack(tipo, x, y) {
    switch (tipo) {
      case "FUEGO":
        this.emitFire(x, y);
        break;
      case "AGUA":
        this.emitWater(x, y);
        break;
      case "TIERRA":
        this.emitEarth(x, y);
        break;
    }
  }

  /**
   * Update + render de todas las partículas.
   * @param {number} dt
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [canvasW]
   * @param {number} [canvasH]
   */
  updateAndDraw(dt, ctx, canvasW, canvasH) {
    this.updateShake(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (!p.alive) {
        this.particles.splice(i, 1);
        continue;
      }
      if (canvasW && canvasH) {
        if (p.x < -10 || p.x > canvasW + 10 || p.y < -10 || p.y > canvasH + 10) {
          this.particles.splice(i, 1);
          continue;
        }
      }
      p.draw(ctx);
    }
  }

  /** Limpia todas las partículas activas. */
  clear() {
    this.particles.length = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakeTimer = 0;
  }
}
