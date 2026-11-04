# 3D Assets

Every third-party asset in `public/models/`, with its source and licence. Add a row before adding a file.

| File(s) | Pack | Source | Licence | Notes |
|---|---|---|---|---|
| `kenney/train/train-electric-subway-a.glb` (front car), `-b.glb` (middle car), `-c.glb` (rear car), `kenney/train/Textures/colormap.png` (shared palette) | Kenney **Train Kit** 1.1 (2024-09-22) | https://kenney.nl/assets/train-kit | **CC0 1.0** (`kenney/train/License.txt`) | ~1.3–1.6k triangles per car. Stainless body; the stripe palette cell (column 5, bottom row) is recoloured per line at runtime. Scaled to DMRC car dimensions (≈21.6 × 3.2 × 3.9 m, nominal) |
| `kenney/nature/tree_default_fall.glb`, `tree_oak_fall.glb`, `tree_default.glb`, `tree_oak.glb` | Kenney **Nature Kit** 2.1 (2020-04-29) | https://kenney.nl/assets/nature-kit | **CC0 1.0** (`kenney/nature/License.txt`) | ~110–230 triangles; material colours only (no textures). Scaled to ≈8 m. Placed only inside real OSM green areas |

## Candidates considered and not used

| Asset | Why not |
|---|---|
| Sketchfab "Riyadh Metro" by meshalAlharbi (`4b2458243ed64df790ecc2c8347ed492`) | CC BY and downloadable, but **3.85 million faces**: too heavy for dozens of trains in a browser. Sketchfab downloads also need the user's login |
| Sketchfab search "delhi metro", "dmrc", "delhi metro train" | No Delhi Metro model found (the "dmrc" hits are unrelated uploads by a user of that name) |
| Kenney City Kit (Commercial / Suburban), Car Kit | CC0, but buildings come from real OSM footprints instead (DECISIONS #41), and road vehicles aren't part of the metro |

Kenney packs were downloaded through the "Continue without donating" link on each official asset page (2026-11-04). CC0 needs no attribution; the app still credits Kenney in the 3D view.
