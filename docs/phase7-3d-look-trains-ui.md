# Delhi Metro 2D/3D Visualization: Phase 7 3D Look, City, Trains and UI

**Completed:** 2026-11-09
**Network data:** OSM snapshot `2026-10-31T12:28:36Z` (validation PASSED, 0 errors) · **City data:** OSM snapshot `2026-11-04T16:46:22Z`

This document is a **frozen summary of Phase 7**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§3D rendering), [DECISIONS.md](DECISIONS.md) (#41–#49), [ASSETS.md](ASSETS.md) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

The planned Phase 7 was "trains". The user widened it: make the 3D view **look like `ref_image.png`** with real 3D models (found first), set in **real OSM surroundings**, with **moving labelled trains** and the **reference-style UI** (bringing Phase 8 work forward).

| Goal | Result |
|---|---|
| Find usable 3D models first | ✅ Kenney Train Kit and Nature Kit (**CC0**). Three Sketchfab candidates rejected on weight or licence (§3) |
| Look like the reference | ✅ Warm opaque ground, cream flat-shaded buildings, soft sun shadows, autumn and green trees, isometric close-up of a hub, floating white cards |
| Real surroundings, nothing invented | ✅ 25,197 OSM buildings, 12,832 road pieces and 860 green areas within 300 m of the stations; trees only inside real green areas |
| Moving trains with labels | ✅ 218 simulated trains (6 DMRC-proportioned cars each, stripe in the line colour), left-hand running, labels like the reference's vehicle tags |
| Reference-style UI | ✅ Top bar, KPI cards, layer panel, station panel with next trains, bottom dock (Trains / Stations / Validation), 3D zoom, view and label controls; shared by 2D and 3D |
| ≥ 50 trains running smoothly | ⚠️ 218 trains run; frame rate measured only in software WebGL (§6) |

Tests: **30/30** pass (+5 in this phase). Type-check and lint are clean. Network validation still PASSED.

---

## 2. What was built

| Area | Files |
|---|---|
| City data | `scripts/fetch-osm-city.ts`, `scripts/build-city.ts` → `data/processed/city_*.geojson`, `data/metadata/city_report.json`; npm `data:fetch-city`, `data:city` |
| City rendering | `src/data/loadCity.ts`, `src/components/scene3d/buildCity.ts` (merged low-poly geometry in 3 km chunks), `City.tsx` (instanced Kenney trees) |
| Trains | `src/utils/trainSim.ts` (deterministic simulated service), `src/components/scene3d/Trains.tsx` (instanced cars, stripe recolouring, labels, far-view dots) |
| Scene look | `src/constants/scene.ts` (palette, true scale, `TRAIN`, `SHADOW`), `SceneRig.tsx` (`CameraRig`, `Sun`, `StationLabels`), `MetroScene.tsx` (shadows, flat look, hub start view, underground surface lines), `Structures.tsx` (clickable stations, X-ray) |
| UI | `src/components/ui/TopBar.tsx`, `KpiCards.tsx`, `StationPanel.tsx`, `BottomDock.tsx`, `SceneControls.tsx`; `ControlPanel`, `ViewToggle` and `ValidationPanel` (now `ValidationList`) reworked; `src/store/useSimNow.ts`; store: selection, labels, camera commands, sim clock |
| Assets | `public/models/kenney/train/` (3 cars + palette texture), `public/models/kenney/nature/` (4 trees), licence files; `docs/ASSETS.md` |
| Tests | `src/utils/trainSim.test.ts` (4), `src/components/scene3d/buildCity.test.ts` (1) |

No new npm dependencies.

---

## 3. Models

| Model | Source | Licence | Use |
|---|---|---|---|
| `train-electric-subway-a/b/c` | Kenney Train Kit 1.1 | CC0 | Car `a` is the cab (nose at +z, used reversed at the rear); `b` and `c` are middle cars |
| `tree_default_fall`, `tree_oak_fall`, `tree_default`, `tree_oak` | Kenney Nature Kit 2.1 | CC0 | Two autumn and two green trees, ~12 m |

**Rejected:**
- **Sketchfab "Riyadh Metro":** CC BY, but 3.85M faces.
- **Sketchfab "Subway Metro Train Concept [High Poly]":** a paid Standard licence, not downloadable, and 2.1M faces.
- **Delhi Metro models on Sketchfab:** a search found none.

**DMRC look:** the Kenney car's body is already stainless. Its stripe palette cell (column 5, bottom row of `colormap.png`) is repainted at runtime in each line's colour, giving one material per line. Cars are scaled per axis to 21.6 × 3.2 × 3.9 m, which is nominal DMRC size.

---

## 4. Method

| Topic | How |
|---|---|
| City heights | OSM `height` (175) → `building:levels` × 3.2 m (1,697) → nominal by type ±25% (23,325, flagged `heightSource: nominal`) |
| City size | 12.3 MB GeoJSON, 1.45 MB gzipped; service roads dropped; coordinates at 5 decimals; loaded only by the 3D view |
| City rendering | One merged mesh per 3 km chunk and layer (buildings, roads, green), 107 chunks, so off-screen chunks are culled from both the camera and the shadow pass. ~473k triangles |
| Trees | Positions are generated deterministically inside each real green polygon (1 per 300 m², at most 40 per area); each Kenney tree part is one instanced mesh |
| Simulated service | Each route's round trip: 3 min terminal dwell, then 45 km/h between stops with 30 s dwells, then back. Trains are spaced one every 6 min per direction (218 in total), and position is a pure function of time, so pause and ×1–×8 never drift. Average ≈ 34 km/h |
| Trains in 3D | Each frame: state → km along the route path → per-car position and heading (binary search), offset 2 m to the left of travel. Models are drawn within 5 km of the view target, and far away as one dot per train. Labels are drawn for the 16 nearest trains within 1.5 km |
| Look | Opaque warm ground (#dcd6cc), hemisphere light plus a warm sun whose shadow camera (±900 m, 2048²) follows the view target, flat output (no tone mapping), Lambert flat shading |
| Underground | Hidden under the opaque ground; drawn close up as dashed surface lines in the line colour. "X-ray" in the layer panel shows tunnels, underground stations and trains |
| Start view | ~700 m from the station with the most lines (Kashmere Gate), from the south-east. `?cam=network`, `?cam=top` and `?at=lat,lng,dist` still work |
| Shared UI | Search (also by DMRC code, `/` to focus), and a station panel that replaces the 2D popup. It shows type, lines, simulated next trains, platform levels compared with Wikipedia, conflicts and OSM sources. The bottom dock lists trains (click to fly to one), stations and validation issues |

---

## 5. Verified (real-time headless Chrome, SwiftShader WebGL)

| View | Seen |
|---|---|
| `?view=3d` (hub) | Kashmere Gate: elevated Red Line station on the viaduct, Yellow and Violet as dashed surface lines crossing beneath, OSM buildings with soft shadows, autumn and green trees in the parks, KPI cards, top bar, labels control |
| Train row clicked, then zoomed | Camera flies to RD-04: a six-car stainless train with Red Line stripes on the left-hand track, labelled "RD-04 → Shastri Park" |
| `?view=2d`, search "rajiv" + Enter | Flies to Rajiv Chowk; the station panel shows Yellow and Blue platforms (underground, matching Wikipedia), next trains (e.g. YL-17 in 2 min) and 8 OSM sources |

Bugs found during the check and fixed: shadow acne on the double-sided walls (bias raised); train IDs wrapping in the dock; white text on the Yellow Line chip (now dark text picked by WCAG luminance).

---

## 6. Open issues

| Item | Note |
|---|---|
| **Frame rate on real hardware not measured** | The worst case is the full city (~473k triangles), structures (~151k), and trains near the view, all with shadows. Please check `?view=3d` on your machine and a phone |
| City data size | 12.3 MB uncompressed. Serve it gzipped or brotli; tiling by area is the upgrade (`shortcut:` noted in DECISIONS #49) |
| Train follow | Clicking a train flies to where it is but doesn't follow it (Phase 8) |
| 2D/3D view sync | Switching views doesn't carry the camera position across (Phase 8) |
| "Work in progress" entries (Rapid Metro, Aqua Line, Namo Bharat) | Not yet in the UI (Phase 8) |
| City coverage | Building density follows OSM mapping, which is sparse in some neighbourhoods |
| Interchange station boxes overlap | One box per line's platform (as in Phase 6) |
| Phase 4 human imagery review | Still pending |

---

## 7. Limitations

- **Trains are simulated:** a uniform pattern, not DMRC's timetable or live positions. Labelled "simulated" in the clock, KPIs, station panel and 3D credits.
- **Nominal sizes:** 93% of building heights, all structure sizes, and train dimensions are nominal. Tree positions inside parks are generated (the parks are real).
- **Kenney cars are generic,** not a specific DMRC rolling-stock model.

---

## 8. Reproduce

```bash
npm run data:fetch-city && npm run data:city   # optional: refresh the OSM surroundings
npm run dev   # http://localhost:5173/?view=3d   (hub)   ·   ?view=3d&cam=network   ·   ?view=2d
npm test      # 30 tests
npx tsc -b && npm run lint && npm run build
```

---

## 9. Next: Phase 8 (remaining UI)

- "Work in progress" entries for Rapid Metro Gurugram, the Noida Aqua Line and Namo Bharat
- Follow a selected train
- Carry the view across when switching between 2D and 3D
- Route highlighting between two selected stations (leading into the journey planner)

**Waiting for approval to start Phase 8.**
