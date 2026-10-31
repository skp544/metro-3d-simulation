# Decision Log

Newest first. Each entry: date, decision, reason.

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
