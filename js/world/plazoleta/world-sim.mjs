/**
 * world-sim.mjs — Simulación pura del recinto "Plazoleta del Río" (M2 / Cali Viva POC).
 *
 * Responsabilidad única: avanzar el ESTADO del mundo. No conoce three.js, ni el DOM,
 * ni la red, ni la cámara. Todas sus salidas son datos planos y deterministas.
 *
 * Contrato:
 *   - stepWorld(state, input, dt)  muta el estado y NO asigna memoria en régimen estable
 *     (usa buffers de scratch del propio estado y primitivas de js/simulation/kinematics.mjs).
 *   - No hay Math.random: el azar usa un LCG sembrado dentro del estado (determinismo).
 *   - Ninguna recompensa es autoritativa: la XP del POC está marcada como simulación local.
 *
 * La presentación LEE el estado; nunca lo escribe.
 */

import { advanceDirectedInto } from "../../simulation/kinematics.mjs";
import { blockedAt, surfaceHeightAt, zoneAt, PLAZOLETA_MAP } from "./map-v1.mjs";
import { createLucia, updateLucia, createPigeons, updatePigeons } from "./behaviors.mjs";

export const SIM = Object.freeze({
  hz: 60,
  walkSpeed: 2.5,
  runSpeed: 5.4,
  turnRate: 8.2,
  strideWalk: 0.62,
  strideRun: 0.98,
  playerRadius: 0.34,
  headHeight: 1.02,
  deckThreshold: 0.6,
  maxStep: 1 / 30,
});

const MAX_EVENTS = 16;

/** LCG determinista (32 bits) — el mismo estado produce la misma secuencia. */
export function nextRandom(state) {
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function bandFilters(map) {
  const ground = [];
  const deck = [];
  const groundFeet = 0;
  const groundHead = groundFeet + SIM.headHeight;
  const deckFeet = map.bridgeDeckY;
  const deckHead = deckFeet + SIM.headHeight;
  for (const s of map.solids) {
    if (s.yMax > groundFeet && s.yMin < groundHead) ground.push(s);
    if (s.yMax > deckFeet && s.yMin < deckHead) deck.push(s);
  }
  return { ground, deck };
}

/**
 * Crea el estado inicial del mundo.
 * @param {object} [map]
 * @param {{seed?: number}} [options]
 */
export function createWorldState(map = PLAZOLETA_MAP, { seed = 20261006 } = {}) {
  if (!map || !Array.isArray(map.solids)) throw new TypeError("createWorldState: mapa inválido.");
  const bands = bandFilters(map);
  const pigeonHomes = map.propFamilies.find((f) => f.id === "paloma")?.instances ?? [];

  // Área de juego extendida al oeste para que el tablero del puente sea recorrible.
  const playArea = Object.freeze({
    minX: -9.7,
    maxX: map.playArea.maxX,
    minZ: map.playArea.minZ,
    maxZ: map.playArea.maxZ,
  });

  const state = {
    map,
    playArea,
    solidsGround: bands.ground,
    solidsDeck: bands.deck,
    tick: 0,
    time: 0,
    rng: seed >>> 0,
    player: {
      id: "salamander",
      x: map.spawn.x,
      z: map.spawn.z,
      feetY: 0,
      y: 0,
      prevX: map.spawn.x,
      prevZ: map.spawn.z,
      heading: map.spawn.heading,
      speed: 0,
      locomotion: "idle",
      phase: 0,
      distance: 0,
      blockedX: false,
      blockedZ: false,
      zone: "plaza",
    },
    npcs: [createLucia(map)],
    critters: createPigeons(map, pigeonHomes),
    quest: {
      id: map.quest.id,
      stepIndex: 0,
      completed: false,
      rewardGranted: false,
      trust: { lucia: 0 },
      observations: 0,
    },
    interaction: { targetId: null, verb: null, label: null, distance: Infinity, inRange: false },
    stats: { ticks: 0, blockedTicks: 0, interactions: 0, events: 0 },
    events: [],
    scratch: {
      move: { x: 0, z: 0, blockedX: false, blockedZ: false, distance: 0 },
      dir: { x: 0, z: 0 },
    },
  };
  state.player.zone = zoneAt(map, state.player.x, state.player.z).id;
  syncFeet(state);
  return state;
}

function syncFeet(state) {
  const p = state.player;
  p.feetY = surfaceHeightAt(state.map, p.x, p.z, p.feetY, state.map.stepUp);
  p.y = p.feetY;
}

function pushEvent(state, type, data) {
  if (state.events.length >= MAX_EVENTS) state.events.shift();
  state.events.push({ type, ...data, tick: state.tick });
  state.stats.events++;
}

/** Gira `current` hacia `target` como máximo `maxDelta` radianes (camino corto). */
export function turnToward(current, target, maxDelta) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function updatePlayer(state, input, dt) {
  const p = state.player;
  const moveX = Number.isFinite(input?.moveX) ? input.moveX : 0;
  const moveZ = Number.isFinite(input?.moveZ) ? input.moveZ : 0;
  const running = Boolean(input?.run);
  const magnitude = Math.hypot(moveX, moveZ);

  p.prevX = p.x;
  p.prevZ = p.z;
  p.blockedX = false;
  p.blockedZ = false;

  if (magnitude > 0.001) {
    const dirX = moveX / magnitude;
    const dirZ = moveZ / magnitude;
    const desiredHeading = Math.atan2(dirX, dirZ);
    p.heading = turnToward(p.heading, desiredHeading, SIM.turnRate * dt);
    const speed = running ? SIM.runSpeed : SIM.walkSpeed;
    p.speed = speed;
    const solids = p.feetY > SIM.deckThreshold ? state.solidsDeck : state.solidsGround;
    state.scratch.dir.x = dirX;
    state.scratch.dir.z = dirZ;
    const result = advanceDirectedInto(
      state.scratch.move,
      p,
      state.scratch.dir,
      speed,
      dt,
      solids,
      state.playArea,
      SIM.playerRadius
    );
    p.blockedX = result.blockedX;
    p.blockedZ = result.blockedZ;
    if (result.distance > 0) {
      p.x = result.x;
      p.z = result.z;
      p.distance += result.distance;
      p.phase += result.distance / (running ? SIM.strideRun : SIM.strideWalk);
    }
    p.locomotion = running ? "run" : "walk";
  } else {
    p.speed = 0;
    p.locomotion = "idle";
  }

  if (p.blockedX || p.blockedZ) state.stats.blockedTicks++;
  syncFeet(state);
  p.zone = zoneAt(state.map, p.x, p.z).id;
}

function updateInteraction(state) {
  const it = state.interaction;
  const p = state.player;
  let bestId = null;
  let bestVerb = null;
  let bestLabel = null;
  let bestDistance = Infinity;
  for (const poi of state.map.interactables) {
    const d = Math.hypot(p.x - poi.x, p.z - poi.z);
    if (d <= poi.radius && d < bestDistance) {
      bestId = poi.id;
      bestVerb = poi.verb;
      bestLabel = poi.label;
      bestDistance = d;
    }
  }
  it.targetId = bestId;
  it.verb = bestVerb;
  it.label = bestLabel;
  it.distance = bestDistance;
  it.inRange = bestId !== null;
}

/**
 * Avanza un tick de simulación. Cero asignaciones en régimen estable.
 * @param {object} state
 * @param {{moveX?:number, moveZ?:number, run?:boolean}} input dirección de mundo ya resuelta
 * @param {number} dt
 */
export function stepWorld(state, input, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("stepWorld: dt debe ser finito y >= 0.");
  const step = Math.min(dt, SIM.maxStep);
  state.tick++;
  state.stats.ticks++;
  state.time += step;

  updatePlayer(state, input, step);
  updateLucia(state, step);
  updatePigeons(state, step);
  updateInteraction(state);
  return state;
}

/** Ejecuta ticks fijos deterministas (tests y arranque). */
export function runTicks(state, input, ticks, dt = 1 / SIM.hz) {
  for (let i = 0; i < ticks; i++) stepWorld(state, input, dt);
  return state;
}

/**
 * Activa la interacción actual. Devuelve un descriptor de acción (o null).
 * Asigna memoria solo cuando el jugador interactúa, nunca por frame.
 */
export function activate(state, dialogs) {
  const it = state.interaction;
  if (!it.inRange || !it.targetId) return null;
  state.stats.interactions++;
  const step = state.map.quest.steps[state.quest.stepIndex] ?? null;
  const isQuestTrigger = Boolean(step && step.trigger === it.targetId);
  const trustKey = it.targetId === "lucia" ? "lucia" : null;
  if (trustKey) state.quest.trust[trustKey] = Math.min(5, state.quest.trust[trustKey] + 1);

  if (isQuestTrigger) {
    state.quest.stepIndex++;
    const finished = state.quest.stepIndex >= state.map.quest.steps.length;
    let reward = null;
    if (finished && !state.quest.rewardGranted) {
      state.quest.rewardGranted = true;
      state.quest.completed = true;
      reward = { xp: state.map.quest.rewardXp, label: state.map.quest.rewardLabel };
      pushEvent(state, "quest-complete", { questId: state.map.quest.id, xp: reward.xp });
    } else {
      pushEvent(state, "quest-step", { stepId: step.id, stepIndex: state.quest.stepIndex });
    }
    return {
      type: "quest-step",
      stepId: step.id,
      questTitle: state.map.quest.title,
      objective: finished ? "Explora libremente la plazoleta" : state.map.quest.steps[state.quest.stepIndex].objective,
      completed: finished,
      reward,
      xpAwarded: reward ? reward.xp : 0,
      trust: state.quest.trust.lucia,
      dialog: dialogs.step(state, step.id, finished),
    };
  }

  if (it.targetId === "samar") state.quest.observations++;
  if (it.targetId === "lucia") pushEvent(state, "npc-greet", { npcId: "lucia", trust: state.quest.trust.lucia });
  return {
    type: "flavor",
    targetId: it.targetId,
    questTitle: state.map.quest.title,
    objective: state.quest.stepIndex >= state.map.quest.steps.length
      ? "Explora libremente la plazoleta"
      : state.map.quest.steps[state.quest.stepIndex].objective,
    completed: state.quest.completed,
    // Contrato uniforme: la XP sólo viaja en acciones de misión, nunca en sabor.
    reward: null,
    xpAwarded: 0,
    trust: state.quest.trust.lucia,
    dialog: dialogs.flavor(state, it.targetId),
  };
}

/** Consume los eventos del tick (la presentación los lee una vez por frame). */
export function drainEvents(state, handler) {
  if (state.events.length === 0) return 0;
  const count = state.events.length;
  for (let i = 0; i < count; i++) handler(state.events[i]);
  state.events.length = 0;
  return count;
}

/** Resumen legible del estado (HUD y tests). */
export function worldSummary(state) {
  const step = state.map.quest.steps[state.quest.stepIndex] ?? null;
  return {
    zone: zoneAt(state.map, state.player.x, state.player.z),
    objective: step ? step.objective : "Explora libremente la plazoleta",
    stepIndex: state.quest.stepIndex,
    stepsTotal: state.map.quest.steps.length,
    completed: state.quest.completed,
    trust: state.quest.trust.lucia,
    locomotion: state.player.locomotion,
    speed: state.player.speed,
  };
}

/** ¿El cuerpo del jugador está bloqueado en su posición actual? (invariante de simulación) */
export function playerBlocked(state) {
  const p = state.player;
  return blockedAt(state.map, p.x, p.z, p.feetY, SIM.playerRadius, SIM.headHeight);
}
