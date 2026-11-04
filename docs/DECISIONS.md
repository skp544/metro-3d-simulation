# Decision Log

Newest first. Each entry: date, decision, reason.

## 2026-11-04: Phase 5 (3D foundations)

| # | Topic | Decision | Reason |
|---|---|---|---|
| 28 | Projection (revises #8) | Web Mercator scaled by cos φ₀ (≈ metres), origin = centre of the network's bounding box, instead of an equirectangular plane centred on Rajiv Chowk | Same projection as Leaflet, so the 3D shape matches the 2D map exactly and Web Mercator map tiles can later be laid on the ground without warping. The origin comes from the data with no magic station ID. Scale error ≤ 0.5% (tested) |
| 29 | Heights | Nominal levels (+12 / 0 / −15 m), 400 m half-ramps at type changes, unknown interpolated, drawn ×4 vertically; labelled "nominal" in the view | No per-station height data exists (Phase 1 §5.3); exaggeration keeps levels readable |
| 30 | Track rendering for Phase 5 | Screen-space fat lines (constant pixel width), underground dashed; ground translucent | Readable at every zoom; Phase 6 replaces them with real viaduct and tunnel geometry |
| 31 | Loading | The 3D view is lazy-loaded; Three.js is its own chunk | The 2D map's bundle stays at ~120 KB gzip |
| 32 | View toggle | A minimal 2D/3D switch (`?view=3d`) added now; the full UI work stays in Phase 8 | The 3D view needs an entry point to be reviewed |
| 33 | 2D-only layers | The under-construction and validation layers are hidden from the panel in 3D (code `shortcut:` comment) | Not drawn in 3D yet |

## 2026-10-31: Phase 4 (Leaflet 2D map)

| # | Topic | Decision | Reason |
|---|---|---|---|
| 23 | Untagged track inference | An untagged OSM stretch takes its neighbours' type only if both neighbours share an explicit elevated/underground type **and** every station inside agrees on Wikipedia (or none inside and < 300 m). Marked `inferred:neighbours`, still `estimated`. Refines #11 | Imagery showed Tis Hazari and Adarsh Nagar on viaducts with untagged station track; the strict conditions leave real at-grade sections and ramps alone |
| 24 | Base layers | OpenStreetMap (default, per the brief), CARTO Light, Esri Satellite (review only) | Satellite is needed for the review; check the tile terms before public deployment |
| 25 | URL state | `#zoom/lat/lng` and `?base=` in the URL | Review spots can be shared and reopened; enables automated screenshots |
| 26 | Data delivery | Vite `?url` imports from `data/`, fetched at runtime | One copy of the data; keeps ~550 KB of GeoJSON out of the JS bundle |
| 27 | State | zustand store (`src/store/useMapStore.ts`) for filters, layers and focus | The same filters will drive the 3D view |

## 2026-10-31: Phase 3 (validation)

| # | Topic | Decision | Reason |
|---|---|---|---|
| 18 | Independence | `validate.ts` shares no code with `build-dataset.ts` and re-derives positions from geometry | A build bug can't validate itself; this caught the segment-slicing bug |
| 19 | Always validate | `npm run data:build` = build + validate; any error fails the command | Bad data never reaches the app silently |
| 20 | Reference figures | Wikipedia infobox "Stations" / "Line length" (captured with the revision ID) are warning-level references, ±5% on length | The only cited second source for totals; length conventions differ (§4.2 of the Phase 3 doc) |
| 21 | Interchange tolerance | Interchange station points may be up to 300 m from a line (others 150 m); every platform must be within 30 m of its track | An interchange point averages stations joined by walkways |
| 22 | Accepted warnings | Magenta (−5.5%) and Grey (−6.4%) length differences accepted as measurement convention | All station counts match and the geometry checks pass |

## 2026-10-31: Phase 2 (dataset build)

| # | Topic | Decision | Reason |
|---|---|---|---|
| 10 | Source precedence for track type | An explicit OSM `bridge`/`tunnel`/`layer` tag outranks Wikipedia. An untagged OSM way gives way to Wikipedia. Every disagreement is logged in `conflicts[]` | Explicit tags are surveyed from imagery; "no tag" is often just missing data |
| 11 | Untagged track | Treated as at-grade (the OSM convention) but marked `estimated: true` | Not inventing a type, and staying honest about how weak the evidence is |
| 12 | Station type for interchanges | Each platform gets its own `trackType`; `stationType` = `mixed` when they differ | Kashmere Gate, Janakpuri West and others really do span levels; 3D needs the per-platform level |
| 13 | Interchange detection | Shared OSM `ref`, plus automatic merge of stations on different lines within 250 m (Kirti Nagar, New Delhi, Madhuban Chowk) | Exact name matching only finds 13; OSM gives these 3 stations different refs |
| 14 | Under construction | Kept as raw OSM construction ways in `metro_under_construction.geojson` with `lineId: null` | OSM doesn't record which line they belong to; assigning one would be a guess |
| 15 | Manual config | `data/manual/lines.json` (colours and canonical OSM relation per branch) replaces the planned `line_colors.json` | One file for line config |
| 16 | Schema types | `src/data/types.ts` is the single source of truth, imported by both the scripts and the app | Keeps the pipeline and the frontend in sync |
| 17 | Scripts runtime | Plain `node scripts/*.ts` (Node 24 type stripping), no build step; `@turf/turf` is the only new runtime dependency | Smallest toolchain |

## 2026-10-31: Phase 1 decisions

| # | Topic | Decision | Reason |
|---|---|---|---|
| 1 | Scope | DMRC's 9 lines only. Rapid Metro Gurugram, Noida Aqua Line and Namo Bharat/RapidX are excluded from the data and shown in the UI as "work in progress" | Keep to one operator first |
| 2 | Line colours | Wikidata palette. Airport Express uses `#FF8C00` (OSM), because Wikidata has no value. Every colour is marked `official: false` | DMRC publishes no HEX codes; Wikidata is closer to DMRC signage than OSM |
| 3 | Phase 4 | Separate "under construction" layer, off by default. Geometry only where OSM has it (the Magenta extension) | No reliable geometry for the other corridors |
| 4 | Attribution / licence | Show "© OpenStreetMap contributors (ODbL)". Processed GeoJSON derived from OSM is ODbL if published | ODbL share-alike |
| 5 | Blue Line | One line, `blue`, with two branches: Dwarka Sector 21 ↔ Noida Electronic City, and Yamuna Bank ↔ Vaishali (via Anand Vihar ISBT) | Matches DMRC and the OSM `route_master` |
| 6 | Primary data source | OSM route relations (dated snapshot) for geometry, stops and track type. Wikipedia and Wikidata for cross-checking. DMRC site for manual verification only | Only OSM is open, complete and track-accurate (see the Phase 1 doc §4) |
| 7 | 3D infrastructure | Viaducts, pillars, tunnels and platforms generated in code from the geometry; one custom low-poly train GLB | No suitably licensed Delhi Metro assets exist, and pre-made models can't follow the real alignment |
| 8 | Projection | Local tangent plane in metres, centred on Rajiv Chowk | Under 0.1% distortion across the network; no proj4 dependency |
| 9 | Folder layout | Use the existing `src/` folders (components, constants, data, pages, store, utils) instead of the layout proposed in the Phase 1 doc | The user created them |
