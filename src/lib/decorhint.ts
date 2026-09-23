// 배치판 힌트 — 빈 칸에 장식을 놓으면 **새로** 생기는 것(조합 · 생산 2배). [2026-09-24]
//
// 배치판(island/DecorBoard)이 놓을 자리를 ✨·⚡ 로 빛낸다. 힌트는 반드시 엔진 결과와 같아야 한다 —
// 빛나는 칸에 놓았는데 아무 일도 없으면 힌트가 거짓말이 된다(1차판이 실제로 그랬다: 이미 꽃 옆이라
// 2배인 벌통 주변이 전부 ⚡ 였다). decorboard.test 가 무작위 섬에서 placeDecor 결과와 맞춰 본다.
// ⚠ 규칙을 여기서 새로 만들지 않는다 — 조합은 DECOR_COMBOS, 부스트는 produce.boostBy(엔진의 표) 그대로.

import { DECOR_COMBOS, decorDef, type DecorCombo, type IslandState, type Placed } from "./island.ts";

export const comboOf = (a: string, b: string): DecorCombo | undefined =>
  DECOR_COMBOS.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** 지금 성립 중인 조합 id(ignoreId 는 없는 셈 치고) — 엔진처럼 같은 조합은 한 번만 센다. */
function liveComboIds(s: IslandState, ignoreId: string | null): Set<string> {
  const ds = s.decor.filter((p) => p.id !== ignoreId);
  const ids = new Set<string>();
  for (const p of ds)
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const q = ds.find((o) => o.x === p.x + dx && o.y === p.y + dy);
      const c = q ? comboOf(p.key, q.key) : undefined;
      if (c) ids.add(c.id);
    }
  return ids;
}

/** 생산 장식 p 가 지금 부스트 중인가(ignoreId 는 없는 셈 치고) — 엔진의 produceBoosted 와 같은 규칙. */
function boostedNow(s: IslandState, p: Placed, ignoreId: string | null): boolean {
  const d = decorDef(p.key);
  if (!d?.produce) return false;
  return s.decor.some(
    (o) => o.id !== p.id && o.id !== ignoreId && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1 && d.produce!.boostBy.includes(o.key),
  );
}

/** 빈 칸 (x,y) 에 key 를 놓으면 **새로** 생기는 것 — 아직 없는 조합 · 아직 부스트 안 된 생산 장식의 2배.
 *  이미 성립한 조합(평점은 한 번만 센다)이나 이미 2배인 벌통 옆은 빛내지 않는다.
 *  ignoreId = 옮기는 중인 장식(자기 원래 자리와는 이웃이 아니다). 없으면 null. */
export function placementHint(
  s: IslandState,
  key: string,
  x: number,
  y: number,
  ignoreId: string | null = null,
): { combos: DecorCombo[]; boost: boolean } | null {
  const d = decorDef(key);
  if (!d) return null;
  const live = liveComboIds(s, ignoreId);
  const combos: DecorCombo[] = [];
  let boost = false;
  for (const [dx, dy] of SIDES) {
    const n = s.decor.find((p) => p.x === x + dx && p.y === y + dy && p.id !== ignoreId);
    if (!n) continue;
    const c = comboOf(key, n.key);
    if (c && !live.has(c.id) && !combos.some((k) => k.id === c.id)) combos.push(c);
    // 놓는 게 생산 장식이면 — 그 자리에서 곧장 2배
    if (d.produce?.boostBy.includes(n.key)) boost = true;
    // 이웃이 생산 장식이면 — 아직 2배가 아닐 때만 새 소식
    if (decorDef(n.key)?.produce?.boostBy.includes(key) && !boostedNow(s, n, ignoreId)) boost = true;
  }
  return combos.length || boost ? { combos, boost } : null;
}
