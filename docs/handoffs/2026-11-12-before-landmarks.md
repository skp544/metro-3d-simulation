# Historical handoff: before landmarks and station design

Archived after implementation on 2026-11-12. The current handoff is `docs/HANDOFF.md`; pending-implementation statements below describe the earlier session only.

Updated 2026-11-12. Workspace: `D:\self-practice\metro-3d-simulation` (Windows, PowerShell).

## Resume here

The next implementation task is to add **India Gate, Lotus Temple, Qutb Minar and Red Fort** near the rail network, with recognizable 3D models, and improve station design with room for future 3D people. The user explicitly approved these four landmarks. They authorized creating models in Blender if suitable existing models cannot be found, using internet images as architectural references.

**Implementation has not started:** no landmark snapshots, processed landmark data, models, app components or new station layout have been created. Research, code inspection and Blender setup were done. This turn writes documentation only; it does not implement the models. The latest user request was to prepare this handoff for another chat.

Read `CLAUDE.md`, `docs/CODE_SUMMARY.md`, the newest entries in `docs/DECISIONS.md`, and this file. Then continue the authorized landmark/station task without asking the user to choose the same places or reconfirm Blender setup.

## Blender: connection verified, earlier blocker resolved

The installer initially configured only VS Code's `AppData\Roaming\Code\User\mcp.json`. Codex uses its own MCP configuration. We registered the installed server using:

```powershell
codex mcp add blender -- C:\Users\systaldyn-pc\.local\bin\uvx.exe mcp-for-blender
```

The `mcp__blender` tools subsequently became available. A read-only `get_addon_status` call **succeeded on 2026-11-12**, returning:

- Blender **5.3.0**, add-on **1.8**, protocol **15**, matching the server; `up_to_date: true`, no warning.
- Native Blender Python execution and viewport inspection are available.
- Poly Haven, Sketchfab and Poly Pizza integrations are off. All listed generators (Tripo, Hunyuan3D, Hyper3D, Meshy) are off; no premium generators are enabled.
- Telemetry consent is false. Leave that preference as configured.

Earlier messages saying no Blender tools/server were available are **historical**, superseded by this successful call. No modeling command has run and the live scene has not been inspected or modified. At the start of the next modeling session, discover the current tools and check status/scene before editing. Preserve existing user work; use a separate collection and project-owned output paths. Do not clear the whole live scene or overwrite an unrelated `.blend` file.

`execute_blender_code` requires `user_prompt` containing the user's own words verbatim. The modeling request was:

> i added the blender add MCP and connect to that. and now let's try to add famous places near metro , try to create good station design also because in future we will add 3d people here that's why

The user separately confirmed: **Use these four landmarks** (India Gate, Lotus Temple, Qutb Minar, Red Fort). Inspect the actual tool schema when calling it. Native procedural Blender modeling does not require the disabled generators or asset services. Do not introduce paid generation without explicit authorization.

Installed executable: `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`. Add-on: `C:\Users\systaldyn-pc\AppData\Roaming\Blender Foundation\Blender\5.3\scripts\addons\blender_mcp.py`. Local bridge normally uses port 9876. Background Blender/Python is a fallback if the live bridge later fails, not evidence that the live connection has been tested.

## Completed work to preserve

The working tree was clean before the handoff documentation edits. Latest commits inspected:

| Commit | Work |
|---|---|
| `4ea8146` | Sourced speed limits and current speed display |
| `20dbe7a` | Distinct fleet models and fleet tests |
| `869b9df` | Regional rail expansion |
| `f11d309` | Realistic track, sleepers and generic stations |

Regional expansion is already implemented: **12 lines, 16 route branches, 288 stations, 378 segments, 30 shared interchanges and 5 external walking links**. Aqua has 21 stations, RRTS 15 including the Duhai Depot branch, Meerut Metro 12. Four NCRTC stations are shared between RRTS and Meerut Metro. The five external links retain separate station identities: Noida Sector 52/51, Sarai Kale Khan/Nizamuddin, New Ashok Nagar, Anand Vihar, and Shaheed Sthal/Ghaziabad. Their dashed geometry and walking times are schematic/nominal. Rapid Metro Gurugram remains work in progress.

Distinct generic train assets are already integrated under `public/models/regional/`, with source/licence manifests. DMRC uses Kenney subway models; RRTS uses a streamlined six-car formation, Aqua four cars, Meerut three. They are illustrative models, not exact operator replicas. See `docs/ASSETS.md` and `docs/phase8-fleet-assets.md`.

Speed work is complete: RRTS operating maximum **160 km/h**, design **180**; Airport Express operating maximum **120**; Meerut Metro operating maximum **120**, design **135**. Ordinary DMRC/Aqua has a **nominal simulation cap of 60 km/h**, not a verified published maximum. Source links and checked dates are in `src/constants/trainSpeeds.ts` and `docs/phase8-train-speeds.md`. Do not replace this with the obsolete 45 km/h descriptions in older decisions.

`trainMotion.ts` supplies acceleration/cruise/braking to both train simulation and route estimates. Current speed appears in train rows, 3D labels and the follow card, and is zero at dwells. The service has 253 simulated trains with nominal headways/dwells. Keep all simulated/estimated labels.

Last implementation verification recorded: **54 tests passing**, build/type checking and lint passing; dataset validation **0 errors, 7 warnings, 68 info**. These checks were not rerun for this documentation-only turn. Browser checks previously observed RRTS at 160 and Airport Express at 120 km/h. Real-hardware frame rate and the full human imagery review remain pending.

## Landmark research and remaining data work

These official pages were researched earlier; re-open them when implementing and store provenance with the resulting features. No landmark coordinates, orientation or footprints have yet been captured in the repository.

| Landmark | Reference / useful detail |
|---|---|
| India Gate | https://www.delhitourism.gov.in/tourist_place/india_gate.html — 42 m stone arch; use references for proportions, cornices and top bowl |
| Lotus Temple | https://www.delhitourism.gov.in/tourist_place/bahai_temple.html and https://dmsoutheast.delhi.gov.in/tourist-place/lotus-temple-delhi/ — white petal architecture, nine pools, Kalkaji Mandir association |
| Qutb Minar | https://www.delhitourism.gov.in/tourist_place/qutab_minar.html — 72.5 m tower, 14.32 m base diameter, 2.75 m top diameter, five storeys/balconies |
| Red Fort | https://dmolddelhi.delhi.gov.in/tourist-place/red-fort/ and https://delhitourism.gov.in/heritage/world_heritage_monuments.html — obtain a real footprint and gate location before deciding how much of the complex to model |

Red Fort's scope (full complex versus a detailed Lahori Gate representation) has **not** been decided. Choose a practical, clearly labelled representation based on verified geometry and reference coverage. Do not present an invented generic fort as a surveyed reconstruction. No particular Blender modeling method or triangle budget has been approved; these are implementation choices.

Use dated OSM snapshots for actual coordinates/footprints. The main OSM API worked for regional data when Overpass was busy. Nearest stations should come from geometry, with any distance labelled correctly: straight-line distance is not a walking route. No landmark-to-station association in preliminary research should be treated as a captured walkway.

Use multiple reference views where helpful. Reference images are not automatically licensed texture assets; record source/licence for imported models and any images actually distributed. Procedural models can be original work informed by references. Keep reproducible modeling scripts/source files, GLB exports, correct metre scale, base origins and orientation metadata. Clearly label architectural approximations and unsourced dimensions as nominal.

## Station design intent and code entry points

The user wants improved station architecture **because people may be added later**. This does not yet authorize or require implementing a crowd simulation. Design useful platforms, concourse circulation, access stairs/lifts, entrances and unobstructed walking space. Keep rail clearance, roof supports and vertical connections coherent. Generic layouts remain nominal unless a station-specific plan is sourced.

Current stations already have two side platforms, yellow edge strips, roof columns, a translucent gabled roof, line-coloured fascia and a simple concourse box where there is sufficient elevation. Underground stations use X-ray boxes. The new work should improve that baseline rather than add a second overlapping station model. Shared/interchange stations need care because platforms can occupy different levels and headings.

Use the codebase knowledge graph for discovery (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`) before text search. Indexed project name at handoff: `D-self-practice-metro-3d-simulation`; re-index if stale. The provided AGENTS instructions require graph-first code discovery.

| File | Relevance |
|---|---|
| `src/data/types.ts`, `src/data/loadNetwork.ts` | Shared schema and processed GeoJSON loading; extend or add a landmark loader |
| `scripts/build-dataset.ts`, `data/manual/`, `data/raw/` | Existing provenance/snapshot pipeline conventions |
| `src/components/scene3d/MetroScene.tsx`, `geometry.ts` | 3D scene integration, projection and station frames |
| `src/components/scene3d/buildStructures.ts` | `stationParts`, `localBox`, station alignment and generated infrastructure |
| `src/components/scene3d/Structures.tsx` | Instanced station parts, filtering and close-up detail |
| `src/constants/scene.ts` | `STRUCTURE` dimensions and materials; nominal sizes in metres |
| `src/components/scene3d/buildCity.ts`, `City.tsx` | OSM city extrusions; avoid duplicate buildings beneath custom landmarks |
| `src/components/map2d/`, `src/components/ui/TopBar.tsx`, `StationPanel.tsx` | Possible landmark markers, discovery and nearby-place UI |
| `src/store/useMapStore.ts`, `useCommand.ts`, `src/utils/projection.ts` | Shared focus/camera commands, view handoff and geographic projection |

`localBox` uses local +X along the track and local -Z for positive across-track distance; verify this in the source before adding circulation geometry. Platforms/roofs are already instanced. Nominal station length is 180 m. Keep trains visible and the track corridor unobstructed.

Existing scene costs are substantial: city approximately 473k triangles, structures approximately 744k before distance-dependent detail; regional train formations add approximately 27k–52k triangles each nearby. Prefer instancing/shared geometry and close-up detail rather than loading detailed interiors across every station. City data covers the original DMRC station catchments, not all regional stations or all four landmark sites.

## Implementation and verification sequence

1. Check repository state and read the project rules. Check Blender status and inspect the live scene without deleting user objects.
2. Capture real landmark positions/footprints and source metadata in immutable dated snapshots. Generate processed landmark GeoJSON through a script; use the same dataset in both views.
3. Find suitable licensed models or author recognizable models in Blender. Inspect viewport results and exported GLBs. Keep reproducible sources and asset attribution.
4. Add models at projected positions with sourced orientation/scale where possible. Add practical discovery/focus UI and geographic markers; avoid duplicated city extrusions.
5. Improve station geometry and circulation, with explicit levels, walkable space and access connections that future people can use. Verify clearances and nominal versus sourced dimensions. Navigation metadata is a useful implementation option, not an existing feature.
6. Run relevant checks and visual review for each landmark and representative stations, including mobile UI and underground/X-ray behavior. Update decisions, code summary, assets and a frozen phase/revision report. Stop at that scope boundary for review; the user handles commits.

Project rules: no invented geographic coordinates; no hardcoded frontend lat/lng; project through `src/utils/projection.ts`; every data feature carries provenance (`source[]`, `verified`, `estimated`, `conflicts[]`). Raw snapshots are immutable, manual corrections go in `data/manual/`, processed data is generated. Do not alter rail geography to fit a model. Keep OSM attribution.

Commands:

```powershell
npm run data:build  # required after pipeline/data edits, followed by npm test
npm test
npm run lint
npm run build
npm run preview -- --port 4173
node scripts/screenshot.mjs "http://127.0.0.1:4173/?view=3d" "$env:TEMP\metro-review.png" 1440 1000 16000
```

Screenshot helper supports Windows Chrome and SwiftShader. `EVAL` can run page JavaScript before capture. Inspect screenshots, not just process exit status. `?view=3d&at=lat,lng,dist` focuses a verified geographic position; `?view=2d#zoom/lat/lng` checks the same place. Node-tested modules need explicit `.ts` imports and must not import Vite `?url` loaders. Use `apply_patch` for Unicode text; PowerShell-to-Node pipes previously corrupted non-ASCII literals. Check whether a preview server is already running rather than assuming an old process/session survives.

The larger Phase 9 journey planner (From/To controls, better transfers, alternatives, trains to catch) remains separate. Do not start it as part of landmark/station work.

## Prompt to paste into the next chat

> Read docs/HANDOFF.md, CLAUDE.md, docs/CODE_SUMMARY.md and the latest docs/DECISIONS.md entries. Continue the authorized task: add India Gate, Lotus Temple, Qutb Minar and Red Fort using real geographic data and good 3D models, and improve station design with circulation space for future 3D people. Blender MCP was successfully verified on 2026-11-12; check the current connection and preserve the live scene. Landmark/station implementation has not started. Use graph tools for code discovery, verify reference facts, implement and visually test the result, and update the project docs. The user will commit the changes.
