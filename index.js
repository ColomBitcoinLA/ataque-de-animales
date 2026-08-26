const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 10_000;
const MAX_ROUNDS = 5;
const MAX_HP = 100;
const MAX_AP = 3;
const AP_PER_TURN = 1;
const CHARGED_COST = 2;
const BASIC_COST = 0;
const CHARGED_BASE_DMG = 30;
const BASIC_BASE_DMG = 20;
const BURN_DAMAGE = 8;
const FREEZE_DAMAGE_REDUCTION = 0.75;
const POISON_SELF_DAMAGE_MULT = 0.85;
const POISON_TARGET_VULN_MULT = 1.15;

// Matriz Elemental estilo Pokémon
const FUERZA_ATAQUES = { FUEGO: "TIERRA", AGUA: "FUEGO", TIERRA: "AGUA" };
const DEBILIDAD_ATAQUES = { FUEGO: "AGUA", AGUA: "TIERRA", TIERRA: "FUEGO" };
const AFINIDAD_ANIMAL = { Neptuno: "AGUA", Salamander: "FUEGO", Tierrudo: "TIERRA" };

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ——— Jugador ———
const jugadores = new Map();

class Jugador {
  constructor(id, ws) {
    this.id = id;
    this.ws = ws;
    this.mascota = null;
    this.x = 0;
    this.y = 0;
    this.isAlive = true;
    this.lastPong = Date.now();
    this.roomCode = null;
    this.ready = false;
  }
  asignarMascota(nombre) { this.mascota = { nombre }; }
  actualizarPosicion(x, y) {
    if (typeof x === "number" && Number.isFinite(x)) this.x = x;
    if (typeof y === "number" && Number.isFinite(y)) this.y = y;
  }
  toPublic() {
    return { id: this.id, mascota: this.mascota, x: this.x, y: this.y };
  }
}

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, payload }));
}
function sendTo(pid, type, payload) { const j = jugadores.get(pid); if (j) send(j.ws, type, payload); }

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getEffectForCharged(tipo) {
  if (tipo === "FUEGO") return "QUEMADO";
  if (tipo === "AGUA") return "CONGELADO";
  if (tipo === "TIERRA") return "ENVENENADO";
  return "NINGUNO";
}

function calcDamage(attackType, charged, animalName, defenderAttack, defenderStatus) {
  let base = charged ? CHARGED_BASE_DMG : BASIC_BASE_DMG;
  
  // Bonus de afinidad de la mascota (STAB +20%)
  if (AFINIDAD_ANIMAL[animalName] === attackType) {
    base = Math.floor(base * 1.2);
  }

  // Matriz elemental de efectividad
  let efectividad = "NEUTRAL";
  if (FUERZA_ATAQUES[attackType] === defenderAttack) {
    base = Math.floor(base * 1.5); // Súper efectivo
    efectividad = "SUPER_EFECTIVO";
  } else if (DEBILIDAD_ATAQUES[attackType] === defenderAttack) {
    base = Math.floor(base * 0.7); // Poco efectivo
    efectividad = "POCO_EFECTIVO";
  }

  // Modificadores de estado
  if (defenderStatus === "ENVENENADO") base = Math.floor(base * POISON_TARGET_VULN_MULT);
  return { damage: base, efectividad };
}

class Room {
  constructor(code, hostId) {
    this.code = code;
    this.players = new Map();
    this.state = "waiting";
    this.combat = null;
    this.turnTimer = null;
    this.players.set(hostId, { id: hostId, ready: false, animal: null });
  }

  addPlayer(pid) {
    if (this.players.size >= 2) return false;
    this.players.set(pid, { id: pid, ready: false, animal: null });
    return true;
  }

  removePlayer(pid) {
    this.players.delete(pid);
    if (this.players.size === 0) { this.state = "finished"; return true; }
    if (this.state === "playing") this.endMatch("opponent_left");
    return this.players.size === 0;
  }

  getPlayerIds() { return [...this.players.keys()]; }
  isFull() { return this.players.size >= 2; }
  getOpponent(pid) {
    for (const [id] of this.players) { if (id !== pid) return id; }
    return null;
  }

  startMatch() {
    this.state = "playing";
    const ids = this.getPlayerIds();
    this.combat = {
      hp: { [ids[0]]: MAX_HP, [ids[1]]: MAX_HP },
      ap: { [ids[0]]: MAX_AP, [ids[1]]: MAX_AP },
      status: { [ids[0]]: "NINGUNO", [ids[1]]: "NINGUNO" },
      round: 0,
      submissions: {},
      history: { [ids[0]]: [], [ids[1]]: [] },
    };
    ids.forEach((id) => { this.players.get(id).ready = false; });
    for (const id of ids) {
      const oppId = this.getOpponent(id);
      sendTo(id, "match_start", {
        roomId: this.code,
        opponent: oppId,
        opponentAnimal: this.players.get(oppId)?.animal,
        playerAnimal: this.players.get(id)?.animal,
        hpMax: MAX_HP,
        apMax: MAX_AP,
      });
    }
    this.startTurn();
  }

  startTurn() {
    this.combat.round++;
    this.combat.submissions = {};
    const ids = this.getPlayerIds();
    ids.forEach((id) => {
      this.combat.ap[id] = Math.min(MAX_AP, this.combat.ap[id] + AP_PER_TURN);
      sendTo(id, "turn_start", {
        round: this.combat.round,
        hp: this.combat.hp[id],
        hpMax: MAX_HP,
        ap: this.combat.ap[id],
        status: this.combat.status[id],
      });
    });
    clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.resolveTimeout(), TURN_TIMEOUT_MS);
  }

  submitAttack(pid, attack, charged) {
    if (this.state !== "playing" || !this.combat) return;
    if (this.combat.submissions[pid]) return; // ya envió ataque en este turno

    const validAttacks = ["FUEGO", "AGUA", "TIERRA"];
    if (!validAttacks.includes(attack)) attack = "FUEGO";
    if (typeof charged !== "boolean") charged = false;

    const cost = charged ? CHARGED_COST : BASIC_COST;
    if (this.combat.ap[pid] < cost) charged = false;
    this.combat.ap[pid] -= charged ? CHARGED_COST : BASIC_COST;

    this.combat.submissions[pid] = { attack, charged };

    // Confirmar al atacante que su ofensiva fue registrada y debe esperar
    sendTo(pid, "attack_confirmed", { attack, charged });

    // Notificar al oponente que el rival ya eligió ataque
    const oppId = this.getOpponent(pid);
    if (oppId) {
      sendTo(oppId, "opponent_attacked", {});
    }

    if (Object.keys(this.combat.submissions).length === 2) {
      clearTimeout(this.turnTimer);
      this.resolveRound();
    }
  }

  resolveTimeout() {
    if (this.state !== "playing" || !this.combat) return;
    const ids = this.getPlayerIds();
    ids.forEach((id) => {
      if (!this.combat.submissions[id]) {
        this.combat.submissions[id] = { attack: "FUEGO", charged: false };
      }
    });
    this.resolveRound();
  }

  resolveRound() {
    const ids = this.getPlayerIds();
    const [p1, p2] = ids;
    const s1 = this.combat.submissions[p1];
    const s2 = this.combat.submissions[p2];
    const animal1 = this.players.get(p1)?.animal || "Neptuno";
    const animal2 = this.players.get(p2)?.animal || "Salamander";

    // Daño residual por quemadura
    let burnDmg1 = 0, burnDmg2 = 0;
    if (this.combat.status[p1] === "QUEMADO") { 
      burnDmg1 = BURN_DAMAGE; 
      this.combat.hp[p1] = Math.max(0, this.combat.hp[p1] - BURN_DAMAGE); 
    }
    if (this.combat.status[p2] === "QUEMADO") { 
      burnDmg2 = BURN_DAMAGE; 
      this.combat.hp[p2] = Math.max(0, this.combat.hp[p2] - BURN_DAMAGE); 
    }

    // Cálculo de daño con matriz elemental y afinidad
    const res1 = calcDamage(s1.attack, s1.charged, animal1, s2.attack, this.combat.status[p2]);
    const res2 = calcDamage(s2.attack, s2.charged, animal2, s1.attack, this.combat.status[p1]);

    let dmg1 = res1.damage;
    let dmg2 = res2.damage;

    // Efecto de congelación (reduce daño recibido 25%)
    if (this.combat.status[p1] === "CONGELADO") dmg2 = Math.floor(dmg2 * FREEZE_DAMAGE_REDUCTION);
    if (this.combat.status[p2] === "CONGELADO") dmg1 = Math.floor(dmg1 * FREEZE_DAMAGE_REDUCTION);

    this.combat.hp[p1] = Math.max(0, this.combat.hp[p1] - dmg2);
    this.combat.hp[p2] = Math.max(0, this.combat.hp[p2] - dmg1);

    // Aplicar efectos por ataques cargados
    if (s1.charged) { const e = getEffectForCharged(s1.attack); if (e !== "NINGUNO") this.combat.status[p2] = e; }
    if (s2.charged) { const e = getEffectForCharged(s2.attack); if (e !== "NINGUNO") this.combat.status[p1] = e; }

    this.combat.history[p1].push(s1.attack);
    this.combat.history[p2].push(s2.attack);

    const result = {
      round: this.combat.round,
      p1: { 
        attack: s1.attack, 
        charged: s1.charged, 
        damage: dmg1, 
        hp: this.combat.hp[p1], 
        status: this.combat.status[p1], 
        burnDmg: burnDmg1,
        efectividad: res1.efectividad 
      },
      p2: { 
        attack: s2.attack, 
        charged: s2.charged, 
        damage: dmg2, 
        hp: this.combat.hp[p2], 
        status: this.combat.status[p2], 
        burnDmg: burnDmg2,
        efectividad: res2.efectividad 
      },
    };

    ids.forEach((id) => {
      const isP1 = id === p1;
      const myData = isP1 ? result.p1 : result.p2;
      const oppData = isP1 ? result.p2 : result.p1;

      sendTo(id, "round_resolved", {
        round: this.combat.round,
        myAttack: myData.attack,
        myCharged: myData.charged,
        myDamage: myData.damage,
        myHp: myData.hp,
        myStatus: myData.status,
        myBurnDmg: myData.burnDmg,
        myEfectividad: myData.efectividad,

        oppAttack: oppData.attack,
        oppCharged: oppData.charged,
        oppDamage: oppData.damage,
        oppHp: oppData.hp,
        oppStatus: oppData.status,
        oppBurnDmg: oppData.burnDmg,
        oppEfectividad: oppData.efectividad,

        ap: this.combat.ap[id],
      });
    });

    // Comprobar condiciones de fin
    if (this.combat.hp[p1] <= 0 || this.combat.hp[p2] <= 0 || this.combat.round >= MAX_ROUNDS) {
      setTimeout(() => this.endMatch(), 1000);
    } else {
      setTimeout(() => this.startTurn(), 2000);
    }
  }

  endMatch(reason = "completed") {
    if (this.state === "finished") return;
    this.state = "finished";
    clearTimeout(this.turnTimer);
    const ids = this.getPlayerIds();
    let winner = null;
    if (reason === "opponent_left") { 
      winner = ids[0]; 
    } else if (this.combat) {
      const hp1 = this.combat.hp[ids[0]], hp2 = this.combat.hp[ids[1]];
      if (hp1 > hp2) winner = ids[0];
      else if (hp2 > hp1) winner = ids[1];
      else winner = "draw";
    }
    for (const id of ids) {
      sendTo(id, "match_ended", { winner, reason, hp: this.combat?.hp[id] || 0 });
      const p = jugadores.get(id); if (p) p.roomCode = null;
    }
    rooms.delete(this.code);
  }
}

const rooms = new Map();
let matchmakingQueue = [];

function handleRoomEvent(jugador, type, payload) {
  switch (type) {
    case "create_room": {
      const code = generateRoomCode();
      const room = new Room(code, jugador.id);
      rooms.set(code, room);
      jugador.roomCode = code;
      send(jugador.ws, "room_joined", { code, players: 1, host: true });
      break;
    }
    case "join_room": {
      const code = (payload.code || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { send(jugador.ws, "error", { message: "Sala no encontrada" }); return; }
      if (room.isFull()) { send(jugador.ws, "error", { message: "Sala llena" }); return; }
      if (room.state !== "waiting") { send(jugador.ws, "error", { message: "La partida ya empezó" }); return; }
      room.addPlayer(jugador.id);
      jugador.roomCode = code;
      const ids = room.getPlayerIds();
      for (const id of ids) {
        sendTo(id, "room_joined", { code, players: room.players.size, host: id === ids[0] });
      }
      break;
    }
    case "quick_match": {
      if (matchmakingQueue.includes(jugador.id)) return;
      matchmakingQueue.push(jugador.id);
      send(jugador.ws, "matchmaking_status", { status: "searching", queue: matchmakingQueue.length });
      if (matchmakingQueue.length >= 2) {
        const p1id = matchmakingQueue.shift();
        const p2id = matchmakingQueue.shift();
        const code = generateRoomCode();
        const room = new Room(code, p1id);
        room.addPlayer(p2id);
        rooms.set(code, room);
        const p1 = jugadores.get(p1id), p2 = jugadores.get(p2id);
        if (p1) p1.roomCode = code;
        if (p2) p2.roomCode = code;
        sendTo(p1id, "room_joined", { code, players: 2, host: true, matched: true });
        sendTo(p2id, "room_joined", { code, players: 2, host: false, matched: true });
      }
      break;
    }
    case "player_ready": {
      const room = rooms.get(jugador.roomCode);
      if (!room) return;
      const p = room.players.get(jugador.id);
      if (p) { p.ready = true; p.animal = payload.animal || null; }
      for (const id of room.getPlayerIds()) {
        sendTo(id, "player_ready", { id: jugador.id, animal: p?.animal });
      }
      if (room.isFull() && [...room.players.values()].every((p) => p.ready)) {
        room.startMatch();
      }
      break;
    }
    case "submit_attack": {
      const room = rooms.get(jugador.roomCode);
      if (room) room.submitAttack(jugador.id, payload.attack, payload.charged);
      break;
    }
    case "leave_room": {
      const room = rooms.get(jugador.roomCode);
      if (room) { room.removePlayer(jugador.id); }
      jugador.roomCode = null;
      matchmakingQueue = matchmakingQueue.filter((id) => id !== jugador.id);
      send(jugador.ws, "room_left", {});
      break;
    }
  }
}

// ——— Eventos Legacy (Exploración Libre) ———
function handleLegacyEvent(jugador, type, payload) {
  switch (type) {
    case "join": {
      const nombre = typeof payload.animal === "string" ? payload.animal.trim() : "";
      if (!nombre || nombre.length > 32) { send(jugador.ws, "error", { message: "Nombre inválido" }); return; }
      jugador.asignarMascota(nombre);
      if (typeof payload.x === "number") jugador.x = payload.x;
      if (typeof payload.y === "number") jugador.y = payload.y;
      send(jugador.ws, "joined", { id: jugador.id, enemigos: getEnemigos(jugador.id) });
      for (const j of jugadores.values()) { if (j.id !== jugador.id) send(j.ws, "player_joined", jugador.toPublic()); }
      break;
    }
    case "move": {
      const { x, y } = payload;
      if (typeof x !== "number" || typeof y !== "number") { send(jugador.ws, "error", { message: "Coords inválidas" }); return; }
      jugador.actualizarPosicion(x, y);
      for (const j of jugadores.values()) { if (j.id !== jugador.id) send(j.ws, "player_moved", { id: jugador.id, x, y, mascota: jugador.mascota }); }
      send(jugador.ws, "enemies", { enemigos: getEnemigos(jugador.id) });
      break;
    }
    case "start_combat": {
      for (const j of jugadores.values()) { send(j.ws, "combat_started", { attackerId: jugador.id, targetId: payload.targetId, enemyName: payload.enemyName }); }
      break;
    }
  }
}

function getEnemigos(jugadorId) {
  const r = [];
  for (const j of jugadores.values()) { if (j.id !== jugadorId && j.mascota) r.push(j.toPublic()); }
  return r;
}

// ——— Mensaje Central ———
function handleMessage(jugador, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { send(jugador.ws, "error", { message: "JSON inválido" }); return; }
  const { type, payload = {} } = msg;
  if (!type || typeof type !== "string") { send(jugador.ws, "error", { message: "Sin type" }); return; }

  const roomTypes = ["create_room", "join_room", "quick_match", "player_ready", "submit_attack", "leave_room"];
  if (roomTypes.includes(type)) { handleRoomEvent(jugador, type, payload); return; }

  handleLegacyEvent(jugador, type, payload);
}

// ——— Conexiones ———
wss.on("connection", (ws) => {
  const id = randomUUID();
  const jugador = new Jugador(id, ws);
  jugadores.set(id, jugador);
  send(ws, "welcome", { id });
  console.log(`[WS] Conectado ${id}. Online: ${jugadores.size}`);

  ws.on("message", (data) => handleMessage(jugador, data.toString()));
  ws.on("pong", () => { jugador.isAlive = true; jugador.lastPong = Date.now(); });
  ws.on("close", () => {
    if (jugador.roomCode) { const room = rooms.get(jugador.roomCode); if (room) room.removePlayer(jugador.id); }
    matchmakingQueue = matchmakingQueue.filter((pid) => pid !== id);
    jugadores.delete(id);
    for (const j of jugadores.values()) { send(j.ws, "player_left", { id }); }
    console.log(`[WS] Desconectado ${id}. Online: ${jugadores.size}`);
  });
  ws.on("error", () => {
    if (jugador.roomCode) { const room = rooms.get(jugador.roomCode); if (room) room.removePlayer(jugador.id); }
    matchmakingQueue = matchmakingQueue.filter((pid) => pid !== id);
    jugadores.delete(id);
  });
});

// ——— Heartbeat ———
const heartbeatTimer = setInterval(() => {
  const now = Date.now();
  for (const jugador of jugadores.values()) {
    if (now - jugador.lastPong > HEARTBEAT_TIMEOUT_MS) { try { jugador.ws.terminate(); } catch {} jugadores.delete(jugador.id); continue; }
    if (!jugador.isAlive) { try { jugador.ws.terminate(); } catch {} jugadores.delete(jugador.id); continue; }
    jugador.isAlive = false;
    try { if (jugador.ws.readyState === jugador.ws.OPEN) { jugador.ws.ping(); send(jugador.ws, "ping", { t: now }); } } catch {}
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on("close", () => clearInterval(heartbeatTimer));

// ——— Health Endpoint ———
app.get("/health", (_req, res) => res.json({ ok: true, players: jugadores.size, rooms: rooms.size }));

server.listen(PORT, () => {
  console.log(`Animal Combat server en http://localhost:${PORT}`);
  console.log(`WebSocket + RoomManager + Combate Autoritativo con Matriz Elemental Pokémon`);
});
