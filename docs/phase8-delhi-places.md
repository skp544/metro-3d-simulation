# Phase 8 extension: Delhi malls, zoo and additional monuments

Date: 2026-11-12. User request: add famous Delhi malls, zoos and remaining monuments near the metro network. This extends the existing Places/landmark phase; no later phase is started.

## Goal and result

Added **17 places**, bringing the shared dataset to **24**: eight malls, one zoo, nine monuments, four religious sites and two civic sites. The existing seven places remain available. Search, the Places list, category filters, source-linked details and nearest mapped stations work in both views. Category colours distinguish the points and labels. Aliases cover Delhi Zoo, DLF Place, Safdarjang, Ugrasen and common alternate names.

The 3D library includes original retail silhouettes with glazing/floor bands and original architectural interpretations of the tombs, mosque, temple, gate, observatory, memorial and stepwell. Mapped grounds use open site contours. No coordinates, station identities, rail geometry, routes or train simulation were changed.

## Added places and outputs

Distances below are **straight line to a station point**, not walking or entrance distances.

| Added place | Rendered scope | Nearest mapped station | Triangles | GLB bytes |
| --- | --- | --- | ---: | ---: |
| Nexus Select CITYWALK · Saket | Approximate model | Malviya Nagar · 1407 m | 4,736 | 285,876 |
| DLF Avenue · Saket | Approximate model | Malviya Nagar · 1181 m | 3,724 | 252,408 |
| DLF Promenade · Vasant Kunj | Approximate model | Vasant Vihar · 1773 m | 15,844 | 1,069,028 |
| DLF Emporio · Vasant Kunj | Approximate model | Vasant Vihar · 1652 m | 9,832 | 645,552 |
| Ambience Mall · Vasant Kunj | Approximate model | Vasant Vihar · 1944 m | 17,012 | 1,155,160 |
| Pacific Mall · NSP | Approximate model | Netaji Subhash Place · 108 m | 3,284 | 208,968 |
| Pacific Mall · Tagore Garden | Mapped site outline | Subhash Nagar · 246 m | 156 | 12,172 |
| Vegas Mall · Dwarka | Mapped site outline | Dwarka Sector 14 · 376 m | 48 | 4,596 |
| National Zoological Park · Delhi Zoo | Mapped site outline | Khan Market · 1751 m | 204 | 15,512 |
| Humayun’s Tomb | Approximate model | Sarai Kale Khan - Nizamuddin · 819 m | 5,864 | 361,040 |
| Safdarjung’s Tomb | Approximate model | Jor Bagh · 357 m | 5,864 | 361,044 |
| Purana Qila · Bara Darwaza | Approximate model | Khan Market · 1481 m | 1,332 | 88,768 |
| Jama Masjid · Old Delhi | Approximate model | Jama Masjid · 417 m | 5,440 | 354,764 |
| Swaminarayan Akshardham | Approximate model | Akshardham · 635 m | 21,916 | 1,318,144 |
| Jantar Mantar · Samrat Yantra | Approximate model | Janpath · 423 m | 2,720 | 192,644 |
| Raj Ghat · Gandhi Memorial | Approximate model | Delhi Gate · 865 m | 352 | 17,856 |
| Agrasen ki Baoli | Approximate model | Barakhambha Road · 410 m | 2,832 | 201,360 |

New assets total **101,160 triangles / 6,544,892 GLB bytes**. All 24 total **209,740 triangles / 12,065,624 GLB bytes**. The reproducible Blender source is `scripts/model-landmarks.py`; `assets/landmarks/landmarks.blend` stores the project source collection. Original authoring is CC0; source-derived geographic geometry remains separately OSM/ODbL. No downloaded model, paid generation or photographic texture is distributed.

## Sources, identity and geography

`data/manual/landmarks.json` records each curated object ID, expected name/tags, category, aliases, height provenance and scope. New dated OSM way/full and relation/full snapshots live under `data/raw/landmarks/2026-11-12/`. Four exact elements are extracted unchanged from preserved environment snapshots; each extraction records its original source path. Unavailable OSM version metadata is labelled with the snapshot date instead of a fabricated version.

Identity is checked against configured Wikidata and/or exact OSM name/tag values. Some tomb/memorial OSM Wikidata tags point to people: Humayun, Safdarjung and Gandhi. These are recorded conflicts, not accepted as the sole place identity. Exact names, historic/building tags and the published place references identify those places. Humayun's outline also carries height=3, which is not used as the entire mausoleum height.

Primary place references include [Delhi Tourism's mall inventory](https://www.delhitourism.gov.in/dt/shop-in-delhi.html), [DLF Promenade](https://www.dlfpromenade.com/about), [Pacific NSP](https://www.pacificmalls.in/nsp), [Delhi Zoo](https://nzpnewdelhi.gov.in/), [Humayun's Tomb](https://www.delhitourism.gov.in/tourist_place/humayun_tomb.html), [Purana Qila](https://www.delhitourism.gov.in/tourist_place/purana_quila.html), [Jantar Mantar](https://delhitourism.gov.in/tourist_place/jantar_mantar.html) and [Akshardham's mandir](https://akshardham.com/explore/mandir/). The complete per-place links and limitations are retained in the manual config/reference file and source-linked UI.

`build-landmarks.ts` retains all closed outer polygon parts and their courtyard holes. Area-weighted component centres locate multi-part places. The two Saket mall relations each contain **two outer polygons**; Ambience and Jama Masjid have open courtyards. Existing compatibility fields retain the first outer ring, while `footprintParts` contains every part. `modelFootprints` holds local Blender XY coordinates derived through `projection.ts`; these mall/source contours are not re-centred or stretched during authoring.

City exclusions operate on building parts with holes and skip sites entirely. This avoids deleting city buildings/trees from zoo or mall grounds and retains courtyard trees. Existing India Gate containment exclusion remains tested.

## Scope and limitations

- **Six mall buildings** use mapped outlines and approximate facade details/heights. **Pacific Tagore Garden and Vegas Dwarka** use mapped retail/commercial land parcels and open boundary highlights: the sources do not verify complete mall-building footprints. The checked Vegas local map is retained as research evidence. No substitute building geometry is invented.
- **Delhi Zoo** uses its mapped boundary, retaining existing city context. Habitats, animals, internal buildings and visitor entrances are not reconstructed. This adds no animal simulation and makes no opening-hours claim.
- **Purana Qila** is **Bara/Bada Darwaza only**. **Jantar Mantar** is **Samrat Yantra only**. The broader captured grounds are research evidence, not claimed as reconstructed sites.
- **Agrasen ki Baoli** is explicitly a **raised cutaway illustration** of a real sunken well. Display height, depth, steps and arcades are nominal; no surveyed excavation or visitor route is claimed.
- **Akshardham** is the main mandir only. Height **43.07 m** is rounded from the official **141.3 feet**. Its mapped OSM outline is smaller than the official plan dimensions; the source outline is retained and the conflict disclosed. Architectural details and proportions remain approximate.
- Other new building heights, facade/sign placement, stonework and model details are **nominal**. Original source imagery is not a texture licence and is not redistributed. Distances remain straight-line estimates to mapped station points.

## Verification and visual review

`npm run data:build`, `npx tsc -b`, `npm run lint`, `npm test` (**80 passing**) and production Vite build pass. Rail validation remains **0 errors, 2 accepted reference-length warnings, 73 info**. Environment geography was not rebuilt; original city tiles and attribution remain in use.

Tests independently compare source identity and exact polygon-edge multisets, preserve holes/parts, verify local projection, recompute nearest stations, check every GLB's base/metre height/triangle budget and use raycasts to confirm source polygon placement and open Ambience/Jama Masjid courtyards. City tests check site preservation, multi-part exclusions and courtyard trees. Existing rail/routing/train tests remain passing.

Browser review uses `scripts/screenshot.mjs`; artifacts are retained in `docs/review/delhi-places/`. The mall category lists all eight entries, the zoo category lists its one verified site, and details show mapped-site/model limitations. Visual review also widened broad place framing and refined tomb arch panels/minaret placement. Headless Chrome uses SwiftShader; real-GPU frame rate remains unmeasured. The existing large lazy-3D-bundle warning remains.

## Reproduce

```sh
npm run data:build
# In a Blender Python environment (no application runtime dependency):
uv run --python 3.11 --with bpy==5.0.1 python scripts/model-landmarks.py
npx tsc -b && npm run lint && npm test && npm run build
npx vite preview --host 127.0.0.1 --port 4173
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=3d&place=select-citywalk' /tmp/select-citywalk.png 1440 900 18000
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=2d&place=delhi-zoo' /tmp/delhi-zoo.png 1440 900 6000
```

Model generation in this session used an existing temporary Blender Python 5.0.1 environment. Only the project collection/library is written; no desktop Blender file or unrelated scene was opened or overwritten. The source script can also run inside compatible Blender with `__file__` set.

## Next boundary

Owner review/commit follows. This curated batch does not claim to cover every Delhi monument or mall. Additional places, exact architectural reconstruction, verified building footprints for the two mall sites, zoo habitats/animals, expanded city capture, people and journey-planner work remain separate scope. Stop here for the owner's direction.
