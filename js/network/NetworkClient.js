/**
 * Cliente WebSocket con reconexión automática y eventos tipados.
 */
export class NetworkClient {
  constructor(url) {
    this.url = url || this._defaultUrl();
    this.ws = null;
    this.playerId = "";
    this.authToken = localStorage.getItem("animalcombat_token") || null;
    this.connected = false;
    this._intentionalClose = false;
    this._retry = 0;
    this._maxRetry = 10;
    this._retryTimer = 0;
    this._clientPingTimer = 0;
    this._handlers = new Map();
  }

  _defaultUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host || "localhost:8080"}`;
  }

  /** Actualiza el token usado en el próximo handshake. @param {string|null} token */
  setAuthToken(token) {
    this.authToken = token;
  }

  _buildUrl() {
    if (!this.authToken) return this.url;
    const sep = this.url.includes("?") ? "&" : "?";
    return `${this.url}${sep}token=${encodeURIComponent(this.authToken)}`;
  }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this._handlers.get(event)?.delete(fn);
  }

  _emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) { try { fn(payload); } catch (e) { console.error(`[Net] ${event}`, e); } }
  }

  connect() {
    this._intentionalClose = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    try { this.ws = new WebSocket(this._buildUrl()); } catch { this._scheduleReconnect(); return; }

    this.ws.addEventListener("open", () => { this.connected = true; this._retry = 0; this._emit("open", {}); this._startClientPing(); });
    this.ws.addEventListener("message", (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      const { type, payload } = msg;
      if (type === "welcome" && payload?.id) {
        this.playerId = payload.id;
        window.__animalCombatPlayerId = payload.id;
      }
      if (type === "pong") return;
      if (type === "ping") { this.emit("ping", { t: Date.now() }); return; }
      this._emit(type, payload);
      this._emit("message", msg);
    });
    this.ws.addEventListener("close", () => { this.connected = false; this._stopClientPing(); this._emit("close", {}); if (!this._intentionalClose) this._scheduleReconnect(); });
    this.ws.addEventListener("error", () => this._emit("error", {}));
  }

  _startClientPing() { this._stopClientPing(); this._clientPingTimer = setInterval(() => this.emit("ping", { t: Date.now() }), 10_000); }
  _stopClientPing() { if (this._clientPingTimer) { clearInterval(this._clientPingTimer); this._clientPingTimer = 0; } }

  _scheduleReconnect() {
    if (this._retry >= this._maxRetry) { this._emit("reconnect_failed", {}); return; }
    const delay = Math.min(1000 * 2 ** this._retry, 15_000);
    this._retry++;
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => { this._emit("reconnecting", { attempt: this._retry }); this.connect(); }, delay);
  }

  emit(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  // Legacy events
  join(data) { return this.emit("join", data); }
  move(x, y) { return this.emit("move", { x, y }); }
  startCombat(data) { return this.emit("start_combat", data); }

  // Room events
  createRoom() { return this.emit("create_room"); }
  joinRoom(code) { return this.emit("join_room", { code }); }
  quickMatch() { return this.emit("quick_match"); }
  playerReady(animal) { return this.emit("player_ready", { animal }); }
  submitAttack(attack, charged, move) { return this.emit("submit_attack", { attack, charged, move }); }
  leaveRoom() { return this.emit("leave_room"); }
  cancelMatch() { return this.emit("leave_room"); }

  disconnect() { this._intentionalClose = true; this._stopClientPing(); clearTimeout(this._retryTimer); if (this.ws) this.ws.close(); this.ws = null; this.connected = false; }
}
