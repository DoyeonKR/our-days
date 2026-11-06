/* 일기책의 쪽 나누기 — 순수 함수. 표지 → 차례 → (달 표제지 → 그 달 일기들) → 뒤표지. */
export type BookReaderEntry = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  location: string | null;
  weather?: string | null;
  mood_emoji: string | null;
  hashtags: string[];
  photo_urls: string[];
  created_by: string;
  /** 같은 날 일기의 순서 — 먼저 쓴 것이 앞(목록은 최신순이라 그대로 두면 거꾸로 실렸다) */
  created_at?: string | null;
};

/** 책 순서 — 날짜, 같은 날이면 쓴 시각 오름차순. 인쇄(diaryBookHtml)도 같은 순서를 쓴다. */
export function bookOrder(a: { entry_date: string; created_at?: string | null }, b: { entry_date: string; created_at?: string | null }): number {
  if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
  const x = a.created_at ?? "", y = b.created_at ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
}
/** 표지 사진 — 책 순서로 처음 나오는 사진(README '표지(첫 사진)') */
export function bookCover(entries: readonly BookReaderEntry[]): string | undefined {
  return [...entries].sort(bookOrder).find((e) => e.photo_urls.length > 0)?.photo_urls[0];
}

export type BookPage =
  | { kind: "cover"; key: string }
  | { kind: "toc"; key: string; months: { month: number; count: number; page: number }[] }
  | { kind: "month"; key: string; month: number; count: number }
  | { kind: "entry"; key: string; entry: BookReaderEntry }
  | { kind: "end"; key: string };

export function bookPages(entries: readonly BookReaderEntry[]): BookPage[] {
  const sorted = [...entries].sort(bookOrder);
  const toc: { month: number; count: number; page: number }[] = [];
  const body: BookPage[] = [];
  let i = 0;
  while (i < sorted.length) {
    const key = sorted[i].entry_date.slice(0, 7);
    const month = Number(key.slice(5, 7));
    let j = i;
    while (j < sorted.length && sorted[j].entry_date.startsWith(key)) j++;
    toc.push({ month, count: j - i, page: 2 + body.length });
    body.push({ kind: "month", key: `m${key}`, month, count: j - i });
    for (; i < j; i++) body.push({ kind: "entry", key: sorted[i].id, entry: sorted[i] });
  }
  return [{ kind: "cover", key: "cover" }, { kind: "toc", key: "toc", months: toc }, ...body, { kind: "end", key: "end" }];
}
