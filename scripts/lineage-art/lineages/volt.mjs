// 번개 새 — 찌릿이 → 번개참새 → 천둥새.
// 진화마다 **몸 구조가 바뀐다**: 동그란 병아리 → 날씬하게 선 참새(접은 날개 · 긴 번개 꼬리) → 날개를 치켜든 천둥새.
import { Cv, T } from "../lib.mjs";
import { BEAK, spike, eyes, blush } from "../helpers.mjs";

const PAL = {
  body: ["#aebdff", "#7388f3", "#4656c6"], // 군청
  belly: ["#ffffff", "#fffaf0", "#cdd6ff"],
  a1: ["#fffbd0", "#ffe14a", "#e8a317"], // 번개 노랑
  beak: ["#ffd9a0", "#ffb347", "#e08a1e"],
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };

/** 아래로 뻗는 번개 조각 — 왼쪽 위 (x,y), s 배, flip=-1 이면 좌우 반전. */
function bolt(cv, x, y, s = 1, flip = 1) {
  const p = [[1, 0], [5, 0], [3, 4.5], [6.5, 4.5], [0, 12], [2, 7], [-1.5, 7]].map(([a, b]) => [x + a * s * flip, y + b * s]);
  return cv.poly(p, T.a1, { grad: { from: [x - flip, y], to: [x + 6 * flip, y + 12 * s], letters: ["f", "F", "F", "h"] } });
}
/** 위로 솟는 번개 볏 — 밑동 y 가 baseY, 끝이 baseY-h. flip=-1 이면 오른쪽으로 기운다. */
function boltUp(cv, cx, baseY, h, s = 1, flip = 1) {
  const rel = [[1, 12], [5, 12], [3, 7.5], [6.5, 7.5], [0, 0], [2, 5], [-1.5, 5]];
  const pts = rel.map(([a, b]) => [cx + (a - 2.5) * s * flip, baseY - h + b * (h / 12)]);
  return cv.poly(pts, T.a1, { grad: { from: [cx, baseY], to: [cx, baseY - h], letters: ["h", "F", "F", "f"] } });
}
const FEATHER = ["B", "b", "b", "F", "f"];

/** 찌릿이 — 동그란 병아리. 몸·머리가 한 덩어리, 날개는 작은 혹. */
function stage2() {
  const cv = new Cv();
  bolt(cv, 33, 32, 0.8);
  cv.ellipse(23.5, 31, 11.5, 11.5, T.body);
  cv.ellipse(23.5, 35, 7, 6.5, T.belly);
  cv.ellipse(12.5, 33, 2.8, 4.6, T.body);
  cv.ellipse(34.5, 33, 2.8, 4.6, T.body);
  boltUp(cv, 23.5, 20, 11, 0.95, 1);
  eyes(cv, 26, 6.5, "big");
  cv.poly([[21.4, 29.5], [25.6, 29.5], [23.5, 33.3]], BEAK, { shade: false });
  blush(cv, 30, 10);
  return cv;
}

/** 번개참새 — 날씬하게 선 새. 머리가 작은 공처럼 얹히고, 날개는 몸에 접혀 붙고, 번개 꼬리가 양옆으로 길게 뻗는다. */
function stage3() {
  const cv = new Cv();
  bolt(cv, 31, 29, 1.3);
  bolt(cv, 16.5, 29, 1.3, -1);
  cv.ellipse(23.5, 32.5, 8.8, 11.5, T.body);
  cv.ellipse(23.5, 35, 5, 8.5, T.belly);
  mirror((mx) => cv.poly([[mx(15.5), 24], [mx(11), 28], [mx(9.5), 36], [mx(12), 43], [mx(16), 37], [mx(16.5), 28]], T.body));
  cv.ellipse(23.5, 18, 10.5, 9.5, T.body);
  boltUp(cv, 23.5, 10, 9, 0.85, 1);
  boltUp(cv, 16.5, 12, 7, 0.65, 1);
  boltUp(cv, 30.5, 12, 7, 0.65, -1);
  eyes(cv, 17, 5.6, "big");
  cv.poly([[21.2, 21], [25.8, 21], [23.5, 25.5]], BEAK, { shade: false });
  blush(cv, 21, 9.5);
  return cv;
}

/** 천둥새 — 날개를 위로 치켜든 큰 새. 가슴이 넓고 머리는 작게 높이, 긴 번개 볏, 번개 꼬리. */
function stage4() {
  const cv = new Cv();
  mirror((mx) => {
    for (const [tx, ty, w] of [[0, 22, 6.5], [0, 13, 6.5], [3, 5, 6.5], [11, 0, 6.5]]) spike(cv, mx(15), 31, mx(tx), ty, w, T.body, { grad: FEATHER });
    spike(cv, mx(15), 31, mx(1), 33, 6, T.body, { grad: FEATHER });
  });
  bolt(cv, 33, 31, 1.15);
  bolt(cv, 14, 31, 1.15, -1);
  cv.ellipse(23.5, 35, 9.5, 8.8, T.body);
  cv.ellipse(23.5, 36, 5.8, 7, T.belly);
  cv.poly([[23, 32], [26, 32], [24.5, 35], [27, 35], [22, 41], [23.5, 37], [21, 37]], T.a1, { shade: false });
  cv.ellipse(23.5, 25, 5.5, 5, T.body);
  cv.ellipse(23.5, 18, 8.8, 7.8, T.body);
  boltUp(cv, 23.5, 11, 11, 1.0, 1);
  boltUp(cv, 16.5, 12, 9, 0.8, 1);
  boltUp(cv, 30.5, 12, 9, 0.8, -1);
  eyes(cv, 17, 5, "big");
  cv.poly([[21, 21.5], [26, 21.5], [23.5, 27]], BEAK, { shade: false });
  return cv;
}

const lineage = { pal: PAL, fur: "q", pad: "Q", stages: [stage2, stage3, stage4] };

export default lineage;
