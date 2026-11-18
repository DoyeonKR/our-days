/* 시즌 미션 보상 받기 (2026-11-13) — 순수. 받음 표시(s.season.got)와 보상을 **같은 상태**에 넣는다:
 * 저장 충돌로 다시 돌려도 · 두 폰이 같이 눌러도 늦은 쪽은 claimBlock 에 걸려 한 번만 받는다.
 *
 *   1단계(4개) — 그 달의 수조 장식 하나(이미 있는 장식 · grantDecor — 낚시 유물 보상과 같은 길이라 보관함은 옛 앱도 아는 칸에 남는다)
 *   2단계(8개) — 시즌 찌(fishlooks 의 LIMITED_LOOKS). 이미 가졌으면 그 달 장식을 하나 더
 *   3단계(12개) — 펫 칭호 "N월 시즌 완주"(s.season.titles — 게임 탭의 우리 섬 카드 · 시즌 시트)
 * 하트는 주지 않는다 — §10.25 경제 표 밖의 하트를 만들지 않는다. 장식은 되팔 길이 없다.
 *
 * 시즌 카드 · 시트(게임 허브)가 받기를 누를 때만 동적으로 부른다 — 수조 엔진을 허브 첫 그림에 더 싣지 않으려고. */
import type { IslandState } from "./island.ts";
import { decorOf, grantDecor } from "./aquarium.ts";
import { josa } from "./josa.ts";
import { SEASON_BOBBER, TIER_REWARD, claimBlock, claimMonth, markClaimed, seasonDecorFor, tierTitleText } from "./season.ts";

export type ClaimResult = { ok: true; state: IslandState; note: string } | { ok: false; reason: string };

const rawObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});

/** 시즌 찌를 가진 목록에 넣는다 — 저장된 그대로에 더한다(claimContest 와 같은 규칙: 다음 버전이 더한 칸을 지우지 않게) */
function ownsSeasonBobber(st: IslandState): boolean {
  const owned = rawObj(rawObj(st.fishPlus).looks).owned;
  return Array.isArray(owned) && owned.includes(SEASON_BOBBER);
}
function giveSeasonBobber(st: IslandState): IslandState {
  const plus = rawObj(st.fishPlus);
  const looks = rawObj(plus.looks);
  const owned = Array.isArray(looks.owned) ? [...looks.owned] : [];
  if (!owned.includes(SEASON_BOBBER)) owned.push(SEASON_BOBBER);
  return { ...st, fishPlus: { ...plus, looks: { ...looks, owned } } };
}

function giveDecor(st: IslandState, month: string, now: number): ClaimResult {
  const key = seasonDecorFor(month);
  const g = grantDecor(st, key, now);
  if (!g.ok) return g;
  return { ok: true, state: g.state, note: `${josa(decorOf(key)?.name ?? "장식", "을/를")} 수조 보관함에 넣었어요` };
}

/** 받기 — tier 1 · 2 · 3. who = 누른 사람(칭호에 남는다).
 *  missed = 지난 달 못 받은 보상(2026-11-18) — 다음 달 첫 7일에 지난 달 장식 · 찌 · 칭호를 그대로 받는다.
 *  지난 달에 채운 단계만 · 단계마다 한 번이라 새 보상을 만들지 않는다(받을 수 있던 것을 늦게 받을 뿐). 하트는 여전히 없다 */
export function claimSeason(st: IslandState, tier: number, now: number, who: string, missed = false): ClaimResult {
  const why = claimBlock(st, tier, now, missed);
  if (why) return { ok: false, reason: why };
  const month = claimMonth(st, now, missed);
  const reward = TIER_REWARD[tier - 1];
  let res: ClaimResult;
  if (reward === "decor") res = giveDecor(st, month, now);
  else if (reward === "bobber") res = ownsSeasonBobber(st) ? giveDecor(st, month, now) : { ok: true, state: giveSeasonBobber(st), note: "시즌 찌를 받았어요 — 낚시 장비 꾸미기에서 낄 수 있어요" };
  else res = { ok: true, state: st, note: `펫 칭호 '${tierTitleText(month, 3)}'을 받았어요` };
  if (!res.ok) return res;
  return { ...res, state: markClaimed(res.state, tier, now, who, missed) };
}
