# Delhi Metro 2D/3D Visualization: Phase 9 Train Control

**Completed:** 2026-11-11 · **Owner review/commit:** pending.

This is the frozen Phase 9 summary. The owner requested research, a plan, then implementation of a train control manager, Start/Stop, more realistic motion, and visible underground trains. They selected automatic X-ray while following plus a manual toggle. This replaces the earlier proposed journey-planner scope; that work remains a proposal for Phase 10.

Research and the implementation sequence were recorded first in [phase9-plan.md](phase9-plan.md). Living references: [CODE_SUMMARY.md](CODE_SUMMARY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md) #59–#65.

## 1. Goal and result

| Goal | Result |
|---|---|
| Manage every metro train | Train control dock opens a manager for all 218 simulated trains, independent of map filters. Search by ID/station/line, filter by line or state, show destination, next stop and nominal speed |
| Start and stop trains | Per-train Start/Stop and fleet Start all/Stop all. Stop holds position; Start resumes with accumulated delay, without jumping forward. The global simulation clock stays independent |
| See underground trains | Auto X-ray activates when any sampled part of the followed consist is below −2 m. Manual Surface and Underground modes override Auto. Ground and city disappear in X-ray, exposing actual nominal track depth, trains and translucent tunnel/station envelopes |
| More realistic movement | Nominal acceleration and braking around station dwells; carriage pitch follows track grade; tunnel entry culls cars separately. Distant train dots retain their proper line colours after filtering |
| Operate while following | Follow opens 3D and reveals the selected line. “Stop following” only ends camera tracking. The follow card also has Start train/Stop train. On phones, Follow collapses the manager so the train remains visible |

## 2. What was built

| Area | Files |
|---|---|
| Pure control/motion model | `src/utils/trainControl.ts`, `trainControl.test.ts`; integrated into `trainSim.ts` and its tests |
| State and timing | `src/store/useMapStore.ts`: per-train controls, underground mode, depth reports, monotonic follow keys; `useSimNow.ts`: fresh time on action-driven renders |
| Fleet UI | `ui/TrainControlManager.tsx`, `BottomDock.tsx`, `FollowCard.tsx`; updated counts in `KpiCards.tsx`, arrivals in `StationPanel.tsx`, clock labels in `TopBar.tsx`, estimate qualification in `RoutePanel.tsx` |
| X-ray policy and geometry | `utils/underground.ts`, `scene3d/UndergroundWatcher.tsx`, `trainGeometry.ts`, `trainGeometry.test.ts` |
| Coordinated rendering | `MetroScene.tsx`, `Trains.tsx`, `Structures.tsx`, `SceneRig.tsx`, `RouteOverlay.tsx`; controls in `ui/UndergroundControls.tsx`, `SceneControls.tsx`, `ControlPanel.tsx` and `MapPage.tsx` |

No dependency, asset, geographic data or pipeline changes.

## 3. Outputs (measured)

| Measure | Result |
|---|---|
| Simulated fleet | 218 trains across the existing 12 routes / 9 lines |
| Tests | 49 passing: prior 40 + 6 control/motion/arrival tests + 3 train-geometry/visibility tests |
| Production 2D JS | 437.18 kB; 132.11 kB gzip |
| Lazy 3D JS | 1,071.45 kB; 289.22 kB gzip |
| CSS | 40.67 kB; 11.93 kB gzip |
| Existing geometry | Structures 522,356 triangles; city 473,180 triangles in 107 chunks, unchanged |
| Nominal motion | Existing hop durations and 218-train count retained; ramps up to 8 s each, capped at 25% of the hop; peak speed ≤60 km/h for a 45 km/h hop average |

The production build retains its existing large-3D-chunk advisory. Real-hardware FPS has not been measured.

## 4. Method

`TrainControl` contains `delayS` and nullable `heldAtS`, both in shared simulation seconds. Effective train time is `(heldAtS ?? now) - delayS`. Stop records the hold time once. Start adds elapsed hold time to delay; repeating a command is harmless. Bulk commands use one timestamp for every train. Clock pause/speed changes therefore cannot release a hold or introduce a jump.

All consumers pass the same controls to `service.stateAt`: models, camera, labels, manager, follow card and KPIs. Arrival predictions use the same effective time, exclude held trains (restart time is unknown), and return zero while a train is dwelling at that station. The static journey estimate is not a dispatch-aware planner; the UI explicitly says it excludes operator holds.

The easing profile integrates to exactly one existing hop over its original duration. It is a visual, nominal profile, not calibrated DMRC acceleration. Stop/Start itself remains an immediate hold/resume rather than physical braking.

Auto X-ray samples the leading/trailing edges and intervening carriage positions along the existing projected route. Only depth transitions are reported to React state. A depth report must belong to the current followed train, preventing stale reports after a switch. A single `groundVisible` selector controls all scene consumers. Manual mode wins; ending follow restores surface visibility only in Auto. City geometry stays loaded while hidden, avoiding a reload on each transition.

Three.js primary documentation informed the material and instancing choices: [Material](https://threejs.org/docs/pages/Material.html) and [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html). Existing instanced models and geographic projection are retained; no heavier model imports or invented alignments.

## 5. Verified

- `npx tsc -b`, `npm run lint`, `npm test`: clean; 49/49 tests.
- `npm run build`: succeeds, with only the existing large-chunk advisory.
- Unit checks cover holds in both directions and at a station, repeated/bulk commands, accumulated delay, other trains remaining unaffected, paused/speed-scaled simulation time, held-train arrival exclusion, resumed predictions, dwell “Now”, easing bounds/endpoints, full-consist portal visibility, grade direction, manual overrides and stale Auto reports.
- Real-time headless Chrome using `scripts/screenshot.mjs`, SwiftShader WebGL:
  - Desktop 1440 × 900: surface view, full manager and automatic X-ray following a stopped Yellow Line train.
  - Individual Stop/Start; Start while globally paused; Resume clock; Stop all (0 active / 218 stopped); speed ×8 retains holds; Start all (218 active / 0 stopped).
  - Search and line filtering; a map-hidden Red Line remains controllable; no page overflow.
  - Manual Surface override while following underground; return to Auto; manual Underground remains active after ending follow; Auto restores surface when not following.
  - Phone 390 × 844: manager layout, follow collapse, visible underground train, Start/Stop from the follow card, attribution readable.
  - Holds persist across 2D/3D switches; repeated Follow after Stop following/view switching works.

Session screenshot artifacts: `/tmp/metro-phase9-surface.png`, `/tmp/metro-phase9-manager-2d.png`, `/tmp/metro-phase9-underground.png`, `/tmp/metro-phase9-mobile.png` (the initial layout that exposed the overlap), `/tmp/metro-phase9-mobile-follow.png`, `/tmp/metro-phase9-desktop-final.png`. These are temporary review artifacts, not committed assets.

## 6. Issues found and fixed during verification

- The old “X-ray: hide ground” checkbox was checked when ground was visible. Replaced with explicit mode buttons.
- Follow keys restarted at 1 after ending follow, so `useCommand` could discard another follow command. Keys now increase across stops.
- Distant-dot positions were compacted after hiding trains, while colours were not. Both buffers now use the same compacted index.
- Phone manager covered the followed train. Follow now collapses it, with quick train controls retained on the follow card; the dock leaves room for multiline attribution.
- The wider follow card could overlap the manager at intermediate desktop widths. It is width-limited and stacks above the dock below 1280 px.

## 7. Limitations and open items

- Simulation holds are not operational dispatch: no signals, interlocking, collision avoidance or follower braking. Other trains can overlap a held train. Controls reset on reload.
- Easing, car dimensions, structural sizes and depth are nominal. Existing generic Kenney cars and station/tunnel envelopes remain; station-specific architecture, doors, rolling-stock variants, catenary and physical braking require a later sourced-data/asset phase.
- X-ray hides the whole city's surface context; it is not a moving excavated cutaway. Elevated structures remain drawn and can overlap underground infrastructure at interchanges.
- Static journey estimates exclude holds; the simulated station arrivals account for them.
- Human satellite-imagery review and real-GPU/phone frame-rate measurement remain pending from earlier phases.

## 8. Reproduce

```bash
npx tsc -b && npm run lint && npm test
npm run build
npx vite preview --host 127.0.0.1 --port 4173 --strictPort
```

Wait for the server-ready message. In another terminal:

```bash
node scripts/screenshot.mjs "http://127.0.0.1:4173/?view=3d" /tmp/metro-control.png 1440 900 16000
node scripts/screenshot.mjs "http://127.0.0.1:4173/?view=3d&underground=underground" /tmp/metro-xray.png 390 844 16000
```

Open **Train control**, choose a train and Stop/Start it, then Follow. The default Auto mode reveals it below ground. Choose Surface or Underground to override. The global clock pause freezes the service independently of individual holds.

## 9. Next phase

Stop for owner review and commit. Do not start Phase 10 without approval. Journey-planner enhancements remain the earlier proposal; a more detailed realism phase is also possible, but its scope and sources must be agreed first.
