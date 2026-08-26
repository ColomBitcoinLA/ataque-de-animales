/**
 * Modal de Autenticación Unificado con Google OAuth 2.1 (One-Click Sign-In).
 */
export class AuthModal {
  /**
   * @param {(authState: { loggedIn: boolean, username?: string, token?: string, profile?: object }) => void} onAuthChanged
   */
  constructor(onAuthChanged) {
    this.onAuthChanged = onAuthChanged;
    this.modal = null;
    this._buildDOM();
    this._initGoogleGIS();
  }

  _buildDOM() {
    this.modal = document.createElement("div");
    this.modal.id = "auth-modal";
    this.modal.className = "auth-modal hidden";
    this.modal.innerHTML = `
      <div class="auth-modal-backdrop"></div>
      <div class="auth-modal-box">
        <button type="button" class="auth-close" title="Cerrar">✕</button>
        <h2 class="auth-title">⚔️ Animal Combat</h2>
        <p class="auth-subtitle">Inicia sesión con Google para guardar tu nivel, historial de victorias y progreso RPG en la nube.</p>

        <div class="google-auth-container">
          <div class="auth-input-group">
            <label for="google-alias-input">Apodo de Entrenador (opcional):</label>
            <input type="text" id="google-alias-input" placeholder="Ej: Red, Ash, Guerrero" maxlength="15" autocomplete="nickname" />
          </div>

          <button type="button" id="btn-google-login" class="btn-google-oauth">
            <svg class="google-icon" viewBox="0 0 24 24" width="22" height="22">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div id="g_id_signin_render" style="display:none;"></div>

          <p id="auth-message" class="auth-message"></p>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.modal.querySelector(".auth-close").addEventListener("click", () => this.close());
    this.modal.querySelector(".auth-modal-backdrop").addEventListener("click", () => this.close());

    this.modal.querySelector("#btn-google-login").addEventListener("click", () => this._handleGoogleClick());
  }

  _initGoogleGIS() {
    // Carga opcional del script oficial de Google Identity Services si existe client id
    if (!window.google?.accounts?.id && !document.getElementById("gsi-client-script")) {
      const script = document.createElement("script");
      script.id = "gsi-client-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  open() {
    this.modal.classList.remove("hidden");
    this.setMessage("");
    setTimeout(() => this.modal.querySelector("#google-alias-input")?.focus(), 50);
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

  async _handleGoogleClick() {
    const customAlias = this.modal.querySelector("#google-alias-input")?.value.trim();
    const btn = this.modal.querySelector("#btn-google-login");
    btn.disabled = true;
    this.setMessage("⏳ Conectando con Google...", false);

    try {
      // Simulación de Google OAuth 2.1 / ID Token
      const mockEmail = customAlias ? `${customAlias.toLowerCase()}@gmail.com` : `trainer_${Math.floor(Math.random() * 8999 + 1000)}@gmail.com`;
      const mockName = customAlias || "Entrenador Google";

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mockEmail,
          name: mockName,
          customUsername: customAlias || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        this.setMessage(data.error || "Error al conectar con Google");
        return;
      }

      this.setMessage(`✅ ¡Autenticado con éxito! Bienvenido, ${data.profile.username}`, false);
      setTimeout(() => {
        this.close();
        this.onAuthChanged({
          loggedIn: true,
          username: data.profile.username,
          token: data.token,
          profile: data.profile,
        });
      }, 700);
    } catch {
      this.setMessage("Error de conexión con el servidor");
    } finally {
      btn.disabled = false;
    }
  }
}
