import { gameState } from "./core/GameState.js";
import { GameEngine } from "./core/GameEngine.js";
import { Animal, createDefaultAnimals } from "./entities/Animal.js";
import { NetworkClient } from "./network/NetworkClient.js";
import { UIManager, TIPOS_ATAQUE, FUERZA_ATAQUES, STATUS_EFFECTS } from "./ui/UIManager.js";
import { LobbyManager } from "./ui/LobbyManager.js";
import { ParticleSystem } from "./fx/ParticleSystem.js";
import { SoundManager } from "./audio/SoundManager.js";
import { BotAI } from "./entities/BotAI.js";
import { Obstacle, generateObstacles } from "./entities/Obstacle.js";
import { PowerUp, generatePowerUps } from "./entities/PowerUp.js";

const DEBILIDAD_ATAQUES = { FUEGO: "AGUA", AGUA: "TIERRA", TIERRA: "FUEGO" };
const AFINIDAD_ANIMAL = { Neptuno: "AGUA", Salamander: "FUEGO", Tierrudo: "TIERRA" };

const ui = new UIManager();
const lobby = new LobbyManager();
const net = new NetworkClient();
const particles = new ParticleSystem();
const sfx = new SoundManager();
const { list: animales } = createDefaultAnimals();

let mascotaJugador = null;
let npcEnemigos = [];
let remoteAnimals = new Map();
let obstacles = [];
let powerUps = [];
let botAI = null;

const mapaBackground = new Image();
mapaBackground.src = "./assets/mapaCombat.webp";
let bgReady = false;
mapaBackground.onload = () => { bgReady = true; };
if (mapaBackground.complete) bgReady = true;

let lastSentX = NaN;
let lastSentY = NaN;
let keys = { up: false, down: false, left: false, right: false };
let stepCooldown = 0;

const combatCtx = ui.combatCanvasOverlay?.getContext("2d") || null;
let combatRafId = 0;
let combatLastTime = 0;

function combatRenderLoop(now) {
  if (gameState.phase !== "COMBATE" && gameState.phase !== "FIN") { combatRafId = 0; return; }
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

function aleatorio(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function obtenerAtaqueAleatorio() { return TIPOS_ATAQUE[aleatorio(0, TIPOS_ATAQUE.length - 1)]; }
function findAnimalTemplate(n) { return animales.find((a) => a.nombre === n) || null; }

function buildNpcEnemies(mapW, mapH) {
  const sx = mapW / 600, sy = mapH / 500;
  return [
    findAnimalTemplate("Neptuno")?.cloneAt(124 * sx, 50 * sy),
    findAnimalTemplate("Tierrudo")?.cloneAt(44 * sx, 111 * sy),
    findAnimalTemplate("Salamander")?.cloneAt(287 * sx, 2 * sy),
  ].filter(Boolean);
}

function applyVelocityFromKeys() {
  if (!mascotaJugador) return;
  let vx = 0, vy = 0;
  if (keys.up) vy -= 1; 
  if (keys.down) vy += 1;
  if (keys.left) vx -= 1; 
  if (keys.right) vx += 1;
  if (vx !== 0 && vy !== 0) { const inv = 1 / Math.SQRT2; vx *= inv; vy *= inv; }
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

// ——— Game Engine (Loop de Exploración en Mapa) ———
const engine = new GameEngine(
  (dt) => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    
    // Desplazamiento deseado
    const nextX = mascotaJugador.x + mascotaJugador.velocidadX * mascotaJugador.speed * dt;
    const nextY = mascotaJugador.y + mascotaJugador.velocidadY * mascotaJugador.speed * dt;
    
    // Comprobar colisiones con obstáculos sólidos
    const futureHitbox = { 
      x: nextX + mascotaJugador.offsetX, 
      y: nextY + mascotaJugador.offsetY, 
      ancho: mascotaJugador.anchoColision, 
      alto: mascotaJugador.altoColision 
    };
    
    let blocked = false;
    for (const obs of obstacles) { 
      if (obs.collidesWith(futureHitbox)) { 
        blocked = true; 
        break; 
      } 
    }
    
    if (!blocked) { 
      mascotaJugador.x = nextX; 
      mascotaJugador.y = nextY; 
    }
    
    mascotaJugador.x = Math.max(0, Math.min(ui.mapa.width - mascotaJugador.ancho, mascotaJugador.x));
    mascotaJugador.y = Math.max(0, Math.min(ui.mapa.height - mascotaJugador.alto, mascotaJugador.y));
    mascotaJugador.targetX = mascotaJugador.x; 
    mascotaJugador.targetY = mascotaJugador.y;

    for (const r of remoteAnimals.values()) r.interpolate(dt);

    if (mascotaJugador.velocidadX !== 0 || mascotaJugador.velocidadY !== 0) {
      stepCooldown -= dt;
      if (stepCooldown <= 0) { sfx.playStep(); stepCooldown = 0.25; }
    }

    // Recolección de Power-ups
    const pbox = mascotaJugador.getHitbox();
    for (const pup of powerUps) {
      if (!pup.collected && pup.collidesWith(pbox)) {
        pup.collected = true;
        sfx.playSelect();
        if (pup.tipo === "vida") {
          gameState.hpJugador = Math.min(gameState.maxHp, gameState.hpJugador + 25);
          ui.updateHP("jugador", gameState.hpJugador, gameState.maxHp);
        } else if (pup.tipo === "mana") {
          gameState.maxAp = Math.min(5, gameState.maxAp + 1);
          gameState.apJugador = Math.min(gameState.maxAp, gameState.apJugador + 1);
          ui.updateAP(gameState.apJugador, gameState.maxAp);
        } else if (pup.tipo === "rapidez") {
          mascotaJugador.speed *= 1.3;
        }
      }
    }

    // Colisiones con NPCs para iniciar combate
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
      if (!npcEnemigos.some((e) => mascotaJugador.collidesWith(e)) && ![...remoteAnimals.values()].some((e) => mascotaJugador.collidesWith(e))) {
        gameState.colisionOcurrida = false;
      }
    }
  },
  (dt, now) => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    const ctx = ui.lienzo;
    const { width, height } = ui.mapa;
    ctx.save();
    ctx.translate(particles.shakeX, particles.shakeY);
    ctx.clearRect(0, 0, width, height);
    if (bgReady) ctx.drawImage(mapaBackground, 0, 0, width, height);
    for (const obs of obstacles) obs.draw(ctx);
    for (const pup of powerUps) pup.draw(ctx, now);
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
  const x = Math.round(mascotaJugador.x), y = Math.round(mascotaJugador.y);
  if (x === lastSentX && y === lastSentY) return;
  lastSentX = x; 
  lastSentY = y;
  net.move(x, y);
};

// ——— Eventos de Red: Conexión y Exploración ———
net.on("welcome", (p) => { gameState.jugadorId = p.id; });
net.on("joined", (p) => { gameState.jugadorId = p.id || gameState.jugadorId; syncEnemies(p.enemigos || []); });
net.on("enemies", (p) => syncEnemies(p.enemigos || []));
net.on("player_joined", (p) => upsertRemote(p));
net.on("player_moved", (p) => upsertRemote(p));
net.on("player_left", (p) => { if (p?.id) remoteAnimals.delete(p.id); });
net.on("reconnecting", () => ui.setMessage("🔄 Reconectando..."));
net.on("error", (p) => { lobby.setStatus(`⚠️ ${p.message || "Error de conexión"}`); });

// ——— Eventos de Red: Salas y Combate Online ———
net.on("room_joined", (p) => {
  gameState.roomCode = p.code;
  gameState.isHost = p.host;
  
  if (p.matched || p.players === 2) {
    lobby.setStatus("🎉 ¡Oponente conectado! Preparando selección...");
    setTimeout(() => {
      gameState.setPhase("SELECCION");
      lobby.hide();
      ui.showPhase("SELECCION");
      ui.renderPetCards(animales);
      ui.setMessage("Elige tu mascota para la batalla online");
      if (ui.botonMascotaJugador) ui.botonMascotaJugador.disabled = false;
    }, 600);
  } else {
    lobby.showRoomCode(p.code);
    lobby.setStatus(`Sala creada: ${p.code}. Comparte el código con tu amigo.`);
  }
});

net.on("player_ready", (p) => {
  if (p.id !== gameState.jugadorId) {
    gameState.nombreMascotaEnemigo = p.animal || "Rival";
  }
});

net.on("match_start", (p) => {
  lobby.hide();
  gameState.nombreMascotaJugador = p.playerAnimal || gameState.nombreMascotaJugador;
  gameState.nombreMascotaEnemigo = p.opponentAnimal || gameState.nombreMascotaEnemigo;
  gameState.isAuthoritative = true;
  gameState.opponentId = p.opponent;
  gameState.maxHp = p.hpMax || 100;
  gameState.maxAp = p.apMax || 3;
  gameState.resetCombat();
  ui.setPetNames(gameState.nombreMascotaJugador, gameState.nombreMascotaEnemigo);
  startCombat(gameState.nombreMascotaEnemigo);
});

net.on("turn_start", (p) => {
  gameState.rondaActual = p.round;
  gameState.hpJugador = p.hp;
  gameState.apJugador = p.ap;
  gameState.statusJugador = p.status;
  ui.updateHP("jugador", p.hp, gameState.maxHp);
  ui.updateAP(p.ap, gameState.maxAp);
  ui.updateStatus("jugador", p.status);
  ui.setMessage(`⚔️ Turno ${p.round} - ¡Elige tu ataque! (10s)`);
  enableAttackButtons();
});

// Confirmación de que el jugador envió su ataque y debe esperar al rival
net.on("attack_confirmed", (p) => {
  ui.disableAttacks();
  const emoji = TIPOS_ATAQUE.find((t) => t.nombre === p.attack)?.emoji || "⚔️";
  ui.setMessage(`⏳ Has lanzado ${emoji} ${p.attack}${p.charged ? " ⚡" : ""}. Esperando la acción del rival...`);
});

// Notificación de que el oponente ya atacó
net.on("opponent_attacked", () => {
  const isWaiting = ui.botonesAtaques.every((b) => b.disabled);
  if (!isWaiting) {
    ui.setMessage(`⚡ ¡El rival ya eligió su ataque! ¡Es tu turno de responder! (10s)`);
  }
});

net.on("round_resolved", (p) => {
  ui.disableAttacks();
  gameState.hpJugador = p.myHp;
  gameState.hpEnemigo = p.oppHp;
  gameState.apJugador = p.ap;
  gameState.statusJugador = p.myStatus;
  gameState.statusEnemigo = p.oppStatus;
  
  ui.updateHP("jugador", p.myHp, gameState.maxHp);
  ui.updateHP("enemigo", p.oppHp, gameState.maxHp);
  ui.updateAP(p.ap, gameState.maxAp);
  ui.updateStatus("jugador", p.myStatus);
  ui.updateStatus("enemigo", p.oppStatus);
  
  const rn = p.round || gameState.rondaActual;
  const emojiMyAtk = TIPOS_ATAQUE.find((t) => t.nombre === p.myAttack)?.emoji || "⚔️";
  const emojiOppAtk = TIPOS_ATAQUE.find((t) => t.nombre === p.oppAttack)?.emoji || "⚔️";

  if (p.myCharged) ui.addChargedAttackLine("jugador", rn, emojiMyAtk, STATUS_EFFECTS[p.myStatus]?.label || "");
  else ui.addAttackLine("jugador", rn, emojiMyAtk);

  if (p.oppCharged) ui.addChargedAttackLine("enemigo", rn, emojiOppAtk, STATUS_EFFECTS[p.oppStatus]?.label || "");
  else ui.addAttackLine("enemigo", rn, emojiOppAtk);

  sfx.playAttack(p.oppAttack || "FUEGO");
  
  if (combatCtx) {
    const cw = ui.combatCanvasOverlay.width, ch = ui.combatCanvasOverlay.height;
    particles.emitForAttack(p.myAttack || "FUEGO", cw * 0.7, ch * 0.4);
    particles.emitForAttack(p.oppAttack || "FUEGO", cw * 0.3, ch * 0.4);
  }
  
  if (p.oppCharged || p.myCharged) ui.triggerShakeCSS(8, 350);

  let effNote = "";
  if (p.myEfectividad === "SUPER_EFECTIVO") effNote = " 🔥 ¡Súper Efectivo (+50%)!";
  else if (p.myEfectividad === "POCO_EFECTIVO") effNote = " 🛡️ Poco Efectivo (-30%)";

  let oppEffNote = "";
  if (p.oppEfectividad === "SUPER_EFECTIVO") oppEffNote = " 💥 ¡Rival causó daño Súper Efectivo!";

  let emoji = "🤝";
  if (p.myHp > p.oppHp) { emoji = "✅"; gameState.rondasJugador++; }
  else if (p.oppHp > p.myHp) { emoji = "❌"; gameState.rondasEnemigo++; }

  ui.setMessage(`${emoji} Ronda ${rn}: ${emojiMyAtk} vs ${emojiOppAtk}.${effNote}${oppEffNote}`);
  ui.appendMessage(`📊 Ronda ${rn}: Tú ${p.myHp} HP | Rival ${p.oppHp} HP`);
  ui.setScores(gameState.rondasJugador, gameState.rondasEnemigo);
});

net.on("match_ended", (p) => {
  let msg = "";
  if (p.winner === gameState.jugadorId) { 
    msg = "🎉 ¡VICTORIA! Eres el campeón 🎉"; 
    sfx.playVictory(); 
  } else if (p.winner === "draw") { 
    msg = "🤝 EMPATE TOTAL 🤝"; 
  } else if (p.reason === "opponent_left") {
    msg = "🏆 ¡VICTORIA! El rival abandonó la partida 🏆";
    sfx.playVictory();
  } else { 
    msg = "💀 DERROTA: Te han vencido 💀"; 
    sfx.playDefeat(); 
  }
  finalizarJuego(msg);
});

function enableAttackButtons() {
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
}

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
  let a = remoteAnimals.get(data.id);
  if (!a || a.nombre !== nombre) { 
    const t = findAnimalTemplate(nombre); 
    a = t ? t.cloneAt(data.x || 0, data.y || 0) : new Animal(nombre, "./assets/agua.webp", 3, "./assets/cabezaNeptuno.webp", data.x || 0, data.y || 0); 
    remoteAnimals.set(data.id, a); 
  }
  if (typeof data.x === "number" && typeof data.y === "number") a.setPosition(data.x, data.y, !Number.isFinite(a.x));
}

// ——— Flujo de Pantallas ———
function irALobby() {
  gameState.resetAll();
  if (ui.botonMascotaJugador) ui.botonMascotaJugador.disabled = false;
  ui.showPhase("LOBBY");
  lobby.show();
}

function seleccionarMascota() {
  const nombre = ui.getSelectedPetName();
  if (!nombre) { ui.setMessage("⚠️ Selecciona una mascota"); return; }
  const tpl = findAnimalTemplate(nombre); if (!tpl) return;
  
  sfx.playSelect();
  gameState.nombreMascotaJugador = nombre;
  gameState.resetCombat();
  ui.setPetNames(nombre, gameState.nombreMascotaEnemigo || "");
  ui.setScores(0, 0); 
  ui.clearBattleLists();
  ui.setMessage(`✅ ${nombre} seleccionado`);
  ui.updateHP("jugador", gameState.maxHp, gameState.maxHp);
  ui.updateHP("enemigo", gameState.maxHp, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);

  const { width, height } = ui.resizeCanvas();
  mascotaJugador = tpl.cloneAt(width * 0.75, height * 0.7);
  npcEnemigos = buildNpcEnemies(width, height);
  obstacles = generateObstacles(width, height, 4);
  powerUps = generatePowerUps(width, height, 3);

  if (gameState.gameMode === "online") {
    net.playerReady(nombre);
    net.join({ animal: nombre, x: mascotaJugador.x, y: mascotaJugador.y });
    ui.setMessage("⏳ ¡Mascota confirmada! Esperando que el rival esté listo...");
    if (ui.botonMascotaJugador) ui.botonMascotaJugador.disabled = true;
    return;
  }

  // Modo Solo vs IA -> Vamos al mapa de exploración
  gameState.setPhase("MAPA");
  ui.showPhase("MAPA");
  ui.setMessage("⚔️ ¡Explora el mapa, esquiva rocas, recoge pociones y choca con un enemigo!");
  engine.start();
}

function startCombat(enemyName, targetId = null) {
  engine.stop();
  stopMovement();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);

  if (!gameState.isAuthoritative) {
    gameState.nombreMascotaEnemigo = enemyName;
    gameState.resetCombat();
  }
  
  ui.setPetNames(gameState.nombreMascotaJugador, gameState.nombreMascotaEnemigo);
  ui.setScores(0, 0); 
  ui.clearBattleLists();
  ui.updateHP("jugador", gameState.maxHp, gameState.maxHp);
  ui.updateHP("enemigo", gameState.maxHp, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);
  ui.updateStatus("jugador", "NINGUNO"); 
  ui.updateStatus("enemigo", "NINGUNO");
  ui.setupCombatOverlay(); 
  particles.clear();

  if (gameState.isAuthoritative) {
    enableAttackButtons();
  } else {
    botAI = new BotAI(gameState.difficulty);
    enableAttackButtons();
    if (gameState.gameMode === "online") net.startCombat({ targetId, enemyName });
  }

  gameState.setPhase("COMBATE");
  ui.showPhase("COMBATE");
  ui.setMessage("⚔️ ¡Prepárate para el combate!");
  startCombatRender();
}

function getEffectForCharged(tipo) {
  if (tipo === "FUEGO") return "QUEMADO";
  if (tipo === "AGUA") return "CONGELADO";
  if (tipo === "TIERRA") return "ENVENENADO";
  return "NINGUNO";
}

function onPlayerAttack(ataqueJug, emojiJug, charged) {
  if (gameState.phase !== "COMBATE") return;

  // Si es Online: Enviar al backend autoritativo y bloquear botones
  if (gameState.isAuthoritative) {
    const cost = charged ? gameState.getChargedCost() : gameState.getBasicCost();
    if (cost > 0 && gameState.apJugador < cost) { 
      ui.setMessage("⚠️ No tienes suficiente energía para un ataque cargado"); 
      return; 
    }
    net.submitAttack(ataqueJug, charged);
    ui.disableAttacks();
    ui.setMessage(`⏳ Has lanzado ${emojiJug} ${ataqueJug}${charged ? " ⚡" : ""}. Esperando al rival...`);
    return;
  }

  // Si es Local / Solo vs IA:
  const cost = charged ? gameState.getChargedCost() : gameState.getBasicCost();
  if (!gameState.spendAP(cost)) { 
    ui.setMessage("⚠️ No tienes suficiente energía para este ataque"); 
    return; 
  }

  gameState.ataqueJugador.push(ataqueJug);
  gameState.rondaActual++;

  // Selección inteligente del BotAI
  const botChoice = botAI ? botAI.chooseAttack(gameState.apEnemigo) : { attack: obtenerAtaqueAleatorio().nombre, charged: gameState.apEnemigo >= 2 && Math.random() < 0.3 };
  const ataqueEnem = botChoice.attack;
  const enemigoCharged = botChoice.charged;
  if (enemigoCharged) gameState.apEnemigo -= 2;
  gameState.ataqueEnemigo.push(ataqueEnem);
  if (botAI) botAI.recordRound(ataqueJug, ataqueEnem, charged, enemigoCharged);

  const emojiEnem = TIPOS_ATAQUE.find((t) => t.nombre === ataqueEnem)?.emoji || "⚔️";

  // Matriz de efectividad elemental y bonus de afinidad
  let dmgPlayer = charged ? 30 : 20;
  if (AFINIDAD_ANIMAL[gameState.nombreMascotaJugador] === ataqueJug) dmgPlayer = Math.floor(dmgPlayer * 1.2);
  let playerEff = "";
  if (FUERZA_ATAQUES[ataqueJug] === ataqueEnem) {
    dmgPlayer = Math.floor(dmgPlayer * 1.5);
    playerEff = " 🔥 ¡Súper Efectivo (+50%)!";
  } else if (DEBILIDAD_ATAQUES[ataqueJug] === ataqueEnem) {
    dmgPlayer = Math.floor(dmgPlayer * 0.7);
    playerEff = " 🛡️ Poco Efectivo (-30%)";
  }

  let dmgEnemy = enemigoCharged ? 30 : 20;
  if (AFINIDAD_ANIMAL[gameState.nombreMascotaEnemigo] === ataqueEnem) dmgEnemy = Math.floor(dmgEnemy * 1.2);
  let enemyEff = "";
  if (FUERZA_ATAQUES[ataqueEnem] === ataqueJug) {
    dmgEnemy = Math.floor(dmgEnemy * 1.5);
    enemyEff = " 💥 ¡Rival causó daño Súper Efectivo!";
  } else if (DEBILIDAD_ATAQUES[ataqueEnem] === ataqueJug) {
    dmgEnemy = Math.floor(dmgEnemy * 0.7);
  }

  if (gameState.statusEnemigo === "ENVENENADO") dmgPlayer = Math.floor(dmgPlayer * 1.15);
  if (gameState.statusJugador === "ENVENENADO") dmgEnemy = Math.floor(dmgEnemy * 0.85);

  const realDmgToEnemy = gameState.applyDamage("enemigo", dmgPlayer);
  const realDmgToJugador = gameState.applyDamage("jugador", dmgEnemy);

  if (charged) { const e = getEffectForCharged(ataqueJug); if (e !== "NINGUNO") gameState.applyStatus("enemigo", e); }
  if (enemigoCharged) { const e = getEffectForCharged(ataqueEnem); if (e !== "NINGUNO") gameState.applyStatus("jugador", e); }

  const burnJ = gameState.applyBurnTick("jugador");
  const burnE = gameState.applyBurnTick("enemigo");
  gameState.rechargeAP();

  ui.setScores(gameState.rondasJugador, gameState.rondasEnemigo);
  ui.updateHP("jugador", gameState.hpJugador, gameState.maxHp);
  ui.updateHP("enemigo", gameState.hpEnemigo, gameState.maxHp);
  ui.updateAP(gameState.apJugador, gameState.maxAp);
  ui.updateStatus("jugador", gameState.statusJugador);
  ui.updateStatus("enemigo", gameState.statusEnemigo);

  const rn = gameState.ataqueJugador.length;
  if (charged) ui.addChargedAttackLine("jugador", rn, emojiJug, STATUS_EFFECTS[getEffectForCharged(ataqueJug)]?.label || "");
  else ui.addAttackLine("jugador", rn, emojiJug);
  
  if (enemigoCharged) ui.addChargedAttackLine("enemigo", rn, emojiEnem, STATUS_EFFECTS[getEffectForCharged(ataqueEnem)]?.label || "");
  else ui.addAttackLine("enemigo", rn, emojiEnem);

  sfx.playAttack(ataqueJug);
  if (combatCtx) { 
    const cw = ui.combatCanvasOverlay.width, ch = ui.combatCanvasOverlay.height; 
    particles.emitForAttack(ataqueJug, cw * 0.7, ch * 0.4); 
    particles.emitForAttack(ataqueEnem, cw * 0.3, ch * 0.4);
  }
  if (charged || enemigoCharged || playerEff || enemyEff) ui.triggerShakeCSS(charged ? 8 : 5, charged ? 350 : 200);
  
  if (charged) { 
    const eff = getEffectForCharged(ataqueJug); 
    if (eff === "QUEMADO") sfx.playBurn(); 
    else if (eff === "CONGELADO") sfx.playFreeze(); 
    else if (eff === "ENVENENADO") sfx.playPoison(); 
  }
  if (burnJ > 0) ui.appendMessage(`🔥 ${burnJ} daño de quemadura (tú)`);
  if (burnE > 0) ui.appendMessage(`🔥 ${burnE} daño de quemadura (rival)`);

  const res = realDmgToEnemy > realDmgToJugador ? "✅ Ganaste ronda" : realDmgToEnemy < realDmgToJugador ? "❌ Perdiste ronda" : "🤝 Empate";
  ui.setMessage(`${res} R${rn}: ${emojiJug}${charged ? "⚡" : ""} vs ${emojiEnem}${enemigoCharged ? "⚡" : ""}.${playerEff}${enemyEff}`);
  ui.appendMessage(`📊 Ronda ${rn}: Tú ${gameState.hpJugador} HP | Rival ${gameState.hpEnemigo} HP`);

  enableAttackButtons();

  if (gameState.hpJugador <= 0 || gameState.hpEnemigo <= 0 || gameState.ataqueJugador.length >= 5) {
    setTimeout(() => {
      let msg = "";
      if (gameState.hpJugador <= 0) { msg = "💀 DERROTA: Te has quedado sin vida"; sfx.playDefeat(); }
      else if (gameState.hpEnemigo <= 0) { msg = "🎉 ¡VICTORIA! Derrotaste al rival"; sfx.playVictory(); }
      else if (gameState.rondasJugador > gameState.rondasEnemigo) { msg = `🎉 GANASTE ${gameState.rondasJugador} a ${gameState.rondasEnemigo} 🎉`; sfx.playVictory(); }
      else if (gameState.rondasEnemigo > gameState.rondasJugador) { msg = `💀 PERDISTE ${gameState.rondasJugador} a ${gameState.rondasEnemigo} 💀`; sfx.playDefeat(); }
      else msg = "🤝 EMPATE TOTAL 🤝";
      finalizarJuego(msg);
    }, 600);
  }
}

function finalizarJuego(msg) {
  ui.disableAttacks(); 
  ui.clearBattleLists();
  ui.setMessage("");
  const h = document.createElement("p"); 
  h.innerHTML = "📊 RESULTADOS DE LA BATALLA"; 
  h.style.fontWeight = "bold"; 
  h.style.textAlign = "center";
  ui.sectionMensajes?.appendChild(h);
  
  const rounds = Math.min(gameState.ataqueJugador.length, gameState.ataqueEnemigo.length);
  for (let i = 0; i < rounds; i++) {
    const aJ = gameState.ataqueJugador[i], aE = gameState.ataqueEnemigo[i];
    const eJ = TIPOS_ATAQUE.find((t) => t.nombre === aJ)?.emoji || "⚔️";
    const eE = TIPOS_ATAQUE.find((t) => t.nombre === aE)?.emoji || "⚔️";
    let r = "🤝", t = "Empate";
    if (FUERZA_ATAQUES[aJ] === aE) { r = "✅"; t = "Ganaste"; }
    else if (FUERZA_ATAQUES[aE] === aJ) { r = "❌"; t = "Perdiste"; }
    ui.appendMessage(`${r} Ronda ${i + 1}: ${eJ} vs ${eE} - ${t}`);
  }
  
  ui.showFinalMessage(msg);
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

// ——— Eventos del Lobby ———
lobby.onAction((mode, opts) => {
  switch (mode) {
    case "quick_match":
      gameState.gameMode = "online";
      lobby.showMatchmaking();
      if (net.connected) {
        net.quickMatch();
      } else {
        net.connect();
        const unbind = net.on("open", () => {
          net.quickMatch();
          unbind();
        });
      }
      break;

    case "create_room":
      gameState.gameMode = "online";
      lobby.setStatus("⏳ Creando sala privada...");
      if (net.connected) {
        net.createRoom();
      } else {
        net.connect();
        const unbind = net.on("open", () => {
          net.createRoom();
          unbind();
        });
      }
      break;

    case "join_room":
      gameState.gameMode = "online";
      lobby.setStatus(`⏳ Conectando a la sala ${opts.code}...`);
      if (net.connected) {
        net.joinRoom(opts.code);
      } else {
        net.connect();
        const unbind = net.on("open", () => {
          net.joinRoom(opts.code);
          unbind();
        });
      }
      break;

    case "single_player":
      gameState.gameMode = "solo";
      gameState.difficulty = opts.difficulty || "normal";
      gameState.setPhase("SELECCION");
      lobby.hide();
      ui.showPhase("SELECCION");
      ui.renderPetCards(animales);
      ui.setMessage(`Modo vs IA (${opts.difficulty.toUpperCase()}): Elige tu mascota`);
      if (ui.botonMascotaJugador) ui.botonMascotaJugador.disabled = false;
      break;

    case "cancel_match":
      net.leaveRoom();
      lobby.setStatus("");
      lobby.cancelMatchBtn?.classList.add("hidden");
      break;
  }
});

// ——— Botones UI ———
ui.botonMascotaJugador?.addEventListener("click", seleccionarMascota);
ui.botonReiniciar?.addEventListener("click", irALobby);
ui.botonIniciarPelea?.addEventListener("click", () => {
  if (gameState.phase !== "MAPA") return;
  const enemy = npcEnemigos[aleatorio(0, npcEnemigos.length - 1)]?.nombre || "Neptuno";
  startCombat(enemy);
});

const muteBtn = document.getElementById("mute-toggle");
if (muteBtn) {
  muteBtn.addEventListener("click", () => { 
    const m = sfx.toggle(); 
    muteBtn.textContent = m ? "🔇" : "🔊"; 
    muteBtn.title = m ? "Activar sonido" : "Silenciar sonido"; 
    if (!m) sfx.resume(); 
  });
}

ui.onMovementControls((dir) => setDirection(dir, true), () => stopMovement());
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
document.addEventListener("click", () => sfx.resume(), { once: true });
document.addEventListener("keydown", () => sfx.resume(), { once: true });

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (gameState.phase !== "MAPA" || !mascotaJugador) return;
    const prevW = ui.mapa.width || 1, prevH = ui.mapa.height || 1;
    const rx = mascotaJugador.x / prevW, ry = mascotaJugador.y / prevH;
    const { width, height } = ui.resizeCanvas();
    mascotaJugador.setPosition(rx * width, ry * height, true);
    npcEnemigos = buildNpcEnemies(width, height);
    obstacles = generateObstacles(width, height, 4);
    powerUps = generatePowerUps(width, height, 3);
  }, 150);
});

window.moverArriba = () => setDirection("up", true);
window.moverAbajo = () => setDirection("down", true);
window.moverIzquierda = () => setDirection("left", true);
window.moverDerecha = () => setDirection("right", true);
window.detenerMovimiento = stopMovement;

// ——— Inicialización ———
net.connect();
irALobby();
