import { gameState } from "./core/GameState.js";
import { GameEngine } from "./core/GameEngine.js";
import { Animal, createDefaultAnimals } from "./entities/Animal.js";
import { NetworkClient } from "./network/NetworkClient.js";
import { UIManager, TIPOS_ATAQUE, FUERZA_ATAQUES, STATUS_EFFECTS } from "./ui/UIManager.js";
import { ParticleSystem } from "./fx/ParticleSystem.js";
import { SoundManager } from "./audio/SoundManager.js";

const ui = new UIManager();
const net = new NetworkClient();
const particles = new ParticleSystem();
const sfx = new SoundManager();
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
mapaBackground.onload = () => { bgReady = true; };
if (mapaBackground.complete) bgReady = true;

let lastSentX = NaN;
let lastSentY = NaN;
let keys = { up: false, down: false, left: false, right: false };
let stepCooldown = 0;

// Combat canvas context
const combatCtx = ui.combatCanvasOverlay?.getContext("2d") || null;
let combatRafId = 0;
let combatLastTime = 0;

function combatRenderLoop(now) {
  if (gameState.phase !== "COMBATE" && gameState.phase !== "FIN") {
    combatRafId = 0;
    return;
  }
  let dt = (now - combatLastTime) / 1000;
  combatLastTime = now;
  if (dt > 0.1) dt = 0.1;
  if (combatCtx && ui.combatCanvasOverlay) {
    combatCtx.clearRect(0, 0, ui.combatCanvasOverlay.width, ui.combatCanvasOverlay.height);
    particles.updateAndDraw(dt, combatCtx, ui.combatCanvasOverlay.width, ui.combatCanvasOverlay.height);
  }
  combatRafId = requestAnimationFrame(combatRenderLoop);
}

function startCombatRender() {
  if (combatRafId) return;
  combatLastTime = performance.now();
  combatRafId = requestAnimationFrame(combatRenderLoop);
}

function stopCombatRender() {
  if (combatRafId) {
    cancelAnimationFrame(combatRafId);
    combatRafId = 0;
  }
  if (combatCtx && ui.combatCanvasOverlay) {
    combatCtx.clearRect(0, 0, ui.combatCanvasOverlay.width, ui.combatCanvasOverlay.height);
  }
}

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

    // Step sound
    if (mascotaJugador.velocidadX !== 0 || mascotaJugador.velocidadY !== 0) {
      stepCooldown -= dt;
      if (stepCooldown <= 0) {
        sfx.playStep();
        stepCooldown = 0.25;
      }
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
  (dt) => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    const ctx = ui.lienzo;
    const { width, height } = ui.mapa;

    ctx.save();
    ctx.translate(particles.shakeX, particles.shakeY);

    ctx.clearRect(0, 0, width, height);
    if (bgReady) ctx.drawImage(mapaBackground, 0, 0, width, height);
    for (const e of npcEnemigos) e.draw(ctx);
    for (const r of remoteAnimals.values()) r.draw(ctx);
    mascotaJugador.draw(ctx);

    particles.updateAndDraw(dt, ctx, width, height);
    particles.updateShake(dt);

    ctx.restore();
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

net.on("player_joined", (p) => upsertRemote(p));
net.on("player_moved", (p) => upsertRemote(p));
net.on("player_left", (p) => { if (p?.id) remoteAnimals.delete(p.id); });

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
  ui.updateHP("jugador", gameState.maxHp, gameState.maxHp);
  ui.updateHP("enemigo", gameState.maxHp, gameState.maxHp);
  ui.updateAP(gameState.maxAp, gameState.maxAp);
  ui.updateStatus("jugador", "NINGUNO");
  ui.updateStatus("enemigo", "NINGUNO");
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

  sfx.playSelect();

  gameState.nombreMascotaJugador = nombre;
  gameState.resetCombat();
  ui.setPetNames(nombre, "");
  ui.setScores(0, 0);
  ui.clearBattleLists();
  ui.setMessage(`✅ Has seleccionado a ${nombre}`);
  ui.updateHP("jugador", gameState.maxHp, gameState.maxHp);
  ui.updateHP("enemigo", gameState.maxHp, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);
  ui.updateStatus("jugador", "NINGUNO");
  ui.updateStatus("enemigo", "NINGUNO");

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
  ui.updateHP("jugador", gameState.maxHp, gameState.maxHp);
  ui.updateHP("enemigo", gameState.maxHp, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);
  ui.updateStatus("jugador", "NINGUNO");
  ui.updateStatus("enemigo", "NINGUNO");
  ui.setupCombatOverlay();
  particles.clear();

  const tpl = findAnimalTemplate(gameState.nombreMascotaJugador);
  if (tpl) {
    ui.renderAttackButtons(
      tpl.ataques,
      onPlayerAttack,
      () => gameState.canChargeAttack(),
      gameState.getChargedCost(),
      () => gameState.apJugador
    );
  }

  net.startCombat({ targetId, enemyName });

  gameState.setPhase("COMBATE");
  ui.showPhase("COMBATE");
  ui.setMessage("⚔️ ¡Prepárate para el combate! ⚔️");
  startCombatRender();
}

/**
 * Calcula el daño base de un ataque.
 * @param {string} ataque
 * @param {boolean} charged
 * @param {string} enemyStatus
 * @returns {{ base: number, statusResult: import("./core/GameState.js").StatusEffect|null }}
 */
function calcularDanio(ataque, charged, enemyStatus) {
  let base = charged ? 30 : 20;

  // Envenenado reduce efectividad 25%
  // Si el atacante (enemigo) está envenenado, su daño baja
  // Aquí se llama desde la perspectiva del jugador: enemyStatus = statusEnemigo
  // Si el enemigo está envenenado, su ataque es más débil
  // Pero aquí calculamos daño del JUGADOR, así que si el enemigo está envenenado, afecta al daño que el enemigo recibe
  // Simplificación: si el target está envenenado, el ataque hace +15% de daño
  if (enemyStatus === "ENVENENADO") {
    base = Math.floor(base * 1.15);
  }

  return { base, statusResult: null };
}

/**
 * Calcula daño del enemigo (IA).
 * @param {string} ataqueEnemigo
 * @param {boolean} chargedEnemigo
 * @param {string} jugadorStatus
 * @returns {number}
 */
function calcularDanioEnemigo(ataqueEnemigo, chargedEnemigo, jugadorStatus) {
  let base = chargedEnemigo ? 30 : 20;
  if (jugadorStatus === "ENVENENADO") {
    base = Math.floor(base * 0.85); // El envenenado reduce efectividad
  }
  return base;
}

function getEffectForCharged(tipo) {
  switch (tipo) {
    case "FUEGO": return "QUEMADO";
    case "AGUA": return "CONGELADO";
    case "TIERRA": return "ENVENENADO";
    default: return "NINGUNO";
  }
}

function onPlayerAttack(ataqueJug, emojiJug, charged) {
  if (gameState.phase !== "COMBATE") return;

  // AP check
  const cost = charged ? gameState.getChargedCost() : gameState.getBasicCost();
  if (!gameState.spendAP(cost)) {
    ui.setMessage("⚠️ No tienes suficiente Energía para este ataque");
    return;
  }

  gameState.ataqueJugador.push(ataqueJug);
  gameState.rondaActual++;

  // Enemigo elige ataque (IA: 30% chance cargado si tiene AP)
  const enemigoCharged = gameState.apEnemigo >= 2 && Math.random() < 0.3;
  if (enemigoCharged) gameState.apEnemigo -= 2;
  else gameState.apEnemigo -= 0;

  const ataqueObjEnem = obtenerAtaqueAleatorio();
  const ataqueEnem = ataqueObjEnem.nombre;
  const emojiEnem = ataqueObjEnem.emoji;
  gameState.ataqueEnemigo.push(ataqueEnem);

  // —— Cálculo de daño ——
  let dmgPlayer, dmgEnemy;
  let playerWinsRound;

  // Efecto de ventaja elemental
  const ventajaJ = FUERZA_ATAQUES[ataqueJug] === ataqueEnem;
  const ventajaE = FUERZA_ATAQUES[ataqueEnem] === ataqueJug;

  dmgPlayer = calcularDanio(ataqueJug, charged, gameState.statusEnemigo).base;
  if (ventajaJ) dmgPlayer = Math.floor(dmgPlayer * 1.3);

  dmgEnemy = calcularDanioEnemigo(ataqueEnem, enemigoCharged, gameState.statusJugador);
  if (ventajaE) dmgEnemy = Math.floor(dmgEnemy * 1.3);

  // Aplicar daño real
  const realDmgToEnemy = gameState.applyDamage("enemigo", dmgPlayer);
  const realDmgToJugador = gameState.applyDamage("jugador", dmgEnemy);

  // Determinar ganador de ronda
  if (ataqueJug === ataqueEnem) {
    playerWinsRound = realDmgToEnemy >= realDmgToJugador;
  } else if (ventajaJ) {
    playerWinsRound = true;
  } else if (ventajaE) {
    playerWinsRound = false;
  } else {
    playerWinsRound = realDmgToEnemy > realDmgToJugador;
  }

  if (playerWinsRound) gameState.rondasJugador++;
  else gameState.rondasEnemigo++;

  // —— Efectos de estado por ataque cargado ——
  if (charged) {
    const effect = getEffectForCharged(ataqueJug);
    if (effect !== "NINGUNO") {
      gameState.applyStatus("enemigo", effect);
    }
  }
  if (enemigoCharged) {
    const effect = getEffectForCharged(ataqueEnem);
    if (effect !== "NINGUNO") {
      gameState.applyStatus("jugador", effect);
    }
  }

  // —— Burn tick al inicio del turno ——
  const burnJ = gameState.applyBurnTick("jugador");
  const burnE = gameState.applyBurnTick("enemigo");

  // —— Recharge AP ——
  gameState.rechargeAP();

  // —— UI Updates ——
  ui.setScores(gameState.rondasJugador, gameState.rondasEnemigo);
  ui.updateHP("jugador", gameState.hpJugador, gameState.maxHp);
  ui.updateHP("enemigo", gameState.hpEnemigo, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);
  ui.updateStatus("jugador", gameState.statusJugador);
  ui.updateStatus("enemigo", gameState.statusEnemigo);

  // Attack lines
  const roundNum = gameState.ataqueJugador.length;
  if (charged) {
    const effectLabel = STATUS_EFFECTS[getEffectForCharged(ataqueJug)]?.label || "";
    ui.addChargedAttackLine("jugador", roundNum, emojiJug, effectLabel);
  } else {
    ui.addAttackLine("jugador", roundNum, emojiJug);
  }
  ui.addAttackLine("enemigo", roundNum, emojiEnem);

  // —— VFX & SFX ——
  const isEffective = ventajaJ || ventajaE;
  sfx.playAttack(ataqueJug);

  // Emitir partículas sobre el canvas overlay
  if (combatCtx) {
    const cw = ui.combatCanvasOverlay.width;
    const ch = ui.combatCanvasOverlay.height;
    const px = cw / 2 + (Math.random() - 0.5) * cw * 0.4;
    const py = ch / 2 + (Math.random() - 0.5) * ch * 0.3;
    particles.emitForAttack(ataqueJug, px, py);
  }

  // Screen shake en golpe efectivo
  if (isEffective || charged) {
    ui.triggerShakeCSS(charged ? 8 : 5, charged ? 350 : 200);
  }

  // Status effect SFX
  if (charged) {
    const eff = getEffectForCharged(ataqueJug);
    if (eff === "QUEMADO") sfx.playBurn();
    else if (eff === "CONGELADO") sfx.playFreeze();
    else if (eff === "ENVENENADO") sfx.playPoison();
  }

  // Burn tick messages
  if (burnJ > 0) {
    ui.appendMessage(`🔥 ${burnJ} de daño por quemadura (tu)`);
  }
  if (burnE > 0) {
    ui.appendMessage(`🔥 ${burnE} de daño por quemadura (enemigo)`);
  }

  // Round result message
  let resultadoRonda = playerWinsRound ? "Ganaste" : "Perdiste";
  let emojiResultado = playerWinsRound ? "✅" : "❌";
  if (ataqueJug === ataqueEnem) {
    resultadoRonda = "Empate";
    emojiResultado = "🤝";
  }
  ui.appendMessage(
    `${emojiResultado} Ronda ${roundNum}: ${emojiJug}${charged ? "⚡" : ""} vs ${emojiEnem}${enemigoCharged ? "⚡" : ""} - ${resultadoRonda}`
  );

  // Refresh attack buttons
  const tpl = findAnimalTemplate(gameState.nombreMascotaJugador);
  if (tpl) {
    ui.renderAttackButtons(
      tpl.ataques,
      onPlayerAttack,
      () => gameState.canChargeAttack(),
      gameState.getChargedCost(),
      () => gameState.apJugador
    );
  }

  // Check end conditions
  if (gameState.hpJugador <= 0 || gameState.hpEnemigo <= 0 || gameState.ataqueJugador.length >= 5) {
    finalizarJuego();
  }
}

function finalizarJuego() {
  ui.disableAttacks();
  ui.clearBattleLists();

  const j = gameState.rondasJugador;
  const e = gameState.rondasEnemigo;
  let ganador = "";
  let mensajeFinal = "";

  if (gameState.hpJugador <= 0) {
    ganador = "derrota";
    mensajeFinal = `💀 TE DERROTARON por agotamiento de vida 💀`;
    sfx.playDefeat();
  } else if (gameState.hpEnemigo <= 0) {
    ganador = "victoria";
    mensajeFinal = `🎉 ¡VICTORIA por agotamiento del enemigo! 🎉`;
    sfx.playVictory();
  } else if (j > e) {
    ganador = "victoria";
    mensajeFinal = `🎉 GANASTE EL JUEGO! ${j} vs ${e} 🎉`;
    sfx.playVictory();
  } else if (e > j) {
    ganador = "derrota";
    mensajeFinal = `💀 PERDISTE EL JUEGO! ${j} vs ${e} 💀`;
    sfx.playDefeat();
  } else {
    ganador = "empate";
    mensajeFinal = `🤝 EMPATE TOTAL! ${j} vs ${e} 🤝`;
  }

  // Render final summary
  ui.setMessage("");
  const headerP = document.createElement("p");
  headerP.innerHTML = "📊 RESULTADOS DE LA BATALLA 📊";
  headerP.style.fontWeight = "bold";
  headerP.style.marginBottom = "10px";
  headerP.style.textAlign = "center";
  ui.sectionMensajes?.appendChild(headerP);

  const rounds = Math.min(gameState.ataqueJugador.length, gameState.ataqueEnemigo.length);
  for (let i = 0; i < rounds; i++) {
    const aJ = gameState.ataqueJugador[i];
    const aE = gameState.ataqueEnemigo[i];
    const emojiJ = TIPOS_ATAQUE.find((t) => t.nombre === aJ)?.emoji || "?";
    const emojiE = TIPOS_ATAQUE.find((t) => t.nombre === aE)?.emoji || "?";
    let r = "Empate";
    let em = "🤝";
    if (FUERZA_ATAQUES[aJ] === aE) { r = "Ganaste"; em = "✅"; }
    else if (FUERZA_ATAQUES[aE] === aJ) { r = "Perdiste"; em = "❌"; }
    ui.appendMessage(`${em} Ronda ${i + 1}: ${emojiJ} vs ${emojiE} - ${r}`);
  }

  ui.showFinalMessage(mensajeFinal);
  stopCombatRender();
  gameState.setPhase("FIN");
  ui.showPhase("FIN");
}

function onKeyDown(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) {
    case "ArrowUp": event.preventDefault(); setDirection("up", true); break;
    case "ArrowDown": event.preventDefault(); setDirection("down", true); break;
    case "ArrowLeft": event.preventDefault(); setDirection("left", true); break;
    case "ArrowRight": event.preventDefault(); setDirection("right", true); break;
  }
}

function onKeyUp(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) {
    case "ArrowUp": setDirection("up", false); break;
    case "ArrowDown": setDirection("down", false); break;
    case "ArrowLeft": setDirection("left", false); break;
    case "ArrowRight": setDirection("right", false); break;
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

// Mute toggle
const muteBtn = document.getElementById("mute-toggle");
if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    const muted = sfx.toggle();
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.title = muted ? "Activar sonido" : "Silenciar sonido";
    if (!muted) sfx.resume();
  });
}

ui.onMovementControls(
  (dir) => setDirection(dir, true),
  () => stopMovement()
);

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// Init AudioContext on first interaction
document.addEventListener("click", () => sfx.resume(), { once: true });
document.addEventListener("keydown", () => sfx.resume(), { once: true });

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

// API global compat
window.moverArriba = () => setDirection("up", true);
window.moverAbajo = () => setDirection("down", true);
window.moverIzquierda = () => setDirection("left", true);
window.moverDerecha = () => setDirection("right", true);
window.detenerMovimiento = stopMovement;

iniciarJuego();
