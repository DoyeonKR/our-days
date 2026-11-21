// 수조 알림(2026-11-21) [사용자: 리뷰 "수조 알림이 앱 밖으로는 안 가요 — 배고픈 사냥꾼 · 곧 팔리는 대기 그물" → "다 진행해"]
// 수조 규칙(정산 · 상성 · 장식 효과)은 앱의 TS 라 엣지 함수가 못 부른다. 그래서 앱이 저장할 때마다(stow) 알림에 필요한 값만
// 섬 맨 위 칸 s.aquaAlert 에 적어 두고, 크론 함수(activity-nudge — 하루 두 번 10 · 20시 KST)가 그 값과 수조의 포만 · 시각(옛 앱도 쓰는 칸)으로 판단한다.
//  · perH  — 한 시간에 줄어드는 포만(장식 · 행사 효과를 반영한 그때 값). 옛 앱이 저장해 aquaAlert 가 묵어도 포만 · 시각은 aquarium 의 최신 값을 쓴다
//  · prey  — 잡아먹힐 수 있는 물고기 수(0 이면 사냥 알림 없음)
//  · net   — 대기 그물의 가장 이른 판매 시각(ms, 없으면 없음)
// ⚠ aquaNudgeFor 는 supabase/functions/activity-nudge/index.ts 에 글자 그대로 복사본이 있다(엣지 함수는 src 를 못 불러온다) — 고치면 둘 다, 그리고 함수를 다시 배포한다(aquanudge.test 가 비교한다).

/** 사냥이 일어나는 포만 문턱 — lib/predation 의 HUNGRY_BELOW 와 같은 값(aquanudge.test) */
export const NUDGE_HUNGRY = 75;
/** 대기 그물 — 이 시간 안에 팔리면 알린다(크론이 12시간마다 돈다) */
export const NUDGE_NET_H = 12;

export type AquaAlert = { perH: number; prey: number; net?: number };

// ── 엣지 함수 복사본 시작 ──
export function aquaNudgeFor(
  aq: { hunger?: unknown; at?: unknown } | null | undefined,
  al: { perH?: unknown; prey?: unknown; net?: unknown } | null | undefined,
  now: number,
): { title: string; body: string } | null {
  if (!aq || !al) return null;
  const hunger = typeof aq.hunger === "number" ? aq.hunger : NaN;
  const at = typeof aq.at === "number" ? aq.at : NaN;
  const perH = typeof al.perH === "number" ? al.perH : NaN;
  const prey = typeof al.prey === "number" ? al.prey : 0;
  const net = typeof al.net === "number" ? al.net : NaN;
  const lines: string[] = [];
  if (prey > 0 && Number.isFinite(hunger) && Number.isFinite(at) && Number.isFinite(perH)) {
    const nowHunger = hunger - Math.max(0, (now - at) / 3600000) * perH;
    if (nowHunger < NUDGE_HUNGRY) lines.push(`배고픈 사냥꾼이 있어요 — 먹이를 안 주면 ${prey}마리가 잡아먹힐 수 있어요`);
  }
  if (Number.isFinite(net) && net > now && net - now <= NUDGE_NET_H * 3600000) lines.push("대기 그물의 물고기가 곧 팔려요 — 수조로 옮겨 주세요");
  if (!lines.length) return null;
  return { title: "🐟 우리 수조", body: lines.join(" · ") };
}
// ── 엣지 함수 복사본 끝 ──
