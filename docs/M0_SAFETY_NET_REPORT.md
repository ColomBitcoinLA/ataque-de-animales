# 🛡️ Informe de Cierre: M0 — Safety Net & Regression Gate

- **Proyecto:** Animal Combat / Mokepon Evolution
- **Repositorio:** `https://github.com/ColomBitcoinLA/ataque-de-animales`
- **Branch:** `chore/m0-safety-net`
- **Fecha:** 2026-10-04
- **Estado:** 🟢 PASS (Completo y Verificado)

---

## 1. Resumen Ejecutivo

La fase **M0 — Safety Net** ha sido completada de forma integral, profesional y verificable. Su objetivo ha sido establecer una red de seguridad técnica exhaustiva que permita refactorizar la arquitectura del monolito en fases futuras (M1+) sin romper contratos multijugador, sin degradar el rendimiento y mitigando vulnerabilidades críticas preexistentes.

Todos los criterios de aceptación y guardrails están verdes:
- **M0.5.3 — Multiplayer Contract Tests:** 10 contratos fundamentales (A–J) formalizados y protegidos mediante tests deterministas sobre WebSockets.
- **M0.6 — Security Baseline:** Auditoría completa de código y mitigación de vulnerabilidades críticas (SEC-01 a SEC-12). Implementado KDF asíncrono con `crypto.scrypt` (no bloqueante para el event loop) con migración lazy de SHA-256 legacy, verificación criptográfica de Google ID Tokens (OAuth 2.1), restricción estricta de archivos estáticos (zero-leak de base de datos o backend), rate limiting en memoria con recolección automática e integración consciente de proxies inversos (`TRUST_PROXY`), sanitización de payloads WebSocket, encabezados defensivos HTTP y herramienta de rotación de sesiones.
- **M0.7 — Performance Baseline:** Medición automatizada y reproducible de arranque del servidor, latencia HTTP `/health`, handshakes WebSocket, creación/unión a salas y estabilidad ante ráfagas concurrentes.
- **M0.8 — Regression Gate:** Compuerta automatizada ejecutable mediante `pnpm run gate:m0`, verificando 13 controles deterministas (incluyendo `git diff --check`, `git diff --cached --check` y `pnpm audit --audit-level high`) en entornos Windows y Linux/CI.

---

## 2. Cobertura de Contratos Multijugador (M0.5.3)

Los contratos de red han sido derivados directamente del comportamiento real de `index.js` y protegidos en `tests/integration/multiplayer-contracts.test.cjs`:

| Contrato | Descripción | Validación Realizada |
|---|---|---|
| **A. WebSocket Welcome** | Conexión inicial WS | Entrega `{ type: "welcome", payload: { id, authenticated, username } }`. |
| **B. Create Room** | Creación de sala privada | Emite `{ type: "room_joined", payload: { code, players: 1, host: true } }` con código alfanumérico de 4 caracteres. |
| **C. Join Room** | Unión de segundo jugador | Notifica a ambos clientes `{ type: "room_joined", payload: { code, players: 2, host } }`. |
| **D. Room Full / Inválida** | Manejo de rechazo de unión | Rechaza tercer jugador con `{ type: "error", payload: { message: "Sala llena" } }`; rechaza código inexistente o malformado. |
| **E. Disconnect Cleanup** | Desconexión de jugadores | Libera referencias en memoria, decrementa `/health`, previene fugas de salas huérfanas en memoria y cancela `turnTimer`. |
| **F. Invalid JSON** | Resiliencia ante JSON corrupto | Responde `{ type: "error", payload: { message: "JSON inválido" } }` sin provocar unhandled exceptions ni tumbar el proceso. |
| **G. Unknown Type** | Mensajes con tipo no reconocido | Ignorados de forma segura sin excepciones ni corrupción de estado. |
| **H. Payload Inválido** | Campos nulos, tipos incorrectos o NaN | Validados de forma segura (ej. strings acotados, enums, coordenadas finitas). |
| **I. Authoritative Combat** | Flujo de combate por turnos | `player_ready` → `match_start` → `turn_start` → `submit_attack` → `attack_confirmed` → `round_resolved`. Resolución inmediata si ambos atacan sin esperar timeout de 10s. |
| **J. Duplicate Action Safety**| Envío duplicado de comandos | `submit_attack` repetido en el mismo turno es ignorado; no duplica gasto de AP ni duplica daño de ronda. |

---

## 3. Matriz de Hallazgos de Seguridad (M0.6)

| ID | Severidad | Hallazgo | Estado | Corrección / Mitigación |
|---|---|---|---|---|
| **SEC-01** | CRITICAL | Verificación de Google ID Token inexistente (decode-only sin firma, aud, iss, exp). | **FIXED** | Integrado `lib/security/google-token.js` con `google-auth-library`. Si `GOOGLE_CLIENT_ID` no está configurado, la ruta falla cerrado (503). Se verifica firma RS256, audience, issuer Google y `email_verified`. Test injection permite pruebas deterministas sin tokens reales. Credenciales nunca son logueadas. |
| **SEC-02** | HIGH | Hashing de contraseñas débil con SHA-256 simple (`sha256(salt:password)`) y riesgo de bloqueo de event loop. | **FIXED** | Implementado `lib/security/passwords.js` con KDF asíncrono nativo `crypto.scrypt` (no bloqueante). Incorporada migración lazy y transparente: usuarios legacy verifican contra SHA-256 vía `crypto.timingSafeEqual` y en su primer login exitoso son promovidos automáticamente a scrypt (`scrypt:<hash>`). Cuentas nuevas usan scrypt directamente. |
| **SEC-03** | CRITICAL | Exposición pública total de archivos backend mediante `express.static(__dirname)`. | **FIXED** | Se eliminó `express.static(__dirname)`. Se reemplazó por un allowlist explícito que sirve únicamente `/assets`, `/css`, `/js`, `/mokepon.html` y la redirección `/`. `/data/database.json`, `/package.json`, `/index.js`, `/pnpm-lock.yaml`, `/tests/` quedan completamente bloqueados (404/403). |
| **SEC-04A** | CRITICAL | Exposición actual de base de datos en working tree y commits futuros. | **FIXED** | Se ejecutó `git rm --cached data/database.json`. Se agregó regla estricta a `.gitignore`. El archivo físico local se preservó intacto. Se creó `data/database.example.json` limpio como plantilla. |
| **SEC-04B** | HIGH | Rastreo accidental futuro de la base de datos en Git. | **FIXED** | Protegido en `.gitignore` (`data/database.json` y `data/*.tmp`) y validado permanentemente en la compuerta M0.8 (`scripts/m0-gate.cjs`). |
| **SEC-04C** | HIGH | Exposición histórica de credenciales y tokens en commits previos de Git. | **MITIGATED / REMAINS IN HISTORY** | `git rm --cached` remueve el archivo del índice de commits futuros pero **no borra** los blobs del historial previo de Git. Se requiere scrubbing de historial (`git filter-repo`) coordinado antes de publicar o hacer de acceso público el repositorio histórico. En este encargo no se reescribió la historia de Git. |
| **SEC-04D** | CRITICAL | Tokens de sesión activos generados en el pasado potencialmente expuestos. | **ROTATION REQUIRED BEFORE PRODUCTION TRUST** | Se creó la herramienta `scripts/rotate-sessions.cjs` para revocar atómicamente todos los tokens de sesión creando un `.bak` previo sin borrar cuentas ni estadísticas. Requiere ejecución explícita con `--confirm`. No fue ejecutada en la base de datos real del usuario durante M0. |
| **SEC-05** | HIGH | Confianza ciega en cliente en `POST /api/report_match` (XP farming arbitrario). | **MITIGATED / DEFERRED** | **Mitigado en M0:** Validación estricta de enums (`result`: win/loss/draw; `difficulty`: facil/normal/dificil), longitud máxima de nombres (32 caracteres) y rate limiter dedicado (20 req/min). **Solución definitiva diferida:** La validación autoritativa real de PvE requiere la simulación del servidor que se construirá en M1/M2. |
| **SEC-06** | MEDIUM | CORS abierto indiscriminadamente (`app.use(cors())`). | **FIXED** | Implementado `lib/security/cors-config.js`. En desarrollo permite `localhost` y `127.0.0.1` en cualquier puerto. En producción restringe el origen a los dominios explícitos listados en `ALLOWED_ORIGINS`. |
| **SEC-07** | MEDIUM | Rate limiter legacy crecía en memoria indefinidamente por IP y era inseguro tras reverse proxy. | **FIXED** | Creada clase `RateLimiter` con ventanas configurables, encabezado `Retry-After`, temporizadores `unref()` y recolección periódica automática de IPs expiradas. Soporte explícito de `TRUST_PROXY`: por defecto seguro (no confía ciegamente en `X-Forwarded-For`), y cuando se configura en entorno (`TRUST_PROXY=1`), utiliza `req.ip` de Express para resolver proxies reversos (Cloudflare/Render). |
| **SEC-08** | HIGH | Servidor WebSocket sin límite de tamaño de payload (default 100MB) y validación débil. | **FIXED** | Configurado `maxPayload: 65536` (64 KB) en `WebSocketServer`. Frames mayores se cierran inmediatamente con código 1009. Validación defensiva contra payloads nulos, cadenas infinitas y números NaN. |
| **SEC-09** | MEDIUM | Posibilidad de ataques o estados inconsistentes por comandos fuera de turno. | **FIXED** | Verificación de `room.state === "waiting"` antes de admitir `player_ready`, y `room.state === "playing"` antes de admitir `submit_attack`. |
| **SEC-10** | LOW | Tokens de sesión con TTL en base de datos JSON. | **MITIGATED** | Entropía criptográfica adecuada (`randomBytes(32)` = 256 bits). Limpieza periódica de sesiones expiradas durante la creación. |
| **SEC-11** | LOW | Logs potencialmente sensibles en errores de OAuth. | **FIXED** | Eliminado logging de tokens, contraseñas y payloads crudos. Mensajes de error saneados hacia el cliente. |
| **SEC-12** | MEDIUM | Ausencia de encabezados de seguridad HTTP. | **FIXED** | Incorporados encabezados `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`. La política CSP estricta queda documentada para posterior afinación con Three.js CDN e importmaps. |

---

## 4. Configuración de Rate Limiter y Reverse Proxy

Para garantizar que el limitador de tasa no colapse a todos los usuarios bajo una sola IP cuando la aplicación se despliegue detrás de proxies inversos (ej. Render, Cloudflare, AWS ALB, Nginx), se implementó un mecanismo configurable y seguro por defecto:

1. **Comportamiento por Defecto (Seguro):**
   - Sin la variable `TRUST_PROXY`, Express no confía en encabezados `X-Forwarded-For`.
   - `req.ip` devuelve la dirección del socket directo (`req.socket.remoteAddress`), evitando que un atacante falsifique su IP mediante cabeceras manipuladas.
2. **Habilitación Explícita (`TRUST_PROXY`):**
   - Si se define `TRUST_PROXY` en el entorno (ej. `TRUST_PROXY=1`, `TRUST_PROXY=loopback`, o lista de IPs), Express activa `app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY))`.
   - El rate limiter utiliza prioritariamente `req.ip`, asociando correctamente el límite a la IP real del cliente reportada por el proxy de confianza.

---

## 5. Procedimiento Operativo: Rotación Segura de Sesiones (SEC-04D)

Para invalidar tokens de sesión históricos sin alterar cuentas ni progreso de usuarios, se dispone del script `scripts/rotate-sessions.cjs`.

### Pasos Operativos:
1. **Verificación de Seguridad:**
   Ejecutar `node scripts/rotate-sessions.cjs` sin argumentos no realiza ninguna acción y emite una advertencia de seguridad.
2. **Ejecución con Confirmación Deliberada:**
   ```bash
   node scripts/rotate-sessions.cjs --confirm
   ```
3. **Garantías Técnicas del Script:**
   - Lee la base de datos definida en `ANIMAL_COMBAT_DB_PATH` o `data/database.json`.
   - Crea automáticamente un respaldo fechado con extensión `.bak` (ej. `data/database.json.bak`).
   - Vacía exclusivamente el objeto `sessions: {}`.
   - **Preserva intactas** las colecciones `users: []` y `stats: {}`.
   - Escribe atómicamente utilizando un archivo temporal y reemplazo directo.
4. **Estado en M0:**
   Este procedimiento fue probado en aislamiento en `tests/unit/rotate-sessions.test.cjs` con base de datos efímera. **NO fue ejecutado sobre `data/database.json` real** para respetar la integridad de los datos locales del usuario.

---

## 6. Línea Base de Rendimiento (M0.7)

Ejecutado mediante `pnpm run perf:baseline` en servidor aislado con puerto efímero y base de datos temporal en `os.tmpdir()`:

| Métrica | Resultado Medido | Metodología | Observaciones |
|---|---|---|---|
| **Server Boot Duration** | **752.78 ms** | Spawn a respuesta 200 en `/health` | Rápido arranque monolítico Node 24 |
| **HTTP `/health` Latency (min)** | **1.78 ms** | Medición sobre 50 solicitudes HTTP | Sin overhead de DB |
| **HTTP `/health` Latency (avg)** | **11.92 ms** | Promedio de 50 muestras | Express 5 + rate limiting |
| **HTTP `/health` Latency (p50)** | **15.05 ms** | Mediana (Percentil 50) | Consistente y determinista |
| **HTTP `/health` Latency (p95)** | **16.89 ms** | Percentil 95 | Sin picos notables |
| **HTTP `/health` Latency (max)** | **17.25 ms** | Muestra máxima | Máximo acotado < 20 ms |
| **WebSocket Welcome Handshake (min)** | **1.53 ms** | Conexión WS hasta payload `welcome` | Negociación nativa `ws` |
| **WebSocket Welcome Handshake (avg)** | **4.79 ms** | Promedio de 10 conexiones | Eficiencia de handshake local |
| **WebSocket Welcome Handshake (p95)** | **16.47 ms** | Percentil 95 de conexiones | |
| **Room Creation Latency** | **2.08 ms** | Envío de `create_room` a `room_joined` | In-memory `Map` |
| **Room Join Latency** | **0.94 ms** | Envío de `join_room` a notificación | Sub-milisegundo |
| **Resource Cleanup & Stability** | **PASS** (0 players, 0 rooms) | Ráfaga de 20 clientes WS concurrentes | Liberación completa de sockets y memoria |

---

## 7. Resultados de la Suite de Pruebas

Comando oficial de ejecución:
```bash
pnpm test
```

### Resumen Consolidado:
- **Total tests:** 33
- **Suites ejecutadas:** Unitarias, Contratos de Integración, Seguridad de Integración
- **Passed:** 33 (100%)
- **Failed:** 0
- **Skipped:** 0
- **Duración total:** ~10.2 s

### Desglose por archivo:
1. `tests/unit/passwords.test.cjs`: 6/6 tests passing (KDF asíncrono scrypt, timing-safe compare, lazy SHA-256 migration, invalid inputs).
2. `tests/unit/google-token.test.cjs`: 4/4 tests passing (fail-closed, invalid tokens, mock verifier, audience/issuer checks).
3. `tests/unit/rate-limiter.test.cjs`: 3/3 tests passing (enforcement, TTL cleanup y proxy-aware `req.ip`).
4. `tests/unit/rotate-sessions.test.cjs`: 2/2 tests passing (halt sin flag `--confirm` y revocación de sesiones preservando cuentas/stats con backup).
5. `tests/integration/server-health.test.cjs`: 1/1 test passing (boot HTTP y `/health`).
6. `tests/integration/websocket.test.cjs`: 1/1 test passing (Contrato A - handshake y welcome).
7. `tests/integration/multiplayer-contracts.test.cjs`: 9/9 tests passing (Contratos B a J: salas, turnos, combate autoritativo, idempotencia de comandos).
8. `tests/integration/security.test.cjs`: 7/7 tests passing (SEC-01 a SEC-12, static guard, headers, CORS, maxPayload, TRUST_PROXY).

---

## 8. M0.8 — Regression Gate

Comando oficial:
```bash
pnpm run gate:m0
```

### Validaciones verificadas por el Gate (13/13 PASS):
1. `[✔] 1. Node.js Environment (v24.18.0)`
2. `[✔] 2. pnpm-lock.yaml present`
3. `[✔] 3. package-lock.json absent`
4. `[✔] 4. node_modules untracked in Git (0 tracked files)`
5. `[✔] 5. pnpm install --frozen-lockfile reproducible (OK)`
6. `[✔] 6. JavaScript Syntax Checks (18 files)`
7. `[✔] 7. Full Test Suite (Unit & Integration) (All 33 tests passing)`
8. `[✔] 8. Performance Baseline Execution (Boot ~752ms, WS ~4.8ms)`
9. `[✔] 9a. git diff --check (unstaged whitespace/conflicts) (Clean)`
10. `[✔] 9b. git diff --cached --check (staged whitespace/conflicts) (Clean)`
11. `[✔] 10. Temporary Persistence Hygiene (no .tmp artifacts)`
12. `[✔] 11. Clean Server Boot & Shutdown Lifecycle`
13. `[✔] 12. Dependency Security Gate (zero High/Critical advisories)`

---

## 9. Integridad y Seguridad de Datos

- **`data/database.json` original:** **UNCHANGED**
  - Hash SHA-256 verificado antes de iniciar: `F33694A2300691FC2E8706ADAEF7B45FBB4855699BD6D55CD90F9A72A8ABDD8C`
  - Hash SHA-256 verificado tras ejecutar todas las pruebas y gates: `F33694A2300691FC2E8706ADAEF7B45FBB4855699BD6D55CD90F9A72A8ABDD8C`
  - Ningún usuario real, contraseña, hash o sesión fue alterado o eliminado del archivo físico.
  - El helper `tests/helpers/server-process.cjs` utiliza aislamiento estricto vía `ANIMAL_COMBAT_DB_PATH` apuntando a archivos temporales en `os.tmpdir()` eliminados al terminar cada prueba.
- **`data/database.example.json`:** Creado como plantilla segura para nuevos entornos sin datos personales.
- **Seguimiento Git:** `data/database.json` fue desindexado del repositorio (`git rm --cached`) y agregado a `.gitignore`.

---

## 10. Gestión de Dependencias y Supply Chain

- **Dependencia agregada:**
  - `google-auth-library` (`^11.1.0`): Requerida para verificación criptográfica robusta de Google ID Tokens (RS256, JWKS, aud, iss, exp). Justificada por las especificaciones de M0.6.
- **Lockfile:** `pnpm-lock.yaml` actualizado y verificado con `pnpm install --frozen-lockfile`.
- **Estado de Auditoría (`pnpm audit`):**
  - Se reportan **4 advertencias** en dependencias transitivas:
    - 3 advertencias de severidad **Moderate** en `qs` (`>=6.14.2 <=6.15.3`).
    - 1 advertencia de severidad **Low** en `body-parser` (`<2.3.0`).
  - **Origen:** Ambas provienen exclusivamente de la dependencia oficial `express@5.2.1` (`express > qs` y `express > body-parser`).
  - **Inspección técnica:** `express@5.2.1` es la versión más reciente publicada de Express. No existe actualmente una versión compatible de Express que resuelva estas advertencias transitivas sin introducir overrides artificiales o migraciones breaking.
  - **Resolución / Política:** Siguiendo la política de M0, se aceptan como deuda técnica transitiva documentada de severidad baja/moderada. No se aplican overrides forzados.
  - **Compuerta de Seguridad:** El Regression Gate aplica `pnpm audit --audit-level high`, el cual pasa con **0 vulnerabilidades de severidad Alta o Crítica**.

---

## 11. Archivos Modificados y Creados

### Modificados:
- `.gitignore`: Regla para ignorar `data/database.json` y `data/*.tmp`.
- `index.js`: Incorporación de helpers de seguridad, KDF scrypt asíncrono, validación OAuth, protección de rutas estáticas, encabezados HTTP, CORS configurable, rate limiter proxy-aware con recolección de memoria, validación de payloads WS, límite `maxPayload: 65536` y soporte para `ANIMAL_COMBAT_DB_PATH`.
- `package.json`: Scripts añadidos (`test:security`, `perf:baseline`, `check`, `gate:m0`) y dependencia `google-auth-library`.
- `docs/PHASE_0.md`: Registro de cierre de M0 y referencia al informe.
- `tests/helpers/server-process.cjs`: Aislamiento automático de persistencia con base de datos temporal por instancia de test y limpieza garantizada al detener el servidor.

### Creados:
- `lib/security/passwords.js`: Módulo KDF asíncrono scrypt, timing-safe compare y lazy migration.
- `lib/security/google-token.js`: Módulo de verificación de ID Token OAuth 2.1 con abstracción para tests.
- `lib/security/rate-limiter.js`: Rate limiter proxy-aware en memoria con limpieza automática de IPs expiradas.
- `lib/security/cors-config.js`: Generador de opciones CORS para desarrollo y producción.
- `data/database.example.json`: Esquema inicial vacío para inicialización limpia.
- `scripts/perf-baseline.cjs`: Script ejecutable de línea base de rendimiento.
- `scripts/rotate-sessions.cjs`: Herramienta explícita de rotación y revocación atómica de sesiones con backup.
- `scripts/m0-gate.cjs`: Script ejecutable de compuerta de regresión multiplataforma (13 checks).
- `.github/workflows/ci.yml`: Pipeline de CI para validar `gate:m0` con Node 24 y pnpm 12.3.4.
- `tests/helpers/websocket-client.cjs`: Helper cliente WebSocket para tests de contratos.
- `tests/integration/multiplayer-contracts.test.cjs`: Suite de integración para contratos B–J.
- `tests/integration/security.test.cjs`: Suite de integración para regresión de seguridad SEC-01 a SEC-12.
- `tests/unit/passwords.test.cjs`: Pruebas unitarias asíncronas de contraseñas.
- `tests/unit/google-token.test.cjs`: Pruebas unitarias de tokens Google.
- `tests/unit/rate-limiter.test.cjs`: Pruebas unitarias del rate limiter con soporte proxy.
- `tests/unit/rotate-sessions.test.cjs`: Pruebas unitarias de la herramienta de rotación de sesiones.

---

## 12. Control de Calidad Manual (QA)

- **Pruebas Automatizadas:** 33 pruebas unitarias y de integración pasando al 100%.
- **Pruebas Manuales / Visuales de Navegador:** **REQUERIDAS (NO EJECUTADAS EN ESTE PASO)**.
  - Las validaciones de M0 se ejecutaron exclusivamente en headless / CLI (Node.js test runner y procesos aislados).
  - No se declara realizada la verificación manual interactiva en navegador del cliente web. Dicha verificación sigue listada como requerida antes de un lanzamiento formal a usuarios finales.

---

## 13. Riesgos Diferidos y Gestión de Deuda

1. **SEC-05 — Report Match Client Trust (DEFERRED):**
   - *Riesgo:* En combates PvE, el cliente aún reporta el resultado (`win`/`loss`) vía HTTP.
   - *Mitigación M0:* Se blindaron los tipos de datos, enums y límites de tasa para evitar inyecciones y farming masivo.
   - *Bloqueo:* La eliminación completa de este trust boundary requiere la simulación autoritativa del servidor para PvE, programada para las fases de arquitectura de dominio y simulación (M1 / M2).
2. **SEC-04C — Historical Git Exposure (DEFERRED / SCRUBBING REQUIRED):**
   - *Riesgo:* Los commits anteriores en la historia de Git aún contienen `data/database.json`.
   - *Mitigación:* Se desindexó para futuros commits. Se requiere scrubbing de historia coordinado (`git filter-repo`) antes de hacer público el repositorio histórico.
3. **SEC-04D — Historical Session Tokens (ROTATION REQUIRED):**
   - *Mitigación:* Herramienta `scripts/rotate-sessions.cjs` lista para ejecución deliberada en producción.
4. **Vulnerabilidades Transitivas en Express Upstream:**
   - 4 advertencias (`qs`, `body-parser`) aceptadas como deuda técnica moderada/baja hasta que Express publique una actualización de parche upstream.
5. **Defectos Legacy Identificados (LEGACY-01 a LEGACY-05):**
   - Registrados y preservados intencionalmente sin cambios de jugabilidad ni rediseño en M0 para evitar scope creep antes de la extracción de dominio.
