/* 행 상한(PostgREST max-rows 1000)에 걸리는 목록을 끝까지 받는다 — 순수(가져오는 함수만 받는다).
 * ⚠ 한 번에 받으면 1000행에서 아무 말 없이 잘린다(사진 목록 · 크기 순위가 그랬다).
 * 넘기는 함수는 순서가 정해진 질의여야 한다(order 없이 range 만 쓰면 쪽마다 겹치거나 빠진다). */
export const ROW_CAP = 1000;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => Promise<readonly T[]>,
  size = ROW_CAP,
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const rows = await page(i * size, i * size + size - 1);
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}
