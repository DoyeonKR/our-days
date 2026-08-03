// 오늘의 경사 — 홈 하늘 축하 레이어 회귀 lock.
// 핵심 계약: **대부분의 날은 null**. 상시 축하는 축하가 아니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { occasionOf } from "./occasion.ts";
import { ALL_FX_SPRITES } from "./pixelfx.ts";

const kst = (m: number, d: number) => Date.UTC(2026, m - 1, d, 3, 0, 0); // 12:00 KST

test("평범한 날은 경사가 없다 — 상시 축하는 축하가 아니다", () => {
  assert.equal(occasionOf(137, false, kst(8, 4)), null);
  assert.equal(occasionOf(1, false, kst(3, 15)), null);
  assert.equal(occasionOf(999, false, kst(6, 30)), null);
});

test("100일 단위에 축하가 뜬다 — 그 사이 날엔 안 뜬다", () => {
  for (const n of [100, 200, 1000, 2500]) {
    const o = occasionOf(n, false, kst(8, 4));
    assert.ok(o, `${n}일`);
    assert.equal(o.label, `${n}일`);
  }
  for (const n of [99, 101, 150, 1001]) assert.equal(occasionOf(n, false, kst(8, 4)), null, `${n}일`);
});

test("0일 이하는 축하하지 않는다 — 미래로 설정된 시작일 방어", () => {
  assert.equal(occasionOf(0, false, kst(8, 4)), null);
  assert.equal(occasionOf(-100, false, kst(8, 4)), null);
});

test("기념일 당일이 100일 단위를 이긴다 — 겹치면 더 '우리 것'이 이긴다", () => {
  const o = occasionOf(100, true, kst(8, 4));
  assert.ok(o);
  assert.equal(o.id, "dday");
});

test("크리스마스·새해는 절기로 잡히되 우리 기념일보다 뒤다", () => {
  assert.equal(occasionOf(50, false, kst(12, 25))?.id, "xmas");
  assert.equal(occasionOf(50, false, kst(12, 24))?.id, "xmas");
  assert.equal(occasionOf(50, false, kst(12, 26)), null);
  assert.equal(occasionOf(50, false, kst(1, 1))?.id, "newyear");
  assert.equal(occasionOf(50, false, kst(1, 2)), null);
  // 우리 날이 이긴다
  assert.equal(occasionOf(100, false, kst(12, 25))?.id, "d100");
  assert.equal(occasionOf(50, true, kst(1, 1))?.id, "dday");
});

test("KST 기준 — UTC 로 판정하면 하루가 어긋난다", () => {
  // 2026-12-24 20:00 UTC = 2026-12-25 05:00 KST → 크리스마스여야 한다
  assert.equal(occasionOf(50, false, Date.UTC(2026, 11, 24, 20, 0, 0))?.id, "xmas");
  // 2026-12-25 16:00 UTC = 2026-12-26 01:00 KST → 이미 지났다
  assert.equal(occasionOf(50, false, Date.UTC(2026, 11, 25, 16, 0, 0)), null);
});

test("모든 경사가 실재하는 입자 스프라이트를 가리킨다", () => {
  const cases = [
    occasionOf(100, false, kst(8, 4)),
    occasionOf(50, true, kst(8, 4)),
    occasionOf(50, false, kst(12, 25)),
    occasionOf(50, false, kst(1, 1)),
  ];
  for (const o of cases) {
    assert.ok(o);
    assert.ok(ALL_FX_SPRITES[o.fx], `없는 스프라이트 ${o.fx}`);
    assert.match(o.tint, /^#[0-9a-f]{6}$/i, `${o.id} 색 형식`);
    assert.ok(o.label.length > 0 && o.label.length <= 12, `${o.id} 라벨은 짧아야 한다`);
    assert.ok(o.emoji.length > 0);
  }
});

test("결정적 — 같은 입력이면 두 사람 화면이 같다", () => {
  const a = occasionOf(300, false, kst(5, 5));
  const b = occasionOf(300, false, kst(5, 5));
  assert.deepEqual(a, b);
});
