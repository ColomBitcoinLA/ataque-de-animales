import { gameState } from "./core/GameState.js";
import { GameEngine } from "./core/GameEngine.js";
import { Animal, createDefaultAnimals } from "./entities/Animal.js";
import { NetworkClient } from "./network/NetworkClient.js";
import { UIManager, TIPOS_ATAQUE, FUERZA_ATAQUES } from "./ui/UIManager.js";

const ui = new UIManager();
const net = new NetworkClient();
const { list: animales } = createDefaultAnimals();

/** @type {Animal | null} */
let mascotaJugador = null;
/** @type {Animal[]} */
let npcEnemigos = [];
/** @type {Map<string, Animal>} */
const remoteAnimals = new Map();

const mapaBackground = new Image();
mapaBackground.src = "./assets/mapaCombat.webp";
let bgReady = false;
mapaBackground.onload = () => {
  bgReady = true;
};
if (mapaBackground.complete) bgReady = true;

let lastSentX = NaN;
let lastSentY = NaN;
let keys = { up: false, down: false, left: false, right: false };

function aleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function obtenerAtaqueAleatorio() {
  return TIPOS_ATAQUE[aleatorio(0, TIPOS_ATAQUE.length - 1)];
}

function findAnimalTemplate(nombre) {
  return animales.find((a) => a.nombre === nombre) || null;
}

function buildNpcEnemies(mapW, mapH) {
  const scaleX = mapW / 600;
  const scaleY = mapH / 500;
  return [
    findAnimalTemplate("Neptuno")?.cloneAt(124 * scaleX, 50 * scaleY),
    findAnimalTemplate("Tierrudo")?.cloneAt(44 * scaleX, 111 * scaleY),
    findAnimalTemplate("Salamander")?.cloneAt(287 * scaleX, 2 * scaleY),
  ].filter(Boolean);
}

function applyVelocityFromKeys() {
  if (!mascotaJugador) return;
  let vx = 0;
  let vy = 0;
  if (keys.up) vy -= 1;
  if (keys.down) vy += 1;
  if (keys.left) vx -= 1;
  if (keys.right) vx += 1;
  if (vx !== 0 && vy !== 0) {
    const inv = 1 / Math.SQRT2;
    vx *= inv;
    vy *= inv;
  }
  mascotaJugador.velocidadX = vx;
  mascotaJugador.velocidadY = vy;
}

function setDirection(dir, pressed) {
  if (dir === "up") keys.up = pressed;
  if (dir === "down") keys.down = pressed;
  if (dir === "left") keys.left = pressed;
  if (dir === "right") keys.right = pressed;
  applyVelocityFromKeys();
}

function stopMovement() {
  keys = { up: false, down: false, left: false, right: false };
  if (mascotaJugador) {
    mascotaJugador.velocidadX = 0;
    mascotaJugador.velocidadY = 0;
  }
}

// —— Game Engine ——
const engine = new GameEngine(
  (dt) => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;

    mascotaJugador.updateLocal(dt, ui.mapa.width, ui.mapa.height);

    for (const remote of remoteAnimals.values()) {
      remote.interpolate(dt);
    }

    if (mascotaJugador.velocidadX !== 0 || mascotaJugador.velocidadY !== 0) {
      for (const enemigo of npcEnemigos) {
        if (mascotaJugador.collidesWith(enemigo) && !gameState.colisionOcurrida) {
          gameState.colisionOcurrida = true;
          startCombat(enemigo.nombre);
          return;
        }
      }
      for (const [id, remote] of remoteAnimals) {
        if (id === gameState.jugadorId) continue;
        if (mascotaJugador.collidesWith(remote) && !gameState.colisionOcurrida) {
          gameState.colisionOcurrida = true;
          startCombat(remote.nombre, id);
          return;
        }
      }
      if (
        !npcEnemigos.some((e) => mascotaJugador.collidesWith(e)) &&
        ![...remoteAnimals.values()].some((e) => mascotaJugador.collidesWith(e))
      ) {
        gameState.colisionOcurrida = false;
      }
    }
  },
  () => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    const ctx = ui.lienzo;
    const { width, height } = ui.mapa;
    ctx.clearRect(0, 0, width, height);
    if (bgReady) {
      ctx.drawImage(mapaBackground, 0, 0, width, height);
    }
    for (const e of npcEnemigos) e.draw(ctx);
    for (const r of remoteAnimals.values()) r.draw(ctx);
    mascotaJugador.draw(ctx);
  }
);

engine.onNetworkTick = () => {
  if (gameState.phase !== "MAPA" || !mascotaJugador || !net.connected) return;
  const x = Math.round(mascotaJugador.x);
  const y = Math.round(mascotaJugador.y);
  if (x === lastSentX && y === lastSentY) return;
  lastSentX = x;
  lastSentY = y;
  net.move(x, y);
};

// —— Network ——
net.on("welcome", (payload) => {
  gameState.jugadorId = payload.id;
});

net.on("joined", (payload) => {
  gameState.jugadorId = payload.id || gameState.jugadorId;
  syncEnemies(payload.enemigos || []);
});

net.on("enemies", (payload) => {
  syncEnemies(payload.enemigos || []);
});

net.on("player_joined", (p) => {
  upsertRemote(p);
});

net.on("player_moved", (p) => {
  upsertRemote(p);
});

net.on("player_left", (p) => {
  if (p?.id) remoteAnimals.delete(p.id);
});

net.on("reconnecting", () => {
  ui.setMessage("🔄 Reconectando al servidor...");
});

function syncEnemies(enemigos) {
  const seen = new Set();
  for (const e of enemigos) {
    if (!e?.id || e.id === gameState.jugadorId) continue;
    seen.add(e.id);
    upsertRemote(e);
  }
  for (const id of remoteAnimals.keys()) {
    if (!seen.has(id)) remoteAnimals.delete(id);
  }
}

function upsertRemote(data) {
  if (!data?.id || data.id === gameState.jugadorId) return;
  const nombre = data.mascota?.nombre;
  if (!nombre) return;
  let animal = remoteAnimals.get(data.id);
  if (!animal || animal.nombre !== nombre) {
    const tpl = findAnimalTemplate(nombre);
    animal = tpl
      ? tpl.cloneAt(data.x || 0, data.y || 0)
      : new Animal(nombre, "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp", data.x || 0, data.y || 0);
    remoteAnimals.set(data.id, animal);
  }
  if (typeof data.x === "number" && typeof data.y === "number") {
    animal.setPosition(data.x, data.y, !Number.isFinite(animal.x));
  }
}

// —— Flujo de juego ——
function iniciarJuego() {
  gameState.resetAll();
  ui.showPhase("SELECCION");
  ui.renderPetCards(animales);
  ui.setMessage("Mucha suerte!");
  ui.clearBattleLists();
  ui.setScores(0, 0);
  ui.setPetNames("", "");

  net.connect();
}

function seleccionarMascota() {
  const nombre = ui.getSelectedPetName();
  if (!nombre) {
    ui.setMessage("⚠️ Selecciona una mascota");
    return;
  }

  const tpl = findAnimalTemplate(nombre);
  if (!tpl) return;

  gameState.nombreMascotaJugador = nombre;
  gameState.resetCombat();
  ui.setPetNames(nombre, "");
  ui.setScores(0, 0);
  ui.clearBattleLists();
  ui.setMessage(`✅ Has seleccionado a ${nombre}`);
  ui.renderAttackButtons(tpl.ataques, onPlayerAttack);

  const { width, height } = ui.resizeCanvas();
  mascotaJugador = tpl.cloneAt(width * 0.75, height * 0.7);
  npcEnemigos = buildNpcEnemies(width, height);

  net.join({ animal: nombre, x: mascotaJugador.x, y: mascotaJugador.y });

  gameState.setPhase("MAPA");
  ui.showPhase("MAPA");
  ui.setMessage("⚔️ ¡Explora el mapa y choca con un enemigo!");
  engine.start();
}

function startCombat(enemyName, targetId = null) {
  engine.stop();
  stopMovement();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);

  gameState.nombreMascotaEnemigo = enemyName;
  ui.setPetNames(gameState.nombreMascotaJugador, enemyName);
  gameState.resetCombat();
  ui.clearBattleLists();
  ui.setScores(0, 0);

  const tpl = findAnimalTemplate(gameState.nombreMascotaJugador);
  if (tpl) ui.renderAttackButtons(tpl.ataques, onPlayerAttack);

  net.startCombat({ targetId, enemyName });

  gameState.setPhase("COMBATE");
  ui.showPhase("COMBATE");
  ui.setMessage("⚔️ ¡Prepárate para el combate! ⚔️");
}

function onPlayerAttack(ataqueJug, emojiJug) {
  if (gameState.phase !== "COMBATE") return;

  gameState.ataqueJugador.push(ataqueJug);
  ui.addAttackLine("jugador", gameState.ataqueJugador.length, emojiJug);

  const ataqueObjEnem = obtenerAtaqueAleatorio();
  const ataqueEnem = ataqueObjEnem.nombre;
  const emojiEnem = ataqueObjEnem.emoji;
  gameState.ataqueEnemigo.push(ataqueEnem);
  ui.addAttackLine("enemigo", gameState.ataqueEnemigo.length, emojiEnem);

  let resultadoRonda = "";
  let emojiResultado = "";

  if (ataqueJug === ataqueEnem) {
    resultadoRonda = "Empate";
    emojiResultado = "🤝";
  } else if (FUERZA_ATAQUES[ataqueJug] === ataqueEnem) {
    resultadoRonda = "Ganaste";
    emojiResultado = "✅";
    gameState.rondasJugador++;
  } else {
    resultadoRonda = "Perdiste";
    emojiResultado = "❌";
    gameState.rondasEnemigo++;
  }

  ui.setScores(gameState.rondasJugador, gameState.rondasEnemigo);
  ui.appendMessage(
    `${emojiResultado} Ronda ${gameState.ataqueJugador.length}: ${emojiJug} vs ${emojiEnem} - ${resultadoRonda}`
  );

  if (gameState.ataqueJugador.length >= 5) {
    finalizarJuego();
  }
}

function finalizarJuego() {
  const j = gameState.rondasJugador;
  const e = gameState.rondasEnemigo;
  let mensajeFinal = "";
  if (j > e) mensajeFinal = `🎉 GANASTE EL JUEGO! ${j} vs ${e} 🎉`;
  else if (e > j) mensajeFinal = `💀 PERDISTE EL JUEGO! ${j} vs ${e} 💀`;
  else mensajeFinal = `🤝 EMPATE TOTAL! ${j} vs ${e} 🤝`;

  ui.showFinalMessage(mensajeFinal);
  ui.disableAttacks();
  gameState.setPhase("FIN");
  ui.showPhase("FIN");
}

function onKeyDown(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      setDirection("up", true);
      break;
    case "ArrowDown":
      event.preventDefault();
      setDirection("down", true);
      break;
    case "ArrowLeft":
      event.preventDefault();
      setDirection("left", true);
      break;
    case "ArrowRight":
      event.preventDefault();
      setDirection("right", true);
      break;
  }
}

function onKeyUp(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) {
    case "ArrowUp":
      setDirection("up", false);
      break;
    case "ArrowDown":
      setDirection("down", false);
      break;
    case "ArrowLeft":
      setDirection("left", false);
      break;
    case "ArrowRight":
      setDirection("right", false);
      break;
  }
}

// —— Eventos UI ——
ui.botonMascotaJugador?.addEventListener("click", seleccionarMascota);
ui.botonReiniciar?.addEventListener("click", () => location.reload());
ui.botonIniciarPelea?.addEventListener("click", () => {
  if (gameState.phase !== "MAPA") return;
  const enemy =
    gameState.nombreMascotaEnemigo ||
    npcEnemigos[aleatorio(0, npcEnemigos.length - 1)]?.nombre ||
    "Neptuno";
  startCombat(enemy);
});

ui.onMovementControls(
  (dir) => setDirection(dir, true),
  () => stopMovement()
);

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    const prevW = ui.mapa.width || 1;
    const prevH = ui.mapa.height || 1;
    const rx = mascotaJugador.x / prevW;
    const ry = mascotaJugador.y / prevH;
    const { width, height } = ui.resizeCanvas();
    mascotaJugador.setPosition(rx * width, ry * height, true);
    npcEnemigos = buildNpcEnemies(width, height);
  }, 150);
});

// API global opcional (compat botones legacy si quedara alguno)
window.moverArriba = () => setDirection("up", true);
window.moverAbajo = () => setDirection("down", true);
window.moverIzquierda = () => setDirection("left", true);
window.moverDerecha = () => setDirection("right", true);
window.detenerMovimiento = stopMovement;

iniciarJuego();
