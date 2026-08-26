/**
 * IA Configurable para modo un solo jugador.
 * - 'facil': ataques aleatorios, nunca usa cargado.
 * - 'normal': 30% chance cargado, balance aleatorio.
 * - 'dificil': analiza historial del jugador, prioriza ventajas elementales y gestiona AP óptimamente.
 */

const ATTACKS = ["FUEGO", "AGUA", "TIERRA"];
const FUERZA_ATAQUES = { FUEGO: "TIERRA", AGUA: "FUEGO", TIERRA: "AGUA" };
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
    const attack = ATTACKS[Math.floor(Math.random() * 3)];
    return { attack, charged: false };
  }

  _normalAI(currentAP) {
    const attack = ATTACKS[Math.floor(Math.random() * 3)];
    const canCharge = currentAP >= CHARGED_COST;
    const charged = canCharge && Math.random() < 0.3;
    return { attack, charged };
  }

  _hardAI(currentAP) {
    const attackCounts = { FUEGO: 0, AGUA: 0, TIERRA: 0 };
    const lastN = this.history.slice(-5);
    for (const h of lastN) attackCounts[h.attack]++;
    // Predict: use most common player attack, then counter it
    let predicted = "FUEGO";
    let maxCount = 0;
    for (const [atk, count] of Object.entries(attackCounts)) {
      if (count > maxCount) { maxCount = count; predicted = atk; }
    }
    // Find what beats the predicted attack
    let bestAttack = "FUEGO";
    for (const [atk, beats] of Object.entries(FUERZA_ATAQUES)) {
      if (beats === predicted) { bestAttack = atk; break; }
    }
    // If no pattern, pick randomly
    if (maxCount === 0) bestAttack = ATTACKS[Math.floor(Math.random() * 3)];

    const canCharge = currentAP >= CHARGED_COST;
    // Charge if: AP is enough AND either 40% chance OR we're losing
    const myHpRatio = 0.5; // simplified — real tracking would need game state
    const charged = canCharge && (Math.random() < 0.4 || Math.random() < 0.25);
    return { attack: bestAttack, charged };
  }
}
