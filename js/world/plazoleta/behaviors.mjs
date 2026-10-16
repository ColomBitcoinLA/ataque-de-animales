/**
 * behaviors.mjs — Comportamientos de agentes del POC (M2 / Cali Viva).
 *
 * Módulo puro: recibe el estado del mundo y lo muta; no conoce render, cámara ni red.
 * Demuestra la separación simulación/presentación con tres agentes distintos:
 *   - Lucía (NPC humana): presencia, orientación hacia el jugador y saludo contextual.
 *   - Palomas (fauna): picoteo con territorio propio, huida y retorno (ecología mínima).
 *
 * Cada comportamiento se escribe como función `updateX(state, dt)` para poder probarse
 * en Node sin navegador (tests/unit/plazoleta-sim.test.cjs).
 */

import { advanceDirectedInto } from "../../simulation/kinematics.mjs";

const LUCIA = Object.freeze({
  id: "lucia",
  x: 4.05,
  z: 4.35,
  heading: -2.2,
  noticeRadius: 4.6,
  greetRadius: 2.5,
  turnRate: 3.2,
});

const PIGEON = Object.freeze({
  wanderRadius: 0.7,
  fleeRadius: 2.6,
  fleeSpeed: 3.1,
  walkSpeed: 0.8,
  returnSpeed: 1.6,
  calmAfter: 3.4,
  radius: 0.16,
  headHeight: 0.4,
});

const TAU = Math.PI * 2;

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function turnToward(current, target, maxDelta) {
  const delta = shortestAngle(current, target);
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

export function createLucia(map) {
  return {
    id: LUCIA.id,
    kind: "npc",
    role: "entrenadora",
    x: LUCIA.x,
    z: LUCIA.z,
    y: 0,
    heading: LUCIA.heading,
    phase: 0,
    alert: 0,
    greeted: false,
    facingPlayer: false,
  };
}

/**
 * Lucía: respira/sway idle, se gira hacia el jugador cuando entra en su radio de
 * atención y emite un saludo (evento) la primera vez que lo tiene cerca.
 */
export function updateLucia(state, dt) {
  const lucia = state.npcs[0];
  if (!lucia) return;
  lucia.phase += dt * 1.7;
  const dx = state.player.x - lucia.x;
  const dz = state.player.z - lucia.z;
  const distance = Math.hypot(dx, dz);
  const near = distance <= LUCIA.noticeRadius;
  lucia.facingPlayer = near;
  lucia.alert = near ? Math.min(1, lucia.alert + dt * 2.5) : Math.max(0, lucia.alert - dt * 1.5);
  const targetHeading = near ? Math.atan2(dx, dz) : LUCIA.heading;
  lucia.heading = turnToward(lucia.heading, targetHeading, LUCIA.turnRate * dt);

  if (!lucia.greeted && distance <= LUCIA.greetRadius) {
    lucia.greeted = true;
    if (state.events.length < 16) {
      state.events.push({ type: "npc-greet", npcId: lucia.id, tick: state.tick });
      state.stats.events++;
    }
  }
  if (distance > LUCIA.noticeRadius) lucia.greeted = false;
}

export function createPigeons(map, homes) {
  return homes.map((inst, index) => ({
    id: `paloma-${index + 1}`,
    kind: "wildlife",
    homeX: inst[0],
    homeZ: inst[1],
    x: inst[0],
    z: inst[1],
    y: 0,
    heading: (index * 1.7) % TAU,
    state: "peck",
    timer: 0.4 + index * 0.7,
    fear: 0,
    phase: index * 1.1,
    targetX: inst[0],
    targetZ: inst[1],
    speed: 0,
  }));
}

function pickPeckTarget(state, bird) {
  // Dos números del LCG por decisión: determinista y sin Math.random.
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0;
  const a = state.rng / 4294967296;
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0;
  const b = state.rng / 4294967296;
  const angle = a * TAU;
  const radius = b * PIGEON.wanderRadius;
  bird.targetX = bird.homeX + Math.cos(angle) * radius;
  bird.targetZ = bird.homeZ + Math.sin(angle) * radius;
}

/**
 * Palomas: picotean alrededor de su territorio; si el jugador se acerca huyen en
 * línea recta; cuando se calman vuelven a su zona. Usa las primitivas compartidas
 * de movimiento, por lo que no hay una segunda cinemática.
 */
export function updatePigeons(state, dt) {
  const p = state.player;
  for (const bird of state.critters) {
    bird.phase += dt * 6;
    const distToPlayer = Math.hypot(p.x - bird.x, p.z - bird.z);
    if (distToPlayer <= PIGEON.fleeRadius) {
      bird.state = "flee";
      bird.fear = 1;
      bird.timer = PIGEON.calmAfter;
      const awayX = bird.x - p.x;
      const awayZ = bird.z - p.z;
      const awayMag = Math.hypot(awayX, awayZ) || 1;
      bird.targetX = bird.x + (awayX / awayMag) * 2.2;
      bird.targetZ = bird.z + (awayZ / awayMag) * 2.2;
    } else if (bird.state === "flee") {
      bird.timer -= dt;
      if (bird.timer <= 0) bird.state = "return";
    } else if (bird.state === "return") {
      bird.targetX = bird.homeX;
      bird.targetZ = bird.homeZ;
      if (Math.hypot(bird.x - bird.homeX, bird.z - bird.homeZ) < 0.25) {
        bird.state = "peck";
        bird.timer = 0.6;
      }
    } else {
      bird.timer -= dt;
      if (bird.timer <= 0) {
        pickPeckTarget(state, bird);
        bird.timer = 0.9 + (state.rng % 100) / 100;
      }
    }

    const dx = bird.targetX - bird.x;
    const dz = bird.targetZ - bird.z;
    const distance = Math.hypot(dx, dz);
    const speed = bird.state === "flee" ? PIGEON.fleeSpeed : bird.state === "return" ? PIGEON.returnSpeed : PIGEON.walkSpeed;
    if (distance > 0.08 && speed > 0) {
      state.scratch.dir.x = dx / distance;
      state.scratch.dir.z = dz / distance;
      bird.heading = turnToward(bird.heading, Math.atan2(dx, dz), 6 * dt);
      advanceDirectedInto(
        state.scratch.move,
        bird,
        state.scratch.dir,
        speed,
        dt,
        state.solidsGround,
        state.playArea,
        PIGEON.radius
      );
      bird.x = state.scratch.move.x;
      bird.z = state.scratch.move.z;
      bird.speed = speed;
    } else {
      bird.speed = 0;
    }
    bird.fear = Math.max(0, bird.fear - dt * 0.6);
  }
}

/* ---------------------------------------------------------------------------
 * Contenido de diálogo (capa de contenido, no de simulación).
 * Las recompensas se etiquetan SIEMPRE como simulación local.
 * ------------------------------------------------------------------------- */

const LUCIA_STEP_LINES = Object.freeze({
  "hablar-lucia": {
    title: "Lucía · entrenadora",
    body: "¡Mira quién llegó a la plazoleta! Tu Salamander tiene buena pinta. " +
      "Antes de cruzar el puente, ve y obsérvalo bien: el Samán del centro lleva aquí más años que la iglesia.",
    lines: [
      "Paso 1 de 5 · Habla con Lucía",
      "Objetivo nuevo: observa el Samán del centro",
    ],
  },
  "volver-lucia": {
    title: "Lucía · entrenadora",
    body: "¡Volviste! Viste el río desde el puente, ¿cierto? Eso es Cali: el río manda. " +
      "Toma, esto es para tu mascota.",
    lines: [
      "Paso 5 de 5 · Vuelve con Lucía",
      "+120 XP (simulación local · no acredita progreso real)",
    ],
  },
});

const FLAVOR_DIALOGS = Object.freeze({
  samar: {
    title: "Samán centenario",
    body: "La corteza está tibia y llena de hormigas. Bajo esta copa caben treinta personas " +
      "y, al atardecer, media docena de loras. Tu Salamander levanta el hocico: huele a lluvia lejana.",
    lines: ["Observación registrada", "El árbol es un punto de referencia de la plazoleta"],
  },
  placa: {
    title: "Placa del malecón",
    body: "\"Al río Cali y a quienes lo cuidaron.\" La piedra está pulida por el uso. " +
      "Alguien dejó una flor fresca entre las letras.",
    lines: ["Lectura registrada"],
  },
  mirador: {
    title: "Mirador del puente",
    body: "Desde aquí el agua suena distinto: rebota en los arcos de piedra. " +
      "Río abajo se ve el malecón completo y, al fondo, la silueta de los Farallones.",
    lines: ["Vista desbloqueada · Farallones al fondo"],
  },
  fuente: {
    title: "Pileta de la plazoleta",
    body: "El agua corre fría. Tu Salamander bebe y sacude las orejas.",
    lines: ["Tu mascota recupera el aliento"],
  },
});

const LUCIA_FLAVOR = Object.freeze([
  {
    title: "Lucía · entrenadora",
    body: "Sigue el recorrido del malecón: placa, puente y mirador. " +
      "Cuando termines, vuelve y te cuento lo que se ve desde el otro lado.",
    lines: ["Conversación de apoyo"],
  },
  {
    title: "Lucía · entrenadora",
    body: "Los sábados la plazoleta se llena de gente y las palomas se vuelven atrevidas. " +
      "Tu mascota todavía las asusta.",
    lines: ["Conversación de apoyo"],
  },
  {
    title: "Lucía · entrenadora",
    body: "Ese Samán es el mejor reloj del barrio: cuando la sombra llega a la pileta, ya es de noche.",
    lines: ["Conversación de apoyo"],
  },
]);

/**
 * Fábrica de contenido de diálogo: `step` para pasos de misión, `flavor` para el resto.
 */
export const dialogs = Object.freeze({
  step(state, stepId, finished) {
    if (stepId === "volver-lucia") {
      const base = LUCIA_STEP_LINES["volver-lucia"];
      return { ...base, reward: finished ? state.map.quest.rewardLabel : null };
    }
    const known = LUCIA_STEP_LINES[stepId];
    if (known) return { ...known, reward: null };
    const step = state.map.quest.steps.find((s) => s.id === stepId);
    return {
      title: "Objetivo cumplido",
      body: step ? `Siguiente objetivo: ${state.map.quest.steps[state.quest.stepIndex]?.objective ?? "explorar"}` : "Explora libremente.",
      lines: [step ? `Paso cumplido · ${step.id}` : "Paso cumplido"],
      reward: null,
    };
  },
  flavor(state, targetId) {
    if (targetId === "lucia") {
      const index = state.quest.trust.lucia % LUCIA_FLAVOR.length;
      return { ...LUCIA_FLAVOR[index], reward: null };
    }
    const known = FLAVOR_DIALOGS[targetId];
    if (known) return { ...known, reward: null };
    return { title: "Plazoleta del Río", body: "No hay nada más que hacer aquí por ahora.", lines: [], reward: null };
  },
});
