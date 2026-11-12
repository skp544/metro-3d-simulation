# Phase 8 extension: city surroundings, roads and Yamuna

Implementation snapshot, 2026-11-12. Decisions #72–#75. User review prompted this extension: the Qutb Minar view looked empty; the user explicitly requested buildings, roads and the missing Yamuna. The user handles commits.

## Result

Replaced isolated station scenery with a larger, source-backed city environment. The 3D scene now includes mapped neighbourhoods and landmark districts, continuous roads, actual land cover, Yamuna water/banks/islands, windowed building facades, nearby illustrative traffic and lamps. Low-angle / oblique camera buttons and WASD movement support exploration. Existing rail geography, station circulation, train motion, routing and landmark positions are retained. Phase 9 and people remain separate.

## Captured data and outputs

Fourteen immutable Overpass responses are preserved in `data/raw/environment/2026-11-12/`: eight groups of 36 processed station centres, four landmark districts, one landscape/water request and one arterial-road request. Snapshot timestamps and exact queries/endpoints are stored per response; the city report lists them. The original 2026-11-04 city snapshot is retained as a baseline. The public endpoints intermittently returned 502/504 or timed out; retries/resumption completed all captures without overwriting saved snapshots.

Buildings are captured within 650 m of all 288 station centres, local roads within 800 m, and building/road context within 2.3 km of each approved landmark. Actual land-use/water areas and arterial roads cover the network bounds plus a margin. These are context catchments, not fabricated geographic features. Neither station positions nor track alignment changed.

| Generated output | Count |
|---|---:|
| Building footprints | 124,105 |
| Roads / mapped paths | 109,046 |
| Land-use/natural/leisure polygons | 19,711 |
| Green areas (subset of land cover) | 10,618 |
| Water polygons / multipolygons | 3,095 |
| Decorative tree positions | 175,644 |
| Indexed 1 km city tiles | 5,345 |
| Polygon assembly issues | 0 |

Building heights: 908 use OSM height, 3,753 use tagged storeys × 3.2 m, and 119,444 use nominal values by type. Feet are converted where tagged; untagged heights vary deterministically within ±25% of a type value. Ruins have a lower nominal height. All features have provenance fields; nominal/generated attributes remain labelled through the data/report. Every tile has a content-hash URL, bounds, centre, counts and byte size in `city_tiles.json`.

The full current tile payload is approximately 179 MB on disk, **not a startup download**. Shared 3D landscape/arterial context is 27.37 MB raw / 4.51 MB gzip; the manifest is 1.20 MB / 192 KB gzip. Water is 2.22 MB / 413 KB gzip and is independently loaded by both views. Combined GeoJSON remains available for offline inspection; runtime buildings/trees come from nearby tiles. Use compressed responses when hosting.

## Geographic method and river verification

`build-environment.ts` deduplicates OSM elements by type/id, retains source snapshots, and builds geographic features without inventing routes or filling unmapped building coverage. `environmentGeometry.ts` assembles multipolygon rings by matching member endpoints, reversing fragments where needed, and assigning inner rings to containing outers. Incomplete rings throw and are logged, rather than being closed with fabricated edges. Interior courtyards and river islands remain holes in the triangulated meshes.

Yamuna includes the captured OSM water areas, including [relation 162295](https://www.openstreetmap.org/relation/162295), [relation 162113](https://www.openstreetmap.org/relation/162113), and other named sections listed in the processed water file. A Blue Line segment (`blue_main_037`) intersects relation 162295 near **28.620306, 77.254357**, derived by intersecting the real rail/water geometry for review. Water uses actual polygon boundaries; no arbitrary centreline or constant river width is drawn. Surface height and the narrow visual bank rim are nominal scene styling, not surveyed river levels or seasonal flow.

The same `city_water.geojson` drives the 2D overlay and 3D water; source-derived river names appear nearby, and the layer panel has River & water. Ground/land/water/roads hide in X-ray so underground structures remain visible. OSM attribution is preserved.

## Scene quality and interaction

- Buildings retain mapped shapes and courtyards. Warm varied walls and roofs replace uniform cream boxes. Original facade textures repeat by metre-scale UVs (nominal 3 m window bays / 3.2 m floors). Heritage/worship/ruin and service/industrial classifications suppress generic modern window grids; these volumes remain approximate rather than detailed reconstructions.
- Roads include arterials, local streets, service roads and footpaths. Asphalt, curb ribbons, path surfaces and nearby markings distinguish them from terrain. Width uses OSM width/lanes where available, otherwise nominal by class; centreline geometry remains sourced. Mapped bridges get nominal elevated profiles with gradual ramps, including two-node bridge ways.
- Real land-use polygons distinguish urban areas, farmland, forests, parks and sand. Predominantly green Kenney trees are placed deterministically inside eligible mapped green areas, excluding buildings, streets, water, and duplicate 7 m cells. Tree positions/species/heights are decorative, not surveyed individual trees.
- Original procedural water ripples, surface grain, sky colour and distance fog add depth. Flat terrain remains nominal; there is no DEM/topographic reconstruction.
- Nearby merged car, bus and autorickshaw meshes follow mapped drivable roads in separated left-hand lanes. They share the simulation clock/playback controls but represent illustrative traffic, with no live feed, intersection routing or collision model. Road-edge lamps are nominal placements on mapped streets.
- The eye button switches to a low-angle view; the adjacent button restores an oblique view at the same place. WASD pans relative to the camera; Shift increases speed. Inputs and browser shortcuts retain their keys, blur clears held keys, and manual movement ends train following. Map orbit/zoom and 2D/3D handoff continue to work.

No external photographic textures, vehicle downloads, API keys or paid generators were added. Visual textures/vehicles/lamps are generated directly in code. Existing Kenney assets and original Blender landmarks remain in use.

## Streaming and budgets

`selectCityTiles` selects at most 48 nearest 1 km tiles; the loader fetches four at a time and retains up to 64 cached tiles. Old nearby geometry is replaced after a batch is ready, and unused generated geometry is disposed. Buildings unload at overview distances above 16 km while shared landscape/water/arterial context remains. Road features shared by adjacent tiles are deduplicated by OSM id. Landmark footprints exclude duplicate buildings and trees.

Detailed tree rendering is capped at the nearest 6,000 trees. Illustrative traffic is capped at 180 vehicles, lamps at 160, and both are hidden above 2.8 km camera distance. Nearby vehicle/lamp candidates refresh as the camera moves. The earlier station/sleeper LOD budgets remain. Hardware frame rate has not been measured; SwiftShader screenshots are visual checks, not real-GPU benchmarks.

## Verification and reproduction

Required checks: `npm run data:city`, `npm run data:build`, `npm test`, `npm run lint`, `npm run build`. Rail validation remains **0 errors, 7 existing warnings, 68 info**; environment assembly reports 0 issues. **63 tests pass**: the old full-city geometry test is replaced with local tile budgets/coverage, river-island triangulation and road/lane/bridge-pose checks, plus two OSM ring-assembly tests. Existing rail, fleet, routing, speed, landmark and station checks continue to pass. Lint/type/build pass; Vite retains the existing warning about the large lazy 3D chunk (approximately 1.097 MB / 298 KB gzip). Main JS is approximately 452 KB / 137 KB gzip.

Browser review uses `scripts/screenshot.mjs` and headless Chrome/SwiftShader. Qutb Minar at the user's broader scene scale now has real neighbourhoods/streets/land cover around it. A Yamuna crossing view shows riverbanks, islands, bridges and the river name; the 2D overlay matches those boundaries. Low-angle view and WASD key input were exercised. Nityanand Marg near Tis Hazari shows nearby vehicles, a streetlight and windowed facades. Phone review (390 × 844) confirms document width equals viewport width; the water checkbox changed true → false → true and the layer returned. Kashmere Gate X-ray exposes underground structures with the ground layer off. Review screenshots are in `docs/review/environment/`; console output was checked for application exceptions.

To reproduce:

1. Offline: `npm run data:city` builds from the captured baseline/environment snapshots, including tile outputs. `node scripts/build-city.ts` delegates to this pipeline.
2. To capture a new context dataset, run `npm run data:fetch-environment`; existing responses for that day are reused. Finish the full capture before building. Raw files are immutable.
3. Run the required checks above, then `npm run preview -- --port 4173` (use localhost, especially if Vite binds IPv6).
4. Review Qutb's district at `http://localhost:4173/?view=3d&at=28.5244172078,77.1854501263,2600` and the source-derived crossing at `http://localhost:4173/?view=3d&at=28.6203061381,77.2543566198,2200`.
5. Switch between 2D and 3D; use the eye/oblique buttons, WASD, water toggle and X-ray. Review a dense neighbourhood and regional corridor on actual hardware.

Stop at this extension for user review. Remaining limitations: incomplete OSM building coverage, nominal heights/facades/fixtures and terrain, illustrative road traffic, initial landscape payload size, and unmeasured real-hardware performance. Full imagery validation, surveyed station plans, people and Phase 9 remain separate.
