# Delhi Metro 2D/3D Visualization: Phase 1 Research and Plan

**Research date:** 2026-10-31
**OSM snapshot used for the measurements below:** Overpass API, `timestamp_osm_base` 2026-10-31T11:54Z

This document covers research and planning only. No processed dataset or application code exists yet.

## Legend

| Tag | Meaning |
|---|---|
| **Verified (OSM)** | Measured directly from the OSM snapshot named above |
| **Reported** | Published by a secondary source (Wikipedia, news). Not cross-checked against DMRC |
| **Unverified** | Single source of unknown quality, or a projection |
| **Unknown** | No reliable source found |

Dataset availability uses the four states the brief asked for: **Available**, **Partially available**, **Not available**, **Requires extraction / manual verification**.

---

## 1. Network overview

| Item | Value | Status | Source |
|---|---|---|---|
| Operator | Delhi Metro Rail Corporation (DMRC) | Reported | — |
| DMRC network size (2025 year-end / 2026) | ~416.5 km, 303 stations, "12 lines" | Reported | [Daily Pioneer](https://dailypioneer.com/news/delhi-metro-sets-new-benchmark-with-99-95-punctuality-in-2026) |
| Earlier figure (Mar 2025) | ~395 km, 289 stations | Reported | [Daily Pioneer](https://www.dailypioneer.com/cities/delhi-news/https://dailypioneer.com/news/delhi-metro-handles-235-8-crore-passenger-journeys-in-2025) |
| DMRC-operated lines with OSM route relations | 9 lines (shown below; Blue counted once) | Verified (OSM) | Overpass `network="Delhi Metro"` |
| Unique station names on those 9 lines | **257** | Verified (OSM) | Route relation stop members |
| Sum of per-line station counts (interchanges counted once per line) | 271 | Verified (OSM) | Same |

**How to read the "303 stations" figure:** 271 per-line stations + 11 Rapid Metro Gurugram + 21 Noida Aqua Line = 303. That matches DMRC's "12 lines" framing, so the official count most likely counts each interchange once per line and includes Rapid Metro Gurugram and the Aqua Line. **This is my inference, not a published breakdown.** The Aqua Line is operated by NMRC, not DMRC.

**Scope (decided 2026-10-31):** DMRC lines only. Rapid Metro Gurugram, the Noida Aqua Line and Namo Bharat/RapidX are **not** in the dataset. The UI lists them as "work in progress" entries, with no geometry.

---

## 2. Metro lines and colours

### 2.1 Operational lines: OSM measurements

Track length is the sum of each route relation's way geometry in one direction. It is a geometric measurement, not the official route length.

| OSM ref | Line | Termini (OSM) | Stations (OSM, unique) | OSM track length (one direction) | Reported length / stations | Geometry |
|---|---|---|---|---|---|---|
| 1 | Red | Rithala ↔ Shaheed Sthal (New Bus Adda) | 29 | 33.4 km | — | Available |
| 2 | Yellow | Samaypur Badli ↔ Millennium City Centre Gurugram | 37 | 47.7 km | 49.02 km / 37 ([Wiki](https://en.wikipedia.org/wiki/Yellow_Line_(Delhi_Metro))) | Available |
| 3 | Blue: main branch | Dwarka Sector 21 ↔ Noida Electronic City | 50 | 55.6 km | — | Available |
| 4 | Blue: Vaishali branch (via Anand Vihar ISBT, Kaushambi) | Yamuna Bank ↔ Vaishali | 8 (Yamuna Bank shared with the main branch) | 8.2 km | — | Available |
| 5 | Green (main + branch) | Inderlok ↔ Brigadier Hoshiyar Singh; Kirti Nagar ↔ Ashok Park Main | 24 | 24.8 + 3.0 km | 28.79 km / 24 ([Wiki](https://en.wikipedia.org/wiki/Green_Line_(Delhi_Metro))) | Available |
| 6 | Violet | Kashmere Gate ↔ Raja Nahar Singh (Ballabhgarh) | 34 | 44.9 km | 46.34 km / 34 ([Wiki](https://en.wikipedia.org/wiki/Violet_Line_(Delhi_Metro))) | Available |
| 7 | Pink | Majlis Park … Shiv Vihar (near-ring via Maujpur-Babarpur) | 46 | 71.3 km | 73.49 km / 46 ([Wiki](https://en.wikipedia.org/wiki/Pink_Line_(Delhi_Metro))) | Available |
| 8 | Magenta | Krishna Park Extension ↔ Botanical Garden; **separate** Majlis Park ↔ Deepali Chowk | 33 | 38.2 + 9.3 km | 50.72 km / 33 operational ([Wiki](https://en.wikipedia.org/wiki/Magenta_Line_(Delhi_Metro))) | Available, but in two disjoint pieces |
| 9 | Grey | Dwarka ↔ Dhansa Bus Stand | 4 | 4.9 km | — | Available |
| AEx | Airport Express (Orange) | New Delhi ↔ Yashobhoomi Dwarka Sector 25 | 7 | 23.7 km | — | Available |

**The Blue Line is one line with two branches.** OSM splits it into refs 3 and 4 under a single Blue Line `route_master`, and our dataset keeps it as one line, `blue`, with both branches (57 unique stations).

Station counts match Wikipedia exactly for Yellow, Green, Violet, Pink and Magenta. Differences in length are expected, because OSM measures track centrelines and official figures measure the alignment, sometimes up to the end of the platform.

### 2.2 Line colours: sources conflict

**DMRC does not publish official HEX codes** (none found). Every HEX value in circulation is a community choice.

| Line | OSM `colour` | Wikidata P465 | Agree? |
|---|---|---|---|
| Red | `#FF4040` | `#FF2D16` | ✗ |
| Yellow | `#FFDF00` | `#FFEA3D` | ✗ |
| Blue | `#4169E1` | `#102694` | ✗ (large difference) |
| Green | `#008000` | `#00AA4F` | ✗ |
| Violet | `#553592` | `#553592` | ✓ |
| Pink | `#FC8EAC` | `#FF5872` | ✗ |
| Magenta | `#CC338B` | `#FB3099` | ✗ |
| Grey | `#838996` | `#9A9B9E` | ✗ |
| Airport Express | `#FF8C00` | not found | — |
| Aqua (NMRC) | — | `#6CD5E0` | — |
| Rapid Metro | — | `#778899` | — |

**Decided 2026-10-31: use the Wikidata palette.** Store it in `data/manual/line_colors.json`, recording the source of each value. Airport Express has no Wikidata value, so it uses the OSM value `#FF8C00`. Mark every value `"official": false` until someone checks it against the official DMRC network map PDF.

### 2.3 Under construction and approved (Phase 4)

| Corridor | Status | Expected | OSM geometry |
|---|---|---|---|
| Magenta extension: R K Ashram Marg → Krishna Park Extension (Janakpuri West–RK Ashram Marg) | Under construction | 2026 (reported) | **Partial**: 13.9 km of `railway=construction` |
| Magenta: Krishna Park Extension → Deepali Chowk (~16.6 km, 6 stations) | Under construction | Late 2026 (reported) | Not found |
| Golden Line (Silver Line): Aerocity ↔ Tughlakabad | Under construction; Tughlakabad–Sangam Vihar section targeted for Dec 2026 | Reported, sources conflict | Not found |
| Inderlok ↔ Indraprastha (moved from Green to Magenta, Feb 2026) | Construction started, or delayed to 2029–30; sources conflict | — | Not found |
| Lajpat Nagar ↔ Saket G Block | Approved | — | Not found |
| Rithala ↔ Narela ↔ Nathupur (26.46 km) | Approved Dec 2024 | — | Not found |

Sources: [Magenta Line (Wikipedia)](https://en.wikipedia.org/wiki/Magenta_Line_(Delhi_Metro)), [Golden Line (Wikipedia)](https://en.wikipedia.org/wiki/Golden_Line_(Delhi_Metro)), [Swarajya](https://swarajyamag.com/news-brief/delhi-metro-phase-4-three-new-corridors-to-be-operational-by-december-says-dmrc-md-vikas-kumar), [The Optimist](https://theoptimist.news/delhi-metro-phase-4-updates/), [The Metro Rail Guy](https://themetrorailguy.com/delhi-metro-phase-4-information-map/). **All Phase 4 status is Reported or Unverified.** **Decided 2026-10-31:** show Phase 4 as a separate "under construction" layer, off by default. Only the Magenta extension has OSM geometry (`status: "under_construction"`). The other corridors appear in the line list without geometry, and nothing is drawn for them on the map.

---

## 3. Stations: data sources

| Source | Content | Coverage | Licence | Status |
|---|---|---|---|---|
| **OSM stop positions** (route relation members) | Stop point on the track, name, `name:hi`, order along the route | All 257 stations on DMRC lines | ODbL 1.0 | **Available** |
| **OSM station objects** (`railway=station`, `station=subway`) | Station centroid, `ref` station code (e.g. `KG`, `ILOK`), `wikidata` | 267 DMRC objects; 256 have `ref`, 274 have `wikidata` | ODbL 1.0 | **Available** |
| OSM station type (`layer`/`location` on station) | Elevated/underground flag | Only about 16 of 267 tagged | ODbL | **Not available** directly; **requires extraction** from track ways (§5) |
| Wikidata | QIDs, coordinates (P625), multilingual names | Most stations | CC0 | **Partially available** (useful for cross-checking) |
| Wikipedia line articles | Station tables with layout (Elevated/Underground/At-grade), opening dates | All operational lines | CC BY-SA 4.0 | **Requires extraction** (HTML tables) |
| Delhi Open Transit Data (GTFS) | `stops.txt` with stop coordinates, routes, schedules | DMRC feed exists | Terms of use on the portal; **licence not confirmed** | **Requires manual verification** ([otd.delhi.gov.in](https://otd.delhi.gov.in/about), [MobilityDatabase](https://mobilitydatabase.org/feeds/gtfs/mdb-3139)) |
| Kaggle "Delhi Metro Dataset" (arunjangir245) | ~285 rows with lat/lng, line, distance, opening year | Probably stale (pre-2026 extensions) | Unknown | **Unverified** ([mirror](https://baselight.app/u/kaggle/dataset/arunjangir245_delhi_metro_dataset)) |
| OpenCity "Delhi Underground Metro Lines Map" | Map of underground sections | Unclear | Public domain (as listed) | **Requires manual verification** ([link](https://data.opencity.in/dataset/delhi-metro-map/resource/delhi-underground-metro-lines-map)) |
| DMRC website / network map PDF | Official names, line map, station codes | Complete | © DMRC (not open) | Use for **manual verification only**; do not redistribute |
| Station elevation or depth | — | — | — | **Not available.** OSM has no `ele` on stations. Use nominal depths (see §5.3) |

**Interchange detection needs care.** Matching station names exactly finds only **13** interchanges across lines (Rajiv Chowk, Kashmere Gate, Central Secretariat, Botanical Garden, Janakpuri West, Mandi House, Kalkaji Mandir, Dilli Haat-INA, Majlis Park, Punjabi Bagh West, Haiderpur Badli Mor, Madhuban Chowk, Dwarka Sector 21). Real interchanges such as Hauz Khas, Kirti Nagar, Inderlok, Welcome, Anand Vihar, Lajpat Nagar, New Delhi, Rajouri Garden and Dwarka (Blue/Grey: OSM names it "Dwarka - Kakrola (Grey Line)") are missed because of naming differences. **Interchanges must be resolved through OSM `stop_area` relations, station `ref`/`wikidata`, or proximity clustering (under 300 m), plus a manual list.**

---

## 4. Route geometry datasets

| Source | Geometry quality | Directionality | Licence | Status |
|---|---|---|---|---|
| **OSM route relations** (`route=subway`, 22 directional variants under 9 `route_master`s) | Surveyed track centrelines, ordered ways, **0 ordering gaps** in all 22 variants | One relation per direction | ODbL | **Available** (primary source) |
| OSM `railway=construction` ways | 15.2 km total (mostly the Magenta extension) | — | ODbL | **Partially available** |
| GTFS `shapes.txt` (OTD) | Unknown; often simplified | Per trip | Unconfirmed | **Requires manual verification** |
| Geofabrik `northern-zone-latest.osm.pbf` | Same data as Overpass, offline | — | ODbL | **Available** (reproducible bulk alternative) |

**Plan:** pull a dated OSM snapshot (Overpass for development, and a Geofabrik extract when the dataset needs to be reproducible), convert with `osmtogeojson`, keep one direction as the canonical line geometry, and split it at the stop positions to produce station-to-station segments.

---

## 5. Elevated, underground and at-grade classification

### 5.1 Measured from OSM track ways

Rule: `tunnel=*` or negative `layer` → underground; `bridge=*` or positive `layer` → elevated; otherwise at-grade. "At-grade" also catches ways with no tags, so those need review.

| Line | Underground | Elevated | At-grade / untagged |
|---|---|---|---|
| Red | 0.2 km | 30.1 km | 3.1 km |
| Yellow | 23.2 km | 24.3 km | 0.2 km |
| Blue (main) | 3.3 km | 50.4 km | 1.9 km |
| Blue (branch) | 0 | 7.7 km | 0.5 km |
| Green | 0 | 27.7 km | 0.2 km |
| Violet | 14.1 km | 30.8 km | 0 |
| Pink | 18.1 km | 51.8 km | 1.4 km |
| Magenta | 24.0 km | 23.1 km | 0.4 km |
| Grey | 2.1 km | 2.6 km | 0.2 km |
| Airport Express | 16.1 km | 7.6 km | 0 |

Status: **Available for track sections (Verified (OSM)); station type requires extraction.**

### 5.2 Station type method

1. Take each station's stop position node and find the track way it sits on.
2. Read that way's `tunnel`/`bridge`/`layer` tags to get the station type.
3. Cross-check against the Wikipedia station tables' layout column.
4. On disagreement, set `stationType: "unknown"`, add a `conflicts[]` entry, and resolve it by hand using satellite imagery and the DMRC station page.

### 5.3 Depth and height

No reliable per-station depth or height data was found. Use **nominal** values, stored with the flag `"estimated": true`: elevated deck about +12 m, underground platform about −15 m. These are typical metro figures, not measurements.

---

## 6. Sources and licences

| # | Source | URL | Licence | Updated | Accuracy | Notes |
|---|---|---|---|---|---|---|
| S1 | OpenStreetMap via Overpass | https://overpass-api.de | ODbL 1.0, attribution "© OpenStreetMap contributors" | Live (snapshot 2026-10-31) | Track: typically ±2–5 m in urban India from imagery tracing | Primary geometry and stations |
| S2 | Geofabrik extracts | https://download.geofabrik.de/asia/india.html | ODbL | Daily | Same as S1 | Reproducible snapshot |
| S3 | Wikidata | https://www.wikidata.org | CC0 | Live | Coordinates vary | IDs, colours, cross-check |
| S4 | Wikipedia line articles | https://en.wikipedia.org/wiki/Delhi_Metro | CC BY-SA 4.0 | Live | Secondary | Station layout, counts, lengths |
| S5 | Delhi OTD (GTFS) | https://otd.delhi.gov.in | Portal terms (unconfirmed) | Unknown | Unknown | Read the terms before use |
| S6 | DMRC official site and map | https://www.delhimetrorail.com | © DMRC | — | Authoritative | Verification reference only |
| S7 | Kaggle Delhi Metro dataset | see §3 | Unknown | Unknown | Unknown | Do not use as a primary source |
| S8 | OSM tiles (base map) | https://tile.openstreetmap.org | ODbL data; [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) | — | — | Fine for development. Production needs its own tiles or a provider |

**Known conflicts:** line colours (§2.2); "303 stations" versus OSM's 257/271 (§1); Phase 4 dates (§2.3); OSM name variants such as "Shaheed Sthal" vs "Shaheed Sthal (New Bus Adda)", and the Pink Line relation's `to=Mayur Vihar Pocket 1` tag, which contradicts its name.

---

## 7. 3D assets

**No Delhi Metro-specific train or station model with a clear open licence was found.** Every licence below needs re-checking on the asset page before download.

| Asset | Source | Format | Licence (as listed) | Commercial | Three.js suitability | Status |
|---|---|---|---|---|---|---|
| "Metro" generic pack (Elbolillo) | [Sketchfab](https://sketchfab.com/3d-models/metro-b2017b6b23844e79a72b473b516a577e), [itch.io](https://elbolilloduro.itch.io/metro) | GLB, FBX, DAE | CC BY on Sketchfab, **CC0 on itch.io (conflict)** | Yes, with either | Good (small) | Requires verification |
| Low-poly train | [Sketchfab](https://sketchfab.com/3d-models/lowpoly-train-7242b3c0deb044db97639f7a6b125223) | Unclear | CC BY | Yes | Likely good | Requires verification |
| Bombardier S Stock carriage (London) | [Sketchfab](https://sketchfab.com/3d-models/bombardier-s-train-carriage-london-underground-09c298622ed74c46bd85d6969396943f) | — | CC BY | Yes | **Poor**: ~382k triangles | Reference only |
| Light rail train | [Sketchfab](https://sketchfab.com/3d-models/light-rail-train-8fff0e6603734bc2923909eb75de1abc) | — | CC BY-NC-ND | **No** | — | Excluded |
| Metro City Assets Part 1 | [Sketchfab](https://sketchfab.com/3d-models/metro-city-assets-part-1-34d19ec7d27e41b89dc2faf190ba8f71) | — | CC BY, but uploader is not the author | Unclear | — | **Excluded** (provenance) |
| Stylized metro station | [Gumroad (PolyStellar)](https://polystellar.gumroad.com/l/metro-station) | .blend | CC BY 4.0 (as listed) | Yes | Needs GLB export and decimation | Requires verification |
| Mumbai Metro train | [Gumroad](https://paperparachute.gumroad.com/l/Blender3DMumbaiMetroAsset) | .blend | Unknown | Unknown | Needs conversion | Requires verification |
| Chicago elevated track kit | [Superhive](https://superhivemarket.com/products/kitbash-elevated-railroad-train-track-chicago-metro-3d-model) | — | Paid, licence not seen | — | Style mismatch (steel el) | Not recommended |
| Concrete, metal and gravel PBR textures | [Poly Haven](https://polyhaven.com/textures) | JPG/EXR | CC0 | Yes | Excellent (use 1k) | Available |
| Train/rail kit | [Kenney](https://kenney.nl/assets) | GLB/FBX | CC0 | Yes | Excellent (low-poly) | Requires verification (check that the kit exists and what it contains) |

**Recommendation:** build the infrastructure **procedurally in code**, not from downloaded models. Viaduct decks, pillars, tunnels and platforms are simple extrusions along the route geometry, and they have to follow the real alignment, which pre-made models cannot do. The train should be **one custom low-poly Blender model** (under 5k triangles per car, Delhi Metro-style stainless body, coloured band material swapped per line), exported as GLB with Draco/Meshopt compression. Use Poly Haven CC0 textures. CGTrader, TurboSquid and BlenderKit had nothing Delhi-specific in these searches, and their licences generally restrict redistribution in a public web app.

---

## 8. Recommended architecture

The repo already has **Vite 8, React 19, TypeScript 7 and Tailwind 4**. Build on it.

| Concern | Choice | Why |
|---|---|---|
| Data pipeline | Node + TypeScript scripts in `scripts/` (`osmtogeojson`, `@turf/turf`) | Same language as the app; turf is shared by the pipeline and the runtime |
| 2D | `leaflet` + `react-leaflet` | Requested; enough for about 300 markers and 10 polylines |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` | Declarative scene and reusable components |
| State | `zustand` | Shares selection, filters and the 2D/3D mode between both views |
| Projection | Local tangent plane (equirectangular) centred on Rajiv Chowk, in metres | Distortion is well under 0.1% within ~40 km. Simpler than proj4. Never put raw lat/lng into Three.js |
| Validation | `scripts/validate.ts` → `data/metadata/validation_report.json` | Runs in CI and before every data build |

### Folder structure

```text
metro-route/
├── data/
│   ├── raw/
│   │   ├── osm/                # dated Overpass JSON snapshots (never edited)
│   │   ├── wikipedia/          # scraped station layout tables
│   │   └── other_sources/      # GTFS etc., once licence-checked
│   ├── manual/                 # hand overrides: interchanges.json, station_type_overrides.json, line_colors.json
│   ├── processed/              # GENERATED: never hand-edit
│   │   ├── metro_lines.geojson
│   │   ├── metro_stations.geojson
│   │   ├── metro_routes.geojson
│   │   ├── metro_segments.geojson
│   │   └── interchange_stations.geojson
│   └── metadata/
│       ├── sources.json
│       ├── data_quality_report.json
│       └── validation_report.json
├── scripts/
│   ├── fetch-osm.ts            # raw snapshot
│   ├── build-dataset.ts        # raw + manual → processed
│   └── validate.ts             # processed → report (exit 1 on errors)
├── public/
│   ├── data/                   # copied from data/processed at build
│   └── models/                 # train.glb etc.
├── src/
│   ├── data/                   # loaders + TS types for the schema
│   ├── geo/projection.ts       # lat/lng → local metres
│   ├── map2d/                  # Leaflet components
│   ├── scene3d/                # tracks/, stations/, trains/, camera/
│   ├── ui/                     # panels, search, filters
│   └── store.ts                # zustand
└── docs/
```

---

## 9. Data normalisation strategy

1. **IDs.** Station ID = DMRC station code from OSM `ref` (e.g. `KG`), lower-cased with a prefix: `stn_kg`. Where `ref` is missing, use `stn_osm_<nodeId>` and list the station in the quality report. Line IDs are fixed slugs: `red`, `yellow`, `blue`, `green`, `violet`, `pink`, `magenta`, `grey`, `airport_express`. Branches are route geometries under their line: `blue_main`, `blue_vaishali`, `green_main`, `green_kirti_nagar`, `magenta_main`, `magenta_majlis_park` (disjoint until Phase 4 links it).
2. **One station, many lines.** An interchange is **one** station feature with `lines: [...]`. Each line's stop position is kept in `platforms: [{line, lat, lng}]` so 3D platforms sit on the correct track.
3. **Geometry.** Canonical geometry for each line = one direction of the OSM route, merged into a single LineString per branch (MultiLineString for Magenta until its two pieces join up). Segments are produced by splitting that line at each stop's projected point (`turf.lineSplit`/`nearestPointOnLine`).
4. **Infrastructure type** lives on **segments, split further wherever the type changes**: `trackType: elevated | underground | at_grade | unknown`. A station's `stationType` is derived, then overridden by `data/manual/`.
5. **Provenance on every feature:** `source: ["osm:node/123", "wikipedia:..."]`, `verified: boolean`, `estimated: boolean`, `conflicts: []`.
6. **Names.** `name` (English, official DMRC spelling), `name_hi`, `aliases[]`. OSM variants such as "Dwarka - Kakrola (Grey Line)" are mapped through aliases.
7. **Coordinates** stay in GeoJSON `[lng, lat]` order (WGS84). The `{lat, lng}` object in the brief's example is replaced by standard GeoJSON geometry, so Leaflet and turf can use it directly.

Example (schema only, not a real record):

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [0, 0] },
  "properties": {
    "id": "stn_xx", "name": "…", "name_hi": "…", "aliases": [],
    "lines": ["yellow", "blue"], "isInterchange": true,
    "stationType": "underground", "stationTypeSource": "osm-track-tags",
    "platforms": [{ "line": "yellow", "coordinates": [0, 0] }],
    "status": "operational", "verified": false, "estimated": false,
    "source": ["osm:node/…"], "conflicts": []
  }
}
```

---

## 10. Data validation strategy

| Check | Method | Severity |
|---|---|---|
| Valid GeoJSON / schema | JSON schema + `@turf/boolean-valid` | Error |
| Missing coordinates | null/NaN, or outside the NCR bounding box (28.2–28.9 N, 76.7–77.6 E) | Error |
| Duplicate station IDs | Set comparison | Error |
| Duplicate or inconsistent names | Same name with different IDs; IDs within 300 m that have different names | Warning |
| Missing route geometry | Each line in `metro_lines` has geometry | Error |
| Disconnected segments | Endpoint of segment *n* ≠ start of *n*+1 (tolerance 1 m) | Error |
| Station ordering | Station positions along the line are strictly increasing; matches the OSM stop order and the Wikipedia order | Error |
| Station far from track | Station more than 150 m from its line geometry | Warning |
| Interchange consistency | `isInterchange ⇔ lines.length > 1`; every interchange in the manual list exists on both lines | Error |
| Station count per line | Compared against Wikipedia counts (table §2.1) | Warning |
| Length sanity | Geometry length within ±5% of the reported length | Warning |
| Type coverage | Share of segment km that is `unknown` | Statistic |
| Overlaps | Segments of different lines closer than 5 m over more than 200 m (shared corridors) | Info |

Output: `validation_report.json` with `{ generatedAt, osmSnapshot, errors[], warnings[], stats{} }`. The Leaflet app will have a "validation" overlay that draws each issue at its location for visual review.

---

## 11. Phased roadmap

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **1. Research** (this document) | This report | Your approval, plus the scope decisions below |
| **2. Dataset** | `fetch-osm`, `build-dataset`, manual override files, `sources.json` | All 5 processed GeoJSON files generated from a dated snapshot |
| **3. Validation** | `validate.ts` + report | 0 errors; warnings documented |
| **4. Leaflet 2D** | Lines in colour, track type as line style (solid = elevated, dashed = underground, dotted = at-grade), station markers and popups, interchange styling, layer control, filters, validation overlay | Manual review of every line against satellite imagery is done |
| **5. 3D foundations** | Projection module, ground plane, track ribbons per type, camera controls | Tracks line up with the 2D map at the same coordinates |
| **6. 3D infrastructure** | Procedural viaduct and pillars (~30 m spacing), tunnels with a cut-away or transparent ground, station boxes by type | Continuous tracks through stations; acceptable FPS on a mid-range laptop |
| **7. Trains** | GLB train, animation along the line, orientation from the tangent, speed control, instancing | ≥ 50 trains at 60 fps |
| **8. UI** | 2D/3D toggle, search, info panel, filters, reset camera; "work in progress" entries for Rapid Metro Gurugram, Aqua Line and Namo Bharat | — |
| **9. Journey planner** (future) | Graph built from segments + interchanges, shortest path, stop count, distance | — |

### Decisions (2026-10-31)

| # | Question | Decision |
|---|---|---|
| 1 | Scope | DMRC's 9 lines only. Rapid Metro Gurugram, Aqua Line and Namo Bharat are shown in the UI as "work in progress" only |
| 2 | Colours | Wikidata palette (Airport Express uses OSM `#FF8C00`) |
| 3 | Phase 4 | Separate "under construction" layer; geometry only where OSM has it (Magenta extension) |
| 4 | Attribution | Show "© OpenStreetMap contributors (ODbL)" in the app; processed GeoJSON is shared under ODbL if published |
| 5 | Blue Line | One line, `blue`, with a main branch and a Vaishali branch |
