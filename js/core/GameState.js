/** @typedef {'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

const TRANSITIONS = {
  SELECCION: ["MAPA"],
  MAPA: ["COMBATE", "SELECCION"],
  COMBATE: ["FIN", "MAPA"],
  FIN: ["SELECCION"],
};

export class GameState {
  constructor() {
    /** @type {GamePhase} */
    this.phase = "SELECCION";
    this.jugadorId = "";
    this.nombreMascotaJugador = "";
    this.nombreMascotaEnemigo = "";
    this.ataqueJugador = [];
    this.ataqueEnemigo = [];
    this.rondasJugador = 0;
    this.rondasEnemigo = 0;
    this.colisionOcurrida = false;
    /** @type {Map<string, { id: string, nombre: string, x: number, y: number, targetX: number, targetY: number }>} */
    this.remotePlayers = new Map();
    /** @type {Set<(phase: GamePhase, prev: GamePhase) => void>} */
    this._listeners = new Set();
  }

  /**
   * @param {(phase: GamePhase, prev: GamePhase) => void} fn
   */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * @param {GamePhase} next
   */
  setPhase(next) {
    if (this.phase === next) return false;
    const allowed = TRANSITIONS[this.phase] || [];
    if (!allowed.includes(next)) {
      console.warn(`[GameState] Transición inválida: ${this.phase} → ${next}`);
      return false;
    }
    const prev = this.phase;
    this.phase = next;
    for (const fn of this._listeners) fn(next, prev);
    return true;
  }

  resetCombat() {
    this.ataqueJugador = [];
    this.ataqueEnemigo = [];
    this.rondasJugador = 0;
    this.rondasEnemigo = 0;
    this.colisionOcurrida = false;
  }

  resetAll() {
    this.phase = "SELECCION";
    this.nombreMascotaJugador = "";
    this.nombreMascotaEnemigo = "";
    this.resetCombat();
    this.remotePlayers.clear();
  }
}

export const gameState = new GameState();
