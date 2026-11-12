# Code Summary

What exists in the code right now. Update this with every change.

**Last updated:** 2026-11-12 ? **Phase:** 8 including the regional expansion (Aqua, RRTS, Meerut Metro and explicit walking transfers), ready for review. Full imagery review and real-GPU frame rate remain pending. See `phase8-regional-expansion.md`.

## Data pipeline

| Path | What it does |
|---|---|
| `scripts/fetch-osm.ts` | Downloads the Overpass snapshot → `data/raw/osm/<date>.json` (retries on 429/5xx) |
| `scripts/fetch-wikipedia.ts` | Downloads station tables and infobox figures (stations, length) for the 9 line articles → `data/raw/wikipedia/<date>.json` |
| `scripts/fetch-regional.ts` | Main OSM API: eight route directions and stop areas ? immutable `data/raw/regional/<timestamp>.json`; preserves the DMRC snapshot |
| `data/manual/regional-lines.json`, `data/manual/transfers.json` | Three regional line configs, operator namespaces, references, five explicit bidirectional pedestrian connections |
| `scripts/build-dataset.ts` | Latest raw snapshots + `data/manual/` → `data/processed/*.geojson`, `data/metadata/{sources,data_quality_report}.json`. Exits 1 on errors |
| `scripts/validate.ts` | 23 independent checks on `data/processed/` → `data/metadata/validation_report.json`. Exits 1 on errors |
| `scripts/validate.test.ts` | 13 tests: baseline corruption checks plus pedestrian endpoints/timing and missing-link connectivity |
| `data/manual/lines.json` | 9 lines: Wikidata colours, OSM route_master, canonical/reverse relation per branch, Wikipedia article |
| `data/manual/interchanges.json` | Proximity threshold (250 m); `merge`/`separate` lists (empty) |
| `data/manual/station_overrides.json` | Per-station name/platform type corrections (empty) |
| `src/data/types.ts` | GeoJSON schema types shared by the scripts and the app |

Commands: `npm run data:fetch`, `npm run data:fetch-regional`, `npm run data:build` (build + validate), `npm run data:validate`, `npm test`.

**Validation (latest):** PASSED: 0 errors, 7 warnings (two accepted length differences plus five nearby-station pairs), 68 info. One connected network including walking edges. Regional counts: Aqua 21, RRTS 15 (main + Duhai Depot), Meerut Metro 12. Original nine counts still match Wikipedia.

## Dataset (DMRC OSM 2026-10-31T12:28Z; regional OSM fetched 2026-11-12T06:02Z)

| Output | Count |
|---|---|
| Lines / routes (branches) | 12 / 16 |
| Stations | 288 (233 match Wikipedia on type) |
| Interchanges | 30 shared stations (27 by shared ref, 3 by proximity), plus 5 separate-station walking links |
| Segments | 378, joined end to end with no gaps |
| Under-construction ways | 12 |
| Station types | 215 elevated, 61 underground, 3 at-grade, 8 mixed, 1 unknown |

Stations per line match Wikipedia: Red 29, Yellow 37, Blue 57, Green 24, Violet 34, Pink 46, Magenta 33, Grey 4, Airport Express 7.

**Open quality items** (see `data/metadata/data_quality_report.json`):

- 0 errors.
- 4 type conflicts:
  - Shahdara and Seelampur (Red): OSM says elevated, Wikipedia says at-grade. OSM was kept.
  - Adarsh Nagar (Yellow) and Tis Hazari (Red): OSM track is untagged, so Wikipedia's "elevated" was used.
- 57 platform comparisons have no Wikipedia match: the regional networks have no captured per-station second-source layout table; original DMRC unmatched stations: Badarpur, GTB Nagar, IIT Delhi, Jama Masjid, North Pitampura - Prashant Vihar, Rajendra Nagar, Punjabi Bagh, Rohini East, Rohini West.
- 1 unknown type: Rohini East (OSM `tunnel=building_passage`).
- 46 stations have no operator code in OSM and use namespaced OSM IDs. All regional station codes are operator-local; NCRTC shares a namespace between RRTS and Meerut Metro.

## City context (3D only)

| Path | What it does |
|---|---|
| `scripts/fetch-osm-city.ts` | Overpass: buildings, green areas and roads within 300 m of every DMRC station → `data/raw/osm-city/<date>.json` (snapshot 2026-11-04, 43,422 elements) |
| `scripts/build-city.ts` | → `data/processed/city_{buildings,roads,green,trees}.geojson` + `data/metadata/city_report.json`: 25,197 buildings (175 with an OSM height, 1,697 from storeys, 23,325 nominal), 12,832 road pieces (service roads dropped), 860 green areas, 11,781 trees inside them. 12.3 MB raw / 1.45 MB gzipped |

## App

| Path | State |
|---|---|
| `src/App.tsx` → `src/pages/MapPage.tsx` | Loads the network and builds the simulated service; top bar + 2D map or lazy 3D scene + floating cards (KPIs, route, layers, station panel, 3D controls, follow card, bottom dock) |
| `src/data/loadNetwork.ts`, `src/data/loadCity.ts` | Fetch the network GeoJSON + reports; the city GeoJSON (3D only) |
| `src/store/useMapStore.ts` | zustand: view, filters, layers (incl. X-ray ground), selected station, label mode, camera/focus/fit commands, followed train, route ends (`?route=from,to`), simulation clock (play/pause, ×1/×2/×4/×8). Also `viewHandoff` (non-reactive: last view, for the 2D/3D switch) |
| `src/store/useSimNow.ts` | `useSimNow` (simulated time for panels), `formatIst` |
| `src/store/useCommand.ts` | Runs a focus/fit/follow/camera command once, in whichever view is showing |
| `src/store/useJourney.ts` | The planned journey for the chosen route ends (one planner per network) |
| `src/utils/trainSim.ts` | `buildService(routes)`: deterministic simulated service (302 trains; generic nominal speeds/models), `stateAt`, `nextArrivals` |
| `src/utils/routePlanner.ts` | `buildRoutePlanner(routes, segments, cfg, transfers).plan(from, to)`: fastest estimated journey on a (station, route) graph; legs with stations, segment ids and km spans; nominal 5-min same-station change (`TRANSFER_S`), plus oriented walking steps with nominal walk/wait costs |
| `src/utils/projection.ts`, `src/utils/trackProfile.ts` | Web Mercator → metres; 2D zoom ↔ metres per pixel ↔ 3D camera distance; nominal height profile with ramps |
| `src/constants/map.ts`, `src/constants/scene.ts` | 2D styles, `WORK_IN_PROGRESS_SYSTEMS` (names only); 3D palette (matched to ref_image.png), true vertical scale, `STRUCTURE`, `TRAIN`, `SHADOW` |
| `src/components/map2d/` | `MetroMap` (view handoff, focus/fit commands, URL hash), `SegmentLayer`, `StationLayer` (click → station panel; both dim off-route), `RouteLayer`, `TransferLayer` (schematic dashed pedestrian links), `ValidationLayer`, `ConstructionLayer` |
| `src/components/scene3d/` | `MetroScene` (shadows, flat look, hub start view, LOD, underground surface lines), `SceneRig` (`CameraRig` fly-to/fit/zoom/views, train follow, view handoff; `Sun`, `StationLabels`), `RouteOverlay`, `TransferLinks` (schematic pedestrian overlay), `City` + `buildCity.ts`, `Structures` + `buildStructures.ts` (concrete viaduct, piers with caps, parapets, track bed, sleepers near the view, rails, ballast; stations with side platforms, glazed roof on columns, concourse; clickable), `Trains` (Kenney cars, stripe per line, clickable labels to follow, far dots), `geometry.ts`, `TrackLines`, `StationPoints` |
| `src/components/ui/` | `TopBar` (search incl. work-in-progress systems, `ViewToggle`, speed, LIVE clock), `KpiCards`, `RoutePanel`, `ControlPanel` (incl. "Other systems"), `StationPanel` (route from/to buttons), `BottomDock` (Trains: follow in 3D / Stations / `ValidationList`), `SceneControls`, `FollowCard` |
| `public/models/kenney/` | CC0 Kenney subway cars and trees (docs/ASSETS.md) |
| Tests | 47: validator (13), projection + profile + view scale (7), structures (9), network geometry (4), city (1), train simulation (4), route planner (5), regional coverage/routing (4) |

Build: 2D bundle 441 KB JS (134 KB gzip); 3D chunk 1.07 MB (289 KB gzip), loaded only when the 3D view opens. Network and city data are fetched at runtime.

3D scene: city ≈ 473k triangles in 109 chunks; structures ≈ 522k (8,429 piers, 6,595 station parts; rails, track bed and parapets ≈ 150k of it, drawn close up only; up to 40k instanced sleepers within 900 m of the view); trains drawn as models within 5 km of the view (≈ 1.5k triangles per car), as dots further away.

The new corridors reuse generic 3D models and the original 45 km/h simulated cruise; times are estimates, not operator schedules. City coverage remains around original DMRC stations. Four shared NCRTC stations connect express and local stopping patterns. The five external transfers keep station identities separate.

## Dependencies

| Installed | Planned |
|---|---|
| react 19, react-dom 19, tailwindcss 4, @turf/turf 7.4, leaflet 1.9.4, react-leaflet 5, zustand 5, three 0.187, @react-three/fiber 9.8, @react-three/drei 10.7; dev: @types/geojson, @types/leaflet, @types/three, vite 8, typescript 7, oxlint | — |
