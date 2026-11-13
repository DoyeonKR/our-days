# 그림 · 3D 모델 지침서 (최신 — 2026-11-13)

> **이 문서 하나만 본다.** 1 ~ 4차 물고기 확장 · 토종 · 때 손님 지침서(`FISH-EXPANSION-*` · `FISH-NATIVE-ART` · `FISHING-TIMED-ART`)는 전부 게임에 켜져 끝났으므로 지웠다 — 필요하면 git 이력(2026-11-13 이전)에서 본다.
> 목록 원본: 수조 그림 `design/AQUARIUM-ART.md`(← `scripts/aqua-art-prompts.mjs`) · 낚시 그림 `design/FISHING-ART.md`(← `scripts/fishing-art.mjs`) · 펫 원화 `design/HERO-ART-V3.md`.
> 그리는 쪽은 그림 세션(Codex), 게임에 켜는 쪽은 Claude 세션이다.

## 지금 그릴 것

| 묶음 | 수 | 프롬프트 | 넣는 곳 |
|---|---|---|---|
| A. 해양 포유류(물범 · 물개 · 바다사자 · 강치 · 해달 · 수달) | 그림 18 · 3D 모델 18 | `design/aqua3d-review/mammals-prompts.json` | `public/aqua/fish` · `public/aqua/models/fish` |
| B. 낚시 2D — 꽝 쓰레기 8 · 보물 · 유물 조각 18 · 만든 미끼 4 | 그림 30 | `design/FISHING-ART.md` 의 해당 표 | `node scripts/fishing-art.mjs sync <폴더>` |
| C. 두족류 3D 모델 다시 짓기(진짜 입체 · 팔마다 뼈 사슬) | 3D 모델 12 | 아래 C | `public/aqua/models/fish-v2`(검수 뒤 Claude 가 옮긴다) |

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

### C. 두족류 3D 모델 다시 짓기 — 12개(문어 · 크라켄 · 살오징어 · 대왕오징어 × 새끼 · 어린 · 다 큰)

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
