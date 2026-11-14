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
  key: string; name: string; grade: "흔함" | "보통" | "고급" | "희귀" | "영웅";
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
