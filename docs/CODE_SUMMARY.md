# Code Summary

What exists in the code right now. Update this with every change.

**Last updated:** 2026-10-31 · **Phase:** 3 done (validation passed), 4 not started

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
| `src/main.tsx` | Mounts `<App />` in StrictMode |
| `src/App.tsx` | Placeholder: `<div>App</div>` |
| `src/components/`, `constants/`, `pages/`, `store/`, `utils/` | Empty |

## Dependencies

| Installed | Planned |
|---|---|
| react 19, react-dom 19, tailwindcss 4, @turf/turf 7.4; dev: @types/geojson, vite 8, typescript 7, oxlint | leaflet, react-leaflet, three, @react-three/fiber, @react-three/drei, zustand |
