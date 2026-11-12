# Handoff: city surroundings, roads and Yamuna implemented

Updated 2026-11-12. Workspace: `D:\self-practice\metro-3d-simulation` (Windows / PowerShell).

The landmark/station extension and the user's visual-review requests (buildings, roads and Yamuna) are implemented. The user handles commits. Read `CLAUDE.md`, `docs/CODE_SUMMARY.md`, DECISIONS #72–#75 and `docs/phase8-city-environment.md` first, then the frozen landmark report. The pre-implementation handoff is preserved in `docs/handoffs/2026-11-12-before-landmarks.md`.

## Completed

- Expanded real OSM environment: 124,105 buildings, 109,046 road ways, 19,711 land areas and 3,095 water areas. Station neighbourhoods expand to 650 m, local roads to 800 m, landmark districts to 2.3 km. All 14 new source snapshots are immutable under `data/raw/environment/2026-11-12/`; original city snapshot remains a baseline.
- Yamuna water/shoreline and islands render from mapped polygons; shared water overlay in both maps and River & water checkbox. No invented river width or alignment. Blue Line crossing was reviewed from source-derived coordinates.
- Procedural facade/ground/water textures, roof colours, curbs/markings, nearby illustrative cars/buses/autorickshaws and streetlights. Heritage/worship/service tags suppress inappropriate modern office window patterns. Modelled facade details, untagged heights, tree placement, bridge levels and traffic are nominal/illustrative.
- 5,345 indexed 1 km city tiles, max 48 selected / 64 cached; max 6,000 nearby trees, 180 vehicles and 160 lamps. At overview scales the global landscape/water/arterial layer remains, while detailed city tiles unload. Low-angle eye / oblique camera controls preserve the current place. WASD moves, Shift speeds up; text inputs retain their keys.

- India Gate, Lotus Temple, Qutb Minar and **Red Fort's Lahori Gate only**, at positions derived from four immutable OSM way/full snapshots dated 2026-11-12. One shared processed GeoJSON drives both views. No rail geography was changed.
- Original procedural Blender GLBs, `.blend` source library and reproducible Python script. Models are architectural approximations, with sourced heights where verified and nominal dimensions labelled. No reference photographs are distributed textures; no paid generation used.
- Search and Places tab, 2D geographic markers/selected footprint, 3D labels and clickable models, detail panel with source links and nearest station. Distances are **straight line to mapped station point**, not walking routes or entrances. `?place=india-gate`, `lotus-temple`, `qutb-minar`, `red-fort` opens a place in either view.
- 201 eligible isolated elevated platform frames have wider side platforms, four real stairwell openings, 3 m clear longitudinal lanes, open concourse floors, street stairs and lift connections. Nearby guards, stairs, rafters, benches and lift detail are capped at six stations / 700 m target radius / camera distance under 1.4 km.
- `circulationLayout` supplies nominal local floor, lane, stair-flight and lift-stop metadata. It is preparation for people, not a surveyed navigation mesh or crowd simulation. Complex/shared, mixed, low-ramp and underground access needs site-specific work and remains outside this generic layout.

## Sources and code

| Path | Purpose |
|---|---|
| `data/raw/landmarks/2026-11-12/` | Four immutable OSM way/full JSON snapshots |
| `data/manual/landmarks.json`, `landmark-references.json` | Identity, height, scope, architectural references, asset search outcomes and limitations |
| `scripts/fetch-landmarks.mjs`, `scripts/build-landmarks.ts` | Snapshot capture and offline build; latter included in `npm run data:build` |
| `data/processed/landmarks.geojson` | Shared points, footprints, orientation, provenance, model paths, nearest station/distance |
| `scripts/model-landmarks.py`, `assets/landmarks/landmarks.blend` | Reproducible Blender authoring source and workshop library |
| `public/models/landmarks/` | Four GLBs, manifest, CC0 licence; 46,598 triangles, 3,029,544 bytes of GLBs |
| `Landmarks.tsx`, `LandmarkLayer.tsx`, `LandmarkPanel.tsx`, `store/showLandmark.ts` | Rendering, markers, details/list, shared picking/focus |
| `scene3d/buildStructures.ts`, `Structures.tsx`, `constants/scene.ts` | Station slabs/openings, local circulation layout, nearby detail and nominal dimensions |

Graph-first code discovery remains required. Project graph: `D-self-practice-metro-3d-simulation`; refresh the index if needed. Node-tested modules use explicit `.ts` imports and must not import Vite `?url` loaders.

## Blender

Live MCP verified: Blender 5.3.0, addon 1.8, protocol 15, telemetry false. Original default cube/camera/light and active unsaved file path were preserved. Project collection: `NCR_Landmarks`, one combined mesh per landmark, spaced 110 m apart in the workshop. Library export does not save or overwrite the user's active file. Asset libraries and generators are disabled; procedural bpy authoring works without them.

To regenerate, build the landmark GeoJSON first, then execute `scripts/model-landmarks.py` in Blender with `__file__` set. It replaces only the named project collection. Follow MCP's status/scene checks before editing. Preserve unrelated scene work. Modeling authorization verbatim:

> i added the blender add MCP and connect to that. and now let's try to add famous places near metro , try to create good station design also because in future we will add 3d people here that's why

## Checks and next boundary

`npm run data:city`, `npm run data:build`, `npm test` (63 passing), lint and build are the required checks. Rail validation remains **0 errors, 7 warnings, 68 info**; the city report records 0 polygon assembly issues. See the latest frozen phase report for final visual/check results. Headless Chrome uses SwiftShader, so real GPU frame rate remains unmeasured. Vite preview listens on localhost; 127.0.0.1 can refuse when it binds IPv6 only.

Current city source pipeline: `scripts/build-environment.ts` (`build-city.ts` delegates), `scripts/environmentGeometry.ts`; types `src/data/cityTypes.ts`. Runtime: `loadCity.ts`, `cityTiles.ts`, `City.tsx`/`buildCity.ts`, `UrbanLife.tsx`, `environmentTextures.ts`, `SceneAtmosphere.tsx`, `ExploreMovement.tsx`, `WaterLabels.tsx`, `map2d/WaterLayer.tsx`. Regenerate city tiles from preserved snapshots with `npm run data:city`; generated content-hash filenames change when a tile changes. The full city tile payload is about 179 MB on disk, not a startup download. Landscape/water context is separate; use compressed hosting responses.

The rail work from before this extension is retained: 12 lines / 16 branches / 288 stations / 378 segments / 30 shared interchanges / 5 external walking links, separate regional fleet models and sourced speed caps. Human imagery review and real-hardware performance review remain pending. Phase 9 journey planning and adding people are separate tasks; wait for the user's direction after review.
