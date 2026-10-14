/**
 * MovementSystem: Módulo puro de simulación matemática de movimiento (M1.6).
 * Libre de dependencias de Canvas, DOM, Image, WebSocket y Express.
 * 
 * Reglas de simulación:
 * - Integración de velocidad 2D independiente de frame rate: pos + vel * speed * dt.
 * - Restricción de límites de mapa (clamping): [0, mapW - ancho], [0, mapH - alto].
 * - Validación estricta: dt >= 0, speed >= 0, coordenadas finitas.
 * - No coerciona silenciosamente valores corruptos (NaN, Infinity).
 */

export class MovementSystem {
  /**
   * Valida que los parámetros escalares y vectoriales sean números finitos válidos.
   * @param {{ x: number, y: number }} velocity
   * @param {number} speed
   * @param {number} dt
   * @param {{ width?: number, height?: number, mapW?: number, mapH?: number }|null} [bounds]
   */
  static validateParams(velocity, speed, dt, bounds = null) {
    if (typeof dt !== "number" || !Number.isFinite(dt) || dt < 0) {
      throw new RangeError("MovementSystem: dt debe ser un número finito no negativo (>= 0).");
    }
    if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) {
      throw new RangeError("MovementSystem: speed debe ser un número finito no negativo (>= 0).");
    }
    if (!velocity || typeof velocity.x !== "number" || !Number.isFinite(velocity.x) || typeof velocity.y !== "number" || !Number.isFinite(velocity.y)) {
      throw new TypeError("MovementSystem: velocity debe ser un objeto con coordenadas numéricas finitas x e y.");
    }
    if (bounds !== null && bounds !== undefined) {
      const w = bounds.width ?? bounds.mapW;
      const h = bounds.height ?? bounds.mapH;
      if (typeof w !== "number" || !Number.isFinite(w) || w <= 0 || typeof h !== "number" || !Number.isFinite(h) || h <= 0) {
        throw new RangeError("MovementSystem: bounds debe tener dimensiones numéricas finitas positivas (> 0).");
      }
    }
  }

  /**
   * Calcula el siguiente punto sin modificar el objeto de entrada.
   * Fórmula canónica: next = pos + vel * speed * dt.
   * @param {{ x: number, y: number }} position
   * @param {{ x: number, y: number }} velocity
   * @param {number} speed
   * @param {number} dt
   * @returns {{ x: number, y: number }}
   */
  static calculateNextPosition(position, velocity, speed, dt) {
    MovementSystem.validateParams(velocity, speed, dt);
    if (!position || typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.y !== "number" || !Number.isFinite(position.y)) {
      throw new TypeError("MovementSystem: position debe ser un objeto con coordenadas numéricas finitas x e y.");
    }
    return {
      x: position.x + velocity.x * speed * dt,
      y: position.y + velocity.y * speed * dt,
    };
  }

  /**
   * Clampa una posición dentro del área rectangular [0, mapW - entW] y [0, mapH - entH].
   * @param {{ x: number, y: number }} pos
   * @param {{ width?: number, height?: number, mapW?: number, mapH?: number }} bounds
   * @param {{ width?: number, height?: number, ancho?: number, alto?: number }} [entityDimensions]
   * @returns {{ x: number, y: number }}
   */
  static clampToBounds(pos, bounds, entityDimensions = null) {
    if (!pos || typeof pos.x !== "number" || !Number.isFinite(pos.x) || typeof pos.y !== "number" || !Number.isFinite(pos.y)) {
      throw new TypeError("MovementSystem: pos debe tener coordenadas finitas.");
    }
    const mapW = bounds.width ?? bounds.mapW;
    const mapH = bounds.height ?? bounds.mapH;
    if (typeof mapW !== "number" || !Number.isFinite(mapW) || mapW <= 0 || typeof mapH !== "number" || !Number.isFinite(mapH) || mapH <= 0) {
      throw new RangeError("MovementSystem: bounds debe tener dimensiones finitas positivas.");
    }
    const entW = entityDimensions ? (entityDimensions.width ?? entityDimensions.ancho ?? 0) : 0;
    const entH = entityDimensions ? (entityDimensions.height ?? entityDimensions.alto ?? 0) : 0;

    const maxW = Math.max(0, mapW - entW);
    const maxH = Math.max(0, mapH - entH);

    return {
      x: Math.max(0, Math.min(maxW, pos.x)),
      y: Math.max(0, Math.min(maxH, pos.y)),
    };
  }

  /**
   * Ejecuta el paso completo de simulación de movimiento local con límites de mapa.
   * Si position implementa el método set(x, y) (como Position de dominio), lo actualiza directamente.
   * De lo contrario, muta las propiedades x e y del objeto provisto.
   * @param {{ x: number, y: number, set?: Function }} position
   * @param {{ x: number, y: number }} velocity
   * @param {number} speed
   * @param {number} dt
   * @param {{ width?: number, height?: number, mapW?: number, mapH?: number }|null} [bounds=null]
   * @param {{ width?: number, height?: number, ancho?: number, alto?: number }|null} [entityDimensions=null]
   * @returns {{ x: number, y: number }} posición resultante
   */
  static updateLocal(position, velocity, speed, dt, bounds = null, entityDimensions = null) {
    MovementSystem.validateParams(velocity, speed, dt, bounds);
    const next = MovementSystem.calculateNextPosition(position, velocity, speed, dt);
    const result = bounds ? MovementSystem.clampToBounds(next, bounds, entityDimensions) : next;

    if (typeof position.set === "function") {
      position.set(result.x, result.y);
    } else {
      position.x = result.x;
      position.y = result.y;
    }

    return result;
  }
}
