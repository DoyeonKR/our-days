/** 낚싯대 그림에서 그려 넣은 줄을 지운다(2026-11-11) [사용자: "개선할거 확인해서 낚시 게임 퀄리티 올려"]
 *  대나무 · 용 낚싯대 원화엔 끝에서 늘어진 줄 고리 · 가이드를 지나 릴로 가는 줄이 같이 그려져 있어, 장면이 그리는 진짜 줄 옆에 줄이 하나 더 보였다.
 *  줄은 몇 칸 굵기라 '열기'(깎았다 다시 불리기)로 사라지고, 낚싯대 몸통 · 가이드 · 릴은 남는다. 남은 덩어리 근처(keep 칸) 픽셀만 살리고,
 *  끊겨 떠 있는 작은 조각(매듭 · 고리 끝)은 지운다. 그림을 구울 때 한 번만 — 순수(같은 그림 = 같은 결과). */

/** 줄이 그려진 낚싯대 — 나머지는 줄이 없고 끝이 가늘어 깎으면 끝이 상한다 */
export const RODS_WITH_DRAWN_LINE: ReadonlySet<string> = new Set(["rod_bamboo", "rod_dragon"]);

function pass(src: Uint8Array, w: number, h: number, r: number, grow: boolean, horiz: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let k = -r; k <= r; k++) {
      const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
      const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx];
      if (grow) { if (s) { v = 1; break; } } else if (!s) { v = 0; break; }
    }
    out[y * w + x] = v;
  }
  return out;
}
const morph = (m: Uint8Array, w: number, h: number, r: number, grow: boolean) => pass(pass(m, w, h, r, grow, true), w, h, r, grow, false);

/** rgba(가로 w · 세로 h)에서 굵기 2r 이하의 가는 선을 투명하게 — 지운 픽셀 수를 돌려준다 */
export function stripThinStrokes(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, r = 2, keep = 2, minArea = 400): number {
  const n = w * h, m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = rgba[i * 4 + 3] > 60 ? 1 : 0;
  const near = morph(morph(morph(m, w, h, r, false), w, h, r, true), w, h, keep, true);
  // 남은 것 중 작은 덩어리는 떠 있는 조각이다
  const lab = new Int32Array(n).fill(-1), sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!near[i] || !m[i] || lab[i] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    lab[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      count++;
      const x = j % w, y = (j - x) / w;
      if (x > 0) visit(j - 1);
      if (x < w - 1) visit(j + 1);
      if (y > 0) visit(j - w);
      if (y < h - 1) visit(j + w);
    }
    sizes.push(count);
    function visit(q: number) { if (near[q] && m[q] && lab[q] < 0) { lab[q] = id; stack.push(q); } }
  }
  let cut = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] === 0) continue;
    if (lab[i] >= 0 && sizes[lab[i]] > minArea) continue;
    // 옅은 가장자리(부드러운 테두리)는 남은 몸통 곁이면 둔다
    if (!m[i] && near[i]) continue;
    rgba[i * 4 + 3] = 0;
    cut++;
  }
  return cut;
}
