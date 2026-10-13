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
   - Reemplaza el comando shell anterior por un verificador multiplataforma confiable que ejecuta `node --check` individualmente sobre el conjunto protegido de 27 archivos Node/CJS/MJS y suites de prueba. No afirma validar todos los módulos browser `.js`, porque el paquete raíz es CommonJS y esos módulos legacy se ejecutan como ESM en navegador.

---

## 7. Estrategia hacia Superbloques Posteriores (M1-B)

- **M1-B (M1.5–M1.7)**: `LegacyAnimalAdapter` + extracción de posición/movimiento + contrato de colisiones, preservando la API y experiencia legacy durante la transición.
- **M1-C (M1.8–M1.10)**: consolidación de reglas elementales compartidas, consolidación de tests de dominio/integración y cierre mediante regression gate + PR.
- M1.8 debe eliminar la duplicación que hoy protege temporalmente el parity guard.
