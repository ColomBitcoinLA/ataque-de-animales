# 🗺️ Animal Combat - Hoja de Ruta de Innovación y Escalabilidad (Roadmap)

Este documento define las fases de evolución del juego, desde la refactorización arquitectónica hasta la implementación de mecánicas avanzadas multijugador y de seguridad.

---

## 📌 Fase 1: Desacoplamiento, Limpieza y Red en Tiempo Real (Completada)
- [x] **Modularización del Frontend (ES Modules)**:
  - `js/core/GameState.js` (FSM para controlar vistas y transiciones limpias sin manipular `style.display` directo por doquier).
  - `js/core/GameEngine.js` (Loop desacoplado con `requestAnimationFrame` y delta time).
  - `js/entities/Animal.js` (Clases con hitbox ajustada e interpolación de movimiento).
  - `js/network/NetworkClient.js` (Cliente WebSocket con reconexión automática y fallback).
  - `js/ui/UIManager.js` + `js/main.js` (entrada del cliente).
- [x] **Modernización del Backend (Node.js + WebSockets / ws)**:
  - Reemplazo del polling HTTP de 50ms por WebSockets orientados a eventos.
  - Generación segura de IDs (`crypto.randomUUID`).
  - Limpieza automática de jugadores desconectados (heartbeat/ping-pong).
  - Validación básica de payloads (helmet/rate-limit → Fase 3/seguridad).

---

## 📌 Fase 2: Sistema de Combate Avanzado, VFX y Audio (Completada)
- [x] **Mecánicas de Combate Estratégico**:
  - Barra de Maná / Puntos de Acción (AP): 3 iniciales, +1 por turno.
  - Ataque Básico (0 AP) vs Ataque Cargado Elemental (2 AP).
  - Efectos de Estado: Quemado 🔥 (daño residual), Congelado 💧 (reduce daño recibido), Envenenado 🌱 (reduce ataque rival).
  - Barras de HP animadas con transiciones CSS.
- [x] **Feedback Audiovisual (Juice it!)**:
  - Partículas en Canvas (`js/fx/ParticleSystem.js`): fuego, agua y tierra + Screen Shake (canvas y CSS).
  - Gestor de Audio procedural (`js/audio/SoundManager.js`) con Web Audio API: selección, pasos, ataques elementales, victoria/derrota y toggle mute flotante.
- [x] **UI interactiva responsiva**: tooltips en ataques, badges de estado, diseño responsive móvil/escritorio.

---

## 📌 Fase 3: Multijugador Autoritativo y Matchmaking
- [ ] **Salas de Juego (Rooms) y Lobby**:
  - Creación y unión por código de sala o Matchmaking aleatorio.
  - Sincronización de combate 1v1 en tiempo real autoritativo en servidor.
- [ ] **Modo Un Solo Jugador con IA Inteligente**:
  - Selector de dificultad (Fácil, Normal, Difícil con IA predictiva).
- [ ] **Mapas Dinámicos**:
  - Obstáculos en el canvas (rocas, ríos que no se pueden cruzar).
  - Power-ups recogibles en el mapa (botiquines de vida, botas de velocidad).

---

## 📌 Fase 4: Persistencia, Cuentas y Progresión
- [ ] **Autenticación y Perfil**:
  - Registro/Login con JWT seguro.
  - Guardado de estadísticas (Victorias, Derrotas, Tasa de Victorias).
- [ ] **Sistema de Progresión**:
  - Puntos de Experiencia (XP) y niveles para los animales.
  - Desbloqueo de aspectos (skins) y títulos honoríficos medievales.
