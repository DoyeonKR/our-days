// 구름 양 — 몽실이 → 구름양 → 뭉게양.
// 진화마다 **몸 구조가 바뀐다**: 동글한 구름 솜뭉치 → 큰 말린 뿔을 인 숫양(갈기 털 + 넓은 몸) → 무지개 날개와 후광을 단 구름 천사.
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, arc, blush } from "../helpers.mjs";

const PAL = {
  body: ["#ffffff", "#f6f3ff", "#c4bcee"], // 구름 털
  belly: ["#ffe9dc", "#ffd0b4", "#e8a688"], // 얼굴
  mark: ["#ece4ff", "#b9a6f0", "#8a72d4"], // 뿔 · 발굽
  a1: ["#ffc6dc", "#ff8fbb", "#e0558f"],
  a2: ["#fff2a8", "#ffd34f", "#e8a317"],
  a3: ["#c4f0ff", "#7fd8f0", "#46b6dd"],
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x, 0); fn((x) => 47 - x, 1); };
const lumps = (cv, list) => { for (const [x, y, r] of list) cv.ellipse(x, y, r, r * 0.95, T.body); };

/** 몽실이 — 뿔도 팔다리도 없는 동그란 구름 솜뭉치. */
function stage2() {
  const cv = new Cv();
  lumps(cv, [[14, 36, 6], [33, 36, 6], [23.5, 36, 9], [13, 30, 6.5], [34, 30, 6.5], [23.5, 29, 11], [17, 23, 6.5], [30, 23, 6.5], [23.5, 20, 7]]);
  cv.ellipse(23.5, 28, 8.8, 7.5, T.belly, { shade: false });
  eyes(cv, 25, 5, "big");
  mouth(cv, 31, "w", 3);
  blush(cv, 28, 8);
  return cv;
}

/** 구름양 — 숫양. 머리에 큰 말린 뿔, 얼굴 둘레에 두툼한 털 갈기, 몸은 넓고 낮은 털 덩어리. */
function stage3() {
  const cv = new Cv();
  lumps(cv, [[8, 38, 6], [39, 38, 6], [14, 34, 8], [33, 34, 8], [23.5, 35, 10.5], [23.5, 41, 6.5], [12, 41, 5], [35, 41, 5]]);
  lumps(cv, [[10, 28, 5.5], [37, 28, 5.5], [12, 21, 6.5], [35, 21, 6.5], [16, 14, 6.5], [31, 14, 6.5], [23.5, 11, 7.5]]);
  mirror((mx) => {
    const pts = [[14, 17], [8, 12], [2.5, 15], [2.5, 22], [6.5, 26.5], [11, 24.5]];
    for (let i = 0; i < pts.length - 1; i++) cv.line(mx(pts[i][0]), pts[i][1], mx(pts[i + 1][0]), pts[i + 1][1], i < 2 ? "A" : "a", 3);
    cv.ellipse(mx(12), 27, 3.2, 1.9, T.belly, { shade: false }); // 귀
  });
  cv.ellipse(23.5, 22, 8.4, 9.6, T.belly, { shade: false });
  eyes(cv, 20, 4.6, "big");
  mouth(cv, 27, "w", 3);
  blush(cv, 24, 7);
  return cv;
}

/** 뭉게양 — 무지개 날개와 금빛 후광을 단 구름 천사. 가늘고 길게 선 구름 옷자락. */
function stage4() {
  const cv = new Cv();
  // 무지개 날개 — 어깨에서 위로 말려 오르는 세 겹 호
  for (const [sx, cx, a0, a1] of [[0, 14, 188, 282], [1, 33, 258, 352]]) {
    for (const [r, ch] of [[14, "F"], [12, "R"], [10, "U"]]) arc(cv, cx, 31, r, a0, a1, ch, 2);
    void sx;
  }
  arc(cv, 23.5, 7, 6.2, 0, 360, "R", 1); // 후광
  arc(cv, 23.5, 7, 5.2, 0, 360, "r", 1);
  lumps(cv, [[23.5, 31, 10], [12, 37, 6.5], [35, 37, 6.5], [23.5, 38, 10.5], [9, 42, 4.5], [38, 42, 4.5], [23.5, 42, 6]]);
  cv.ellipse(12, 31, 3.2, 3, T.body); cv.ellipse(35, 31, 3.2, 3, T.body); // 팔 솜뭉치
  lumps(cv, [[13, 21, 5.5], [34, 21, 5.5], [15, 15, 5.5], [32, 15, 5.5], [23.5, 12, 6]]);
  cv.ellipse(23.5, 21, 8.4, 9.2, T.belly, { shade: false });
  eyes(cv, 19, 4.6, "big");
  mouth(cv, 26, "w", 3);
  blush(cv, 23, 7);
  return cv;
}

const lineage = { pal: PAL, fur: "b", pad: "A", stages: [stage2, stage3, stage4] };

export default lineage;
