# Requirements

Source: the project brief (`text.txt`), narrowed by the decisions in `DECISIONS.md`.

## Scope

- **In:** Noida Metro Aqua Line, Delhi–Meerut Namo Bharat RRTS, Meerut Metro, and DMRC operational lines: Red, Yellow, Blue (main branch + Vaishali branch), Green (main + Kirti Nagar branch), Violet, Pink, Magenta, Grey, Airport Express.
- **Under construction:** Phase 4 corridors, in a separate layer that is off by default. Geometry is drawn only where a verified source exists.
- **Work in progress (UI listing only, no data):** Rapid Metro Gurugram.

## Data

| ID | Requirement |
|---|---|
| D1 | Every station has a real coordinate, line membership, station type (`elevated`/`underground`/`at_grade`/`unknown`) and interchange status |
| D2 | Line geometry follows the real track alignment (OSM), not straight lines between stations |
| D3 | Track segments carry a track type; it changes along a line where the infrastructure changes |
| D4 | Line colours: Wikidata palette, each value stored with its source |
| D5 | Source, licence and snapshot date recorded for every dataset (`data/metadata/sources.json`) |
| D6 | Unverifiable values are `unknown` and appear in the quality report, never guessed |

## Validation

| ID | Requirement |
|---|---|
| V1 | An automated script checks: GeoJSON validity, missing coordinates, duplicate IDs, inconsistent names, missing geometry, disconnected segments, station order, interchange consistency |
| V2 | It produces `validation_report.json` with errors, warnings and statistics |
| V3 | 3D work starts only when there are 0 errors and the warnings are documented |

## 2D map (Leaflet)

| ID | Requirement |
|---|---|
| M1 | OSM base map with "© OpenStreetMap contributors" attribution |
| M2 | Lines in their colours; track type shown by line style |
| M3 | Station markers; name on hover; details popup on click |
| M4 | Interchanges visually distinct |
| M5 | Layer control per line, plus filters by station type and line |
| M6 | Validation overlay showing each issue at its location |

## 3D view (Three.js)

| ID | Requirement |
|---|---|
| T1 | Coordinates projected to local metres (never raw lat/lng) |
| T2 | Elevated track on a viaduct with pillars; underground track in tunnels below a ground plane; at-grade track on the ground |
| T3 | Stations modelled by type; interchanges handle multiple lines; platforms aligned to their track |
| T4 | Trains (GLB) move along their line, facing the direction of travel, with adjustable speed and many trains at once |
| T5 | Orbit, zoom and rotate camera, with a reset button |
| T6 | Runs smoothly in a browser (instancing, low-poly assets, compressed GLB) |

## UI

| ID | Requirement |
|---|---|
| U1 | 2D/3D toggle with shared selection and filters |
| U2 | Station search and station info panel |
| U3 | Line, station and track-type visibility controls |
| U4 | Train animation controls (play/pause, speed) |
| U5 | Route highlighting between two selected stations |
| U6 | "Work in progress" entries for out-of-scope systems |

**Visual style** (`ref_image.png`): light theme; low-poly isometric 3D scene with soft shading; white rounded floating cards (KPI tiles, a collapsible list on the left, a detail panel on the right, a tabbed table at the bottom); a top bar with search, speed controls (×1/×2/×4/×8) and a live status pill; floating labels on moving vehicles; vertical map controls (zoom, rotate, reset).

## Future

Regional pedestrian transfers use explicit sourced connections, separate station identities and nominal walking times.

Journey planner: pick source and destination, compute the route, then show the interchanges, number of stops and distance.
