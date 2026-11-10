# PROJECT FIX LOG

## Overview
This project was blocked by a compilation error in the main React screen flow. A second, smaller issue was also present in the mobile touch HUD and prevented the file from compiling when mouse-based firing logic was referenced.

## Files Modified
- `src/App.tsx`
- `src/components/TouchHUD.tsx`

## Root Causes
### 1) Duplicate setInterval closure in `src/App.tsx`
The gameplay HUD poller had a duplicated closure and an extra `}, 90);` line inserted after the bomb-site proximity block. This corrupted the TypeScript syntax and produced build failures.

### 2) Missing mouse-fire ref in `src/components/TouchHUD.tsx`
The component used `isMouseFireActive` in the mouse click handlers but never initialized a matching `useRef` object. TypeScript flagged the missing identifier.

## Change Notes
### `src/App.tsx`
- Removed the stray duplicate end-of-interval closure.
- Kept the bomb-site proximity check inside the interval callback.
- Preserved the proper cleanup return path so the engine is stopped and the interval is cleared correctly.

### `src/components/TouchHUD.tsx`
- Added the missing `const isMouseFireActive = useRef<boolean>(false);` ref.
- Left the existing UX and input semantics intact while restoring the compile-safe state.

## Validation
The following checks were run after the fixes:
1. `npm run lint` -> Passed
2. `npm run build` -> Passed
3. Local dev server smoke test -> HTTP 200 on port 3001

## Final Notes
The initial build-fix pass did not require dependency changes. The project remains architecture-preserving and minimal in scope.

## Phase 1 Reliability Follow-up (2026-11-10)

### `src/App.tsx`
- Added typed HUD snapshots and update them after each poll, preventing repeated state updates for unchanged values.
- Compare radar telemetry by its actual values and compute it only once per polling tick.
- Compare player and roster data using serialized value signatures so in-place mutations are detected.
- Track app-owned UI timeouts and clear them when the gameplay effect is cleaned up.
- Synchronize changed control and graphics settings to the active engine without restarting the current match.

### `src/engine/gameEngine.ts`
- Track transient gameplay timeouts separately from the render-loop fallback timer.
- Clear all tracked gameplay timeouts during `stop()` to prevent callbacks from mutating a stopped or disposed engine.

### Validation
- `npm run lint` -> Passed
- `npm run build` -> Passed (non-blocking Vite config and large-chunk warnings remain)

## Phase 2 Configuration and Resource Fixes (2026-11-10)

### Changes
- `src/components/AgentSelect.tsx`: dispose scene geometries, material textures, and materials; remove renderer canvas during cleanup.
- `src/components/AppErrorBoundary.tsx` (new) and `src/main.tsx`: wrap the application with an error boundary that logs render errors and presents a reload action.
- `package.json`: make `clean` cross-platform using Node's `fs.rmSync`.
- `vite.config.ts` and `tsconfig.json`: align `@` aliases to the `src` directory.
- `metadata.json`, `README.md`, and `.env.example`: remove the unused server-side Gemini claim and obsolete API-key setup instructions/file.
- `package.json`, `package-lock.json`, and `bun.lock`: remove unused `@google/genai`, `dotenv`, `express`, and `@types/express` direct dependencies. The bun workspace dependency list was updated alongside the npm-generated lockfile.

### Validation
- `npm run lint` -> Passed.
- `npm run clean` -> Passed on Windows.
- `npm run build` -> Passed.
- Build output no longer includes the `__dirname` config-loader warning. The existing large JavaScript chunk warning remains.
- No dependencies were added. Four direct dependencies were removed.

## Phase 3 Bundle and QA Improvements (2026-11-10)

### Changes
- `src/App.tsx`: lazy-load the game engine and menu, agent selection, armory, settings, and match-summary screens. This keeps the initial route bundle smaller and defers the 3D game engine until play starts.
- `tests/gameData.test.ts` (new): added four built-in Node test-runner cases covering key game-data integrity constraints.
- `package.json`: added `npm test` using the existing `tsx` dependency.
- `vite.config.ts` already uses `import.meta.url` for path resolution from Phase 2; no additional change was needed for the config-loader warning.

### Validation and bundle results
- `npm run lint` -> Passed.
- `npm test` -> Passed (4 tests).
- `npm run build` -> Passed.
- Main JavaScript chunk reduced from about 1,269 kB to 435 kB (gzip: 331 kB to 125 kB).
- `proceduralModels` remains a deferred 588 kB chunk and still triggers Vite's large-chunk warning. Further model-module separation is still recommended; warning thresholds were not raised.
- Latest build emitted no `__dirname` config-loader warning.

## Audio Quality Follow-up (2026-11-10)

### Changes
- `src/audio/soundEngine.ts`: fixed the unconfigured gunshot sub-oscillator that defaulted to a continuous 440 Hz tone at full gain for weapon categories without a sub layer.
- Lowered the gunshot output ceiling and voice output level to reduce piercing peaks and voice/SFX harshness.
- Improved Web Speech voice ranking using locale, gender hints, natural-voice naming, and default-voice preference. Narrowed pitch/rate variation to reduce artificial-sounding delivery.

### Validation and limitations
- `npm run lint` -> Passed.
- `npm test` -> Passed (4 tests).
- `npm run build` -> Passed.
- Audio was not auditioned in a shared browser/device during this pass. Speech quality depends on installed browser/OS voices; improvements to voice choice cannot guarantee studio-quality human recordings.
