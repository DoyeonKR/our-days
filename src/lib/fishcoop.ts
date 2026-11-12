/* 함께 끌어올리기 (2026-11-12) [사용자: "둘이 동시에 접속해 있을 때 한 명은 낚싯대, 한 명은 뜰채로 같이 끌어올립니다. 실시간 연결이 필요합니다"]
 * 낚는 사람(angler, A)이 힘겨루기 끝자락(남은 거리 30% 아래)에 오면 낚시 화면에 같이 있는 상대(helper, B)에게 "도와줘!"를 보낸다.
 * B 가 6초 안에 받으면 짧은 뜰채 들어올리기(stepLift 를 짧게 줄인 판, 최대 5초)를 하고 결과를 돌려준다. 건지면 A 의 수조 담기 확률이 +15%p(최대 95%).
 *
 * 여기는 규칙만 있는 순수 모듈이다 — 소켓(couplebroadcast.ts) · 화면(usefishcoop · FishCoopHelp)은 이 리듀서에 사건을 넣고 나온 메시지를 보낼 뿐이다.
 * 그래야 시간 초과 · 묵은 판 번호 · 상대가 끊김 같은 갈래를 폰 두 대 없이 테스트로 잠글 수 있다(fishcoop.test).
 *
 * 규칙
 *  · 저장은 A 한 사람만 한다(단일 작성자). 섬 상태는 커플이 같은 행을 쓰므로 B 도 저장하면 버전 충돌 · 이중 보상이 난다.
 *    B 의 결과는 메시지로만 가고, 보너스는 A 의 담기 판정(captureChance)에만 얹힌다. coopBonus 는 angler 역할에서만 참이다.
 *  · 메시지마다 판 번호(round)가 있다 — 지난 판의 늦은 응답이 이번 판에 보너스를 주지 않게 같은 번호만 받는다.
 *  · 시간은 기기 시계(Date.now)로 넣는다. 게임 시계(gameNow)는 저장 응답마다 다시 맞춰져 한 판 도중에 뛸 수 있다.
 *  · 상대가 사라지면(presence 이탈 · 숨김) 기다리던 쪽은 바로 혼자 하던 대로 돌아간다. 이미 받은 결과는 그대로 둔다.
 * fishingmodes.ts 와 같은 이유로 상대 경로 .ts 만 import 한다(node --test 가 바로 돌린다). */
import { liftTune, stepLift, startLift, liftQuality, type Lift, type LiftTune } from "./fishingmodes.ts";

/** 남은 거리가 이 밑으로 내려오면 도움을 부른다 — 너무 일찍 부르면 B 가 받기 전에 A 가 혼자 끌어올린다 */
export const COOP_ASK_DIST = 0.3;
/** B 가 받기까지 기다리는 시간 */
export const COOP_ACCEPT_MS = 6_000;
/** B 의 들어올리기 판 상한 — 그 안에 못 올리면 실패 */
export const COOP_GAME_MS = 5_000;
/** 메시지가 오가는 데 드는 여유(브로드캐스트는 보통 수백 ms, 폰이 느리면 1초 넘게) */
export const COOP_SLACK_MS = 1_500;
/** B 가 결과("건졌어요")를 보는 시간 — 그 뒤 원래 화면으로 */
export const COOP_RESULT_SHOW_MS = 2_200;
/** 도와준 보너스 · 상한. 상한은 captureChance 의 상한(95%)과 같다 — 함께 해도 '반드시'가 되지는 않는다 */
export const COOP_BONUS = 0.15;
export const COOP_CAP = 0.95;

export type CoopRole = "angler" | "helper";
export type CancelWhy = "lost" | "done" | "timeout" | "decline" | "gone";
export type CoopMsg =
  | { t: "ask"; round: string; from: string }
  | { t: "accept"; round: string; from: string }
  | { t: "result"; round: string; from: string; ok: boolean; q: number }
  | { t: "cancel"; round: string; from: string; why: CancelWhy };

export type Coop =
  | { k: "idle" }
  /** A: 부탁을 보냈다 — B 의 accept 를 기다린다 */
  | { k: "askSent"; round: string; at: number }
  /** B: 부탁을 받았다 — 받을지 묻는 창 */
  | { k: "prompt"; round: string; at: number; from: string }
  /** A: B 가 받았다(결과 대기) · B: 들어올리는 중 */
  | { k: "helping"; round: string; at: number; role: CoopRole }
  /** A: 결과를 받았다(판이 끝날 때까지 남는다) · B: 결과를 보냈다(잠깐 보여 주고 idle) */
  | { k: "result"; round: string; at: number; role: CoopRole; ok: boolean; q: number };

export type CoopEvent =
  | { e: "ask"; round: string; now: number }
  /** canPrompt — 지금 이 화면이 부탁을 받을 수 있나(보이고 · 낚시터 탭 · 판을 돌리지 않는 중) */
  | { e: "recv"; msg: CoopMsg; now: number; canPrompt: boolean }
  | { e: "accept"; now: number }
  | { e: "decline"; now: number }
  | { e: "finish"; ok: boolean; q: number; now: number }
  | { e: "tick"; now: number }
  | { e: "gone"; now: number }
  | { e: "close"; why: CancelWhy; now: number };

export type CoopNote = "accepted" | "helped" | "missed" | "fallback" | "partnerLeft" | "partnerDone" | null;
export type CoopStep = { s: Coop; out: CoopMsg | null; note: CoopNote };

export const COOP_IDLE: Coop = { k: "idle" };
const same = (s: Coop, out: CoopMsg | null = null, note: CoopNote = null): CoopStep => ({ s, out, note });
const roundOf = (s: Coop) => (s.k === "idle" ? null : s.round);

/** A 가 기다리는 최대 시간 — accept 전에는 받기 시간 + 여유, 받은 뒤에는 판 상한 + 여유 */
export const anglerWaitMs = (k: "askSent" | "helping") => (k === "askSent" ? COOP_ACCEPT_MS + COOP_SLACK_MS : COOP_GAME_MS + COOP_SLACK_MS);

/** 프로토콜 한 걸음 — 순수. me 는 이 기기 사람(자기 메시지 메아리는 버린다). */
export function coopStep(s: Coop, ev: CoopEvent, me: string): CoopStep {
  switch (ev.e) {
    case "ask":
      // 이미 무언가 진행 중이면 새 부탁을 하지 않는다 — 한 판에 한 번(호출자가 판마다 round 를 새로 만든다)
      if (s.k !== "idle") return same(s);
      return same({ k: "askSent", round: ev.round, at: ev.now }, { t: "ask", round: ev.round, from: me });

    case "recv": {
      const m = ev.msg;
      if (!m || typeof m !== "object" || m.from === me || typeof m.round !== "string") return same(s);
      if (m.t === "ask") {
        // 쉬는 중일 때만 — B 가 자기 판을 돌리는 중 · 다른 탭이면 묻지 않는다(A 는 시간 초과로 혼자 간다).
        // 지난 결과를 보여 주는 중(helper result)이면 새 부탁으로 바로 넘어간다
        const free = s.k === "idle" || (s.k === "result" && s.role === "helper");
        if (!free || !ev.canPrompt) return same(s);
        return same({ k: "prompt", round: m.round, at: ev.now, from: m.from });
      }
      if (m.round !== roundOf(s)) return same(s); // 묵은 판 번호 — 지난 판의 늦은 응답은 버린다
      if (m.t === "accept") {
        if (s.k !== "askSent") return same(s);
        return same({ k: "helping", round: s.round, at: ev.now, role: "angler" }, null, "accepted");
      }
      if (m.t === "result") {
        // accept 가 유실되고 result 만 와도 받는다(같은 번호면 그 판의 결과다)
        if (!((s.k === "helping" && s.role === "angler") || s.k === "askSent")) return same(s);
        const q = Number.isFinite(m.q) ? Math.max(0, Math.min(1, m.q)) : 0;
        return same({ k: "result", round: s.round, at: ev.now, role: "angler", ok: m.ok === true, q }, null, m.ok === true ? "helped" : "missed");
      }
      if (m.t === "cancel") {
        // A 의 결과는 이미 얻은 것이라 상대가 그만둬도(혹은 늦은 cancel 이 와도) 지우지 않는다
        if (s.k === "result" && s.role === "angler") return same(s);
        if (s.k === "result") return same(COOP_IDLE);
        return same(COOP_IDLE, null, s.k === "prompt" || (s.k === "helping" && s.role === "helper") ? "partnerDone" : "fallback");
      }
      return same(s);
    }

    case "accept":
      if (s.k !== "prompt") return same(s);
      return same({ k: "helping", round: s.round, at: ev.now, role: "helper" }, { t: "accept", round: s.round, from: me });

    case "decline":
      if (s.k !== "prompt") return same(s);
      return same(COOP_IDLE, { t: "cancel", round: s.round, from: me, why: "decline" });

    case "finish":
      if (s.k !== "helping" || s.role !== "helper") return same(s);
      return same({ k: "result", round: s.round, at: ev.now, role: "helper", ok: ev.ok, q: ev.q }, { t: "result", round: s.round, from: me, ok: ev.ok, q: ev.q });

    case "tick": {
      const age = ev.now - (s.k === "idle" ? ev.now : s.at);
      if (s.k === "askSent" && age >= anglerWaitMs("askSent")) return same(COOP_IDLE, { t: "cancel", round: s.round, from: me, why: "timeout" }, "fallback");
      if (s.k === "helping" && s.role === "angler" && age >= anglerWaitMs("helping")) return same(COOP_IDLE, { t: "cancel", round: s.round, from: me, why: "timeout" }, "fallback");
      if (s.k === "prompt" && age >= COOP_ACCEPT_MS) return same(COOP_IDLE, { t: "cancel", round: s.round, from: me, why: "timeout" });
      // B 의 판은 화면이 COOP_GAME_MS 에 끝낸다 — 화면이 멈췄을 때(탭 숨김 등)의 안전망
      if (s.k === "helping" && s.role === "helper" && age >= COOP_GAME_MS + 500) return same({ k: "result", round: s.round, at: ev.now, role: "helper", ok: false, q: 0 }, { t: "result", round: s.round, from: me, ok: false, q: 0 });
      if (s.k === "result" && s.role === "helper" && age >= COOP_RESULT_SHOW_MS) return same(COOP_IDLE);
      return same(s);
    }

    case "gone":
      // 상대가 낚시 화면을 떠났다 · 끊겼다 — 기다리던 쪽은 바로 혼자 하던 대로. 받은 결과는 남긴다
      if (s.k === "askSent" || (s.k === "helping" && s.role === "angler")) return same(COOP_IDLE, null, "fallback");
      if (s.k === "prompt" || (s.k === "helping" && s.role === "helper")) return same(COOP_IDLE, null, "partnerLeft");
      return same(s);

    case "close":
      // 이 기기에서 판이 끝났다(놓침 · 담기/팔기 · 화면 닫기) — 진행 중이던 상대에게 알리고 접는다
      if (s.k === "idle") return same(s);
      if (s.k === "result" && s.role === "helper") return same(COOP_IDLE);
      return same(COOP_IDLE, { t: "cancel", round: s.round, from: me, why: ev.why });
  }
}

/** 이 판(round)에 도움을 받아 건졌나 — angler 역할만 참이다(단일 작성자: 보너스로 저장하는 건 A 뿐) */
export function coopBonus(s: Coop, round: string | null): boolean {
  return !!round && s.k === "result" && s.role === "angler" && s.ok && s.round === round;
}

/** 도움을 받은 담기 확률 — +15%p, 95% 상한. 피버 · 주인처럼 이미 1 인 확률은 낮추지 않는다 */
export function coopChance(p: number, helped: boolean): number {
  if (!helped) return p;
  return Math.max(p, Math.round(Math.min(COOP_CAP, p + COOP_BONUS) * 100) / 100);
}

/** 이 판에 도움을 부를까 — 커플 · 상대가 받을 수 있음 · 찌/루어/심해 힘겨루기(뜰채 방식은 이미 뜰채다) · 주인전 아님 · 끝자락 · 이 판에 아직 안 불렀음.
 *  꽝 · 특별한 것도 거르지 않는다 — 걸러 내면 "도와줘!"가 안 뜨는 것만으로 공개 전에 정체가 드러난다(보너스는 담기 판정이 없어 저절로 무효). */
export function wantHelp(o: { linked: boolean; partnerReady: boolean; method: string; boss: boolean; dist: number; coop: Coop; asked: boolean }): boolean {
  return o.linked && o.partnerReady && o.method !== "scoop" && !o.boss && !o.asked && o.coop.k === "idle" && o.dist > 0 && o.dist < COOP_ASK_DIST;
}

/** presence 에 싣는 값 — visible: 낚시 화면이 실제로 보인다 · ready: 부탁을 받을 수 있다(판을 돌리지 않는 중) */
export type CoopPeer = { who: string; visible: boolean; ready: boolean };
/** 상대 상태 — 이 기기 사람(me)이 아닌 다른 사람 중 하나라도 보이면 '상대도 낚시 중' */
export function partnerOf(peers: readonly unknown[], me: string): { present: boolean; ready: boolean } {
  let present = false, ready = false;
  for (const p of peers) {
    if (!p || typeof p !== "object") continue;
    const x = p as Partial<CoopPeer>;
    if (typeof x.who !== "string" || x.who === me || x.visible !== true) continue;
    present = true;
    if (x.ready === true) ready = true;
  }
  return { present, ready };
}

/** 판 번호 — 기기마다 다르게(같은 밀리초에 둘이 불러도 겹치지 않게 사람 id 를 붙인다) */
export function coopRoundId(me: string, now: number, rand: number): string {
  return `${me.slice(0, 8)}-${now.toString(36)}-${Math.floor(rand * 2 ** 31).toString(36)}`;
}

/* ── B 의 짧은 들어올리기 ─────────────────────────────── */

/** 뜰채 2막(stepLift)을 짧게 — 원래 판은 잘해도 7~9초라 부탁받은 사람이 끼어들기엔 길다(fishingscoop.test).
 *  오르는 속도를 1.6배로 올려 잘하면 3.5초 안팎에 끝나게 하고, 대신 몸부림을 세고 잦게 — 누르고만 있으면 못 올린다(봇: 사람 흉내 약 80% · 늦게 보는 사람 약 65% · 버티지 않음 0%).
 *  능력치는 보지 않는다(B 의 장비가 A 의 판에 섞이지 않게). */
export function coopLiftTune(): LiftTune {
  const base = liftTune(1, { power: 0, line: 0 });
  return { ...base, rise: 0.34, kick: base.kick * 1.35, kickEvery: base.kickEvery * 0.75 };
}
export function startCoopLift(seed: number): Lift {
  return startLift(seed, coopLiftTune());
}
/** 한 칸 — 판 상한(COOP_GAME_MS)이 지나면 놓친 것으로 */
export function stepCoopLift(l: Lift, dt: number, hold: boolean, counter: number, tune: LiftTune = coopLiftTune()): Lift {
  const n = stepLift(l, dt, hold, counter, tune);
  if (n.status === "on" && n.t * 1000 >= COOP_GAME_MS) return { ...n, status: "dropped" };
  return n;
}
export const coopLiftQuality = liftQuality;
