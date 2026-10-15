# Animal Combat World — M2 first playable vertical slice (prototype)

This code is a **small playable 3D exploration slice inspired by Cali**, not a complete city, multiplayer world or authoritative gameplay. It preserves the legacy game at `/mokepon.html`. The default `/` now opens `/world.html` after installing the route patch.

Features: third-person camera, stylized Cali-inspired river boulevard/plaza, switch between Salamander/Neptuno/Tierrudo, WASD + Shift movement, mouse camera, bounded motion and solid buildings, trainer and wild creature interaction, simple encounter overlay and local demo XP. World data is in `js/world/world-core.mjs`, backed by pure Node unit tests. Uses existing Three.js import map/CDN, no runtime dependency added.

**Install from the repository root on the new branch**:

```
git fetch origin
git switch --track origin/feat/m2-world-vertical-slice
# unzip archive into repository root (preserving folders)
node tools/install-world.mjs
node --test tests/unit/world-core.test.cjs
pnpm test
pnpm run gate:m0
pnpm start
```

Browse `http://localhost:8080/`. The legacy game remains at `http://localhost:8080/mokepon.html`. Requires WebGL-capable browser and network access to existing Three.js CDN for now. Do not merge before GitHub review, tests and browser QA.

Not implemented: real Cali geography, persistent progression, authoritative world state, real combat transitions, other human players/replication, advanced NPC AI, rigged pet animations. These require later vertical slices. Known Quick Match/PvP issues are unchanged.
