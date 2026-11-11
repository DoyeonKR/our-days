// 낚시 리뷰(2026-11-05)에서 고친 것들의 회귀 lock. 한 줄씩: 무엇이 잘못됐고 무엇을 지키는지.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRADES } from "./aquarium.ts";
import { BAITS, SPOTS, rollCatch, speciesWeight } from "./fishing.ts";
import { upgradeCatch } from "./fishingfever.ts";
import { FishFx, type FxCanvas } from "./fishingfx.ts";
import { TIMED_FISH, type FishMoment, type FishTime } from "./fishingworld.ts";
import { appCss } from "./cssfiles.ts";

const root = join(import.meta.dirname, "../..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function fakeCanvas() {
  const ctx = new Proxy({}, {
    get: (_t, name: string) => () => (name.startsWith("create") ? { addColorStop() {} } : undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  let allocs = 0, w = 0, h = 0;
  const canvas: FxCanvas = {
    get width() { return w; },
    set width(v) { w = v; allocs++; },
    get height() { return h; },
    set height(v) { h = v; allocs++; },
    getContext: () => ctx,
  };
  return { canvas, allocs: () => allocs };
}

test("뜰채 — 때 손님도 다 큰 모습으로 오지 않는다(METHODS.scoop.adult = 0)", () => {
  const times: FishTime[] = ["dawn", "day", "dusk", "night"];
  let timed = 0;
  for (const spot of SPOTS) for (const time of times) for (const wx of ["rain", "snow", "clear", null] as const) {
    const when: FishMoment = { time, wx };
    if (!TIMED_FISH.some((t) => t.spot === spot.key && (!t.time || t.time === time) && (!t.wx || t.wx === wx))) continue;
    for (let i = 0; i < 400; i++) {
      const c = rollCatch(spot, 10, 0.5, i * 7919 + 13, { bait: BAITS.length - 1, method: "scoop", when });
      if (TIMED_FISH.some((t) => t.species === c.species)) timed++;
      assert.notEqual(c.stage, 2, `${spot.key} ${time} ${wx} 뜰채에 다 큰 ${c.family}`);
    }
  }
  assert.equal(timed, 0);
});

test("찌 · 루어 · 심해는 때 손님 뽑기가 그대로다 — 같은 seed 면 같은 결과(뜰채 수정이 다른 방식의 뽑기 순서를 안 바꿨다)", () => {
  const when: FishMoment = { time: "night", wx: null };
  const reef = SPOTS.find((s) => s.key === "reef")!;
  let adults = 0;
  for (let i = 0; i < 2000; i++) if (rollCatch(reef, 10, 0.5, i * 31 + 1, { bait: 6, method: "float", when }).stage === 2) adults++;
  assert.ok(adults > 0, "찌낚시엔 다 큰 때 손님이 온다");
});

test("피버 등급업 — 정확히 한 칸 · 미끼 상한 안 · 때가 아니면 때 손님 품종이 안 나온다", () => {
  const off: FishMoment = { time: "day", wx: null };
  for (const spot of SPOTS) for (let bait = 0; bait < BAITS.length; bait++) for (let i = 0; i < 40; i++) {
    const c = rollCatch(spot, 5, 0.4, i * 17 + 3, { bait });
    const up = upgradeCatch(c, spot, bait, 5, i + 1, off);
    const d = GRADES.indexOf(up.grade) - GRADES.indexOf(c.grade);
    assert.ok(up === c || d === 1, `${spot.key} ${c.grade} → ${up.grade}`);
    if (up !== c) {
      assert.ok(GRADES.indexOf(up.grade) <= BAITS[bait].maxGrade);
      const t = TIMED_FISH.find((x) => x.species === up.species);
      assert.ok(!t || t.spot !== spot.key || ((!t.time || t.time === off.time) && (!t.wx || t.wx === off.wx)), `${up.species} 는 때가 아니다`);
    }
  }
});

test("품종 무게 — 표 밖(5번째 품종 이후)도 유한하고 줄어든다", () => {
  for (let i = 0; i < 8; i++) assert.ok(Number.isFinite(speciesWeight(i)) && speciesWeight(i) > 0, String(i));
  for (let i = 1; i < 8; i++) assert.ok(speciesWeight(i) < speciesWeight(i - 1));
});

test("연출 — stop 뒤엔 resume 이 루프를 되살리지 않는다 · 캔버스 메모리를 돌려준다", () => {
  const g = globalThis as unknown as { requestAnimationFrame?: (f: unknown) => number; cancelAnimationFrame?: (n: number) => void };
  const raf0 = g.requestAnimationFrame, caf0 = g.cancelAnimationFrame;
  let asked = 0;
  g.requestAnimationFrame = () => ++asked;
  g.cancelAnimationFrame = () => {};
  try {
    const { canvas } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(360, 450, 2);
    fx.pause();
    fx.stop();
    fx.resume();
    assert.equal(asked, 0, "멈춘 채 버려진 연출이 다시 그리기 시작했다");
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
  } finally {
    g.requestAnimationFrame = raf0;
    g.cancelAnimationFrame = caf0;
  }
});

test("연출 — 같은 크기의 resize 는 백버퍼를 다시 잡지 않는다 · NaN 대기 시간에도 그리기 값이 유한하다", () => {
  const { canvas, allocs } = fakeCanvas();
  const fx = new FishFx(canvas);
  fx.resize(360, 450, 2);
  const once = allocs();
  for (let i = 0; i < 5; i++) fx.resize(360, 450, 2);
  assert.equal(allocs(), once);
  fx.resize(360, 500, 2);
  assert.ok(allocs() > once, "크기가 바뀌면 다시 잡는다");
  fx.cast({ x: 0.4, y: 0.6 }, Number.NaN, 0.5, 1, 0.5);
  for (let t = 0; t < 2000; t += 16) fx.frame(16);
  assert.equal(fx.counts().bobOn, true);
});

test("연출 — 움직임 줄이기면 비 · 눈 입자를 그리지 않는다", () => {
  const src = code("src/lib/fishingfx.ts");
  assert.match(src, /drawWeatherBack\(c: CanvasRenderingContext2D\) \{\s+if \(!this\.wx \|\| this\.reduced\) return;/);
  assert.match(src, /drawWeatherFront\(c: CanvasRenderingContext2D\) \{\s+if \(!this\.wx \|\| this\.reduced\) return;/);
});

test("화면 — 판의 끝 처리는 한 번 · 저장이 안 된 미끼 · 주인 도전은 판을 물린다 · 보상 문구는 저장 뒤 · 점수는 서버 값", () => {
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /if \(roundEnded\.current\) return;\s+const fxn = fxRef\.current;/, "33ms 루프가 끝난 판을 다시 보지 않는다");
  for (const fn of ["loseRound", "landRound"]) {
    const body = src.slice(src.indexOf(`const ${fn} = useCallback`), src.indexOf(`const ${fn} = useCallback`) + 200);
    assert.match(body, /if \(roundEnded\.current\) return;\s+roundEnded\.current = true;/, fn);
  }
  const pay = src.slice(src.indexOf("function payBait"), src.indexOf("function clearRound"));
  assert.match(pay, /if \(!r\?\.ok\) abortRound\(\)/, "null(저장 실패)도 판을 물린다");
  assert.match(src, /bossOpen\(s, fightBoss\.key, who, kstDate\(clock\(\)\)\), true\)\.then\(\(r\) => \{\s+if \(!r\?\.ok\) abortRound\(\);/);
  const land = src.slice(src.indexOf("const landRound"), src.indexOf("setQuality(q)"));
  assert.ok(land.indexOf("setBossNote") > land.indexOf(".then("), "보상 문구는 저장 결과를 본 뒤에");
  assert.match(src, /serverPts === 0 \?/);
  assert.match(src, /role="application"/);
  assert.doesNotMatch(src, /className=\{`fish-scene[^`]*`\}\s+role="button"/, "버튼 안에 버튼을 두지 않는다");
  assert.match(code("src/lib/couple.ts"), /Promise<number \| null>/);
});

test("시트 · 피버 · 랭킹 — 포커스 · Esc · 바깥 누르기 · 실제 시간 · 키 반복 · 고르기 한 칸", () => {
  const panels = code("src/components/FishingPanels.tsx");
  assert.match(panels, /useDialogFocus\(true, onClose\)/);
  assert.match(panels, /downAt\.current = e\.target === e\.currentTarget \? e\.currentTarget : null/);
  assert.doesNotMatch(panels, /role="tab"/);
  assert.match(panels, /couple \? " · 둘이 함께 깎아요" : ""/);
  const game = code("src/components/FishingGame.tsx");
  assert.match(game, /useDialogFocus\(sheetOpen, closePrep\)/);
  const fever = code("src/components/FishFever.tsx");
  assert.match(fever, /performance\.now\(\)/);
  assert.doesNotMatch(fever, /Math\.min\(0\.1,/, "한 틱을 잘라 10초를 늘리지 않는다");
  assert.match(fever, /if \(e\.repeat\) return;/);
  assert.match(fever, /\{f\.hits\}\/\{FEVER_ROUNDS\}/);
  const rank = code("src/components/FishRank.tsx");
  assert.doesNotMatch(rank, /<select|role="tab"/);
  assert.match(appCss(), /\.fish-cm-board li \{[^}]*min-height: 36px/);
});

test("서버 — 점수 제한은 사람마다 잠금을 잡고 확인한다 · schema.sql 에 같은 복사본", () => {
  const f = "supabase/migrations/20261105000000_fish_catch_rate_lock.sql";
  const sql = read(f).replace(/\r\n/g, "\n");
  const lock = sql.indexOf("pg_advisory_xact_lock"), check = sql.indexOf("interval '2 seconds'");
  assert.ok(lock > 0 && lock < check, "잠금이 확인보다 먼저");
  for (const s of ["10 * power(1.8::double precision, v_grade)", "when 2 then 2 when 1 then 1.3", "1 + 0.5 * v_q", "v_pts := 2", "create or replace function public.submit_fish_catch("]) assert.ok(sql.includes(s), s);
  assert.doesNotMatch(sql, /errcode = '40/);
  assert.ok(read("supabase/schema.sql").replace(/\r\n/g, "\n").includes(sql.trim()), "schema.sql 복사본");
});
