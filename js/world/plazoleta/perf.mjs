/**
 * perf.mjs — Instrumentación de rendimiento en cliente (M2 / Cali Viva POC).
 *
 * Prioridad 8 del encargo: métricas reales de frame y `renderer.info`, no promesas.
 * Se activa con `?perf=1`. No mide nada si está desactivado (coste cero).
 *
 * Métricas:
 *   - frame time p50/p95/p99 (ventana móvil de 120 frames) y FPS medio de la ventana
 *   - ms de simulación y de animación por frame (medidos con performance.now)
 *   - renderer.info.render.calls / triangles / programs
 *   - memoria JS si el navegador la expone (Chromium: performance.memory)
 *   - tiempo de GPU si existe EXT_disjoint_timer_query_webgl2
 *
 * Además publica el resumen en `document.title` para poder capturarlo sin DevTools
 * (por ejemplo desde Chrome headless con --dump-dom).
 */

export const PERF_WINDOW = 120;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

export function createPerfMonitor({ enabled = false, budget = { p95Ms: 16.7, calls: 90, triangles: 260000 } } = {}) {
  const frames = new Float32Array(PERF_WINDOW);
  let cursor = 0;
  let filled = 0;
  let last = 0;
  let simMs = 0;
  let animMs = 0;
  let renderMs = 0;
  let gpuMs = 0;
  let overBudgetFrames = 0;
  let degraded = false;
  let lastRenderer = null;
  const listeners = new Set();

  // Consulta de tiempo de GPU (opcional, solo si el driver la expone).
  let gl = null;
  let gpuExt = null;
  let gpuQuery = null;
  function attachGpuTimer(renderer) {
    try {
      gl = renderer.getContext();
      gpuExt = gl?.getExtension("EXT_disjoint_timer_query_webgl2");
    } catch {
      gpuExt = null;
    }
  }
  function beginGpuQuery() {
    if (!gpuExt) return;
    try {
      gpuQuery = gl.createQuery();
      gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, gpuQuery);
    } catch {
      gpuExt = null;
    }
  }
  function endGpuQuery() {
    if (!gpuExt || !gpuQuery) return;
    try {
      gl.endQuery(gpuExt.TIME_ELAPSED_EXT);
      const query = gpuQuery;
      gpuQuery = null;
      const poll = () => {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(gpuExt.GPU_DISJOINT_EXT);
        if (available && !disjoint) {
          gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        } else if (!available) {
          requestAnimationFrame(poll);
        }
      };
      poll();
    } catch {
      gpuExt = null;
    }
  }

  /**
   * Cierra un frame y registra métricas.
   * @param {number} nowMs marca de tiempo (performance.now)
   * @param {object} renderer
   */
  function endFrame(nowMs, renderer) {
    if (!enabled) return null;
    lastRenderer = renderer ?? lastRenderer;
    const frameMs = last === 0 ? 0 : nowMs - last;
    last = nowMs;
    if (frameMs > 0) {
      frames[cursor] = frameMs;
      cursor = (cursor + 1) % PERF_WINDOW;
      filled = Math.min(PERF_WINDOW, filled + 1);
      if (frameMs > budget.p95Ms) overBudgetFrames++;
      else overBudgetFrames = Math.max(0, overBudgetFrames - 1);
    }
    const info = renderer?.info?.render;
    const snapshot = readSnapshot(info);
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  function readSnapshot(info) {
    const values = Array.from(frames.slice(0, filled)).sort((a, b) => a - b);
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return {
      frames: filled,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
      fps: average > 0 ? 1000 / average : 0,
      simMs,
      animMs,
      renderMs,
      gpuMs,
      calls: info?.calls ?? lastRenderer?.info?.render?.calls ?? 0,
      triangles: info?.triangles ?? lastRenderer?.info?.render?.triangles ?? 0,
      programs: lastRenderer?.info?.programs?.length ?? 0,
      heapMB: typeof performance !== "undefined" && performance.memory
        ? performance.memory.usedJSHeapSize / 1048576
        : null,
      overBudgetFrames,
      degraded,
    };
  }

  return {
    enabled,
    attachGpuTimer,
    beginGpuQuery,
    endGpuQuery,
    endFrame,
    listeners,
    get snapshot() {
      return readSnapshot(null);
    },
    recordSim(ms) { simMs = ms; },
    recordAnim(ms) { animMs = ms; },
    recordRender(ms) { renderMs = ms; },
    /** Degradación adaptativa basada en medición, no en suposiciones. */
    shouldDegrade() {
      return enabled && !degraded && filled >= PERF_WINDOW && overBudgetFrames >= 90;
    },
    markDegraded() { degraded = true; overBudgetFrames = 0; },
    budget,
  };
}

/** Suscribe un callback con throttle (para no escribir DOM en cada frame). */
export function onPerfSample(monitor, callback, everyMs = 250) {
  let lastCall = 0;
  const listener = (snapshot) => {
    const now = performance.now();
    if (now - lastCall < everyMs) return;
    lastCall = now;
    callback(snapshot);
  };
  monitor.listeners.add(listener);
  return () => monitor.listeners.delete(listener);
}
