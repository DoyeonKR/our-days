/* 섬 저장 파이프라인의 순수 조각 — 충돌 · 네트워크 판별, 액션 다시 놓기, '자리 비운 사이' 소식. (2026-11-06 게임 리뷰)
 * ⚠ 섬 엔진은 타입만 — 이 파일은 화면(IslandGame)이 부르고 islandsync.test 가 바로 돌린다. */

import type { IslandState } from "./island.ts";

/** 저장 실패의 종류.
 *  · conflict — 버전 충돌(island_action 의 PT409 'stale'). 최신을 받아 쌓인 액션을 그 위에 다시 놓는다.
 *  · network — 연결이 끊겼다 · 서버가 잠깐 못 받았다. 초안을 지키고 조금 뒤 다시 보낸다(예전엔 이것도 충돌로 보고 초안을 버렸다).
 *  · other — 그 밖(권한 · 섬 없음 · 받을 수 없는 상태). 다시 보내도 안 풀린다.
 *  2026-11-11 리뷰 — 502 · 503 · HTML 오류 페이지 · 코드 없는 오류가 other 로 떨어져 초안을 버렸다. 서버가 판정한 오류는
 *  늘 코드(P0001 · PT422 · 28000 …)를 달고 오므로, 코드가 없거나 5xx 면 길 위에서 난 일로 보고 다시 보낸다. */
export function saveErrorKind(e: unknown): "conflict" | "network" | "other" {
  const err = e as { code?: unknown; message?: unknown; status?: unknown } | null;
  const code = typeof err?.code === "string" ? err.code : "";
  const msg = typeof err?.message === "string" ? err.message : String(e ?? "");
  const status = typeof err?.status === "number" ? err.status : 0;
  if (code === "PT409" || /\bstale\b/i.test(msg)) return "conflict";
  if (/fetch|network|load failed|timed? ?out|abort|offline|네트워크|ECONN|ETIMEDOUT/i.test(msg)) return "network";
  if (status >= 500 || /<html|bad gateway|service unavailable|gateway time/i.test(msg)) return "network";
  // PostgREST 연결 계열(PGRST000~003 — DB 연결 · 스키마 캐시 · 시간 초과, 503/504) · JWT 만료(PGRST301 — 클라이언트가 토큰을 새로 받는다)
  if (/^PGRST00[0-3]$/.test(code) || code === "PGRST301") return "network";
  // 앱 설정 · 로그인 문제는 코드가 없어도 다시 보내서 안 풀린다
  if (!code && /연동이 설정되지 않았|로그인이 필요/.test(msg)) return "other";
  // 코드 없는 4xx(413 너무 큼 · 400 …)는 다시 보내도 같다 — 시간 초과(408) · 너무 잦음(429)만 다시
  if (!code && status >= 400 && status < 500) return status === 408 || status === 429 ? "network" : "other";
  if (!code) return "network";
  return "other";
}

/* ── 저장 표식(2026-11-11 리뷰) — 응답을 잃은 저장이 실제로 들어갔는지 ─────────────
 * 저장 응답이 끊기면(네트워크 · 시간 초과) 서버에 들어갔는지 알 길이 없었다. 다시 보내면 버전 충돌이 나고,
 * 화면은 쌓인 액션을 최신(= 이미 들어간 내 저장) 위에 **또** 놓았다 — 비료 · 농기구 · 밭 넓히기가 두 번 샀다.
 * 저장마다 새 표식을 상태 최상위 _saves 링에 넣는다. 다시 받은 상태에 그 표식이 있으면 그 저장은 들어간 것이다.
 * ⚠ 최상위 칸이라야 한다 — 섬 · 낚시 · 수조 · 합치기 · 오늘 기록 · 옛 앱이 모두 ...st 로 그대로 흘려보낸다
 *   (b21e977 aquaTankMax 와 같은 자리). 안쪽 칸은 옛 앱이 다시 지으며 버린다.
 * 링 크기: 상대가 450ms 마다 저장해도 다시 시도 간격(최대 30초) 안에 밀려나지 않을 만큼. 표식 하나 10글자라 64개도 1KB 미만. */
export const SAVE_MARKS = 64;
export type SaveMarked = { _saves?: unknown };
export function newSaveMark(): string {
  try {
    const a = new Uint32Array(2);
    globalThis.crypto.getRandomValues(a);
    return a[0].toString(36) + a[1].toString(36).slice(0, 4);
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}
export function saveMarksOf(s: SaveMarked | null | undefined): string[] {
  const v = s?._saves;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
/** 보낼 상태에 표식을 붙인다(초안 · 쌓인 액션은 그대로 — 보낼 때만). */
export function withSaveMark<S extends object>(s: S, mark: string): S {
  return { ...s, _saves: [...saveMarksOf(s as SaveMarked).filter((m) => m !== mark), mark].slice(-SAVE_MARKS) };
}
export const hasSaveMark = (s: SaveMarked | null | undefined, mark: string): boolean => saveMarksOf(s).includes(mark);

/** 아직 확인 못 한 저장 시도 — 표식과, 보낼 때 줄에 쌓여 있던 액션 수(앞에서부터). */
export type SaveAttempt = { mark: string; n: number };
/** 다시 받은 상태에 들어간 시도가 있으면 그 시도가 보낸 액션 수(같은 버전에서 보낸 시도는 하나만 들어갈 수 있다). 없으면 0. */
export function committedOps(fresh: SaveMarked | null | undefined, attempts: readonly SaveAttempt[]): number {
  const marks = new Set(saveMarksOf(fresh));
  let n = 0;
  for (const a of attempts) if (marks.has(a.mark)) n = Math.max(n, a.n);
  return n;
}
/** 다시 받은 최신 위에 놓을 액션 — 들어간 시도의 몫은 빼고 나머지만(그 몫을 또 놓으면 두 번 산다). */
export function opsToReplay<T>(fresh: SaveMarked | null | undefined, attempts: readonly SaveAttempt[], ops: readonly T[]): { ops: T[]; committed: number } {
  const committed = Math.min(ops.length, committedOps(fresh, attempts));
  return { ops: ops.slice(committed), committed };
}

/* ── 못 보낸 초안을 기기에(2026-11-11 리뷰) ─────────────────────────
 * 오프라인에서 한 일은 화면 메모리에만 있어서 앱을 닫거나 iOS 가 앱을 내리면 사라졌다. 초안 · 바탕 버전 · 확인 못 한
 * 저장 표식을 localStorage 에 둔다. ⚠ 쌓인 액션은 함수(클로저)라 남길 수 없다 — 다시 열었을 때
 *   · 서버 버전이 바탕 그대로면 → 초안을 그대로 보낸다(그 사이 아무도 안 썼다).
 *   · 남긴 표식이 서버 상태에 있고 그 시도가 초안 전부를 보냈으면 → 이미 들어갔다(조용히 지운다).
 *   · 그 밖(상대가 그 사이 썼다) → 다시 놓을 액션이 없어 올리지 못한다 — 화면이 안내하고 지운다.
 *   초안을 '그대로 덮는 액션'으로 줄에 넣으면 안 된다 — 충돌 뒤 다시 놓을 때 상대 변경을 덮어쓴다. */
export type PendingDraft<S> = { v: number; state: S; attempts: SaveAttempt[]; ops: number; at: number };
export function readPending<S>(key: string | null): PendingDraft<S> | null {
  if (!key) return null;
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? "null") as PendingDraft<S> | null;
    if (!p || typeof p.v !== "number" || !p.state || typeof p.state !== "object") return null;
    return { v: p.v, state: p.state, attempts: Array.isArray(p.attempts) ? p.attempts.filter((a) => a && typeof a.mark === "string") : [], ops: Number(p.ops) || 0, at: Number(p.at) || 0 };
  } catch {
    return null;
  }
}
/** 남기기(null 이면 지우기). 저장소가 가득해도 화면은 계속 돈다 — 실패 여부만 돌려준다. */
export function writePending<S>(key: string | null, p: PendingDraft<S> | null): boolean {
  if (!key) return true;
  try {
    if (p) localStorage.setItem(key, JSON.stringify(p));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
/** 되살린 초안을 넘겨받을 때 닫힌 화면의 시도를 나눈다(2026-11-11 2차).
 *  · full — 그때 초안 전부(p.ops 개)를 보낸 시도. 들어갔으면 되살린 초안이 통째로 들어간 것이라 '한 액션'(n: 1)으로 친다.
 *  · partial — 앞의 몇 개만 보낸 시도(그 뒤에 더 한 일이 초안에 있다). 이게 들어갔으면 초안의 나머지는 다시 놓을 길이 없다
 *    (액션은 함수라 남기지 못했다) — 표식만 들고 있다가 화면이 안내한다.
 *  ⚠ 예전엔 모든 시도를 n: 1 로 바꿔, 액션 3개를 보낸 시도가 늦게 들어가면 5개짜리 초안 전체를 '들어간 것'으로 보고 소리 없이 지웠다. */
export function restoredAttempts(p: { attempts: readonly SaveAttempt[]; ops: number }): { full: SaveAttempt[]; partial: string[] } {
  const full: SaveAttempt[] = [];
  const partial: string[] = [];
  for (const a of p.attempts) {
    if (a.n >= p.ops) full.push({ mark: a.mark, n: 1 });
    else partial.push(a.mark);
  }
  return { full, partial };
}
/** 다시 받은 상태에 일부만 보낸 시도가 들어갔나 */
export function partialLanded(fresh: SaveMarked | null | undefined, partial: readonly string[]): boolean {
  if (!partial.length) return false;
  const marks = new Set(saveMarksOf(fresh));
  return partial.some((m) => marks.has(m));
}
export function pendingDecision<S extends SaveMarked>(p: PendingDraft<S>, row: { version: number; state: SaveMarked }): "send" | "committed" | "conflict" {
  const done = committedOps(row.state, p.attempts);
  if (done > 0 && done >= p.ops) return "committed";
  if (row.version === p.v) return "send";
  return "conflict";
}

/* ── 서버 시각(2026-11-11 리뷰) — 기기 시계가 틀린 폰 ─────────────────────
 * 시계가 이틀 빠른 폰이 밥을 주면 cd.feed 가 이틀 뒤로 찍혀 상대 폰은 47시간 동안 밥을 못 줬고,
 * 시계를 앞으로 돌리면 작물이 익었다. island_action 은 저장한 행을 그대로(updated_at = 서버 now()) 돌려준다 —
 * 보낸 시각 · 받은 시각의 가운데와 견줘 이 기기 시계의 어긋남을 잰다(오차 ≤ 왕복/2). 몇 초 안쪽은 0 으로 둔다
 * (왕복 흔들림으로 시계가 떨지 않게). HTTP Date 헤더는 CORS 기본 노출 헤더가 아니라 브라우저에서 못 읽는다 — 저장 응답의 updated_at 을 쓴다.
 * ⚠ 2026-11-11 2차 — 잰 값은 **이번 실행에서만** 쓴다. 예전엔 기기에 남겨 다음에 열 때 재기 전부터 썼는데, 그 사이 사용자가 시계를
 *   고쳤으면 게임 시각이 이틀 어긋나 방문이 지난날로 처리됐다(출석 보상 한 번 더 · 오늘 퀘스트 진행 0 · 스트릭 끊김).
 *   재기 전엔 기기 시계 — 첫 저장(대개 방문)이 바로 잰다. 11-11 배포가 남긴 값(CLOCK_KEY)은 재는 순간 지우고, 로그아웃도 지운다(auth.ts). */
export const CLOCK_KEY = "ourdays.clockOffset.v1";
const CLOCK_SLOP_MS = 5_000;
/** 표본 하나 — 받아들일 수 없으면 null(왕복이 너무 길거나 시각을 못 읽음). */
export function clockSample(serverAt: unknown, sentAt: number, recvAt: number): number | null {
  if (typeof serverAt !== "string" && typeof serverAt !== "number") return null;
  // Postgres timestamptz 는 소수 6자리 · 시간대 '+00' 꼴일 수 있다 — 어느 엔진에서나 읽히게 ISO 로 맞춘다
  const t = typeof serverAt === "number" ? serverAt : Date.parse(serverAt.replace(/(\.\d{3})\d+/, "$1").replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  const rtt = recvAt - sentAt;
  if (!Number.isFinite(t) || !(rtt >= 0) || rtt > 20_000) return null;
  const off = t - (sentAt + recvAt) / 2;
  return Math.abs(off) <= Math.max(CLOCK_SLOP_MS, rtt) ? 0 : Math.round(off);
}
/** 이번 실행(페이지)에서 잰 어긋남 — 재기 전엔 null(기기 시계 그대로) */
let clockOffset: number | null = null;
/** 저장 응답 하나로 어긋남을 다시 잰다(couple.ts 의 commitIslandAction 이 부른다). */
export function noteServerClock(serverAt: unknown, sentAt: number, recvAt: number): void {
  const off = clockSample(serverAt, sentAt, recvAt);
  if (off === null) return;
  clockOffset = off;
  try {
    localStorage.removeItem(CLOCK_KEY); // 11-11 배포가 남긴 값 — 이제 읽지 않는다
  } catch {
    /* 저장소 없음 */
  }
}
/** **이번 실행에서** 서버 시각과 견줘 봤나 — 남의 시각을 깎는 일(rebaseFuture)은 이것이 참일 때만 한다. */
export const clockKnown = (): boolean => clockOffset !== null;
/** 게임 시각 — 서버 시각에 맞춘 지금(재기 전엔 기기 시계). 섬 화면 · 홈 펫 · 게임 탭 요약이 이걸 쓴다. */
export const gameNow = (): number => Date.now() + (clockOffset ?? 0);
/** 테스트용 — 잰 값을 비운다 */
export function resetServerClock(): void {
  clockOffset = null;
}

/** 네트워크 재시도 간격 — 1 · 2 · 4 · 8 · 16 · 30초(상한) */
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, Math.min(5, attempt)));
}

/** 쌓인 액션을 새 상태 위에 차례로 다시 놓는다. 엔진이 받아들이지 않는 액션(같은 참조)은 떨어진다. */
export function replayOps<S>(base: S, ops: readonly ((s: S) => S)[]): { state: S; kept: ((s: S) => S)[]; dropped: number } {
  let st = base;
  const kept: ((s: S) => S)[] = [];
  let dropped = 0;
  for (const op of ops) {
    let next: S;
    try {
      next = op(st);
    } catch {
      next = st;
    }
    if (next === st) dropped++;
    else {
      st = next;
      kept.push(op);
    }
  }
  return { state: st, kept, dropped };
}

/* ── '자리 비운 사이' — 누가 · 언제 무엇을 했나 ─────────────────────────
 * 엔진 로그(s.log)는 글자뿐이라 누가 했는지 모른다. 화면이 액션을 적용할 때 새로 생긴 로그 줄을
 * 행동한 사람 · 시각과 함께 s.feed(옵셔널 — 무마이그레이션)에 남긴다. 옛 앱은 이 칸을 몰라도
 * clone 이 상태를 펼쳐 두므로 지우지 않는다(옛 앱으로 한 일은 소식에 안 뜰 뿐이다). */
export type FeedEntry = { at: number; by: string; msg: string };
export const FEED_MAX = 30;
/** 한 액션에서 남길 소식 줄 상한 — '모두 수확'이 밭 수만큼 줄을 내도 소식함을 덮지 않게 */
export const FEED_PER_ACTION = 4;
/** 정산(tick)이 내는 섬 소식 — 행동한 사람의 일이 아니다 */
const SYSTEM_LINE = /비가 내려 밭이|약이 필요해요/;

/** prev → next 사이에 새로 앞에 붙은 로그 줄. 엔진은 앞에 붙이고 50줄로 자른다. */
export function newLogLines(prev: readonly string[], next: readonly string[]): string[] {
  if (next === prev) return [];
  if (!prev.length) return next.slice();
  const probe = Math.min(3, prev.length);
  // 붙은 줄 수는 적어도 (next − prev) 줄이다(잘림은 뒤에서만). 거기서부터 찾아야 같은 글이 되풀이돼도(밥 · 밥) 안 놓친다.
  for (let k = Math.max(0, next.length - prev.length); k <= next.length - 1; k++) {
    let ok = true;
    for (let j = 0; j < probe && k + j < next.length; j++) if (next[k + j] !== prev[j]) { ok = false; break; }
    if (ok) return next.slice(0, k);
  }
  return [];
}

/** 액션 결과에 소식을 붙인다. 바뀐 게 없으면 같은 참조(엔진의 no-op 규약을 지킨다). */
export function withFeed(prev: IslandState, next: IslandState, by: string | null, at: number): IslandState {
  if (next === prev || !by) return next;
  const lines = newLogLines(prev.log, next.log).filter((l) => !SYSTEM_LINE.test(l)).slice(0, FEED_PER_ACTION);
  if (!lines.length) return next;
  const feed = [...lines.map((msg) => ({ at, by, msg })), ...(next.feed ?? [])].slice(0, FEED_MAX);
  return { ...next, feed };
}

/** 내가 마지막으로 본 뒤 상대가 한 일(최근 것부터). since 가 없으면 내가 마지막으로 한 일 뒤로 본다. */
export function awayFeed(feed: readonly FeedEntry[] | undefined, me: string, since: number | null): FeedEntry[] {
  const list = Array.isArray(feed) ? feed.filter((f) => f && typeof f.at === "number" && typeof f.msg === "string") : [];
  const mine = list.filter((f) => f.by === me).reduce((m, f) => Math.max(m, f.at), 0);
  const from = since ?? mine;
  if (!from) return [];
  return list.filter((f) => f.by !== me && f.at > from).sort((a, b) => b.at - a.at);
}

/** '3시간 전' · '어제' 같은 짧은 시각 */
export function agoLabel(at: number, now: number): string {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return d === 1 ? "어제" : `${d}일 전`;
}
