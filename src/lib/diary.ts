// 일기장(타임라인/회상/검색) 순수 로직 — UI·데이터 계층과 분리해 테스트 용이.

type DatedEntry = { entry_date: string };

/** 'YYYY-MM' 월 키. */
export function entryMonthKey(e: DatedEntry): string {
  return e.entry_date.slice(0, 7);
}

/** 'YYYY-MM' → '2026년 7월'. */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** entry_date 로 월별 그룹(최신 월 먼저, 그룹 내 원래 순서 유지). */
export function groupByMonth<T extends DatedEntry>(
  entries: T[],
): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const k = entryMonthKey(e);
    const arr = map.get(k);
    if (arr) arr.push(e);
    else map.set(k, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({ key, label: monthLabel(key), items }));
}

/** refIso(YYYY-MM-DD) 와 같은 월-일이면서 더 이전 연도의 항목('작년 오늘'). */
export function onThisDay<T extends DatedEntry>(entries: T[], refIso: string): T[] {
  const md = refIso.slice(5); // MM-DD
  const year = refIso.slice(0, 4);
  return entries.filter(
    (e) => e.entry_date.slice(5) === md && e.entry_date.slice(0, 4) < year,
  );
}

/** 몇 년 전인지(양수). */
export function yearsAgo(entryIso: string, refIso: string): number {
  return Number(refIso.slice(0, 4)) - Number(entryIso.slice(0, 4));
}

/** 제목/본문/위치/해시태그에 질의어 포함 여부(대소문자 무시). 빈 질의는 항상 true. */
export function matchesQuery(
  e: {
    title?: string | null;
    body?: string | null;
    location?: string | null;
    hashtags?: string[];
  },
  q: string,
): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [e.title, e.body, e.location, ...(e.hashtags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}
