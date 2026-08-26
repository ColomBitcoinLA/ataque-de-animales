/** @typedef {'LOBBY' | 'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

const TRANSITIONS = {
  LOBBY: ["SELECCION"],
  SELECCION: ["MAPA", "LOBBY"],
  MAPA: ["COMBATE", "SELECCION"],
  COMBATE: ["FIN", "MAPA"],
  FIN: ["SELECCION", "LOBBY"],
};

/** @typedef {'QUEMADO'|'CONGELADO'|'ENVENENADO'|'NINGUNO'} StatusEffect */

const MAX_HP = 100;
const MAX_AP = 3;
const AP_PER_TURN = 1;
const CHARGED_COST = 2;
const BASIC_COST = 0;

export function zipRounds(a, b) {
  const len = Math.min(a.length, b.length);
  const out = [];
  for (let i = 0; i < len; i++) out.push([a[i], b[i]]);
  return out;
}

export class GameState {
  constructor() {
    /** @type {GamePhase} */
    this.phase = "LOBBY";
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

    // —— Phase 2 ——
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
    this._combatListeners = new Set();

    // —— Phase 3 ——
    /** @type {'online'|'solo'|null} */
    this.gameMode = null;
    /** @type {'facil'|'normal'|'dificil'} */
    this.difficulty = "normal";
    this.roomCode = null;
    this.isHost = false;
    this.opponentId = null;
    this.isAuthoritative = false; // true when server resolves combat
    this.turnTimer = 0;
    this.roundData = null;
  }

  onCombat(fn) { this._combatListeners.add(fn); return () => this._combatListeners.delete(fn); }
  _emitCombat(event, payload) { for (const fn of this._combatListeners) { try { fn(event, payload); } catch {} } }
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  setPhase(next) {
    if (this.phase === next) return false;
    const allowed = TRANSITIONS[this.phase] || [];
    if (!allowed.includes(next)) { console.warn(`[GameState] Invalid: ${this.phase} → ${next}`); return false; }
    const prev = this.phase;
    this.phase = next;
    for (const fn of this._listeners) fn(next, prev);
    return true;
  }

  // HP helpers
  applyDamage(side, rawDamage) {
    const isJ = side === "jugador";
    let d = rawDamage;
    if ((isJ ? this.statusJugador : this.statusEnemigo) === "CONGELADO") d = Math.floor(d * 0.75);
    if (isJ) this.hpJugador = Math.max(0, this.hpJugador - d);
    else this.hpEnemigo = Math.max(0, this.hpEnemigo - d);
    return d;
  }

  applyBurnTick(side) {
    const isJ = side === "jugador";
    if ((isJ ? this.statusJugador : this.statusEnemigo) !== "QUEMADO") return 0;
    const d = 8;
    if (isJ) this.hpJugador = Math.max(0, this.hpJugador - d);
    else this.hpEnemigo = Math.max(0, this.hpEnemigo - d);
    return d;
  }

  applyStatus(side, effect) {
    if (side === "jugador") this.statusJugador = effect;
    else this.statusEnemigo = effect;
    this._emitCombat("status_applied", { side, effect });
  }

  clearStatus(side) { if (side === "jugador") this.statusJugador = "NINGUNO"; else this.statusEnemigo = "NINGUNO"; }

  rechargeAP() {
    this.apJugador = Math.min(this.maxAp, this.apJugador + AP_PER_TURN);
    this.apEnemigo = Math.min(this.maxAp, this.apEnemigo + AP_PER_TURN);
  }

  spendAP(cost) { if (this.apJugador < cost) return false; this.apJugador -= cost; return true; }
  canChargeAttack() { return this.apJugador >= CHARGED_COST; }
  getChargedCost() { return CHARGED_COST; }
  getBasicCost() { return BASIC_COST; }

  resetCombat() {
    this.ataqueJugador = []; this.ataqueEnemigo = [];
    this.rondasJugador = 0; this.rondasEnemigo = 0;
    this.colisionOcurrida = false;
    this.hpJugador = this.maxHp; this.hpEnemigo = this.maxHp;
    this.apJugador = this.maxAp; this.apEnemigo = this.maxAp;
    this.rondaActual = 0;
    this.statusJugador = "NINGUNO"; this.statusEnemigo = "NINGUNO";
    this.roundData = null;
  }

  resetAll() {
    this.phase = "LOBBY";
    this.nombreMascotaJugador = ""; this.nombreMascotaEnemigo = "";
    this.gameMode = null; this.roomCode = null; this.isHost = false;
    this.opponentId = null; this.isAuthoritative = false;
    this.resetCombat();
    this.remotePlayers.clear();
  }
}

export const gameState = new GameState();
