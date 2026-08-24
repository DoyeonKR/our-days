"use client";

/* 정적 픽셀 스프라이트 하나를 캔버스에 찍는다 — 애니 없음(작물·가공품·데코 아이콘용).
 *
 * PetPixel 과 나눈 이유: 펫은 걷기 2프레임 + 숨쉬기 + 수면 포즈가 있어 rAF 루프가 필요하지만,
 * 작물 아이콘은 수십 개가 격자로 깔린다. 거기에 rAF 를 수십 개 돌리면 배터리만 태운다.
 * 여기는 마운트 때 **한 번만** 그린다.
 *
 * 규약: 정수배 스케일만(도트가 뭉개지지 않는 유일한 조건), DPR 보정, imageSmoothing off.
 */

import { useEffect, useRef } from "react";
import { type Sprite, blitSprite, setupPixelCanvas } from "@/lib/pixel";

export default function PixelSprite({
  sprite,
  size = 34,
  className,
  title,
  onTap,
}: {
  sprite: Sprite;
  size?: number; // 목표 CSS 크기(px). 실제 크기는 정수배로 반올림된다.
  className?: string;
  title?: string;
  onTap?: () => void;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const box = Math.max(sprite.w, sprite.h);
    const scale = Math.max(1, Math.round(size / box));
    const px = setupPixelCanvas(c, ctx, sprite.w, sprite.h, scale);
    ctx.clearRect(0, 0, c.width, c.height);
    blitSprite(ctx, sprite, 0, 0, px);
  }, [sprite, size]);

  return (
    <canvas
      ref={cvs}
      onClick={onTap}
      role="img"
      aria-label={title ?? "아이콘"}
      className={`select-none ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
