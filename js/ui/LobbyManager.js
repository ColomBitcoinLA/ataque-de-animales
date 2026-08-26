/**
 * Gestor de UI para la pantalla de Lobby / Menú principal.
 */
export class LobbyManager {
  constructor() {
    this.sectionLobby = document.getElementById("lobby-section");
    this.btnQuickMatch = document.getElementById("btn-quick-match");
    this.btnCreateRoom = document.getElementById("btn-create-room");
    this.btnJoinRoom = document.getElementById("btn-join-room");
    this.btnSinglePlayer = document.getElementById("btn-single-player");
    this.roomCodeDisplay = document.getElementById("room-code-display");
    this.roomCodeInput = document.getElementById("room-code-input");
    this.btnConfirmJoin = document.getElementById("btn-confirm-join");
    this.lobbyStatus = document.getElementById("lobby-status");
    this.difficultySelector = document.getElementById("difficulty-selector");
    this.btnStartSolo = document.getElementById("btn-start-solo");
    this.cancelMatchBtn = document.getElementById("btn-cancel-match");

    /** @type {(mode: string, opts?: object) => void} */
    this._onAction = null;

    this.bindEvents();
  }

  /**
   * Registra callback para acciones del lobby.
   * @param {(mode: string, opts?: object) => void} fn
   */
  onAction(fn) { 
    this._onAction = fn; 
  }

  _emit(mode, opts = {}) { 
    if (this._onAction) {
      this._onAction(mode, opts); 
    }
  }

  bindEvents() {
    this.btnQuickMatch?.addEventListener("click", () => {
      this._hideSubPanels();
      this._emit("quick_match");
    });

    this.btnCreateRoom?.addEventListener("click", () => {
      this._hideSubPanels();
      this._emit("create_room");
    });

    this.btnJoinRoom?.addEventListener("click", () => {
      const isVisible = !this.roomCodeInput?.classList.contains("hidden");
      this._hideSubPanels();
      if (!isVisible) {
        this.roomCodeInput?.classList.remove("hidden");
        this.btnConfirmJoin?.classList.remove("hidden");
        this.roomCodeInput?.focus();
      }
    });

    this.btnConfirmJoin?.addEventListener("click", () => {
      const code = this.roomCodeInput?.value?.trim().toUpperCase();
      if (code && code.length === 4) {
        this._emit("join_room", { code });
      } else {
        this.setStatus("⚠️ El código debe tener 4 caracteres (ej: K9X2)");
      }
    });

    this.roomCodeInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.btnConfirmJoin?.click();
      }
    });

    this.btnSinglePlayer?.addEventListener("click", () => {
      const isVisible = !this.difficultySelector?.classList.contains("hidden");
      this._hideSubPanels();
      if (!isVisible) {
        this.difficultySelector?.classList.remove("hidden");
      }
    });

    this.btnStartSolo?.addEventListener("click", () => {
      const checkedInput = document.querySelector('input[name="difficulty"]:checked');
      const diff = checkedInput?.value || "normal";
      this._emit("single_player", { difficulty: diff });
    });

    this.cancelMatchBtn?.addEventListener("click", () => {
      this._emit("cancel_match");
    });
  }

  _hideSubPanels() {
    this.roomCodeDisplay?.classList.add("hidden");
    this.difficultySelector?.classList.add("hidden");
    this.roomCodeInput?.classList.add("hidden");
    this.btnConfirmJoin?.classList.add("hidden");
    this.cancelMatchBtn?.classList.add("hidden");
    this.setStatus("");
  }

  show() {
    if (this.sectionLobby) this.sectionLobby.style.display = "flex";
    this._hideSubPanels();
  }

  hide() {
    if (this.sectionLobby) this.sectionLobby.style.display = "none";
  }

  /** @param {string} msg */
  setStatus(msg) { 
    if (this.lobbyStatus) this.lobbyStatus.textContent = msg; 
  }

  showRoomCode(code) {
    if (this.roomCodeDisplay) {
      this.roomCodeDisplay.classList.remove("hidden");
      const span = this.roomCodeDisplay.querySelector(".room-code-value");
      if (span) {
        span.textContent = code;
        span.setAttribute("data-code", code);
      }
    }
  }

  showMatchmaking() {
    this.setStatus("🔍 Buscando oponente en línea...");
    this.cancelMatchBtn?.classList.remove("hidden");
  }
}
