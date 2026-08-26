/** @typedef {'LOBBY' | 'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

import { TIPOS_ELEMENTALES, getEffectForCharged } from "../core/typeChart.js";

const TIPOS_ATAQUE = TIPOS_ELEMENTALES.map((t) => ({
  nombre: t.nombre,
  emoji: t.emoji,
  id: "boton" + t.nombre.charAt(0) + t.nombre.slice(1).toLowerCase(),
  tooltip: t.tooltip,
}));

const STATUS_EFFECTS = {
  QUEMADO: { emoji: "🔥", label: "Quemado", color: "#ff5722", desc: "Daño residual de 8 HP por turno" },
  CONGELADO: { emoji: "❄️", label: "Congelado", color: "#00bcd4", desc: "Reduce daño recibido un 25%" },
  ENVENENADO: { emoji: "🌱", label: "Envenenado", color: "#8bc34a", desc: "Reduce la efectividad del ataque rival" },
  PARALIZADO: { emoji: "⚡", label: "Paralizado", color: "#ffdd44", desc: "Reduce daño saliente un 25%" },
  DRAGONICO: { emoji: "🐉", label: "Aterrado", color: "#ab47bc", desc: "Reduce daño recibido un 25%" },
  NINGUNO: { emoji: "", label: "", color: "transparent", desc: "" },
};

export { TIPOS_ATAQUE, STATUS_EFFECTS, getEffectForCharged };

/**
 * Manejador centralizado de vistas, botones y mensajes.
 */
export class UIManager {
  constructor() {
    this.sectionLobby = document.getElementById("lobby-section");
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

    this._onMoveStart = null;
    this._onMoveEnd = null;

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
    this._hide(this.sectionLobby);
    this._hide(this.sectionSeleccionarMascota);
    this._hide(this.sectionVerMapa);
    this._hide(this.sectionSeleccionarAtaque);
    this._hide(this.sectionReiniciar);
    document.body.classList.remove("mapa-activo");

    switch (phase) {
      case "LOBBY":
        this._show(this.sectionLobby, "flex");
        break;
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

    const elementMap = {
      Neptuno: { icon: "💧", tipo: "Agua", cssClass: "elem-agua" },
      Tierrudo: { icon: "🌱", tipo: "Tierra", cssClass: "elem-tierra" },
      Salamander: { icon: "🔥", tipo: "Fuego", cssClass: "elem-fuego" },
    };

    for (const animal of animales) {
      const elemInfo = elementMap[animal.nombre] || { icon: "🐾", tipo: "Normal", cssClass: "" };
      const label = document.createElement("label");
      label.className = `tarjeta-animal ${elemInfo.cssClass}`;
      label.innerHTML = `
        <div class="tarjeta-header">
          <span class="nombre-animal">${animal.nombre}</span>
          <span class="tipo-badge">${elemInfo.icon} ${elemInfo.tipo}</span>
        </div>
        <div class="tarjeta-img-wrapper">
          <img src="${animal.foto}" alt="${animal.nombre}"/>
        </div>
        <input type="radio" name="mascota" value="${animal.nombre}" id="${animal.nombre}"/>
      `;

      // Selección visual dinámica al hacer click
      label.addEventListener("click", () => {
        document.querySelectorAll(".tarjeta-animal").forEach(c => c.classList.remove("seleccionada"));
        label.classList.add("seleccionada");
      });

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

      // Botón básico (0 AP)
      const btnBasic = document.createElement("button");
      btnBasic.type = "button";
      btnBasic.id = info.id;
      btnBasic.classList.add("botonAtaque", `btn-${info.nombre.toLowerCase()}`);
      btnBasic.innerHTML = `<span class="btn-icon">${info.emoji}</span> <span class="btn-label">Básico (0 AP)</span>`;
      btnBasic.setAttribute("data-tooltip", `${info.nombre} Básico | Costo: 0 AP\n${info.tooltip.split('\n')[0]}`);
      
      btnBasic.addEventListener("click", () => {
        if (btnBasic.disabled) return;
        btnBasic.disabled = true;
        btnBasic.style.opacity = "0.5";
        btnCharged.disabled = true;
        btnCharged.style.opacity = "0.5";
        onAttack(info.nombre, info.emoji, false);
      });

      // Botón cargado (2 AP)
      const btnCharged = document.createElement("button");
      btnCharged.type = "button";
      btnCharged.classList.add("botonAtaque", "boton-cargado", `btn-${info.nombre.toLowerCase()}-cargado`);
      btnCharged.innerHTML = `<span class="btn-icon">${info.emoji}⚡</span> <span class="btn-label">Cargado (${chargedCost} AP)</span>`;
      btnCharged.setAttribute("data-tooltip", `⚡ ${info.nombre} CARGADO | Costo: ${chargedCost} AP\n${info.tooltip.split('\n')[1] || info.tooltip}`);
      
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
        btn.style.opacity = btn.disabled ? "0.45" : "1";
      } else {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    }
  }

  /**
   * Renderiza los 4 botones del loadout de habilidades.
   * @param {{ type: string, nombre: string, costo: number, element: string|null, emoji: string }[]} moves
   * @param {(moveType: string, element: string|null) => void} onAction
   * @param {() => number} getAP
   */
  renderSkillButtons(moves, onAction, getAP) {
    if (!this.contenedorAtaques) return;
    this.contenedorAtaques.innerHTML = "";
    this.botonesAtaques = [];

    for (const mv of moves) {
      const info = mv.element ? TIPOS_ATAQUE.find((t) => t.nombre === mv.element) : null;
      const emoji = mv.emoji + (info ? ` ${info.emoji}` : "");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `botonAtaque skill-btn skill-${mv.type}`;
      if (info) btn.classList.add(`btn-${info.nombre.toLowerCase()}`);
      btn.dataset.cost = String(mv.costo);
      btn.dataset.move = mv.type;
      btn.innerHTML = `<span class="btn-icon">${emoji}</span> <span class="btn-label">${mv.nombre} (${mv.costo} AP)</span>`;
      btn.setAttribute("data-tooltip", `${mv.nombre} | Costo: ${mv.costo} AP\n${info ? info.tooltip.split("\n")[0] : "Reduce el daño recibido del turno en un 50%"}`);

      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        onAction(mv.type, mv.element);
      });

      this.botonesAtaques.push(btn);
      this.contenedorAtaques.appendChild(btn);
    }
    this._refreshSkillStates(getAP);
  }

  /**
   * @param {() => number} getAP
   */
  _refreshSkillStates(getAP) {
    const ap = getAP();
    for (const btn of this.botonesAtaques) {
      const cost = parseInt(btn.dataset.cost || "0", 10);
      btn.disabled = ap < cost;
      btn.style.opacity = btn.disabled ? "0.45" : "1";
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
      if (i < current) {
        orb.classList.add("ap-active");
      } else {
        orb.classList.add("ap-empty");
      }
      this.apDisplay.appendChild(orb);
    }
  }

  /**
   * Actualiza barra de HP con porcentaje y animación suave.
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
    text.textContent = `${hp} / ${maxHp} HP`;
    fill.classList.remove("hp-high", "hp-mid", "hp-low");
    if (pct > 55) fill.classList.add("hp-high");
    else if (pct > 25) fill.classList.add("hp-mid");
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
    badge.setAttribute("title", info.desc);
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
    this.sectionMensajes.scrollTop = this.sectionMensajes.scrollHeight;
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
    const p = document.createElement("div");
    p.classList.add("ataque-individual");
    if (extraClass) p.classList.add(extraClass);
    p.innerHTML = `<span class="atk-badge">R${n}</span> <span class="atk-emoji">${emoji}</span> <span class="atk-text">Ataque ${n}</span>`;
    container.appendChild(p);
    container.scrollTop = container.scrollHeight;
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
    const p = document.createElement("div");
    p.classList.add("ataque-individual", "ataque-cargado-line");
    p.innerHTML = `<span class="atk-badge">⚡ R${n}</span> <span class="atk-emoji">${emoji}</span> <span class="atk-text">CARGADO (${statusLabel})</span>`;
    container.appendChild(p);
    container.scrollTop = container.scrollHeight;
  }

  setScores(j, e) {
    if (this.spanVidasJugador) this.spanVidasJugador.innerHTML = `${j} rondas ganadas`;
    if (this.spanVidasEnemigo) this.spanVidasEnemigo.innerHTML = `${e} rondas ganadas`;
  }

  setPetNames(jugador, enemigo) {
    if (this.spanMascotaJugador) this.spanMascotaJugador.innerHTML = jugador || "Jugador";
    if (this.spanMascotaEnemigo) this.spanMascotaEnemigo.innerHTML = enemigo || "Enemigo";
  }

  /**
   * Ajusta el canvas de forma proporcional a la pantalla.
   * @param {number} [maxWidth=600]
   * @param {number} [aspectW=800]
   * @param {number} [aspectH=700]
   */
  resizeCanvas(maxWidth = 600, aspectW = 800, aspectH = 700) {
    let width = Math.min(window.innerWidth - 40, maxWidth);
    if (width < 280) width = 280;
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
