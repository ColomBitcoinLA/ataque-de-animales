import { gameState } from "./core/GameState.js";
import { GameEngine } from "./core/GameEngine.js";
import { Animal, createDefaultAnimals, AFINIDAD_ANIMAL } from "./entities/Animal.js";
import { NetworkClient } from "./network/NetworkClient.js";
import { UIManager, TIPOS_ATAQUE, STATUS_EFFECTS } from "./ui/UIManager.js";
import { LobbyManager } from "./ui/LobbyManager.js";
import { AuthModal } from "./ui/AuthModal.js";
import { ProfileManager } from "./ui/ProfileManager.js";
import { ProfileModal } from "./ui/ProfileModal.js";
import { SkillLoadout } from "./ui/SkillLoadout.js";
import { Arena3D, petElement } from "./3d/Arena3D.js";
import { typeMultiplier, getEffectForCharged, emojiForTipo } from "./core/typeChart.js";
import { ParticleSystem } from "./fx/ParticleSystem.js";
import { SoundManager } from "./audio/SoundManager.js";
import { BotAI } from "./entities/BotAI.js";
import { Obstacle, generateObstacles } from "./entities/Obstacle.js";
import { PowerUp, generatePowerUps } from "./entities/PowerUp.js";

const ui = new UIManager();
const lobby = new LobbyManager();
const net = new NetworkClient();
const particles = new ParticleSystem();
const sfx = new SoundManager();
const { list: animales } = createDefaultAnimals();

// —— Fase 5: Loadout de habilidades y Arena 3D ——
const skillLoadout = new SkillLoadout();
const arena3D = new Arena3D(document.getElementById("arena-3d"));
let use3D = localStorage.getItem("animalcombat_3d") === "1";
let arenaReady = false;

// —— Fase 4: Autenticación y Perfil ——
const profiles = new ProfileManager();
let petDmgBonus = 0;

const profileModal = new ProfileModal(profiles, () => {
  profiles.logout();
  net.setAuthToken(null);
  if (net.connected) net.disconnect();
  net.connect();
  renderAuthUI();
});

const authModal = new AuthModal((authState) => {
  if (authState.loggedIn) {
    profiles.state.loggedIn = true;
    profiles.state.username = authState.username;
    profiles.state.token = authState.token;
    profiles.saveSession(authState.token, authState.username);
    profiles.applyServerProfile(authState.profile);
    net.setAuthToken(authState.token);
    if (net.connected) net.disconnect(); // fuerza reconexión con token
    net.connect();
  }
  renderAuthUI();
});

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
      renderLoadoutPanel();
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
  
  // Fase 5: hechizos 3D y textos flotantes en combate online
  if (arenaReady) {
    if (p.myAttack && p.myAttack !== "ESCUDO") arena3D.castSpell(p.myAttack, "player");
    if (p.oppAttack && p.oppAttack !== "ESCUDO") arena3D.castSpell(p.oppAttack, "enemy");
    if (p.myAttack === "ESCUDO") arena3D.showFloatingText("🛡️ ESCUDO", "player", "#4fc3f7");
    if (p.oppAttack === "ESCUDO") arena3D.showFloatingText("🛡️ ESCUDO", "enemy", "#4fc3f7");
    if (p.myDamage > 0) arena3D.showFloatingText(`-${p.myDamage} HP`, "enemy", "#ff5252");
    if (p.oppDamage > 0) arena3D.showFloatingText(`-${p.oppDamage} HP`, "player", "#ff7043");
    if (p.oppCharged || p.myCharged) arena3D.impact(true);
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

net.on("match_ended", async (p) => {
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

  // —— Fase 4: XP y progreso ——
  let reward = null;
  if (p.profile && p.profile.username) {
    // Servidor ya registró el resultado para la cuenta autenticada
    profiles.applyServerProfile(p.profile);
    reward = { xpGain: p.xpGain || 0, leveledUp: !!p.leveledUp, newLevel: p.newLevel, title: p.newTitle };
  } else {
    reward = await profiles.handleServerMatchEnd(p);
  }
  if (reward && reward.xpGain) ui.appendMessage(xpRewardText(reward));
  renderAuthUI();
});

function enableAttackButtons() {
  ui.renderSkillButtons(skillLoadout.toMoves(), useMove, () => gameState.apJugador);
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

// ——— Fase 4: UI de Perfil y Auth ———
function xpRewardText(r) {
  let t = `✨ +${r.xpGain} XP`;
  if (r.leveledUp && r.newLevel) t += ` | 🎊 ¡SUBISTE AL NIVEL ${r.newLevel}! Título: ${r.title}`;
  return t;
}

function renderAuthUI() {
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogin) btnLogin.classList.toggle("hidden", profiles.state.loggedIn);
  if (btnLogout) btnLogout.classList.toggle("hidden", !profiles.state.loggedIn);
  renderProfileCard();
}

function renderProfileCard() {
  const card = document.getElementById("profile-card");
  if (!card) return;
  const p = profiles.state.profile;
  if (!p) { card.innerHTML = ""; return; }

  let pct = 100;
  if (p.xpForNext != null) {
    const span = Math.max(1, p.xpForNext - (p.xpPrev || 0));
    pct = Math.max(0, Math.min(100, ((p.xp - (p.xpPrev || 0)) / span) * 100));
  }
  const xpLabel = p.xpForNext != null ? `${p.xp} / ${p.xpForNext} XP` : `${p.xp} XP · MÁX`;

  const histHtml = (p.history || []).slice(-5).reverse().map((h) => `
    <div class="history-item ${h.result}">
      <span class="history-result">${h.result === "win" ? "🏆 Victoria" : h.result === "loss" ? "💀 Derrota" : "🤝 Empate"}</span>
      <span class="history-detail">${h.pet} vs ${h.opponent}${h.vsAI ? " (IA)" : ""}</span>
    </div>
  `).join("");

  card.innerHTML = `
    <div class="profile-header">
      <span class="profile-name">${p.guest ? "👤" : "🛡️"} ${p.username}</span>
      <span class="profile-title-badge">🎖️ Nv.${p.level} · ${p.title}</span>
    </div>
    <div class="profile-level-row">
      <span class="profile-level">Nivel ${p.level}</span>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
      <span class="xp-text">${xpLabel}</span>
    </div>
    <div class="profile-stats">
      <div class="stat-box"><div class="stat-value">${p.stats.battles}</div><div class="stat-label">Batallas</div></div>
      <div class="stat-box"><div class="stat-value">${p.stats.wins}</div><div class="stat-label">Victorias</div></div>
      <div class="stat-box"><div class="stat-value">${p.stats.losses}</div><div class="stat-label">Derrotas</div></div>
      <div class="stat-box"><div class="stat-value">${p.stats.winrate}%</div><div class="stat-label">Winrate</div></div>
    </div>
    ${histHtml ? `<div class="profile-history"><h4>Últimas partidas:</h4>${histHtml}</div>` : ""}
  `;
}

function bindAuthButtons() {
  document.getElementById("btn-login")?.addEventListener("click", () => authModal.open());
  document.getElementById("btn-profile")?.addEventListener("click", () => profileModal.open());
  document.getElementById("profile-card")?.addEventListener("click", () => profileModal.open());
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    profiles.logout();
    net.setAuthToken(null);
    if (net.connected) net.disconnect();
    net.connect();
    renderAuthUI();
  });
}

// —— Flujo de Pantallas ——
function irALobby() {
  gameState.resetAll();
  if (ui.botonMascotaJugador) ui.botonMascotaJugador.disabled = false;
  hideArena();
  ui.showPhase("LOBBY");
  lobby.show();
  renderAuthUI();
}

function seleccionarMascota() {
  const nombre = ui.getSelectedPetName();
  if (!nombre) { ui.setMessage("⚠️ Selecciona una mascota"); return; }
  const tpl = findAnimalTemplate(nombre); if (!tpl) return;
  
  sfx.playSelect();
  gameState.nombreMascotaJugador = nombre;

  // Fase 4: aplicar bonos de nivel a la mascota (+5 HP / +2 DMG por nivel)
  if (gameState.gameMode !== "online") {
    const bonus = profiles.getPetBonuses();
    petDmgBonus = bonus.dmgBonus;
    gameState.maxHp = 100 + bonus.hpBonus;
    if (bonus.hpBonus > 0) ui.appendMessage(`🎖️ Bonos Nv.${profiles.state.profile.level}: +${bonus.hpBonus} HP, +${bonus.dmgBonus} DMG`);
  } else {
    petDmgBonus = 0;
  }

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

  // Fase 5: inicializar arena 3D
  initArena();

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

// —— Fase 5: Arena 3D ——
function hideArena() {
  const el = document.getElementById("arena-3d");
  if (el) el.style.display = "none";
  arena3D.hide();
}

async function initArena() {
  const el = document.getElementById("arena-3d");
  if (!use3D) { 
    if (el) el.style.display = "none"; 
    arena3D.hide(); 
    arenaReady = false; 
    return; 
  }
  if (!arenaReady) arenaReady = await arena3D.init();
  if (arenaReady) {
    if (el) el.style.display = "block";
    const pName = gameState.nombreMascotaJugador || "Salamander";
    const eName = gameState.nombreMascotaEnemigo || "Tierrudo";
    arena3D.setCombatants(
      { nombre: pName, element: petElement(pName) },
      { nombre: eName, element: petElement(eName) }
    );
    arena3D.show();
  } else if (el) {
    el.style.display = "none";
  }
}

function update3DToggleLabel() {
  const btn = document.getElementById("btn-toggle-3d");
  if (btn) btn.textContent = use3D ? "👁️ Vista 3D: ON" : "👁️ Vista 3D: OFF";
}

/**
 * Ejecuta un movimiento del loadout (basic/charged/status/shield).
 * @param {string} moveType
 * @param {string|null} element
 */
function useMove(moveType, element) {
  if (gameState.phase !== "COMBATE") return;

  if (moveType === "shield") {
    if (gameState.isAuthoritative) {
      net.submitAttack(null, false, "shield");
      ui.disableAttacks();
      ui.setMessage("🛡️ ¡Escudo activado! Esperando al rival...");
    } else {
      localAttack(null, null, false, "shield");
    }
    return;
  }

  const charged = moveType === "charged";
  const move = moveType === "status" ? "status" : (charged ? "charged" : "basic");
  const emoji = emojiForTipo(element);

  if (gameState.isAuthoritative) {
    const cost = moveType === "status" ? 1 : (charged ? gameState.getChargedCost() : gameState.getBasicCost());
    if (cost > 0 && gameState.apJugador < cost) { ui.setMessage("⚠️ No tienes suficiente energía"); return; }
    net.submitAttack(element, charged, move);
    ui.disableAttacks();
    ui.setMessage(`⏳ ${emoji} ${element}${charged ? "⚡" : ""}. Esperando al rival...`);
    return;
  }

  localAttack(element, emoji, charged, move);
}

/** Cálculo de daño local (6 tipos + afinidad + bono de nivel). */
function calcLocalDamage(attackType, charged, attackerPet, defenderType, defenderStatus, move) {
  let base;
  if (move === "status") base = 10;
  else base = charged ? 30 : 20;
  base += petDmgBonus;
  if (AFINIDAD_ANIMAL[attackerPet] === attackType) base = Math.floor(base * 1.2);
  let eff = "";
  const mult = typeMultiplier(attackType, defenderType);
  if (mult > 1) { base = Math.floor(base * mult); eff = " 🔥 ¡Súper Efectivo (+50%)!"; }
  else if (mult < 1) { base = Math.floor(base * mult); eff = mult === 0.75 ? " 🐉 ¡Resistido!" : " 🛡️ Poco Efectivo (-30%)"; }
  if (defenderStatus === "ENVENENADO") base = Math.floor(base * 1.15);
  return { dmg: base, eff };
}

function localAttack(ataqueJug, emojiJug, charged, move) {
  if (gameState.phase !== "COMBATE") return;

  // Coste según movimiento
  const cost = move === "shield" ? 1 : move === "status" ? 1 : (charged ? gameState.getChargedCost() : gameState.getBasicCost());
  if (!gameState.spendAP(cost)) { ui.setMessage("⚠️ No tienes suficiente energía para este movimiento"); return; }

  gameState.rondaActual++;

  // Selección inteligente del BotAI
  const botChoice = botAI ? botAI.chooseAttack(gameState.apEnemigo) : { attack: obtenerAtaqueAleatorio().nombre, charged: gameState.apEnemigo >= 2 && Math.random() < 0.3 };
  const ataqueEnem = botChoice.attack;
  const enemigoCharged = botChoice.charged;
  if (enemigoCharged) gameState.apEnemigo -= 2;

  gameState.ataqueJugador.push(ataqueJug || "ESCUDO");
  gameState.ataqueEnemigo.push(ataqueEnem);
  if (botAI) botAI.recordRound(ataqueJug || "ESCUDO", ataqueEnem, charged, enemigoCharged);

  const emojiEnem = emojiForTipo(ataqueEnem);

  // Cálculo de daño (el escudo no ataca; reduce 50% el daño recibido)
  let dmgPlayer = 0, dmgEnemy = 0, playerEff = "", enemyEff = "";
  if (move !== "shield") {
    const r = calcLocalDamage(ataqueJug, charged, gameState.nombreMascotaJugador, ataqueEnem, gameState.statusEnemigo, move);
    dmgPlayer = r.dmg; playerEff = r.eff;
  }
  const re = calcLocalDamage(ataqueEnem, enemigoCharged, gameState.nombreMascotaEnemigo, ataqueJug || "NINGUNO", gameState.statusJugador, null);
  dmgEnemy = re.dmg; enemyEff = re.eff;
  if (move === "shield") dmgEnemy = Math.floor(dmgEnemy * 0.5);

  const realDmgToEnemy = gameState.applyDamage("enemigo", dmgPlayer);
  const realDmgToJugador = gameState.applyDamage("jugador", dmgEnemy);

  if ((charged || move === "status") && ataqueJug) { const e = getEffectForCharged(ataqueJug); if (e !== "NINGUNO") gameState.applyStatus("enemigo", e); }
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
  if (move === "shield") ui.addAttackLine("jugador", rn, "🛡️");
  else if (charged || move === "status") ui.addChargedAttackLine("jugador", rn, emojiJug, STATUS_EFFECTS[getEffectForCharged(ataqueJug)]?.label || "");
  else ui.addAttackLine("jugador", rn, emojiJug);

  if (enemigoCharged) ui.addChargedAttackLine("enemigo", rn, emojiEnem, STATUS_EFFECTS[getEffectForCharged(ataqueEnem)]?.label || "");
  else ui.addAttackLine("enemigo", rn, emojiEnem);

  // SFX y VFX
  if (move !== "shield") { sfx.playAttack(ataqueJug); }
  if (combatCtx && move !== "shield") {
    const cw = ui.combatCanvasOverlay.width, ch = ui.combatCanvasOverlay.height;
    particles.emitForAttack(ataqueJug, cw * 0.7, ch * 0.4);
  }
  if (combatCtx) {
    const cw = ui.combatCanvasOverlay.width, ch = ui.combatCanvasOverlay.height;
    particles.emitForAttack(ataqueEnem, cw * 0.3, ch * 0.4);
  }
  if (charged || enemigoCharged || playerEff || enemyEff) ui.triggerShakeCSS(charged ? 8 : 5, charged ? 350 : 200);

  if (charged || move === "status") {
    const eff = getEffectForCharged(ataqueJug);
    if (eff === "QUEMADO") sfx.playBurn();
    else if (eff === "CONGELADO") sfx.playFreeze();
    else if (eff === "ENVENENADO") sfx.playPoison();
  }

  // Fase 5: hechizos 3D y textos flotantes
  if (arenaReady) {
    if (move !== "shield" && ataqueJug) arena3D.castSpell(ataqueJug, "player");
    if (ataqueEnem) arena3D.castSpell(ataqueEnem, "enemy");
    if (move === "shield") arena3D.showFloatingText("🛡️ ESCUDO (-50%)", "player", "#4fc3f7");
    if (realDmgToEnemy > 0) arena3D.showFloatingText(`-${realDmgToEnemy} HP${playerEff ? " 🔥" : ""}`, "enemy", "#ff5252");
    if (realDmgToJugador > 0) arena3D.showFloatingText(`-${realDmgToJugador} HP${enemyEff ? " 💥" : ""}`, "player", "#ff7043");
    if (charged || enemigoCharged) arena3D.impact(true);
  }

  if (burnJ > 0) ui.appendMessage(`🔥 ${burnJ} daño de quemadura (tú)`);
  if (burnE > 0) ui.appendMessage(`🔥 ${burnE} daño de quemadura (rival)`);

  const res = realDmgToEnemy > realDmgToJugador ? "✅ Ganaste ronda" : realDmgToEnemy < realDmgToJugador ? "❌ Perdiste ronda" : "🤝 Empate";
  ui.setMessage(`${res} R${rn}: ${move === "shield" ? "🛡️" : emojiJug}${charged ? "⚡" : ""} vs ${emojiEnem}${enemigoCharged ? "⚡" : ""}.${playerEff}${enemyEff}`);
  ui.appendMessage(`📊 Ronda ${rn}: Tú ${gameState.hpJugador} HP | Rival ${gameState.hpEnemigo} HP`);

  enableAttackButtons();

  if (gameState.hpJugador <= 0 || gameState.hpEnemigo <= 0 || gameState.ataqueJugador.length >= 5) {
    setTimeout(async () => {
      let msg = "";
      let result = "draw";
      if (gameState.hpJugador <= 0) { msg = "💀 DERROTA: Te has quedado sin vida"; sfx.playDefeat(); result = "loss"; }
      else if (gameState.hpEnemigo <= 0) { msg = "🎉 ¡VICTORIA! Derrotaste al rival"; sfx.playVictory(); result = "win"; }
      else if (gameState.rondasJugador > gameState.rondasEnemigo) { msg = `🎉 GANASTE ${gameState.rondasJugador} a ${gameState.rondasEnemigo} 🎉`; sfx.playVictory(); result = "win"; }
      else if (gameState.rondasEnemigo > gameState.rondasJugador) { msg = `💀 PERDISTE ${gameState.rondasJugador} a ${gameState.rondasEnemigo} 💀`; sfx.playDefeat(); result = "loss"; }
      else msg = "🤝 EMPATE TOTAL 🤝";

      finalizarJuego(msg);

      // Fase 4: registrar resultado y otorgar XP
      try {
        const reward = await profiles.reportMatch(result, {
          pet: gameState.nombreMascotaJugador,
          opponent: gameState.nombreMascotaEnemigo,
          vsAI: true,
          difficulty: gameState.difficulty,
        });
        if (reward) ui.appendMessage(xpRewardText(reward));
      } catch { /* sin conexión */ }
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
    const mult = typeMultiplier(aJ, aE);
    if (mult > 1) { r = "✅"; t = "Ganaste"; }
    else if (mult < 1) { r = "❌"; t = "Perdiste"; }
    ui.appendMessage(`${r} Ronda ${i + 1}: ${eJ} vs ${eE} - ${t}`);
  }
  
  ui.showFinalMessage(msg);
  stopCombatRender();
  hideArena();
  gameState.setPhase("FIN");
  ui.showPhase("FIN");
}

function onKeyDown(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) { 
    case "ArrowUp":
    case "KeyW":
    case "w":
    case "W":
      event.preventDefault(); setDirection("up", true); break; 
    case "ArrowDown":
    case "KeyS":
    case "s":
    case "S":
      event.preventDefault(); setDirection("down", true); break; 
    case "ArrowLeft":
    case "KeyA":
    case "a":
    case "A":
      event.preventDefault(); setDirection("left", true); break; 
    case "ArrowRight":
    case "KeyD":
    case "d":
    case "D":
      event.preventDefault(); setDirection("right", true); break; 
  }
}

function onKeyUp(event) {
  if (gameState.phase !== "MAPA") return;
  switch (event.key) { 
    case "ArrowUp":
    case "KeyW":
    case "w":
    case "W":
      setDirection("up", false); break; 
    case "ArrowDown":
    case "KeyS":
    case "s":
    case "S":
      setDirection("down", false); break; 
    case "ArrowLeft":
    case "KeyA":
    case "a":
    case "A":
      setDirection("left", false); break; 
    case "ArrowRight":
    case "KeyD":
    case "d":
    case "D":
      setDirection("right", false); break; 
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
      renderLoadoutPanel();
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

// —— Fase 5: Toggle Vista 3D / 2D ——
const toggle3DBtn = document.getElementById("btn-toggle-3d");
if (toggle3DBtn) {
  update3DToggleLabel();
  toggle3DBtn.addEventListener("click", async () => {
    use3D = !use3D;
    localStorage.setItem("animalcombat_3d", use3D ? "1" : "0");
    if (use3D) await initArena();
    else { hideArena(); arenaReady = false; }
    update3DToggleLabel();
  });
}

// —— Fase 5: Render del loadout en la pantalla de selección ——
function renderLoadoutPanel() {
  skillLoadout.render(document.getElementById("skill-loadout-container"));
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

// ——— Inicialización (Fase 4: restaurar sesión antes de conectar) ———
(async () => {
  await profiles.init();
  net.setAuthToken(profiles.state.token);
  bindAuthButtons();
  net.connect();
  irALobby();
})();
