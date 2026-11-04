# Delhi Metro 2D/3D Visualization: Phase 6 3D Infrastructure

**Completed:** 2026-11-04
**Dataset shown:** OSM snapshot `2026-10-31T12:28:36Z`; validation PASSED (0 errors, 2 warnings, 22 info)

This document is a **frozen summary of Phase 6**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§3D scene, §3D rendering), [DECISIONS.md](DECISIONS.md) (#34–#40) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

| Goal (roadmap) | Result |
|---|---|
| Procedural viaduct deck and pillars under elevated track | ✅ Deck wherever the track is above ground (ramps included); 8,487 instanced pillars every 30 m |
| Tunnels, with an option to see underground track | ✅ Translucent tunnel shells; a "Ground" toggle in the 3D panel hides the ground plane |
| Station boxes by type, aligned to the track | ✅ 271 platform boxes (200 above ground, 71 below), centred on the track at each stop and oriented along it |
| Track as real geometry | ✅ Coloured 8 m ribbon close up; screen-space lines far away (switch at 3 m per pixel) |
| **Exit: track runs continuously through stations** | ✅ Tested on the real network (§4) |
| **Exit: acceptable frame rate** | ⚠️ The workload is small (~151k triangles, ~7 structure draw calls), but the frame rate hasn't been measured on a real GPU (§5) |

Tests: **25/25** pass (10 new in this phase). Type-check and lint are clean. Validation still PASSED.

---

## 2. What was built

| File | Purpose |
|---|---|
| `src/components/scene3d/buildStructures.ts` | Pure builders: `extrudeRect` (a rectangle swept along many paths into one geometry, with vertex colours), `spansWhere` (stretches above or below a level), `pillarMatrices`, `boxMatrix`, and `buildStructures(scene, colors, filters)`, which assembles everything |
| `src/components/scene3d/Structures.tsx` | Draws deck, pillars, tunnels, ribbon (close up) and station boxes; instanced `Boxes` helper |
| `src/components/scene3d/geometry.ts` | + continuous `paths` per route; platforms placed **on the track** at their stop, with a `yaw` heading; minimal `NetworkGeometry` input type; Node-loadable imports |
| `src/components/scene3d/MetroScene.tsx` | + lights, logarithmic depth buffer, `LodWatcher`, ground toggle, `?at=lat,lng,distance` start view |
| `src/constants/scene.ts` | + `STRUCTURE` (nominal sizes), `LOD_METRES_PER_PIXEL`, structure colours |
| `src/utils/trackProfile.ts` | Short runs reach only part of their level (§3) |
| `src/store/useMapStore.ts`, `src/components/ui/ControlPanel.tsx` | `showGround` + "Ground (hide to see tunnels)" row (3D only) |
| `src/components/scene3d/buildStructures.test.ts` | 5 builder tests |
| `src/components/scene3d/geometry.test.ts` | 4 tests on the real network (§4) |
| `src/utils/projection.test.ts` | + short-tunnel underpass test |

No new dependencies.

---

## 3. Method

| Topic | How |
|---|---|
| What gets a viaduct or tunnel | The **height** of the track, not its type label. A deck wherever it is above +2 m; a tunnel shell wherever it is below −2 m. Viaducts continue down the ramps to the portal |
| Sizes (nominal, `STRUCTURE`) | Track ribbon 8 m; deck 11 m wide × 2 m deep; pillars 2.5 m every 30 m; tunnel 13 × 7 m; platform box 180 × 26 m, from 4 m below the rails to 6 m above. Vertical sizes ×4 like the heights |
| Stations | Each platform's box is centred on its route path at the stop's distance and rotated to the track heading. At a junction shared by two branches (Yamuna Bank) it takes the first branch. Above-ground roofs are white tinted 30% to the line colour; underground boxes are translucent slate |
| Level of detail | Metres per pixel at the orbit target = 2·distance·tan(fov/2) / screen height. Under 3 m/pixel: ribbon and boxes. Over it: Phase 5 lines and dots. 20% hysteresis prevents flicker |
| Performance design | One merged mesh each for deck, tunnel and ribbon (vertex colours); instanced pillars and station boxes, so about 7 draw calls for all structures. Filters rebuild the merged geometry |
| Depth precision | Logarithmic depth buffer: the ribbon sits 0.3 m above the deck, and both must not flicker from 1 m up to 400 km away |
| Short-run fix | A run shorter than a full ramp (800 m) reaches only that fraction of its level. Found by the grade test: a 48 m OSM "tunnel" between two at-grade stretches near Yamuna Bank had produced an **8.2%** grade. It is now a ~1 m underpass, and the network's steepest grade is **3.37%** |

---

## 4. Results

### 4.1 Automated checks on the real network (`geometry.test.ts`)

| Check | Result |
|---|---|
| One continuous path per route (12) with no height jumps | ✅ Steepest modelled grade **3.37%** (Yellow Line), under the 5% limit; real metros run up to about 4% |
| Every platform lies on its line's track | ✅ All 271 within 1 m, so the track runs through every station box |
| Each platform's height matches its data type | ✅ Every elevated platform is above +2 m, every underground one below −2 m, and every at-grade one is near ground |
| Structure budget | ✅ ~151k triangles in total (deck 21.9k, tunnel 4.2k, ribbon 19.9k, plus 12 per instanced box); 8,487 pillars; 271 station boxes |

### 4.2 Visual checks (real-time headless Chrome, SwiftShader WebGL)

| View | Seen |
|---|---|
| Kashmere Gate (`?view=3d&at=28.66806,77.22815,1600`) | Elevated Red Line on deck and pillars with its station box; Yellow and Violet tunnels and underground station boxes visible through the ground |
| Tis Hazari (`…&at=28.667163,77.216631,700`) | Deck and pillars continuous through the elevated station (the Phase 4 inference holds) |
| Rajiv Chowk, ground hidden (`…&at=28.6328,77.2195,1400`) | Blue and Yellow tunnels crossing at stacked station boxes; Airport Express tunnel; Blue Line ramping from tunnel to viaduct |
| Overview (`?view=3d`) | Unchanged from Phase 5 (lines and dots at city scale) |

---

## 5. Open issues

| Item | Note |
|---|---|
| **Frame rate on real hardware not measured** | Headless SwiftShader (CPU) ran at 9 fps at 1440×900, which isn't representative. Please check `?view=3d` on your machine and a phone; drei `<Stats>` can be added if needed |
| No end caps on decks and tunnels | `shortcut:` comment in `extrudeRect`; ends are visible only very close up |
| No miter at sharp bends | Widths vary slightly at bends (`shortcut:` comment); OSM track is dense, so bends are gentle |
| Interchange boxes overlap | Each line's platform gets its own box; real interchanges share a concourse |
| No shadows or textures | The flat, clean style is deliberate for now; Poly Haven CC0 textures are an option later |
| `THREE.Clock` deprecation warning | From @react-three/fiber 9.8; harmless |
| Phase 4 human imagery review | Still pending |

---

## 6. Limitations

- **Every height and structure size is nominal.** No open per-site data exists. The view says "heights and structure sizes nominal, ×4 vertical".
- **Portal positions** come from where OSM's tunnel and bridge tags change, which is a mapping convention, not surveyed portal locations.
- **At-grade track** (7.5 km) has no structure, so it shows as the ribbon on the ground close up.

---

## 7. Reproduce

```bash
npm run dev
# http://localhost:5173/?view=3d                              overview
# http://localhost:5173/?view=3d&at=28.66806,77.22815,1600     Kashmere Gate close-up
# then untick "Ground (hide to see tunnels)" in the panel
npm test                                     # 25 tests
npx tsc -b && npm run lint && npm run build
```

---

## 8. Next: Phase 7 (trains)

- A low-poly train (a custom GLB, or procedural to start: no licensed Delhi Metro model exists, Phase 1 §7)
- Trains animated along the route paths with the correct heading; several per line; adjustable speed; instanced
- Play/pause and speed controls

Exit: ≥ 50 trains running smoothly.

**Waiting for approval to start Phase 7.**
