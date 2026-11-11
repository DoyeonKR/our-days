// 주인 레이드(2026-11-11) — 사람 흉내 봇으로 난이도를 잠근다. 값이 아니라 범위다(봇은 사람보다 규칙적이다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOSSES, BOSS_DUO, bossHurt, bossHp, type BossRecord } from "./fishingworld.ts";
import { bossPhase } from "./fishing.ts";
import { PARRY_EARLY, partnerWound, raidLeft, raidScore, raidTune, startRaid, stepRaid, swipeRaid, tapRaid, type Raid, type RaidDir } from "./bossraid.ts";

type Bot = { delay: number; wrong: number; tps: number; aim: number; jitter?: number };
const GOOD: Bot = { delay: 0.25, wrong: 0.05, tps: 6, aim: 0.18 };
const CLUMSY: Bot = { delay: 0.42, wrong: 0.25, tps: 3.5, aim: 0.1 };
/** 박자를 노리는 손(덮치는 순간 · 빠른 연타) · 대충 하는 손(이르게 · 들쭉날쭉 · 여덟에 하나 엉뚱한 쪽) */
const SHARP: Bot = { delay: 0.2, wrong: 0, tps: 8.3, aim: 0, jitter: 0.04 };
const CARELESS: Bot = { delay: 0.3, wrong: 0.12, tps: 5, aim: 0.25, jitter: 0.25 };

function rnd(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }

/** 한 판 — 봇은 화살표를 delay 뒤에 보고, 덮치기 aim 초 전에 민다. 속임수도 delay 뒤에 본다 */
function play(r: Raid, bot: Bot, seed: number): Raid {
  const dt = 1 / 30, rand = rnd(seed);
  let seenIdx = 0, plan: { at: number; dir: RaidDir } | null = null, nextTap = 0;
  const pending: { at: number; dir: RaidDir; hitAt: number }[] = [];
  while (!r.end) {
    stepRaid(r, dt);
    for (; seenIdx < r.events.length; seenIdx++) {
      const e = r.events[seenIdx];
      if ((e.k === "warn" || e.k === "feint") && r.atk) pending.push({ at: e.t + bot.delay, dir: e.dir, hitAt: r.atk.hitAt });
    }
    while (pending.length && pending[0].at <= r.t) {
      const p = pending.shift()!;
      const dir = (rand() < bot.wrong ? (p.dir + 1 + Math.floor(rand() * 3)) % 4 : p.dir) as RaidDir;
      plan = { at: Math.max(r.t, p.hitAt - bot.aim + (rand() - 0.5) * (bot.jitter ?? 0.12)), dir };
    }
    if (plan && r.atk && r.t >= plan.at) { swipeRaid(r, plan.dir); plan = null; }
    if (!r.atk) plan = null;
    if (r.stagger > 0 && r.t >= nextTap) { tapRaid(r); nextTap = r.t + 1 / bot.tps; }
  }
  return r;
}

/** 주인 하나를 잡기까지 몇 판 — 혼자, 하루 3판, 쉬는 날 회복 없이 이어 친다 */
function roundsToKill(bossIdx: number, bot: Bot, eff = { power: 15, line: 15 }) {
  const boss = BOSSES[bossIdx];
  let rec: BossRecord = { hp: 1, at: "2026-11-11", tries: {}, caught: 0, until: "" };
  for (let n = 1; n <= 40; n++) {
    const hp = bossHp(rec, "2026-11-11");
    const r = play(startRaid(n * 7919 + bossIdx, raidTune(boss.difficulty, bossPhase(hp), eff), hp, boss.chunk), bot, n * 31 + bossIdx);
    if (raidLeft(hp, boss.chunk, r) <= 0) return n;
    rec = bossHurt(rec, boss.chunk * raidScore(r), "2026-11-11", "me");
  }
  return 99;
}

test("잘하는 손 — 주인마다 5~12판(하루 3판이면 2~4일), 절벽이 없다", () => {
  const counts = BOSSES.map((_, i) => roundsToKill(i, GOOD))
  for (const [i, n] of counts.entries()) assert.ok(n >= 5 && n <= 12, `${BOSSES[i].name} ${n}판 (${counts.join(",")})`);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1] + 4, `앞 주인보다 갑자기 어렵다: ${counts.join(",")}`);
});

test("점수가 실력을 가른다 — 박자를 노리면 ≈1, 대충 하면 0.5~0.75(예전엔 대충 해도 0.8~0.9 · 화살표만 맞히면 늘 1)", () => {
  const avg = (bot: Bot, d: number, pw: number) => {
    let s = 0;
    for (let n = 0; n < 40; n++) s += raidScore(play(startRaid(n * 7919 + 1, raidTune(d, 0, { power: pw, line: pw }), 1, 0.2), bot, n * 31 + 1));
    return s / 40;
  };
  for (const d of [1.2, 3, 4.6, 7.2]) for (const pw of [5, 15]) {
    const sharp = avg(SHARP, d, pw), good = avg(GOOD, d, pw), care = avg(CARELESS, d, pw);
    assert.ok(sharp >= 0.95, `d=${d} pw=${pw} 박자 손 ${sharp.toFixed(2)}`);
    assert.ok(good >= 0.78 && good <= 0.95, `d=${d} pw=${pw} 잘하는 손 ${good.toFixed(2)}`);
    assert.ok(care >= 0.5 && care <= 0.75, `d=${d} pw=${pw} 대충 하는 손 ${care.toFixed(2)}`);
    assert.ok(sharp - care >= 0.25, "실력 차가 점수에 드러난다");
  }
});

test("서툰 손도 매 판 조금은 깎는다 · 잘하는 손보다 느리다", () => {
  for (const [i, boss] of BOSSES.entries()) {
    const r = play(startRaid(i + 1, raidTune(boss.difficulty, 0, { power: 5, line: 5 }), 1, boss.chunk), CLUMSY, i + 3);
    assert.ok(raidScore(r) > 0.08, `${boss.name} 서툰 손 점수 ${raidScore(r)}`);
    const g = play(startRaid(i + 1, raidTune(boss.difficulty, 0, { power: 5, line: 5 }), 1, boss.chunk), GOOD, i + 3);
    assert.ok(raidScore(g) > raidScore(r), `${boss.name} 잘하는 손이 더 깎는다`);
  }
});

test("아무것도 안 하면 줄 셋이 끊겨 끝나고 깎지 못한다 · 마구 밀면 손해다", () => {
  const boss = BOSSES[5], tune = raidTune(boss.difficulty, 0, { power: 10, line: 10 });
  const idle = startRaid(9, tune, 1, boss.chunk);
  while (!idle.end) stepRaid(idle, 1 / 30);
  assert.equal(idle.end, "down");
  assert.equal(raidScore(idle), 0);
  // 화살표가 뜨자마자 아무 쪽이나 미는 손 — 이르거나 틀려서 끊긴다
  const spam = startRaid(9, tune, 1, boss.chunk);
  let i = 0;
  while (!spam.end) { stepRaid(spam, 1 / 30); if (spam.atk && spam.t - spam.atk.warnAt < 0.05) swipeRaid(spam, (i++ % 4) as RaidDir); }
  assert.ok(raidScore(spam) < 0.15, `마구 밀기 점수 ${raidScore(spam)}`);
  assert.ok(PARRY_EARLY < tune.warn, "막기 창이 알림보다 짧다(알리자마자 밀면 이르다)");
});

test("같은 시드 = 같은 판 · 화나면 빨라진다 · 다 깎으면 그 자리에서 토벌", () => {
  const boss = BOSSES[8];
  const a = play(startRaid(42, raidTune(boss.difficulty, 0, { power: 10, line: 10 }), 1, boss.chunk), GOOD, 7);
  const b = play(startRaid(42, raidTune(boss.difficulty, 0, { power: 10, line: 10 }), 1, boss.chunk), GOOD, 7);
  assert.deepEqual(a, b);
  assert.ok(raidTune(boss.difficulty, 2, { power: 10, line: 10 }).warn < raidTune(boss.difficulty, 0, { power: 10, line: 10 }).warn);
  const low = play(startRaid(42, raidTune(boss.difficulty, 2, { power: 10, line: 10 }), 0.04, boss.chunk), GOOD, 7);
  assert.equal(low.end, "kill");
  assert.equal(raidLeft(0.04, boss.chunk, low), 0);
});

test("협공 · 상대가 남긴 상처 — 상대가 오늘 깎았으면 비틀거리는 주인으로 시작한다, 혼자 · 어제 기록은 없다", () => {
  const log = [{ who: "you", d: 0.1, day: "2026-11-11" }, { who: "me", d: 0.2, day: "2026-11-11" }, { who: "you", d: 0.2, day: "2026-11-10" }];
  assert.ok(partnerWound(log, "me", "2026-11-11") > 1);
  assert.equal(partnerWound(log, "me", "2026-11-12"), 0);
  assert.equal(partnerWound([{ who: "me", d: 0.3, day: "2026-11-11" }], "me", "2026-11-11"), 0);
  const boss = BOSSES[3], tune = raidTune(boss.difficulty, 0, { power: 10, line: 10 });
  const solo = play(startRaid(5, tune, 1, boss.chunk), GOOD, 5);
  const duo = play(startRaid(5, tune, 1, boss.chunk * BOSS_DUO, partnerWound(log, "me", "2026-11-11")), GOOD, 5);
  assert.ok(raidLeft(1, boss.chunk * BOSS_DUO, duo) < raidLeft(1, boss.chunk, solo), "같이 하면 더 깎는다");
});

test("엔진은 순수 — 난수 · 시계를 쓰지 않는다", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/bossraid.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /Math\.random|Date\.now|performance\.now|new Date/);
});

test("주인과는 레이드로 겨룬다 — 시트의 버튼이 레이드를 열고, 찌낚시 주인전(bossPick)으로 들어갈 길이 없다 · 토벌은 끌어올리기(landRound)로", () => {
  const code = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const game = code("src/components/FishingGame.tsx"), sheet = code("src/components/FishingPanels.tsx");
  assert.match(game, /onStart=\{\(\) => \{[\s\S]*?openRaid\(boss\)/);
  assert.doesNotMatch(game, /setBossPick\(boss\.key\)/, "찌낚시 주인전으로 들어가는 길");
  assert.match(game, /bossCatch\(b\)[\s\S]*?landRound\(1\)/);
  assert.match(game, /bossLost\(s, cur\.key, dealt, day, who, cur\.seen, cur\.seed\)/, "깎은 양을 옛 길로 남긴다(연 때 본 출현 번호와 함께)");
  assert.match(sheet, /주인 레이드 시작/);
  const ui = code("src/components/BossRaidGame.tsx");
  assert.match(ui, /createPortal\(/);
  assert.match(ui, /useBackClose\(close\)/);
  assert.match(ui, /document\.hidden \? 0/, "숨은 탭에선 시간이 흐르지 않는다");
});
