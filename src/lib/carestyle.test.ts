// 성장기 분기 lock. [사용자 리포트 2026-09-22 "항상 알에서 고양이로만 진화해"]
//
// 원인이 둘이었고 둘 다 이 파일이 잠근다.
//  1) 성장기(hatchling → stage2)가 **CQ 하나**로만 갈렸다. CQ 는 '잘 키웠나' 한 축이라
//     잘 키우면 누구나 햇살이 → 키우는 **방식**이 결과에 안 남는다.
//  2) 햇살이 → 여우 조건에만 `bondLv >= 5` 가 붙어 있었다. 유대 5 에 못 닿으면
//     **전부 고양이**로 떨어진다. 같은 층의 다른 갈래(곰·판다·부엉이·늑대)엔 없던
//     조건이라 이 갈래만 막힌 것이다.
//
// ⚠ 이 테스트가 지키는 성질은 "값이 맞나"가 아니라 **"손버릇이 다르면 결과가 다른가"** 다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_ACTS,
  type CareAct,
  PET_FORMS,
  STAGE2_BY_STYLE,
  careStyle,
  nextEvolution,
  petStage,
} from "./island.ts";

const only = (act: CareAct, n = 5): Partial<Record<CareAct, number>> => ({ [act]: n });

test("케어 액션 다섯이 **서로 다른** 성장기 모습으로 자란다", () => {
  const got = CARE_ACTS.map((a) => nextEvolution("hatchling", 50, 1, 0, 0, only(a)));
  assert.equal(new Set(got).size, CARE_ACTS.length, `성장기가 겹친다: ${got.join(", ")}`);
  for (const f of got) assert.equal(petStage(String(f)), 2, `${f} 가 성장기(stage 2)가 아니다`);
});

test("성장기 분기는 CQ 가 아니라 손버릇을 본다", () => {
  // 같은 CQ 라도 많이 해 준 케어가 다르면 다른 아이가 된다 — 이게 없으면 다시 한 갈래로 몰린다.
  const a = nextEvolution("hatchling", 90, 9, 0, 0, only("play"));
  const b = nextEvolution("hatchling", 90, 9, 0, 0, only("feed"));
  assert.notEqual(a, b, "CQ·유대가 같으면 케어를 달리해도 같은 모습이 된다");
  // 반대로 CQ 가 달라도 손버릇이 같으면 같은 아이다(스타일이 주인이라는 뜻).
  assert.equal(
    nextEvolution("hatchling", 20, 1, 9, 0, only("clean")),
    nextEvolution("hatchling", 95, 9, 0, 0, only("clean")),
  );
});

test("기록이 없는 구버전 저장분은 예전 CQ 규칙 그대로 [무마이그레이션]", () => {
  // ⚠ 이 폴백을 지우면 이미 키우던 펫이 전부 한 갈래로 떨어진다.
  assert.equal(nextEvolution("hatchling", 80, 1, 0), "sunny");
  assert.equal(nextEvolution("hatchling", 50, 1, 0), "cozy");
  assert.equal(nextEvolution("hatchling", 20, 1, 0), "moody");
  assert.equal(nextEvolution("hatchling", 80, 1, 0, 0, {}), "sunny", "빈 객체도 기록 없음으로 본다");
});

test("careStyle — 가장 많이 해 준 것을 고르고, 동점은 결정적으로 갈린다", () => {
  assert.equal(careStyle(undefined), null);
  assert.equal(careStyle({}), null);
  assert.equal(careStyle({ feed: 3, play: 1 }), "feed");
  // 동점이면 CARE_ACTS 순서가 이긴다 — 양쪽 클라가 같은 답을 내야 한다(RNG 금지와 같은 이유).
  assert.equal(careStyle({ rest: 2, play: 2 }), "play");
  assert.equal(careStyle({ clean: 4, hug: 4 }), "hug");
});

test("성장기 → 중간형에 유대 조건이 없다 [회귀 lock]", () => {
  // 유대 0 이어도 케어만 좋으면 여우가 나와야 한다. 여기에 다시 유대를 달면 고양이 쏠림이 재발한다.
  assert.equal(nextEvolution("sunny", 80, 0, 0), "fox");
  assert.equal(nextEvolution("sunny", 40, 9, 0), "cat");
  for (const mid of ["sunny", "cozy", "moody", "sprout", "dewy"]) {
    const low = nextEvolution(mid, 95, 0, 0);
    const high = nextEvolution(mid, 95, 9, 0);
    assert.equal(low, high, `${mid} 의 다음 단계가 유대에 따라 갈린다 — 이 층엔 유대 조건이 없어야 한다`);
  }
});

test("성장기 다섯 갈래가 중간형 열 종으로 이어진다", () => {
  const mids = new Set<string>();
  for (const f of Object.values(STAGE2_BY_STYLE)) {
    for (const cq of [0, 50, 100]) {
      const m = nextEvolution(f, cq, 1, 0);
      assert.ok(m, `${f} 가 막다른 길이다`);
      assert.equal(petStage(String(m)), 3, `${f} → ${m} 이 중간형이 아니다`);
      mids.add(String(m));
    }
  }
  assert.equal(mids.size, 10, `중간형이 ${mids.size}종이다 — 다섯 갈래 × 2 = 10 이어야 한다`);
});

test("중간형은 전부 최종형 둘을 갖는다 (막다른 종 금지)", () => {
  const stage3 = Object.values(PET_FORMS).filter((f) => f.stage === 3);
  assert.equal(stage3.length, 10);
  for (const f of stage3) {
    const hi = nextEvolution(f.key, 95, 9, 0);
    const lo = nextEvolution(f.key, 10, 0, 9);
    assert.ok(hi && lo, `${f.key} 에 최종형이 없다`);
    assert.notEqual(hi, lo, `${f.key} 의 최종형 둘이 같다 — 갈래가 아니다`);
    for (const t of [hi, lo]) assert.equal(petStage(String(t)), 4, `${f.key} → ${t} 가 최종형이 아니다`);
  }
});

test("모든 최종형이 신화형으로 이어진다 (새 계보도 막히지 않는다)", () => {
  for (const f of Object.values(PET_FORMS).filter((x) => x.stage === 4)) {
    const m = nextEvolution(f.key, 95, 9, 0, 1);
    assert.ok(m && petStage(m) === 5, `${f.key} 에서 신화형으로 못 간다`);
  }
});

test("케어 액션마다 bumpCare 가 짝으로 찍힌다 [소스 스캔]", () => {
  // ⚠ 한 액션만 빠뜨리면 그 손버릇으로는 영영 그 성장기 모습이 안 나오는데,
  //   화면엔 아무 표시도 안 난다 — 그래서 값이 아니라 **짝**을 센다.
  const src = readFileSync(join(import.meta.dirname, "island.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  for (const act of CARE_ACTS) {
    const cds = (src.match(new RegExp("s\\.pet\\.cd\\." + act + " = now", "g")) ?? []).length;
    const bumps = (src.match(new RegExp('bumpCare\\(s, "' + act + '"\\)', "g")) ?? []).length;
    assert.ok(cds > 0, `${act} 액션을 못 찾았다`);
    assert.equal(bumps, cds, `${act}: 쿨다운 ${cds}곳 중 bumpCare 가 ${bumps}곳뿐이다`);
  }
});

test("성장기·중간형·최종형 수가 계보와 맞는다", () => {
  const byStage = (n: number) => Object.values(PET_FORMS).filter((f) => f.stage === n).length;
  assert.equal(byStage(2), 5, "성장기는 케어 액션 수(5)와 같아야 한다");
  assert.equal(byStage(3), 10);
  assert.equal(byStage(4), 20);
  assert.equal(Object.keys(STAGE2_BY_STYLE).length, CARE_ACTS.length);
});

test("모든 폼이 고유 문장(HERO_IDENTITY)을 갖는다 [소스 스캔]", () => {
  // ⚠ heroIdentity 는 목록에 없는 폼을 **조용히 통과**시킨다(폴백). 그래서 빠뜨려도
  //   에러가 안 나고, 그 폼만 외곽이 허전한 채 배포된다 — 값이 아니라 커버리지를 센다.
  const src = readFileSync(join(import.meta.dirname, "pixelpet48.ts"), "utf8");
  const block = src.slice(src.indexOf("const HERO_IDENTITY"));
  const listed = new Set(
    [...block.slice(0, block.indexOf("\n};")).matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1]),
  );
  const missing = Object.keys(PET_FORMS).filter((k) => !listed.has(k));
  assert.deepEqual(missing, [], `문장이 없는 폼: ${missing.join(", ")}`);
});

test("신규 4종이 공용 골격 위 오버레이로만 만들어진다 [소스 스캔]", () => {
  // 신화형처럼 전용 골격을 새로 파면 유지비가 배로 든다(걸음·수면·장비 앵커를 다 따로 맞춰야 한다).
  // 중간형은 BODY + 귀·마킹·꼬리로 충분하다는 규약을 지킨다.
  const src = readFileSync(join(import.meta.dirname, "pixelpet48.ts"), "utf8");
  for (const kind of ["rabbit", "deer", "squirrel", "otter"]) {
    const m = src.match(new RegExp("^\\s{2}" + kind + ":\\s*\\{ ear:[^\\n]*$", "m"));
    assert.ok(m, `KIND 에 ${kind} 항목이 없다`);
    assert.ok(/ear: EAR_/.test(m![0]), `${kind} 에 전용 귀가 없다 — 색만 다른 종은 안 된다`);
  }
  // 수면 귀도 종마다 있어야 한다(없으면 잘 때 다른 종의 귀가 달린다)
  const sleep = src.slice(src.indexOf("const SLEEP_EARS"));
  for (const kind of ["rabbit", "deer", "squirrel", "otter"]) {
    assert.ok(new RegExp("^\\s{2}" + kind + ":", "m").test(sleep.slice(0, sleep.indexOf("\n};"))), `수면 귀에 ${kind} 가 없다`);
  }
});

// ── 2026-09-23 쏠림 2차 — '버튼을 다 누르는 사람' ─────────────────────
// 횟수만 세면 동점·쿨다운이 결과를 정한다. 가끔 열어 다 누르면 다섯이 동점이라
// 순서상 첫째(놀기) → **항상 햇살이**, 자주 열면 쿨다운이 짧은 안기가 쌓여 항상 포근이.
// '항상 고양이'를 고치고 하루 만에 '항상 햇살이'를 만든 셈이다 — 그래서 이 묶음이 있다.

test("다 누르는 사람(동점)은 생마다 성장기가 바뀐다 — 한 갈래로 안 쏠린다", () => {
  const even = { play: 6, hug: 6, feed: 6, clean: 6, rest: 6 };
  const seen = new Set<string>();
  for (let lives = 0; lives < 5; lives++) {
    seen.add(String(nextEvolution("hatchling", 95, 1, 0, 0, even, { seed: 0, lives })));
  }
  assert.equal(seen.size, 5, `다섯 생 동안 ${[...seen].join(", ")} 만 나왔다 — 동점이 한 갈래로 쏠린다`);
});

test("자주 여는 사람(안기가 쿨다운 덕에 많은 것)은 포근이로 고정되지 않는다", () => {
  // 2시간마다 열어 다 누르면 12시간에 안기 6 · 놀기 4 · 밥 3 · 씻기 2 · 재우기 1.5 쯤 된다.
  // 안기가 1등이지만 손버릇이 아니라 쿨다운이 만든 차이다(1.5배 < styleMargin).
  const frequent = { hug: 6, play: 4, feed: 3, clean: 2, rest: 1 };
  const seen = new Set<string>();
  for (let lives = 0; lives < 4; lives++) {
    seen.add(String(nextEvolution("hatchling", 95, 1, 0, 0, frequent, { seed: 0, lives })));
  }
  assert.ok(seen.size >= 2, `자주 여는 사람이 매번 ${[...seen][0]} 만 받는다`);
  assert.ok(seen.has("cozy") && seen.has("sunny"), "비슷하게 한 둘(안기·놀기) 사이에서 돌아야 한다");
});

test("동점 돌림은 **실제로 해 준 것** 안에서만 — 안 씻긴 아이가 이슬이가 되면 안 된다", () => {
  const two = { hug: 5, play: 5 };
  for (let lives = 0; lives < 10; lives++) {
    const f = nextEvolution("hatchling", 95, 1, 0, 0, two, { seed: 3, lives });
    assert.ok(f === "cozy" || f === "sunny", `해 준 적 없는 돌봄으로 자랐다: ${f}`);
  }
});

test("손버릇이 뚜렷하면 생이 바뀌어도 그대로다 — 돌림은 애매할 때만", () => {
  const clear = { feed: 10, play: 3, hug: 2 };
  for (let lives = 0; lives < 6; lives++) {
    assert.equal(nextEvolution("hatchling", 50, 1, 0, 0, clear, { seed: 7, lives }), "sprout");
  }
});

test("돌림은 결정적이다 — 같은 섬·같은 생이면 두 사람이 같은 답을 본다", () => {
  const even = { play: 2, hug: 2, feed: 2 };
  const a = nextEvolution("hatchling", 80, 1, 0, 0, even, { seed: 12345, lives: 2 });
  for (let i = 0; i < 5; i++) {
    assert.equal(nextEvolution("hatchling", 80, 1, 0, 0, even, { seed: 12345, lives: 2 }), a);
  }
});

test("중간형은 집중도로 갈린다 — 잘 키우는 사람도 양쪽 종을 다 만난다", () => {
  // 예전엔 CQ 로 갈라서 정성이 높으면 영원히 여우·곰·부엉이…만 나왔다.
  // 고양이·판다·늑대·토끼·다람쥐가 '대충 키워야 나오는 종'이었다 — 종이 품질 판정이 된 셈.
  const focused = { play: 10, hug: 2, feed: 2, clean: 1, rest: 1 }; // 한 가지에 몰았다
  const balanced = { play: 3, hug: 3, feed: 3, clean: 3, rest: 3 }; // 고루 했다
  const pairs: [string, string, string][] = [
    ["sunny", "fox", "cat"], ["cozy", "bear", "panda"], ["moody", "owl", "wolf"],
    ["sprout", "deer", "rabbit"], ["dewy", "otter", "squirrel"],
  ];
  for (const [mid, f, b] of pairs) {
    assert.equal(nextEvolution(mid, 99, 9, 0, 0, focused), f, `${mid}: 집중했는데 ${f} 가 아니다`);
    assert.equal(nextEvolution(mid, 99, 9, 0, 0, balanced), b, `${mid}: 정성 99 로 고루 했는데 ${b} 가 안 나온다`);
  }
});

test("구버전 저장분(기록 없음)의 중간형은 예전 CQ 규칙 그대로", () => {
  assert.equal(nextEvolution("cozy", 70, 1, 0), "bear");
  assert.equal(nextEvolution("cozy", 40, 1, 0), "panda");
  assert.equal(nextEvolution("sunny", 80, 0, 0), "fox");
});

test("진화 힌트가 옛 규칙을 안내하지 않는다 [소스 스캔]", () => {
  // 2026-09-22 분기를 바꾸고 힌트를 안 고쳐, 하루 동안 이미 뺀 조건("유대 5+ 면 여우")을 보여줬다.
  const src = readFileSync(join(import.meta.dirname, "island.ts"), "utf8");
  const at = src.indexOf("export function evolutionPreview");
  const body = src.slice(at, src.indexOf("\n}\n", at));
  assert.equal(/s3RadiantBond/.test(body), false, "없앤 유대 게이트를 힌트가 아직 말한다");
  assert.equal(/stage2Sunny|stage2Cozy/.test(body), false, "성장기 힌트가 아직 CQ 문턱을 말한다");
});

test("진화 대상은 nextEvolutionOf 한 곳에서만 계산한다 [소스 스캔]", () => {
  // 인자를 세 곳에서 따로 늘어놓다가 두 번 어긋났다(연출 뱅갈·적용 무등산 / 연출 햇살이·적용 새싹이).
  const dir = join(import.meta.dirname, "..");
  const files = [join(dir, "components", "IslandGame.tsx"), join(dir, "lib", "island.ts")];
  for (const f of files) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const direct = [...src.matchAll(/nextEvolution\(\s*s\.pet\.form/g)].length;
    // island.ts 안의 nextEvolutionOf 본문 한 곳만 허용
    const allowed = f.endsWith("island.ts") ? 1 : 0;
    assert.equal(direct, allowed, `${f} 에서 nextEvolution 을 직접 부른다 — nextEvolutionOf(s) 를 써라`);
  }
});
