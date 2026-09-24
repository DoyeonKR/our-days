"use client";

/* 홈·앱 글리프 — 기분 도트(MoodGlyph) · 글줄 표시(MicroIcon · Coin) · 잠금(LockMark) · 탭 엠블럼(EmblemIcon).
 *
 * 섬 전용 아이콘(돌봄 · 장비 · 스탯 · 농기구 · 할 일)은 island/UiIcon 에 있다. 나눈 이유는 첫 로드다 — 홈이 UiIcon 을
 * 부르면 섬 전용 도트(lib/pixelui)까지 딸려 왔다[2026-09-25]. UiIcon 은 이 파일을 재수출한다(섬 쪽 import 경로는 그대로).
 * ⚠ 여기서 lib/pixelui 나 섬 모듈을 부르지 않는다 — firstload.test 가 홈에서 닿는 import 를 따라가 본다.
 */

import Icon from "@/components/Icon";
import PixelSprite from "@/components/island/PixelSprite";
import { MICRO_ICONS, emblemIcon, moodIcon } from "@/lib/pixelglyph";

export function EmblemIcon({ k, size = 48, title }: { k: string; size?: number; title?: string }) {
  const sp = emblemIcon(k);
  return sp ? <PixelSprite sprite={sp} size={size} title={title} /> : null;
}
/** 작은 표시(12×12) — 밭(drop · link · plus · star) · 섬 글줄(coin · bond · sleep · pill · pencil · bulb · gift ·
 *  sprout · museum · sparkle · peak · clover · tree · tier_*) · 일기 위치(pin). 기본 2배(24px), 글줄 안에선 size={12}(1배). */
export function MicroIcon({ k, size = 24, title, className }: { k: string; size?: number; title?: string; className?: string }) {
  const sp = MICRO_ICONS[k];
  return sp ? <PixelSprite sprite={sp} size={size} title={title} className={`inline-block shrink-0 align-middle ${className ?? ""}`} /> : null;
}
/** 하트(섬 화폐) — 가격·보상·지갑의 💗 자리. 글줄 높이(12px). 이모지는 기기마다 그림이 달랐다. */
export function Coin({ size = 12 }: { size?: number }) {
  return <MicroIcon k="coin" size={size} title="하트" className="mx-px" />;
}
/** 잠금 표시 — 글줄 안의 🔒 대신. 픽셀 SVG 라 글자색(currentColor)을 그대로 따른다(빨강 안내 · 노랑 안내). */
export function LockMark() {
  return (
    <span aria-hidden className="mr-1 inline-block align-middle">
      <Icon name="lock" size={12} />
    </span>
  );
}
/** 이모지 → 직접 찍은 16×16 도트(기분 한 줄 · 일기 기분·스티커·반응 · 쿡). 표에 없는 이모지는 글자 그대로(예전 저장값 보호). */
export function MoodGlyph({ e, size = 32, className }: { e: string; size?: number; className?: string }) {
  const sp = moodIcon(e);
  if (sp) return <PixelSprite sprite={sp} size={size} title={e} className={`inline-block shrink-0 align-middle ${className ?? ""}`} />;
  return <span className={className}>{e}</span>;
}
