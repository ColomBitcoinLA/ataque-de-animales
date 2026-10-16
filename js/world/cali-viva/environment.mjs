/**
 * Cali Viva — Constructor del entorno 3D para la Plazoleta del Río (20 m x 20 m).
 *
 * Utiliza StaticBatcher para fusionar la geometría en pocos lotes por material:
 *  - ground: adoquines y losas del malecón con variación de color por vértice.
 *  - masonry: ladrillo, piedra del Puente Ortiz y revoque colonial.
 *  - terracotta: tejas de barro del tejado colonial.
 *  - wood: vigas, balcones, bancas y carreta de frutas.
 *  - foliage: copa del samán, enredadera de trinitarias (buganvilias) y setos perimetrales.
 *  - blooms: flores de buganvilia magenta vibrante.
 *  - iron: faroles coloniales y herrería de balcones.
 *  - riverbed: cantos rodados y lecho del río Cali.
 *
 * Incluye un material de agua estilizado animado para el río Cali y un fondo de Farallones.
 */
import * as THREE from 'three';
import {
  PLAZA,
  RIVER,
  BRIDGE,
  FACADE,
  SAMAN,
  FRUIT_CART,
  LAMPS,
  BENCHES,
} from './layout.mjs';
import {
  col,
  mixCol,
  rng,
  noise3,
  xf,
  mul,
  capsuleGeometry,
  displace,
  StaticBatcher,
} from './kit.mjs';

export function buildEnvironment(tracker) {
  const batcher = new StaticBatcher();
  const rand = rng(42);

  // -------------------------------------------------------------
  // 1. PALETA DE COLORES CALI VIVA (lineal)
  // -------------------------------------------------------------
  const C = {
    pavementA: col('#98836a'),
    pavementB: col('#c2b093'),
    curbStone: col('#6e6153'),
    cobbleA: col('#786856'),
    cobbleB: col('#8f7d6a'),
    brickDark: col('#8e3c2c'),
    brickWarm: col('#b54f35'),
    stonePier: col('#7a6e60'),
    stoneBalustrade: col('#968774'),
    stuccoWall: col('#f3ede2'),
    stuccoPlinth: col('#d8cebc'),
    terracottaTile: col('#b64d36'),
    terracottaDark: col('#8a3522'),
    woodTimber: col('#422b1b'),
    woodPlank: col('#61422d'),
    samanTrunk: col('#3f3328'),
    samanLeafDark: col('#1f4d2f'),
    samanLeafLight: col('#3a7a3e'),
    bougainvilleaLeaf: col('#24582f'),
    bougainvilleaBloom: col('#d81b60'),
    bougainvilleaBloomLight: col('#f06292'),
    wroughtIron: col('#1c1e22'),
    riverStoneA: col('#4f5850'),
    riverStoneB: col('#6b7468'),
    fruitLulo: col('#76b041'),
    fruitChontaduro: col('#e65100'),
    fruitMaracuya: col('#fbc02d'),
  };

  // -------------------------------------------------------------
  // 2. PAVIMENTO Y PLAZOLETA
  // -------------------------------------------------------------
  // Losa base de la plazoleta (minX a maxX, bankZ a maxZ)
  const plazaW = PLAZA.maxX - PLAZA.minX;
  const plazaD = PLAZA.maxZ - RIVER.bankZ;
  const plazaCenterZ = (PLAZA.maxZ + RIVER.bankZ) / 2;
  const groundGeo = new THREE.BoxGeometry(plazaW, 0.4, plazaD);
  batcher.add(
    'ground',
    groundGeo,
    xf(0, -0.2, plazaCenterZ),
    (pos) => {
      const n = noise3(pos.x * 0.45, 0, pos.z * 0.45);
      return mixCol(C.pavementA, C.pavementB, n);
    }
  );

  // Borde de adoquines / sardinel a lo largo del malecón del río
  const curbGeo = new THREE.BoxGeometry(plazaW, 0.22, 0.5);
  batcher.add('masonry', curbGeo, xf(0, 0.08, RIVER.bankZ + 0.25), C.curbStone);

  // Setos perimetrales este, oeste y sur para delimitar el benchmark
  const hedgeMat = new THREE.BoxGeometry(1, 1, 1);
  const addHedge = (x, y, z, w, h, d) => {
    const g = new THREE.BoxGeometry(w, h, d);
    displace(g, 0.12, 1.4, rand() * 10);
    batcher.add('foliage', g, xf(x, y + h / 2, z), (p) => {
      const n = noise3(p.x * 0.8, p.y * 0.8, p.z * 0.8);
      return mixCol(C.samanLeafDark, C.samanLeafLight, n);
    });
  };
  addHedge(-10.4, 0, plazaCenterZ, 0.8, 1.3, plazaD); // seto oeste
  addHedge(0, 0, 10.4, plazaW + 1.6, 1.3, 0.8);      // seto sur

  // -------------------------------------------------------------
  // 3. PUENTE ORTIZ Y MALECÓN
  // -------------------------------------------------------------
  // Muro de contención del malecón (piedra hacia el río)
  const seaWallW = (BRIDGE.minX - PLAZA.minX);
  const wallGeoL = new THREE.BoxGeometry(seaWallW, 2.2, 0.6);
  batcher.add('masonry', wallGeoL, xf(PLAZA.minX + seaWallW / 2, -1.0, RIVER.bankZ - 0.2), C.stonePier);

  const seaWallWR = (PLAZA.maxX - BRIDGE.maxX);
  const wallGeoR = new THREE.BoxGeometry(seaWallWR, 2.2, 0.6);
  batcher.add('masonry', wallGeoR, xf(BRIDGE.maxX + seaWallWR / 2, -1.0, RIVER.bankZ - 0.2), C.stonePier);

  // Balaustradas del malecón con pilares y pasamanos
  const addBalustradeSegment = (xStart, xEnd, zPos) => {
    const len = xEnd - xStart;
    if (len <= 0.2) return;
    const rail = new THREE.BoxGeometry(len, 0.16, 0.24);
    batcher.add('masonry', rail, xf(xStart + len / 2, 0.85, zPos), C.stoneBalustrade);
    const postGeo = new THREE.BoxGeometry(0.26, 0.9, 0.26);
    const numPosts = Math.max(2, Math.round(len / 1.3));
    for (let i = 0; i <= numPosts; i++) {
      const px = xStart + (i / numPosts) * len;
      batcher.add('masonry', postGeo.clone(), xf(px, 0.45, zPos), C.stoneBalustrade);
    }
    // Barrotillos intermedios
    const baluster = new THREE.CylinderGeometry(0.06, 0.08, 0.65, 6);
    const numBalusters = Math.round(len * 4);
    for (let i = 1; i < numBalusters; i++) {
      const bx = xStart + (i / numBalusters) * len;
      batcher.add('masonry', baluster.clone(), xf(bx, 0.45, zPos), C.stoneBalustrade);
    }
  };
  addBalustradeSegment(PLAZA.minX + 0.2, BRIDGE.minX, RIVER.bankZ);
  addBalustradeSegment(BRIDGE.maxX, PLAZA.maxX - 0.2, RIVER.bankZ);

  // Tablero del Puente Ortiz: rampa en arco con escalonamiento
  const bridgeW = BRIDGE.maxX - BRIDGE.minX;
  const bridgeL = Math.abs(BRIDGE.endZ - BRIDGE.startZ);
  const bridgeCenterX = (BRIDGE.minX + BRIDGE.maxX) / 2;
  const numSteps = 16;
  const stepL = bridgeL / numSteps;

  for (let i = 0; i < numSteps; i++) {
    const z = BRIDGE.startZ - (i + 0.5) * stepL;
    const t = (i + 0.5) / numSteps;
    const archH = BRIDGE.rise * Math.sin(Math.PI * t);
    // Tablero
    const stepGeo = new THREE.BoxGeometry(bridgeW - 0.1, 0.35, stepL + 0.02);
    batcher.add(
      'masonry',
      stepGeo,
      xf(bridgeCenterX, archH - 0.15, z),
      (p) => mixCol(C.brickDark, C.brickWarm, (p.z % 0.8) + 0.5)
    );
    // Balaustrada lateral izquierda del puente
    const railL = new THREE.BoxGeometry(BRIDGE.railWidth, 0.8, stepL + 0.02);
    batcher.add('masonry', railL, xf(BRIDGE.minX + BRIDGE.railWidth / 2, archH + 0.4, z), C.stoneBalustrade);
    // Balaustrada lateral derecha del puente
    const railR = new THREE.BoxGeometry(BRIDGE.railWidth, 0.8, stepL + 0.02);
    batcher.add('masonry', railR, xf(BRIDGE.maxX - BRIDGE.railWidth / 2, archH + 0.4, z), C.stoneBalustrade);
  }

  // Arco inferior visible de ladrillo del Puente Ortiz
  const archGeo = new THREE.CylinderGeometry(bridgeL * 0.45, bridgeL * 0.45, bridgeW, 16, 1, false, 0, Math.PI);
  archGeo.rotateZ(Math.PI / 2);
  archGeo.rotateY(Math.PI / 2);
  batcher.add('masonry', archGeo, xf(bridgeCenterX, -0.6, (BRIDGE.startZ + BRIDGE.endZ) / 2), C.brickDark);

  // -------------------------------------------------------------
  // 4. FACHADA COLONIAL-REPUBLICANA (CALI TRADICIONAL)
  // -------------------------------------------------------------
  const facadeW = FACADE.backX - FACADE.frontX;
  const facadeD = FACADE.maxZ - FACADE.minZ;
  const facadeCenterX = (FACADE.frontX + FACADE.backX) / 2;
  const facadeCenterZ = (FACADE.minZ + FACADE.maxZ) / 2;

  // Cuerpo principal de 2 plantas
  const wallGeo = new THREE.BoxGeometry(facadeW, FACADE.height, facadeD);
  batcher.add('masonry', wallGeo, xf(facadeCenterX, FACADE.height / 2, facadeCenterZ), (p) => {
    return p.y < 0.9 ? C.stuccoPlinth : C.stuccoWall;
  });

  // Tejado de tejas de barro con alero pronunciado hacia el oeste (-X)
  const eaveOverhang = 0.95;
  const roofW = facadeW + eaveOverhang + 0.4;
  const roofD = facadeD + 0.8;
  const roofSlope = 0.32;
  const roofGeo = new THREE.BoxGeometry(roofW, 0.3, roofD);
  roofGeo.rotateZ(-roofSlope);
  batcher.add(
    'terracotta',
    roofGeo,
    xf(facadeCenterX - eaveOverhang / 3, FACADE.height + 0.55, facadeCenterZ),
    (p) => {
      const tileNoise = noise3(p.x * 2.5, 0, p.z * 4.0);
      return mixCol(C.terracottaTile, C.terracottaDark, tileNoise);
    }
  );

  // Canecillos de madera bajo el alero
  const corbelGeo = new THREE.BoxGeometry(0.55, 0.22, 0.2);
  const numCorbels = Math.round(facadeD / 1.1);
  for (let i = 0; i <= numCorbels; i++) {
    const cz = FACADE.minZ + (i / numCorbels) * facadeD;
    batcher.add('wood', corbelGeo.clone(), xf(FACADE.frontX - 0.24, FACADE.height - 0.18, cz), C.woodTimber);
  }

  // Balcón corrido de madera en la segunda planta
  const balconyW = 0.85;
  const balconyL = facadeD - 1.6;
  const balconyY = 3.3;
  const balconyFloor = new THREE.BoxGeometry(balconyW, 0.18, balconyL);
  batcher.add('wood', balconyFloor, xf(FACADE.frontX - balconyW / 2, balconyY, facadeCenterZ), C.woodTimber);

  // Baranda de madera y hierro en el balcón
  const railWood = new THREE.BoxGeometry(0.12, 0.85, balconyL);
  batcher.add('wood', railWood, xf(FACADE.frontX - balconyW + 0.06, balconyY + 0.48, facadeCenterZ), C.woodPlank);

  // Pilares de soporte del balcón hacia el suelo
  const pillarGeo = new THREE.BoxGeometry(0.2, balconyY, 0.2);
  batcher.add('wood', pillarGeo.clone(), xf(FACADE.frontX - balconyW + 0.1, balconyY / 2, FACADE.minZ + 1.2), C.woodTimber);
  batcher.add('wood', pillarGeo.clone(), xf(FACADE.frontX - balconyW + 0.1, balconyY / 2, FACADE.maxZ - 1.2), C.woodTimber);

  // Puertas y ventanas coloniales (nichos de madera empotrados)
  const windowFrame = new THREE.BoxGeometry(0.12, 1.4, 0.95);
  for (const z of [FACADE.minZ + 1.6, facadeCenterZ, FACADE.maxZ - 1.6]) {
    // Ventana planta baja
    batcher.add('wood', windowFrame.clone(), xf(FACADE.frontX - 0.04, 1.45, z), C.woodTimber);
    // Puerta-ventana balcón planta alta
    batcher.add('wood', windowFrame.clone(), xf(FACADE.frontX - 0.04, balconyY + 1.1, z), C.woodTimber);
  }

  // Enredadera de trinitarias (bougainvillea) trepando por el balcón
  const vineCount = 28;
  const vineGeo = new THREE.SphereGeometry(0.35, 7, 6);
  displace(vineGeo, 0.1, 1.5, 3);
  for (let i = 0; i < vineCount; i++) {
    const t = i / vineCount;
    const vy = 0.6 + t * (balconyY + 1.2);
    const vz = FACADE.minZ + 1.2 + Math.sin(t * 5.0) * 0.4 + t * 2.2;
    const vx = FACADE.frontX - balconyW + 0.12 + (rand() - 0.5) * 0.35;
    const s = 0.7 + rand() * 0.6;
    batcher.add(
      'foliage',
      vineGeo.clone(),
      xf(vx, vy, vz, rand() * 0.4, rand() * 0.4, 0, s),
      mixCol(C.bougainvilleaLeaf, C.samanLeafDark, rand())
    );
    // Flores magenta de buganvilia concentradas arriba
    if (t > 0.3 && rand() > 0.25) {
      const bloomGeo = new THREE.DodecahedronGeometry(0.18 + rand() * 0.12);
      batcher.add(
        'blooms',
        bloomGeo,
        xf(vx - 0.1, vy + (rand() - 0.5) * 0.2, vz + (rand() - 0.5) * 0.2),
        mixCol(C.bougainvilleaBloom, C.bougainvilleaBloomLight, rand() * 0.5)
      );
    }
  }

  // -------------------------------------------------------------
  // 5. EL SAMÁN DE LA PLAZOLETA (Albizia saman)
  // -------------------------------------------------------------
  // Jardinera circular de piedra
  const planterOuter = 1.6;
  const planterInner = 1.35;
  const planterH = 0.45;
  const planterGeo = new THREE.CylinderGeometry(planterOuter, planterOuter, planterH, 16);
  batcher.add('masonry', planterGeo, xf(SAMAN.x, planterH / 2, SAMAN.z), C.stonePier);

  // Tierra en la jardinera
  const dirtGeo = new THREE.CylinderGeometry(planterInner, planterInner, 0.1, 14);
  batcher.add('ground', dirtGeo, xf(SAMAN.x, planterH + 0.02, SAMAN.z), C.samanTrunk);

  // Tronco masivo retorcido del samán
  const trunkH = 3.6;
  const trunkGeo = new THREE.CylinderGeometry(0.42, 0.65, trunkH, 10);
  displace(trunkGeo, 0.12, 1.2, 5);
  batcher.add('wood', trunkGeo, xf(SAMAN.x, trunkH / 2 + planterH, SAMAN.z), C.samanTrunk);

  // Ramas principales que se abren en paraguas horizontal
  const branchCount = 6;
  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const branchL = 2.8 + rand() * 0.8;
    const bGeo = new THREE.CylinderGeometry(0.16, 0.28, branchL, 7);
    bGeo.rotateZ(Math.PI / 3);
    bGeo.rotateY(angle);
    batcher.add(
      'wood',
      bGeo,
      xf(
        SAMAN.x + Math.cos(angle) * (branchL * 0.35),
        planterH + trunkH + 0.4,
        SAMAN.z + Math.sin(angle) * (branchL * 0.35)
      ),
      C.samanTrunk
    );
  }

  // Masa de copa aparasolada amplia (característica del Samán)
  // Nubes de hojas semi-planas y estratificadas
  const canopyNodes = [
    { x: 0, y: 0, z: 0, r: 2.8, sy: 0.55 },
    { x: -1.8, y: 0.3, z: 0.9, r: 2.2, sy: 0.5 },
    { x: 1.9, y: 0.2, z: -0.8, r: 2.3, sy: 0.52 },
    { x: -0.8, y: 0.4, z: -2.1, r: 2.1, sy: 0.48 },
    { x: 0.9, y: 0.35, z: 2.0, r: 2.2, sy: 0.5 },
    { x: 2.4, y: 0.15, z: 1.4, r: 1.8, sy: 0.45 },
    { x: -2.3, y: 0.2, z: -1.2, r: 1.9, sy: 0.45 },
  ];

  for (const node of canopyNodes) {
    const leafGeo = new THREE.IcosahedronGeometry(node.r, 2);
    leafGeo.scale(1.0, node.sy, 1.0);
    displace(leafGeo, 0.22, 1.0, rand() * 20);
    batcher.add(
      'foliage',
      leafGeo,
      xf(
        SAMAN.x + node.x,
        planterH + trunkH + 1.2 + node.y,
        SAMAN.z + node.z
      ),
      (p) => {
        const h = noise3(p.x * 0.6, p.y * 0.6, p.z * 0.6);
        return mixCol(C.samanLeafDark, C.samanLeafLight, h);
      }
    );
  }

  // -------------------------------------------------------------
  // 6. CARRETA DE FRUTAS (LULO, CHONTADURO, MARACUYÁ)
  // -------------------------------------------------------------
  const cartW = 1.4;
  const cartD = 0.9;
  const cartH = 0.85;
  const cartBox = new THREE.BoxGeometry(cartW, 0.45, cartD);
  batcher.add('wood', cartBox, xf(FRUIT_CART.x, cartH - 0.1, FRUIT_CART.z), C.woodPlank);

  // Ruedas de madera
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  batcher.add('wood', wheelGeo.clone(), xf(FRUIT_CART.x - cartW / 2 + 0.1, 0.38, FRUIT_CART.z - cartD / 2 - 0.06), C.woodTimber);
  batcher.add('wood', wheelGeo.clone(), xf(FRUIT_CART.x - cartW / 2 + 0.1, 0.38, FRUIT_CART.z + cartD / 2 + 0.06), C.woodTimber);

  // Toldillo de rayas blanco y naranja
  const awningGeo = new THREE.BoxGeometry(cartW + 0.3, 0.1, cartD + 0.3);
  awningGeo.rotateZ(0.12);
  batcher.add(
    'terracotta',
    awningGeo,
    xf(FRUIT_CART.x, cartH + 0.95, FRUIT_CART.z),
    (p) => (Math.abs(p.z % 0.3) < 0.15 ? col('#f57c00') : col('#ffffff'))
  );

  // Pilares del toldo
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6);
  batcher.add('wood', poleGeo.clone(), xf(FRUIT_CART.x - cartW / 2 + 0.1, cartH + 0.45, FRUIT_CART.z - cartD / 2 + 0.1), C.woodTimber);
  batcher.add('wood', poleGeo.clone(), xf(FRUIT_CART.x + cartW / 2 - 0.1, cartH + 0.45, FRUIT_CART.z - cartD / 2 + 0.1), C.woodTimber);
  batcher.add('wood', poleGeo.clone(), xf(FRUIT_CART.x - cartW / 2 + 0.1, cartH + 0.45, FRUIT_CART.z + cartD / 2 - 0.1), C.woodTimber);
  batcher.add('wood', poleGeo.clone(), xf(FRUIT_CART.x + cartW / 2 - 0.1, cartH + 0.45, FRUIT_CART.z + cartD / 2 - 0.1), C.woodTimber);

  // Frutas en montones (esferas de color vivo)
  const fruitGeo = new THREE.SphereGeometry(0.1, 6, 5);
  for (let i = 0; i < 9; i++) {
    const fx = FRUIT_CART.x - 0.35 + (i % 3) * 0.22;
    const fz = FRUIT_CART.z - 0.2 + Math.floor(i / 3) * 0.2;
    const fruitCol = i < 3 ? C.fruitChontaduro : i < 6 ? C.fruitLulo : C.fruitMaracuya;
    batcher.add('blooms', fruitGeo.clone(), xf(fx, cartH + 0.18, fz), fruitCol);
  }

  // -------------------------------------------------------------
  // 7. FAROLES Y BANCAS
  // -------------------------------------------------------------
  const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8);
  const lampHeadGeo = new THREE.BoxGeometry(0.42, 0.55, 0.42);
  for (const lamp of LAMPS) {
    batcher.add('iron', lampPoleGeo.clone(), xf(lamp.x, 1.6, lamp.z), C.wroughtIron);
    batcher.add('iron', lampHeadGeo.clone(), xf(lamp.x, 3.35, lamp.z), C.wroughtIron);
  }

  const benchSeatGeo = new THREE.BoxGeometry(1.8, 0.08, 0.45);
  const benchBackGeo = new THREE.BoxGeometry(1.8, 0.45, 0.08);
  const benchLegGeo = new THREE.BoxGeometry(0.1, 0.45, 0.45);
  for (const b of BENCHES) {
    const rot = b.rotation;
    const mSeat = mul(xf(b.x, 0.45, b.z), xf(0, 0, 0, 0, rot, 0));
    batcher.add('wood', benchSeatGeo.clone(), mSeat, C.woodPlank);
    const mBack = mul(xf(b.x, 0.72, b.z), xf(0, 0, 0, 0, rot, 0), xf(0, 0, -0.2));
    batcher.add('wood', benchBackGeo.clone(), mBack, C.woodPlank);
    const mLeg1 = mul(xf(b.x, 0.22, b.z), xf(0, 0, 0, 0, rot, 0), xf(-0.75, 0, 0));
    batcher.add('iron', benchLegGeo.clone(), mLeg1, C.wroughtIron);
    const mLeg2 = mul(xf(b.x, 0.22, b.z), xf(0, 0, 0, 0, rot, 0), xf(0.75, 0, 0));
    batcher.add('iron', benchLegGeo.clone(), mLeg2, C.wroughtIron);
  }

  // -------------------------------------------------------------
  // 8. LECHO DEL RÍO Y CANTOS RODADOS
  // -------------------------------------------------------------
  const riverW = RIVER.maxX - RIVER.minX;
  const riverL = Math.abs(RIVER.farBankZ - RIVER.bankZ) + 4.0;
  const riverCenterZ = (RIVER.bankZ + RIVER.farBankZ) / 2;
  const bedGeo = new THREE.PlaneGeometry(riverW, riverL, 16, 8);
  bedGeo.rotateX(-Math.PI / 2);
  batcher.add(
    'ground',
    bedGeo,
    xf(0, RIVER.bedY, riverCenterZ),
    (p) => mixCol(C.riverStoneA, C.riverStoneB, noise3(p.x * 0.4, 0, p.z * 0.4))
  );

  // Cantos rodados en la orilla
  const stoneGeo = new THREE.DodecahedronGeometry(0.4, 1);
  for (let i = 0; i < 18; i++) {
    const sx = PLAZA.minX + rand() * plazaW;
    const sz = RIVER.bankZ - 0.4 - rand() * 1.6;
    if (sx >= BRIDGE.minX - 0.5 && sx <= BRIDGE.maxX + 0.5) continue;
    const sc = 0.5 + rand() * 0.8;
    batcher.add(
      'masonry',
      stoneGeo.clone(),
      xf(sx, RIVER.waterY + 0.1, sz, rand(), rand(), 0, sc, sc * 0.6, sc),
      mixCol(C.riverStoneA, C.stonePier, rand())
    );
  }

  // -------------------------------------------------------------
  // 9. ESPECIFICACIÓN DE MATERIALES (PBR CÁLIDO ESTILIZADO)
  // -------------------------------------------------------------
  const matGround = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const matMasonry = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.08,
    })
  );
  const matTerracotta = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.02,
    })
  );
  const matWood = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.05,
    })
  );
  const matFoliage = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.0,
      shadowSide: THREE.DoubleSide,
    })
  );
  const matBlooms = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.0,
    })
  );
  const matIron = tracker.track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.75,
    })
  );

  const meshes = batcher.build({
    ground: { material: matGround, cast: false, receive: true },
    masonry: { material: matMasonry, cast: true, receive: true },
    terracotta: { material: matTerracotta, cast: true, receive: true },
    wood: { material: matWood, cast: true, receive: true },
    foliage: { material: matFoliage, cast: true, receive: true },
    blooms: { material: matBlooms, cast: true, receive: false },
    iron: { material: matIron, cast: true, receive: false },
  });

  const root = new THREE.Group();
  root.name = 'cali-environment';
  for (const m of meshes) {
    tracker.track(m);
    root.add(m);
  }

  // -------------------------------------------------------------
  // 10. AGUA DEL RÍO CALI (SUPERFICIE ANIMADA)
  // -------------------------------------------------------------
  const waterGeo = tracker.track(new THREE.PlaneGeometry(riverW, riverL, 32, 16));
  waterGeo.rotateX(-Math.PI / 2);

  const waterMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: col('#248a94'),
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0.88,
    })
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'cali-river-surface';
  waterMesh.position.set(0, RIVER.waterY, riverCenterZ);
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // Animador sutil de onda
  const posAttr = waterGeo.attributes.position;
  const basePositions = Float32Array.from(posAttr.array);
  const updateWater = (time) => {
    for (let i = 0; i < posAttr.count; i++) {
      const bx = basePositions[i * 3];
      const bz = basePositions[i * 3 + 2];
      const wave = Math.sin(bx * 0.8 + time * 2.2) * 0.04 + Math.cos(bz * 1.2 + time * 1.8) * 0.03;
      posAttr.setY(i, basePositions[i * 3 + 1] + wave);
    }
    posAttr.needsUpdate = true;
    waterGeo.computeVertexNormals();
  };

  // -------------------------------------------------------------
  // 11. SILUETA DISTANTE DE LOS FARALLONES Y LA ERMITA
  // -------------------------------------------------------------
  // Plano de fondo hacia el norte / oeste con silueta de montañas caleñas
  const farallonesGeo = tracker.track(new THREE.PlaneGeometry(60, 14, 24, 2));
  const farPos = farallonesGeo.attributes.position;
  for (let i = 0; i < farPos.count; i++) {
    const x = farPos.getX(i);
    const y = farPos.getY(i);
    if (y > 0) {
      const peak = Math.sin(x * 0.15) * 3.2 + Math.cos(x * 0.35) * 1.8;
      farPos.setY(i, y + peak);
    }
  }
  farallonesGeo.computeVertexNormals();
  const farallonesMat = tracker.track(
    new THREE.MeshBasicMaterial({
      color: col('#526a7a'),
      fog: true,
    })
  );
  const farallones = new THREE.Mesh(farallonesGeo, farallonesMat);
  farallones.position.set(-6, 4.5, -28);
  root.add(farallones);

  return { root, updateWater };
}
