/* 물때 · 달 (2026-11-12) — [사용자: "실제 날짜로 계산한 사리 · 조금, 달 모양에 따라 바다 낚시터의 입질과 대물 확률이 달라집니다. 보름달에만 오는 손님도 둡니다"]
 * 순수 계산만 둔다. 저장하지 않는다(그날 날짜에서 늘 다시 계산된다 — 둘이 같은 시각이면 같은 물때를 본다).
 *  · 달 — 평균 삭망월에 Meeus(Astronomical Algorithms 49장)의 큰 보정 항 일곱 개만 더해 실제 삭 · 망 시각을 몇 시간 안으로 맞춘다.
 *    평균값만 쓰면 반나절 넘게 어긋나 날짜 단위(음력 날 · 물때)가 하루씩 밀린다(2026-11 의 삭이 9일인데 10일로 나왔다).
 *  · 물때 — 서해안 7물때식(음력 1일 = 7물 · 8일 = 조금 · 9일 = 무시 · 10일 = 1물, 보름 뒤 같은 순서). 음력 날은 'KST 로 삭이 든 날 = 1일'.
 *    실제 물때표는 지역 · 해마다 하루쯤 다를 수 있다(남해 · 동해의 8물때식은 하루 앞선다). 게임에선 한 가지 규칙이 둘에게 같게 보이는 게 더 중요하다.
 *  · 효과는 바다(FishSpot.water === "sea")에만, 작게 — 입질까지 기다림과 대물(길이) 확률만 건드린다.
 *    ⚠ 등급 · 계열 뽑기(미끼 한 단계에 약 1% — 사용자 결정)는 건드리지 않는다. 행운(luck)으로 넘기면 lift 를 통해 1% 규칙이 흔들려서 따로 둔다.
 *  · 보름달 손님(MOON_FISH, fishingworld.ts) — 보름달 밤에만 그 바다에 오는 이미 있는 품종. 때 손님과 같은 10% 칸을 나눠 쓴다.
 *  ⚠ fishing.ts 를 값으로 부르지 않는다(fishing.ts 가 이 파일을 부른다 — 순환). */
import { fishTimeOf, type FishMoon } from "./fishingworld.ts";
import { kstDate, kstDayOf } from "./kst.ts";

const DAY_MS = 86_400_000;
/** 평균 삭망월(일) */
export const SYNODIC = 29.530588853;
/** Meeus 의 k = 0 평균 삭(JDE 2451550.09766 = 2000-01-06 14:20:37 TT). 보정 전의 시작점이다 */
const EPOCH_MS = Date.UTC(2000, 0, 6, 14, 20, 37);
/** 이 밝기를 넘으면 '보름달' — 보름 앞뒤 이틀쯤(한 달에 밤 넷 남짓) */
export const FULL_ILLUM = 0.95;

const rad = (d: number) => (d * Math.PI) / 180;
/** k 번째 삭(정수) · 망(.5)의 시각(ms). 큰 항만 써서 오차는 대개 1~2시간이다 */
export function phaseAt(k: number): number {
  const T = k / 1236.85;
  const E = 1 - 0.002516 * T;
  const M = rad(2.5534 + 29.1053567 * k), Mp = rad(201.5643 + 385.81693528 * k), F = rad(160.7108 + 390.67050284 * k);
  const full = Math.abs(k % 1) > 0.25;
  const c = full
    ? -0.40614 * Math.sin(Mp) + 0.17302 * E * Math.sin(M) + 0.01614 * Math.sin(2 * Mp) + 0.01043 * Math.sin(2 * F) + 0.00734 * E * Math.sin(Mp - M) - 0.00515 * E * Math.sin(Mp + M) + 0.00209 * E * E * Math.sin(2 * M)
    : -0.4072 * Math.sin(Mp) + 0.17241 * E * Math.sin(M) + 0.01608 * Math.sin(2 * Mp) + 0.01039 * Math.sin(2 * F) + 0.00739 * E * Math.sin(Mp - M) - 0.00514 * E * Math.sin(Mp + M) + 0.00208 * E * E * Math.sin(2 * M);
  return EPOCH_MS + (k * SYNODIC + c) * DAY_MS;
}
/** ms 바로 앞(같거나 이른) 삭의 k */
function newMoonK(ms: number): number {
  let k = Math.floor((ms - EPOCH_MS) / DAY_MS / SYNODIC);
  // 보정이 ±0.6일쯤이라 평균으로 고른 k 가 하나 어긋날 수 있다 — 앞뒤로 맞춘다
  while (phaseAt(k) > ms) k--;
  while (phaseAt(k + 1) <= ms) k++;
  return k;
}

export type MoonName = "그믐" | "초승" | "상현" | "보름" | "하현";
/** age — 삭에서 지난 날, frac — 이번 삭망월의 몇 분의 몇(0 = 삭, 0.5 = 망), illum — 밝은 면 비율 0~1, waxing — 차오르는 중(오른쪽이 밝다) */
export type MoonPhase = { age: number; frac: number; illum: number; name: MoonName; waxing: boolean; newMoon: number; lunarDay: number };
export function moonPhase(ms: number): MoonPhase {
  const k = newMoonK(ms), nm = phaseAt(k), full = phaseAt(k + 0.5), next = phaseAt(k + 1);
  // 삭 → 망, 망 → 다음 삭을 따로 0.5 씩 편다 — 실제 망은 삭망월 한가운데가 아니라(달 궤도가 타원) 한 덩어리로 펴면 가장 밝은 때가 반나절 넘게 어긋난다
  const frac = ms < full ? 0.5 * (ms - nm) / (full - nm) : 0.5 + 0.5 * (ms - full) / (next - full);
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  // 보름은 밝기로 가른다 — 칩에 '보름'이 뜨는 때와 보름달 손님이 오는 때가 같아야 한다
  const name: MoonName = illum > FULL_ILLUM ? "보름" : frac < 0.03 || frac >= 0.81 ? "그믐" : frac < 0.19 ? "초승" : frac < 0.5 ? "상현" : "하현";
  // 음력 날 — 삭이 든 KST 날이 그날 하루 내내 1일이다(한국 음력의 규칙). 그래서 '오늘 KST 의 끝'까지 든 삭을 고른다
  // (그 시각 그대로 고르면 저녁에 든 삭의 날 낮이 전달 30일로 나왔다 — 2026-07-14 는 18시 44분 삭, 음력 6월 1일)
  const dayEnd = (kstDayOf(ms) + 1) * DAY_MS - 9 * 3_600_000 - 1;
  const lunarDay = kstDayOf(ms) - kstDayOf(phaseAt(newMoonK(dayEnd))) + 1;
  return { age: (ms - nm) / DAY_MS, frac, illum, name, waxing: frac < 0.5, newMoon: nm, lunarDay };
}
/** ms 뒤의 첫 망(보름달이 가장 둥근 시각) */
export function nextFullMoon(ms: number): number {
  const k = newMoonK(ms);
  return phaseAt(k + 0.5) > ms ? phaseAt(k + 0.5) : phaseAt(k + 1.5);
}

/* ── 물때 ───────────────────────────────────────────── */

export type TideKind = "sari" | "jogeum" | "mid";
/** n — 1~15(14 = 조금, 15 = 무시). kind — 사리(6~8물: 삭 · 망 하루이틀 뒤 물이 가장 크게 드나든다) · 조금(13물 · 조금: 상현 · 하현 무렵 가장 작다) */
export type Tide = { n: number; kind: TideKind; label: string; lunarDay: number };
export const TIDE_KIND_NAME: Readonly<Record<TideKind, string>> = { sari: "사리", jogeum: "조금", mid: "중물" };
/** 음력 날 → 7물때식 물때. 1일 = 7물, 8일 = 조금(14), 9일 = 무시(15), 10일 = 1물 … 15일 = 6물, 16일 = 다시 7물.
 *  29일까지인 달은 30일(6물)을 건너뛴다(물때표의 관행과 같다). */
export const tideKindOf = (n: number): TideKind => (n >= 6 && n <= 8 ? "sari" : n === 13 || n === 14 ? "jogeum" : "mid");
export function tideOfLunarDay(lunarDay: number): Tide {
  const n = ((((lunarDay - 1 + 6) % 15) + 15) % 15) + 1;
  const kind = tideKindOf(n);
  const name = n === 14 ? "조금" : n === 15 ? "무시" : `${n}물`;
  const label = n === 14 || kind === "mid" ? name : `${name} · ${TIDE_KIND_NAME[kind]}`;
  return { n, kind, label, lunarDay };
}
export const tideOf = (ms: number): Tide => tideOfLunarDay(moonPhase(ms).lunarDay);

/** 뽑기 · 화면이 받는 지금의 달 — FishMoment.moon. full: 보름달이 뜬 KST 밤(20시~5시)인가 */
export function moonMomentOf(ms: number): FishMoon {
  const m = moonPhase(ms);
  return { tide: tideOfLunarDay(m.lunarDay).n, full: m.illum > FULL_ILLUM && fishTimeOf(ms) === "night" };
}

/* ── 효과 ───────────────────────────────────────────── */

/** 사리 — 물살이 세서 먹이가 돌고 입질이 빠르다 · 대물이 조금 더. 조금 — 물이 죽어 입질이 느리다.
 *  wait 는 입질까지 기다림의 배율, trophy 는 rollCm 의 대물 확률에 더하는 값(기본 4% → 사리 6%).
 *  ⚠ 작게 둔다 — 기다림은 한 판의 일부라 하트 벌이는 몇 % 밖에 안 움직이고, 대물은 길이 · 크기 기록에만 닿는다(등급 · 계열은 그대로). */
export const TIDE_FX: Readonly<Record<TideKind, { wait: number; trophy: number }>> = {
  sari: { wait: 0.85, trophy: 0.02 },
  jogeum: { wait: 1.1, trophy: 0 },
  mid: { wait: 1, trophy: 0 },
};
const NO_FX = TIDE_FX.mid;
/** 강 · 호수 · 늪 · 열대관엔 물때가 없다. 달을 모르면(옛 호출) 효과도 없다 */
export function tideEffect(water: string, moon: Pick<FishMoon, "tide"> | undefined): { wait: number; trophy: number } {
  if (water !== "sea" || !moon) return NO_FX;
  return TIDE_FX[tideKindOf(moon.tide)];
}

/** 달 아이콘의 밝은 면(차오르는 쪽 기준 — 기울 땐 화면이 좌우로 뒤집는다). 바깥 반원 + 종결선 타원호(rx = r·|cos|).
 *  ⚠ rx 는 반올림한다 — cos(π/2) 가 6e-17 이라 그대로 두면 경로에 지수 표기가 박힌다(홈 하늘 달에서 겪었다, README §10.5).
 *  거의 안 보이는 삭 무렵(밝기 2% 미만)은 null(어두운 원만 그린다). */
export function moonLitPath(frac: number, r = 10, c = 12): string | null {
  const f = ((frac % 1) + 1) % 1;
  const g = f < 0.5 ? f : 1 - f; // 0 ~ 0.5 로 접는다
  const cos = Math.cos(2 * Math.PI * g);
  if ((1 - cos) / 2 < 0.02) return null;
  const rx = Math.round(r * Math.abs(cos) * 100) / 100;
  // 초승 쪽은 종결선이 밝은 쪽(오른쪽)으로 불룩 — 아래 → 오른쪽 → 위는 반시계라 sweep 0, 볼록한 달은 왼쪽을 지나 sweep 1
  const sweep = g < 0.25 ? 0 : 1;
  return `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${rx} ${r} 0 0 ${sweep} ${c} ${c - r}Z`;
}

/** 화면용 'M월 D일 H시' (KST) */
export function kstWhen(ms: number): string {
  const d = kstDate(ms), h = new Date(ms + 9 * 3_600_000).getUTCHours();
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 ${h}시`;
}
