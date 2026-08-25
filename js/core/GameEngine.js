/**
 * Game loop desacoplado con requestAnimationFrame y delta time.
 */
export class GameEngine {
  /**
   * @param {(dt: number, now: number) => void} updateFn
   * @param {(dt: number, now: number) => void} [renderFn]
   */
  constructor(updateFn, renderFn = null) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.running = false;
    this.rafId = 0;
    this.lastTime = 0;
    this.accumulator = 0;
    /** fixed step opcional para lógica de red (20 Hz) */
    this.networkStep = 1 / 20;
    this._networkAcc = 0;
    /** @type {((dt: number) => void) | null} */
    this.onNetworkTick = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  _loop = (now) => {
    if (!this.running) return;

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // clamp para evitar saltos al cambiar de pestaña
    if (dt > 0.1) dt = 0.1;

    this.updateFn(dt, now);

    if (this.onNetworkTick) {
      this._networkAcc += dt;
      while (this._networkAcc >= this.networkStep) {
        this.onNetworkTick(this.networkStep);
        this._networkAcc -= this.networkStep;
      }
    }

    if (this.renderFn) this.renderFn(dt, now);

    this.rafId = requestAnimationFrame(this._loop);
  };
}
