// 씬(하늘·빛)을 픽셀 문법으로 바꾸는 순수 헬퍼.
//
// 픽셀 아트에서 하늘은 **부드러운 그라데이션이 아니라 색 띠**다. 실제 도트 게임의 하늘은
// 색이 몇 단계로 뚝뚝 끊기고, 그 계단이 스타일 그 자체다(밴딩은 버그가 아니다).
// 여기 함수들은 그 규칙을 한 곳에 모아, HomeWorld/IslandScene 이 같은 문법을 쓰게 한다.

/** 채널을 8의 배수로 양자화 — 색 수를 줄여 '팔레트가 정해진' 레트로 느낌을 만든다. */
export function q8(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex; // rgba()/색이름 등은 손대지 않는다
  const v = parseInt(m[1], 16);
  const q = (c: number) => Math.min(248, Math.round(c / 8) * 8);
  const r = q((v >> 16) & 255);
  const g = q((v >> 8) & 255);
  const b = q(v & 255);
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * 색 배열 → **하드 스톱** linear-gradient. 각 색이 같은 높이의 띠를 차지하고 경계에서 뚝 끊긴다.
 * (부드러운 보간을 쓰면 그 즉시 픽셀 톤이 깨진다.)
 */
export function bands(colors: readonly string[], angle = 180): string {
  if (colors.length === 0) return "transparent";
  if (colors.length === 1) return q8(colors[0]);
  const step = 100 / colors.length;
  const stops: string[] = [];
  colors.forEach((c, i) => {
    const from = (i * step).toFixed(3);
    const to = ((i + 1) * step).toFixed(3);
    stops.push(`${q8(c)} ${from}%`, `${q8(c)} ${to}%`);
  });
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

/**
 * 동심 사각 링 — 픽셀 아트의 광원(해/달)은 블러 후광이 아니라 **단계별 링**으로 그린다.
 * box-shadow 의 spread 만 써서 링을 만든다(블러 0).
 */
export function haloRings(color: string, steps: readonly number[]): string {
  return steps.map((px, i) => `0 0 0 ${px}px ${color}${alphaHex(0.42 - i * 0.12)}`).join(", ");
}

function alphaHex(a: number): string {
  const v = Math.max(0, Math.min(255, Math.round(a * 255)));
  return v.toString(16).padStart(2, "0");
}

/** 도트 격자에 맞춘 반올림 — 씬 좌표를 u(기본 2px) 배수로 스냅한다. */
export const snap = (v: number, u = 2): number => Math.round(v / u) * u;
