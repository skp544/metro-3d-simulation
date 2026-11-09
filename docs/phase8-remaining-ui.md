# Delhi Metro 2D/3D Visualization: Phase 8 Remaining UI

**Completed:** 2026-11-09
**Network data:** OSM snapshot `2026-10-31T12:28:36Z` (validation PASSED, 0 errors, unchanged in this phase)

This document is a **frozen summary of Phase 8**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§Routes and the 2D/3D handoff), [DECISIONS.md](DECISIONS.md) (#50–#56) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

Four UI items agreed at the end of Phase 7 (Phase 7 doc §9). No data or pipeline changes.

| Goal | Result |
|---|---|
| "Work in progress" entries for Rapid Metro Gurugram, Noida Aqua Line and Namo Bharat | ✅ Names only: an "Other systems" section in the layer panel, and a "work in progress · not on this map yet" row when a search matches one. No data invented |
| Follow a selected train in 3D | ✅ A train-list row or a train's 3D tag starts it; the camera moves with the train, orbit and zoom still work; a pan, Esc or "Stop" ends it |
| Carry the view across the 2D/3D switch | ✅ Same centre and on-screen scale both ways, through `projection.ts` |
| Route highlighting between two stations | ✅ "Route from here" / "Route to here" in the station panel; legs and changes in a route card; highlighted on both maps, which fit to it |

Tests: **36/36** pass (+6 in this phase). Type-check and lint are clean. Network validation still PASSED.

---

## 2. What was built

| Area | Files |
|---|---|
| Route planner | `src/utils/routePlanner.ts` (+ `routePlanner.test.ts`, 5 tests), `src/store/useJourney.ts` |
| Route display | `src/components/ui/RoutePanel.tsx`, `src/components/map2d/RouteLayer.tsx`, `src/components/scene3d/RouteOverlay.tsx`; `SegmentLayer` and `StationLayer` dim what is off the route; route buttons in `StationPanel` |
| Train follow | `CameraRig` in `src/components/scene3d/SceneRig.tsx`; `src/components/ui/FollowCard.tsx`; clickable train tags in `Trains.tsx`; train rows in `BottomDock.tsx` |
| View handoff | `metresPerPixel`, `zoomForMetresPerPixel`, `distanceForMetresPerPixel`, `metresPerPixelAtDistance` in `src/utils/projection.ts` (+1 test); `viewHandoff` in `useMapStore.ts`; read/write in `MetroMap.tsx` and `MetroScene.tsx` / `CameraRig` |
| Commands | `src/store/useCommand.ts`: focus, fit, follow and camera commands run once, by the view that is showing |
| Work in progress | `WORK_IN_PROGRESS_SYSTEMS` in `src/constants/map.ts`; `ControlPanel.tsx`, `TopBar.tsx` |
| Store | `fit`, `follow`, `routeFrom`/`routeTo` (`?route=from,to`), `fitTo`, `followTrain`, `setRouteEnd`, `swapRoute` |

No new npm dependencies. Build: 2D bundle 432 KB JS (131 KB gzip, +12 KB); 3D chunk 1.07 MB (287 KB gzip).

---

## 3. Outputs (real figures)

**Route planner** on the processed network (12 routes, 244 stations, 312 segments):

| Measure | Value |
|---|---|
| Station pairs routed | 59,292 of 59,292 (every station reaches every other) |
| Changes needed | 0: 8,762 pairs · 1: 25,676 · 2: 19,954 · 3: 4,448 · 4: 438 · 5: 14 |
| Longest estimated trip | Raja Nahar Singh → Brigadier Hoshiyar Singh, 133 min, 72.5 km, 2 changes |
| Speed | Graph built in 2.4 ms; one plan takes 0.05 ms on average (Node 24) |

Sample journeys (estimated, see §4):

| From → to | Estimate | Legs |
|---|---|---|
| Rithala → Shaheed Sthal | 58 min, 33.4 km, 28 stops | Red, no change |
| Kashmere Gate → Hauz Khas | 26 min, 14.3 km, 13 stops | Yellow, no change |
| Indraprastha → Vaishali | 22 min, 10.1 km, 8 stops | Blue main → change at Yamuna Bank → Blue Vaishali branch |
| Majlis Park → Noida Electronic City | 77 min, 38.4 km, 32 stops | Pink → Azadpur → Yellow → Rajiv Chowk → Blue |
| Samaypur Badli → Dwarka Sector 21 | 67 min, 39.3 km, 19 stops | Yellow → New Delhi → Airport Express |

**View handoff:** 3D at `?at=28.6328,77.2197,1500` (1.2 m per pixel) switched to 2D opens at `#17/28.63280/77.21970`, which is the same centre, with the scale rounded to zoom 17. 2D at zoom 15 switched to 3D shows Connaught Place's circle at about the same on-screen size.

---

## 4. Method

| Topic | How |
|---|---|
| Graph | One node per (station, route). Ride edges join consecutive stops of a route, both ways (routes are stored one way). A change edge joins two routes at the same station, so changing between a line's branches (Yamuna Bank, Ashok Park Main) is a change, as it is in reality. Pink's loop lists Maujpur-Babarpur twice; both entries are one node |
| Cost | Run time at the simulation's 45 km/h plus a 30 s dwell per hop; a change costs 5 min (2 min walk + half the 6-min headway). Dijkstra by linear scan, a few hundred nodes. Changing at the origin or into the destination is skipped |
| Legs | The steps are cut into legs at each change. Each leg carries its stations, the "towards" terminus, the real segment ids (several per hop where the track type changes) and km spans along the route path |
| 2D highlight | Own pane between track and stations: a 13 px white casing and an 8 px line in the leg's colour on the real segments; From / Change / To markers with permanent tooltips; the rest of the network at 35% opacity, off-route stations at 30% |
| 3D highlight | Each km span is sliced from `RoutePath3D` (`pointAt` at both ends) and drawn 2.5 m above the deck as a 9 px white and 5 px coloured line with no depth test, so it reads through buildings at any distance. With the ground shown, underground stretches are drawn at the surface. From/To tags float above the end stations |
| Fit | A new journey fits both views to its stations' bounds: Leaflet `flyToBounds` with padding for the cards; in 3D, a fly to the centre at 1.4 × the extent, keeping the viewing angle |
| Follow | Each frame the train's position is recomputed with `stateAt` + `pointAt` (the same path the cars use). The fly-in's end point moves with the train. After that, camera and target are moved by the train's step, so orbit and zoom stay the user's. If the target is more than 3 m off where it was put, the user panned, and following stops |
| View handoff | The shared measure is metres per CSS pixel at the view centre: Leaflet's `40,075 km × cos(lat) / (256 · 2^zoom)` and, for the 3D camera, `2 · d · tan(fov/2) / height`. 2D → 3D keeps the reference's oblique angle from the south-east |
| Commands across views | Each command key is run by one view only. This fixed a replay bug: remounting a view used to fly again to the last searched station, and the lazy 3D view now still runs a fit that was issued before it loaded |

---

## 5. Verified (real-time headless Chrome, SwiftShader WebGL)

| Check | Seen |
|---|---|
| `?view=2d&route=stn_mkpr,stn_necc` | Route card: ≈ 77 min, 32 stops, 2 changes, Pink → Yellow → Blue with "Change at Azadpur / Rajiv Chowk"; the cased route on the map, the rest dimmed, From / Change / To tags |
| Same route in 3D | Camera fits the route; cased Pink, Yellow and Blue line over the network; "From: Majlis Park" and "To: Noida Electronic City" tags |
| `?view=3d`, train row clicked | Camera flies to RD-03 and stays on it; its row is highlighted; the card reads "Following RD-03 → Shaheed Sthal · next Hindon River · simulated" |
| Follow, then zoom in, then a left-drag | Following after the click and after zooming; ended by the drag |
| 2D → 3D and 3D → 2D | As in §3 |
| Search "rapid" | "Rapid Metro Gurugram" and "Namo Bharat (RapidX)" marked "Work in progress · not on this map yet"; the layer panel lists all three as disabled |
| Phone, 390 × 844 | Route card readable; follow card above the train list |

Bugs found during the check and fixed:
- The 3D view did not fit a route given in the URL, because the lazy view mounted after the command was issued. Fixed by `useCommand` (§4).
- With two drei `<Html>` tags mounting in the scene's first render, the first one lost its content. The route tags now mount one frame later.
- The follow card covered a KPI card, and on phones the "Labels" card covered the route card. Both were moved or hidden (DECISIONS #56).

---

## 6. Open issues

| Item | Note |
|---|---|
| **Frame rate on real hardware not measured** | Still open from Phase 6/7. Please check `?view=3d` on your machine and a phone, ideally while following a train |
| Phase 4 human imagery review | Still pending (`docs/phase4-leaflet-map.md` §5) |
| City data size | 12.3 MB uncompressed; serve gzipped or brotli |
| Route times are nominal | One speed for every line, so the Airport Express, which runs much faster in reality, is not given its real advantage; transfer time is a flat 5 min everywhere |
| Route end picking | Through the station panel only; there is no From/To search field yet (Phase 9) |
| 3D → 2D zoom | Rounded to a whole zoom level, up to ×1.4 off in scale |
| No out-of-system changes | Only changes inside one station are routed; walking links between separate stations are not in the data |

---

## 7. Limitations

- **Times are estimates** from the simulated service's nominal constants (45 km/h, 30 s dwell, 6-min headway, 5-min change), labelled as such. They are not DMRC's timetable or fare route.
- **The followed train is simulated,** like all trains.
- **The work-in-progress systems have no data.** They are names only, by design (DECISIONS #1).

---

## 8. Reproduce

```bash
npm test      # 36 tests (route planner: 5, view scale: 1)
npx tsc -b && npm run lint && npm run build
npx vite preview --port 4173
# then, for example:
#   http://localhost:4173/?view=2d&route=stn_mkpr,stn_necc   (Majlis Park → Noida Electronic City)
#   http://localhost:4173/?view=3d&route=stn_idpt,stn_vasi   (change at Yamuna Bank)
#   http://localhost:4173/?view=3d  → click a train row to follow it
node scripts/screenshot.mjs "http://localhost:4173/?view=3d&route=stn_mkpr,stn_necc" /tmp/x.png 1440 900 16000
```

---

## 9. Next: Phase 9 (journey planner)

- From/To fields with station search, and swapping (the route card already swaps)
- Per-line speeds where a source exists (Airport Express), and better change times at large interchanges, each sourced or marked nominal
- Alternatives (fewest changes vs fastest), and the trains to catch from the simulated service
- Still open: the real-hardware frame rate and the imagery review

**Waiting for approval to start Phase 9.**
