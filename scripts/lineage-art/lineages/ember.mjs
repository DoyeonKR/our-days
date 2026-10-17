// 불꽃 도롱뇽 — 불똥이 → 불도롱 → 염룡.
// 진화마다 **몸 구조가 바뀐다**: 알 모양 불씨 → 날씬하게 선 도롱뇽(뒤로 쓸린 프릴·긴 꼬리) → 불꽃 날개 단 용.
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, blush } from "../helpers.mjs";

const PAL = {
  body: ["#ff9468", "#f2643c", "#c23b22"], // 주홍
  belly: ["#fff3d9", "#ffe1ad", "#e8bd7e"],
  a1: ["#fff6c0", "#ffc93f", "#f08a2e"], // 불꽃: 연노랑 · 금 · 주황
  a2: ["#fffaf0", "#efe0b8", "#b89a62"], // 뿔: 뼈색
  eye: "#2b2440",
};

/** 불꽃 한 줄기 — 밑동(bx,by)에서 끝(tx,ty)까지 눈물방울 꼴. 밑동 어둡게 → 끝 밝게. */
function flame(cv, bx, by, tx, ty, w, o = {}) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const P = (t, s) => [bx + dx * t + nx * s, by + dy * t + ny * s];
  const pts = [P(0, -w / 2), P(0.35, -w * 0.62), P(0.72, -w * 0.28), [tx, ty], P(0.62, w * 0.22), P(0.3, w * 0.6), P(0, w / 2)];
  return cv.poly(pts, T.a1, { grad: { from: [bx, by], to: [tx, ty], letters: ["h", "F", "F", "f"] }, ...o });
}
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };
const plates = (cv, ys, x0, x1) => { for (const y of ys) for (let x = x0; x <= x1; x++) cv.put(x, y, "C"); };

/** 불똥이 — 알 모양. 머리와 몸이 한 덩어리, 불꽃은 점처럼 작다. */
function stage2() {
  const cv = new Cv();
  flame(cv, 32, 39, 41, 33, 4.5); // 꼬리불
  cv.ellipse(23.5, 31, 11.5, 12, T.body);
  cv.ellipse(23.5, 36, 6.2, 6, T.belly, { shade: false });
  cv.ellipse(11.8, 33.5, 2.4, 2.2, T.body);
  cv.ellipse(35.2, 33.5, 2.4, 2.2, T.body);
  mirror((mx) => { flame(cv, mx(13), 27, mx(5), 24, 4); flame(cv, mx(13), 31, mx(4), 32, 3.5); });
  flame(cv, 23.5, 20, 23.5, 8, 6);
  eyes(cv, 26, 6, "big");
  mouth(cv, 31, "smile", 3);
  blush(cv, 29, 9.5);
  return cv;
}

/** 불도롱 — 길고 가늘게 선 도롱뇽. 불꽃 프릴이 뒤로 쓸려 양옆으로 드리우고, 꼬리가 크게 휘어 오른다. */
function stage3() {
  const cv = new Cv();
  cv.poly([[27, 43], [34, 43], [40, 41], [44, 36], [45, 29], [42, 31], [40, 36], [36, 39], [29, 40]], T.body);
  flame(cv, 43.5, 31, 44.5, 17, 6);
  cv.ellipse(23.5, 32.5, 8.6, 11.5, T.body);
  cv.ellipse(23.5, 33.5, 4.8, 9.6, T.belly, { shade: false });
  plates(cv, [28, 31, 34, 37, 40], 21, 26);
  mirror((mx) => {
    cv.line(mx(16), 27, mx(11), 33, "b", 2);
    cv.ellipse(mx(10), 34, 2.2, 2, T.body);
    flame(cv, mx(15), 11, mx(2), 6, 5);
    flame(cv, mx(14.5), 15, mx(0), 16, 5.5);
    flame(cv, mx(15), 19, mx(2), 27, 5);
  });
  cv.ellipse(23.5, 15.5, 9.5, 8.5, T.body);
  flame(cv, 23.5, 8, 23.5, 0, 5.5);
  eyes(cv, 14.5, 5.2, "big");
  cv.ellipse(23.5, 20.5, 5, 2.6, T.belly, { shade: false });
  mouth(cv, 21, "smile", 2);
  return cv;
}

/** 염룡 — 불꽃 날개를 활짝 편 용. 뿔과 송곳니, 두툼한 가슴, 불꽃 꼬리. */
function stage4() {
  const cv = new Cv();
  mirror((mx) => {
    for (const [tx, ty, w] of [[0, 9, 6], [1, 17, 6.5], [2, 25, 6.5], [5, 33, 6]]) flame(cv, mx(15), 27, mx(tx), ty, w);
  });
  cv.poly([[31, 43], [38, 43], [43, 40], [45, 35], [42, 37], [39, 40], [32, 41]], T.body);
  flame(cv, 44, 38, 46.5, 28, 6);
  cv.ellipse(23.5, 33.5, 11, 10, T.body);
  cv.ellipse(23.5, 35, 6.8, 8, T.belly, { shade: false });
  plates(cv, [31, 34, 37, 40], 20, 27);
  mirror((mx) => {
    cv.ellipse(mx(11.5), 34, 3.2, 3, T.body);
    cv.poly([[mx(17), 10], [mx(13), 6], [mx(9), 0.5], [mx(14), 3.5], [mx(19), 8]], T.a2, { grad: { from: [mx(17), 10], to: [mx(9), 0.5], letters: ["t", "R", "R", "r"] } });
  });
  cv.ellipse(23.5, 16.5, 10.5, 8.5, T.body);
  flame(cv, 23.5, 8.5, 23.5, 0, 5.5);
  eyes(cv, 15, 5.5, "big");
  cv.ellipse(23.5, 21.5, 6.2, 3, T.belly, { shade: false });
  mouth(cv, 22, "smile", 3);
  cv.put(19, 23, "w"); cv.put(28, 23, "w");
  return cv;
}

const lineage = { pal: PAL, fur: "b", pad: "y", stages: [stage2, stage3, stage4] };

export default lineage;
