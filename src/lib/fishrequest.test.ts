// 오늘의 의뢰(2026-11-13) — 두 폰이 같은 목록 · 늘 오늘 잡을 수 있는 것 · 날짜를 되돌려도 다시 안 받는다 · 하루 상한
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIsland } from "./island.ts";
import { BAITS, SPOTS, rollCatch, sellCatch, fishingOf, type FishCatch } from "./fishing.ts";
import { REQUEST_ALL_BONUS, REQUEST_COUNT, baseFamilies, noteRequest, requestsFor, todayRequests } from "./fishrequest.ts";

const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));

test("같은 날 · 시드 · 레벨이면 같은 목록(두 폰) — 낚시터 · 계열이 겹치지 않는다", () => {
  for (const d of days) for (const lv of [1, 9, 25, 50]) {
    const a = requestsFor(1234, d, lv), b = requestsFor(1234, d, lv);
    assert.deepEqual(a, b);
    assert.ok(a.length >= 1 && a.length <= REQUEST_COUNT);
    assert.equal(new Set(a.map((x) => x.family)).size, a.length);
    if (lv >= 9) { assert.equal(a.length, REQUEST_COUNT, `${d} lv${lv}`); assert.equal(new Set(a.map((x) => x.spot)).size, REQUEST_COUNT); }
  }
  const spread = new Set(days.flatMap((d) => requestsFor(77, d, 50).map((x) => x.family)));
  assert.ok(spread.size >= 25, `60일에 여러 물고기 — ${spread.size}`);
});

test("늘 오늘 잡을 수 있다 — 열린 낚시터의 시작 미끼로 무는 계열이고, 실제 뽑기에서 나온다", () => {
  for (const lv of [1, 5, 12, 25, 40]) for (const d of days.slice(0, 20)) {
    for (const r of requestsFor(9, d, lv)) {
      const spot = SPOTS.find((s) => s.key === r.spot)!;
      assert.ok(spot.minLevel <= lv, `${r.spot} 열림`);
      assert.ok(baseFamilies(spot).includes(r.family), `${r.family} 은 ${r.spot} 기본 무리`);
    }
  }
  for (const spot of SPOTS) for (const fam of baseFamilies(spot)) {
    let n = 0;
    for (let i = 0; i < 4000 && !n; i++) if (rollCatch(spot, 0, 0.4, i * 31 + 5, { bait: 0 }).family === fam) n++;
    // 시작 미끼 단계가 지렁이가 아닌 낚시터는 그 단계 미끼로 본다
    if (!n) for (let b = 1; b < BAITS.length && !n; b++) for (let i = 0; i < 4000 && !n; i++) if (rollCatch(spot, 0, 0.4, i * 31 + 5, { bait: b }).family === fam) n++;
    assert.ok(n > 0, `${spot.key} ${fam} 가 나온다`);
  }
});

test("끌어올리면 채워지고 하트가 들어온다 · 같은 의뢰는 한 번 · 셋 다 하면 덤 · 꽝 · 주인은 안 센다", () => {
  const st0 = { ...createIsland("t", null, 0), seed: 42 };
  const lv = fishingOf(st0).level, day = "2026-11-13";
  const list = requestsFor(42, day, lv);
  let st = st0, total = 0;
  const junk = noteRequest(st, { family: list[0].family, at: list[0].spot, junk: "can" }, day);
  assert.equal(junk.hit, null);
  for (const [i, r] of list.entries()) {
    const before = st.coins;
    const q = noteRequest(st, { family: r.family, at: r.spot }, day);
    assert.ok(q.hit, `의뢰 ${i}`);
    st = q.state; total += st.coins - before;
    const again = noteRequest(st, { family: r.family, at: r.spot }, day);
    assert.equal(again.hit, null, "두 번 안 받는다");
    assert.equal(again.state.coins, st.coins);
  }
  assert.equal(total, list.reduce((n, r) => n + r.coins, 0) + REQUEST_ALL_BONUS);
  assert.ok(total <= 3000, `하루 상한 ${total}`);
  assert.deepEqual(todayRequests(st, day).done, list.map(() => true));
});

test("날짜는 앞으로만 — 시계를 되돌린 날엔 아무것도 안 센다 · 다음 날은 새로", () => {
  const st0 = { ...createIsland("t", null, 0), seed: 5 };
  const lv = fishingOf(st0).level;
  const [r] = requestsFor(5, "2026-11-14", lv);
  const q = noteRequest(st0, { family: r.family, at: r.spot }, "2026-11-14");
  assert.ok(q.hit);
  for (const [past] of requestsFor(5, "2026-11-13", lv).map((x) => [x])) {
    assert.equal(noteRequest(q.state, { family: past.family, at: past.spot }, "2026-11-13").hit, null);
  }
  assert.equal(todayRequests(q.state, "2026-11-13").list.length, 0);
  assert.equal(todayRequests(q.state, "2026-11-15").done.some(Boolean), false);
});

test("목록은 그날 처음 끌어올릴 때 레벨로 굳는다 — 낮에 레벨이 올라도 안 바뀐다", () => {
  const st0 = { ...createIsland("t", null, 0), seed: 8 };
  const day = "2026-11-13", lv = fishingOf(st0).level;
  const first = noteRequest(st0, { family: "__없음", at: SPOTS[0].key }, day).state;
  const up = { ...first, fishing: { ...fishingOf(first), level: 40 } };
  assert.deepEqual(todayRequests(up, day).list, requestsFor(8, day, lv));
});

test("판매 · 담기 결과에 의뢰가 실린다(mastered 한 곳)", () => {
  const st0 = { ...createIsland("t", null, 0), seed: 42 };
  const day = "2026-11-13";
  const [r] = requestsFor(42, day, fishingOf(st0).level);
  const c: FishCatch = { family: r.family, stage: 0, grade: "흔함", difficulty: 0, at: r.spot };
  const res = sellCatch(st0, c, day);
  assert.ok(res.ok && res.request && res.request.family === r.family);
});
