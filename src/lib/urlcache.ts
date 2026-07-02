// 서명 URL 캐시의 순수 로직 — couple.ts 인라인에서 추출해 단위 테스트 가능하게.
// (localStorage 영속화 캐시는 프라이버시·만료 정확성이 걸린 로직이라 회귀 lock 필수)
export type UrlEntry = { url: string; exp: number };

/** 캐시 히트 판정 — 잔여 유효시간이 minLeftMs 미만이면 미스(재서명 유도). */
export function isFreshUrlEntry(
  e: UrlEntry | undefined,
  now: number,
  minLeftMs = 60_000,
): e is UrlEntry {
  return !!e && typeof e.url === "string" && e.exp > now + minLeftMs;
}

/** localStorage 원문 → 유효 엔트리만 복원. 형식 오류/오염 데이터는 빈 배열(크래시 금지). */
export function parseStoredUrlEntries(
  raw: string | null,
  now: number,
  minLeftMs = 60_000,
): [string, UrlEntry][] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: [string, UrlEntry][] = [];
    for (const item of parsed) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [k, v] = item as [unknown, unknown];
      if (typeof k !== "string" || !k) continue;
      const e = v as UrlEntry;
      if (isFreshUrlEntry(e, now, minLeftMs)) out.push([k, e]);
    }
    return out;
  } catch {
    return [];
  }
}

/** 저장 직전 정리 — 만료 엔트리 제거 + 최근 cap 개만 (스토리지 폭주 방지). */
export function persistableUrlEntries(
  entries: [string, UrlEntry][],
  now: number,
  cap = 300,
): [string, UrlEntry][] {
  return entries.filter(([, v]) => v && v.exp > now).slice(-cap);
}
