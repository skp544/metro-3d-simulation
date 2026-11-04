# Code Summary

What exists in the code right now. Update this with every change.

**Last updated:** 2026-11-04 · **Phase:** 6 done (3D infrastructure), 7 not started. Phase 4's human imagery review is still pending

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

## App

| Path | State |
|---|---|
| `src/App.tsx` → `src/pages/MapPage.tsx` | Loads the network; renders the 2D map or the lazy-loaded 3D scene, the panels and the view toggle; loading and error states |
| `src/data/loadNetwork.ts` | Fetches the 6 GeoJSON files, the validation report and sources (Vite `?url` from `data/`) |
| `src/store/useMapStore.ts` | zustand: view (`2d`/`3d`, synced to `?view=`), hidden lines, track types and station types; layer toggles (incl. 3D ground); fly-to focus |
| `src/constants/map.ts` | Base layers, attribution, track styles, severity colours |
| `src/constants/scene.ts` | Nominal track heights, ramp length, vertical exaggeration, `STRUCTURE` sizes, LOD threshold, 3D colours |
| `src/components/map2d/` | `MetroMap` (panes, base layers, URL hash, `?base=`), `SegmentLayer`, `StationLayer` (+ popup), `ValidationLayer`, `ConstructionLayer` |
| `src/components/scene3d/` | `geometry.ts` (`buildScene3D`: type runs, continuous route paths, platforms on the track with heading), `buildStructures.ts` (pure: `extrudeRect`, `spansWhere`, `pillarMatrices`, `boxMatrix`, `buildStructures`), `Structures` (deck, pillars, tunnels, ribbon, station boxes), `MetroScene` (canvas, lights, log depth, ground toggle, LOD switch, `?cam=top`, `?at=`), `TrackLines` + `StationPoints` (far view) |
| `src/components/scene3d/*.test.ts` | `buildStructures.test.ts` (5 builder tests), `geometry.test.ts` (4 network tests: continuity and max grade, platforms on track, platform levels, structure budget) |
| `src/components/ui/` | `ControlPanel` (line, track-type, station-type and layer filters; 2D-only layers hidden in 3D), `ValidationPanel` (2D only), `ViewToggle` |
| `src/utils/projection.ts` | Web Mercator → metres from the network centre; `createProjection`, `boundsCentre` |
| `src/utils/trackProfile.ts` | `heightProfile`: nominal level per run with ramps |
| `src/utils/projection.test.ts` | 6 tests: origin, round-trip, scale ≤ 0.5%, axes, height profile, short-run underpass |

Build: 2D bundle 399 KB JS (122 KB gzip); 3D chunk 968 KB (258 KB gzip), loaded only when the 3D view opens. Data loaded at runtime as separate assets. `npm test` runs 25 tests.

3D scene: about 151k triangles; 8,487 pillars and 271 station boxes (200 above ground, 71 below), instanced; about 7 draw calls for the structures.

## Dependencies

| Installed | Planned |
|---|---|
| react 19, react-dom 19, tailwindcss 4, @turf/turf 7.4, leaflet 1.9.4, react-leaflet 5, zustand 5, three 0.187, @react-three/fiber 9.8, @react-three/drei 10.7; dev: @types/geojson, @types/leaflet, @types/three, vite 8, typescript 7, oxlint | — |
