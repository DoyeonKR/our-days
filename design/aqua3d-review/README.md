# Aquarium GLB delivery — all requested forms

## Scope

- `public/aqua/models/fish/`: 81 GLBs (51 adults, 15 fry, 15 juveniles).
- `public/aqua/models/decor/`: 37 GLBs.
- Existing green/fry/juvenile sea turtle models are deliberately excluded.
- No game source, database, package manifest, external models or tank environment changes.
- File generation is complete. Visual similarity is not self-approved or given a numerical score. Some ornamental details remain stylised approximations of the painted references.
- Adding these files does **not** switch the live aquarium to loading them. Runtime integration belongs to the other session.

## Integration contract

One self-contained GLB per exact catalogue key; uncompressed glTF 2.0, embedded 512px PNG base colour, a single PBR metallic-roughness material. No Draco/KTX2/Meshopt, no animation clips. Ordinary surfaces are opaque; moon jelly uses alpha.

Y is up, fish face +X and their side is +Z. Fish origins are at the anatomical body centre. Decorations have bottom-centre origins. Fish are approximately two units long and are intended to be rescaled by the game.

Each fish contains one skinned mesh with these ten bones, in this joint order:

`spine_0`, `spine_1`, `spine_2`, `spine_3`, `spine_4`, `spine_5`, `fin_L`, `fin_L_tip`, `fin_R`, `fin_R_tip`.

The body chain goes from head to tail. Paired fins/wing tips use the two fin chains. Jelly bell vertices use `spine_0`, and tentacles use the spine chain. Young forms use their own artwork and distinct head/body/eye proportions, not uniformly scaled adults. Windmill/lids/plant stems have separate `moving_` nodes.

`models.json` records every key, source hash, GLB hash, triangle count, bytes, bones, texture dimensions, size limits, Khronos validation and fish deformation checks. `native-render.json` ties saved WebGL frames to exact GLB hashes.

## Local review / reproducibility

Requires the project's existing `three` and `sharp`, Node 22+; no package manifest changes.

1. `node design/aqua3d-review/build-stage1.mjs` generates **all 118**, despite its legacy filename.
2. `node design/aqua3d-review/review-stage1.mjs` validates and creates CPU proof images. The local Khronos validator installation is required; CPU images are not claimed as PBR captures.
3. `node design/aqua3d-review/serve-review.mjs` serves the isolated review on `http://127.0.0.1:4197/`.
4. Use the visible export button for all actual GLBLoader/WebGL rest-pose frames; it downloads `aqua-all-native-renders.zip`.
5. `node design/aqua3d-review/import-native-renders.mjs <zip>` verifies every GLB hash before importing the frames.
6. `node design/aqua3d-review/review-stage1.mjs --native-stills`, then `node design/aqua3d-review/finalize-stage1.mjs` refresh the reference comparisons without replacing the native frames.

`models/<key>-{front,side,oblique}.webp` contains every required view. Ray/manta forms also have top views because their references are dorsal. `all-fish-review-{1,2,3}.webp` and `all-decor-review-{1,2}.webp` provide the complete overview. Legacy `stage1-` comparison filenames are retained for viewer compatibility; their content now covers the full catalogue.
