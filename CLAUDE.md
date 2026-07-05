# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

疊池 / SUPERPOOL — a first-person web 3D horror-ish experience. You walk through a pool/backrooms space where every door leads to a *different parallel universe* of the same room, and water reflections render a *different* branch than the one you stand in. The design bible is `plan` (Traditional Chinese) — read it for intent, milestones (M0–M5, all ✅), and the philosophy. Respond in Traditional Chinese.

## Commands

```bash
npm run dev        # dev server (localhost:3000)
npm run build      # production build — the real gate (typecheck runs inside it)
npm run typecheck  # tsc --noEmit
npm start          # serve the production build (needed to test the PWA service worker)
npm run icons      # regenerate public/icons/*.png from scripts/gen-icons.mjs
```

There is **no test framework and no linter**. Verification = `npm run typecheck` + `npm run build` + **driving the real app in a browser**. Always dogfood visual/gameplay changes; typecheck alone proves nothing about rendering.

### Debug URL params (client-only, read on load)
- `?d=0.65` — jump straight to any divergence D ∈ [0,1]
- `?a=arcade` — force an archetype (`poolhall|arcade|flooded|storage|corridor`)
- `?b=021` — replay a shared branch (sequence of door indices)
- `?touch=1` — force the mobile touch UI on desktop

`window.__superpool` (the Zustand store) and `window.__branch` (`replayPath`/`decodePath`/`shareUrl`) are exposed for console driving.

## The core invariant: determinism

Everything hangs off one rule — **`(seed, D) → room` is a pure function** (`generateRoomSpec` in `src/core/room.ts`, driven by the `mulberry32` PRNG). This is the shared prerequisite for three features that all break if it breaks:

1. **Reflections** — the water renders `generateRoomSpec(mirrorSeed(branchId), …)`, a *different but reproducible* universe.
2. **Replay / sharing** — a journey is fully determined by `path[]` (the sequence of door indices) from a fixed start. `src/core/branch.ts` replays it.
3. **impossible-space** — traversing a door swaps room content and teleports the player home; memory only ever holds ~2 rooms.

**When editing `generateRoomSpec`, never reorder `rng()` calls.** The draw order is load-bearing: `replayPath` re-derives door `dDelta` values by re-running the same rng stream, so inserting/removing an `rng()` before the door loop silently invalidates every shared link. The figure/prop rolls are drawn in a fixed order for the same reason (see comments in `room.ts`). `ROOT_BRANCH` is always forced to the `poolhall` archetype — `branch.ts` (`rootForce`) and `Experience.tsx` must agree on this or replay diverges from live play.

## Divergence model (D)

`D ∈ [0,1]` in the store is the central variable — "how far from home." Every traverse applies `dDelta + ENTROPY_DRIFT` (entropy always pushes outward; coherent doors give negative dDelta). D drives, in real time: fog color/near/far, light density, geometry jitter, water ripple, hum detune, figure presence/mode, archetype weighting, palette blend, post-processing intensity. If you add a new D-driven effect, bind it the same way the existing ones do so "how far from home" stays legible at a glance/by ear.

## Architecture

`Experience.tsx` is the assembly point (Canvas + the divergence loop + ending orchestration). Component tree:

- **`Room.tsx`** — pure render of a `RoomSpec`, dispatched by `archetype` (5 kinds). Reuses parts from `src/components/room/parts.tsx` (walls, doors, arches, skylights, figure, caustics, props). `variant="mirror"` and `ghost < 1` (superposition) reuse the same component.
- **`Pool.tsx`** — the signature effect. Renders the *mirror branch* into a half-res FBO via a reflection camera + oblique clip plane (math ported from three.js `Reflector` to avoid mirror-culling bugs), sampled by a screen-space water shader with D-scaled ripple. Uses `spec.mirrorWater`; returns null if the room has none.
- **`Player.tsx`** — drag-look + WASD + virtual joystick (`src/core/input.ts`). Movement, water-rect collision, door-trigger traversal, flooded-room swim physics, figure-proximity audio all live in one `useFrame`.
- **`Effects.tsx`** — found-footage post: custom VHS-tracking `Effect` + Noise/ChromaticAberration/Scanline/Vignette/Bloom, all D-bound; Bloom/Scanline cut on the low quality tier.
- **`Hud.tsx`** — REC / impossible timestamp (`FEB.29 1997`) / TRACKING readout / lucid subtitles / Zhuangzi ending / share button / touch controls.

**State** is a single Zustand store (`src/core/store.ts`): `branchId`, `D`, `path[]`, `travelNonce`, and a `phase` state machine: `play → lucid (D≤0.02, the "no original home" reveal) | super (D≥0.9) → end (Zhuangzi butterfly)`. The initial state reads `?b=` (replay) then `?d=` then defaults.

**Audio** (`src/core/audio.ts`) is a module-level Web Audio singleton, **not** React — started once from a user gesture (`startAudio` on the click-to-enter overlay). Components push state into it via setters (`setAudioDivergence`, `setDoorVoices`, `setFigureState`, `setUnderwater`, `setSuperposition`, `resolveEnd`). It never reads the store.

**Quality tiering** (`src/core/quality.ts`) — `detectQuality()` is a cached one-shot that decides dpr cap, FBO scale, and whether heavy post runs. Read it at mount in `Experience`/`Pool`/`Effects`/`Hud`; do not re-detect per frame.

## Gotchas learned the hard way

- **React 19 + `@react-three/postprocessing`**: effect components must take a **callback ref**, never an object ref. `wrapEffect` does `JSON.stringify` on leftover props (React 19 includes `ref`), and a mounted object ref carries a circular reference that crashes to a black screen. See `Effects.tsx`.
- **`EffectComposer` children** reject `false` — build a `.filter(Boolean)` array for conditional passes, don't use `{cond && <Pass/>}`.
- **Spawn reset must be inside `useFrame`, not `useEffect`.** `useEffect` runs after paint, so the first frame of a new room can still hold the old (against-the-wall) position and instantly re-trigger a door — chained traversals. `Player.tsx` resets position synchronously when `spec.seed` changes.
- **Dev HMR is flaky** with this R3F setup — an edit sometimes yields `a[d] is not a function` or a 500. If a page 500s after edits, restart `npm run dev` (and `rm -rf .next/cache` if it persists); it's not your code.
- **Headless WebGL doesn't work here** (SwiftShader context fails). Dogfood with a real/headed browser.
