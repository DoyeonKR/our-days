// 이불 유령 — 이불이 → 이불유령 → 한밤유령.
// 진화마다 **몸 구조가 바뀐다**: 작은 물방울 이불 → "우!" 팔을 든 넓은 종 모양 → 나이트캡·촛불·긴 옷자락의 키 큰 유령.
import { Cv, T } from "../lib.mjs";
import { eyes, blush, arc } from "../helpers.mjs";

const PAL = {
  body: ["#ffffff", "#f6f2ff", "#c9bff2"],
  belly: ["#ffffff", "#f6f2ff", "#c9bff2"],
  a1: ["#fff6a8", "#ffd34f", "#f08a2e"], // 촛불
  a2: ["#a5b0ff", "#6672e0", "#3f49b0"], // 나이트캡
  a3: ["#fff6a8", "#ffd34f", "#e8a317"], // 별 · 방울
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };

/** 종 모양 이불 — 위는 둥글고 아래 밑단이 물결친다. 한 도형이라 명암이 이어진다. */
function bell(cv, cx, cy, rx, ry, hemY, n) {
  const pts = [];
  for (let a = 180; a <= 360; a += 10) pts.push([cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)]);
  pts.push([cx + rx, hemY - 1]);
  const w = (2 * rx) / n;
  for (let i = 0; i < n; i++) {
    const xr = cx + rx - i * w, xl = xr - w;
    pts.push([xr - w * 0.15, hemY + 1.8], [xr - w * 0.5, hemY + 2.6], [xl + w * 0.15, hemY + 1.8], [xl, hemY - 1]);
  }
  return cv.poly(pts, T.body);
}
const MOUTH_O = (cv, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 1], [2, 1], [0, 2], [1, 2]]) cv.put(23 + dx, y + dy, "m"); };

/** 이불이 — 물방울처럼 동글게 솟은 작은 이불. 팔도 없고 눈이 크다. */
function stage2() {
  const cv = new Cv();
  bell(cv, 23.5, 25, 11, 11, 39, 3);
  eyes(cv, 24, 5.4, "big");
  MOUTH_O(cv, 29);
  blush(cv, 27, 8.5);
  return cv;
}

/** 이불유령 — 팔을 번쩍 든 넓은 종 모양. 밑단이 넓게 물결치고 머리 위에 이불 매듭이 솟는다. */
function stage3() {
  const cv = new Cv();
  bell(cv, 23.5, 24, 14, 13, 40, 4);
  mirror((mx) => {
    cv.poly([[mx(11), 29], [mx(4), 20], [mx(1.5), 22.5], [mx(7), 32]], T.body);
    cv.ellipse(mx(2.5), 20, 2.6, 2.6, T.body);
  });
  cv.ellipse(23.5, 10, 3.4, 3.2, T.body); // 매듭
  cv.poly([[21, 10], [18, 6], [22, 8]], T.body); cv.poly([[26, 10], [29, 6], [25, 8]], T.body);
  eyes(cv, 23, 6.4, "big");
  MOUTH_O(cv, 29);
  blush(cv, 27, 9.8);
  return cv;
}

/** 한밤유령 — 나이트캡을 쓰고 촛불을 든 키 큰 유령. 어깨가 좁고 옷자락이 길게 끌린다. */
function stage4() {
  const cv = new Cv();
  bell(cv, 23.5, 20, 9.8, 10.5, 40, 4);
  cv.poly([[14.5, 26], [7, 43], [40, 43], [32.5, 26]], T.body); // 길게 끌리는 옷자락
  for (let i = 0; i < 5; i++) cv.ellipse(8 + i * 8, 43, 4.2, 2.2, T.body); // 밑단 물결
  // 나이트캡 — 이마 위에서 한쪽으로 늘어진다 + 방울 + 별
  cv.poly([[14, 13], [16, 6], [22, 1.5], [30, 3], [37, 8], [43, 12], [41, 16], [35, 13], [29, 10], [19, 11], [15, 15]], T.a2, { grad: { from: [14, 13], to: [43, 12], letters: ["r", "R", "R", "t"] } });
  cv.ellipse(42.5, 15, 2.8, 2.8, T.a3, { shade: false });
  cv.put(25, 5, "s"); cv.put(24, 5, "s"); cv.put(26, 5, "s"); cv.put(25, 4, "s"); cv.put(25, 6, "s");
  // 촛불 — 오른손
  cv.poly([[33, 32], [36, 29], [38, 31], [35, 35]], T.body); cv.ellipse(37, 29.5, 2.2, 2.2, T.body);
  cv.rect(36, 24, 38, 28, T.body, { shade: false });
  cv.poly([[37, 18], [35.5, 22], [37, 24], [38.5, 22]], T.a1, { grad: { from: [37, 24], to: [37, 18], letters: ["h", "F", "F", "f"] } });
  eyes(cv, 20, 4.8, "big");
  MOUTH_O(cv, 25);
  blush(cv, 23, 7.8);
  void arc;
  return cv;
}

const lineage = { pal: PAL, fur: "b", pad: "d", stages: [stage2, stage3, stage4] };

export default lineage;
