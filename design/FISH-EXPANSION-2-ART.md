# 물고기 늘리기 2차 — 불가사리 · 오징어 · 문어 · 심해 어종 작업 목록

[사용자: "불가사리, 오징어, 문어, 심해의 경우 대왕오징어 크라켄, 초롱아귀 심해어는 별도로 또 따로 만들어"]

⚠ 아직 게임에 없다. 그림과 3D 모델이 먼저다(`fishing3dbound.test` 가 파일을 요구하고, `makeReferenceAnimal` 은 프로필이 없으면 던져서 수조가 멈춘다). 제작 형식은 1차와 같다 — `design/FISH-EXPANSION-ART.md` · `design/aqua3d-review/expansion-prompts.json`.

어종마다 치어(`fry_<key>`) · 어린 개체(`juv_<key>`) · 성체(`<key>`) 3장 + GLB 3개 = 9종 × 3 = **그림 27장 · 모델 27개**, 새 낚시터 그림 `spot_abyss` 1장(1024×1280, 물 경계 높이를 재서 `FX_SPOTS` 에 넣는다).

⚠ **물고기 몸이 아니다.** 지금 뼈대(`spine_0~5` · `fin_L/R`)와 `anatomy` 는 헤엄치는 물고기 기준이다. 불가사리는 다섯 팔이 바닥을 기고, 오징어 · 문어 · 대왕오징어 · 크라켄은 머리 쪽 몸통과 다리 묶음이 있다. 새 `kind`(star · cephalopod)와 그 움직임이 필요하다 — 해파리처럼 납작한 원반이 되지 않게 원화와 대조해 검수한다. 크라켄은 전설 속 존재라 기존 어떤 게임 · 영화의 디자인도 따르지 않고 새로 그린다.

## 얕은 바다 3종 — 정규 낚시터

| key | 이름 | 등급 | 낚시터 | size | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|---|
| `starfish` | 별불가사리 | 고급 | 남해 항구 · 산호초 바다 | 18 | 15 | Real blue bat star (Patiria pectinifera), five short webbed arms, mottled blue-green with orange-red patches, viewed from a slight top angle, transparent background. |
| `squid` | 살오징어 | 희귀 | 남해 항구 · 먼 바다 | 26 | 35 | Real Japanese flying squid (Todarodes pacificus), slim reddish-brown mantle with triangular fins, eight arms and two tentacles held forward, large eye, side view with head to the right, transparent background. |
| `octopus` | 대문어 | 영웅 | 남해 항구 · 산호초 바다 | 30 | 120 | Real giant Pacific octopus (Enteroctopus dofleini), rounded reddish-brown mantle, eight long arms with visible suckers spreading naturally, textured skin, side view with head to the right, transparent background. |

## 심해 6종 — 새 낚시터 '심연'(Lv.28) · **심해 방식에서만 문다**

| key | 이름 | 등급 | size | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|
| `gulper_eel` | 풍선장어 | 영웅 | 30 | 75 | Real gulper eel (Eurypharynx pelecanoides), huge loose pouch-like mouth, thin whip tail with a small glowing tip, black body, side view facing right, transparent background. |
| `anglerfish` | 초롱아귀 | 전설 | 26 | 60 | Real deep-sea anglerfish (Melanocetus johnsonii), round black body, needle teeth in a large mouth, luminous lure on a stalk from the forehead, side view facing right, transparent background. |
| `oarfish` | 산갈치 | 전설 | 42 | 800 | Real giant oarfish (Regalecus glesne), very long ribbon-like silver body, continuous red dorsal fin, red crest on the head, side view facing right, transparent background. |
| `coelacanth` | 실러캔스 | 신화 | 36 | 190 | Real coelacanth (Latimeria chalumnae), heavy steel-blue body with pale spots, fleshy lobed fins, side view facing right, transparent background. |
| `giant_squid` | 대왕오징어 | 신화 | 44 | 1200 | Real giant squid (Architeuthis dux), long deep-red mantle, enormous eye, eight thick arms and two very long tentacles with clubbed ends, side view with head to the right, transparent background. |
| `kraken` | 크라켄 | 태초 | 45 | 2500 | Original legendary sea monster inspired by old sailors' tales: colossal dark teal cephalopod, barnacle-crusted mantle, glowing pale eyes, many thick arms with suckers, ancient and weathered. Original design, not based on any existing film or game. Side view with head to the right, transparent background. |

`spot_abyss` 프롬프트: First-person view from a small research boat at night over a vast dark ocean above a deep trench, faint bioluminescent glow rising from far below, a few drifting lights, calm black water filling the lower 70%, painted in the same style as the existing fishing spots, portrait 4:5, no text.

## 켜는 순서(그림 · 모델이 승인된 뒤)

1. `lib/aquarium.ts` — `FAMILIES` 에 값 순서대로, `FISH_BASE_CM` 에 위 길이.
2. `lib/fishing.ts` — 얕은 3종은 그 낚시터 `pool` 에 낮은 무게로. `SPOTS` 에 `abyss`(Lv.28)를 넣고 **심해 방식만 받는 규칙**을 더한다(`castBlock` 이 다른 방식을 막고 이유를 말한다). 심연의 주인은 크라켄(`BOSSES`, 전용 체력).
3. 2,500cm 는 `fishLength` 윗단(5.4)에 걸린다 — 크라켄 · 대왕오징어가 수조 폭의 절반 안에 드는지 눈으로 본다. 다리가 긴 몸은 `fishCourse` 반경도 본다.
4. `lib/fishingfx.ts` — `FX_SPOTS.abyss`. 도감 칸과 낚시 물고기 목록은 표에서 읽으므로 저절로 는다.
5. `fishing.test` · `fishing3dbound.test` · `aquarium.test` · `fishingworld.test`(도감 수) 를 돌린다.

## 제작 현황 · 2026-11-05

- 위 9종의 치어·어린 개체·성체 **27장**을 내장 이미지 생성 도구로 새로 그렸다. 원본 프롬프트는 `design/aqua3d-review/expansion2-prompts.json`, 게임용 그림은 `public/aqua/fish/`, 축소본은 `sm/`, 피부 자료는 `public/aqua/skin/`에 있다. 외부 모델·유료 3D 서비스는 사용하지 않았다.
- 원본 GLB **27개**를 `public/aqua/models/fish/`에 만들었다. 512px 내장 텍스처·PBR 재질 1개·스킨 메쉬 1개, 애니메이션 클립과 압축 확장 없음. 기존 10개 뼈 이름을 유지하고 불가사리는 팔 5개×3관절(총 25개), 문어·크라켄은 8개×3관절(34개), 오징어·대왕오징어는 10개×3관절(40개)을 추가했다. 실제 팔 뼈를 회전하는 런타임도 준비했다.
- `expansion2-validation.json`은 27개 GLB의 구조 검사 결과, `models.json`은 삼각형 수·바이트·뼈 이름·텍스처 크기·변형 검사를 기록한다. 실제 GLBLoader/WebGL로 찍은 각도별 렌더와 원화 대조표는 `models/`, 묶음 대조표는 `expansion2-models-1.webp`~`5.webp`에 있다.
- **2026-11-05 켰다**[사용자: "그림 세션도 다 올라오는거 확인하고 포함해서 배포해"]. 낚시터 울릉분지 심해(Lv.36) · 주인 심연의 크라켄. 문어 · 오징어 계열은 그림 윤곽 그대로의 몸(`fish-fit`)으로 다시 만들었다.
- 미완성 외형: 문어·크라켄의 팔별 자연스러운 배치, 촘촘한 흡반과 피부 굴곡, 깊이 방향에서 보이는 입·지느러미의 세부 조형은 원화보다 단순하다. 숫자 점수로 스스로 합격 처리하지 않는다. `http://127.0.0.1:4197/design/aqua3d-review/index.html?set=expansion2`에서 비교하고 사용자 승인을 받는다.
