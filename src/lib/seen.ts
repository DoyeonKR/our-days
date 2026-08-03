"use client";

/* '마지막으로 확인한 시각' 로컬 기준선.
 *
 * 왜 서버가 아니라 로컬인가 — 이 앱의 유일한 읽음 테이블 `chat_reads` 는 CoupleSync 가
 * **마운트되는 순간**(= 홈을 열기만 해도) markChatRead 로 내 last_read_at 을 now 로 민다.
 * 그래서 서버 기준 '내가 안 본 것'은 구조적으로 항상 0 에 수렴해 배지로 쓸 수 없다.
 * 배지는 "이 기기에서 내가 저걸 봤나"를 묻는 UI 상태이므로 로컬이 오히려 맞는 저장소다.
 * (기기마다 따로 뜨는 건 의도된 동작 — 새 기기에서 한 번 더 알려주는 쪽이 낫다.)
 *
 * ⚠ 저장 실패(사파리 프라이빗 등)를 삼킨다 — 배지가 안 사라질 뿐 앱은 계속 동작해야 한다.
 */

const PREFIX = "ourdays:seen:";

/** 일기 배지 기준선 키(홈 벤치). */
export const DIARY_SEEN_KEY = "diary";

/** 마지막 확인 시각(ms). 없거나 못 읽으면 0 — 즉 '아직 아무것도 안 봤다'로 시작한다. */
export function getSeen(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(PREFIX + key);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 지금(또는 지정 시각)까지 봤다고 표시. 되돌아가지 않게 **단조 증가**만 허용한다. */
export function markSeen(key: string, at: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    if (at <= getSeen(key)) return;
    localStorage.setItem(PREFIX + key, String(at));
  } catch {
    /* noop */
  }
}

/** 기준선을 읽되, **처음이면 지금으로 세우고** 그 값을 돌려준다.
 *  이게 없으면 새 기기 첫 실행에서 과거 쿡 20개가 통째로 '새 것'으로 잡힌다. */
export function seenBaseline(key: string, now: number = Date.now()): number {
  const v = getSeen(key);
  if (v > 0) return v;
  markSeen(key, now);
  return now;
}

/** ISO 문자열 목록 중 기준선 이후 것의 개수 — 배지 숫자용.
 *  기준선이 0(= 아직 안 세움)이면 셀 근거가 없으므로 0. 호출부가 seenBaseline 을 먼저 부른다. */
export function countSince(isoList: readonly string[], since: number): number {
  if (since <= 0) return 0;
  let n = 0;
  for (const iso of isoList) {
    const t = Date.parse(iso);
    if (Number.isFinite(t) && t > since) n++;
  }
  return n;
}
