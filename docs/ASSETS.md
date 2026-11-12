# 3D Assets

Every third-party asset in `public/models/`, with its source and licence. Add a row before adding a file.

## Environment visuals (2026-11-12)

Facade windows, ground grain and water ripples are original CanvasTexture patterns in `scene3d/environmentTextures.ts` / `SceneAtmosphere.tsx`. Road vehicles (cars, buses and autorickshaws) and streetlights are original merged Three.js primitives in `UrbanLife.tsx`; no external vehicle images/models or photographic textures were added. These are illustrative, not exact vehicle replicas or live traffic. Existing Kenney CC0 trees remain in use, with predominantly green variants. Building/road/land/water geography is separately OSM-derived ODbL data with provenance; heights, facade details, fixture placement, traffic and unsourced dimensions are nominal. See `docs/phase8-city-environment.md`.

## Original landmark models (2026-11-12)

Four original procedural Blender interpretations are released under CC0 1.0, with no photographic textures. Architectural reference URLs, checked date and rejected/inaccessible asset candidates are in `data/manual/landmark-references.json`. Geographic positions/footprints remain OSM-derived ODbL data, separate from the model licence. The active Blender file path and original cube/camera/light were preserved; only the project collection `NCR_Landmarks` was created/rebuilt.

| Local GLB | Triangles | Bytes | Scale / scope |
|---|---|---|---|
| `landmarks/india-gate.glb` | 2,432 | 141,956 | 42 m height from Delhi Tourism; footprint envelope from OSM; decorative proportions approximate |
| `landmarks/lotus-temple.glb` | 20,876 | 1,451,712 | Nominal 34 m; 27 shells in three sets of nine, skyline/opening approximations; no invented surrounding pools |
| `landmarks/qutb-minar.glb` | 15,868 | 922,580 | Source-backed 72.5 m height and 14.32 m base diameter; five storeys, simplified flutes and balconies |
| `landmarks/red-fort.glb` | 7,422 | 513,296 | **Lahori Gate only**, mapped envelope; nominal 33 m height; approximate red sandstone towers/chhatris |

Reproduce with `scripts/model-landmarks.py` in Blender. Source library: `assets/landmarks/landmarks.blend` (workshop objects spaced apart); exports have base origins, metre units, +X frontage/+Y up in glTF. Manifest and full licence URL: `public/models/landmarks/{manifest.json,LICENSE.txt}`. Source links and verification are detailed in `docs/phase8-landmarks-stations.md`.

## Regional train assets (2026-11-12)

The user requested train silhouettes distinct from the Delhi Metro model. These are generic stand-ins, not exact NCRTC/CRRC replicas. Five original, AI-generated assets by **3D Assets** from the [Modern Rail and Metro Network pack](https://3dassets.dev/packs/modern-rail-and-metro-network) are released by the publisher under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Sources, original bounds, mesh counts and licence metadata are retained in `public/models/regional/manifest.json`.

| Local file | Publisher asset | Licence | Use |
|---|---|---|---|
| `regional/rrts-cab.glb` | https://3dassets.dev/assets/modern-rail-and-metro-network-high-speed-power-car-a6dc258e (13675) | CC0 1.0 | Streamlined RRTS cab; 9,872 triangles |
| `regional/rrts-middle.glb` | https://3dassets.dev/assets/modern-rail-and-metro-network-high-speed-trailer-car-e82de8c5 (13670) | CC0 1.0 | RRTS intermediate; 7,944 rendered triangles |
| `regional/aqua-cab.glb` | Asset 13672, metro driving car; canonical URL in manifest | CC0 1.0 | Aqua cab; 8,272 rendered triangles |
| `regional/metro-middle.glb` | Asset 13674, metro intermediate car; canonical URL in manifest | CC0 1.0 | Aqua/Meerut intermediate; 7,832 rendered triangles |
| `regional/meerut-cab.glb` | Asset 13673, commuter electric driving car; canonical URL in manifest | CC0 1.0 | Meerut cab with pantograph; 9,800 triangles |

At runtime, static parts are merged with baked vertex colours into one instanced mesh per car type and line. Counts above are measured after traversing the downloaded scenes; publisher metadata counts are retained separately in the manifest. Existing Delhi Metro assets remain in use. Regional liveries are approximate: RRTS silver/red, Aqua silver/aqua, Meerut silver/green with blue/orange details. Generic source details, including door arrangements and electrical equipment, are not operator-specific replicas. Car dimensions are nominal; six/four/three-car formation counts come from [Alstom/NCRTC](https://ncrtc.in/wp-content/uploads/2023/04/Alstom-Brochure-D2-3.pdf) and [NMRC's fleet document](https://www.nmrcnoida.com/writereaddata/Portal/Tender/141_1/2_RFP.pdf) (indexed document; current URL may redirect).

| File(s) | Pack | Source | Licence | Notes |
|---|---|---|---|---|
| `kenney/train/train-electric-subway-a.glb` (front car), `-b.glb` (middle car), `-c.glb` (rear car), `kenney/train/Textures/colormap.png` (shared palette) | Kenney **Train Kit** 1.1 (2024-09-22) | https://kenney.nl/assets/train-kit | **CC0 1.0** (`kenney/train/License.txt`) | ~1.3–1.6k triangles per car. Stainless body; the stripe palette cell (column 5, bottom row) is recoloured per line at runtime. Scaled to DMRC car dimensions (≈21.6 × 3.2 × 3.9 m, nominal) |
| `kenney/nature/tree_default_fall.glb`, `tree_oak_fall.glb`, `tree_default.glb`, `tree_oak.glb` | Kenney **Nature Kit** 2.1 (2020-04-29) | https://kenney.nl/assets/nature-kit | **CC0 1.0** (`kenney/nature/License.txt`) | ~110–230 triangles; material colours only (no textures). Scaled to ≈12 m (±20%). Placed only inside real OSM green areas |

## Candidates considered and not used

| Asset | Why not |
|---|---|
| Sketchfab "Riyadh Metro" by meshalAlharbi (`4b2458243ed64df790ecc2c8347ed492`) | CC BY and downloadable, but **3.85 million faces**: too heavy for dozens of trains in a browser. Sketchfab downloads also need the user's login |
| Sketchfab search "delhi metro", "dmrc", "delhi metro train" | No Delhi Metro model found (the "dmrc" hits are unrelated uploads by a user of that name) |
| Sketchfab "Subway Metro Train Concept [High Poly]" by Voynaroveech (`f36be0d8beed4164b122e2d7979c73ac`), suggested 2026-11-09 | **Standard (paid) licence, not downloadable** for free, 2.1 million faces and 88 materials |
| Sketchfab "Metro Exodus Gold Edition Free Download 2027" by HealthyQuail268 (`5e75aa2e23ef4b9497f44d11d80ac7f2`), suggested 2026-11-09 for its track look | **Spam listing:** a throwaway account, and a description that advertises a "free download" of the commercial game with a link to a third-party site. Its CC BY label can't be trusted (likely game assets taken without permission), so it was not downloaded. The model itself is a straight piece of rails on dark sleepers (3,570 faces); the same look is now drawn in code along the real alignment (DECISIONS #58) |
| Kenney City Kit (Commercial / Suburban), Car Kit | CC0, but buildings come from real OSM footprints instead (DECISIONS #41), and road vehicles aren't part of the metro |

Kenney packs were downloaded through the "Continue without donating" link on each official asset page (2026-11-04). CC0 needs no attribution; the app still credits Kenney in the 3D view.

## Delhi landmark batch 2 · 2026-11-12

Rashtrapati Bhavan, Supreme Court of India and Hanuman Statue · Jhandewalan are original project-authored procedural Blender models, CC0 under `public/models/landmarks/LICENSE.txt`. No third-party mesh was imported. Authoring: `scripts/model-landmarks.py`; source library: `assets/landmarks/landmarks.blend`; export environment: Blender Python 5.0.1. Reference photographs informed silhouettes, with no photographs distributed as model textures. See `data/manual/landmark-references.json` for architectural sources and limitations.

| Model | Triangles | GLB bytes |
| --- | ---: | ---: |
| rashtrapati-bhavan | 24,196 | 1,158,564 |
| supreme-court | 14,266 | 634,436 |
| hanuman-jhandewalan | 23,520 | 696,620 |

Palace: dome, drum railing, portico, chhatris and courtyard wings; court: dome, colonnaded verandah and original main wings; statue: vermilion figure, crown, chest gesture, mace, tail and ornaments. The two buildings use sourced overall extents and official dome heights; their details remain approximate. Hanuman has a directory point rather than a verified footprint, with nominal model width/depth/heading and a rounded 108-foot height. These are lightweight interpretations, not scans or surveyed reconstructions.
