/**
 * Gestor de Perfil: sesión persistente (token), modo Invitado (localStorage),
 * XP/niveles, estadísticas, historial y bonos de mascota por nivel.
 */

const STORAGE_KEY_TOKEN = "animalcombat_token";
const STORAGE_KEY_USER = "animalcombat_username";
const STORAGE_KEY_GUEST = "animalcombat_guest_profile";

export function levelForXp(xp) {
  const thresholds = [0, 200, 500, 1000, 1600];
  let lvl = 1;
  for (let i = 0; i < thresholds.length; i++) if (xp >= thresholds[i]) lvl = i + 1;
  let threshold = thresholds[4];
  while (xp >= threshold + 1000) { threshold += 1000; lvl++; }
  return lvl;
}
export function titleForLevel(level) {
  const titles = { 1: "Aprendiz", 2: "Gladiador", 3: "Guerrero Elemental", 4: "Domador Legendario" };
  if (level >= 5) return "Maestro de Bestias";
  return titles[level] || titles[1];
}
/** Bonos de mascota por nivel: +5 HP y +2 DMG por nivel sobre 1. */
export function petBonusesForLevel(level) {
  return { hpBonus: Math.max(0, level - 1) * 5, dmgBonus: Math.max(0, level - 1) * 2 };
}

function emptyGuest() {
  return { xp: 0, stats: { battles: 0, wins: 0, losses: 0 }, history: [] };
}

export class ProfileManager {
  constructor() {
    /** @type {{ loggedIn: boolean, username: string, token: string|null, profile: object|null }} */
    this.state = { loggedIn: false, username: "", token: null, profile: null };
    /** @type {(state: object) => void} */
    this.onChange = null;
  }

  // —— Persistencia local ——
  saveSession(token, username) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, username);
  }
  clearSession() {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  /**
   * Inicializa: intenta restaurar sesión guardada; si no hay, modo invitado.
   */
  async init() {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const username = localStorage.getItem(STORAGE_KEY_USER);
    if (token && username) {
      try {
        const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          this.state = { loggedIn: true, username, token, profile: data.profile };
          return this.state;
        }
      } catch { /* servidor no disponible → invitado */ }
      // Token inválido/expirado
      this.clearSession();
    }
    this.ensureGuest();
    return this.state;
  }

  ensureGuest() {
    if (!localStorage.getItem(STORAGE_KEY_GUEST)) {
      localStorage.setItem(STORAGE_KEY_GUEST, JSON.stringify(emptyGuest()));
    }
    const guest = JSON.parse(localStorage.getItem(STORAGE_KEY_GUEST));
    const level = levelForXp(guest.xp);
    this.state = {
      loggedIn: false,
      username: "Invitado",
      token: null,
      profile: {
        username: "Invitado",
        guest: true,
        xp: guest.xp,
        level,
        title: titleForLevel(level),
        xpPrev: [0, 200, 500, 1000, 1600][level - 1] ?? 1600 + (level - 5) * 1000,
        xpForNext: level >= 5 ? null : [200, 500, 1000, 1600][level - 1],
        stats: {
          ...guest.stats,
          winrate: guest.stats.battles > 0 ? Math.round((guest.stats.wins / guest.stats.battles) * 100) : 0,
        },
        history: guest.history.slice(-5),
      },
    };
  }

  logout() {
    this.clearSession();
    this.ensureGuest();
    this._notify();
  }

  applyServerProfile(profile) {
    if (!profile) return;
    this.state.loggedIn = true;
    this.state.profile = profile;
    this.state.username = profile.username;
    this._notify();
  }

  // —— Reporte de resultados (online lo maneja el servidor; solo/invitado es local) ——
  /**
   * @param {'win'|'loss'|'draw'} result
   * @param {{ pet?: string, opponent?: string, vsAI?: boolean, difficulty?: string }} opts
   * @returns {Promise<{xpGain:number, leveledUp:boolean, newLevel?:number, title?:string}|null>}
   */
  async reportMatch(result, { pet, opponent, vsAI = true, difficulty = "normal" } = {}) {
    // Autenticado vs IA → servidor
    if (this.state.loggedIn && this.state.token && vsAI) {
      try {
        const res = await fetch("/api/report_match", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.state.token}` },
          body: JSON.stringify({ result, pet, opponent, vsAI, difficulty }),
        });
        if (res.ok) {
          const data = await res.json();
          this.applyServerProfile(data.newProfile);
          return { xpGain: data.xpGain, leveledUp: data.leveledUp, newLevel: data.newProfile.level, title: data.newProfile.title };
        }
      } catch { /* cae a local */ }
    }

    // Local (invitado o fallback offline)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_GUEST) || "null") || emptyGuest();
    raw.stats.battles++;
    let xpGain = result === "win" ? (difficulty === "dificil" ? 150 : 100) : 35;
    if (result === "loss" || result === "draw") raw.stats.losses += result === "loss" ? 1 : 0;
    if (result === "win") raw.stats.wins++;
    else if (result === "draw") { /* empate no suma W/L */ xpGain = 35; }
    raw.xp += xpGain;
    raw.history.push({ result, pet: pet || "?", opponent: opponent || "?", vsAI, difficulty, date: new Date().toISOString() });
    if (raw.history.length > 15) raw.history = raw.history.slice(-15);
    localStorage.setItem(STORAGE_KEY_GUEST, JSON.stringify(raw));

    const beforeLevel = this.state.profile?.level || 1;
    this.ensureGuest();
    const leveledUp = this.state.profile.level > beforeLevel;
    this._notify();
    return { xpGain, leveledUp, newLevel: this.state.profile.level, title: this.state.profile.title };
  }

  /** Bonos que aplican a la mascota del jugador actual. */
  getPetBonuses() {
    const lvl = this.state.profile?.level || 1;
    return petBonusesForLevel(lvl);
  }

  /** Aplica el resultado recibido del servidor tras un combate online. */
  handleServerMatchEnd(payload) {
    if (payload.profile && payload.profile.username) {
      this.applyServerProfile(payload.profile);
    } else if (!this.state.loggedIn) {
      // Invitado en partida online: progreso en localStorage
      const result = payload.winner === gameStateId() ? "win" : payload.winner === "draw" ? "draw" : "loss";
      return this.reportMatch(result, { vsAI: false });
    }
    return null;
  }

  _notify() {
    this.onChange?.(this.state);
  }
}

// Helper para evitar dependencia circular con GameState
function gameStateId() {
  // El id del jugador se inyecta desde main.js antes de llamar a este método
  return window.__animalCombatPlayerId || "__none__";
}
