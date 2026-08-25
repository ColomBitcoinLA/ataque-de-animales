/** @typedef {'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

const TIPOS_ATAQUE = [
  { nombre: "FUEGO", emoji: "🔥", id: "botonFuego", tooltip: "Fuego: supera Tierra. Cargado: Quema (daño residual)." },
  { nombre: "AGUA", emoji: "💧", id: "botonAgua", tooltip: "Agua: supera Fuego. Cargado: Congela (reduce daño)." },
  { nombre: "TIERRA", emoji: "🌱", id: "botonTierra", tooltip: "Tierra: supera Agua. Cargado: Envenena (reduce ataque rival)." },
];

const FUERZA_ATAQUES = {
  FUEGO: "TIERRA",
  AGUA: "FUEGO",
  TIERRA: "AGUA",
};

const STATUS_EFFECTS = {
  QUEMADO: { emoji: "🔥", label: "Quemado", color: "#ff4400", desc: "Daño residual por turno" },
  CONGELADO: { emoji: "💧", label: "Congelado", color: "#44aaff", desc: "Reduce daño recibido 25%" },
  ENVENENADO: { emoji: "🌱", label: "Envenenado", color: "#88cc44", desc: "Reduce efectividad del ataque rival" },
  NINGUNO: { emoji: "", label: "", color: "transparent", desc: "" },
};

export { TIPOS_ATAQUE, FUERZA_ATAQUES, STATUS_EFFECTS };

/**
 * Manejador centralizado de vistas, botones y mensajes.
 */
export class UIManager {
  constructor() {
    this.sectionSeleccionarMascota = document.getElementById("seleccionar-mascota");
    this.sectionSeleccionarAtaque = document.getElementById("seleccionar-ataque");
    this.sectionVerMapa = document.getElementById("ver-mapa");
    this.sectionReiniciar = document.getElementById("reiniciar");
    this.sectionMensajes = document.getElementById("resultado");

    this.botonMascotaJugador = document.getElementById("botonMascota");
    this.botonReiniciar = document.getElementById("botonReiniciar");
    this.botonIniciarPelea = document.getElementById("botonIniciarPelea");

    this.spanMascotaJugador = document.getElementById("mascota-jugador");
    this.spanMascotaEnemigo = document.getElementById("mascota-enemigo");
    this.spanVidasJugador = document.getElementById("vidas-jugador");
    this.spanVidasEnemigo = document.getElementById("vidas-enemigo");
    this.ataqueDelJugador = document.getElementById("ataqueDelJugador");
    this.ataqueDelEnemigo = document.getElementById("ataqueDelEnemigo");

    this.contenedorTarjetas = document.getElementById("contenedor-tarjetas");
    this.contenedorAtaques = document.getElementById("contenedor-ataque");

    this.mapa = /** @type {HTMLCanvasElement} */ (document.getElementById("mapa"));
    this.lienzo = this.mapa.getContext("2d");

    this.hpBarJugador = document.getElementById("hp-bar-jugador");
    this.hpBarFillJugador = document.getElementById("hp-bar-fill-jugador");
    this.hpTextJugador = document.getElementById("hp-text-jugador");

    this.hpBarEnemigo = document.getElementById("hp-bar-enemigo");
    this.hpBarFillEnemigo = document.getElementById("hp-bar-fill-enemigo");
    this.hpTextEnemigo = document.getElementById("hp-text-enemigo");

    this.apContainer = document.getElementById("ap-container");
    this.apDisplay = document.getElementById("ap-display");

    this.statusBadgeJugador = document.getElementById("status-jugador");
    this.statusBadgeEnemigo = document.getElementById("status-enemigo");

    this.combatCanvasOverlay = document.getElementById("combat-particles-canvas");

    /** @type {HTMLButtonElement[]} */
    this.botonesAtaques = [];

    this._onChargeAttack = null;

    this._bindMovementButtons();
  }

  _bindMovementButtons() {
    const map = {
      arriba: "up",
      abajo: "down",
      izquierda: "left",
      derecha: "right",
    };
    for (const [cls, dir] of Object.entries(map)) {
      const btn = document.querySelector(`.${cls}`);
      if (!btn) continue;
      btn.removeAttribute("onmousedown");
      btn.removeAttribute("onmouseup");
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this._onMoveStart?.(dir);
      });
      btn.addEventListener("mouseup", (e) => {
        e.preventDefault();
        this._onMoveEnd?.();
      });
      btn.addEventListener("mouseleave", () => this._onMoveEnd?.());
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this._onMoveStart?.(dir);
      }, { passive: false });
      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        this._onMoveEnd?.();
      }, { passive: false });
    }
  }

  /**
   * @param {(dir: string) => void} start
   * @param {() => void} end
   */
  onMovementControls(start, end) {
    this._onMoveStart = start;
    this._onMoveEnd = end;
  }

  /**
   * @param {GamePhase} phase
   */
  showPhase(phase) {
    this._hide(this.sectionSeleccionarMascota);
    this._hide(this.sectionVerMapa);
    this._hide(this.sectionSeleccionarAtaque);
    this._hide(this.sectionReiniciar);
    document.body.classList.remove("mapa-activo");

    switch (phase) {
      case "SELECCION":
        this._show(this.sectionSeleccionarMascota, "flex");
        break;
      case "MAPA":
        this._show(this.sectionVerMapa, "flex");
        document.body.classList.add("mapa-activo");
        break;
      case "COMBATE":
        this._show(this.sectionSeleccionarAtaque, "flex");
        break;
      case "FIN":
        this._show(this.sectionSeleccionarAtaque, "flex");
        this._show(this.sectionReiniciar, "block");
        break;
    }
  }

  /**
   * @param {HTMLElement | null} el
   * @param {string} [display='flex']
   */
  _show(el, display = "flex") {
    if (el) el.style.display = display;
  }

  /** @param {HTMLElement | null} el */
  _hide(el) {
    if (el) el.style.display = "none";
  }

  /**
   * @param {{ nombre: string, foto: string }[]} animales
   */
  renderPetCards(animales) {
    if (!this.contenedorTarjetas) return;
    this.contenedorTarjetas.innerHTML = "";
    for (const animal of animales) {
      const label = document.createElement("label");
      label.className = "tarjeta-animal";
      label.innerHTML = `
        <p>${animal.nombre}</p>
        <img src="${animal.foto}" alt="${animal.nombre}"/>
        <input type="radio" name="mascota" value="${animal.nombre}" id="${animal.nombre}"/>
      `;
      this.contenedorTarjetas.appendChild(label);
    }
  }

  getSelectedPetName() {
    const input = /** @type {HTMLInputElement | null} */ (
      document.querySelector('#contenedor-tarjetas input[name="mascota"]:checked')
    );
    return input?.value || null;
  }

  /**
   * Renderiza botones de ataque con tooltip y modo cargado.
   * @param {{ id: string }[]} ataques
   * @param {(ataqueNombre: string, emoji: string, charged: boolean) => void} onAttack
   * @param {() => boolean} canCharge
   * @param {number} chargedCost
   * @param {() => number} getCurrentAP
   */
  renderAttackButtons(ataques, onAttack, canCharge, chargedCost, getCurrentAP) {
    if (!this.contenedorAtaques) return;
    this.contenedorAtaques.innerHTML = "";
    this.botonesAtaques = [];

    const seen = new Set();
    for (const ataqueId of ataques) {
      const info = TIPOS_ATAQUE.find((a) => a.id === ataqueId.id);
      if (!info || seen.has(info.id)) continue;
      seen.add(info.id);

      const wrapper = document.createElement("div");
      wrapper.classList.add("attack-btn-group");

      // Botón básico
      const btnBasic = document.createElement("button");
      btnBasic.textContent = info.emoji;
      btnBasic.id = info.id;
      btnBasic.classList.add("botonAtaque");
      btnBasic.title = info.tooltip + " (Básico: 0 AP)";
      btnBasic.dataset.tooltip = info.tooltip + " | Costo: 0 AP";
      btnBasic.addEventListener("click", () => {
        if (btnBasic.disabled) return;
        btnBasic.disabled = true;
        btnBasic.style.opacity = "0.5";
        btnCharged.disabled = true;
        btnCharged.style.opacity = "0.5";
        onAttack(info.nombre, info.emoji, false);
      });

      // Botón cargado
      const btnCharged = document.createElement("button");
      btnCharged.textContent = info.emoji + "⚡";
      btnCharged.classList.add("botonAtaque", "boton-cargado");
      btnCharged.title = `${info.tooltip} (Cargado: ${chargedCost} AP)`;
      btnCharged.dataset.tooltip = `${info.tooltip} | Cargado: ${chargedCost} AP`;
      btnCharged.addEventListener("click", () => {
        if (btnCharged.disabled) return;
        btnCharged.disabled = true;
        btnCharged.style.opacity = "0.5";
        btnBasic.disabled = true;
        btnBasic.style.opacity = "0.5";
        onAttack(info.nombre, info.emoji, true);
      });

      this.botonesAtaques.push(btnBasic, btnCharged);
      wrapper.appendChild(btnBasic);
      wrapper.appendChild(btnCharged);
      this.contenedorAtaques.appendChild(wrapper);
    }

    this._refreshAttackStates(canCharge, getCurrentAP);
  }

  /**
   * Actualiza el estado de los botones según AP actual.
   * @param {() => boolean} canCharge
   * @param {() => number} getCurrentAP
   */
  _refreshAttackStates(canCharge, getCurrentAP) {
    const ap = getCurrentAP();
    for (let i = 0; i < this.botonesAtaques.length; i++) {
      const btn = this.botonesAtaques[i];
      if (btn.classList.contains("boton-cargado")) {
        btn.disabled = ap < 2;
        btn.style.opacity = btn.disabled ? "0.4" : "1";
      } else {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    }
  }

  /**
   * Actualiza el display de AP.
   * @param {number} current
   * @param {number} max
   */
  updateAP(current, max) {
    if (!this.apDisplay) return;
    this.apDisplay.innerHTML = "";
    for (let i = 0; i < max; i++) {
      const orb = document.createElement("span");
      orb.classList.add("ap-orb");
      orb.textContent = "⚡";
      if (i < current) orb.classList.add("ap-active");
      else orb.classList.add("ap-empty");
      this.apDisplay.appendChild(orb);
    }
  }

  /**
   * Actualiza barra de HP.
   * @param {'jugador'|'enemigo'} side
   * @param {number} hp
   * @param {number} maxHp
   */
  updateHP(side, hp, maxHp) {
    const isJ = side === "jugador";
    const fill = isJ ? this.hpBarFillJugador : this.hpBarFillEnemigo;
    const text = isJ ? this.hpTextJugador : this.hpTextEnemigo;
    if (!fill || !text) return;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    fill.style.width = `${pct}%`;
    text.textContent = `${hp}/${maxHp}`;
    fill.classList.remove("hp-high", "hp-mid", "hp-low");
    if (pct > 60) fill.classList.add("hp-high");
    else if (pct > 30) fill.classList.add("hp-mid");
    else fill.classList.add("hp-low");
  }

  /**
   * Muestra badge de status effect.
   * @param {'jugador'|'enemigo'} side
   * @param {string} statusKey - clave de STATUS_EFFECTS
   */
  updateStatus(side, statusKey) {
    const badge = side === "jugador" ? this.statusBadgeJugador : this.statusBadgeEnemigo;
    if (!badge) return;
    const info = STATUS_EFFECTS[statusKey] || STATUS_EFFECTS.NINGUNO;
    if (!info.emoji) {
      badge.style.display = "none";
      return;
    }
    badge.style.display = "inline-flex";
    badge.innerHTML = `${info.emoji} ${info.label}`;
    badge.title = info.desc;
    badge.style.backgroundColor = info.color + "33";
    badge.style.borderColor = info.color;
  }

  disableAttacks() {
    this.botonesAtaques.forEach((b) => {
      b.disabled = true;
    });
  }

  /** @param {string} msg */
  setMessage(msg) {
    if (this.sectionMensajes) this.sectionMensajes.innerHTML = msg;
  }

  /** @param {string} html */
  appendMessage(html) {
    if (!this.sectionMensajes) return;
    const p = document.createElement("p");
    p.innerHTML = html;
    this.sectionMensajes.appendChild(p);
  }

  clearBattleLists() {
    if (this.ataqueDelJugador) this.ataqueDelJugador.innerHTML = "";
    if (this.ataqueDelEnemigo) this.ataqueDelEnemigo.innerHTML = "";
  }

  /**
   * @param {string} side 'jugador' | 'enemigo'
   * @param {number} n
   * @param {string} emoji
   * @param {string} [extraClass]
   */
  addAttackLine(side, n, emoji, extraClass = "") {
    const container = side === "jugador" ? this.ataqueDelJugador : this.ataqueDelEnemigo;
    if (!container) return;
    const p = document.createElement("p");
    p.classList.add("ataque-individual");
    if (extraClass) p.classList.add(extraClass);
    p.innerHTML = `⚔️ Ataque ${n}: ${emoji}`;
    container.appendChild(p);
  }

  /**
   * @param {string} side 'jugador' | 'enemigo'
   * @param {number} n
   * @param {string} emoji
   * @param {string} statusLabel - Label del efecto de estado aplicado
   */
  addChargedAttackLine(side, n, emoji, statusLabel) {
    const container = side === "jugador" ? this.ataqueDelJugador : this.ataqueDelEnemigo;
    if (!container) return;
    const p = document.createElement("p");
    p.classList.add("ataque-individual", "ataque-cargado-line");
    p.innerHTML = `⚡ ${emoji} Ataque ${n}: CARGADO → ${statusLabel}`;
    container.appendChild(p);
  }

  setScores(j, e) {
    if (this.spanVidasJugador) this.spanVidasJugador.innerHTML = String(j);
    if (this.spanVidasEnemigo) this.spanVidasEnemigo.innerHTML = String(e);
  }

  setPetNames(jugador, enemigo) {
    if (this.spanMascotaJugador) this.spanMascotaJugador.innerHTML = jugador || "";
    if (this.spanMascotaEnemigo) this.spanMascotaEnemigo.innerHTML = enemigo || "";
  }

  /**
   * Ajusta el canvas de forma proporcional a la pantalla.
   * @param {number} [maxWidth=600]
   * @param {number} [aspectW=800]
   * @param {number} [aspectH=700]
   */
  resizeCanvas(maxWidth = 600, aspectW = 800, aspectH = 700) {
    let width = Math.min(window.innerWidth - 20, maxWidth);
    if (width < 200) width = 200;
    const height = Math.round((width * aspectH) / aspectW);
    this.mapa.width = width;
    this.mapa.height = height;
    this.mapa.style.width = `${width}px`;
    this.mapa.style.height = `${height}px`;

    if (this.combatCanvasOverlay) {
      this.combatCanvasOverlay.width = width;
      this.combatCanvasOverlay.height = height;
    }

    return { width, height };
  }

  /**
   * Configura el canvas overlay para partículas de combate.
   * Se dimensiona para cubrir la sección de combate.
   */
  setupCombatOverlay() {
    if (!this.combatCanvasOverlay) return;
    const section = this.sectionSeleccionarAtaque;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    this.combatCanvasOverlay.width = rect.width || window.innerWidth;
    this.combatCanvasOverlay.height = rect.height || window.innerHeight;
  }

  /**
   * @param {string} mensajeFinal
   */
  showFinalMessage(mensajeFinal) {
    const pFinal = document.createElement("p");
    pFinal.innerHTML = mensajeFinal;
    pFinal.classList.add("mensaje-final");
    this.sectionMensajes?.appendChild(pFinal);
  }

  /**
   * Shake el contenedor de combate.
   * @param {number} intensity - 1..10
   * @param {number} duration - ms
   */
  triggerShakeCSS(intensity = 6, duration = 300) {
    const el = this.sectionSeleccionarAtaque;
    if (!el) return;
    el.style.setProperty("--shake-intensity", `${intensity}px`);
    el.style.setProperty("--shake-duration", `${duration}ms`);
    el.classList.remove("screen-shake");
    void el.offsetWidth; // force reflow
    el.classList.add("screen-shake");
    setTimeout(() => el.classList.remove("screen-shake"), duration);
  }
}
