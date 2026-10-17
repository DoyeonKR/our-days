// 눈사람 — 눈송이 → 눈덩이 → 눈사람왕.
// 진화마다 **몸 구조가 바뀐다**: 눈 한 덩이 → 목도리 두른 두 덩이 눈사람 → 얼음 왕관·망토·지팡이의 세 겹 눈사람왕.
import { Cv, T } from "../lib.mjs";
import { blush, spike } from "../helpers.mjs";

const PAL = {
  body: ["#ffffff", "#f3f7ff", "#bccdee"],
  belly: ["#ffffff", "#f3f7ff", "#bccdee"],
  mark: ["#c99a6e", "#8a5f3a", "#5a3a22"], // 나뭇가지 팔
  a1: ["#ffc4b8", "#ff6a5c", "#c23b3b"], // 목도리 · 망토
  a2: ["#6b7288", "#434860", "#272b3d"], // 숯 단추
  a3: ["#ffd9a0", "#ff9a3c", "#d96a1e"], // 당근
  eye: "#2b2440",
};
const COAL = ["Lee", "eee", "eee"]; // 숯 눈 3×3(왼쪽 위 광택)

function face(cv, ey, dx, noseY, mouthY) {
  cv.stamp(Math.round(23.5 - dx - 1), ey - 1, COAL);
  cv.stamp(Math.round(23.5 + dx - 1), ey - 1, COAL);
  cv.poly([[22, noseY], [25.5, noseY], [24, noseY + 4.5]], T.a3, { grad: { from: [24, noseY], to: [24, noseY + 5], letters: ["u", "U", "v"] } });
  for (const [x, y] of [[19, mouthY - 1], [20, mouthY], [22, mouthY + 1], [25, mouthY + 1], [27, mouthY], [28, mouthY - 1]]) cv.put(x, y, "e");
}
function twig(cv, x0, y0, x1, y1) {
  cv.line(x0, y0, x1, y1, "A", 1);
  const dir = x1 < x0 ? -2 : 2;
  cv.line(x1, y1, x1 + dir, y1 - 2, "A", 1);
  const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
  cv.line(mx, my, mx + dir, my - 2, "A", 1);
}
const buttons = (cv, x, ys) => { for (const y of ys) cv.stamp(x, y, ["ee", "ee"]); };

/** 눈송이 — 눈 한 덩이. 머리 위에 육각 눈꽃이 앉는다. */
function stage2() {
  const cv = new Cv();
  twig(cv, 12, 32, 4, 27); twig(cv, 35, 32, 43, 27);
  cv.ellipse(23.5, 30.5, 12.5, 12, T.body);
  cv.line(24, 8, 24, 17, "g", 1); cv.line(19, 10, 28, 15, "g", 1); cv.line(28, 10, 19, 15, "g", 1); cv.put(24, 12, "L");
  face(cv, 27, 4.6, 30, 34);
  blush(cv, 31, 9.5);
  return cv;
}

/** 눈덩이 — 머리 덩이와 몸 덩이가 나뉘고 목도리를 두른다. */
function stage3() {
  const cv = new Cv();
  twig(cv, 11, 34, 4, 26); twig(cv, 36, 34, 43, 26);
  cv.ellipse(23.5, 35, 14, 9.2, T.body);
  cv.ellipse(23.5, 20, 10.8, 10.2, T.body);
  cv.ellipse(23.5, 29.5, 10.6, 2.8, T.a1);
  cv.rect(28, 29, 32, 37, T.a1, { grad: { from: [30, 29], to: [30, 37], letters: ["F", "F", "F", "h"] } });
  buttons(cv, 23, [34, 37, 40]);
  face(cv, 18, 4.5, 21, 26);
  blush(cv, 22, 9);
  return cv;
}

/** 눈사람왕 — 세 겹으로 높이 선 왕. 얼음 왕관, 붉은 망토와 흰 털깃, 눈꽃 지팡이. 머리가 작고 몸이 길다. */
function stage4() {
  const cv = new Cv();
  // 망토(뒤)
  cv.poly([[13, 24], [4, 41], [7, 43.5], [40, 43.5], [43, 41], [34, 24]], T.a1, { grad: { from: [23.5, 24], to: [23.5, 43], letters: ["F", "F", "F", "h"] } });
  twig(cv, 13, 31, 4, 24);
  // 눈꽃 지팡이
  cv.line(44, 8, 44, 36, "A", 1);
  cv.line(44, 3, 44, 13, "g", 1); cv.line(40, 5, 47, 11, "g", 1); cv.line(47, 5, 40, 11, "g", 1); cv.put(44, 8, "L");
  cv.line(35, 30, 43, 27, "A", 1);
  // 세 겹 몸: 밑동 · 가운데 · 머리
  cv.ellipse(23.5, 37, 13, 6.8, T.body);
  cv.ellipse(23.5, 28, 9.8, 7.6, T.body);
  cv.ellipse(23.5, 15, 8.2, 7.6, T.body);
  // 얼음 왕관
  for (const [x, ty, w] of [[17.5, 3.5, 3.6], [20.5, 1.5, 4], [23.5, 0, 4.4], [26.5, 1.5, 4], [29.5, 3.5, 3.6]]) spike(cv, x, 9.5, x, ty, w, T.body, { grad: ["g", "g", "L"] });
  // 흰 털깃 + 붉은 목도리
  cv.ellipse(23.5, 22, 9.2, 2.6, T.body);
  cv.ellipse(23.5, 23.5, 9.8, 2.2, T.a1);
  buttons(cv, 23, [27, 30, 33]);
  face(cv, 14, 3.8, 15.5, 19.5);
  blush(cv, 17, 7);
  return cv;
}

const lineage = { pal: PAL, fur: "b", pad: "d", stages: [stage2, stage3, stage4] };

export default lineage;
