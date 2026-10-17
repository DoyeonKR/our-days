// 박쥐 — 깜박이 → 밤박쥐 → 박쥐군주.
// 진화마다 **몸 구조가 바뀐다**: 큰 귀의 동그란 털뭉치(날개는 접힌 혹) → 날개를 활짝 편 박쥐(작은 몸) → 날개로 몸을 감싼 망토 군주(키 큰 귀·뾰족한 실루엣).
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, blush, spike } from "../helpers.mjs";

const PAL = {
  body: ["#c9a8ff", "#7a52d6", "#44268f"],
  belly: ["#f4eaff", "#dccbff", "#a98fe4"],
  mark: ["#9a72ec", "#5e3cb0", "#34206e"], // 날개막 · 망토
  a1: ["#fff6a8", "#ffd34f", "#e8a317"], // 별빛
  a2: ["#ffd0e2", "#ff8fb8", "#d94a85"], // 귀 안쪽
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };
const star = (cv, x, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) cv.put(x + dx, y + dy, "s"); };
const ear = (cv, bx, by, tx, ty, w) => {
  spike(cv, bx, by, tx, ty, w, T.body, {});
  const k = 0.55;
  spike(cv, bx + (tx - bx) * 0.08, by + (ty - by) * 0.08, bx + (tx - bx) * k, by + (ty - by) * k, w * 0.5, T.a2, {});
};
const fangs = (cv, y, dx = 2.5, len = 2) => {
  for (const sx of [-1, 1]) for (let i = 0; i < len; i++) cv.put(Math.round(23.5 + sx * dx - (sx > 0 ? 0 : 1)), y + i, "w");
};

/** 깜박이 — 큰 귀를 쫑긋 세운 동그란 털뭉치. 날개는 옆구리에 접힌 작은 혹. */
function stage2() {
  const cv = new Cv();
  mirror((mx) => cv.poly([[mx(13), 36], [mx(4), 34], [mx(7), 43], [mx(14), 42]], T.mark));
  cv.ellipse(23.5, 38.5, 8.2, 5, T.belly);
  cv.ellipse(23.5, 27, 11, 10, T.body);
  ear(cv, 16, 21, 9, 3, 9);
  ear(cv, 31, 21, 38, 3, 9);
  eyes(cv, 26, 5.5, "big");
  mouth(cv, 31, "smile", 2);
  fangs(cv, 32);
  blush(cv, 29, 8.5);
  return cv;
}

/** 밤박쥐 — 날개를 활짝 편 박쥐. 몸은 작고 날개막이 양쪽으로 넓게 펼쳐지며 손가락뼈가 비친다. */
function stage3() {
  const cv = new Cv();
  mirror((mx) => {
    cv.poly([[mx(14), 28], [mx(8), 21], [mx(0), 14], [mx(2), 24], [mx(0), 33], [mx(5), 31], [mx(6), 41], [mx(10), 36], [mx(14), 40]], T.mark);
    cv.line(mx(14), 28, mx(1), 15, "a", 1); cv.line(mx(14), 31, mx(1), 33, "a", 1); cv.line(mx(14), 33, mx(7), 41, "a", 1);
  });
  cv.ellipse(23.5, 37, 8.5, 6.5, T.body);
  cv.ellipse(23.5, 38, 5, 4.8, T.belly);
  cv.ellipse(23.5, 24, 11.5, 10, T.body);
  ear(cv, 15.5, 18, 8, 0, 9.5);
  ear(cv, 31.5, 18, 39, 0, 9.5);
  eyes(cv, 23, 5.8, "big");
  mouth(cv, 28, "smile", 2);
  fangs(cv, 29);
  blush(cv, 26, 9);
  return cv;
}

/** 박쥐군주 — 날개를 망토처럼 몸에 둘러 키 큰 종 모양이 됐다. 높이 솟은 귀, 털깃, 망토 안쪽 별빛. */
function stage4() {
  const cv = new Cv();
  // 망토(날개막) — 어깨에서 밑단으로 퍼지며 물결 모양으로 끝난다
  cv.poly([[14, 24], [8, 32], [2, 43], [8, 40], [14, 43.5], [20, 40], [27, 40], [33, 43.5], [39, 40], [45, 43], [40, 32], [33, 24]], T.mark);
  cv.poly([[17, 28], [13, 40], [34, 40], [30, 28]], T.belly, { shade: false });
  cv.ellipse(23.5, 33, 7, 8, T.body);
  cv.ellipse(23.5, 34, 4.4, 6.5, T.belly);
  for (const [x, y] of [[7, 37], [40, 37], [10, 30], [37, 30], [4, 40], [43, 40]]) star(cv, x, y);
  cv.ellipse(23.5, 27.5, 9.8, 3.6, T.belly, { shade: false }); // 털깃
  cv.ellipse(23.5, 19, 10.8, 9.6, T.body);
  ear(cv, 15.5, 14, 8, 0, 9.5);
  ear(cv, 31.5, 14, 39, 0, 9.5);
  eyes(cv, 18, 5.4, "big");
  mouth(cv, 23, "smile", 2);
  fangs(cv, 24, 2.6, 3);
  return cv;
}

const lineage = { pal: PAL, fur: "B", pad: "d", stages: [stage2, stage3, stage4] };

export default lineage;
