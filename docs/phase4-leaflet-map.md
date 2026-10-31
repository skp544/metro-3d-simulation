# Delhi Metro 2D/3D Visualization: Phase 4 Leaflet 2D Map

**Completed:** 2026-10-31 (build); human imagery review in progress
**Dataset shown:** OSM snapshot `2026-10-31T12:28:36Z`; validation PASSED (0 errors, 2 warnings, 22 info)

This document is a **frozen summary of Phase 4**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§2D map), [DECISIONS.md](DECISIONS.md) (#23–#27) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

| Requirement ([REQUIREMENTS.md](REQUIREMENTS.md)) | Result |
|---|---|
| M1: OSM base map with attribution | ✅ OpenStreetMap by default, plus Light (CARTO) and Satellite (Esri) for review. Attribution covers tiles, OSM data (ODbL) and Wikipedia (CC BY-SA) |
| M2: lines in their colours; track type by line style | ✅ Solid = elevated, dashed = underground, dotted = at-grade, thin dash = unknown. Colour always stays the line's |
| M3: station markers, name on hover, details on click | ✅ Tooltip on hover. The popup shows Hindi name, lines, type, per-platform level vs Wikipedia, DMRC code, verified badge, conflicts, and OSM source links |
| M4: interchanges visually distinct | ✅ Larger marker with a black ring, drawn on top |
| M5: layer control per line; filters by station type and line | ✅ Left panel: 9 line toggles (show/hide all), 4 track-type toggles with km, 5 station-type toggles with counts, plus layers (stations, under construction, validation) |
| M6: validation overlay at issue locations | ✅ Coloured rings by severity with the message. The Validation card lists every located issue; clicking one flies to it |
| Exit: every line reviewed against satellite imagery | ⏳ **Partly done.** The 4 type conflicts were checked (§4); the full line-by-line review is a human task (§5) |

Verified by headless-Chrome screenshots at 1440×900 (overview), zoom 16 (Kashmere Gate: elevated Red over underground Yellow/Violet), 500×900 (narrow layout) and zoom 17–18 on satellite at the 4 conflict stations.

---

## 2. What was built

| File | Purpose |
|---|---|
| `src/data/loadNetwork.ts` | Loads the 6 GeoJSON files, the validation report and sources.json in parallel. Vite `?url` imports serve or emit them straight from `data/`, so there's one copy and nothing is bundled into the JS |
| `src/data/types.ts` | + `ValidationIssue` / `ValidationReport` (also used by `validate.ts`) |
| `src/store/useMapStore.ts` | zustand: hidden lines, track types and station types; layer toggles; fly-to target. Ready to be shared with the 3D view |
| `src/constants/map.ts` | Base layers, attribution, track-style table, draw order, severity colours. Rendering constants only, no geography |
| `src/components/map2d/MetroMap.tsx` | Map container: fit-to-network start (offset for the panel on desktop), base-layer switcher, zoom, panes for stacking, `#zoom/lat/lng` URL state, `?base=Satellite` |
| `src/components/map2d/SegmentLayer.tsx` | 312 segments with styles and a hover tooltip (line, from → to, type, km, "estimated") |
| `src/components/map2d/StationLayer.tsx` | 244 station markers and the details popup |
| `src/components/map2d/ValidationLayer.tsx` | Issue rings |
| `src/components/map2d/ConstructionLayer.tsx` | Phase 4 corridors (grey dashed, off by default) |
| `src/components/ui/ControlPanel.tsx` | Left floating card (collapsible; collapsed by default under 768 px) |
| `src/components/ui/ValidationPanel.tsx` | Bottom-right card: pass/fail, counts, clickable issue list |
| `src/pages/MapPage.tsx`, `src/App.tsx`, `src/index.css`, `index.html` | Page with loading and error states, card styling, title |
| `scripts/build-dataset.ts` | + the untagged-track inference rule (§4) |

**New dependencies:** `leaflet` 1.9.4, `react-leaflet` 5.0.0, `zustand` 5.0.16; dev: `@types/leaflet`.

**Production build:** 395 KB JS (120 KB gzip) + 31 KB CSS. The data ships as 7 separate assets (~550 KB total), loaded at runtime. Rendering uses a canvas renderer (`preferCanvas`).

---

## 3. How to use it for review

| To… | Do |
|---|---|
| Open on satellite at a place | `http://localhost:5173/?base=Satellite#17/28.66716/77.21663` (zoom/lat/lng) |
| Share the current view | Copy the URL: the hash updates as you pan and zoom |
| See every validation issue | Turn on Layers → Validation issues, or open the Validation card and click an item |
| Check one line | Line panel → Hide all, then tick that line |
| Find estimated track | Hover a dotted segment: the tooltip says "type estimated (untagged in OSM)" |
| Inspect a station's evidence | Click it: per-platform level, Wikipedia's layout, conflicts, OSM links |

---

## 4. Imagery review done in this phase

The 4 stations where OSM and Wikipedia disagree on type were checked on Esri imagery at zoom 17–18:

| Station | Sources | Imagery | Outcome |
|---|---|---|---|
| **Tis Hazari** (Red) | OSM untagged, Wikipedia elevated | Station box spans the road, on the viaduct line | ✅ Elevated confirmed |
| **Adarsh Nagar** (Yellow) | OSM untagged, Wikipedia elevated | Station over the road median, on the viaduct line | ✅ Elevated confirmed |
| **Shahdara** (Red) | OSM bridge, Wikipedia at-grade | Station roof beside the railway corridor | ❓ Level can't be judged from top-down imagery (no oblique view) |
| **Seelampur** (Red) | OSM layer=1, Wikipedia at-grade | Station roof beside the railway corridor | ❓ Same; needs street-level imagery or DMRC station info |

**Data fix that came out of it.** At Tis Hazari and Adarsh Nagar, the stations were already elevated (from Wikipedia), but the OSM track *through* each station had no bridge tag, so a few hundred metres drew as at-grade between two elevated stretches. The build now applies a narrow inference rule (DECISIONS #23): an untagged stretch takes its neighbours' type only if both neighbours share an explicit type **and** every station inside it agrees on Wikipedia (or there's no station inside and it's under 300 m). Exactly 3 stretches changed, 0.29 km in total: Tis Hazari 0.194 km, Adarsh Nagar 0.089 km, plus an 11 m sliver. They are marked `inferred:neighbours` and stay `estimated`. The long genuine at-grade Red Line section (Shastri Park, Welcome) and the underground↔elevated ramps are untouched. Validation still passes with the same counts.

---

## 5. Remaining review checklist (human)

A top-down satellite view can't reliably tell elevated from at-grade track; street-level imagery or DMRC station pages can. Items, in priority order:

1. **Shahdara, Seelampur:** settle elevated vs at-grade. Record the result in `data/manual/station_overrides.json` with the evidence.
2. **Rohini East:** type `unknown` (OSM `tunnel=building_passage`).
3. **Not found on Wikipedia (9):** Badarpur, GTB Nagar, IIT Delhi, Jama Masjid, North Pitampura - Prashant Vihar, Rajendra Nagar, Punjabi Bagh, Rohini East, Rohini West. Confirm position and type.
4. **Dhaula Kuan ↔ Durgabai Deshmukh South Campus walkway interchange:** add to `interchanges.json` if confirmed.
5. **Each line end to end:** hide all, show one line, follow it on Satellite and check that stations sit on the track and the dashed (underground) stretches match the portals.

After any manual edit: `npm run data:build && npm test`.

---

## 6. Limitations

- **Satellite tiles (Esri World Imagery)** are for review use; check Esri's terms before any public deployment. **OSM's tile server** is fine for development but not for production traffic (OSMF tile usage policy). **CARTO** basemaps have their own usage limits. Production needs its own tile hosting or a provider.
- **No station search, no route highlighting, no 2D/3D toggle yet:** those are Phase 8 (UI). The "work in progress" entries for Rapid Metro, Aqua Line and Namo Bharat are also Phase 8.
- **Narrow screens** were checked at 500 px (headless Chrome's minimum width); not yet tested on a real phone.
- **Track-type styling at overview zoom:** at zoom ≤ 11 the dashes are small, so the type distinction is clearer once zoomed in.

---

## 7. Reproduce

```bash
npm run dev            # http://localhost:5173
npm run build && npm run preview
npm run data:build && npm test   # after any data change
```

---

## 8. Next: Phase 5 (3D foundations)

Projection module (`src/utils/projection.ts`, local tangent plane centred from the data), a React Three Fiber scene with a ground plane and camera controls, and track ribbons per type built from the same segments. Exit: the 3D track lines up with the 2D map at the same coordinates.

**Waiting for approval to start Phase 5.** The human imagery review in §5 can continue in parallel.
