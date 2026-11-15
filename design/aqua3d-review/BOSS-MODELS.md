# Boss model authoring

Two new assets only: `public/aqua/models/boss/boss_sanho.glb` and `boss_geomeun.glb`. Existing fish GLBs and game code are preserved. No commit or game activation is performed.

Built-in image generation prompts and source paths are in `boss-model-prompts.json`; raw wide four-view sheets and registered 1024px masks are in `boss-refs/`. Body reconstruction uses the existing V3 marching-cubes/Taubin/meshoptimizer approach. Thin appendages are authored as closed volumes, merged into one skinned mesh. One embedded 512px WebP atlas and one PBR material per asset.

Run with the bundled Node 22+ executable from the repository root:

1. `node design/aqua3d-review/boss-prepare.mjs`
2. `node design/aqua3d-review/boss-build.mjs`
3. `node design/aqua3d-review/boss-validate.mjs`
4. `node design/aqua3d-review/boss-review-serve.mjs`
5. Open `http://127.0.0.1:4199/design/aqua3d-review/boss-model-viewer.html`, export the actual WebGL renders, then run `node design/aqua3d-review/boss-import-renders.mjs <downloaded-zip>`.

The comparison uses the real code-built green sea turtle, not a substitute GLB. The review server copies and transpiles its read-only TypeScript sources into `boss-runtime/`, recording hashes in `boss-baseline-source.json`. Review-only import-path/catalog changes do not alter its geometry. Water-light shader injection is disabled to compare both models under the same neutral PBR lights.

`boss-models-validation.json` records compressed and expanded Khronos checks, texture dimensions, triangle count, byte size, exact joint names and five deformation poses. The validator cannot fully inspect meshopt data directly, so the second check uses decoded geometry; embedded WebP is decoded losslessly to PNG only in a private validation copy. Shipping assets retain meshopt, quantization and WebP.

See `boss-review-notes.json` for remaining appearance limitations. Visual approval stays pending; no likeness score is assigned.
