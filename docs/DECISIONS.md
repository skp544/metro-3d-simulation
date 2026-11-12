# Decision Log

Newest first. Each entry: date, decision, reason.

## 2026-11-12: Expanded city, roads and Yamuna

| # | Topic | Decision | Reason |
|---|---|---|---|
| 72 | Surroundings (user review) | Replace isolated 300 m DMRC context with captured OSM buildings within 650 m of all network stations, local streets within 800 m, and 2.3 km districts around the four landmarks. Add actual land-use polygons and continuous arterial roads across the network bounds | User's Qutb Minar screenshot showed empty space; they explicitly requested buildings and a more convincing 3D simulation |
| 73 | River and roads (user) | Render mapped water polygons including Yamuna, banks and interior islands, plus main/residential/service roads and footpaths. One processed water GeoJSON is used in both views, with a River & water toggle and source-derived names | User explicitly requested Yamuna and roads. Preserve source topology and geography; do not draw an invented constant-width river or arbitrary streets |
| 74 | Render and simulation detail | Add original procedural facade/ground/water textures, varied building/roof colours, curbs and nominal lane markings. Tagged heritage/worship/ruins and service structures avoid office-style window grids. Add illustrative left-hand cars, buses, autorickshaws and streetlights near the camera. Camera has low/oblique views and WASD/Shift movement | Improves the experience without external imagery licences or claiming live road traffic, exact facades, crowds or surveyed elevations |
| 75 | Streaming budget | Generate content-hashed 1 km city tiles. Load up to 48 nearest tiles, cache 64, retain at most 6,000 closest decorative trees, 180 vehicles and 160 lamps; overview keeps shared land/water/arterial context without loading all buildings. Preserve raw snapshots and provenance | Expanded data has 124,105 buildings; loading the entire city into the browser would defeat the visual improvement. Actual hardware frame rate still requires user review |

## 2026-11-12: Landmarks and generic station circulation implemented

| # | Topic | Decision | Reason |
|---|---|---|---|
| 69 | Landmark data and scope | Four immutable OSM way/full snapshots dated 2026-11-12 generate one shared landmark GeoJSON. India Gate and Lahori Gate use the footprint's long axis; radial model orientation is nominal. Red Fort is represented by **Lahori Gate only**, explicitly labelled. Nearest stations are computed from geometry and distances labelled straight line | Real positions and clear geographic scope; no invented walking routes or full fort reconstruction |
| 70 | Original Blender assets | Author four procedural architectural interpretations in a separate `NCR_Landmarks` collection. Preserve the original scene objects and file path. Retain Python source and a `.blend` library; export base-origin, metre-scale CC0 GLBs (46,598 triangles total). Reference images are not distributed textures; nominal details and heights are labelled | Usable original assets without paid generators or inaccessible downloads; reproducible and small enough for the existing scene |
| 71 | Station circulation | 201 isolated elevated platform frames with sufficient headroom get wider side platforms, two stair openings per side, an uninterrupted 3 m lane, open concourse floor at nominal 6 m, street stairs and lift connections. Steps, guards, rafters and furniture render within 700 m of the target, at most six stations, camera distance below 1.4 km. Local floor/flight/lift metadata prepares future people work | Functional nominal architecture with real slab openings and clear tracks. Complex/shared, mixed, low ramp and underground layouts require site plans; no people, surveyed entrances or interchange navigation are claimed |

## 2026-11-12: Next task — landmarks and station circulation

| # | Topic | Decision | Reason |
|---|---|---|---|
| 66 | First landmarks (user) | Add India Gate, Lotus Temple, Qutb Minar and Red Fort. Use suitable licensed models or create recognizable models in Blender using architectural reference images. Real coordinates/footprints and provenance remain required; approximations must be labelled | User explicitly confirmed these four places and authorized Blender modeling where suitable models are unavailable |
| 67 | Station design (user) | Improve station architecture and leave coherent circulation space for future 3D people. Preserve train clearances and geographic alignment; generic dimensions/layouts remain nominal. Adding people or crowd simulation is not part of this initial request | User requested better station design in preparation for adding people later |
| 68 | Handoff and Blender status | Prepare `docs/HANDOFF.md` for another chat. Modeling/app implementation is pending. Blender MCP is registered in Codex and a live `get_addon_status` call succeeded: Blender 5.3.0, add-on 1.8, protocol 15. Preserve the user's existing scene when work resumes | User requested a transferable handoff; the earlier missing-connection blocker is now resolved |

## 2026-11-12: Verified speed limits and current speed display

| # | Topic | Decision | Reason |
|---|---|---|---|
| 64 | Train speeds (user) | Verify and show Namo Bharat's 160 km/h operating maximum separately from its 180 km/h design speed; Airport Express operating maximum 120 km/h (DMRC Annual Report 2023–24); Meerut Metro operating maximum 120 km/h, design 135 km/h (Alstom). Keep checked date and direct source links in `trainSpeeds.ts`. Ordinary metros/Aqua use a nominal 60 km/h model cap, with published maximum left unknown | User explicitly requested internet verification and faster express trains; design speed, actual instantaneous speed and estimated model settings must not be conflated |
| 65 | Motion, UI and route estimates | Rest-to-rest acceleration/cruise/braking replaces constant 45 km/h motion. Acceleration 0.8 m/s² and braking 0.9 m/s² are nominal, with lower peak on short hops. Show current simulated km/h in the train table, 3D labels and follow card; source-backed limits also appear in station details. Planner and simulated arrivals use the same motion. Playback multiplier changes time, not the km/h value | Visible speeds must agree with actual model movement and route times, and must read zero at station dwells. No live speed feed, local speed restrictions or official timetable is claimed |

## 2026-11-12: Distinct regional train models

| # | Topic | Decision | Reason |
|---|---|---|---|
| 62 | Different rolling stock (user) | Use separate CC0 3D Assets models for streamlined Namo Bharat, metro-style Aqua and commuter-style Meerut cabs; retain Kenney subway models for DMRC. Store all five downloaded GLBs locally with source/licence manifest. Generic models and liveries are illustrative, not official replicas | The user explicitly requested assets that look different from Delhi Metro |
| 63 | Formations and rendering | RRTS six cars, Aqua four, Meerut three, based on operator/manufacturer references. Per-fleet nominal dimensions/livery and actual formation capacities replace the universal six-car layout. Merge source materials into vertex-coloured geometry; preserve pantograph height; use one instanced draw per car type and line | Distinction includes silhouette, length and livery; RRTS needs four intermediate instances per train. Service speed/timing is unchanged |

## 2026-11-12: Phase 8 regional expansion

The user requested the remaining regional systems, specifically Noida Aqua Line, Delhi–Meerut RRTS and Meerut Metro, with proper interchanges. This revises decision #1 for those three systems. Rapid Metro Gurugram remains a work-in-progress entry.

| # | Topic | Decision | Reason |
|---|---|---|---|
| 59 | Regional scope (user) | Add operational Aqua, Namo Bharat and Meerut Metro routes using actual OSM geometry and dated snapshots; preserve the existing DMRC snapshot. Include the Duhai Depot passenger branch; exclude Jangpura and Modipuram Depot from active routes | Requested regional coverage; no invented track or planned stations presented as operational |
| 60 | Proper interchanges | Operator-local station IDs are namespaced. Four NCRTC shared stations remain shared; five cross-system pedestrian links are explicit, sourced, bidirectional edges between separate stations. Show schematic dashed connectors, separate ticketing, and estimated walking time; proximity alone never merges regional stations | Sector 51/52 and DMRC/RRTS stations have separate identities. Express RRTS and local Meerut services need distinct stop patterns |
| 61 | Timing and 3D limits | Retain the existing generic six-car models and 45 km/h simulated cruise, 6-min nominal headway, 30-s dwell; walking links add nominal walk plus half-headway wait. Walking-only finishes have no train wait. Existing city geometry remains around original DMRC stations. Record seven validation warnings and pending imagery/performance review | Source-backed geography can be shipped without inventing operator timetables, surveyed walkway alignments or station-specific 3D designs |

## 2026-11-09: Phase 8 (remaining UI)

The user said "start Phase 8" (2026-11-09). The four agreed items were done in order, smallest first.

| # | Topic | Decision | Reason |
|---|---|---|---|
| 50 | "Work in progress" systems (DECISIONS #1) | Rapid Metro Gurugram, Noida Metro Aqua Line and Namo Bharat (RapidX) appear as names only: a disabled "Other systems" section in the layer panel, and a "work in progress · not on this map yet" row when a search matches them. No stations, geometry or colours | Shows the scope honestly without inventing data |
| 51 | Following a train | 3D only (the 2D map draws no trains). A train-list row or a train's 3D tag starts it; the camera flies in to 420 m and then moves with the train, while orbit and zoom keep working. It ends on a pan (target moved > 3 m off the train), Esc, "Stop", the hub/network buttons, a search or list jump, hiding the train's line, or switching to 2D. In 2D a train row still flies once to the train | Follows without taking the camera away from the user |
| 52 | Route between two stations | Picked from the station panel ("Route from here" / "Route to here"), or `?route=<fromId>,<toId>`. Highlighted on both maps (2D: cased real segments, the rest dimmed; 3D: cased line drawn over everything, From/To tags) and listed by leg in a route card; both views fit to the route | First step to the Phase 9 journey planner, on the real segments |
| 53 | Route cost (nominal) | Graph node = (station, route). Ride edges between consecutive stops, both ways, cost = run time at the simulation's 45 km/h + a 30 s dwell; a change of trains costs 5 min (2 min walk + half the 6-min headway). Changing between a line's branches (Yamuna Bank, Ashok Park Main) counts as a change. Labelled "estimated … not a DMRC timetable or fare route" | No open DMRC timetable or transfer times; reuse the simulation's nominal constants so everything agrees |
| 54 | 2D/3D view handoff | Each view reports its centre and scale (metres per pixel at the centre, written as a Leaflet zoom) through `src/utils/projection.ts`; the other view opens there. 2D → 3D keeps the reference's oblique angle; 3D → 2D rounds to the nearest whole zoom (Leaflet `zoomSnap` 1). URL start parameters (`?at`, `?cam`, the 2D hash) only apply on first load | Same place and size on screen in both views; no second camera model |
| 55 | Commands across views | A focus, fit, follow or camera command runs once, by whichever view is showing (`useCommand`). Before, remounting a view replayed the last search jump over the carried view | Needed for #54; a bug found while building it |
| 56 | Phones | The 3D "Labels" card is hidden below 640 px (it covered the left cards); the follow card sits above the train list there | Layout check at 390 × 844 |
| 57 | Realistic track and stations (user, after Phase 8 review: "metro track not looking realistic, and same as metro stations") | **Viaduct:** concrete deck slab (10 m) on a box girder, round piers with a cap across the track, parapets; the line colour only on the deck's edge faces. **Track:** two tracks 4 m apart, each a concrete plinth with two rails; gravel ballast where at grade. **Elevated stations:** two side platforms with a yellow edge strip, an open gabled roof on columns, glazed (45% opaque, like the reference's see-through roof) so trains at the platform stay visible, a line-coloured fascia, and a concourse box below where the track is high enough. Replaces the 8 m line-coloured slab and the 26 × 10 m station box. All sizes nominal, in `STRUCTURE` (DMRC publishes no per-station drawings; side platforms are typical of DMRC elevated stations but not checked per station). Underground stations unchanged (X-ray boxes) | Reads as real infrastructure; nothing about the geography changes |
| 58 | Sleepers (user pointed at a Sketchfab track model, 2026-11-09) | The model was not used (spam listing, untrustworthy licence; docs/ASSETS.md). Its look, rails on sleepers, is drawn in code instead: concrete sleepers (2.6 × 0.26 m, every 0.65 m, nominal) on a concrete track bed, or in the ballast at grade, under the rails. Sleepers are placed only within 900 m of the view target (one instanced mesh, refilled after a 200 m move, hidden when the camera is over 1.2 km away), since the whole network would need over a million | DMRC uses concrete, not timber, sleepers; a code-built track follows the real curves, which a straight model piece can't |

## 2026-11-09: Phase 7 (3D look, city, trains and UI)

The user asked for the 3D view to look like `ref_image.png`, with real 3D models found first. Their answers on 2026-11-04: **real OSM surroundings, drawn low-poly**, and **moving trains with labels plus the reference-style UI** (bringing Phase 8 work forward).

| # | Topic | Decision | Reason |
|---|---|---|---|
| 41 | City around the stations (user) | Real OSM buildings, roads and green areas within 300 m of every station, extruded low-poly. Height = OSM `height`, else `building:levels` × 3.2 m, else nominal by type ±25% (flagged `heightSource: nominal`). Trees only inside real OSM green areas | Keeps the "never invent geography" rule while matching the reference's look |
| 42 | True vertical scale (revises #29 and the vertical part of #37) | `VERTICAL_EXAGGERATION` = 1 | Real-proportioned trains, trees and buildings would look flattened next to ×4 structures |
| 43 | 3D models | Kenney **Train Kit** (subway cars) and **Nature Kit** (trees), CC0 (docs/ASSETS.md). Rejected: Sketchfab "Riyadh Metro" (3.85M faces), Sketchfab "Subway Metro Train Concept" (Standard paid licence, not downloadable, 2.1M faces); no Delhi Metro model exists on Sketchfab | Licence-clean, ~1.5k triangles per car, and matches the reference's low-poly style |
| 44 | DMRC train look | Stainless Kenney car with its stripe palette cell repainted per line; 6 cars (cab · b · c · b · c · reversed cab) scaled to 21.6 × 3.2 × 3.9 m; left-hand running | Close to real DMRC rolling stock (stainless body, line-coloured band) |
| 45 | Simulated service (user: moving trains) | Deterministic pattern: 45 km/h, 30 s dwell, 3 min at termini, a train every 6 min per direction → 218 trains, ~34 km/h average. Labelled "simulated" everywhere | No open DMRC timetable or live positions exist |
| 46 | Reference-style UI (user) | Top bar (search with `/`, 2D/3D, play/pause ×1/×2/×4/×8, LIVE IST clock), KPI cards, collapsible layer panel, right station panel with simulated next trains, bottom dock (Trains / Stations / Validation), 3D zoom/view/label controls. The 2D popup is replaced by the same station panel; the validation card moves into the dock | One consistent UI across 2D and 3D, matching ref_image.png |
| 47 | Underground in the realistic view | Opaque ground; underground routes drawn as dashed surface lines close up; "X-ray" (ground off) shows tunnels, underground boxes and trains | Opaque ground matches the reference; the brief requires underground routes to stay understandable |
| 48 | Default 3D view | ~700 m from the station with the most lines (Kashmere Gate), from the south-east; `?cam=network` for the whole network | The reference is a close-up of one hub; the hub comes from the data |
| 49 | City data size | ~12 MB of GeoJSON (≈1.5 MB gzipped), loaded only by the 3D view; service roads dropped; coordinates at 5 decimals (`shortcut:` tiling if it grows) | Acceptable on a compressed host; tiling is the upgrade path |

## 2026-11-04: Phase 6 (3D infrastructure)

| # | Topic | Decision | Reason |
|---|---|---|---|
| 34 | Level of detail | Far away (≥ 3 m/pixel): Phase 5 lines and dots. Close up: real track ribbon. Structures are always drawn | An 8 m track is under a pixel at city scale; this rule depends on the screen, not on a fixed distance |
| 35 | Structures follow height | Deck and pillars where the track is above +2 m; tunnel where it is below −2 m; both include ramps | Viaducts must continue down to the portal; type labels end abruptly |
| 36 | Short runs (revises #29) | A run shorter than a full ramp (800 m) reaches only that fraction of its level | A 48 m OSM "tunnel" between at-grade stretches (near Yamuna Bank) had produced an 8.2% grade; it is now a ~1 m underpass, and the steepest grade on the network is 3.37% |
| 37 | Nominal structure sizes | Deck 11 m, pillars 2.5 m every 30 m, tunnel 13 m, platform 180 × 26 m (all in `STRUCTURE`); vertical sizes ×4 like heights; the view says "structure sizes nominal" | No per-site data; typical twin-track metro values |
| 38 | Stations on the track | Each platform box is centred on its route path at the stop and oriented along it (first branch at a shared junction) | Track runs continuously through every station box (tested, < 1 m) |
| 39 | Draw-call budget | Merged meshes (vertex colours) and instancing: about 7 draw calls and about 151k triangles for the whole network | Mobile-friendly; filters rebuild the merged geometry, which is cheap (a few ms) |
| 40 | Testable scene code | `geometry.ts` and `buildStructures.ts` use explicit `.ts` imports and minimal input types, so Node tests run them on the real data | The exit criteria are checked automatically, not only by screenshot |

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
