// 계절 수조 행사 lock (2026-11-13) — [사용자 승인: "계절 수조 행사"]. 달력(KST · 경계 · 윤년 · 음력 표) · 배율 · 쪼개 정산 = 한 번 정산.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AQUA_EVENTS, EVENT_FROM, LUNAR, changeAfter, eventGuest, eventsAt, eventsOn, kstMidnight, modsOn, nextEventAfter, occurrence,
} from "./aquaevent.ts";
import { DECOR, aquaOf, buyDecor, decorOf, feedFish, placeDecor, tickAqua, type AquaFish, type AquaState, type Island } from "./aquarium.ts";
import { claimBlock, claimEventDecor, eventSaveOf, eventTints, readEventSave } from "./aquaeventclaim.ts";
import { createIsland, type IslandState } from "./island.ts";

const H = 3_600_000;
const keys = (day: string) => eventsOn(day).map((e) => e.def.key);
/** 그날 KST 정오 */
const noon = (day: string) => kstMidnight(day) + 12 * H;

test("달력 — 기간 경계(시작 날 포함 · 끝 날 제외) · 겹침(겨울 + 크리스마스 · 설날)", () => {
  const cases: [string, string[]][] = [
    ["2026-11-13", []], // 출시 전
    ["2026-11-14", ["autumn"]],
    ["2026-11-30", ["autumn"]],
    ["2026-12-01", ["winter"]],
    ["2026-12-19", ["winter"]],
    ["2026-12-20", ["winter", "xmas"]],
    ["2026-12-26", ["winter", "xmas"]],
    ["2026-12-27", ["winter"]],
    ["2027-02-04", ["winter"]],
    ["2027-02-05", ["winter", "seollal"]], // 2027 설날 2/7 ± 2
    ["2027-02-09", ["winter", "seollal"]],
    ["2027-02-10", ["winter"]],
    ["2027-02-28", ["winter"]],
    ["2027-03-01", ["spring"]],
    ["2027-04-30", ["spring"]],
    ["2027-05-01", []],
    ["2027-06-19", []],
    ["2027-06-20", ["rainy"]],
    ["2027-07-31", ["rainy"]],
    ["2027-08-01", ["summer"]],
    ["2027-08-31", ["summer"]],
    ["2027-09-01", []],
    ["2027-09-13", ["chuseok"]], // 2027 추석 9/15 ± 2
    ["2027-09-17", ["chuseok"]],
    ["2027-09-18", []],
    ["2027-10-01", ["autumn"]],
  ];
  for (const [day, want] of cases) assert.deepEqual(keys(day), want, day);
  // 한 번의 행사 id — 해를 넘는 겨울은 시작한 해로 하나
  assert.equal(eventsOn("2026-12-05")[0].id, "winter:2026");
  assert.equal(eventsOn("2027-02-20")[0].id, "winter:2026");
  assert.equal(eventsOn("2027-02-06").find((e) => e.def.key === "seollal")?.id, "seollal:2027");
});

test("윤년 — 겨울은 2월 29일까지(3월 1일 자정에 끝), 평년은 28일까지", () => {
  assert.deepEqual(keys("2028-02-29"), ["winter"]);
  assert.deepEqual(keys("2028-03-01"), ["spring"]);
  assert.equal(eventsOn("2028-02-29")[0].daysLeft, 1, "윤년 마지막 날");
  assert.equal(eventsOn("2027-02-28")[0].daysLeft, 1, "평년 마지막 날");
  assert.equal(eventsOn("2027-12-01")[0].daysLeft, 91, "2027-12 ~ 2028-02(윤년) = 31 + 31 + 29");
  assert.equal(eventsOn("2026-12-01")[0].daysLeft, 90, "2026-12 ~ 2027-02 = 31 + 31 + 28");
  assert.equal(changeAfter(noon("2028-02-28")), kstMidnight("2028-03-01"));
});

test("KST — 기기 시간대와 상관없이 한국 자정에 바뀐다", () => {
  const edge = Date.UTC(2026, 10, 30, 15, 0); // 2026-12-01 00:00 KST
  assert.deepEqual(eventsAt(edge - 1).map((e) => e.def.key), ["autumn"]);
  assert.deepEqual(eventsAt(edge).map((e) => e.def.key), ["winter"]);
  assert.equal(kstMidnight("2026-12-01"), edge);
  assert.equal(changeAfter(edge - 1), edge, "경계 바로 전 → 그 자정");
  assert.equal(changeAfter(edge), kstMidnight("2026-12-20"), "경계 위 → 다음 경계(크리스마스)");
  assert.equal(changeAfter(0), kstMidnight(EVENT_FROM), "출시 전 시각 → 출시일");
  // 다음 경계는 늘 지금보다 뒤이고, 1년 넘게 비지 않는다
  for (let t = kstMidnight("2026-11-14"); t < kstMidnight("2031-01-01"); t += 37 * H) {
    const c = changeAfter(t);
    assert.ok(c > t && c - t <= 200 * 24 * H, new Date(t).toISOString());
  }
});

test("음력 표 — Intl 의 ca-dangi(한국 음력)와 같다(설날 1/1 · 추석 8/15)", (t) => {
  let fmt: Intl.DateTimeFormat;
  try { fmt = new Intl.DateTimeFormat("ko-KR-u-ca-dangi", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }); } catch { t.skip("Intl 에 ca-dangi 가 없다"); return; }
  const md = (day: string) => {
    const p = Object.fromEntries(fmt.formatToParts(kstMidnight(day) + 12 * H).map((x) => [x.type, x.value]));
    return `${p.month}/${p.day}`;
  };
  if (md("2026-02-17") !== "1/1") { t.skip("이 런타임의 ca-dangi 가 다른 값을 낸다"); return; }
  for (const [y, d] of Object.entries(LUNAR.seollal)) assert.equal(md(`${y}-${d}`), "1/1", `설날 ${y}`);
  for (const [y, d] of Object.entries(LUNAR.chuseok)) assert.equal(md(`${y}-${d}`), "8/15", `추석 ${y}`);
  // 표 밖의 해엔 명절 행사가 없다(계절 행사는 그대로)
  assert.equal(occurrence("seollal", 2040), null);
  assert.deepEqual(keys("2040-12-05"), ["winter"]);
});

test("행사 표 — 한정 장식은 이미 있는 장식(장비 제외) · 이름 · 키가 겹치지 않는다 · 계절 다섯 + 명절 셋", () => {
  assert.equal(AQUA_EVENTS.filter((e) => e.kind === "season").length, 5);
  assert.equal(AQUA_EVENTS.filter((e) => e.kind === "holiday").length, 3);
  assert.equal(new Set(AQUA_EVENTS.map((e) => e.key)).size, AQUA_EVENTS.length);
  assert.equal(new Set(AQUA_EVENTS.map((e) => e.decor.name)).size, AQUA_EVENTS.length);
  for (const e of AQUA_EVENTS) {
    const d = decorOf(e.decor.base);
    assert.ok(d && DECOR.includes(d), `${e.key}: ${e.decor.base}`);
    assert.ok(!d.effect, `${e.key}: 장비는 한정 장식으로 주지 않는다(효과가 겹친다)`);
    // 배율은 작다 — ±15% 안
    for (const v of Object.values(e.mods ?? {})) assert.ok(v >= 0.85 && v <= 1.15, `${e.key} ${v}`);
    assert.doesNotMatch(e.blurb + e.name + e.decor.name, /\p{Extended_Pictographic}/u, "글에 이모지 없음");
  }
});

test("배율 — 행사가 없거나 출시 전이면 1 · 봄 알 · 겨울 먹이 · 한 해 합은 거의 0(하트 수도꼭지 없음)", () => {
  assert.deepEqual(modsOn("2027-05-15"), { hunger: 1, water: 1, breed: 1 });
  assert.deepEqual(modsOn("2026-01-15"), { hunger: 1, water: 1, breed: 1 }, "출시 전 겨울");
  assert.deepEqual(modsOn("2026-11-20"), { hunger: 1, water: 1, breed: 1 }, "가을은 손님 · 그림뿐");
  assert.equal(modsOn("2027-03-10").breed, 1.15);
  assert.deepEqual(modsOn("2026-12-22"), { hunger: 1.15, water: 1, breed: 0.9 }, "겨울 + 크리스마스(명절은 배율 없음)");
  assert.equal(modsOn("2027-07-01").water, 1.1);
  assert.equal(modsOn("2027-08-15").water, 0.9);
  // 한 해(2027-03-01 ~ 2028-02-29)의 알 · 물 배율 치우침 — 날 수 × (배율 − 1) 의 합이 2일치 안
  let breed = 0, water = 0;
  for (let t = kstMidnight("2027-03-01"); t < kstMidnight("2028-03-01"); t += 24 * H) {
    const m = modsOn(new Date(t + 9 * H).toISOString().slice(0, 10));
    breed += m.breed - 1; water += m.water - 1;
  }
  assert.ok(Math.abs(breed) <= 2, `알 ${breed.toFixed(2)}일치`);
  assert.ok(Math.abs(water) <= 2, `물 ${water.toFixed(2)}일치`);
});

test("손님 — 날짜로만 고른다(두 폰이 같다) · 손님 행사(장마 · 가을)에만", () => {
  assert.equal(eventGuest("2027-03-10"), null);
  const g = eventGuest("2027-07-01");
  assert.ok(g && g.event.key === "rainy" && g.event.guests!.includes(g.name));
  assert.deepEqual(eventGuest("2027-07-01"), g);
  const autumn = new Set(Array.from({ length: 30 }, (_, i) => eventGuest(`2027-10-${String(i + 1).padStart(2, "0")}`)!.name));
  assert.ok(autumn.size >= 3, "한 달 동안 여러 손님");
});

test("다음 행사 안내 — 빈 달엔 다음에 열릴 행사와 남은 날", () => {
  const n = nextEventAfter(noon("2027-05-10"));
  assert.ok(n && n.def.key === "rainy" && n.start === "2027-06-20" && n.inDays === 41);
  assert.equal(nextEventAfter(noon("2026-11-10"))?.start, EVENT_FROM, "출시 전엔 출시일의 가을");
});

/* ── 정산 — 쪼개 정산 = 한 번 정산(행사 경계를 지나도) ─────────────── */
const fish = (id: number, family: string, stage: 0 | 1 | 2, species?: string): AquaFish =>
  ({ id, family, stage, ...(species ? { species } : {}), growH: stage === 2 ? 9999 : 0, goodH: 0, totalH: 0 } as AquaFish);
function tank(at: number, breedH = 0): AquaState {
  const a = aquaOf({ aquarium: null }, at);
  return { ...a, at, hunger: 100, water: 100, nextId: 10, fish: [fish(1, "guppy", 2, "cobra_guppy"), fish(2, "guppy", 2, "tuxedo_guppy"), fish(3, "goldfish", 0)], breedH };
}
function close(x: AquaState, y: AquaState, label: string) {
  for (const k of ["hunger", "water", "breedH", "at"] as const) assert.ok(Math.abs((x[k] ?? 0) - (y[k] ?? 0)) < 1e-6, `${label} ${k}: ${x[k]} vs ${y[k]}`);
  assert.deepEqual(x.fish.map((f) => [f.id, f.stage, f.bred ?? false]), y.fish.map((f) => [f.id, f.stage, f.bred ?? false]), label);
  for (let i = 0; i < x.fish.length; i++) for (const k of ["growH", "goodH", "totalH"] as const)
    assert.ok(Math.abs(x.fish[i][k] - y.fish[i][k]) < 1e-6, `${label} 물고기 ${x.fish[i].id} ${k}`);
  assert.equal(x.eggN ?? 0, y.eggN ?? 0, `${label} 알`);
}

test("겨울 → 봄 경계를 지나는 정산 — 한 번에 해도 · 37분마다 해도 같다(알까지)", () => {
  const t0 = kstMidnight("2027-02-28") + 14 * H; // 경계 10시간 전
  const t1 = t0 + 30 * H;
  const start = tank(t0, 60);
  const once = tickAqua(start, t1).a;
  let split = start;
  for (let t = t0 + 37 * 60_000; t < t1; t += 37 * 60_000) split = tickAqua(split, t).a;
  split = tickAqua(split, t1).a;
  close(once, split, "37분");
  assert.ok((once.eggN ?? 0) >= 1, "봄 문턱을 넘어 알이 생겼다");
  // 경계에서 딱 한 번 끊어도 같다
  const b = kstMidnight("2027-03-01");
  close(once, tickAqua(tickAqua(start, b).a, t1).a, "경계에서 끊기");
});

test("배율이 정산에 듣는다 — 겨울엔 포만이 15% 오래 · 봄엔 알이 15% 빨리 · 행사 없는 날은 예전과 같다", () => {
  const plain = tickAqua(tank(noon("2027-05-12")), noon("2027-05-12") + 12 * H).a;
  const winter = tickAqua(tank(noon("2027-01-12")), noon("2027-01-12") + 12 * H).a;
  const spring = tickAqua(tank(noon("2027-03-12")), noon("2027-03-12") + 12 * H).a;
  assert.ok(Math.abs((100 - plain.hunger) - 12 * 100 / 24) < 1e-6, "행사 없는 날 — 24시간 기준");
  assert.ok(Math.abs((100 - winter.hunger) - 12 * 100 / (24 * 1.15)) < 1e-6, "겨울 — 27.6시간 기준");
  assert.ok(Math.abs((spring.breedH ?? 0) - (plain.breedH ?? 0) * 1.15) < 1e-6, `봄 알 ${spring.breedH} vs ${plain.breedH}`);
  assert.ok(Math.abs((winter.breedH ?? 0) - (plain.breedH ?? 0) * 0.9) < 1e-6, "겨울 알 0.9");
  // 성장 · 정성은 배율이 없다(물 · 포만이 '좋음' 위인 동안 같은 시간)
  assert.ok(Math.abs(spring.fish[2].growH - plain.fish[2].growH) < 1e-6);
});

test("출시 전 저장(at)이 몇십 년 전이어도 정산이 끝난다 — 경계는 출시일부터만", () => {
  const r = tickAqua(tank(0), kstMidnight("2030-01-01")).a;
  assert.equal(r.at, kstMidnight("2030-01-01"));
});

/* ── 한정 장식 받기 · 저장 ─────────────────────────────── */
const isle = (coins = 100_000): IslandState => ({ ...createIsland("콩", null, 0), coins });
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.ok(r.ok, (r as { reason?: string }).reason);
  return r as Extract<T, { ok: true }>;
}
/** 2026-11-06 까지 배포된 앱(7ab54e1)의 쓰기 — aquacare.test 의 oldClientSave 와 같다: s.aquarium 을 아는 칸으로, aquaPlus 를 옛 PLUS_KEYS 로 다시 짓고 나머지는 ...st */
const OLD_PLUS_KEYS = ["badH", "news", "newsN", "newsSeen", "care", "duoDay", "released", "net", "combos", "req", "food", "junkUsed", "breedH", "eggN"] as const;
function oldClientSave(st: Island): Island {
  const a = st.aquarium!;
  const core = { tank: Math.min(6, Math.max(1, Math.floor(a.tank))), hunger: a.hunger, water: a.water, at: a.at, nextId: a.nextId,
    fish: a.fish, placed: a.placed, ...(a.wide !== undefined ? { wide: a.wide } : {}), bag: a.bag, dex: a.dex };
  const plusIn = (st.aquaPlus ?? {}) as Record<string, unknown>, plus: Record<string, unknown> = {};
  for (const k of OLD_PLUS_KEYS) if (plusIn[k] !== undefined) plus[k] = plusIn[k];
  return { ...st, aquarium: core as AquaState, aquaPlus: plus } as Island;
}

test("받기 — 행사마다 커플 한 번 · 하트는 그대로 · 장식은 옛 앱도 아는 보관함 · 빛깔은 맨 위 칸", () => {
  const t = noon("2026-11-20");
  const s0 = isle();
  const r = ok(claimEventDecor(s0, "autumn", t));
  const s1 = r.state as Island;
  assert.equal(s1.coins, s0.coins, "하트 없음");
  assert.equal(aquaOf(s1, t).bag.java_fern, 1);
  assert.deepEqual(eventSaveOf(s1), { claimed: ["autumn:2026"], tint: { java_fern: ["autumn"] } });
  assert.match(r.note, /단풍 자바 펀/);
  // 두 번째(같은 폰 · 상대 폰이 저장 충돌 뒤 다시 읽어 누른 것) — 같은 판정에 걸린다
  assert.equal(claimEventDecor(s1, "autumn", t + H).ok, false);
  assert.match(claimBlock(s1, "autumn", t + H) ?? "", /이미 받았어요/);
  // 행사가 아닌 때 · 열리지 않은 행사
  assert.match(claimBlock(s0, "autumn", noon("2027-05-10")) ?? "", /기간이 아니에요/);
  assert.equal(claimEventDecor(s0, "spring", t).ok, false);
  assert.equal(claimEventDecor(s0, "autumn", noon("2026-11-10")).ok, false, "출시 전");
  // 다음 해 가을은 새 행사 — 또 받는다
  const s2 = ok(claimEventDecor(s1, "autumn", noon("2027-10-05"))).state;
  assert.deepEqual(eventSaveOf(s2).claimed, ["autumn:2026", "autumn:2027"]);
  assert.equal(aquaOf(s2 as Island, t).bag.java_fern, 2);
});

test("옛 앱이 수조를 다시 지어도 남는다 — 받음 표시 · 빛깔(맨 위 칸) · 장식(보관함) · 다시 받기는 막힌다", () => {
  const t = noon("2026-12-22");
  let s = ok(claimEventDecor(isle(), "winter", t)).state as Island;
  s = ok(claimEventDecor(s, "xmas", t)).state as Island;
  const old = oldClientSave(s);
  assert.deepEqual(eventSaveOf(old), eventSaveOf(s));
  assert.deepEqual(aquaOf(old, t).bag, aquaOf(s, t).bag);
  assert.equal(claimEventDecor(old, "winter", t + H).ok, false);
  // 새 앱의 다른 쓰기(사기)도 맨 위 칸을 그대로 둔다
  const bought = ok(buyDecor(old, "pebbles", t + H)).state as Island;
  assert.deepEqual(eventSaveOf(bought), eventSaveOf(s));
  assert.equal(feedFish(bought, t + 2 * H).ok, false, "물고기가 없어 먹이는 거절");
  // aquaPlus 에 새 칸을 만들지 않았다(옛 앱이 버린다)
  assert.deepEqual(Object.keys(s.aquaPlus ?? {}).filter((k) => !(OLD_PLUS_KEYS as readonly string[]).includes(k)), []);
  // 다음 버전이 더한 칸은 지우지 않는다
  const future = { ...s, aquaEvent: { ...((s as { aquaEvent?: object }).aquaEvent ?? {}), next: 7 } } as Island;
  const again = ok(claimEventDecor(future, "seollal", noon("2027-02-06"))).state as { aquaEvent?: { next?: number } };
  assert.equal(again.aquaEvent?.next, 7);
});

test("날짜는 앞으로만 — 겹친 행사는 어느 쪽을 먼저 받아도 되지만, 더 늦은 행사를 받은 뒤엔 먼저 끝난 행사를 못 받는다", () => {
  const t = noon("2026-12-22");
  const a = ok(claimEventDecor(isle(), "xmas", t)).state;
  assert.ok(claimEventDecor(a, "winter", t).ok, "크리스마스 뒤 겨울");
  const b = ok(claimEventDecor(isle(), "winter", t)).state;
  assert.ok(claimEventDecor(b, "xmas", t).ok, "겨울 뒤 크리스마스");
  // 시계가 빨랐던 폰이 2027 겨울을 받은 뒤 진짜 2027 가을(12/1 에 끝)은 못 받는다
  const ahead = ok(claimEventDecor(isle(), "winter", noon("2027-12-05"))).state;
  assert.match(claimBlock(ahead, "autumn", noon("2027-11-20")) ?? "", /지난 행사/);
});

test("빛깔 — 놓인 같은 장식을 id 순으로 앞에서부터 · 모르는 값은 버린다", () => {
  const t = noon("2026-11-20");
  let s = ok(claimEventDecor(isle(), "autumn", t)).state;
  s = ok(buyDecor(s, "java_fern", t)).state;
  s = ok(placeDecor(s, "java_fern", 30, 50, t)).state;
  s = ok(placeDecor(s, "java_fern", 60, 50, t)).state;
  const placed = aquaOf(s as Island, t).placed;
  const ids = placed.filter((p) => p.key === "java_fern").map((p) => p.id).sort((x, y) => x - y);
  assert.equal(ids.length, 2);
  assert.deepEqual(eventTints(eventSaveOf(s), placed), { [ids[0]]: "autumn" });
  assert.deepEqual(eventTints(eventSaveOf(s), []), {});
  assert.deepEqual(readEventSave({ claimed: ["nope:2026", 3, "autumn:2026", "autumn:20x"], tint: { java_fern: ["autumn", "x"], zzz: ["autumn"], coral: "a" } }),
    { claimed: ["autumn:2026"], tint: { java_fern: ["autumn"] } });
  assert.deepEqual(readEventSave(null), { claimed: [], tint: {} });
});
