/**
 * Gestor de Audio con Web Audio API procedural (sin archivos externos).
 * Genera efectos de sonido sintetizados nativos.
 */
export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
  }

  _ensure() {
    if (this._initialized) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
      return true;
    } catch {
      console.warn("[SoundManager] Web Audio API no disponible");
      return false;
    }
  }

  /** Resume context (requerido por autoplay policy). */
  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    this.muted = muted;
  }

  toggle() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Oscillator helper.
   * @param {OscillatorType} type
   * @param {number} freq
   * @param {number} duration
   * @param {number} [gain=0.3]
   * @param {number} [attack=0.01]
   * @param {number} [release=0.1]
   */
  _tone(type, freq, duration, gain = 0.3, attack = 0.01, release = 0.1) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.setValueAtTime(gain, now + duration - release);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Ruido白 (white noise) buffer helper.
   * @param {number} duration
   * @param {number} [gain=0.15]
   * @param {number} [highpass=1000]
   */
  _noise(duration, gain = 0.15, highpass = 1000) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(hp).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  // —— Efectos de sonido ——

  /** Chime / beep agradable para selección de personaje. */
  playSelect() {
    if (!this._ensure()) return;
    this._tone("sine", 880, 0.12, 0.25, 0.005, 0.06);
    setTimeout(() => this._tone("sine", 1100, 0.1, 0.2, 0.005, 0.04), 60);
    setTimeout(() => this._tone("sine", 1320, 0.15, 0.18, 0.005, 0.08), 120);
  }

  /** Sonido de paso / movimiento en mapa (sutil click). */
  playStep() {
    if (!this._ensure()) return;
    this._tone("square", 180 + Math.random() * 60, 0.04, 0.06, 0.002, 0.02);
  }

  /** Ataque FUEGO: whoosh + crackle. */
  playFireAttack() {
    if (!this._ensure()) return;
    this._noise(0.3, 0.2, 2000);
    this._tone("sawtooth", 300, 0.2, 0.15, 0.02, 0.1);
    setTimeout(() => this._noise(0.15, 0.12, 3000), 80);
    setTimeout(() => this._tone("sawtooth", 200, 0.15, 0.1, 0.01, 0.08), 100);
  }

  /** Ataque AGUA: splash. */
  playWaterAttack() {
    if (!this._ensure()) return;
    this._noise(0.35, 0.18, 800);
    this._tone("sine", 600, 0.15, 0.15, 0.01, 0.1);
    setTimeout(() => this._noise(0.2, 0.1, 1200), 60);
    setTimeout(() => this._tone("sine", 400, 0.2, 0.1, 0.02, 0.12), 80);
  }

  /** Ataque TIERRA: thud / impact. */
  playEarthAttack() {
    if (!this._ensure()) return;
    this._tone("sine", 80, 0.3, 0.3, 0.005, 0.2);
    this._tone("triangle", 120, 0.2, 0.2, 0.005, 0.15);
    this._noise(0.15, 0.12, 200);
  }

  /** Sonido genérico de ataque (elige según tipo). */
  playAttack(tipo) {
    switch (tipo) {
      case "FUEGO": this.playFireAttack(); break;
      case "AGUA": this.playWaterAttack(); break;
      case "TIERRA": this.playEarthAttack(); break;
      default: this._tone("square", 300, 0.1, 0.15); break;
    }
  }

  /** Victoria: fanfarria ascendente. */
  playVictory() {
    if (!this._ensure()) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone("sine", freq, 0.25, 0.2, 0.01, 0.1), i * 120);
    });
  }

  /** Derrota: tono descendente sombrío. */
  playDefeat() {
    if (!this._ensure()) return;
    const notes = [440, 370, 311, 220];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone("sine", freq, 0.3, 0.2, 0.01, 0.15), i * 150);
    });
  }

  /** Golpe crítico: impacto fuerte + screen flash. */
  playCriticalHit() {
    if (!this._ensure()) return;
    this._tone("square", 100, 0.15, 0.35, 0.003, 0.1);
    this._noise(0.12, 0.25, 500);
    setTimeout(() => this._tone("sine", 220, 0.1, 0.2, 0.005, 0.05), 50);
  }

  /** Sonido de quemadura. */
  playBurn() {
    if (!this._ensure()) return;
    this._noise(0.2, 0.1, 4000);
    this._tone("sawtooth", 250, 0.15, 0.08, 0.02, 0.1);
  }

  /** Sonido de congelación. */
  playFreeze() {
    if (!this._ensure()) return;
    this._tone("sine", 1400, 0.2, 0.12, 0.01, 0.15);
    this._tone("triangle", 1800, 0.15, 0.08, 0.02, 0.1);
  }

  /** Sonido de veneno. */
  playPoison() {
    if (!this._ensure()) return;
    this._tone("sine", 180, 0.3, 0.1, 0.02, 0.2);
    setTimeout(() => this._tone("sine", 150, 0.25, 0.08, 0.02, 0.15), 80);
  }
}
