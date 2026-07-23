"use client";

/**
 * 우리 섬 — 섬 풍경 씬 (꾸미기의 심장)
 * ============================================================================
 * 이전 꾸미기 UI 는 "검은 네모 6×4 격자 + 이모지 한 글자"였다. 그건 인벤토리지 섬이 아니다.
 * 여기서는 실제 섬을 그린다: 계절·시간대에 따라 변하는 하늘, 물결치는 바다, 모래 해변,
 * 잔디 고원, 그 위에 **원근으로 배치되는 데코**, 그리고 해변에 서 있는 우리 펫.
 *
 * 좌표계: viewBox 0 0 340 230 (가로로 넓은 풍경).
 *   하늘 0~118 · 바다 ~230 · 섬(모래) cy180 · 잔디 고원 cy172
 *   데코 6×4 그리드는 잔디 위에 **뒤로 갈수록 작고 좁게**(ROWS) 매핑 → 평면 격자가 아니라 공간감.
 *   펫은 그리드 앞 모래밭(y≈205)에 서서 섬을 바라본다.
 *
 * 배치 슬롯은 <g> 히트영역으로만 존재하고(빈 칸은 배치 모드에서만 은은히 표시),
 * 평소엔 **UI 격자가 전혀 보이지 않는다** — 그냥 섬 풍경으로 보이는 게 목표.
 *
 * 순수성: Math.random 미사용(파도/구름/반짝임은 전부 CSS 애니메이션). 시간대는 `now` prop 파생.
 */

import { type ReactNode, useId } from "react";
import type { Placed, Season } from "@/lib/island";
import { DECOR_COLS, DECOR_ROWS } from "@/lib/island";
import { decorArt, SKY_DECOR } from "@/components/island/art/decor";
import { petArt } from "@/components/island/art/pets";
import { INK } from "@/components/island/art/parts";

/* ── 레이아웃 상수 ─────────────────────────────────────────── */
const VW = 340;
const VH = 230;
const HORIZON = 118; // 수평선
const SAND = { cx: 170, cy: 181, rx: 156, ry: 45 };
const GRASS = { cx: 170, cy: 172, rx: 143, ry: 39 };

/** 행별 원근: [화면 Y, 반너비, 스케일]. 뒤(0)로 갈수록 작고 좁다. */
const ROWS: [number, number, number][] = [
  [143, 76, 0.76],
  [156, 97, 0.85],
  [170, 117, 0.94],
  [184, 132, 1.03],
];
const SLOT = 27; // 슬롯 기본 폭(스케일 곱해서 사용)

/** 그리드 (x,y) → 화면 좌표/스케일. */
export function slotPos(x: number, y: number): { sx: number; sy: number; sc: number } {
  const [rowY, half, sc] = ROWS[Math.min(y, ROWS.length - 1)];
  const t = x / Math.max(1, DECOR_COLS - 1); // 0..1
  return { sx: 170 + (t - 0.5) * 2 * half, sy: rowY, sc };
}

/** 하늘 소품(나비·달·별…)은 하늘 영역에 흩어 놓는다 — 격자에 묶이면 어색. */
function skyPos(x: number, y: number): { sx: number; sy: number; sc: number } {
  const t = x / Math.max(1, DECOR_COLS - 1);
  return { sx: 34 + t * (VW - 68), sy: 26 + y * 17, sc: 0.78 };
}

/* ── 계절/시간대 팔레트 ────────────────────────────────────── */
type Sky = { top: string; mid: string; bottom: string; sea: [string, string]; night: boolean };

function skyOf(season: Season, hour: number): Sky {
  const night = hour < 6 || hour >= 19;
  const dusk = !night && (hour < 8 || hour >= 17);
  if (night) {
    return {
      top: "#1a1b3a",
      mid: "#2c2a55",
      bottom: "#4a3f6b",
      sea: ["#2a3f63", "#1b2949"],
      night: true,
    };
  }
  if (dusk) {
    return {
      top: "#ffb37a",
      mid: "#ffd2a1",
      bottom: "#ffe6c4",
      sea: ["#5f9fc4", "#3b6f97"],
      night: false,
    };
  }
  const bySeason: Record<Season, Sky> = {
    spring: { top: "#a8dcff", mid: "#cdeeff", bottom: "#f0f9e8", sea: ["#63c6e5", "#3b93bf"], night: false },
    summer: { top: "#5fc3f0", mid: "#9ee0f7", bottom: "#e8f9ff", sea: ["#46b6dd", "#2b87b3"], night: false },
    autumn: { top: "#ffc98a", mid: "#ffe3b5", bottom: "#fff3dd", sea: ["#5aa7c4", "#37799c"], night: false },
    winter: { top: "#b9d4ea", mid: "#dbe9f5", bottom: "#f3f8fd", sea: ["#7fb0cc", "#4d7d9c"], night: false },
  };
  return bySeason[season];
}

/** 계절별 잔디 톤. */
const GRASS_TONE: Record<Season, [string, string, string]> = {
  spring: ["#9ae86f", "#63c94b", "#3f9636"],
  summer: ["#8ade5f", "#52bd3f", "#358a2c"],
  autumn: ["#d9c26a", "#bfa044", "#8d7430"],
  winter: ["#e8f1f5", "#cfe0e8", "#a4bcc7"],
};

/* ── 부속 그래픽 ───────────────────────────────────────────── */

function Cloud({ x, y, s, o = 0.85 }: { x: number; y: number; s: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <ellipse cx={0} cy={0} rx={20} ry={9} fill="#fff" />
      <ellipse cx={-12} cy={3} rx={12} ry={7} fill="#fff" />
      <ellipse cx={13} cy={3} rx={13} ry={7} fill="#fff" />
      <ellipse cx={2} cy={-6} rx={11} ry={7.5} fill="#fff" />
    </g>
  );
}

/** 물결 띠 — 좌우로 천천히 흐르는 CSS 애니(animate-island-wave). */
function WaveBand({ y, color, opacity, dur }: { y: number; color: string; opacity: number; dur: number }) {
  // 한 주기(120) 를 3번 이어붙여 -120 이동해도 끊기지 않음
  const seg = (ox: number) =>
    `M ${ox} ${y} q 15 -5 30 0 t 30 0 t 30 0 t 30 0 v 40 h -120 z`;
  return (
    <g className="island-wave" style={{ animationDuration: `${dur}s` }} opacity={opacity}>
      {[-120, 0, 120, 240, 360].map((ox) => (
        <path key={ox} d={seg(ox)} fill={color} />
      ))}
    </g>
  );
}

/** 하늘을 가로지르는 새(갈매기 실루엣) — X 활공은 CSS, 기본 Y 는 attr 로 분리. */
function Bird({ y, dur, delay, scale = 1, color }: { y: number; dur: number; delay: number; scale?: number; color: string }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className="island-bird" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
        <path
          d="M -6 0 Q -3 -4 0 -0.5 Q 3 -4 6 0"
          transform={`scale(${scale})`}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

/* 계절별 떠다니는 입자(봄 꽃잎·여름 빛·가을 낙엽·겨울 눈). 랜덤 금지 → 고정 슬롯+음수 딜레이. */
type FallShape = "petal" | "dot" | "leaf" | "snow";
const AMBIENT: Record<Season, { fill: string; shape: FallShape; op: number }> = {
  spring: { fill: "#ffc4dd", shape: "petal", op: 0.8 },
  summer: { fill: "#fff3b0", shape: "dot", op: 0.62 },
  autumn: { fill: "#e8925a", shape: "leaf", op: 0.82 },
  winter: { fill: "#ffffff", shape: "snow", op: 0.85 },
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
function Faller({ shape, fill }: { shape: FallShape; fill: string }) {
  if (shape === "petal") return <ellipse rx={3} ry={1.6} fill={fill} />;
  if (shape === "leaf") return <path d="M0 -3 Q3 0 0 3 Q-3 0 0 -3 Z" fill={fill} />;
  return <circle r={shape === "snow" ? 1.9 : 1.5} fill={fill} />;
}

/* ── 메인 ──────────────────────────────────────────────────── */

export default function IslandScene({
  decor,
  petForm,
  season,
  now,
  placing,
  onSlotTap,
  ratingLabel,
  petAsleep,
  children,
}: {
  decor: Placed[];
  petForm: string;
  season: Season;
  now: number;
  /** 배치할 데코 key (있으면 빈 칸이 반짝이며 탭 대기). */
  placing?: string | null;
  /** 슬롯 탭 — 비어 있으면 배치, 차 있으면 치우기(호출측이 판단). */
  onSlotTap?: (x: number, y: number, placed: Placed | null) => void;
  ratingLabel?: ReactNode;
  petAsleep?: boolean;
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const hour = new Date(now).getHours();
  const sky = skyOf(season, hour);
  const grass = GRASS_TONE[season];
  const amb = AMBIENT[season];
  // 아트 레지스트리 조회 — 같은 form 이면 **모듈 스코프의 동일 컴포넌트 참조**라 재마운트 없음.
  // (린트는 레지스트리 조회를 '렌더 중 컴포넌트 생성'으로 본다.) ⚠ `petArt(form)({...})` 처럼
  // 함수로 호출하면 아트 내부 useId 가 이 컴포넌트의 훅 순서에 섞여 form 전환 시 훅 개수가
  // 달라진다(React 오류) → 반드시 JSX 엘리먼트로 렌더할 것.
  const Pet = petArt(petForm);

  const at = (x: number, y: number) => decor.find((d) => d.x === x && d.y === y) ?? null;

  // 지면 데코는 뒤→앞 순서로 그려야 앞의 것이 위에 겹친다(정렬 = 깊이).
  const groundSlots: { x: number; y: number; p: Placed | null }[] = [];
  const skySlots: { x: number; y: number; p: Placed }[] = [];
  for (let y = 0; y < DECOR_ROWS; y++) {
    for (let x = 0; x < DECOR_COLS; x++) {
      const p = at(x, y);
      if (p && SKY_DECOR.has(p.key)) skySlots.push({ x, y, p });
      else groundSlots.push({ x, y, p });
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/12">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block w-full" role="img" aria-label="우리 섬">
        <defs>
          <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.top} />
            <stop offset="0.62" stopColor={sky.mid} />
            <stop offset="1" stopColor={sky.bottom} />
          </linearGradient>
          <linearGradient id={`sea${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.sea[0]} />
            <stop offset="1" stopColor={sky.sea[1]} />
          </linearGradient>
          <radialGradient id={`glow${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6c8" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`grass${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={grass[0]} />
            <stop offset="0.55" stopColor={grass[1]} />
            <stop offset="1" stopColor={grass[2]} />
          </linearGradient>
          <clipPath id={`seaclip${uid}`}>
            <rect x="0" y={HORIZON} width={VW} height={VH - HORIZON} />
          </clipPath>
        </defs>

        {/* 하늘 */}
        <rect x="0" y="0" width={VW} height={HORIZON + 2} fill={`url(#sky${uid})`} />

        {/* 해/달 + 후광 */}
        <g>
          <circle cx={272} cy={34} r={26} fill={`url(#glow${uid})`} />
          {sky.night ? (
            <>
              <circle cx={272} cy={34} r={12} fill="#fdf6d8" />
              <circle cx={266} cy={30} r={10} fill={sky.top} opacity={0.9} />
            </>
          ) : (
            <circle cx={272} cy={34} r={12.5} fill="#fff2a8" />
          )}
        </g>

        {/* 밤 별 (고정 좌표 — 랜덤 금지) */}
        {sky.night && (
          <g fill="#fff" className="island-twinkle">
            {[
              [28, 22, 1.5], [56, 40, 1.1], [92, 18, 1.3], [124, 46, 1], [150, 26, 1.4],
              [196, 38, 1.1], [222, 20, 1.3], [246, 52, 1], [300, 62, 1.2], [318, 30, 1.4],
              [70, 66, 1], [172, 60, 1.1],
            ].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} />
            ))}
          </g>
        )}

        {/* 구름 (겨울/밤엔 옅게) */}
        <g className="island-drift">
          <Cloud x={62} y={30} s={1} o={sky.night ? 0.18 : 0.9} />
          <Cloud x={188} y={20} s={0.72} o={sky.night ? 0.14 : 0.75} />
          <Cloud x={128} y={58} s={0.55} o={sky.night ? 0.1 : 0.5} />
        </g>

        {/* 새 — 낮/노을에만 하늘을 가로지른다(밤엔 쉼) */}
        {!sky.night && (
          <g opacity={0.85}>
            <Bird y={48} dur={19} delay={-4} scale={1} color="#3d4d66" />
            <Bird y={66} dur={26} delay={-13} scale={0.8} color="#48586f" />
          </g>
        )}

        {/* 바다 */}
        <rect x="0" y={HORIZON} width={VW} height={VH - HORIZON} fill={`url(#sea${uid})`} />
        <g clipPath={`url(#seaclip${uid})`}>
          <WaveBand y={HORIZON + 6} color="#ffffff" opacity={0.16} dur={13} />
          <WaveBand y={HORIZON + 26} color="#ffffff" opacity={0.12} dur={17} />
          <WaveBand y={VH - 34} color="#ffffff" opacity={0.14} dur={11} />
        </g>

        {/* 섬 — 모래(해변) */}
        <ellipse cx={SAND.cx} cy={SAND.cy} rx={SAND.rx} ry={SAND.ry} fill="#f2dcaa" />
        <ellipse cx={SAND.cx} cy={SAND.cy - 3} rx={SAND.rx - 4} ry={SAND.ry - 4} fill="#f8e9c4" />
        {/* 파도가 해변에 닿는 흰 테두리 */}
        <ellipse
          cx={SAND.cx}
          cy={SAND.cy + 3}
          rx={SAND.rx + 3}
          ry={SAND.ry + 3}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.5}
          opacity={0.4}
        />

        {/* 섬 — 잔디 고원 */}
        <ellipse cx={GRASS.cx} cy={GRASS.cy + 3} rx={GRASS.rx} ry={GRASS.ry} fill={grass[2]} opacity={0.5} />
        <ellipse cx={GRASS.cx} cy={GRASS.cy} rx={GRASS.rx} ry={GRASS.ry} fill={`url(#grass${uid})`} />
        {/* 잔디 질감 — 고정 위치 풀 포기(랜덤 금지), 은은한 밝은 패치로 굴곡 표현 */}
        <ellipse cx={112} cy={160} rx={42} ry={11} fill={grass[0]} opacity={0.26} />
        <ellipse cx={226} cy={168} rx={38} ry={10} fill={grass[0]} opacity={0.2} />
        <ellipse cx={170} cy={186} rx={54} ry={9} fill={grass[2]} opacity={0.22} />

        {/* 하늘 데코(나비·달·별·혜성·행성) — 중첩 SVG 로 얹는다(foreignObject 불필요) */}
        {skySlots.map(({ x, y, p }) => {
          const { sx, sy, sc } = skyPos(x, y);
          const A = decorArt(p.key);
          const w = SLOT * sc * 1.15;
          return (
            // ⚠ 위치(transform 속성)와 애니(CSS transform)를 **다른 <g> 로 분리**해야 한다.
            //    한 요소에 같이 걸면 CSS transform 이 속성을 덮어써 (0,0) 으로 튄다.
            <g
              key={p.id}
              transform={`translate(${sx - w / 2} ${sy - w / 2})`}
              onClick={() => onSlotTap?.(x, y, p)}
              style={{ cursor: onSlotTap ? "pointer" : undefined }}
            >
              <g className="island-float">
                <A size={w} />
              </g>
            </g>
          );
        })}

        {/* 지면 데코 — 뒤(y=0)부터 그려 앞이 위로 겹치게 */}
        {groundSlots.map(({ x, y, p }) => {
          const { sx, sy, sc } = slotPos(x, y);
          const w = SLOT * sc;
          const empty = !p;
          const A = p ? decorArt(p.key) : null;
          return (
            <g
              key={`${x}-${y}`}
              onClick={() => onSlotTap?.(x, y, p)}
              style={{ cursor: onSlotTap ? "pointer" : undefined }}
            >
              {/* 히트영역 — 항상 존재(투명), 빈 칸은 배치 모드에서만 보임 */}
              <ellipse
                cx={sx}
                cy={sy + w * 0.34}
                rx={w * 0.46}
                ry={w * 0.24}
                fill={empty && placing ? "#ffffff" : "transparent"}
                opacity={empty && placing ? 0.5 : 0}
                className={empty && placing ? "island-slot-pulse" : undefined}
                stroke={empty && placing ? "#ffffff" : "none"}
                strokeWidth={empty && placing ? 1.2 : 0}
              />
              {A && (
                <g transform={`translate(${sx - w / 2} ${sy - w * 0.72})`}>
                  <A size={w} />
                </g>
              )}
            </g>
          );
        })}

        {/* 펫 — 그리드 앞 모래밭에 서서 섬을 지킨다.
            위치 g(transform 속성) / 애니 g(CSS transform) 분리 — 겹치면 CSS 가 위치를 덮어씀. */}
        <g transform={`translate(${170 - 26} ${210 - 48})`}>
          {/* 산책(translateX) → 숨쉬기(translateY) 를 각각 다른 <g> 로 분리(한 요소=한 transform).
              자면 둘 다 멈춘다. */}
          <g className={petAsleep ? undefined : "island-stroll"}>
            <g className={petAsleep ? undefined : "island-bob"}>
              {/* key=form — 진화로 폼이 바뀌면 의도적으로 새로 마운트(상태 없는 순수 아트라 무해) */}
              {/* eslint-disable-next-line react-hooks/static-components */}
              <Pet key={petForm} size={52} title="우리 펫" />
            </g>
          </g>
        </g>

        {/* 계절 입자 — 씬 전체에 은은히 떠다닌다(맨 앞, 낮은 불투명도) */}
        <g opacity={amb.op}>
          {FALLERS.map((f, i) => (
            <g key={i} transform={`translate(${f.x} 0)`}>
              <g className="island-fall" style={{ animationDuration: `${f.dur}s`, animationDelay: `${f.delay - f.dur}s` }}>
                <Faller shape={amb.shape} fill={amb.fill} />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* 좌상단 평점 뱃지 */}
      {ratingLabel && (
        <div className="absolute left-2 top-2 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          {ratingLabel}
        </div>
      )}
      {children}

      {/* 씬 전용 애니메이션 — 전역 CSS 오염 없이 여기서만 */}
      <style>{`
        @keyframes island-wave-x { from { transform: translateX(0) } to { transform: translateX(-120px) } }
        .island-wave { animation: island-wave-x linear infinite; }
        @keyframes island-drift-x { 0%{transform:translateX(-8px)} 50%{transform:translateX(8px)} 100%{transform:translateX(-8px)} }
        .island-drift { animation: island-drift-x 26s ease-in-out infinite; }
        @keyframes island-bob-y { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2.5px)} }
        .island-bob { animation: island-bob-y 3.4s ease-in-out infinite; }
        @keyframes island-float-y { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .island-float { animation: island-float-y 5s ease-in-out infinite; }
        @keyframes island-twinkle-o { 0%,100%{opacity:.9} 50%{opacity:.45} }
        .island-twinkle { animation: island-twinkle-o 4s ease-in-out infinite; }
        @keyframes island-slot-o { 0%,100%{opacity:.22} 50%{opacity:.6} }
        .island-slot-pulse { animation: island-slot-o 1.5s ease-in-out infinite; }
        @keyframes island-stroll-x { 0%,100%{transform:translateX(-15px)} 50%{transform:translateX(15px)} }
        .island-stroll { animation: island-stroll-x 9s ease-in-out infinite; }
        @keyframes island-bird-x { 0%{transform:translate(-40px,0)} 50%{transform:translate(180px,-7px)} 100%{transform:translate(400px,0)} }
        .island-bird { animation: island-bird-x linear infinite; }
        @keyframes island-fall-y { 0%{transform:translate(0,-14px) rotate(0)} 10%{opacity:1} 90%{opacity:1} 100%{transform:translate(16px,244px) rotate(220deg)} }
        .island-fall { animation: island-fall-y linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .island-wave,.island-drift,.island-bob,.island-float,.island-twinkle,.island-slot-pulse,.island-stroll,.island-bird,.island-fall { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** 씬 밖(시트/도감)에서 쓰는 작은 섬 썸네일용 배경색 — 톤 통일. */
export const SCENE_INK = INK;
