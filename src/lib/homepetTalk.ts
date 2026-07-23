// 홈 펫이 '말 거는 컴패니언'이 되도록, 커플의 실제 상황을 대사 목록으로 바꾸는 순수 로직.
// UI(HomePet)는 컨텍스트를 모아 여기 넘기고, 돌려받은 배열을 자동 순환/탭으로 보여준다.
// ⚠ DOM/React/시간(Date.now) 의존 없음 — 전부 인자로 주입(결정적 테스트).

import type { PetVibe } from "./petmotion";
import type { Season } from "./island";

export type TalkCtx = {
  petName: string;
  partnerName: string; // 상대 애칭(없으면 "우리" 로 대체)
  vibe: PetVibe; // 펫 기분(아픔>졸림>배고픔>슬픔>행복>보통)
  pendingEvolve: boolean; // 진화 대기
  coopWaiting: boolean; // 상대가 '함께 놀기'를 걸어둠
  cropsReady: number; // 수확 가능한 밭 수
  nDays: number | null; // 함께한 날(오늘=1). 시작일 없으면 null
  milestoneDay: number | null; // 임박한 100일 단위(예: 500). 없으면 null
  milestoneInDays: number | null; // 그 100일 단위까지 남은 일수(0=오늘)
  annivLabel: string | null; // 임박한 주년 라벨(예: "2주년")
  annivInDays: number | null; // 그 주년까지 남은 일수(0=오늘)
  season: Season;
  hour: number; // 0-23 (KST)
  seed: number; // 일상 대사 결정적 변형용(예: nDays)
};

const SEASON_LINE: Record<Season, string> = {
  spring: "봄바람이 살랑살랑, 꽃구경 가고 싶다 🌸",
  summer: "여름이야! 바다 보러 갈까? 🌊",
  autumn: "가을이라 단풍이 참 예뻐 🍁",
  winter: "겨울엔 꼭 붙어 있자, 따뜻하게 ❄️",
};

const AFFECTION = (p: string): string[] => [
  `${p}랑 있으면 나도 기분이 좋아 😊`,
  "오늘도 만나서 반가워!",
  "우리 셋이라 더 행복해 💗",
  "보고 싶었어, 헤헷",
  "둘이 사이좋게 지내야 나도 신나 🎵",
];

/** 안전한 인덱스(음수/범위초과 방지). */
function pick<T>(arr: T[], i: number): T {
  const n = arr.length;
  return arr[((i % n) + n) % n];
}

/**
 * 컨텍스트 → 우선순위 대사 배열. 앞쪽일수록 지금 가장 관련 있는 말(긴급 케어·기념일 임박 등),
 * 뒤로 갈수록 일상/애정 대사. 항상 1개 이상 반환.
 */
export function petTalk(ctx: TalkCtx): string[] {
  const L: string[] = [];
  const p = ctx.partnerName?.trim() || "우리";

  // 1) 긴급 케어(아픔/배고픔)
  if (ctx.vibe === "sick") L.push("끙… 나 좀 아파. 약이 필요해 💊");
  if (ctx.vibe === "hungry") L.push("배고파… 밥 주라 🍚");

  // 2) 진화 임박
  if (ctx.pendingEvolve) L.push("나… 곧 다른 모습이 될 것 같아! 보러 와줘 ✨");

  // 3) 상대가 함께 놀기 대기
  if (ctx.coopWaiting) L.push(`${p}가 같이 놀자고 기다리고 있어 💞`);

  // 4) 100일 단위(오늘/임박)
  if (ctx.milestoneDay != null && ctx.milestoneInDays != null) {
    if (ctx.milestoneInDays === 0) L.push(`오늘 우리 ${ctx.milestoneDay.toLocaleString()}일째야! 🎉`);
    else L.push(`${ctx.milestoneDay.toLocaleString()}일까지 ${ctx.milestoneInDays}일 남았어, 두근두근 🎉`);
  }

  // 5) 주년(오늘/임박)
  if (ctx.annivLabel != null && ctx.annivInDays != null) {
    if (ctx.annivInDays === 0) L.push(`오늘은 ${ctx.annivLabel}! 축하해 🥳`);
    else L.push(`${ctx.annivLabel}까지 ${ctx.annivInDays}일! 기대돼 💗`);
  }

  // 6) 수확할 작물
  if (ctx.cropsReady > 0) L.push(`밭에 다 자란 게 ${ctx.cropsReady}개 있어! 수확하자 🌾`);

  // 7) 기분(슬픔/졸림)
  if (ctx.vibe === "sad") L.push("조금 심심해… 나랑 놀아줄래?");
  if (ctx.vibe === "sleepy") L.push("졸려… 살짝 잘게 😴");

  // 8) 시간대 인사
  if (ctx.hour >= 5 && ctx.hour < 11) L.push("좋은 아침! 오늘도 우리 셋이 함께야 ☀️");
  else if (ctx.hour >= 22 || ctx.hour < 5) L.push("잘 자, 좋은 꿈 꿔 🌙");

  // 9) 계절 한마디
  L.push(SEASON_LINE[ctx.season]);

  // 10) 함께한 날 자랑(시작일 있을 때)
  if (ctx.nDays != null && ctx.nDays > 0) L.push(`우리 벌써 ${ctx.nDays.toLocaleString()}일째래, 대단하지? 💕`);

  // 11) 일상 애정(결정적 변형)
  L.push(pick(AFFECTION(p), ctx.seed));

  // 12) 행복하면 밝은 한마디 하나 더
  if (ctx.vibe === "happy") L.push("오늘 기분 최고야! 히히");

  return L;
}
