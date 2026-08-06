"use client";

/* 사냥 무대 — 히어로(왼쪽)가 무기를 들고 몬스터(오른쪽)를 자동으로 때린다.
 *
 * PixelPet 과 같은 캔버스 규약을 쓴다: 논리 격자 + 정수배 확대 + 배경 1회 굽기.
 * 다만 여기서는 **두 캐릭터가 서로를 향해** 서야 해서 무기 앵커가 다르다 —
 * PixelPet 은 무기를 오른쪽에 세워 들지만, 여기서는 몬스터 쪽으로 **휘두른다**.
 *
 * ⚠ 공격 모션은 CSS 가 아니라 캔버스 안 좌표로 만든다. 래퍼에 transform 을 걸면
 *   배경까지 통째로 흔들린다(2026-08-05 에 섬에서 겪은 그 문제).
 */

import { useEffect, useRef } from "react";
import { type Sprite, pixelAt, tintPalette } from "@/lib/pixel";
import { GRASS, TREE, petSprites } from "@/lib/pixelart";
import { gearSprite } from "@/lib/pixelgear";
import { monsterSprite } from "@/lib/pixelmonster";
import { type SkyLook } from "@/lib/scenetime";

const LOGICAL_W = 192;
const LOGICAL_H = 96;
const GROUND_Y = 76;
/** 한 번 휘두르는 데 걸리는 시간(ms). 1초 틱과 무관하게 계속 도는 상시 모션. */
const SWING_MS = 900;

export default function HuntStage({
  form,
  monster,
  look,
  weapon,
  hitKey,
}: {
  form: string;
  monster: string;
  look: SkyLook;
  weapon: string | null;
  /** 값이 바뀌면 피격 연출(몬스터가 밀리고 번쩍). */
  hitKey: number;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const hitAt = useRef(-1e9);

  useEffect(() => {
    if (hitKey) hitAt.current = performance.now();
  }, [hitKey]);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cssW = c.clientWidth || 360;
    const scale = Math.min(4, Math.max(1, Math.floor(cssW / LOGICAL_W)));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = LOGICAL_W * scale * dpr;
    c.height = LOGICAL_H * scale * dpr;
    c.style.height = `${LOGICAL_H * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr;

    const tint = look.night ? 0.42 : look.onDark ? 0.3 : 0.12;
    const mul = look.night ? 0.62 : look.onDark ? 0.85 : 1;
    const lit = (s: Sprite): Sprite => ({ ...s, pal: tintPalette(s.pal, look.light, tint, mul) });

    const blit = (s: Sprite, ox: number, oy: number, flip = false) => {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const col = pixelAt(s, x, y);
          if (!col) continue;
          ctx.fillStyle = col;
          const dx = flip ? ox + (s.w - 1 - x) : ox + x;
          ctx.fillRect(dx * px, (oy + y) * px, px, px);
        }
      }
    };
    /** 스프라이트의 잉크 경계 — 앵커를 폼별로 박지 않기 위한 것(PixelPet 과 같은 수법). */
    const inkBox = (s: Sprite) => {
      let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          if (!pixelAt(s, x, y)) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      return { x0, y0, x1, y1 };
    };

    const hero = lit(petSprites(form)[0]);
    const mon = lit(monsterSprite(monster));
    const wpn = weapon ? lit(gearSprite(weapon) ?? monsterSprite("slime")) : null;
    const grassLit = lit(GRASS);
    const treeLit = lit(TREE);

    // 배경 1회 굽기 — 매 프레임 다시 칠하면 프레임당 fillRect 가 수천 회가 된다
    const bg = document.createElement("canvas");
    bg.width = c.width;
    bg.height = c.height;
    const bx = bg.getContext("2d");
    if (bx) {
      bx.imageSmoothingEnabled = false;
      const bands = [look.top, look.upper, look.mid, look.lower, look.bottom];
      const bandH = Math.ceil(GROUND_Y / bands.length);
      bands.forEach((col, i) => {
        bx.fillStyle = col;
        bx.fillRect(0, i * bandH * px, LOGICAL_W * px, bandH * px);
      });
      const blitBg = (s: Sprite, ox: number, oy: number) => {
        for (let y = 0; y < s.h; y++)
          for (let x = 0; x < s.w; x++) {
            const col = pixelAt(s, x, y);
            if (!col) continue;
            bx.fillStyle = col;
            bx.fillRect((ox + x) * px, (oy + y) * px, px, px);
          }
      };
      for (let y = GROUND_Y; y < LOGICAL_H; y += grassLit.h)
        for (let x = 0; x < LOGICAL_W; x += grassLit.w) blitBg(grassLit, x, y);
      blitBg(treeLit, 4, GROUND_Y - treeLit.h + 2);
      blitBg(treeLit, LOGICAL_W - 28, GROUND_Y - treeLit.h + 1);
    }

    const heroX = 26;
    const monX = LOGICAL_W - 26 - mon.w;
    const heroY = GROUND_Y - hero.h + 1;
    const monY = GROUND_Y - mon.h + 1;
    const hbox = inkBox(hero);

    const draw = (t: number) => {
      ctx.drawImage(bg, 0, 0);

      // 휘두르기 위상 0~1 — 앞으로 내디뎠다 돌아온다(정수 픽셀만 이동)
      const p = reduced ? 0 : ((t % SWING_MS) / SWING_MS);
      const lunge = Math.round(Math.sin(p * Math.PI) * 5);
      // 피격 반동 — 맞은 직후 짧게 뒤로 밀린다
      const age = t - hitAt.current;
      const knock = !reduced && age >= 0 && age < 220 ? Math.round((1 - age / 220) * 4) : 0;
      const flash = !reduced && age >= 0 && age < 120;

      // 그림자
      ctx.fillStyle = "rgba(40,30,60,0.22)";
      ctx.fillRect((heroX + lunge + 4) * px, (GROUND_Y - 1) * px, (hero.w - 8) * px, px);
      ctx.fillRect((monX + knock + 3) * px, (GROUND_Y - 1) * px, (mon.w - 6) * px, px);

      // 몬스터 — 오른쪽. 맞으면 밀리고 번쩍인다
      blit(mon, monX + knock, monY);
      if (flash) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#fffdf7";
        for (let y = 0; y < mon.h; y++)
          for (let x = 0; x < mon.w; x++) {
            if (!pixelAt(mon, x, y)) continue;
            ctx.fillRect((monX + knock + x) * px, (monY + y) * px, px, px);
          }
        ctx.globalAlpha = 1;
      }

      // 히어로 — 왼쪽, 몬스터를 바라본다(기본 스프라이트가 정면이라 그대로 둔다)
      blit(hero, heroX + lunge, heroY);

      // 무기 — 몬스터 쪽 어깨에서 휘두른다. 위상에 따라 각도 대신 **위치**로 표현한다
      // (도트를 회전시키면 격자가 깨진다 — README §14.5).
      if (wpn) {
        const wx = heroX + lunge + hbox.x1 - 2 + Math.round(p * 6);
        const wy = heroY + hbox.y0 + Math.round((hbox.y1 - hbox.y0) * 0.3) + Math.round(Math.sin(p * Math.PI) * -4);
        blit(wpn, wx, wy);
      }

      // 타격 이펙트 — 맞는 순간 몬스터 앞에 짧은 섬광 조각
      if (flash) {
        ctx.fillStyle = "#fff3b0";
        const ex = monX + knock - 3;
        const ey = monY + Math.floor(mon.h * 0.45);
        for (const [dx, dy] of [[0, 0], [-2, -3], [-3, 2], [1, -5], [1, 4]]) {
          ctx.fillRect((ex + dx) * px, (ey + dy) * px, px * 2, px * 2);
        }
      }
    };

    draw(performance.now());
    if (reduced) return;
    const loop = (t: number) => {
      draw(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [form, monster, look, weapon]);

  return (
    <canvas
      ref={cvs}
      role="img"
      aria-label="사냥 무대"
      className="block w-full select-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
