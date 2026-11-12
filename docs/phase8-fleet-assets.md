# Phase 8 revision: distinct regional rolling stock

**Date:** 2026-11-12. The user requested RRTS and Noida Metro assets that look different from Delhi Metro, after the regional network expansion.

## Goal and result

The renderer now selects a visual fleet per line. DMRC retains the existing Kenney subway cars. RRTS uses streamlined cab/trailer assets, Aqua uses metro cab/intermediate assets, and Meerut Metro uses a commuter cab and metro intermediate. The formations are six, four and three cars respectively. Each has an independent approximate livery rather than inheriting only the route's map colour.

| Fleet | Appearance | Formation | Rendered triangles per formation |
|---|---|---:|---:|
| DMRC | Existing stainless body and line stripe | 6 | approximately 9k |
| Namo Bharat RRTS | Long tapered cab, silver/red, roof pantographs | 6 | 51,520 |
| Aqua Line | Upright metro cab, silver/aqua | 4 | 32,208 |
| Meerut Metro | Commuter cab with pantograph, silver/green, blue/orange details | 3 | 27,432 |

## Assets and sources

Five GLBs (approximately 1.68 MB total) come from the [Modern Rail and Metro Network pack by 3D Assets](https://3dassets.dev/packs/modern-rail-and-metro-network), published as CC0 1.0. They are AI-generated generic assets. Individual links, original publisher geometry statistics and licensing metadata are in `public/models/regional/manifest.json`; `docs/ASSETS.md` records measured rendered counts. No third-party scripts or remote model dependencies were installed. Files are served locally.

[Alstom's manufacturer announcement](https://www.alstom.com/press-releases-news/2021/7/alstom-begins-manufacturing-modern-commuter-transit-trains-delhi) and the [Alstom/NCRTC brochure](https://ncrtc.in/wp-content/uploads/2023/04/Alstom-Brochure-D2-3.pdf) support six-car regional and three-car Meerut formations. NMRC's indexed [fleet document](https://www.nmrcnoida.com/writereaddata/Portal/Tender/141_1/2_RFP.pdf) describes its four-car DT+M+M+DT formation (current direct URL may redirect). Dimensions and colour swatches are nominal, not manufacturer measurements or official HEX values.

## Implementation

`trainFleet.ts` owns visual profiles, car offsets, instance capacities and regional geometry preparation. Source materials are baked into vertex colours, with named livery colours overridden. This preserves body, glazing and running-gear contrast while merging every car into a single geometry. Quantized attributes are unpacked before world transforms, and height is measured to the shell so raised pantographs do not squash the body. Cached source GLTF scenes remain unmodified. Regional geometries/materials are disposed on teardown.

`Trains.tsx` places each formation around the simulated position, reverses the final cab, follows the real path and retains the existing near/far visibility and train-follow behavior. Buffer capacities derive from each formation: a six-car RRTS has two cabs and four intermediates. There are 33 instanced train meshes across the twelve lines. The 3D footer credits both publishers.

## Verification and limits

Build/type checking and lint pass. Geometry tests parse all downloaded assets, validate finite attributes, bounds, rail-level grounding, retained material colour distinctions, per-car triangle limits and unchanged source bounds. Formation tests validate coach counts, centred spacing and buffer capacity. Headless Chrome renders were inspected while following NB-01, AQ-01 and MM-01; there were no browser exceptions. The Meerut shot also showed a six-car Namo Bharat train alongside the shorter three-car local formation.

Models are visually differentiated approximations. Source cab shapes, doors, pantographs and shoegear are not exact replicas of NCRTC or CRRC stock. No geographic data, service speed, timetable, fare or station architecture changed. Models remain limited to a 5 km radius at close zoom; real hardware FPS remains unmeasured. The new models are heavier than the old Kenney cars.

## Reproduce and next step

```sh
npm test
npm run lint
npm run build
npm run preview -- --port 4173
```

Open `?view=3d`, then click NB, AQ or MM rows in the simulated train list to follow each fleet. Review the silhouettes/liveries; exact operator replicas would require appropriately licensed specialist assets. This revision stops here for review; Phase 9 remains separate.
