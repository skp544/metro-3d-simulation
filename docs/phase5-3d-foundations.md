# Delhi Metro 2D/3D Visualization: Phase 5 3D Foundations

**Completed:** 2026-11-04
**Dataset shown:** OSM snapshot `2026-10-31T12:28:36Z`; validation PASSED (0 errors, 2 warnings, 22 info)

This document is a **frozen summary of Phase 5**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§Projection, §3D scene), [DECISIONS.md](DECISIONS.md) (#28–#33) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

| Goal (roadmap) | Result |
|---|---|
| Projection module: lat/lng never enter Three.js directly | ✅ `src/utils/projection.ts`, the only entry point |
| Ground plane and camera controls | ✅ Translucent ground + 1 km grid; `MapControls` (pan, rotate, zoom, damping, can't go below the horizon) |
| Track per type, from the same segments as 2D | ✅ 312 segments → per-route runs of one type, at nominal height with ramps |
| **Exit: 3D lines up with 2D** | ✅ Tested numerically (§4) and visually: the top-down 3D view (`?view=3d&cam=top`) has the 2D map's shape |

Verified with real-time headless Chrome (DevTools Protocol, SwiftShader WebGL): default view, top-down view, zoomed view. Tests: 15/15 pass. Type-check and lint are clean. Validation still PASSED.

---

## 2. What was built

| File | Purpose |
|---|---|
| `src/utils/projection.ts` | `createProjection(origin)`: Web Mercator scaled by cos φ₀ → metres; x = east, z = south. `boundsCentre(fc)`: origin from the data |
| `src/utils/trackProfile.ts` | `heightProfile(runs)`: nominal level per run, linear ramps at type changes, unknown interpolated |
| `src/constants/scene.ts` | Levels (+12 / 0 / −15 m), ramp half-length 400 m, ×4 vertical exaggeration, colours and sizes |
| `src/components/scene3d/geometry.ts` | `buildScene3D(network)`: 3D track runs per route and type, station points per platform (at the track height at that stop) and interchange markers, and scene bounds |
| `src/components/scene3d/MetroScene.tsx` | Canvas, ground, grid, controls, camera fit to the network, `?cam=top`, attribution and a "heights nominal" note |
| `src/components/scene3d/TrackLines.tsx` | One fat line per run in the line colour; underground and unknown dashed. Uses the shared line/track-type filters |
| `src/components/scene3d/StationPoints.tsx` | Constant-pixel round markers (line colour, dark rim); interchanges larger and white. Uses the station filters |
| `src/components/ui/ViewToggle.tsx` | "2D map / 3D view" segmented control (radio group), synced to `?view=` |
| `src/store/useMapStore.ts` | + `view` / `setView` |
| `src/pages/MapPage.tsx` | Renders the 2D map or the lazy-loaded 3D scene; validation card only in 2D |
| `src/components/ui/ControlPanel.tsx` | Hides the 2D-only layers (under construction, validation) in 3D |
| `src/utils/projection.test.ts` | 5 tests (§4) |
| `package.json`, `tsconfig.*.json` | `npm test` also runs `src/**/*.test.ts`; test files are type-checked by the Node config |

**New dependencies:** `three` 0.187, `@react-three/fiber` 9.8, `@react-three/drei` 10.7; dev: `@types/three`.

**Bundles:** 2D map 399 KB JS (122 KB gzip), unchanged. The 3D chunk is 962 KB (256 KB gzip) and loads only when the 3D view opens.

---

## 3. Method

| Step | How |
|---|---|
| Projection | Web Mercator, identical to Leaflet's, so the shapes match exactly; scaled by cos(28.542°) so a unit ≈ 1 m |
| Origin | Centre of the lines' bounding box: **77.16727 E, 28.54232 N**, computed from the data at runtime |
| Distance along a route | The segments' own `lengthKm`, spread over each segment's vertices by planar distance |
| Height | Each same-type run holds its level. Within 400 m of a change the track ramps linearly (800 m ≈ 3.4% grade between underground and elevated). A run shorter than 800 m (e.g. an at-grade portal between viaduct and tunnel) collapses to its midpoint, so the track crosses ground level there. Unknown runs (Rohini East) are interpolated from their neighbours |
| Platforms | Height = the track profile at that stop (`stopKm`), so a station sits exactly on its track |
| Underground visibility | The ground is translucent (72%) and doesn't write depth, so underground track shows through it, tinted |

---

## 4. Alignment results

| Check | Result |
|---|---|
| Worst scale error over **29,563 station pairs** more than 1 km apart (projected vs geodesic distance) | **0.301%** (test threshold 0.5%) |
| Project → unproject round trip, all 244 stations | < 1 mm |
| Axes | east = +x, north = −z (tested) |
| Origin | projects to (0, 0) and lies inside the network box |
| Height profile | levels, ramps, a short portal crossing 0, unknown interpolated (tested) |
| Visual | the top-down 3D view matches the 2D map: Yellow south-west to Gurugram, Violet south to Ballabgarh, Blue to Noida and Vaishali, Green west to Bahadurgarh |

A 0.3% scale error is about 30 m at 10 km from the centre. That's invisible at network scale, and it is the same distortion the 2D map has, which is exactly what makes the two views match.

---

## 5. Open issues

| Item | Note |
|---|---|
| Height differences barely visible at city zoom | Expected: ±60 m (exaggerated) at a 60 km scale. Phase 6's viaduct, pillar and tunnel geometry makes levels readable |
| Elevated vs at-grade look the same from far away | Only height separates them in Phase 5; Phase 6 adds structure |
| No under-construction or validation layers in 3D | Hidden in the panel (`shortcut:` comment in `ControlPanel.tsx`) |
| No station picking or labels in 3D | Phase 8 (UI) |
| The view doesn't carry over between 2D and 3D | Each opens at its default framing; syncing is a Phase 8 item |
| `THREE.Clock` deprecation warning | Comes from @react-three/fiber 9.8 internals; harmless |
| Phase 4 human imagery review | Still pending (Shahdara, Seelampur, …) |

---

## 6. Limitations

- **Heights are nominal, not measured.** No open per-station height or depth data exists. The view labels them "nominal" and draws them ×4.
- **The ramp shape is a model.** Real portal positions and grades aren't in the data; ramps are centred on the type changes recorded in OSM.
- **Headless verification used software WebGL (SwiftShader).** Performance on real GPUs and mobile devices hasn't been measured.

---

## 7. Reproduce

```bash
npm run dev                                   # then open http://localhost:5173/?view=3d
# top-down comparison with the 2D map:          http://localhost:5173/?view=3d&cam=top
npm test                                      # 15 tests (validator + projection/profile)
npx tsc -b && npm run lint && npm run build
```

---

## 8. Next: Phase 6 (3D infrastructure)

- Procedural **viaduct deck and pillars** (instanced, about every 30 m) under elevated track
- **Tunnels** and an option to cut away or hide the ground for underground track
- **Station boxes** by type, aligned to the track
- Track as real geometry (ribbon or extrusion) in place of the screen-space lines

Exit: track runs continuously through stations; acceptable frame rate.

**Waiting for approval to start Phase 6.**
