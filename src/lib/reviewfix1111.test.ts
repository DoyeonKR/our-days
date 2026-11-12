// 11-11 배포 뒤 리뷰 lock (2026-11-11 2차) — §10.24 변경이 새로 만든 구멍 아홉 개.
//   1. 되살린 섬 초안 — 일부만 보낸 시도가 늦게 들어가면 초안 전체가 소리 없이 사라졌다
//   2. 되살린 '새 일정' 초안 — 이미 있는 id 로 다른 일정을 쓰면 첫 일정을 덮었다
//   3. 기기에 남긴 시계 어긋남 — 이번 실행에서 재기 전에 썼다(시계를 고친 뒤 출석 두 번 · 퀘스트 초기화 · 스트릭 끊김)
//   4. 레이드 결과 창 — 저장이 끝나지 않거나 거절되면 닫히지 않았다
//   5. 마지막으로 알던 커플 id — 다른 계정이 이어 썼다
//   6. 로그아웃 정리 — 섬 초안 · 시계 어긋남이 남았다
//   7. 홈 펫 · 게임 탭 섬 요약 — 기기 시계라 섬 화면과 달랐다
//   8. 퀘스트 넘김 — 빠른 폰이 내일로 넘긴 뒤 느린 폰이 오늘 퀘스트를 다시 만들었다(다시 받기)
//   9. 출석 스트릭 — 지난날로 가는 방문도 +1
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// ⚠ 네임스페이스 import — 고치기 전 코드(새 함수가 없다)에서도 파일이 열려 테스트마다 따로 실패한다
import * as I from "./island.ts";
import * as Y from "./islandsync.ts";
import * as L from "./couplelookup.ts";
import * as E from "./eventdraft.ts";
import type { CoupleEvent } from "./dday.ts";

const code = (p: string) =>
  readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\r\n/g,"\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const fnBody = (src: string, start: string, end: string) => {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `${start} 를 못 찾았다`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `${end} 를 못 찾았다`);
  return src.slice(a, b);
};

/** node 에는 localStorage 가 없다 — 테스트마다 새로 깐다 */
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}
function withStorage<T>(fn: (ls: Storage) => T): T {
  const g = globalThis as { localStorage?: Storage };
  const prev = g.localStorage;
  const ls = memStorage();
  g.localStorage = ls;
  try {
    return fn(ls);
  } finally {
    if (prev) g.localStorage = prev;
    else delete g.localStorage;
  }
}

const H = 3_600_000;

// ── 1 ────────────────────────────────────────────────────────────────────
test("1 되살린 섬 초안 — 초안 전부를 보낸 시도만 '이 초안'으로 친다 · 일부만 보낸 시도가 들어가면 안내", () => {
  const s = I.createIsland("p", null, Date.parse("2026-11-11T03:00:00Z"));
  const m1 = Y.newSaveMark(), m2 = Y.newSaveMark();
  // 닫힌 화면이 액션 3개를 담아 m1 을 보냈고, 그 뒤 2개를 더 해 초안에는 5개가 있다
  const p = { v: 7, state: s, attempts: [{ mark: m1, n: 3 }], ops: 5, at: 0 };
  const r = Y.restoredAttempts(p);
  assert.deepEqual(r.full, [], "일부만 보낸 시도를 되살린 초안 전체로 친다(들어가면 o4 · o5 가 소리 없이 사라진다)");
  assert.deepEqual(r.partial, [m1]);
  // 다시 연 뒤 m1 이 들어갔다 — 되살린 액션을 '들어간 것'으로 보고 빼면 안 된다
  const fresh = Y.withSaveMark({ ...s, coins: s.coins + 1 }, m1);
  const base = s;
  const restored = [(st: I.IslandState) => (st === base ? s : st)];
  assert.equal(Y.opsToReplay(fresh, r.full, restored).committed, 0, "되살린 초안이 '들어간 것'으로 지워진다");
  assert.equal(Y.partialLanded(fresh, r.partial), true, "일부만 들어간 걸 알아보지 못한다(안내 없이 지운다)");
  assert.equal(Y.partialLanded(s, r.partial), false);
  // 되살린 액션은 바탕이 같을 때만 놓인다 — 바뀐 최신 위에선 떨어지고(두 번 들어가지 않는다) 화면이 안내한다
  assert.equal(Y.replayOps(fresh, restored).dropped, 1);
  // 초안 전부를 보낸 시도는 예전처럼 한 액션(되살린 초안)으로 친다
  const all = Y.restoredAttempts({ ...p, attempts: [{ mark: m1, n: 3 }, { mark: m2, n: 5 }] });
  assert.deepEqual(all.full, [{ mark: m2, n: 1 }]);
  assert.deepEqual(all.partial, [m1]);
  assert.equal(Y.opsToReplay(Y.withSaveMark(s, m2), all.full, restored).ops.length, 0, "다 보낸 시도가 들어갔으면 다시 놓지 않는다");

  const g = code("components/IslandGame.tsx");
  assert.doesNotMatch(g, /p\.attempts\.map\(\(a\) => \(\{ mark: a\.mark, n: 1 \}\)\)/, "모든 시도를 n: 1 로 바꾸던 것이 남았다");
  assert.match(g, /const \{ full, partial \} = restoredAttempts\(p\);\s+attemptsRef\.current = full;\s+partialRef\.current = partial;/);
  const adopt = fnBody(g, "const adoptFresh = useCallback(", "const flush = useCallback(");
  assert.match(adopt, /partialLanded\(fresh\.state, partialRef\.current\)/, "일부만 들어간 경우를 안내하지 않는다");
});

// ── 2 ────────────────────────────────────────────────────────────────────
const ev = (over: Partial<CoupleEvent> = {}): CoupleEvent => ({ id: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b", title: "저녁", date: "2026-11-20", repeatYearly: false, recurrence: "none", emoji: "⭐", category: "plan", reminderOffsets: [0, 1, 3, 7], ...over });

test("2 되살린 '새 일정' 초안 — 이미 있는 id 면: 같은 내용은 저장된 것 · 다른 내용은 새 id", () => {
  const saved = ev();
  assert.equal(E.restoreNewEventDraft(ev(), []), "keep", "목록에 없으면 그 id 로 이어 저장(응답을 잃은 첫 저장과 한 줄)");
  assert.equal(E.restoreNewEventDraft(ev({ title: "저녁 " }), [saved]), "saved", "같은 내용(앞뒤 공백 무시)은 이미 저장된 것");
  assert.equal(E.restoreNewEventDraft(ev({ title: "영화" }), [saved]), "fresh", "다른 내용을 이미 있는 id 로 보내면 첫 일정을 덮는다");
  assert.equal(E.restoreNewEventDraft(ev({ id: "k3j9x2a" }), [saved]), "keep", "uuid 가 아닌 옛 id 는 서버가 새 id 를 준다");
});

test("2 새 일정 시트의 중복 id — 이 시트가 보낸 그 내용 그대로일 때만 덮는다(되살린 초안은 덮지 않는다)", () => {
  const landed = ev();
  assert.equal(E.dupKeyDecision(landed, ev(), []), "same", "같은 내용 재시도는 성공");
  assert.equal(E.dupKeyDecision(landed, ev({ title: "영화" }), []), "taken", "이 시트가 보낸 적 없는 id 를 덮는다");
  assert.equal(E.dupKeyDecision(landed, ev({ title: "영화" }), [ev()]), "update", "같은 시트에서 고쳐 다시 누른 것은 덮는다");
  assert.equal(E.dupKeyDecision(ev({ note: "상대 메모" }), ev({ title: "영화" }), [ev()]), "taken", "그사이 상대가 고친 행을 덮는다");

  const couple = code("lib/couple.ts");
  const add = fnBody(couple, "export async function addCoupleEvent(", "const EVENT_UPDATING");
  assert.match(add, /const decision = dupKeyDecision\(existing, sent, opts\.sent \?\? \[\]\);/);
  assert.match(add, /if \(decision === "taken"\) throw new EventIdTakenError\(existing\);/);
  const page = code("app/page.tsx");
  const save = fnBody(page, "async function saveEvent(", "async function skipOccurrence(");
  assert.match(save, /saved = isNew \? await addCoupleEvent\(coupleId, ev, \{ sent: opts\.sent \}\) : await updateCoupleEvent\(ev\);/, "새 시트가 목록에 있는 id 면 updated_at 없이 덮어쓴다");
  assert.doesNotMatch(save, /exists \? await updateCoupleEvent\(ev\)/);
  const sheet = fnBody(page, "function AddEvent(", "function Settings(");
  assert.match(sheet, /restoreNewEventDraft\(/, "되살린 초안의 id 를 목록과 견주지 않는다");
  assert.match(sheet, /reason instanceof EventIdTakenError/, "서버에 이미 있는 id 면 새 id 로 바꾸지 않는다");
  assert.match(page, /known=\{events\}/);
});

// ── 3 ────────────────────────────────────────────────────────────────────
test("3 기기에 남은 시계 어긋남은 이번 실행에서 재기 전엔 게임 시각에 쓰지 않는다 · 방문은 바로", () => {
  withStorage((ls) => {
    Y.resetServerClock();
    // 이틀 빠르던 폰이 −2일을 남겼고, 그 뒤 사용자가 시계를 고쳤다
    ls.setItem("ourdays.clockOffset.v1", String(-2 * I.DAY_MS));
    const t = Date.now();
    assert.ok(Math.abs(Y.gameNow() - t) < 5_000, `재기 전에 남긴 값을 썼다 (${Math.round((Y.gameNow() - t) / H)}시간 어긋남)`);
    assert.equal(Y.clockKnown(), false);
    // 이번 실행에서 재면 그 값을 쓴다
    const real = Date.now();
    Y.noteServerClock(new Date(real + 3 * H).toISOString(), real - 100, real + 100);
    assert.equal(Y.clockKnown(), true);
    assert.ok(Math.abs(Y.gameNow() - (Date.now() + 3 * H)) < 5_000);
    Y.resetServerClock();
  });
  const g = code("components/IslandGame.tsx");
  // 방문 처리는 재기를 기다리지 않는다(재는 길은 저장 응답뿐 — 방문이 첫 저장이다)
  const visit = fnBody(g, "if (!myUserId) return;\n    const t = gameNow();", "}, [row, myUserId, now]);");
  assert.doesNotMatch(visit, /clockKnown/, "방문이 시계 재기를 기다리면 아무것도 안 하는 날엔 출석이 안 들어간다");
});

// ── 4 ────────────────────────────────────────────────────────────────────
test("4 레이드 — 결과 창 닫기는 시간 제한 · 거절에도 풀린다 · 여는 저장이 거절돼도 잠기지 않는다 [소스 스캔]", () => {
  const game = code("components/FishingGame.tsx");
  const close = fnBody(game, "function closeRaid(", "function clearRound(");
  assert.match(close, /withTimeout\(raidSave\.current \?\? Promise\.resolve\(null\), RAID_CLOSE_TIMEOUT_MS/, "끝나지 않는 저장을 끝없이 기다린다");
  assert.match(close, /\.finally\(\(\) => \{\s+raidClosing\.current = false;/, "거절되면 닫기 잠금이 풀리지 않는다");
  assert.match(close, /upload-timeout[\s\S]*저장 중이에요/, "시간 초과에 '저장 중' 안내가 없다");
  const open = fnBody(game, "function openRaid(", "function endRaid(");
  assert.match(open, /\.finally\(\(\) => \{\s+raidOpening\.current = false;/, "여는 저장이 거절되면 낚시터가 영영 잠긴다");
});

// ── 5 ────────────────────────────────────────────────────────────────────
test("5 마지막으로 알던 커플 id — 남긴 계정일 때만 쓴다", () => {
  withStorage((ls) => {
    L.rememberCouple({ id: "c1", invite_code: "AB12" }, "u1");
    assert.equal(L.lastKnownCoupleId("u1"), "c1");
    assert.equal(L.lastKnownCoupleId("u2"), null, "다른 계정이 옛 공간으로 이어 간다");
    assert.equal(L.lastKnownCoupleId(null), null);
    // 11-11 배포가 남긴 옛 기록(uid 없음)은 누구 것인지 모른다
    ls.setItem(L.LS_COUPLE, JSON.stringify({ id: "c0", code: "ZZ99" }));
    assert.equal(L.lastKnownCoupleId("u1"), null);
    // '다시 연결' 코드는 세션이 새로 발급되면(uid 가 바뀐다) 쓰는 것이라 계정으로 가르지 않는다
    assert.equal(L.lastKnownCoupleCode(), "ZZ99");
  });
  const page = code("app/page.tsx");
  assert.match(page, /const known = lastKnownCoupleId\(myUserId\);/);
  const sync = code("components/CoupleSync.tsx");
  assert.doesNotMatch(sync, /saveCoupleLocal\((c|st\.couple|next)\);/, "uid 없이 기억한다");
});

// ── 6 ────────────────────────────────────────────────────────────────────
test("6 로그아웃 — 섬 초안(접두사) · 시계 어긋남도 지운다 [소스 스캔]", () => {
  const auth = code("lib/auth.ts");
  assert.match(auth, /k\.startsWith\("ourdays:island:pending:"\)/, "다음 계정이 이전 사람의 섬 초안을 보낸다");
  assert.match(auth, /localStorage\.removeItem\("ourdays\.clockOffset\.v1"\)/);
  assert.match(code("components/IslandGame.tsx"), /`ourdays:island:pending:\$\{coupleId\}:\$\{myUserId\}`/, "초안 키가 바뀌면 로그아웃 정리도 같이");
});

// ── 7 ────────────────────────────────────────────────────────────────────
test("7 홈 펫 · 게임 탭의 섬 요약도 섬 화면과 같은 시각(gameNow) [소스 스캔]", () => {
  for (const f of ["components/island/HomePet.tsx", "components/GameArcade.tsx"]) {
    const src = code(f);
    assert.doesNotMatch(src, /Date\.now\(\)/, `${f} 가 기기 시계로 섬을 본다(홈은 '수확 N칸', 섬은 아직)`);
    assert.match(src, /import \{[^}]*\bgameNow\b[^}]*\} from "@\/lib\/islandsync";/);
  }
});

// ── 8 ────────────────────────────────────────────────────────────────────
test("8 퀘스트 — 빠른 폰이 내일로 넘긴 뒤 느린 폰의 행동이 오늘 퀘스트를 다시 만들지 않는다(다시 받기 막힘)", () => {
  const midnight = Date.parse("2026-11-11T15:00:00Z"); // 11-12 00:00 KST
  let s = { ...I.claimVisit(I.createIsland("p", null, midnight - 30 * H), "a", midnight - 30 * H, null), coins: 1e6 };
  // 빠른 폰(3초 앞섬)이 내일로 넘어가 퀘스트를 받았다
  s = I.claimVisit(s, "a", midnight + 2_000, null);
  const tomorrow = I.kstDate(midnight + 2_000);
  assert.equal(s.quest.date, tomorrow);
  s = { ...s, quest: { ...s.quest, list: s.quest.list.map((q, i) => (i === 0 ? { ...q, prog: q.goal, claimed: true } : q)) } };
  const claimedId = s.quest.list[0].id;
  // 느린 폰(아직 23:59:58)이 물을 준다 — 예전엔 오늘 퀘스트를 새로 만들어(진행 0 · 안 받음) 같은 퀘스트를 또 받을 수 있었다
  const slow = midnight - 2_000;
  const p = I.plant(s, 0, I.CROPS[0].key, slow);
  const w = I.waterPlot(p, 0, slow);
  assert.equal(w.quest.date, tomorrow, "지난날로 퀘스트를 다시 만든다");
  assert.equal(w.quest.list.find((q) => q.id === claimedId)?.claimed, true, "받은 표시가 지워졌다");
  assert.equal(I.claimQuest(w, claimedId, slow), w, "같은 퀘스트를 또 받는다");
  // 하루를 넘게 앞선 날은 시계가 틀린 폰이 남긴 것 — 오늘로 고쳐 달되 진행 · 받은 표시는 그대로(다시 만들지 않는다)
  const far = { ...s, quest: { ...s.quest, date: I.kstDate(midnight + 2 * I.DAY_MS) } };
  const fixed = I.claimVisit(far, "b", midnight + 6 * H, null);
  assert.equal(fixed.quest.date, tomorrow);
  assert.equal(fixed.quest.list.find((q) => q.id === claimedId)?.claimed, true);
  // 평범한 넘김(어제 → 오늘)은 그대로 새 퀘스트
  const next = I.claimVisit(s, "a", midnight + I.DAY_MS + H, null);
  assert.equal(next.quest.date, I.kstDate(midnight + I.DAY_MS + H));
  assert.ok(next.quest.list.every((q) => !q.claimed && q.prog === 0));
});

// ── 9 ────────────────────────────────────────────────────────────────────
test("9 출석 · 스트릭 — 지난날로 가는 방문은 세지 않는다(하루를 넘게 앞선 기록은 오늘로 고치기만)", () => {
  const t = Date.parse("2026-11-11T03:00:00Z"); // 11-11 12:00 KST
  const today = I.kstDate(t), tomorrow = I.kstDate(t + I.DAY_MS), yesterday = I.kstDate(t - I.DAY_MS);
  const base = { ...I.createIsland("p", null, t - 10 * I.DAY_MS), coins: 1000 };
  // 빠른 폰이 내일로 출석을 남긴 뒤 느린 폰이 오늘로 온다 — 예전엔 음수 간격이 유예를 통과해 +1 · 보상
  const ahead = { ...base, daily: { a: tomorrow }, streak: { count: 5, lastDay: tomorrow, rewardIdx: 0 } };
  const v = I.claimVisit(ahead, "a", t, null);
  assert.equal(v.streak.count, 5, "지난날 방문이 스트릭을 +1 한다");
  assert.equal(v.streak.lastDay, tomorrow, "스트릭 날을 뒤로 돌린다");
  assert.equal(v.daily.a, tomorrow);
  assert.equal(v.coins, ahead.coins, "같은 날 출석 보상을 또 준다");
  // 다른 사람의 오늘 출석 — 보상은 받지만 공유 스트릭은 뒤로 가지 않는다
  const b = I.claimVisit(ahead, "b", t, null);
  assert.equal(b.streak.count, 5);
  assert.equal(b.streak.lastDay, tomorrow);
  assert.equal(b.daily.b, today);
  // 이틀 넘게 앞선 기록(시계가 틀린 폰) — 오늘로 고치되 보상 · +1 은 없다(그날 몫은 이미 받았다)
  const bogus = { ...base, daily: { a: I.kstDate(t + 2 * I.DAY_MS) }, streak: { count: 5, lastDay: I.kstDate(t + 2 * I.DAY_MS), rewardIdx: 0 } };
  const r = I.claimVisit(bogus, "a", t, null);
  assert.equal(r.daily.a, today);
  assert.equal(r.streak.lastDay, today);
  assert.equal(r.streak.count, 5);
  assert.equal(r.coins, bogus.coins);
  // 평범한 다음 날 — 그대로 +1
  const fwd = I.claimVisit({ ...base, daily: { a: yesterday }, streak: { count: 5, lastDay: yesterday, rewardIdx: 0 } }, "a", t, null);
  assert.equal(fwd.streak.count, 6);
  assert.equal(fwd.streak.lastDay, today);
  assert.ok(fwd.coins > base.coins);
});
