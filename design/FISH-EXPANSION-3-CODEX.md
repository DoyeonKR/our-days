# 물고기 늘리기 3차 — 그림 세션(Codex)에 붙여 넣을 프롬프트 (2026-11-12)

[사용자: "어종 추가하자 프롬프트 알려줘"] 3차 12계열의 목록 · 켜는 순서는 `design/FISH-EXPANSION-3-ART.md`, 어종마다 치어 · 어린 개체 · 성체 그림 프롬프트 36개는 `design/aqua3d-review/expansion3-prompts.json` 에 있다.
아래 구분선 사이를 그대로 Codex 에 붙여 넣는다. 그림 · 모델이 승인되면 게임에 켜는 일(표 · 낚시터 · 습성 · 서버 목록)은 이 세션(Claude)이 한다.

---

우리 수조 · 낚시 게임에 새 어종 12계열을 넣으려고 해. 이번엔 그림과 3D 모델만 만들어 줘. 게임 코드는 건드리지 마.

**무엇을** — `design/aqua3d-review/expansion3-prompts.json` 의 `items` 36개(12계열 × 치어 `fry_<key>` · 어린 개체 `juv_<key>` · 성체 `<key>`). 어종 · 등급 · 크기 · 민물/바다는 `species`, 그림마다 문장은 `subject`, 공통 화풍은 `style`(1 · 2차와 같은 문장) 그대로 쓴다. 표와 켜는 순서는 `design/FISH-EXPANSION-3-ART.md`.

**그림** — 1 · 2차와 같은 방식(`built-in image_gen`). 실존 어종은 실제 생김새대로(학명 기준), 기존 게임 · 도감 · 다른 게임 그림을 따르지 않는다. 머리는 오른쪽, 투명 배경, 몸 전체가 다 보이게.
- `public/aqua/fish/<key>.webp`(512px 투명) + `public/aqua/fish/sm/<key>.webp`(192px). 원본 1024px PNG 는 지금까지처럼 `design/aqua3d-review` 쪽에 둔다.
- 치어 · 어린 개체는 성체를 줄인 그림이 아니라 그 종의 실제 어린 모습(머리가 크고 몸이 짧고 무늬가 덜 난).

**3D 모델** — 1 · 2차와 같은 파이프라인(`design/aqua3d-review/build-stage1.mjs` → `review-stage1.mjs` → 압축 `glb-compress.mjs`). Node 22+ 라 `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` 로 돌린다.
- `public/aqua/models/fish/<key>.glb` 36개. 계약은 `design/aqua3d-review/README.md` 그대로: +X 머리 · +Y 위 · +Z 옆, 몸 가운데 원점, 길이 약 2, 뼈 10개(`spine_0`~`spine_5`, `fin_L`, `fin_L_tip`, `fin_R`, `fin_R_tip`), 재질 하나 · 텍스처 하나, `EXT_meshopt_compression` · `KHR_mesh_quantization` · `EXT_texture_webp`.
- ⚠ **몸 구조는 지금 물고기들과 같게** — 게임이 받을 때 위에서 본 몸을 다듬는다(`src/lib/aqua3d/topview.ts`). 그 코드는 ① 정점 맨 앞에 몸통 튜브 고리(x 가 같은 정점 17개짜리 고리가 이어진 묶음, 지금 모델은 41개)가 있고 ② 가슴지느러미가 지느러미 뼈(`fin_*`)에 묶인 작은 부채판이라고 본다. fish-sculpt 의 일반 물고기 몸(튜브 + 실루엣 판 + 가슴지느러미 부채)을 그대로 쓴다.
- 몸이 특이한 넷:
  - **해마(seahorse)** — 세로로 선 몸. 그림은 머리가 위 · 오른쪽을 본다. 모델은 다른 물고기처럼 +X 를 '머리 쪽'으로 두되(게임이 해파리처럼 세워 쓴다 — 세우는 각은 내가 맞춘다) 꼬리가 말린 모양은 살린다. 뼈 사슬은 머리 → 꼬리 끝.
  - **개복치(sunfish)** — 원반 몸 · 꼬리 대신 클라부스. 몸 물결은 거의 없고 위아래 지느러미를 젓는다 — 위아래 큰 지느러미가 실루엣 판에 또렷이 들어가게.
  - **곰치(moray)** — 뱀장어처럼 긴 몸(뱀장어 · 갈치와 같은 띠 몸 방식), 가슴지느러미 없음.
  - **짱뚱어(mudskipper)** — 바닥에 사는 물고기. 머리 위로 튀어나온 눈 · 팔 같은 가슴지느러미가 보이게.
- 철갑상어 · 청새치 · 피라루쿠는 몸길이가 크다(180 · 300 · 250cm) — 모델은 길이 약 2 그대로, 크기는 게임이 맞춘다.

**검수 자료** — 2차와 같은 모양으로 `design/aqua3d-review/expansion3-art.webp`(그림 36장), `expansion3-models-*.webp`(모델 대조), `expansion3-validation.json`, `expansion3-status.json`(`visualApproval: "pending"`, `activation: "not enabled"`). `models.json` 에 36개 기록. 위에서 본 모습도 한 장 같이 찍어 줘(이번에 위에서 볼 때 어색한 걸 많이 고쳤다).

**하지 말 것** — `src/` · `supabase/` · `package.json` · 기존 222개 그림 · 모델은 고치지 않는다. 커밋하지 않는다(내가 확인하고 켜면서 커밋한다). 다른 게임의 그림 · 이름 · 모양을 따라 하지 않는다.

끝나면 무엇을 만들었는지, 어떤 키가 아직 어색한지 한 줄씩 알려 줘.

---

## 그림 세션이 끝난 뒤 이 세션이 할 일

1. 검수 자료 · 위에서 본 모습을 보고 어색한 것을 고쳐 달라고 돌려보낸다.
2. 켜기 — `design/FISH-EXPANSION-3-ART.md` 의 '켜는 순서' 1~6(표 · 낚시터 · 습성 · `glb.ts` 목록 · 서버 `private.fish_family_ok` migration · 테스트).
3. 해마 세우기(`glbUpright`) · 개복치 몸 물결 0 · 짱뚱어 바닥 생활 · 곰치 띠 몸(`NOT_FUSIFORM` 에 moray · seahorse · sunfish 추가 — 위에서 본 몸 다듬기에서 뺀다).
4. 사냥꾼이면(곰치 · 자바리 · 청새치 · 철갑상어?) `lib/predation` 의 `PREDATORS` · `lib/aqua3d/hunt.ts` 의 `HUNT`(사냥 방식 · 이빨)에 더한다.
