# Delhi Metro 2D/3D Visualization: Phase 3 Validation

**Completed:** 2026-10-31
**Dataset validated:** built from OSM snapshot `2026-10-31T12:28:36Z` + Wikipedia snapshot of 2026-10-31
**Report:** `data/metadata/validation_report.json`

This document is a **frozen summary of Phase 3**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (§Validation), [DECISIONS.md](DECISIONS.md) (#18–#22) and [CODE_SUMMARY.md](CODE_SUMMARY.md).

---

## 1. Goal and result

| Goal (from the roadmap) | Result |
|---|---|
| An automated script that checks every requirement in the brief (invalid GeoJSON, missing coordinates, duplicate IDs, inconsistent names, missing geometry, disconnected segments, station order, interchange consistency) | ✅ `scripts/validate.ts`, 22 checks |
| A report with errors, warnings and statistics | ✅ `validation_report.json`: per-check status, statistics, reference comparison, and every issue with feature IDs and a map location |
| Exit criteria: 0 errors, warnings documented | ✅ **PASSED: 0 errors, 2 warnings, 22 info** (§4) |

**The validator found a real bug in the Phase 2 build** (§3), which has been fixed.

---

## 2. What was built

| File | Purpose |
|---|---|
| `scripts/validate.ts` | Re-checks `data/processed/` independently: it shares no logic with the build. Usage: `node scripts/validate.ts [dir] [reportPath]`. Exits 1 on errors |
| `scripts/validate.test.ts` | 10 tests: the real data passes, and each of 8 deliberate corruptions is caught. Also tests the loop-aware projection |
| `scripts/fetch-wikipedia.ts` | Now also captures each article's infobox "Stations" and "Line length" (summing per-branch values, e.g. Blue) as reference figures |
| `package.json` | `data:build` now runs the build **then validation**. Added `data:validate` and `test` |

### Checks

| Code | Severity | What it checks | Result |
|---|---|---|---|
| GEOJSON_INVALID | error | FeatureCollection, expected geometry type, finite `[lng, lat]` positions | pass |
| SCHEMA | error | Required properties, types and enum values; `stationType` consistent with platforms | pass |
| OUT_OF_BOUNDS | error | Every coordinate inside 28.2–28.9 N, 76.7–77.6 E (catches swapped lat/lng) | pass |
| DUPLICATE_ID | error | IDs unique per file | pass |
| MISSING_GEOMETRY | error | Every line has geometry, every branch has a route | pass |
| BROKEN_REFERENCE | error | All referenced IDs exist; station ↔ line membership agrees both ways; branch lists match routes | pass |
| SEGMENT_GAP | error | Segments join within 1 m and cover first → last station in order | pass |
| LENGTH_INCONSISTENT | error | Segment `lengthKm` vs geometry (±1%); route = sum of segments (±0.5%) | pass (**failed before the fix**) |
| STATION_ORDER | error | Each station projects onto its route after the previous one | pass |
| INTERCHANGE_MISMATCH | error | `isInterchange` ⇔ more than one line; interchange file ⇔ stations; manual merges applied | pass |
| NETWORK_DISCONNECTED | error | All 244 stations form one connected graph | pass (1 component) |
| DEGENERATE_GEOMETRY | warning | No repeated consecutive positions | pass (**187 before the fix**) |
| STOP_KM_DRIFT | warning | Re-projected position agrees with the stored `stopKm` within 100 m | pass |
| STATION_FAR_FROM_LINE | warning | Station within 150 m of each of its lines (300 m for interchanges) | pass |
| PLATFORM_FAR_FROM_TRACK | warning | Each platform within 30 m of its line's track | pass |
| DUPLICATE_NAME | warning | No two stations share a name | pass |
| NEARBY_STATIONS | warning | No two separate stations within 300 m (possible missed interchange) | pass |
| REFERENCE_COUNT | warning | Station count per line = Wikipedia infobox | pass (9 of 9) |
| REFERENCE_LENGTH | warning | Line length within ±5% of the Wikipedia infobox | **2 warnings** |
| SOURCE_CONFLICT | info | Features whose sources disagree | 11 noted |
| UNVERIFIED_STATION | info | Stations without a second-source confirmation | 11 noted |
| CORRIDOR_OVERLAP | info | Different lines within 5 m of each other for over 200 m | none |

---

## 3. Bugs found and fixed

| Found by | Problem | Cause | Fix |
|---|---|---|---|
| LENGTH_INCONSISTENT | 3 end-of-line segments (`blue_main_057`, `green_main_020`, `green_kirti_nagar_002`) had geometry 3–33 km long for a 1–2 km segment | When a terminus measured a hair past the track's end (float error), the build's slicer fell back to the **start** of the line | Clamp to the final track segment (`build-dataset.ts`) |
| DEGENERATE_GEOMETRY | 187 segments had a repeated point | Rounding to 6 decimals collapsed a cut point onto the next vertex | De-duplicate after rounding |
| STOP_KM_DRIFT | 45 stations drifted by 100–180 m (validator side) | The validator's flat-map scale used equator constants (about 0.25% off at 28.6° N) | Geodesic segment lengths for distance along the line |
| STATION_FAR_FROM_LINE | Punjabi Bagh West 154 m from the Green line | An interchange's point is the mean of its per-line stations, which are joined by a walkway | 300 m limit for interchanges; per-line accuracy is covered by the 30 m platform check |

Phase 2 figures (station, interchange and segment counts) are unchanged by these fixes. Only the geometry of 3 segments changed.

---

## 4. Results

### 4.1 Summary statistics

| Metric | Value |
|---|---|
| Lines / branches / stations / interchanges | 9 / 12 / 244 / 26 (23 shared ref, 3 proximity) |
| Segments | 312 |
| Track km | 364.3: 255.4 elevated, 100.9 underground, 7.8 at-grade, 0.19 unknown |
| Track km with estimated type (untagged OSM) | 2.2% |
| Stations confirmed by Wikipedia | 233 / 244 (95.5%) |
| Station types | 176 elevated, 57 underground, 8 mixed, 2 at-grade, 1 unknown |
| Network | 1 connected component |

### 4.2 Reference comparison (Wikipedia infobox)

| Line | Stations (ours / Wikipedia) | Length km (ours / Wikipedia) | Difference |
|---|---|---|---|
| Red | 29 / 29 | 33.37 / 34.55 | −3.4% |
| Yellow | 37 / 37 | 47.69 / 49.02 | −2.7% |
| Blue | 58 / 58 (per branch) | 63.84 / 64.62 | −1.2% |
| Green | 24 / 24 | 27.85 / 28.79 | −3.3% |
| Violet | 34 / 34 | 44.86 / 46.34 | −3.2% |
| Pink | 46 / 46 | 70.65 / 73.49 | −3.9% |
| Magenta | 33 / 33 | 47.44 / 50.18 | **−5.5%** ⚠ |
| Grey | 4 / 4 | 4.86 / 5.19 | **−6.4%** ⚠ |
| Airport Express | 7 / 7 | 23.73 / 22.70 | +4.6% |

**All station counts match.** Our lengths are measured along the track from the first stop to the last. They come out about 3% below Wikipedia because official route lengths usually run to the ends of the terminal tracks. That bias fully explains Grey's −6.4% (0.33 km on a 5 km line). Magenta's −5.5% is a little beyond it. The Airport Express is +4.6%, possibly because the infobox figure predates the 2023 extension to Yashobhoomi Dwarka Sector 25 (**not verified**). None of these suggests a geometry error, and the station-level checks all pass.

### 4.3 Documented warnings and info (no action required to proceed)

| Item | Detail | Handling |
|---|---|---|
| REFERENCE_LENGTH ×2 | Magenta, Grey (above) | Accepted: a measurement convention, not missing track |
| SOURCE_CONFLICT ×7 (colours) | OSM line colours differ from Wikidata | Expected; Wikidata chosen (DECISIONS #2) |
| SOURCE_CONFLICT ×4 (station type) | Shahdara, Seelampur: OSM elevated vs Wikipedia at-grade (OSM kept). Adarsh Nagar, Tis Hazari: OSM untagged, Wikipedia elevated (used) | **Verify against satellite imagery in Phase 4** |
| UNVERIFIED_STATION ×11 | Badarpur, GTB Nagar, IIT Delhi, Jama Masjid, North Pitampura - Prashant Vihar, Rajendra Nagar, Punjabi Bagh, Rohini East, Rohini West (no Wikipedia match), Shahdara, Seelampur (conflict) | Review in Phase 4; fix through `station_overrides.json` with evidence |

Still open from Phase 2: Rohini East's type is `unknown`; Dhaula Kuan ↔ Durgabai Deshmukh South Campus walkway interchange is not linked; 25 stations have no DMRC code.

---

## 5. Limitations of the validation

- **Internal consistency, not ground truth.** The checks prove the data is self-consistent and matches Wikipedia's counts. They can't prove a station sits on the right street corner. That is Phase 4's job (visual review against imagery).
- **Wikipedia is the only second source.** Counts and lengths are compared with one secondary source; no DMRC dataset was available.
- **Corridor overlap** samples every 100 m with a 5 m tolerance, so overlaps shorter than about 200 m aren't reported.
- **Station order** is checked by projecting each platform's coordinate; a station at a branch junction (Yamuna Bank) uses its mean platform position.

---

## 6. Reproduce

```bash
npm run data:build     # build + validate (exit 1 on errors)
npm run data:validate  # validate only
npm test               # validator self-tests (10)
npx tsc -b && npm run lint
```

---

## 7. Next: Phase 4 (Leaflet 2D map)

The validated GeoJSON on an OSM base map:
- Lines in their colours, with line style showing track type
- Station markers and popups; interchanges styled differently
- Per-line layer control, plus filters by station type and line
- A **validation overlay** that draws each issue from `validation_report.json` at its location

Phase 4 also includes manually reviewing every line against satellite imagery, starting with the 4 type conflicts and 11 unverified stations above.

**Waiting for approval to start Phase 4.**
