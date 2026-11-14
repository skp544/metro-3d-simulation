# Phase 8 extension: Noida, Ghaziabad and Meerut Places

Date: 2026-11-14. Owner request: extend Delhi's Places feature to the Noida area and Ghaziabad/Meerut corridors. This extends the existing landmark scope.

## Goal and result

Added **11 places**, bringing the shared dataset to **35**. Four additions cover Noida/Greater Noida, four cover Ghaziabad and three cover Meerut. The existing 24 Delhi places remain available. Search, Places, category filters, source-linked details, 2D markers/selected footprints and 3D picking/focus use the same generated GeoJSON.

Places now has an **Area** selector: All areas, Delhi, Noida / Greater Noida, Ghaziabad and Meerut. Category counts reflect the selected area; empty combinations show an explicit message. A Parks category covers parks and sanctuaries. Search accepts area names and aliases such as GIP, Hindon City Forest, Company Garden and Kali Paltan Mandir.

## Added places and outputs

Distances are straight line from the source-derived place centre to the nearest mapped station point, **not entrance or walking distances**.

| Place | Rendered scope | Nearest mapped station | Distance | Triangles | GLB bytes |
| --- | --- | --- | ---: | ---: | ---: |
| DLF Mall of India · Noida | Approximate building | Noida Sector 18 | 613 m | 7,156 | 479,872 |
| The Great India Place · Noida | Approximate building | Noida Sector 18 | 351 m | 3,664 | 216,464 |
| India Expo Mart · Greater Noida | Approximate mapped mart building only | Knowledge Park II | 504 m | 1,204 | 87,600 |
| Okhla Bird Sanctuary | Mapped protected-area outline | Okhla Bird Sanctuary | 1,504 m | 180 | 13,844 |
| Mahagun Metro Mall · Vaishali | Approximate building | Vaishali | 672 m | 6,492 | 418,376 |
| Pacific Mall · Sahibabad | Mapped retail-parcel outline | Anand Vihar (Namo Bharat) | 334 m | 48 | 4,600 |
| City Forest · Ghaziabad | Mapped nature-reserve outline | Mohan Nagar | 2,315 m | 1,392 | 98,700 |
| ISKCON Temple · Ghaziabad | Approximate mapped building | Guldhar (Namo Bharat) | 1,928 m | 3,390 | 195,136 |
| Shopprix Mall · Meerut | Approximate building | Shatabdi Nagar | 159 m | 4,904 | 304,420 |
| Gandhi Bagh · Meerut | Mapped park outline | MES Colony | 946 m | 216 | 16,364 |
| Augharnath Temple · Meerut | Mapped worship-site outline | Bhainsali | 1,333 m | 48 | 4,604 |

New assets total **28,694 triangles / 1,839,980 GLB bytes**. All 35 total **238,434 triangles / 13,905,604 GLB bytes**. The Blender source library is 16,053,368 bytes. Assets are original procedural architectural interpretations with nominal materials/details, authored under the existing CC0 model licence; source-derived geography remains OSM/ODbL. No downloaded imagery or photographic textures are distributed.

Totals: 13 malls, nine monuments, six religious sites, three civic landmarks, three parks/sanctuaries and one zoo.

## Sources and method

- `data/manual/landmarks.json` supplies curated identity, aliases, area, scope and nominal height. `landmark-references.json` retains references and limitations.
- Seven unchanged OSM elements are extracted from preserved city/environment snapshots, with the original file recorded in `sourceSnapshot`. Six live under `data/raw/landmarks/2026-11-12/`; Great India Place lives under `data/raw/landmarks/2026-11-04/`, matching its original `data/raw/osm-city/2026-11-04.json` capture. Both the displayed date and provenance retain the original source date/path.
- Four new OSM API way/full snapshots live in `data/raw/landmarks/2026-11-14/`: sanctuary way 28208892, forest way 780474305, Augharnath way 1214457825 and Ghaziabad ISKCON way 352767307. Every identity is checked against exact source names/tags and Wikidata where configured.
- Build/fetch now accept a **per-place snapshot date**, falling back to the existing config date. Old Delhi captures are not relabelled as newly fetched.
- DLF Noida uses **way 351621425**, separate from similarly named Gurugram relation 16164905. City Forest uses **nature-reserve way 780474305**, separate from its Gopi Sarover pond, way 780474299.
- `build-landmarks.ts` generates shared location, exact polygon parts/holes, orientation, nearest station and local authoring coordinates. Geographic 3D coordinates pass through `projection.ts`.
- `model-landmarks.py` extends the existing mall builder and adds original exhibition-building and temple interpretations. Geographic building outlines are retained without stretching/recentring their XY geometry. Open site outlines retain city buildings, trees and water.

Place references include [DLF Mall of India](https://www.dlfmallofindia.com/), [The Great India Place](https://www.thegreatindiaplace.in/), [India Expo Mart](https://indiaexpomart.in/), [UP Eco-Tourism's Okhla page](https://upecoboard.up.gov.in/en/article/okhla-bird-sanctuary), [Mahagun](https://www.mahagunindia.com/project/mahagun-metro-mall/), [Pacific Sahibabad](https://www.pacificmalls.in/ghaziabad), [GDA City Forest](https://gdaghaziabad.in/city-forest/), [ISKCON Ghaziabad](https://iskconghaziabad.com/contact), [Meerut district's attractions](https://meerut.nic.in/tourist-places/), [MDA's Augharnath page](https://heritagemeerut.in/Eng/AugurnathTemple.html) and [Supertech's named Meerut project records](https://www.supertechlimited.com/public-announcements/). References establish identity/context, not surveyed model dimensions or current visitor operations.

## Scope and limitations

All new building heights, architectural details, facade/sign placement and materials are **nominal**. The temple interpretation does not claim an exact shrine/spire layout. India Expo is the mapped mart building only, not the complete exhibition campus. Pacific Sahibabad is a retail parcel and Augharnath is a worship-site boundary without a verified building footprint: both remain open highlights rather than fabricated buildings. Park/sanctuary highlights are nominally 0.4 m thick; habitats, birds, paths, entrances, rides and fountains are not reconstructed.

Existing city tiles are reused. Regional mapping density varies: the 48 selected tiles around Shopprix contain only **30 mapped buildings**, versus hundreds/thousands at the other added sites. The city test retains Delhi's established density requirement and checks that regional places have source-backed context and bounded tile selection; it does not claim a new environment capture. No surrounding buildings are invented to fill gaps.

This is a curated batch, not an exhaustive inventory. Gardens Galleria, Shipra Mall and additional Meerut churches/memorials remain outside this captured geometry batch. Opening hours, admission, surveyed pedestrian access, people and wildlife simulation are outside scope. Rail geography, routes, service simulation and OSM attribution are preserved.

## Verification and review

`npm run data:build`, `npx tsc -b`, `npm run lint`, `npm test` (**81 passing**) and production build pass. Rail validation remains **0 errors, 2 accepted warnings, 73 info**. Source-edge tests cover all 35 places, per-place dates, identity distinctions, exact local projection and independently recomputed nearest stations. GLB checks cover ground origins, metre heights and geometry budgets; raycasts cover all six new building models. City exclusions test every site outline, retaining surrounding context.

Browser artifacts from `scripts/screenshot.mjs` live in `docs/review/ncr-places/`. Review includes malls in each region, site outlines, area/category filtering, empty categories, aliases and mobile layout. Chrome uses SwiftShader; real-GPU frame rate remains unmeasured. The existing lazy 3D bundle-size warning remains.

## Reproduce

```sh
npm run data:build
# Blender Python, or compatible Blender with __file__ set:
uv run --python 3.11 --with bpy==5.0.1 python scripts/model-landmarks.py
npx tsc -b && npm run lint && npm test && npm run build
npx vite preview --host 127.0.0.1 --port 4173
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=3d&place=dlf-mall-of-india' /tmp/noida-dlf.png 1440 900 16000
node scripts/screenshot.mjs 'http://127.0.0.1:4173/?view=2d&place=city-forest-ghaziabad' /tmp/ghaziabad-forest.png 1440 900 6000
```

Model generation used the existing cached Blender Python environment; only the project collection/library is authored. No active desktop Blender file was opened or overwritten. No commit or push was made. Owner review/commit follows; further places, city capture and later phases await direction.
