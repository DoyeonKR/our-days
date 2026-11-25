/** 새우류(2026-11-14) [사용자: "새우류 추가" → "너는 스켈레톤으로만 만들고 모델이나 이미지가 필요한 것들은 다른 세션 프롬프트로 남겨"]
 *  게임 쪽 뼈대만 먼저 넣었다 — 계열 표 · 몸길이 · 낚시터 자리 · 습성은 여기 한 곳에 있고, `SHRIMP_ON` 이 false 인 동안은 어디에도 안 들어간다
 *  (수조는 승인된 3D 모델이 있는 물고기만 그리고, 도감 · 낚시 결과는 사진풍 그림을 쓴다 — 그림 없이 켜면 빈 칸 · 임시 물고기가 보인다).
 *  그림 · 모델은 그림 세션 몫이다: design/ART-GUIDE.md 의 D(체리새우 · 대하 · 독도새우 × 새끼 · 어린 · 다 큰 = 그림 9 · 모델 9).
 *
 *  ── 켜는 순서(그림이 들어온 뒤 Claude 세션) ──
 *  1. 그림 9장(`public/aqua/fish` · `sm`)과 GLB 9개(`public/aqua/models/fish`)가 있는지 · 검수 시트를 사용자에게 보이고 승인(style-approvals.json · models.json).
 *  2. 그림 목록 `src/lib/aquaimages.ts`, 모델 목록 `src/lib/aqua3d/glb.ts`, `PREPARED_FISH_KEYS`(aqua3d/prepared.ts)에 9 key 를 더한다.
 *  3. 여기 `SHRIMP_ON = true` — FAMILIES · FISH_BASE_CM · 민물 · 관상어 · 낚시터 자리 · 습성이 함께 켜진다(shrimp.test 가 켠 뒤의 모양을 미리 잰다).
 *  4. 서버: 새 migration(레포의 가장 큰 번호 다음)으로 `private.fish_family_ok` 목록에 세 key 를 더한다(serverguard.test 가 FAMILIES 와 견준다).
 *  5. `node scripts/aqua-art-prompts.mjs`(프롬프트 표) · README · 숫자 잠금(계열 · 폼 수) 갱신.
 */
import type { FishHabit } from "./aqua3d/habits.ts";

/** 켜는 스위치 — 2026-11-14 그림 9 · 모델 9 승인 뒤 켰다(README §14.4.6) */
export const SHRIMP_ON = true;

export type StagedFamily = {
  key: string; name: string; grade: "흔함" | "보통" | "고급" | "희귀" | "영웅" | "전설" | "신화" | "태초";
  /** 계열 표 값(aquarium.ts 의 AquaFamily) — 값어치 순서 · 다 크는 시간 · 담을 수 있는 수조 단계 · 화면 크기(%) */
  price: number; hours: number; minTank: number; size: number;
  /** 다 큰 몸길이(cm) */
  cm: number;
  fresh: boolean; ornamental: boolean;
  /** 낚시터 자리 — [낚시터 key, 무게, 앞에 둘 계열(그 바로 뒤에 넣는다)]. 미끼 1% 규칙: 그 낚시터 시작 미끼보다 싼 계열은 넣지 않는다 */
  spots: readonly (readonly [string, number, string])[];
  habit: FishHabit;
};

/** 바닥을 기며 더듬이로 살피다가, 놀라면 꼬리를 배 쪽으로 튕겨 뒤로 휙 달아난다(dart) — 몸은 바닥에 붙는다 */
const crawl = (more: Partial<FishHabit>): FishHabit => ({ lo: -5, hi: -3.6, speed: 0.07, reach: 0.6, depth: 1.2, hug: 0.12, tilt: 0, rest: 0.55, hop: 0.6, dart: 0.25, pace: 1.3, idle: 0.4, ...more });

export const SHRIMP_FAMILIES: readonly StagedFamily[] = [
  // 관상 체리새우 — 생태원 열대관의 흔한 관상어 무리 뒤(지렁이로 문다)
  { key: "cherry_shrimp", name: "체리새우", grade: "흔함", price: 340, hours: 24.8, minTank: 1, size: 10, cm: 3, fresh: true, ornamental: true,
    spots: [["jungle", 1.5, "guppy"]], habit: crawl({ lane: 0.5, school: true }) },
  // 서해 대하 — 통영 항구의 흔한 새 계열 자리(민물새우부터 고급까지 흔하다)
  { key: "fleshy_prawn", name: "대하", grade: "고급", price: 2350, hours: 74, minTank: 2, size: 20, cm: 25, fresh: false, ornamental: false,
    spots: [["harbor", 2, "starfish"]], habit: crawl({ lane: 0.8, speed: 0.06, school: true }) },
  // 동해 독도새우(도화새우) — 울릉도 앞바다의 귀한 몫(미끼 한 단계에 약 1%)
  { key: "dokdo_shrimp", name: "독도새우", grade: "희귀", price: 3500, hours: 91, minTank: 2, size: 18, cm: 22, fresh: false, ornamental: false,
    spots: [["ocean", 8, "skate"]], habit: crawl({ lane: 0.7, speed: 0.05, rest: 0.65 }) },
  // 게(2026-11-18 [사용자: "토종물고기 보다는 갑각류를 추가하자"]) — 그림 · 3D 는 NOAA Fisheries 등쪽 일러스트(퍼블릭 도메인)를 기준으로
  //   Claude 세션이 직접 지었다(design/aqua3d-review/crab-build.mjs · crabs/). 바닥을 천천히 걷고 오래 멈춰 있다 — 놀라도 거의 안 튄다(dart 0.05)
  // 동해 대게 — 울릉도 앞바다의 귀한 몫(독도새우 바로 뒤)
  { key: "snow_crab", name: "대게", grade: "희귀", price: 3700, hours: 92.4, minTank: 2, size: 24, cm: 60, fresh: false, ornamental: false,
    spots: [["ocean", 6, "dokdo_shrimp"]], habit: crawl({ lane: 0.9, speed: 0.035, rest: 0.7, hop: 0.7, dart: 0.05, hug: 0.05 }) },
  // 킹크랩 — 울릉분지 심해의 영웅(찬 깊은 바다)
  { key: "king_crab", name: "킹크랩", grade: "영웅", price: 23500, hours: 204.5, minTank: 4, size: 30, cm: 120, fresh: false, ornamental: false,
    // 남극 세종기지 앞바다(2026-11-18) — 남극 대륙붕에도 킹크랩(왕게류)이 산다
    spots: [["abyss", 1.5, "viperfish"], ["sejong", 4, "fur_seal"]], habit: crawl({ lane: 1, speed: 0.03, rest: 0.72, hop: 0.7, dart: 0.05, hug: 0.05 }) },
  // 바닷가재(2026-11-18 [사용자: "가재류도 넣어주거"]) — NOAA 미국 바닷가재 일러스트(퍼블릭 도메인). 통영 항구의 고급(대하 바로 뒤). 놀라면 꼬리를 배 쪽으로 쳐 뒤로 휙(dart)
  { key: "lobster", name: "바닷가재", grade: "고급", price: 2420, hours: 75, minTank: 2, size: 24, cm: 45, fresh: false, ornamental: false,
    spots: [["harbor", 1.5, "fleshy_prawn"]], habit: crawl({ lane: 0.8, speed: 0.045, rest: 0.6, hop: 0.7, dart: 0.3, hug: 0.06 }) },
  // 고래 5종 · 톱상어(2026-11-18 [사용자: "고래 종류 5가지 와 톱상어 추가해줘"]) — 그림 · 3D 는 NOAA 고래 일러스트 · 톱상어 옛 채색 도판(둘 다 퍼블릭 도메인)을
  //   기준으로 Claude 세션이 지었다(design/aqua3d-review/whales/). 낚시터 pool 에는 안 넣고 때 손님(곁 칸)으로만 온다 — 미끼 1% 규칙 · 전설 몫(fishingworld 의 TIMED_FISH).
  //   고래는 숨 쉬러 수면에 오르고(breathe) 꼬리를 위아래로 친다(anatomy 의 CETACEAN). 톱상어는 바닥 가까이 톱 주둥이로 모래를 훑는다
  { key: "sawshark", name: "톱상어", grade: "영웅", price: 36500, hours: 258, minTank: 4, size: 32, cm: 150, fresh: false, ornamental: false,
    spots: [], habit: { lo: -5, hi: -3.5, speed: 0.07, reach: 0.85, depth: 1.4, hug: 0.16, tilt: 0, pace: 0.75, lane: 0.85, bob: 0.06 } },
  { key: "minke_whale", name: "밍크고래", grade: "영웅", price: 50500, hours: 309, minTank: 5, size: 44, cm: 800, fresh: false, ornamental: false,
    spots: [], habit: { lo: -1, hi: 2.6, speed: 0.22, reach: 1, depth: 2, breathe: 70, breathOnly: true, pace: 0.6, tilt: 0.25 } },
  { key: "gray_whale", name: "귀신고래", grade: "전설", price: 58200, hours: 331, minTank: 5, size: 46, cm: 1300, fresh: false, ornamental: false,
    spots: [], habit: { lo: -1.8, hi: 2.2, speed: 0.15, reach: 1, depth: 2, breathe: 80, breathOnly: true, pace: 0.5, tilt: 0.25 } },
  { key: "humpback_whale", name: "혹등고래", grade: "전설", price: 58600, hours: 332, minTank: 5, size: 47, cm: 1500, fresh: false, ornamental: false,
    spots: [], habit: { lo: -1, hi: 2.6, speed: 0.18, reach: 1, depth: 2, breathe: 70, breathOnly: true, pace: 0.5, tilt: 0.3 } },
  { key: "sperm_whale", name: "향유고래", grade: "신화", price: 59700, hours: 335, minTank: 5, size: 48, cm: 1600, fresh: false, ornamental: false,
    spots: [], habit: { lo: -2, hi: 2, speed: 0.15, reach: 1, depth: 2, breathe: 110, breathOnly: true, pace: 0.45, tilt: 0.25 } },
  { key: "blue_whale", name: "흰수염고래", grade: "태초", price: 100000, hours: 450, minTank: 6, size: 50, cm: 2500, fresh: false, ornamental: false,
    spots: [], habit: { lo: -1, hi: 2.6, speed: 0.17, reach: 1, depth: 2, breathe: 90, breathOnly: true, pace: 0.45, tilt: 0.2 } },
  // 바다코끼리 · 황제펭귄(2026-11-24 [사용자: "바다코끼리도 이미지 찾아서 모델 만들어줘" · "황제펭귄도 추가해"]) — 그림은 USFWS 바다코끼리 사진 ·
  //   헤엄치는 펭귄 사진(둘 다 퍼블릭 도메인)을 바탕으로 Claude 세션이 지었다(design/aqua3d-review/walrus/ · penguin/). 때 손님(곁 칸)으로만 온다.
  //   바다코끼리: 바닥 가까이 천천히 — 수염 주둥이로 조개를 찾고 숨 쉬러 오른다, 바위 · 모래사장에서 쉰다. 황제펭귄: 날개로 날듯이 빠르게, 숨 쉬러 오르고 물 밖에서 쉰다
  { key: "emperor_penguin", name: "황제펭귄", grade: "영웅", price: 24500, hours: 207.5, minTank: 4, size: 26, cm: 115, fresh: false, ornamental: false,
    spots: [], habit: { lo: -2, hi: 2.4, speed: 0.34, reach: 1, depth: 2, haul: true, breathe: 60, breathOnly: true, dart: 0.3, pace: 1, tilt: 0.45 } },
  { key: "walrus", name: "바다코끼리", grade: "전설", price: 53000, hours: 315, minTank: 5, size: 42, cm: 330, fresh: false, ornamental: false,
    spots: [], habit: { lo: -3.4, hi: 1.2, speed: 0.14, reach: 0.9, depth: 1.8, haul: true, breathe: 80, breathOnly: true, pace: 0.5, tilt: 0.3 } },
  // 남극 10종(2026-11-25 [사용자: "남극기지 낚시터에 … 10종" → "기존에있는 것과 조금 다른 느낌없어 ? 펭귄과 메로는 유지하고" → "다 완벽하게 진행해줘"]) —
  //   그림 · 3D 는 Claude 세션이 부위로 지었다(design/aqua3d-review/polar/ penguins · antfish · inverts-build.mjs, 카드 그림은 모델을 찍은 것).
  //   젠투 · 아델리 · 대왕등각류는 세종기지 pool 의 흔한 몫(시작 미끼 단계 — 대구 바로 뒤), 나머지 일곱은 세종기지 때 손님(곁 칸)
  { key: "antarctic_urchin", name: "남극성게", grade: "흔함", price: 575, hours: 31.5, minTank: 1, size: 14, cm: 7, fresh: false, ornamental: false,
    spots: [], habit: crawl({ lane: 0.7, speed: 0.012, rest: 0.85, hop: 0.3, dart: 0, hug: 0.2, idle: 0.1, pace: 0.4 }) },
  { key: "gentoo_penguin", name: "젠투펭귄", grade: "고급", price: 2900, hours: 83, minTank: 2, size: 22, cm: 80, fresh: false, ornamental: false,
    spots: [["sejong", 6, "cod"]], habit: { lo: -2, hi: 2.6, speed: 0.4, reach: 1, depth: 2, haul: true, breathe: 45, breathOnly: true, dart: 0.4, pace: 1.2, tilt: 0.45, school: true } },
  { key: "giant_isopod", name: "남극 대왕등각류", grade: "고급", price: 3150, hours: 86.2, minTank: 2, size: 18, cm: 19, fresh: false, ornamental: false,
    spots: [["sejong", 4, "gentoo_penguin"]], habit: crawl({ lane: 0.85, speed: 0.05, rest: 0.55, dart: 0.1, hug: 0.08 }) },
  { key: "adelie_penguin", name: "아델리펭귄", grade: "고급", price: 3450, hours: 90.5, minTank: 2, size: 21, cm: 70, fresh: false, ornamental: false,
    spots: [["sejong", 6, "giant_isopod"]], habit: { lo: -1.8, hi: 2.6, speed: 0.38, reach: 1, depth: 2, haul: true, breathe: 45, breathOnly: true, dart: 0.45, pace: 1.25, tilt: 0.45, school: true } },
  { key: "icefish", name: "남극빙어", grade: "희귀", price: 3550, hours: 91.5, minTank: 2, size: 22, cm: 60, fresh: false, ornamental: false,
    spots: [], habit: { lo: -5, hi: -3.8, speed: 0.05, reach: 0.8, depth: 1.3, hug: 0.14, rest: 0.6, hop: 0.5, pace: 0.6, tilt: 0, lane: 0.8 } },
  { key: "sea_pig", name: "바다돼지", grade: "희귀", price: 6650, hours: 108.5, minTank: 2, size: 16, cm: 15, fresh: false, ornamental: false,
    spots: [], habit: crawl({ lane: 0.9, speed: 0.03, rest: 0.7, hop: 0.5, dart: 0, hug: 0.14, pace: 0.6 }) },
  { key: "chinstrap_penguin", name: "턱끈펭귄", grade: "희귀", price: 7750, hours: 113.5, minTank: 3, size: 22, cm: 72, fresh: false, ornamental: false,
    spots: [], habit: { lo: -2, hi: 2.6, speed: 0.38, reach: 1, depth: 2, haul: true, breathe: 45, breathOnly: true, dart: 0.4, pace: 1.2, tilt: 0.45, school: true } },
  { key: "clione", name: "클리오네", grade: "영웅", price: 21250, hours: 196.2, minTank: 4, size: 12, cm: 4, fresh: false, ornamental: false,
    spots: [], habit: { lo: 0.8, hi: 3.2, speed: 0.1, reach: 0.7, depth: 1.4, bob: 0.25, pace: 1.6, tilt: 0.1, school: true } },
  { key: "toothfish", name: "메로", grade: "전설", price: 29500, hours: 227.5, minTank: 4, size: 34, cm: 175, fresh: false, ornamental: false,
    spots: [], habit: { lo: -4.2, hi: -1.6, speed: 0.08, reach: 0.9, depth: 1.6, pace: 0.6, tilt: 0.25, rest: 0.3 } },
  // 북극곰(2026-11-25 [사용자: "북극곰도 만들어볼 수 있어 ? 태초등급으로 … 움직임도 이미지도 정말 이게 실제인지 그래픽인지 알 수없을정도로"]) —
  //   USFWS · Ltshears · Unsplash(CC0) 사진(퍼블릭 도메인 · CC0)을 기준으로 Claude 세션이 부위로 지었다(design/aqua3d-review/polarbear/).
  //   남극 세종기지 밤의 때 손님(곁 칸 · 뽑혀도 30% 만 문다 — 범고래와 같다. 2026-11-26 고성 거진항에서 옮겼다). 수면 가까이 머리를 내밀고 앞발을 번갈아 저어(개헤엄) 나아가고, 뒷다리는 뒤로 끌린다.
  //   숨 쉬러 자주 오르고 모래사장 · 바위에서 쉰다. 사냥꾼(PREDATORS)에는 넣지 않았다 — 수조 물고기를 실제로 잡아먹게 된다
  { key: "polar_bear", name: "북극곰", grade: "태초", price: 135000, hours: 550, minTank: 6, size: 46, cm: 250, fresh: false, ornamental: false,
    spots: [], habit: { lo: -0.6, hi: 3, speed: 0.2, reach: 1, depth: 2, haul: true, breathe: 40, breathOnly: true, dart: 0.15, pace: 0.7, tilt: 0.25 } },
  { key: "salp", name: "살프 사슬", grade: "전설", price: 46500, hours: 294, minTank: 5, size: 30, cm: 60, fresh: false, ornamental: false,
    spots: [], habit: { lo: 0.5, hi: 3, speed: 0.05, reach: 1, depth: 2, pace: 0.5, tilt: 0.15, bob: 0.2, feeds: false } },
];

/** 켜졌을 때만 — 다른 표가 펼쳐 넣는다 */
export const ACTIVE_SHRIMP: readonly StagedFamily[] = SHRIMP_ON ? SHRIMP_FAMILIES : [];

/** 낚시터 pool 에 켜진 새우를 끼운다(정해진 계열 바로 뒤 — 대표 물고기 자리는 그대로) */
export function withShrimp<P extends readonly (readonly [string, number])[]>(spot: string, pool: P, list: readonly StagedFamily[] = ACTIVE_SHRIMP): [string, number][] {
  const out = pool.map((x) => [x[0], x[1]] as [string, number]);
  for (const f of list) for (const [sp, w, after] of f.spots) {
    if (sp !== spot) continue;
    const i = out.findIndex(([k]) => k === after);
    out.splice(i < 0 ? out.length : i + 1, 0, [f.key, w]);
  }
  return out;
}
