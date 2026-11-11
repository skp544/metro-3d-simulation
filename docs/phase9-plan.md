# Phase 9 research and plan: train control and underground visibility

**Date:** 2026-11-11. The owner requested research, a plan, then implementation of train management, Start/Stop, realism and underground visibility. This replaces the previously proposed Phase 9 journey-planner scope. The owner selected automatic X-ray while following plus a manual toggle.

## Findings

- `trainSim.ts` is deterministic from one simulation clock. There are 218 trains; individual holds need independent offsets, shared by rendering, following, lists and arrival predictions.
- `Trains.tsx` explicitly hides a train below −2 m while `showGround` is true. Following does not reveal it. The old Layers X-ray checkbox is also inverted (checked means ground visible).
- Hiding only the ground leaves city buildings and roads occluding underground trains. Tunnel shells and rails already exist below ground; exposing them requires coordinated visibility changes.
- Carriages follow route curves but are horizontal on ramps. Motion between station dwells changes speed instantly.

## Research and design choices

Primary sources consulted 2026-11-11:

- [Three.js Material](https://threejs.org/docs/pages/Material.html): world-space clipping planes require local clipping; transparent materials and depth-write settings allow visible tunnel shells. A moving cutaway affects ground, buildings, roads, trees and their shadows. Use a whole-scene X-ray mode now, retaining actual train depth, with surface scenery hidden and translucent tunnel envelopes.
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): repeated train models can share geometry/materials; update instance matrices once per frame. Keep the current instancing and distance-based detail rather than importing heavier assets.

Motion and structural dimensions remain **nominal**, service remains **simulated**, arrival times **estimated**. No new geographic data, station types, official livery, DMRC operational claims or third-party assets.

## Implementation sequence

1. Pure hold/resume time offsets, idempotent single/bulk commands. The global clock pause stays separate. Held trains have no scheduled arrival until restarted; resumed trains retain accumulated delay. Test holds in both directions, at stations, over repeated commands and clock changes.
2. Train Control Manager available in both views: entire fleet independent of map filters; search, line/status filters, active/held counts, per-train Start/Stop, explicit Start all/Stop all, Follow in 3D. Keep camera Stop following distinct from Stop train.
3. Auto / Surface / Underground controls. Auto checks the followed train's whole consist so entry/exit does not hide half a train. Manual modes override Auto. X-ray hides ground/city, exposes tunnel rails and translucent nominal envelopes, and shows an explanatory badge.
4. Smooth nominal acceleration/braking around station stops while retaining existing travel durations, train count and route estimates. Pitch cars along the track grade and keep line colours correct for distant train dots.
5. Type-check, lint, tests, production build; actual screenshots and interaction checks for controls, underground follow, manual override, 2D and mobile. Record measured outputs and limitations in the phase summary; update living docs.

## Boundaries and later work

Start/Stop is an immediate simulation hold/resume, not an operational braking or signalling system. No collision avoidance, interlocking, real fleet dispatch or real-time feeds. Controls last for the current page session and survive 2D/3D switching. Train-specific models, doors, platform layouts, catenary and realistic driving physics require sourced asset/data work in a later approved phase. Journey planner enhancements are deferred until the owner selects the next phase.
