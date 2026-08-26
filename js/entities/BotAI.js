/**
 * IA Configurable para modo un solo jugador.
 * - 'facil': ataques aleatorios, nunca usa cargado.
 * - 'normal': 30% chance cargado, balance aleatorio.
 * - 'dificil': analiza historial del jugador, prioriza ventajas elementales y gestiona AP óptimamente.
 */

import { TIPOS, typeMultiplier } from "../core/typeChart.js";

const ATTACKS = TIPOS;
const CHARGED_COST = 2;

export class BotAI {
  /**
   * @param {'facil'|'normal'|'dificil'} difficulty
   */
  constructor(difficulty = "normal") {
    this.difficulty = difficulty;
    this.history = [];
    this.myHistory = [];
  }

  /**
   * Registra un turno de combate para la IA predictiva.
   * @param {string} playerAttack - ataque del jugador
   * @param {string} myAttack - ataque de la IA
   * @param {boolean} playerCharged
   * @param {boolean} myCharged
   */
  recordRound(playerAttack, myAttack, playerCharged, myCharged) {
    this.history.push({ attack: playerAttack, charged: playerCharged });
    this.myHistory.push({ attack: myAttack, charged: myCharged });
  }

  reset() {
    this.history = [];
    this.myHistory = [];
  }

  /**
   * Elige ataque.
   * @param {number} currentAP
   * @returns {{ attack: string, charged: boolean }}
   */
  chooseAttack(currentAP) {
    switch (this.difficulty) {
      case "facil": return this._easyAI();
      case "normal": return this._normalAI(currentAP);
      case "dificil": return this._hardAI(currentAP);
      default: return this._normalAI(currentAP);
    }
  }

  _easyAI() {
    const attack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    return { attack, charged: false };
  }

  _normalAI(currentAP) {
    const attack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    const canCharge = currentAP >= CHARGED_COST;
    const charged = canCharge && Math.random() < 0.3;
    return { attack, charged };
  }

  _hardAI(currentAP) {
    const attackCounts = {};
    for (const a of ATTACKS) attackCounts[a] = 0;
    const lastN = this.history.slice(-5);
    for (const h of lastN) { if (attackCounts[h.attack] != null) attackCounts[h.attack]++; }
    // Predict: use most common player attack, then counter it (element que le gana)
    let predicted = ATTACKS[0];
    let maxCount = 0;
    for (const atk of ATTACKS) {
      if (attackCounts[atk] > maxCount) { maxCount = attackCounts[atk]; predicted = atk; }
    }
    let bestAttack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    let bestMult = -1;
    for (const atk of ATTACKS) {
      const mult = typeMultiplier(atk, predicted);
      if (mult > bestMult) { bestMult = mult; bestAttack = atk; }
    }

    const canCharge = currentAP >= CHARGED_COST;
    const charged = canCharge && Math.random() < 0.4;
    return { attack: bestAttack, charged };
  }
}
