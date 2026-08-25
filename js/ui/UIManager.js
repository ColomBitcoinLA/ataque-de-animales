/** @typedef {'SELECCION' | 'MAPA' | 'COMBATE' | 'FIN'} GamePhase */

const TIPOS_ATAQUE = [
  { nombre: "FUEGO", emoji: "🔥", id: "botonFuego" },
  { nombre: "AGUA", emoji: "💧", id: "botonAgua" },
  { nombre: "TIERRA", emoji: "🌱", id: "botonTierra" },
];

const FUERZA_ATAQUES = {
  FUEGO: "TIERRA",
  AGUA: "FUEGO",
  TIERRA: "AGUA",
};

export { TIPOS_ATAQUE, FUERZA_ATAQUES };

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

    /** @type {HTMLButtonElement[]} */
    this.botonesAtaques = [];

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
   * @param {{ id: string }[]} ataques
   * @param {(ataqueNombre: string, emoji: string) => void} onAttack
   */
  renderAttackButtons(ataques, onAttack) {
    if (!this.contenedorAtaques) return;
    this.contenedorAtaques.innerHTML = "";
    this.botonesAtaques = [];

    for (const ataqueId of ataques) {
      const info = TIPOS_ATAQUE.find((a) => a.id === ataqueId.id);
      if (!info) continue;
      const boton = document.createElement("button");
      boton.textContent = info.emoji;
      boton.id = info.id;
      boton.classList.add("botonAtaque");
      boton.addEventListener("click", (e) => {
        const target = /** @type {HTMLButtonElement} */ (e.currentTarget);
        if (target.disabled) return;
        target.disabled = true;
        target.style.opacity = "0.5";
        onAttack(info.nombre, info.emoji);
      });
      this.botonesAtaques.push(boton);
      this.contenedorAtaques.appendChild(boton);
    }
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
   */
  addAttackLine(side, n, emoji) {
    const container = side === "jugador" ? this.ataqueDelJugador : this.ataqueDelEnemigo;
    if (!container) return;
    const p = document.createElement("p");
    p.classList.add("ataque-individual");
    p.innerHTML = `⚔️ Ataque ${n}: ${emoji}`;
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
    return { width, height };
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
}
