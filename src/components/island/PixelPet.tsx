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
import { type Sprite, frameAt, gearAnchors, hash01, pixelAt, tintPalette } from "@/lib/pixel";
import { FLOWER, GRASS, HEART, STAR, TREE, petSprites, sleepSprite } from "@/lib/pixelart";
import { type SkyLook } from "@/lib/scenetime";
import { TAP_LAND_MS, hopLift, hopMs, tapHop } from "@/lib/petmotion";
import { gearSprite } from "@/lib/pixelgear";

/** 논리 픽셀 해상도 — 이 격자 위에 모든 걸 찍는다. */
const LOGICAL_W = 192;
const LOGICAL_H = 108;
const GROUND_Y = 84; // 지면 라인(논리 픽셀)
/** 걷기 한 바퀴(ms). 프레임당이 아니라 **총 시간**이다 — 프레임 수가 폼마다 달라도
 *  (펫 6장 · 알 2장) 걷는 속도가 같아야 한다. 2프레임 시절 값 2×420 을 그대로 이었다. */
const WALK_CYCLE_MS = 840;

export type PixelFx = "heart" | "star" | "flower" | null;

export default function PixelPet({
  form,
  asleep = false,
  look,
  fx = null,
  fxKey = 0,
  tapCombo = 0,
  tapKey = 0,
  gear,
  active = true,
  onTap,
  className,
}: {
  form: string;
  asleep?: boolean;
  look: SkyLook; // 시간대 조명(하늘 팔레트와 같은 소스)
  fx?: PixelFx; // 파티클 버스트 종류
  fxKey?: number; // 값이 바뀌면 버스트 재시작
  /** 연타 수 — 점프 높이가 여기 비례한다(단계가 아니라 연속). */
  tapCombo?: number;
  /** 값이 바뀌면 점프를 새로 시작한다(같은 콤보로 연타해도 재생되도록). */
  tapKey?: number;
  /** 장착 장비(슬롯별 key). 앵커는 스프라이트 잉크 박스에서 자동 산출 — 폼별 보정 없음. */
  gear?: { weapon?: string | null; hat?: string | null; cape?: string | null };
  active?: boolean; // false 면 애니 정지(안 보이는 탭)
  onTap?: () => void;
  className?: string;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const fxStart = useRef(0);
  const fxKind = useRef<PixelFx>(null);
  // 점프는 **렌더 루프가 읽는 ref** 로만 굴린다 — state 로 두면 매 프레임 리렌더가 나고
  // effect deps 가 바뀌어 캔버스를 다시 굽는다(배경 재굽기 = 프레임 드랍).
  const hop = useRef({ at: -1e9, combo: 0 });

  // fx 트리거 — 렌더 루프가 읽는 ref 로만(리렌더 없이 버스트)
  useEffect(() => {
    if (!fx) return;
    fxKind.current = fx;
    fxStart.current = performance.now();
  }, [fx, fxKey]);

  // 탭 점프 트리거. 같은 값으로 다시 눌러도 재생되게 tapKey 를 함께 본다.
  useEffect(() => {
    if (!tapKey) return;
    hop.current = { at: performance.now(), combo: tapCombo };
  }, [tapKey, tapCombo]);

  /* ⚠ gear 객체를 그대로 effect 의존성에 넣으면 매 렌더가 새 객체라 캔버스를 계속 다시 굽는다.
     반대로 안 넣으면 장비를 바꿔도 화면이 그대로다. **원시값 3개로 쪼개** 둘 다 피한다. */
  const gw = gear?.weapon ?? null;
  const gh = gear?.hat ?? null;
  const gc = gear?.cape ?? null;

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
    const cssW = c.clientWidth || 384;
    const scale = Math.min(4, Math.max(1, Math.floor(cssW / LOGICAL_W)));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = LOGICAL_W * scale * dpr;
    c.height = LOGICAL_H * scale * dpr;
    c.style.height = `${LOGICAL_H * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr; // 논리 1픽셀이 차지하는 실제 픽셀

    /* 시간대 조명값 — 밤일수록 어둡고 조명색으로 물든다.
       ⚠ **배경과 주인공에 같은 값을 쓰면 안 된다.** 그러면 밤에 펫이 배경과 똑같이 어두워지고
         같은 색으로 물들어 실루엣이 안 떨어진다(사용자: "히어로가 흐리멍텅해").
         피사체는 살리고 배경은 눕히는 게 조명의 기본이다 — 펫은 배경의 HERO_LIT 만큼만 먹는다. */
    const tint = look.night ? 0.42 : look.onDark ? 0.3 : 0.12;
    const mul = look.night ? 0.62 : look.onDark ? 0.85 : 1;
    const HERO_LIT = 0.4; // 주인공이 받는 조명 비율(배경 대비)
    const lit = (s: Sprite): Sprite => ({ ...s, pal: tintPalette(s.pal, look.light, tint, mul) });
    /** 주인공용 — 덜 물들고 덜 어두워진다. 밤에도 종 색이 남는다. */
    const litHero = (s: Sprite): Sprite => ({
      ...s,
      pal: tintPalette(s.pal, look.light, tint * HERO_LIT, 1 - (1 - mul) * HERO_LIT),
    });
    /** 림 라이트 — 실루엣 바깥 1px 에 어두운 테. 배경이 복잡해도 경계가 선다.
     *  스프라이트 안쪽 외곽선(o)과 달리 **바깥**에 그리므로 원본 도트를 건드리지 않는다. */
    const rim = (sp: Sprite, ox: number, oy: number) => {
      ctx.fillStyle = look.night ? "rgba(8,6,20,0.85)" : "rgba(20,14,34,0.6)";
      for (let y = 0; y < sp.h; y++) {
        for (let x = 0; x < sp.w; x++) {
          if (pixelAt(sp, x, y)) continue; // 잉크가 있는 칸은 건너뛴다
          // 상하좌우 중 하나라도 잉크면 여기는 '바깥 경계'다
          if (
            pixelAt(sp, x - 1, y) || pixelAt(sp, x + 1, y) ||
            pixelAt(sp, x, y - 1) || pixelAt(sp, x, y + 1)
          ) {
            ctx.fillRect((ox + x) * px, (oy + y) * px, px, px);
          }
        }
      }
    };

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

    const petFrames = petSprites(form).map(litHero);
    const sleepLit = litHero(sleepSprite(form)); // 종 색을 유지한 채 웅크린 포즈
    const grassLit = lit(GRASS);
    const treeLit = lit(TREE);
    const fxSprite = { heart: lit(HEART), star: lit(STAR), flower: lit(FLOWER) };

    /* ── 배경을 **한 번만** 굽는다 ────────────────────────────────
     * 하늘 밴드·잔디 72타일·나무 4그루는 프레임 간 1픽셀도 안 변한다(조명은 effect 실행 때
     * 이미 확정). 이걸 rAF 마다 다시 칠하면 프레임당 fillRect 가 6,400여 회가 되고 그중 90%가
     * 완전 중복이다(2026-08-03 적대 검증에서 수치까지 확정). 오프스크린에 구워두고 매 프레임
     * drawImage 한 번으로 끝낸다 → 프레임당 fillRect ≈ 620. */
    const bg = document.createElement("canvas");
    bg.width = c.width;
    bg.height = c.height;
    const bgx = bg.getContext("2d");
    if (bgx) {
      bgx.imageSmoothingEnabled = false;
      const bands = [look.top, look.upper, look.mid, look.lower, look.bottom];
      const bandH = Math.ceil(GROUND_Y / bands.length);
      bands.forEach((col, i) => {
        bgx.fillStyle = col;
        bgx.fillRect(0, i * bandH * px, LOGICAL_W * px, bandH * px);
      });
      const blitBg = (s: Sprite, ox: number, oy: number) => {
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            const col = pixelAt(s, x, y);
            if (!col) continue;
            bgx.fillStyle = col;
            bgx.fillRect((ox + x) * px, (oy + y) * px, px, px);
          }
        }
      };
      for (let y = GROUND_Y; y < LOGICAL_H; y += grassLit.h)
        for (let x = 0; x < LOGICAL_W; x += grassLit.w) blitBg(grassLit, x, y);
      blitBg(treeLit, 8, GROUND_Y - treeLit.h + 2);
      blitBg(treeLit, 34, GROUND_Y - treeLit.h - 4);
      blitBg(treeLit, LOGICAL_W - 32, GROUND_Y - treeLit.h + 3);
      blitBg(treeLit, LOGICAL_W - 58, GROUND_Y - treeLit.h - 3);
    }

    const draw = (t: number) => {
      ctx.drawImage(bg, 0, 0);

      // ── 별(밤) — 반짝임이 시간에 따라 변하므로 배경에 굽지 않는다 ──
      if (look.starOpacity > 0.05) {
        ctx.globalAlpha = look.starOpacity;
        ctx.fillStyle = "#fffdf0";
        for (let i = 0; i < 48; i++) {
          const sx = Math.floor(hash01(i, 11) * LOGICAL_W);
          const sy = Math.floor(hash01(i, 23) * (GROUND_Y - 20));
          const tw = 0.6 + 0.4 * Math.sin(t / 700 + i);
          ctx.globalAlpha = look.starOpacity * tw;
          ctx.fillRect(sx * px, sy * px, px, px);
        }
        ctx.globalAlpha = 1;
      }

      // ── 펫 ──
      /* 탭 점프 — **여기서만** 움직인다. 캔버스 래퍼에 CSS transform 을 걸면 하늘·잔디·나무가
         함께 움직여 '네모가 통째로 흔들린다'(사용자 리포트 2026-08-05). 오프셋은 순수 함수
         tapHop() 이 주고 전부 정수 논리 픽셀이라 도트가 격자를 벗어나지 않는다. */
      const age = t - hop.current.at;
      const jumping = !reduced && !asleep && age >= 0 && age <= hopMs(hop.current.combo) + TAP_LAND_MS;
      const j = jumping ? tapHop(hop.current.combo, age) : { dx: 0, dy: 0 };
      const lift = jumping ? hopLift(hop.current.combo, age) : 0;

      // 뛰는 동안엔 걷기 프레임을 고정한다 — 공중에서 다리가 움직이면 걸어 다니는 것처럼 보인다.
      // ⚠ 프레임 수는 스프라이트에서 읽는다(2로 박으면 3~6번 프레임이 영영 안 나온다).
      //   ms 는 **한 바퀴 총 시간**에서 나눈다 — 프레임당 ms 를 고정하면 알(2장)만
      //   3배 빨리 떨리고 펫(6장)은 그대로다.
      const walkPhase =
        reduced || !active || lift > 0.05
          ? 0
          : frameAt(t, petFrames.length, WALK_CYCLE_MS / petFrames.length);
      const sprite = asleep ? sleepLit : petFrames[walkPhase % petFrames.length];
      // 살짝 좌우로 거니는 위치(결정적 사인) + 숨쉬기 1px
      const wander = reduced || asleep ? 0 : Math.round(Math.sin(t / 2600) * 22);
      const bob = reduced || asleep || jumping ? 0 : frameAt(t, 2, 640);
      const petX = Math.round(LOGICAL_W / 2 - sprite.w / 2) + wander + j.dx;
      const petY = GROUND_Y - sprite.h + 1 - bob + j.dy;
      // 발밑 그림자 — 뜰수록 좁고 옅게(발밑이 그대로면 점프로 안 보인다). 그림자는 지면에 남는다.
      const shrink = Math.round(lift * 5);
      ctx.fillStyle = `rgba(40,30,60,${(0.22 * (1 - lift * 0.6)).toFixed(3)})`;
      ctx.fillRect((petX - j.dx + 3 + shrink) * px, (GROUND_Y - 1) * px, (sprite.w - 6 - shrink * 2) * px, px);

      /* ── 장비 ──
       * 앵커는 **이 프레임 스프라이트의 잉크 박스**에서 뽑는다. 폼이 12종이고 실루엣이
       * 제각각(알·병아리·여우·올빼미…)이라 좌표를 박으면 어딘가는 반드시 어긋난다.
       * 박스를 재면 어떤 폼이 와도 머리 위·어깨 옆에 붙는다. 점프 오프셋도 같이 탄다. */
      const an = gearAnchors(sprite);
      if (an.ok) {
        const cape = gc ? gearSprite(gc) : null;
        if (cape) blit(litHero(cape), petX + an.back.x - Math.floor(cape.w / 2), petY + an.back.y);
        rim(sprite, petX, petY); // 몸 **바로 밑**에 테를 깔아 배경과 분리
        blit(sprite, petX, petY); // 망토 위에 몸이 온다
        const hat = gh ? gearSprite(gh) : null;
        // 모자 **밑동**이 정수리에 오게 — 위로 그린다(박스 위에 띄우면 '얹힌' 게 아니라 '뜬' 것)
        if (hat) blit(litHero(hat), petX + an.head.x - Math.floor(hat.w / 2), petY + an.head.y - hat.h);
        const weapon = gw ? gearSprite(gw) : null;
        // 무기 **손잡이**(아래 25%)가 앞발 높이에 오고, 몸 바깥선에 걸쳐야 '쥔' 것으로 읽힌다
        if (weapon)
          blit(
            litHero(weapon),
            petX + an.hand.x - Math.floor(weapon.w / 2),
            petY + an.hand.y - Math.round(weapon.h * 0.75),
          );
      } else {
        rim(sprite, petX, petY);
        blit(sprite, petX, petY);
      }

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
            const spd = 24 + hash01(i, 13) * 32;
            const px0 = LOGICAL_W / 2 + Math.cos(ang) * spd * age;
            const py0 = petY + 8 + Math.sin(ang) * spd * age - age * 28;
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
  }, [form, asleep, look, active, gw, gh, gc]);

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
