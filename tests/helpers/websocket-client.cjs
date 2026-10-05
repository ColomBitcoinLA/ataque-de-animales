const WebSocket = require("ws");

/**
 * Creates and wraps a WebSocket client for deterministic testing.
 */
class TestWsClient {
  constructor(url) {
    this.url = url;
    this.ws = new WebSocket(url);
    this.messages = [];
    this.listeners = [];
    this.welcomePayload = null;

    this.ws.on("message", (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        parsed = { raw: data.toString() };
      }
      // Check registered waiters first
      for (let i = 0; i < this.listeners.length; i++) {
        const { predicate, resolve } = this.listeners[i];
        if (predicate(parsed)) {
          this.listeners.splice(i, 1);
          resolve(parsed);
          return;
        }
      }

      // Buffer if no waiter is currently listening for it
      this.messages.push(parsed);
    });
  }

  /**
   * Waits until the socket is open and the welcome message has arrived.
   */
  async waitReady(timeoutMs = 5000) {
    const welcomeMsg = await this.waitForMessage(
      (m) => m.type === "welcome",
      timeoutMs
    );
    this.welcomePayload = welcomeMsg.payload;
    return this.welcomePayload;
  }

  /**
   * Sends a JSON object over the WebSocket.
   */
  send(obj) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send message: WebSocket is not open (state: ${this.ws.readyState})`);
    }
    const data = typeof obj === "string" ? obj : JSON.stringify(obj);
    this.ws.send(data);
  }

  /**
   * Sends raw string/buffer data (useful for malformed JSON tests).
   */
  sendRaw(rawData) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send raw data: WebSocket is not open (state: ${this.ws.readyState})`);
    }
    this.ws.send(rawData);
  }

  /**
   * Waits for a message matching a type string or predicate function.
   */
  waitForMessage(typeOrPredicate, timeoutMs = 5000) {
    const predicate =
      typeof typeOrPredicate === "function"
        ? typeOrPredicate
        : (m) => m.type === typeOrPredicate;

    // Check already received messages that match
    const existingIndex = this.messages.findIndex(predicate);
    if (existingIndex !== -1) {
      const found = this.messages[existingIndex];
      this.messages.splice(existingIndex, 1);
      return Promise.resolve(found);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.listeners.findIndex((l) => l.resolve === resolve);
        if (idx !== -1) this.listeners.splice(idx, 1);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for message matching ${
              typeof typeOrPredicate === "string" ? typeOrPredicate : "custom predicate"
            }`
          )
        );
      }, timeoutMs);

      this.listeners.push({
        predicate,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  }

  /**
   * Closes the connection cleanly.
   */
  async close() {
    if (
      this.ws.readyState === WebSocket.CLOSED ||
      this.ws.readyState === WebSocket.CLOSING
    ) {
      return;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      this.ws.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.close();
    });
  }
}

/**
 * Connects and waits for welcome message.
 */
async function connectWs(url, timeoutMs = 5000) {
  const client = new TestWsClient(url);
  await client.waitReady(timeoutMs);
  return client;
}

module.exports = {
  TestWsClient,
  connectWs,
};
