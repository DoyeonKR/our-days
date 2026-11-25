# 그림 · 3D 모델 지침서 (최신 — 2026-11-13)

> **이 문서 하나만 본다.** 1 ~ 4차 물고기 확장 · 토종 · 때 손님 지침서(`FISH-EXPANSION-*` · `FISH-NATIVE-ART` · `FISHING-TIMED-ART`)는 전부 게임에 켜져 끝났으므로 지웠다 — 필요하면 git 이력(2026-11-13 이전)에서 본다.
> 목록 원본: 수조 그림 `design/AQUARIUM-ART.md`(← `scripts/aqua-art-prompts.mjs`) · 낚시 그림 `design/FISHING-ART.md`(← `scripts/fishing-art.mjs`) · 펫 원화 `design/HERO-ART-V3.md`.
> 그리는 쪽은 그림 세션(Codex), 게임에 켜는 쪽은 Claude 세션이다.

## 3D 모델 검수 규칙 (2026-11-17 — 누가 만들든 이걸 다 통과해야 게임에 넣는다)

[사용자: "새우들 탑뷰에서 확인해봐. 지금 다 무너지는 그래픽이야 고쳐 그리고 재발생하지않게 지침에 녹여" · "해파리도 지금 다리와 몸통이 분리되어있잖아 그러면 실패한 glb라고" · "몸과 다른 부품들이 떨어져있는것처럼 보이면 안대"]

1. **네 방향을 다 본다 — 옆 · 위에서 · 앞 · 비스듬히.** 원화가 옆모습이라 옆만 맞추기 쉽다. 위에서 본 모습이 무너지면 실패다(수조는 위 · 비스듬히에서도 본다). 검수 시트는 기준 이미지 | 네 방향을 한 줄로(`design/aqua3d-review/floating-parts.mjs` 의 `render4PNG`).
2. **몸통은 둥근 입체로.** 옆모습 윤곽을 앞뒤로 부풀린 판(relief)은 물고기 · 갑각류 몸통에 쓰지 않는다 — 옆에서만 원화와 같고 위에서 보면 납작한 판에 옆면 그림이 늘어져 무너진다(2026-11-17 새우 9종). 몸통은 원화에서 잰 중심선 · 굵기의 둥근 관(`shrimp-tube-build.mjs` · `golden-build.mjs`)이나 입체 모델로. 판 부풀리기는 정면에서 보는 장식에만(`relief-build.mjs decor`). `modelrules.test` 가 막는다.
3. **뼈를 입힌 채로 본다.** 정지 자세 꼭짓점만 보면 맞아도, 게임이 뼈를 입히는 순간 부품이 밀릴 수 있다 — 저장 전에 뼈 world 행렬을 계산하고(`bones[0].updateMatrixWorld(true)`) 바인드가 '뼈 world × 역바인드 = 단위'인지 본다(`bindpose.test`). 2026-11-17 해파리 입팔이 이것 때문에 갓과 떨어졌다. 검수 렌더는 three 로 뼈째 그린다.
4. **떠 있는 부품이 없어야 한다.** 다리 · 지느러미 · 수염 · 촉수 · 장식 조각이 몸에 닿아 있는지(`floating-parts-node.mjs` — 0 이어야 한다, 일부러 떨어진 거품 · 먹이 알갱이만 예외). 떠 있으면 `floating-repair.mjs` 로 붙이거나 다시 짓는다. 몸과 이어지지 않는 작은 조각(끊긴 더듬이 토막)은 붙이지 말고 버린다.
5. **기준 이미지와 견준다.** 윤곽(`silhouette-score.html` — 옆 IoU, 보통 물고기 0.97 안팎)과 색 · 무늬. 반투명한 원화(해파리 등)는 투명한 곳을 물빛으로 칠하지 않는다 — 물속에서 안 보여 부품이 떨어져 보인다(몸빛 바탕에 굽는다).
7. **게 · 가재(2026-11-18) `snow_crab`(대게) · `king_crab`(킹크랩) · `lobster`(바닷가재)** — 그림 세션 없이 Claude 세션이 지었다. 기준은 NOAA Fisheries 등쪽 일러스트(퍼블릭 도메인 · `design/aqua3d-review/crabs/reference`), 2D 는 머리 오른쪽으로 돌린 것(`crabs/make-art.mjs` — 새끼 · 어린 것은 옅게), 3D 는 위에서 본 그림을 둥글게 부풀린 입체(`crab-build.mjs` — 단면 √(d·(2R−d)), 다리 끝은 바닥으로 처진다). 위에서 그린 그림이라 위 · 비스듬히가 가장 원화에 가깝다. 다시 그릴 때의 설명은 `scripts/aqua-art-prompts.mjs` 의 CRAB. **다리 걸음(2026-11-18)**: 게임이 다리마다 따로 걷게 하므로(`src/lib/aqua3d/crabwalk.ts`), 게 · 가재 모델을 다시 짓거나 새로 들일 땐 그 파일의 `CRAB_ART`(기준 그림 위 다리마다 가운데 선 · 몸통 타원)도 같이 맞추고 `crabs/build-all.mjs` 로 짓는다 — 다른 다리끼리 맞닿은 칸을 자르고 가려진 다리 자리를 채우고 다리 번호(`_AQUA_PART`)를 굽는다. 검수는 정지 자세 네 방향에 더해 **걷는 모습**(`crabs/walk-review.webp` — 한 바퀴를 위 · 비스듬히)을 본다: 다리 사이에 막이 늘어나거나, 다리가 바닥 아래로 들어가거나, 조각이 떨어져 보이면 실패다(crabwalk.test 가 숫자로도 막는다).
8. **위에서 보이는 앞지느러미(2026-11-18)** — 포유류 · 거북처럼 앞지느러미가 몸 아래로 붙는 몸은, 지느러미 판을 몸과 나란히 세우면 위에서 모서리만 보인다. 뿌리 아래를 바깥 · 아래로 벌린다(`mammal-tube-build.mjs` 의 SPLAY — 바다사자 · 물개 약 55°). 벌린 뒤엔 떠 있는 부품 검사를 다시 돌린다(벌리면 판이 몸 표면에서 떨어진다 → `floating-repair.mjs`).
6. **규격**: +X 머리 · 길이 2 · 뼈 10개 이름 그대로 · 삼각형 8,000 안 · 16비트 색인(꼭짓점 65,535 안) · 바뀐 물고기는 `model-revisions.ts` 에 새 해시.

## 지금 그릴 것

> **2026-11-14 현재 A · B · D · E 는 끝나 게임에 켜졌다**(A 포유류 2026-11-13, B 낚시 2D 30장, D 새우 · E 해초 그림 2026-11-14). C(두족류 입체)는 한 번 바꿨다가 화면이 어색해 되돌렸고, **2026-11-18 Claude 세션이 다시 지어 오징어 · 대왕오징어는 켰고, 문어 · 크라켄 v3 는 후보로만 남겼다**(v3 — `design/aqua3d-review/ceph-v3-build.mjs`, README §14.4.6 '두족류 입체 모델 v3'). 아래 표 · 프롬프트는 기록으로 남긴다.

| 묶음 | 수 | 프롬프트 | 넣는 곳 |
|---|---|---|---|
| A. 해양 포유류(물범 · 물개 · 바다사자 · 강치 · 해달 · 수달) | 그림 18 · 3D 모델 18 | `design/aqua3d-review/mammals-prompts.json` | `public/aqua/fish` · `public/aqua/models/fish` |
| B. 낚시 2D — 꽝 쓰레기 8 · 보물 · 유물 조각 18 · 만든 미끼 4 | 그림 30 | `design/FISHING-ART.md` 의 해당 표 | `node scripts/fishing-art.mjs sync <폴더>` |
| C. 두족류 3D 모델 다시 짓기(진짜 입체) — **오징어류 · 문어 켬(2026-11-18) · 크라켄은 후보** | 3D 모델 12 | 아래 C | 오징어류 · 문어 `public/aqua/models/fish` · 크라켄 후보 `design/aqua3d-review/ceph-v3/octopus-candidates`(옛 판은 `ceph-v3/old`) |
| D. 새우류 3계열(체리새우 · 대하 · 독도새우) | 그림 9 · 3D 모델 9 | 아래 D | `public/aqua/fish` · `public/aqua/models/fish` |
| E. 해초 꾸미기 3종(파래 · 미역 · 다시마) — 그림은 2026-11-14 교체 끝, 3D 는 코드 모델(잎 색만 그림에 맞춤, 2026-11-18) | 그림 3(+ 선택: 3D 모델 3) | `design/AQUARIUM-ART.md` 의 `sea_lettuce` · `sea_mustard` · `dasima` 줄 | `public/aqua/decor`(+ `sm`) · 모델은 `public/aqua/models/decor` |

B 의 key: `junk_buoy` `junk_basket` `junk_oar` `junk_ring` `junk_pole` `junk_stool` `junk_helmet` `junk_probe` · `relic_pottery_vase` `relic_pottery_jar` `relic_pottery_bowl` `relic_pottery_dropper` `relic_wreck_plate` `relic_wreck_compass` `relic_wreck_bell` `relic_wreck_anchor` `relic_wreck_wheel` `relic_pirate_coin` `relic_pirate_glass` `relic_pirate_key` `relic_pirate_map` `relic_palace_scale` `relic_palace_pearl` `relic_palace_crown` `relic_palace_tile` `relic_palace_seal` · `craft_scent` `craft_glow` `craft_shine` `craft_sticky`.
게임은 이미 이 key 를 찾는다 — 파일이 들어오면 벡터 임시 그림 대신 저절로 그림을 쓴다(그림 목록 `src/lib/fishingimages.ts` 는 sync 가 다시 쓴다).

---

## Codex 에 붙여 넣을 프롬프트

아래 구분선 사이를 그대로 붙여 넣는다.

---

우리 수조 · 낚시 게임에 들어갈 그림과 3D 모델을 만들어 줘. 게임 코드(`src/` · `supabase/` · `package.json`)는 건드리지 말고, 커밋하지 마(Claude 세션이 확인하고 켜면서 커밋한다). 다른 게임 · 캐릭터 · 도감 그림을 따라 하지 말고, 실존 동물은 학명대로 실제 생김새로 그린다. 끝나면 묶음마다 무엇을 만들었는지, 어떤 key 가 아직 어색한지 한 줄씩 알려 줘.

### A. 해양 포유류 6계열 — 그림 18장 + 3D 모델 18개

**무엇을** — `design/aqua3d-review/mammals-prompts.json` 의 `items` 18개(계열마다 새끼 `fry_<key>` · 어린 개체 `juv_<key>` · 다 큰 개체 `<key>`). 그림마다 문장은 `subject`, 공통 화풍은 `style`, 계열마다 몸(`body`) · 위에서 본 폭/길이(`widthRatio`) · 사는 곳 · 사냥은 `species`.

| key | 이름 | 등급 | 다 큰 몸길이 | 몸 | 위에서 본 폭/길이 |
|---|---|---|---|---|---|
| `spotted_seal` | 점박이물범(백령도) | 영웅 | 160cm | seal — 귀 없는 물범 | 0.28 |
| `fur_seal` | 물개 | 영웅 | 150cm | sealion — 귓바퀴 있는 물개류 | 0.24 |
| `steller_sea_lion` | 큰바다사자 | 전설 | 280cm | sealion | 0.27 |
| `japanese_sea_lion` | 독도 강치(멸종 — 표본 복원) | 신화 | 230cm | sealion | 0.25 |
| `sea_otter` | 해달 | 전설 | 130cm | otter | 0.26 |
| `otter` | 수달(천연기념물) | 희귀 | 110cm | otter — 민물 | 0.18 |

**그림**(`built-in image_gen`, 1024px 원본은 `design/aqua3d-review/mammals-originals/`, 게임용은 `public/aqua/fish/<key>.webp` 512px 투명 + `public/aqua/fish/sm/<key>.webp` 192px)
- 물속에서 헤엄치는 옆모습 · 머리 오른쪽 · 배가 아래 · 몸을 곧게 편 자세. 앞 · 뒤 지느러미(또는 네 다리)가 몸에 가리지 않고 다 보이게. 해달도 이 자세로 그린다(배를 하늘로 띄운 자세는 게임이 움직임으로 만든다).
- **빛 반사 금지** — 젖은 털 · 피부에 하얀 반사 띠 · 번쩍임을 그리지 않는다(게임이 위에서 볼 때 등 색을 그림 등 쪽에서 가져와 흰 무늬가 된다). 고르고 부드러운 빛.
- 등 색이 몸 위쪽 끝까지 이어지게, 몸 테두리에 어두운 외곽선 · 번진 테두리 없이.
- 입은 다문 채 입 선이 또렷하게(게임이 셰이더로 턱을 연다), 콧구멍은 닫힘(물속). 수염은 짧게 · 주둥이에 스며들게 — 머리 밖으로 뻗은 가는 선이면 모델 판에서 바늘이 된다.
- 눈은 그림에 그린다(모델에 눈 구슬을 따로 달지 않는다).
- 새끼 · 어린 개체는 다 큰 것을 줄인 그림이 아니라 그 종의 실제 어린 모습(점박이물범 새끼는 흰 배냇털, 물개 새끼는 검은 털, 해달 새끼는 부풀어 오른 금갈색 털).
- 강치는 멸종종이다 — 박물관 표본 · 학술 복원 그대로, 신비롭게 꾸미지 않는다.

**3D 모델**(`public/aqua/models/fish/<key>.glb`) — 물고기 파이프라인(`design/aqua3d-review/build-stage1.mjs` → `review-stage1.mjs` → `glb-compress.mjs`, Node 22+ 는 `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`)을 쓰되 몸은 포유류로 새로 짓는다. 계약은 `design/aqua3d-review/README.md` 그대로라 게임 엔진이 그대로 움직인다:
- +X 머리 · +Y 위 · +Z 옆, 몸 가운데 원점, 길이 약 2(꼬리 · 뒷지느러미 끝까지), 재질 하나 · 텍스처 하나(512px WebP), meshopt · 양자화 · `EXT_texture_webp`, 삼각형 3,000 이하 · 300KB 이하.
- 뼈 10개 이름 그대로: `spine_0`(머리) → `spine_5`(꼬리 끝), `fin_L` · `fin_L_tip` · `fin_R` · `fin_R_tip` = **앞지느러미 · 앞다리**.
  - 물범(seal): 뒷지느러미 두 장은 꼬리처럼 뒤로 뻗은 한 쌍 — `spine_4` · `spine_5` 에 묶는다(물범은 뒷지느러미를 좌우로 저어 나간다 = 게임의 꼬리 물결). 앞지느러미는 작게.
  - 물개 · 바다사자 · 강치(sealion): 앞지느러미가 길고 날개처럼 크다 — 몸길이의 25 ~ 30%, 뒤로 젖혀 `fin_*` 에(게임이 이 뼈로 노를 젓는다). 뒷지느러미는 뒤로 모아 `spine_5`.
  - 해달 · 수달(otter): 짧은 앞다리 · 발을 `fin_*` 에. 해달은 뒷발이 넓은 지느러미발, 수달은 굵게 가늘어지는 긴 꼬리가 `spine_3` ~ `spine_5`. 물갈퀴 발은 얇은 판이 아니라 두께 있는 발.
- **몸통은 둥근 원통**(물고기 튜브 고리 구조 그대로 — 정점 맨 앞에 x 가 같은 17점 고리를 앞에서 뒤로 41개): 옆 폭은 표의 `widthRatio`(가장 넓은 폭 ÷ 몸길이)로, 가장 넓은 곳은 가슴 · 배(앞에서 35 ~ 50%), 머리 · 목은 부드럽게 좁아지고, 위아래 폭과 옆 폭이 거의 같은 둥근 단면(물고기처럼 옆으로 납작하지 않다). 등지느러미 같은 판은 없다 — 실루엣 판은 지느러미 · 발 · 꼬리에만.
- 털 · 피부 결은 텍스처에만(털을 형상으로 세우지 않는다). 위에서 볼 때 등 그림 자리(UV)는 각도에 고르게 펴서 그림의 몸 안쪽을 찍는다(위쪽 끝 몇 줄을 넓게 늘이면 등에 줄무늬가 났다).
- 게임은 이 계열을 '위에서 본 물고기 몸 다듬기'에서 뺀다(Claude 가 켤 때 `NOT_FUSIFORM` 에 더한다) — 그러니 모델이 처음부터 위에서 봐도 둥글고 자연스러워야 한다.

**검수 자료**(지금까지와 같은 모양): `design/aqua3d-review/mammals-art.webp`(그림 18장), `mammals-models-*.webp`(그림 · 옆 · 비스듬히), `mammals-top-*.webp`(**위 · 비스듬히 · 옆** — 검수의 중심), `mammals-validation.json`(Khronos 검증 오류 0), `mammals-status.json`(`visualApproval: "pending"`, `activation: "not enabled"`). `models.json` 에 18개 기록, `viewer.mjs` 에 `?set=mammals`.

### B. 낚시 2D 그림 30장

`design/FISHING-ART.md` 의 '장비 공통' 프롬프트 + 표의 설명으로 그린다(손으로 칠한 게임 아이콘풍, 투명 배경, 10% 여백, 52px 에서도 읽히는 실루엣, 글자 없음). 대상은 위 '지금 그릴 것'의 B key 30개(꽝 쓰레기 8 · 유물 18 · 만든 미끼 4). 같은 세트끼리 색 톤을 맞춘다(옛 도자기 · 난파선 · 해적의 보물 · 용궁). 다 그리면 파일 이름을 key 로 저장하고 `node scripts/fishing-art.mjs sync <그림 폴더>` 를 돌린다(이 스크립트는 `src/lib/fishingimages.ts` 를 다시 쓰는데, 이 파일만은 고쳐도 된다). 검수용으로 30장을 한 장에 모은 `design/fishing-review/batch-2026-11-13.webp` 도 만들어 줘.

### D. 새우류 3계열 — 그림 9장 + 3D 모델 9개 (2026-11-14 [사용자: "새우류 추가"])

| key | 이름 | 등급(안) | 다 큰 몸길이 | 사는 곳 | 위에서 본 폭/길이 |
|---|---|---|---|---|---|
| `cherry_shrimp` | 체리새우(관상 · *Neocaridina davidi* 붉은 품종) | 흔함 | 3cm | 민물 · 수초 사이 | 0.22 |
| `fleshy_prawn` | 대하(*Fenneropenaeus chinensis*, 서해) | 고급 | 25cm | 바다 · 모래 바닥 | 0.18 |
| `dokdo_shrimp` | 독도새우(도화새우 *Pandalus hypsinotus*, 동해 심해) | 희귀 | 20cm | 깊은 바다 바닥 | 0.2 |

**그림**: 위 A 의 규칙과 같다(머리 오른쪽 · 옆모습 · 배가 아래 · 빛 반사 금지 · 512px 투명 + sm 192px, key 는 `fry_<key>` · `juv_<key>` · `<key>`). 마디진 몸통(머리가슴 + 배 6마디) · 꼬리부채 · 긴 더듬이 두 쌍 · 걷는 다리 · 헤엄다리가 다 보이게. 더듬이는 머리 뒤로 몸길이만큼 휘어 내려 몸 가까이(머리 밖으로 곧게 뻗은 가는 선은 모델에서 바늘이 된다). 새끼는 그 종의 실제 어린 모습(투명에 가까운 작은 새우).
**3D 모델**: A 와 같은 계약(+X 머리 · 뼈 10개 · 삼각형 3,000 · 300KB). `spine_0` 머리가슴 → `spine_5` 꼬리부채(배 마디가 이 사슬을 따라 굽는다 — 게임이 꼬리를 배 쪽으로 튕겨 뒤로 달아나는 동작을 만든다), `fin_L` · `fin_R` = 헤엄다리 묶음. 몸 단면은 위아래로 조금 높은 둥근 통, 걷는 다리는 두께 있는 가는 기둥 몇 개(판 하나로 그리지 않는다).
**게임 쪽 뼈대는 이미 들어가 있다** — `src/lib/shrimp.ts`(계열 값 · 몸길이 · 낚시터 자리 · 바닥을 기다 뒤로 튀는 습성)가 `SHRIMP_ON = false` 로 꺼져 있다. 그림 세션은 그림 · 모델만 만들고, 켜는 순서는 그 파일 머리 주석대로 Claude 세션이 한다.
**검수**: `design/aqua3d-review/shrimp-*.webp`(그림 9장 · 위 · 비스듬히 · 옆) · `shrimp-validation.json` · `models.json` 기록 · `visualApproval: "pending"`. 켜는 건 Claude 세션(계열 표 · 낚시터 · 습성 · 서버 `fish_family_ok` migration).

### D2. 고래 5종 · 톱상어 — 그림 18장 + 3D 모델 18개 (2026-11-18, Claude 세션이 만들었다 — 다시 그릴 때의 기록)

| key | 이름 | 등급 | 다 큰 몸길이 | 기준 그림(퍼블릭 도메인) |
|---|---|---|---|---|
| `minke_whale` | 밍크고래 | 영웅 | 8m | NOAA *Balaenoptera acutorostrata* |
| `gray_whale` | 귀신고래 | 전설 | 13m | NOAA *Eschrichtius robustus* |
| `humpback_whale` | 혹등고래 | 전설 | 15m | NOAA *Megaptera novaeangliae* |
| `sperm_whale` | 향유고래 | 신화 | 16m | NOAA *Physeter macrocephalus* |
| `blue_whale` | 흰수염고래 | 태초 | 25m | NOAA *Balaenoptera musculus* |
| `sawshark` | 톱상어 | 영웅 | 1.5m | *Pristiophorus cirratus* 옛 채색 도판(같은 속) |

**그림**: `design/aqua3d-review/whales/make-art.mjs` — 흰 바탕을 가장자리에서 채워 지우고, 흑백 원화는 밝기를 종의 몸빛으로 물들인다(머리 오른쪽 · 512 투명 · sm 192). 새끼 · 어린 것은 옅게.
**3D**: `whales/build.mjs` — 원화에서 잰 중심선 · 반두께의 둥근 몸통 + 가슴지느러미는 fin 뼈. **고래 꼬리지느러미는 수평**이라 원화의 세로 꼬리 판을 빼고 갈래 둘 · 가운데 홈의 수평 꼬리를 따로 짓는다(톱상어는 세로 꼬리). 검수 `whales/review.webp`(기준 | 옆 · 위 · 앞 · 비스듬히), 떠 있는 부품 0.

### D3. 바다코끼리 · 황제펭귄 — 그림 6장 + 3D 모델 6개 (2026-11-24, Claude 세션이 만들었다 — 다시 그릴 때의 기록)

| key | 이름 | 등급 | 다 큰 몸길이 | 기준(퍼블릭 도메인) |
|---|---|---|---|---|
| `walrus` | 바다코끼리 | 전설 | 3.3m | USFWS 사진 "Pacific Walrus - Bull"(Joel Garlich-Miller) — 머리 · 엄니 · 피부 |
| `emperor_penguin` | 황제펭귄 | 영웅 | 1.15m | 헤엄치는 펭귄 사진 "Penguin under water"(Tor-Egil Farestveit) — 깃털 결만 |

**그림**: 바다코끼리 = `walrus/make-art.mjs`(우리 물범 그림을 부풀린 몸) → `walrus/photo-head.mjs`(사진 머리 · 목을 뒤집어 붙이고 몸 색을 사진 피부에 맞춤, 어린 개체는 엄니를 짧게 · 새끼는 지움 — 엄니 자리는 `walrus/<key>-tusk.png`). 황제펭귄 = `penguin/make-art.mjs`(SVG — 검은 등 · 흰 배 · 노란 귀 무늬 · 아랫부리 주황 줄 · 새끼는 회색 솜털과 흰 얼굴 가면) → `penguin/photo-penguin.mjs`(사진의 잔결만 얹는다). 사용자 참고 사진 · 조형물 · 시트는 비율만 봤다(저작권).
**3D**: `mammal-tube-build.mjs` — 바다코끼리는 앞쪽 40%(머리 · 목)를 열의 위 · 아래 끝으로 재 관에 넣고, 엄니는 마스크로 몸 · 지느러미 판에서 빼 주둥이 밑에서 아래 · 조금 뒤로 뻗는 원뿔 둘로(머리 뼈). 검수 `walrus/review.webp` · `penguin/review.webp`.

### D4. 남극 10종 — 그림 30장 + 3D 모델 30개 (2026-11-25, Claude 세션이 만들었다 — 다시 그릴 때의 기록)

| key | 이름 | 등급 | 다 큰 몸길이 | 오는 곳 |
|---|---|---|---|---|
| `gentoo_penguin` | 젠투펭귄 | 고급 | 80cm | 세종기지 pool |
| `adelie_penguin` | 아델리펭귄 | 고급 | 70cm | 세종기지 pool |
| `giant_isopod` | 남극 대왕등각류 | 고급 | 19cm | 세종기지 pool |
| `chinstrap_penguin` | 턱끈펭귄 | 희귀 | 72cm | 세종기지 낮(때 손님) |
| `icefish` | 남극빙어 | 희귀 | 60cm | 세종기지 해 질 녘 |
| `sea_pig` | 바다돼지 | 희귀 | 15cm | 세종기지 밤 |
| `antarctic_urchin` | 남극성게 | 흔함 | 7cm | 세종기지 새벽 |
| `clione` | 클리오네 | 영웅 | 4cm | 세종기지 맑은 날 |
| `toothfish` | 메로(남극이빨고기) | 전설 | 1.75m | 세종기지 밤 |
| `salp` | 살프 사슬 | 전설 | 60cm(사슬) | 세종기지 눈 오는 날 |

**3D(2판 — 2026-11-25 [사용자: "기준이미지 없이 모델을 만드니 그렇게 허접하게 만들지 너무 다르잖아 실제 어종과"])**: 기준은 퍼블릭 도메인 · CC0 사진과 도판(`polar/reference/SOURCES.md`). `polar/ref-art.mjs` 가 바탕을 오려 카드 그림과 3D 용 그림(`polar/model-art/`)을 만든다. 메로 · 빙어 = `whales/build.mjs`(사진에서 잰 중심선 · 두께의 둥근 몸통 + 사진을 몸에 입힘, 단면 타원) — 빙어 도판은 꼬리가 휘어 있어 곧게 편 그림(`icefishModelArt`)으로. 클리오네 · 등각류 = 위에서 본 사진을 `crab-build.mjs` 로 부풀림(`polar/top-build.mjs` — 클리오네 날개는 얇게 · 반투명). 성게 = 사진 윤곽의 회전체 + 사진 무늬 + 가시 520(`polar/urchin-build.mjs`). 바다돼지 = 도판 윤곽대로 몸통 + 도판 자리의 돌기 · 다리 · 입 촉수, 도판 무늬(`polar/seapig-build.mjs`). 살프 = 낱개 도판 무늬를 입힌 통 여덟 사슬(`polar/salp-build.mjs`, 사슬 사진은 퍼블릭 도메인으로 찾지 못했다). 펭귄 셋 = 부위로 짓고(`polar/penguins-build.mjs`) 사진과 견줘 머리 · 목 · 닫힌 부리 · 턱끈을 맞췄다. 1판(그림 없이 지은 `antfish-build` · `inverts-build`)은 지웠다.
**그림**: 메로 · 빙어 · 클리오네 · 등각류 · 성게 · 바다돼지는 기준 사진 · 도판을 오린 것(바다돼지는 흑백 도판을 살아 있는 분홍으로, 빙어는 흰 몸빛으로 칠했다). 펭귄 셋 · 살프는 모델을 찍었다(`ceph-v3/review.html?card=` → `polar/cards-to-art.mjs`). 검수 `polar/review-antarctic.webp`(기준 | 카드 | 다섯 방향).

### D5. 북극곰 — 그림 3장 + 3D 모델 3개 (2026-11-25, Claude 세션이 만들었다 — 다시 그릴 때의 기록)

| key | 이름 | 등급 | 다 큰 몸길이 | 오는 곳 |
|---|---|---|---|---|
| `polar_bear` | 북극곰 | 태초 | 2.5m | 고성 거진항 밤(때 손님 · 뽑혀도 30%) |

**3D**: `polarbear/polarbear-build.mjs` — 부위로 짓는다(몸통 · 목 · 머리 한 줄 관 + 다리 넷 · 귀 · 눈 · 코 · 발톱 · 꼬리). 단면은 원이 아니다(몸통은 옆이 납작한 깊은 통, 머리는 이마가 평평하고 뺨이 넓은 쐐기 — `hr(x, θ)`). 비율은 USFWS 옆모습 사진, 헤엄 자세는 Ltshears 물속 사진, 얼굴은 Unsplash(CC0) 사진(`polarbear/reference/SOURCES.md`). 털은 흐르는 방향으로 늘인 가닥 · 다발 무늬를 계산으로 칠한다(사진 조각을 깔면 반복 무늬가 생긴다). 앞다리는 fin 뼈 — 게임이 좌우 엇갈려 앞뒤로 젓는다(`anatomy` 의 URSID · `glb` 의 개헤엄). 등록은 `polarbear/register.mjs`.
**그림**: 모델을 찍었다(`ceph-v3/review.html?card=` → `polar/cards-to-art.mjs`). 헤엄 사진을 오려 쓰려 했지만 바닥과 붙어 깔끔하게 안 오려졌다. 검수 `polarbear/review.webp`.

### F. 범고래 새끼 · 어린 개체 — 그림 2장 + 3D 모델 2개 (2026-11-14)

> **2026-11-18 끝** — 그림 세션 없이 Claude 세션이 다 큰 모델 · 그림에서 비율만 바꿔 만들었다(`design/aqua3d-review/orca-young-build.mjs` · `orca-young-art.mjs`, 검수 `orca-young/review.webp`). 진짜 새끼 그림으로 다시 그리면 이 두 스크립트 대신 아래 규칙대로.

다 큰 범고래(`orca`)는 켜졌다(사용자 메시 → `design/aqua3d-review/orca-build.mjs`). `fry_orca` · `juv_orca` 는 지금 다 큰 그림 · 모델을 그대로 쓴다.
그림은 A 의 규칙(머리 오른쪽 · 옆모습 · 빛 반사 금지 · 512px 투명 + sm 192px)으로 `public/aqua/fish/fry_orca.webp` · `juv_orca.webp` 를 덮어쓴다. 설명은 `design/AQUARIUM-ART.md` 의 `fry_orca` · `juv_orca` 줄(새끼는 흰 무늬가 연한 주황빛 · 몸이 짧고 머리 · 지느러미가 크다).
모델은 `orca-build.mjs` 와 같은 계약(뼈 10개 · 삼각형 3,000 · 300KB). 새로 짓기 어렵다면 다 큰 모델을 비율만 바꿔(몸 짧게 · 머리 크게) 다시 구워도 된다.

### C. 두족류 3D 모델 다시 짓기 — 12개(문어 · 크라켄 · 살오징어 · 대왕오징어 × 새끼 · 어린 · 다 큰)

> **2차(2026-11-18): 문어 3모습도 켬 · 크라켄은 여전히 후보** — 팔을 그림에서 따라 그린 길로 짓고 팔 텍스처를 그 길을 편 띠로 · 빨판 구슬 · 크라켄 혹 머리 · 등 줄무늬 고침(README §14.4.6 '두족류 v3 2차', 검수 `ceph-v3/review-octopus-2.webp` · `review-kraken-2.webp`). 크라켄은 수조 카메라에서 옛 판의 빽빽한 촉수보다 성겨 켜지 않았다.
>
> **오징어 · 대왕오징어 켬(2026-11-18) · 문어 · 크라켄 v3 는 후보(Claude 세션 — v3)**: 오징어류는 옛 것과 비슷하거나 나아 켰다. 문어 · 크라켄 v3 는 위 · 앞에선 낫지만 수조 카메라에선 옛 그림 판보다 팔 · 텍스처가 단순하고, 크라켄은 혹투성이 머리를 잃고, 위에서 보면 몸 무늬가 줄무늬로 늘어져 `design/aqua3d-review/ceph-v3/octopus-candidates` 에만 두었다 — 게임은 옛 판 + 옛 팔 경로(`cephalopod.ts`)다. 다시 할 때는 팔 결(빨판 · 주름) · 크라켄 머리 혹 · 위쪽 몸 텍스처부터. 아래 설계와 다른 점 — 팔마다 뼈 사슬(`arm_<a>_<j>`)을 더하지 않고 뼈 10개 계약을 지켰다. 팔은 uv 의 팔 띠(`CEPH_UV`)로 팔 번호 · 뿌리→끝을 읽어 정점 셰이더가 팔마다 3D 로 굽힌다(`src/lib/aqua3d/cephalopod3d.ts`). 몸은 그림에서 잰 둥근 관에 그림을 굽고, 문어 팔은 바닥에 펼친 별이 아니라 몸 아래로 늘어진 아치(옆모습이 그림과 닮게 — v2 는 수평으로 펼쳐 옆에서 막대였다). 빨판은 텍스처만(법선 굴곡 없음), 켠 파일은 `fish-v2` 를 거치지 않고 바로 `public/aqua/models/fish`. 검수 `design/aqua3d-review/ceph-v3/review-*.webp`. 아래는 처음 설계 기록.

**왜** — 지금 두족류 GLB 는 옆에서 본 그림 한 장을 두께 있게 세운 판이고 뼈가 몸길이 사슬 여섯뿐이다. 게임이 정점 셰이더로 팔을 하나씩 굽히고(2026-11-13, `src/lib/aqua3d/cephalopod.ts`) 물 뿜기 · 숨 · 기기를 흉내 내지만, 위 · 앞에서 보면 납작한 판이라 진짜 문어처럼(팔 여덟이 사방으로 퍼지고 바닥을 짚는다) 보일 수 없다. 이게 두족류 움직임의 남은 상한이다.

**무엇을** — 같은 key 12개를 새 모델로 바꾼다(`octopus` `fry_octopus` `juv_octopus` `kraken` `fry_kraken` `juv_kraken` `squid` `fry_squid` `juv_squid` `giant_squid` `fry_giant_squid` `juv_giant_squid`). 그림(`public/aqua/fish/<key>.webp`)은 그대로 쓰고 모델만 새로.
- **진짜 입체** — 외투막(달걀꼴 주머니) · 머리(눈 둘, 양옆) · 팔 고리(입 둘레). 문어 · 크라켄은 팔 8개가 팔 고리에서 **사방으로**(위에서 보면 별 모양) 나와 끝이 가늘어지고 끝이 말린 쉬는 자세, 팔 사이에 얇은 막(web)이 팔 길이의 20% 까지. 팔 안쪽(입 쪽)에 빨판 두 줄(형상 아닌 텍스처 + 얕은 법선 굴곡). 오징어류는 팔 8개 + 긴 촉완 2개가 앞으로 모이고 외투막 끝에 지느러미 한 쌍.
- **방향** — +X 가 외투막 끝의 반대(팔 고리 · 팔 쪽), +Y 위(문어는 외투막이 위 · 뒤로 기울어 앉은 자세), 원점은 팔 고리 가운데, 팔을 편 길이 약 2.
- **뼈** — 기존 10개(`spine_0..5` · `fin_*` — 엔진이 몸 전체를 움직인다)를 남기고 **팔마다 사슬 6개**를 더한다: `arm_<a>_<j>`(a = 0..7 팔, j = 0 뿌리 → 5 끝, 오징어 촉완은 `arm_8_*` · `arm_9_*`), 각 사슬의 부모는 `spine_0`. 외투막은 `mantle` 뼈 하나(숨 · 물 뿜기 때 부풀고 오므린다). 정점 가중치는 팔 안에서 이웃 마디끼리 부드럽게.
- 재질 하나 · 텍스처 하나(512px WebP, 그림의 색 · 무늬), meshopt · 양자화 · `EXT_texture_webp`, 삼각형 6,000 이하 · 400KB 이하(팔이 많아 물고기보다 조금 크다).

**검수 자료** — `design/aqua3d-review/ceph-v2-top-*.webp`(**위 · 앞 · 옆 · 비스듬히** 넷 — 팔 여덟이 위에서 별 모양으로 보이는지가 중심), `ceph-v2-validation.json`(Khronos 오류 0), `ceph-v2-status.json`(`visualApproval: "pending"`). 게임 연결(팔 사슬로 걷기 · 짚기 · 물 뿜기)은 Claude 세션이 새 뼈를 읽게 고친 뒤 켠다 — 그 전까지 기존 파일을 덮어쓰지 말고 `public/aqua/models/fish-v2/<key>.glb` 에 둔다.

---

## 물고기를 또 늘릴 때(다음 확장) — 그림 · 모델 공통 규칙

1 ~ 4차에서 게임이 고친 것을 처음부터 지킨다.
- 그림: 머리 오른쪽 · 투명 · 몸 전체 · 10% 여백 · 빛 반사 금지 · 등 어둡고 배 밝게 · 외곽선 없음 · 지느러미 다 펴서(가슴지느러미는 몸을 따라 뒤로 젖힌 자세) · 입 다문 채 입 선 또렷 · 눈은 그림에 · 새끼 · 어린 개체는 실제 어린 모습.
- 모델: 위 계약 그대로. 옆 폭은 위에서 본 실제 폭/길이로(그림의 몸 높이에서 따오지 않는다) · 아가미 뒤가 가장 넓고 꼬리자루로 매끈하게 · 튜브 꼭대기가 등지느러미까지 솟지 않게 · 실루엣 판의 몸 테두리 띠는 튜브 안쪽에 · 지느러미 판은 붙은 쪽 반두께 몸길이의 1 ~ 2% 에서 끝으로 얇게 · 가슴지느러미는 몸길이 12 ~ 18% 잎을 60° 눕히고 30° 젖혀 `fin_*` 에 · 사냥하는 종은 턱 경첩 자리까지 입 선을 맞춘다 · 띠 몸 · 납작 · 원반 · 세로 · 상자 · 물렁 몸은 문서에 따로 적는다.
- 검수: 그림 · 모델 대조 · **위에서 본 모습** · 검증 json · status json(`pending` / `not enabled`).
- 프롬프트 파일은 `design/aqua3d-review/<묶음>-prompts.json`(mode · style · species · items), 수조 그림 문서에 넣으려면 `scripts/aqua-art-prompts.mjs` 에 그 파일을 더한다.

## 그림 세션이 끝난 뒤(Claude 세션)

A. 해양 포유류 켜기
1. 검수 시트(특히 위에서 본 모습)를 보고 어색한 key 를 돌려보낸다.
2. 승인 — `src/lib/aqua3d/style-approvals.json` 에 18 key(원본 지문은 `scripts/aqua-model-profiles.mjs` 가 굽는 `profiles.json`) → `node scripts/aqua-approved.mjs`, `models.json` 의 approval.
3. 목록 — `aquaimages.ts` · `glb.ts` 의 `FISH_GLB`(+ `NOT_FUSIFORM` 에 여섯), `prepared.ts`, `scripts/aqua-art-prompts.mjs` 에 `mammals-prompts.json`.
4. 표 — `aquarium.ts` 의 `FAMILIES`(youngName "새끼" · 값 · 성장 시간은 앞뒤 계열 사이) · `FISH_BASE_CM`, 수달은 `FRESH_FAMILIES`.
5. 만나는 길 — 포유류를 낚싯바늘로 '낚는' 건 어색하다. 제안: 꽝(버려진 그물 · 낚싯줄)에 얽힌 포유류를 **구해 주는** 때 손님(`TIMED_ONLY`)으로 — 구하면 수조에 들어온다(점박이물범 · 물개는 바다 낚시터 새벽, 큰바다사자 · 강치는 울릉도 · 용궁사, 해달은 거진항, 수달은 섬진강 · 봉화 계곡 밤). 미끼 1% 규칙 · 시작 미끼 규칙을 지킨다.
6. 습성 — 물범은 바닥 가까이 미끄러지기, 물개류는 앞지느러미로 날듯이(빠르게 · 비틀기), 해달은 수면에 배를 위로 떠 있기(`glbUpright` 처럼 몸을 뒤집는 새 자세), 수달은 몸 물결. 모두 숨 쉬러 수면(`breathe` + `breathOnly`). 물개류 · 수달은 사냥꾼(`PREDATORS` · `HUNT`)이 될 수 있다.
7. 서버 — `private.fish_family_ok` 를 새 migration 으로(가장 큰 번호 다음), schema.sql 에도 한 번.
8. 테스트 · 화면(폰 크기) 확인 · README §14.4.9 · 배포.

B. 낚시 2D — sync 가 그림 목록을 고치면 끝이다(게임은 이미 그림을 찾는다). 화면에서 꽝 · 유물 · 만든 미끼 칸을 한 번 찍어 본다.
