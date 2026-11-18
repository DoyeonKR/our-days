/** 수조 조명(2026-11-18) [사용자: 다 산 뒤 쌓이는 하트를 쓸 늦은 소모처 — 커플이 같이 즐길 것]
 *
 *  §10.25 의 1년 시뮬레이션에서 살 것을 다 사는 날이 대충 193일 · 열심 84일이고, 그 뒤 365일째 잔액이 약 211만 · 557만 하트였다.
 *  그 잔액을 받아 줄 '보기만 바뀌는' 사다리 — 3D 수조의 하늘빛 · 해 · 보조등 색과 세기를 바꾼다(lib/aqua3d/scene.ts 가 그린다).
 *  그림 파일이 없다(빛 색만) · 사진 모드도 같은 장면이라 찍힌다.
 *  · 값 3만 ~ 90만, 여덟 개 합 2,480,000(AQUA_LIGHT_TOTAL — econbalance.test 가 잡는다): 대충 커플의 365일째 잔액보다 조금 많고 열심 커플 잔액의 약 45%.
 *  · 능력치 · 성장 · 아름다움에 아무것도 더하지 않는다(새 하트 수도꼭지 · 성장 지름길 금지). 되팔기 없음.
 *  · 저장은 섬 맨 위 칸 s.aquaLight = { owned: [key…], on: key | null } — 하트로 산 것이라 옛 앱이 다시 짓는 s.aquarium · s.aquaPlus 에 두지 않는다
 *    (§14.4.6 — 옛 앱이 aquaPlus 를 자기 칸 목록으로 다시 지어 산 것이 사라졌다). 수조는 커플이 같이 보니 켠 조명도 하나(둘이 같이 본다).
 *  ⚠ 값 import 없음 — 3D 장면(scene.ts)도 이 표를 부른다. */
import type { IslandState } from "./island.ts";

export type AquaLight = {
  key: string; name: string; price: number; desc: string;
  /** 하늘빛(위) · 바닥 반사(아래) · 해 · 보조등 색(0xRRGGBB) */
  sky: number; ground: number; sun: number; fill: number;
  /** 기본 세기에 곱하는 값 — 하늘빛 · 해 · 보조등 */
  k: [number, number, number];
  /** 마지막 그리기에서 장면 색에 곱하는 빛깔(r, g, b — 1 이 그대로). 빛 색만으론 물빛 그림에 묻혀 거의 안 보였다 */
  tint: [number, number, number];
  /** 가게 칸의 견본(CSS 그라디언트) */
  swatch: string;
};
/** 기본(조명 없음)은 처음 장면 그대로 — scene.ts 의 처음 값과 같아야 한다 */
export const AQUA_LIGHT_BASE = { sky: 0xb7e4ed, ground: 0x656442, sun: 0xffe3ad, fill: 0x5ec8df } as const;
export const AQUA_LIGHTS: readonly AquaLight[] = [
  { key: "morning", name: "아침 햇살", price: 30000, desc: "맑은 아침 해가 비스듬히", sky: 0xd8f1ff, ground: 0x7a7350, sun: 0xfff2d0, fill: 0x8fd8ee, k: [1.12, 1.15, 0.9], tint: [1.08, 1.06, 0.97], swatch: "linear-gradient(160deg,#fff4d6,#bfe8ff 60%,#4fa9c9)" },
  { key: "sunset", name: "노을", price: 60000, desc: "주황빛 해가 수면에 번진다", sky: 0xffc9a3, ground: 0x6b4a3a, sun: 0xff9a5a, fill: 0xd77aa0, k: [1, 1.05, 1.1], tint: [1.2, 0.95, 0.8], swatch: "linear-gradient(160deg,#ffd29a,#ff8f6b 55%,#7a3f6b)" },
  { key: "moon", name: "달빛", price: 100000, desc: "푸른 밤, 은은한 달빛", sky: 0x8ea8d8, ground: 0x2a3150, sun: 0xcfdcff, fill: 0x4a6fd0, k: [0.78, 0.7, 1.2], tint: [0.76, 0.88, 1.14], swatch: "linear-gradient(160deg,#dfe8ff,#5d7bc4 50%,#1a2348)" },
  { key: "coral", name: "산호빛", price: 160000, desc: "분홍 산호에 비친 빛", sky: 0xffc2d6, ground: 0x7a4a5a, sun: 0xffd6e6, fill: 0xff7aa8, k: [1.05, 1, 1.25], tint: [1.15, 0.93, 1.05], swatch: "linear-gradient(160deg,#ffe0ea,#ff8fb6 55%,#a03d6b)" },
  { key: "aurora", name: "오로라", price: 250000, desc: "초록 · 보라 빛이 함께", sky: 0x9ff5d0, ground: 0x3a2a6a, sun: 0xc9a6ff, fill: 0x46e6b0, k: [0.95, 0.9, 1.4], tint: [0.88, 1.12, 1.06], swatch: "linear-gradient(160deg,#a6ffd9,#5fd6c0 40%,#8f6bff 75%,#2a1d5a)" },
  { key: "glow", name: "심해 발광", price: 380000, desc: "깊은 바다의 청록 불빛", sky: 0x3fd6e6, ground: 0x0a2a3a, sun: 0x7af0ff, fill: 0x19ffd1, k: [0.7, 0.6, 1.7], tint: [0.7, 1.04, 1.1], swatch: "radial-gradient(circle at 50% 70%,#5ffff0,#0f8fa6 45%,#04202e)" },
  { key: "galaxy", name: "별빛 은하", price: 600000, desc: "보랏빛 밤하늘 아래", sky: 0xb69cff, ground: 0x231a48, sun: 0xffe6ff, fill: 0x7a5cff, k: [0.85, 0.85, 1.55], tint: [0.95, 0.82, 1.18], swatch: "radial-gradient(circle at 30% 30%,#fff 0 2%,transparent 3%),radial-gradient(circle at 70% 55%,#fff 0 1.5%,transparent 2.5%),linear-gradient(160deg,#c9b3ff,#5b3fc4 55%,#140e33)" },
  { key: "palace", name: "황금 용궁", price: 900000, desc: "용궁의 금빛이 수조를 채운다", sky: 0xffe6a0, ground: 0x6a4a1a, sun: 0xffd166, fill: 0xffb627, k: [1.15, 1.2, 1.45], tint: [1.22, 1.06, 0.72], swatch: "linear-gradient(160deg,#fff3c4,#ffd166 45%,#c98a12 75%,#5a3a06)" },
];
export const AQUA_LIGHT_TOTAL = AQUA_LIGHTS.reduce((n, x) => n + x.price, 0);
export const aquaLightOf = (key: string | null | undefined) => AQUA_LIGHTS.find((x) => x.key === key);

export type AquaLightRec = { owned: string[]; on: string | null };
/** 저장값 읽기 — 모르는 key 는 버리고, 켠 것은 산 것일 때만 */
export function aquaLightRec(st: Pick<IslandState, "aquaLight">): AquaLightRec {
  const raw = st.aquaLight as { owned?: unknown; on?: unknown } | undefined;
  const owned = [...new Set(Array.isArray(raw?.owned) ? raw.owned.filter((x): x is string => typeof x === "string" && !!aquaLightOf(x)) : [])];
  const on = typeof raw?.on === "string" && owned.includes(raw.on) ? raw.on : null;
  return { owned, on };
}
export type LightResult = { ok: true; state: IslandState; note?: string } | { ok: false; reason: string };
/** 사기 — 섬 하트로. 사면 바로 켠다(산 순간 수조에서 보이게). 사다리 순서대로만(앞 조명을 사야 다음이 열린다 — 한 번에 맨 위를 사서 끝내지 않게) */
export function buyAquaLight(st: IslandState, key: string): LightResult {
  const x = aquaLightOf(key);
  if (!x) return { ok: false, reason: "없는 조명이에요" };
  const rec = aquaLightRec(st);
  if (rec.owned.includes(key)) return { ok: false, reason: "이미 가진 조명이에요" };
  const prev = AQUA_LIGHTS[AQUA_LIGHTS.indexOf(x) - 1];
  if (prev && !rec.owned.includes(prev.key)) return { ok: false, reason: `${prev.name}부터 들여와요` };
  if (st.coins < x.price) return { ok: false, reason: "하트가 모자라요" };
  return { ok: true, state: { ...st, coins: st.coins - x.price, aquaLight: { owned: [...rec.owned, key], on: key } }, note: `${x.name} 조명을 달았어요` };
}
/** 켜기 · 끄기(null = 기본 빛) */
export function setAquaLight(st: IslandState, key: string | null): LightResult {
  const rec = aquaLightRec(st);
  if (key !== null && !rec.owned.includes(key)) return { ok: false, reason: "아직 없는 조명이에요" };
  const x = key ? aquaLightOf(key) : null;
  return { ok: true, state: { ...st, aquaLight: { owned: rec.owned, on: key } }, note: x ? `${x.name} 조명을 켰어요` : "기본 빛으로 돌렸어요" };
}
