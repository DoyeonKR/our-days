# Aquarium GLB delivery — all requested forms

## Scope

- `public/aqua/models/fish/`: 81 GLBs (51 adults, 15 fry, 15 juveniles).
- `public/aqua/models/decor/`: 37 GLBs.
- Existing green/fry/juvenile sea turtle models are deliberately excluded.
- No game source, database, package manifest, external models or tank environment changes.
- File generation is complete. Visual similarity is not self-approved or given a numerical score. Some ornamental details remain stylised approximations of the painted references.
- Adding these files does **not** switch the live aquarium to loading them. Runtime integration belongs to the other session.

## Integration contract

One self-contained GLB per exact catalogue key; glTF 2.0 with a single PBR metallic-roughness material and one embedded base-colour texture. No Draco/KTX2, no animation clips. Ordinary surfaces are opaque; moon jelly uses alpha.

**배포 형식 (2026-11-05)** — `extensionsRequired`: `EXT_meshopt_compression` · `KHR_mesh_quantization` · `EXT_texture_webp`. 만드는 곳은 `glb-compress.mjs` 하나(build-stage1 의 packGLB 가 부른다).

| | 예전 | 지금 | 왜 |
|---|---|---|---|
| 위치 | float32 | int16(14비트) — 뼈 메시는 배율을 IBM 에, 고정 메시는 노드 scale(균등)에 | glTF 는 뼈 메시 노드의 변환을 무시한다. 균등 배율이라 `moving_` 노드의 회전축 · 법선 방향이 그대로 |
| 법선 | float32 | int8 octahedral(meshopt 필터) | 오차 1.2° 이하 |
| UV | float32 | uint16 정규화(12비트 격자). [0,1] 밖이면 float(격자만) | 장식 몇 개는 UV 가 -0.03~1.01 — 잘라 넣으면 무늬가 밀린다 |
| 뼈 번호 · 가중치 | uint16 · float32 | uint8 · uint16 정규화(합 = 65535) | three 는 가중치 합을 다시 맞추지 않는다. uint8 은 오징어 팔 끝에서 모델 크기의 1.5/1000 어긋났다 |
| 텍스처 | 물고기 768px JPEG · 장식 512px PNG | 512px WebP q82 | 그림 원본이 512px — 768 은 늘리기만 했다 |
| bufferView | 그대로 | meshopt(buffer 0 = BIN, buffer 1 = 풀린 자리 fallback) | |

- 크기: 물고기 219 33.1MB → 7.0MB(gzip 16.2 → 5.0) · 장식 37 9.8MB → 1.9MB(gzip 7.0 → 1.1). 물고기 한 마리 중앙값 147KB → 30KB.
- ⚠ **게임은 `loader.setMeshoptDecoder(MeshoptDecoder)` 가 있어야 연다**(`src/lib/aqua3d/glb.ts`). 없으면 모든 GLB 가 못 열리고 수조는 코드 모델로만 남는다(오류 없이). 검수 뷰어(`viewer.mjs`)도 같은 디코더를 단다.
- 장식 37개는 같은 아틀라스를 여전히 하나씩 담는다(WebP 18KB × 37). 바깥 파일로 빼면 0.6MB 더 줄지만 파일 하나로 완결되는 계약(검수 도구 · 해시 · 경로)을 깨므로 하지 않았다.
- 원본과 같은 모델인지: `node scripts/aqua-model-verify.mjs --ref <압축 전 커밋>` — 게임과 같은 GLTFLoader + MeshoptDecoder 로 둘 다 열어 정점 수 · 삼각형 · 뼈 번호 · 가중치 · 쉬는/꺾은 자세의 뼈로 휜 위치 · 법선 · UV · 경계 상자 · 재질 · 텍스처 PSNR 을 맞댄다(256/256 통과, 위치 오차 모델 크기의 6e-5 이하, PSNR 최저 34.7dB). 형식 잠금은 `src/lib/aqua3d/assets-compress.test.ts`.
- `models.json` 의 `sha256` · `bytes` · `validation` 은 압축본 기준이다. 압축 전 해시는 `compression.uncompressedSha256` — `native-render.json` 의 WebGL 사진은 그 압축 전 GLB 로 찍었다(겉모습은 같다). 새로 찍으면 압축본 해시로 맞춰진다.
- gltf-validator 2.0.0-dev.3.10 은 meshopt 를 풀지 못한다(UNSUPPORTED_EXTENSION 정보 1건). 그래서 verify 가 압축을 푼 데이터(`expandGLB`)도 검사기에 한 번 더 넣는다.

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

압축(2026-11-05 이후):
- 새로 빌드하면 1번이 바로 압축본을 쓴다(텍스처는 512px 무손실 PNG 로 만들어 WebP 로 한 번만 손실 압축). 2번은 압축본을 검사기에 넣고, CPU 렌더에는 `expandGLB` 로 되푼 같은 모델을 쓴다.
- 이미 있는 압축 안 한 GLB 를 바꿀 땐 `node scripts/aqua-model-compress.mjs [key…] [--validator <gltf-validator 폴더>]` — 제자리에서, 여러 번 돌려도 같다. 2026-11-05 의 256개는 이 길로 바꿨다(768px JPEG 를 512 로 줄여 WebP). 같은 key 를 1번으로 다시 빌드하면 형상은 같고 텍스처 바이트만 다르다.
- 바꾼 뒤 `node scripts/aqua-model-verify.mjs --ref <압축 전 커밋> --validator <폴더>`. 검사기는 `npm i --prefix <임시 폴더> gltf-validator@2.0.0-dev.3.10` 처럼 레포 밖에 깐다(패키지 매니페스트를 건드리지 않는다).
- 쓰는 패키지는 이미 있는 `sharp` 와 `meshoptimizer`(1.1.1, @types/three 가 끌어온다) · `three` 의 meshopt_decoder 뿐이다. 설정값은 `glb-compress.mjs` 의 `COMPRESSION`.
- 되돌리기: 압축 전 GLB 는 git 이력에 있다(`git checkout <압축 전 커밋> -- public/aqua/models design/aqua3d-review/models.json`). glb.ts 의 디코더 등록은 그대로 둬도 압축 안 한 파일을 여는 데 문제없다.

`models/<key>-{front,side,oblique}.webp` contains every required view. Ray/manta forms also have top views because their references are dorsal. `all-fish-review-{1,2,3}.webp` and `all-decor-review-{1,2}.webp` provide the complete overview. Legacy `stage1-` comparison filenames are retained for viewer compatibility; their content now covers the full catalogue.
