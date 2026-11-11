# Handoff: Delhi Metro 2D/3D Visualization

**Written:** 2026-11-11 · **For:** any coding model or developer picking this project up without earlier chat history.
**State at handoff:** Phases 1–8 committed. Phase 9 (train control and underground visibility, the owner’s revised scope) implemented; owner review and commit pending. Do not start another phase without the owner’s go-ahead. Journey-planner enhancements remain proposed for Phase 10.

Read this file first, then `docs/CODE_SUMMARY.md` (what exists now) and `docs/phase9-train-control.md` (the latest phase) and `docs/phase9-plan.md` (research and plan). `CLAUDE.md` holds the same rules for Claude Code; this file is the self-contained version.

---

## 1. What this project is

An interactive map of the Delhi Metro (DMRC, 9 lines, 244 stations, 364 km) with two views of the **same** processed GeoJSON:

- **2D** (Leaflet): the geographic validation layer. Real OSM geometry on OSM/satellite tiles.
- **3D** (Three.js via React Three Fiber): viaducts, tunnels, stations, OSM city blocks and simulated trains, in the low-poly style of `ref_image.png`.

Priorities, in this order: **geographic accuracy → 2D validation → 3D quality**. The original brief is `text.txt`.

---

## 2. How the owner works (follow these)

| Rule | Detail |
|---|---|
| **One phase at a time** | The roadmap is in `docs/ARCHITECTURE.md` §Roadmap. Never start the next phase without the owner's explicit go-ahead ("start Phase N") |
| **Close every phase the same way** | Write `docs/phaseN-<topic>.md`, a frozen summary in the same shape as the earlier ones: goal and result, what was built, outputs with **real measured figures**, method, verified, open issues, limitations, how to reproduce, next phase. Update `docs/DECISIONS.md`, `docs/CODE_SUMMARY.md`, `docs/ARCHITECTURE.md` (roadmap row) and the "Next session" section of `CLAUDE.md`. Then stop and report |
| **Log every decision** | `docs/DECISIONS.md`, newest section first, numbered rows (last is **#65**), with date, decision and reason. Owner choices are marked "(user)" |
| **The owner commits** | Don't commit or push unless asked. Leave the work tree ready and say so |
| **Never invent data** | No made-up stations, coordinates, geometry, colours or station types. Unverifiable means `unknown`, logged in the quality report. Hand fixes go in `data/manual/`; `data/processed/` is generated only; `data/raw/` is immutable dated snapshots |
| **Keep attribution** | Retain “© OpenStreetMap contributors” (ODbL), plus applicable tile/model credits |
| **Label what isn't real** | Trains are a **simulated** service; route times are **estimated**; structure sizes and most building heights are **nominal**. Keep these labels in the UI and docs |
| **Realistic visuals, nothing made up** | The owner wants the 3D view to look real and like `ref_image.png`. They pushed back on abstract shapes (a coloured slab for track, boxes for stations). Line colour is an accent, not paint over everything |
| **Vet any 3D model before using it** | Check licence, `isDownloadable`, `faceCount` (`https://api.sketchfab.com/v3/models/<uid>`) **and the listing itself**. Rejected so far: multi-million-face models, a paid licence, and a spam "free game download" listing. Record every candidate in `docs/ASSETS.md`. Often the owner wants the *look*; building it in code along the real alignment is usually better |
| **Check visually** | After any visual change, take real screenshots (§4) and look at them before reporting |
| **Report plainly** | Short, plain English: what changed, what was checked, what is still open. The owner reads summaries, not diffs |

---

## 3. Setup and commands

Node **24** (scripts run as `node scripts/x.ts` with type stripping, no build step). Stack: Vite 8, React 19, TypeScript 7, Tailwind 4, oxlint, @turf/turf, leaflet + react-leaflet 5, zustand 5, three 0.187 + @react-three/fiber 9 + @react-three/drei 10.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # tsc -b (app + scripts) && vite build
npm run lint           # oxlint
npm test               # 49 tests (node --test): validator, projection, height profile, 3D geometry, structures, city, train sim, route planner
npm run data:build     # data/raw + data/manual → data/processed + data/metadata, then validates (offline; exit 1 on errors)
npm run data:validate  # validation only
npm run data:fetch     # new OSM + Wikipedia snapshots (network; Overpass is often busy, retries take minutes)
npm run data:fetch-city && npm run data:city   # OSM buildings/roads/green near stations (3D only)
```

**After any change to data or the pipeline:** `npm run data:build && npm test`. Never ship data with validation errors (currently 0 errors, 2 documented warnings).

**Definition of done for a change:** `npx tsc -b`, `npm run lint` and `npm test` all clean, screenshots checked for anything visual, and docs updated.

`README.md` is still the Vite template boilerplate; it does not describe this project.

---

## 4. Checking the app visually

Plain `chrome --headless --screenshot` gives a blank WebGL canvas on macOS. Use the project's script, which drives real-time headless Chrome:

```bash
# Terminal 1: wait for the preview server to print its ready URL.
npm run build && npx vite preview --port 4173 --strictPort
# Terminal 2:
node scripts/screenshot.mjs "http://localhost:4173/?view=3d" /path/out.png 1440 900 16000
# EVAL='js' runs page JavaScript first (click a train row, a button…); WHEEL=n scrolls n notches in.
EVAL='document.querySelector("[aria-label=\"Follow RD-01 in 3D\"]").click(); "ok"' node scripts/screenshot.mjs "http://localhost:4173/?view=3d" out.png 1440 900 15000
```

The script also prints page `console.log` lines and exceptions, which helps with debugging.

| URL | Opens |
|---|---|
| `?view=3d` | 3D, close up on the hub (Kashmere Gate) |
| `?view=3d&cam=network` / `&cam=top` | Whole network / straight down |
| `?view=3d&at=lat,lng,dist` | 3D aimed at a place from `dist` metres |
| `?view=2d#zoom/lat/lng` | 2D at a spot (the hash updates as you move) |
| `?view=3d&underground=underground` / `&underground=surface` | Manual X-ray / surface; default is Auto while following |
| `?base=Satellite` | 2D on imagery |
| `?route=<fromId>,<toId>` | With a route highlighted, e.g. `stn_mkpr,stn_necc` (Majlis Park → Noida Electronic City) |

The headless browser renders in software (SwiftShader), so frames are slow there. Timing-sensitive UI (camera flights) can behave differently from real hardware; this exposed a camera-flight bug during Phase 8.

---

## 5. Architecture in one page

```
data/raw (dated OSM + Wikipedia snapshots) + data/manual (hand fixes)
   └─ scripts/build-dataset.ts → data/processed/*.geojson + data/metadata/*.json
         └─ scripts/validate.ts (22 checks) → data/metadata/validation_report.json
src/data/loadNetwork.ts (fetches the processed files via Vite ?url)
   └─ src/pages/MapPage.tsx: builds the simulated service once; top bar, cards, and either
        ├─ 2D  src/components/map2d/MetroMap.tsx  (Leaflet panes: construction < track < route < stations < validation)
        └─ 3D  src/components/scene3d/MetroScene.tsx (lazy chunk): geometry.ts projects everything, then
               Structures, City, Trains, StationLabels, RouteOverlay, CameraRig
shared UI state: src/store/useMapStore.ts (zustand)
```

| Area | Key files | Notes |
|---|---|---|
| Schema | `src/data/types.ts` | Every feature has provenance: `source[]`, `verified`, `estimated`, `conflicts[]` |
| Projection | `src/utils/projection.ts` | The **only** way lat/lng enters Three.js (Web Mercator → metres, x east, y up, z south). Also 2D zoom ↔ metres per pixel ↔ 3D camera distance |
| Heights | `src/utils/trackProfile.ts` | Nominal levels per track type, with ramps |
| 3D geometry | `scene3d/geometry.ts` | Route paths (km from the first stop), track runs, station points with heading |
| Structures | `scene3d/buildStructures.ts` (pure, tested) → `Structures.tsx` | Concrete viaduct, piers with caps, parapets, track bed, sleepers (only within 900 m of the view), rails; stations with side platforms, glazed roof, concourse. Sizes in `STRUCTURE` (`constants/scene.ts`), all nominal |
| City | `scripts/build-city.ts` → `scene3d/buildCity.ts` → `City.tsx` | Real OSM buildings, roads and parks near stations, in 3 km chunks |
| Trains | `src/utils/trainSim.ts`, `trainControl.ts` → `scene3d/Trains.tsx` | 218 simulated trains; nominal eased station motion, grade-aligned instanced Kenney cars; per-train hold/resume offsets |
| Train control | `ui/TrainControlManager.tsx`, `useMapStore.trainControls` | Whole fleet in either view; search/filter, single/all Start/Stop, Follow in 3D. Controls survive view switches, reset on reload. Held trains excluded from next-arrival predictions |
| Underground | `scene3d/UndergroundWatcher.tsx`, `trainGeometry.ts`, `utils/underground.ts`, `ui/UndergroundControls.tsx` | Auto reveals the entire followed consist below −2 m; manual Surface/Underground overrides. Ground/city hidden in X-ray; true nominal depth retained |
| Routes | `src/utils/routePlanner.ts` → `store/useJourney.ts` → `ui/RoutePanel.tsx`, `map2d/RouteLayer.tsx`, `scene3d/RouteOverlay.tsx` | Dijkstra on (station, route) nodes; estimated time from the simulation constants plus a 5-minute change |
| Camera | `scene3d/SceneRig.tsx` (`CameraRig`) | Fly-to, fit, zoom, network/hub views, following a train, reporting the view for the 2D/3D switch |
| View switch | `viewHandoff` in `useMapStore.ts` | Non-reactive holder of centre + zoom + viewport height; each view writes it, the other reads it once on mount |
| Commands | `store/useCommand.ts` | Focus/fit/follow/camera commands run once, by whichever view is showing |
| LOD | `LodWatcher` in `MetroScene.tsx` | "Near" below 3 m per pixel: real track and structure detail; "far": screen-space coloured lines and dots |
| Assets | `public/models/kenney/`, `docs/ASSETS.md` | Kenney Train Kit and Nature Kit, CC0 |

---

## 6. Gotchas (each one cost time)

- **macOS disks are case-insensitive.** Never create files whose names differ only in case (`Structures.tsx` vs an old `structures.ts` broke the dev server). `MetroScene` imports `./Structures.tsx` explicitly for this reason.
- **Node-tested modules** (`src/utils/*`, `scene3d/geometry.ts`, `buildStructures.ts`, `buildCity.ts`, `constants/scene.ts`) must use explicit `.ts` import extensions and must not import `loadNetwork.ts` or `loadCity.ts` (their Vite `?url` imports break Node).
- **Memoise objects passed to `<Canvas>` and `<MapControls>`** in `MetroScene`. A new `camera={{…}}` or `target={[…]}` on each render makes React Three Fiber rebuild the camera and controls, snapping the view back to the start.
- **Two drei `<Html>` tags mounting in the scene's first render:** the first loses its content. Mount such tags a frame later (`RouteOverlay.tsx` does).
- **Camera commands during a flight** must aim at the flight's destination (or the followed train), not the current mid-flight position.
- **Interchange stations are one station feature** with several `lines` and one `platforms[]` entry per line. In 3D there is one station point per (station, line), plus an interchange marker with `lineId: null`.
- **Segments are split where the track type changes**, so one stop-to-stop hop can have several segments.
- **Pink Line is a loop route** that lists Maujpur-Babarpur twice.
- **Blue and Green have branches** as separate routes (`blue_vaishali`, `green_kirti_nagar`), joined at Yamuna Bank and Ashok Park Main. Magenta also has two routes.
- **Left-hand running:** trains run 2 m left of the centre line (`TRAIN.trackOffset`); the two tracks are 4 m apart. In a station's local frame, left of travel is local −z.
- **The Overpass API is often busy** (429/502/504); the fetch scripts retry with backoff.
- **Train control is an immediate simulation hold**, not braking/signalling. Use `stateAt(train, time, trainControls)` for every position/status consumer; `nextArrivals` also accepts controls. Camera follow must use the same offsets.
- **Use `groundVisible` for underground visibility**, not a second ground flag. Auto reports must match the current followed train. Keep follow command keys monotonic after “Stop following”.
- **City GeoJSON is 12.3 MB** raw (1.45 MB gzipped). Serve it compressed.

---

## 7. Data facts worth knowing

- OSM snapshot `2026-10-31T12:28Z`; city snapshot `2026-11-04`.
- 9 lines, 12 routes, 244 stations (26 interchanges), 312 segments, 12 under-construction ways. Station counts per line match Wikipedia.
- Line colours come from Wikidata (`official: false`; DMRC publishes no HEX codes). The Airport Express uses OSM's `#FF8C00`.
- Validation: 0 errors, 2 warnings (Magenta −5.5% and Grey −6.4% length against Wikipedia), 4 station-type conflicts documented, 1 unknown type (Rohini East).
- Scope: DMRC's 9 lines only. Rapid Metro Gurugram, Noida Aqua Line and Namo Bharat appear in the UI as **names only** ("work in progress"), by design.

---

## 8. Open items

| Item | Status |
|---|---|
| **Frame rate on real hardware** | Never measured (only software rendering). More important now: structures ≈ 522k triangles, city ≈ 473k, up to 40k sleepers. Ask the owner to try `?view=3d`, follow a train and zoom in |
| **Human imagery review** | The owner's check of the 2D map against satellite imagery, `docs/phase4-leaflet-map.md` §5, is pending |
| Route times are nominal | Same hop-average speed (45 km/h) on every line, flat 5-minute change; static route estimates exclude operator holds. Station next-arrival predictions do account for holds |
| Operational realism | Immediate simulation holds; no collision avoidance, signals, route interlocking or real dispatch. Station motion and dimensions are nominal |
| Station design is generic | Side platforms and one roof type everywhere; not checked per station. Straight stations sit on curved track |
| Interchange station boxes overlap | One station per line's platform |
| City coverage | Building density follows OSM mapping, sparse in places |
| README | Still the Vite template |

---

## 9. Next: Phase 10, journey-planner enhancements (proposed, not started)

The owner chose train control and underground visibility for Phase 9 (decisions #59–#65). The former journey-planner proposal from `docs/phase8-remaining-ui.md` §10 is still available for a later phase. Confirm the next scope with the owner first:

1. From/To fields with station search (reuse `StationSearch` matching in `ui/TopBar.tsx`) and swap. The route card (`ui/RoutePanel.tsx`) already shows legs, changes and the estimate.
2. Per-line speeds **only where a source exists** (e.g. the Airport Express), logged in DECISIONS with the source; everything else stays nominal and labelled.
3. Change times that are sourced or clearly marked nominal.
4. Alternatives: fastest vs fewest changes (the planner is `src/utils/routePlanner.ts`; its tests in `routePlanner.test.ts` show the expected shape).
5. Trains to catch, from the simulated service (`trainSim.nextArrivals`), labelled simulated.

The graph already routes all 59,292 station pairs in about 0.05 ms each. That benchmark is from Phase 8. End the next phase with `docs/phase10-<topic>.md` and stop for approval.

---

## 10. Where to look

| Question | File |
|---|---|
| What the app must do | `docs/REQUIREMENTS.md` |
| Structure, schema, pipeline, projection, roadmap | `docs/ARCHITECTURE.md` |
| Why something is the way it is | `docs/DECISIONS.md` (#1–#65) |
| What exists in code right now, with figures | `docs/CODE_SUMMARY.md` |
| A phase's full story | `docs/phase1-…` to `docs/phase9-train-control.md` |
| Third-party models and rejected candidates | `docs/ASSETS.md` |
| Data quality issues | `data/metadata/data_quality_report.json`, `validation_report.json` |
