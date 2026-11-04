# 한국 토종 · 실제 어종 목록 (그림 · 3D 작업용)

[사용자: "토종어 목록도 만들어줘 관상어는 빼고 그리고 맞지 않다면 적절한 곳에 배치해"]

2026-11-05 전부 켰다(낚시터 5곳 · 주인 5). 형식은 `design/FISH-EXPANSION-ART.md` · `design/aqua3d-review/expansion-prompts.json` 과 같다. 어종마다 치어(`fry_<key>`) · 어린 개체(`juv_<key>`) · 성체(`<key>`) 3장 + GLB 3개다. 모두 실존 종의 사실적인 그림 · 오른쪽을 보는 옆모습 · 투명 배경 · 한 종으로 자란다.

**전체 20종 = 그림 60장 · 모델 60개 + 새 낚시터 그림 5장.** 관상어는 이 목록에 없다. 불가사리 · 오징어 · 문어 · 심해 어종은 `design/FISH-EXPANSION-2-ART.md` 에 따로 있다.

## 민물 12종

| key | 이름 | 등급 | 낚시터 | size | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|---|
| `crucian` | 붕어 | 흔함 | 양평 두물머리 · 창녕 우포늪 | 16 | 25 | Real Korean crucian carp (Carassius auratus), deep olive-bronze body, silver-gold belly, large even scales, no barbels. |
| `pale_chub` | 피라미 | 흔함 | 양평 두물머리 | 14 | 12 | Real pale chub (Zacco platypus), slim silver body with faint blue-pink side bars, long anal fin. |
| `chinese_minnow` | 버들치 | 흔함 | 봉화 계곡 | 14 | 12 | Real Korean stream minnow (Rhynchocypris oxycephalus), slim brown-grey body with fine dark speckles. |
| `smelt` | 빙어 | 보통 | 춘천 소양호 | 14 | 13 | Real pond smelt (Hypomesus nipponensis), slender translucent silver body, faint dark side line, small adipose fin. |
| `bullhead` | 동자개 | 보통 | 양평 두물머리 · 하동 섬진강 | 17 | 22 | Real Korean bullhead (Tachysurus fulvidraco), yellow-brown body with dark blotches, four pairs of barbels, strong spines on the fins. |
| `common_carp` | 잉어 | 고급 | 창녕 우포늪 · 양평 두물머리 | 26 | 70 | Real wild common carp (Cyprinus carpio), heavy bronze-olive body, large scales, two pairs of barbels. Wild form, not ornamental koi colours. |
| `masu_salmon` | 산천어 | 고급 | 화천 화천천 | 19 | 28 | Real landlocked masu salmon (Oncorhynchus masou), silver-olive body with dark oval parr marks along the side, small dark spots. |
| `snakehead` | 가물치 | 희귀 | 창녕 우포늪 | 28 | 80 | Real northern snakehead (Channa argus), long cylindrical body, flat snake-like head, dark brown irregular blotches, long dorsal fin. |
| `mandarin_fish` | 쏘가리 | 희귀 | 양평 두물머리 · 하동 섬진강 | 23 | 50 | Real Korean mandarin fish (Siniperca scherzeri), yellow-brown body with dark leopard-like rosettes, large mouth, spiny dorsal fin. |
| `perch_kkeokji` | 꺽지 | 희귀 | 봉화 계곡 | 18 | 20 | Real Korean aucha perch (Coreoperca herzi), dark green-brown body with faint vertical bands, a blue-edged spot on the gill cover. |
| `eel` | 뱀장어 | 영웅 | 하동 섬진강 | 29 | 90 | Real Japanese eel (Anguilla japonica), long smooth snake-like body, dark olive back, pale belly, continuous fin around the tail. |
| `lenok` | 열목어 | 전설 | 봉화 계곡 | 25 | 60 | Real Korean lenok (Brachymystax lenok tsinlingensis), silver-brown body with small dark spots, reddish tint on the flank, small adipose fin. |

열목어는 실제로는 천연기념물이고 서식지 낚시가 금지돼 있다. 게임 안 이야기로만 두거나 뺄지는 켤 때 다시 본다.

## 바다 8종 — 지금 어종이 없는 한국 대표 어종

| key | 이름 | 등급 | 낚시터 | size | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|---|
| `mackerel` | 고등어 | 보통 | 통영 항구 | 20 | 35 | Real chub mackerel (Scomber japonicus), blue-green back with dark wavy lines, silver belly, small finlets. |
| `rockfish_bollak` | 볼락 | 보통 | 통영 항구 | 17 | 22 | Real dark-banded rockfish (Sebastes inermis), dark red-brown body with faint bands, very large eye. |
| `black_seabream` | 감성돔 | 고급 | 통영 항구 | 22 | 45 | Real black sea bream (Acanthopagrus schlegelii), deep grey-black compressed body, silver sheen, spiny dorsal fin. |
| `hairtail` | 갈치 | 희귀 | 서귀포 문섬 | 30 | 110 | Real largehead hairtail (Trichiurus lepturus), long ribbon-like mirror-silver body, sharp teeth, no tail fin. |
| `barred_knifejaw` | 돌돔 | 영웅 | 서귀포 문섬 | 25 | 55 | Real barred knifejaw (Oplegnathus fasciatus), deep body with bold black and white vertical bars, beak-like mouth. |
| `cutlassfish_pollock` | 명태 | 희귀 | 울릉도 앞바다 | 26 | 60 | Real Alaska pollock (Gadus chalcogrammus), slim mottled brown-olive back, silver belly, three dorsal fins, small chin barbel. |
| `sailfin_sandfish` | 도루묵 | 고급 | 울릉도 앞바다 | 18 | 25 | Real sailfin sandfish (Arctoscopus japonicus), scaleless silver-brown body with dark mottling on the back, large pectoral fins. |
| `puffer` | 황복 | 전설 | 하동 섬진강 어귀 → 통영 항구 | 22 | 40 | Real river puffer (Takifugu obscurus), rounded body, dark back with a large black spot behind the pectoral fin, yellow side stripe, white belly. |

## 새 낚시터 5곳 — 실제 지형 프롬프트

| 그림 key | 이름 | 물 | 프롬프트 |
|---|---|---|---|
| `spot_dumulmeori` | 양평 두물머리 | 강 | Real Korean place: Dumulmeori in Yangpyeong, where the Namhan and Bukhan rivers meet. Wide calm river at dawn, a huge old zelkova tree and a traditional wooden sail boat on the far bank, soft misty layered mountains behind, reeds along the far edge. |
| `spot_soyang` | 춘천 소양호 | 호수 | Real Korean place: Soyang Lake in Chuncheon in winter dawn. Broad dam lake between steep forested mountains, mist on still dark water, a small ferry far away. |
| `spot_hwacheon` | 화천 화천천 | 강 | Real Korean place: Hwacheon stream in winter. Frozen river with ice-fishing holes and small figures far away, snow-covered hills, pale clear sky. |
| `spot_bonghwa` | 봉화 계곡 | 계곡 | Real Korean place: a cold mountain valley in Bonghwa, Gyeongbuk. Clear shallow stream over round boulders, thick pine and broadleaf forest on steep slopes, soft morning light. |
| `spot_sanriver` | 단양 남한강 | 강 | Real Korean place: the Namhan River at Danyang. Tall limestone peaks rising from the water (Dodamsambong-like rock pillars), a small pavilion far away, emerald water. |

전부 4:5 세로(1024×1280), 물이 아래 약 70%. 그림을 넣으면 물 경계 높이를 재서 `FX_SPOTS` 에 적는다.

## 켜는 순서

1. `lib/aquarium.ts` — `FAMILIES`(값 순서) · `FISH_BASE_CM`.
2. `lib/fishing.ts` — `SPOTS` 에 낚시터를 더하고(레벨 오름차순) pool 에 넣는다. 민물은 `FRESH_FAMILIES` 에도. 낚시터마다 `BOSSES` 에 주인 한 마리(fishingworld.test 가 맞춰 본다).
3. 토종이 들어오면 지렁이로 무는 민물고기가 생기므로 `양평 두물머리`를 레벨 1 낚시터로 삼고, 관상어 낚시터 `서울 청계천` 은 뒤로 미룰지 다시 정한다.

## 제작 묶음 · 2026-11-05

- 내장 `image_gen`으로 원화 60장을 각각 새로 생성했다. 512px 투명 WebP는 `public/aqua/fish/`, 192px 사본은 `sm/`, 피부 자료는 `public/aqua/skin/`에 있다. 갈치 3단계는 몸이 너무 짧아 리본형 몸과 꼬리지느러미가 없는 형태로 다시 그렸다. 최종 프롬프트는 `design/aqua3d-review/native-prompts.json`에 보존했다.
- 원본 GLB 60개는 `public/aqua/models/fish/`에 있다. Y-up·머리 +X, 표준 뼈 10개·스킨 메쉬 1개·내장 512px PBR 텍스처 1장, 애니메이션 클립·외부 모델·압축 확장 없음. 갈치·뱀장어는 긴 몸을 별도 조형하고 동자개·잉어·명태의 수염을 입체로 추가했다. 기존 뼈 회전 런타임을 사용한다.
- 배경 5장은 `public/fishing/`에 1024×1280으로 저장했고 `FISHING-ART.md`·그림 목록에 추가했다. 물 경계 근삿값: 두물머리 .29, 소양호 .28, 화천천 .26, 봉화 .30, 남한강 .29.
- `FISH_IMAGE_KEYS`·`FISH_GLB`·참조 프로필·준비 목록을 연결했다. 기존 낚시터·장비·미끼·쓰레기는 유지한다.
- **이 자산 묶음의 외형 승인은 대기다.** 같은 작업 트리에서 별도 세션이 게임 출현을 동시에 구현해 현재 `FAMILIES`에는 토종 20계열이 들어 있다. 이 그림·모델 작업에서는 출현 규칙과 승인 기록을 직접 변경하지 않았다. 레벨·풀·주인·열목어 처리와 승인 상태는 활성화 담당 작업과 맞춰 확인해야 한다. 사진 한 장으로 확인할 수 없는 뒷면과 입·지느러미 접합부는 추정 조형이다. 구조 검사 통과가 외형 합격을 의미하지 않으며 숫자 점수로 자동 승인하지 않는다.
- 대조표는 `design/aqua3d-review/native-models-1.webp`~`10.webp`, 원화 모음은 `native-art-1.webp`~`4.webp`, 배경 모음은 `native-backgrounds.webp`다. 실제 GLB 각도별 렌더는 `models/<key>-{front,side,oblique}.webp`, 검사 결과는 `native-validation.json`·`models.json`·`native-status.json`에 남긴다.
- 검수: `http://127.0.0.1:4197/design/aqua3d-review/index.html?set=native`. 게임 계정·DB·저장 데이터를 변경하지 않는다.
