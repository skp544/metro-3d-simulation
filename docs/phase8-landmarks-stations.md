# Phase 8 extension: landmarks and station circulation

Frozen implementation report, 2026-11-12. Decisions #66–#71. The user reviews and commits.

## Goal and result

Add four approved places near the network using real geographic data and recognisable 3D models; improve generic stations for future people. Implemented India Gate, Lotus Temple, Qutb Minar and **Red Fort's Lahori Gate only**. Both views share geographic data and picking behavior. Eligible elevated stations have open floors, stairs and lifts with train clearance preserved. People and the larger Phase 9 planner remain separate.

## Geographic outputs

Four immutable OSM `way/<id>/full.json` snapshots were captured on 2026-11-12 in `data/raw/landmarks/2026-11-12/`. The API host returned 429; `www.openstreetmap.org/api/0.6/` succeeded. The build checks Wikidata identity and closed rings, derives polygon centres and minimum-area bounding rectangles, and computes nearest stations from the existing network. Each processed feature has source, verified, estimated and conflicts fields. Features remain estimated / not verified because the architecture is approximate.

| Place / OSM way | Nearest mapped station | Straight-line distance | Model height |
|---|---|---|---|
| India Gate / [361709652](https://www.openstreetmap.org/way/361709652) | Khan Market | 1,189 m | 42 m, sourced |
| Lotus Temple / [44827278](https://www.openstreetmap.org/way/44827278) | Kalkaji Mandir | 388 m | 34 m, nominal |
| Qutb Minar / [369140381](https://www.openstreetmap.org/way/369140381) | Qutab Minar | 1,279 m | 72.5 m, sourced |
| Lahori Gate / [80429907](https://www.openstreetmap.org/way/80429907) | Lal Quila | 268 m | 33 m, nominal |

Distances are from the polygon-derived model centre to the mapped station point, not walking routes or entrance distances. Rail geography is unchanged. Custom model footprints exclude duplicate city extrusions/tree placements. City coverage remains station catchments, so India Gate and Qutb Minar have sparse surroundings. Red Fort's full complex and Lotus Temple's pools/grounds are not reconstructed.

## Blender models and references

Live Blender MCP succeeded (5.3.0 / addon 1.8 / protocol 15). Original cube/camera/light, selection and active file path were retained. Authoring uses a separate `NCR_Landmarks` collection. `bpy.data.libraries.write` writes only this collection to `assets/landmarks/landmarks.blend`; selected-only GLB exports have base origins and metre units. Source objects are spaced apart in the workshop after export.

| Model | Triangles | GLB bytes | Features |
|---|---|---|---|
| India Gate | 2,432 | 141,956 | Open vault, pilasters, cornices, attic, INDIA lettering, crown bowl |
| Lotus Temple | 20,876 | 1,451,712 | Three radial sets of nine double-curved shells, separated tips, skylight |
| Qutb Minar | 15,868 | 922,580 | Five tapering storeys, fluting, stone bands, projecting balconies and balusters |
| Lahori Gate | 7,422 | 513,296 | Open vault, red sandstone octagonal bastions, chhatris, crenellations, simplified tricolour |
| Total | 46,598 | 3,029,544 | Original CC0 geometry/materials; no photographic textures |

[Delhi Tourism's India Gate page](https://www.delhitourism.gov.in/tourist_place/india_gate.html) supports the 42 m height. [Its Qutb Minar page](https://www.delhitourism.gov.in/tourist_place/qutab_minar.html) supports 72.5 m height, 14.32 m base and 2.75 m top diameter. The Qutb GLB uses those diameters rather than stretching to the slightly different mapped outline. [Delhi Tourism](https://www.delhitourism.gov.in/tourist_place/bahai_temple.html), [ICE](https://www.ice.org.uk/what-is-civil-engineering/infrastructure-projects/lotus-temple) and the [temple's architectural booklet](https://bahaihouseofworship.in/wp-content/uploads/2024/04/architectural_blossoming_of_the_lotus.pdf) informed the petals; the booklet describes inner leaves at 34.3 m above the inner podium. The model envelope is rounded nominal 34 m; no podium survey is claimed. [District Old Delhi](https://dmolddelhi.delhi.gov.in/tourist-place/red-fort/) and facade photographs informed Lahori Gate. Fine carvings, shell curvature and unsourced proportions are simplified.

An asset search found an advertised CC Attribution Lotus model whose page/download returned 403; other listings did not yield a verified usable licensed download. No third-party monument model was imported. References, checked date and search outcomes are in `data/manual/landmark-references.json`. Images were consulted (including a temporary Wikimedia Lotus reference), but none are distributed. No paid generation was used. Source/licence inventory: `docs/ASSETS.md`.

## Generic station circulation

201 isolated elevated platform frames have sufficient headroom for the new layout. Platform outer edge expands from 8.2 to 11.8 m from the track centre; inner edge stays 3.8 m. Two 18 × 3 m stairwells per side are real slab openings. A continuous 3 m lane at across ±6.1 m sits beside the tactile strip. Supports, furniture and guards sit outside it; overhead rafters clear roof equipment.

The open concourse slab is 0.35 m thick, floor at nominal 6 m above ground. Each side has two 17 m platform stair flights (risers ≤0.18 m), street stairs, level landings, and a lift shaft with ground/concourse/platform stops. Wings join lift landings to the main concourse. Platform guards have gaps at the lift access. Benches have supports; rafters frame the transparent roof while trains remain visible.

`circulationLayout` records local floor levels, lanes, flights and lift stops for future development. It is not a complete navmesh, surveyed access plan or people simulation. Shared/mixed, underground and low-ramp access is not reconstructed; no invented shared-station pedestrian connection is added. New street access is nominal illustrative architecture, not real mapped entrances. Surrounding geography is not altered to make it fit.

Base structures total approximately **763,540 triangles**, 12,976 piers and 9,621 station part instances. Nearby detail selects at most six stations within 700 m of the target, camera distance below 1.4 km, checked every 300 ms. Six typical layouts add 2,400 box instances (28,800 triangles). Existing sleepers retain their separate LOD budget. Real-hardware frame rate remains unmeasured.

## UI, checks and visual review

Places lists all four landmarks; search supports station/landmark names and keyboard selection. Both views show scope, source/approximation labels, source links and straight-line nearest-station distance. 2D draws markers and the selected footprint; 3D has clickable models and nearby labels. `?place=<id>` opens a selected place. Existing view handoff and one-shot camera commands are retained.

`npm run data:build`, **59 tests**, lint and TypeScript/Vite build pass. Rail validation remains **0 errors / 7 warnings / 68 info**. Five added tests check snapshot provenance/centres/nearest distances, GLB scale/origin/budget, stairwell holes, lane/track clearance, stair/lift levels and shared-layout exclusion. The existing large lazy 3D chunk warning remains: about 1.082 MB / 293 KB gzip. 2D JS is about 450 KB / 137 KB gzip. Landmark GeoJSON is 10.66 KB; GLBs are fetched only in 3D.

Blender front/side/three-quarter inspection checked forms and open vaults. Browser screenshots checked all four landmarks, Tis Hazari's station close-up, 2D Lahori Gate marker/footprint and the 390 × 844 phone layout. The phone Places list fits without horizontal overflow (document width = viewport width = 390 px), and closing details leaves the model visible. Kashmere Gate's X-ray check revealed the existing underground station boxes, tunnels and simulated trains with ground hidden. Console review showed no application exceptions. Headless Chrome uses SwiftShader, not a real-GPU performance measurement. Selected screenshots are retained in `docs/review/landmarks/`.

## Reproduce and next boundary

1. `npm run data:build` uses preserved snapshots offline, builds landmarks and validates the rail dataset.
2. To regenerate models, execute `scripts/model-landmarks.py` in Blender with `__file__` set to its absolute path. It replaces only the named project collection; inspect live status/scene first. Outputs are project-owned GLBs and a source library.
3. `npm test`, `npm run lint`, `npm run build`.
4. `npm run preview -- --port 4173`; open `http://localhost:4173/?view=3d&place=india-gate`. Other IDs: `lotus-temple`, `qutb-minar`, `red-fort`. Use search/Places and switch to 2D to inspect the same position.
5. Screenshot example: `node scripts/screenshot.mjs "http://localhost:4173/?view=3d&place=red-fort" "$env:TEMP\metro-review.png" 1440 1000 10000`. Use localhost when Vite binds IPv6; 127.0.0.1 can refuse the connection.

Stop for user review/commit at this extension boundary. Full imagery review, real-hardware performance, surveyed station plans, complete landmark grounds, people and Phase 9 journey planning remain separate.
