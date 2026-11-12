# NCR Rail 2D/3D Visualization

Interactive NCR rail map (DMRC, NMRC and NCRTC): a Leaflet 2D view (the geographic validation layer) and a Three.js 3D view, both driven by the same GeoJSON.

**Priorities, in order:** geographic accuracy → 2D validation → 3D quality.

## Current phase

Phases 1 (research), 2 (dataset build), 3 (validation: 0 errors), 4 (Leaflet 2D map), 5 (3D foundations), 6 (3D infrastructure), 7 (3D look, OSM city, simulated trains, reference-style UI) and 8 (remaining UI: work-in-progress entries, train follow, 2D/3D view handoff, route highlighting) are **done**. The human imagery review in `docs/phase4-leaflet-map.md` §5 is pending. Phase 9 (journey planner) has **not started** and is waiting for the user's go-ahead.
Track progress in `docs/CODE_SUMMARY.md`.

## Next session: start here (handoff, 2026-11-12)

Read **`docs/HANDOFF.md` first**. Latest: expanded real city surroundings, roads and Yamuna (DECISIONS #72–#75; `docs/phase8-city-environment.md`), following the landmark/station extension. City tiles stream near the view; low-angle camera and WASD support exploration. The user reviews/commits. Blender's original objects/file are preserved; project models remain in `NCR_Landmarks`. Phase 9 and people simulation remain separate.

Phase 8 includes the regional expansion requested 2026-11-12 (DECISIONS #59–#61). Read `docs/phase8-train-speeds.md`, `docs/phase8-fleet-assets.md`, `docs/phase8-regional-expansion.md` and `docs/CODE_SUMMARY.md` first. Aqua, Namo Bharat RRTS and Meerut Metro are now active networks; Rapid Metro Gurugram remains a work-in-progress entry. The extension is ready for review; the user commits it.

**Phase 9 remaining scope:** From/To station fields; better change times, sourced or marked nominal; alternatives (fastest vs fewest changes); trains to catch from the simulated service. Per-line express speeds and current simulated speed displays were added by the user's request on 2026-11-12 (DECISIONS #64–#65). The graph already exists: `src/utils/routePlanner.ts`.

**Still open from earlier phases:**
- The human imagery review (`docs/phase4-leaflet-map.md` §5).
- Frame rate on real hardware is unmeasured; ask the user.
- Expanded city is tiled (48 selected / 64 cached). Landscape context is 27.37 MB raw / 4.51 MB gzip, water 2.22 MB / 413 KB gzip; serve compressed. Hardware performance review remains pending.

**How to verify visually:** `npm run build && npx vite preview --port 4173`, then `node scripts/screenshot.mjs "http://localhost:4173/?view=3d" /tmp/x.png 1440 900 16000` and read the PNG. Plain `chrome --headless --screenshot` gives a blank WebGL canvas on macOS. Useful URLs:
- `?view=3d` opens on the hub.
- `?view=3d&cam=network` shows the whole network.
- `?view=3d&at=lat,lng,dist` aims at a place.
- `?view=2d#zoom/lat/lng` opens the 2D map at a spot.
- `?base=Satellite` opens the 2D map on imagery.
- `?route=<fromStationId>,<toStationId>` opens with a route highlighted (e.g. `stn_mkpr,stn_necc`).
- `EVAL='js'` runs page JavaScript before the shot (click a train row, the view toggle, etc.).

**Gotchas:**
- macOS disks are case-insensitive. Never create files whose names differ only in case (`Structures.tsx` vs the old `structures.ts` broke the dev server).
- Modules that Node tests import directly (`src/utils/*`, `scene3d/geometry.ts`, `buildStructures.ts`, `buildCity.ts`, `constants/scene.ts`) must use explicit `.ts` import extensions and must not import `src/data/loadNetwork.ts` or `loadCity.ts`, whose Vite `?url` imports break Node and the Node tsconfig.
- The public Overpass server is often busy (HTTP 429/502/504); the fetch scripts retry with backoff and can take minutes.
- Trains are a **simulated** service; keep the "simulated" labels. Route times are estimates from the same constants; keep "estimated".
- Two drei `<Html>` mounting in the 3D scene's first render: the first loses its content. Mount such tags a frame later (see `RouteOverlay.tsx`).
- Props passed to `<Canvas>` / `<MapControls>` in `MetroScene` must be memoised objects: a new object each render resets the camera.
- Focus/fit/follow/camera commands go through `useCommand` so a view switch doesn't replay them; the view itself crosses via `viewHandoff`.
- The user commits each phase themselves unless they ask otherwise.

## Workflow rules

- Work phase by phase (roadmap: `docs/ARCHITECTURE.md` §Roadmap). **Stop at the end of each phase and wait for the user's approval** before starting the next.
- No 3D work until the 2D map passes validation, or its remaining issues are documented.
- Record every user decision in `docs/DECISIONS.md` (dated). Update `docs/CODE_SUMMARY.md` when code changes.
- **At the end of every phase, write `docs/phaseN-<topic>.md`**: a frozen summary in the same shape as `phase1-research-and-plan.md` and `phase2-dataset-build.md`. Cover the goal and result, what was built, outputs with real figures, method, open issues, limitations, how to reproduce, and the next phase. Then stop for approval.
- Never build the whole app in one step.

## Data rules

- **Never invent** stations, coordinates, geometry, colours or station types. If something can't be verified, set it to `unknown` and log it in the quality report.
- Every feature carries provenance: `source[]`, `verified`, `estimated`, `conflicts[]`.
- `data/raw/` is immutable (dated snapshots). `data/processed/` is generated only, never hand-edited. Hand fixes go in `data/manual/`.
- No coordinates hardcoded in frontend code. The frontend only reads processed GeoJSON.
- Both views read the **same** GeoJSON. Never put raw lat/lng into Three.js; project it through `src/utils/projection.ts`.
- Keep attribution: OSM data is ODbL. Show "© OpenStreetMap contributors" in the app.

## Scope (see `docs/DECISIONS.md`)

- In: Noida Metro Aqua Line, Delhi–Meerut Namo Bharat RRTS, Meerut Metro, and DMRC's 9 lines (Red, Yellow, Blue with its Vaishali branch, Green, Violet, Pink, Magenta, Grey, Airport Express).
- Phase 4 corridors: a separate "under construction" layer, off by default.
- Out (shown in the UI only as "work in progress"): Rapid Metro Gurugram.

## Stack and commands

Vite 8 · React 19 · TypeScript 7 · Tailwind 4 · oxlint · @turf/turf · leaflet + react-leaflet 5 · zustand 5 · three + @react-three/fiber 9 + @react-three/drei 10 (3D view lazy-loaded).

```bash
npm run dev          # dev server
npm run build        # tsc -b (app + scripts) && vite build
npm run lint         # oxlint
npm run data:fetch   # new OSM + Wikipedia snapshots → data/raw/ (network; Overpass may be busy)
npm run data:build   # data/raw + data/manual → data/processed + data/metadata, then validates (offline; exit 1 on errors)
npm run data:validate  # validation only → data/metadata/validation_report.json
npm run data:fetch-regional # new regional OSM API snapshot (preserves DMRC baseline)
npm run data:fetch-city  # OSM buildings/roads/green within 300 m of stations → data/raw/osm-city/ (network)
npm run data:fetch-environment # immutable OSM city/roads/landscape/water snapshots; reuses completed requests
npm run data:city    # baseline + environment snapshots → combined GeoJSON, context, hashed city tiles + report
npm test             # data, geometry, city, fleet/motion, routing, landmarks and circulation tests (63)
```

After any change to the data or the pipeline, run `npm run data:build && npm test`. Never ship data with validation errors.

Scripts run directly with Node 24 (`node scripts/x.ts`, no build step). Schema types live in `src/data/types.ts`.

## Docs

| File | Purpose |
|---|---|
| `docs/REQUIREMENTS.md` | What the app must do |
| `docs/ARCHITECTURE.md` | Structure, data schema, pipeline, projection, roadmap |
| `docs/DECISIONS.md` | Dated decision log |
| `docs/CODE_SUMMARY.md` | What exists in the code right now |
| `docs/phase1-research-and-plan.md` | Phase 1 research snapshot (2026-10-31): sources, licences, OSM measurements, 3D assets |
| `docs/phase2-dataset-build.md` | Phase 2 summary: pipeline, outputs, per-line figures, open quality items |
| `docs/phase3-validation.md` | Phase 3 summary: checks, bugs found, reference comparison, documented warnings |
| `docs/phase4-leaflet-map.md` | Phase 4 summary: 2D map, review workflow, imagery findings, review checklist |
| `docs/phase5-3d-foundations.md` | Phase 5 summary: projection, height profile, 3D scene, alignment check |
| `docs/phase6-3d-infrastructure.md` | Phase 6 summary: viaducts, tunnels, stations, LOD, continuity tests |
| `docs/phase7-3d-look-trains-ui.md` | Phase 7 summary: OSM city, Kenney models, simulated trains, reference-style UI |
| `docs/phase8-remaining-ui.md` | Phase 8 summary: work-in-progress entries, train follow, 2D/3D view handoff, route highlighting |
| `docs/ASSETS.md` | Every third-party 3D asset: source, licence, notes, rejected candidates |
| `docs/phaseN-*.md` | One frozen summary per later phase |
| `text.txt` | The original project brief |
| `ref_image.png` | Visual style reference for the UI and the 3D view |
