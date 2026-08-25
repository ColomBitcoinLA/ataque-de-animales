const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, Jugador>} */
const jugadores = new Map();

class Jugador {
  /**
   * @param {string} id
   * @param {import("ws").WebSocket} ws
   */
  constructor(id, ws) {
    this.id = id;
    this.ws = ws;
    this.mascota = null;
    this.x = 0;
    this.y = 0;
    this.isAlive = true;
    this.lastPong = Date.now();
  }

  asignarMascota(nombre) {
    this.mascota = { nombre };
  }

  actualizarPosicion(x, y) {
    if (typeof x === "number" && Number.isFinite(x)) this.x = x;
    if (typeof y === "number" && Number.isFinite(y)) this.y = y;
  }

  toPublic() {
    return {
      id: this.id,
      mascota: this.mascota,
      x: this.x,
      y: this.y,
    };
  }
}

function send(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

function broadcast(type, payload, exceptId = null) {
  for (const jugador of jugadores.values()) {
    if (exceptId && jugador.id === exceptId) continue;
    send(jugador.ws, type, payload);
  }
}

function getEnemigos(jugadorId) {
  const enemigos = [];
  for (const j of jugadores.values()) {
    if (j.id !== jugadorId && j.mascota) {
      enemigos.push(j.toPublic());
    }
  }
  return enemigos;
}

function removeJugador(id, reason = "disconnect") {
  const jugador = jugadores.get(id);
  if (!jugador) return;
  jugadores.delete(id);
  broadcast("player_left", { id, reason }, id);
  console.log(`[WS] Jugador eliminado ${id} (${reason}). Online: ${jugadores.size}`);
}

function handleMessage(jugador, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(jugador.ws, "error", { message: "JSON inválido" });
    return;
  }

  const { type, payload = {} } = msg;
  if (!type || typeof type !== "string") {
    send(jugador.ws, "error", { message: "Evento sin type" });
    return;
  }

  switch (type) {
    case "join": {
      const nombre = typeof payload.animal === "string" ? payload.animal.trim() : "";
      if (!nombre || nombre.length > 32) {
        send(jugador.ws, "error", { message: "Nombre de mascota inválido" });
        return;
      }
      jugador.asignarMascota(nombre);
      if (typeof payload.x === "number") jugador.x = payload.x;
      if (typeof payload.y === "number") jugador.y = payload.y;

      send(jugador.ws, "joined", {
        id: jugador.id,
        enemigos: getEnemigos(jugador.id),
      });
      broadcast("player_joined", jugador.toPublic(), jugador.id);
      break;
    }

    case "move": {
      const { x, y } = payload;
      if (typeof x !== "number" || typeof y !== "number") {
        send(jugador.ws, "error", { message: "Coordenadas inválidas" });
        return;
      }
      jugador.actualizarPosicion(x, y);
      broadcast(
        "player_moved",
        { id: jugador.id, x: jugador.x, y: jugador.y, mascota: jugador.mascota },
        jugador.id
      );
      send(jugador.ws, "enemies", { enemigos: getEnemigos(jugador.id) });
      break;
    }

    case "start_combat": {
      broadcast(
        "combat_started",
        {
          attackerId: jugador.id,
          targetId: payload.targetId || null,
          enemyName: payload.enemyName || null,
        },
        null
      );
      break;
    }

    case "ping": {
      jugador.isAlive = true;
      jugador.lastPong = Date.now();
      send(jugador.ws, "pong", { t: Date.now() });
      break;
    }

    default:
      send(jugador.ws, "error", { message: `Evento desconocido: ${type}` });
  }
}

wss.on("connection", (ws) => {
  const id = randomUUID();
  const jugador = new Jugador(id, ws);
  jugadores.set(id, jugador);

  send(ws, "welcome", { id });
  console.log(`[WS] Conectado ${id}. Online: ${jugadores.size}`);

  ws.on("message", (data) => {
    handleMessage(jugador, data.toString());
  });

  ws.on("pong", () => {
    jugador.isAlive = true;
    jugador.lastPong = Date.now();
  });

  ws.on("close", () => {
    removeJugador(id, "close");
  });

  ws.on("error", () => {
    removeJugador(id, "error");
  });
});

const heartbeatTimer = setInterval(() => {
  const now = Date.now();
  for (const jugador of jugadores.values()) {
    if (now - jugador.lastPong > HEARTBEAT_TIMEOUT_MS) {
      try {
        jugador.ws.terminate();
      } catch {
        /* ignore */
      }
      removeJugador(jugador.id, "heartbeat_timeout");
      continue;
    }

    if (!jugador.isAlive) {
      try {
        jugador.ws.terminate();
      } catch {
        /* ignore */
      }
      removeJugador(jugador.id, "no_pong");
      continue;
    }

    jugador.isAlive = false;
    try {
      if (jugador.ws.readyState === jugador.ws.OPEN) {
        jugador.ws.ping();
        send(jugador.ws, "ping", { t: now });
      }
    } catch {
      removeJugador(jugador.id, "ping_fail");
    }
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on("close", () => {
  clearInterval(heartbeatTimer);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, players: jugadores.size });
});

server.listen(PORT, () => {
  console.log(`Animal Combat server en http://localhost:${PORT}`);
  console.log(`WebSocket listo (heartbeat ${HEARTBEAT_INTERVAL_MS}ms)`);
});
