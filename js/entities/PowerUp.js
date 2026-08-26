/**
 * Power-up recolectable en el mapa.
 * Tipos: 'vida' (+25 HP), 'mana' (+1 AP max), 'rapidez' (+30% velocidad)
 */
export class PowerUp {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'vida'|'mana'|'rapidez'} tipo
   */
  constructor(x, y, tipo) {
    this.x = x;
    this.y = y;
    this.tipo = tipo;
    this.ancho = 28;
    this.alto = 28;
    this.collected = false;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 2 + Math.random();
    this.spawnTime = performance.now();

    switch (tipo) {
      case "vida": this.emoji = "💖"; this.label = "+25 HP"; this.color = "#ff6b9d"; break;
      case "mana": this.emoji = "⚡"; this.label = "+1 AP"; this.color = "#ffdd44"; break;
      case "rapidez": this.emoji = "🥾"; this.label = "+30% Vel"; this.color = "#66ccff"; break;
      default: this.emoji = "✨"; this.label = "?"; this.color = "#fff";
    }
  }

  getHitbox() {
    return { x: this.x, y: this.y, ancho: this.ancho, alto: this.alto };
  }

  /**
   * @param {{ x: number, y: number, ancho: number, alto: number }} rect
   */
  collidesWith(rect) {
    return !(
      rect.x + rect.ancho < this.x ||
      rect.x > this.x + this.ancho ||
      rect.y + rect.alto < this.y ||
      rect.y > this.y + this.alto
    );
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} now - performance.now()
   */
  draw(ctx, now) {
    if (this.collected) return;
    const t = (now - this.spawnTime) / 1000;
    const bob = Math.sin(t * this.bobSpeed + this.bobPhase) * 4;
    const drawY = this.y + bob;

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color + "33";
    ctx.beginPath();
    ctx.arc(this.x + this.ancho / 2, drawY + this.alto / 2, this.ancho / 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emoji
    ctx.font = `${this.ancho}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x + this.ancho / 2, drawY + this.alto / 2);
  }
}

/**
 * Genera power-ups aleatorios.
 * @param {number} mapW
 * @param {number} mapH
 * @param {number} [count=3]
 * @returns {PowerUp[]}
 */
export function generatePowerUps(mapW, mapH, count = 3) {
  const types = ["vida", "mana", "rapidez"];
  const pups = [];
  const margin = 50;
  for (let i = 0; i < count; i++) {
    const tipo = types[i % types.length];
    const x = margin + Math.random() * (mapW - margin * 2 - 28);
    const y = margin + Math.random() * (mapH - margin * 2 - 28);
    pups.push(new PowerUp(x, y, tipo));
  }
  return pups;
}
