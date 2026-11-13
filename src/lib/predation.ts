/** 잡아먹기(2026-11-11) [사용자: "물고기가 물고기를 잡아먹는 연출까지 … 상성이 안맞으면 잡아먹는거야 … 피도 흘려야해"]
 *  상성 — 사냥하는 계열(PREDATORS)이 자기 몸 길이의 50% 이하인 다른 계열 물고기와 한 수조에 있고, **배가 고프면**(포만 75 미만) 하루 다섯 번까지(4.8시간마다 한 기회) 잡아먹을 수 있다.
 *  · 먹이를 잘 주면 안 일어난다 — 지키는 길이 있어야 벌이 아니라 긴장이 된다. 치어 사냥꾼은 못 먹는다(어린 물고기부터). 왕관(주인)은 안 먹힌다.
 *  · 저장된 상태가 바뀐다(먹힌 물고기는 수조에서 빠지고 소식에 남는다) — 그래서 정산 안에서, 절대 시각과 날짜 번호만으로 정한다
 *    (두 기기 · 쪼갠 정산 · 한 번 정산이 같은 결과. aquarium.ts 의 tickAqua 가 성장 · 알 사건과 시간 순서대로 끼워 넣는다).
 *  · 화면은 소식(news 의 ate)을 보고 3D 수조에서 사냥 장면을 다시 그린다(scene.ts — 다가가 물고 피가 번진다). 순수 · three 없음. */

/** 사냥하는 계열 — 실제로 물고기를 잡아먹는 종(상어 · 가물치 · 쏘가리 · 메기 · 뱀장어 · 아로와나 · 두족류 · 심해 포식자 · 대형 회유어 …). 걸러 먹는 고래상어 · 넓은주둥이상어 · 만타는 아니다 */
export const PREDATORS: ReadonlySet<string> = new Set([
  "great_white", "hammerhead", "blue_shark", "leopard_shark", "nurse_shark",
  "snakehead", "mandarin_fish", "catfish", "eel", "arowana", "perch_kkeokji", "sea_bass", "rockfish",
  "octopus", "squid", "giant_squid", "kraken", "anglerfish", "gulper_eel",
  "bluefin", "yellowtail", "hairtail", "coelacanth",
  "sleeper", "skygazer", "rainbow_trout", "largemouth_bass", "char", "arapaima", "oscar", "redtail_catfish", "piranha", "electric_eel", "moray", "lionfish", "grouper", "marlin", "spanish_mackerel", "cod", "scorpionfish", "goosefish", "swordfish", "barracuda", "dolphinfish", "viperfish", "frilled_shark",
  "spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "otter",
]);
/** 먹이 크기 — 사냥꾼 몸 길이의 이 비율 이하 */
export const PREY_RATIO = 0.5;
/** 배가 이 밑일 때만 사냥한다 */
export const HUNGRY_BELOW = 75;
/** 사냥 기회의 확률(조건이 맞을 때) — 2026-11-13 [사용자: "사냥 하는 빈도수가 너무 낮은 것 같아"] 하루 한 번 · 0.5 · 포만 60 · 몸 45% 에서
 *  하루 다섯 번(4.8시간마다 한 기회 — 같은 날 사용자: "하루에 사냥 최대5번") · 0.6 · 포만 75 · 몸 50% 로 올렸다. 배부름(75 이상)이면 여전히 안 일어난다 */
export const MEAL_CHANCE = 0.6;
export const DAY_MS = 86_400_000;
/** 하루의 사냥 기회 수 — 기회마다 그 기회 칸 안의 정해진 한 때 */
export const MEAL_SLOTS = 5;
const SLOT_MS = DAY_MS / MEAL_SLOTS;

export type MealFish = { id: number; family: string; stage: 0 | 1 | 2; crown?: string; cm: number };
export const isPredator = (family: string) => PREDATORS.has(family);

/** 이 둘이 상성이 안 맞나 — pred 가 prey 를 먹을 수 있나 */
export function canEat(pred: MealFish, prey: MealFish): boolean {
  if (pred.id === prey.id || !isPredator(pred.family) || pred.stage === 0) return false;
  if (prey.crown || prey.family === pred.family) return false;
  return prey.cm > 0 && pred.cm > 0 && prey.cm <= pred.cm * PREY_RATIO;
}
/** 수조 안의 상성이 안 맞는 짝(사냥꾼, 먹이) — id 순으로 정렬(두 기기가 같은 순서) */
export function mealPairs(fish: readonly MealFish[]): [MealFish, MealFish][] {
  const out: [MealFish, MealFish][] = [];
  const sorted = [...fish].sort((a, b) => a.id - b.id);
  for (const p of sorted) if (isPredator(p.family)) for (const q of sorted) if (canEat(p, q)) out.push([p, q]);
  return out;
}

/** 정수 해시 — 날짜 번호(+ 덧값)만으로 0 ~ 1 */
export function mealHash(d: number, salt = 0): number {
  let x = (Math.imul(d | 0, 2654435761) ^ Math.imul(salt | 0, 40503)) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
/** 기회 d(= 날 × MEAL_SLOTS + 몇 번째) 의 사냥 시각(절대 ms) — 그 기회 칸 안의 정해진 한 때 */
export const mealTime = (d: number) => d * SLOT_MS + Math.floor(mealHash(d, 7) * SLOT_MS);
/** from 뒤(초과) · to 까지(이하) 처음 오는 사냥 시각 — 확률을 넘긴 날만. 없으면 null */
export function nextMealTime(from: number, to: number): { t: number; d: number } | null {
  if (!(to > from)) return null;
  for (let d = Math.floor(from / SLOT_MS); d * SLOT_MS <= to; d++) {
    const t = mealTime(d);
    if (t > from && t <= to && mealHash(d, 3) < MEAL_CHANCE) return { t, d };
  }
  return null;
}
/** 그날 누가 누구를 먹나 — 조건이 안 맞으면 null(배부름 · 짝 없음) */
export function pickMeal(fish: readonly MealFish[], hunger: number, d: number): [MealFish, MealFish] | null {
  if (hunger >= HUNGRY_BELOW) return null;
  const pairs = mealPairs(fish);
  if (!pairs.length) return null;
  return pairs[Math.floor(mealHash(d, 11) * pairs.length) % pairs.length];
}
