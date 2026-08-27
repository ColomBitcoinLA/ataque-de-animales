const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { randomUUID, createHash, randomBytes } = require("crypto");
const fs = require("fs");
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

// ——— Fase 5: Movimientos (Loadout 4 habilidades) ———
const STATUS_COST = 1;         // Movimiento de Estado / Debuff
const SHIELD_COST = 1;         // Movimiento Defensivo / Escudo
const SHIELD_DMG_REDUCTION = 0.5; // reduce 50% el daño recibido
const STATUS_MOVE_BASE_DMG = 10;
const PARALYSIS_DMG_MULT = 0.75;   // Paralizado reduce 25% daño saliente
const DRAGONICO_DMG_REDUCTION = 0.75; // Drágonico reduce 25% daño recibido

// ——— Fase 4: Progresión ———
const XP_WIN = 100;
const XP_LOSS = 35;
const XP_HARD_AI_BONUS = 50;
const HP_PER_LEVEL = 5;
const DMG_PER_LEVEL = 2;
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1600]; // L1..L5
const LEVEL_TITLES = {
  1: "Aprendiz",
  2: "Gladiador",
  3: "Guerrero Elemental",
  4: "Domador Legendario",
  5: "Maestro de Bestias",
};
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const HISTORY_MAX = 5;

function levelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  // Nivel 6+: cada nivel adicional requiere +1000 XP sobre el anterior
  let threshold = LEVEL_THRESHOLDS[4];
  while (xp >= threshold + 1000) { threshold += 1000; lvl++; }
  return lvl;
}
function titleForLevel(level) {
  if (level >= 5) return LEVEL_TITLES[5];
  return LEVEL_TITLES[level] || LEVEL_TITLES[1];
}
function hpMaxForLevel(level) { return MAX_HP + Math.max(0, level - 1) * HP_PER_LEVEL; }
function dmgBonusForLevel(level) { return Math.max(0, level - 1) * DMG_PER_LEVEL; }

// Matriz Elemental estilo Pokémon (Fase 5: expandida a 6 tipos)
const TIPOS = ["FUEGO", "AGUA", "TIERRA", "ELECTRICO", "HIELO", "DRAGON"];
const TYPE_MATCHUP = {
  FUEGO: { strong: ["TIERRA"], weak: ["AGUA"] },
  AGUA: { strong: ["FUEGO"], weak: ["TIERRA"] },
  TIERRA: { strong: ["AGUA"], weak: ["FUEGO"] },
  ELECTRICO: { strong: ["AGUA"], weak: ["TIERRA"] },
  HIELO: { strong: ["TIERRA", "DRAGON"], weak: ["FUEGO"] },
  DRAGON: { strong: ["DRAGON"], weak: [] },
};
const DRAGON_RESISTANCES = ["FUEGO", "AGUA", "ELECTRICO"];
const DRAGON_RESIST_MULT = 0.75;
const AFINIDAD_ANIMAL = { Neptuno: "AGUA", Salamander: "FUEGO", Tierrudo: "TIERRA" };

/** Devuelve el multiplicador de daño entre tipos (attacker → defender). */
function typeMultiplier(attacker, defender) {
  if (!TIPOS.includes(attacker) || !TIPOS.includes(defender)) return 1;
  const m = TYPE_MATCHUP[attacker];
  if (m.strong.includes(defender)) return 1.5;
  if (m.weak.includes(defender)) return 0.7;
  if (defender === "DRAGON" && DRAGON_RESISTANCES.includes(attacker)) return DRAGON_RESIST_MULT;
  return 1;
}

// ============================================================
// FASE 4: Base de Datos Local (data/database.json)
// ============================================================
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "database.json");

let db = { users: {}, sessions: {} };
let saveTimer = null;

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      db.users = db.users || {};
      db.sessions = db.sessions || {};
    }
  } catch (e) {
    console.error("[DB] Error cargando base de datos:", e.message);
    db = { users: {}, sessions: {} };
  }
}

function saveDB(immediate = false) {
  const write = () => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_PATH + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
      fs.renameSync(tmp, DB_PATH); // escritura atómica
    } catch (e) {
      console.error("[DB] Error guardando:", e.message);
    }
  };
  clearTimeout(saveTimer);
  if (immediate) write();
  else saveTimer = setTimeout(write, 300); // auto-guardado con debounce
}

function hashPassword(password, salt) {
  return createHash("sha256").update(salt + ":" + password).digest("hex");
}

function createSession(username) {
  const token = randomBytes(32).toString("hex");
  db.sessions[token] = { username, expiresAt: Date.now() + SESSION_TTL_MS };
  // limpieza de sesiones expiradas
  const now = Date.now();
  for (const [t, s] of Object.entries(db.sessions)) {
    if (s.expiresAt < now) delete db.sessions[t];
  }
  saveDB();
  return token;
}

function getUserByToken(token) {
  const s = db.sessions[token];
  if (!s || s.expiresAt < Date.now()) return null;
  return db.users[s.username] || null;
}

function publicProfile(user, username) {
  const level = levelForXp(user.xp);
  const nextXp = level >= 5 ? null : LEVEL_THRESHOLDS[level]; // null = máximo
  const prevXp = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const { battles, wins, losses } = user.stats;
  return {
    username,
    xp: user.xp,
    level,
    title: titleForLevel(level),
    xpForNext: nextXp,
    xpPrev: prevXp,
    stats: {
      battles,
      wins,
      losses,
      winrate: battles > 0 ? Math.round((wins / battles) * 100) : 0,
    },
    history: user.history.slice(-HISTORY_MAX),
  };
}

function applyMatchResult(username, { result, pet, opponent, vsAI = false, difficulty = "normal" }) {
  const user = db.users[username];
  if (!user) return null;
  const beforeLevel = levelForXp(user.xp);

  user.stats.battles++;
  let xpGain = 0;
  if (result === "win") {
    user.stats.wins++;
    xpGain = XP_WIN;
    if (vsAI && difficulty === "dificil") xpGain += XP_HARD_AI_BONUS;
  } else if (result === "loss") {
    user.stats.losses++;
    xpGain = XP_LOSS;
  } else {
    xpGain = XP_LOSS; // empate cuenta como participación
  }
  user.xp += xpGain;
  user.history.push({
    result,
    pet: pet || "?",
    opponent: opponent || "?",
    vsAI,
    difficulty,
    date: new Date().toISOString(),
  });
  if (user.history.length > HISTORY_MAX * 3) user.history = user.history.slice(-HISTORY_MAX);

  const afterLevel = levelForXp(user.xp);
  const leveledUp = afterLevel > beforeLevel;
  saveDB();
  return {
    xpGain,
    newProfile: publicProfile(user, username),
    leveledUp,
    previousLevel: beforeLevel,
  };
}

loadDB();
process.on("SIGINT", () => { saveDB(true); process.exit(0); });

// ============================================================
// Express + Rate Limiting básico para /api/
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Redirección automática de la raíz a mokepon.html
app.get("/", (req, res) => {
  res.redirect("/mokepon.html");
});

const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  rateMap.set(ip, arr);
  if (arr.length > 30) return res.status(429).json({ error: "Demasiadas peticiones" });
  next();
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token requerido" });
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: "Sesión inválida o expirada" });
  req.user = user;
  req.token = token;
  next();
}

// ——— POST /api/register ———
app.post("/api/register", rateLimit, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return res.status(400).json({ error: "Usuario: 3-16 caracteres alfanuméricos" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Contraseña mínimo 4 caracteres" });
  }
  if (db.users[username]) {
    return res.status(409).json({ error: "El usuario ya existe" });
  }
  const salt = randomBytes(16).toString("hex");
  db.users[username] = {
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    xp: 0,
    stats: { battles: 0, wins: 0, losses: 0 },
    history: [],
  };
  const token = createSession(username);
  saveDB();
  res.json({ ok: true, token, profile: publicProfile(db.users[username], username) });
});

// ——— POST /api/login ———
app.post("/api/login", rateLimit, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = db.users[username];
  if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const token = createSession(username);
  res.json({ ok: true, token, profile: publicProfile(user, username) });
});

// ——— POST /api/auth/google (OAuth 2.1 / Google Sign-In) ———
app.post("/api/auth/google", rateLimit, (req, res) => {
  let { credential, email, name, picture, customUsername } = req.body || {};

  // Decodificar JWT ID Token si viene de Google Identity Services
  if (credential && typeof credential === "string") {
    try {
      const parts = credential.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
        const payload = JSON.parse(payloadJson);
        email = payload.email || email;
        name = payload.name || payload.given_name || name;
        picture = payload.picture || picture;
      }
    } catch (e) {
      console.warn("[OAuth] Error decodificando token Google:", e.message);
    }
  }

  // Generar nombre de usuario amigable
  let baseUsername = (customUsername || name || email?.split("@")[0] || "Guerrero").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15);
  if (baseUsername.length < 3) baseUsername = "Trainer_" + randomBytes(2).toString("hex");

  // Buscar usuario existente por email o username
  let targetUser = null;
  let finalUsername = baseUsername;

  for (const [uname, u] of Object.entries(db.users)) {
    if (email && u.email && u.email.toLowerCase() === email.toLowerCase()) {
      targetUser = u;
      finalUsername = uname;
      break;
    }
  }

  // Si no existe, crear la cuenta automáticamente (Registro transparente)
  if (!targetUser) {
    if (db.users[finalUsername]) {
      finalUsername = `${baseUsername}_${randomBytes(2).toString("hex")}`;
    }
    db.users[finalUsername] = {
      email: email || `${finalUsername.toLowerCase()}@google.com`,
      name: name || finalUsername,
      avatar: picture || null,
      provider: "google",
      createdAt: new Date().toISOString(),
      xp: 0,
      stats: { battles: 0, wins: 0, losses: 0 },
      history: [],
    };
    targetUser = db.users[finalUsername];
  }

  const token = createSession(finalUsername);
  saveDB();
  res.json({ ok: true, token, profile: publicProfile(targetUser, finalUsername) });
});

// ——— GET /api/profile ———
app.get("/api/profile", rateLimit, authMiddleware, (req, res) => {
  res.json({ ok: true, profile: publicProfile(req.user, findUsernameByUser(req.user)) });
});

function findUsernameByUser(user) {
  for (const [name, u] of Object.entries(db.users)) if (u === user) return name;
  return "";
}

// ——— POST /api/report_match (combates vs IA desde el cliente autenticado) ———
app.post("/api/report_match", rateLimit, authMiddleware, (req, res) => {
  const { result, pet, opponent, vsAI, difficulty } = req.body || {};
  if (!["win", "loss", "draw"].includes(result)) {
    return res.status(400).json({ error: "Resultado inválido" });
  }
  const out = applyMatchResult(findUsernameByUser(req.user), {
    result, pet, opponent, vsAI: !!vsAI, difficulty: String(difficulty || "normal"),
  });
  if (!out) return res.status(500).json({ error: "Error registrando partida" });
  res.json({ ok: true, ...out });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ============================================================
// Jugadores conectados (WS)
// ============================================================
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
    this.authToken = null;
    this.username = null;
  }
  get level() {
    if (this.username && db.users[this.username]) return levelForXp(db.users[this.username].xp);
    return this.clientLevel || 1;
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
  if (tipo === "ELECTRICO") return "PARALIZADO";
  if (tipo === "HIELO") return "CONGELADO";
  if (tipo === "DRAGON") return "DRAGONICO";
  return "NINGUNO";
}

function calcDamage(attackType, charged, animalName, defenderAttack, defenderStatus, attackerDmgBonus = 0, move = null) {
  let base;
  if (move === "status") base = STATUS_MOVE_BASE_DMG;
  else base = charged ? CHARGED_BASE_DMG : BASIC_BASE_DMG;

  // Bonus de nivel del jugador (+2 por nivel)
  base += attackerDmgBonus;

  // Bonus de afinidad de la mascota (STAB +20%)
  if (AFINIDAD_ANIMAL[animalName] === attackType) {
    base = Math.floor(base * 1.2);
  }

  // Matriz elemental de efectividad (6 tipos + resistencia de Dragón)
  let efectividad = "NEUTRAL";
  const mult = typeMultiplier(attackType, defenderAttack);
  if (mult > 1) {
    base = Math.floor(base * mult);
    efectividad = "SUPER_EFECTIVO";
  } else if (mult < 1) {
    base = Math.floor(base * mult);
    efectividad = mult === DRAGON_RESIST_MULT ? "RESISTIDO" : "POCO_EFECTIVO";
  }

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
    const hpMax = {};
    const dmgBonus = {};
    for (const id of ids) {
      const lvl = jugadores.get(id)?.level || 1;
      hpMax[id] = hpMaxForLevel(lvl);
      dmgBonus[id] = dmgBonusForLevel(lvl);
    }
    this.combat = {
      hp: { [ids[0]]: hpMax[ids[0]], [ids[1]]: hpMax[ids[1]] },
      ap: { [ids[0]]: MAX_AP, [ids[1]]: MAX_AP },
      status: { [ids[0]]: "NINGUNO", [ids[1]]: "NINGUNO" },
      round: 0,
      submissions: {},
      history: { [ids[0]]: [], [ids[1]]: [] },
      hpMax,
      dmgBonus,
      pets: {},
    };
    ids.forEach((id) => {
      this.combat.pets[id] = this.players.get(id)?.animal || "Neptuno";
      this.players.get(id).ready = false;
    });
    for (const id of ids) {
      const oppId = this.getOpponent(id);
      sendTo(id, "match_start", {
        roomId: this.code,
        opponent: oppId,
        opponentAnimal: this.combat.pets[oppId],
        playerAnimal: this.combat.pets[id],
        hpMax: this.combat.hpMax[id],
        apMax: MAX_AP,
        yourLevel: jugadores.get(id)?.level || 1,
        opponentLevel: jugadores.get(oppId)?.level || 1,
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
        hpMax: this.combat.hpMax[id],
        ap: this.combat.ap[id],
        status: this.combat.status[id],
      });
    });
    clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.resolveTimeout(), TURN_TIMEOUT_MS);
  }

  submitAttack(pid, attack, charged, move) {
    if (this.state !== "playing" || !this.combat) return;
    if (this.combat.submissions[pid]) return;

    // Validar tipo elemental (6 tipos)
    if (move !== "shield" && !TIPOS.includes(attack)) attack = "FUEGO";

    // Calcular costo según el movimiento
    let cost;
    if (move === "shield") cost = SHIELD_COST;
    else if (move === "status") cost = STATUS_COST;
    else cost = (typeof charged === "boolean" && charged) ? CHARGED_COST : BASIC_COST;

    // Si no tiene AP suficiente, degrada a ataque básico
    if (this.combat.ap[pid] < cost) { move = undefined; charged = false; cost = 0; }
    this.combat.ap[pid] -= cost;

    this.combat.submissions[pid] = {
      attack: move === "shield" ? null : attack,
      charged: move === "status" ? false : !!charged,
      move: move || (charged ? "charged" : "basic"),
    };

    sendTo(pid, "attack_confirmed", { attack: move === "shield" ? null : attack, charged: move === "status" ? false : !!charged, move: move || (charged ? "charged" : "basic") });
    const oppId = this.getOpponent(pid);
    if (oppId) sendTo(oppId, "opponent_attacked", {});

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
        this.combat.submissions[id] = { attack: "FUEGO", charged: false, move: "basic" };
      }
    });
    this.resolveRound();
  }

  resolveRound() {
    const ids = this.getPlayerIds();
    const [p1, p2] = ids;
    const s1 = this.combat.submissions[p1];
    const s2 = this.combat.submissions[p2];
    const animal1 = this.combat.pets[p1];
    const animal2 = this.combat.pets[p2];
    const shield1 = s1.move === "shield";
    const shield2 = s2.move === "shield";

    let burnDmg1 = 0, burnDmg2 = 0;
    if (this.combat.status[p1] === "QUEMADO") {
      burnDmg1 = BURN_DAMAGE;
      this.combat.hp[p1] = Math.max(0, this.combat.hp[p1] - BURN_DAMAGE);
    }
    if (this.combat.status[p2] === "QUEMADO") {
      burnDmg2 = BURN_DAMAGE;
      this.combat.hp[p2] = Math.max(0, this.combat.hp[p2] - BURN_DAMAGE);
    }

    // Cálculo de daño (el que hace escudo no ataca)
    let dmg1 = 0, dmg2 = 0, eff1 = "NEUTRAL", eff2 = "NEUTRAL";
    const defType1 = shield1 ? "NINGUNO" : (s1.attack || "NINGUNO");
    const defType2 = shield2 ? "NINGUNO" : (s2.attack || "NINGUNO");

    if (!shield1) {
      const res = calcDamage(s1.attack, s1.charged, animal1, defType2, this.combat.status[p2], this.combat.dmgBonus[p1], s1.move === "status" ? "status" : null);
      dmg1 = res.damage; eff1 = res.efectividad;
    }
    if (!shield2) {
      const res = calcDamage(s2.attack, s2.charged, animal2, defType1, this.combat.status[p1], this.combat.dmgBonus[p2], s2.move === "status" ? "status" : null);
      dmg2 = res.damage; eff2 = res.efectividad;
    }

    // Paralizado reduce 25% el daño saliente
    if (this.combat.status[p1] === "PARALIZADO") dmg1 = Math.floor(dmg1 * PARALYSIS_DMG_MULT);
    if (this.combat.status[p2] === "PARALIZADO") dmg2 = Math.floor(dmg2 * PARALYSIS_DMG_MULT);

    // Congelado / Drágonico reduce 25% el daño recibido
    if (this.combat.status[p1] === "CONGELADO" || this.combat.status[p1] === "DRAGONICO") dmg2 = Math.floor(dmg2 * FREEZE_DAMAGE_REDUCTION);
    if (this.combat.status[p2] === "CONGELADO" || this.combat.status[p2] === "DRAGONICO") dmg1 = Math.floor(dmg1 * FREEZE_DAMAGE_REDUCTION);

    // Escudo reduce 50% el daño recibido
    if (shield1) dmg2 = Math.floor(dmg2 * SHIELD_DMG_REDUCTION);
    if (shield2) dmg1 = Math.floor(dmg1 * SHIELD_DMG_REDUCTION);

    this.combat.hp[p1] = Math.max(0, this.combat.hp[p1] - dmg2);
    this.combat.hp[p2] = Math.max(0, this.combat.hp[p2] - dmg1);

    // Aplicar efectos por ataques cargados o movimientos de estado
    if ((s1.charged || s1.move === "status") && s1.attack) { const e = getEffectForCharged(s1.attack); if (e !== "NINGUNO") this.combat.status[p2] = e; }
    if ((s2.charged || s2.move === "status") && s2.attack) { const e = getEffectForCharged(s2.attack); if (e !== "NINGUNO") this.combat.status[p1] = e; }

    this.combat.history[p1].push(s1.attack || "ESCUDO");
    this.combat.history[p2].push(s2.attack || "ESCUDO");

    const result = {
      round: this.combat.round,
      p1: {
        attack: s1.attack || "ESCUDO",
        charged: s1.charged,
        move: s1.move,
        damage: dmg1,
        hp: this.combat.hp[p1],
        status: this.combat.status[p1],
        burnDmg: burnDmg1,
        efectividad: eff1
      },
      p2: {
        attack: s2.attack || "ESCUDO",
        charged: s2.charged,
        move: s2.move,
        damage: dmg2,
        hp: this.combat.hp[p2],
        status: this.combat.status[p2],
        burnDmg: burnDmg2,
        efectividad: eff2
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
        myMove: myData.move,
        myDamage: myData.damage,
        myHp: myData.hp,
        myStatus: myData.status,
        myBurnDmg: myData.burnDmg,
        myEfectividad: myData.efectividad,

        oppAttack: oppData.attack,
        oppCharged: oppData.charged,
        oppMove: oppData.move,
        oppDamage: oppData.damage,
        oppHp: oppData.hp,
        oppStatus: oppData.status,
        oppBurnDmg: oppData.burnDmg,
        oppEfectividad: oppData.efectividad,

        ap: this.combat.ap[id],
      });
    });

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

    // —— Fase 4: registrar resultados en cuentas autenticadas ——
    const progress = {};
    for (const id of ids) {
      const j = jugadores.get(id);
      if (!j?.username) continue;
      const result = winner === "draw" ? "draw" : winner === id ? "win" : "loss";
      progress[id] = applyMatchResult(j.username, {
        result,
        pet: this.combat?.pets[id],
        opponent: this.combat?.pets[this.getOpponent(id)],
        vsAI: false,
      });
    }

    for (const id of ids) {
      const prog = progress[id];
      sendTo(id, "match_ended", {
        winner,
        reason,
        hp: this.combat?.hp[id] || 0,
        xpGain: prog ? prog.xpGain : 0,
        leveledUp: prog ? prog.leveledUp : false,
        newLevel: prog ? prog.newProfile.level : null,
        newTitle: prog ? prog.newProfile.title : null,
        profile: prog ? prog.newProfile : null,
      });
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
      // Notifica a TODOS (ambos clientes necesitan players===2 para pasar a selección)
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
      if (p) {
        p.ready = true;
        p.animal = payload.animal || null;
        // El servidor confía en su propia DB si el jugador está autenticado
        p.level = jugador.level;
      }
      for (const id of room.getPlayerIds()) {
        sendTo(id, "player_ready", { id: jugador.id, animal: p?.animal, level: p?.level || 1 });
      }
      if (room.isFull() && [...room.players.values()].every((pl) => pl.ready)) {
        room.startMatch();
      }
      break;
    }
    case "submit_attack": {
      const room = rooms.get(jugador.roomCode);
      if (room) room.submitAttack(jugador.id, payload.attack, payload.charged, payload.move);
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
      if (typeof payload.level === "number") jugador.clientLevel = Math.max(1, Math.min(20, Math.floor(payload.level)));
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

// ——— Conexiones (con token de sesión en el handshake) ———
wss.on("connection", (ws, req) => {
  const id = randomUUID();
  const jugador = new Jugador(id, ws);

  // Fase 4: autenticación vía query param ?token=
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const token = url.searchParams.get("token");
    if (token) {
      const user = getUserByToken(token);
      if (user) {
        jugador.authToken = token;
        jugador.username = findUsernameByUser(user);
      }
    }
  } catch { /* handshake sin token o URL malformada */ }

  jugadores.set(id, jugador);
  send(ws, "welcome", { id, authenticated: !!jugador.username, username: jugador.username });
  console.log(`[WS] Conectado ${id}${jugador.username ? ` (${jugador.username})` : ""}. Online: ${jugadores.size}`);

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

app.get("/health", (_req, res) => res.json({ ok: true, players: jugadores.size, rooms: rooms.size }));

server.listen(PORT, () => {
  console.log(`Animal Combat server en http://localhost:${PORT}`);
  console.log(`WebSocket + Rooms + Combate Autoritativo + Persistencia (Fase 4)`);
});
