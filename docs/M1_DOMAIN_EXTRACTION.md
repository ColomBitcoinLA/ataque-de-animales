# 🐾 M1 — Domain Extraction: Superblock M1-A Documentation

> **Estado**: 🟡 M1-A EN REVISIÓN INDEPENDIENTE / HARDENING  
> **Fecha**: 2026-10-12  
> **Rama**: `m1/domain-extraction`  
> **Alcance de M1-A**: M1.1 (Inventario semántico), M1.2 (SpeciesDefinition), M1.3 (CreatureIndividual), M1.4 (Identity / Stats / Traits / Temperament / Progression / Position)  
> **Principio rector**: *El dominio no sabe cómo se ve. El renderizador no decide qué es verdad.*

---

## 1. Resumen Ejecutivo

La fase M1 extrae progresivamente el modelo de dominio conceptual del juego desde la implementación monolítica y acoplada de `Animal.js`. En lugar de un "big-bang rewrite" destructivo, M1-A construye el núcleo de dominio puro **al lado del legacy**, garantizando que el juego actual y todas las pruebas de seguridad y regresión (M0) permanezcan 100% verdes.

```text
LEGACY (navegador)                 NUEVO DOMINIO PURO (.mjs)
Animal.js (intacto)                SpeciesDefinition
   │                               CreatureIndividual
   │                               Identity
   │                               Stats
   │                               Traits
   │                               Temperament
   │                               Progression
   │                               Position
   └─────── sigue funcionando ─────┘
```

Ninguna clase o Value Object del nuevo dominio importa ni depende de:
`DOM`, `window`, `document`, `Image`, `Canvas`, `Three.js`, `WebSocket`, `Express`, `HTML`, `CSS` ni `localStorage`.

---

## 2. Arquitectura de Módulos y Dual Runtime Boundary

El proyecto opera con una frontera de ejecución dual bien delimitada entre el navegador cliente y el entorno Node.js CommonJS:

1. **Punto de Entrada en Navegador (`Browser`)**:
   - `js/domain/index.mjs`: Módulo ECMAScript nativo (`ESM`).
   - Se consume directamente por navegadores modernos mediante `<script type="module">` o `import` nativo.
   - **Cero herramientas de compilación**: No se introduce Vite, Webpack, Babel ni TypeScript.
   - Servido estáticamente por Express bajo `/js/domain/` respetando las reglas de seguridad SEC-03.

2. **Punto de Entrada en Node.js (`Backend y Tests`)**:
   - `js/domain/index.cjs`: Único wrapper CommonJS mantenido.
   - Permite que el entorno CommonJS de Node.js v24 y las suites de test (`.test.cjs`) consuman el dominio puro de forma transparente vía `require('../../js/domain/index.cjs')`.
   - Se eliminaron wrappers `.js` redundantes para evitar ambigüedades de resolución en Node.

3. **Restricciones de Acoplamiento y Compatibilidad**:
   - Los módulos legacy de navegador escritos en `.js` (`Animal.js`, `main.js`, `mokepon.js`) utilizan dependencias de entorno de navegador (`new Image()`, DOM) y no son importables directamente desde Node CommonJS.
   - El futuro `LegacyAnimalAdapter` (M1-B) residirá en el espacio de compatibilidad y NO introducirá acoplamiento ilegal entre CommonJS y DOM.
   - Se declara formalmente en `package.json`: `"engines": { "node": ">=22.12" }`.

---

## 3. M1.1 — Inventario Semántico de `Animal.js` y Capas Destino

Auditoría detallada de campos y métodos existentes en `js/entities/Animal.js` y su mapeo arquitectónico:

| Campo / Método / Símbolo | Uso en código legacy | Capa Destino | Clasificación y Destino Arquitectónico |
|---|---|---|---|
| `nombre` | Constructor, identificador de especie, clave de afinidad elemental y nombre en UI | DOMAIN / PRESENTATION | **Especie**: `SpeciesDefinition.displayName`.<br>**Individuo**: `CreatureIndividual.identity.name` (apodo).<br>**Legacy**: Alias compatible en `Animal.nombre`. |
| `foto` | Ruta a imagen de retrato (`./assets/agua.webp`) | PRESENTATION | Asset visual del renderizador/UI. No pertenece al dominio. |
| `vida` | Constructor inicializa `this.vida = 3`. No muta en `Animal.js` durante el combate | DOMAIN / SIMULATION | **Base**: `SpeciesDefinition.baseStats.health`.<br>**Individuo**: `CreatureIndividual.stats` (`base`, `max`, `current`).<br>**Combate**: Estado mutable de simulación/room. |
| `ataques` | Lista de botones (`[{ id: "botonAgua" }]`) y loadout de habilidades | DOMAIN / SIMULATION | **Especie**: `SpeciesDefinition.abilities` (habilidades nativas normalizadas).<br>**Individuo**: Loadout de habilidades activas. |
| `x`, `y` | Coordenadas en mapa canvas 2D (px) | SIMULATION | `Position` (`CreatureIndividual.position` o `SimulationState.position`). |
| `targetX`, `targetY` | Coordenadas destino para interpolación de red | SIMULATION / PRESENTATION | Suavizado visual de red en el cliente. No es verdad de dominio. |
| `velocidadX`, `velocidadY` | Vector de entrada (-1, 0, 1) | SIMULATION | `MovementSystem` (vector de velocidad). |
| `speed` | Escalar de velocidad (180 px/s) | DOMAIN / SIMULATION | **Perfil base**: `SpeciesDefinition.movementProfile.baseSpeed`.<br>**Simulación**: Velocidad efectiva tras modificadores. |
| `ancho`, `alto` | 80x80 px tamaño visual en canvas | PRESENTATION | Huella gráfica para dibujado. |
| `anchoColision`, `altoColision`, `offsetX`, `offsetY` | 30x30 px caja colisionadora centrada | SIMULATION | Geometría y hitboxes del `CollisionSystem`. |
| `mapaFoto` | Instancia de `new Image()` con sprite del mapa | PRESENTATION | Objeto exclusivo de navegador (`HTMLImageElement`). |
| `ready` | Booleano activado en `mapaFoto.onload` | PRESENTATION | Estado de carga de assets visuales. |
| `draw(ctx)` | `ctx.drawImage(this.mapaFoto, ...)` | PRESENTATION | Renderizado 2D Canvas. |
| `setPosition(x, y, immediate)` | Ajuste directo de posición e interpolación | SIMULATION / PRESENTATION | Manipulación de coordenadas en loop local. |
| `updateLocal(dt, mapW, mapH)` | Integración `pos += vel * speed * dt` con límites | SIMULATION | `MovementSystem.advance(...)`. |
| `interpolate(dt, lerpFactor)` | Lerp exponencial hacia `targetX/Y` | PRESENTATION / SIMULATION | Suavizado visual de entidades remotas. |
| `getHitbox()` | Calcula AABB `{ x, y, ancho, alto }` | SIMULATION | `CollisionSystem`. |
| `collidesWith(other)` | Test AABB de intersección de cajas | SIMULATION | `CollisionSystem`. |
| `cloneAt(x, y)` | Copia de animal para instanciar en mapa | FACTORY / LEGACY | Reemplazado por `CreatureIndividual.fromSpecies(...)`. |
| `createDefaultAnimals()` | Factory de Neptuno, Tierrudo y Salamander | LEGACY COMPATIBILITY | Preservado intacto para el frontend actual. En dominio: `getDefaultSpeciesDefinitions()`. |
| `AFINIDAD_ANIMAL` | `{ Neptuno: "AGUA", Salamander: "FUEGO", Tierrudo: "TIERRA" }` | DOMAIN | `SpeciesDefinition.affinity`. |
| `ELEMENTOS_DISPONIBLES` | Lista de 6 elementos | DOMAIN | `VALID_AFFINITIES` en `constants.mjs`. |

---

## 4. Mapeo frente al Contrato Conceptual F0.5: Implementado vs Diferido

Para garantizar absoluta precisión y honestidad técnica, a continuación se detalla el estado de cada concepto del modelo F0.5:

### 4.1 Campos y Conceptos Implementados en M1-A

- **`SpeciesDefinition`**:
  - `speciesId`: Identificador normalizado en minúsculas y no vacío.
  - `displayName`: Nombre visible canónico de la especie (ej. `"Neptuno"`).
  - `category`: Categoría taxonómica (`"PET"` por defecto).
  - `affinity`: Elemento validado contra `VALID_AFFINITIES`.
  - `baseStats.health`: Salud base inmutable > 0.
  - `abilities`: Lista normalizada y congelada de habilidades canónicas con resolución de elemento legacy independiente de la afinidad de la especie.
  - `movementProfile.baseSpeed`: Velocidad de movimiento base (180 px/s).
  - `sensesProfile`, `behaviorProfile`, `habitatProfile`: Perfiles opcionales profundamente inmutables.
- **`CreatureIndividual`**:
  - `entityId`: Identificador único de instancia provisto explícitamente.
  - `speciesId`: Clave foránea hacia la especie.
  - `ownerId`: Identificador opcional del propietario/entrenador.
  - `identity`: Objeto `Identity` con `speciesDisplayName` explícito y `name` (apodo).
  - `stats`: Objeto `Stats` con aislamiento y encapsulación estricta.
  - `traits`: Conjunto `Traits` clonado defensivamente.
  - `temperament`: Disposición conductual `Temperament` validada contra catálogo canónico.
  - `progression`: Nivel y experiencia `Progression` clonados defensivamente.
  - `position`: Coordenadas espaciales 2D `Position` clonadas defensivamente.
  - `lifecycle`: Estado de ciclo de vida (`"ACTIVE"`, `"FAINTED"`).

### 4.2 Campos y Sistemas Diferidos Explícitamente

Los siguientes campos y subsistemas están **diferidos** y NO forman parte del núcleo M1-A:

- **`energy` / `stamina` / `ap` (Puntos de Acción)**: Diferidos a la extracción del motor de combate y simulación de batalla (M1.6 / M1.8).
- **`visualProfile` / sprites / assets gráficos**: Diferidos a la capa de presentación y al adaptador de renderizado (M1-B / M1.7).
- **`behaviorState` / árboles de comportamiento de IA**: Diferidos al subsistema de inteligencia artificial de criaturas salvajes y compañeros (M2).
- **`historyRef` / match history / genealogía**: Diferidos a la capa de persistencia y progresión persistente de la cuenta (M3).
- **`relationshipsRef` / bonding / sistema de party**: Diferidos a los sistemas sociales y de grupo (M3).

---

## 5. Invariantes Fundamentales del Dominio

### 5.1 Species ≠ Individual
Una especie responde a: **"¿Qué clase de criatura es esta?"**  
Un individuo responde a: **"¿Quién es esta criatura en particular?"**

- **Compartido (Especie)**: `speciesId`, estadísticas base (`baseStats`), afinidad elemental (`affinity`), catálogo de habilidades base (`abilities`), perfil de movimiento (`movementProfile`).
- **Aislado e Independiente (Individuo)**: `entityId`, identidad (`identity.name`), salud actual (`stats.current.health`), experiencia (`progression.xp`), nivel (`progression.level`), rasgos (`traits`), temperamento (`temperament`), posición (`position`), ciclo de vida (`lifecycle`).
- `entityId` y `speciesId` son estructuralmente inmutables; las referencias principales (`stats`, `traits`, `progression`, `position`, etc.) no pueden ser reemplazadas desde consumidores. Los objetos mutables exponen operaciones validadas en vez de campos públicos reescribibles.

### 5.2 Aislamiento Defensivo contra Mutable Aliasing (H-1)
Para garantizar que dos criaturas nunca compartan estado mutable por reutilización accidental de instancias por parte del llamador, `CreatureIndividual` clona defensivamente:
- `Stats -> stats.clone()`
- `Traits -> traits.clone()`
- `Progression -> progression.clone()`
- `Position -> position.clone()`

Pruebas de regresión unitarias garantizan que crear dos criaturas pasando las mismas instancias produce dos estados completamente desacoplados.

### 5.3 Normalización Elemental de Habilidades sin Fallback a Afinidad (H-2)
Las habilidades normalizadas en `SpeciesDefinition` **NUNCA** heredan la afinidad elemental de la especie si el elemento no fue especificado:
- Si una habilidad `{ id: "botonTierra" }` se define en una especie de afinidad `AGUA` (como Neptuno), su elemento es estrictamente `TIERRA`.
- Se implementa el mapeo canónico legacy temporal:
  - `botonFuego -> FUEGO`
  - `botonAgua -> AGUA`
  - `botonTierra -> TIERRA`
  - `botonElectrico -> ELECTRICO`
  - `botonHielo -> HIELO`
  - `botonDragon -> DRAGON`
- Identificadores desconocidos resuelven a `element: null`, jamás a la afinidad de la especie.
- Se eliminaron todos los nombres de habilidad inventados ("Chorro de Agua", "Lanzarrocas", "Llamarada") para mantener fidelidad estricta al código fuente legacy.

### 5.4 Identidad Desacoplada del Slug (H-3)
- El constructor directo de `CreatureIndividual` **exige** información de identidad explícita (`speciesDisplayName` requerido).
- No se infiere `speciesDisplayName` ni `name` a partir del slug `speciesId` (ej. `"neptuno"`).
- `CreatureIndividual.fromSpecies(speciesDef, options)` deriva el nombre de exhibición de la especie directamente desde `speciesDef.displayName`, la fuente autoritativa.

### 5.5 Encapsulación de Estado y Validación de Estadísticas
- `Stats.base` y `Stats.max` son objetos congelados inmutables.
- `Stats.current` expone un objeto congelado (`Object.freeze({ health: ... })`). Asignaciones directas como `stats.current.health = 999` fallan en strict mode (`TypeError`) y no pueden corromper el estado interno.
- La salud actual solo puede modificarse a través de los métodos de dominio validados: `takeDamage(amount)` y `heal(amount)`.
- Entradas inválidas a `Stats` (`NaN`, `Infinity`, valores negativos, tipos incorrectos o `currentHealth > maxHealth`) son rechazadas explícitamente con `TypeError` o `RangeError`, sin sustituciones silenciosas.

### 5.6 Ciclo de Vida y Curación (Lifecycle & Heal)
- `takeDamage(amount)` transiciona el ciclo de vida a `"FAINTED"` cuando la salud llega a 0.
- `heal(amount)` incrementa la salud actual respetando el tope de `maxHealth`, pero **preserva** el ciclo de vida: curar a una criatura debilitada (`FAINTED`) **no la revive automáticamente**. Las reglas de reanimación corresponden a políticas de simulación/combate futuras.
- `isFainted` representa el estado de ciclo de vida (`lifecycle === "FAINTED"`); `hasZeroHealth` representa exclusivamente `currentHealth === 0`. Esto evita que una curación no-revivificante deje dos APIs públicas contradiciéndose.
- Las transiciones manuales pasan por `setLifecycle(...)`, que valida contra `LIFECYCLE_STATES`; la política que decide cuándo cambiar de estado queda diferida a simulación/combate.
- Criaturas inicializadas con salud 0 adoptan coherentemente `lifecycle: "FAINTED"`.

### 5.7 Inmutabilidad Profunda (Deep Immutability)
`SpeciesDefinition` aplica `deepClone` y `deepFreeze` recursivos sobre todas sus estructuras anidadas (`baseStats`, `abilities`, `movementProfile`, `sensesProfile`, `behaviorProfile`, `habitatProfile`). Modificaciones externas posteriores al objeto original de configuración no alteran la definición.

---

## 6. Guardias de Paridad y Reglas Arquitectónicas

1. **Elemental Parity Guard (`tests/unit/domain.test.cjs`)**:
   - Guardia de regresión temporal que verifica por lectura estructurada de fuente que `VALID_AFFINITIES` se mantiene en paridad con `Animal.js:ELEMENTOS_DISPONIBLES`, `js/core/typeChart.js:TIPOS` e `index.js:TIPOS`; también compara las afinidades de las tres especies base entre dominio, cliente legacy y servidor.
   - La consolidación unificada definitiva de la matriz de tipos se realizará en M1.8.

2. **Domain Isolation Source-Level Guard (`tests/unit/domain.test.cjs`)**:
   - Análisis estático a nivel de código fuente que escanea todos los módulos `.mjs` de `js/domain/`.
   - Garantiza de forma verificable la ausencia total de APIs o dependencias prohibidas: `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `WebSocket`, `HTMLImageElement`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, `new Image`, `express`, `child_process`, `net`, `http`.

3. **Verificación de Sintaxis Multi-archivo (`scripts/check-syntax.cjs`)**:
   - Ejecuta `node --check` sobre los módulos Node/CJS/MJS protegidos.
   - También valida la sintaxis de `js/entities/Animal.js` y `js/main.js` como ESM mediante copias temporales `.mjs`, sin ejecutar el código ni añadir bundler.

---

## 7. Superblock M1-B — Simulación y Adaptador de Compatibilidad

> **Estado**: 🟡 M1-B EN REVISIÓN INDEPENDIENTE / HARDENING
> **Alcance**: M1.5 (Legacy Compatibility Adapter), M1.6 (Extracción de Posición / Movimiento), M1.7 (Contrato de Colisiones)
> **Garantía**: `Animal.js` no fue reescrito de forma destructiva; su API pública, responsabilidades visuales (`draw`, `mapaFoto`, Canvas) y flujos existentes se preservan intactos mientras la verdad de dominio y cálculo físico se delegan a subsistemas puros.

### 7.1 Arquitectura en Capas M1-B

```text
┌────────────────────────────────────────────────────────┐
│ DOMINIO PURO (js/domain/)                              │
│ - SpeciesDefinition (inmutable, arquetipo de especie)  │
│ - CreatureIndividual (identidad única, stats, vida)    │
│ - Position (Value Object mutable validado)             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ SIMULACIÓN PURA (js/simulation/)                       │
│ - MovementSystem.mjs (integración Euler dt, límites)   │
│ - interpolation.mjs (suavizado visual / red)           │
│ - CollisionSystem.mjs (geometría AABB pura, offsets)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ COMPATIBILIDAD (js/compat/)                            │
│ - speciesResolver.mjs (resuelve 'Neptuno' a canonical) │
│ - LegacyAnimalAdapter.mjs (dueño único de puente)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ PRESENTACIÓN / LEGACY RUNTIME (js/entities/)           │
│ - Animal.js (delega x/y, speed, movimiento, colisión;  │
│   retiene draw(ctx), HTMLImageElement, Canvas)         │
└────────────────────────────────────────────────────────┘
```

### 7.2 M1.5 — Adaptador de Compatibilidad y Propiedad de Estado

1. **Posición lógica vs posición de render**:
   - `CreatureIndividual.position` es la **posición lógica/autoritativa conocida por el cliente**.
   - El adaptador mantiene una posición de render privada exclusivamente para suavizado visual de entidades remotas.
   - `Animal.x/y` preservan la semántica visual legacy y leen la posición de render.
   - Escrituras locales legacy en `x/y` sincronizan posición lógica + render.
   - `setPosition(x, y, false)` actualiza la posición lógica objetivo sin hacer snap visual; `interpolate()` mueve sólo render hacia esa verdad lógica.
   - Esta separación evita que una operación de presentación reescriba estado lógico. La autoridad espacial real de servidor sigue diferida a M2.

2. **Resolución Canónica de Especies (`speciesResolver.mjs`)**:
   - Mapea de forma centralizada y sin strings duplicados:
     - `"Neptuno"` / `"neptuno"` → `neptunoSpecies`
     - `"Tierrudo"` / `"tierrudo"` → `tierrudoSpecies`
     - `"Salamander"` / `"salamander"` → `salamanderSpecies`
   - Nombres desconocidos o nulos lanzan `TypeError` / `Error` predecible y explicativo, previniendo fallas silenciosas.

3. **Estrategia de ID de Compatibilidad**:
   - Generación determinista `compat-<speciesId>-<counter>` (ej. `compat-neptuno-1`).
   - Evita colisiones de identidad dentro del ámbito de ejecución sin requerir infraestructura externa de UUID ni dependencias pesadas.

4. **Preservación de `cloneAt(x, y)`**:
   - Crea un clon de `CreatureIndividual` vía `CreatureIndividual.fromSpecies(species, { ... })`.
   - Garantiza que dos clones no compartan instancias mutables de `Position`, `Stats`, `Traits` o `Progression`.

5. **Delegación de Salud (`vida`)**:
   - `vida` delega en `CreatureIndividual.currentHealth`.
   - Escribir un valor menor invoca `takeDamage`; un valor mayor invoca `heal`.
   - Como regla explícita de compatibilidad legacy, asignar `vida > 0` a una criatura `FAINTED` ejecuta además `setLifecycle("ACTIVE")`. El dominio puro mantiene `heal()` sin reanimación automática.

### 7.3 M1.6 — Extracción de Posición, Movimiento e Interpolación

1. **Contrato de Movimiento (`MovementSystem.mjs`)**:
   - Integración matemática de velocidad en el plano 2D:
     $$\Delta x = \text{velocidadX} \cdot \text{speed} \cdot \Delta t$$
     $$\Delta y = \text{velocidadY} \cdot \text{speed} \cdot \Delta t$$
   - Clampeo estricto a los bordes del mapa:
     $$x \in [0, \text{mapWidth} - \text{entityWidth}]$$
     $$y \in [0, \text{mapHeight} - \text{entityHeight}]$$
   - Manejo determinista e independiente de la tasa de cuadros (`dt`).
   - Validación estricta: `dt`, `speed`, `velocity` y `bounds` deben ser números finitos válidos; valores negativos o inválidos disparan `RangeError` / `TypeError` sin coerción silenciosa de `NaN` o `Infinity`.

2. **Clasificación y Propiedad de la Interpolación (`interpolation.mjs`)**:
   - **Clasificación arquitectónica**: `PRESENTATION / NETWORK SMOOTHING`.
   - La interpolación **no pertenece al dominio puro**. Existe exclusivamente para mitigar el lag visual y la tasa de refresco en entidades remotas recibidas por red WebSocket.
   - Se extrajo como función realmente pura `interpolateScalar` / `interpolatePosition`: devuelve el punto suavizado sin mutar sus entradas.
     $x_{\text{nuevo}} = x + (x_{\text{target}} - x) \cdot (1 - e^{-\text{lerpFactor} \cdot \Delta t})$
   - El adaptador aplica el resultado sólo sobre su posición de render privada; `CreatureIndividual.position` permanece intacta durante el smoothing.
   - Preserva con exactitud matemática la curva visual original de `Animal.interpolate(dt, lerpFactor)`.

### 7.4 M1.7 — Extracción del Contrato de Colisiones

1. **Geometría Pura vs Presentación Gráfica**:
   - Se desacopla el tamaño gráfico visual (`ancho = 80, alto = 80`) del colisionador físico (`anchoColision = 30, altoColision = 30, offsetX = 25, offsetY = 25`).
   - `CollisionSystem.getAabb(position, collider)` computa la caja de colisión AABB pura `(x, y, ancho, alto)` sin instanciar Canvas ni acceder al DOM.

2. **Semántica de Colisión AABB (`CollisionSystem.intersectsAabb`)**:
   - Preserva de forma exacta el comportamiento legacy original caracterizado:
     - No colisionan si:
       $$a.x + a.w < b.x \lor a.x > b.x + b.w \lor a.y + a.h < b.y \lor a.y > b.y + b.h$$
     - Semántica de toque de borde: Cuando las coordenadas límite coinciden exactamente ($a.x + a.w == b.x$), el resultado es `true` (inclusive edge-touch), garantizando compatibilidad 100% con los niveles y obstáculos actuales.
   - Cero dependencias de motores de física externos (no se añade Matter.js, Cannon, Rapier ni Box2D).

### 7.5 API Pública de `Animal.js` Preservada

| Propiedad / Método | Estado en M1-B | Implementación |
|---|---|---|
| `x`, `y` | Delegada | Posición de render legacy; setters locales sincronizan render + posición lógica |
| `targetX`, `targetY` | Delegada | Alias de la posición lógica objetivo (`CreatureIndividual.position`) |
| `velocidadX`, `velocidadY` | Delegada | Getters/setters hacia `this.adapter.velocidadX/Y` |
| `speed` | Delegada | Getter/setter hacia `this.adapter.speed` |
| `nombre` | Delegada | Getter canónico de especie; mutación a otra especie se rechaza en M1 |
| `vida` | Delegada | Getter/setter hacia `this.adapter.vida` |
| `ancho`, `alto` | Delegada | Getters/setters hacia `this.adapter.ancho/alto` |
| `anchoColision`, `altoColision` | Delegada | Getters/setters hacia `this.adapter` |
| `offsetX`, `offsetY` | Delegada | Getters/setters hacia `this.adapter` |
| `setPosition(x, y, immediate)` | Delegada | `this.adapter.setPosition(...)` |
| `updateLocal(dt, mapW, mapH)` | Delegada | `this.adapter.updateLocal(...)` |
| `interpolate(dt, lerpFactor)` | Delegada | `this.adapter.interpolate(...)` |
| `getHitbox()` | Delegada | `this.adapter.getHitbox()` |
| `collidesWith(other)` | Delegada | `this.adapter.collidesWith(other)` |
| `cloneAt(x, y)` | Delegada | `this.adapter.cloneAt(x, y)` |
| `draw(ctx)` | Intacta | Renderizado Canvas legacy en cliente |
| `mapaFoto`, `ready` | Intacta | Carga de `Image()` exclusiva de navegador |
| `createDefaultAnimals()` | Compatible | Retorna las mismas 3 mascotas; sus 5 ataques derivan de las definiciones canónicas de especie |

---

### 7.6 Hardening de revisión independiente

- El loop real de exploración en `js/main.js` consume ahora `MovementSystem.calculateNextPosition`, `MovementSystem.clampToBounds` y `CollisionSystem.getAabb`, eliminando la duplicación de fórmulas que había quedado después de la primera extracción.
- La restricción `mapWidth - ancho` / `mapHeight - alto` se conserva **como footprint de borde legacy** para no alterar la jugabilidad actual. No se considera geometría física canónica y deberá revisarse al introducir la simulación espacial autoritativa.
- Los IDs `compat-<speciesId>-<counter>` son identificadores **locales de compatibilidad de runtime**. No son IDs de red, persistencia ni identidad global.
- Entradas inválidas de posición, velocidad, tamaño, offsets, vida y especie fallan explícitamente; el adaptador ya no convierte silenciosamente valores corruptos a cero/defaults.
- `cloneAt()` reutiliza un único adapter individual nuevo por clon y evita consumir IDs temporales adicionales durante la construcción de `Animal`.
- `cloneAt()` resetea `speed` a la velocidad base de especie, preservando la semántica legacy original.
- El borde de red ignora especies remotas desconocidas sin abortar `syncEnemies`.
- `Animal.adapter` es estructuralmente no reemplazable; `nombre` no puede mutar a otra especie durante M1.
- Las secuencias exactas de los 5 ataques legacy por especie están cubiertas por regresión.
- `Animal.js` y `main.js` siguen requiriendo smoke QA para comportamiento de navegador; su sintaxis sí queda cubierta por `pnpm run check`.

---

## 8. Superblock M1-C — Consolidación Final y Fuente Única Elemental

> **Estado**: 🟢 M1-C IMPLEMENTADO (Listo para QA Manual y Cierre de M1)
> **Alcance**: M1.8 (Consolidación de Reglas Elementales), M1.9 (Consolidación de Tests y Guardias Anti-duplicación), M1.10 (Gate de Integración y Preparación de Cierre)
> **Garantía**: Cero duplicación de matrices de daño o afinidades; tanto el backend como el frontend, dominio, compatibilidad y tests consumen la misma fuente de verdad canónica.

### 8.1 Arquitectura de la Fuente Única Elemental (`js/rules/`)

Se eliminó la dispersión histórica de definiciones elementales (`typeChart.js`, `index.js`, `Animal.js`, `constants.mjs`, `defaultSpecies.mjs`) consolidando todas las reglas en un único subsistema neutral:

```text
               FUENTE CANÓNICA ÚNICA (js/rules/)
               - js/rules/elementalRules.mjs (Datos y cálculo puro congelados)
               - js/rules/index.mjs (Barrel ESM para navegador y frontend)
               - js/rules/index.cjs (Wrapper CJS para Node v24 y backend)
                                    │
       ┌────────────────────────────┼────────────────────────────┬────────────────────────────┐
       ▼                            ▼                            ▼                            ▼
  DOMINIO PURO              FRONTEND / BROWSER           BACKEND / SERVER           COMPATIBILIDAD
(js/domain/)                (js/core/typeChart.js)       (index.js)                 (js/entities/Animal.js)
- VALID_AFFINITIES          - typeMultiplier(...)        - typeMultiplier(...)      - AFINIDAD_ANIMAL
- LEGACY_ABILITY_ELEMENTS   - TIPOS / ELEMENTALES        - TYPE_MATCHUP             - ELEMENTOS_DISPONIBLES
- defaultSpecies.mjs        - getEffectForCharged(...)   - AFINIDAD_ANIMAL          (aliases transicionales)
```

1. **Ubicación Canónica**:
   - `js/rules/elementalRules.mjs`: Contiene las listas y estructuras inmutables profundamente congeladas (`Object.freeze`):
     - `ELEMENTS` / `TIPOS`: `["FUEGO", "AGUA", "TIERRA", "ELECTRICO", "HIELO", "DRAGON"]`.
     - `ATTACK_TO_ELEMENT` / `LEGACY_ABILITY_ELEMENTS`: Mapeo determinista de 6 IDs de botón a elementos.
     - `SPECIES_DEFAULT_AFFINITIES` / `AFINIDAD_ANIMAL`: Afinidades canónicas de las 3 mascotas base.
     - `TYPE_MATCHUP`: Matriz de ventajas y debilidades elementales (6x6).
     - `DRAGON_RESISTANCES` y `DRAGON_RESIST_MULT`: Resistencia de Dragón a Fuego, Agua y Eléctrico (0.75x).
     - `typeMultiplier(attacker, defender)`: Función de cálculo puro de daño elemental.
     - `ELEMENTAL_METADATA` / `TIPOS_ELEMENTALES`: Emojis, colores, tooltips y efectos de ataque cargado.
     - `getEffectForCharged(tipo)` y `emojiForTipo(tipo)`.
2. **Interfaces de Consumo**:
   - ESM: `js/rules/index.mjs` re-exporta la fuente canónica para módulos de navegador nativos.
   - CommonJS: `js/rules/index.cjs` permite que `index.js` y las suites de prueba Node CommonJS consuman el módulo vía `require("./js/rules/index.cjs")`.

### 8.2 Duplicados Eliminados y Adaptadores Preservados

| Archivo | Antes (Duplicación Permanente) | Después (M1.8 / M1.9) |
|---|---|---|
| `js/core/typeChart.js` | Literal independiente de `TIPOS`, `TYPE_MATCHUP`, `DRAGON_RESISTANCES` y duplicado de `typeMultiplier` | Adaptador limpio que re-exporta directamente desde `../rules/index.mjs` sin romper APIs públicas de frontend |
| `index.js` | Literal independiente de `TIPOS`, `TYPE_MATCHUP`, `DRAGON_RESISTANCES`, `AFINIDAD_ANIMAL` y duplicado de `typeMultiplier` | Consume `const { TIPOS, TYPE_MATCHUP, ... } = require("./js/rules/index.cjs")` |
| `js/entities/Animal.js` | Literales independientes de `AFINIDAD_ANIMAL` y `ELEMENTOS_DISPONIBLES` | Re-exporta aliases transicionales derivados directamente de `../rules/index.mjs` |
| `js/domain/constants.mjs` | Literales independientes de `VALID_AFFINITIES` y `LEGACY_ABILITY_ELEMENTS` | Deriva directamente de `CANONICAL_ELEMENTS` y `CANONICAL_ATTACK_TO_ELEMENT` de `../rules/index.mjs` |
| `js/domain/defaultSpecies.mjs` | Asignaciones mágicas con strings duplicados | Utiliza `SPECIES_DEFAULT_AFFINITIES.Neptuno`, etc. |

### 8.3 Invariantes Finales de Milestone 1 (M1)

1. **Aislamiento de Dominio**: El dominio (`js/domain/`) permanece 100% puro y no conoce DOM, Canvas, Image, WebSocket ni Express.
2. **Separación de Posición**: `CreatureIndividual.position` es el único dueño lógico de coordenadas en tiempo de ejecución. La posición de render/suavizado (`renderX, renderY, targetX, targetY`) es una preocupación explícita de presentación y red.
3. **Simulación Pura**: `MovementSystem` y `CollisionSystem` son funciones puras matemáticas de Euler y AABB sin dependencias externas de motores de física.
4. **Fuente Única Elemental**: No existen matrices de tipos elementales duplicadas en ningún módulo del cliente, servidor o dominio.
5. **Inmutabilidad Profunda**: Todas las definiciones de especie y matrices elementales están congeladas defensivamente.

### 8.4 Defectos Legados Conocidos y Trabajo Diferido

Para no alterar la jugabilidad existente de forma no intencionada, los siguientes comportamientos legacy se preservan explícitamente y se difieren a hitos posteriores:

- **Quick Match (Matchmaking aleatorio)**: Presenta comportamientos erráticos conocidos en backend legacy; se difiere a la reestructuración de red en M3.
- **Congelamiento de Par en Combate Privado**: En ciertas condiciones de reconexión WebSocket, una de las dos pantallas puede congelar su loop de animación. Difeerido a M3.
- **UI / HUD Legacy**: La interfaz gráfica continúa siendo la plantilla HTML/CSS tradicional del curso. Se mantendrá hasta la modernización de presentación en M4.
- **Servidor Autoritativo de Movimiento Espacial**: `MovementSystem` corre localmente en el cliente para respuesta instantánea. La simulación espacial de servidor (zonas/shards/mundo) corresponde formalmente a **M2 (World Simulation)**.

### 8.5 Lista de Verificación para QA Manual en Navegador (Smoke Test)

Antes de dar el cierre definitivo a M1 por parte de un operador humano:

1. [ ] **Carga de la Aplicación**: Abrir `http://localhost:8080/` y verificar redirección a `/mokepon.html` sin errores en la consola del navegador.
2. [ ] **Selección de Mascota**: Seleccionar a Neptuno, Tierrudo o Salamander y comprobar que el sprite de retrato y los botones de ataque cargan adecuadamente.
3. [ ] **Skill Loadout**: Probar la personalización de habilidades elementales en la vista previa.
4. [ ] **Mapa 2D**: Mover al personaje con teclas de dirección o botones en pantalla; verificar que el mapa delimita las colisiones y el movimiento es fluido.
5. [ ] **Combate vs Bot (IA)**: Entrar en combate local, ejecutar ataques simples y cargados; verificar que los multiplicadores elementales y los efectos de estado (Quemadura, Congelación, etc.) se reflejan en las barras de vida.
6. [ ] **Partida Multijugador Privada**: Crear sala con código, unirse con una segunda pestaña y verificar el intercambio de ataques elementales.
7. [ ] **Pantalla de Resultados**: Confirmar que la victoria/derrota muestra los mensajes correctos y permite volver a jugar.
8. [ ] **Consola de Desarrollador**: Verificar cero excepciones no controladas (`TypeError`, `ReferenceError`, etc.).

