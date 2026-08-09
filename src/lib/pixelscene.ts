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

/* ── 곡선을 계단으로 ──────────────────────────────────────────────
 * [사용자 요청 2026-08-07 "홈화면 배경 픽셀들 개선"]
 *
 * 홈 풍경은 SVG **베지어 곡선**이었다. 그 위에 1px 격자로 딱 끊긴 펫이 서 있으니
 * 펫이 벡터 일러스트에 붙인 스티커처럼 보인다 — 이게 "픽셀 게임으로 안 보이는"
 * 진짜 이유였다. 해상도가 아니라 **문법**이 둘로 갈려 있었다.
 *
 * 픽셀 아트에 곡선은 없다. 계단이 있을 뿐이다. 여기서는 실루엣을 그대로 두고
 * **격자에만 맞춘다** — 그림이 바뀌는 게 아니라 같은 그림이 같은 문법으로 그려진다.
 *
 * ⚠ 순수 함수다. 렌더에서 부르지 말고 모듈 최상단에서 한 번 계산해 쓴다
 *   (좌표가 고정이라 매 렌더 다시 만들 이유가 없다).
 */

/** 3차 베지어 한 구간: [x1,y1, x2,y2, x3,y3] (SVG C 커맨드와 같은 순서). */
export type Cubic = readonly [number, number, number, number, number, number];

const cube = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** (0,y0) 에서 시작하는 C 체인을 촘촘히 찍어 점 목록으로. */
export function sampleCubics(y0: number, cs: readonly Cubic[], per = 24): [number, number][] {
  const pts: [number, number][] = [[0, y0]];
  let cx = 0;
  let cy = y0;
  for (const [x1, y1, x2, y2, x3, y3] of cs) {
    for (let i = 1; i <= per; i++) {
      const t = i / per;
      pts.push([cube(cx, x1, x2, x3, t), cube(cy, y1, y2, y3, t)]);
    }
    cx = x3;
    cy = y3;
  }
  return pts;
}

/**
 * 점 목록 → **계단 경로**(수평·수직 선분만). 곡선이 사라지고 도트 계단이 남는다.
 *
 * @param u     격자 단위(논리 px). 클수록 계단이 굵다.
 * @param right 오른쪽 끝 x
 * @param floor 아래를 채울 y(면으로 만들 때)
 */
export function stepPath(
  pts: readonly (readonly [number, number])[],
  u: number,
  right: number,
  floor: number,
): string {
  if (pts.length === 0) return "";
  const q = (v: number) => Math.round(v / u) * u;
  // x 를 격자 칸으로 묶고 칸마다 대표 y 를 고른다(같은 칸 안의 평균 — 튀는 점에 안 흔들린다)
  const cells = new Map<number, { sum: number; n: number }>();
  for (const [x, y] of pts) {
    const cx = q(x);
    const c = cells.get(cx) ?? { sum: 0, n: 0 };
    c.sum += y;
    c.n += 1;
    cells.set(cx, c);
  }
  const xs = [...cells.keys()].sort((a, b) => a - b);
  const d: string[] = [];
  let prevY = q(cells.get(xs[0])!.sum / cells.get(xs[0])!.n);
  d.push(`M0 ${prevY}`);
  for (const x of xs) {
    const c = cells.get(x)!;
    const y = q(c.sum / c.n);
    if (y !== prevY) {
      d.push(`L${x} ${prevY}`, `L${x} ${y}`); // 가로로 갔다가 세로로 — 계단 한 칸
      prevY = y;
    }
  }
  d.push(`L${right} ${prevY}`, `L${right} ${floor}`, `L0 ${floor}`, "Z");
  return d.join(" ");
}

/** 꺾은선(산등성이)도 같은 계단 문법으로. */
export function stepPolyline(
  pts: readonly (readonly [number, number])[],
  u: number,
  right: number,
  floor: number,
): string {
  // 선분을 잘게 쪼개 점으로 만든 뒤 stepPath 에 넘긴다(같은 규칙 하나만 쓴다)
  const dense: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.abs(bx - ax) / 2));
    for (let k = 0; k <= n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return stepPath(dense, u, right, floor);
}
