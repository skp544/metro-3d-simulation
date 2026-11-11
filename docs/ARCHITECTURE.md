# Architecture

Living document. Research behind these choices: `phase1-research-and-plan.md`. Decisions: `DECISIONS.md`.

## Overview

```text
OSM (Overpass / Geofabrik) ─┐
Wikipedia / Wikidata ───────┼─► data/raw/ ─► scripts/build-dataset.ts ─► data/processed/*.geojson ─► scripts/validate.ts ─► validation_report.json
data/manual/ (overrides) ───┘                                                │
                                                                             ▼ (copied to public/data/ at build)
                                                          src/data loaders ─► zustand store ─► Leaflet 2D │ Three.js 3D
```

The data pipeline runs offline in Node. The app is static and only reads processed GeoJSON.

## Folder structure

```text
metro-route/
├── data/
│   ├── raw/osm/                  # dated Overpass JSON snapshots; never edited
│   ├── raw/wikipedia/            # scraped station layout tables
│   ├── manual/                   # lines.json (colours, OSM relation per branch), interchanges.json, station_overrides.json
│   ├── processed/                # GENERATED: metro_lines, metro_stations, metro_routes, metro_segments, interchange_stations, metro_under_construction (.geojson)
│   └── metadata/                 # sources.json, data_quality_report.json, validation_report.json
├── scripts/
│   ├── fetch-osm.ts              # writes data/raw/osm/<date>.json
│   ├── fetch-wikipedia.ts        # writes data/raw/wikipedia/<date>.json (station tables, for cross-checking)
│   ├── build-dataset.ts          # raw + manual → processed + metadata
│   ├── validate.ts               # processed → validation_report.json; exit 1 on errors
│   └── validate.test.ts          # node --test: real data passes, corruptions are caught
├── public/
│   ├── data/                     # processed GeoJSON served to the app
│   └── models/                   # train.glb
└── src/
    ├── components/
    │   ├── map2d/                # Leaflet: MetroMap, LineLayer, StationMarkers, ValidationOverlay
    │   ├── scene3d/              # R3F: Scene, Track, Viaduct, Tunnel, Station, Train, CameraRig
    │   └── ui/                   # panels, search, filters, toggles (Tailwind)
    ├── constants/                # non-geographic constants only: nominal heights/depths, pillar spacing, UI config
    ├── data/                     # GeoJSON loaders + TypeScript types for the schema
    ├── pages/                    # top-level views
    ├── store/                    # zustand: mode (2d|3d), selection, filters, train playback
    └── utils/                    # projection.ts, geometry helpers
```

**Rule:** no coordinates, station lists or colours in `src/`. These come from `public/data/`. `src/constants/` holds only rendering constants.

## Data schema

All files are GeoJSON FeatureCollections in WGS84, with coordinates in `[lng, lat]` order and 6 decimal places (about 0.1 m). They are written one feature per line, so diffs stay readable. **The TypeScript types in `src/data/types.ts` are the source of truth for this schema.**

| File | Geometry | Key properties |
|---|---|---|
| `metro_lines.geojson` | MultiLineString (one part per branch) | `id`, `name`, `color`, `colorSource`, `colorOfficial`, `status`, `branches[{id, stationIds[]}]` |
| `metro_routes.geojson` | LineString per branch (full track, including tail tracks) | `id` (e.g. `blue_vaishali`), `lineId`, `stationIds[]` (travel order), `stopKm[]`, `lengthKm` (first to last stop), `geometryLengthKm` |
| `metro_segments.geojson` | LineString between consecutive stops, split further where the track type changes | `id`, `lineId`, `routeId`, `fromStationId`, `toStationId`, `trackType`, `trackTypeSource`, `lengthKm` |
| `metro_stations.geojson` | Point (mean of the per-line OSM station objects) | `id`, `name`, `name_hi`, `aliases[]`, `refs[]`, `lines[]`, `isInterchange`, `stationType`, `platforms[{lineId, coordinates, trackType, trackTypeSource, wikipediaName, wikipediaLayout}]`, `status` |
| `interchange_stations.geojson` | Point | `stationId`, `name`, `lines[]`, `evidence` (`osm-ref` / `proximity` / `manual`) |
| `metro_under_construction.geojson` | LineString per OSM construction way | `id`, `name`, `lineId` (null; OSM doesn't say which line), `lengthKm` |

Every feature except interchanges also has: `source[]` (e.g. `osm:node/123`, `wikipedia:<article>@<revision>`), `verified`, `estimated`, `conflicts[]`.

- **Stations:** `verified` = every platform matched a Wikipedia row that agrees on the type.
- **Segments:** `verified` is always false (single source). `estimated` = the track type comes from an untagged OSM way.

**IDs.** Line IDs: `red yellow blue green violet pink magenta grey airport_express`. Route (branch) IDs: `blue_main`, `blue_vaishali`, `green_main`, `green_kirti_nagar`, `magenta_main`, `magenta_majlis_park`, and `<line>_main` for the rest. Station ID: `stn_<ref>` from the OSM `ref` station code (e.g. `stn_kg`). Without a ref it is `stn_osm_<n|w><id>`. When stations merge, a ref-based ID wins. These IDs change if OSM later adds a ref.

`trackType`: `elevated | underground | at_grade | unknown`. `stationType` adds `mixed` for interchanges whose platforms differ (e.g. Kashmere Gate: Red elevated, Yellow/Violet underground). Each platform's own `trackType` is what 3D uses.

**Loop lines.** Pink's `stationIds` lists Maujpur-Babarpur twice (the line passes it twice). Validation must allow this.

## Data pipeline (Phase 2)

Run with `npm run data:fetch` (network) and then `npm run data:build` (offline, deterministic). The build exits 1 on errors.

1. **Fetch:** Overpass returns the `route_master`/`route` relations with `network="Delhi Metro"`, their ways (with geometry) and stop nodes, the stops' `stop_area` relations, `railway=station` objects, and `railway=construction` subway ways. Saved to `data/raw/osm/YYYY-MM-DD.json`. Wikipedia station tables are saved to `data/raw/wikipedia/YYYY-MM-DD.json`. Both fetches retry with backoff.
2. **Track:** for each branch, chain the canonical-direction relation's ways in order (orienting each way to connect). A break in the chain is a `CHAIN_GAP` error.
3. **Stops:** snap each stop onto the track, searching forward from the previous stop (needed for the Pink loop). The stop must be within 50 m of the track and after the previous one. The opposite-direction relation must have the reverse stop sequence.
4. **Stations:** stop → its `stop_area` → station object, falling back to a same-name station object within 400 m. In OSM each line has its own station object; objects sharing a `ref` are one physical station.
5. **Interchanges:** stations on different lines within 250 m are merged automatically (logged as `PROXIMITY_MERGE`). `interchanges.json` can add merges or block them.
6. **Segments:** cut at every stop and at every change of track type. Way tags map as follows:
   - `tunnel` or negative `layer` → underground
   - `bridge` or positive `layer` → elevated
   - `cutting` / `embankment` / `covered` → at-grade
   - no tags → at-grade, marked estimated
   - `tunnel=building_passage` → unknown
7. **Station type:** the type of the track at each platform's stop, cross-checked against Wikipedia (matching tolerates spelling drift). An explicit OSM tag outranks Wikipedia (logged as a conflict); an untagged OSM way gives way to Wikipedia. `station_overrides.json` is applied last.
8. **Metadata:** `sources.json` (snapshot timestamps, Wikipedia revision IDs, licences) and `data_quality_report.json` (counts, km by type per line, every issue with its OSM IDs).

## Validation (Phase 3)

`scripts/validate.ts` re-checks `data/processed/` **independently of the build** (it shares no code with it) and writes `data/metadata/validation_report.json`. It exits 1 on any error. `npm run data:build` always runs it after the build. `scripts/validate.test.ts` feeds it corrupted copies of the data to prove each check fires.

| Severity | Checks |
|---|---|
| **Error** (blocks the next phase) | GEOJSON_INVALID, SCHEMA, OUT_OF_BOUNDS (NCR box 28.2–28.9 N, 76.7–77.6 E), DUPLICATE_ID, MISSING_GEOMETRY, BROKEN_REFERENCE, SEGMENT_GAP (> 1 m), LENGTH_INCONSISTENT, STATION_ORDER, INTERCHANGE_MISMATCH, NETWORK_DISCONNECTED |
| **Warning** (document or fix) | DEGENERATE_GEOMETRY, STOP_KM_DRIFT (> 100 m), STATION_FAR_FROM_LINE (> 150 m; 300 m for interchanges), PLATFORM_FAR_FROM_TRACK (> 30 m), DUPLICATE_NAME, NEARBY_STATIONS (< 300 m), REFERENCE_COUNT and REFERENCE_LENGTH (> ±5%) against the Wikipedia infobox |
| **Info** | SOURCE_CONFLICT, UNVERIFIED_STATION, CORRIDOR_OVERLAP |

Report shape: `{ passed, summary{errors, warnings, info}, checks[{code, severity, description, issues, status}], stats, references[], issues[{severity, code, message, featureIds, location}] }`. The Leaflet validation overlay draws `issues[].location` on the map.

Station order is checked by projecting each platform onto its route, scanning forward from the previous station and taking the first stretch within 60 m. That way the Pink loop's second pass through Maujpur-Babarpur is matched correctly.

## 2D map (Phase 4)

`MapPage` loads the network once (`loadNetwork`) and renders `MetroMap` with two floating cards (`ControlPanel` on the left, `ValidationPanel` bottom right). The map has stacked panes:
- `construction` (390)
- `track` (400): segments, sorted underground → elevated
- `stations` (450): interchanges on top
- `validation` (460)

All layers read filters from `useMapStore`. The canvas renderer is used throughout. The start view is the URL hash if present, otherwise a fit to the network's bounds (offset 300 px for the desktop panel). Styling lives in `src/constants/map.ts` (`TRACK_STYLE`); no geographic constants live in `src/`.

## Projection (3D)

`src/utils/projection.ts` is the only way geographic data enters the scene (revised in DECISIONS #28):

- **Projection:** Web Mercator, the same projection as the Leaflet map, so the 3D network has exactly the 2D shape. It is scaled by cos φ₀, so one unit ≈ 1 m near the origin.
- **Formula:** `x = (X_merc − X₀)·cos φ₀`, `z = −(Y_merc − Y₀)·cos φ₀`. Axes: x = east, y = up, z = south.
- **Origin:** the centre of the lines' bounding box, read from the data.
- **Accuracy:** the scale error is ≤ 0.5% across the network (tested; about 0.3% at the edges), and points round-trip to < 1 mm.

Heights (`src/constants/scene.ts`, `src/utils/trackProfile.ts`) are **nominal**: elevated +12 m, at-grade 0, underground −15 m, with no per-station data. Each run of one type holds its level; within 400 m of a type change the track ramps linearly (800 m total, about 3.4% between underground and elevated). A run shorter than 800 m (e.g. an at-grade portal) collapses to its midpoint, so the track passes through ground level. `unknown` runs are interpolated from their neighbours. Heights are drawn ×4 (`VERTICAL_EXAGGERATION`), and the 3D view states "heights nominal".

## 3D scene (Phase 5)

`MetroScene` (lazy-loaded, so Three.js is a separate ~256 KB gzip chunk) builds everything once with `buildScene3D(network)` (`src/components/scene3d/geometry.ts`):

- **Per route:** segments are grouped into same-type runs, the height profile is applied, and the result is a 3D polyline per run.
- **Per station:** one point per platform, at the track height at that stop, plus an interchange marker.

The scene has:
- **Ground:** a translucent plane (underground track shows through it) plus a 1 km grid.
- **Track:** screen-space fat lines (drei `Line`). Underground runs are dashed, as in 2D.
- **Stations:** screen-size point markers.
- **Camera:** `MapControls`.

Filters come from the same `useMapStore` as 2D. URL parameters:
- `?view=3d` opens the 3D view.
- `?cam=top` looks straight down, for comparison with the 2D map.
- `?at=lat,lng,distance` aims the camera at a place.

**Phase 6 structures** are built by `buildStructures(scene, colors, filters)` (`src/components/scene3d/buildStructures.ts`, pure, with all sizes from `STRUCTURE` in `src/constants/scene.ts`). They are rebuilt only when the filters change, and drawn by `<Structures>` in about 7 draw calls: one merged mesh each for the deck, tunnel and ribbon (vertex colours), and instanced pillars and station boxes. Structures follow the **height** of the track, not its type label, so viaducts continue down the ramps. Lighting is a hemisphere plus a directional light. The depth buffer is logarithmic, because geometry 1 m apart must not flicker at 1 m–400 km.

## 3D rendering

| Element | Approach | Status |
|---|---|---|
| Track | **Far:** screen-space lines in the line colour (Phase 5). **Near:** two tracks 4 m apart, each a concrete plinth with two rails (`offsetPath` + `extrudeRect`), on gravel ballast where at grade. The switch happens at 3 m per pixel, with hysteresis (`LodWatcher`) | ✅ Phase 6, realistic in Phase 8 (DECISIONS #57) |
| Viaduct and piers | Deck slab (10 m) with line-coloured edge faces on a 5.6 m box girder, wherever the track is above +2 m, ramps included; parapets close up. Instanced round piers every 30 m with a pier cap turned across the track | ✅ Phase 6, realistic in Phase 8 |
| Tunnel | Translucent rectangular shell (13 m) wherever the track is below −2 m; a "Ground" toggle hides the ground plane to show it | ✅ Phase 6 |
| Stations | Per line at a stop, 180 m long, oriented along the track (`stationParts`, instanced): two side platforms with yellow edge strips, a glazed gabled roof on columns with a line-coloured fascia, a concourse box below high track. Underground: translucent slate box (X-ray). All parts clickable | ✅ Phase 6, realistic in Phase 8 |
| Trains | Kenney subway cars merged per car type, instanced per line (27 instanced meshes); stripe recoloured per line; positions from `trainSim` along the route path each frame, left-hand running; far away one dot per train | ✅ Phase 7 |
| City | Real OSM buildings, roads and green areas (`scripts/build-city.ts`), merged into 3 km chunks (`buildCity.ts`); Kenney trees instanced inside green areas | ✅ Phase 7 |
| Look | Opaque warm ground, hemisphere light plus a shadow-casting sun that follows the view target, flat (no tone mapping), true vertical scale | ✅ Phase 7 |
| Assets | Poly Haven CC0 textures at 1k; custom low-poly train under 5k triangles per car |

## Routes and the 2D/3D handoff (Phase 8)

| Part | Approach |
|---|---|
| Route planner | `src/utils/routePlanner.ts`: nodes are (station, route) pairs; ride edges join consecutive stops of a route in both directions; change edges join a station's routes. Dijkstra on estimated time (DECISIONS #53). A journey is a list of legs, each with its stations, the real segment ids (2D) and km spans along the route path (3D) |
| Highlight | 2D `RouteLayer` (own pane between track and stations) draws the legs' segments cased in white and dims the rest; 3D `RouteOverlay` slices `RoutePath3D` by the km spans and draws a cased line without depth test |
| View handoff | `viewHandoff` (in `useMapStore.ts`, not reactive state) holds centre + zoom + viewport height. The 2D map writes it on every move; the 3D `CameraRig` writes it 2–3 times a second via `metresPerPixelAtDistance` → `zoomForMetresPerPixel`. A view reads it once on mount (`metresPerPixel` → `distanceForMetresPerPixel` for 3D) |
| Train follow | `follow` in the store; `CameraRig` recomputes the train's position with `service.stateAt` + `pointAt` each frame and translates camera and target together |

## Train management and underground visibility (Phase 9)

`useMapStore.trainControls` stores `{delayS, heldAtS}` per train. `trainControl.ts` freezes its effective simulation time and accumulates delay on resume. `service.stateAt(train, time, controls)` is used by every position/status consumer; `nextArrivals(station, time, controls)` excludes held trains and honors delay. Global clock pause/speed are independent. State is session-only. `runMotion` eases station departures and arrivals while retaining existing hop durations; motion is nominal, not calibrated DMRC dynamics.

`TrainControlManager` replaces the passive train list and operates on the entire fleet independent of map filters. “Follow” reveals the line and opens 3D. `UndergroundWatcher` samples the full consist along the existing projected path and reports only depth transitions. `groundVisible` resolves Auto/Surface/Underground for the ground, city, trains, structures, labels and route overlay. Auto clears when following ends; manual modes remain selected. Car pitch samples the path grade; instancing and distance-based detail remain in place.

## Roadmap

| Phase | Deliverable | Exit criteria | Status |
|---|---|---|---|
| 1 | Research and plan | User approval | ✅ Done |
| 2 | Dataset pipeline + processed GeoJSON | All files generated from a dated snapshot | ✅ Done |
| 3 | Validation script + report | 0 errors; warnings documented | ✅ Done (0 errors, 2 warnings) |
| 4 | Leaflet 2D map | Every line reviewed against satellite imagery | ✅ Built; 4 conflict stations checked; full human review pending |
| 5 | 3D foundation (projection, ground, tracks) | 3D and 2D line up | ✅ Done |
| 6 | 3D infrastructure (viaduct, tunnel, stations) | Continuous track; acceptable FPS | ✅ Done (continuity tested; FPS not measured on a real GPU) |
| 7 | 3D look, city, trains and UI (user-expanded) | ≥ 50 trains; looks like ref_image.png | ✅ Done: 218 simulated trains; real-GPU fps not measured |
| 8 | Remaining UI: work-in-progress entries, train follow, 2D/3D view sync, route highlighting | All four work in both views where they apply | ✅ Done (40 tests after track revision); real-GPU fps still not measured |
| 9 | Train control manager, underground visibility, nominal motion (owner-selected scope) | Individual/fleet Start/Stop, consistent predictions, Auto/manual X-ray; tests and screenshots | Implemented; see `phase9-train-control.md` |
| 10 | Journey planner enhancements (proposed) | Scope to be agreed with owner | Future; do not start without approval |
