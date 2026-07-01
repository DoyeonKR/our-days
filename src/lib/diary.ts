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

/**
 * 기록 히트맵 셀 — 최근 `weeks`주를 주(열)×요일(행, 일~토) 격자로. 컬럼-메이저
 * (index i → 열 floor(i/7), 행 i%7). 각 셀은 그 날 일기 유무. 오늘 이후(현재 주의
 * 미래 요일)는 null. 순수(테스트 용이) — endIso 를 받아 결정적.
 */
export function heatmapCells(
  entries: { entry_date: string }[],
  endIso: string,
  weeks = 24,
): ({ iso: string; has: boolean } | null)[] {
  const has = new Set(entries.map((e) => e.entry_date));
  const [ey, em, ed] = endIso.split("-").map(Number);
  const end = new Date(ey, em - 1, ed); // 로컬 자정
  // day 0 = 첫 열의 일요일: 뒤로 (weeks-1)*7 + 오늘 요일 만큼
  const back = (weeks - 1) * 7 + end.getDay();
  const cells: ({ iso: string; has: boolean } | null)[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - back + i);
    if (d.getTime() > end.getTime()) {
      cells.push(null); // 현재 주의 미래 요일
      continue;
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    cells.push({ iso, has: has.has(iso) });
  }
  return cells;
}

/** 기분 이모지 집계(많은 순). 빈/널 mood 는 제외. */
export function moodCounts(
  entries: { mood_emoji?: string | null }[],
): { emoji: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    const m = e.mood_emoji;
    if (!m) continue;
    map.set(m, (map.get(m) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
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
