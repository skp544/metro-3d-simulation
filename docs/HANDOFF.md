# Handoff: landmarks and station circulation implemented

Updated 2026-11-12. Workspace: `D:\self-practice\metro-3d-simulation` (Windows / PowerShell).

The authorized landmark/station extension is implemented and awaiting user review. The user handles commits. Read `CLAUDE.md`, `docs/CODE_SUMMARY.md`, DECISIONS #69–#71 and `docs/phase8-landmarks-stations.md`. The original pre-implementation handoff is preserved in `docs/handoffs/2026-11-12-before-landmarks.md`.

## Completed

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

`npm run data:build`, `npm test` (59 passing), `npm run lint` and `npm run build` pass. Rail validation remains **0 errors, 7 warnings, 68 info**. See the frozen phase report for visual checks and limitations. Browser screenshot tooling uses SwiftShader, so real GPU frame rate remains unmeasured. Vite preview listens on **localhost** by default; `127.0.0.1` can refuse when it binds IPv6 only.

The rail work from before this extension is retained: 12 lines / 16 branches / 288 stations / 378 segments / 30 shared interchanges / 5 external walking links, separate regional fleet models and sourced speed caps. Human imagery review and real-hardware performance review remain pending. Phase 9 journey planning and adding people are separate tasks; wait for the user's direction after review.
