// 수조 · 낚시 두 번째 리뷰 — 2026-11-21 [사용자: "다 진행해"] ① ~ ⑪
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { breedInfo, nextHuntAt, kstWhen } from "./aquatoday.ts";
import { BREED_H, stow, type AquaFish, type AquaState } from "./aquarium.ts";
import { HUNGRY_BELOW, mealTime } from "./predation.ts";
import { NUDGE_HUNGRY, aquaNudgeFor } from "./aquanudge.ts";
import { addLog, summarize, FISH_LOG_MAX, type FishLogEntry } from "./fishlog.ts";
import type { IslandState } from "./island.ts";

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const fish = (id: number, family: string, stage: 0 | 1 | 2): AquaFish => ({ id, family, stage, growH: 0, goodH: 0, totalH: 0 } as unknown as AquaFish);
const T0 = Date.UTC(2026, 10, 21, 3);
const tank = (over: Partial<AquaState>): AquaState => ({ tank: 3, fish: [], placed: [], bag: {}, dex: [], hunger: 100, water: 100, at: T0, nextId: 50, ...over } as unknown as AquaState);

test("① 다 큰 물고기는 품종이 없어도 '다 컸어요' — 목록 · 카드 둘 다", () => {
  assert.match(read("src/components/AquariumGame.tsx"), /\{f\.stage === 2 \? \(sp \? <span className=\{gradeClass\(sp\.grade\)\}>\{sp\.grade\}<\/span> : <small>다 컸어요<\/small>\)/);
  assert.match(read("src/components/aquarium/AquaCards.tsx"), /\{f\.stage === 2 \? \(sp \?[^\n]*다 컸어요/);
});

test("② 알 — 짝 · 진행 · 막힌 까닭 · 하나뿐인 계열", () => {
  assert.equal(breedInfo(tank({ fish: [fish(1, "guppy", 1)] })).pairs.length, 0);
  const single = breedInfo(tank({ fish: [fish(1, "guppy", 2)] }));
  assert.deepEqual(single.single, ["guppy"]);
  const pair = breedInfo(tank({ fish: [fish(1, "guppy", 2), fish(2, "guppy", 2)], breedH: 36 }));
  assert.deepEqual(pair.pairs, ["guppy"]);
  assert.equal(pair.blocked, null);
  assert.ok(pair.leftH !== null && Math.abs(pair.leftH - (BREED_H - 36)) < 1e-6, String(pair.leftH));
  assert.equal(breedInfo(tank({ fish: [fish(1, "guppy", 2), fish(2, "guppy", 2)], hunger: 10 })).blocked, "care");
  assert.match(read("src/components/AquariumGame.tsx"), /<BreedCard a=\{a\} \/>/);
});

test("③ 다음 사냥 시각 — 시각표의 기회 중 포만이 문턱 밑인 첫 때, 상성이 없으면 null", () => {
  assert.equal(nextHuntAt(tank({ fish: [fish(1, "guppy", 2)] }), T0), null);
  const a = tank({ fish: [fish(1, "great_white", 2), fish(2, "guppy", 0)], hunger: 50 });
  const t = nextHuntAt(a, T0);
  assert.ok(t !== null && t > T0 && t <= T0 + 72 * 3_600_000);
  assert.ok(HUNGRY_BELOW === NUDGE_HUNGRY, "알림 함수와 같은 문턱");
  assert.ok(Number.isFinite(mealTime(0)));
  assert.match(kstWhen(Date.UTC(2026, 10, 21, 6), Date.UTC(2026, 10, 21, 1)), /^오늘 오후 3시$/);
  assert.match(kstWhen(Date.UTC(2026, 10, 22, 0, 30), Date.UTC(2026, 10, 21, 1)), /^내일 오전 9시 30분$/);
});

test("⑤ 수조 알림 — 저장마다 aquaAlert, 배고프면 · 그물이 곧 팔리면 알림, 엣지 함수는 글자 그대로 복사본", () => {
  const st = { coins: 0, aquarium: tank({}) } as unknown as IslandState;
  const a = tank({ fish: [fish(1, "great_white", 2), fish(2, "guppy", 0)], hunger: 90 });
  const out = stow(st, a) as IslandState & { aquaAlert?: { perH: number; prey: number } };
  assert.ok(out.aquaAlert && out.aquaAlert.prey === 1 && out.aquaAlert.perH > 0);
  const al = out.aquaAlert!;
  assert.equal(aquaNudgeFor({ hunger: 90, at: T0 }, al, T0), null, "배부르면 없음");
  const hours = (90 - NUDGE_HUNGRY) / al.perH + 1;
  assert.match(aquaNudgeFor({ hunger: 90, at: T0 }, al, T0 + hours * 3_600_000)?.body ?? "", /배고픈 사냥꾼/);
  assert.match(aquaNudgeFor({ hunger: 100, at: T0 }, { perH: 1, prey: 0, net: T0 + 3_600_000 }, T0)?.body ?? "", /대기 그물/);
  assert.equal(aquaNudgeFor({ hunger: 100, at: T0 }, null, T0), null);
  const lib = read("src/lib/aquanudge.ts"), fn = read("supabase/functions/activity-nudge/index.ts");
  const copy = lib.slice(lib.indexOf("// ── 엣지 함수 복사본 시작 ──"), lib.indexOf("// ── 엣지 함수 복사본 끝 ──")).replace("export function aquaNudgeFor", "function aquaNudgeFor");
  assert.ok(fn.includes(copy), "함수 복사본이 다르다 — 고치면 둘 다, 그리고 다시 배포");
  assert.match(fn, /select\("couple_id, aq:state->aquarium, al:state->aquaAlert"\)/);
  assert.ok(fn.includes("if (aquaMsg && okAqua) out.push") && fn.indexOf("okAqua = canNudge(pref, localHour, \"aquarium\")") < fn.indexOf("aquaMsg && okAqua"), "설정(수조 알림 · 조용시간 — 받는 사람 시간대)을 지나야 보낸다(2026-11-23)");
});

test("④ 오늘 잡은 물고기 — 날이 바뀌면 새로, 상한, 요약", () => {
  const e = (name: string, out: FishLogEntry["out"], cm?: number, grade = 0, coins = 10): FishLogEntry => ({ t: 1, name, art: "x", cm, out, coins, grade });
  let log = addLog(null, "2026-11-21", e("붕어", "stored", 20, 1));
  log = addLog(log, "2026-11-21", e("장화", "junk"));
  log = addLog(log, "2026-11-21", e("잉어", "sold", 40, 2, 30));
  const sum = summarize(log, "2026-11-21");
  assert.deepEqual([sum.n, sum.fish, sum.junk, sum.stored, sum.coins], [3, 2, 1, 1, 50]);
  assert.equal(sum.biggest?.name, "잉어");
  assert.equal(summarize(log, "2026-11-22").n, 0, "다음 날은 비었다");
  assert.equal(addLog(log, "2026-11-22", e("붕어", "sold")).list.length, 1);
  let big = null as ReturnType<typeof addLog> | null;
  for (let i = 0; i < FISH_LOG_MAX + 10; i++) big = addLog(big, "d", e(String(i), "sold"));
  assert.equal(big!.list.length, FISH_LOG_MAX);
  const g = read("src/components/FishingGame.tsx");
  assert.equal((g.match(/logCatch\(r, c, who, t\)/g) ?? []).length, 4, "끝나는 네 길(꽝 · 담기 · 팔기 · 팔고 닫기)");
  assert.match(read("src/components/FishCollect.tsx"), /<FishToday st=\{p\.st\} who=\{p\.who\} today=\{p\.today\} \/>/);
});

test("⑥ 물고기 카드에 상성 한 줄 · ⑦ 잡아먹힌 목록은 접기", () => {
  const cards = read("src/components/aquarium/AquaCards.tsx");
  assert.match(cards, /이 물고기를 노려요/);
  assert.match(cards, /배고프면 작은 물고기 \{preys\.length\}마리/);
  const g = read("src/components/AquariumGame.tsx");
  assert.match(g, /<details className="aqua-eaten-log"/);
  assert.ok(g.indexOf("우리 물고기") < g.indexOf('id="aqua-req"'), "물고기 목록이 손님 카드보다 위");
});

test("⑨ ⑩ ⑪ 파일 나누기 — 준비 시트 · 날씨 · 수조 카드", () => {
  assert.match(read("src/components/FishingGame.tsx"), /<PrepSheet st=\{st\}/);
  assert.match(read("src/components/fishing/PrepSheet.tsx"), /export default function PrepSheet\(/);
  assert.match(read("src/lib/fishingfx.ts"), /private sky = new FxWeatherLayer\(\);/);
  assert.match(read("src/lib/fishingfxweather.ts"), /export class FxWeatherLayer/);
  for (const n of ["FishCard", "BreedCard", "FullCompare", "MemorialCard", "MorphDexCard", "LightShop", "EventCard"]) assert.match(read("src/components/aquarium/AquaCards.tsx"), new RegExp(`export function ${n}\\(`), n);
});

// 2026-11-23 리뷰 — 늦은 사냥 알림 · 버려진 수조 · 그물 사각지대
test("수조 알림 — 문턱 밑 3시간 넘으면 '벌써 사냥했을 수 있어요'(숫자 없이) · 마지막 저장 48시간 뒤엔 사냥 알림 없음 · 그물은 15시간 안", async () => {
  const { aquaNudgeFor, NUDGE_NET_H, NUDGE_STALE_H, NUDGE_LATE_H } = await import("./aquanudge.ts");
  const H = 3_600_000, T0 = Date.parse("2026-11-23T01:00:00Z");
  assert.equal(NUDGE_NET_H >= 14, true); assert.equal(NUDGE_STALE_H, 48); assert.equal(NUDGE_LATE_H, 3);
  // 저장 때 포만 80, 시간당 5 → 1시간 뒤 문턱(75). 2시간 뒤면 막 내려간 참 — 숫자로 막을 수 있다고
  assert.match(aquaNudgeFor({ hunger: 80, at: T0 }, { perH: 5, prey: 3 }, T0 + 2 * H)?.body ?? "", /3마리가 잡아먹힐 수 있어요/);
  // 10시간 뒤면 문턱 밑 9시간 — 이미 사냥했을 수 있다
  const late = aquaNudgeFor({ hunger: 80, at: T0 }, { perH: 5, prey: 3 }, T0 + 10 * H)?.body ?? "";
  assert.match(late, /벌써 사냥했을 수 있어요/); assert.doesNotMatch(late, /3마리/);
  // 버려진 수조 — 저장 49시간 뒤엔 사냥 알림 없음
  assert.equal(aquaNudgeFor({ hunger: 10, at: T0 }, { perH: 1, prey: 3 }, T0 + 49 * H), null);
  // 그물 — 14시간 뒤 팔리는 물고기도 알린다(20시 → 다음 날 10시 사이)
  assert.match(aquaNudgeFor({ hunger: 100, at: T0 }, { perH: 0, prey: 0, net: T0 + 14 * H }, T0)?.body ?? "", /대기 그물/);
});
