# 물고기 늘리기 4차 — 54계열 (2026-11-12)

[사용자: "물고기 최소 50종 이상으로 추가해 우리가 개선했던 것 미리 개선해서 그릴 수 있도록" · "곰치는 무조건 어디 숨어있어야 하는 거 알지?"]

3차 12계열(`FISH-EXPANSION-3-ART.md`)을 그대로 넣고 42계열을 더했다 — **54계열 × 치어 · 어린 개체 · 성체 = 그림 162장 · 모델 162개**. 지금 222칸 → 384칸.
그림 문장 162개 · 어종 표(`species`)는 `design/aqua3d-review/expansion4-prompts.json`(이 표와 같은 원본 — 고칠 땐 둘 다), 그림 세션에 붙여 넣을 프롬프트는 `design/FISH-EXPANSION-4-CODEX.md`.
⚠ **아직 게임에 없다.** 그림 · 모델이 승인된 뒤 켠다(아래 '켜는 순서').

- **몸**: fish 방추형 · compressed 옆으로 납작 · eel 띠 · flat 위아래로 납작(바닥에 눕는) · disc 원반 · upright 세로 · box 상자 · blob 물렁. fish · compressed 만 위에서 본 몸 다듬기(`topview.ts`)를 탄다 — 나머지는 `glb.ts` 의 `NOT_FUSIFORM` 에 더한다.
- **위에서 본 폭/길이**: 실제 물고기를 위에서 본 가장 넓은 폭 ÷ 몸길이(꼬리지느러미 포함). 모델은 이 값으로 옆 폭을 만든다(그림의 몸 높이로 만들지 않는다).
- **사냥**: `lib/aqua3d/hunt.ts` 의 `HUNT` — 방식(charge 돌진 · ambush 매복 · gulp 통째로 · strike 튕기기)/이빨(saw · fang · needle · rasp) 경첩 자리(머리 끝에서 몸길이 비율). — 는 사냥하지 않는다.

### 민물 14 — 한국 강 · 호수 · 계곡

| key | 이름 | 등급 | cm | 낚시터 | 몸 | 위에서 본 폭/길이 | 사는 곳 · 움직임 | 사냥(방식/이빨 경첩) |
|---|---|---|---|---|---|---|---|---|
| `bitterling` | 각시붕어 | 보통 | 5 | pond · dumulmeori | compressed | 0.16 | 중층 · 작은 무리 | — |
| `shiri` | 쉬리 | 고급 | 12 | bonghwa · seomjin | fish | 0.15 | 계곡 바닥 가까이 · 빠름 | — |
| `sturgeon` | 철갑상어 | 영웅 | 180 | sanriver · soyang | fish | 0.14 | 바닥 · 천천히(주둥이로 뒤진다) | — |
| `loach` | 미꾸라지 | 흔함 | 15 | pond · brook | eel | 0.1 | 바닥 · 진흙에 몸을 묻는다 | — |
| `dark_chub` | 갈겨니 | 흔함 | 15 | seomjin · bonghwa | fish | 0.15 | 중층 · 무리 | — |
| `sleeper` | 동사리 | 보통 | 15 | seomjin · sanriver | fish | 0.2 | 바닥 돌 밑 · 숨어 기다린다 | ambush/needle 0.3 |
| `gudgeon` | 모래무지 | 보통 | 18 | seomjin · dumulmeori | fish | 0.16 | 모래 바닥 · 모래에 반쯤 묻힌다 | — |
| `skygazer` | 강준치 | 고급 | 60 | soyang · sanriver | compressed | 0.12 | 윗물 · 빠름 | charge/needle 0.22 |
| `rainbow_trout` | 무지개송어 | 고급 | 50 | hwacheon · bonghwa | fish | 0.17 | 중층 · 물살 | charge/needle 0.22 |
| `grass_carp` | 초어 | 희귀 | 100 | dumulmeori · soyang | fish | 0.18 | 중층 · 수초를 뜯는다 | — |
| `bluegill` | 블루길 | 흔함 | 20 | pond · soyang | compressed | 0.14 | 수초 곁 · 무리 | — |
| `largemouth_bass` | 큰입배스 | 고급 | 50 | soyang · dumulmeori | fish | 0.22 | 수초 · 바위 곁에서 기다린다 | gulp/rasp 0.3 |
| `char` | 곤들매기 | 희귀 | 40 | hwacheon · soyang | fish | 0.17 | 찬물 깊은 곳 | charge/needle 0.22 |
| `ricefish` | 송사리 | 흔함 | 4 | brook · pond | fish | 0.18 | 윗물 · 무리 | — |

### 열대관 11 — 국립생태원 · 청계천 관상어

| key | 이름 | 등급 | cm | 낚시터 | 몸 | 위에서 본 폭/길이 | 사는 곳 · 움직임 | 사냥(방식/이빨 경첩) |
|---|---|---|---|---|---|---|---|---|
| `arapaima` | 피라루쿠 | 영웅(2026-11-13 낚시 밸런스 — 처음 전설) | 250 | jungle | fish | 0.17 | 윗물 · 숨 쉬러 수면 | gulp/rasp 0.25 |
| `oscar` | 오스카 | 희귀(2026-11-13 낚시 밸런스 — 처음 고급) | 30 | jungle | compressed | 0.2 | 중층 · 혼자 | gulp/rasp 0.28 |
| `molly` | 블랙몰리 | 흔함 | 8 | brook · jungle | fish | 0.2 | 윗물 · 무리 | — |
| `platy` | 플래티 | 흔함 | 6 | brook | fish | 0.22 | 중층 · 무리 | — |
| `zebra_danio` | 제브라다니오 | 흔함 | 5 | brook · jungle | fish | 0.14 | 윗물 · 빠른 무리 | — |
| `pleco` | 플레코 | 보통 | 40 | jungle | flat | 0.22 | 바닥 · 유리 · 돌에 붙는다(빨판 입) | — |
| `corydoras` | 코리도라스 | 흔함 | 6 | brook · jungle | fish | 0.22 | 바닥 · 무리로 모래를 뒤진다 | — |
| `gourami` | 드워프구라미 | 보통 | 8 | brook · jungle | compressed | 0.16 | 윗물 · 실 같은 배지느러미로 더듬는다 | — |
| `redtail_catfish` | 레드테일캣피시 | 영웅 | 120 | jungle | fish | 0.24 | 바닥 · 큰 입으로 삼킨다 | gulp/rasp 0.3 |
| `piranha` | 피라냐 | 희귀 | 30 | jungle | compressed | 0.18 | 중층 · 무리 지어 사냥 | charge/saw 0.18 |
| `electric_eel` | 전기뱀장어 | 영웅(2026-11-13 낚시 밸런스 — 처음 전설) | 200 | jungle | eel | 0.08 | 바닥 · 천천히(숨 쉬러 수면) | gulp/rasp 0.18 |

### 바다 24

| key | 이름 | 등급 | cm | 낚시터 | 몸 | 위에서 본 폭/길이 | 사는 곳 · 움직임 | 사냥(방식/이빨 경첩) |
|---|---|---|---|---|---|---|---|---|
| `mudskipper` | 짱뚱어 | 보통 | 15 | harbor | fish | 0.2 | 바닥 · 앉아 있다가 통통 뛴다 | — |
| `filefish` | 쥐치 | 고급 | 25 | harbor · starsea | compressed | 0.1 | 중층 · 바위 곁 | — |
| `moray` | 곰치 | 희귀 | 90 | reef | eel | 0.09 | ⚠ 바위 틈 · 굴에 숨는다 — 머리만 내밀고 입을 벌렸다 닫았다 숨 쉬며, 거의 안 나온다. 지나가는 먹이를 튀어나와 물고 다시 숨는다 | strike/fang 0.24 |
| `lionfish` | 쏠배감펭 | 희귀 | 30 | reef · palace | fish | 0.18 | 바위 곁 · 느릿느릿 · 지느러미로 몰아 삼킨다 | gulp/rasp 0.26 |
| `seahorse` | 해마 | 영웅 | 20 | reef | upright | 0.1 | 세로로 서서 · 꼬리를 수초에 감는다 | — |
| `grouper` | 자바리 | 영웅 | 100 | reef · ocean | fish | 0.24 | 바위 굴 앞 · 기다렸다 삼킨다 | gulp/rasp 0.3 |
| `sunfish` | 개복치 | 전설 | 250 | ocean · starsea | disc | 0.1 | 윗물 · 위아래 지느러미로 천천히 | — |
| `marlin` | 청새치 | 전설 | 300 | ocean | fish | 0.14 | 윗물 · 아주 빠름 | charge/needle 0.2 |
| `anchovy` | 멸치 | 흔함 | 12 | harbor · starsea | fish | 0.13 | 윗물 · 큰 무리 | — |
| `saury` | 꽁치 | 흔함 | 30 | starsea · ocean | fish | 0.08 | 윗물 · 무리 · 빠름 | — |
| `spanish_mackerel` | 삼치 | 고급 | 100 | harbor · ocean | fish | 0.13 | 중층 · 빠름 | charge/needle 0.2 |
| `cod` | 대구 | 고급 | 80 | starsea · ocean | fish | 0.2 | 바닥 가까이 · 찬물 | gulp/rasp 0.26 |
| `halfbeak` | 학공치 | 보통 | 35 | harbor | fish | 0.08 | 수면 바로 밑 · 무리 | — |
| `goby` | 문절망둑 | 흔함 | 15 | harbor | fish | 0.18 | 바닥 · 앉아서 쉰다 | — |
| `parrotfish` | 파랑비늘돔 | 희귀 | 40 | reef | fish | 0.2 | 산호 곁 · 부리로 갉는다 | — |
| `butterflyfish` | 나비고기 | 보통 | 15 | reef | compressed | 0.08 | 산호 곁 · 짝지어 | — |
| `blue_tang` | 블루탱 | 고급 | 25 | reef | compressed | 0.1 | 산호 곁 · 무리 | — |
| `boxfish` | 노랑거북복 | 보통 | 15 | reef | box | 0.4 | 바위 곁 · 지느러미로 맴돈다 | — |
| `scorpionfish` | 쏨뱅이 | 보통 | 25 | harbor · palace | fish | 0.22 | 바닥 바위 · 숨어 기다린다 | ambush/needle 0.28 |
| `goosefish` | 아귀 | 영웅 | 100 | starsea · ocean | flat | 0.45 | 바닥에 납작 · 입을 벌리고 기다린다 | ambush/needle 0.4 |
| `skate` | 홍어 | 희귀 | 100 | starsea | flat | 0.75 | 바닥에 납작 | — |
| `swordfish` | 황새치 | 전설 | 300 | ocean | fish | 0.16 | 윗물 · 아주 빠름 | charge/needle 0.18 |
| `barracuda` | 꼬치고기 | 희귀 | 100 | reef · ocean | fish | 0.11 | 중층 · 혼자 떠 있다 튀어 나간다 | strike/fang 0.22 |
| `dolphinfish` | 만새기 | 영웅 | 120 | ocean | compressed | 0.12 | 윗물 · 빠름 | charge/needle 0.2 |

### 심해 5 — 울릉분지

| key | 이름 | 등급 | cm | 낚시터 | 몸 | 위에서 본 폭/길이 | 사는 곳 · 움직임 | 사냥(방식/이빨 경첩) |
|---|---|---|---|---|---|---|---|---|
| `viperfish` | 독사고기 | 영웅 | 30 | abyss | fish | 0.1 | 깊은 곳 · 빛을 켜고 기다린다 | ambush/fang 0.3 |
| `hatchetfish` | 은도끼고기 | 보통 | 6 | abyss | compressed | 0.08 | 깊은 곳 · 무리 | — |
| `frilled_shark` | 주름상어 | 전설 | 200 | abyss | eel | 0.09 | 깊은 곳 · 뱀처럼 휘어 친다 | strike/needle 0.22 |
| `blobfish` | 블롭피시 | 희귀 | 30 | abyss | blob | 0.4 | 바닥 · 거의 안 움직인다 | — |
| `lanternfish` | 샛비늘치 | 흔함 | 8 | abyss | fish | 0.15 | 깊은 곳 · 큰 무리 · 밤에 떠오른다 | — |

## 습성에서 꼭 지킬 것

- ⚠ **곰치(`moray`)는 늘 숨어 있다** — 실제 곰치처럼 바위 틈 · 굴(수조의 바위 · 난파선 · 동굴 장식, 없으면 바닥 바위 그늘)에 몸을 넣고 머리만 내민다. 입을 천천히 벌렸다 닫았다 하며 숨 쉬고(위협이 아니라 숨쉬기), 거의 나오지 않는다. 먹이(사냥 대상)가 굴 앞을 지나면 몸을 반쯤 내밀어 물고(strike) 곧바로 굴로 돌아간다. 먹이를 줘도 굴 입구에서 받아먹는다. 굴 자리는 물고기마다 정해져 이어진다(저장 안 함 — 장식 배치에서 고른다).
  - 모델: 머리 ~ 몸 앞쪽이 굴 밖, 나머지는 굴 안에 감춰지므로 꼬리 쪽이 장식을 뚫어도 보이지 않게 그리기 순서 · 자리를 맞춘다.
- 바닥에 사는 것(동사리 · 모래무지 · 미꾸라지 · 문절망둑 · 짱뚱어 · 플레코 · 코리도라스 · 쏨뱅이 · 아귀 · 홍어 · 블롭피시 · 철갑상어)은 `floorPose` — 모래무지 · 미꾸라지는 몸을 반쯤 묻고, 플레코는 유리 · 돌에 입으로 붙는다.
- 무리(멸치 · 꽁치 · 제브라다니오 · 은도끼고기 · 샛비늘치 · 피라냐 · 갈겨니 · 송사리)는 `schoolCourse`.
- 해마는 세로로 서서(`glbUpright`) 거의 제자리에서 오르내리고 꼬리를 수초에 감는다. 개복치는 몸 물결 0, 위아래 지느러미를 젓는다. 거북복은 몸을 거의 안 굽히고 지느러미로 맴돈다.
- 전기뱀장어 · 피라루쿠는 가끔 숨 쉬러 수면에 올라온다(거북 숨쉬기와 같은 길).

## 켜는 순서(그림 · 모델이 승인된 뒤 — Claude 세션)

1. `lib/aquarium.ts` — `FAMILIES`(값 순서) · `FISH_BASE_CM` · 민물이면 `FRESH_FAMILIES` · 관상어면 `ORNAMENTAL_FAMILIES`.
2. `lib/fishing.ts` — 낚시터 `pool`. ⚠ 그 낚시터의 가장 싼 미끼 단계 계열이어야 기본이 안 흔들린다(§14.4.7). 미끼 1% 규칙 그대로. fishingbalance.test 로 잰다.
3. `lib/aqua3d/habits.ts` 습성 · `glb.ts` 목록(162) · `NOT_FUSIFORM` · 곰치 굴 습성(새 코드).
4. 사냥꾼은 `lib/predation` 의 `PREDATORS` · `hunt.ts` 의 `HUNT`.
5. 서버 `private.fish_family_ok` 를 새 migration 으로(레포의 가장 마지막 번호 다음) — serverguard.test.
6. 수조 10 · 11단계 도감 조건(100 · 180)을 384칸에 맞출지 본다.
7. 테스트 — fishing · fishingbalance · fishing3dbound · aquarium · fishingworld · aquaimagecoverage · habits · hunt · topview.
