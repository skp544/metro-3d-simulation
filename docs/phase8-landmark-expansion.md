# Phase 8 extension: Delhi landmarks, second batch

Date: 2026-11-12. Scope authorized by the owner: Rashtrapati Bhavan, Supreme Court of India and the Hanuman murti near Jhandewalan. This extends the existing landmark work; no later phase is started.

## Goal and result

Seven places now share one processed landmark GeoJSON across 2D markers, 3D models, search, Places and details. Three new original CC0 Blender models provide the palace dome/portico/chhatris, the court dome/colonnade/wings, and the orange Hanuman figure with crown, hands at chest, mace and tail. Selecting a landmark fits its width/depth as well as height and opens on its modeled facade.

## Sources and geography

- Rashtrapati Bhavan: immutable OSM relation **5354966**, identified by Wikidata Q677555, outer building way 44187405 and six courtyard holes. The [President's Secretariat](https://rashtrapatibhavan.gov.in/index.php/rbtour/central-dome) gives the dome height as **55 m above the forecourt**. Model architecture is approximate; terrain slopes, the wider Presidential Estate, gardens and Jaipur Column are not reconstructed.
- Supreme Court: immutable OSM building relation **5492821**, Wikidata Q213380, outer way 80499788 and one courtyard hole. The [Court's own history](https://www.sci.gov.in/about-department/history/) describes its original building, central wing, colonnaded verandah and **27.6 m** dome. The separate additional complex is outside this custom model.
- Hanuman: [BhaktiBharat's page](https://www.bhaktibharat.com/mandir/108-foot-hanumanji) supplies the Sankat Mochan Dham identification, 108-foot description and rounded directory point. An immutable HTML capture and extraction record preserve these facts. No verified OSM statue footprint was found, so its footprint is empty, 2D shows only a point, and details disclose the approximate location. Model width **14 m**, depth **12 m**, heading and pose details are nominal; height is rounded to **32.92 m** from 108 ft and labeled nominal. Chest opening is not animated.

No station or rail alignment changed. Scene positioning still enters through `projection.ts`. Relation courtyard holes are retained in the 2D footprint. City exclusions skip point-only landmarks and retain the India Gate containment repair. The generic city environment is not rebuilt for this batch.

## Outputs and measured size

| New model | Triangles | GLB bytes |
| --- | ---: | ---: |
| rashtrapati-bhavan | 24,196 | 1,158,564 |
| supreme-court | 14,266 | 634,436 |
| hanuman-jhandewalan | 23,520 | 696,620 |

New models total **61,982 triangles / 2,489,620 bytes**. All seven models total **108,580 triangles / 5,520,732 bytes**. The original four were re-exported with Blender Python 5.0.1; their triangle counts remain unchanged. Sources live in `scripts/model-landmarks.py` and the updated `assets/landmarks/landmarks.blend`. Workshop spacing now accommodates the wide buildings. Only project collections are written to the library; no desktop Blender file was opened or overwritten.

## Method and checks

`build-landmarks.ts` now handles configured OSM building relations, preserves their exact nodes and closed rings, checks identity against Wikidata, and derives centres, oriented extents and straight-line nearest stations. Point-only sources have explicit provenance and no fabricated polygon. `fetch-landmarks.mjs` reads configured IDs and preserves existing snapshots. UI source links distinguish way and relation IDs and omit an OSM footprint link for the directory-only statue.

`npm run data:build`: **0 rail errors, 7 documented warnings, 68 info**. TypeScript, lint, production build and **75 tests** pass. Landmark tests now cover all seven identities, raw relation courtyard holes, directory coordinates/no invented footprint, independent nearest-station calculations and every exported GLB's height/base/triangle budget. Existing large lazy-3D-bundle warning remains. Browser review uses `scripts/screenshot.mjs`; retained screenshots are under `docs/review/landmarks-batch2/`. Real-GPU performance and full human imagery review remain open.

## Reproduce

1. `npm run data:build` uses the preserved sources offline.
2. Generate the models with Blender Python: `uv run --python 3.11 --with bpy==5.0.1 python scripts/model-landmarks.py`, or execute the script in a compatible Blender with `__file__` set. The temporary environment used here adds no application dependency.
3. `npx tsc -b && npm run lint && npm test && npm run build`.
4. Preview and open `?view=3d&place=rashtrapati-bhavan`, `?view=3d&place=supreme-court` or `?view=3d&place=hanuman-jhandewalan`. Change to `view=2d` for the same source-backed locations. Search names or use Places (7).

Stop at this batch for owner review/commit. Further landmarks, exact architectural reconstruction, surveyed statue placement, people, journey-planner enhancements and additional terrain/city work remain separate scope.
