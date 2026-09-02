import type { Sprite } from "./pixel.ts";

const MYTHIC = new Set(["tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe"]);

const SIGIL_COLORS: Record<string, [string, string, string]> = {
  tiger: ["#fff3b0", "#ff7fb8", "#8fe3ff"],
  bengal_tiger: ["#f8fbff", "#8fe3ff", "#b18cf5"],
  mudeung_tiger: ["#d8ffe9", "#6fe0bf", "#ffcc3d"],
  lion: ["#fff3b0", "#ffcc3d", "#ff7f9f"],
  giraffe: ["#fff3b0", "#b18cf5", "#8fe3ff"],
};

/** 신화형 전용 48×12 별자리 문양. 캐릭터와 함께 움직이는 실제 픽셀 스프라이트다. */
export function mythicSigil(form: string): Sprite | null {
  if (!MYTHIC.has(form)) return null;
  const w = 48;
  const h = 12;
  const grid = Array.from({ length: h }, () => Array<string>(w).fill("."));
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = ch;
  };
  // 타원형 외곽 — 1px 선을 계단으로 찍어 축소 화면에서도 원근이 읽힌다.
  for (const [y, x0, x1] of [[2, 13, 34], [3, 8, 39], [4, 5, 42], [5, 3, 44], [6, 3, 44], [7, 5, 42], [8, 8, 39], [9, 13, 34]] as const) {
    put(x0, y, "a"); put(x1, y, "a");
  }
  for (let x = 14; x <= 33; x++) { put(x, 2, x % 4 === 0 ? "c" : "a"); put(x, 9, x % 4 === 1 ? "c" : "b"); }
  // 중심 별자리와 종별 룬. 같은 등급이되 문양은 서로 다르다.
  [[24, 3], [20, 5], [24, 6], [28, 5], [24, 8]].forEach(([x, y]) => put(x, y, "c"));
  for (let x = 20; x <= 28; x++) put(x, 6, x === 24 ? "c" : "a");
  for (let d = 0; d <= 3; d++) {
    put(24 - d, 3 + d, d % 2 ? "b" : "c");
    put(24 + d, 3 + d, d % 2 ? "b" : "c");
  }
  const seed = ["tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe"].indexOf(form);
  for (let i = 0; i < 5; i++) {
    const x = 10 + ((seed * 7 + i * 9) % 29);
    const y = 4 + ((seed + i * 2) % 4);
    put(x, y, i % 2 ? "b" : "c");
  }
  const [a, b, c] = SIGIL_COLORS[form];
  return { w, h, pal: { a, b, c }, rows: grid.map((r) => r.join("")) };
}

export const isMythicForm = (form?: string): boolean => !!form && MYTHIC.has(form);
