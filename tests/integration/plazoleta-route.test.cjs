"use strict";

/**
 * Ruta del POC "Plazoleta del Río" (M2 / Cali Viva).
 *
 * Comprueba que la página se sirve con cabecera CSP estricta, sin recursos de
 * terceros, y que las rutas existentes (modo clásico y mundo v0) siguen intactas.
 * NO modifica ninguna aserción de seguridad previa: sólo añade cobertura.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, stopTestServer } = require("../helpers/server-process.cjs");

test("POC Cali Viva: ruta, CSP estricta y convivencia con el modo clásico", async (t) => {
  const server = await startTestServer();
  t.after(async () => { await stopTestServer(server); });

  const pageRes = await fetch(`${server.url}/plazoleta.html`);
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.ok(html.includes("Plazoleta del Río"), "la página debe identificarse");
  assert.ok(html.includes("/js/world/plazoleta/boot-guard.mjs"), "debe cargar el arranque del POC");
  assert.ok(!/<script[^>]*type=["']importmap["']/i.test(html), "sin importmap inline (bloqueado por CSP estricta)");
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), "sin scripts inline");
  assert.ok(!html.includes("cdnjs"), "no debe depender de un CDN");
  assert.ok(!html.includes("unpkg"), "no debe depender de un CDN");

  const csp = pageRes.headers.get("content-security-policy");
  assert.ok(csp, "la ruta del POC debe enviar Content-Security-Policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.ok(!csp.includes("unsafe-eval"), "la CSP no debe permitir eval");
  assert.ok(!csp.includes("unsafe-inline"), "la CSP no debe permitir scripts inline");

  // Recursos del POC servidos con el tipo correcto.
  const entry = await fetch(`${server.url}/js/world/plazoleta/main.mjs`);
  assert.equal(entry.status, 200);
  assert.match(entry.headers.get("content-type") || "", /javascript/);

  const boot = await fetch(`${server.url}/js/world/plazoleta/boot-guard.mjs`);
  assert.equal(boot.status, 200);

  const css = await fetch(`${server.url}/css/plazoleta.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type") || "", /css/);

  const three = await fetch(`${server.url}/js/vendor/three/three.module.min.mjs`);
  assert.equal(three.status, 200);
  assert.match(three.headers.get("content-type") || "", /javascript/);
  assert.ok((await three.text()).length > 100000, "el build vendorizado debe estar completo");

  // Rutas previas intactas: modo clásico, mundo v0 y redirect raíz sin cambios.
  const classic = await fetch(`${server.url}/mokepon.html`);
  assert.equal(classic.status, 200, "el modo clásico debe seguir disponible");

  const world = await fetch(`${server.url}/world.html`);
  assert.equal(world.status, 200, "el prototipo v0 debe seguir disponible");

  const root = await fetch(`${server.url}/`, { redirect: "manual" });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), "/world.html");
});
