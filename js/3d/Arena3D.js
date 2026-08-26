/**
 * Motor de Batalla 3D (Three.js / WebGL) para la sección de combate.
 * - Arena circular flotante con césped, rocas y nubes procedurales.
 * - Mascotas como sprites/billboards con sombra, respiración y retroceso.
 * - Hechizos 3D: fuego, agua, tierra, rayo.
 * - Cámara cinemática (órbita en reposo, zoom dramático en impactos).
 * - Alternancia Vista 3D / Vista 2D (los dispositivos de bajos recursos usan 2D).
 *
 * Three.js se carga de forma diferida vía import map; si falla, se desactiva
 * automáticamente y el juego sigue en 2D.
 */

const ELEMENT_STYLE = {
  FUEGO: { color: 0xff5722, emoji: "🔥" },
  AGUA: { color: 0x03a9f4, emoji: "💧" },
  TIERRA: { color: 0x8bc34a, emoji: "🌱" },
  ELECTRICO: { color: 0xffdd44, emoji: "⚡" },
  HIELO: { color: 0x80deea, emoji: "❄️" },
  DRAGON: { color: 0xab47bc, emoji: "🐉" },
};
const PET_ELEMENT = { Neptuno: "AGUA", Salamander: "FUEGO", Tierrudo: "TIERRA" };

export class Arena3D {
  /**
   * @param {HTMLElement} container - contenedor donde se monta el canvas
   */
  constructor(container) {
    this.container = container;
    this.enabled = false;
    this.ready = false;
    this.three = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.playerSprite = null;
    this.enemySprite = null;
    this.clock = null;
    this.effects = [];
    this.player = { nombre: "Neptuno", element: "AGUA" };
    this.enemy = { nombre: "Salamander", element: "FUEGO" };
    this._raf = 0;
    this._lastTime = 0;
    this._recoil = { player: 0, enemy: 0 };
    this._impactTime = 0;
  }

  /** @returns {boolean} WebGL disponible */
  get supported() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch { return false; }
  }

  /**
   * Inicializa la escena 3D (carga diferida de Three.js).
   * @returns {Promise<boolean>}
   */
  async init() {
    if (!this.supported) return false;
    if (this.ready) return true;
    try {
      this.three = await import("three");
    } catch (e) {
      console.warn("[Arena3D] No se pudo cargar Three.js:", e.message);
      return false;
    }
    const THREE = this.three;
    this.clock = new THREE.Clock();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth || 480, this.container.clientHeight || 320);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Escena y cámara
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 30, 120);
    this.camera = new THREE.PerspectiveCamera(55, (this.container.clientWidth || 480) / (this.container.clientHeight || 320), 0.1, 200);
    this.camera.position.set(0, 8, 22);
    this.camera.lookAt(0, 3, 0);

    // Luces
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(15, 25, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(dir);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8b9bb4, 0.5);
    this.scene.add(hemi);

    this._buildArena();
    this._buildClouds();
    this._buildCombatants();

    this.ready = true;
    this._startLoop();
    return true;
  }

  _buildArena() {
    const THREE = this.three;

    // Plataforma circular flotante
    const arena = new THREE.Group();
    const base = new THREE.CylinderGeometry(12, 13, 2.5, 48);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 0.9 });
    const rock = new THREE.Mesh(base, rockMat);
    rock.position.y = -1.25;
    rock.castShadow = true; rock.receiveShadow = true;
    arena.add(rock);

    // Césped superior
    const grass = new THREE.CylinderGeometry(12.2, 12.2, 0.3, 48);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.85 });
    const grassTop = new THREE.Mesh(grass, grassMat);
    grassTop.position.y = 0.05;
    grassTop.receiveShadow = true;
    arena.add(grassTop);

    // Anillo de borde
    const ring = new THREE.TorusGeometry(12.2, 0.5, 12, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5 });
    const ringMesh = new THREE.Mesh(ring, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.2;
    ringMesh.receiveShadow = true;
    arena.add(ringMesh);

    // Rocas decorativas alrededor
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 11.5;
      const rock2 = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x8d7b64, roughness: 1 })
      );
      rock2.position.set(Math.cos(angle) * r, 0.5, Math.sin(angle) * r);
      rock2.castShadow = true;
      arena.add(rock2);
    }

    this.scene.add(arena);
    this.arena = arena;
  }

  _buildClouds() {
    const THREE = this.three;
    const cloudTex = this._makeCloudTexture();
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.7 });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set((Math.random() - 0.5) * 80, 18 + Math.random() * 15, (Math.random() - 0.5) * 60 - 10);
      sprite.scale.set(14 + Math.random() * 10, 8 + Math.random() * 6, 1);
      this.scene.add(sprite);
      this.clouds.push(sprite);
    }
  }

  _makeCloudTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(255,255,255,0)";
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const blobs = [[40, 40, 22], [64, 34, 18], [88, 40, 20], [52, 46, 16]];
    for (const [x, y, r] of blobs) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new this.three.CanvasTexture(c);
    return tex;
  }

  _makePetTexture(element) {
    const THREE = this.three;
    const style = ELEMENT_STYLE[element] || ELEMENT_STYLE.AGUA;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#" + style.color.toString(16).padStart(6, "0"));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = "64px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.emoji, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  _makeShadowTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, "rgba(0,0,0,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new this.three.CanvasTexture(c);
  }

  _buildCombatants() {
    const THREE = this.three;

    this.playerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._makePetTexture(this.player.element), transparent: true }));
    this.playerSprite.scale.set(5, 5, 1);
    this.playerSprite.position.set(-6, 2.5, 2);
    this.scene.add(this.playerSprite);

    this.enemySprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._makePetTexture(this.enemy.element), transparent: true }));
    this.enemySprite.scale.set(5, 5, 1);
    this.enemySprite.position.set(6, 2.5, -2);
    this.scene.add(this.enemySprite);

    // Sombras proyectadas (discos planos)
    const shadowTex = this._makeShadowTexture();
    this.playerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(-6, 0.35, 2);
    this.scene.add(this.playerShadow);

    this.enemyShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    this.enemyShadow.rotation.x = -Math.PI / 2;
    this.enemyShadow.position.set(6, 0.35, -2);
    this.scene.add(this.enemyShadow);
  }

  /** Actualiza los combatientes. @param {{nombre:string,element:string}} player @param {{nombre:string,element:string}} enemy */
  setCombatants(player, enemy) {
    this.player = { ...this.player, ...player };
    this.enemy = { ...this.enemy, ...enemy };
    if (this.ready) {
      this.playerSprite.material.map = this._makePetTexture(this.player.element);
      this.playerSprite.material.needsUpdate = true;
      this.enemySprite.material.map = this._makePetTexture(this.enemy.element);
      this.enemySprite.material.needsUpdate = true;
    }
  }

  /** Lanza un hechizo 3D. @param {string} tipo @param {'player'|'enemy'} side */
  castSpell(tipo, side) {
    if (!this.ready) return;
    const from = side === "player" ? this.playerSprite.position : this.enemySprite.position;
    const to = side === "player" ? this.enemySprite.position : this.playerSprite.position;
    switch (tipo) {
      case "FUEGO": this._spawnFireball(from, to); break;
      case "AGUA": this._spawnWater(from, to); break;
      case "TIERRA": this._spawnEarth(to); break;
      case "ELECTRICO": this._spawnLightning(to); break;
      case "HIELO": this._spawnIce(from, to); break;
      case "DRAGON": this._spawnDragon(from, to); break;
    }
    // retroceso del objetivo
    if (side === "player") this._recoil.enemy = 1;
    else this._recoil.player = 1;
  }

  _spawnFireball(from, to) {
    const THREE = this.three;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    ball.position.copy(from); ball.position.y += 1;
    this.scene.add(ball);
    const light = new THREE.PointLight(0xff6600, 2.5, 18);
    light.position.copy(ball.position);
    this.scene.add(light);
    this.effects.push({
      kind: "projectile", mesh: ball, light, from: from.clone().setY(from.y + 1), to: to.clone().setY(to.y + 1),
      speed: 16, life: 3, t: 0, trail: [],
    });
  }

  _spawnWater(from, to) {
    const THREE = this.three;
    const origin = from.clone().setY(from.y + 1);
    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.85 }));
      drop.position.copy(origin);
      this.scene.add(drop);
      this.effects.push({ kind: "water", mesh: drop, to: to.clone(), phase: i * 0.6, life: 1.5, t: 0 });
    }
  }

  _spawnEarth(to) {
    const THREE = this.three;
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x7a5c3a }));
      spike.position.copy(to);
      spike.position.x += (Math.random() - 0.5) * 4;
      spike.position.z += (Math.random() - 0.5) * 4;
      spike.position.y = -1;
      this.scene.add(spike);
      this.effects.push({ kind: "earth", mesh: spike, targetY: 2.2, life: 1.2, t: 0 });
    }
  }

  _spawnLightning(to) {
    const THREE = this.three;
    const light = new THREE.PointLight(0xffdd44, 8, 30);
    light.position.copy(to).setY(to.y + 6);
    this.scene.add(light);
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.5, 12, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bolt.position.copy(to).setY(to.y + 2);
    this.scene.add(bolt);
    this.effects.push({ kind: "lightning", mesh: bolt, light, life: 0.5, t: 0 });
  }

  _spawnIce(from, to) {
    const THREE = this.three;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9ee8ff, emissive: 0x336677, roughness: 0.2 }));
    crystal.position.copy(from).setY(from.y + 1);
    this.scene.add(crystal);
    this.effects.push({ kind: "projectile", mesh: crystal, light: null, from: from.clone().setY(from.y + 1), to: to.clone().setY(to.y + 1), speed: 12, life: 3, t: 0, trail: [] });
  }

  _spawnDragon(from, to) {
    const THREE = this.three;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xab47bc, emissive: 0x440055 }));
    orb.position.copy(from).setY(from.y + 1);
    this.scene.add(orb);
    this.effects.push({ kind: "projectile", mesh: orb, light: null, from: from.clone().setY(from.y + 1), to: to.clone().setY(to.y + 1), speed: 14, life: 3, t: 0, trail: [] });
  }

  /** Impacto dramático: zoom de cámara. @param {boolean} charged */
  impact(charged) {
    this._impactTime = charged ? 0.6 : 0.35;
  }

  _startLoop() {
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _update(dt) {
    const THREE = this.three;
    const t = this.clock.elapsedTime;

    // Cámara: órbita suave + zoom de impacto
    let baseR = 22, baseY = 8;
    if (this._impactTime > 0) {
      this._impactTime -= dt;
      const p = Math.max(0, this._impactTime);
      baseR = 22 - 6 * Math.sin(p * 8); // zoom in/out
      baseY = 8 - 2 * Math.sin(p * 8);
    }
    const orbitSpeed = 0.15;
    this.camera.position.x = Math.sin(t * orbitSpeed) * baseR;
    this.camera.position.z = Math.cos(t * orbitSpeed) * baseR;
    this.camera.position.y = baseY;
    this.camera.lookAt(0, 3, 0);

    // Respiración (idle bobbing) + retroceso
    if (this.playerSprite) {
      const bob = Math.sin(t * 2.2) * 0.25;
      const recoil = this._recoil.player;
      this.playerSprite.position.y = 2.5 + bob - recoil * 1.5;
      this.playerSprite.position.x = -6 - recoil * 1.8;
      this._recoil.player = Math.max(0, recoil - dt * 4);
    }
    if (this.enemySprite) {
      const bob = Math.cos(t * 2.2) * 0.25;
      const recoil = this._recoil.enemy;
      this.enemySprite.position.y = 2.5 + bob - recoil * 1.5;
      this.enemySprite.position.x = 6 + recoil * 1.8;
      this._recoil.enemy = Math.max(0, recoil - dt * 4);
    }

    // Nubes a la deriva
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.8;
      if (cloud.position.x > 45) cloud.position.x = -45;
    }

    // Efectos
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      switch (e.kind) {
        case "projectile": {
          const dir = new THREE.Vector3().subVectors(e.to, e.mesh.position).normalize();
          e.mesh.position.add(dir.multiplyScalar(e.speed * dt));
          if (e.light) e.light.position.copy(e.mesh.position);
          // estela
          const dist = e.mesh.position.distanceTo(e.to);
          if (dist < 1.2 || e.t > e.life) {
            this.scene.remove(e.mesh);
            if (e.light) this.scene.remove(e.light);
            this.effects.splice(i, 1);
          }
          break;
        }
        case "water": {
          const dir = new THREE.Vector3().subVectors(e.to, e.mesh.position);
          e.mesh.position.add(dir.multiplyScalar(dt * 8));
          e.mesh.position.y = 2 + Math.sin(e.t * 6 + e.phase) * 1.5;
          if (e.t > e.life || e.mesh.position.distanceTo(e.to) < 0.5) {
            this.scene.remove(e.mesh);
            this.effects.splice(i, 1);
          }
          break;
        }
        case "earth": {
          e.mesh.position.y = Math.min(e.targetY, e.mesh.position.y + dt * 6);
          if (e.t > e.life) {
            this.scene.remove(e.mesh);
            this.effects.splice(i, 1);
          }
          break;
        }
        case "lightning": {
          if (e.t > e.life) {
            this.scene.remove(e.mesh);
            if (e.light) this.scene.remove(e.light);
            this.effects.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  /** Muestra el canvas 3D. */
  show() {
    if (this.renderer?.domElement) this.renderer.domElement.style.display = "block";
  }

  /** Oculta el canvas 3D (vista 2D). */
  hide() {
    if (this.renderer?.domElement) this.renderer.domElement.style.display = "none";
    this.stop();
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth || 480;
    const h = this.container.clientHeight || 320;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    for (const e of this.effects) { if (e.mesh) this.scene?.remove(e.mesh); if (e.light) this.scene?.remove(e.light); }
    this.effects = [];
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.ready = false;
  }
}

/** Determina el elemento de una mascota por nombre. */
export function petElement(nombre) {
  return PET_ELEMENT[nombre] || "AGUA";
}
