// 잎 개구리 — 풀쏙이 → 잎개구리 → 연꽃개구리.
// 진화마다 **몸 구조가 바뀐다**: 꼬리 달린 올챙이 → 두 눈두덩과 굵은 뒷다리의 개구리 → 잎 망토를 두르고 일어선 연꽃 개구리.
import { Cv, T } from "../lib.mjs";
import { eyes, blush, spike } from "../helpers.mjs";

const PAL = {
  body: ["#b2f28f", "#5fc84a", "#2f7f36"],
  belly: ["#fffbd0", "#fff0a0", "#e8cf6a"],
  mark: ["#7fd96a", "#3f9a3c", "#256a2a"],
  a1: ["#9be87a", "#3d9433", "#1f6a28"], // 잎
  a2: ["#ffd0e2", "#ff7fae", "#d94a85"], // 꽃잎
  a3: ["#fff6a8", "#ffd34f", "#e8a317"], // 꽃술
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };
const EYE7 = [".ooooo.", "oowwwoo", "owLLwwo", "owLeewo", "owweeeo", ".oweeo.", "..ooo.."];

function grin(cv, y, half) {
  for (let x = 24 - half; x <= 23 + half; x++) cv.put(x, y + (x <= 24 - half + 1 || x >= 23 + half - 1 ? -1 : 0), "m");
}
function leafShape(cv, pts, vein) {
  cv.poly(pts, T.a1, { grad: { from: pts[0], to: pts[Math.floor(pts.length / 2)], letters: ["f", "F", "F", "h"] } });
  if (vein) cv.line(vein[0], vein[1], vein[2], vein[3], "h", 1);
}
const lotus = (cv, cx, cy) => {
  for (const [tx, ty, w] of [[cx - 9.5, cy - 6, 6], [cx + 9.5, cy - 6, 6]]) spike(cv, cx, cy + 1.5, tx, ty, w, T.a2, { grad: ["t", "R", "r"] });
  for (const [tx, ty, w] of [[cx - 5.5, cy - 10, 6.5], [cx + 5.5, cy - 10, 6.5]]) spike(cv, cx, cy + 1.5, tx, ty, w, T.a2, { grad: ["t", "R", "r"] });
  spike(cv, cx, cy + 2, cx, cy - 12, 7, T.a2, { grad: ["t", "R", "R", "r"] });
  cv.ellipse(cx, cy - 1, 2.2, 2.2, T.a3, { shade: false });
};

/** 풀쏙이 — 올챙이. 머리와 몸이 한 덩어리, 꼬리가 달리고 다리는 아직 없다. 머리에 새싹. */
function stage2() {
  const cv = new Cv();
  cv.poly([[33, 38], [39, 38], [43, 36.5], [44.5, 40], [39, 43], [32, 42]], T.body); // 꼬리
  cv.ellipse(23.5, 31, 12.5, 11.5, T.body);
  cv.ellipse(23.5, 36.5, 7.5, 5.2, T.belly, { shade: false });
  cv.ellipse(13.5, 38.5, 2.6, 2.2, T.body); // 막 나온 앞다리 싹
  cv.ellipse(33.5, 38.5, 2.6, 2.2, T.body);
  leafShape(cv, [[23.5, 22], [17, 15], [20, 10], [24.5, 17]]);
  leafShape(cv, [[23.5, 22], [30, 15], [27, 10], [22.5, 17]]);
  eyes(cv, 27, 6.2, "big");
  grin(cv, 32, 4);
  blush(cv, 30, 10);
  return cv;
}

/** 잎개구리 — 눈두덩이 솟은 넓적한 개구리. 굵은 뒷다리가 옆으로 불룩하고 연잎을 모자로 쓴다. */
function stage3() {
  const cv = new Cv();
  mirror((mx) => {
    cv.ellipse(mx(8.5), 37, 6, 5.6, T.body); // 뒷다리 허벅지
    cv.poly([[mx(4), 41], [mx(0.5), 43.5], [mx(7), 43.5]], T.body); // 물갈퀴 발
  });
  cv.ellipse(23.5, 38, 12.5, 5.6, T.body);
  cv.ellipse(23.5, 38.5, 8, 3.6, T.belly, { shade: false });
  cv.ellipse(15.5, 36, 2.5, 2.2, T.body);
  cv.ellipse(31.5, 36, 2.5, 2.2, T.body);
  cv.ellipse(23.5, 28.5, 15.5, 10, T.body);
  cv.ellipse(14, 20, 7.2, 7.2, T.body);
  cv.ellipse(33, 20, 7.2, 7.2, T.body);
  cv.ellipse(23.5, 33, 9, 4.2, T.belly, { shade: false });
  cv.ellipse(23.5, 16.5, 11, 5.5, T.body);
  leafShape(cv, [[12, 11], [16, 5], [23.5, 3], [31, 5], [35, 11], [30, 12.5], [17, 12.5]], [23, 4, 23, 12]);
  for (const cx of [14, 33]) cv.stamp(Math.round(cx - 3), 17, EYE7);
  grin(cv, 31, 8);
  blush(cv, 28, 12.5);
  return cv;
}

/** 연꽃개구리 — 잎 망토를 어깨에 두르고 일어선 모습. 머리에 연꽃이 핀다. */
function stage4() {
  const cv = new Cv();
  // 큰 잎 망토 — 어깨 뒤로 좌우 펼친 잎
  mirror((mx) => leafShape(cv, [[mx(17), 22], [mx(9), 14], [mx(2), 19], [mx(0), 30], [mx(4), 40], [mx(12), 37], [mx(17), 31]], [mx(16), 24, mx(3), 30]));
  mirror((mx) => { cv.ellipse(mx(12), 38, 5, 5.4, T.body); cv.poly([[mx(8), 42], [mx(4), 43.5], [mx(11), 43.5]], T.body); });
  cv.ellipse(23.5, 35, 9.8, 8.8, T.body);
  cv.ellipse(23.5, 36, 6.4, 7.2, T.belly, { shade: false });
  mirror((mx) => cv.ellipse(mx(13.5), 32, 2.8, 3.2, T.body)); // 팔
  cv.ellipse(23.5, 21, 11.5, 8.5, T.body);
  cv.ellipse(15, 15.5, 5.8, 5.8, T.body);
  cv.ellipse(32, 15.5, 5.8, 5.8, T.body);
  cv.ellipse(23.5, 25.5, 8, 3.8, T.belly, { shade: false });
  lotus(cv, 23.5, 8.5);
  for (const cx of [15, 32]) cv.stamp(Math.round(cx - 3), 12.5, EYE7);
  grin(cv, 25, 6);
  blush(cv, 22, 11);
  return cv;
}

const lineage = { pal: PAL, fur: "b", pad: "y", stages: [stage2, stage3, stage4] };

export default lineage;
