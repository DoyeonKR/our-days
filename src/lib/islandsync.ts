/* 섬 저장 파이프라인의 순수 조각 — 충돌 · 네트워크 판별, 액션 다시 놓기, '자리 비운 사이' 소식. (2026-11-06 게임 리뷰)
 * ⚠ 섬 엔진은 타입만 — 이 파일은 화면(IslandGame)이 부르고 islandsync.test 가 바로 돌린다. */

import type { IslandState } from "./island.ts";

/** 저장 실패의 종류.
 *  · conflict — 버전 충돌(island_action 의 PT409 'stale'). 최신을 받아 쌓인 액션을 그 위에 다시 놓는다.
 *  · network — 연결이 끊겼다. 초안을 지키고 조금 뒤 다시 보낸다(예전엔 이것도 충돌로 보고 초안을 버렸다).
 *  · other — 그 밖(권한 · 섬 없음). 다시 보내도 안 풀린다. */
export function saveErrorKind(e: unknown): "conflict" | "network" | "other" {
  const err = e as { code?: unknown; message?: unknown; status?: unknown } | null;
  const code = typeof err?.code === "string" ? err.code : "";
  const msg = typeof err?.message === "string" ? err.message : String(e ?? "");
  if (code === "PT409" || /\bstale\b/i.test(msg)) return "conflict";
  if (/fetch|network|load failed|timed? ?out|abort|offline|네트워크|ECONN|ETIMEDOUT/i.test(msg)) return "network";
  if (!code && typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  return "other";
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
