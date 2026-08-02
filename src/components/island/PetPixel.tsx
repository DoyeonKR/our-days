"use client";

/* 펫 스프라이트 한 마리 — 배경 없는 투명 캔버스.
 *
 * PixelPet(무대) 과의 역할 분담:
 *   · PixelPet  = 하늘·지면·나무까지 포함한 **무대**(섬 펫 탭 전용).
 *   · PetPixel  = 캐릭터만. 홈 히어로·쿡찌르기·게임 카드·도감처럼 **이미 배경이 있는 자리**에 얹는다.
 * 무대를 그런 곳에 넣으면 하늘이 두 겹으로 겹친다 — 그래서 컴포넌트를 나눈다.
 *
 * 렌더 규약(PixelPet 과 동일):
 *   · 정수배 스케일만 — 도트가 뭉개지지 않는 유일한 조건.
 *   · 랜덤 금지: 흔들림은 시간/인덱스 결정값으로만(양쪽 폰이 같은 화면).
 *   · 첫 프레임은 **동기로** 그린다. rAF 안에서만 그리면 백그라운드 탭 복귀·저전력·헤드리스에서
 *     캔버스가 빈 채 남는다(실제로 겪은 버그).
 *   · prefers-reduced-motion 이면 1프레임만.
 */

import { useEffect, useRef } from "react";
import { type Sprite, frameAt, pixelAt, tintPalette } from "@/lib/pixel";
import { petSprites, sleepSprite } from "@/lib/pixelart";

const SPRITE = 32; // 스프라이트 논리 크기(정사각)
const PAD = 1; // 그림자·숨쉬기(1px) 여유 — 34 논리칸이 1배율에서 34 CSS px 로 딱 맞는다

export default function PetPixel({
  form,
  size = 64,
  asleep = false,
  active = true,
  shadow = true,
  bob = true,
  tint,
  onTap,
  className,
  title,
}: {
  form: string;
  size?: number; // 목표 CSS 크기(px). 실제 크기는 정수배로 반올림된다.
  asleep?: boolean;
  active?: boolean; // false 면 애니 정지(안 보이는 화면)
  shadow?: boolean; // 발밑 그림자
  bob?: boolean; // 숨쉬기 1px. PetYard 처럼 바깥에서 이미 흔드는 자리에선 false(이중 흔들림 방지)
  tint?: { light: string; t: number; mul: number }; // 시간대 조명(홈 월드가 넘김)
  onTap?: () => void;
  className?: string;
  title?: string;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const box = SPRITE + PAD * 2;
    // 정수배만 허용하되 **반올림**한다. 내림으로 하면 size=64 가 1배율(34px)로 떨어져
    // 요청 크기의 절반이 된다 — 도트가 뭉개지지 않는 선에서 가장 가까운 배율을 고른다.
    const scale = Math.max(1, Math.round(size / box));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = box * scale * dpr;
    c.height = box * scale * dpr;
    c.style.width = `${box * scale}px`;
    c.style.height = `${box * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr;

    const lit = (s: Sprite): Sprite =>
      tint ? { ...s, pal: tintPalette(s.pal, tint.light, tint.t, tint.mul) } : s;

    const frames = petSprites(form).map(lit);
    const sleeping = lit(sleepSprite(form));

    const blit = (s: Sprite, ox: number, oy: number) => {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const col = pixelAt(s, x, y);
          if (!col) continue;
          ctx.fillStyle = col;
          ctx.fillRect((ox + x) * px, (oy + y) * px, px, px);
        }
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      const still = reduced || !active || asleep;
      const walk = still ? 0 : frameAt(t, 2, 460);
      const lift = still || !bob ? 0 : frameAt(t, 2, 640); // 숨쉬기 1px
      const s = asleep ? sleeping : frames[walk % frames.length];
      const ox = PAD + Math.round((SPRITE - s.w) / 2);
      const oy = PAD + (SPRITE - s.h) - lift;

      if (shadow) {
        ctx.fillStyle = "rgba(40,30,60,0.20)";
        ctx.fillRect((ox + 5) * px, (PAD + SPRITE - 1) * px, (s.w - 10) * px, px);
      }
      blit(s, ox, oy);

      // 자는 중 — 픽셀 💤 세 점이 올라간다
      if (asleep && !reduced && active) {
        ctx.fillStyle = "#fffdf7";
        for (let i = 0; i < 3; i++) {
          const p = (t / 1500 + i * 0.33) % 1;
          ctx.globalAlpha = 1 - p;
          const zx = ox + s.w - 6 + Math.round(p * 4);
          const zy = oy + 6 - Math.round(p * 8);
          const zs = px * (1 + Math.round(p));
          if (zy >= 0) ctx.fillRect(zx * px, zy * px, zs, zs);
        }
        ctx.globalAlpha = 1;
      }
    };

    draw(performance.now());
    if (reduced || !active) return;
    const loop = (t: number) => {
      draw(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [form, size, asleep, active, shadow, bob, tint]);

  return (
    <canvas
      ref={cvs}
      onClick={onTap}
      role="img"
      aria-label={title ?? "펫"}
      className={`select-none ${onTap ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
