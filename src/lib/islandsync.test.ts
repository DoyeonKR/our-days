// 섬 저장 파이프라인 lock (2026-11-06 게임 리뷰) — 충돌이면 다시 놓기 · 네트워크면 기다리기 · 방문도 같은 줄 · 자리 비운 사이.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, feedPet, hugPet, claimVisit, type IslandState } from "./island.ts";
import { awayFeed, backoffMs, newLogLines, replayOps, saveErrorKind, withFeed, FEED_MAX } from "./islandsync.ts";

const T = Date.UTC(2026, 3, 15, 3, 0, 0);
const code = (p: string) =>
  readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("저장 실패 가르기 — 충돌(PT409 stale) · 네트워크 · 그 밖", () => {
  assert.equal(saveErrorKind({ code: "PT409", message: "stale" }), "conflict");
  assert.equal(saveErrorKind(new Error("stale")), "conflict");
  assert.equal(saveErrorKind(new Error("TypeError: Failed to fetch")), "network");
  assert.equal(saveErrorKind(new Error("Load failed")), "network");
  assert.equal(saveErrorKind(new Error("네트워크 연결을 확인해 주세요.")), "network");
  assert.equal(saveErrorKind({ code: "28000", message: "로그인이 필요합니다." }), "other");
  // 서버가 판정한 오류(raise exception — P0001 · PT422)는 코드를 달고 온다 → 다시 보내도 같다
  assert.equal(saveErrorKind({ code: "P0001", message: "no island" }), "other");
  assert.equal(saveErrorKind({ code: "PT422", message: "bad state" }), "other");
  assert.deepEqual([0, 1, 2, 5, 9].map(backoffMs), [1000, 2000, 4000, 30000, 30000]);
});

test("★ 충돌 뒤 다시 놓기 — 엔진이 순수라 쌓인 액션을 새 상태 위에 그대로 놓는다", () => {
  const mine = createIsland("나비", null, T);
  // 상대가 먼저 돌봄을 했다(같은 섬 · 더 새 버전)
  const theirs = hugPet(mine, T + 60_000);
  const ops = [(s: IslandState) => feedPet(s, T + 90_000), (s: IslandState) => hugPet(s, T + 95_000)];
  const r = replayOps(theirs, ops);
  assert.equal(r.kept.length, 1, "먹이기는 남는다");
  assert.equal(r.dropped, 1, "상대가 막 안아 준 뒤의 안기는 쿨다운이라 엔진이 받지 않는다");
  assert.ok(r.state.pet.care?.hug === theirs.pet.care?.hug, "상대의 안기가 살아 있다(덮어쓰지 않는다)");
  assert.ok(r.state.log.some((l) => l.includes("안아")) && r.state.pet.stats.hunger > theirs.pet.stats.hunger, "내 먹이기도 들어갔다");
  // 액션이 던지면 떨어뜨린다(화면이 죽지 않게)
  assert.equal(replayOps(theirs, [() => { throw new Error("x"); }]).dropped, 1);
});

test("★ 방문(출석)도 같은 줄 — 다시 놓아도 하트를 두 번 주지 않는다(claimVisit 멱등)", () => {
  const s = createIsland("나비", null, T);
  const visit = (x: IslandState) => claimVisit(x, "me", T + 1000, null);
  const once = replayOps(s, [visit]).state;
  const twice = replayOps(once, [visit]).state;
  assert.equal(twice.coins, once.coins, "같은 날 출석을 다시 놓아도 하트는 그대로");
  const g = code("components/IslandGame.tsx");
  const visitFn = g.slice(g.indexOf("function doVisit("), g.indexOf("const [visitAt, setVisitAt]"));
  assert.match(visitFn, /applyOp\(\(x\) => claimVisit\(/, "방문이 액션 줄을 안 탄다");
  assert.doesNotMatch(g, /pushState\(/, "따로 저장하는 길(pushState)이 돌아왔다 — 첫 탭과 경합한다");
});

test("★ 화면 파이프라인 — 충돌이면 다시 놓고, 네트워크면 초안을 지킨 채 다시 보낸다 [소스 스캔]", () => {
  const g = code("components/IslandGame.tsx");
  const flush = g.slice(g.indexOf("const flush = useCallback("), g.indexOf("flushRef.current = flush"));
  assert.match(flush, /saveErrorKind\(e\)/, "실패를 가르지 않는다(전부 충돌로 본다)");
  // 2026-11-11: 다시 시도 · 다시 놓기는 retryLater · adoptFresh 로 나뉘었다(표식으로 들어간 시도의 몫을 뺀다)
  const retry = g.slice(g.indexOf("const retryLater = useCallback("), g.indexOf("const adoptFresh = useCallback("));
  const adopt = g.slice(g.indexOf("const adoptFresh = useCallback("), g.indexOf("const flush = useCallback("));
  assert.match(flush, /if \(kind === "network"\) \{[\s\S]{0,200}?retryLater\(\)/, "네트워크 오류에 다시 시도가 없다");
  assert.match(retry, /backoffMs\(/, "다시 시도에 간격이 없다");
  assert.match(adopt, /opsToReplay\(fresh\.state, attemptsRef\.current, opsRef\.current\)/, "들어간 시도의 몫을 빼지 않는다");
  assert.match(adopt, /replayOps\(fresh\.state, ops\)/, "충돌 뒤 쌓인 액션을 다시 놓지 않는다");
  assert.match(flush, /if \(adoptFresh\(fresh\)\) scheduleFlush\(0\)/, "충돌 경로가 다시 놓기를 안 탄다");
  assert.match(adopt, /if \(r\.dropped > 0 && mountedRef\.current\) setErr\(/, "충돌 안내는 다시 놓지 못한 액션이 있을 때만");
  assert.doesNotMatch(flush, /상대가 방금 뭔가 했어요/, "옛 무조건 충돌 문구");
  const apply = g.slice(g.indexOf("const applyOp = "), g.indexOf("const act = "));
  assert.match(apply, /opsRef\.current = \[\.\.\.opsRef\.current, op\]/, "액션을 줄에 쌓지 않는다");
  assert.match(apply, /withFeed\(/, "누가 · 언제 한 일인지 소식을 남기지 않는다");
  // 수확도 같은 줄(예전엔 commit(next) 로 상태만 넘겨서 다시 놓을 수 없었다)
  assert.match(g, /applyOp\(\(x\) => harvest\(x, i, nowMs\)\)/);
  assert.doesNotMatch(g, /\bcommit\(next\)/);
});

test("새 로그 줄 찾기 — 앞에 붙은 것만, 50줄로 잘려도", () => {
  assert.deepEqual(newLogLines(["b", "a"], ["d", "c", "b", "a"]), ["d", "c"]);
  assert.deepEqual(newLogLines([], ["x"]), ["x"]);
  assert.deepEqual(newLogLines(["a"], ["a"]), []);
  const old = Array.from({ length: 50 }, (_, i) => `l${i}`);
  assert.deepEqual(newLogLines(old, ["n1", "n2", ...old].slice(0, 50)), ["n1", "n2"]);
  // 같은 글이 되풀이돼도 가장 앞의 짝을 찾는다
  assert.deepEqual(newLogLines(["밥", "밥"], ["밥", "밥", "밥"]), ["밥"]);
});

test("★ 자리 비운 사이 — 소식은 누가 · 언제를 붙여 남고, 상대가 내 마지막 이후에 한 일만 보인다", () => {
  const s = createIsland("나비", null, T);
  const fed = withFeed(s, feedPet(s, T + 1000), "partner", T + 1000);
  assert.equal(fed.feed?.[0]?.by, "partner");
  assert.match(fed.feed?.[0]?.msg ?? "", /밥|먹/);
  assert.equal(withFeed(s, s, "me", T), s, "no-op 은 같은 참조(헛저장 방지)");
  // 정산이 낸 섬 소식(비 · 아픔)은 사람이 한 일이 아니다
  const rainy = { ...s, log: ["🌧️ 비가 내려 밭이 촉촉해졌어요", ...s.log] };
  assert.equal(withFeed(s, rainy, "partner", T).feed, undefined);
  // 상한
  let x: IslandState = s;
  for (let i = 0; i < 40; i++) x = withFeed(x, { ...x, log: [`일 ${i}`, ...x.log] }, "partner", T + i);
  assert.equal(x.feed?.length, FEED_MAX);
  const mine = withFeed(x, { ...x, log: ["내 일", ...x.log] }, "me", T + 100);
  assert.deepEqual(awayFeed(mine.feed, "me", T + 35).map((f) => f.msg), ["일 39", "일 38", "일 37", "일 36"]);
  assert.equal(awayFeed(mine.feed, "me", null).length, 0, "기록이 없으면 내가 마지막으로 한 일 뒤로 — 그 뒤엔 없다");
  assert.equal(awayFeed(undefined, "me", 1).length, 0, "옛 저장분(소식 칸 없음)");
});

test("자리 비운 사이 카드 — 소식이 있을 때만 · 닫을 수 있다 · 본 시각은 이 기기에 [소스 스캔]", () => {
  const g = code("components/IslandGame.tsx");
  assert.match(g, /\{away && away\.length > 0 && \(/);
  assert.match(g, /aria-label="자리 비운 사이"/);
  assert.match(g, /onClick=\{\(\) => \{ markSeen\(\); setAway\(null\); \}\}/, "닫기");
  assert.match(g, /ourdays:island:seen:\$\{coupleId\}:\$\{myUserId\}/);
  assert.match(g, /useEffect\(\(\) => \(\) => markSeen\(\), \[markSeen\]\)/, "섬을 닫을 때 본 시각을 남긴다");
});
