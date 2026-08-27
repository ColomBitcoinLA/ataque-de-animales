/**
 * Motor de Batalla 3D (Three.js / WebGL) para la sección de combate.
 * - Arena circular flotante con césped, rocas y nubes procedurales.
 * - Mascotas como sprites 3D recortados y transparentes (sin círculos sólidos),
 *   con aros elementales en el suelo, sombras proyectadas y animación de respiración.
 * - Textos de daño y estado flotantes en 3D ("-30 HP", "🛡️ ESCUDO", "⚡ SÚPER EFECTIVO").
 * - Hechizos 3D dinámicos: Fuego 🔥, Agua 💧, Tierra 🌱, Rayo ⚡, Hielo ❄️ y Dragón 🐉.
 * - Cámara cinemática orbital y zoom de impacto dramático en ataques cargados.
 * - Alternancia fluida Vista 3D / Vista 2D con fallback seguro.
 */

const ELEMENT_STYLE = {
  FUEGO: { color: 0xff5722, hex: "#ff5722", border: "#ff9800", emoji: "🔥" },
  AGUA: { color: 0x03a9f4, hex: "#03a9f4", border: "#4fc3f7", emoji: "💧" },
  TIERRA: { color: 0x8bc34a, hex: "#8bc34a", border: "#aed581", emoji: "🌱" },
  ELECTRICO: { color: 0xffdd44, hex: "#ffdd44", border: "#fff59d", emoji: "⚡" },
  HIELO: { color: 0x80deea, hex: "#80deea", border: "#b2ebf2", emoji: "❄️" },
  DRAGON: { color: 0xab47bc, hex: "#ab47bc", border: "#ce93d8", emoji: "🐉" },
};

const PET_IMAGES = {
  Neptuno: "./assets/cabezaNeptuno.webp",
  Salamander: "./assets/cabezaSalamander.webp",
  Tierrudo: "./assets/cabezaTierrudo.webp",
};

const PET_ELEMENT = {
  Neptuno: "AGUA",
  Salamander: "FUEGO",
  Tierrudo: "TIERRA",
};

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
    this.playerRing = null;
    this.enemyRing = null;
    this.clock = null;
    this.effects = [];
    this.floatingTexts = [];
    this.player = { nombre: "Salamander", element: "FUEGO" };
    this.enemy = { nombre: "Tierrudo", element: "TIERRA" };
    this._raf = 0;
    this._recoil = { player: 0, enemy: 0 };
    this._impactTime = 0;
    this._imageCache = new Map();
    this._preloadImages();
  }

  _preloadImages() {
    for (const [name, src] of Object.entries(PET_IMAGES)) {
      const img = new Image();
      img.src = src;
      this._imageCache.set(name, img);
    }
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
    this.renderer.setSize(this.container.clientWidth || 800, this.container.clientHeight || 420);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Escena y cámara
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 28, 120);
    this.camera = new THREE.PerspectiveCamera(48, (this.container.clientWidth || 800) / (this.container.clientHeight || 420), 0.1, 250);
    this.camera.position.set(0, 9.5, 25);
    this.camera.lookAt(0, 3.2, 0);

    // Iluminación
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.25);
    dirLight.position.set(16, 28, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.65);
    this.scene.add(hemiLight);

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
    const baseGeo = new THREE.CylinderGeometry(14, 15.5, 3.5, 48);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x544636, roughness: 0.9 });
    const rockBase = new THREE.Mesh(baseGeo, rockMat);
    rockBase.position.y = -1.75;
    rockBase.castShadow = true;
    rockBase.receiveShadow = true;
    arena.add(rockBase);

    // Césped superior
    const grassGeo = new THREE.CylinderGeometry(14.2, 14.2, 0.4, 48);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.75 });
    const grassTop = new THREE.Mesh(grassGeo, grassMat);
    grassTop.position.y = 0.05;
    grassTop.receiveShadow = true;
    arena.add(grassTop);

    // Anillo perimetral
    const ringGeo = new THREE.TorusGeometry(14.2, 0.55, 12, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.5 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.22;
    ringMesh.receiveShadow = true;
    arena.add(ringMesh);

    // Rocas decorativas alrededor
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 13.5;
      const rockMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x6d5d4d, roughness: 1 })
      );
      rockMesh.position.set(Math.cos(angle) * r, 0.5, Math.sin(angle) * r);
      rockMesh.castShadow = true;
      arena.add(rockMesh);
    }

    this.scene.add(arena);
    this.arena = arena;
  }

  _buildClouds() {
    const THREE = this.three;
    const cloudTex = this._makeCloudTexture();
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75 });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set((Math.random() - 0.5) * 95, 16 + Math.random() * 16, (Math.random() - 0.5) * 60 - 12);
      sprite.scale.set(18 + Math.random() * 12, 10 + Math.random() * 6, 1);
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
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const blobs = [[36, 40, 22], [64, 32, 20], [92, 40, 22], [52, 44, 18]];
    for (const [x, y, r] of blobs) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return new this.three.CanvasTexture(c);
  }

  /**
   * Genera el sprite transparente de la mascota (sin círculos sólidos de fondo).
   */
  _makePetTexture(nombre, element) {
    const THREE = this.three;
    const style = ELEMENT_STYLE[element] || ELEMENT_STYLE.AGUA;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;

    const renderSprite = (img = null) => {
      ctx.clearRect(0, 0, 256, 256);

      // Sombra proyectada en la base del personaje
      const baseShadow = ctx.createRadialGradient(128, 205, 5, 128, 205, 60);
      baseShadow.addColorStop(0, "rgba(0, 0, 0, 0.45)");
      baseShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = baseShadow;
      ctx.beginPath();
      ctx.ellipse(128, 205, 55, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ilustración real de la mascota con transparencia completa
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        // Sombra de silueta brillante con el color del elemento
        ctx.shadowColor = style.hex;
        ctx.shadowBlur = 16;
        ctx.drawImage(img, 28, 20, 200, 185);
        ctx.restore();
      } else {
        // Fallback de carga con emoji grande
        ctx.font = "bold 95px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = style.hex;
        ctx.shadowBlur = 18;
        ctx.fillText(style.emoji, 128, 110);
      }

      // Placa flotante elegante con nombre y elemento
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(10, 15, 28, 0.9)";
      ctx.strokeStyle = style.border || "#0ae98a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(28, 216, 200, 34, 10);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 17px 'MedievalSharp', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${style.emoji} ${nombre || "Mascota"}`, 128, 233);

      tex.needsUpdate = true;
    };

    const cachedImg = this._imageCache.get(nombre) || null;
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      renderSprite(cachedImg);
    } else {
      renderSprite(null);
      const petSrc = PET_IMAGES[nombre] || `./assets/cabeza${nombre}.webp`;
      const img = new Image();
      img.src = petSrc;
      img.onload = () => {
        this._imageCache.set(nombre, img);
        renderSprite(img);
      };
    }

    return tex;
  }

  _buildCombatants() {
    const THREE = this.three;

    // Sprite Jugador (Primer plano izquierdo)
    const playerMat = new THREE.SpriteMaterial({
      map: this._makePetTexture(this.player.nombre, this.player.element),
      transparent: true,
    });
    this.playerSprite = new THREE.Sprite(playerMat);
    this.playerSprite.scale.set(7.5, 7.5, 1);
    this.playerSprite.position.set(-6.8, 3.5, 2.8);
    this.scene.add(this.playerSprite);

    // Sprite Rival (Fondo derecho)
    const enemyMat = new THREE.SpriteMaterial({
      map: this._makePetTexture(this.enemy.nombre, this.enemy.element),
      transparent: true,
    });
    this.enemySprite = new THREE.Sprite(enemyMat);
    this.enemySprite.scale.set(7.5, 7.5, 1);
    this.enemySprite.position.set(6.8, 3.5, -2.8);
    this.scene.add(this.enemySprite);

    // Aros elementales luminosos en el suelo de la arena
    const pStyle = ELEMENT_STYLE[this.player.element] || ELEMENT_STYLE.FUEGO;
    const eStyle = ELEMENT_STYLE[this.enemy.element] || ELEMENT_STYLE.TIERRA;

    const ringGeo = new THREE.RingGeometry(2.4, 3.2, 32);
    
    this.playerRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: pStyle.color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    this.playerRing.rotation.x = -Math.PI / 2;
    this.playerRing.position.set(-6.8, 0.28, 2.8);
    this.scene.add(this.playerRing);

    this.enemyRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: eStyle.color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    this.enemyRing.rotation.x = -Math.PI / 2;
    this.enemyRing.position.set(6.8, 0.28, -2.8);
    this.scene.add(this.enemyRing);
  }

  /**
   * Actualiza los combatientes con sus nombres e imágenes reales.
   * @param {{nombre:string, element:string}} player
   * @param {{nombre:string, element:string}} enemy
   */
  setCombatants(player, enemy) {
    if (player) this.player = { ...this.player, ...player };
    if (enemy) this.enemy = { ...this.enemy, ...enemy };

    if (this.ready) {
      this.playerSprite.material.map = this._makePetTexture(this.player.nombre, this.player.element);
      this.playerSprite.material.needsUpdate = true;
      this.enemySprite.material.map = this._makePetTexture(this.enemy.nombre, this.enemy.element);
      this.enemySprite.material.needsUpdate = true;

      const pStyle = ELEMENT_STYLE[this.player.element] || ELEMENT_STYLE.FUEGO;
      const eStyle = ELEMENT_STYLE[this.enemy.element] || ELEMENT_STYLE.TIERRA;
      if (this.playerRing) this.playerRing.material.color.setHex(pStyle.color);
      if (this.enemyRing) this.enemyRing.material.color.setHex(eStyle.color);
    }
  }

  /**
   * Muestra un texto de daño / efecto flotante en 3D.
   * @param {string} text
   * @param {'player'|'enemy'} targetSide
   * @param {string} [color='#ffffff']
   */
  showFloatingText(text, targetSide, color = "#ffffff") {
    if (!this.ready) return;
    const THREE = this.three;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 8;
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 1.6, 1);

    const targetPos = targetSide === "player" ? this.playerSprite.position : this.enemySprite.position;
    sprite.position.copy(targetPos).setY(targetPos.y + 4.5);
    this.scene.add(sprite);

    this.floatingTexts.push({ sprite, life: 1.6, t: 0 });
  }

  /**
   * Lanza un hechizo visual tridimensional.
   * @param {string} tipo
   * @param {'player'|'enemy'} side
   */
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
      default: this._spawnFireball(from, to); break;
    }

    if (side === "player") this._recoil.enemy = 1;
    else this._recoil.player = 1;
  }

  _spawnFireball(from, to) {
    const THREE = this.three;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5500 })
    );
    ball.position.copy(from).setY(from.y + 0.6);
    this.scene.add(ball);

    const light = new THREE.PointLight(0xff4400, 3.5, 22);
    light.position.copy(ball.position);
    this.scene.add(light);

    this.effects.push({
      kind: "projectile",
      mesh: ball,
      light,
      to: to.clone().setY(to.y + 0.6),
      speed: 19,
      life: 2.2,
      t: 0,
    });
  }

  _spawnWater(from, to) {
    const THREE = this.three;
    const origin = from.clone().setY(from.y + 0.6);
    for (let i = 0; i < 14; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x03a9f4, transparent: true, opacity: 0.9 })
      );
      drop.position.copy(origin);
      this.scene.add(drop);
      this.effects.push({ kind: "water", mesh: drop, to: to.clone(), phase: i * 0.45, life: 1.5, t: 0 });
    }
  }

  _spawnEarth(to) {
    const THREE = this.three;
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 2.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
      );
      spike.position.copy(to);
      spike.position.x += (Math.random() - 0.5) * 5;
      spike.position.z += (Math.random() - 0.5) * 5;
      spike.position.y = -1;
      this.scene.add(spike);
      this.effects.push({ kind: "earth", mesh: spike, targetY: 2.6, life: 1.3, t: 0 });
    }
  }

  _spawnLightning(to) {
    const THREE = this.three;
    const light = new THREE.PointLight(0xffea00, 10, 35);
    light.position.copy(to).setY(to.y + 7.5);
    this.scene.add(light);

    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.7, 15, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bolt.position.copy(to).setY(to.y + 3.5);
    this.scene.add(bolt);

    this.effects.push({ kind: "lightning", mesh: bolt, light, life: 0.55, t: 0 });
  }

  _spawnIce(from, to) {
    const THREE = this.three;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshStandardMaterial({ color: 0x80deea, emissive: 0x00838f, roughness: 0.1 })
    );
    crystal.position.copy(from).setY(from.y + 0.6);
    this.scene.add(crystal);
    this.effects.push({ kind: "projectile", mesh: crystal, light: null, to: to.clone().setY(to.y + 0.6), speed: 15, life: 2.2, t: 0 });
  }

  _spawnDragon(from, to) {
    const THREE = this.three;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xab47bc, emissive: 0x4a148c })
    );
    orb.position.copy(from).setY(from.y + 0.6);
    this.scene.add(orb);
    this.effects.push({ kind: "projectile", mesh: orb, light: null, to: to.clone().setY(to.y + 0.6), speed: 17, life: 2.2, t: 0 });
  }

  impact(charged) {
    this._impactTime = charged ? 0.7 : 0.45;
  }

  _startLoop() {
    const loop = () => {
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

    // Cámara cinemática: órbita suave en reposo + zoom dramático
    let baseR = 25, baseY = 9.5;
    if (this._impactTime > 0) {
      this._impactTime -= dt;
      const p = Math.max(0, this._impactTime);
      baseR = 25 - 8 * Math.sin(p * 8);
      baseY = 9.5 - 3 * Math.sin(p * 8);
    }
    const orbitSpeed = 0.13;
    this.camera.position.x = Math.sin(t * orbitSpeed) * baseR;
    this.camera.position.z = Math.cos(t * orbitSpeed) * baseR;
    this.camera.position.y = baseY;
    this.camera.lookAt(0, 3.2, 0);

    // Animación de respiración continua (idle bobbing) + retroceso
    if (this.playerSprite) {
      const bob = Math.sin(t * 2.5) * 0.3;
      const recoil = this._recoil.player;
      this.playerSprite.position.y = 3.5 + bob - recoil * 1.8;
      this.playerSprite.position.x = -6.8 - recoil * 2.2;
      this._recoil.player = Math.max(0, recoil - dt * 4);
    }
    if (this.enemySprite) {
      const bob = Math.cos(t * 2.5) * 0.3;
      const recoil = this._recoil.enemy;
      this.enemySprite.position.y = 3.5 + bob - recoil * 1.8;
      this.enemySprite.position.x = 6.8 + recoil * 2.2;
      this._recoil.enemy = Math.max(0, recoil - dt * 4);
    }

    // Rotación suave de los aros elementales en el suelo
    if (this.playerRing) this.playerRing.rotation.z += dt * 0.6;
    if (this.enemyRing) this.enemyRing.rotation.z += dt * 0.6;

    // Nubes en movimiento
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.95;
      if (cloud.position.x > 55) cloud.position.x = -55;
    }

    // Textos flotantes 3D
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.t += dt;
      ft.sprite.position.y += dt * 2.2;
      ft.sprite.material.opacity = Math.max(0, 1 - (ft.t / ft.life));
      if (ft.t >= ft.life) {
        this.scene.remove(ft.sprite);
        this.floatingTexts.splice(i, 1);
      }
    }

    // Efectos de hechizos en curso
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      switch (e.kind) {
        case "projectile": {
          const dir = new THREE.Vector3().subVectors(e.to, e.mesh.position).normalize();
          e.mesh.position.add(dir.multiplyScalar(e.speed * dt));
          if (e.light) e.light.position.copy(e.mesh.position);
          const dist = e.mesh.position.distanceTo(e.to);
          if (dist < 1.4 || e.t > e.life) {
            this.scene.remove(e.mesh);
            if (e.light) this.scene.remove(e.light);
            this.effects.splice(i, 1);
          }
          break;
        }
        case "water": {
          const dir = new THREE.Vector3().subVectors(e.to, e.mesh.position);
          e.mesh.position.add(dir.multiplyScalar(dt * 9));
          e.mesh.position.y = 2 + Math.sin(e.t * 6 + e.phase) * 1.8;
          if (e.t > e.life || e.mesh.position.distanceTo(e.to) < 0.6) {
            this.scene.remove(e.mesh);
            this.effects.splice(i, 1);
          }
          break;
        }
        case "earth": {
          e.mesh.position.y = Math.min(e.targetY, e.mesh.position.y + dt * 8);
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

  show() {
    if (this.renderer?.domElement) this.renderer.domElement.style.display = "block";
  }

  hide() {
    if (this.renderer?.domElement) this.renderer.domElement.style.display = "none";
    this.stop();
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 420;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    for (const e of this.effects) {
      if (e.mesh) this.scene?.remove(e.mesh);
      if (e.light) this.scene?.remove(e.light);
    }
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
