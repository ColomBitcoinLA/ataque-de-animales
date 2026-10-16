/**
 * Cali Viva — estadísticas de rendimiento medidas en ejecución (?perf=1).
 * FrameStats es puro (probado en Node). Los valores mostrados provienen de
 * performance.now() y renderer.info reales: nada se estima ni se inventa.
 */

export class FrameStats {
  #samples;
  #index = 0;
  #count = 0;

  constructor(capacity = 240) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('capacity must be an integer >= 2');
    this.#samples = new Float64Array(capacity);
  }

  push(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.#samples[this.#index] = ms;
    this.#index = (this.#index + 1) % this.#samples.length;
    this.#count = Math.min(this.#count + 1, this.#samples.length);
  }

  get count() {
    return this.#count;
  }

  summary() {
    if (this.#count === 0) return { count: 0, avg: 0, p95: 0, max: 0, fps: 0 };
    const values = Array.from(this.#samples.subarray(0, this.#count)).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const p95 = values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)];
    return { count: values.length, avg, p95, max: values[values.length - 1], fps: avg > 0 ? 1000 / avg : 0 };
  }
}

export function formatPerfLines({ frame, cpu, info, heapMB, pixelRatio }) {
  const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');
  return [
    `FPS ${f(frame.fps, 0)} · frame ${f(frame.avg, 2)} ms (p95 ${f(frame.p95, 2)})`,
    `CPU update+render ${f(cpu.avg, 2)} ms (p95 ${f(cpu.p95, 2)})`,
    `Draw calls ${info.calls} · tris ${info.triangles.toLocaleString('es-CO')}`,
    `GPU mem: geom ${info.geometries} · tex ${info.textures}`,
    `JS heap ${heapMB === null ? 'n/d (solo Chromium)' : `${f(heapMB, 1)} MB`} · DPR ${f(pixelRatio, 2)}`,
  ];
}
