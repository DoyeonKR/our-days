"use client";

/* 스프라이트 → data URL(PNG) 캐시 — **SVG 안에 픽셀 아트를 넣기 위한** 유일한 실용적 방법.
 *
 * 섬 풍경(IslandScene)은 하늘·바다·잔디가 전부 하나의 <svg> 다. 여기에 캔버스를 넣으려면
 * foreignObject 가 필요한데(사파리에서 애니와 궁합이 나쁨), 픽셀을 <rect> 하나씩 그리면
 * 24×24 데코 하나가 수백 개 노드가 되어 배치 24개면 수천 노드가 된다 — 모바일에서 못 쓴다.
 * 그래서 스프라이트를 한 번만 캔버스에 굽고 data URL 로 만들어 <image> 로 얹는다.
 *
 * · 캐시 키는 **문자열 id**다(스프라이트 객체는 호출마다 새로 만들어져 identity 로 못 잡는다).
 * · `image-rendering: pixelated` 를 함께 줘야 확대해도 도트가 뭉개지지 않는다.
 * · SSR(정적 export 프리렌더)에는 document 가 없다 → 빈 문자열. 섬 오버레이는 사용자가 열 때
 *   클라이언트에서만 마운트되므로 실제 화면에는 영향이 없다.
 */

import { type Sprite, pixelAt } from "./pixel";

const cache = new Map<string, string>();

export function spriteUrl(id: string, make: () => Sprite): string {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  const s = make();
  const c = document.createElement("canvas");
  c.width = s.w;
  c.height = s.h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const col = pixelAt(s, x, y);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = c.toDataURL("image/png");
  cache.set(id, url);
  return url;
}
