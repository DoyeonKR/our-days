// 팔기 반응(2026-11-06) [사용자: "물고기들 팔기 누르면 반응이 가끔 느릴 때가 있어"]
// 팔기 한 번이 '섬 전체 받기(GET) → 저장(RPC)' 왕복 둘이었고, 그 사이 수조 · 상대가 저장하면 넷이었다. 결과는 저장이 끝나야 떴다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const game = code("src/components/FishingGame.tsx");
const body = (name: string, end: string) => game.slice(game.indexOf(name), game.indexOf(end, game.indexOf(name)));

test("저장은 가진 행(이 화면 · 공유 저장소 중 새 쪽)으로 먼저 — 버전이 어긋날 때만 다시 받는다", () => {
  const act = body("const act = useCallback", "const feverNow");
  assert.match(act, /let cached = freshRow\(\);/);
  assert.match(act, /const r = cached \?\? \(await loadIsland\(coupleId\)/);
  assert.match(act, /if \(fromCache\) continue;/, "가진 행으로 안 되면 새로 받아 다시 판정한다(낡은 행의 '미끼 없음'을 그대로 믿지 않는다)");
  assert.match(act, /rowRef\.current = saved;/);
  const fresh = body("const freshRow = useCallback", "const act = useCallback");
  assert.match(fresh, /islandSnapshot\(coupleId\)\.row/);
  assert.match(fresh, /b\.version > a\.version \? b : a/);
});

test("내 저장의 메아리(받은 버전 ≤ 지금)는 섬 전체를 다시 받지 않는다", () => {
  assert.match(game, /watchIsland\(coupleId, \(p\) => \{\s+const v = \(p\?\.new as \{ version\?: unknown \} \| undefined\)\?\.version;\s+const cur = rowRef\.current;\s+if \(typeof v === "number" && cur && v <= cur\.version\) return;\s+void load\(\);/);
});

test("팔기는 결과를 먼저 보여 주고 저장은 뒤에서 — 실패하면 거두되 다음 판은 건드리지 않는다", () => {
  const sell = body("async function sell()", "const fightEvent");
  const shown = sell.indexOf('setPhase("result")'), saved = sell.indexOf("await act(");
  assert.ok(shown > 0 && shown < saved, "결과 화면이 저장보다 먼저");
  assert.match(sell, /const guess = base \? sellCatch\(base\.state, c, kstDate\(t\), by\) : null;/);
  assert.match(sell, /if \(!fish \|\| fish\.junk \|\| picked\) return;/, "두 번 눌러 두 번 팔지 않는다");
  assert.ok(sell.indexOf("reportCatch(") > saved, "랭킹 기록은 저장이 된 뒤에만");
  assert.match(sell, /if \(fishRef\.current !== c\) return;/);
  assert.match(sell, /setPhase\("landed"\);/);
});
