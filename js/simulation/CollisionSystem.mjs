/**
 * CollisionSystem: Módulo puro de simulación geométrica de colisiones AABB (M1.7).
 * Libre de dependencias de Canvas, DOM, Image, WebSocket y Express.
 * 
 * Reglas de colisión:
 * - Geometría Axis-Aligned Bounding Box (AABB) pura en 2D.
 * - Distingue tamaño visual (ancho/alto = 80x80) de tamaño colisionador (anchoColision/altoColision = 30x30).
 * - Desplazamiento de centrado (offsetX/offsetY = 25/25).
 * - Semántica de bordes: inclusiva al contacto de bordes (edge-touch returns true).
 * - Libre de motores de física externos (sin Box2D, Matter.js ni Rapier).
 */

export const DEFAULT_COLLIDER = Object.freeze({
  width: 30,
  height: 30,
  offsetX: 25,
  offsetY: 25,
});

export class CollisionSystem {
  /**
   * Calcula la caja delimitadora AABB a partir de una posición y un descriptor colisionador.
   * Soporta tanto nombres canónicos (width/height) como legacy (ancho/alto, anchoColision/altoColision).
   * Si se omite collider se usa DEFAULT_COLLIDER; no se infiere geometría custom desde position/entityLike.
   * @param {{ x: number, y: number }} position
   * @param {{ width?: number, height?: number, ancho?: number, alto?: number, anchoColision?: number, altoColision?: number, offsetX?: number, offsetY?: number }} [collider]
   * @returns {{ x: number, y: number, width: number, height: number, ancho: number, alto: number }}
   */
  static getAabb(position, collider = DEFAULT_COLLIDER) {
    if (!position || typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.y !== "number" || !Number.isFinite(position.y)) {
      throw new TypeError("CollisionSystem: position debe tener coordenadas numéricas finitas x e y.");
    }

    const c = collider || DEFAULT_COLLIDER;
    if (typeof c !== "object" || Array.isArray(c)) {
      throw new TypeError("CollisionSystem: collider debe ser un objeto.");
    }

    const offX = c.offsetX ?? 0;
    const offY = c.offsetY ?? 0;
    if (
      typeof offX !== "number" || !Number.isFinite(offX) ||
      typeof offY !== "number" || !Number.isFinite(offY)
    ) {
      throw new TypeError("CollisionSystem: offsetX y offsetY deben ser números finitos.");
    }

    const rawW = c.width ?? c.anchoColision ?? c.ancho ?? DEFAULT_COLLIDER.width;
    const rawH = c.height ?? c.altoColision ?? c.alto ?? DEFAULT_COLLIDER.height;

    if (typeof rawW !== "number" || !Number.isFinite(rawW) || rawW < 0 || typeof rawH !== "number" || !Number.isFinite(rawH) || rawH < 0) {
      throw new RangeError("CollisionSystem: collider debe tener dimensiones no negativas.");
    }

    const x = position.x + offX;
    const y = position.y + offY;

    return {
      x,
      y,
      width: rawW,
      height: rawH,
      ancho: rawW,
      alto: rawH,
    };
  }

  /**
   * Determina si dos cajas AABB se intersectan, preservando la semántica exacta legacy.
   * Dos cajas en contacto de borde (a.x + a.w === b.x) se consideran en colisión.
   * @param {{ x: number, y: number, width?: number, height?: number, ancho?: number, alto?: number }} a
   * @param {{ x: number, y: number, width?: number, height?: number, ancho?: number, alto?: number }} b
   * @returns {boolean}
   */
  static intersectsAabb(a, b) {
    if (!a || !b) {
      throw new TypeError("CollisionSystem: intersectsAabb requiere dos cajas delimitadoras.");
    }

    const aW = a.width ?? a.ancho;
    const aH = a.height ?? a.alto;
    const bW = b.width ?? b.ancho;
    const bH = b.height ?? b.alto;

    if (
      typeof a.x !== "number" || !Number.isFinite(a.x) ||
      typeof a.y !== "number" || !Number.isFinite(a.y) ||
      typeof aW !== "number" || !Number.isFinite(aW) || aW < 0 ||
      typeof aH !== "number" || !Number.isFinite(aH) || aH < 0 ||
      typeof b.x !== "number" || !Number.isFinite(b.x) ||
      typeof b.y !== "number" || !Number.isFinite(b.y) ||
      typeof bW !== "number" || !Number.isFinite(bW) || bW < 0 ||
      typeof bH !== "number" || !Number.isFinite(bH) || bH < 0
    ) {
      throw new TypeError("CollisionSystem: ambas cajas deben tener coordenadas y dimensiones numéricas finitas válidas.");
    }

    return !(
      a.x + aW < b.x ||
      a.x > b.x + bW ||
      a.y + aH < b.y ||
      a.y > b.y + bH
    );
  }

  /**
   * Comprueba si dos entidades colisionan extrayendo sus cajas AABB.
   * @param {{ getHitbox?: Function, x: number, y: number }} entityA
   * @param {{ getHitbox?: Function, x: number, y: number }} entityB
   * @returns {boolean}
   */
  static checkCollision(entityA, entityB) {
    if (!entityA || !entityB) {
      throw new TypeError("CollisionSystem: checkCollision requiere dos entidades.");
    }
    const boxA = typeof entityA.getHitbox === "function" ? entityA.getHitbox() : entityA;
    const boxB = typeof entityB.getHitbox === "function" ? entityB.getHitbox() : entityB;
    return CollisionSystem.intersectsAabb(boxA, boxB);
  }
}
