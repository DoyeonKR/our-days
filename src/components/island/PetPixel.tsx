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
import { type Sprite, cropSprite, downscale2, frameAt, pixelAt, tintPalette } from "@/lib/pixel";
import { petSprites, sleepSprite } from "@/lib/pixelart";

const PAD = 1; // 그림자·숨쉬기(1px) 여유
/** 걷기 한 바퀴(ms) — 프레임당이 아니라 총 시간(PixelPet 과 같은 개념, 옛 2×460). */
const WALK_CYCLE_MS = 920;

/* 얼굴(초상) 크롭 — 아주 작은 자리를 위한 변형.
 * 픽셀 아트는 1배율보다 작게 못 줄인다. 48×48 전신은 최소 50 CSS px 라 24px·20px 칸
 * (탭 아이콘·쿡찌르기 배지)에 그대로 넣으면 넘친다.
 * → **귀+얼굴만 잘라 2:1 축소**한다(48 판이므로 정수배 축소가 되어 격자가 안 깨진다).
 * 초상 아이콘은 게임 UI 의 흔한 문법이라 의도적으로 보이고, 1배율에서 24px 안에 들어간다. */
const FACE = { x: 6, y: 0, w: 36, h: 30 };
const faceOf = (s: Sprite): Sprite => downscale2(cropSprite(s, FACE.x, FACE.y, FACE.w, FACE.h));

export default function PetPixel({
  form,
  size = 64,
  asleep = false,
  active = true,
  shadow = true,
  bob = true,
  face = false,
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
  face?: boolean; // 얼굴만 크롭(24×22) — 20~24px 칸에 전신을 넣으면 넘친다
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

    // 스프라이트 크기에 종속되지 않게 — 48판/32판 어느 쪽이 와도 동작한다.
    const base = petSprites(form)[0];
    const SPRITE = base.w;
    const cropW = face ? FACE.w / 2 : SPRITE + PAD * 2;
    const cropH = face ? FACE.h / 2 : base.h + PAD * 2;
    const box = Math.max(cropW, cropH);
    // 정수배만 허용하되 **반올림**한다. 내림으로 하면 size=64 가 1배율(34px)로 떨어져
    // 요청 크기의 절반이 된다 — 도트가 뭉개지지 않는 선에서 가장 가까운 배율을 고른다.
    const scale = Math.max(1, Math.round(size / box));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = cropW * scale * dpr;
    c.height = cropH * scale * dpr;
    c.style.width = `${cropW * scale}px`;
    c.style.height = `${cropH * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr;

    const lit = (s: Sprite): Sprite =>
      tint ? { ...s, pal: tintPalette(s.pal, tint.light, tint.t, tint.mul) } : s;

    const frames = petSprites(form).map((sp) => lit(face ? faceOf(sp) : sp));
    const sleeping = lit(face ? faceOf(sleepSprite(form)) : sleepSprite(form));

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
      // ⚠ 프레임 수는 배열에서 읽고, ms 는 한 바퀴 총 시간에서 나눈다(PixelPet 과 같은 이유).
      const walk = still ? 0 : frameAt(t, frames.length, WALK_CYCLE_MS / frames.length);
      // ⚠ 아래 2 는 프레임 수가 아니라 **0/1 두 값**이다(숨쉬기 1px). 프레임 수 치환에
      //   휩쓸리면 펫이 0~5px 을 오르내리고 PAD 가 1px 뿐이라 머리가 캔버스 위로 잘린다.
      const lift = still || !bob ? 0 : frameAt(t, 2, 640);
      const s = asleep ? sleeping : frames[walk % frames.length];
      const ox = face ? 0 : PAD + Math.round((SPRITE - s.w) / 2);
      const oy = (face ? 0 : PAD + (base.h - s.h)) - lift;

      if (shadow && !face) {
        ctx.fillStyle = "rgba(40,30,60,0.20)";
        ctx.fillRect((ox + 6) * px, (PAD + base.h - 1) * px, (s.w - 12) * px, px);
      }
      blit(s, ox, oy);

      // 자는 중 — 픽셀 💤 세 점이 올라간다
      if (asleep && !reduced && active && !face) {
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
  }, [form, size, asleep, active, shadow, bob, face, tint]);

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
