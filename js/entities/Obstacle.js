/**
 * Entidad de obstáculo sólido en el mapa con colisión AABB.
 */
export class Obstacle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} ancho
   * @param {number} alto
   * @param {string} [tipo='roca']
   */
  constructor(x, y, ancho, alto, tipo = "roca") {
    this.x = x;
    this.y = y;
    this.ancho = ancho;
    this.alto = alto;
    this.tipo = tipo;
    this.color = tipo === "roca" ? "#5a4a3a" : tipo === "arbol" ? "#2d5a27" : "#4a3a6a";
    this.emoji = tipo === "roca" ? "🪨" : tipo === "arbol" ? "🌳" : "🏛️";
  }

  getHitbox() {
    return { x: this.x, y: this.y, ancho: this.ancho, alto: this.alto };
  }

  /**
   * Verifica si un rectángulo colisiona con este obstáculo.
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
   * Dibuja el obstáculo en canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    const rx = this.x + this.ancho / 2;
    const ry = this.y + this.alto / 2;
    if (this.tipo === "roca") {
      ctx.ellipse(rx, ry, this.ancho / 2, this.alto / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2a1a";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.tipo === "arbol") {
      // Tronco
      ctx.fillRect(rx - 4, ry, 8, this.alto / 2);
      // Copa
      ctx.fillStyle = "#3a7a30";
      ctx.beginPath();
      ctx.arc(rx, ry - 4, this.ancho / 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(this.x, this.y, this.ancho, this.alto);
      ctx.strokeStyle = "#6a5a8a";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.ancho, this.alto);
    }
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.min(this.ancho, this.alto) * 0.6}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, rx, ry);
  }
}

/**
 * Genera obstáculos aleatorios para un mapa dado.
 * @param {number} mapW
 * @param {number} mapH
 * @param {number} [count=5]
 * @returns {Obstacle[]}
 */
export function generateObstacles(mapW, mapH, count = 5) {
  const types = ["roca", "arbol", "ruina"];
  const obstacles = [];
  const margin = 60;
  for (let i = 0; i < count; i++) {
    const tipo = types[Math.floor(Math.random() * types.length)];
    const w = 30 + Math.random() * 30;
    const h = 30 + Math.random() * 30;
    const x = margin + Math.random() * (mapW - margin * 2 - w);
    const y = margin + Math.random() * (mapH - margin * 2 - h);
    obstacles.push(new Obstacle(x, y, w, h, tipo));
  }
  return obstacles;
}
