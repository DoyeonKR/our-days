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
import { type Sprite, flipX, pixelAt } from "@/lib/pixel";
import { angryPal, bubbleMonster, fruitSprite, heroSprites } from "@/lib/pixelbubble";
import { BUB_R, COLS, H, ROWS, TILE, W, layoutFor, type BubbleState } from "@/lib/bubble";

/** 발판 색 — 스테이지마다 돌려 쓴다. 판이 바뀐 걸 색으로 먼저 알아챈다. */
const PLATFORM_SETS: readonly (readonly [string, string, string])[] = [
  ["#7fe3ff", "#2f8fd6", "#14406e"], // 하늘
  ["#9dff86", "#3fbf46", "#166b28"], // 풀
  ["#ffc46b", "#e0812c", "#8a4310"], // 주황
  ["#ff9dd0", "#d94b95", "#7a1d4f"], // 분홍
  ["#c0aaff", "#7a5bd6", "#3b2a7a"], // 보라
  ["#ffe98a", "#d9b02c", "#7a5c0f"], // 금
];

export default function BubbleStage({ state, form }: { state: BubbleState; form: string }) {
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

    const blit = (s: Sprite, ox: number, oy: number) => {
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const col = pixelAt(s, x, y);
          if (!col) continue;
          ctx.fillStyle = col;
          // 무대는 좌우가 이어져 있다 — 가장자리에 걸친 스프라이트는 반대편에도 찍힌다
          const dx = (((ox + x) % W) + W) % W;
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
      const s = cur.current;
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
        // 안쪽 — 가둔 거품은 조금 더 진하다(안에 뭔가 있다는 신호)
        ctx.fillStyle = held ? "rgba(120,225,255,0.22)" : "rgba(190,240,255,0.13)";
        ctx.beginPath();
        ctx.arc(b.x * px, b.y * px, R, 0, Math.PI * 2);
        ctx.fill();
        // 곧 풀릴 거품은 깜빡인다 — 언제 터뜨려야 하는지가 보여야 판단이 선다
        const soon = held && b.life < 1200 && Math.floor(s.frame / 4) % 2 === 0;
        ctx.strokeStyle = soon ? "#ff7aa8" : held ? "#7fe6ff" : "#cbf3ff";
        ctx.lineWidth = px * 2;
        ctx.beginPath();
        ctx.arc(b.x * px, b.y * px, R - px * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        // 반사광 — 왼쪽 위 짧은 호 + 점 하나. 이게 구를 만든다.
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = px * 1.5;
        ctx.beginPath();
        ctx.arc(b.x * px, b.y * px, R - px * 1.8, Math.PI * 1.05, Math.PI * 1.45);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect((b.x + 1) * px, (b.y - 4) * px, px, px);
      }

      // 히어로 — 서기/걷기/점프·발사 3프레임. 무적(부활 직후)이면 깜빡인다.
      const h = s.hero;
      const hide = h.inv > 0 && Math.floor(s.frame / 4) % 2 === 0;
      if (!hide && s.phase !== "over") {
        const fi = !h.onGround || h.cool > 260 ? 2 : h.vx !== 0 && Math.floor(s.frame / 8) % 2 === 0 ? 1 : 0;
        const sp = (h.face < 0 ? heroL : heroR)[fi];
        blit(sp, Math.round(h.x - sp.w / 2), Math.round(h.y - sp.h / 2));
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [form]);

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
