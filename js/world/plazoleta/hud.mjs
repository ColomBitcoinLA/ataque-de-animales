/**
 * hud.mjs — Interfaz del POC (M2 / Cali Viva).
 *
 * Reglas:
 *   - El HUD LEE estado; nunca lo modifica. `main.mjs` es quien traduce intención.
 *   - Escrituras DOM con dirty-check: nada de tocar el documento cada frame.
 *   - Accesibilidad: `aria-live` en objetivo y prompt, diálogo con trampa de foco,
 *     cierre con Escape, foco restaurado y soporte de `prefers-reduced-motion`.
 */

const Q = (id) => document.getElementById(id);

export function createHud({ perfEnabled = false } = {}) {
  const els = {
    objective: Q("objective"),
    objectiveTitle: Q("objective-title"),
    stepDots: Q("step-dots"),
    zone: Q("zone-label"),
    clock: Q("clock-label"),
    petName: Q("pet-name"),
    petMeta: Q("pet-meta"),
    trustFill: Q("trust-fill"),
    trustValue: Q("trust-value"),
    prompt: Q("prompt"),
    promptVerb: Q("prompt-verb"),
    promptKey: Q("prompt-key"),
    toast: Q("toast"),
    dialog: Q("dialog"),
    dialogTitle: Q("dialog-title"),
    dialogBody: Q("dialog-body"),
    dialogLines: Q("dialog-lines"),
    dialogReward: Q("dialog-reward"),
    dialogActions: Q("dialog-actions"),
    loading: Q("loading"),
    perf: Q("perf"),
    perfBody: Q("perf-body"),
    fallback: Q("fallback"),
    help: Q("help"),
  };

  const cache = {
    objective: "",
    zone: "",
    clock: "",
    petName: "",
    petMeta: "",
    trust: -1,
    promptVerb: "",
    promptVisible: null,
  };

  const reducedMotion = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  let lastFocused = null;
  let dialogOpen = false;
  const onCloseHooks = new Set();

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function setObjective(text, stepIndex, stepsTotal) {
    if (!els.objective) return;
    if (cache.objective !== text) {
      cache.objective = text;
      els.objective.textContent = text;
    }
    if (els.stepDots && els.stepDots.childElementCount !== stepsTotal) {
      els.stepDots.replaceChildren();
      for (let i = 0; i < stepsTotal; i++) {
        const dot = document.createElement("span");
        dot.className = "dot";
        els.stepDots.append(dot);
      }
    }
    if (els.stepDots) {
      Array.from(els.stepDots.children).forEach((dot, index) => {
        dot.classList.toggle("done", index < stepIndex);
        dot.classList.toggle("current", index === stepIndex);
      });
    }
  }

  function setContext(zoneLabel, clockLabel) {
    if (cache.zone !== zoneLabel) {
      cache.zone = zoneLabel;
      setText(els.zone, zoneLabel);
    }
    if (cache.clock !== clockLabel) {
      cache.clock = clockLabel;
      setText(els.clock, clockLabel);
    }
  }

  function setPet({ name, meta, trust, trustMax = 5 }) {
    if (cache.petName !== name) {
      cache.petName = name;
      setText(els.petName, name);
    }
    if (cache.petMeta !== meta) {
      cache.petMeta = meta;
      setText(els.petMeta, meta);
    }
    if (cache.trust !== trust) {
      cache.trust = trust;
      if (els.trustFill) els.trustFill.style.width = `${Math.round((trust / trustMax) * 100)}%`;
      setText(els.trustValue, `${trust}/${trustMax}`);
    }
  }

  function setPrompt({ visible, verb = "", label = "" }) {
    if (!els.prompt) return;
    if (cache.promptVisible !== visible) {
      cache.promptVisible = visible;
      els.prompt.hidden = !visible;
    }
    if (visible) {
      const text = `${verb} · ${label}`;
      if (cache.promptVerb !== text) {
        cache.promptVerb = text;
        setText(els.promptVerb, `${verb} — ${label}`);
      }
    }
  }

  let toastTimer = 0;
  function toast(text, ms = 2600) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, ms);
  }

  function openDialog({ title, body, lines = [], reward = null, actions = [] }) {
    if (!els.dialog) return;
    lastFocused = document.activeElement;
    setText(els.dialogTitle, title);
    setText(els.dialogBody, body);
    if (els.dialogLines) {
      els.dialogLines.replaceChildren();
      for (const line of lines) {
        const item = document.createElement("li");
        item.textContent = line;
        els.dialogLines.append(item);
      }
      els.dialogLines.hidden = lines.length === 0;
    }
    if (els.dialogReward) {
      els.dialogReward.hidden = !reward;
      setText(els.dialogReward, reward ? `🏅 ${reward} · recompensa de demostración` : "");
    }
    if (els.dialogActions) {
      els.dialogActions.replaceChildren();
      const list = actions.length > 0 ? actions : [{ label: "Continuar", primary: true }];
      for (const action of list) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        if (action.primary) button.className = "primary";
        button.addEventListener("click", () => {
          closeDialog();
          action.onSelect?.();
        });
        els.dialogActions.append(button);
      }
    }
    els.dialog.hidden = false;
    dialogOpen = true;
    const first = els.dialogActions?.querySelector("button");
    first?.focus();
  }

  function closeDialog() {
    if (!els.dialog || !dialogOpen) return;
    els.dialog.hidden = true;
    dialogOpen = false;
    lastFocused?.focus?.();
    for (const hook of onCloseHooks) hook();
  }

  /** Trampa de foco: mantiene el tabulador dentro del diálogo modal. */
  function trapFocus(event) {
    if (!dialogOpen || event.key !== "Tab" || !els.dialog) return;
    const focusables = els.dialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setLoading(text) {
    if (!els.loading) return;
    if (text === null) {
      els.loading.hidden = true;
      return;
    }
    const label = els.loading.querySelector("[data-loading-text]");
    if (label) setText(label, text);
  }

  function showFallback(message) {
    if (!els.fallback) return;
    els.fallback.hidden = false;
    const body = els.fallback.querySelector("[data-fallback-text]");
    if (body) setText(body, message);
  }

  function setPerfVisible(visible) {
    if (!els.perf) return;
    els.perf.hidden = !visible;
    els.perf.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  /** Actualiza el panel de métricas (llamado con throttle, no cada frame). */
  function updatePerf(snapshot, budget) {
    if (!els.perfBody) return;
    const fmt = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "n/a");
    const rows = [
      ["frame p50", `${fmt(snapshot.p50)} ms`],
      ["frame p95", `${fmt(snapshot.p95)} ms`],
      ["frame p99", `${fmt(snapshot.p99)} ms`],
      ["fps (ventana)", fmt(snapshot.fps, 1)],
      ["sim / anim / render", `${fmt(snapshot.simMs)} / ${fmt(snapshot.animMs)} / ${fmt(snapshot.renderMs)} ms`],
      ["gpu", snapshot.gpuMs ? `${fmt(snapshot.gpuMs)} ms` : "no disponible"],
      ["draw calls", `${snapshot.calls} (plan ${budget.calls})`],
      ["triángulos", `${snapshot.triangles} (plan ${budget.triangles})`],
      ["programas", String(snapshot.programs)],
      ["heap JS", snapshot.heapMB ? `${fmt(snapshot.heapMB, 1)} MB` : "no disponible"],
      ["frames", String(snapshot.frames)],
    ];
    els.perfBody.replaceChildren();
    for (const [label, value] of rows) {
      const line = document.createElement("div");
      line.className = "perf-row";
      const key = document.createElement("span");
      key.textContent = label;
      const val = document.createElement("strong");
      val.textContent = value;
      line.append(key, val);
      els.perfBody.append(line);
    }
  }

  function setTitle(text) {
    if (document.title !== text) document.title = text;
  }

  return {
    els,
    reducedMotion,
    setObjective,
    setContext,
    setPet,
    setPrompt,
    toast,
    openDialog,
    closeDialog,
    isDialogOpen: () => dialogOpen,
    onDialogClose(hook) { onCloseHooks.add(hook); return () => onCloseHooks.delete(hook); },
    trapFocus,
    setLoading,
    showFallback,
    setPerfVisible,
    updatePerf,
    setTitle,
  };
}
