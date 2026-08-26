/**
 * Loadout de 4 habilidades personalizables antes del combate.
 *  1. Ataque Primario Básico (0 AP)
 *  2. Ataque Elemental Cargado (2 AP)
 *  3. Movimiento de Estado / Debuff (1 AP)
 *  4. Movimiento Defensivo / Escudo (1 AP)
 */
import { TIPOS_ELEMENTALES } from "../core/typeChart.js";

const STORAGE_KEY = "animalcombat_loadout";

const DEFAULT_LOADOUT = {
  basico: "FUEGO",
  cargado: "FUEGO",
  estado: "ELECTRICO",
  escudo: null, // el escudo no necesita elemento
};

export class SkillLoadout {
  constructor() {
    this.loadout = this._load();
    this._listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LOADOUT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_LOADOUT };
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.loadout));
  }

  /** @param {(loadout: object) => void} fn */
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  setSkill(slot, value) {
    this.loadout[slot] = value;
    this._save();
    for (const fn of this._listeners) fn(this.loadout);
  }

  get() { return this.loadout; }

  /** Convierte el loadout a la lista de movimientos que usa el combate. */
  toMoves() {
    return [
      { type: "basic", slot: "basico", nombre: "Ataque Básico", costo: 0, element: this.loadout.basico, emoji: "⚔️" },
      { type: "charged", slot: "cargado", nombre: "Ataque Cargado", costo: 2, element: this.loadout.cargado, emoji: "⚡" },
      { type: "status", slot: "estado", nombre: "Debuff", costo: 1, element: this.loadout.estado, emoji: "🌀" },
      { type: "shield", slot: "escudo", nombre: "Escudo", costo: 1, element: null, emoji: "🛡️" },
    ];
  }

  /** Renderiza el panel de selección de loadout dentro de un contenedor. */
  render(container) {
    if (!container) return;
    const self = this;
    container.innerHTML = `
      <h3 class="loadout-title">⚔️ Arsenal de Habilidades</h3>
      <div class="loadout-grid">
        ${this._slotHtml("basico", "1️⃣ Ataque Básico (0 AP)")}
        ${this._slotHtml("cargado", "2️⃣ Ataque Cargado (2 AP)")}
        ${this._slotHtml("estado", "3️⃣ Movimiento Estado (1 AP)")}
        <div class="loadout-slot loadout-slot-shield">
          <span class="loadout-slot-label">4️⃣ Escudo (1 AP)</span>
          <div class="loadout-fixed">🛡️ Reduce 50% daño del turno</div>
        </div>
      </div>
    `;

    container.querySelectorAll(".loadout-select").forEach((sel) => {
      sel.addEventListener("change", (e) => self.setSkill(e.target.dataset.slot, e.target.value));
    });
  }

  _slotHtml(slot, label) {
    const opts = TIPOS_ELEMENTALES.map((t) =>
      `<option value="${t.nombre}" ${this.loadout[slot] === t.nombre ? "selected" : ""}>${t.emoji} ${t.nombre}</option>`
    ).join("");
    return `
      <div class="loadout-slot">
        <span class="loadout-slot-label">${label}</span>
        <select class="loadout-select" data-slot="${slot}">${opts}</select>
      </div>
    `;
  }
}
