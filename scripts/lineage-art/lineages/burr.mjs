// 밤송이 고슴도치 — 밤톨이 → 밤송이 → 대왕밤송이.
// 진화마다 **몸 구조가 바뀐다**: 매끈한 밤톨 → 가시 둥근 등을 진 고슴도치 → 가시 후광을 두르고 일어선 대왕.
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, radial } from "../helpers.mjs";

const NUT = {
  body: ["#e0a56a", "#b06f3e", "#703f20"], // 윤나는 밤톨
  belly: ["#fff6e0", "#ffe6b8", "#ecc890"],
  a2: ["#b6f0a0", "#6fcf5a", "#3d9433"], // 잎
  eye: "#2b2440",
};
const SPIKY = {
  body: ["#dcb78e", "#bb8c5e", "#8a5f3a"], // 얼굴·귀(밝은 갈색)
  belly: ["#fff6e0", "#ffe6b8", "#ecc890"],
  mark: ["#a47446", "#6f4829", "#43291a"], // 가시 등(진갈색)
  a1: ["#ffffff", "#fff6e0", "#e8d9bd"], // 솜털 끝
  a2: ["#b6f0a0", "#6fcf5a", "#3d9433"], // 잎
  eye: "#2b2440",
};
const SPINE = ["a", "A", "A", "f"]; // 밑동(어둡게) → 끝(솜털 흰색)
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const leaf = (cv, pts, from, to) => cv.poly(pts, T.a2, { grad: { from, to, letters: ["t", "R", "r"] } });
function nose(cv, y) { cv.stamp(22, y, [".nn.", "nnnn"]); }

/** 밤톨이 — 가시 없는 매끈한 밤톨. 위가 뾰족하고 아래가 넓다. */
function stage2() {
  const cv = new Cv();
  cv.poly([[23.5, 8], [28, 12], [32, 18], [34.5, 26], [34.5, 34], [30.5, 40], [23.5, 42.5], [16.5, 40], [12.5, 34], [12.5, 26], [15, 18], [19, 12]], T.body);
  leaf(cv, [[23.5, 9.5], [29, 3], [33.5, 5], [28.5, 10.5]], [23.5, 9.5], [33.5, 5]);
  cv.ellipse(23.5, 31.5, 9.2, 8.2, T.belly, { shade: false });
  eyes(cv, 26, 5, "big");
  nose(cv, 29);
  mouth(cv, 33, "w", 3);
  cv.ellipse(14, 40, 2.6, 2.2, T.belly, { shade: false });
  cv.ellipse(33, 40, 2.6, 2.2, T.belly, { shade: false });
  return cv;
}

/** 밤송이 — 가시로 덮인 둥근 등을 지고 앞에 얼굴을 내민 고슴도치. */
function stage3() {
  const cv = new Cv();
  cv.ellipse(23.5, 28, 19, 14, T.mark);
  for (let y = 12; y <= 40; y++) for (let x = 5; x <= 42; x++) {
    const u = (x - 23.5) / 19, v = (y - 28) / 14;
    if (u * u + v * v > 0.8 || v > 0.5) continue;
    if (hash(x, y) % 13 === 0) { cv.put(x, y, "A"); cv.put(x + 1, y - 1, "A"); }
  }
  radial(cv, 23.5, 27, 15, 22.5, -178, -2, 13, 6.5, T.mark, { grad: SPINE, squash: 0.88 });
  radial(cv, 23.5, 31, 16, 21, 150, 188, 3, 5.5, T.mark, { grad: SPINE });
  radial(cv, 23.5, 31, 16, 21, -8, 30, 3, 5.5, T.mark, { grad: SPINE });
  cv.ellipse(23.5, 31, 9.5, 8.4, T.belly, { shade: false });
  cv.ellipse(14.5, 22.5, 2.8, 2.8, T.body);
  cv.ellipse(32.5, 22.5, 2.8, 2.8, T.body);
  eyes(cv, 26, 5, "big");
  nose(cv, 30);
  mouth(cv, 34, "w", 3);
  cv.ellipse(13.5, 39, 3, 2.7, T.belly, { shade: false });
  cv.ellipse(33.5, 39, 3, 2.7, T.belly, { shade: false });
  return cv;
}

/** 대왕밤송이 — 일어선 몸에 가시 후광을 두르고 정수리에 밤을 인 대왕. */
function stage4() {
  const cv = new Cv();
  radial(cv, 23.5, 26, 13, 23, -180, 0, 19, 6.5, T.mark, { grad: SPINE, squash: 0.98 });
  cv.ellipse(23.5, 26, 15, 14.5, T.mark);
  cv.ellipse(23.5, 35.5, 10, 7.8, T.belly, { shade: false }); // 배
  cv.ellipse(23.5, 20.5, 11, 9.5, T.body); // 머리
  cv.ellipse(23.5, 24.5, 7.8, 5.8, T.belly, { shade: false });
  for (const [x, y, r] of [[16.5, 9, 3.3], [23.5, 5.5, 3.6], [30.5, 9, 3.3]]) { cv.ellipse(x, y, r, r + 0.4, T.mark); cv.put(x - 1, y - 1, "f"); }
  leaf(cv, [[12, 11], [5, 6], [9, 13.5]], [12, 11], [5, 6]);
  leaf(cv, [[35, 11], [42, 6], [38, 13.5]], [35, 11], [42, 6]);
  cv.ellipse(14.5, 14.5, 2.6, 2.6, T.body);
  cv.ellipse(32.5, 14.5, 2.6, 2.6, T.body);
  eyes(cv, 20, 5.6, "big");
  nose(cv, 24);
  mouth(cv, 28, "w", 3);
  // 팔 — 양옆으로 벌려 밤을 쥔다
  for (const [x, y] of [[8.5, 33], [38.5, 33]]) { cv.ellipse(x, y, 3.6, 3.2, T.belly, { shade: false }); }
  cv.ellipse(5, 29.5, 2.6, 2.9, T.mark); cv.ellipse(42, 29.5, 2.6, 2.9, T.mark);
  return cv;
}

const lineage = { pal: SPIKY, pals: [NUT, SPIKY, SPIKY], fur: "c", pad: "C", stages: [stage2, stage3, stage4] };

export default lineage;
