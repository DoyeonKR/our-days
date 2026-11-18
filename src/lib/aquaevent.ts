/* 계절 수조 행사 (2026-11-13) — [사용자 승인: "계절 수조 행사"] 실제 달력(KST)을 따라 수조에 계절 행사가 열린다.
 *
 *   계절 다섯(봄 산란기 · 장마철 손님 · 여름 수온 · 가을 단풍 · 겨울 수온) + 명절 셋(설날 · 추석 · 크리스마스).
 *   행사마다: 기간(KST 날짜) · 작은 수조 규칙(알 · 먹이 · 물이 줄어드는 빠르기 — 수조 안에서만) · 3D 물 위 그림 · 한정 장식 하나(aquaeventclaim).
 *
 * 규칙의 뼈대
 *  · 날짜만 본다(KST 'YYYY-MM-DD'). 같은 날 = 두 폰에서 같은 행사 · 같은 규칙 · 같은 손님. Math.random 없음.
 *  · 규칙은 정산(aquarium.tickAqua)이 **구간의 시작 시각**으로 읽는다. 행사가 바뀌는 자정(changeAfter)에서 정산을 쪼개므로
 *    쪼개 정산 = 한 번 정산이 그대로다(모습이 바뀌는 때 · 알을 낳는 때와 같은 방식).
 *  · 규칙은 작다(±10~15%) · 하트 수입을 늘리지 않는다: 알(보내 주면 하트가 조금 생긴다)은 봄 +15% · 겨울 −10% 라 한 해에 거의 0,
 *    물(물갈이는 하트를 쓴다)은 장마 +10% · 여름 −10% 로 비슷하게 맞췄다. 낚시 · 미끼(미끼 1% 규칙)는 건드리지 않는다.
 *  · 행사는 EVENT_FROM(출시일) 부터 — 그 전 시각(옛 저장의 at · 테스트)엔 아무 행사도 없다. 오래된 at 이 몇십 년 치 경계를 돌지 않게도 한다.
 *  · 설날 · 추석은 음력이라 해마다 날짜 표(LUNAR) — Node 의 ca-dangi 달력으로 뽑았고 aquaevent.test 가 다시 맞춰 본다.
 *    표 밖의 해(2037~)에는 명절 행사가 없다(계절 행사는 그대로).
 *
 * ⚠ 이 파일은 가볍게 — 런타임 import 는 lib/kst 하나다(수조 엔진 · 화면이 부른다). 저장 · 보상은 aquaeventclaim. */
import { kstDate } from "./kst.ts";

export type AquaEventKey = "spring" | "rainy" | "summer" | "autumn" | "winter" | "seollal" | "chuseok" | "xmas";
/** 3D 물 위 그림(lib/aqua3d/seasonfx) — 꽃잎 · 빗방울 물결 · 거품 · 낙엽 · 얼음빛 · 장식 빛 */
export type AquaEventFx = "petal" | "rain" | "heat" | "leaf" | "frost" | "glow";
/** 정산 배율 — hunger · water: 포만 · 물이 버티는 시간(1.1 = 10% 오래), breed: 알을 향해 쌓이는 빠르기(1.15 = 15% 빨리) */
export type AquaEventMods = { hunger: number; water: number; breed: number };
export type AquaEventDef = {
  key: AquaEventKey;
  name: string;
  kind: "season" | "holiday";
  /** 카드에 보이는 한 줄 — 규칙이 있으면 규칙을 말한다 */
  blurb: string;
  fx: AquaEventFx;
  mods?: Partial<AquaEventMods>;
  /** 오늘의 손님 — 행사 동안 찾아오는 손님 이름(날짜로 고른다). 부탁(req)은 그대로다 */
  guests?: readonly string[];
  /** 3D 수조에 잠깐 들르는 손님 물고기(2026-11-18) — 물고기 모델 key(FISH_GLB · 승인된 모델 · 계열 key 와 같은 최종 key). 손님 이름(guests)은 땅 · 물가 동물이라
   *  3D 몸이 없어서 행사 느낌이 나는 물고기로 대신한다(가을 꽁치 · 겨울 빙어 · 봄 각시붕어 산란 · 장마 미꾸라지 · 여름 은어). 저장 · 정산과 무관한 그림 */
  visitor?: string;
  /** 한정 장식 — 이미 있는 장식(base) 에 행사 빛깔(tint)을 입힌다. 옛 앱 · 3D 모델 · 그림이 다 아는 장식이라 옛 앱에선 보통 장식으로 보인다 */
  decor: { base: string; name: string; tint: number; glow?: number };
};

export const AQUA_EVENTS: readonly AquaEventDef[] = [
  { key: "spring", name: "봄 산란기", kind: "season", fx: "petal", blurb: "짝이 있으면 알이 15% 빨리 생겨요 · 물 위에 벚꽃잎이 떠요",
    mods: { breed: 1.15 }, visitor: "bitterling", decor: { base: "water_lily", name: "벚꽃빛 수련", tint: 0xffb7c9 } },
  { key: "rainy", name: "장마철 손님", kind: "season", fx: "rain", blurb: "빗물 덕에 물이 10% 오래 맑아요 · 비 손님이 찾아와요",
    mods: { water: 1.1 }, guests: ["청개구리", "소금쟁이", "물달팽이", "우렁이", "장구애비"], visitor: "loach", decor: { base: "mailbox", name: "장맛비 우체통", tint: 0x8fb8e8 } },
  { key: "summer", name: "여름 수온", kind: "season", fx: "heat", blurb: "물이 따뜻해 10% 빨리 흐려져요 · 물고기가 거품을 더 내요",
    mods: { water: 0.9 }, visitor: "sweetfish", decor: { base: "sand_castle", name: "한여름 모래성", tint: 0xffd27a } },
  { key: "autumn", name: "가을 단풍", kind: "season", fx: "leaf", blurb: "물 위에 단풍잎이 떨어져요 · 가을 손님이 찾아와요",
    guests: ["고추잠자리", "도토리 다람쥐", "귀뚜라미", "가을 참새", "단풍 나비"], visitor: "saury", decor: { base: "java_fern", name: "단풍 자바 펀", tint: 0xff8a3d } },
  { key: "winter", name: "겨울 수온", kind: "season", fx: "frost", blurb: "먹이가 15% 오래 가요 · 알은 10% 천천히 생겨요 · 수면에 살얼음빛",
    mods: { hunger: 1.15, breed: 0.9 }, visitor: "smelt", decor: { base: "crystal", name: "얼음 수정 군락", tint: 0xcfeeff, glow: 0x9fd8ff } },
  { key: "seollal", name: "설날", kind: "holiday", fx: "glow", blurb: "수조 장식이 색동빛으로 반짝여요",
    decor: { base: "hanok", name: "설빔 한옥", tint: 0xffc9b8, glow: 0xff5a5a } },
  { key: "chuseok", name: "추석", kind: "holiday", fx: "glow", blurb: "수조 장식이 보름달빛으로 반짝여요",
    decor: { base: "moon_stone", name: "한가위 달의 돌", tint: 0xffe3a0, glow: 0xffc24a } },
  { key: "xmas", name: "크리스마스", kind: "holiday", fx: "glow", blurb: "수조 장식이 성탄 불빛으로 반짝여요",
    decor: { base: "treasure", name: "성탄 선물 상자", tint: 0xff9c9c, glow: 0x4fd18b } },
];
export const eventDef = (key: string): AquaEventDef | undefined => AQUA_EVENTS.find((e) => e.key === key);

/** 출시일 — 이 날(KST) 전에는 행사가 없다 */
export const EVENT_FROM = "2026-11-14";
/** 음력 명절(설날 1월 1일 · 추석 8월 15일)의 양력 날짜 — ca-dangi 로 뽑음(aquaevent.test 가 Intl 로 다시 맞춘다) */
export const LUNAR: Readonly<Record<"seollal" | "chuseok", Readonly<Record<number, string>>>> = {
  seollal: { 2026: "02-17", 2027: "02-07", 2028: "01-27", 2029: "02-13", 2030: "02-03", 2031: "01-23", 2032: "02-11", 2033: "01-31", 2034: "02-19", 2035: "02-08", 2036: "01-28" },
  chuseok: { 2026: "09-25", 2027: "09-15", 2028: "10-03", 2029: "09-22", 2030: "09-12", 2031: "10-01", 2032: "09-19", 2033: "09-08", 2034: "09-27", 2035: "09-16", 2036: "10-04" },
};
/** 명절 앞뒤로 며칠 — 연휴(전날 · 당일 · 다음날)에 하루씩 더 둬서 둘이 받을 틈을 준다 */
export const LUNAR_PAD = 2;

const DAY = 86_400_000;
/** 'YYYY-MM-DD' → 그날 KST 자정(ms) */
export const kstMidnight = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) - 9 * 3_600_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const shiftDay = (day: string, n: number) => ymd(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) + n * DAY);

/** y 해에 시작하는 그 행사의 기간 — [start, end) 날짜(end 는 그날 자정에 끝난다). 없으면 null */
export function occurrence(key: AquaEventKey, y: number): { start: string; end: string } | null {
  switch (key) {
    case "spring": return { start: `${y}-03-01`, end: `${y}-05-01` };
    case "rainy": return { start: `${y}-06-20`, end: `${y}-08-01` };
    case "summer": return { start: `${y}-08-01`, end: `${y}-09-01` };
    case "autumn": return { start: `${y}-10-01`, end: `${y}-12-01` };
    // 겨울은 해를 넘긴다 — 3월 1일 자정에 끝나서 윤년(2월 29일)도 저절로 들어간다
    case "winter": return { start: `${y}-12-01`, end: `${y + 1}-03-01` };
    case "xmas": return { start: `${y}-12-20`, end: `${y}-12-27` };
    case "seollal": case "chuseok": {
      const md = LUNAR[key][y];
      if (!md) return null;
      const d = `${y}-${md}`;
      return { start: shiftDay(d, -LUNAR_PAD), end: shiftDay(d, LUNAR_PAD + 1) };
    }
  }
}

export type ActiveEvent = { def: AquaEventDef; /** 한 번의 행사 — "winter:2026"(2026-12 ~ 2027-02 겨울 하나) */ id: string; start: string; end: string;
  /** 오늘을 넣은 남은 날(마지막 날이면 1) */ daysLeft: number };

/** 그날(KST 'YYYY-MM-DD') 열린 행사들 — 계절 하나 + 명절이 겹칠 수 있다(겨울 + 크리스마스). AQUA_EVENTS 순서 */
export function eventsOn(day: string): ActiveEvent[] {
  if (day < EVENT_FROM) return [];
  const y = Number(day.slice(0, 4)), out: ActiveEvent[] = [];
  for (const def of AQUA_EVENTS) for (const yy of [y - 1, y]) {
    const o = occurrence(def.key, yy);
    if (!o || day < o.start || day >= o.end) continue;
    out.push({ def, id: `${def.key}:${yy}`, start: o.start, end: o.end, daysLeft: Math.round((kstMidnight(o.end) - kstMidnight(day)) / DAY) });
  }
  return out;
}
export const eventsAt = (now: number) => eventsOn(kstDate(now));

const NO_MODS: AquaEventMods = { hunger: 1, water: 1, breed: 1 };
/** 그날의 정산 배율 — 열린 행사들의 곱. 행사가 없으면 1 · 1 · 1(지금까지와 똑같다) */
export function modsOn(day: string): AquaEventMods {
  let m = NO_MODS;
  for (const e of eventsOn(day)) {
    const x = e.def.mods;
    if (!x) continue;
    m = { hunger: m.hunger * (x.hunger ?? 1), water: m.water * (x.water ?? 1), breed: m.breed * (x.breed ?? 1) };
  }
  return m;
}
export const modsAt = (t: number) => modsOn(kstDate(t));

/** t 뒤로 처음 행사가 열리거나 닫히는 자정(ms) — 정산을 여기서 쪼갠다. 출시일도 경계다 */
export function changeAfter(t: number): number {
  const day = kstDate(t), y = Math.max(Number(day.slice(0, 4)), Number(EVENT_FROM.slice(0, 4)));
  let best: string | null = EVENT_FROM > day ? EVENT_FROM : null;
  for (const def of AQUA_EVENTS) for (const yy of [y - 1, y, y + 1]) {
    const o = occurrence(def.key, yy);
    if (!o) continue;
    for (const d of [o.start, o.end]) if (d > day && d >= EVENT_FROM && (best === null || d < best)) best = d;
  }
  return best === null ? Infinity : kstMidnight(best);
}

/** 다음에 열릴 행사 — 지금 아무 행사도 없을 때 카드가 미리 알린다 */
export function nextEventAfter(now: number): { def: AquaEventDef; start: string; inDays: number } | null {
  const day = kstDate(now), y = Number(day.slice(0, 4));
  let best: { def: AquaEventDef; start: string } | null = null;
  for (const def of AQUA_EVENTS) for (const yy of [y, y + 1]) {
    const o = occurrence(def.key, yy);
    if (!o || o.end <= EVENT_FROM) continue;
    const start = o.start < EVENT_FROM ? EVENT_FROM : o.start;
    if (start <= day) continue;
    if (!best || start < best.start) best = { def, start };
  }
  return best ? { ...best, inDays: Math.round((kstMidnight(best.start) - kstMidnight(day)) / DAY) } : null;
}

/** 32비트 FNV-1a — 두 폰이 같은 값을 낸다 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
/** 그날의 행사 손님(손님이 있는 행사만) — 날짜로만 고른다. 오늘의 손님 카드가 '누가 왔나'를 말한다 */
export function eventGuest(day: string): { name: string; event: AquaEventDef } | null {
  for (const e of eventsOn(day)) {
    const g = e.def.guests;
    if (g?.length) return { name: g[hash(`guest:${day}`) % g.length], event: e.def };
  }
  return null;
}

/** 'M월 D일' — 카드 글 */
export const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
/** 마지막 날(end 전날) */
export const lastDay = (e: Pick<ActiveEvent, "end">) => shiftDay(e.end, -1);

/* ── 3D 수조 쪽(2026-11-18) — 계절 헤엄 빠르기 · 손님 물고기 들르기. 둘 다 그림만(저장 · 정산 · 하트와 무관) ── */

/** 계절 헤엄 빠르기 폭 — 한여름 +13% · 한겨울 −13% */
export const SWIM_PACE_AMP = 0.13;
/** 빠르기가 가장 높은 날(7월 16일 무렵 — 1월 1일부터 196일째). 가장 낮은 날은 반년 뒤(1월 15일 무렵) */
const PACE_PEAK_DOY = 196;
/** 물고기 헤엄 빠르기 배율(1 = 예전 그대로) — 실제 날짜(KST)로 매끈하게 바뀐다.
 *  한 해를 코사인 한 바퀴로 보고, |cos| 가 0.7 아래인 봄(3월 초 ~ 5월 말) · 가을(9월 초 ~ 11월 말)은 딱 1,
 *  그 위(6 ~ 8월 · 12 ~ 2월)만 smoothstep 으로 올리고 내린다 — 계절(kst.seasonOf)과 거의 같은 경계에서 기울기 0 으로 이어진다.
 *  시각(ms)을 그대로 받아 하루 안에서도 연속이다(자정에 계단이 없다). 출시일(EVENT_FROM) 전 시각은 1 */
export function swimPaceAt(now: number): number {
  if (!Number.isFinite(now) || kstDate(now) < EVENT_FROM) return 1;
  const t = now + 9 * 3_600_000, y = new Date(t).getUTCFullYear(), doy = (t - Date.UTC(y, 0, 1)) / DAY;
  const s = Math.cos((2 * Math.PI * (doy - PACE_PEAK_DOY)) / 365.25), a = Math.abs(s);
  if (a <= 0.7) return 1;
  const k = Math.min(1, (a - 0.7) / 0.3), e = k * k * (3 - 2 * k);
  return 1 + SWIM_PACE_AMP * Math.sign(s) * e;
}

/** 손님 물고기 — 한 시간을 VISITS_PER_HOUR 칸으로 나눠 칸마다 한 번, VISIT_MIN_S ~ VISIT_MAX_S 초 들른다. 들어오고(VISIT_IN_S) 나가는(VISIT_OUT_S) 시간 포함 */
export const VISITS_PER_HOUR = 3, VISIT_MIN_S = 20, VISIT_MAX_S = 40, VISIT_IN_S = 5, VISIT_OUT_S = 5;
const HOUR = 3_600_000;
export type VisitSlot = { start: number; end: number; slot: string };
/** KST 시각(시간 번호 h · 칸 i)의 들르는 때 — 시각과 seed(두 사람이 같은 값)만 본다. 칸 안에 앞뒤 30초 여유를 둬 시간 · 날짜를 넘지 않는다 */
export function visitSlot(h: number, i: number, seed = ""): VisitSlot {
  const span = HOUR / VISITS_PER_HOUR, x = hash(`visit:${seed}:${h}:${i}`);
  const dur = (VISIT_MIN_S + (x % (VISIT_MAX_S - VISIT_MIN_S + 1))) * 1000;
  const room = Math.max(1, Math.floor((span - dur - 60_000) / 1000));
  const start = h * HOUR + i * span + 30_000 + (Math.floor(x / 64) % room) * 1000 - 9 * HOUR;
  return { start, end: start + dur, slot: `${h}:${i}` };
}
/** 지금(now, ms) 손님이 들러 있는 때 — 없으면 null. Math.random 없음(두 폰이 같은 시각에 같은 손님을 본다) */
export function visitWindow(now: number, seed = ""): VisitSlot | null {
  if (!Number.isFinite(now)) return null;
  const k = now + 9 * HOUR, h = Math.floor(k / HOUR), i = Math.min(VISITS_PER_HOUR - 1, Math.floor((k - h * HOUR) / (HOUR / VISITS_PER_HOUR)));
  const v = visitSlot(h, i, seed);
  return now >= v.start && now < v.end ? v : null;
}
/** 지금 열린 행사(keys, AQUA_EVENTS 순서)의 손님 물고기 key — 없으면 null */
export function visitorFor(keys: readonly string[]): string | null {
  for (const k of keys) { const v = eventDef(k)?.visitor; if (v) return v; }
  return null;
}
/** 들른 지 u 초(전체 dur 초) — 수조 안으로 들어온 정도 w(0 = 왼쪽 유리 밖, 1 = 제 길) · 초당 바뀌는 빠르기 dw. 짧으면 들어오고 나가는 시간을 줄인다 */
export function visitWeight(u: number, dur: number): { w: number; dw: number } {
  const edge = Math.max(0.5, Math.min(VISIT_IN_S, VISIT_OUT_S, dur / 2.5));
  const ss = (k: number) => k * k * (3 - 2 * k), ds = (k: number) => 6 * k * (1 - k);
  if (u <= 0 || u >= dur) return { w: 0, dw: 0 };
  if (u < edge) { const k = u / edge; return { w: ss(k), dw: ds(k) / edge }; }
  if (u > dur - edge) { const k = (dur - u) / edge; return { w: ss(k), dw: -ds(k) / edge }; }
  return { w: 1, dw: 0 };
}
