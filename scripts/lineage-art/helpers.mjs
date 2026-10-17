// 계보 공통 그리기 도구 — 몸 조각(가시·잎·날개 깃…)과 얼굴.
import { T, EYE, EYE_S, EYE_DOT } from "./lib.mjs";

/** 부리·뿔 같은 한 가지 색 램프(밝음/기본/그늘) — q Q 글자(부리 램프). */
export const BEAK = { H: "q", b: "q", B: "q", d: "Q", D: "Q" };

/** 삼각 가시 — 밑동 중심(bx,by), 끝(tx,ty), 밑동 폭 w. 밑동 → 끝 방향 띠로 칠한다. */
export function spike(cv, bx, by, tx, ty, w, letters, o = {}) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts = [[bx + nx * w / 2, by + ny * w / 2], [tx, ty], [bx - nx * w / 2, by - ny * w / 2]];
  return cv.poly(pts, letters, o.grad ? { grad: { from: [bx, by], to: [tx, ty], letters: o.grad }, tag: o.tag } : { th: o.th, tag: o.tag });
}

/** 방사형 가시 — 중심(cx,cy) 둘레 반지름 r0 에서 r1 까지, 각도 a0~a1(도, 0=오른쪽 · -90=위) 사이에 n 개.
 *  가시마다 밑동폭 w. 위쪽 호(둥근 등)에 가시를 세울 때 쓴다. */
export function radial(cv, cx, cy, r0, r1, a0, a1, n, w, letters, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = ((a0 + ((a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)))) * Math.PI) / 180;
    const jitter = o.jitter ? o.jitter[i % o.jitter.length] : 0;
    const rr1 = r1 + jitter;
    spike(cv, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * (o.squash ?? 1), cx + Math.cos(a) * rr1, cy + Math.sin(a) * rr1 * (o.squash ?? 1), w, letters, o);
  }
}

/** 눈 둘. kind: "big"(7×7) · "small"(5×5) · "dot"(3×3). cy = 눈 중심 y, dx = 중심선에서 눈 중심까지. */
export function eyes(cv, cy, dx = 7.5, kind = "big") {
  const pat = kind === "small" ? EYE_S : kind === "dot" ? EYE_DOT : EYE;
  const w = pat[0].length, h = pat.length;
  const x0l = Math.round(23.5 - dx - (w - 1) / 2), x0r = Math.round(23.5 + dx - (w - 1) / 2);
  const y0 = Math.round(cy - (h - 1) / 2);
  cv.stamp(x0l, y0, pat);
  cv.stamp(x0r, y0, pat);
  return { left: x0l + (w - 1) / 2, right: x0r + (w - 1) / 2, top: y0, bottom: y0 + h - 1 };
}

/** 입 — "smile" 은 한 줄 미소, "w" 는 고양이 입(ω), "o" 는 작은 동그라미, "flat" 은 일자. cx 는 가운데 x(소수). */
export function mouth(cv, y, kind = "smile", half = 4, cx = 23.5, ch = "m") {
  const L = Math.floor(cx - half + 0.5), R = Math.floor(cx + half - 0.5 + 0.5);
  if (kind === "flat") { for (let x = L; x <= R; x++) cv.put(x, y, ch); return; }
  if (kind === "smile") {
    for (let x = L; x <= R; x++) cv.put(x, y + (x === L || x === R ? -1 : 0), ch);
    return;
  }
  if (kind === "w") {
    const m = Math.floor(cx);
    cv.put(m - 2, y, ch); cv.put(m - 1, y + 1, ch); cv.put(m, y, ch); cv.put(m + 1, y, ch); cv.put(m + 2, y + 1, ch); cv.put(m + 3, y, ch);
    return;
  }
  if (kind === "o") {
    const m = Math.floor(cx);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 1], [2, 1], [0, 2], [1, 2]]) cv.put(m + dx, y + dy, ch);
  }
}

/** 볼터치 — 눈 아래 바깥쪽 두 점. */
export function blush(cv, y, dx = 11, w = 2) {
  const l = Math.round(23.5 - dx - w / 2), r = Math.round(23.5 + dx - w / 2);
  cv.stamp(l, y, ["p".repeat(w)]);
  cv.stamp(r, y, ["p".repeat(w)]);
}

/** 호 — 중심(cx,cy) 반지름 r, 각도 a0~a1(도, 0=오른쪽 · -90=위 · 시계방향 +)을 ch 로 두께 th 만큼 긋는다. */
export function arc(cv, cx, cy, r, a0, a1, ch, th = 1, o = {}) {
  const layer = o.tag ? cv.tag(o.tag) : ++cv.n;
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r * 0.06));
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    for (let dx = 0; dx < th; dx++) for (let dy = 0; dy < th; dy++) cv.put(x + dx - Math.floor(th / 2), y + dy - Math.floor(th / 2), ch, layer);
  }
  return layer;
}

/** 좌우 짝 그리기 — fn(mx) 에 x 를 비추는 함수를 넘겨 왼쪽·오른쪽을 한 번에. */
export function both(fn) {
  fn((x) => x, 0);
  fn((x) => 47 - x, 1);
}

export { T };
