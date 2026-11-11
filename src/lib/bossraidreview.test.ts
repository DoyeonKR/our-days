// 주인 레이드 검토(2026-11-11) — 둘이 같은 때 싸울 때의 저장 · 판 끝 저장 · 손가락 판정 · 피버 시계 · 연출 박자를 잠근다.
// 재현 스크립트(race · kill2 · weak)를 테스트로 옮겼다. 화면 연결은 소스 계약으로 본다(주석을 지운 뒤).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOSSES, BOSS_TAKEN, bossBeaten, bossChunk, bossHp, bossStarted, bossHurt, type BossRecord } from "./fishingworld.ts";
import { bossLost, bossOpen, bossRefund, bossWon, fishingOf } from "./fishing.ts";
import { SWIPE_PX, touchDown, touchMove, touchUp, type RaidTouch } from "./bossraid.ts";
import { FEVER_MAX_DT, feverDt, startFever, tickFever } from "./fishingfever.ts";
import { FishFx, type FxCanvas } from "./fishingfx.ts";
import { createIsland, type IslandState } from "./island.ts";

const DAY = "2026-11-11";
const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const boss = BOSSES[0];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function islandWith(rec: BossRecord): IslandState {
  const s = createIsland("A", null, Date.UTC(2026, 10, 11, 3)) as IslandState;
  return { ...s, coins: 0, fishing: { ...fishingOf(s), level: 50, bosses: { [boss.key]: rec } } };
}
const recOf = (s: IslandState) => fishingOf(s).bosses[boss.key];

test("둘이 같은 때 겨루면 둘 다 깎인다 — 깎은 양을 저장할 때의 체력에서 뺀다(race.mts)", () => {
  // A 가 열고 B 가 연다(B 는 협공) — 둘 다 연 때 체력 1 에서 판을 시작했다
  let s = islandWith(bossStarted(bossStarted(undefined, "A", DAY), "B", DAY));
  const seen = recOf(s).caught;
  const chunkA = bossChunk(boss, recOf(s), "A", DAY), chunkB = bossChunk(boss, recOf(s), "B", DAY);
  // 둘 다 한 판을 다 했다 — B 가 먼저 저장, A 는 B 가 저장한 섬 위에 저장
  for (const [who, d] of [["B", chunkB], ["A", chunkA]] as const) {
    const got = bossLost(s, boss.key, d, DAY, who, seen);
    assert.ok(got.ok, who);
    if (got.ok) s = got.state;
  }
  const r = recOf(s);
  assert.ok(near(r.hp, 1 - chunkA - chunkB), `체력 ${r.hp} — 먼저 저장한 쪽 몫이 사라졌다`);
  assert.ok(near(r.dmg?.A ?? 0, chunkA) && near(r.dmg?.B ?? 0, chunkB), JSON.stringify(r.dmg));
  assert.equal(r.log?.length, 2);
  // 같은 판을 두 번 저장해도(저장은 됐는데 응답을 못 받아 다시) 한 번만 깎는다 — 판 번호(id)로 가린다
  const once = bossLost(s, boss.key, 0.1, DAY, "A", seen, 4242);
  assert.ok(once.ok);
  if (once.ok) {
    const twice = bossLost(once.state, boss.key, 0.1, DAY, "A", seen, 4242);
    assert.ok(twice.ok);
    if (twice.ok) assert.ok(near(recOf(twice.state).hp, recOf(once.state).hp), "같은 판이 두 번 깎였다");
    const other = bossLost(once.state, boss.key, 0.1, DAY, "B", seen, 4242);
    assert.ok(other.ok && near(recOf(other.state).hp, recOf(once.state).hp - 0.1), "상대의 같은 번호 판은 따로 센다");
  }
  // 바닥 — 아무리 깎아도 3% 밑으로는 안 내려가고, 몫은 실제로 깎인 만큼만
  const low = bossHurt({ ...r, hp: 0.1 }, 0.5, DAY, "A");
  assert.ok(near(low.hp, 0.03));
  assert.ok(near((low.dmg?.A ?? 0) - (r.dmg?.A ?? 0), 0.07));
});

test("상대가 먼저 잡은 뒤에 온 늦은 저장은 쉬는 주인 · 다음 주인에 얹지 않는다", () => {
  let rec = bossStarted(bossStarted({ hp: 0.25, at: DAY, tries: {}, caught: 0, until: "" }, "A", DAY), "B", DAY);
  const seen = rec.caught;
  rec = bossBeaten(rec, "B", DAY); // B 가 먼저 잡았다
  const s = islandWith(rec);
  const late = bossLost(s, boss.key, 0.2, DAY, "A", seen);
  assert.equal(late.ok, false);
  if (!late.ok) assert.equal(late.reason, BOSS_TAKEN);
  // 출현 번호를 모르는 옛 길도 쉬는 중이면 막는다
  assert.equal(bossLost(s, boss.key, 0.2, DAY, "A").ok, false);
  // 다음 출현(쉬는 날이 지난 뒤)에도 지난 출현의 판은 얹지 않는다
  assert.equal(bossLost(s, boss.key, 0.2, "2026-11-20", "A", seen).ok, false);
  assert.equal(bossLost(s, boss.key, 0.2, "2026-11-20", "A", seen + 1).ok, true);
  assert.equal(bossHp(recOf(s), DAY), 1);
});

test("둘이 같은 때 잡으면 먼저 저장한 쪽만 보상 · caught 는 한 번만(kill2.mts) · 내 토벌을 다시 저장해도 두 번 안 준다", () => {
  const s0 = islandWith({ hp: 0.1, at: DAY, tries: { A: { day: DAY, n: 1 }, B: { day: DAY, n: 1 } }, caught: 0, until: "" });
  const b = bossWon(s0, boss.key, "B", DAY, 0);
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(b.state.coins, boss.coins);
  const a = bossWon(b.state, boss.key, "A", DAY, 0);
  assert.equal(a.ok, false, "두 번째 토벌이 저장됐다");
  if (!a.ok) assert.equal(a.reason, BOSS_TAKEN);
  assert.equal(bossWon(b.state, boss.key, "A", DAY).ok, false, "출현 번호 없이도 쉬는 중이면 막는다");
  const again = bossWon(b.state, boss.key, "B", DAY, 0);
  assert.ok(again.ok, "내 토벌이 이미 저장됐다 — 실패로 알리지 않는다");
  if (again.ok) {
    assert.equal(again.state.coins, boss.coins, "보상을 두 번 줬다");
    assert.equal(recOf(again.state).caught, 1);
  }
});

test("레이드 안내 화면에서 나가면 쓴 도전을 돌려준다 — 오늘 쓴 것만", () => {
  let s = islandWith({ hp: 1, at: DAY, tries: {}, caught: 0, until: "" });
  const o = bossOpen(s, boss.key, "A", DAY);
  assert.ok(o.ok);
  if (!o.ok) return;
  s = o.state;
  assert.equal(recOf(s).tries.A.n, 1);
  const back = bossRefund(s, boss.key, "A", DAY);
  assert.ok(back.ok);
  if (back.ok) assert.equal(recOf(back.state).tries.A.n, 0);
  assert.equal(bossRefund(s, boss.key, "A", "2026-11-12").ok, false, "어제 쓴 도전은 돌려주지 않는다");
  assert.equal(bossRefund(s, boss.key, "B", DAY).ok, false, "상대 몫은 건드리지 않는다");
});

test("손가락 판정 — 미는 동안 SWIPE_PX 를 넘는 순간 밀기(뗄 때까지 안 기다린다) · 두 엄지로 번갈아 두드려도 누르기", () => {
  const m = new Map<number, RaidTouch>();
  touchDown(m, 1, 100, 300);
  assert.equal(touchMove(m, 1, 110, 300), null, "아직 짧다");
  assert.deepEqual(touchMove(m, 1, 100 + SWIPE_PX + 1, 302), { k: "swipe", dir: 2 }, "넘는 순간 판정");
  assert.equal(touchMove(m, 1, 200, 300), null, "한 번만");
  assert.equal(touchUp(m, 1, 220, 300), null, "뗄 때 다시 밀지 않는다");
  // 왼손 · 오른손 엄지가 겹쳐 눌렸다 떨어진다 — 서로의 시작점을 쓰면 200px 밀기로 읽혔다
  touchDown(m, 7, 60, 600);
  touchDown(m, 8, 300, 600);
  assert.deepEqual(touchUp(m, 7, 62, 601), { k: "tap" });
  touchDown(m, 7, 61, 600);
  assert.deepEqual(touchUp(m, 8, 301, 599), { k: "tap" });
  assert.deepEqual(touchUp(m, 7, 60, 600), { k: "tap" });
  // 움직임을 못 받고 떨어진 긴 밀기는 뗄 때 판정
  touchDown(m, 3, 200, 400);
  assert.deepEqual(touchUp(m, 3, 200, 400 - SWIPE_PX - 5), { k: "swipe", dir: 1 });
  assert.equal(m.size, 0);
});

test("피버 시계 — 다른 앱에 다녀와도 바로 실패하지 않는다(숨은 동안 0 · 한 틱 0.25초까지)", () => {
  assert.equal(feverDt(0.05, true), 0);
  assert.equal(feverDt(0.05, false), 0.05);
  assert.equal(feverDt(30, false), FEVER_MAX_DT, "돌아온 첫 틱이 30초를 통째로 뺐다");
  assert.equal(feverDt(-1, false), 0);
  assert.equal(tickFever(startFever(), feverDt(30, false)).status, "on");
});

test("낚시 연출은 120Hz 화면에서도 초당 60장까지만 그린다 · 움직임 속도는 그대로", () => {
  const g = globalThis as unknown as { requestAnimationFrame?: (f: FrameRequestCallback) => number; cancelAnimationFrame?: (n: number) => void };
  const saved = [g.requestAnimationFrame, g.cancelAnimationFrame];
  let cb: FrameRequestCallback | null = null;
  g.requestAnimationFrame = (f) => { cb = f; return 1; };
  g.cancelAnimationFrame = () => {};
  try {
    for (const hz of [120, 60]) {
      const ctx = new Proxy({}, { get: (_t, n: string) => (...a: unknown[]) => (n.startsWith("create") ? { addColorStop() {} } : (void a, undefined)), set: () => true }) as unknown as CanvasRenderingContext2D;
      const canvas: FxCanvas = { width: 0, height: 0, getContext: () => ctx };
      const fx = new FishFx(canvas);
      fx.resize(360, 450, 1);
      let drawn = 0, ms = 0;
      const frame = fx.frame.bind(fx);
      fx.frame = (d: number) => { drawn++; ms += d; frame(d); };
      fx.pause();
      fx.resume();
      const t0 = performance.now();
      for (let i = 1; i <= hz; i++) (cb as unknown as FrameRequestCallback)(t0 + (i * 1000) / hz);
      assert.ok(drawn >= 58 && drawn <= 61, `${hz}Hz 에서 1초에 ${drawn}장`);
      assert.ok(Math.abs(ms - 1000) < 40, `${hz}Hz 에서 흐른 시간 ${ms}ms`);
      fx.stop();
    }
  } finally {
    [g.requestAnimationFrame, g.cancelAnimationFrame] = saved as [typeof g.requestAnimationFrame, typeof g.cancelAnimationFrame];
  }
});

test("화면 — 판 끝에 바로 저장 · 결과 창 닫기는 알리기만 · 앱을 떠나면 판을 끝낸다 · 여는 중엔 던지지 않는다", () => {
  const game = code("src/components/FishingGame.tsx"), ui = code("src/components/BossRaidGame.tsx");
  const endRaid = game.slice(game.indexOf("function endRaid("), game.indexOf("function quitRaid("));
  assert.match(endRaid, /r\.end === "kill"[\s\S]*?raidSave\.current = saveBossWin\(b, cur\.seen\)/, "토벌을 결과 창을 닫을 때까지 미뤘다");
  assert.match(endRaid, /const dealt = cur\.chunk \* raidScore\(r\)/, "깎은 양(남은 체력이 아니다)");
  const closeRaid = game.slice(game.indexOf("function closeRaid("), game.indexOf("function clearRound("));
  assert.doesNotMatch(closeRaid, /bossWon\(|bossLost\(|act\(/, "닫을 때 저장하면 앱이 꺼질 때 사라지고 두 번 준다");
  assert.match(closeRaid, /saved\?\.res && !saved\.res\.ok\) \{ setMsg\(saved\.note\); return; \}/, "상대가 먼저 잡았으면 끌어올리지 않는다");
  assert.match(closeRaid, /bossPaid\.current = saved/);
  const land = game.slice(game.indexOf("const landRound = useCallback("), game.indexOf("useEffect(", game.indexOf("const landRound = useCallback(")));
  assert.match(land, /paid \? Promise\.resolve\(paid\) : saveBossWin\(beaten, bossSeenRef\.current\)/, "레이드 토벌은 다시 저장하지 않는다");
  assert.doesNotMatch(land, /bossWon\(/);
  // 찌낚시 주인전도 깎은 양 · 출현 번호로 남긴다
  assert.match(game, /bossLost\(s, lostBoss\.key, dealt, kstDate\(clock\(\)\), who, seen, hitId\)/);
  // 레이드 중엔 뒤의 낚시터 캔버스를 멈춘다
  assert.match(game, /!tankOpen && !dialogOpen && phase !== "fever" && !raid\)\) return;/);
  // 여는 저장이 도는 동안 낚시터 누르기를 막고, 돌아왔을 때 판이 시작됐으면 도전을 돌려준다
  assert.match(game, /function press\([^)]*\) \{\s*if \(raidOpening\.current \|\| raidRef\.current\) return;/);
  assert.match(game, /raidOpening\.current = false;[\s\S]*?const now = phaseRef\.current;[\s\S]*?bossRefund\(s, b\.key, who, day\)/);
  assert.match(game, /onQuit=\{quitRaid\}/);
  // 앱을 떠나면 판을 끝낸다(안내 화면이면 도전을 돌려받는다)
  assert.match(ui, /addEventListener\("visibilitychange", onVis\)/);
  assert.match(ui, /addEventListener\("pagehide", away\)/);
  assert.match(ui, /if \(!readyRef\.current\) \{ quit\(\); return; \}[\s\S]*?finishNow\(\);/);
  // 무대를 다시 붙이지 않는다 · 움직임 설정은 한 번만 읽는다 · 손가락마다 시작점
  assert.doesNotMatch(ui, /boss-raid-stage[^>]*key=/, "막을 때마다 무대 · 주인 그림을 새로 붙였다");
  assert.match(ui, /useState\(\(\) => typeof window !== "undefined" && window\.matchMedia\(/);
  assert.equal(ui.match(/matchMedia\(/g)?.length, 1);
  assert.match(ui, /onPointerMove=\{\(e\) => \{ e\.stopPropagation\(\); gesture\(touchMove\(touches\.current, e\.pointerId/);
  assert.match(ui, /frameGate\(acc, now - prev\)/);
  assert.match(code("src/app/globals.css"), /\.boss-raid-stage\.fx-hit\.fx-b, \.boss-raid-stage\.fx-perfect\.fx-b \{ animation-name: boss-raid-shake-b; \}/);
  assert.match(code("src/components/FishFever.tsx"), /tickFever\(fRef\.current, feverDt\(\(now - last\) \/ 1000, document\.hidden\)\)/);
});
