# Phase 8 repair: nearby-station walking pathways

Date: 2026-11-12. Scope: the five station pairs in the owner's validation screenshot; repair of the existing regional extension.

## Goal and result

Make walking connections visible and resolve the five proximity warnings without merging separate stations. These five bidirectional pedestrian edges already existed in `data/manual/transfers.json`, generated `station_transfers.geojson` and the route planner.

| Separate station pair | Estimated walking time |
| --- | --- |
| Anand Vihar ↔ Anand Vihar (Namo Bharat) | 5 min |
| New Ashok Nagar ↔ New Ashok Nagar (Namo Bharat) | 4 min |
| Shaheed Sthal ↔ Ghaziabad (Namo Bharat) | 6 min |
| Sarai Kale Khan - Nizamuddin ↔ Sarai Kale Khan (Namo Bharat) | 5 min |
| Noida Sector 52 ↔ Noida Sector 51 | 8 min |

## Implementation and method

- `TransferLayer.tsx`: amber dashed paths with a white outline; permanent walking-time/schematic labels at zoom 15+, hover labels further out; click a path or label for station details.
- `TransferLinks.tsx`: matching cased dashes, shared GeoJSON projected through the existing projection, clickable labels within 2.2 km of the camera, with first-frame HTML deferral. Heights are schematic; route dimming, station/line filters and underground handling remain integrated.
- `StationPanel.tsx`: walking-pathway explanation above the existing destination links and connection notes.
- `validate.ts`: validate links before classifying nearby pairs. A valid explicit link produces `WALKING_TRANSFER` info, including estimated time and straight-line separation. Missing or invalid links retain `NEARBY_STATIONS` warnings. Only valid links connect the network.
- Data generation remains unchanged; regenerate metadata with `npm run data:build`. No stations, geographic coordinates, surveyed path shapes or physical bridge structures were added.

## Outputs and verification

288 stations, 378 segments, 30 shared interchanges and 5 separate-station walking links remain unchanged. Validation is **0 errors, 2 warnings, 73 info**, previously 0 / 7 / 68. The two retained warnings are existing reference-length differences.

`npx tsc -b`, `npm run lint`, `npm test` (**77 passing**), `npm run data:build` and production Vite build pass. Validator regressions check all five real pairs, invalid walking times/geometry, missing connections and reversed endpoints. Existing routing tests cover bidirectional and walk-only journeys.

Visual reproduction, after `npm run build` and `npx vite preview --host 127.0.0.1 --port 4173`:

```sh
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=2d#17/28.58630/77.37415' /tmp/walking-noida-2d.png 1440 900 6000
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=3d&at=28.58630,77.37415,1200' /tmp/walking-noida-3d.png 1440 900 16000
```

## Limitations and boundary

Path lines connect mapped station centres. They are **schematic**, not surveyed pedestrian alignments or entrance-to-entrance navigation. Walking times are **estimated**, separate ticketing/exit restrictions remain in source notes, and no planned skywalk or travelator is asserted operational. Original source references stay in `data/manual/transfers.json`. OpenStreetMap attribution remains visible.

Owner review/commit follows; expanded journey planning, people and further phases remain separate work.
