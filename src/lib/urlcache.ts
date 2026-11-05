// 서명 URL 캐시의 순수 로직 — couple.ts 인라인에서 추출해 단위 테스트 가능하게.
// (localStorage 영속화 캐시는 프라이버시·만료 정확성이 걸린 로직이라 회귀 lock 필수)
export type UrlEntry = { url: string; exp: number };

/** 재서명 여유 — 2026-11-06 60초 → 5분. 60초면 화면에 붙어 있는 동안 만료돼(사진첩을 켜 둔 채 둔 경우) 타일이 깨졌다. */
export const URL_MIN_LEFT_MS = 5 * 60_000;

/** 썸네일 서명 유효 — 7일. 1시간이면 매시간 2N 경로를 다시 서명했고, 토큰이 바뀌면 HTTP 캐시가 빗나가 썸네일을 다시 받았다.
 *  원본 · 영상은 1시간 그대로(크고, 보는 순간에만 서명한다). */
export const THUMB_TTL_S = 7 * 86_400;
export const MEDIA_TTL_S = 3600;

/** 사진첩 썸네일 경로(`<couple>/<stamp>.thumb.<ext>`) — SW 도 같은 규칙으로 캐시 키를 고른다. */
export function isThumbPath(path: string): boolean {
  return /\.thumb\.[a-z0-9]+$/i.test(path);
}

export function ttlForPath(path: string): number {
  return isThumbPath(path) ? THUMB_TTL_S : MEDIA_TTL_S;
}

/** 캐시 히트 판정 — 잔여 유효시간이 minLeftMs 미만이면 미스(재서명 유도). */
export function isFreshUrlEntry(
  e: UrlEntry | undefined,
  now: number,
  minLeftMs = URL_MIN_LEFT_MS,
): e is UrlEntry {
  return !!e && typeof e.url === "string" && e.exp > now + minLeftMs;
}

/** localStorage 원문 → 유효 엔트리만 복원. 형식 오류/오염 데이터는 빈 배열(크래시 금지). */
export function parseStoredUrlEntries(
  raw: string | null,
  now: number,
  minLeftMs = URL_MIN_LEFT_MS,
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

/** 저장 상한 — 300 이면 사진 150장(원본+썸네일)에서 넘쳐 앱을 다시 열 때마다 앞쪽이 재서명됐다.
 *  1500개 × 약 400바이트 ≈ 600KB(localStorage 5MB 안). */
export const URL_CACHE_CAP = 1500;

/** 저장 직전 정리 — 만료 엔트리 제거 + 최근 cap 개만 (스토리지 폭주 방지). */
export function persistableUrlEntries(
  entries: [string, UrlEntry][],
  now: number,
  cap = URL_CACHE_CAP,
): [string, UrlEntry][] {
  return entries.filter(([, v]) => v && v.exp > now).slice(-cap);
}
