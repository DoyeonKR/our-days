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
import { blitSprite, gearAnchors, pixelAt, rot90, setupPixelCanvas, type Sprite, tintPalette } from "@/lib/pixel";
import { GRASS, TREE, petSprites } from "@/lib/pixelart";
import { gearDiag, gearSprite } from "@/lib/pixelgear";
import { monsterSprite } from "@/lib/pixelmonster";
import { type SkyLook } from "@/lib/scenetime";
import { SWING_MS, swingAt } from "@/lib/hunt";

const LOGICAL_W = 192;
const LOGICAL_H = 96;
const GROUND_Y = 76;

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
    const px = setupPixelCanvas(c, ctx, LOGICAL_W, LOGICAL_H, scale, { styleWidth: false });

    const tint = look.night ? 0.42 : look.onDark ? 0.3 : 0.12;
    const mul = look.night ? 0.62 : look.onDark ? 0.85 : 1;
    const lit = (s: Sprite): Sprite => ({ ...s, pal: tintPalette(s.pal, look.light, tint, mul) });

    const blit = (s: Sprite, ox: number, oy: number, flip = false) => blitSprite(ctx, s, ox, oy, px, { flip });
    const hero = lit(petSprites(form)[0]);
    const mon = lit(monsterSprite(monster));
    /* 무기 3자세 — 치켜듦(원본) · 비스듬(직접 찍음) · 내려침(rot90, 격자 손실 0).
       자세가 안 바뀌면 아무리 위치를 흔들어도 '휘두른다'로 안 읽힌다. */
    const base = weapon ? gearSprite(weapon) : null;
    const pose = base
      ? { up: lit(base), diag: lit(gearDiag(weapon!) ?? base), flat: lit(rot90(base)) }
      : null;
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
      const blitBg = (s: Sprite, ox: number, oy: number) => blitSprite(bx, s, ox, oy, px);
      for (let y = GROUND_Y; y < LOGICAL_H; y += grassLit.h)
        for (let x = 0; x < LOGICAL_W; x += grassLit.w) blitBg(grassLit, x, y);
      blitBg(treeLit, 4, GROUND_Y - treeLit.h + 2);
      blitBg(treeLit, LOGICAL_W - 28, GROUND_Y - treeLit.h + 1);
    }

    const heroX = 26;
    const monX = LOGICAL_W - 26 - mon.w;
    const heroY = GROUND_Y - hero.h + 1;
    const monY = GROUND_Y - mon.h + 1;
    const an = gearAnchors(hero);

    const draw = (t: number) => {
      ctx.drawImage(bg, 0, 0);

      // 휘두르기 — 위상 → **자세**. 궤적은 순수 함수 swingAt() 이 정한다(테스트로 잠금).
      const sw = swingAt(reduced ? 0 : (t % SWING_MS) / SWING_MS);
      const lunge = sw.lunge;
      // 피격 반동 — 맞은 직후 짧게 뒤로 밀린다. **칼이 닿는 순간**에도 같이 흔든다.
      const age = t - hitAt.current;
      const hitFx = !reduced && age >= 0 && age < 220 ? 1 - age / 220 : 0;
      const knock = Math.round(Math.max(hitFx, sw.impact ? 0.8 : 0) * 4);
      const flash = !reduced && (sw.impact || (age >= 0 && age < 120));

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
      if (pose && an.ok) {
        const g = pose[sw.pose];
        /* 손잡이가 앞발에 붙어 있어야 자세가 바뀌어도 '쥔 채로' 돌아간다.
           세로 자세는 손잡이가 아래 25%, 가로/비스듬은 **왼쪽 끝**이 손잡이다. */
        const gripX = sw.pose === "up" ? Math.floor(g.w / 2) : 2;
        const gripY = sw.pose === "up" ? Math.round(g.h * 0.75) : Math.floor(g.h / 2);
        blit(g, heroX + lunge + an.hand.x - gripX + sw.dx, heroY + an.hand.y - gripY + sw.dy);
      }

      // 타격 이펙트 — 맞는 순간 몬스터 앞에 짧은 섬광 조각
      if (flash) {
        // 베인 자국 — 칼이 지나간 궤적을 짧은 사선으로 남긴다(타격이 '닿았다'는 신호)
        ctx.fillStyle = "#fffdf7";
        const sx = monX + knock - 8;
        const sy = monY + Math.floor(mon.h * 0.28);
        for (let i = 0; i < 7; i++) ctx.fillRect((sx + i) * px, (sy + i) * px, px * 2, px);
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
