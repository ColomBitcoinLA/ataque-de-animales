/**
 * Modal de Perfil de Jugador (Estadísticas, Historial, Rango y Bonos RPG).
 */
export class ProfileModal {
  /**
   * @param {import('./ProfileManager.js').ProfileManager} profileManager
   * @param {() => void} onLogout
   */
  constructor(profileManager, onLogout) {
    this.profiles = profileManager;
    this.onLogout = onLogout;
    this.modal = null;
    this._buildDOM();
  }

  _buildDOM() {
    this.modal = document.createElement("div");
    this.modal.id = "profile-modal-view";
    this.modal.className = "auth-modal hidden";
    this.modal.innerHTML = `
      <div class="auth-modal-backdrop"></div>
      <div class="auth-modal-box profile-modal-box">
        <button type="button" class="auth-close" id="profile-modal-close" title="Cerrar">✕</button>
        <div id="profile-modal-content"></div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.modal.querySelector("#profile-modal-close").addEventListener("click", () => this.close());
    this.modal.querySelector(".auth-modal-backdrop").addEventListener("click", () => this.close());
  }

  open() {
    this.render();
    this.modal.classList.remove("hidden");
  }

  close() {
    this.modal.classList.add("hidden");
  }

  render() {
    const container = this.modal.querySelector("#profile-modal-content");
    const p = this.profiles.state.profile;
    if (!p) {
      container.innerHTML = `<p style="text-align:center">No hay datos de perfil disponibles.</p>`;
      return;
    }

    let pct = 100;
    if (p.xpForNext != null) {
      const span = Math.max(1, p.xpForNext - (p.xpPrev || 0));
      pct = Math.max(0, Math.min(100, ((p.xp - (p.xpPrev || 0)) / span) * 100));
    }
    const xpLabel = p.xpForNext != null ? `${p.xp} / ${p.xpForNext} XP` : `${p.xp} XP (Nivel Máximo)`;
    const hpBonus = Math.max(0, p.level - 1) * 5;
    const dmgBonus = Math.max(0, p.level - 1) * 2;

    const histRows = (p.history || []).slice(-10).reverse().map((h) => {
      const isWin = h.result === "win";
      const isLoss = h.result === "loss";
      const badge = isWin ? "🏆 Victoria" : isLoss ? "💀 Derrota" : "🤝 Empate";
      const dateStr = h.date ? new Date(h.date).toLocaleDateString() : "";
      return `
        <div class="history-item ${h.result}">
          <div class="history-item-left">
            <span class="history-result">${badge}</span>
            <span class="history-detail">${h.pet || "?"} vs ${h.opponent || "?"} ${h.vsAI ? "(vs IA)" : "(Online 1v1)"}</span>
          </div>
          <span class="history-date">${dateStr}</span>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="profile-modal-header">
        <div class="profile-avatar-emblem">🛡️</div>
        <div>
          <h2 class="profile-name-modal">${p.guest ? "👤 Modo Invitado" : "🌐 " + p.username}</h2>
          <span class="profile-title-badge">🎖️ Nivel ${p.level} · ${p.title}</span>
        </div>
      </div>

      <div class="profile-level-row" style="margin-top:16px;">
        <span class="profile-level">Progreso Nivel ${p.level}:</span>
        <div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
        <span class="xp-text">${xpLabel}</span>
      </div>

      <div class="profile-rpg-bonuses">
        <div class="bonus-badge">💖 +${hpBonus} HP Máxima</div>
        <div class="bonus-badge">⚔️ +${dmgBonus} Daño Base</div>
      </div>

      <div class="profile-stats" style="margin-top:16px;">
        <div class="stat-box"><div class="stat-value">${p.stats.battles}</div><div class="stat-label">Batallas</div></div>
        <div class="stat-box"><div class="stat-value">${p.stats.wins}</div><div class="stat-label">Victorias</div></div>
        <div class="stat-box"><div class="stat-value">${p.stats.losses}</div><div class="stat-label">Derrotas</div></div>
        <div class="stat-box"><div class="stat-value">${p.stats.winrate}%</div><div class="stat-label">Winrate</div></div>
      </div>

      <div class="profile-history" style="margin-top:18px; max-height: 180px; overflow-y:auto;">
        <h4>📜 Historial de Batallas Recientes:</h4>
        ${histRows || "<p style='font-size:0.85rem; color:#94a3b8;'>Aún no has jugado partidas.</p>"}
      </div>

      <div style="margin-top:20px; display:flex; justify-content:space-between; gap:10px;">
        <button type="button" id="btn-close-profile-modal" class="animarBoton" style="flex:1;">Cerrar</button>
        ${!p.guest ? `<button type="button" id="btn-logout-from-profile" class="animarBoton" style="background:#e94040; border-color:#e94040; flex:1;">Cerrar Sesión</button>` : ""}
      </div>
    `;

    container.querySelector("#btn-close-profile-modal")?.addEventListener("click", () => this.close());
    container.querySelector("#btn-logout-from-profile")?.addEventListener("click", () => {
      this.close();
      this.onLogout?.();
    });
  }
}
