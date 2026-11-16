// 모험 커플 레이드(2026-11-13) — 주간 영물 · 동시 저장 · 한 번만 토벌 · 상한 · 저장 크기. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGEND_KEYS, isDuel, makeMon, newSave, type AdvSave } from "./adventure.ts";
import { ENGINE_HASH } from "./adventurehash.ts";
import { TPS } from "./arena.ts";
import {
  RAID_CLAIMED_MAX, RAID_GOLD, RAID_SECONDS, RAID_TICKS, RAID_HEARTS, RAID_HITS_MAX, RAID_POOL_DUO, RAID_POOL_SOLO, RAID_TAKEN, RAID_TRIES, RAID_TRY_MAX, RAID_UNIT, RAID_WEEK_GONE,
  raidBattle, raidBossOf, raidCharge, raidClaim, raidClaimable, raidCommit, raidDmg, raidHit, raidHitIsland, raidHitSolo, raidLeft, raidLog, raidMineOf, raidNow, raidOf,
  raidOpen, raidOpenIsland, raidOpenSolo, raidPhase, raidPoints, raidTotal, raidTriesLeft, raidWear, raidWeek, readRaid,
  type RaidDeps, type RaidShared,
} from "./advraid.ts";
import type { IslandState } from "./island.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const island = (extra: Partial<IslandState> = {}) => ({ coins: 1000, ...extra }) as unknown as IslandState;
const FRI = "2026-11-13";
const save0 = (): AdvSave => {
  const s = newSave("leaf_2", 7);
  const g = { s: 3 };
  return { ...s, party: [makeMon("leaf_3", 30, g, "a"), makeMon("ember_3", 28, g, "b")] };
};

/** 가짜 서버 — island_action 처럼 버전이 같을 때만 쓴다. lose 가 참이면 들어간 뒤 응답만 잃는다 */
function server(st: IslandState) {
  const s = { row: { state: st, version: 1 }, lose: 0, writes: 0 };
  const deps = (stale?: { state: IslandState; version: number }): RaidDeps => {
    let first = stale;
    return {
      load: async () => {
        if (first) {
          const r = first;
          first = undefined;
          return r;
        }
        return s.row;
      },
      save: async (version, state, mark) => {
        if (version !== s.row.version) throw Object.assign(new Error("stale"), { code: "PT409" });
        const saves = [...(((state as { _saves?: string[] })._saves) ?? []), mark];
        s.row = { state: { ...state, _saves: saves } as IslandState, version: version + 1 };
        s.writes++;
        if (s.lose > 0) {
          s.lose--;
          throw new Error("Failed to fetch");
        }
        return s.row;
      },
      mark: (() => {
        let n = 0;
        return () => `m${++n}${Math.random().toString(36).slice(2, 6)}`;
      })(),
    };
  };
  return { s, deps };
}

test("주 · 영물 — KST 월요일이 출현 번호, 같은 주는 같은 영물, 이웃한 주는 다른 영물, 24주에 24마리 모두", () => {
  assert.equal(raidWeek(FRI), "2026-11-09");
  assert.equal(raidWeek("2026-11-09"), "2026-11-09");
  assert.equal(raidWeek("2026-11-15"), "2026-11-09");
  assert.equal(raidWeek("2026-11-16"), "2026-11-16");
  assert.equal(raidWeek("2027-01-01"), "2026-12-28");
  assert.equal(raidBossOf("2026-11-09"), raidBossOf(raidWeek("2026-11-12")));
  const seen = new Set<string>();
  let prev = "";
  for (let i = 0; i < 160; i++) {
    const w = new Date(Date.parse("2026-01-05T00:00:00Z") + i * 7 * 86_400_000).toISOString().slice(0, 10);
    const b = raidBossOf(w);
    assert.ok(LEGEND_KEYS.includes(b));
    assert.notEqual(b, prev, w);
    prev = b;
    if (i < LEGEND_KEYS.length) seen.add(b);
  }
  assert.equal(seen.size, LEGEND_KEYS.length);
  // 시간대와 무관(문자열 계산)
  assert.equal(raidBossOf("2026-11-09"), raidBossOf("2026-11-09"));
});

test("하루 세 번 — 줄 개수로 정해지고, 날짜를 되돌려도 다시 열리지 않는다", () => {
  let r: RaidShared | undefined;
  for (let i = 0; i < RAID_TRIES; i++) {
    const o = raidOpen(r, "me", "2026-11-14", 2);
    assert.ok(o.ok);
    r = o.raid;
    assert.equal(o.id, `me:2026-11-14:${i + 1}`);
  }
  assert.equal(raidTriesLeft(r!, "me", "2026-11-14"), 0);
  assert.equal(raidOpen(r, "me", "2026-11-14", 2).ok, false);
  // 되돌린 날짜 — 마지막 연 날(11-14)로 센다
  assert.equal(raidOpen(r, "me", "2026-11-13", 2).ok, false);
  // 상대는 따로
  assert.ok(raidOpen(r, "you", "2026-11-14", 2).ok);
  // 다음 날
  assert.ok(raidOpen(r, "me", "2026-11-15", 2).ok);
});

test("깎은 양 — 같은 id 는 한 번, 판마다 상한 · 남은 몫 · 잘못된 값은 0", () => {
  const o1 = raidOpen(undefined, "me", FRI, 2);
  assert.ok(o1.ok);
  const h1 = raidHit(o1.raid, o1.id, 250.9, "me", FRI, o1.week);
  assert.ok(h1.ok);
  assert.equal(raidTotal(h1.raid), 250);
  const again = raidHit(h1.raid, o1.id, 400, "me", FRI, o1.week);
  assert.ok(again.ok);
  assert.equal(again.raid, h1.raid, "다시 보낸 저장은 아무것도 안 바꾼다");
  const o2 = raidOpen(h1.raid, "me", FRI, 2);
  assert.ok(o2.ok);
  const big = raidHit(o2.raid, o2.id, 999_999, "me", FRI, o2.week);
  assert.ok(big.ok);
  assert.equal(big.raid.hits[o2.id].d, RAID_TRY_MAX);
  for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const o = raidOpen(undefined, "x", FRI, 2);
    assert.ok(o.ok);
    const h = raidHit(o.raid, o.id, bad, "x", FRI, o.week);
    assert.ok(h.ok);
    assert.equal(h.raid.hits[o.id].d, 0);
  }
});

test("동시에 싸우기 — 두 기기가 같은 버전에서 저장해도 둘 다 들어간다(버전 충돌이면 새 섬에 다시 돌린다)", async () => {
  const { s, deps } = server(island());
  // 둘이 판을 연다
  const a = await raidCommit(deps(), (st) => raidOpenIsland(st, "a", FRI));
  const b = await raidCommit(deps(), (st) => raidOpenIsland(st, "b", FRI));
  assert.ok(a.ok && b.ok);
  const idA = (a as { id: string }).id, idB = (b as { id: string }).id, week = (a as { week: string }).week;
  // b 는 a 가 저장하기 전의 섬을 들고 있다(같은 버전)
  const stale = { ...s.row };
  await raidCommit(deps(), (st) => raidHitIsland(st, idA, 300, "a", FRI, week));
  const rb = await raidCommit(deps(stale), (st) => raidHitIsland(st, idB, 200, "b", FRI, week));
  assert.ok(rb.ok);
  const r = raidOf(s.row.state)!;
  assert.deepEqual(raidDmg(r), { a: 300, b: 200 });
  assert.equal(raidTotal(r), 500);
  assert.equal(raidLeft(r), RAID_POOL_DUO - 500);
});

test("같은 사람의 두 기기가 같이 열어도 도전 id 가 갈린다", async () => {
  const { s, deps } = server(island());
  const before = { ...s.row };
  const d1 = await raidCommit(deps(), (st) => raidOpenIsland(st, "me", FRI));
  const d2 = await raidCommit(deps(before), (st) => raidOpenIsland(st, "me", FRI));
  assert.ok(d1.ok && d2.ok);
  assert.notEqual((d1 as { id: string }).id, (d2 as { id: string }).id);
  assert.equal(raidTriesLeft(raidOf(s.row.state)!, "me", FRI), RAID_TRIES - 2);
});

test("응답만 잃은 저장 — 다시 읽은 섬에 표식이 있으면 두 번 깎지 않는다", async () => {
  const { s, deps } = server(island());
  const o = await raidCommit(deps(), (st) => raidOpenIsland(st, "me", FRI));
  assert.ok(o.ok);
  s.lose = 1;
  const before = s.writes;
  const h = await raidCommit(deps(), (st) => raidHitIsland(st, (o as { id: string }).id, 120, "me", FRI, (o as { week: string }).week));
  assert.ok(h.ok);
  assert.equal(s.writes, before + 1, "한 번만 썼다");
  assert.equal(raidTotal(raidOf(s.row.state)!), 120);
});

test("토벌은 한 번 — 둘이 같이 끝내도 하트 · 기록은 한 번, 나중 저장은 '상대가 먼저'", async () => {
  // 남은 몫 100 인 섬
  const o0 = raidOpen(undefined, "a", FRI, 2);
  assert.ok(o0.ok);
  const nearly = raidHit(o0.raid, o0.id, RAID_TRY_MAX, "a", FRI, o0.week);
  assert.ok(nearly.ok);
  let r: RaidShared = nearly.raid;
  // 몫을 거의 다 채운다(다른 날 줄로)
  for (let i = 0; raidLeft(r) > 100; i++) {
    const day = `2026-11-${String(10 + Math.floor(i / 3)).padStart(2, "0")}`;
    const who = i % 2 ? "a" : "b";
    const o = raidOpen(r, who, day, 2);
    if (!o.ok) continue;
    const h = raidHit(o.raid, o.id, Math.min(RAID_TRY_MAX, raidLeft(o.raid) - 100), who, day, o.week);
    assert.ok(h.ok);
    r = h.raid;
  }
  assert.equal(raidLeft(r), 100);
  const { s, deps } = server(island({ advRaid: r }));
  const a = await raidCommit(deps(), (st) => raidOpenIsland(st, "a", "2026-11-15"));
  const b = await raidCommit(deps(), (st) => raidOpenIsland(st, "b", "2026-11-15"));
  assert.ok(a.ok && b.ok);
  const stale = { ...s.row };
  const coins0 = s.row.state.coins;
  const ra = await raidCommit(deps(), (st) => raidHitIsland(st, (a as { id: string }).id, 400, "a", "2026-11-15", (a as { week: string }).week));
  const rb = await raidCommit(deps(stale), (st) => raidHitIsland(st, (b as { id: string }).id, 400, "b", "2026-11-15", (b as { week: string }).week));
  assert.ok(ra.ok && (ra as { beatenNow: boolean }).beatenNow);
  assert.equal(rb.ok, false);
  assert.equal((rb as { reason: string }).reason, RAID_TAKEN);
  const fin = raidOf(s.row.state)!;
  assert.equal(fin.beaten?.by, "a");
  assert.equal(s.row.state.coins, coins0 + RAID_HEARTS, "하트는 한 번");
  assert.equal(raidTotal(fin), RAID_POOL_DUO, "몫을 넘겨 쌓지 않는다");
  // a 가 같은 저장을 다시 보내도 하트가 또 들지 않는다
  const again = raidHitIsland(s.row.state, (a as { id: string }).id, 400, "a", "2026-11-15", (a as { week: string }).week);
  assert.ok(again.ok);
  assert.equal(again.state.coins, s.row.state.coins);
  // 쓰러진 뒤엔 열 수 없다
  assert.equal(raidOpenIsland(s.row.state, "b", "2026-11-15").ok, false);
});

test("늦게 닿은 저장 — 주가 바뀌었으면 버리고, 지난 주는 last 로 넘어가 보상을 받을 수 있다", () => {
  const o = raidOpen(undefined, "me", FRI, 2);
  assert.ok(o.ok);
  const h = raidHit(o.raid, o.id, 200, "me", FRI, o.week);
  assert.ok(h.ok);
  const next = raidOpen(h.raid, "me", "2026-11-16", 2);
  assert.ok(next.ok);
  assert.equal(next.week, "2026-11-16");
  assert.equal(next.raid.last?.week, "2026-11-09");
  assert.deepEqual(next.raid.last?.dmg, { me: 200 });
  // 지난 주에 연 판이 이제 닿았다
  const late = raidHit(next.raid, "me:2026-11-15:1", 300, "me", "2026-11-16", "2026-11-09");
  assert.equal(late.ok, false);
  assert.equal((late as { reason: string }).reason, RAID_WEEK_GONE);
  // 읽기만 해도(저장 전) 새 주로 보인다
  assert.equal(raidNow(h.raid, "2026-11-17", 2).week, "2026-11-16");
  assert.equal(raidNow(h.raid, "2026-11-17", 2).boss, raidBossOf("2026-11-16"));
});

test("보상 — 사람마다 그 주에 한 번 · 정해진 양 · 휘장은 하나 · 받은 주 목록은 8개까지", () => {
  const beaten: RaidShared = { week: "2026-11-09", boss: raidBossOf("2026-11-09"), size: 2, day: FRI, hits: { "a:x:1": { who: "a", day: FRI, n: 1, d: RAID_POOL_DUO, fin: true } }, beaten: { by: "a", day: FRI, id: "a:x:1" } };
  const s0 = save0();
  const c1 = raidClaim(s0, beaten);
  assert.ok(c1);
  assert.equal(c1.save.gold, s0.gold + RAID_GOLD);
  assert.equal(c1.save.balls.great, s0.balls.great + 3);
  assert.equal(c1.save.items.bigpotion, s0.items.bigpotion + 2);
  assert.deepEqual(raidMineOf(c1.save).crests, [beaten.boss]);
  assert.equal(raidMineOf(c1.save).wear, beaten.boss);
  assert.equal(raidClaim(c1.save, beaten), null, "두 번 못 받는다");
  // 다음 주에 넘어가도 지난 주(last)는 아직 안 받았으면 받는다 — 받았으면 못 받는다
  const rolled = raidNow(beaten, "2026-11-17", 2);
  assert.equal(raidClaimable(rolled, s0)?.week, "2026-11-09");
  assert.equal(raidClaimable(rolled, c1.save), null);
  // 같은 영물을 다른 주에 또 잡으면 휘장은 그대로 하나
  const again = raidClaim(c1.save, { ...beaten, week: "2027-05-10" });
  assert.ok(again);
  assert.deepEqual(raidMineOf(again.save).crests, [beaten.boss]);
  // 받은 주 목록 상한
  let s = c1.save;
  for (let i = 1; i <= 20; i++) {
    const w = new Date(Date.parse("2026-11-09T00:00:00Z") + i * 7 * 86_400_000).toISOString().slice(0, 10);
    const c = raidClaim(s, { ...beaten, week: w, boss: raidBossOf(w) });
    assert.ok(c);
    s = c.save;
  }
  assert.ok(raidMineOf(s).claimed.length <= RAID_CLAIMED_MAX);
  // 휘장 떼기 · 없는 휘장은 달 수 없다
  assert.equal(raidMineOf(raidWear(s, null)).wear, undefined);
  assert.equal(raidWear(s, "없는영물"), s);
  // 쓰러지지 않았으면 받을 것이 없다
  assert.equal(raidClaim(s0, { ...beaten, beaten: undefined }), null);
});

test("혼자 — 작은 몫 · 모험 저장에 기록 · 하트 없음", () => {
  const s0 = save0();
  const o = raidOpenSolo(s0, "me", FRI);
  assert.ok(o.ok);
  assert.equal(raidLeft(o.raid), RAID_POOL_SOLO);
  const h = raidHitSolo(o.save, o.id, 300, "me", FRI, o.week);
  assert.ok(h.ok);
  assert.equal(raidTotal(raidMineOf(h.save).solo!), 300);
  assert.equal(h.save.gold, s0.gold);
  assert.ok(RAID_POOL_SOLO < RAID_POOL_DUO);
});

test("기세 — 50% 분노 · 25% 격노, 전투 판은 같은 시드 = 같은 판 · 대장 패턴 · 대전 아님", () => {
  const r0 = raidNow(undefined, FRI, 2);
  assert.equal(raidPhase(r0), 0);
  const half: RaidShared = { ...r0, hits: { x: { who: "a", day: FRI, n: 1, d: RAID_POOL_DUO / 2, fin: true } } };
  const quarter: RaidShared = { ...r0, hits: { x: { who: "a", day: FRI, n: 1, d: (RAID_POOL_DUO * 3) / 4, fin: true } } };
  assert.equal(raidPhase(half), 1);
  assert.equal(raidPhase(quarter), 2);
  assert.equal(raidPhase({ ...quarter, beaten: { by: "a", day: FRI, id: "x" } }), 0, "쓰러진 영물은 기세 없음");
  const s = save0();
  const f1 = raidBattle(s, half, 42), f2 = raidBattle(s, half, 42);
  assert.deepEqual(JSON.stringify(f1), JSON.stringify(f2));
  const boss = f1.battle.sides[1].team[0];
  assert.equal(boss.mon.species, r0.boss);
  assert.equal(boss.stats.hp, Math.round((RAID_POOL_DUO * f1.unit) / RAID_UNIT));
  assert.equal(boss.mon.hp, Math.round((RAID_POOL_DUO / 2) * f1.unit / RAID_UNIT));
  assert.ok(boss.mon.hp < boss.stats.hp * 0.5 + 1, "절반이면 엔진의 대장 분노 문턱");
  assert.ok(f1.battle.boss, "대장 패턴(예고 원)");
  assert.equal(isDuel(f1.battle), false);
  assert.equal(f1.battle.sides[0].team.every((f) => f.mon.hp === f.stats.hp), true, "팀은 다 회복한 사본");
  assert.equal(s.party[0].hp, save0().party[0].hp, "내 저장은 그대로");
  const fury = raidBattle(s, quarter, 42).battle.sides[1].team[0].stats;
  assert.ok(fury.atk > boss.stats.atk && fury.spd > boss.stats.spd, "격노는 더 세다");
  // 점수
  assert.equal(raidPoints(f1, f1.startHp), 0);
  assert.equal(raidPoints(f1, f1.startHp - f1.unit), RAID_UNIT);
  assert.equal(raidPoints(f1, 0), Math.min(RAID_TRY_MAX, Math.ceil((f1.startHp * RAID_UNIT) / f1.unit)));
  assert.ok(raidCharge(f1.unit, f1.unit, boss.stats.hp) > 90);
  assert.equal(raidCharge(0, f1.unit, boss.stats.hp), 0);
});

test("저장 크기 — 한 주 줄 상한까지 채워도 섬 칸 10KB · 내 칸 2KB 아래, 읽기는 깨진 줄을 버린다", () => {
  let r = raidNow(undefined, FRI, 2);
  for (let i = 0; i < RAID_HITS_MAX + 5; i++) {
    const day = new Date(Date.parse("2026-11-09T00:00:00Z") + Math.floor(i / 6) * 86_400_000).toISOString().slice(0, 10);
    const o = raidOpen(r, `user-${i % 2}-0123456789abcdef0123456789ab`, day, 2);
    if (!o.ok) continue;
    const h = raidHit(o.raid, o.id, 1, `user-${i % 2}`, day, o.week);
    if (h.ok) r = h.raid;
  }
  assert.ok(Object.keys(r.hits).length <= RAID_HITS_MAX);
  assert.ok(JSON.stringify({ ...r, last: { week: "2026-11-02", boss: r.boss, size: 2, dmg: raidDmg(r), beaten: { by: "a", day: FRI, id: "x" } } }).length < 10_000);
  let s = save0();
  for (let i = 0; i < 60; i++) {
    const w = new Date(Date.parse("2026-11-09T00:00:00Z") + i * 7 * 86_400_000).toISOString().slice(0, 10);
    const c = raidClaim(s, { week: w, boss: raidBossOf(w), size: 2, day: FRI, hits: {}, beaten: { by: "a", day: FRI, id: "x" } });
    if (c) s = c.save;
  }
  assert.ok(JSON.stringify((s as AdvSave & { raid?: unknown }).raid).length < 2_000);
  assert.ok(raidMineOf(s).crests.length <= LEGEND_KEYS.length);
  // 깨진 값
  assert.equal(readRaid(null), undefined);
  assert.equal(readRaid({ week: "nope" }), undefined);
  const junk = readRaid({ week: "2026-11-09", boss: "없는", size: 9, day: 3, hits: { a: { who: "x", day: FRI, n: 1, d: 5e9, fin: 1 }, b: "bad", c: { who: 1 } } })!;
  assert.equal(junk.boss, raidBossOf("2026-11-09"));
  assert.equal(junk.size, 2);
  assert.deepEqual(Object.keys(junk.hits), ["a"]);
  assert.equal(junk.hits.a.d, RAID_TRY_MAX);
});

test("최근 줄 — 끝난 판만, 새 것부터", () => {
  const r: RaidShared = {
    ...raidNow(undefined, FRI, 2),
    hits: {
      "a:2026-11-10:1": { who: "a", day: "2026-11-10", n: 1, d: 10, fin: true },
      "b:2026-11-12:2": { who: "b", day: "2026-11-12", n: 2, d: 20, fin: true },
      "b:2026-11-12:1": { who: "b", day: "2026-11-12", n: 1, d: 30, fin: true },
      "a:2026-11-13:1": { who: "a", day: FRI, n: 1, d: 0 },
    },
  };
  assert.deepEqual(raidLog(r).map((h) => h.d), [20, 30, 10]);
});

test("판 길이 — 90초 = arena 의 틱", () => {
  assert.equal(RAID_TICKS, RAID_SECONDS * TPS);
});

test("엔진 지문 그대로 — 레이드는 엔진 파일을 바꾸지 않는다(adventure-battle 다시 배포 없음)", async () => {
  const { engineHash } = await import(join(ROOT, "scripts/adventure-shared.mjs"));
  assert.equal(engineHash(ROOT), ENGINE_HASH);
});

test("화면 — 이모지 없음 · 전투 코드는 늦게 · 글자 12/18 · 15/24 · 움직임 줄이기", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const panel = strip(read("src/components/adventure/RaidPanel.tsx"));
  assert.doesNotMatch(panel, /\p{Extended_Pictographic}/u, "크롬에 이모지 없음");
  assert.doesNotMatch(panel, /^import [^\n]*(lib\/arena|lib\/battlefx|adventure\/BattleView)/m, "전투 코드는 dynamic");
  assert.match(panel, /dynamic\(\(\) => import\("@\/components\/adventure\/BattleView"\)/);
  assert.match(panel, /limit=\{RAID_TICKS\}/);
  const tab = strip(read("src/components/adventure/AdventureTab.tsx"));
  assert.match(tab, /const RaidPanel = dynamic\(\(\) => import\("@\/components\/adventure\/RaidPanel"\)/);
  assert.doesNotMatch(tab, /^import [^\n]*advraid/m, "탭은 레이드 규칙을 정적으로 안 부른다");
  assert.match(read("src/app/page.tsx"), /<AdventureTab myUserId=\{myUserId\} coupleId=\{coupleId\} partnerName=\{partnerName\} \/>/);
  const bv = read("src/components/adventure/BattleView.tsx");
  assert.match(bv, /newArena\(start, startBag, limit\)/);
  // CSS — 레이드 덩어리만
  const css = read("src/styles/adventure.css");
  const block = css.slice(css.indexOf("/* 커플 레이드(2026-11-13"));
  assert.ok(block.length > 100);
  for (const m of block.matchAll(/font-size:\s*([\d.]+)px;\s*line-height:\s*([\d.]+)px/g)) assert.ok((m[1] === "12" && m[2] === "18") || (m[1] === "15" && m[2] === "24"), m[0]);
  for (const m of block.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(m[1] === "12" || m[1] === "15", m[0]);
  assert.match(block, /prefers-reduced-motion: reduce\)[\s\S]*is-phase-2 \{ animation: none; \}/);
});
