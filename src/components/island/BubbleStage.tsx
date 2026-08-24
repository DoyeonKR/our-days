"use client";

/* 보글보글 무대 — 엔진 상태(BubbleState)를 그대로 그리기만 한다.
 *
 * 이 컴포넌트에는 **판정도 물리도 없다.** 전부 lib/bubble.ts 가 이미 끝낸 결과다.
 * 그리기와 규칙이 섞이면 "화면에선 맞았는데 안 죽었다" 같은 게 생기고, 그건 못 고친다.
 *
 * ── 1차판이 "흐리멍텅"했던 이유 (2026-08-07 사용자 리포트) ──────────────
 * 배경을 섬과 같은 **시간대별 하늘 그라데이션**으로 깔고, 캐릭터에도 같은 조명을 먹였다.
 * 그러면 밝은 파스텔 배경 위에 밝은 캐릭터가 놓여 대비가 사라진다. 아무리 잘 그려도
 * 흐려 보이는 게 당연하다.
 *
 * 원작(Taito 1986)은 **배경이 검정**이다. 그게 이 게임이 선명한 진짜 이유다 —
 * 검정 위의 채도 높은 색은 최대 대비가 나온다. 그래서 여기서는:
 *   · 배경 = 검정(+ 아주 옅은 별)
 *   · 발판 = 채도 높은 블록, 윗면 하이라이트 + 아랫면 그림자로 입체
 *   · 캐릭터 = **조명 없음**. 원색 그대로 찍는다.
 * 시간대(SkyLook)는 이 화면에서 아예 안 쓴다. 액션 게임은 분위기보다 판독성이다.
 *
 * ⚠ 스테이지가 바뀔 때만 배경을 다시 굽는다. 매 프레임 발판을 칠하면 프레임이 죽는다.
 */

import { useEffect, useRef } from "react";
import { blitSprite, flipX, setupPixelCanvas, type Sprite } from "@/lib/pixel";
import {
  angryPal,
  bubbleMonster,
  bubbleSkin,
  fruitSprite,
  heroSprites,
  itemSprite,
  letterSprite,
  skelSprite,
  specialIcon,
} from "@/lib/pixelbubble";
import { BUB_R, COLS, H, HURRY_MS, ROWS, TILE, W, layoutFor, type BubbleState } from "@/lib/bubble";

/** 발판 색 — 스테이지마다 돌려 쓴다. 판이 바뀐 걸 색으로 먼저 알아챈다. */
const PLATFORM_SETS: readonly (readonly [string, string, string])[] = [
  ["#7fe3ff", "#2f8fd6", "#14406e"], // 하늘
  ["#9dff86", "#3fbf46", "#166b28"], // 풀
  ["#ffc46b", "#e0812c", "#8a4310"], // 주황
  ["#ff9dd0", "#d94b95", "#7a1d4f"], // 분홍
  ["#c0aaff", "#7a5bd6", "#3b2a7a"], // 보라
  ["#ffe98a", "#d9b02c", "#7a5c0f"], // 금
];

export default function BubbleStage({
  stateRef,
  form,
  weapon,
}: {
  /* 상태는 매 프레임 바뀐다. 값으로 받으면 부모가 60fps 로 리렌더해 줘야만 캔버스가
     움직인다(그게 HUD 까지 매 프레임 리렌더시키는 원인이었다). **시뮬레이션 ref 를
     그대로 받아** 그리기 루프가 직접 읽는다 — 부모 리렌더와 캔버스가 분리된다. */
  stateRef: { readonly current: BubbleState | null };
  form: string;
  /** 장착 무기 — 거품의 **모양**이 여기서 갈린다(사용자 요구 2026-08-07). */
  weapon?: string | null;
}) {
  const cvs = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    /* ⚠ **폭도 정수배로 못 박는다.** 예전엔 높이만 정하고 폭은 w-full 로 뒀는데,
       그러면 컨테이너 폭에 맞춰 가로로만 늘어나 **도트가 직사각형이 된다**
       (실측 컨테이너 350 / 무대 288 → 1.22:1 로 찌그러짐). 픽셀 아트에서 이건 치명적이다. */
    const cssW = (c.parentElement?.clientWidth ?? c.clientWidth) || 320;
    const scale = Math.min(4, Math.max(1, Math.floor(cssW / W)));
    const px = setupPixelCanvas(c, ctx, W, H, scale);

    // 캐릭터는 조명을 안 먹는다 — 원색 그대로가 가장 선명하다
    const heroR = heroSprites(form);
    const heroL = heroR.map(flipX);
    const monR = new Map<string, Sprite>();
    const monL = new Map<string, Sprite>();
    const monA = new Map<string, Sprite>(); // 화난(분홍) 판
    const monAL = new Map<string, Sprite>();
    const monOf = (k: string, angry: boolean, left: boolean): Sprite => {
      const cache = angry ? (left ? monAL : monA) : left ? monL : monR;
      const hit = cache.get(k);
      if (hit) return hit;
      const base = bubbleMonster(k);
      const tuned = angry ? { ...base, pal: angryPal(base.pal) } : base;
      const made = left ? flipX(tuned) : tuned;
      cache.set(k, made);
      return made;
    };

    // 무대는 좌우가 이어져 있다(wrapW) — 가장자리에 걸친 스프라이트는 반대편에도 찍힌다
    const blit = (s: Sprite, ox: number, oy: number) => blitSprite(ctx, s, ox, oy, px, { wrapW: W });

    /* ── 무기별 거품 모양 ────────────────────────────────────────────────
       [사용자 요구 2026-08-07 "히어로는 무기에 따라 버블 모양이 색다르게 변할 것"]
       무기는 이미 사거리·재장전을 바꾸지만 그건 숫자라 손에만 남는다.
       모양이 바뀌어야 산 게 눈에도 남는다. 별지팡이=별 거품, 수박검=수박 거품. */
    const skin = bubbleSkin(weapon);

    /** 원 또는 정다각별을 그린다. points=0 이면 원. */
    const shape = (cx: number, cy: number, r: number, points: number, spin: number) => {
      ctx.beginPath();
      if (points <= 0) {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        return;
      }
      // 별 — 바깥/안쪽 반지름을 번갈아 찍는다. 천천히 돌아 '떠 있는' 느낌을 준다.
      const n = points * 2;
      for (let i = 0; i < n; i++) {
        const rad = i % 2 === 0 ? r : r * 0.46;
        const a = spin + (i * Math.PI) / points;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
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
      // 검정 — 원작 그대로. 완전한 0 보다 아주 살짝 띄우면 눈이 덜 피로하다.
      bx.fillStyle = "#07070c";
      bx.fillRect(0, 0, W * px, H * px);
      // 옅은 별 — 완전 무지 검정은 화면이 죽어 보인다. 결정적 배치라 깜빡이지 않는다.
      bx.fillStyle = "rgba(255,255,255,0.10)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 53 + stage * 7) % W;
        const sy = (i * 31 + stage * 13) % (H - 16);
        bx.fillRect(sx * px, sy * px, px, px);
      }

      const [top, mid, deep] = PLATFORM_SETS[(stage - 1) % PLATFORM_SETS.length];
      const rows = layoutFor(stage);
      for (let r = 0; r < ROWS; r++)
        for (let col = 0; col < COLS; col++) {
          if (rows[r][col] !== "#") continue;
          const X = col * TILE;
          const Y = r * TILE;
          bx.fillStyle = mid;
          bx.fillRect(X * px, Y * px, TILE * px, TILE * px);
          // 윗면 2px 하이라이트 — 발판이 '딛는 면'이라는 걸 알린다
          bx.fillStyle = top;
          bx.fillRect(X * px, Y * px, TILE * px, px);
          bx.fillRect(X * px, (Y + 1) * px, px, px);
          // 아랫면·오른쪽 그림자 — 블록이 튀어나와 보인다
          bx.fillStyle = deep;
          bx.fillRect(X * px, (Y + TILE - 1) * px, TILE * px, px);
          bx.fillRect((X + TILE - 1) * px, (Y + 1) * px, px, (TILE - 1) * px);
          // 벽돌 눈금 — 넓은 발판이 한 덩어리로 안 뭉친다
          bx.fillStyle = deep;
          bx.fillRect((X + 3) * px, (Y + 3) * px, px, px);
          bx.fillRect((X + 6) * px, (Y + 5) * px, px, px);
        }
    };

    let raf = 0;
    const draw = () => {
      const s = stateRef.current;
      if (!s) {
        raf = requestAnimationFrame(draw);
        return;
      }
      bake(s.stage);
      if (bx) ctx.drawImage(bg, 0, 0);

      // 떨어진 열매 — 값에 따라 종류가 다르다
      for (const d of s.drops) {
        if (d.life < 1400 && Math.floor(s.frame / 6) % 2 === 0) continue; // 사라지기 직전 깜빡임
        const f = fruitSprite(d.value);
        blit(f, Math.round(d.x - f.w / 2), Math.round(d.y - f.h / 2));
      }

      // 몬스터 — 화난 놈은 **분홍으로 변한다**(원작 규칙). 표식보다 색이 훨씬 잘 읽힌다.
      for (const m of s.mons) {
        if (m.st === "dead") continue;
        const sp = monOf(m.kind, m.st === "free" && m.angry, m.vx < 0);
        blit(sp, Math.round(m.x - sp.w / 2), Math.round(m.y - sp.h / 2));
      }

      /* 거품 — 게임 이름이 거품인데 1차판은 **그냥 그린 동그라미**로 보였다.
         비눗방울로 읽히려면 셋이 다 있어야 한다: 안쪽 물빛 채움 · 두꺼운 테 ·
         **왼쪽 위 반사광**. 특히 반사광이 없으면 구가 아니라 원으로 보인다. */
      for (const b of s.bubs) {
        const held = b.hold !== null;
        const R = BUB_R * px;
        const spin = (s.frame + b.id * 9) / 90; // 별 거품이 천천히 돈다
        // 안쪽 — 가둔 거품은 조금 더 진하다(안에 뭔가 있다는 신호)
        ctx.fillStyle = skin.fill;
        shape(b.x * px, b.y * px, R, skin.points, spin);
        ctx.fill();
        // 곧 풀릴 거품은 깜빡인다 — 언제 터뜨려야 하는지가 보여야 판단이 선다
        const soon = held && b.life < 1200 && Math.floor(s.frame / 4) % 2 === 0;
        ctx.strokeStyle = soon ? "#ff7aa8" : held ? skin.rimHeld : skin.rim;
        ctx.lineWidth = px * 2;
        shape(b.x * px, b.y * px, R - px * 0.5, skin.points, spin);
        ctx.stroke();
        // 수박 거품은 꼭지를 하나 얹는다 — 줄무늬는 안 그린다(무등산수박엔 무늬가 없다)
        if (skin.key === "melon") {
          ctx.fillStyle = "#2f7a2c";
          ctx.fillRect((b.x - 1) * px, (b.y - BUB_R - 1) * px, px * 2, px * 2);
        }
        // 반사광 — 왼쪽 위 짧은 호 + 점 하나. 이게 구를 만든다.
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = px * 1.5;
        ctx.beginPath();
        ctx.arc(b.x * px, b.y * px, R - px * 1.8, Math.PI * 1.05, Math.PI * 1.45);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect((b.x + 1) * px, (b.y - 4) * px, px, px);
      }

      /* ── 터진 특수 효과 ── 히어로보다 아래에 깔아 시야를 안 가린다 */
      for (const bl of s.blasts) {
        if (bl.kind === "bolt") {
          /* 번개 — 곧은 막대로 그리면 그냥 '흰 줄'로 보인다. 위아래로 꺾인 **지그재그**여야
             전기로 읽힌다. 두 프레임마다 색이 튀어 지지직거린다. */
          ctx.fillStyle = Math.floor(s.frame / 2) % 2 === 0 ? "#fffbe0" : "#ffe14d";
          for (let i = -6; i <= 6; i++) {
            const zig = ((i + 60) % 4 < 2 ? -1 : 1) * 2;
            ctx.fillRect((bl.x + i) * px, (bl.y + zig - 1) * px, px, px * 2);
          }
          // 심 — 가운데를 한 줄 이어 끊겨 보이지 않게
          ctx.fillRect((bl.x - 6) * px, bl.y * px, 13 * px, px);
        } else if (bl.foe) {
          /* 적(Hidegons)이 뿜은 불 — **가로로 날아가는 보라 불꽃**.
             내 불(주황 웅덩이)과 색·모양을 갈라 놨다. 같은 그림이면 밟아도 되는 건지
             피해야 하는 건지 순간적으로 판단이 안 선다. */
          const f = Math.floor(s.frame / 3) % 2;
          ctx.fillStyle = "#c56cf0";
          ctx.fillRect((bl.x - 4) * px, (bl.y - 2) * px, 8 * px, 4 * px);
          ctx.fillStyle = "#f0b0ff";
          ctx.fillRect((bl.x - 2 + f) * px, (bl.y - 1) * px, 3 * px, 2 * px);
        } else if (bl.kind === "flame") {
          const f = Math.floor(s.frame / 4) % 2;
          ctx.fillStyle = "#ff5a2a";
          ctx.fillRect((bl.x - 3) * px, (bl.y - 2 - f) * px, 6 * px, (4 + f) * px);
          ctx.fillStyle = "#ffd83d";
          ctx.fillRect((bl.x - 1) * px, (bl.y - 1) * px, 2 * px, 3 * px);
        } else {
          ctx.fillStyle = "rgba(63,168,255,0.85)";
          ctx.fillRect((bl.x - 4) * px, (bl.y - 3) * px, 8 * px, 6 * px);
          ctx.fillStyle = "#a8e6ff";
          ctx.fillRect((bl.x - 4) * px, (bl.y - 3) * px, 8 * px, px);
        }
      }

      /* ── 특수 거품(번개·불·물) ── 안에 아이콘이 들어 있어 뭔지 바로 안다 */
      for (const sp of s.specials) {
        const R = (BUB_R + 1) * px;
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.arc(sp.x * px, sp.y * px, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = sp.kind === "lightning" ? "#ffe14d" : sp.kind === "fire" ? "#ff8a4d" : "#7fc9ff";
        ctx.lineWidth = px * 2;
        ctx.beginPath();
        ctx.arc(sp.x * px, sp.y * px, R - px * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        const ic = specialIcon(sp.kind);
        blit(ic, Math.round(sp.x - ic.w / 2), Math.round(sp.y - ic.h / 2));
      }

      // ── 아이템 ── 사라지기 직전 깜빡인다(시간 압박이 보여야 뛰어간다)
      for (const it of s.items) {
        if (it.life < 2200 && Math.floor(s.frame / 5) % 2 === 0) continue;
        const sp = itemSprite(it.kind);
        blit(sp, Math.round(it.x - sp.w / 2), Math.round(it.y - sp.h / 2));
      }

      // ── EXTEND 글자 ──
      for (const lt of s.letters) {
        if (lt.life < 1600 && Math.floor(s.frame / 5) % 2 === 0) continue;
        const sp = letterSprite(lt.idx);
        blit(sp, Math.round(lt.x - sp.w / 2), Math.round(lt.y - sp.h / 2));
      }

      // 히어로 — 서기/걷기/점프·발사 3프레임. 무적(부활 직후)이면 깜빡인다.
      const h = s.hero;
      const hide = h.inv > 0 && Math.floor(s.frame / 4) % 2 === 0;
      if (!hide && s.phase !== "over") {
        const fi = !h.onGround || h.cool > 260 ? 2 : h.vx !== 0 && Math.floor(s.frame / 8) % 2 === 0 ? 1 : 0;
        const sp = (h.face < 0 ? heroL : heroR)[fi];
        blit(sp, Math.round(h.x - sp.w / 2), Math.round(h.y - sp.h / 2));
      }

      /* ── 해골 ── 히어로 **위에** 그린다. 겹쳤을 때 가려지면 위험을 못 본다.
         HURRY 경고 중에는 화면 위쪽에 깜빡이는 띠를 얹는다. */
      if (s.skel.on) {
        const sk = skelSprite();
        blit(sk, Math.round(s.skel.x - sk.w / 2), Math.round(s.skel.y - sk.h / 2));
      } else if (s.stageMs > HURRY_MS && Math.floor(s.frame / 12) % 2 === 0) {
        ctx.fillStyle = "rgba(255,60,90,0.30)";
        ctx.fillRect(0, 0, W * px, 10 * px);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [form, weapon, stateRef]);

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
