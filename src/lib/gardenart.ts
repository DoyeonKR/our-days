/* 정원 도트를 CSS 배경으로 — 흙 두둑(비료 단계별) · 울타리. [2026-09-24 전 영역 UI 개편]
 * 밭 칸은 버튼이라 캔버스를 겹치기보다 배경 이미지가 가볍다(칸이 24개까지 깔린다).
 * spriteUrl 이 한 번만 구워 캐시한다. SSR(정적 프리렌더)에선 빈 문자열 — 섬은 열 때만 그린다. */
import { spriteUrl } from "./spriteurl.ts";
import { GARDEN_FENCE, GARDEN_SOIL } from "./pixelui.ts";

export const soilUrl = (stack: number): string => {
  const n = Math.max(0, Math.min(GARDEN_SOIL.length - 1, Math.floor(stack)));
  return spriteUrl(`garden-soil-${n}`, () => GARDEN_SOIL[n]);
};
export const fenceUrl = (): string => spriteUrl("garden-fence", () => GARDEN_FENCE);
