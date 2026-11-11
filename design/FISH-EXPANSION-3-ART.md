# 물고기 늘리기 3차 — 12계열 작업 목록 (2026-11-11)

[사용자: "물고기 종류도 더 늘려줄 수 있어?"]

⚠ **아직 게임에 없다. 그림과 3D 모델이 먼저다.** 지금 그려 둔 물고기(`PREPARED_FISH_KEYS`)는 222칸 전부 이미 켜져 있다. 표에만 넣으면 `aquaimagecoverage.test` · `fishing3dbound.test` 가 깨지고, 프로필 없는 종은 `makeReferenceAnimal` 이 던져서 수조가 멈춘다.
제작 형식은 1 · 2차와 같다 — `design/FISH-EXPANSION-ART.md` · `design/FISH-EXPANSION-2-ART.md` · `design/aqua3d-review/expansion-prompts.json`. 원본 프롬프트는 `design/aqua3d-review/expansion3-prompts.json` 에 남긴다.

어종마다 치어(`fry_<key>`) · 어린 개체(`juv_<key>`) · 성체(`<key>`) 3장 + GLB 3개 = 12계열 × 3 = **그림 36장 · 모델 36개**. 그림은 512px(투명) + 192px 축소본(`sm/`), 머리는 오른쪽. 실존 어종은 실제 생김새대로, 기존 게임 · 도감 그림을 따르지 않는다.

## 민물 4계열 — 강 · 계곡 · 열대관

| key | 이름 | 등급 | 낚시터 | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|
| `bitterling` | 각시붕어 | 보통 | 우포늪 · 두물머리 | 5 | Real Korean rose bitterling (Rhodeus uyekii), small deep-bodied fish, breeding male with iridescent violet-pink flank and red-edged fins, side view facing right, transparent background. |
| `shiri` | 쉬리 | 고급 | 봉화 계곡 · 섬진강 | 12 | Real Korean splendid shiner (Coreoleuciscus splendidus), slim body with yellow and black horizontal stripes and a bluish back, side view facing right, transparent background. |
| `sturgeon` | 철갑상어 | 영웅 | 남한강 · 소양호 | 180 | Real Amur sturgeon (Acipenser schrenckii), long grey body with rows of bony plates (scutes), pointed snout with barbels, shark-like tail, side view facing right, transparent background. |
| `arapaima` | 피라루쿠 | 전설 | 국립생태원 열대관 | 250 | Real arapaima (Arapaima gigas), huge torpedo body, olive-grey front fading to bright red-edged scales toward the tail, flat head, side view facing right, transparent background. |

## 바다 8계열

| key | 이름 | 등급 | 낚시터 | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|
| `mudskipper` | 짱뚱어 | 보통 | 남해 항구 · 통영 항구(갯벌 쪽) | 15 | Real great blue-spotted mudskipper (Boleophthalmus pectinirostris), bulging eyes on top of the head, tall spotted dorsal fin raised, pectoral fins like little arms, side view facing right, transparent background. |
| `filefish` | 쥐치 | 고급 | 통영 항구 · 거진항 | 25 | Real thread-sail filefish (Stephanolepis cirrhifer), flat diamond-shaped body, rough skin, single spine on top of the head, small mouth, side view facing right, transparent background. |
| `moray` | 곰치 | 희귀 | 서귀포 문섬 | 90 | Real reticulated moray eel (Gymnothorax sp.), long muscular body with brown net pattern, open mouth showing teeth, no pectoral fins, side view facing right, transparent background. |
| `lionfish` | 쏠배감펭 | 희귀 | 서귀포 문섬 · 기장 용궁사 | 30 | Real red lionfish (Pterois lunulata), red-and-white vertical stripes, long feathery venomous spines and fan-like pectoral fins, side view facing right, transparent background. |
| `seahorse` | 해마 | 영웅 | 서귀포 문섬 | 20 | Real Korean seahorse (Hippocampus haema), upright body with ringed bony plates, horse-like head, curled prehensile tail, tiny dorsal fin, side view facing right, transparent background. |
| `grouper` | 자바리 | 영웅 | 서귀포 문섬 · 울릉도 앞바다 | 100 | Real longtooth grouper (Epinephelus bruneus), heavy brown body with darker irregular bands, big mouth, side view facing right, transparent background. |
| `sunfish` | 개복치 | 전설 | 울릉도 앞바다 · 고성 거진항 | 250 | Real ocean sunfish (Mola mola), huge flat disc-shaped grey body, tall dorsal and anal fins, no real tail (clavus), small mouth, side view facing right, transparent background. |
| `marlin` | 청새치 | 전설 | 울릉도 앞바다 | 300 | Real striped marlin (Kajikia audax), long spear-like bill, tall sail-like dorsal fin, blue back with pale vertical stripes, crescent tail, side view facing right, transparent background. |

치어 · 어린 개체: 같은 종의 실제 어린 모습(투명한 치어 · 줄무늬가 덜 난 어린 개체). 철갑상어 치어는 판이 작고 머리가 큰 모습.

## 몸이 특이한 셋 — 모델 · 움직임 검수

- **해마**: 세로로 서서 등지느러미로 천천히 뜬다. 지금 뼈대(`spine_0~5`)는 가로로 헤엄치는 몸 기준이라, 해파리처럼 똑바로 세우는 각도(`glbUpright`)와 '거의 제자리에서 오르내리기' 습성이 필요하다. 꼬리를 수초에 감고 쉬는 모습은 장식 피하기와 겹치지 않게 본다.
- **개복치**: 몸이 원반이라 꼬리로 헤엄치지 않는다 — 위아래 지느러미를 번갈아 젓는다. 몸 물결(`bendProfile`)은 거의 0, 지느러미만 흔든다.
- **짱뚱어**: 바닥 생활(`floorPose`) — 모래 위에 앉아 가끔 통통 뛰어 옮긴다.

## 켜는 순서(그림 · 모델이 승인된 뒤)

1. `lib/aquarium.ts` — `FAMILIES` 에 값 순서대로, `FISH_BASE_CM` 에 위 길이. 민물이면 `FRESH_FAMILIES`, 열대관 관상어면 `ORNAMENTAL_FAMILIES`.
2. `lib/fishing.ts` — 그 낚시터 `pool` 에. ⚠ **그 낚시터의 가장 싼 미끼 단계**의 계열이어야 기본이 안 흔들린다(§14.4.7 밸런스). 미끼 1% 규칙 그대로.
3. `lib/aqua3d/habits.ts` 습성 표(사는 높이 · 빠르기 · 무리 · 바닥) — habits.test 가 빠진 계열을 잡는다. `glb.ts` 목록에 36개.
4. **새 계열은 서버도** — `private.fish_family_ok` 목록을 새 migration 으로 다시 정의한다(번호는 레포의 가장 마지막 파일 다음, serverguard.test 가 FAMILIES 와 견준다). 안 하면 그 계열은 점수만 받고 크기 순위엔 안 든다.
5. 수조 10 · 11단계 조건의 도감 수(100 · 180)는 222칸 기준이다 — 칸이 258칸이 되면 그대로 둘지 본다.
6. `fishing.test` · `fishingbalance.test` · `fishing3dbound.test` · `aquarium.test` · `fishingworld.test` · `aquaimagecoverage.test` 를 돌린다.
