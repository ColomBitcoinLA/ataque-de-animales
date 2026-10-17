# R1-B · Embercrest salamander — asset handoff / blocker

**Status: ART ASSET REQUIRED.** This is an original concept and production specification, **not** a finished 3D character or a claim of implementation. No final-quality rigged/animated GLB has been produced or accepted. Do not substitute the existing ten-primitive rig, a downloaded commercial character, or a GLB made by repackaging primitives and call R1-B finished.

## Original orthographic concept references

[Front / right-side / rear turnaround](./r1b-salamander-orthos.svg) is a flat, schematic **design reference**, not screenshots, mesh renders, or proof of three-angle model quality. In all views the fire is stylized ceramic/ember anatomy rather than an additive particle effect. The side view faces toward the **right of the page**; glTF forward must be **+Z** in the game after import (confirm orientation in a glTF viewer). In front view the eye highlights are asymmetric to avoid a blank mask; in rear view the three separated dorsal embers and lantern tail tip make the silhouette legible behind the avatar.

### Modeling target, to be reviewed by a character artist

- Original IP: a squat, agile fire salamander with a broad wedge-shaped cranium (about 1.35× shoulder width), two large forward/lateral eyes with eyelids and iris highlights, subtle mouth corners and nostrils, cheek fins (not dragon wings or horns), a tapering torso and **four** sturdy articulated legs with wide, grasping feet. Avoid tracing any existing game mascot.
- Distinguishing rear read: a three-part staggered ember crest, split warm/cool dorsal ridge, tapering flexible tail with a shielded ember tip, and visible left/right leg rhythms. Keep eyes and cheeks readable from front three-quarter view. Do not use unlit bloom as the only means of distinguishing fire anatomy.
- Working dimensions in local meters (final sculpt/rig to verify): ground plane Y=0, shoulder Y≈0.55, top of crest ≤1.02, nose Z≈+0.85, tail end Z≈−1.05, max body width ≈0.65 (not counting outward step poses). Origin between the feet under the torso. Feet rest at local Y=0. This is a **visual** envelope, not a modification to the R1-A 0.34 m collision radius or 1.02 m head-height contract.
- Palette to validate under the plaza lights: upper body clay orange `#dc603c`, shaded extremities oxblood `#862f38`, warm ivory belly `#fff0b5`, amber-to-cream ember faces `#ffd470` / `#fff8ca`, charcoal-teal pupils `#152b32`. Suggested PBR roughness: body 0.6–0.75, belly 0.75–0.85, eyes 0.2–0.32, crest 0.45–0.65. Any emissive use must preserve color when bloom is disabled. Export glTF base colors in sRGB; let three.js manage output color space; no manual double conversion.
- Topology target: clean, deformation-ready contiguous or deliberately separate meshes, no intersecting rigid ball/cylinder stand-ins; loops at shoulders, hips, neck and at least two tail bends. Author actual design detail in geometry and/or licensed textures. Bake a small, color-managed texture atlas if needed. Preserve silhouette and facial readability at the default 6.4 m chase-camera distance and low graphics tier.
- Author three **actual model** inspection images (front, right-side and rear) from the same neutral pose and orthographic camera, plus an in-game rear third-person capture; none exist at this blocker stage. Capture actual draw calls/triangles/frame percentiles in a named browser/GPU environment, not estimates.

## Required art deliverable and acceptance gate

Deliver `assets/characters/embercrest-salamander.glb` and the editable original `.blend` source (or another verifiable original DCC source), texture sources if external, plus model renders and exporter/version instructions. GLB must be locally hosted on this app's same origin, contain a deforming skeletal rig (or equivalent genuinely articulated hierarchy) and **six named clips**: `idle`, `walk`, `run`, `turn-left`, `turn-right`, `interact`. Export a stable rest pose, meters, consistent +Z forward, foot-height origin, no embedded camera or unnecessary lights, no baked root translation for walking/running. Check in a clean glTF validator and two independent viewers; inspect profile, face, rear and animation at near/default/far zoom. Name bones predictably (`root`, `body`, `head`, front/rear left/right upper/lower legs, `tail_01`…`tail_03`, `crest_*`) and provide clip durations and any additive-mask notes. No external URLs in material, image or buffer references.

**Acceptance requires the actual reviewed GLB**, not merely an available Blender executable, a plausible script, a working loader or the concept art. This worktree currently has no accepted animated GLB. The placeholder remains available only as the existing clearly understood fallback. No character code or camera/simulation geometry was changed in this blocker handoff.

### Intended animation contract (implementation still pending)

| State / clip | Source and behavior | Transition target |
|---|---|---|
| `idle` | R1-A `player.locomotion === 'idle'`; breathing/blink with feet planted | Walk/turn/interact cross-fade |
| `walk` | R1-A `locomotion === 'walk'`, **actual distance/phase** drives stride; freeze/settle if collision prevents progress | Idle/run/turn cross-fade |
| `run` | R1-A `locomotion === 'run'` plus sprint/speed; same measured-distance stride, no separate motion integration | Walk/idle cross-fade |
| `turn-left` / `turn-right` | Signed shortest heading delta per frame with tiny actual translation; layered or weighted over stance | Idle/walk/run smoothly |
| `interact` | Successful `activate` event, or explicit read-only one-shot cue from interaction; not merely in range | Prior locomotion state on completion |

Artist to deliver looping `idle`, `walk`, `run`, `turn-*`; `interact` nonlooping with a recoverable end pose. Implementation should use `AnimationMixer` (or equivalent) with ~0.15–0.25 s bounded fades; synchronize paired gaits at equivalent normalized foot-contact phase, not clip start; prewarm initial idle at nonzero weight and avoid double-weighted root motion. Align clip time/stride to `player.phase` and `player.distance` increments computed by `world-sim.mjs` after collision. Use `player.x/z/feetY/heading` for world pose and the camera's existing interpolated subject convention; never write back to simulation, collision, interaction radius or camera solver. Treat reduced motion as disabling unnecessary bob/sway/blink while retaining usable grounded gait feedback. This is a **proposed contract**, not a tested or installed animation system.

### Planned loader, lifecycle, camera and debug acceptance

Once the accepted GLB exists, load by local relative URL with a same-origin `GLTFLoader`, display an explicit loading state, and use the existing ten-mesh Salamander as a **labeled temporary fallback** on error. Show the load failure to a user (accessible status, not console-only); test 404, invalid GLB and an interrupted load. Keep one asset owner for geometries/materials/textures, clone instance-safe skeletons where appropriate, cancel or ignore late load after disposal, and dispose shared GLB resources once all references release. Calibrate the framing against the actual model bounds while preserving `camera-solver.mjs` obstacle tests, minimum boom, player visibility on collapse, interaction focus and unchanged R1-A collision radius; use a grounded contact shadow, not enlarged collision geometry. Expose a keyboard-operable, screen-reader-labeled debug/performance panel displaying **active clip/weights, applied speed, loaded/fallback status, bounds, renderer draw calls/triangles** (measured by `renderer.info`), plus the existing performance samples. Preserve the V0 and classic links and unrelated HUD.

Tests to add **after asset acceptance**: GLB URL/same-origin/clip and skeleton validation; missing/corrupt/network-failure fallback and late-load disposal; state classifier and bounded blend continuity; actual-distance-driven stride and blocked collision; turn directions, interact recovery, reduced motion; camera occlusion and three-view visual QA; V0/classic smoke tests. Re-run `pnpm run check`, `pnpm test`, `pnpm run test:integration`, `pnpm run gate:m0`, `pnpm audit --audit-level high`. Report exact test totals, audit exit, and browser/GPU frame timings only once measured. No FPS or render screenshots are claimed by this handoff.

## Licensing / attribution

The **concept SVG and this art brief** were authored originally for this repository, with no third-party geometry, texture, photograph, character, or model incorporated; release under the repository's **ISC** license (`package.json`). The finished GLB and source **do not yet exist**, so their authorship, license and redistribution permissions are **unverified**. Before ingesting any external commissioned or third-party asset, record creator, source URL, exact redistribution/derivative license, required attribution, texture provenance, and export rights in `docs/ASSET_LICENSES.md`. No third-party model has been selected or incorporated here.

## Manual QA once production resumes

1. Open the world at `plazoleta.html?perf=1` and verify a non-error same-origin GLB network response, correct initial clip and foot placement; simulate 404 and corrupt data and confirm labeled fallback and accessible error.
2. Rotate to front, side and rear in neutral pose; compare actual model against the linked concept, examine eyes, four legs, crest/tail, roughness and silhouette at near/default/far zoom. Capture and label **model** views separately from this concept.
3. Walk and run straight, diagonally and against a wall, switch speed repeatedly; inspect planted feet and continuity at transition boundaries, `phase` versus measured distance, and absence of root-motion drift.
4. Turn left/right in place and while moving, interact with Lucía, interrupt and repeat; verify head intent, one-shot recovery and no instant pose snap.
5. Test mouse/touch chase camera, zoom extremes, dialog focus, bridge and tight wall occlusion; verify boom collision, no camera penetration and no geometry clipping that implies changed gameplay radius.
6. Test reduced motion, low/high quality, WebGL failure/context loss, page navigation/reload and keyboard/screen-reader debug panel; inspect model lifecycle, console errors and resource release.
7. Record p50/p95 frame times, renderer calls/triangles and test totals on named hardware/browser with the accepted asset; compare against the baseline without asserting an unmeasured FPS.
