// 상위 단계 확장 표 — 순수 데이터. [2026-10-17 "상위 목록이 너무 적어 2배 이상 늘려줘"]
//
// 신화(5) 5 · 사신(6) 4 · 천수(7) 2 · 황룡(8) 1 = 12 → **24**: 신화 +5 · 사신 +4 · 천수 +2 · 황룡 +1.
// 화면은 heroassets.ts의 독립 고해상도 원화를 사용한다(2026-10-18).
// 기존 상위 골격을 팔레트만 바꾼 도트(pixelart.ts MYTHICS)는 장비 앵커·로드 실패 폴백용으로 유지한다.
//
// 분기(규칙은 island.ts 의 nextEvolution · divineDirection):
//   신화  — 최종형이 **계보 폼**이면 정성 55+ 에서 그 계보의 영물(아래 MYTHIC_BEAST_BY_ACT · 만능은 호랑이). 무등산·뱅갈·사자가 먼저 가져간다.
//   사신  — 가장 깊이 판 축: 옛 넷(농사·사냥·장비·꾸미기) + 새 넷(유대·출석·도감·섬 레벨). 비율이 가장 큰 축이 이긴다.
//   천수  — 박물관 8종이면 봉황 · 아니면 유대가 깊으면 삼족오 · 꾸준히 왔으면 천록 · 그 외 해태.
//   황룡  — 박물관을 크게 채웠으면 홍룡, 아니면 황룡.
// ⚠ island.ts 를 **값으로** import 하지 마라 — 타입만. island.ts 가 이 파일을 읽는다(lineages.ts 와 같은 규칙).
// ⚠ 이모지·이름은 기존 폼과 안 겹쳐야 한다(도감·박물관에서 같으면 같은 폼으로 읽힌다 — upper.test 가 잡는다).

import type { CareAct } from "./island.ts";

export type UpperForm = { key: string; stage: 5 | 6 | 7 | 8; name: string; emoji: string; note: string };

export const UPPERS: readonly UpperForm[] = [
  // ── 신화(5) — 계보의 영물. 돌봄 하나가 영물 하나 ────────────────
  { key: "cheonma", stage: 5, name: "천마", emoji: "🎠", note: "놀기가 으뜸인 계보가 닿는 하늘 말" },
  { key: "baengnok", stage: 5, name: "백록", emoji: "🤍", note: "안기가 으뜸인 계보가 닿는 흰 사슴" },
  { key: "bulgasari", stage: 5, name: "불가사리", emoji: "🔩", note: "밥이 으뜸인 계보가 닿는 쇠 먹는 영물" },
  { key: "imugi", stage: 5, name: "이무기", emoji: "🐍", note: "씻기가 으뜸인 계보가 닿는, 용이 되려는 물뱀" },
  { key: "maek", stage: 5, name: "몽맥", emoji: "🌠", note: "재우기가 으뜸인 계보가 닿는 꿈 먹는 영물" },
  // ── 사신(6) — 새 네 축 ───────────────────────────────────────
  { key: "bii_jo", stage: 6, name: "비익조", emoji: "💞", note: "둘이 날개를 맞대야 나는 새 — 유대를 가장 깊이 판 이" },
  { key: "eungryong", stage: 6, name: "응룡", emoji: "⛈️", note: "날개 달린 용 — 출석을 가장 꾸준히 이어 온 이" },
  { key: "baektaek", stage: 6, name: "백택", emoji: "🔭", note: "만물을 아는 흰 영수 — 도감을 가장 많이 채운 이" },
  { key: "geumseom", stage: 6, name: "금두꺼비", emoji: "🪙", note: "복을 부르는 금빛 두꺼비 — 섬을 가장 크게 키운 이" },
  // ── 천수(7) ──────────────────────────────────────────────────
  { key: "samjoko", stage: 7, name: "삼족오", emoji: "🌞", note: "해 속의 세 발 까마귀 — 둘의 유대가 깊은 이" },
  { key: "cheonrok", stage: 7, name: "천록", emoji: "🔔", note: "하늘의 복을 내리는 사슴 — 꾸준히 찾아온 이" },
  // ── 황룡(8) ──────────────────────────────────────────────────
  { key: "hong_dragon", stage: 8, name: "홍룡", emoji: "🎆", note: "무지개 비늘의 용 — 박물관을 크게 채운 이" },
];

export const UPPER_KEYS: ReadonlySet<string> = new Set(UPPERS.map((u) => u.key));

/** 신화 영물 — 최종형이 속한 계보의 **첫 돌봄**이 영물을 정한다(한 우물이면 그 돌봄 그대로). */
export const MYTHIC_BEAST_BY_ACT: Readonly<Record<CareAct, string>> = {
  play: "cheonma",
  hug: "baengnok",
  feed: "bulgasari",
  clean: "imugi",
  rest: "maek",
};

/** 계보(돌봄 묶음) → 닿는 신화 영물. 만능(네 가지)은 고루 키운 호랑이 — 호랑이가 새 생에서도 닿게 하는 자리다. */
export const mythicBeastOf = (acts: readonly CareAct[]): string =>
  acts.length >= 4 ? "tiger" : MYTHIC_BEAST_BY_ACT[acts[0]];
