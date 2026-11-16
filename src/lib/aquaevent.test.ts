// 계절 수조 행사 lock (2026-11-13) — [사용자 승인: "계절 수조 행사"]. 달력(KST · 경계 · 윤년 · 음력 표) · 배율 · 쪼개 정산 = 한 번 정산.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AQUA_EVENTS, EVENT_FROM, LUNAR, changeAfter, eventGuest, eventsAt, eventsOn, kstMidnight, modsOn, nextEventAfter, occurrence,
} from "./aquaevent.ts";
import { DECOR, aquaOf, decorOf, tickAqua, type AquaFish, type AquaState } from "./aquarium.ts";

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
