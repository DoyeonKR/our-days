// 함께 끌어올리기(2026-11-12) [사용자: "둘이 동시에 접속해 있을 때 한 명은 낚싯대, 한 명은 뜰채로 같이 끌어올립니다. 실시간 연결이 필요합니다"]
// 폰 두 대 없이 잠글 수 있는 것: 프로토콜 리듀서(시간 초과 · 묵은 판 번호 · 상대 끊김), 보너스 계산, 단일 작성자, 짧은 들어올리기 난이도,
// 그리고 이 기능이 DB 변경 구독 채널을 늘리지 않았는지(2026-07-27 Disk IO 사건 — realtime-mux.test 와 같은 줄).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COOP_ACCEPT_MS, COOP_ASK_DIST, COOP_GAME_MS, COOP_IDLE, COOP_RESULT_SHOW_MS, COOP_SLACK_MS,
  anglerWaitMs, coopBonus, coopChance, coopLiftQuality, coopLiftTune, coopRoundId, coopStep, partnerOf, startCoopLift, stepCoopLift, wantHelp,
  type Coop, type CoopEvent, type CoopMsg,
} from "./fishcoop.ts";
import type { Lift } from "./fishingmodes.ts";

const root = join(import.meta.dirname, "../..");
const raw = (f: string) => readFileSync(join(root, f), "utf8");
/** 주석을 뗀 소스 — 설명문에 든 낱말이 검사를 흔들지 않게(README §10.5) */
const code = (f: string) => raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const A = "user-a", B = "user-b";
/** 한쪽 리듀서에 사건을 넣고 나온 메시지를 모은다 */
function run(s: Coop, me: string, evs: CoopEvent[]) {
  const out: CoopMsg[] = [];
  const notes: string[] = [];
  for (const ev of evs) {
    const r = coopStep(s, ev, me);
    s = r.s;
    if (r.out) out.push(r.out);
    if (r.note) notes.push(r.note);
  }
  return { s, out, notes };
}
const recv = (msg: CoopMsg, now: number, canPrompt = true): CoopEvent => ({ e: "recv", msg, now, canPrompt });

test("한 판 전체 — A idle → askSent → helping → result, B prompt → helping → result → idle (두 리듀서를 메시지로 잇는다)", () => {
  let a: Coop = COOP_IDLE, b: Coop = COOP_IDLE;
  // A 가 끝자락에서 부른다
  let r = coopStep(a, { e: "ask", round: "r1", now: 0 }, A);
  a = r.s;
  assert.equal(a.k, "askSent");
  assert.deepEqual(r.out, { t: "ask", round: "r1", from: A });
  // B 가 받는다 → 받기 창
  r = coopStep(b, recv(r.out!, 200), B);
  b = r.s;
  assert.equal(b.k, "prompt");
  // B 가 수락
  r = coopStep(b, { e: "accept", now: 1_500 }, B);
  b = r.s;
  assert.ok(b.k === "helping" && b.role === "helper");
  r = coopStep(a, recv(r.out!, 1_700), A);
  a = r.s;
  assert.ok(a.k === "helping" && a.role === "angler");
  assert.equal(r.note, "accepted");
  // B 가 건졌다
  r = coopStep(b, { e: "finish", ok: true, q: 0.7, now: 5_000 }, B);
  b = r.s;
  assert.ok(b.k === "result" && b.role === "helper");
  r = coopStep(a, recv(r.out!, 5_200), A);
  a = r.s;
  assert.ok(a.k === "result" && a.role === "angler" && a.ok);
  assert.equal(r.note, "helped");
  assert.equal(coopBonus(a, "r1"), true);
  // B 는 결과를 잠깐 보여 준 뒤 쉰다 · A 의 결과는 판이 끝날 때까지 남는다
  b = coopStep(b, { e: "tick", now: 5_000 + COOP_RESULT_SHOW_MS }, B).s;
  assert.equal(b.k, "idle");
  a = coopStep(a, { e: "tick", now: 600_000 }, A).s;
  assert.equal(a.k, "result", "A 의 결과는 시간으로 사라지지 않는다(담기를 누를 때까지)");
  // A 가 담으면 접는다
  r = coopStep(a, { e: "close", why: "done", now: 601_000 }, A);
  assert.equal(r.s.k, "idle");
  assert.equal(r.out?.t, "cancel");
});

test("시간 초과 — B 가 6초 안에 안 받으면 A 는 혼자 간다 · 받은 뒤 결과가 안 와도 혼자 간다", () => {
  const sent = coopStep(COOP_IDLE, { e: "ask", round: "r1", now: 0 }, A).s;
  assert.equal(coopStep(sent, { e: "tick", now: anglerWaitMs("askSent") - 1 }, A).s.k, "askSent");
  const late = coopStep(sent, { e: "tick", now: anglerWaitMs("askSent") }, A);
  assert.equal(late.s.k, "idle");
  assert.equal(late.note, "fallback");
  assert.deepEqual(late.out, { t: "cancel", round: "r1", from: A, why: "timeout" }, "늦게 받은 B 의 창도 접히게 알린다");
  assert.equal(anglerWaitMs("askSent"), COOP_ACCEPT_MS + COOP_SLACK_MS);

  const helping = run(COOP_IDLE, A, [{ e: "ask", round: "r2", now: 0 }, recv({ t: "accept", round: "r2", from: B }, 3_000)]).s;
  assert.equal(helping.k, "helping");
  // 받은 시각부터 판 상한 + 여유 — B 의 판(최대 5초)이 끝나기 전에 끊으면 안 된다
  assert.ok(anglerWaitMs("helping") > COOP_GAME_MS + 500, "A 의 기다림이 B 의 판 상한보다 길다");
  assert.equal(coopStep(helping, { e: "tick", now: 3_000 + COOP_GAME_MS }, A).s.k, "helping");
  assert.equal(coopStep(helping, { e: "tick", now: 3_000 + anglerWaitMs("helping") }, A).s.k, "idle");

  // B: 받기 창은 6초, 판은 화면이 멈춰도 5.5초에 실패로 닫힌다
  const prompt = coopStep(COOP_IDLE, recv({ t: "ask", round: "r3", from: A }, 0), B).s;
  const exp = coopStep(prompt, { e: "tick", now: COOP_ACCEPT_MS }, B);
  assert.equal(exp.s.k, "idle");
  assert.equal(exp.out?.t, "cancel");
  const playing = coopStep(prompt, { e: "accept", now: 1_000 }, B).s;
  const stuck = coopStep(playing, { e: "tick", now: 1_000 + COOP_GAME_MS + 500 }, B);
  assert.ok(stuck.s.k === "result" && !stuck.s.ok);
  assert.deepEqual(stuck.out, { t: "result", round: "r3", from: B, ok: false, q: 0 });
});

test("묵은 판 번호 · 자기 메아리 · 엉뚱한 메시지는 버린다", () => {
  const sent = coopStep(COOP_IDLE, { e: "ask", round: "new", now: 0 }, A).s;
  // 지난 판(old)의 늦은 응답
  assert.equal(coopStep(sent, recv({ t: "accept", round: "old", from: B }, 10), A).s, sent);
  assert.equal(coopStep(sent, recv({ t: "result", round: "old", from: B, ok: true, q: 1 }, 10), A).s, sent);
  assert.equal(coopStep(sent, recv({ t: "cancel", round: "old", from: B, why: "decline" }, 10), A).s, sent);
  // 내 메시지 메아리
  assert.equal(coopStep(sent, recv({ t: "accept", round: "new", from: A }, 10), A).s, sent);
  // 망가진 값
  assert.equal(coopStep(sent, recv(null as unknown as CoopMsg, 10), A).s, sent);
  assert.equal(coopStep(sent, recv({ t: "accept", round: 3, from: B } as unknown as CoopMsg, 10), A).s, sent);

  // 지난 판에 받은 결과는 새 판의 보너스가 아니다
  const done = run(COOP_IDLE, A, [{ e: "ask", round: "r1", now: 0 }, recv({ t: "result", round: "r1", from: B, ok: true, q: 1 }, 100)]).s;
  assert.equal(coopBonus(done, "r1"), true);
  assert.equal(coopBonus(done, "r2"), false, "다음 판 번호로는 보너스가 없다");
  assert.equal(coopBonus(done, null), false);
  // 판 번호는 사람 · 시각 · 주사위로 기기마다 다르다
  assert.notEqual(coopRoundId(A, 1, 0.5), coopRoundId(B, 1, 0.5));
  assert.notEqual(coopRoundId(A, 1, 0.5), coopRoundId(A, 2, 0.5));
});

test("accept 가 유실되고 result 만 와도 같은 판이면 받는다 · 실패 결과는 보너스가 없다", () => {
  const sent = coopStep(COOP_IDLE, { e: "ask", round: "r1", now: 0 }, A).s;
  const got = coopStep(sent, recv({ t: "result", round: "r1", from: B, ok: true, q: 2 }, 4_000), A);
  assert.ok(got.s.k === "result" && got.s.q === 1, "q 는 0~1 로 자른다");
  const miss = coopStep(sent, recv({ t: "result", round: "r1", from: B, ok: false, q: 0.3 }, 4_000), A);
  assert.equal(miss.note, "missed");
  assert.equal(coopBonus(miss.s, "r1"), false);
  // ok 가 true 가 아닌 값(문자열 등)은 실패로
  const odd = coopStep(sent, recv({ t: "result", round: "r1", from: B, ok: "yes", q: 1 } as unknown as CoopMsg, 4_000), A);
  assert.equal(coopBonus(odd.s, "r1"), false);
});

test("B 가 부탁을 받지 않는 때 — 보이지 않음 · 자기 판 · 이미 돕는 중", () => {
  const ask: CoopMsg = { t: "ask", round: "r1", from: A };
  assert.equal(coopStep(COOP_IDLE, recv(ask, 0, false), B).s.k, "idle", "canPrompt false(다른 탭 · 숨김 · 판 도중)면 창을 안 띄운다");
  const helping = run(COOP_IDLE, B, [recv(ask, 0), { e: "accept", now: 100 }]).s;
  assert.equal(coopStep(helping, recv({ t: "ask", round: "r2", from: A }, 200), B).s, helping, "돕는 중엔 새 부탁을 안 받는다");
  // 결과를 보여 주던 중이면 새 부탁으로 넘어간다
  const shown = coopStep(helping, { e: "finish", ok: true, q: 1, now: 3_000 }, B).s;
  assert.equal(coopStep(shown, recv({ t: "ask", round: "r2", from: A }, 3_100), B).s.k, "prompt");
  // A 자신이 부탁을 보낸 중이면 상대의 부탁을 안 받는다(둘 다 싸우는 중)
  const sent = coopStep(COOP_IDLE, { e: "ask", round: "mine", now: 0 }, A).s;
  assert.equal(coopStep(sent, recv({ t: "ask", round: "yours", from: B }, 10), A).s, sent);
  // 거절하면 A 가 바로 혼자 가도록 알린다
  const prompt = coopStep(COOP_IDLE, recv(ask, 0), B).s;
  const no = coopStep(prompt, { e: "decline", now: 500 }, B);
  assert.equal(no.s.k, "idle");
  assert.deepEqual(no.out, { t: "cancel", round: "r1", from: B, why: "decline" });
  const back = coopStep(coopStep(COOP_IDLE, { e: "ask", round: "r1", now: 0 }, A).s, recv(no.out!, 600), A);
  assert.equal(back.s.k, "idle");
  assert.equal(back.note, "fallback");
});

test("도중에 끊김 — 상대가 사라지면 기다리던 쪽은 바로 혼자, 이미 받은 결과는 남는다", () => {
  const sent = coopStep(COOP_IDLE, { e: "ask", round: "r1", now: 0 }, A).s;
  const gone = coopStep(sent, { e: "gone", now: 100 }, A);
  assert.equal(gone.s.k, "idle");
  assert.equal(gone.note, "fallback");
  const helping = coopStep(sent, recv({ t: "accept", round: "r1", from: B }, 100), A).s;
  assert.equal(coopStep(helping, { e: "gone", now: 200 }, A).s.k, "idle");
  const won = coopStep(helping, recv({ t: "result", round: "r1", from: B, ok: true, q: 1 }, 300), A).s;
  assert.equal(coopStep(won, { e: "gone", now: 400 }, A).s, won, "건진 뒤 상대가 떠나도 보너스는 그대로");
  assert.equal(coopStep(won, recv({ t: "cancel", round: "r1", from: B, why: "gone" }, 400), A).s, won, "늦은 cancel 도 결과를 지우지 않는다");
  // B: A 가 놓쳐 판을 접으면 B 의 창도 접힌다
  const bHelping = run(COOP_IDLE, B, [recv({ t: "ask", round: "r1", from: A }, 0), { e: "accept", now: 100 }]).s;
  const lost = coopStep(bHelping, recv({ t: "cancel", round: "r1", from: A, why: "lost" }, 500), B);
  assert.equal(lost.s.k, "idle");
  assert.equal(lost.note, "partnerDone");
  assert.equal(coopStep(bHelping, { e: "gone", now: 500 }, B).note, "partnerLeft");
});

test("단일 작성자 — 보너스(저장에 쓰이는 값)는 낚는 사람에게만, 도와준 쪽 화면 · 훅 · 소켓은 저장을 부르지 않는다", () => {
  const helperWon = run(COOP_IDLE, B, [recv({ t: "ask", round: "r1", from: A }, 0), { e: "accept", now: 10 }, { e: "finish", ok: true, q: 1, now: 3_000 }]).s;
  assert.ok(helperWon.k === "result" && helperWon.ok);
  assert.equal(coopBonus(helperWon, "r1"), false, "B 의 결과 상태로는 보너스가 없다");
  for (const f of ["src/components/FishCoopHelp.tsx", "src/lib/usefishcoop.ts", "src/lib/couplebroadcast.ts", "src/lib/fishcoop.ts"]) {
    const s = code(f);
    assert.doesNotMatch(s, /saveIsland|loadIsland|island_action|islandAction|\bact\(|submitFishCatch|tryStore|sellCatch/, `${f} 이 섬 · 순위 저장을 부른다(이중 저장)`);
  }
  const g = code("src/components/FishingGame.tsx");
  // 보너스는 담기 판정의 확률에만 — 피버 · 주인은 1 그대로
  assert.match(g, /const coopHelpedNow = coopBonus\(coop\.coop, coopRound\) \|\| coopHelped;/, "저장 실패 뒤 다시 눌러도 이 판의 보너스가 남는다");
  assert.match(g, /const soloChance = fish \? \(feverWon \|\| fish\.boss \? 1 : captureChance\(/);
  assert.match(g, /const chance = fish \? coopChance\(soloChance, coopHelpedNow\) : 0;/);
  // 누르는 순간의 확률로 판정하고 그때 접는다(늦게 온 결과가 끼어들지 않게)
  const store = g.slice(g.indexOf("async function store("), g.indexOf("async function sell("));
  assert.ok(store.indexOf("p = chance") < store.indexOf('coop.close("done")'), "담기 확률을 잡은 뒤 협동을 접는다");
  // 도와주는 중엔 내 낚시터 누르기가 던지기가 아니다
  assert.match(g, /if \(coopHelping\) return;/);
});

test("보너스 계산 — +15%p, 95% 상한, 이미 1 인 확률은 그대로", () => {
  assert.equal(coopChance(0.5, true), 0.65);
  assert.equal(coopChance(0.8, true), 0.95);
  assert.equal(coopChance(0.9, true), 0.95);
  assert.equal(coopChance(0.95, true), 0.95);
  assert.equal(coopChance(1, true), 1, "피버 · 주인(1)을 95% 로 낮추지 않는다");
  assert.equal(coopChance(0.05, true), 0.2);
  assert.equal(coopChance(0.37, false), 0.37);
  for (let p = 0.05; p <= 0.95; p += 0.01) {
    const c = coopChance(p, true);
    assert.ok(c >= p && c <= 0.95 + 1e-9, `${p} → ${c}`);
    assert.equal(Math.round(c * 100), c * 100 > 0 ? Math.round(c * 100) : 0, "백분율 두 자리");
  }
});

test("부를 때 — 커플 · 상대 받을 수 있음 · 찌 · 루어 · 심해 끝자락 · 주인전 아님 · 한 판 한 번", () => {
  const base = { linked: true, partnerReady: true, method: "float", boss: false, dist: 0.2, coop: COOP_IDLE, asked: false };
  assert.equal(wantHelp(base), true);
  assert.equal(wantHelp({ ...base, method: "lure" }), true);
  assert.equal(wantHelp({ ...base, method: "deep" }), true);
  assert.equal(wantHelp({ ...base, method: "scoop" }), false, "뜰채 방식은 이미 뜰채를 들고 있다");
  assert.equal(wantHelp({ ...base, boss: true }), false, "주인전은 협공 규칙이 따로 있다");
  assert.equal(wantHelp({ ...base, dist: COOP_ASK_DIST }), false);
  assert.equal(wantHelp({ ...base, dist: 0 }), false, "다 끌어온 뒤엔 늦다");
  assert.equal(wantHelp({ ...base, asked: true }), false);
  assert.equal(wantHelp({ ...base, linked: false }), false, "혼자면 아무 일도 없다");
  assert.equal(wantHelp({ ...base, partnerReady: false }), false, "상대가 다른 탭 · 자기 판 중이면 안 부른다");
  assert.equal(wantHelp({ ...base, coop: { k: "askSent", round: "x", at: 0 } }), false);
});

test("상대 찾기 — 나는 빼고, 낚시 화면이 보이는 사람만", () => {
  assert.deepEqual(partnerOf([], A), { present: false, ready: false });
  assert.deepEqual(partnerOf([{ who: A, visible: true, ready: true }], A), { present: false, ready: false }, "내 다른 탭은 상대가 아니다");
  assert.deepEqual(partnerOf([{ who: B, visible: false, ready: true }], A), { present: false, ready: false }, "숨은 탭은 낚시 중이 아니다");
  assert.deepEqual(partnerOf([{ who: B, visible: true, ready: false }], A), { present: true, ready: false });
  assert.deepEqual(partnerOf([{ who: B, visible: true, ready: false }, { who: B, visible: true, ready: true }], A), { present: true, ready: true });
  assert.deepEqual(partnerOf([null, 3, { who: 5 }], A), { present: false, ready: false });
});

test("짧은 들어올리기 — 3~5초, 버티면 대개 건지고 누르고만 있으면 못 건진다(사람 흉내 봇)", () => {
  const DT = 1 / 30;
  const play = (seed: number, mode: "human" | "slow" | "still" | "nohold"): Lift => {
    const tune = coopLiftTune();
    let l = startCoopLift(seed);
    const seen: Lift[] = [];
    let c = 0;
    while (l.status === "on") {
      seen.push(l);
      const x = seen[Math.max(0, seen.length - 1 - (mode === "slow" ? 10 : 7))];
      const want = mode === "human" || mode === "slow" ? -(x.tilt * 1.5 + x.vel * 0.35) - (x.warnLeft > 0 ? x.side * 0.45 : 0) : 0;
      c += (Math.max(-1, Math.min(1, want)) - c) * Math.min(1, DT * 9);
      l = stepCoopLift(l, DT, mode !== "nohold", c, tune);
    }
    return l;
  };
  const rate = (mode: "human" | "slow" | "still" | "nohold") => {
    let ok = 0, tMax = 0, tMin = Infinity;
    for (let i = 0; i < 200; i++) {
      const l = play(i * 7 + 1, mode);
      tMax = Math.max(tMax, l.t);
      if (l.status === "landed") {
        ok++;
        tMin = Math.min(tMin, l.t);
      }
    }
    return { ok: ok / 200, tMax, tMin };
  };
  const human = rate("human"), slow = rate("slow");
  assert.ok(human.ok >= 0.7 && human.ok <= 0.95, `사람 흉내 ${human.ok}`);
  assert.ok(slow.ok >= 0.5, `늦게 보는 사람 ${slow.ok}`);
  assert.ok(human.tMin >= 2.5, `너무 빨리 끝난다 ${human.tMin}초`);
  assert.ok(human.tMax * 1000 <= COOP_GAME_MS + 40, "판 상한(5초)을 넘지 않는다");
  assert.equal(rate("still").ok, 0, "누르고만 있으면 못 건진다");
  assert.equal(rate("nohold").ok, 0);
  const q = coopLiftQuality({ good: 2, t: 4 });
  assert.equal(q, 0.5);
});

test("실시간 — DB 변경 구독을 늘리지 않고, 공유 이름 채널 하나 · 앱 복귀 재연결에 함께 다시 짓는다", () => {
  const bc = code("src/lib/couplebroadcast.ts");
  assert.doesNotMatch(raw("src/lib/couplebroadcast.ts"), /postgres_changes/, "DB 변경 구독은 couple.ts 의 muxOn 으로만");
  assert.equal((bc.match(/\.channel\(/g) ?? []).length, 1, "채널을 만드는 곳은 한 곳");
  assert.doesNotMatch(bc, /_chanName\(|_chanSeq/, "두 폰이 같은 이름을 써야 한다 — 번호를 붙이면 서로 못 본다");
  assert.match(bc, /export const broadcastTopic = \(topic: string, coupleId: string\) => `\$\{topic\}:\$\{coupleId\}`/);
  assert.match(bc, /broadcast: \{ self: false/);
  assert.match(bc, /presence: \{ key: e\.me \}/);
  // 같은 이름 객체 재사용 크래시 클래스 — 참조 수 · 제거를 기다린 뒤 짓기
  assert.match(bc, /void e\.closing\.then\(/);
  assert.match(bc, /RELEASE_MS/);
  assert.match(bc, /onRealtimeRevive\(/);
  // 재조인마다 presence 를 다시 싣는다
  assert.match(bc, /status === "SUBSCRIBED"[\s\S]{0,200}ch\.track\(e\.meta\)/);

  const couple = code("src/lib/couple.ts");
  assert.equal((raw("src/lib/couple.ts").match(/"postgres_changes"/g) ?? []).length, 1, "couple.ts 의 DB 변경 구독은 그대로 하나");
  const revive = couple.slice(couple.indexOf("export function reviveRealtime("), couple.indexOf("let _wakeBound"));
  assert.match(revive, /_mux\.size === 0 && _reviveHooks\.size === 0/, "다중화 구독이 없어도 바깥 채널은 되살린다");
  assert.match(revive, /for \(const fn of \[\.\.\._reviveHooks\]\)/);
  assert.match(couple, /export function onRealtimeRevive\([\s\S]{0,80}_bindWake\(\);/);

  for (const f of ["src/components/FishingGame.tsx", "src/components/FishCoopHelp.tsx", "src/lib/usefishcoop.ts"]) {
    assert.doesNotMatch(code(f), /\.channel\(|postgres_changes|getSupabase/, `${f} 이 채널을 직접 연다`);
  }
  const hook = code("src/lib/usefishcoop.ts");
  assert.match(hook, /export const COOP_TOPIC = "fish-coop";/);
  assert.match(hook, /if \(!fake && \(!coupleId \|\| me === "me"\)\) return;/, "혼자 섬 · 로컬 모드는 채널을 열지 않는다");
});

test("개발용 가짜 상대는 배포 빌드에서 빠진다", () => {
  const hook = code("src/lib/usefishcoop.ts");
  const fn = hook.slice(hook.indexOf("function fakeMode("), hook.indexOf("function fakeLink("));
  assert.match(fn, /process\.env\.NODE_ENV === "production"[^\n]*return null;/);
  assert.match(hook, /const link = fake \? fakeLink\(listener, fake\) : coupleBroadcast/);
  // 사용법이 파일 머리에 적혀 있다(README 는 이 갈래에서 고치지 않는다)
  assert.match(raw("src/lib/usefishcoop.ts"), /window\.__fishFakePartner = true/);
  assert.match(raw("src/lib/usefishcoop.ts"), /window\.__fishFakeAsk\(\)/);
});
