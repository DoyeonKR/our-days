// 이벤트 물고기(갓파, 2026-11-26) — 잠그는 것:
//   봉화 계곡에서 던질 때마다 정확히 1%(미끼 · 행운 · 방식 · 시간 · 날씨 무관) · 다른 낚시터는 0 ·
//   수조에 한 번 넣는 데 성공하면(addFish) eventKept 에 남고 그 뒤로는 안 온다(보내 줘도) · 넣지 못했으면 계속 온다
import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_FISH, isEventFamily } from "./eventfish.ts";
import { SPOTS, BAITS, rollCatch, eventDone } from "./fishing.ts";
import { TIMED_FISH } from "./fishingworld.ts";
import { addFish, aquaOf } from "./aquarium.ts";
import type { IslandState } from "./island.ts";

const N = 20000;
const rate = (spotKey: string, opts: Parameters<typeof rollCatch>[4]) => {
  const sp = SPOTS.find((s) => s.key === spotKey)!; let n = 0;
  for (let i = 0; i < N; i++) if (rollCatch(sp, 50, 1, (Math.imul(i + 1, 2654435761) + 3) >>> 0, opts).family === "kappa") n++;
  return n / N;
};

test("갓파는 봉화 계곡 이벤트 — 던질 때마다 1%(미끼 · 시간 · 날씨 · 방식 무관), 다른 낚시터 0, 때 손님 표엔 없다", () => {
  assert.deepEqual(EVENT_FISH.map((e) => [e.species, e.spot, e.chance]), [["kappa", "bonghwa", 0.01], ["yujin", "brook", 0.05]]);
  assert.ok(!TIMED_FISH.some((t) => t.species === "kappa"));
  for (const opts of [{}, { bait: 0 }, { bait: BAITS.length - 1, when: { time: "night" as const, wx: "rain" as const } }, { bait: 2, method: "scoop" as const, when: { time: "day" as const, wx: null } }]) {
    const r = rate("bonghwa", opts);
    assert.ok(r > 0.0085 && r < 0.0115, `봉화 ${JSON.stringify(opts)}: ${(r * 100).toFixed(2)}%`);
  }
  for (const s of SPOTS) if (s.key !== "bonghwa") assert.equal(rate(s.key, { bait: BAITS.length - 1, when: { time: "night", wx: "rain" } }), 0, s.key);
  // 모습 — 치어 · 어린 · 다 큰 셋 다 온다, 뜰채는 다 큰 놈을 못 건진다
  const sp = SPOTS.find((s) => s.key === "bonghwa")!, stages = new Set<number>();
  for (let i = 0; i < N * 3; i++) { const c = rollCatch(sp, 50, 1, (Math.imul(i + 1, 2654435761) + 3) >>> 0, {}); if (c.family === "kappa") stages.add(c.stage); }
  assert.deepEqual([...stages].sort(), [0, 1, 2]);
  for (let i = 0; i < N; i++) { const c = rollCatch(sp, 50, 1, (Math.imul(i + 1, 2654435761) + 3) >>> 0, { method: "scoop" }); if (c.family === "kappa") assert.ok(c.stage < 2); }
});

test("수조에 한 번 넣는 데 성공하면 다시 안 낚인다 — 보내 줘도 그대로, 넣지 못했으면 계속", () => {
  assert.ok(isEventFamily("kappa") && !isEventFamily("guppy"));
  const base = { aquarium: { tank: 6, hunger: 100, water: 100, at: 0, nextId: 1, fish: [], placed: [], wide: 0, bag: {}, dex: [] }, coins: 0 } as unknown as IslandState;
  assert.deepEqual(eventDone(base), []);
  const after = addFish(base, "kappa", 2, "kappa", 1000) as IslandState;
  assert.deepEqual(after.eventKept, ["kappa"]);
  assert.deepEqual(eventDone(after), ["kappa"]);
  // 수조에서 빠져도(보내 주기) 기록은 남는다
  const gone = { ...after, aquarium: { ...aquaOf(after), fish: [] } } as unknown as IslandState;
  assert.deepEqual(eventDone(gone), ["kappa"]);
  assert.equal(rate("bonghwa", { eventDone: eventDone(gone) }), 0);
  // 다른 물고기는 기록하지 않는다
  assert.equal((addFish(base, "guppy", 0, undefined, 1000) as IslandState).eventKept, undefined);
});

test("유진은 청계천(가장 낮은 낚시터) 이벤트 — 던질 때마다 5%(미끼 · 시간 · 날씨 무관), 다른 낚시터 0, 때 손님 표엔 없다", () => {
  const M = 60000, count = (spotKey: string, opts: Parameters<typeof rollCatch>[4]) => { const sp = SPOTS.find((s) => s.key === spotKey)!; let n = 0; for (let i = 0; i < M; i++) if (rollCatch(sp, 50, 1, (Math.imul(i + 7, 2654435761) + 11) >>> 0, opts).family === "yujin") n++; return n / M; };
  assert.equal(SPOTS[0].key, "brook", "가장 낮은 레벨 낚시터");
  assert.ok(!TIMED_FISH.some((t) => t.species === "yujin"));
  for (const opts of [{}, { bait: BAITS.length - 1, when: { time: "night" as const, wx: "rain" as const } }]) { const r = count("brook", opts); assert.ok(r > 0.046 && r < 0.054, `청계천 ${JSON.stringify(opts)}: ${(r * 100).toFixed(2)}%`); }
  for (const s of SPOTS) if (s.key !== "brook") { const sp = s; let n = 0; for (let i = 0; i < 20000; i++) if (rollCatch(sp, 50, 1, i * 977 + 5, {}).family === "yujin") n++; assert.equal(n, 0, s.key); }
});

// 2026-11-27 [사용자: "유진이 낚시 잡힐 확률 5%로 올리고 수조에 넣을 확률을 0.5% 낮춰"]
test("유진 — 수조에 있거나 한 번 넣었으면 청계천에서도 0 · 담기 확률은 무엇을 해도 0.5% 고정 · 잡히는 물고기 목록에도 반영", async () => {
  const { captureChance, pinCapture, FIXED_CAPTURE, catchTable, catchableCount } = await import("./fishing.ts");
  const base = { aquarium: { tank: 6, hunger: 100, water: 100, at: 0, nextId: 1, fish: [], placed: [], wide: 0, bag: {}, dex: [] }, coins: 0 } as unknown as IslandState;
  const after = addFish(base, "yujin", 2, "yujin", 1000) as IslandState;
  assert.deepEqual(eventDone(after), ["yujin"]);
  const sp = SPOTS.find((s) => s.key === "brook")!;
  let n = 0; for (let i = 0; i < 30000; i++) if (rollCatch(sp, 50, 1, (Math.imul(i + 7, 2654435761) + 11) >>> 0, { eventDone: eventDone(after) }).family === "yujin") n++;
  assert.equal(n, 0, "수조에 넣은 뒤엔 안 온다");
  const gone = { ...after, aquarium: { ...aquaOf(after), fish: [] } } as unknown as IslandState;
  assert.deepEqual(eventDone(gone), ["yujin"], "보내 줘도 기록은 남는다");
  assert.equal(FIXED_CAPTURE.yujin, 0.005);
  for (const raw of [0.05, captureChance(99, 1, 1, true, "float", 0.3, "yujin"), 0.95, 1]) assert.equal(pinCapture("yujin", raw), 0.005, `${raw}`);
  assert.equal(pinCapture("kappa", 0.6), 0.6, "다른 물고기는 그대로");
  // 잡히는 물고기 목록(catchTable · catchableCount)에 유진 포함, 수조에 넣은 뒤엔 제외
  const beforeRows = catchTable(sp, 5, 0, "float", { time: "day", wx: "clear" }, 2000, []);
  const afterRows = catchTable(sp, 5, 0, "float", { time: "day", wx: "clear" }, 2000, ["yujin"]);
  assert.ok(beforeRows.some((r) => r.family === "yujin"), "잡히는 물고기 목록에 유진 포함");
  assert.ok(!afterRows.some((r) => r.family === "yujin"), "수조에 넣은 뒤엔 목록에서 제외");
  assert.equal(catchableCount(sp, 0, { time: "day", wx: "clear" }, []), catchableCount(sp, 0, { time: "day", wx: "clear" }, ["yujin"]) + 1);
});
