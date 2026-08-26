/**
 * Modal de Autenticación (Iniciar Sesión / Registro) con pestañas.
 */
export class AuthModal {
  /**
   * @param {(authState: { loggedIn: boolean, username?: string, profile?: object }) => void} onAuthChanged
   */
  constructor(onAuthChanged) {
    this.onAuthChanged = onAuthChanged;
    this.modal = null;
    this._buildDOM();
  }

  _buildDOM() {
    this.modal = document.createElement("div");
    this.modal.id = "auth-modal";
    this.modal.className = "auth-modal hidden";
    this.modal.innerHTML = `
      <div class="auth-modal-backdrop"></div>
      <div class="auth-modal-box">
        <button type="button" class="auth-close">✕</button>
        <h2 class="auth-title">⚔️ Animal Combat</h2>
        <div class="auth-tabs">
          <button type="button" class="auth-tab active" data-tab="login">Iniciar Sesión</button>
          <button type="button" class="auth-tab" data-tab="register">Registrarse</button>
        </div>
        <form class="auth-form" id="auth-form">
          <input type="text" id="auth-username" placeholder="Usuario (3-16 caracteres)" maxlength="16" autocomplete="username" />
          <input type="password" id="auth-password" placeholder="Contraseña (mín. 4)" autocomplete="current-password" />
          <p id="auth-message" class="auth-message"></p>
          <button type="submit" id="auth-submit" class="animarBoton auth-submit-btn">Entrar</button>
        </form>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.modal.querySelector(".auth-close").addEventListener("click", () => this.close());
    this.modal.querySelector(".auth-modal-backdrop").addEventListener("click", () => this.close());
    this.modal.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
    this.modal.querySelector("#auth-form").addEventListener("submit", (e) => this._onSubmit(e));
  }

  switchTab(tab) {
    this.modal.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    this._currentTab = tab;
    const submit = this.modal.querySelector("#auth-submit");
    submit.textContent = tab === "login" ? "Entrar" : "Crear Cuenta";
    this.setMessage("");
  }

  open(tab = "login") {
    this.switchTab(tab);
    this.modal.classList.remove("hidden");
    setTimeout(() => this.modal.querySelector("#auth-username")?.focus(), 50);
  }

  close() {
    this.modal.classList.add("hidden");
  }

  get isOpen() {
    return !this.modal.classList.contains("hidden");
  }

  /** @param {string} msg @param {boolean} [isError=true] */
  setMessage(msg, isError = true) {
    const el = this.modal.querySelector("#auth-message");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("auth-error", isError);
    el.classList.toggle("auth-success", !isError);
  }

  async _onSubmit(e) {
    e.preventDefault();
    const username = this.modal.querySelector("#auth-username")?.value.trim();
    const password = this.modal.querySelector("#auth-password")?.value;
    if (!username || !password) { this.setMessage("Completa usuario y contraseña"); return; }

    const btn = this.modal.querySelector("#auth-submit");
    btn.disabled = true;
    try {
      const endpoint = this._currentTab === "register" ? "/api/register" : "/api/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        this.setMessage(data.error || "Error de autenticación");
        return;
      }
      this.setMessage(`✅ ¡Bienvenido, ${data.profile.username}!`, false);
      setTimeout(() => {
        this.close();
        this.onAuthChanged({ loggedIn: true, username: data.profile.username, token: data.token, profile: data.profile });
      }, 600);
    } catch {
      this.setMessage("Error de conexión con el servidor");
    } finally {
      btn.disabled = false;
    }
  }
}
