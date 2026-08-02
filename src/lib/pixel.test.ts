// 픽셀 스프라이트 포맷 회귀 lock. [2026-08-02]
// 아트를 텍스트로 저작하므로 오타(행 길이/미정의 색)가 조용히 렌더 구멍이 된다 → 정합성 강제.
// 팔레트 스왑은 "스프라이트를 다시 그리지 않고 시간대 조명을 입히는" 핵심이라 계약을 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Sprite,
  flipX,
  frameAt,
  hash01,
  hexToRgb,
  pixelAt,
  rgbToHex,
  tintColor,
  tintPalette,
  validateSprite,
} from "./pixel.ts";

const S: Sprite = {
  w: 4,
  h: 3,
  pal: { a: "#ff0000", b: "#00ff00" },
  rows: ["ab.a", ".bb.", "a..b"],
};

test("스프라이트 정합성 — 정상은 무오류", () => {
  assert.deepEqual(validateSprite(S), []);
});

test("스프라이트 정합성 — 행 길이/행 수/미정의 색을 잡는다", () => {
  assert.ok(validateSprite({ ...S, rows: ["ab.a", ".bb.", "a..b", "aaaa"] }, "x").some((e) => /행 수/.test(e)));
  assert.ok(validateSprite({ ...S, rows: ["ab.a", ".bb", "a..b"] }, "x").some((e) => /길이/.test(e)));
  assert.ok(validateSprite({ ...S, rows: ["abZa", ".bb.", "a..b"] }, "x").some((e) => /미정의 색 'Z'/.test(e)));
});

test("픽셀 조회 — 공백/'.'/범위 밖은 투명", () => {
  assert.equal(pixelAt(S, 0, 0), "#ff0000");
  assert.equal(pixelAt(S, 1, 0), "#00ff00");
  assert.equal(pixelAt(S, 2, 0), null); // '.'
  assert.equal(pixelAt(S, -1, 0), null);
  assert.equal(pixelAt(S, 0, 9), null);
});

test("좌우 반전 — 방향 전환(행 문자열 역순)", () => {
  const f = flipX(S);
  assert.deepEqual(f.rows, ["a.ba", ".bb.", "b..a"]);
  assert.equal(pixelAt(f, 3, 0), "#ff0000"); // 원본 0열이 오른쪽 끝으로
  assert.deepEqual(validateSprite(f), []);
});

test("색 변환 — hex 왕복 + 잘못된 입력은 검정(렌더가 죽지 않게)", () => {
  assert.deepEqual(hexToRgb("#ff8000"), [255, 128, 0]);
  assert.equal(rgbToHex(255, 128, 0), "#ff8000");
  assert.deepEqual(hexToRgb("nope"), [0, 0, 0]);
  assert.equal(rgbToHex(999, -5, 12), "#ff000c", "범위 밖은 클램프");
});

test("조명 — t=0 이면 원색 유지, t=1 이면 조명색, mul 은 밝기", () => {
  assert.equal(tintColor("#204060", "#ffffff", 0, 1), "#204060");
  assert.equal(tintColor("#204060", "#ffffff", 1, 1), "#ffffff");
  // 밤: 파랗게 물들이고 어둡게.
  // ⚠ 따뜻한 베이스(#ffcf9a 는 R255 ≫ B154)는 t=0.45 로 B>R 까지 뒤집히지 않는다.
  //   올바른 계약은 "파랑/빨강 비율이 원본보다 커진다"(= 파란 쪽으로 물든다)이다.
  const base = "#ffcf9a";
  const night = tintColor(base, "#3050a0", 0.45, 0.62);
  const [r, , b] = hexToRgb(night);
  const [r0, , b0] = hexToRgb(base);
  assert.ok(b / r > b0 / r0, `밤엔 파란 쪽으로 물든다(${(b / r).toFixed(2)} > ${(b0 / r0).toFixed(2)})`);
  assert.ok(r < r0, "밝기 감쇠로 원본보다 어두워진다");
});

test("팔레트 스왑 — 키는 그대로, 색만 전부 변환(스프라이트 재작성 없음)", () => {
  const p = tintPalette(S.pal, "#3050a0", 0.5, 0.7);
  assert.deepEqual(Object.keys(p), Object.keys(S.pal));
  assert.notEqual(p.a, S.pal.a);
  assert.match(p.a, /^#[0-9a-f]{6}$/);
  // 항등 조명이면 원본 그대로
  assert.deepEqual(tintPalette(S.pal, "#000000", 0, 1), S.pal);
});

test("결정적 흔들림 — 같은 입력은 항상 같은 값(양 클라 동일 화면)", () => {
  for (const i of [0, 1, 7, 999]) {
    assert.equal(hash01(i), hash01(i));
    const v = hash01(i, 5);
    assert.ok(v >= 0 && v < 1, `범위 ${v}`);
  }
  assert.notEqual(hash01(1), hash01(2), "인덱스가 다르면 값도 다르다");
  // 분포가 한쪽에 쏠리지 않는지(파티클이 뭉치지 않게)
  const xs = Array.from({ length: 200 }, (_, i) => hash01(i, 3));
  const lo = xs.filter((v) => v < 0.5).length;
  assert.ok(lo > 60 && lo < 140, `분포 편향 ${lo}/200`);
});

test("프레임 순환 — 시간에 따라 도는 결정적 인덱스", () => {
  assert.equal(frameAt(0, 4, 100), 0);
  assert.equal(frameAt(250, 4, 100), 2);
  assert.equal(frameAt(400, 4, 100), 0, "한 바퀴");
  assert.equal(frameAt(12345, 1, 100), 0, "단일 프레임은 항상 0");
  assert.equal(frameAt(12345, 4, 0), frameAt(12345, 4, 1), "0ms 는 1ms 로 보정(0 나눗셈 방지)");
});
