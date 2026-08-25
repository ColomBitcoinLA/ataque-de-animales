/**
 * Cliente WebSocket con reconexión automática y eventos tipados.
 */
export class NetworkClient {
  /**
   * @param {string} [url]
   */
  constructor(url) {
    this.url = url || this._defaultUrl();
    /** @type {WebSocket | null} */
    this.ws = null;
    this.playerId = "";
    this.connected = false;
    this._intentionalClose = false;
    this._retry = 0;
    this._maxRetry = 10;
    this._retryTimer = 0;
    this._clientPingTimer = 0;
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  _defaultUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const host = location.host || "localhost:8080";
    return `${proto}//${host}`;
  }

  /**
   * @param {string} event
   * @param {Function} fn
   */
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this._handlers.get(event)?.delete(fn);
  }

  /**
   * @param {string} event
   * @param {unknown} payload
   */
  _emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[NetworkClient] handler ${event}`, e);
      }
    }
  }

  connect() {
    this._intentionalClose = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.error("[NetworkClient] connect fail", e);
      this._scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.connected = true;
      this._retry = 0;
      this._emit("open", { id: this.playerId });
      this._startClientPing();
    });

    this.ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const { type, payload } = msg;
      if (type === "welcome" && payload?.id) {
        this.playerId = payload.id;
      }
      if (type === "pong") return;
      if (type === "ping") {
        this.emit("ping", { t: Date.now() });
        return;
      }
      this._emit(type, payload);
      this._emit("message", msg);
    });

    this.ws.addEventListener("close", () => {
      this.connected = false;
      this._stopClientPing();
      this._emit("close", {});
      if (!this._intentionalClose) this._scheduleReconnect();
    });

    this.ws.addEventListener("error", () => {
      this._emit("error", { message: "WebSocket error" });
    });
  }

  _startClientPing() {
    this._stopClientPing();
    this._clientPingTimer = window.setInterval(() => {
      this.emit("ping", { t: Date.now() });
    }, 10_000);
  }

  _stopClientPing() {
    if (this._clientPingTimer) {
      clearInterval(this._clientPingTimer);
      this._clientPingTimer = 0;
    }
  }

  _scheduleReconnect() {
    if (this._retry >= this._maxRetry) {
      this._emit("reconnect_failed", { attempts: this._retry });
      return;
    }
    const delay = Math.min(1000 * 2 ** this._retry, 15_000);
    this._retry += 1;
    clearTimeout(this._retryTimer);
    this._retryTimer = window.setTimeout(() => {
      this._emit("reconnecting", { attempt: this._retry, delay });
      this.connect();
    }, delay);
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} [payload]
   */
  emit(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  /** @param {{ animal: string, x?: number, y?: number }} data */
  join(data) {
    return this.emit("join", data);
  }

  /** @param {number} x @param {number} y */
  move(x, y) {
    return this.emit("move", { x, y });
  }

  /** @param {{ targetId?: string, enemyName?: string }} data */
  startCombat(data) {
    return this.emit("start_combat", data);
  }

  disconnect() {
    this._intentionalClose = true;
    this._stopClientPing();
    clearTimeout(this._retryTimer);
    if (this.ws) this.ws.close();
    this.ws = null;
    this.connected = false;
  }
}
