// 이웃 조합 · 손님 회귀 lock
//
// 이 기능의 존재 이유는 단 하나 — 꾸미기에서 **위치가 결과를 바꾸게** 만드는 것이다.
// 아래 첫 테스트가 그 계약이고, 나머지는 그 계약이 새는 구멍(파밍·중복·비결정성)을 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECOR_COMBOS,
  DECORS,
  GUESTS,
  ACHIEVEMENTS,
  TUNING,
  activeCombos,
  knownCombos,
  comboHint,
  createIsland,
  islandRating,
  placeDecor,
  moveDecor,
  removeDecor,
  todayGuest,
  guestClaimable,
  welcomeGuest,
  kstDate,
  type IslandState,
} from "./island.ts";

const T0 = Date.UTC(2026, 7, 3, 3, 0, 0); // 2026-08-03 12:00 KST

/** 레벨·코인·유대를 넉넉히 준 테스트 섬(게이트 때문에 배치가 막히지 않게). */
function rich(): IslandState {
  const s = createIsland("콩", null, T0);
  s.level = 40;
  s.coins = 999999;
  s.bond.level = 10;
  return s;
}
/** 두 장식을 (0,0)-(1,0) 에 나란히 놓는다. */
function pairAt(s0: IslandState, a: string, b: string): IslandState {
  const s1 = placeDecor(s0, a, 0, 0, T0);
  return placeDecor(s1, b, 1, 0, T0);
}

test("조합 정의가 건전하다 — 실재 장식 · id 중복 없음 · 쌍 중복 없음", () => {
  const keys = new Set(DECORS.map((d) => d.key));
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const c of DECOR_COMBOS) {
    assert.ok(keys.has(c.a), `없는 장식 ${c.a}`);
    assert.ok(keys.has(c.b), `없는 장식 ${c.b}`);
    assert.notEqual(c.a, c.b, `${c.id}: 자기 자신과 조합할 수 없다`);
    assert.ok(!ids.has(c.id), `id 중복 ${c.id}`);
    ids.add(c.id);
    const pk = [c.a, c.b].sort().join("|");
    assert.ok(!pairs.has(pk), `같은 쌍이 두 조합에 ${pk}`); // 한 쌍이 두 조합을 켜면 보상이 겹친다
    pairs.add(pk);
    assert.ok(c.rating > 0 && c.name.length > 0 && c.line.length > 0);
  }
});

test("모든 장식이 최소 하나의 조합에 쓰인다 — '쓸모없는 장식'이 없어야 한다", () => {
  const deg = new Map<string, number>();
  for (const c of DECOR_COMBOS)
    for (const k of [c.a, c.b]) deg.set(k, (deg.get(k) ?? 0) + 1);
  const unused = DECORS.filter((d) => !deg.has(d.key)).map((d) => d.name);
  assert.deepEqual(unused, [], `조합에 안 쓰인 장식: ${unused.join(", ")}`);
});

test("한 장식이 4개 넘는 조합에 걸리지 않는다 — 동시 완성이 구조적으로 불가능해진다", () => {
  // 4방향 인접이라 한 칸의 이웃은 최대 4개. 어떤 장식의 조합 차수가 4를 넘으면
  // '모든 조합을 동시에 성립'이 원리적으로 불가능해져서 배치 퍼즐이 죽는다.
  const deg = new Map<string, number>();
  for (const c of DECOR_COMBOS)
    for (const k of [c.a, c.b]) deg.set(k, (deg.get(k) ?? 0) + 1);
  for (const [k, n] of deg) assert.ok(n <= 4, `${k} 의 조합 차수 ${n} > 4`);
});

test("세트를 가로지르는 조합이 있다 — 세트만 모으면 끝나면 안 된다", () => {
  const setOf = (k: string) => DECORS.find((d) => d.key === k)!.set;
  const cross = DECOR_COMBOS.filter((c) => setOf(c.a) !== setOf(c.b));
  assert.ok(cross.length >= 5, `세트 교차 조합 ${cross.length}개 — 너무 적다`);
});

test("★ 계약: 같은 장식이라도 붙이면 평점이 오른다(위치가 결과를 바꾼다)", () => {
  const c = DECOR_COMBOS[0];
  const s0 = rich();
  const apart = placeDecor(placeDecor(s0, c.a, 0, 0, T0), c.b, 3, 2, T0); // 떨어뜨려 놓기
  const near = pairAt(s0, c.a, c.b); // 나란히 놓기
  assert.equal(activeCombos(apart).length, 0);
  assert.deepEqual(activeCombos(near).map((x) => x.id), [c.id]);
  assert.equal(islandRating(near) - islandRating(apart), c.rating);
});

test("인접은 4방향만 — 대각선은 조합이 아니다", () => {
  const c = DECOR_COMBOS[0];
  const diag = placeDecor(placeDecor(rich(), c.a, 0, 0, T0), c.b, 1, 1, T0);
  assert.equal(activeCombos(diag).length, 0);
  const below = placeDecor(placeDecor(rich(), c.a, 0, 0, T0), c.b, 0, 1, T0);
  assert.deepEqual(below.decor.length, 2);
  assert.equal(activeCombos(below).length, 1, "세로 인접은 성립해야 한다");
});

test("순서 무관 — (a,b) 든 (b,a) 든 같은 조합", () => {
  const c = DECOR_COMBOS[1];
  assert.equal(activeCombos(pairAt(rich(), c.a, c.b)).length, 1);
  assert.equal(activeCombos(pairAt(rich(), c.b, c.a)).length, 1);
});

test("옮기기만 해도 조합이 열린다 — moveDecor 가 발견을 트리거", () => {
  const c = DECOR_COMBOS[0];
  const apart = placeDecor(placeDecor(rich(), c.a, 0, 0, T0), c.b, 3, 2, T0);
  assert.equal(knownCombos(apart).length, 0);
  const id = apart.decor.find((d) => d.key === c.b)!.id;
  const moved = moveDecor(apart, id, 1, 0);
  assert.deepEqual(knownCombos(moved).map((x) => x.id), [c.id]);
  // 조합 보상 + '첫 조합 발견' 업적 보상이 함께 들어온다
  assert.ok(moved.coins - apart.coins >= TUNING.island.combo.firstCoins);
  assert.ok(moved.log.some((l) => l.includes(c.name)), "발견이 로그에 남아야 한다");
});

test("최초 발견만 보상 — 떼었다 붙여도 코인이 다시 나오지 않는다(파밍 차단)", () => {
  const c = DECOR_COMBOS[0];
  const found = pairAt(rich(), c.a, c.b);
  const target = found.decor.find((d) => d.key === c.b)!;
  const away = moveDecor(found, target.id, 4, 3);
  assert.equal(activeCombos(away).length, 0, "떨어지면 조합은 풀린다");
  const back = moveDecor(away, target.id, 1, 0);
  assert.equal(back.coins, away.coins, "재조립은 코인을 주지 않는다");
  assert.equal(activeCombos(back).length, 1, "평점 가산은 다시 붙으면 살아난다");
});

test("같은 조합을 여러 쌍 도배해도 평점은 1회만 — 인플레 차단", () => {
  const c = DECOR_COMBOS[0];
  const one = pairAt(rich(), c.a, c.b);
  const two = placeDecor(placeDecor(one, c.a, 0, 2, T0), c.b, 1, 2, T0);
  assert.equal(activeCombos(two).length, 1);
  // 두 번째 쌍이 더한 건 장식 등급 평점뿐 — 조합 가산은 그대로다
  const extra = islandRating(two) - islandRating(one);
  assert.ok(extra > 0 && extra < c.rating + 200);
  assert.equal(activeCombos(two).filter((x) => x.id === c.id).length, 1);
});

test("장식을 치우면 조합 평점도 사라진다", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const gone = removeDecor(s, s.decor.find((d) => d.key === c.b)!.id);
  assert.equal(activeCombos(gone).length, 0);
  assert.ok(islandRating(gone) < islandRating(s));
});

test("조합 발견은 도감(catalog)에 남고 업적이 붙는다", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  assert.ok(s.catalog.includes(`combo_${c.id}`));
  assert.ok(s.achievements.includes("combo_first"));
  for (const k of ["combo_first", "combo_half", "combo_all", "guest_10"]) {
    assert.ok(ACHIEVEMENTS.some((a) => a.key === k), `업적 정의 누락 ${k}`);
  }
});

test("힌트 — 재료가 이미 섬에 있으면 '사라'가 아니라 '옮겨라'를 먼저 권한다", () => {
  const c = DECOR_COMBOS[0];
  const apart = placeDecor(placeDecor(rich(), c.a, 0, 0, T0), c.b, 3, 2, T0);
  const h = comboHint(apart, T0);
  assert.ok(h);
  assert.equal(h.kind, "move");
  assert.equal(h.combo.id, c.id);
  assert.deepEqual(h.missing, []);
});

test("힌트 — 붙여 놓으면 그 조합은 더 이상 권하지 않는다", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const h = comboHint(s, T0);
  assert.ok(!h || h.combo.id !== c.id);
});

test("힌트 — 살 수 없는 조합(레벨/유대 게이트)은 권하지 않는다", () => {
  const s = createIsland("별", null, T0); // Lv.1 · 유대 1
  const h = comboHint(s, T0);
  assert.ok(h);
  assert.equal(h.kind, "buy");
  for (const k of [h.combo.a, h.combo.b]) {
    const d = DECORS.find((x) => x.key === k)!;
    assert.ok(s.level >= d.minLevel, `${k} 레벨 게이트`);
    assert.notEqual(d.set, "couple", `${k} 유대 게이트`);
  }
});

test("힌트는 결정적 — 같은 날 같은 상태면 양쪽 클라가 같은 걸 본다", () => {
  const s = rich();
  assert.deepEqual(comboHint(s, T0), comboHint(s, T0 + 60_000));
});

test("손님 — 발견한 조합이 없으면 아직 안 온다", () => {
  assert.equal(todayGuest(rich(), T0), null);
});

test("손님 — 보러 온 조합이 붙어 있어야 맞이할 수 있다", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const v = todayGuest(s, T0);
  assert.ok(v);
  assert.equal(v.combo.id, c.id, "발견한 조합 중에서만 고른다");
  assert.ok(GUESTS.some((g) => g.id === v.guest.id));
  assert.equal(v.ready, true);
  assert.equal(guestClaimable(s, T0), true);

  const broken = moveDecor(s, s.decor.find((d) => d.key === c.b)!.id, 4, 3);
  assert.equal(todayGuest(broken, T0)!.ready, false);
  assert.equal(guestClaimable(broken, T0), false);
  assert.equal(welcomeGuest(broken, T0), broken, "안 붙어 있으면 no-op");
});

test("손님 맞이 — 보상 지급 + 하루 1회 가드", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const v = todayGuest(s, T0)!;
  const after = welcomeGuest(s, T0);
  assert.equal(after.coins - s.coins, v.reward);
  assert.equal(after.guestDay, kstDate(T0));
  assert.equal(after.guestCount, 1);
  assert.ok(after.bond.xp > s.bond.xp);
  assert.equal(welcomeGuest(after, T0), after, "같은 날 두 번은 no-op");
  assert.equal(guestClaimable(after, T0), false);
  // 다음 날은 다시 온다
  assert.equal(guestClaimable(after, T0 + 24 * 3600_000), true);
});

test("손님 선물은 평점에 비례하되 상한이 있다", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const g = TUNING.island.guest;
  const lo = todayGuest(s, T0)!.reward;
  const huge = { ...s, museum: Array.from({ length: 200 }, (_, i) => `m${i}`) };
  const hi = todayGuest(huge, T0)!.reward;
  assert.ok(hi > lo, "평점이 높으면 선물이 커진다");
  assert.equal(hi, g.coins + g.bonusMax, "상한을 넘지 않는다");
});

test("손님 선택은 결정적 — 같은 날엔 몇 번을 읽어도 같은 손님/조합", () => {
  const c = DECOR_COMBOS[0];
  const s = pairAt(rich(), c.a, c.b);
  const a = todayGuest(s, T0)!;
  const b = todayGuest(s, T0 + 3600_000)!;
  assert.equal(a.guest.id, b.guest.id);
  assert.equal(a.combo.id, b.combo.id);
});
