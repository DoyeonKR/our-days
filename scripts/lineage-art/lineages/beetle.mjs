// 장수풍뎅이 — 굼벵이 → 풍뎅이 → 장수풍뎅이.
// 진화마다 **몸 구조가 바뀐다**: 마디진 굼벵이 → 둥근 날개집을 진 풍뎅이 → 딱지날개를 펼치고 일어선 뿔 투구 전사.
import { Cv, T } from "../lib.mjs";
import { eyes, mouth, blush, spike } from "../helpers.mjs";

const GRUB = {
  body: ["#fffaf0", "#f6e8cc", "#cdb98e"],
  belly: ["#fffaf0", "#f6e8cc", "#cdb98e"],
  mark: ["#f6bf78", "#d98a3c", "#97501f"], // 머리
  eye: "#2b2440",
};
const BEETLE = {
  body: ["#eaa45e", "#c26a2e", "#7a3a18"],
  belly: ["#ffe1ad", "#f0c080", "#c89850"],
  mark: ["#a8602c", "#6e3418", "#41200e"], // 가슴판 · 다리
  a1: ["#9a8a80", "#5a4c44", "#302824"], // 뿔
  a2: ["#ffe0a8", "#ffb347", "#e08a1e"], // 날개 광택
  eye: "#2b2440",
};
const mirror = (fn) => { fn((x) => x); fn((x) => 47 - x); };
const HORN = { grad: { from: [23.5, 18], to: [27, 1], letters: ["h", "F", "F", "f"] } };

/** 굼벵이 — 통통한 마디 몸 + 주황 머리. 다리가 없다. */
function stage2() {
  const cv = new Cv();
  cv.ellipse(23.5, 36, 12.5, 8, T.body);
  for (const [y, h] of [[32, 8.6], [36, 11.4], [40, 9.2]]) cv.line(Math.round(23.5 - h), y, Math.round(23.5 + h - 1), y, "d", 1);
  cv.ellipse(23.5, 23.5, 10.5, 9, T.mark);
  spike(cv, 23.5, 16, 23.5, 10, 3.6, T.mark);
  eyes(cv, 22, 4.5, "small");
  cv.put(21, 28, "m"); cv.put(26, 28, "m");
  mouth(cv, 27, "flat", 1);
  blush(cv, 25, 8.5);
  return cv;
}

/** 풍뎅이 — 둥글고 낮은 날개집을 지고 여섯 다리로 선 딱정벌레. 뿔은 아직 작은 돌기. */
function stage3() {
  const cv = new Cv();
  mirror((mx) => {
    for (const [x0, y0, x1, y1, x2, y2] of [[10, 30, 5, 27, 2, 30], [9, 35, 4, 34, 1, 37], [11, 40, 6, 41, 3, 44]]) { cv.line(mx(x0), y0, mx(x1), y1, "a", 1); cv.line(mx(x1), y1, mx(x2), y2, "a", 1); }
  });
  cv.ellipse(23.5, 34, 15, 10, T.body);
  cv.line(24, 27, 24, 42, "d", 1);
  cv.ellipse(17.5, 31, 2, 4, T.body, { shade: false }); cv.put(17, 29, "H"); cv.put(17, 30, "H"); cv.put(18, 29, "H");
  cv.ellipse(23.5, 26.5, 11.5, 6.2, T.mark);
  cv.ellipse(23.5, 20, 9, 7.5, T.body);
  spike(cv, 23.5, 14.5, 23.5, 5.5, 5, T.a1, { grad: ["h", "F", "F", "f"] });
  cv.line(17, 14, 13, 8, "A", 1); cv.line(30, 14, 34, 8, "A", 1);
  eyes(cv, 20, 4, "small");
  mouth(cv, 25, "flat", 1);
  return cv;
}

/** 장수풍뎅이 — 딱지날개를 좌우로 펼치고 일어선 전사. 어깨가 넓고 허리가 가늘며, 이마에서 큰 뿔이 갈라져 솟는다. */
function stage4() {
  const cv = new Cv();
  mirror((mx) => {
    cv.poly([[mx(15), 25], [mx(8), 21], [mx(1.5), 27], [mx(0), 37], [mx(4), 43], [mx(10), 42], [mx(14), 36]], T.body); // 펼친 딱지날개
    cv.line(mx(14), 27, mx(3), 38, "d", 1);
    cv.line(mx(12), 25, mx(5), 29, "r", 1);
  });
  cv.ellipse(23.5, 38, 8.4, 5.8, T.body); // 복부
  for (const y of [36, 39, 42]) cv.line(18, y, 29, y, "d", 1);
  cv.ellipse(23.5, 28, 12.5, 6.2, T.mark); // 넓은 어깨판
  mirror((mx) => { cv.line(mx(11), 30, mx(8), 36, "a", 2); cv.ellipse(mx(7.5), 37, 2, 2, T.mark); }); // 집게 팔
  cv.ellipse(23.5, 20.5, 8.8, 7.2, T.body);
  cv.poly([[20.5, 18], [26.5, 18], [25.5, 10], [22, 10]], T.a1, HORN);
  cv.poly([[22, 10.5], [25.5, 10.5], [29.5, 2], [27, 0.8]], T.a1, HORN);
  cv.poly([[22.5, 11.5], [24, 8], [19.5, 4.5], [20.5, 9.5]], T.a1, HORN);
  eyes(cv, 20.5, 4.4, "small");
  mouth(cv, 25, "flat", 1);
  return cv;
}

const lineage = { pal: BEETLE, pals: [GRUB, BEETLE, BEETLE], fur: "A", pad: "a", stages: [stage2, stage3, stage4] };

export default lineage;
