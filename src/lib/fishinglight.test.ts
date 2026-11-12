// 밤 집어등 낚시 lock (2026-11-12) [사용자 승인: "밤에만 열리는 다섯 번째 방식입니다. 불빛으로 물고기를 모았다가 터지는 순간 낚아 올립니다"]
// 봇은 사람을 흉내 낸다(늦게 봄 · 오차 · 반응 시간) — 값이 아니라 '잘하는 손은 대개 · 서툰 손은 절반쯤' · '능력치가 곡선을 민다' · '막 누르면 못 낚는다'를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BAITS, GREEN_HIGH, METHODS, SPOTS, castBlock, catchPoints, catchTable, familyBaitTier, fightLevel, fishingOf, methodOf, prefMethod, prefMethodWrite, rollCatch, spendBait, spotPush, startFight, stepFight, LIGHT_BLOCK, NIGHT_FAMILIES, type Fight, type FishSpot, type MethodKey } from "./fishing.ts";
import { lightNight } from "./fishingworld.ts";
import { LIGHT_PERFECT, lightBand, lightFightTune, lightHook, lightQuality, lightTune, startLight, stepLight, type Light } from "./fishinglight.ts";
import { createIsland } from "./island.ts";

const root = process.cwd();
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const DT = 0.033;
const noise = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 2 ** 32;
  };
};
const rate = (fn: (seed: number) => boolean, n = 300) => {
  let w = 0;
  for (let i = 0; i < n; i++) if (fn(i * 131 + 7)) w++;
  return w / n;
};
const spot = (k: string) => SPOTS.find((x) => x.key === k) as FishSpot;

/** 손 — lag 만큼 늦게 보고(프레임 수), 초록 칸 가운데를 오차 err 로 노리고, 터지면 react 초(± jitter) 뒤에 채기를 시작한다.
 *  채기는 위로 튕기기뿐이라(화면은 누르기를 채기로 치지 않는다) 몸짓 값이 더 든다 — 누르고 있었으면 FLICK_HOLD, 떼고 있었으면 눌렀다 튕기느라 FLICK_LIFT.
 *  화면은 채기를 다음 33ms 칸에 쓰므로 반 칸(TICK)을 더한다 */
const FLICK_HOLD = 0.1, FLICK_LIFT = 0.18, TICK = 0.017;
type Hand = { lag: number; err: number; react: number; jitter: number; fightLag: number };
const GOOD: Hand = { lag: 8, err: 0.05, react: 0.26, jitter: 0.08, fightLag: 9 };
const POOR: Hand = { lag: 13, err: 0.12, react: 0.36, jitter: 0.16, fightLag: 12 };

function gather(d: number, eff: number, seed: number, hand: Hand, spam = false): Light {
  const tune = lightTune(d, { power: eff, line: eff });
  let l = startLight(seed, tune);
  const r = noise(seed + 5);
  const seen: Light[] = [];
  let hold = false, strikeAt = -1, aim = (r() - 0.5) * 2 * hand.err;
  for (let i = 0; i < 4000 && (l.status === "gather" || l.status === "ready" || l.status === "surge"); i++) {
    seen.push(l);
    const x = seen[Math.max(0, seen.length - 1 - hand.lag)];
    const b = lightBand(x, tune);
    const mid = (b.lo + b.hi) / 2 + aim;
    if (x.bright > mid + (b.hi - b.lo) * 0.18) hold = false;
    else if (x.bright < mid - (b.hi - b.lo) * 0.18) hold = true;
    if (i % 20 === 0) aim = (r() - 0.5) * 2 * hand.err;
    let strike = false;
    if (spam) strike = i % 12 === 0;
    else if (l.status === "surge") {
      if (strikeAt < 0) strikeAt = l.t + hand.react + (r() - 0.5) * 2 * hand.jitter + (hold ? FLICK_HOLD : FLICK_LIFT) + TICK;
      strike = l.t >= strikeAt;
    }
    l = stepLight(l, DT, { hold, strike }, tune);
  }
  return l;
}

/** 3막 — fishing.test 의 사람 흉내 그대로(차고 나가면 떼고 · 빨간 칸 전에 뗀다), 늦게 보는 정도만 손마다 */
function reel(d: number, eff: number, family: string, seed: number, hand: Hand): Fight {
  const tune = lightFightTune(d, { power: eff, line: eff }, family);
  let f = startFight(seed, tune);
  let hold = true;
  const seen: Fight[] = [];
  const r = noise(seed + 9);
  for (let i = 0; i < 4000 && f.status === "on"; i++) {
    seen.push(f);
    const x = seen[Math.max(0, seen.length - hand.fightLag)];
    const err = (r() - 0.5) * 0.15;
    const ev = x.surgeLeft > 0 || x.warnLeft > 0 ? x.event : null;
    if (ev === "surge") hold = false;
    else if (ev === "jump") hold = true;
    else if (x.tension > GREEN_HIGH - 0.06 + err) hold = false;
    else if (x.tension < 0.45 + err) hold = true;
    f = stepFight(f, DT, hold, tune);
  }
  return f;
}

/** 그 낚시터의 '흔한 물고기' 미끼 단계(FishSpot.common — 통영 항구는 민물새우) · 없으면 가장 싼 미끼 */
const earlyBait = (sp: FishSpot) => sp.common ?? familyBaitTier(sp.pool[0][0]);
/** 한 판 전체 — 이 낚시터에서 정말 물 물고기로(찌와 같은 뽑기, 첫 미끼), 그 세기로 모으기 → 챔질 → 힘겨루기 */
function round(sp: FishSpot, eff: number, seed: number, hand: Hand) {
  const c = rollCatch(sp, eff, 0.4, seed, { bait: earlyBait(sp), method: "light" });
  const d = fightLevel(c);
  const l = gather(d, eff, seed, hand);
  if (l.status !== "hooked") return false;
  return reel(d, eff, c.family, seed + 1, hand).status === "landed";
}
const winAt = (k: string, eff: number, hand: Hand) => rate((s) => round(spot(k), eff, s, hand));

/* Lv.12 무렵의 보통 능력치 — 점수 22 를 넷에 나눈 6 + 유리섬유 · 카본 낚싯대 3~7 ≈ 10 */
const EFF_EARLY = 10;

test("집어등 — 다섯 번째 방식 · Lv.12 · 밤 방식 · 미끼 하나 · 찌와 같은 등급 기울기(lift · adult)", () => {
  assert.equal(METHODS.length, 5);
  const m = methodOf("light");
  assert.equal(m.key, "light");
  assert.equal(m.name, "집어등");
  assert.equal(m.minLevel, 12);
  assert.equal(m.baitCost, 1);
  assert.equal(m.night, true);
  assert.equal(m.lift, methodOf("float").lift, "귀한 등급을 더 부르지 않는다");
  assert.equal(m.adult, methodOf("float").adult);
  for (const o of METHODS.filter((x) => x.key !== "light")) assert.ok(!o.night, o.key);
});

test("모으기 — 잘하는 손은 대개 걸고, 서툰 손은 절반 남짓 · 막 누르면 못 건다 · 가만히 있으면 떠난다 · 계속 켜 두면 놀란다", () => {
  const ok = (d: number, h: Hand) => rate((s) => gather(d, EFF_EARLY, s, h).status === "hooked");
  const good = ok(3.75, GOOD), poor = ok(3.75, POOR);
  assert.ok(good > 0.85, `잘하는 손 ${good}`);
  assert.ok(poor < good - 0.2, `서툰 손 ${poor}`);
  assert.equal(rate((s) => gather(3, EFF_EARLY, s, GOOD, true).status === "hooked"), 0, "막 누르기");
  const tune = lightTune(3, { power: 10, line: 10 });
  let idle = startLight(5, tune);
  for (let i = 0; i < 3000 && idle.status === "gather"; i++) idle = stepLight(idle, DT, { hold: false, strike: false }, tune);
  assert.equal(idle.status, "gone", "불을 안 켜면 무리가 안 모인다");
  let blaze = startLight(5, tune);
  for (let i = 0; i < 3000 && blaze.status === "gather"; i++) blaze = stepLight(blaze, DT, { hold: true, strike: false }, tune);
  assert.equal(blaze.status, "scared", "계속 켜 두면 너무 밝아 흩어진다");
});

test("터짐 — 창 안에 채야 걸린다 · 일찍 채면 흩어진다 · 늦으면 지나간다 · 빨리 챌수록 솜씨가 높다", () => {
  const tune = lightTune(3, { power: 10, line: 10 });
  const surging: Light = { ...startLight(1, tune), status: "surge", school: 1, surgeT: 0 };
  assert.equal(stepLight(surging, DT, { hold: true, strike: true }, tune).status, "hooked");
  assert.equal(stepLight({ ...surging, status: "ready", surgeIn: 1 }, DT, { hold: true, strike: true }, tune).status, "early");
  assert.equal(stepLight({ ...surging, status: "gather" }, DT, { hold: true, strike: true }, tune).status, "early");
  let late = surging;
  for (let i = 0; i < 60 && late.status === "surge"; i++) late = stepLight(late, DT, { hold: true, strike: false }, tune);
  assert.equal(late.status, "missed");
  const fast = lightHook({ hookAt: 0.05 }, tune), slow = lightHook({ hookAt: tune.window * 0.9 }, tune);
  assert.ok(fast.q > slow.q && fast.perfect && !slow.perfect);
  assert.ok(LIGHT_PERFECT > 0.3 && LIGHT_PERFECT < 0.6);
  assert.ok(tune.window >= 0.3, "창이 사람 반응(0.25초 안팎)보다 짧지 않다");
});

test("한 판 전체(모으기 × 챔질 × 힘겨루기) — 이른 밤바다(통영 · 문섬)에서 잘하는 손 75~85% · 서툰 손 35~55%", () => {
  for (const k of ["harbor", "reef"]) {
    const good = winAt(k, EFF_EARLY, GOOD), poor = winAt(k, EFF_EARLY, POOR);
    console.log(`  집어등 ${k}(push ${spotPush(spot(k))}) 잘하는 손 ${good.toFixed(3)} · 서툰 손 ${poor.toFixed(3)}`);
    assert.ok(good >= 0.75 && good <= 0.85, `${k} 잘하는 손 ${good}`);
    assert.ok(poor >= 0.35 && poor <= 0.55, `${k} 서툰 손 ${poor}`);
  }
});

test("능력치가 오르면 곡선이 오른다 — 내려가지 않는다(잘하는 손 · 서툰 손)", () => {
  for (const hand of [GOOD, POOR]) {
    let prev = 0;
    for (const eff of [1, 5, 10, 20, 35]) {
      const w = winAt("reef", eff, hand);
      assert.ok(w >= prev - 0.03, `eff ${eff}: ${prev} → ${w}`);
      prev = Math.max(prev, w);
    }
  }
  assert.ok(winAt("reef", 35, POOR) > winAt("reef", 1, POOR) + 0.1, "능력치가 체감된다");
});

test("귀할수록 어렵다 — 초록 칸이 좁고 창이 짧다 · 절벽 없이", () => {
  const ok = (d: number) => rate((s) => gather(d, EFF_EARLY, s, GOOD).status === "hooked", 200);
  let prev = 1;
  for (const d of [2, 4, 6, 8]) {
    const now = ok(d);
    assert.ok(now <= prev + 0.05, `d${d}`);
    assert.ok(prev - now < 0.4, `d${d}: ${prev} → ${now}`);
    prev = now;
  }
  const a = lightTune(1, { power: 5, line: 5 }), b = lightTune(7, { power: 5, line: 5 });
  assert.ok(b.width < a.width && b.window < a.window);
  const s1 = gather(3, 10, 99, GOOD), s2 = gather(3, 10, 99, GOOD);
  assert.deepEqual(s1, s2, "같은 입력 = 같은 결과");
  assert.ok(lightQuality(s1) >= 0 && lightQuality(s1) <= 1);
});

/* ── 밤 · 바다 막기 ── */

const KST = (h: number) => Date.UTC(2026, 10, 12, h - 9, 30); // KST h:30
test("밤 — KST 19시 ~ 새벽 5시만 · 바다 낚시터만 · 이유가 분명하다", () => {
  for (const h of [19, 20, 23, 0, 3, 4]) assert.equal(lightNight(KST(h)), true, `${h}시`);
  for (const h of [5, 6, 12, 17, 18]) assert.equal(lightNight(KST(h)), false, `${h}시`);
  assert.equal(lightNight(NaN), false, "시각을 모르면 밤이 아니다");
  const f = { ...fishingOf(createIsland("콩", null, 0)), level: 12 };
  const harbor = spot("harbor"), river = spot("seomjin");
  const bait = BAITS[0].key;
  assert.equal(castBlock(f, harbor, "light", bait, "2026-11-12", true), null);
  assert.ok(castBlock(f, harbor, "light", bait, "2026-11-12", false)?.startsWith(LIGHT_BLOCK));
  assert.ok(castBlock(f, harbor, "light", bait, "2026-11-12")?.startsWith(LIGHT_BLOCK), "밤을 안 넘기면 막는다");
  assert.ok(castBlock(f, river, "light", BAITS[1].key, "2026-11-12", true)?.startsWith(LIGHT_BLOCK), "민물은 밤이어도 안 된다");
  assert.equal(LIGHT_BLOCK, "집어등은 밤바다에서만 켤 수 있어요");
  assert.match(castBlock({ ...f, level: 11 }, harbor, "light", bait, "2026-11-12", true) ?? "", /Lv\.12/);
  for (const m of ["float", "lure", "scoop", "deep"] as MethodKey[]) assert.equal(castBlock(f, harbor, m, bait, "2026-11-12", false), null, `${m} 는 낮에도`);
  // 저장도 같은 판정 — 밤이 아니면 미끼를 쓰지 않는다
  const st = { ...createIsland("콩", null, 0) };
  st.fishing = { ...fishingOf(st), level: 12 };
  assert.equal(spendBait(st, harbor, "light", bait, "2026-11-12", 0, false).ok, false);
  assert.equal(spendBait(st, harbor, "light", bait, "2026-11-12", 0, true).ok, true);
});

/* ── 물고기 — 미끼 1% 규칙 안에서만 밤 물고기 쪽으로 ── */

const SEA = SPOTS.filter((x) => x.water === "sea");
const tierOf = (k: string) => familyBaitTier(k);
test("집어등 뽑기 — 같은 seed 면 찌와 미끼 단계가 한 판도 다르지 않다(미끼 1% 규칙 그대로) · 등급 상한도 그대로", () => {
  for (const sp of SEA) {
    for (let b = 0; b < BAITS.length; b++) {
      for (let i = 0; i < 600; i++) {
        const seed = (Math.imul(i + 1, 2654435761) + b * 977) >>> 0;
        const fl = rollCatch(sp, 10, 0.5, seed, { bait: b, method: "float" });
        const li = rollCatch(sp, 10, 0.5, seed, { bait: b, method: "light" });
        assert.equal(tierOf(li.family), tierOf(fl.family), `${sp.key} 미끼 ${b} seed ${seed}: ${fl.family} → ${li.family}`);
        assert.equal(li.stage, fl.stage, "다 큰 물고기 비율도 찌와 같다");
      }
    }
  }
});

test("집어등 뽑기 — 밤 물고기가 더 많다(catchTable) · 단계별 몫은 찌와 같다", () => {
  const share = (rows: { family: string; chance: number }[], f: (k: string) => boolean) => rows.filter((r) => f(r.family)).reduce((a, r) => a + r.chance, 0);
  const report: string[] = [];
  let raised = 0;
  for (const sp of SEA) {
    for (let b = 0; b < BAITS.length; b++) {
      const fl = catchTable(sp, 10, b, "float", undefined, 3000), li = catchTable(sp, 10, b, "light", undefined, 3000);
      if (!fl.length) continue;
      const tiers = new Set([...fl, ...li].map((r) => tierOf(r.family)));
      for (const t of tiers) {
        const a = share(fl, (k) => tierOf(k) === t), z = share(li, (k) => tierOf(k) === t);
        assert.ok(Math.abs(a - z) < 1e-9, `${sp.key} 미끼 ${b} 단계 ${t}: 찌 ${a} · 집어등 ${z}`);
      }
      const nf = share(fl, (k) => NIGHT_FAMILIES.has(k)), nl = share(li, (k) => NIGHT_FAMILIES.has(k));
      assert.ok(nl >= nf - 1e-9, `${sp.key} 미끼 ${b}: 밤 물고기 ${nf} → ${nl}`);
      if (nl > nf + 0.005) raised++;
      if (sp.key === "harbor" || sp.key === "reef" || sp.key === "ocean") report.push(`${sp.key}/${BAITS[b].key}: ${li.filter((r) => NIGHT_FAMILIES.has(r.family)).map((r) => `${r.family} ${(fl.find((x) => x.family === r.family)?.chance ?? 0).toFixed(3)}→${r.chance.toFixed(3)}`).join(", ")}`);
    }
  }
  console.log("  " + report.join("\n  "));
  assert.ok(raised >= 8, `밤 물고기가 늘어난 낚시터 · 미끼 ${raised}`);
  // 통영 항구 — 오징어살 미끼면 오징어가 찌보다 확실히 많다(같은 희귀 단계 안에서)
  const fl = catchTable(spot("harbor"), 10, 2, "float", undefined, 4000), li = catchTable(spot("harbor"), 10, 2, "light", undefined, 4000);
  const sq = (rows: typeof fl) => rows.find((r) => r.family === "squid")?.chance ?? 0;
  assert.ok(sq(li) > sq(fl) * 1.8, `오징어 ${sq(fl)} → ${sq(li)}`);
  // 다른 방식은 그대로 — 집어등 갈래는 how.night 일 때만
  for (const m of ["float", "lure", "scoop", "deep"] as MethodKey[]) {
    const a = rollCatch(spot("reef"), 10, 0.5, 12345, { bait: 3, method: m }), b = rollCatch(spot("reef"), 10, 0.5, 12345, { bait: 3, method: m });
    assert.deepEqual(a, b);
  }
});

test("NIGHT_FAMILIES — 있는 계열만(새 계열 없음) · 바다 낚시터에서 잡힌다", async () => {
  const { familyOf } = await import("./aquarium.ts");
  for (const k of NIGHT_FAMILIES) {
    assert.ok(familyOf(k), k);
    assert.ok(SEA.some((s) => s.pool.some(([p]) => p === k)), `${k} 는 어느 바다에서 잡힌다`);
  }
});

test("점수 — 집어등 솜씨(모으기 · 챔질 · 힘겨루기)를 catchPoints 가 그대로 받는다", () => {
  const fish = rollCatch(spot("harbor"), 10, 0.5, 77, { bait: 1, method: "light" });
  const lo = catchPoints(fish, 0, false, false), hi = catchPoints(fish, 1, true, true);
  assert.ok(hi > lo && Number.isFinite(hi));
});

/* ── 방식 저장(기기 prefs) — 되돌린 옛 앱이 깨지지 않게 집어등은 lamp 칸 ── */

test("방식 저장 — 다섯 방식이 왕복한다 · 모르는 값은 찌 · 집어등은 method 칸을 건드리지 않는다", () => {
  for (const m of METHODS) {
    const w = prefMethodWrite(m.key);
    assert.equal(prefMethod({ method: "lure", ...w }), m.key, m.key);
  }
  assert.deepEqual(prefMethodWrite("light"), { lamp: true });
  assert.equal(prefMethod({ method: "light" }), "float", "옛 칸에 light 가 들어 있으면 찌로");
  assert.equal(prefMethod({ method: "nope" }), "float");
  assert.equal(prefMethod({}), "float");
  assert.equal(prefMethod({ method: "deep", lamp: false }), "deep");
  // 옛 번들이 읽는 method 칸엔 옛 넷 중 하나만 남는다 — 되돌린 앱의 COACH[method] 가 늘 있다
  const g = code("src/components/FishingGame.tsx");
  assert.match(g, /prefMethod\(readPrefs\(\)\)/);
  assert.match(g, /savePrefs\(prefMethodWrite\(m\.key\)\)/);
  assert.doesNotMatch(g, /savePrefs\(\{ method: m\.key \}\)/);
});

/* ── 화면 · 연출 계약 ── */

test("화면 — 밤 판정을 던질 때 다시 보고 저장에도 넘긴다 · 개발 빌드에서만 밤 강제 · 판이 glow 단계로 간다", () => {
  const g = code("src/components/FishingGame.tsx");
  assert.match(g, /lightNight\(clock\(\)\)/, "때 손님과 같은 시각(gameNow)");
  assert.match(g, /process\.env\.NODE_ENV !== "production"/);
  assert.match(g, /__fishNight/);
  assert.match(g, /spendBait\(s, sp, m, key, kstDate\(t\), castM, night\)/);
  assert.match(g, /castBlock\(fs, spot, method, bait\.key, today, night\)/);
  assert.match(g, /setPhase\("glow"\)/);
  assert.match(g, /stepLight\(cur, dt, \{ hold: holdRef\.current, strike \}, tune\)/);
  assert.match(g, /lightFightTune\(/);
  for (const k of ["lightScare", "lightGone", "lightMiss", "lightEarly"]) assert.ok(g.includes(`${k}:`), k);
  assert.match(g, /light: \[/, "첫 안내(GameCoach)");
  const icons = code("src/components/FishingIcons.tsx");
  assert.match(icons, /light: </, "방식 그림(SVG)");
  const fx = code("src/lib/fishingfx.ts");
  for (const k of ["lanternStart(", "lanternSet(", "lanternSurge(", "lanternEnd("]) assert.ok(fx.includes(k), k);
  assert.doesNotMatch(fx, /shadowBlur|\.filter\s*=/, "그림자 흐림 · 필터 금지");
});

/** 연출 — 한 판을 통째로 돌려 그리기 인자에 NaN 이 없는지(가짜 캔버스) */
test("연출 — 집어등 한 판(모으기 → 터짐 → 걸림 · 흩어짐)을 그려도 깨지지 않는다 · 움직임 줄이기면 번쩍임이 없다", async () => {
  const { FishFx } = await import("./fishingfx.ts");
  const bad: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return (...a: unknown[]) => { for (const v of a) if (typeof v === "number" && !Number.isFinite(v)) bad.push(k); };
    },
    set(t, k: string, v) { t[k] = v; return true; },
  });
  for (const reduced of [false, true]) {
    const fx = new FishFx({ width: 360, height: 450, getContext: () => ctx as unknown as CanvasRenderingContext2D }, null, reduced);
    fx.resize(360, 450, 1);
    fx.set({ method: "light", phase: "charge" });
    fx.frame(16);
    fx.cast({ x: 0.45, y: 0.5 }, 20000, 0.5, 2, 0.5, 0);
    fx.set({ phase: "glow" });
    fx.lanternStart();
    for (let i = 0; i < 90; i++) { fx.lanternSet(0.5 + Math.sin(i / 9) * 0.3, 0.4, 0.65, i / 90, (i % 30) / 40); fx.frame(33); }
    fx.lanternSurge();
    for (let i = 0; i < 10; i++) fx.frame(33);
    const lit = fx.lanternFlash();
    if (reduced) assert.equal(lit, 0, "움직임 줄이기면 번쩍이지 않는다");
    else assert.ok(lit > 0, "터질 때 번쩍인다");
    fx.lanternEnd(true);
    fx.hook(true);
    fx.set({ phase: "fight" });
    for (let i = 0; i < 20; i++) fx.frame(33);
    fx.reset();
    fx.lanternStart();
    fx.lanternEnd(false);
    for (let i = 0; i < 40; i++) fx.frame(33);
    assert.equal(fx.lanternOn(), false, "흩어진 뒤엔 불이 꺼진다");
  }
  assert.deepEqual(bad, []);
});

