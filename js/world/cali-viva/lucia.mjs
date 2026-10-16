/**
 * Cali Viva — Lucía, la entrenadora caleña (NPC humano estilizado).
 *
 * Silueta humana estilizada (no es una mascota ni un clon):
 *  - Chaqueta cortavientos turquesa con mangas blancas.
 *  - Pantalones cortos blancos de senderismo y zapatillas.
 *  - Cabello oscuro recogido con cinta de colores caleños.
 *  - Morralito bandolera regional cruzado.
 *  - Animación procedural: respiración, parpadeo, giro de cabeza hacia la mascota
 *    y saludo de mano cuando el jugador se encuentra cerca.
 */
import * as THREE from 'three';
import { col } from './kit.mjs';
import { LUCIA } from './layout.mjs';

export function buildLucia(tracker) {
  const root = new THREE.Group();
  root.name = 'npc:lucia';
  root.position.set(LUCIA.x, 0, LUCIA.z);
  root.rotation.y = LUCIA.heading;

  const C = {
    skin: col('#b57a53'),         // tono de piel cálido
    jacketTurquoise: col('#00acc1'), // cortavientos turquesa
    jacketWhite: col('#f5f5f5'),
    shortsWhite: col('#e0e0e0'),
    hairDark: col('#212121'),
    hairRibbon: col('#ff4081'),
    sneakers: col('#ffffff'),
    satchelLeather: col('#795548'),
    eyes: col('#3e2723'),
  };

  const matSkin = tracker.track(new THREE.MeshStandardMaterial({ color: C.skin, roughness: 0.65 }));
  const matJacket = tracker.track(new THREE.MeshStandardMaterial({ color: C.jacketTurquoise, roughness: 0.55 }));
  const matJacketTrim = tracker.track(new THREE.MeshStandardMaterial({ color: C.jacketWhite, roughness: 0.55 }));
  const matShorts = tracker.track(new THREE.MeshStandardMaterial({ color: C.shortsWhite, roughness: 0.7 }));
  const matHair = tracker.track(new THREE.MeshStandardMaterial({ color: C.hairDark, roughness: 0.6 }));
  const matRibbon = tracker.track(new THREE.MeshStandardMaterial({ color: C.hairRibbon, roughness: 0.5 }));
  const matSatchel = tracker.track(new THREE.MeshStandardMaterial({ color: C.satchelLeather, roughness: 0.6 }));
  const matShoes = tracker.track(new THREE.MeshStandardMaterial({ color: C.sneakers, roughness: 0.4 }));

  // Altura total: ~1.70 m
  // Piernas y zapatillas
  for (const side of [-1, 1]) {
    // Pierna
    const legGeo = tracker.track(new THREE.CylinderGeometry(0.065, 0.055, 0.72, 8));
    const leg = new THREE.Mesh(legGeo, matSkin);
    leg.position.set(side * 0.12, 0.38, 0);
    leg.castShadow = true;
    root.add(leg);

    // Zapatilla
    const shoeGeo = tracker.track(new THREE.BoxGeometry(0.1, 0.08, 0.22));
    const shoe = new THREE.Mesh(shoeGeo, matShoes);
    shoe.position.set(side * 0.12, 0.04, -0.03);
    root.add(shoe);
  }

  // Pantalones cortos
  const shortsGeo = tracker.track(new THREE.CylinderGeometry(0.18, 0.22, 0.32, 10));
  const shorts = new THREE.Mesh(shortsGeo, matShorts);
  shorts.position.set(0, 0.82, 0);
  shorts.castShadow = true;
  root.add(shorts);

  // Torso / Chaqueta cortavientos
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.15, 0);
  root.add(torsoGroup);

  const jacketGeo = tracker.track(new THREE.CylinderGeometry(0.17, 0.19, 0.46, 10));
  jacketGeo.scale(1.2, 1.0, 0.85);
  const jacket = new THREE.Mesh(jacketGeo, matJacket);
  jacket.castShadow = true;
  torsoGroup.add(jacket);

  // Cuello blanco de la chaqueta
  const collarGeo = tracker.track(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 8));
  const collar = new THREE.Mesh(collarGeo, matJacketTrim);
  collar.position.set(0, 0.25, 0);
  torsoGroup.add(collar);

  // Bolso / Morral bandolera cruzado
  const satchelGeo = tracker.track(new THREE.BoxGeometry(0.24, 0.22, 0.09));
  satchelGeo.rotateZ(0.2);
  const satchel = new THREE.Mesh(satchelGeo, matSatchel);
  satchel.position.set(0.14, -0.05, 0.15);
  torsoGroup.add(satchel);

  // Cuello y Cabeza
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.32, 0);
  torsoGroup.add(headGroup);

  const headGeo = tracker.track(new THREE.SphereGeometry(0.13, 10, 10));
  headGeo.scale(0.9, 1.05, 0.95);
  const head = new THREE.Mesh(headGeo, matSkin);
  head.castShadow = true;
  headGroup.add(head);

  // Cabello oscuro con peinado recogido y cinta
  const hairGeo = tracker.track(new THREE.SphereGeometry(0.145, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7));
  const hair = new THREE.Mesh(hairGeo, matHair);
  hair.position.set(0, 0.04, -0.02);
  headGroup.add(hair);

  // Coleta / moño trasero
  const bunGeo = tracker.track(new THREE.SphereGeometry(0.08, 8, 8));
  const bun = new THREE.Mesh(bunGeo, matHair);
  bun.position.set(0, 0.08, 0.14);
  headGroup.add(bun);

  // Cinta fucsia
  const ribbonGeo = tracker.track(new THREE.TorusGeometry(0.09, 0.018, 6, 12));
  const ribbon = new THREE.Mesh(ribbonGeo, matRibbon);
  ribbon.position.set(0, 0.08, 0.1);
  headGroup.add(ribbon);

  // Ojos oscuros amables
  for (const side of [-1, 1]) {
    const eyeGeo = tracker.track(new THREE.BoxGeometry(0.028, 0.016, 0.01));
    const eye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: C.eyes }));
    eye.position.set(side * 0.045, 0.01, -0.125);
    headGroup.add(eye);
  }

  // Sonrisa sutil
  const smileGeo = tracker.track(new THREE.BoxGeometry(0.04, 0.01, 0.01));
  const smile = new THREE.Mesh(smileGeo, new THREE.MeshBasicMaterial({ color: col('#8d4925') }));
  smile.position.set(0, -0.045, -0.122);
  headGroup.add(smile);

  // Brazos
  // Brazo izquierdo (descansa al costado)
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.24, 0.18, 0);
  torsoGroup.add(armLGroup);

  const armLGeo = tracker.track(new THREE.CylinderGeometry(0.045, 0.04, 0.48, 6));
  const armL = new THREE.Mesh(armLGeo, matJacketTrim);
  armL.position.set(0, -0.22, 0);
  armLGroup.add(armL);

  // Brazo derecho (puede saludar cuando el jugador se acerca)
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.24, 0.18, 0);
  torsoGroup.add(armRGroup);

  const armRGeo = tracker.track(new THREE.CylinderGeometry(0.045, 0.04, 0.48, 6));
  const armR = new THREE.Mesh(armRGeo, matJacketTrim);
  armR.position.set(0, -0.22, 0);
  armRGroup.add(armR);

  // Animación procedural
  function update(playerPos, dt, time) {
    // Respiración del torso
    torsoGroup.position.y = 1.15 + Math.sin(time * 2.2) * 0.012;

    // Distancia hacia el jugador
    const dx = playerPos.x - LUCIA.x;
    const dz = playerPos.z - LUCIA.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 4.5) {
      // Girar cabeza hacia el jugador
      const targetAngle = Math.atan2(dx, dz) - LUCIA.heading;
      const clampedAngle = Math.max(-0.8, Math.min(0.8, targetAngle));
      headGroup.rotation.y += (clampedAngle - headGroup.rotation.y) * Math.min(1, dt * 6);

      // Saludo alegre con la mano derecha si está muy cerca (< 3.2 m)
      if (dist < 3.2) {
        armRGroup.rotation.z = Math.PI * 0.75 + Math.sin(time * 6.0) * 0.25;
        armRGroup.rotation.x = -0.2;
      } else {
        armRGroup.rotation.z += (0.1 - armRGroup.rotation.z) * Math.min(1, dt * 4);
        armRGroup.rotation.x = 0;
      }
    } else {
      // Reposo: cabeza centrada, mira el río
      headGroup.rotation.y += (0 - headGroup.rotation.y) * Math.min(1, dt * 3);
      headGroup.rotation.x = Math.sin(time * 1.5) * 0.03;
      armRGroup.rotation.z += (0.05 - armRGroup.rotation.z) * Math.min(1, dt * 4);
      armRGroup.rotation.x = 0;
    }
  }

  return { root, update };
}
