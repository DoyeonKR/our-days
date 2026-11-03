# 물고기 늘리기 — 상어 · 횟감 그림 · 3D 작업 목록

[사용자: "물고기 종류가 52종에서 늘어나야함 상어류를 늘리고, 횟감 종류들도 늘렸으면 좋겠어"]

⚠ 코드에는 아직 안 넣었다. 물고기 표에 넣으려면 그림과 3D 모델이 먼저 있어야 한다(`fishing3dbound.test` 가 그림 파일을 요구하고, `makeReferenceAnimal` 은 프로필이 없으면 던져서 수조가 멈춘다).
제작 순서는 은어 · 메기 · 해파리와 같다(`design/FISHING-TIMED-ART.md`). 모두 **실존 종의 사실적인 그림**이고 한 종으로 자란다(만타 · 참다랑어와 같은 방식). 물고기마다 치어(`fry_<key>`) · 어린 개체(`juv_<key>`) · 성체(`<key>`) 3장 + GLB 3개 = 14종 × 3 = **그림 42장 · 모델 42개**.

## 상어 6종

| key | 이름 | 등급 | 낚시터 | 수조 크기(size) | 길이 cm | 성체 프롬프트 |
|---|---|---|---|---|---|---|
| `nurse_shark` | 수염상어 | 희귀 | 산호초 바다 | 30 | 180 | Real adult nurse shark (Ginglymostoma cirratum), tawny-brown flattened body, two small barbels at the nostrils, rounded fins, long upper tail, side view facing right, transparent background. |
| `leopard_shark` | 표범상어 | 희귀 | 산호초 바다 | 28 | 130 | Real adult leopard shark (Triakis semifasciata), slim silver-grey body with dark saddle bars and spots, side view facing right, transparent background. |
| `blue_shark` | 청새리상어 | 영웅 | 먼 바다 | 37 | 280 | Real adult blue shark (Prionace glauca), long slender indigo-blue back, white belly, long pointed pectoral fins, side view facing right, transparent background. |
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

이름 정정: `blue_shark`의 학명 `Prionace glauca`는 청새리상어다. [국립수산과학원](https://www.nifs.go.kr/portal/bt/frctA/actionSpeciesSearchView.do?taxonId=11416)에 맞춰 정리했으며, 다른 종인 청상아리로 바꾸지 않는다.

1. `lib/aquarium.ts` 의 `FAMILIES` 에 값 순서대로 끼운다(값 · 시간은 같은 등급의 옆 계열 사이). 상어는 `youngName: "새끼"`.
2. `lib/fishingworld.ts` 의 `BASE_CM` 에 위 길이를 넣는다. 정규 낚시터는 `lib/fishing.ts` 의 `pool` 에 낮은 무게로, 남해 항구는 `SPOTS` 에 새 줄로 넣는다(`FX_SPOTS` 수평선도 잰다).
3. `fishing.test` · `fishing3dbound.test` · `aquarium.test` 를 돌린다.

## 제작·배포 묶음 · 2026-11-03

- 14종 × 3단계 그림 42장: `public/aqua/fish/`(512px, 투명), `sm/`(192px).
- 원본 스킨 및 해시 일치 참조 프로필을 생성하고 `FISH_IMAGE_KEYS`, `FISH_GLB`에 42개 key를 등록했다.
- GLB 42개: `public/aqua/models/fish/`. 10개 표준 뼈, 스킨 메시 1개, 내장 512px PBR 텍스처 1장. 애니메이션 클립·외부 모델·압축 확장을 쓰지 않았다.
- 귀상어는 머리 양 끝의 눈과 가로로 넓은 입체 머리, 광어는 수평으로 납작한 몸과 윗면의 눈을 따로 조형했다. 새끼의 그림·메시를 따로 만들었다.
- 남해 항구: `public/fishing/spot_harbor.webp`(1024×1280). 완성 그림에서 잰 물 경계는 화면 높이 약 27%; 활성화 때 `FX_SPOTS.harbor.horizon`에 `.27`을 사용한다.
- `aqua3d-review/expansion-validation.json`에 구조 검사, `models.json`에 예산·뼈대·텍스처 크기, `native-render.json`에 실제 GLB 렌더의 파일 해시를 남긴다.
- 원화 대조표: `aqua3d-review/expansion-models-1.webp` ~ `expansion-models-7.webp`. 로컬 검수 화면: `aqua3d-review/index.html?set=expansion`.
- 생성 방식은 내장 `image_gen`. 물고기 전체 프롬프트는 `aqua3d-review/expansion-prompts.json`, 항구는 `expansion-harbor-prompt.json`에 보존했다.

**2026-11-04 사용자 지시로 14종과 남해 항구를 모두 켰다**[사용자: "이거 다 반영해줘 잡히고 도감에도 다 추가해 모든어종"]. 남해 항구 전용 쓰레기만 그림이 없어 없다.

**(승인 전 기록) 파일 제작·배포와 게임 등장은 별개다. 새 42개 형태는 외형 승인 대기이며, 수치로 자체 합격 처리하지 않았다.** 이 문서의 활성화 절차(`FAMILIES`, `BASE_CM`, `pool`, 남해 항구 Lv.9)는 아직 실행하지 않았다. 원화 한 장에서 알 수 없는 뒷면·연결부는 추정 조형이며, 지느러미의 얇은 막과 머리·입의 세부 표면은 사용자 검수가 필요하다.
