// 소라 게 — 소라꼬마 → 소라게 → 소라성주.
// 진화마다 **몸 구조가 바뀐다**: 껍데기가 막 돋은 납작한 아기 게 → 큰 소라를 어깨 뒤에 비스듬히 진 게 → 성탑 껍데기 앞에서 집게를 치켜든 성주.
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, blush, spike, arc } from "../helpers.mjs";

const PAL = {
  body: ["#ffc9b0", "#ff9272", "#d85a3c"],
  belly: ["#fff1e0", "#ffdcc0", "#e8b08a"],
  mark: ["#ff9a7a", "#e0603f", "#a63a22"], // 집게
  a1: ["#fffaf0", "#f3e3cf", "#cdb394"], // 껍데기
  a2: ["#e6dcff", "#b18cf5", "#8259cf"], // 껍데기 줄무늬 · 지붕
  a3: ["#fff6a8", "#ffd34f", "#e8a317"], // 창 · 깃발
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };

/** 뒤에 얹힌 소라 껍데기 — 둥근 몸통 + 뾰족한 끝(tip) + 휘감는 보라 줄무늬. */
function shell(cv, cx, cy, r, tipX, tipY) {
  spike(cv, cx, cy - r * 0.6, tipX, tipY, r * 1.5, T.a1, {});
  cv.ellipse(cx, cy, r, r * 0.95, T.a1);
  for (const k of [0.35, 0.62, 0.88]) arc(cv, cx + 1, cy + 1, r * k, 195, 335, "R", 1);
}
function claw(cv, cx, cy, r) {
  cv.ellipse(cx, cy, r, r * 0.9, T.mark);
  cv.line(Math.round(cx - r + 1), Math.round(cy), Math.round(cx - 1), Math.round(cy), "o", 1); // 집게 틈
}
const stalk = (cv, x, y0, y1) => cv.line(x, y0, x, y1, "B", 2);

/** 소라꼬마 — 납작하고 둥근 아기 게. 작은 껍데기가 오른쪽 뒤에 막 돋았다. 눈은 짧은 자루 끝에. */
function stage2() {
  const cv = new Cv();
  shell(cv, 23.5, 21, 9.5, 24.5, 5);
  cv.ellipse(23.5, 35, 12.5, 8, T.body);
  cv.ellipse(23.5, 38, 7.2, 4.4, T.belly, { shade: false });
  claw(cv, 9.5, 37, 3.6);
  claw(cv, 37.5, 37, 3.6);
  stalk(cv, 17, 26, 30); stalk(cv, 30, 26, 30);
  eyes(cv, 23, 6.5, "small");
  mouth(cv, 34, "smile", 2);
  blush(cv, 31, 10.5);
  return cv;
}

/** 소라게 — 큰 소라를 오른쪽 어깨 뒤에 비스듬히 진 게. 왼쪽 집게만 크다. 눈자루가 길다. */
function stage3() {
  const cv = new Cv();
  shell(cv, 23.5, 19, 12, 25, 0);
  cv.ellipse(23.5, 36, 14, 7.2, T.body);
  cv.ellipse(23.5, 38, 8, 4, T.belly, { shade: false });
  claw(cv, 7, 33, 5.2);
  claw(cv, 40, 35, 3.4);
  cv.line(11, 36, 8, 34, "b", 2);
  stalk(cv, 17, 22, 30); stalk(cv, 28, 22, 30);
  eyes(cv, 22, 5.5, "small");
  mouth(cv, 34, "smile", 2);
  blush(cv, 31, 11.5);
  return cv;
}

/** 소라성주 — 껍데기가 성탑이 됐다. 탑 앞에서 집게 팔을 높이 치켜든다. */
function stage4() {
  const cv = new Cv();
  // 성탑 — 가운데 본탑 + 양옆 작은 탑 + 깃발
  mirror((mx) => {
    cv.rect(Math.min(mx(7), mx(13)), 14, Math.max(mx(7), mx(13)), 30, T.a1);
    spike(cv, mx(10), 15, mx(10), 8, 8.5, T.a2, { grad: ["t", "R", "r"] });
    cv.rect(mx(10) - 1, 19, mx(10), 21, T.a3, { shade: false });
  });
  cv.rect(17, 6, 30, 30, T.a1);
  for (const k of [0.4, 0.7]) arc(cv, 24, 22, 11 * k, 195, 340, "R", 1);
  spike(cv, 23.5, 7, 23.5, 0, 15, T.a2, { grad: ["t", "R", "R", "r"] });
  cv.poly([[24.5, 0], [30, 1.5], [24.5, 3.5]], T.a3, { shade: false });
  cv.rect(22, 11, 25, 14, T.a3, { shade: false });
  // 게 몸
  cv.ellipse(23.5, 36, 14.5, 7.2, T.body);
  cv.ellipse(23.5, 38, 8.2, 4, T.belly, { shade: false });
  // 치켜든 집게 팔
  mirror((mx) => {
    cv.line(mx(11), 33, mx(7), 24, "b", 2);
    claw(cv, mx(6.5), 21.5, 5);
  });
  stalk(cv, 17, 23, 31); stalk(cv, 29, 23, 31);
  eyes(cv, 22, 5.8, "small");
  mouth(cv, 35, "smile", 2);
  blush(cv, 32, 12);
  return cv;
}

const lineage = { pal: PAL, fur: "B", pad: "d", stages: [stage2, stage3, stage4] };

export default lineage;
