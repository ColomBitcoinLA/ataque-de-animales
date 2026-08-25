/** @typedef {'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

const TRANSITIONS = {
  SELECCION: ["MAPA"],
  MAPA: ["COMBATE", "SELECCION"],
  COMBATE: ["FIN", "MAPA"],
  FIN: ["SELECCION"],
};

/** @typedef {'QUEMADO'|'CONGELADO'|'ENVENENADO'|'NINGUNO'} StatusEffect */

const MAX_HP = 100;
const MAX_AP = 3;
const AP_PER_TURN = 1;
const CHARGED_COST = 2;
const BASIC_COST = 0;

/**
 * Combina dos arrays de rondas en array de tuplas: [[jugador, enemigo], ...]
 * @param {string[]} ataqueJ
 * @param {string[]} ataqueE
 */
export function zipRounds(ataqueJ, ataqueE) {
  const len = Math.min(ataqueJ.length, ataqueE.length);
  const out = [];
  for (let i = 0; i < len; i++) out.push([ataqueJ[i], ataqueE[i]]);
  return out;
}

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

    // —— Phase 2: Combate enriquecido ——
    this.hpJugador = MAX_HP;
    this.hpEnemigo = MAX_HP;
    this.apJugador = MAX_AP;
    this.apEnemigo = MAX_AP;
    this.maxHp = MAX_HP;
    this.maxAp = MAX_AP;
    this.rondaActual = 0;

    /** @type {StatusEffect} */
    this.statusJugador = "NINGUNO";
    /** @type {StatusEffect} */
    this.statusEnemigo = "NINGUNO";

    // Eventos adicionales para UI
    this._combatListeners = new Set();
  }

  /** Apunta a un listener de eventos de combate. */
  onCombat(fn) {
    this._combatListeners.add(fn);
    return () => this._combatListeners.delete(fn);
  }

  _emitCombat(event, payload) {
    for (const fn of this._combatListeners) {
      try { fn(event, payload); } catch (e) { console.error("[GameState]", e); }
    }
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

  // —— HP helpers ——

  /**
   * Aplica daño a un lado, retorna daño real aplicado.
   * @param {'jugador'|'enemigo'} side
   * @param {number} rawDamage
   * @returns {number}
   */
  applyDamage(side, rawDamage) {
    const isJ = side === "jugador";
    let damage = rawDamage;

    // Congelación reduce daño recibido 25%
    if ((isJ ? this.statusJugador : this.statusEnemigo) === "CONGELADO") {
      damage = Math.floor(damage * 0.75);
    }

    // Envenenamiento reduce efectividad del rival (ya aplicado en cálculo de ataque)
    if (isJ) {
      this.hpJugador = Math.max(0, this.hpJugador - damage);
    } else {
      this.hpEnemigo = Math.max(0, this.hpEnemigo - damage);
    }

    return damage;
  }

  /**
   * Aplica daño residual por quemadura.
   * @param {'jugador'|'enemigo'} side
   */
  applyBurnTick(side) {
    const isJ = side === "jugador";
    const status = isJ ? this.statusJugador : this.statusEnemigo;
    if (status !== "QUEMADO") return 0;
    const burnDmg = 8;
    if (isJ) this.hpJugador = Math.max(0, this.hpJugador - burnDmg);
    else this.hpEnemigo = Math.max(0, this.hpEnemigo - burnDmg);
    return burnDmg;
  }

  /**
   * Aplica un efecto de estado.
   * @param {'jugador'|'enemigo'} side
   * @param {StatusEffect} effect
   */
  applyStatus(side, effect) {
    if (side === "jugador") this.statusJugador = effect;
    else this.statusEnemigo = effect;
    this._emitCombat("status_applied", { side, effect });
  }

  /**
   * Limpia el estado del lado indicado.
   * @param {'jugador'|'enemigo'} side
   */
  clearStatus(side) {
    if (side === "jugador") this.statusJugador = "NINGUNO";
    else this.statusEnemigo = "NINGUNO";
  }

  /**
   * Recharge AP al inicio de un turno.
   */
  rechargeAP() {
    this.apJugador = Math.min(this.maxAp, this.apJugador + AP_PER_TURN);
    this.apEnemigo = Math.min(this.maxAp, this.apEnemigo + AP_PER_TURN);
  }

  /**
   * Gasta AP del jugador. Retorna true si tenía suficiente.
   * @param {number} cost
   */
  spendAP(cost) {
    if (this.apJugador < cost) return false;
    this.apJugador -= cost;
    return true;
  }

  /** Verifica si el jugador puede usar un ataque cargado. */
  canChargeAttack() {
    return this.apJugador >= CHARGED_COST;
  }

  getChargedCost() {
    return CHARGED_COST;
  }

  getBasicCost() {
    return BASIC_COST;
  }

  resetCombat() {
    this.ataqueJugador = [];
    this.ataqueEnemigo = [];
    this.rondasJugador = 0;
    this.rondasEnemigo = 0;
    this.colisionOcurrida = false;
    this.hpJugador = MAX_HP;
    this.hpEnemigo = MAX_HP;
    this.apJugador = MAX_AP;
    this.apEnemigo = MAX_AP;
    this.rondaActual = 0;
    this.statusJugador = "NINGUNO";
    this.statusEnemigo = "NINGUNO";
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
