/**
 * Cali Viva — Criaturas 3D originales y expresivas con siluetas y rig procedurales.
 *
 * NO utiliza esferas genéricas recoloreadas:
 *  - Salamander (Fuego): reptil bajo y sinuoso, cresta dorsal de fuego emisiva,
 *    cola segmentada articulada, 4 extremidades digitígradas y ojos ámbar.
 *  - Neptuno (Agua): nutria-axolote aerodinámica, penachos branquiales externos,
 *    cola de remo y patas palmeadas.
 *  - Tierrudo (Tierra): armadillo-gliptodonte con caparazón de placas terracota,
 *    brotes botánicos, patas excavadoras y escudo cefálico.
 *
 * Cada criatura expone un método update(locomotion, dt, time) que anima:
 *  - Marcha cuadrúpeda (walk / run) con elevación de patas y balanceo de cadera.
 *  - Inclinación lateral (banking) en giros.
 *  - Respiración y pestañeo en reposo (idle).
 *  - Ondulación secundaria de la cola y cresta.
 */
import * as THREE from 'three';
import { col, mixCol } from './kit.mjs';
import { GAIT } from './locomotion.mjs';

function createEye(tracker, irisColor) {
  const eye = new THREE.Group();
  const scleraGeo = tracker.track(new THREE.SphereGeometry(0.09, 8, 8));
  scleraGeo.scale(1.0, 1.0, 0.6);
  const scleraMat = tracker.track(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.2 }));
  const sclera = new THREE.Mesh(scleraGeo, scleraMat);
  eye.add(sclera);

  const irisGeo = tracker.track(new THREE.SphereGeometry(0.05, 8, 8));
  irisGeo.scale(1.0, 1.0, 0.4);
  const irisMat = tracker.track(new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.3 }));
  const iris = new THREE.Mesh(irisGeo, irisMat);
  iris.position.set(0, 0, 0.045);
  eye.add(iris);

  const pupilGeo = tracker.track(new THREE.SphereGeometry(0.025, 6, 6));
  pupilGeo.scale(0.5, 1.0, 0.3);
  const pupilMat = tracker.track(new THREE.MeshBasicMaterial({ color: col('#0a0a0a') }));
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.set(0, 0, 0.065);
  eye.add(pupil);

  return eye;
}

// ============================================================================
// 1. SALAMANDER (FUEGO)
// ============================================================================
export function buildSalamander(tracker) {
  const root = new THREE.Group();
  root.name = 'creature:salamander';

  const C = {
    skinBase: col('#d84315'),      // naranja fuego cálido
    skinBelly: col('#ffb74d'),     // vientre crema cálido
    skinBack: col('#bf360c'),      // lomo oscuro terracota
    crestEmissive: col('#ff9100'), // fuego dorado
    eyeIris: col('#ffab00'),
    claw: col('#212121'),
  };

  const matSkin = tracker.track(new THREE.MeshStandardMaterial({ color: C.skinBase, roughness: 0.65 }));
  const matBelly = tracker.track(new THREE.MeshStandardMaterial({ color: C.skinBelly, roughness: 0.7 }));
  const matBack = tracker.track(new THREE.MeshStandardMaterial({ color: C.skinBack, roughness: 0.6 }));
  const matCrest = tracker.track(
    new THREE.MeshStandardMaterial({
      color: C.crestEmissive,
      emissive: C.crestEmissive,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
    })
  );
  const matClaw = tracker.track(new THREE.MeshStandardMaterial({ color: C.claw, roughness: 0.4 }));

  // Torso bajo y sinuoso
  const body = new THREE.Group();
  body.position.set(0, 0.38, 0);
  root.add(body);

  const torsoGeo = tracker.track(new THREE.CylinderGeometry(0.24, 0.28, 0.95, 10));
  torsoGeo.rotateX(Math.PI / 2);
  torsoGeo.scale(1.15, 0.85, 1.0);
  const torso = new THREE.Mesh(torsoGeo, matSkin);
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Placa dorsal
  const backGeo = tracker.track(new THREE.BoxGeometry(0.32, 0.1, 0.85));
  const back = new THREE.Mesh(backGeo, matBack);
  back.position.set(0, 0.16, 0);
  body.add(back);

  // Cuello y Cabeza
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.08, -0.52);
  body.add(headGroup);

  const headGeo = tracker.track(new THREE.ConeGeometry(0.3, 0.55, 8));
  headGeo.rotateX(-Math.PI / 2);
  headGeo.scale(1.2, 0.75, 1.0);
  const head = new THREE.Mesh(headGeo, matSkin);
  head.position.set(0, 0, -0.22);
  head.castShadow = true;
  headGroup.add(head);

  // Ojos ámbar expresivos
  const eyeL = createEye(tracker, C.eyeIris);
  eyeL.position.set(-0.2, 0.12, -0.2);
  eyeL.rotation.y = -0.35;
  headGroup.add(eyeL);

  const eyeR = createEye(tracker, C.eyeIris);
  eyeR.position.set(0.2, 0.12, -0.2);
  eyeR.rotation.y = 0.35;
  headGroup.add(eyeR);

  // Cresta de fuego sobre la cabeza y lomo (aletas en cuña emisivas)
  const crestNodes = [];
  for (let i = 0; i < 5; i++) {
    const s = 0.18 - i * 0.02;
    const crestGeo = tracker.track(new THREE.ConeGeometry(s * 0.5, s * 1.8, 4));
    crestGeo.rotateX(Math.PI / 5);
    const c = new THREE.Mesh(crestGeo, matCrest);
    const cz = -0.35 + i * 0.22;
    c.position.set(0, 0.22, cz);
    body.add(c);
    crestNodes.push(c);
  }

  // Cola articulada de 3 segmentos que ondea
  const tailSegments = [];
  let parentSegment = body;
  for (let i = 0; i < 3; i++) {
    const segGroup = new THREE.Group();
    segGroup.position.set(0, 0, i === 0 ? 0.48 : 0.35);
    parentSegment.add(segGroup);

    const radius = 0.18 - i * 0.05;
    const len = 0.4;
    const segGeo = tracker.track(new THREE.ConeGeometry(radius, len, 7));
    segGeo.rotateX(Math.PI / 2);
    const segMesh = new THREE.Mesh(segGeo, matSkin);
    segMesh.position.set(0, 0, len / 2);
    segMesh.castShadow = true;
    segGroup.add(segMesh);

    tailSegments.push(segGroup);
    parentSegment = segGroup;
  }

  // 4 Extremidades (delanteras y traseras)
  const legDefs = [
    { name: 'FL', x: -0.32, z: -0.32 },
    { name: 'FR', x: 0.32, z: -0.32 },
    { name: 'RL', x: -0.34, z: 0.32 },
    { name: 'RR', x: 0.34, z: 0.32 },
  ];
  const legs = [];

  for (const def of legDefs) {
    const hip = new THREE.Group();
    hip.position.set(def.x, 0.0, def.z);
    body.add(hip);

    // Muslo orientado hacia afuera
    const thighGeo = tracker.track(new THREE.CylinderGeometry(0.08, 0.07, 0.26, 6));
    const thigh = new THREE.Mesh(thighGeo, matSkin);
    thigh.position.set(Math.sign(def.x) * 0.08, -0.1, 0);
    thigh.rotation.z = -Math.sign(def.x) * 0.45;
    hip.add(thigh);

    // Pata y garras
    const footGeo = tracker.track(new THREE.BoxGeometry(0.14, 0.06, 0.18));
    const foot = new THREE.Mesh(footGeo, matClaw);
    foot.position.set(Math.sign(def.x) * 0.14, -0.32, 0.02);
    foot.castShadow = true;
    hip.add(foot);

    legs.push({ hip, def });
  }

  // -------------------------------------------------------------
  // ANIMACIÓN PROCEDURAL DEL SALAMANDER
  // -------------------------------------------------------------
  function update(locomotion, dt, time) {
    const speed = locomotion.speed;
    const gait = locomotion.gait;
    const stride = locomotion.stride;
    const angVel = locomotion.angularVelocity;

    // 1. Inclinación lateral en giros (banking)
    const targetRoll = -angVel * 0.08;
    body.rotation.z += (targetRoll - body.rotation.z) * Math.min(1, dt * 10);

    // 2. Respiración en reposo (idle)
    if (gait === GAIT.IDLE) {
      const breath = Math.sin(time * 2.8) * 0.03;
      body.scale.set(1 + breath, 1 + breath * 0.5, 1);
      body.position.y = 0.38 + breath * 0.5;
      headGroup.rotation.x = Math.sin(time * 1.4) * 0.04;
      headGroup.rotation.y = Math.sin(time * 0.7) * 0.06;

      // Cola ondea suave
      tailSegments[0].rotation.y = Math.sin(time * 2.0) * 0.12;
      tailSegments[1].rotation.y = Math.sin(time * 2.0 - 0.6) * 0.18;
      tailSegments[2].rotation.y = Math.sin(time * 2.0 - 1.2) * 0.25;

      // Patas descansan en el suelo
      for (const { hip } of legs) {
        hip.rotation.x = 0;
        hip.position.y = 0;
      }
    } else {
      // 3. Marcha cuadrúpeda (Walk / Run)
      body.scale.set(1, 1, 1);
      const isRun = gait === GAIT.RUN;
      const freq = isRun ? 13 : 8.5;
      const stepH = isRun ? 0.15 : 0.08;
      const pitchAmp = isRun ? 0.08 : 0.04;

      // Cabeceo del cuerpo
      body.position.y = 0.38 + Math.abs(Math.sin(stride * freq * 0.5)) * stepH;
      body.rotation.x = Math.sin(stride * freq) * pitchAmp;

      // Movimiento de patas alternado (trote: FL + RR en fase, FR + RL opuestos)
      const phaseFL = Math.sin(stride * freq);
      const phaseFR = Math.sin(stride * freq + Math.PI);
      const phaseRL = Math.sin(stride * freq + Math.PI);
      const phaseRR = Math.sin(stride * freq);

      legs[0].hip.rotation.x = phaseFL * 0.55;
      legs[0].hip.position.y = Math.max(0, -phaseFL) * stepH;

      legs[1].hip.rotation.x = phaseFR * 0.55;
      legs[1].hip.position.y = Math.max(0, -phaseFR) * stepH;

      legs[2].hip.rotation.x = phaseRL * 0.55;
      legs[2].hip.position.y = Math.max(0, -phaseRL) * stepH;

      legs[3].hip.rotation.x = phaseRR * 0.55;
      legs[3].hip.position.y = Math.max(0, -phaseRR) * stepH;

      // Cola contrabalancea la marcha
      tailSegments[0].rotation.y = -Math.sin(stride * freq) * 0.22;
      tailSegments[1].rotation.y = -Math.sin(stride * freq - 0.6) * 0.35;
      tailSegments[2].rotation.y = -Math.sin(stride * freq - 1.2) * 0.45;
    }

    // Ondulación de la cresta de fuego (emisión pulsante)
    const crestPulse = 0.45 + Math.sin(time * 5.0) * 0.25;
    matCrest.emissiveIntensity = crestPulse;
  }

  return { root, update };
}

// ============================================================================
// 2. NEPTUNO (AGUA)
// ============================================================================
export function buildNeptuno(tracker) {
  const root = new THREE.Group();
  root.name = 'creature:neptuno';

  const C = {
    skinBase: col('#0288d1'),
    skinBelly: col('#b3e5fc'),
    gills: col('#ff4081'),
    eyeIris: col('#01579b'),
  };

  const matSkin = tracker.track(new THREE.MeshStandardMaterial({ color: C.skinBase, roughness: 0.5 }));
  const matBelly = tracker.track(new THREE.MeshStandardMaterial({ color: C.skinBelly, roughness: 0.55 }));
  const matGills = tracker.track(new THREE.MeshStandardMaterial({ color: C.gills, roughness: 0.4, transparent: true, opacity: 0.88 }));

  const body = new THREE.Group();
  body.position.set(0, 0.42, 0);
  root.add(body);

  // Cuerpo aerodinámico redondeado
  const torsoGeo = tracker.track(new THREE.SphereGeometry(0.38, 12, 10));
  torsoGeo.scale(0.9, 0.85, 1.4);
  const torso = new THREE.Mesh(torsoGeo, matSkin);
  torso.castShadow = true;
  body.add(torso);

  // Cabeza redondeada de nutria
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.16, -0.45);
  body.add(headGroup);

  const headGeo = tracker.track(new THREE.SphereGeometry(0.32, 10, 8));
  headGeo.scale(1.0, 0.88, 1.0);
  const head = new THREE.Mesh(headGeo, matSkin);
  headGroup.add(head);

  // Ojos
  const eyeL = createEye(tracker, C.eyeIris);
  eyeL.position.set(-0.2, 0.08, -0.22);
  headGroup.add(eyeL);
  const eyeR = createEye(tracker, C.eyeIris);
  eyeR.position.set(0.2, 0.08, -0.22);
  headGroup.add(eyeR);

  // Penachos branquiales externos de axolote (3 a cada lado)
  const gillPlumes = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const gGeo = tracker.track(new THREE.ConeGeometry(0.04, 0.28, 5));
      gGeo.rotateZ(side * (Math.PI / 3 + i * 0.15));
      const plume = new THREE.Mesh(gGeo, matGills);
      plume.position.set(side * 0.26, 0.08 + i * 0.08, -0.05);
      headGroup.add(plume);
      gillPlumes.push({ plume, baseRotZ: plume.rotation.z });
    }
  }

  // Cola ancha aplanada de remo
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.04, 0.45);
  body.add(tailGroup);

  const tailGeo = tracker.track(new THREE.ConeGeometry(0.26, 0.75, 8));
  tailGeo.rotateX(Math.PI / 2);
  tailGeo.scale(0.45, 1.2, 1.0);
  const tail = new THREE.Mesh(tailGeo, matSkin);
  tail.position.set(0, 0, 0.35);
  tailGroup.add(tail);

  // 4 Patas cortas
  const legDefs = [
    { x: -0.28, z: -0.25 },
    { x: 0.28, z: -0.25 },
    { x: -0.28, z: 0.25 },
    { x: 0.28, z: 0.25 },
  ];
  const legs = legDefs.map((def) => {
    const hip = new THREE.Group();
    hip.position.set(def.x, -0.15, def.z);
    body.add(hip);
    const pGeo = tracker.track(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 6));
    const pMesh = new THREE.Mesh(pGeo, matBelly);
    pMesh.position.set(0, -0.1, 0);
    hip.add(pMesh);
    return hip;
  });

  function update(locomotion, dt, time) {
    const gait = locomotion.gait;
    const stride = locomotion.stride;
    if (gait === GAIT.IDLE) {
      body.position.y = 0.42 + Math.sin(time * 2.2) * 0.02;
      tailGroup.rotation.y = Math.sin(time * 1.8) * 0.18;
      for (const g of gillPlumes) {
        g.plume.rotation.z = g.baseRotZ + Math.sin(time * 3.5) * 0.08;
      }
    } else {
      const freq = gait === GAIT.RUN ? 12 : 7.5;
      body.position.y = 0.42 + Math.abs(Math.sin(stride * freq * 0.5)) * 0.06;
      tailGroup.rotation.y = -Math.sin(stride * freq) * 0.35;
      for (let i = 0; i < 4; i++) {
        legs[i].rotation.x = Math.sin(stride * freq + (i % 2 === 0 ? 0 : Math.PI)) * 0.45;
      }
    }
  }

  return { root, update };
}

// ============================================================================
// 3. TIERRUDO (TIERRA)
// ============================================================================
export function buildTierrudo(tracker) {
  const root = new THREE.Group();
  root.name = 'creature:tierrudo';

  const C = {
    carapace: col('#6d4c41'),
    belly: col('#a1887f'),
    sprouts: col('#7cb342'),
    eyeIris: col('#4e342e'),
  };

  const matCarapace = tracker.track(new THREE.MeshStandardMaterial({ color: C.carapace, roughness: 0.85 }));
  const matBelly = tracker.track(new THREE.MeshStandardMaterial({ color: C.belly, roughness: 0.8 }));
  const matSprout = tracker.track(new THREE.MeshStandardMaterial({ color: C.sprouts, roughness: 0.5 }));

  const body = new THREE.Group();
  body.position.set(0, 0.45, 0);
  root.add(body);

  // Caparazón abovedado de armadillo
  const shellGeo = tracker.track(new THREE.SphereGeometry(0.48, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  shellGeo.scale(1.0, 0.75, 1.25);
  const shell = new THREE.Mesh(shellGeo, matCarapace);
  shell.castShadow = true;
  body.add(shell);

  // Vientre plano
  const bellyGeo = tracker.track(new THREE.BoxGeometry(0.7, 0.15, 0.95));
  const belly = new THREE.Mesh(bellyGeo, matBelly);
  belly.position.set(0, -0.05, 0);
  body.add(belly);

  // Cabeza con escudo cefálico
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.05, -0.55);
  body.add(headGroup);

  const headGeo = tracker.track(new THREE.BoxGeometry(0.34, 0.28, 0.38));
  const head = new THREE.Mesh(headGeo, matBelly);
  headGroup.add(head);

  // Ojos
  const eyeL = createEye(tracker, C.eyeIris);
  eyeL.position.set(-0.18, 0.06, -0.12);
  headGroup.add(eyeL);
  const eyeR = createEye(tracker, C.eyeIris);
  eyeR.position.set(0.18, 0.06, -0.12);
  headGroup.add(eyeR);

  // Pequeños brotes verdes sobre el caparazón
  for (let i = 0; i < 4; i++) {
    const spGeo = tracker.track(new THREE.ConeGeometry(0.04, 0.16, 4));
    const sp = new THREE.Mesh(spGeo, matSprout);
    sp.position.set((i % 2 === 0 ? -0.15 : 0.15), 0.38, -0.1 + i * 0.15);
    body.add(sp);
  }

  // Patas gruesas y robustas
  const legDefs = [
    { x: -0.32, z: -0.28 },
    { x: 0.32, z: -0.28 },
    { x: -0.32, z: 0.28 },
    { x: 0.32, z: 0.28 },
  ];
  const legs = legDefs.map((def) => {
    const hip = new THREE.Group();
    hip.position.set(def.x, -0.18, def.z);
    body.add(hip);
    const pGeo = tracker.track(new THREE.BoxGeometry(0.18, 0.22, 0.22));
    const pMesh = new THREE.Mesh(pGeo, matBelly);
    pMesh.position.set(0, -0.08, 0);
    pMesh.castShadow = true;
    hip.add(pMesh);
    return hip;
  });

  function update(locomotion, dt, time) {
    const gait = locomotion.gait;
    const stride = locomotion.stride;
    if (gait === GAIT.IDLE) {
      body.position.y = 0.45 + Math.sin(time * 2.0) * 0.015;
    } else {
      const freq = gait === GAIT.RUN ? 10 : 6.5;
      body.position.y = 0.45 + Math.abs(Math.sin(stride * freq * 0.5)) * 0.05;
      for (let i = 0; i < 4; i++) {
        legs[i].rotation.x = Math.sin(stride * freq + (i % 2 === 0 ? 0 : Math.PI)) * 0.4;
      }
    }
  }

  return { root, update };
}
