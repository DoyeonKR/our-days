/** 짧은 글(유리병 편지 · 물고기 이름) 공용 — 자소 묶음 세기 · 다듬기 · 주소 막기(2026-11-13, fishbottle.ts 에서 옮겼다).
 *  ⚠ 값 import 가 없는 파일로 둔다 — aquarium.ts 가 부르는데 fishbottle → fishing → aquarium 고리를 타면
 *  모듈이 덜 만들어진 채로 읽힌다(fishing.ts 가 맨 위에서 aquarium 값을 쓴다). */

type Seg = new (l?: string, o?: { granularity: "grapheme" }) => { segment(s: string): Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: Seg }).Segmenter;
/** 자소 묶음으로 나눈다 — Segmenter 가 없는 옛 브라우저는 코드 포인트(이모지 조합은 여러 글자로 셀 수 있다) */
export function graphemes(s: string): string[] {
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return Array.from(s);
}
/** 줄바꿈 · 제어 문자는 띄어쓰기로, 띄어쓰기는 한 칸으로, 앞뒤는 다듬는다. NFC — 풀어 쓴 한글(ㅎ+ㅏ+ㄴ)도 한 글자로 저장 */
export function normalizeShortText(raw: string): string {
  return String(raw ?? "").normalize("NFC").replace(/[\r\n\u2028\u2029]+/g, " ").replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim();
}
/** 그릴 때 — 저장된 값이 길어도(옛 앱 · 다른 기기) len 글자 · units UTF-16 단위까지만. 글자 단위로 덜어 낸다(UTF-16 로 자르면 이모지 반쪽이 남는다) */
export function clipShortText(s: string, len: number, units: number): string {
  const out: string[] = [];
  let used = 0;
  for (const g of graphemes(normalizeShortText(s)).slice(0, len)) {
    if (used + g.length > units) break;
    out.push(g);
    used += g.length;
  }
  return out.join("");
}
/** 주소는 못 넣는다 — 둘만 보는 글이지만 남의 링크를 실어 나르는 길이 되면 안 된다 */
export const URL_LIKE = /(https?:|www\.|:\/\/|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|co|gg|app|xyz|link)\b)/i;
/** 보이는 글자가 하나라도 있나 — 폭 없는 공백 · 한글 채움 문자만으로 된 글은 빈 글이다(\p{Cf} 를 지우지는 않는다 — ZWJ 라 이모지 조합이 깨진다) */
export const VISIBLE = /[^\s\p{Cf}\u115f\u1160\u3164\uffa0]/u;
