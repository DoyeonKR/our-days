/* 시즌 미션 — 이 기기가 센 이번 달 내 모험 수 (2026-11-13)
 * 판이 끝난 그 틱에 동기로 적는다 — 섬에 올리는 코드(lib/seasonsync)는 동적으로 받아서, 오프라인에서 그 조각을 못 받아도 수는 남는다.
 * ⚠ 모험 탭이 정적으로 부른다 — 런타임 import 는 season.ts(kst 하나) · islandsync(타입만 섬을 본다)뿐이어야 한다(season.test). */
import { gameNow } from "./islandsync.ts";
import { monthOf, type AdvStat, type AdvTally } from "./season.ts";

const KEY = "ourdays.season.adv.v1";
const keyOf = (uid: string) => `${KEY}:${uid}`;
const ADV: readonly AdvStat[] = ["advBoss", "advCatch", "advWin"];

/** 이 기기가 센 이번 달 내 모험 수 — 없거나 지난 달이면 null */
export function readAdvTally(uid: string | null, now = gameNow()): AdvTally | null {
  if (!uid) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(keyOf(uid)) ?? "null") as AdvTally | null;
    if (!raw || typeof raw.m !== "string" || raw.m !== monthOf(now)) return null;
    const out: AdvTally = { m: raw.m };
    for (const k of ADV) { const v = raw[k]; if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.floor(v); }
    return out;
  } catch {
    return null;
  }
}

/** 판이 끝난 그 틱에 — 이 기기 수에 더한다(달이 바뀌었으면 새로). 순수하지 않다(localStorage).
 *  같은 사람의 다른 기기 수와는 더해지지 않는다 — 섬에는 큰 값으로 올라간다(README §14.7) */
export function bumpAdvTally(uid: string, add: Partial<Record<AdvStat, number>>, now = gameNow()): AdvTally {
  const cur = readAdvTally(uid, now) ?? { m: monthOf(now) };
  const next: AdvTally = { ...cur };
  for (const k of ADV) next[k] = (cur[k] ?? 0) + Math.max(0, Math.floor(add[k] ?? 0));
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify(next));
  } catch {
    /* 저장 공간이 없으면 이번 판은 섬에 바로 올리는 것으로만 — 섬에 올리는 쪽(seasonsync)이 이 값을 그대로 받는다 */
  }
  return next;
}

