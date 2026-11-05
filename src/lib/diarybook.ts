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
};

export type BookPage =
  | { kind: "cover"; key: string }
  | { kind: "toc"; key: string; months: { month: number; count: number; page: number }[] }
  | { kind: "month"; key: string; month: number; count: number }
  | { kind: "entry"; key: string; entry: BookReaderEntry }
  | { kind: "end"; key: string };

export function bookPages(entries: readonly BookReaderEntry[]): BookPage[] {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
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
