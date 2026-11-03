# 물고기 늘리기 — 상어 · 횟감 그림 · 3D 작업 목록

[사용자: "물고기 종류가 52종에서 늘어나야함 상어류를 늘리고, 횟감 종류들도 늘렸으면 좋겠어"]

⚠ 코드에는 아직 안 넣었다. 물고기 표에 넣으려면 그림과 3D 모델이 먼저 있어야 한다(`fishing3dbound.test` 가 그림 파일을 요구하고, `makeReferenceAnimal` 은 프로필이 없으면 던져서 수조가 멈춘다).
제작 순서는 은어 · 메기 · 해파리와 같다(`design/FISHING-TIMED-ART.md`). 모두 **실존 종의 사실적인 그림**이고 한 종으로 자란다(만타 · 참다랑어와 같은 방식). 물고기마다 치어(`fry_<key>`) · 어린 개체(`juv_<key>`) · 성체(`<key>`) 3장 + GLB 3개 = 14종 × 3 = **그림 42장 · 모델 42개**.

## 상어 6종

| key | 이름 | 등급 | 낚시터 | 수조 크기(size) | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|---|
| `nurse_shark` | 수염상어 | 희귀 | 산호초 바다 | 30 | 180 | Real adult nurse shark (Ginglymostoma cirratum), tawny-brown flattened body, two small barbels at the nostrils, rounded fins, long upper tail, side view facing right, transparent background. |
| `leopard_shark` | 표범상어 | 희귀 | 산호초 바다 | 28 | 130 | Real adult leopard shark (Triakis semifasciata), slim silver-grey body with dark saddle bars and spots, side view facing right, transparent background. |
| `blue_shark` | 청상아리 | 영웅 | 먼 바다 | 37 | 280 | Real adult blue shark (Prionace glauca), long slender indigo-blue back, white belly, long pointed pectoral fins, side view facing right, transparent background. |
| `hammerhead` | 귀상어 | 전설 | 먼 바다 | 38 | 350 | Real adult scalloped hammerhead (Sphyrna lewini), wide flattened hammer-shaped head with eyes at the ends, grey-bronze back, tall first dorsal fin, three-quarter side view facing right, transparent background. |
| `great_white` | 백상아리 | 전설 | 먼 바다 | 42 | 480 | Real adult great white shark (Carcharodon carcharias), heavy torpedo body, slate-grey back with a sharp line to a white belly, conical snout, side view facing right, mouth closed, transparent background. |
| `megamouth` | 넓은주둥이상어 | 신화 | 용궁 앞바다 | 44 | 520 | Real adult megamouth shark (Megachasma pelagios), huge rounded head, very wide mouth, dark brown-grey soft body, side view facing right, transparent background. |

## 횟감 8종 — 새 낚시터 '남해 항구'(Lv.9, 낚시터 그림 `spot_harbor` 1장 추가)

| key | 이름 | 등급 | 수조 크기(size) | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|
| `flounder` | 광어 | 고급 | 24 | 60 | Real adult olive flounder (Paralichthys olivaceus), flat oval body seen from above at an angle, mottled olive-brown, both eyes on one side, transparent background. |
| `rockfish` | 우럭 | 고급 | 21 | 40 | Real adult Korean rockfish (Sebastes schlegelii), stout dark grey-brown body, spiny dorsal fin, large mouth, side view facing right, transparent background. |
| `sea_bream` | 참돔 | 희귀 | 24 | 60 | Real adult red sea bream (Pagrus major), deep pink-red body with faint blue spots, side view facing right, transparent background. |
| `sea_bass` | 농어 | 희귀 | 26 | 80 | Real adult Japanese sea bass (Lateolabrax japonicus), slim silver body, dark back, small black spots, side view facing right, transparent background. |
| `salmon` | 연어 | 희귀 | 27 | 85 | Real adult Atlantic salmon (Salmo salar), silver body with small black spots, blue-grey back, side view facing right, transparent background. |
| `yellowtail` | 방어 | 영웅 | 31 | 110 | Real adult Japanese amberjack (Seriola quinqueradiata), streamlined blue-green back, silver belly, yellow lateral stripe, yellow forked tail, side view facing right, transparent background. |
| `croaker` | 민어 | 영웅 | 29 | 90 | Real adult brown croaker (Miichthys miiuy), long grey-bronze body, slightly arched back, side view facing right, transparent background. |
| `striped_jack` | 줄전갱이 | 전설 | 28 | 85 | Real adult striped jack (Pseudocaranx dentex), silver-blue compressed body, one yellow side stripe, yellow fins, side view facing right, transparent background. |

## 켜는 순서(그림 · 모델이 승인된 뒤)

1. `lib/aquarium.ts` 의 `FAMILIES` 에 값 순서대로 끼운다(값 · 시간은 같은 등급의 옆 계열 사이). 상어는 `youngName: "새끼"`.
2. `lib/fishingworld.ts` 의 `BASE_CM` 에 위 길이를 넣는다. 정규 낚시터는 `lib/fishing.ts` 의 `pool` 에 낮은 무게로, 남해 항구는 `SPOTS` 에 새 줄로 넣는다(`FX_SPOTS` 수평선도 잰다).
3. `fishing.test` · `fishing3dbound.test` · `aquarium.test` 를 돌린다.
