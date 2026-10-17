# 계보 도트 제작 도구

`src/lib/pixellineage.ts` 의 몸통 행(48칸 × 44행)을 **도형으로 그려서 구워 내는** 도구다. 그 파일의 행은 손으로 점을 센 게 아니다 —
고칠 때는 행을 고치지 말고 여기 그림 스크립트를 고쳐 다시 굽는다(`build.sh` 한 번이면 결과가 같은 파일로 다시 나온다).
설계 기록은 [docs/PET-LINEAGES.md](../../docs/PET-LINEAGES.md), 규약은 README §14.5 '계보 개편'.

## 쓰는 법

```bash
bash scripts/lineage-art/build.sh              # 계보 전부 굽기 → out/*.png · *.json → src/lib/pixellineage.ts 조립
bash scripts/lineage-art/build.sh ember volt   # 이 계보만 PNG 다시 굽기(표는 항상 전부)
OUT=/tmp/x.ts bash scripts/lineage-art/build.sh   # 저장소를 건드리지 않고 결과만 보기
```

- Node 22.18+ 는 앱 소스(.ts)를 바로 읽는다. Node 20 은 `node .claude/striptypes.mjs <사본폴더> build` 로 만든 사본을 `SIMLIB=<사본폴더>` 로 가리킨다(`deps.mjs`).
- **PNG 를 눈으로 본다** — `out/<계보>.png`(밝은 · 어두운 바탕 두 줄) · `out/all.png`(전부 한 장). 숫자로만 맞춘 그림은 '규격은 맞는데 못생긴' 걸 못 잡는다(README §10.8).

## 새 계보를 넣는 순서

1. `lineages/<키>.mjs` — `export default { pal, pals?, fur, pad, stages: [성장기, 중간형, 최종형] }`. 단계마다 `Cv` 를 만들어 돌려주는 함수.
2. `gen.mjs` 의 `order` · `NAMES` 에 키를 넣는다. `templates/tail.ts.txt` 의 `SLEEP_TOP` 에 머리 위 5행 표식을 넣는다(그 폼 팔레트에 **정의된 글자만**).
3. `build.sh <키>` → PNG 확인 → 고치고 다시. 마지막에 전부 굽는다.
4. `src/lib/lineages.ts` 표(폼 이름 · 이모지 · 소개)와 도감 · 테스트(`lineage.test.ts` 가 레지스트리를 훑는다).

## 그리기 도구 (`lib.mjs` · `helpers.mjs`)

- `Cv` — `ellipse(cx,cy,rx,ry,letters,{shade,th,tag})` · `poly(pts,letters,{grad})` · `rect` · `line(x0,y0,x1,y1,글자,굵기)` · `stamp(x,y,행들,글자표)` ·
  `mirror(cx)` · `outline()`(바깥 외곽선) · `ring(태그)`(팔·귀·날개가 몸에서 갈리게) · `shiftY`. 나중에 그린 도형이 위. 광원은 좌상단 5톤 자동 명암.
- 글자 집합 — `T.body`(H b B d D) · `T.belly`(c C) · `T.mark`(A a) · `T.a1`(f F h) · `T.a2`(r R t) · `T.a3`(u U v). 색은 폼 `pal` 이 정한다.
- `helpers` — `eyes(cv, cy, dx, "big"|"small"|"dot")` · `mouth` · `blush` · `arc` · `spike` · `radial` · `both`.

## 규약 (어기면 테스트가 잡는다)

- 몸통은 0~43행, **43행에 잉크**가 있어야 한다 — 44~47행 다리는 공용 `feet()` 가 걷기 6프레임으로 채운다(`run.mjs` 가 43행이 비면 던진다).
- 눈은 얼굴 창(x 6~41 · y 0~29) 안. 모자 · 무기 앵커는 스프라이트에서 뽑는다 — 손 앵커(가장 오른쪽 잉크)가 **가는 부속**(꼬리 끝 · 집게 · 가지)에 걸리면
  무기가 떠 보이니 부속을 몸쪽으로 당긴다(겹침 ≥ 4칸).
- **진화마다 몸 구조가 바뀐다.** 크기만 키우고 장식을 얹은 그림은 퇴짜다 — 실루엣 차이는 `lineage.test.ts` 가 잰다.
- `line()` 끝점은 정수로 반올림된다(소수 좌표가 끝점에 안 닿아 무한 루프가 났었다). 다각형 명암은 외접 타원 기준 근사다.
