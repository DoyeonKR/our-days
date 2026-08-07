"use client";

/* 보글보글 무대 — 엔진 상태(BubbleState)를 그대로 그리기만 한다.
 *
 * 이 컴포넌트에는 **판정도 물리도 없다.** 전부 lib/bubble.ts 가 이미 끝낸 결과다.
 * 그리기와 규칙이 섞이면 "화면에선 맞았는데 안 죽었다" 같은 게 생기고, 그건 못 고친다.
 *
 * 렌더 규약은 PixelPet/HuntStage 와 같다: 논리 격자 → 정수배 확대 → 배경 1회 굽기.
 * ⚠ 스테이지가 바뀔 때만 배경을 다시 굽는다. 매 프레임 발판을 칠하면 프레임이 죽는다.
 */

import { useEffect, useRef } from "react";
import { type Sprite, downscaleBy, flipX, pixelAt, tintPalette, trimSprite } from "@/lib/pixel";
import { petSprites } from "@/lib/pixelart";
import { monsterSprite } from "@/lib/pixelmonster";
import { type SkyLook } from "@/lib/scenetime";
import {
  BUB_R,
  COLS,
  H,
  ROWS,
  TILE,
  W,
  layoutFor,
  type BubbleState,
} from "@/lib/bubble";

/* 무대가 144×176 이라 원본 스프라이트는 그대로 못 쓴다. 둘의 사정이 다르다:
 *  · 펫 48×48 → **3배 축소** 16×16. 반만 줄이면(24) 층 사이 24px 에 못 들어간다.
 *  · 몬스터 32×32 → 그림은 아래쪽 11px 뿐이고 나머지는 빈 판이다(바닥에 세우려고 그렇게 그렸다).
 *    줄이면 뭉개지니 **여백만 잘라내고** 원본 해상도로 쓴다 — 잘라낸 크기가 곧 몸집이다. */
const heroSprite = (s: Sprite): Sprite => downscaleBy(s, 3);
const monTrim = (s: Sprite): Sprite => trimSprite(s);

export default function BubbleStage({
  state,
  form,
  look,
}: {
  state: BubbleState;
  form: string;
  look: SkyLook;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);
  /* 상태는 매 프레임 바뀐다. 그때마다 effect 를 돌리면 캔버스를 초당 60번 다시 만든다 —
     ref 로 넘겨서 **그리기 루프는 한 번만** 세운다.
     ⚠ 렌더 중에 ref 를 쓰면 안 된다(react-hooks/refs). 그리기는 어차피 rAF 가 하니
     커밋 뒤에 넣어 줘도 늦지 않는다. */
  const cur = useRef(state);
  useEffect(() => {
    cur.current = state;
  }, [state]);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const cssW = c.clientWidth || 320;
    const scale = Math.min(4, Math.max(1, Math.floor(cssW / W)));
    const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    c.width = W * scale * dpr;
    c.height = H * scale * dpr;
    c.style.height = `${H * scale}px`;
    ctx.imageSmoothingEnabled = false;
    const px = scale * dpr;

    const tint = look.night ? 0.38 : look.onDark ? 0.26 : 0.1;
    const mul = look.night ? 0.66 : look.onDark ? 0.87 : 1;
    /* 히어로·몬스터는 배경보다 **덜** 어둡게 물들인다. 같은 조명을 주면 밤에 다 같이
       흐려져 뭐가 뭔지 안 보인다(섬에서 이미 겪은 문제). */
    const ACTOR_LIT = 0.35;
    const litBg = (s: Sprite): Sprite => ({ ...s, pal: tintPalette(s.pal, look.light, tint, mul) });
    const litActor = (s: Sprite): Sprite => ({
      ...s,
      pal: tintPalette(s.pal, look.light, tint * ACTOR_LIT, 1 - (1 - mul) * ACTOR_LIT),
    });

    const heroR = litActor(heroSprite(petSprites(form)[0]));
    const heroL = flipX(heroR);
    const monCache = new Map<string, Sprite>();
    const monOf = (k: string): Sprite => {
      const hit = monCache.get(k);
      if (hit) return hit;
      const made = litActor(monTrim(monsterSprite(k)));
      monCache.set(k, made);
      return made;
    };

    const blit = (s: Sprite, ox: number, oy: number) => {
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const col = pixelAt(s, x, y);
          if (!col) continue;
          ctx.fillStyle = col;
          // 무대는 좌우가 이어져 있다 — 가장자리에 걸친 스프라이트는 반대편에도 찍힌다
          const dx = ((ox + x) % W + W) % W;
          ctx.fillRect(dx * px, (oy + y) * px, px, px);
        }
    };

    // ── 배경 굽기(스테이지마다 한 번) ──
    let bakedStage = -1;
    const bg = document.createElement("canvas");
    bg.width = c.width;
    bg.height = c.height;
    const bx = bg.getContext("2d");

    const bake = (stage: number) => {
      if (!bx || bakedStage === stage) return;
      bakedStage = stage;
      bx.imageSmoothingEnabled = false;
      const bands = [look.top, look.upper, look.mid, look.lower, look.bottom];
      const bandH = H / bands.length;
      bands.forEach((col, i) => {
        bx.fillStyle = col;
        bx.fillRect(0, Math.round(i * bandH) * px, W * px, Math.ceil(bandH) * px);
      });
      // 별/거품 무늬 — 배경이 민민하면 도트가 떠 보인다(결정적 배치)
      bx.fillStyle = look.night ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.1)";
      for (let i = 0; i < 26; i++) {
        const sx = (i * 53 + stage * 7) % W;
        const sy = (i * 31 + stage * 13) % (H - 24);
        bx.fillRect(sx * px, sy * px, px, px);
      }

      const rows = layoutFor(stage);
      const base = litBg({
        w: 1,
        h: 1,
        pal: { a: "#7c6bd6", b: "#5b4bab", c: "#3a2f78" },
        rows: ["a"],
      });
      const top = base.pal.a;
      const mid = base.pal.b;
      const deep = base.pal.c;
      for (let r = 0; r < ROWS; r++)
        for (let cCol = 0; cCol < COLS; cCol++) {
          if (rows[r][cCol] !== "#") continue;
          const X = cCol * TILE;
          const Y = r * TILE;
          bx.fillStyle = mid;
          bx.fillRect(X * px, Y * px, TILE * px, TILE * px);
          // 윗면 하이라이트 — 발판이 '딛는 면'이라는 걸 한 줄로 알린다
          bx.fillStyle = top;
          bx.fillRect(X * px, Y * px, TILE * px, px);
          bx.fillStyle = deep;
          bx.fillRect(X * px, (Y + TILE - 1) * px, TILE * px, px);
        }
    };

    let raf = 0;
    const draw = () => {
      const s = cur.current;
      bake(s.stage);
      if (bx) ctx.drawImage(bg, 0, 0);

      // 떨어진 열매
      for (const d of s.drops) {
        const blink = d.life < 1400 && Math.floor(s.frame / 6) % 2 === 0;
        if (blink) continue;
        ctx.fillStyle = "#ffd166";
        ctx.fillRect((d.x - 3) * px, (d.y - 3) * px, 6 * px, 6 * px);
        ctx.fillStyle = "#f2734d";
        ctx.fillRect((d.x - 1) * px, (d.y - 4) * px, 2 * px, 2 * px);
      }

      // 몬스터 — 갇힌 놈은 거품 안에 있으니 조금 작게 보이도록 그대로 두고 거품을 덧그린다
      for (const m of s.mons) {
        if (m.st === "dead") continue;
        const sp = monOf(m.kind);
        blit(sp, Math.round(m.x - sp.w / 2), Math.round(m.y - sp.h / 2));
        if (m.st === "free" && m.angry) {
          // 화난 놈은 붉은 표시 — 같은 그림이면 위험한 줄 모른다
          ctx.fillStyle = "rgba(255,90,90,0.85)";
          ctx.fillRect(Math.round(m.x - 1) * px, Math.round(m.y - sp.h / 2 - 4) * px, 2 * px, 3 * px);
        }
      }

      // 거품
      for (const b of s.bubs) {
        const held = b.hold !== null;
        // 곧 터질 거품은 깜빡인다 — 갇힌 놈이 언제 풀리는지 보여야 판단이 선다
        const soon = held && b.life < 1200 && Math.floor(s.frame / 4) % 2 === 0;
        ctx.strokeStyle = soon ? "#ff9db0" : held ? "#bff5ff" : "rgba(214,246,255,0.85)";
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.arc(b.x * px, b.y * px, BUB_R * px, 0, Math.PI * 2);
        ctx.stroke();
        // 반짝임 한 점 — 이게 있어야 유리구슬로 읽힌다
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect((b.x - 3) * px, (b.y - 3) * px, px, px);
      }

      // 히어로 — 무적(부활 직후)이면 깜빡인다
      const h = s.hero;
      const hide = h.inv > 0 && Math.floor(s.frame / 4) % 2 === 0;
      if (!hide && s.phase !== "over") {
        const sp = h.face < 0 ? heroL : heroR;
        blit(sp, Math.round(h.x - sp.w / 2), Math.round(h.y - sp.h / 2));
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [form, look]);

  return (
    <canvas
      ref={cvs}
      role="img"
      aria-label="보글보글 무대"
      className="block w-full select-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
