# Delhi Metro 2D/3D Visualization: Phase 2 Dataset Build

**Completed:** 2026-10-31
**OSM snapshot:** `2026-10-31T12:28:36Z` (`data/raw/osm/2026-10-31.json`)
**Wikipedia snapshot:** fetched 2026-10-31 (`data/raw/wikipedia/2026-10-31.json`; revision IDs are in `data/metadata/sources.json`)

This document is a **frozen summary of Phase 2**. The living versions are [ARCHITECTURE.md](ARCHITECTURE.md) (pipeline and schema), [DECISIONS.md](DECISIONS.md) (#10–#17) and [CODE_SUMMARY.md](CODE_SUMMARY.md) (current state).

---

## 1. Goal and result

| Goal (from the Phase 1 roadmap) | Result |
|---|---|
| Turn open sources into normalised GeoJSON that both Leaflet and Three.js can use | ✅ 6 GeoJSON files in `data/processed/` |
| Every file generated from a dated snapshot, never hand-edited | ✅ `npm run data:fetch` → `npm run data:build`. The build is offline and deterministic |
| Provenance on every feature | ✅ `source[]`, `verified`, `estimated`, `conflicts[]` |
| Nothing invented | ✅ Unverifiable values are `unknown` or flagged; every gap is in the quality report |

**Exit criteria met:** the build finishes with **0 errors**. 50 warnings and info items are logged, and the ones that need action are in §6.

---

## 2. What was built

| File | Purpose |
|---|---|
| `scripts/fetch-osm.ts` | One Overpass query covering route masters, routes, track ways (with geometry), stop nodes, stop areas, station objects and construction ways. Retries with exponential backoff (the public server returns 429/502 when busy) |
| `scripts/fetch-wikipedia.ts` | Station tables from the 9 line articles (all tables, so the Blue and Green branches are included), throttled with retry |
| `scripts/build-dataset.ts` | Chains the track, snaps stops, merges stations, detects interchanges, cuts segments, classifies station types, writes the GeoJSON and metadata |
| `src/data/types.ts` | Schema types shared by the scripts and the app |
| `data/manual/lines.json` | Line config: Wikidata colours, OSM route_master, canonical and reverse relation per branch, Wikipedia article |
| `data/manual/interchanges.json` | Proximity threshold (250 m) and `merge`/`separate` correction lists (empty) |
| `data/manual/station_overrides.json` | Per-station corrections (empty) |
| `package.json` | `data:fetch`, `data:build` scripts; `@turf/turf` (runtime), `@types/geojson` (dev) |
| `tsconfig.node.json` | Now type-checks `scripts/` as part of `npm run build` |

---

## 3. Outputs

| File | Features | Contents |
|---|---|---|
| `data/processed/metro_lines.geojson` | 9 | One MultiLineString per line (one part per branch), colour, branch station lists |
| `data/processed/metro_routes.geojson` | 12 | One LineString per branch, ordered `stationIds`, `stopKm` (distance along the route) |
| `data/processed/metro_segments.geojson` | 312 | Stop-to-stop pieces, split again wherever the track type changes |
| `data/processed/metro_stations.geojson` | 244 | Physical stations with per-line platforms |
| `data/processed/interchange_stations.geojson` | 26 | Interchange stations and the evidence for each |
| `data/processed/metro_under_construction.geojson` | 12 | OSM construction ways (Phase 4 layer) |
| `data/metadata/sources.json` | — | Snapshot timestamps, Wikipedia revision IDs, licences, and what each source was used for |
| `data/metadata/data_quality_report.json` | — | Counts, km by type per line, and every issue with its OSM IDs |

Total size is 536 KB. Coordinates are rounded to 6 decimal places (about 0.1 m), with one feature per line so diffs stay readable.

---

## 4. Network figures

### 4.1 Per line

"Track km" is the route length between the first and last stop, measured from OSM geometry. Platform types are counted per line (an interchange counts once on each line).

| Line | Branches | Stations | Track km | Elevated km | Underground km | At-grade km | Platforms E / U / G / ? |
|---|---|---|---|---|---|---|---|
| Red | 1 | 29 | 33.37 | 30.08 | 0 | 3.10 | 26 / 0 / 2 / 1 |
| Yellow | 1 | 37 | 47.69 | 24.32 | 23.19 | 0.18 | 17 / 20 / 0 / 0 |
| Blue | 2 (main, Vaishali) | 57 | 63.84 | 58.10 | 3.36 | 2.39 | 52 / 4 / 1 / 0 |
| Green | 2 (main, Kirti Nagar) | 24 | 27.85 | 27.68 | 0 | 0.17 | 23 / 0 / 1 / 0 |
| Violet | 1 | 34 | 44.86 | 30.78 | 14.08 | 0 | 23 / 11 / 0 / 0 |
| Pink | 1 (loop via Maujpur-Babarpur) | 46 | 70.65 | 51.11 | 18.14 | 1.40 | 34 / 12 / 0 / 0 |
| Magenta | 2 (main, Majlis Park–Deepali Chowk) | 33 | 47.44 | 23.08 | 24.01 | 0.36 | 17 / 16 / 0 / 0 |
| Grey | 1 | 4 | 4.86 | 2.58 | 2.08 | 0.20 | 2 / 2 / 0 / 0 |
| Airport Express | 1 | 7 | 23.73 | 7.64 | 16.09 | 0 | 1 / 6 / 0 / 0 |

Red also has 0.19 km of `unknown` track at Rohini East. Nearly all at-grade km comes from untagged OSM ways, so it is marked `estimated`. The only exception is 0.15 km on Magenta, which is explicitly tagged `cutting`.

**Station counts match Wikipedia exactly for all 9 lines.** Network total: 244 unique stations (271 counting each interchange once per line).

### 4.2 Station types

| Type | Stations | Meaning |
|---|---|---|
| Elevated | 176 | — |
| Underground | 57 | — |
| Mixed | 8 | Interchange whose platforms are at different levels: Azadpur, Janakpuri West, Kashmere Gate, Kalkaji Mandir, Kirti Nagar, Lajpat Nagar, Netaji Subhash Place, Welcome |
| At-grade | 2 | Shastri Park, Yamuna Bank |
| Unknown | 1 | Rohini East (OSM `tunnel=building_passage`) |

233 of 244 stations are **verified**: every platform matched a Wikipedia row that agrees on the type.

### 4.3 Interchanges (26)

| Evidence | Count | Stations |
|---|---|---|
| Shared OSM `ref` (DMRC station code) | 23 | Anand Vihar, Azadpur, Botanical Garden, Haiderpur Badli Mor, Central Secretariat, Dwarka Sector 21, Dwarka-Kakrola, Hauz Khas, Inderlok, Dilli Haat-INA, Janakpuri West, Kashmere Gate (3 lines), Kalkaji Mandir, Karkarduma, Lajpat Nagar, Mandi House, Majlis Park, Mayur Vihar-I, Netaji Subhash Place, Punjabi Bagh West, Rajiv Chowk, Rajouri Garden, Welcome |
| Proximity (different refs, under 250 m) | 3 | Kirti Nagar (150 m), New Delhi (117 m), Madhuban Chowk (215 m) |

Phase 1 found that exact name matching catches only 13 of these.

---

## 5. Method highlights

| Problem | How it was solved |
|---|---|
| OSM stores each line's station separately (Rajiv Chowk = a Blue object and a Yellow object) | Group station objects by `ref`, then merge stations on different lines within 250 m |
| The Pink Line passes Maujpur-Babarpur twice | Each stop is snapped by searching forward from the previous stop, so it lands on the correct pass |
| Stop order could be wrong in OSM | Each stop must be within 50 m of the track and come after the previous one. The opposite-direction relation must have exactly the reverse sequence. **All 12 branches pass** |
| Untagged track ways (53) | Treated as at-grade by OSM convention but marked `estimated`; Wikipedia's value wins at stations |
| An explicit OSM tag disagrees with Wikipedia | Keep OSM and log the conflict |
| Station names drift between sources ("Lal Quila" vs "Lal Qila") | Fuzzy matching (85% similarity, or containment that matches exactly one row). All 15 non-exact matches were checked by hand and are correct |
| 8 Red Line stops have no stop area in OSM | Matched to the same-name station object (all at 0 m) |
| `turf.lineSliceAlong` crashes on floating-point overrun | Replaced with a slicer that uses the track's own cumulative distances; segments join exactly |

**Bugs found and fixed during the build:**
- The Overpass query originally returned stop nodes without coordinates (`out tags`). Changed to `out body`.
- Wikipedia rate-limited parallel requests. Requests are now throttled with retry.

---

## 6. Open quality items (for Phase 3 / 4 review)

| # | Item | Count | Severity | Suggested handling |
|---|---|---|---|---|
| 1 | Type conflict, explicit OSM tag vs Wikipedia: **Shahdara**, **Seelampur** (Red); OSM elevated, Wikipedia at-grade | 2 | Warning | Check against satellite imagery in the Leaflet phase, then add a `station_overrides.json` entry with evidence |
| 2 | Type conflict, untagged OSM: **Adarsh Nagar** (Yellow), **Tis Hazari** (Red); Wikipedia's elevated was used | 2 | Info | Confirm with imagery |
| 3 | Not found in Wikipedia: Badarpur, GTB Nagar, IIT Delhi, Jama Masjid, North Pitampura - Prashant Vihar, Rajendra Nagar, Punjabi Bagh, Rohini East, Rohini West | 9 | Warning | Mostly naming differences (GTB Nagar = Guru Tegh Bahadur Nagar; North = Uttari Pitampura). Type comes from OSM only |
| 4 | Unknown type: Rohini East | 1 | Info | Check with imagery |
| 5 | No DMRC station code in OSM (IDs fall back to `stn_osm_*`), e.g. Shaheed Sthal, Jhilmil, Burari, Deepali Chowk, Noida Sector 52 | 25 | Info | IDs will change if OSM adds codes; acceptable for now |
| 6 | Walkway interchange **Dhaula Kuan ↔ Durgabai Deshmukh South Campus** not linked (too far for the 250 m merge) | 1 | Info | Add to `interchanges.json` `merge` once a source confirms it |
| 7 | Under-construction ways have `lineId: null` | 12 | Info | OSM doesn't record the line; assign by hand if needed |
| 8 | Name variants: New Delhi / New Delhi Airport Express Terminal | 1 | Info | Kept as an alias |

---

## 7. Limitations

- **One source for geometry and track type.** OSM is the only open, track-accurate source. Segment `verified` is therefore always false; Wikipedia only covers stations.
- **Station coordinates** are the mean of the per-line OSM station objects, not an official DMRC point.
- **Platform coordinates** are the mean of that line's stop positions (both directions).
- **No heights or depths.** 3D will use the nominal values in ARCHITECTURE.md, labelled as estimated.
- **Colours** are Wikidata's, not DMRC-published (`colorOfficial: false`).
- **Snapshot drift:** a new `data:fetch` may change counts or IDs. The quality report records which snapshot each build used.
- **Licence:** the processed data derives from OSM, so it is ODbL if published.

---

## 8. Reproduce

```bash
npm run data:fetch   # network: new OSM + Wikipedia snapshots in data/raw/
npm run data:build   # offline: data/processed + data/metadata; exits 1 on errors
npx tsc -b && npm run lint
```

---

## 9. Next: Phase 3 (validation)

A standalone `scripts/validate.ts` that re-checks the processed files independently of the build: schema, bounds, IDs, connectivity, ordering, interchange consistency, and counts and lengths against Wikipedia. It writes `data/metadata/validation_report.json`. The checks are listed in ARCHITECTURE.md §Validation. It must allow the Pink loop's repeated station.

**Waiting for approval to start Phase 3.**
