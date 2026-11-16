# Reference-based aquarium model upgrades

Scope: `imugi_fish`, `oceanic_manta`, `whale_shark` adult forms only. Original 2D artwork, other species and young forms are preserved. No external/market models or paid generation services are used.

| Key | Triangles | Delivered bytes | Texture |
| --- | ---: | ---: | --- |
| imugi_fish | 6368 | 100080 | 512px embedded WebP |
| oceanic_manta | 6984 | 61212 | 512px embedded WebP |
| whale_shark | 6404 | 86236 | 512px embedded WebP |

Every asset has one skinned mesh, one PBR material, ten standard joints, no animation clips, +X head, +Y up and normalized X length 2. Shipping format retains meshopt / quantization / embedded WebP. `validation.json` records both packed and independently expanded Khronos checks and five deformation poses. Geometry errors and warnings are zero. WebP is decoded losslessly only in a private expanded validation copy.

Changes:

- Imugi: curved reference-traced tubular body; arclength skin weights; sculpted skull, brow, snout, paired eyes, branched horns, curved barbels, mane, dorsal crest and solid fins. Original scales and ventral colors are cylindrically baked instead of stretching a side painting over a straight body.
- Manta: broad disc, thick cambered swept wings with curved trailing edges, physical recessed mouth, paired rolled cephalic lobes, eyes and tapered whip tail. Wing roots and distal sections have independent fin-chain weights.
- Whale shark: broad blunt head, spotted cylindrical body texture, recessed horizontal anterior mouth, paired small lateral eyes, five physical gill slits per side, swept solid pectorals, dorsal/pelvic/anal fins and asymmetric caudal lobes.

`comparison.webp` places original artwork beside old/new GLBs in top/front/side/oblique views. `game-motion.webp` shows three poses driven by the actual game `fishMotion()` function. `render-proof.json` ties all 42 native WebGL captures to exact GLB and source-image hashes. These are actual saved-asset renders, not authoring-scene mockups. The local game runtime is transpiled read-only for review; game motion rules are unchanged.

Appearance limits: hidden undersides are anatomical estimates from one painting; the manta wing projection can retain faint texture stretching near the tips; imugi's fine mane/fin filaments are simplified; whale-shark gill folds and the smallest spots are limited by the mobile texture budget. Visual approval stays pending; no self-assigned similarity score is used.

Rebuild from repository root with Node 22+:

1. `node design/aqua3d-review/imugi-build.mjs`
2. `node design/aqua3d-review/marine-upgrade-build.mjs`
3. `node design/aqua3d-review/marine-upgrade-check.mjs`
4. `node design/aqua3d-review/imugi-prepare-runtime.mjs`
5. `node design/aqua3d-review/serve-review.mjs`, open `/design/aqua3d-review/marine-upgrade/index.html`, use the native render export button.
6. `node design/aqua3d-review/marine-upgrade-import.mjs <downloaded-zip>`

Old GLBs are retained here for reproducible comparison. The revision map uses hashes of delivered bytes, so the service worker requests the new assets without clearing all artwork caches. The cache test continues checking every revision against its actual GLB, while allowing this catalogue to grow.
