"use client";

/* 펫 스프라이트 한 마리 — 배경 없는 투명 캔버스.
 *
 * 캐릭터만 그린다. 홈 히어로·쿡찌르기·게임 카드·도감처럼 **이미 배경이 있는 자리**에 얹는다.
 * (하늘·지면까지 그리던 섬 무대 PixelPet 은 2026-09-24 지웠다 — 섬은 HeroV2 를 쓴다.)
 *
 * 렌더 규약:
 *   · 정수배 스케일만 — 도트가 뭉개지지 않는 유일한 조건.
 *   · 랜덤 금지: 흔들림은 시간/인덱스 결정값으로만(양쪽 폰이 같은 화면).
 *   · 첫 프레임은 **동기로** 그린다. rAF 안에서만 그리면 백그라운드 탭 복귀·저전력·헤드리스에서
 *     캔버스가 빈 채 남는다(실제로 겪은 버그).
 *   · prefers-reduced-motion 이면 1프레임만.
 */

import { useEffect, useRef } from "react";
import { blitSprite, cropSprite, downscale2, frameAt, gearAnchors, setupPixelCanvas, type Sprite, tintPalette } from "@/lib/pixel";
import { petSprites, sleepSprite } from "@/lib/pixelart";
import { gearSprite } from "@/lib/pixelgear";
import { isMythicForm } from "@/lib/pixelrank";

const PAD = 1; // 그림자·숨쉬기(1px) 여유
/** 걷기 한 바퀴(ms) — 프레임당이 아니라 총 시간(옛 2×460). */
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
  // tint 는 부모가 렌더마다 새 객체로 넘길 수 있다 — 값으로 비교해야 프레임을 매번 다시 굽지 않는다
  const tintLight = tint?.light, tintT = tint?.t, tintMul = tint?.mul;

  /* 2026-11-11 리뷰 — 예전엔 매 프레임(60fps) 1,200 개 안팎의 도트를 fillRect 로 다시 찍었다. 그림은 230ms(걷기) ·
     640ms(숨쉬기)마다만 바뀌고, 화면 밖 · 숨은 탭에서도 계속 돌았다.
     · 모습(걷기 프레임 × 숨쉬기 0/1 · 잠)마다 한 번만 오프스크린 캔버스에 굽고, 모습이 바뀔 때만 drawImage 한 번.
     · 화면 밖(IntersectionObserver) · 숨은 탭(visibilitychange)이면 rAF 를 멈춘다.
     · 잠의 💤 는 연속 애니메이션이라 초당 10번으로 끊어 그린다. */
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
    const px = setupPixelCanvas(c, ctx, cropW, cropH, scale);

    const lit = (sp: Sprite): Sprite =>
      tintLight != null ? { ...sp, pal: tintPalette(sp.pal, tintLight, tintT ?? 0, tintMul ?? 1) } : sp;

    const frames = petSprites(form).map((sp) => lit(face ? faceOf(sp) : sp));
    const sleeping = lit(face ? faceOf(sleepSprite(form)) : sleepSprite(form));
    const innateCape = !face && isMythicForm(form) ? lit(gearSprite("galaxycape")!) : null;

    /** 한 모습을 그 캔버스에 — 그림자 · 망토 · 몸. px = 도트 한 칸의 픽셀 수(구울 땐 1) */
    const paint = (g: CanvasRenderingContext2D, walk: number, lift: number, px: number) => {
      const sp = asleep ? sleeping : frames[walk % frames.length];
      const ox = face ? 0 : PAD + Math.round((SPRITE - sp.w) / 2);
      const oy = (face ? 0 : PAD + (base.h - sp.h)) - lift;
      if (shadow && !face) {
        g.fillStyle = "rgba(40,30,60,0.20)";
        g.fillRect((ox + 6) * px, (PAD + base.h - 1) * px, (sp.w - 12) * px, px);
      }
      if (innateCape && !asleep) {
        const an = gearAnchors(sp);
        if (an.ok) blitSprite(g, innateCape, ox + an.back.x - Math.floor(innateCape.w / 2), oy + an.back.y, px);
      }
      blitSprite(g, sp, ox, oy, px);
      return { sp, ox, oy };
    };
    // 구운 모습 — 키 = 걷기 프레임 · 숨쉬기. **도트 1칸 = 1픽셀**로 구워 정수배로 늘려 찍는다(최근접 확대라 격자 그대로 ·
    // 메모리는 기기 해상도로 굽는 것의 1/px² — iOS 의 캔버스 메모리 한도). 움직이지 않는 펫은 굽지 않고 바로 그린다.
    const animated = !(reduced || !active);
    const baked = new Map<string, HTMLCanvasElement>();
    const bake = (walk: number, lift: number): HTMLCanvasElement | null => {
      if (!animated) return null;
      const k = `${walk}|${lift}`;
      const hit = baked.get(k);
      if (hit) return hit;
      if (typeof document === "undefined") return null;
      const off = document.createElement("canvas");
      off.width = cropW;
      off.height = cropH;
      const g = off.getContext("2d");
      if (!g) return null;
      paint(g, walk, lift, 1);
      baked.set(k, off);
      return off;
    };

    let lastKey = "";
    const draw = (t: number) => {
      const still = reduced || !active || asleep;
      // ⚠ 프레임 수는 배열에서 읽고, ms 는 한 바퀴 총 시간에서 나눈다(프레임당 ms 를 고정하면 알(2장)만 빨리 떤다).
      const walk = still ? 0 : frameAt(t, frames.length, WALK_CYCLE_MS / frames.length);
      // ⚠ 아래 2 는 프레임 수가 아니라 **0/1 두 값**이다(숨쉬기 1px). 프레임 수 치환에
      //   휩쓸리면 펫이 0~5px 을 오르내리고 PAD 가 1px 뿐이라 머리가 캔버스 위로 잘린다.
      const lift = still || !bob ? 0 : frameAt(t, 2, 640);
      const zzz = asleep && !reduced && active && !face;
      const zStep = zzz ? Math.floor(t / 100) : 0; // 💤 는 초당 10번
      const key = `${walk}|${lift}|${zStep}`;
      if (key === lastKey) return; // 모습이 그대로면 아무것도 안 그린다
      lastKey = key;
      ctx.clearRect(0, 0, c.width, c.height);
      const img = bake(walk, lift);
      if (img) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, c.width, c.height);
      } else paint(ctx, walk, lift, px);

      // 자는 중 — 픽셀 💤 세 점이 올라간다
      if (zzz) {
        const sp = sleeping;
        const ox = PAD + Math.round((SPRITE - sp.w) / 2);
        const oy = PAD + (base.h - sp.h) - lift;
        const tz = zStep * 100;
        ctx.fillStyle = "#fffdf7";
        for (let i = 0; i < 3; i++) {
          const p = (tz / 1500 + i * 0.33) % 1;
          ctx.globalAlpha = 1 - p;
          const zx = ox + sp.w - 6 + Math.round(p * 4);
          const zy = oy + 6 - Math.round(p * 8);
          const zs = px * (1 + Math.round(p));
          if (zy >= 0) ctx.fillRect(zx * px, zy * px, zs, zs);
        }
        ctx.globalAlpha = 1;
      }
    };

    // 첫 모습은 **동기로** — rAF 안에서만 그리면 백그라운드 복귀 · 저전력 · 헤드리스에서 빈 캔버스로 남는다
    draw(performance.now());
    if (reduced || !active) return;

    let onScreen = true;
    let running = false;
    const loop = (t: number) => {
      draw(t);
      raf.current = requestAnimationFrame(loop);
    };
    const sync = () => {
      const want = onScreen && !(typeof document !== "undefined" && document.visibilityState === "hidden");
      if (want && !running) {
        running = true;
        raf.current = requestAnimationFrame(loop);
      } else if (!want && running) {
        running = false;
        cancelAnimationFrame(raf.current);
      }
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((es) => {
            onScreen = es.some((e) => e.isIntersecting);
            sync();
          })
        : null;
    io?.observe(c);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      running = false;
      cancelAnimationFrame(raf.current);
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [form, size, asleep, active, shadow, bob, face, tintLight, tintT, tintMul]);

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
