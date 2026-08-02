"use client";

/* 픽셀 아트 펫 무대 — 손으로 찍은 도트 스프라이트를 캔버스에 크게 확대해 렌더한다.
 *
 * 왜 캔버스인가: 픽셀 아트는 확대해도 흐려지면 안 된다(imageSmoothingEnabled=false).
 * DOM/SVG 로는 픽셀 퍼펙트를 보장하기 어렵고, 파티클 수십 개를 DOM 노드로 두면 무겁다.
 * 이 저장소엔 이미 캔버스 선례가 있다(games/TetrisPlayfield.tsx — DPR·rAF·터치).
 *
 * 렌더 규약
 *  · 논리 해상도 = LOGICAL_W x LOGICAL_H 픽셀. 실제 캔버스는 정수배(scale)로만 확대 → 도트가 뭉개지지 않음.
 *  · 시간대 조명은 **팔레트 스왑**(pixel.tintPalette)으로 — 스프라이트를 다시 그리지 않는다.
 *  · 랜덤 금지: 파티클/반짝임은 hash01(인덱스) 로만. 양쪽 폰이 같은 화면을 본다.
 *  · prefers-reduced-motion 이면 애니 루프를 돌리지 않고 1프레임만 그린다.
 */

import { useEffect, useRef } from "react";
import { type Sprite, frameAt, hash01, pixelAt, tintPalette } from "@/lib/pixel";
import { FLOWER, GRASS, HEART, SLEEP, STAR, TREE, petSprites } from "@/lib/pixelart";
import { type SkyLook } from "@/lib/scenetime";

/** 논리 픽셀 해상도 — 이 격자 위에 모든 걸 찍는다. */
const LOGICAL_W = 96;
const LOGICAL_H = 54;
const GROUND_Y = 42; // 지면 라인(논리 픽셀)

export type PixelFx = "heart" | "star" | "flower" | null;

export default function PixelPet({
  form,
  asleep = false,
  look,
  fx = null,
  fxKey = 0,
  active = true,
  onTap,
  className,
}: {
  form: string;
  asleep?: boolean;
  look: SkyLook; // 시간대 조명(하늘 팔레트와 같은 소스)
  fx?: PixelFx; // 파티클 버스트 종류
  fxKey?: number; // 값이 바뀌면 버스트 재시작
  active?: boolean; // false 면 애니 정지(안 보이는 탭)
  onTap?: () => void;
  className?: string;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const fxStart = useRef(0);
  const fxKind = useRef<PixelFx>(null);

  // fx 트리거 — 렌더 루프가 읽는 ref 로만(리렌더 없이 버스트)
  useEffect(() => {
    if (!fx) return;
    fxKind.current = fx;
    fxStart.current = performance.now();
  }, [fx, fxKey]);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 정수배 스케일 — 도트가 뭉개지지 않는 유일한 조건.
    // 상한(6)을 두는 이유: 데스크톱 넓은 뷰포트에서 scale 12 까지 올라가면 무대가 650px 로
    // 치솟아 레이아웃을 밀어낸다(모바일 375px 기준 scale 3~4 가 적정).
    const cssW = c.clientWidth || 288;
    const scale = Math.min(6, Math.max(1, Math.floor(cssW / LOGICAL_W)));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = LOGICAL_W * scale * dpr;
    c.height = LOGICAL_H * scale * dpr;
    c.style.height = `${LOGICAL_H * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr; // 논리 1픽셀이 차지하는 실제 픽셀

    // 시간대 조명값 — 밤일수록 어둡고 조명색으로 물든다
    const tint = look.night ? 0.42 : look.onDark ? 0.3 : 0.12;
    const mul = look.night ? 0.62 : look.onDark ? 0.85 : 1;
    const lit = (s: Sprite): Sprite => ({ ...s, pal: tintPalette(s.pal, look.light, tint, mul) });

    /** 스프라이트를 논리좌표 (ox,oy) 에 찍는다. */
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

    const petFrames = petSprites(form).map(lit);
    const sleepLit = lit(SLEEP);
    const grassLit = lit(GRASS);
    const treeLit = lit(TREE);
    const fxSprite = { heart: lit(HEART), star: lit(STAR), flower: lit(FLOWER) };

    const draw = (t: number) => {
      // ── 하늘(그라데이션 밴드 — 픽셀 아트답게 계단식) ──
      const bands = [look.top, look.upper, look.mid, look.lower, look.bottom];
      const bandH = Math.ceil(GROUND_Y / bands.length);
      bands.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(0, i * bandH * px, LOGICAL_W * px, bandH * px);
      });

      // ── 별(밤) ──
      if (look.starOpacity > 0.05) {
        ctx.globalAlpha = look.starOpacity;
        ctx.fillStyle = "#fffdf0";
        for (let i = 0; i < 22; i++) {
          const sx = Math.floor(hash01(i, 11) * LOGICAL_W);
          const sy = Math.floor(hash01(i, 23) * (GROUND_Y - 10));
          const tw = 0.6 + 0.4 * Math.sin(t / 700 + i);
          ctx.globalAlpha = look.starOpacity * tw;
          ctx.fillRect(sx * px, sy * px, px, px);
        }
        ctx.globalAlpha = 1;
      }

      // ── 지면(잔디 타일링) ──
      for (let y = GROUND_Y; y < LOGICAL_H; y += grassLit.h)
        for (let x = 0; x < LOGICAL_W; x += grassLit.w) blit(grassLit, x, y);

      // ── 나무(양쪽) ──
      blit(treeLit, 4, GROUND_Y - treeLit.h + 2);
      blit(treeLit, LOGICAL_W - 20, GROUND_Y - treeLit.h + 3);

      // ── 펫 ──
      const walkPhase = reduced || !active ? 0 : frameAt(t, 2, 420);
      const sprite = asleep ? sleepLit : petFrames[walkPhase % petFrames.length];
      // 살짝 좌우로 거니는 위치(결정적 사인) + 숨쉬기 1px
      const wander = reduced || asleep ? 0 : Math.round(Math.sin(t / 2600) * 10);
      const bob = reduced || asleep ? 0 : frameAt(t, 2, 640);
      const petX = Math.round(LOGICAL_W / 2 - sprite.w / 2) + wander;
      const petY = GROUND_Y - sprite.h + 1 - bob;
      // 발밑 그림자(픽셀 타원 대용 — 2행)
      ctx.fillStyle = "rgba(40,30,60,0.22)";
      ctx.fillRect((petX + 3) * px, (GROUND_Y - 1) * px, (sprite.w - 6) * px, px);
      blit(sprite, petX, petY);

      // 자는 중 — 💤 대신 픽셀 점 3개가 올라감
      if (asleep && !reduced) {
        ctx.fillStyle = "#fffdf7";
        for (let i = 0; i < 3; i++) {
          const p = ((t / 1400 + i * 0.33) % 1);
          const zx = petX + sprite.w - 2 + Math.round(p * 5);
          const zy = petY - Math.round(p * 10);
          ctx.globalAlpha = 1 - p;
          ctx.fillRect(zx * px, zy * px, px * (1 + Math.round(p)), px * (1 + Math.round(p)));
        }
        ctx.globalAlpha = 1;
      }

      // ── 파티클 버스트(하트/별/꽃) ──
      const k = fxKind.current;
      if (k && !reduced) {
        const age = (t - fxStart.current) / 1000; // 초
        if (age >= 0 && age < 1.3) {
          const s = fxSprite[k];
          for (let i = 0; i < 10; i++) {
            const ang = hash01(i, 7) * Math.PI * 2;
            const spd = 12 + hash01(i, 13) * 16;
            const px0 = LOGICAL_W / 2 + Math.cos(ang) * spd * age;
            const py0 = petY + 4 + Math.sin(ang) * spd * age - age * 14;
            ctx.globalAlpha = Math.max(0, 1 - age / 1.3);
            blit(s, Math.round(px0 - s.w / 2), Math.round(py0 - s.h / 2));
          }
          ctx.globalAlpha = 1;
        } else if (age >= 1.3) {
          fxKind.current = null;
        }
      }
    };

    // ⚠ 첫 프레임은 **동기로** 그린다. rAF 안에서만 그리면 rAF 가 스로틀되는 상황
    // (백그라운드 탭 복귀·저전력 모드·헤드리스)에서 캔버스가 빈 채로 남는다.
    draw(performance.now());
    if (reduced || !active) return;
    const loop = (t: number) => {
      draw(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [form, asleep, look, active]);

  return (
    <canvas
      ref={cvs}
      onClick={onTap}
      role="img"
      aria-label="픽셀 아트 펫"
      className={`w-full cursor-pointer select-none ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
