/**
 * boot-guard.mjs — Arranque a prueba de fallos del POC (M2 / Cali Viva).
 *
 * Se carga como primer módulo de la página. Su trabajo:
 *   1. Instalar captura de errores ANTES de cargar la escena.
 *   2. Mostrar en el HUD cualquier fallo (mensaje real, no pantalla vacía).
 *   3. Importar dinámicamente el entrypoint real y reportar si no puede.
 *
 * Motivo de diseño: la página aplica una CSP estricta (script-src 'self'), así que no
 * hay scripts inline; toda la lógica de arranque vive en módulos propios.
 */

const fallback = document.getElementById("fallback");
const fallbackText = fallback?.querySelector("[data-fallback-text]");
const loading = document.getElementById("loading");

function report(title, detail) {
  if (loading) loading.hidden = true;
  if (fallbackText) {
    fallbackText.textContent = `${title}${detail ? ` — ${detail}` : ""}`;
  }
  if (fallback) fallback.hidden = false;
}

window.addEventListener("error", (event) => {
  report("Error al iniciar el mundo 3D.", event.message || String(event.error || "desconocido"));
});

window.addEventListener("unhandledrejection", (event) => {
  report("Error al iniciar el mundo 3D.", String(event.reason?.message || event.reason || "promesa rechazada"));
});

try {
  await import("./main.mjs");
} catch (error) {
  report("No se pudo cargar la escena.", String(error?.message || error));
}
