"use client";

/**
 * 우리 섬 — 섬 풍경 씬 (꾸미기의 심장)
 * ============================================================================
 * 예전 꾸미기 UI 는 "검은 네모 6×4 격자 + 이모지 한 글자"였고(2026-08), 그다음 판은 SVG 타원 셋
 * (모래·잔디)에 벡터 구름을 얹은 풍경이었다. [사용자 2026-09-24 "꾸미기 풍경 그래픽이야 너무 허접해"]
 * 도트 장식·도트 펫이 매끈한 벡터 타원 위에 서니 **팬케이크 위의 스티커**였다.
 *
 * 지금은 배경 전체가 **도트 그림**이다(lib/islandscape — 1 풍경 단위 = 1 도트):
 *   하늘(홈 히어로와 같은 시간대 팔레트 · 해/달 · 별) · 먼 섬과 등대 · 바다(물결 · 반사 기둥) ·
 *   얕은 물 · 파도 거품 · 모래 · 흙 절벽 · 잔디 고원 · 계절 나무 · 바위 · 선착장.
 * 한 장을 시간대 × 계절마다 한 번 구워(bufUrl 캐시) <image> 로 깔고, **움직이는 것만** 위에 얹는다 —
 * 구름(흐름) · 물빛 반짝임 · 파도 거품(두 장 번갈아) · 장식 · 펫 · 계절 입자.
 *
 * 좌표계: viewBox 0 0 340 250. 좌표·줄(scapeRows)은 islandscape 한 곳에서 정한다.
 *   장식 6×4(확장 6×6) 격자는 잔디 위에 **뒤로 갈수록 작고 좁게** 매핑 → 평면 격자가 아니라 공간감.
 *   펫은 앞 해변(PET_SPOT)에 서서 섬을 바라본다.
 *
 * ⚠ 장식·펫 도트에도 **섬과 같은 조명**을 입힌다(litPalette). 배경만 밤이고 장식이 한낮이면 또 스티커가 된다.
 * ⚠ 크기 위계 — 집·풍차 같은 건물은 크게, 꽃·등불은 작게(decorScale). 전부 같은 크기면 장난감 상자다.
 * ⚠ 펫은 pointer-events 를 받지 않는다 — 앞줄 장식 위에 서 있어서, 받으면 그 장식을 누를 수 없다.
 *
 * 순수성: Math.random 미사용(물빛·구름·입자는 CSS 애니 + 좌표 해시). 시간대는 `now` prop 파생.
 */

import { type ReactNode } from "react";
import type { Placed, Season } from "@/lib/island";
import { DECOR_COLS, DECOR_ROWS, DECOR_COMBOS } from "@/lib/island";
import { decorArt, hasDecorArt, SKY_DECOR } from "@/components/island/art/decor";
import { petArt } from "@/components/island/art/pets";
import { INK } from "@/components/island/art/parts";
import { decorSprite } from "@/lib/pixeldecor";
import { petSprites } from "@/lib/pixelart";
import { bufUrl, spriteUrl } from "@/lib/spriteurl";
import { usePixelArt } from "@/lib/pixelpref";
import { kstHourFloatOf, skyLook, skyPhaseOf } from "@/lib/scenetime";
import {
  PET_SPOT,
  SCAPE_H,
  scapeRows,
  SCAPE_W,
  lightPosOf,
  litPalette,
  paintCloud,
  paintFoam,
  paintGlints,
  paintIslandscape,
  paintShadow,
  paintSlotRing,
} from "@/lib/islandscape";

/* ── 레이아웃 상수 ─────────────────────────────────────────── */
const VW = SCAPE_W;
const VH = SCAPE_H;
const SLOT = 36; // 장식 기본 폭(줄 스케일 · 크기 위계를 곱해서 사용)

/** 크기 위계 — 건물·큰 물건은 크게, 꽃·작은 소품은 작게. 나머지는 1. */
const BIG = new Set([
  "henhouse", "cowshed", "windmill", "pine", "castle", "lighthouse", "ferris", "carousel", "circustent",
  "pavilion", "igloo", "xmastree", "mushhouse", "fountain", "hotspring", "bridge", "cottoncandy", "coffeecart",
  "minitrain", "umbrella",
]);
const SMALL = new Set([
  "tulip", "rose", "blossom", "shell", "crab", "candle", "giftbox", "plantpot", "stump", "lantern", "cheers", "ring",
]);
export const decorScale = (key: string): number => (BIG.has(key) ? 1.3 : SMALL.has(key) ? 0.85 : 1);

/** 그리드 (x,y) → 화면 좌표(sy = 장식이 땅에 닿는 선)/스케일. 줄 표는 islandscape(scapeRows — 줄 수에 따라 잔디 전체에 편다).
 *  y=4·5 는 **섬 확장 줄**(expandIsland) — 마당이 앞쪽으로 내려온다.
 *  ⚠ 앞줄만 늘린다 — 그리드 인덱스 인접이 화면 인접과 같아야 조합(가로·세로 맞닿음) 판정이 안 뒤틀린다. */
export function slotPos(x: number, y: number, rows = DECOR_ROWS): { sx: number; sy: number; sc: number } {
  const table = scapeRows(rows);
  const [rowY, half, sc] = table[Math.min(y, table.length - 1)];
  const t = x / Math.max(1, DECOR_COLS - 1); // 0..1
  return { sx: 170 + (t - 0.5) * 2 * half, sy: rowY, sc };
}

/** 하늘 소품(나비·달·별…)은 하늘 영역에 흩어 놓는다 — 격자에 묶이면 어색. */
function skyPos(x: number, y: number): { sx: number; sy: number; sc: number } {
  const t = x / Math.max(1, DECOR_COLS - 1);
  return { sx: 30 + t * (VW - 60), sy: 14 + y * 9, sc: 0.78 };
}

/* ── 움직이는 겹 ───────────────────────────────────────────── */

/** 구름 자리 — 해·달을 가리지 않게 광원 반대편 하늘에 둔다(v = 크기 0 큰 · 1 중간 · 2 작은).
 *  ⚠ 왼쪽 위 모서리(x < 72, y < 26)는 평점 뱃지 자리라 비운다 — 구름이 뱃지 밑에 깔리면 둘 다 지저분하다. */
function cloudSpots(lightX: number): { x: number; y: number; v: number }[] {
  return lightX < 170
    ? [
        { x: 138, y: 6, v: 0 },
        { x: 234, y: 30, v: 2 },
        { x: 284, y: 8, v: 1 },
      ]
    : [
        { x: 78, y: 6, v: 0 },
        { x: 26, y: 34, v: 2 },
        { x: 166, y: 24, v: 1 },
      ];
}

/** 갈매기 — 도트 여섯 칸의 얕은 V. */
const GULL: [number, number][] = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 0], [5, 0]];

/* 계절 입자(봄 꽃잎·여름 반딧빛·가을 낙엽·겨울 눈) — 도트 사각형. 랜덤 금지 → 고정 슬롯 + 음수 딜레이. */
const AMBIENT: Record<Season, { fill: string; w: number; h: number; op: number }> = {
  spring: { fill: "#ffc4dd", w: 2, h: 1, op: 0.85 },
  summer: { fill: "#fff3b0", w: 1, h: 1, op: 0.7 },
  autumn: { fill: "#e8925a", w: 2, h: 2, op: 0.85 },
  winter: { fill: "#ffffff", w: 2, h: 2, op: 0.9 },
};
const FALLERS: { x: number; delay: number; dur: number }[] = [
  { x: 40, delay: 0, dur: 9 },
  { x: 96, delay: 3.5, dur: 11 },
  { x: 150, delay: 6, dur: 8.5 },
  { x: 210, delay: 1.8, dur: 10.5 },
  { x: 268, delay: 4.6, dur: 9.5 },
  { x: 305, delay: 7.2, dur: 12 },
  { x: 128, delay: 2.4, dur: 10 },
];

/** 밤에 빛나는 장식(야광) — key → 불빛 색. 밤 섬의 보석. */
const GLOW_DECOR: Record<string, string> = {
  candle: "#ffd9a0",
  lantern: "#ffcf87",
  campfire: "#ffb766",
  stringlights: "#fff0a8",
  lighthouse: "#fff3b8",
  xmastree: "#ffe7a0",
  carousel: "#ffd0e8",
  ferris: "#ffd0e8",
  hearts: "#ffc7dd",
  moon: "#fff3b8",
  stars: "#fff3b8",
  comet: "#cfe8ff",
  planet: "#e3d4ff",
};

/* ── 메인 ──────────────────────────────────────────────────── */

export default function IslandScene({
  decor,
  petForm,
  season,
  now,
  rows = DECOR_ROWS,
  placing,
  onSlotTap,
  ratingLabel,
  petAsleep,
  justPlacedPos,
  movingId,
  bubbles,
  children,
}: {
  decor: Placed[];
  petForm: string;
  season: Season;
  now: number;
  /** 배치 가능한 줄 수 — decorRowsOf(state). 확장 전 저장분은 4(기본값 = 호출부 무변경 호환). */
  rows?: number;
  /** 배치할 데코 key (있으면 빈 칸이 반짝이며 탭 대기). */
  placing?: string | null;
  /** 슬롯 탭 — 비어 있으면 배치, 차 있으면 치우기(호출측이 판단). */
  onSlotTap?: (x: number, y: number, placed: Placed | null) => void;
  ratingLabel?: ReactNode;
  petAsleep?: boolean;
  /** 방금 배치/이동된 칸 — 팝 바운스 + 스파클 + 펫 환호 연출. */
  justPlacedPos?: { x: number; y: number; ts: number } | null;
  /** 이동 중인 데코 id — 픽업 상태로 맥동 표시. */
  movingId?: string | null;
  /** 장식 위 말풍선 — Placed.id → 짧은 글자(생산 장식의 "🍯2"). 지면 장식만. 누르면 그 장식을 누른 것과 같다. */
  bubbles?: Record<string, string>;
  children?: ReactNode;
}) {
  // 하늘·조명 = 홈 히어로와 같은 시간대(KST 8단계) · 계절 팔레트
  const phase = skyPhaseOf(kstHourFloatOf(now));
  const look = skyLook(phase, season);
  const night = look.night || phase === "twilight" || phase === "blueHour";
  const light = lightPosOf(phase);
  const key = `${phase}|${season}`;
  // 배경·겹은 시간대 × 계절마다 한 번만 굽는다(모듈 캐시 — 틱마다 다시 그리지 않는다)
  const bg = bufUrl(`scape:${key}`, () => paintIslandscape(look, phase, season));
  const glints = [0, 1].map((f) => bufUrl(`glint:${key}:${f}`, () => paintGlints(look, phase, f as 0 | 1)));
  const foams = [0, 1].map((f) => bufUrl(`foam:${key}:${f}`, () => paintFoam(look, f as 0 | 1)));
  const clouds = cloudSpots(light.x).map((c) => ({ ...c, url: bufUrl(`cloud:${key}:${c.v}`, () => paintCloud(look, c.v)) }));
  const shadowUrl = bufUrl("scape-shadow", () => paintShadow(20, 6));
  const ringUrl = bufUrl("scape-ring", () => paintSlotRing(24, 9));
  const amb = AMBIENT[season];
  // 아트 레지스트리 조회 — 같은 form 이면 **모듈 스코프의 동일 컴포넌트 참조**라 재마운트 없음.
  // ⚠ `petArt(form)({...})` 처럼 함수로 호출하면 아트 내부 useId 가 이 컴포넌트의 훅 순서에 섞여
  // form 전환 시 훅 개수가 달라진다(React 오류) → 반드시 JSX 엘리먼트로 렌더할 것.
  const Pet = petArt(petForm);
  const pixel = usePixelArt();

  const at = (x: number, y: number) => decor.find((d) => d.x === x && d.y === y) ?? null;

  /** 씬 안의 데코 한 점 — 픽셀이면 섬의 조명을 입혀 구운 PNG 를 <image> 로, 아니면 SVG 아트를 그대로.
   *  ⚠ <svg> 안이라 캔버스를 못 쓴다. 픽셀을 <rect> 로 펴면 배치 24개에 수천 노드가 된다.
   *  ⚠ **컴포넌트가 아니라 함수**다. 렌더 안에서 컴포넌트를 정의하면 렌더마다 타입이 새로 생겨
   *     React 가 전부 언마운트→재마운트한다(배치 데코가 매 틱 깜빡인다). */
  const decorNode = (dkey: string, size: number) => {
    if (pixel || !hasDecorArt(dkey)) {
      return (
        <image
          href={spriteUrl(`decor:${dkey}@${phase}`, () => {
            const s = decorSprite(dkey);
            return { ...s, pal: litPalette(s.pal, look) };
          })}
          width={size}
          height={size}
          style={{ imageRendering: "pixelated" }}
        />
      );
    }
    const A = decorArt(dkey);
    return <A size={size} />;
  };

  // 지면 데코는 뒤→앞 순서로 그려야 앞의 것이 위에 겹친다(정렬 = 깊이).
  const groundSlots: { x: number; y: number; p: Placed | null }[] = [];
  const skySlots: { x: number; y: number; p: Placed }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < DECOR_COLS; x++) {
      const p = at(x, y);
      if (p && SKY_DECOR.has(p.key)) skySlots.push({ x, y, p });
      else groundSlots.push({ x, y, p });
    }
  }
  const sizeAt = (x: number, y: number, p: Placed | null) => Math.round(SLOT * slotPos(x, y, rows).sc * (p ? decorScale(p.key) : 1));

  // 성립 중인 이웃 조합을 **눈에 보이게** — 두 데코 사이에 반짝이는 도트 줄.
  // 이게 없으면 "붙이면 좋다"가 숫자로만 존재해서, 화면상으로는 여전히 아무 일도 안 일어난다.
  const links: { key: string; dots: [number, number][] }[] = [];
  for (const p of decor) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const q = at(p.x + dx, p.y + dy);
      if (!q) continue;
      const c = DECOR_COMBOS.find((k) => (k.a === p.key && k.b === q.key) || (k.b === p.key && k.a === q.key));
      if (!c) continue;
      const A = slotPos(p.x, p.y, rows);
      const B = slotPos(q.x, q.y, rows);
      const ax = A.sx;
      const ay = A.sy - SLOT * A.sc * 0.25;
      const bx = B.sx;
      const by = B.sy - SLOT * B.sc * 0.25;
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 4));
      const dots: [number, number][] = [];
      for (let i = 1; i < n; i++) dots.push([Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n)]);
      links.push({ key: `${p.id}-${q.id}`, dots });
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/12" style={{ background: look.mid }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block w-full" role="img" aria-label="우리 섬" shapeRendering="crispEdges">
        {/* 배경 한 장 — 하늘 · 해/달 · 먼 섬 · 바다 · 섬(모래 · 절벽 · 잔디) · 나무 · 선착장 */}
        <image href={bg} x={0} y={0} width={VW} height={VH} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />

        {/* 구름 — 광원 반대편에서 천천히 흐른다(밤엔 옅게 — 팔레트가 알아서 어둡다) */}
        {clouds.map((c) => (
          <g key={`${c.x}-${c.v}`} transform={`translate(${c.x} ${c.y})`}>
            <g className="island-drift" style={{ animationDuration: `${22 + c.v * 6}s`, animationDelay: `${-c.v * 7}s` }}>
              <image href={c.url} style={{ imageRendering: "pixelated" }} />
            </g>
          </g>
        ))}

        {/* 갈매기 — 낮에만 하늘을 가로지른다 */}
        {!night && (
          <g fill="#3d4d66" opacity={0.8}>
            {[
              { y: 40, dur: 19, delay: -4 },
              { y: 58, dur: 26, delay: -13 },
            ].map((g) => (
              <g key={g.y} transform={`translate(0 ${g.y})`}>
                <g className="island-bird" style={{ animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }}>
                  {GULL.map(([x, y]) => (
                    <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} />
                  ))}
                </g>
              </g>
            ))}
          </g>
        )}

        {/* 등대 불빛(밤) — 먼 섬 꼭대기에서 깜빡인다 */}
        {night && (
          <g className="island-lamp">
            <circle cx={297.5} cy={57.5} r={4} fill={look.light} opacity={0.35} />
            <rect x={297} y={57} width={1} height={1} fill="#fff4c2" />
          </g>
        )}

        {/* 바다 물빛 · 파도 거품 — 두 장을 번갈아 켠다(도트 애니의 문법: 보간이 아니라 교대) */}
        <image href={glints[0]} width={VW} height={VH} className="island-blink-a" style={{ imageRendering: "pixelated" }} />
        <image href={glints[1]} width={VW} height={VH} className="island-blink-b" style={{ imageRendering: "pixelated" }} />
        <image href={foams[0]} width={VW} height={VH} className="island-foam-a" style={{ imageRendering: "pixelated" }} />
        <image href={foams[1]} width={VW} height={VH} className="island-foam-b" style={{ imageRendering: "pixelated" }} />

        {/* 하늘 데코(나비·달·별·혜성·행성) */}
        {skySlots.map(({ x, y, p }) => {
          const { sx, sy, sc } = skyPos(x, y);
          const w = Math.round(SLOT * sc * 1.1);
          const justHere = justPlacedPos && justPlacedPos.x === x && justPlacedPos.y === y;
          const moving = movingId === p.id;
          return (
            // ⚠ 위치(transform 속성)와 애니(CSS transform)를 **다른 <g> 로 분리**해야 한다.
            //    한 요소에 같이 걸면 CSS transform 이 속성을 덮어써 (0,0) 으로 튄다.
            <g
              key={p.id}
              transform={`translate(${sx - w / 2} ${sy - w / 2})`}
              onClick={() => onSlotTap?.(x, y, p)}
              style={{ cursor: onSlotTap ? "pointer" : undefined }}
              opacity={moving ? 0.55 : 1}
              className={moving ? "island-moving" : undefined}
            >
              {night && GLOW_DECOR[p.key] && (
                <circle className="island-glow" cx={w / 2} cy={w / 2} r={w * 0.85} fill={GLOW_DECOR[p.key]} opacity={0.3} />
              )}
              <g className="island-float">
                <g key={justHere ? justPlacedPos!.ts : 0} className={justHere ? "island-place-pop" : undefined}>
                  {decorNode(p.key, w)}
                </g>
              </g>
              {justHere && (
                <g key={`sp${justPlacedPos!.ts}`} className="island-place-spark" fill="#fff6c8">
                  <rect x={w * 0.1} y={w * 0.2} width={2} height={2} />
                  <rect x={w * 0.9} y={w * 0.35} width={2} height={2} />
                  <rect x={w * 0.5} y={-2} width={2} height={2} />
                </g>
              )}
            </g>
          );
        })}

        {/* 조합 도트 줄 — 데코보다 **먼저** 그려서 뒤에 깔린다(장식을 가리지 않게) */}
        {links.map((l) => (
          <g key={l.key} className="island-combo-link" pointerEvents="none" fill="#fff4c2">
            {l.dots.map(([x, y], i) => (
              <rect key={i} x={x - 1} y={y - 1} width={2} height={2} opacity={i % 2 ? 0.55 : 1} />
            ))}
          </g>
        ))}

        {/* 지면 데코 — 뒤(y=0)부터 그려 앞이 위로 겹치게 */}
        {groundSlots.map(({ x, y, p }) => {
          const { sx, sy, sc } = slotPos(x, y, rows);
          const w = sizeAt(x, y, p);
          const base = Math.round(SLOT * sc);
          const empty = !p;
          const justHere = !!(justPlacedPos && justPlacedPos.x === x && justPlacedPos.y === y);
          return (
            <g key={`${x}-${y}`} onClick={() => onSlotTap?.(x, y, p)} style={{ cursor: onSlotTap ? "pointer" : undefined }}>
              {/* 히트영역 — 항상 존재(투명). 장식이 있으면 그 몸통, 없으면 땅 자리 */}
              <rect
                x={sx - (p ? w : base) * 0.46}
                y={p ? sy - w * 0.9 : sy - base * 0.55}
                width={(p ? w : base) * 0.92}
                height={p ? w * 0.95 : base * 0.7}
                fill="transparent"
              />
              {/* 빈 칸 표시 — 배치 모드에서만 도트 고리가 숨쉰다 */}
              {empty && placing && (
                <image
                  href={ringUrl}
                  x={sx - base * 0.42}
                  y={sy - base * 0.16}
                  width={base * 0.84}
                  height={base * 0.32}
                  className="island-slot-pulse"
                  style={{ imageRendering: "pixelated" }}
                  pointerEvents="none"
                />
              )}
              {p && (
                <>
                  {/* 발밑 그림자 — 땅에 '서' 있게 */}
                  <image
                    href={shadowUrl}
                    x={sx - w * 0.4}
                    y={sy - Math.max(3, w * 0.11)}
                    width={w * 0.8}
                    height={Math.max(4, w * 0.22)}
                    style={{ imageRendering: "pixelated" }}
                    pointerEvents="none"
                  />
                  <g
                    transform={`translate(${sx - w / 2} ${sy - w + 1})`}
                    opacity={movingId === p.id ? 0.55 : 1}
                    className={movingId === p.id ? "island-moving" : undefined}
                  >
                    {/* 밤 야광(글로우 데코) — 촛불·등불·모닥불이 잔디에 번진다 */}
                    {night && GLOW_DECOR[p.key] && (
                      <ellipse className="island-glow" cx={w / 2} cy={w * 0.7} rx={w * 0.95} ry={w * 0.5} fill={GLOW_DECOR[p.key]} opacity={0.3} />
                    )}
                    <g key={justHere ? justPlacedPos!.ts : 0} className={justHere ? "island-place-pop" : undefined}>
                      {decorNode(p.key, w)}
                    </g>
                    {justHere && (
                      <g key={`sp${justPlacedPos!.ts}`} className="island-place-spark" fill="#fff6c8">
                        <rect x={w * 0.08} y={w * 0.18} width={2} height={2} />
                        <rect x={w * 0.92} y={w * 0.3} width={2} height={2} />
                        <rect x={w * 0.5} y={-2} width={2} height={2} />
                      </g>
                    )}
                  </g>
                </>
              )}
            </g>
          );
        })}

        {/* 장식 말풍선 — 지면 장식을 **다 그린 뒤** 얹는다(앞줄 장식에 가려지지 않게).
            생산물이 쌓였다는 걸 숫자판이 아니라 섬 위에서 보여 준다(누르면 모으기). */}
        {bubbles &&
          groundSlots.map(({ x, y, p }) => {
            const text = p ? bubbles[p.id] : undefined;
            if (!p || !text) return null;
            const { sx, sy } = slotPos(x, y, rows);
            const top = sy - sizeAt(x, y, p) - 2;
            return (
              <g
                key={`bub${p.id}`}
                transform={`translate(${Math.round(sx)} ${Math.round(top)})`}
                onClick={() => onSlotTap?.(x, y, p)}
                style={{ cursor: onSlotTap ? "pointer" : undefined }}
              >
                <g className="island-bob">
                  <rect x={-16} y={-15} width={32} height={17} rx={3} fill="#fffbe8" stroke="#c98f2a" strokeWidth={1} />
                  <path d="M-3 2 L0 6 L3 2 Z" fill="#fffbe8" />
                  <text x={0} y={-6} textAnchor="middle" dominantBaseline="middle" fontSize={11.5} fontWeight={800} fill="#5b3a0a">
                    {text}
                  </text>
                </g>
              </g>
            );
          })}

        {/* 펫 — 앞 해변에 서서 섬을 지킨다. 누르기는 받지 않는다(앞줄 장식을 가리므로).
            위치 g(transform 속성) / 애니 g(CSS transform) 분리 — 겹치면 CSS 가 위치를 덮어씀. */}
        <g transform={`translate(${PET_SPOT.x - 22} ${PET_SPOT.y - 44})`} pointerEvents="none">
          {/* 산책(translateX) → 숨쉬기/환호(translateY) 를 각각 다른 <g> 로 분리(한 요소=한 transform).
              자면 둘 다 멈춘다. 새 장식이 놓이면 펫이 두 번 폴짝(환호). */}
          <g className={petAsleep ? undefined : "island-stroll"}>
            <image href={shadowUrl} x={9} y={41} width={26} height={6} style={{ imageRendering: "pixelated" }} />
            <g
              key={justPlacedPos ? `cheer${justPlacedPos.ts}` : "calm"}
              className={justPlacedPos ? "island-cheer" : petAsleep ? undefined : "island-bob"}
            >
              {/* key=form — 진화로 폼이 바뀌면 의도적으로 새로 마운트(상태 없는 순수 아트라 무해) */}
              {pixel ? (
                <image
                  href={spriteUrl(`pet:${petForm}@${phase}`, () => {
                    const s = petSprites(petForm)[0];
                    return { ...s, pal: litPalette(s.pal, look) };
                  })}
                  width={44}
                  height={44}
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                // eslint-disable-next-line react-hooks/static-components
                <Pet key={petForm} size={44} title="우리 펫" />
              )}
            </g>
          </g>
        </g>

        {/* 계절 입자 — 씬 전체에 은은히 떠다닌다(맨 앞, 도트 사각형) */}
        <g opacity={amb.op} fill={amb.fill} pointerEvents="none">
          {FALLERS.map((f, i) => (
            <g key={i} transform={`translate(${f.x} 0)`}>
              <g className="island-fall" style={{ animationDuration: `${f.dur}s`, animationDelay: `${f.delay - f.dur}s` }}>
                <rect width={amb.w} height={amb.h} />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* 좌상단 평점 뱃지 */}
      {ratingLabel && (
        <div className="absolute left-2 top-2 rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-white">
          {ratingLabel}
        </div>
      )}
      {children}

      {/* 씬 전용 애니메이션 — 전역 CSS 오염 없이 여기서만 */}
      <style>{`
        @keyframes island-drift-x { 0%{transform:translateX(-8px)} 50%{transform:translateX(8px)} 100%{transform:translateX(-8px)} }
        .island-drift { animation: island-drift-x 26s ease-in-out infinite; }
        @keyframes island-bob-y { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        .island-bob { animation: island-bob-y 3.4s steps(2, jump-none) infinite; }
        @keyframes island-float-y { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .island-float { animation: island-float-y 5s ease-in-out infinite; }
        /* 물빛 · 거품 — 두 장 교대(보간 없이 뚝뚝 — 도트 애니의 문법) */
        @keyframes island-blink-o { 0%,49.9%{opacity:1} 50%,100%{opacity:0} }
        .island-blink-a { animation: island-blink-o 1.6s infinite; }
        .island-blink-b { animation: island-blink-o 1.6s infinite; animation-delay: -.8s; }
        .island-foam-a { animation: island-blink-o 2.6s infinite; }
        .island-foam-b { animation: island-blink-o 2.6s infinite; animation-delay: -1.3s; }
        @keyframes island-lamp-o { 0%,60%{opacity:1} 70%,100%{opacity:.25} }
        .island-lamp { animation: island-lamp-o 2.2s steps(1) infinite; }
        @keyframes island-slot-o { 0%,100%{opacity:.35} 50%{opacity:.95} }
        .island-slot-pulse { animation: island-slot-o 1.5s steps(3) infinite; }
        /* 배치/이동 팝 — 통 떨어졌다 튀어오르는 바운스(fill-box 기준 하단 원점) */
        @keyframes island-place-y {
          0% { transform: translateY(-10px) scale(.55); opacity: 0; }
          55% { transform: translateY(0) scale(1.14); opacity: 1; }
          75% { transform: translateY(0) scale(.94); }
          100% { transform: translateY(0) scale(1); }
        }
        .island-place-pop { animation: island-place-y .55s cubic-bezier(.34,1.56,.64,1) both; transform-box: fill-box; transform-origin: 50% 90%; }
        @keyframes island-spark-o { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.6); } }
        .island-place-spark { animation: island-spark-o 1s ease-out both; transform-box: fill-box; transform-origin: 50% 50%; }
        /* 이동 픽업 중 — 맥동 */
        @keyframes island-moving-o { 0%,100% { opacity: .35; } 50% { opacity: .75; } }
        .island-moving { animation: island-moving-o 1s ease-in-out infinite; }
        /* 조합 도트 줄 — 성립 중인 이웃 두 데코를 잇는다(숨쉬듯) */
        @keyframes island-link-o { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
        .island-combo-link { animation: island-link-o 2.4s ease-in-out infinite; }
        /* 밤 야광 데코 — 은은한 숨쉬기 */
        @keyframes island-glow-o { 0%,100% { opacity: .18; } 50% { opacity: .38; } }
        .island-glow { animation: island-glow-o 3.2s ease-in-out infinite; }
        /* 새 장식에 펫이 환호 — 두 번 폴짝 */
        @keyframes island-cheer-y {
          0%,100% { transform: translateY(0); }
          20% { transform: translateY(-7px); }
          40% { transform: translateY(0); }
          60% { transform: translateY(-5px); }
          80% { transform: translateY(0); }
        }
        .island-cheer { animation: island-cheer-y .9s ease-out 1; }
        @keyframes island-stroll-x { 0%,100%{transform:translateX(-14px)} 50%{transform:translateX(14px)} }
        .island-stroll { animation: island-stroll-x 9s ease-in-out infinite; }
        @keyframes island-bird-x { 0%{transform:translate(-40px,0)} 50%{transform:translate(180px,-7px)} 100%{transform:translate(400px,0)} }
        .island-bird { animation: island-bird-x linear infinite; }
        @keyframes island-fall-y { 0%{transform:translate(0,-14px)} 10%{opacity:1} 90%{opacity:1} 100%{transform:translate(16px,264px)} }
        .island-fall { animation: island-fall-y linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .island-drift,.island-bob,.island-float,.island-blink-a,.island-blink-b,.island-foam-a,.island-foam-b,.island-lamp,.island-slot-pulse,.island-stroll,.island-bird,.island-fall,.island-place-pop,.island-place-spark,.island-moving,.island-glow,.island-cheer,.island-combo-link { animation: none; }
          .island-blink-b,.island-foam-b { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** 씬 밖(시트/도감)에서 쓰는 작은 섬 썸네일용 배경색 — 톤 통일. */
export const SCENE_INK = INK;
