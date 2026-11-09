# Code Summary

What exists in the code right now. Update this with every change.

**Last updated:** 2026-11-09 · **Phase:** 8 done (work-in-progress entries, train follow, 2D/3D view handoff, route highlighting; realistic track and stations after review), waiting for approval. Phase 4's human imagery review is still pending

## Data pipeline

| Path | What it does |
|---|---|
| `scripts/fetch-osm.ts` | Downloads the Overpass snapshot → `data/raw/osm/<date>.json` (retries on 429/5xx) |
| `scripts/fetch-wikipedia.ts` | Downloads station tables and infobox figures (stations, length) for the 9 line articles → `data/raw/wikipedia/<date>.json` |
| `scripts/build-dataset.ts` | Latest raw snapshots + `data/manual/` → `data/processed/*.geojson`, `data/metadata/{sources,data_quality_report}.json`. Exits 1 on errors |
| `scripts/validate.ts` | 22 independent checks on `data/processed/` → `data/metadata/validation_report.json`. Exits 1 on errors |
| `scripts/validate.test.ts` | 10 tests: the real data passes, and 8 kinds of corruption are caught, plus loop projection |
| `data/manual/lines.json` | 9 lines: Wikidata colours, OSM route_master, canonical/reverse relation per branch, Wikipedia article |
| `data/manual/interchanges.json` | Proximity threshold (250 m); `merge`/`separate` lists (empty) |
| `data/manual/station_overrides.json` | Per-station name/platform type corrections (empty) |
| `src/data/types.ts` | GeoJSON schema types shared by the scripts and the app |

Commands: `npm run data:fetch`, `npm run data:build` (build + validate), `npm run data:validate`, `npm test`.

**Validation (latest):** PASSED: 0 errors, 2 warnings (Magenta −5.5% and Grey −6.4% length vs Wikipedia), 22 info. Network is 1 connected component; all 9 station counts match Wikipedia.

## Dataset (OSM snapshot 2026-10-31T12:28Z)

| Output | Count |
|---|---|
| Lines / routes (branches) | 9 / 12 |
| Stations | 244 (233 match Wikipedia on type) |
| Interchanges | 26 (23 by shared ref, 3 by proximity) |
| Segments | 312, joined end to end with no gaps |
| Under-construction ways | 12 |
| Station types | 176 elevated, 57 underground, 2 at-grade, 8 mixed, 1 unknown |

Stations per line match Wikipedia: Red 29, Yellow 37, Blue 57, Green 24, Violet 34, Pink 46, Magenta 33, Grey 4, Airport Express 7.

**Open quality items** (see `data/metadata/data_quality_report.json`):

- 0 errors.
- 4 type conflicts:
  - Shahdara and Seelampur (Red): OSM says elevated, Wikipedia says at-grade. OSM was kept.
  - Adarsh Nagar (Yellow) and Tis Hazari (Red): OSM track is untagged, so Wikipedia's "elevated" was used.
- 9 stations not found in Wikipedia: Badarpur, GTB Nagar, IIT Delhi, Jama Masjid, North Pitampura - Prashant Vihar, Rajendra Nagar, Punjabi Bagh, Rohini East, Rohini West.
- 1 unknown type: Rohini East (OSM `tunnel=building_passage`).
- 25 stations have no DMRC code in OSM, so they use `stn_osm_*` IDs.

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
| `src/utils/trainSim.ts` | `buildService(routes)`: deterministic simulated service (218 trains), `stateAt`, `nextArrivals` |
| `src/utils/routePlanner.ts` | `buildRoutePlanner(routes, segments).plan(from, to)`: fastest estimated journey on a (station, route) graph; legs with stations, segment ids and km spans; nominal 5-min change (`TRANSFER_S`) |
| `src/utils/projection.ts`, `src/utils/trackProfile.ts` | Web Mercator → metres; 2D zoom ↔ metres per pixel ↔ 3D camera distance; nominal height profile with ramps |
| `src/constants/map.ts`, `src/constants/scene.ts` | 2D styles, `WORK_IN_PROGRESS_SYSTEMS` (names only); 3D palette (matched to ref_image.png), true vertical scale, `STRUCTURE`, `TRAIN`, `SHADOW` |
| `src/components/map2d/` | `MetroMap` (view handoff, focus/fit commands, URL hash), `SegmentLayer`, `StationLayer` (click → station panel; both dim off-route), `RouteLayer`, `ValidationLayer`, `ConstructionLayer` |
| `src/components/scene3d/` | `MetroScene` (shadows, flat look, hub start view, LOD, underground surface lines), `SceneRig` (`CameraRig` fly-to/fit/zoom/views, train follow, view handoff; `Sun`, `StationLabels`), `RouteOverlay`, `City` + `buildCity.ts`, `Structures` + `buildStructures.ts` (concrete viaduct, piers with caps, parapets, plinths and rails, ballast; stations with side platforms, glazed roof on columns, concourse; clickable), `Trains` (Kenney cars, stripe per line, clickable labels to follow, far dots), `geometry.ts`, `TrackLines`, `StationPoints` |
| `src/components/ui/` | `TopBar` (search incl. work-in-progress systems, `ViewToggle`, speed, LIVE clock), `KpiCards`, `RoutePanel`, `ControlPanel` (incl. "Other systems"), `StationPanel` (route from/to buttons), `BottomDock` (Trains: follow in 3D / Stations / `ValidationList`), `SceneControls`, `FollowCard` |
| `public/models/kenney/` | CC0 Kenney subway cars and trees (docs/ASSETS.md) |
| Tests | 39: validator (10), projection + profile + view scale (7), structures (8), network geometry (4), city (1), train simulation (4), route planner (5) |

Build: 2D bundle 432 KB JS (131 KB gzip); 3D chunk 1.07 MB (287 KB gzip), loaded only when the 3D view opens. Network and city data are fetched at runtime.

3D scene: city ≈ 473k triangles in 107 chunks; structures ≈ 522k (8,429 piers, 6,595 station parts; rails, plinths and parapets ≈ 150k of it, drawn close up only); trains drawn as models within 5 km of the view (≈ 1.5k triangles per car), as dots further away.

## Dependencies

| Installed | Planned |
|---|---|
| react 19, react-dom 19, tailwindcss 4, @turf/turf 7.4, leaflet 1.9.4, react-leaflet 5, zustand 5, three 0.187, @react-three/fiber 9.8, @react-three/drei 10.7; dev: @types/geojson, @types/leaflet, @types/three, vite 8, typescript 7, oxlint | — |
