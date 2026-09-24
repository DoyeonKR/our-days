"use client";

/* UI 도트 아이콘 — 돌봄·히어로 기술(ActionIcon) · 장비(GearIcon) · 스탯(StatIcon) · 농기구(ToolIcon)
 * · 탭 엠블럼(EmblemIcon) · '지금 할 일' 칩(TodoIcon).
 *
 * 그림은 lib/pixelui.ts 에 있다(이 저장소에서 직접 찍은 도트). 이모지를 쓰지 않는 이유:
 * 픽셀 서체(Galmuri)엔 🪵🪄🪶 같은 새 이모지가 없어 ⊠ 네모로 나왔고, 나머지도 기기마다 그림체가 달랐다.
 * 정적 아이콘이라 PixelSprite(마운트 때 한 번 그림)로 찍는다 — 카드 수십 장에 rAF 를 돌리지 않는다.
 */

import PixelSprite from "@/components/island/PixelSprite";
import { actionIcon, gearIcon, statIcon, todoIcon, toolIcon } from "@/lib/pixelui";

// 홈·앱 글리프(기분 · 글줄 표시 · 하트 · 잠금 · 탭 엠블럼)는 PixelGlyph 에 있다 — 섬 쪽 import 경로를 위해 재수출만(2026-09-25).
export { Coin, EmblemIcon, LockMark, MicroIcon, MoodGlyph } from "@/components/PixelGlyph";

export function ActionIcon({ k, size = 48, title }: { k: string; size?: number; title?: string }) {
  const sp = actionIcon(k);
  return sp ? <PixelSprite sprite={sp} size={size} title={title} /> : null;
}
export function GearIcon({ k, size = 48, title }: { k: string; size?: number; title?: string }) {
  const sp = gearIcon(k);
  return sp ? <PixelSprite sprite={sp} size={size} title={title} /> : null;
}
export function StatIcon({ k, size = 24, title }: { k: string; size?: number; title?: string }) {
  const sp = statIcon(k);
  return sp ? <PixelSprite sprite={sp} size={size} title={title} /> : null;
}
export function ToolIcon({ k, size = 48, title }: { k: string; size?: number; title?: string }) {
  const sp = toolIcon(k);
  return sp ? <PixelSprite sprite={sp} size={size} title={title} /> : null;
}
/** '지금 할 일' 칩 아이콘 — 그림이 없는 키면 fallback(엔진의 이모지)을 그대로 쓴다. */
export function TodoIcon({ k, size = 24, fallback }: { k: string; size?: number; fallback?: string }) {
  const sp = todoIcon(k);
  if (sp) return <PixelSprite sprite={sp} size={size} className="shrink-0" />;
  return fallback ? <span aria-hidden>{fallback}</span> : null;
}
