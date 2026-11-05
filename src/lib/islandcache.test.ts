// 공유 섬 저장소 lock (2026-11-06 게임 리뷰) — 저장 한 번에 기기마다 섬 전체를 2~3번 다시 받던 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { changeAction, createIslandCache, type CacheRow, type Change } from "./islandcache.ts";

type Row = CacheRow<{ pet: object; farm: object; log: string[]; n: number }>;
const row = (version: number, n = version): Row => ({ couple_id: "c", version, updated_by: null, state: { pet: {}, farm: {}, log: [], n } });
const tickQ = () => new Promise((r) => setTimeout(r, 0));

function harness() {
  let server: Row | null = row(1);
  let loads = 0;
  let fail = false;
  let gate: Promise<void> | null = null;
  const watchers = new Set<(p?: Change) => void>();
  let watchCalls = 0;
  const cache = createIslandCache<Row>({
    load: async () => {
      loads++;
      const answer = server; // 요청이 나간 순간의 서버 — 늦게 도착해도 그때 값이다
      if (gate) await gate;
      if (fail) throw new Error("Failed to fetch");
      return answer;
    },
    watch: (_c, cb) => {
      watchCalls++;
      watchers.add(cb);
      return () => watchers.delete(cb);
    },
  });
  return {
    cache,
    get loads() { return loads; },
    get watchCalls() { return watchCalls; },
    get watchers() { return watchers.size; },
    setServer: (r: Row | null) => (server = r),
    setFail: (v: boolean) => (fail = v),
    hold: () => { let open!: () => void; gate = new Promise<void>((r) => (open = r)); return () => { gate = null; open(); }; },
    emit: (p?: Change) => watchers.forEach((cb) => cb(p)),
  };
}

test("★ 구독은 커플마다 하나 — 화면 셋이 봐도 한 번 받는다", async () => {
  const h = harness();
  const seen: (Row | null)[][] = [[], [], []];
  const offs = seen.map((list) => h.cache.watch("c", (s) => list.push(s.row)));
  await tickQ();
  assert.equal(h.watchCalls, 1, "realtime 구독이 화면마다 생긴다");
  assert.equal(h.loads, 1, "처음 한 번만 받는다");
  for (const list of seen) assert.equal(list.at(-1)?.version, 1);
  offs.forEach((off) => off());
  assert.equal(h.watchers, 0, "마지막 화면이 닫히면 구독도 닫는다");
});

test("★ 내 저장의 메아리 · 이미 본 버전은 다시 받지 않는다 · 저장 응답은 그대로 캐시에", async () => {
  const h = harness();
  const off = h.cache.watch("c", () => {});
  await tickQ();
  h.cache.adopt("c", row(2)); // 저장 응답
  assert.equal(h.cache.snapshot("c").row?.version, 2);
  h.emit({ eventType: "UPDATE", new: { version: 2 } }); // 메아리(행이 잘려 온 경우)
  h.emit({ eventType: "UPDATE", new: { version: 1 } }); // 늦게 온 옛 변경
  await tickQ();
  assert.equal(h.loads, 1, "메아리에 다시 받았다");
  // 상대 변경 — 행이 통째로 오면 받지 않고 그대로 쓴다
  h.emit({ eventType: "UPDATE", new: row(3) });
  await tickQ();
  assert.equal(h.loads, 1);
  assert.equal(h.cache.snapshot("c").row?.version, 3);
  // 큰 행은 값이 빠진 채 온다 — 그땐 다시 받는다
  h.setServer(row(4));
  h.emit({ eventType: "UPDATE", new: { version: 4, couple_id: "c" } });
  await tickQ();
  assert.equal(h.loads, 2);
  assert.equal(h.cache.snapshot("c").row?.version, 4);
  // 옛 저장 응답이 늦게 와도 캐시를 되돌리지 않는다
  h.cache.adopt("c", row(3));
  assert.equal(h.cache.snapshot("c").row?.version, 4);
  off();
});

test("★ 네트워크 오류는 '섬 없음'이 아니다 — 캐시를 지키고 error 로 알린다", async () => {
  const h = harness();
  const off = h.cache.watch("c", () => {});
  await tickQ();
  h.setFail(true);
  await assert.rejects(h.cache.refresh("c"));
  const snap = h.cache.snapshot("c");
  assert.equal(snap.row?.version, 1, "캐시를 비웠다");
  assert.equal(snap.error, true);
  h.setFail(false);
  h.setServer(null); // 정말 없어진 경우(연결 해제 등)만 null
  assert.equal(await h.cache.refresh("c"), null);
  assert.equal(h.cache.snapshot("c").error, false);
  off();
});

test("동시에 받기는 하나로 · 받는 사이 저장 응답이 오면 더 새 쪽", async () => {
  const h = harness();
  const off = h.cache.watch("c", () => {});
  await tickQ();
  const open = h.hold();
  const a = h.cache.refresh("c");
  const b = h.cache.refresh("c");
  h.cache.adopt("c", row(5)); // 받는 도중에 내 저장 응답(서버는 이제 5 — 먼저 나간 받기는 옛 1 을 들고 온다)
  open();
  h.setServer(row(5));
  await Promise.all([a, b]);
  assert.equal(h.cache.snapshot("c").row?.version, 5, "받던 옛 행(1)이 저장 응답을 덮었다");
  assert.ok(h.loads <= 3, `받기가 합쳐지지 않았다(${h.loads})`);
  off();
});

test("변경 판정 표", () => {
  assert.equal(changeAction({ eventType: "resync" }, row(3)), "refresh");
  assert.equal(changeAction({ eventType: "DELETE", old: {} }, row(3)), "refresh");
  assert.equal(changeAction({ eventType: "UPDATE", new: { version: 3 } }, row(3)), "skip");
  assert.equal(changeAction({ eventType: "UPDATE", new: row(4) }, row(3)), "adopt");
  assert.equal(changeAction({ eventType: "UPDATE", new: { version: 4 } }, row(3)), "refresh");
  assert.equal(changeAction(undefined, null), "refresh");
});

test("★ 섬을 보는 화면은 공유 저장소 하나 — 각자 구독 · 각자 다시 받기 금지 [소스 스캔]", () => {
  const code = (p: string) => readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const f of ["components/IslandGame.tsx", "components/GameArcade.tsx", "components/island/HomePet.tsx", "components/MergeGame.tsx"]) {
    const src = code(f);
    assert.doesNotMatch(src, /\bwatchIsland\(/, `${f}: 자기 구독을 연다`);
    assert.doesNotMatch(src, /\bloadIsland\(/, `${f}: 저장소를 거치지 않고 받는다`);
    assert.match(src, /@\/lib\/islandstore/, `${f}: 공유 저장소를 안 쓴다`);
  }
  const couple = code("lib/couple.ts");
  assert.match(couple, /emitIslandRow\(coupleId, row\)/, "저장 · 받기 응답이 저장소로 안 간다");
  const store = code("lib/islandstore.ts");
  assert.match(store, /onIslandRow\(\(coupleId, row\) => cache\.adopt\(coupleId, row\)\)/);
  assert.doesNotMatch(store, /from "@\/lib\/island"/, "저장소가 섬 엔진을 싣는다(홈 첫 로드)");
});
