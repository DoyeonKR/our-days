"use client";

/**
 * 우리 섬 — 데코 아트 22종
 * ============================================================================
 * 섬 위에 놓여 '풍경'을 이루는 오브젝트들. 이모지 대체가 아니라 한 화면에 여러 개가
 * 같이 놓였을 때 같은 세계관으로 보이는 게 목표라서 세트별 색 톤을 묶었다.
 *
 *   spring    봄 파스텔 (rose/leaf/gold)        — tulip rose sunflower blossom butterfly
 *   cozy      따뜻한 앰버/브라운 (amber/brown)  — sofa chair candle frame books
 *   beach     물/모래 (water/sand/white)        — umbrella shell crab wave
 *   couple    로즈/골드 (rose/gold/cream)       — hearts cheers ferris ring
 *   celestial 밤보라/별빛 (violet/night/gold)   — moon stars comet planet
 *
 * 규칙(parts.tsx 계약 준수):
 *  - viewBox 는 <Art> 가 "0 0 100 100" 고정. 지면 y=92, 중심 x=50.
 *  - 지면 오브젝트는 GroundShadow 필수. 하늘 소품(SKY_DECOR)은 그림자 없이 공중 + 글로우.
 *  - 광원 좌상단(밝은 면 = 왼쪽 위). 색은 PAL 에서만. 먹선은 INK.
 *  - 랜덤 금지 — 반복 배치는 전부 상수 배열/각도 계산(순수).
 *  - 등급이 높을수록 화려하게. legendary(ring/planet)는 글로우 + Sparkle 로 확실히 구분.
 */

import { useId } from "react";
import {
  Art,
  type ArtFC,
  PAL,
  INK,
  INK_SOFT,
  GroundShadow,
  Leaf,
  Sparkle,
  Eyes,
  Blush,
  Smile,
  Body,
  VGrad,
} from "./parts";

/* ══════════════════ 내부 헬퍼 (순수 함수 — 랜덤 없음) ══════════════════ */

/** 극좌표 → 데카르트. 0도 = 위쪽(12시), 시계방향. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
}

/** 5각 별 path. polar() 이 이미 0도=12시라 rot=0 이 꼭짓점 위(기본). rot 은 그로부터의 추가 회전. */
function starPath(cx: number, cy: number, r: number, inner = 0.44, rot = 0): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const [x, y] = polar(cx, cy, rr, rot + i * 36);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/** 하트 path. s = 대략 반지름. */
function heartPath(cx: number, cy: number, s: number): string {
  return (
    `M${cx} ${cy + s * 0.98} ` +
    `C${cx - s * 1.4} ${cy + s * 0.1} ${cx - s * 1.0} ${cy - s * 1.05} ${cx} ${cy - s * 0.3} ` +
    `C${cx + s * 1.0} ${cy - s * 1.05} ${cx + s * 1.4} ${cy + s * 0.1} ${cx} ${cy + s * 0.98} Z`
  );
}

/**
 * 은은한 발광 — 하늘 소품/레전드용.
 * 동심원 겹치기는 어두운 배경에서 테두리(밴딩)가 보여 '접시'처럼 읽힌다 → 방사형 그라데이션.
 * gradient id 는 useId 로 자체 생성한다(호출부가 넘기지 않음). 같은 페이지에 여러 개가
 * 떠도 id 가 충돌하지 않아야 하므로 고정 문자열을 주입받는 경로는 두지 않는다.
 */
function Glow({
  cx,
  cy,
  r,
  color,
  opacity = 0.3,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity?: number;
}) {
  const gid = `glow${useId().replace(/:/g, "")}`;
  return (
    <>
      <defs>
        <radialGradient id={gid}>
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.5} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
    </>
  );
}

/** 5장 꽃잎 소형 꽃 — 들꽃/정원 공용. 왼쪽 위 꽃잎이 밝다. */
function Petal5({
  cx,
  cy,
  r,
  tone,
  core = PAL.gold[1],
  rot = 0,
}: {
  cx: number;
  cy: number;
  r: number;
  tone: readonly string[];
  core?: string;
  rot?: number;
}) {
  return (
    <>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={cx}
          cy={cy - r * 0.82}
          rx={r * 0.5}
          ry={r * 0.76}
          fill={a + rot > 55 && a + rot < 250 ? tone[2] : tone[0]}
          transform={`rotate(${a + rot} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.4} fill={core} />
      <circle cx={cx - r * 0.14} cy={cy - r * 0.15} r={r * 0.15} fill="#fff" opacity={0.55} />
    </>
  );
}

/** 흙 둔덕 — 화단 데코가 지면에 '심겨' 보이게. */
function SoilMound({ cx = 50, cy = 90.5, rx = 21 }: { cx?: number; cy?: number; rx?: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.28} fill={PAL.soil[1]} />
      <ellipse cx={cx - rx * 0.24} cy={cy - rx * 0.09} rx={rx * 0.6} ry={rx * 0.15} fill={PAL.soil[0]} opacity={0.45} />
      <ellipse cx={cx + rx * 0.3} cy={cy + rx * 0.08} rx={rx * 0.5} ry={rx * 0.12} fill={PAL.soil[2]} opacity={0.4} />
    </>
  );
}

/** 모래 둔덕 — 바다 세트 공용. */
function SandMound({ cx = 50, cy = 90, rx = 26 }: { cx?: number; cy?: number; rx?: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.26} fill={PAL.sand[1]} />
      <ellipse cx={cx - rx * 0.22} cy={cy - rx * 0.08} rx={rx * 0.62} ry={rx * 0.14} fill={PAL.sand[0]} opacity={0.7} />
      <ellipse cx={cx + rx * 0.34} cy={cy + rx * 0.07} rx={rx * 0.44} ry={rx * 0.1} fill={PAL.sand[2]} opacity={0.45} />
    </>
  );
}

/* ══════════════════ 🌸 spring — 봄 정원 ══════════════════ */

/** 튤립 (common) — 화단에 심긴 큰 튤립 + 뒤쪽 작은 튤립. */
export const Tulip: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "튤립"}>
    <GroundShadow rx={24} ry={5.5} />
    <SoilMound />
    {/* 뒤쪽 작은 튤립 */}
    <path d="M72 89 C71 79 73 72 72 66" stroke={PAL.leaf[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <Leaf cx={72} cy={80} r={8} rot={-34} tone={2} />
    <path
      d="M64 62 C64 56 65 51 66 48 L69 53 L72 46 L75 53 L78 48 C79 51 80 56 80 62 C80 69 76 73 72 73 C68 73 64 69 64 62 Z"
      fill={PAL.amber[1]}
    />
    <path d="M72 46 L75 53 L78 48 C79 51 80 56 80 62 C80 69 76 73 72 73 Z" fill={PAL.amber[2]} opacity={0.5} />
    <path d="M67 53 Q66 59 67 66" stroke={PAL.amber[0]} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75} />
    {/* 메인 줄기 + 잎 */}
    <path d="M50 91 C47 79 52 67 50 56" stroke={PAL.leaf[1]} strokeWidth={3.8} strokeLinecap="round" fill="none" />
    <path d="M51.4 91 C48.4 79 53.4 67 51.4 56" stroke={PAL.leaf[2]} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.55} />
    <Leaf cx={49} cy={77} r={13} rot={204} tone={0} />
    <Leaf cx={51} cy={70} r={12} rot={-26} tone={2} />
    {/* 꽃 컵 + 꽃잎 3장 */}
    <path d="M35 45 C35 60 41 69 50 69 C59 69 65 60 65 45 Z" fill={PAL.rose[1]} />
    <path d="M36 44 Q33 32 43 29 Q48 37 46 51 Z" fill={PAL.rose[0]} />
    <path d="M64 44 Q67 32 57 29 Q52 37 54 51 Z" fill={PAL.rose[2]} />
    <path d="M43 33 Q50 23 57 33 Q58 47 50 54 Q42 47 43 33 Z" fill={PAL.rose[1]} />
    <path d="M50 54 Q58 47 57 33 Q55 30 53 30 Q55 45 50 54 Z" fill={PAL.rose[2]} opacity={0.5} />
    <ellipse cx={44} cy={41} rx={3.2} ry={6.2} fill="#fff" opacity={0.3} transform="rotate(-12 44 41)" />
  </Art>
);

/** 장미 (common) — 소용돌이 꽃잎 + 가시 줄기. */
export const Rose: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "장미"}>
    <GroundShadow rx={22} ry={5} />
    <SoilMound rx={19} />
    <path d="M50 91 C48 80 53 70 51 60" stroke={PAL.leaf[2]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
    <path d="M52.5 76 l6 -3.4 -4.6 4.8 Z" fill={PAL.leaf[2]} />
    <path d="M48.6 68 l-6 -3.4 4.6 4.8 Z" fill={PAL.leaf[2]} />
    <Leaf cx={51} cy={79} r={12} rot={-24} tone={1} />
    <Leaf cx={49} cy={72} r={11} rot={208} tone={0} />
    {/* 꽃받침 */}
    <path d="M39 58 Q50 68 61 58 Q50 63 39 58 Z" fill={PAL.leaf[2]} />
    {/* 꽃송이 */}
    <circle cx={50} cy={43} r={19} fill={PAL.berry[1]} />
    <path d="M31 43 a19 19 0 0 0 38 0 a19 19 0 0 0 -38 0" fill={PAL.berry[2]} opacity={0.3} />
    <path d="M32 39 Q29 25 44 26 Q37 33 35 44 Z" fill={PAL.berry[0]} />
    <path d="M68 39 Q71 25 56 26 Q63 33 65 44 Z" fill={PAL.berry[2]} />
    <path d="M34 51 Q40 63 51 61 Q41 59 36 49 Z" fill={PAL.berry[0]} opacity={0.85} />
    {/* 소용돌이 심 */}
    <path
      d="M51 32 C60 33 63 41 60 47 C57 54 47 56 42 51 C37 46 40 38 46 37 C51 36 54 40 52 44"
      stroke={PAL.rose[0]}
      strokeWidth={3.1}
      strokeLinecap="round"
      fill="none"
    />
    <circle cx={49.5} cy={43} r={4.2} fill={PAL.rose[0]} />
    <circle cx={48} cy={41.4} r={1.7} fill="#fff" opacity={0.6} />
  </Art>
);

/** 해바라기 (rare) — 2겹 꽃잎 + 씨앗 중심. */
export const Sunflower: ArtFC = (p) => {
  const back = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
  const front = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const seeds: [number, number][] = [
    [46, 40],
    [53, 38],
    [50, 44],
    [44, 46],
    [56, 45],
    [49, 33],
    [42, 36],
    [57, 34],
  ];
  return (
    <Art {...p} title={p.title ?? "해바라기"}>
      <GroundShadow rx={22} ry={5} />
      <SoilMound rx={18} />
      <path d="M50 91 C47 78 52 66 50 54" stroke={PAL.leaf[1]} strokeWidth={4.2} strokeLinecap="round" fill="none" />
      <path d="M51.6 91 C48.6 78 53.6 66 51.6 54" stroke={PAL.leaf[2]} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.5} />
      <Leaf cx={49} cy={78} r={15} rot={200} tone={0} />
      <Leaf cx={51} cy={69} r={13} rot={-28} tone={2} />
      {/* 뒤 꽃잎 */}
      {back.map((a) => (
        <ellipse
          key={`b${a}`}
          cx={50}
          cy={22}
          rx={4.6}
          ry={10.5}
          fill={PAL.amber[2]}
          opacity={0.85}
          transform={`rotate(${a} 50 40)`}
        />
      ))}
      {/* 앞 꽃잎 */}
      {front.map((a) => (
        <ellipse
          key={`f${a}`}
          cx={50}
          cy={25}
          rx={5.2}
          ry={10}
          fill={a > 50 && a < 240 ? PAL.gold[2] : PAL.gold[0]}
          transform={`rotate(${a} 50 40)`}
        />
      ))}
      {/* 씨앗 중심 */}
      <circle cx={50} cy={40} r={12} fill={PAL.brown[2]} />
      <circle cx={50} cy={40} r={9.4} fill={PAL.brown[1]} />
      <path d="M40.6 40 a9.4 9.4 0 0 0 18.8 0 a9.4 9.4 0 0 0 -18.8 0" fill={PAL.brown[2]} opacity={0.4} />
      {seeds.map(([sx, sy]) => (
        <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r={1.5} fill={PAL.brown[2]} opacity={0.75} />
      ))}
      <ellipse cx={45.5} cy={35.5} rx={3.4} ry={2.4} fill={PAL.cream[0]} opacity={0.35} transform="rotate(-24 45.5 35.5)" />
    </Art>
  );
};

/** 들꽃 (common) — 잔디 덤불 + 작은 꽃 세 송이. */
export const Blossom: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "들꽃"}>
    <GroundShadow rx={26} ry={5.5} />
    <ellipse cx={50} cy={90} rx={25} ry={6} fill={PAL.grass[2]} opacity={0.55} />
    {/* 잔디 */}
    <path d="M30 91 Q31 78 27 71" stroke={PAL.grass[1]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <path d="M36 91 Q34 80 38 73" stroke={PAL.grass[0]} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    <path d="M64 91 Q66 79 71 73" stroke={PAL.grass[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <path d="M70 91 Q69 82 65 76" stroke={PAL.grass[1]} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    {/* 줄기 */}
    <path d="M50 91 C49 76 45 68 42 60" stroke={PAL.leaf[1]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <path d="M52 91 C55 80 61 72 65 66" stroke={PAL.leaf[2]} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    <path d="M51 90 C52 76 52 66 52 52" stroke={PAL.leaf[1]} strokeWidth={2.8} strokeLinecap="round" fill="none" />
    <Leaf cx={49} cy={78} r={9} rot={202} tone={0} />
    <Leaf cx={54} cy={72} r={8} rot={-30} tone={2} />
    {/* 꽃 */}
    <Petal5 cx={65} cy={64} r={9} tone={PAL.violet} core={PAL.gold[1]} rot={18} />
    <Petal5 cx={41} cy={58} r={10} tone={PAL.white} core={PAL.amber[1]} />
    <Petal5 cx={52} cy={49} r={11.5} tone={PAL.rose} core={PAL.gold[0]} rot={36} />
    <Sparkle cx={69} cy={48} r={3.4} color={PAL.cream[0]} opacity={0.8} />
  </Art>
);

/** 나비 (rare, 하늘) — 4장 날개 + 더듬이. 그림자 없이 공중. */
export const Butterfly: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "나비"}>
    <Glow cx={50} cy={50} r={40} color={PAL.violet[0]} opacity={0.3} />
    {/* 아래 날개 */}
    <path d="M48 56 C39 58 27 62 29 70 C31 78 43 74 48 62 Z" fill={PAL.rose[0]} />
    <path d="M52 56 C61 58 73 62 71 70 C69 78 57 74 52 62 Z" fill={PAL.rose[1]} />
    <path d="M52 56 C61 58 73 62 71 70 C70 73 66 73 63 71 C66 65 60 60 52 59 Z" fill={PAL.rose[2]} opacity={0.45} />
    {/* 위 날개 */}
    <path d="M48 50 C43 33 29 26 21 33 C13 40 25 54 47 57 Z" fill={PAL.violet[0]} />
    <path d="M52 50 C57 33 71 26 79 33 C87 40 75 54 53 57 Z" fill={PAL.violet[1]} />
    <path d="M52 50 C57 33 71 26 79 33 C82 36 81 41 77 45 C73 38 62 40 55 52 Z" fill={PAL.violet[2]} opacity={0.4} />
    {/* 무늬 */}
    <circle cx={34} cy={39} r={3.6} fill={PAL.gold[0]} opacity={0.9} />
    <circle cx={66} cy={39} r={3.6} fill={PAL.gold[1]} opacity={0.9} />
    <circle cx={37} cy={66} r={2.4} fill={PAL.cream[0]} opacity={0.85} />
    <circle cx={63} cy={66} r={2.4} fill={PAL.cream[0]} opacity={0.7} />
    {/* 몸통 + 더듬이 */}
    <ellipse cx={50} cy={54} rx={3.1} ry={13} fill={PAL.night[1]} />
    <ellipse cx={48.9} cy={49} rx={1.1} ry={6} fill={PAL.violet[0]} opacity={0.5} />
    <circle cx={50} cy={40} r={3.6} fill={PAL.night[1]} />
    <path d="M48 38 Q43 31 40 29" stroke={PAL.night[1]} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    <path d="M52 38 Q57 31 60 29" stroke={PAL.night[1]} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    <circle cx={39.6} cy={28.6} r={1.7} fill={PAL.violet[1]} />
    <circle cx={60.4} cy={28.6} r={1.7} fill={PAL.violet[1]} />
    <Sparkle cx={80} cy={24} r={4.4} color={PAL.cream[0]} />
    <Sparkle cx={22} cy={62} r={3.2} color={PAL.violet[0]} opacity={0.8} />
  </Art>
);

/* ══════════════════ 🏮 cozy — 아늑한 집 ══════════════════ */

/** 소파 (common) — 등받이 + 방석 2 + 팔걸이 + 쿠션. */
export const Sofa: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "소파"}>
    <GroundShadow rx={38} ry={6} />
    {/* 다리 — 좌판 아래로 확실히 보이게 */}
    <rect x={20} y={78} width={6.5} height={12} rx={2.6} fill={PAL.brown[2]} />
    <rect x={21} y={79} width={2} height={9} rx={1} fill={PAL.brown[0]} opacity={0.55} />
    <rect x={73.5} y={78} width={6.5} height={12} rx={2.6} fill={PAL.brown[2]} />
    {/* 등받이 */}
    <rect x={18} y={36} width={64} height={32} rx={11} fill={PAL.amber[1]} />
    <rect x={22} y={40} width={26} height={21} rx={8} fill={PAL.amber[0]} opacity={0.75} />
    <rect x={52} y={40} width={26} height={21} rx={8} fill={PAL.amber[2]} opacity={0.35} />
    <path d="M50 39 L50 66" stroke={PAL.brown[2]} strokeWidth={1.4} opacity={0.3} strokeLinecap="round" />
    {/* 좌판 */}
    <rect x={14} y={62} width={72} height={20} rx={8} fill={PAL.amber[2]} />
    <rect x={19} y={58} width={30} height={16} rx={6} fill={PAL.amber[0]} />
    <rect x={51} y={58} width={30} height={16} rx={6} fill={PAL.amber[1]} />
    <path d="M17 76 L83 76" stroke={PAL.brown[2]} strokeWidth={1.4} opacity={0.28} strokeLinecap="round" />
    {/* 팔걸이 */}
    <rect x={9} y={52} width={17} height={30} rx={8.5} fill={PAL.brown[1]} />
    <ellipse cx={17.5} cy={56} rx={7} ry={3.4} fill={PAL.brown[0]} opacity={0.8} />
    <rect x={74} y={52} width={17} height={30} rx={8.5} fill={PAL.brown[2]} />
    <ellipse cx={82.5} cy={56} rx={7} ry={3.4} fill={PAL.brown[1]} opacity={0.85} />
    {/* 쿠션 */}
    <rect x={28} y={46} width={19} height={19} rx={5} fill={PAL.rose[1]} transform="rotate(-12 37 55)" />
    <rect x={31} y={49} width={7} height={7} rx={3} fill={PAL.rose[0]} opacity={0.75} transform="rotate(-12 37 55)" />
    <path d="M62 48 q8 4 6 14" stroke={PAL.cream[0]} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.35} />
  </Art>
);

/** 의자 (common) — 원목 등받이 의자 + 방석. */
export const Chair: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "의자"}>
    <GroundShadow rx={26} ry={5.5} />
    {/* 뒷다리 */}
    <rect x={33} y={40} width={5} height={50} rx={2.4} fill={PAL.brown[2]} />
    <rect x={62} y={40} width={5} height={50} rx={2.4} fill={PAL.brown[2]} />
    {/* 등받이 살 */}
    <rect x={33} y={38} width={34} height={6} rx={3} fill={PAL.brown[1]} />
    <rect x={35} y={50} width={30} height={5} rx={2.5} fill={PAL.brown[1]} opacity={0.85} />
    <rect x={35} y={60} width={30} height={5} rx={2.5} fill={PAL.brown[1]} opacity={0.7} />
    <rect x={34.2} y={39.4} width={12} height={2} rx={1} fill={PAL.brown[0]} opacity={0.7} />
    {/* 좌판 */}
    <path d="M28 70 L72 70 L68 76 L32 76 Z" fill={PAL.brown[2]} />
    <ellipse cx={50} cy={70} rx={22} ry={6.6} fill={PAL.brown[1]} />
    <ellipse cx={45} cy={68.4} rx={12} ry={3.2} fill={PAL.brown[0]} opacity={0.55} />
    {/* 방석 */}
    <ellipse cx={50} cy={67.4} rx={15} ry={4.8} fill={PAL.cream[1]} />
    <ellipse cx={46} cy={66.2} rx={8} ry={2.2} fill={PAL.cream[0]} opacity={0.8} />
    <path d="M36 68.4 Q50 73 64 68.4" stroke={PAL.rose[1]} strokeWidth={1.6} fill="none" opacity={0.7} />
    {/* 앞다리 */}
    <rect x={28} y={74} width={5.6} height={17} rx={2.6} fill={PAL.brown[1]} />
    <rect x={29} y={75} width={2} height={13} rx={1} fill={PAL.brown[0]} opacity={0.6} />
    <rect x={67} y={74} width={5.6} height={17} rx={2.6} fill={PAL.brown[2]} />
    <rect x={30} y={84} width={41} height={3.4} rx={1.7} fill={PAL.brown[2]} opacity={0.8} />
  </Art>
);

/** 촛불 (rare) — 촛대 + 촛농 + 불꽃 글로우. */
export const Candle: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "촛불"}>
    <GroundShadow rx={22} ry={5} />
    {/* 촛대 */}
    <ellipse cx={50} cy={88} rx={20} ry={5.4} fill={PAL.gold[2]} />
    <ellipse cx={50} cy={86.4} rx={18} ry={4.6} fill={PAL.gold[1]} />
    <ellipse cx={45} cy={85.4} rx={8} ry={2} fill={PAL.gold[0]} opacity={0.8} />
    <path d="M43 80 L57 80 L55 86 L45 86 Z" fill={PAL.gold[2]} />
    {/* 초 몸통 */}
    <rect x={40} y={44} width={20} height={38} rx={3} fill={PAL.cream[1]} />
    <rect x={41.4} y={45} width={5.6} height={35} rx={2.8} fill={PAL.cream[0]} />
    <rect x={54} y={45} width={5} height={35} rx={2.5} fill={PAL.cream[2]} opacity={0.7} />
    <ellipse cx={50} cy={44} rx={10} ry={3.2} fill={PAL.cream[0]} />
    {/* 촛농 */}
    <path d="M40 46 q-1.6 6 0.6 9 q2.4 -3 1.4 -9 Z" fill={PAL.cream[0]} />
    <path d="M58.6 46 q2 7 -0.4 11 q-2.6 -4 -1.6 -11 Z" fill={PAL.cream[0]} opacity={0.9} />
    {/* 심지 + 불꽃 */}
    <path d="M50 44 L50 39" stroke={INK_SOFT} strokeWidth={1.6} strokeLinecap="round" />
    <Glow cx={50} cy={30} r={30} color={PAL.amber[0]} opacity={0.42} />
    <path d="M50 16 C57 25 58 32 55 36 C53 39 47 39 45 36 C42 32 43 25 50 16 Z" fill={PAL.amber[1]} />
    <path d="M50 22 C54 28 55 33 52 36 C50 38 47 37 46 35 C44 32 46 27 50 22 Z" fill={PAL.gold[0]} />
    <ellipse cx={49.4} cy={33} rx={2} ry={3.2} fill="#fff" opacity={0.8} />
    <Sparkle cx={68} cy={30} r={4} color={PAL.gold[0]} opacity={0.85} />
    <Sparkle cx={32} cy={24} r={3} color={PAL.cream[0]} opacity={0.7} />
  </Art>
);

/** 액자 (rare) — 미니 풍경화 + 유리 반사. */
export const Frame: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "액자"}>
    <defs>
      <VGrad id={`dc-frame-sky${_gid}`} from={PAL.sky[0]} to={PAL.rose[0]} />
    </defs>
    <GroundShadow rx={28} ry={5.5} />
    {/* 받침대 */}
    <path d="M58 78 L72 90 L66 90 L54 80 Z" fill={PAL.brown[2]} />
    {/* 프레임 */}
    <rect x={20} y={26} width={60} height={54} rx={4} fill={PAL.brown[1]} />
    <rect x={20} y={26} width={60} height={54} rx={4} fill="none" stroke={PAL.brown[0]} strokeWidth={1.6} opacity={0.6} />
    <path d="M20 30 L80 30 L80 26 L20 26 Z" fill={PAL.brown[0]} opacity={0.55} />
    <path d="M20 80 L80 80 L80 74 L20 74 Z" fill={PAL.brown[2]} opacity={0.55} />
    {/* 매트 + 그림 */}
    <rect x={26} y={32} width={48} height={42} rx={2} fill={PAL.cream[0]} />
    <rect x={30} y={36} width={40} height={34} rx={1.5} fill={`url(#dc-frame-sky${_gid})`} />
    <circle cx={60} cy={45} r={5} fill={PAL.gold[0]} />
    <path d="M30 62 Q40 50 50 58 Q58 64 70 56 L70 70 L30 70 Z" fill={PAL.grass[1]} />
    <path d="M30 66 Q42 58 52 64 Q62 70 70 64 L70 70 L30 70 Z" fill={PAL.grass[2]} opacity={0.75} />
    <path d={heartPath(43, 48, 4.4)} fill={PAL.rose[1]} />
    <path d={heartPath(50, 45, 3.2)} fill={PAL.rose[0]} />
    {/* 유리 반사 */}
    <path d="M30 70 L46 36 L54 36 L34 70 Z" fill="#fff" opacity={0.16} />
    <circle cx={26} cy={32} r={2.2} fill={PAL.gold[1]} />
    <circle cx={74} cy={32} r={2.2} fill={PAL.gold[1]} opacity={0.8} />
  </Art>
  );
};

/** 책장 (common) — 2단 원목 책장 + 책등. */
export const Books: ArtFC = (p) => {
  const top = [
    { x: 25, h: 16, tone: PAL.berry },
    { x: 33, h: 18, tone: PAL.amber },
    { x: 41, h: 14, tone: PAL.mint },
    { x: 49, h: 17, tone: PAL.violet },
    { x: 57, h: 15, tone: PAL.water },
  ] as const;
  const bottom = [
    { x: 25, h: 15, tone: PAL.gold },
    { x: 33, h: 17, tone: PAL.rose },
    { x: 41, h: 14, tone: PAL.grass },
  ] as const;
  return (
    <Art {...p} title={p.title ?? "책장"}>
      <GroundShadow rx={30} ry={5.5} />
      {/* 케이스 */}
      <rect x={18} y={40} width={64} height={50} rx={3} fill={PAL.brown[2]} />
      <rect x={22} y={44} width={56} height={42} rx={2} fill={PAL.brown[1]} />
      <rect x={22} y={44} width={4} height={42} fill={PAL.brown[0]} opacity={0.4} />
      <rect x={22} y={66} width={56} height={3.4} fill={PAL.brown[0]} />
      <rect x={18} y={40} width={64} height={4} rx={2} fill={PAL.brown[0]} opacity={0.8} />
      {/* 윗칸 책 */}
      {top.map((b) => (
        <g key={`t${b.x}`}>
          <rect x={b.x} y={66 - b.h} width={6.6} height={b.h} rx={1.2} fill={b.tone[1]} />
          <rect x={b.x} y={66 - b.h} width={2} height={b.h} rx={1} fill={b.tone[0]} opacity={0.8} />
          <rect x={b.x + 1} y={66 - b.h + 3} width={4.4} height={1.4} fill={PAL.cream[0]} opacity={0.6} />
        </g>
      ))}
      {/* 기울어진 책 */}
      <g transform="rotate(14 66 60)">
        <rect x={63} y={50} width={6.4} height={16} rx={1.2} fill={PAL.rose[1]} />
        <rect x={63} y={50} width={2} height={16} rx={1} fill={PAL.rose[0]} opacity={0.85} />
      </g>
      {/* 아랫칸 책 */}
      {bottom.map((b) => (
        <g key={`b${b.x}`}>
          <rect x={b.x} y={86 - b.h} width={6.6} height={b.h} rx={1.2} fill={b.tone[1]} />
          <rect x={b.x} y={86 - b.h} width={2} height={b.h} rx={1} fill={b.tone[0]} opacity={0.8} />
        </g>
      ))}
      {/* 눕힌 책 더미 */}
      <rect x={52} y={80} width={22} height={6} rx={1.6} fill={PAL.cream[1]} />
      <rect x={54} y={74} width={20} height={6} rx={1.6} fill={PAL.violet[1]} />
      <rect x={54} y={74} width={20} height={2} rx={1} fill={PAL.violet[0]} opacity={0.8} />
    </Art>
  );
};

/* ══════════════════ 🏖️ beach — 바다 ══════════════════ */

/** 파라솔 (common) — 스캘럽 캐노피 + 모래에 꽂힌 기둥. */
export const Umbrella: ArtFC = (p) => {
  const panels = [
    "M50 15 Q30 22 16 45 L27.3 45 Q40 26 50 15 Z",
    "M50 15 Q46 24 38.7 45 L50 45 Q50 28 50 15 Z",
    "M50 15 Q60 26 72.7 45 L84 45 Q70 22 50 15 Z",
  ];
  return (
    <Art {...p} title={p.title ?? "파라솔"}>
      <GroundShadow cx={52} rx={24} ry={5} />
      <SandMound cx={50} cy={89} rx={24} />
      {/* 기둥 */}
      <rect x={48.2} y={30} width={3.6} height={58} rx={1.8} fill={PAL.gray[1]} />
      <rect x={48.6} y={32} width={1.3} height={54} rx={0.7} fill={PAL.white[0]} opacity={0.7} />
      {/* 캐노피 */}
      <path
        d="M16 45 A34 30 0 0 1 84 45 q-5.66 7 -11.33 0 q-5.67 7 -11.33 0 q-5.67 7 -11.34 0 q-5.67 7 -11.33 0 q-5.67 7 -11.33 0 q-5.67 7 -11.34 0 Z"
        fill={PAL.white[1]}
      />
      {panels.map((d) => (
        <path key={d} d={d} fill={PAL.water[1]} />
      ))}
      <path d="M50 15 A34 30 0 0 1 84 45 q-5.66 7 -11.33 0 Q76 30 50 15 Z" fill={PAL.water[2]} opacity={0.22} />
      <path d="M50 15 Q30 22 16 45 Q28 26 50 15 Z" fill="#fff" opacity={0.35} />
      {/* 꼭지 */}
      <circle cx={50} cy={14} r={3.4} fill={PAL.gold[1]} />
      <circle cx={48.8} cy={12.8} r={1.2} fill={PAL.gold[0]} />
      {/* 소품 */}
      <ellipse cx={72} cy={86} rx={8} ry={4} fill={PAL.water[0]} opacity={0.85} />
      <path d="M64 86 a8 4 0 0 1 16 0 Z" fill={PAL.rose[0]} opacity={0.9} />
      <circle cx={70.4} cy={84} r={1.6} fill="#fff" opacity={0.7} />
    </Art>
  );
};

/** 조개 (rare) — 스캘럽 조가비 + 진주. */
export const Shell: ArtFC = (p) => {
  const ribs = [-38, -19, 0, 19, 38];
  return (
    <Art {...p} title={p.title ?? "조개"}>
      <GroundShadow rx={24} ry={5} />
      <SandMound cx={50} cy={89} rx={25} />
      {/* 조가비 */}
      <path
        d="M50 86 C26 82 15 60 23 45 Q29 51 33 42 Q39 50 43 40 Q50 48 57 40 Q61 50 67 42 Q71 51 77 45 C85 60 74 82 50 86 Z"
        fill={PAL.peach[1]}
      />
      <path
        d="M50 86 C26 82 15 60 23 45 Q29 51 33 42 Q39 50 43 40 Q47 44 50 44 Z"
        fill={PAL.peach[0]}
        opacity={0.75}
      />
      <path d="M50 86 C74 82 85 60 77 45 Q71 51 67 42 Q61 50 57 40 Q53 44 50 44 Z" fill={PAL.peach[2]} opacity={0.35} />
      {ribs.map((a) => (
        <path
          key={a}
          d="M50 84 L50 44"
          stroke={PAL.peach[2]}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.45}
          transform={`rotate(${a} 50 84)`}
        />
      ))}
      {/* 경첩 */}
      <path d="M42 86 a8 6 0 0 1 16 0 Z" fill={PAL.peach[2]} />
      <ellipse cx={50} cy={85} rx={4.4} ry={2.4} fill={PAL.cream[0]} opacity={0.65} />
      <ellipse cx={38} cy={58} rx={4} ry={9} fill={PAL.cream[0]} opacity={0.35} transform="rotate(-16 38 58)" />
      {/* 진주 */}
      <ellipse cx={73} cy={88} rx={6} ry={2} fill={INK} opacity={0.16} />
      <circle cx={73} cy={84} r={5.6} fill={PAL.white[1]} />
      <circle cx={71.2} cy={82.2} r={2} fill="#fff" opacity={0.95} />
      <path d="M67.4 84 a5.6 5.6 0 0 0 11.2 0 a5.6 5.6 0 0 0 -11.2 0" fill={PAL.violet[0]} opacity={0.35} />
      <Sparkle cx={28} cy={36} r={4} color={PAL.cream[0]} opacity={0.85} />
    </Art>
  );
};

/** 게 (rare) — 집게 + 눈자루. */
export const Crab: ArtFC = (p) => {
  const legs = [
    "M30 74 C22 76 18 82 19 88",
    "M28 68 C19 68 13 72 12 78",
    "M32 79 C26 84 25 88 26 91",
    "M70 74 C78 76 82 82 81 88",
    "M72 68 C81 68 87 72 88 78",
    "M68 79 C74 84 75 88 74 91",
  ];
  return (
    <Art {...p} title={p.title ?? "게"}>
      <GroundShadow rx={28} ry={5.5} />
      <SandMound cx={50} cy={90} rx={27} />
      {legs.map((d) => (
        <path key={d} d={d} stroke={PAL.berry[2]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      ))}
      {/* 집게 팔 */}
      <path d="M31 64 C24 62 19 58 17 54" stroke={PAL.berry[2]} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M69 64 C76 62 81 58 83 54" stroke={PAL.berry[2]} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M18 56 C10 52 8 44 14 41 C19 39 24 43 24 48 C24 53 22 56 18 56 Z" fill={PAL.berry[0]} />
      <path d="M15 46 L24 44 L23 48 Z" fill={PAL.berry[2]} opacity={0.55} />
      <path d="M82 56 C90 52 92 44 86 41 C81 39 76 43 76 48 C76 53 78 56 82 56 Z" fill={PAL.berry[1]} />
      <path d="M85 46 L76 44 L77 48 Z" fill={PAL.berry[2]} opacity={0.55} />
      {/* 몸통 */}
      <Body cx={50} cy={68} rx={24} ry={16} tone={PAL.berry} />
      <path d="M32 62 Q40 58 48 60" stroke={PAL.berry[2]} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.45} />
      <path d="M54 60 Q62 58 68 62" stroke={PAL.berry[2]} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.45} />
      {/* 눈자루 */}
      <path d="M43 55 L42 46" stroke={PAL.berry[2]} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M57 55 L58 46" stroke={PAL.berry[2]} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={42} cy={43} r={5} fill={PAL.white[0]} />
      <circle cx={58} cy={43} r={5} fill={PAL.white[0]} />
      <Eyes cx={50} y={43} gap={8} r={2.8} />
      <Blush cx={50} y={70} gap={16} rx={4.4} ry={2.6} color={PAL.rose[1]} opacity={0.45} />
      <Smile cx={50} y={71} w={6} />
    </Art>
  );
};

/** 파도 (epic) — 말리는 물결 + 포말. */
export const Wave: ArtFC = (p) => {
  const foam: [number, number, number][] = [
    [40, 40, 7],
    [51, 33, 8.5],
    [63, 34, 6.6],
    [73, 40, 5.4],
    [80, 47, 4],
  ];
  return (
    <Art {...p} title={p.title ?? "파도"}>
      <GroundShadow rx={34} ry={5.5} />
      <SandMound cx={50} cy={90} rx={32} />
      {/* 물결 본체 */}
      <path
        d="M12 86 Q12 54 38 41 Q66 27 86 47 Q93 57 84 67 Q77 74 68 70 Q78 60 70 52 Q57 42 44 53 Q34 62 38 86 Z"
        fill={PAL.water[1]}
      />
      <path d="M12 86 Q12 56 34 43 Q21 60 24 86 Z" fill={PAL.water[2]} opacity={0.7} />
      <path d="M38 41 Q66 27 86 47 Q68 34 44 46 Z" fill={PAL.water[0]} opacity={0.85} />
      <path d="M70 52 Q78 60 68 70 Q80 64 76 53 Z" fill={PAL.water[2]} opacity={0.5} />
      {/* 포말 */}
      {foam.map(([fx, fy, fr]) => (
        <circle key={`${fx}-${fy}`} cx={fx} cy={fy} r={fr} fill={PAL.white[0]} />
      ))}
      {foam.map(([fx, fy, fr]) => (
        <circle key={`h${fx}`} cx={fx - fr * 0.3} cy={fy - fr * 0.3} r={fr * 0.45} fill="#fff" opacity={0.9} />
      ))}
      {/* 물보라 */}
      <circle cx={88} cy={30} r={3.2} fill={PAL.white[1]} opacity={0.9} />
      <circle cx={78} cy={22} r={2.2} fill={PAL.white[0]} opacity={0.8} />
      <circle cx={64} cy={20} r={2.8} fill={PAL.white[1]} opacity={0.75} />
      {/* 밑단 거품 */}
      <path d="M14 84 q8 -5 16 0 q8 5 16 0 q8 -5 16 0 q8 5 16 0" stroke={PAL.white[0]} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.75} />
      <Sparkle cx={30} cy={52} r={4.2} color={PAL.sky[0]} opacity={0.8} />
      <Sparkle cx={72} cy={60} r={3.2} color="#fff" opacity={0.7} />
    </Art>
  );
};

/* ══════════════════ 💑 couple — 커플 코너 ══════════════════ */

/** 하트 (rare) — 지면에 묶인 하트 풍선 두 개. */
export const Hearts: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "하트"}>
    <GroundShadow rx={16} ry={4} />
    {/* 말뚝 + 리본 */}
    <rect x={47.6} y={78} width={4.4} height={13} rx={2} fill={PAL.brown[1]} />
    <rect x={48.2} y={79} width={1.4} height={11} rx={0.7} fill={PAL.brown[0]} opacity={0.7} />
    <path d="M50 80 q-7 -3 -9 2 q6 2 9 -2 Z" fill={PAL.rose[2]} />
    <path d="M50 80 q7 -3 9 2 q-6 2 -9 -2 Z" fill={PAL.rose[1]} />
    <circle cx={50} cy={80.4} r={2.2} fill={PAL.gold[1]} />
    {/* 끈 */}
    <path d="M50 79 C44 68 38 60 36 50" stroke={PAL.cream[2]} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    <path d="M50 79 C58 70 63 64 65 56" stroke={PAL.cream[2]} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    {/* 뒤 하트(골드) — 어두운 층/본체/밝은 층 3겹(면 이탈 없이 셰이딩) */}
    <path d={heartPath(67.4, 45.4, 15)} fill={PAL.gold[2]} />
    <path d={heartPath(66, 44, 14.4)} fill={PAL.gold[1]} />
    <path d={heartPath(64.4, 42.2, 9.6)} fill={PAL.gold[0]} opacity={0.6} />
    {/* ⚠ 하이라이트는 반드시 하트 안쪽에 — 밖으로 삐져나가면 어두운 배경에서 회색 얼룩으로 보인다. */}
    <ellipse cx={60.5} cy={39.5} rx={2.8} ry={3.8} fill="#fff" opacity={0.45} transform="rotate(-24 60.5 39.5)" />
    {/* 앞 하트(로즈) */}
    <path d={heartPath(39.8, 39.8, 20)} fill={PAL.rose[2]} />
    <path d={heartPath(38, 38, 19.2)} fill={PAL.rose[1]} />
    <path d={heartPath(35.8, 35.6, 12.6)} fill={PAL.rose[0]} opacity={0.6} />
    <ellipse cx={31.5} cy={33} rx={3.6} ry={4.8} fill="#fff" opacity={0.45} transform="rotate(-24 31.5 33)" />
    <path d={heartPath(20, 62, 5)} fill={PAL.rose[0]} opacity={0.85} />
    <path d={heartPath(84, 66, 4)} fill={PAL.gold[0]} opacity={0.8} />
    <Sparkle cx={54} cy={18} r={4.4} color={PAL.cream[0]} />
  </Art>
);

/** 건배 (epic) — 부딪히는 샴페인 잔 두 개. */
export const Cheers: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "건배"}>
    <GroundShadow rx={30} ry={5.5} />
    {/* 왼쪽 잔 */}
    <g transform="rotate(-13 34 86)">
      <ellipse cx={34} cy={86} rx={11} ry={3} fill={PAL.white[2]} />
      <ellipse cx={34} cy={85.4} rx={9} ry={2.2} fill={PAL.white[0]} opacity={0.8} />
      <rect x={32.8} y={62} width={2.6} height={24} fill={PAL.white[1]} opacity={0.85} />
      {/* 유리 — 밝은 배경에서도 보이도록 옅은 하늘빛 + 테두리 */}
      <path d="M23 28 L45 28 L40 62 L28 62 Z" fill={PAL.sky[0]} opacity={0.32} />
      <path d="M23 28 L45 28 L40 62 L28 62 Z" fill="none" stroke={PAL.white[2]} strokeWidth={1.3} opacity={0.9} />
      <path d="M25 43 L43 43 L40 62 L28 62 Z" fill={PAL.gold[1]} />
      <ellipse cx={34} cy={43} rx={9} ry={2.4} fill={PAL.gold[0]} />
      <path d="M23 28 L26 28 L30.5 62 L28 62 Z" fill="#fff" opacity={0.6} />
      <ellipse cx={34} cy={28} rx={11} ry={3} fill={PAL.white[0]} opacity={0.5} />
      <circle cx={32} cy={52} r={1.5} fill="#fff" opacity={0.85} />
      <circle cx={37} cy={49} r={1.1} fill="#fff" opacity={0.7} />
      <circle cx={34} cy={57} r={1} fill="#fff" opacity={0.6} />
    </g>
    {/* 오른쪽 잔 */}
    <g transform="rotate(13 66 86)">
      <ellipse cx={66} cy={86} rx={11} ry={3} fill={PAL.white[2]} />
      <ellipse cx={66} cy={85.4} rx={9} ry={2.2} fill={PAL.white[0]} opacity={0.7} />
      <rect x={64.6} y={62} width={2.6} height={24} fill={PAL.white[1]} opacity={0.75} />
      <path d="M55 28 L77 28 L72 62 L60 62 Z" fill={PAL.sky[0]} opacity={0.26} />
      <path d="M55 28 L77 28 L72 62 L60 62 Z" fill="none" stroke={PAL.white[2]} strokeWidth={1.3} opacity={0.8} />
      <path d="M57 43 L75 43 L72 62 L60 62 Z" fill={PAL.amber[1]} />
      <ellipse cx={66} cy={43} rx={9} ry={2.4} fill={PAL.amber[0]} />
      <path d="M74 28 L77 28 L72 62 L69.5 62 Z" fill={PAL.amber[2]} opacity={0.35} />
      <ellipse cx={66} cy={28} rx={11} ry={3} fill={PAL.white[0]} opacity={0.42} />
      <circle cx={64} cy={51} r={1.4} fill="#fff" opacity={0.8} />
      <circle cx={69} cy={55} r={1} fill="#fff" opacity={0.6} />
    </g>
    {/* 부딪힘 */}
    <Sparkle cx={50} cy={26} r={9} color={PAL.gold[0]} />
    <Sparkle cx={38} cy={16} r={4.4} color={PAL.cream[0]} opacity={0.9} />
    <Sparkle cx={62} cy={18} r={3.6} color={PAL.gold[0]} opacity={0.85} />
    <path d={heartPath(50, 40, 5)} fill={PAL.rose[1]} opacity={0.9} />
  </Art>
);

/** 관람차 (epic) — 바퀴 + 캐빈 8칸 + A형 지지대. */
export const Ferris: ArtFC = (p) => {
  const CX = 50;
  const CY = 42;
  const R = 30;
  const cabins = [0, 45, 90, 135, 180, 225, 270, 315];
  const cabinTone = [PAL.rose, PAL.gold, PAL.cream, PAL.gold, PAL.rose, PAL.cream, PAL.gold, PAL.rose] as const;
  return (
    <Art {...p} title={p.title ?? "관람차"}>
      <GroundShadow rx={32} ry={5.5} />
      {/* 지지대 */}
      {/* 좌상단 광원 — 왼쪽 다리가 밝은 면, 오른쪽 다리가 그림자 면. */}
      <path d={`M32 88 L${CX} ${CY} L${CX + 4} ${CY} L38 88 Z`} fill={PAL.gray[1]} />
      <path d={`M68 88 L${CX + 4} ${CY} L${CX} ${CY} L62 88 Z`} fill={PAL.gray[2]} />
      <path d="M38 72 L62 72" stroke={PAL.gray[2]} strokeWidth={2.6} strokeLinecap="round" />
      <rect x={28} y={86} width={44} height={5} rx={2.5} fill={PAL.brown[2]} />
      <rect x={30} y={86.6} width={18} height={1.8} rx={0.9} fill={PAL.brown[0]} opacity={0.6} />
      {/* 스포크 */}
      {cabins.map((a) => {
        const [x, y] = polar(CX, CY, R, a);
        return (
          <path
            key={`s${a}`}
            d={`M${CX} ${CY} L${x.toFixed(2)} ${y.toFixed(2)}`}
            stroke={PAL.gold[2]}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {/* 림 */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={PAL.gold[1]} strokeWidth={3.2} />
      <circle cx={CX} cy={CY} r={R - 4.5} fill="none" stroke={PAL.gold[2]} strokeWidth={1.6} opacity={0.7} />
      <path
        d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX} ${CY - R}`}
        fill="none"
        stroke={PAL.gold[0]}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      {/* 허브 */}
      <circle cx={CX} cy={CY} r={6.4} fill={PAL.gold[2]} />
      <circle cx={CX} cy={CY} r={4} fill={PAL.gold[0]} />
      <circle cx={CX - 1.4} cy={CY - 1.4} r={1.4} fill="#fff" opacity={0.75} />
      {/* 캐빈 */}
      {cabins.map((a, i) => {
        const [x, y] = polar(CX, CY, R, a);
        const t = cabinTone[i];
        return (
          <g key={`c${a}`}>
            <path d={`M${x.toFixed(2)} ${y.toFixed(2)} L${x.toFixed(2)} ${(y + 3).toFixed(2)}`} stroke={PAL.gold[2]} strokeWidth={1.4} />
            <path
              d={`M${(x - 5).toFixed(2)} ${(y + 4).toFixed(2)} h10 a2 2 0 0 1 2 2 v5 a5 5 0 0 1 -14 0 v-5 a2 2 0 0 1 2 -2 Z`}
              fill={t[1]}
            />
            <path d={`M${(x - 4).toFixed(2)} ${(y + 5).toFixed(2)} h4 v3 h-4 Z`} fill="#fff" opacity={0.45} />
          </g>
        );
      })}
      <Sparkle cx={18} cy={20} r={4.4} color={PAL.gold[0]} opacity={0.9} />
      <Sparkle cx={84} cy={26} r={3.4} color={PAL.cream[0]} opacity={0.8} />
    </Art>
  );
};

/** 반지 (legendary) — 벨벳 케이스 + 다이아 + 글로우. */
export const Ring: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "반지"}>
    <GroundShadow rx={28} ry={5.5} />
    {/* 열린 뚜껑 */}
    <g transform="rotate(-7 50 64)">
      <rect x={24} y={30} width={52} height={22} rx={4} fill={PAL.berry[2]} />
      <rect x={28} y={33} width={44} height={16} rx={3} fill={PAL.cream[0]} />
      <path d="M28 49 Q50 39 72 49 L72 33 L28 33 Z" fill={PAL.cream[1]} opacity={0.55} />
      <path d={heartPath(50, 41, 4.6)} fill={PAL.rose[1]} opacity={0.7} />
    </g>
    <Glow cx={50} cy={58} r={36} color={PAL.gold[0]} opacity={0.4} />
    {/* 케이스 본체 — 링보다 먼저(링이 케이스 위에 얹혀 보이게) */}
    <path d="M26 70 h48 a4 4 0 0 1 4 4 v10 a4 4 0 0 1 -4 4 h-48 a4 4 0 0 1 -4 -4 v-10 a4 4 0 0 1 4 -4 Z" fill={PAL.berry[1]} />
    <path d="M50 70 h24 a4 4 0 0 1 4 4 v10 a4 4 0 0 1 -4 4 h-24 Z" fill={PAL.berry[2]} opacity={0.45} />
    <ellipse cx={50} cy={71} rx={19} ry={5.4} fill={PAL.cream[0]} />
    <ellipse cx={45} cy={70} rx={9} ry={2.4} fill="#fff" opacity={0.6} />
    {/* 링 밴드 */}
    <ellipse cx={50} cy={60} rx={11} ry={11.5} fill="none" stroke={PAL.gold[1]} strokeWidth={3.8} />
    <path d="M39 60 a11 11.5 0 0 0 22 0" fill="none" stroke={PAL.gold[2]} strokeWidth={3.8} opacity={0.7} />
    <path d="M40.6 55 a11 11.5 0 0 1 6.4 -6.6" fill="none" stroke={PAL.gold[0]} strokeWidth={2.2} strokeLinecap="round" />
    {/* 쿠션 슬롯 — 밴드가 꽂힌 느낌 */}
    <ellipse cx={50} cy={71} rx={8} ry={2.4} fill={PAL.cream[0]} />
    <path d="M45 70.6 L55 70.6" stroke={PAL.berry[2]} strokeWidth={1.8} strokeLinecap="round" opacity={0.45} />
    {/* 다이아 */}
    <path d="M43 34 L57 34 L59.5 40 L40.5 40 Z" fill={PAL.white[0]} />
    <path d="M43 34 L40.5 40 L50 40 Z" fill={PAL.white[1]} />
    <path d="M57 34 L59.5 40 L50 40 Z" fill={PAL.gray[1]} />
    <path d="M40.5 40 L50 40 L50 50.5 Z" fill={PAL.sky[0]} />
    <path d="M50 40 L59.5 40 L50 50.5 Z" fill={PAL.violet[1]} />
    <path d="M44.6 35.4 L52 35.4" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.95} />
    <Sparkle cx={26} cy={26} r={6} color={PAL.cream[0]} />
    <Sparkle cx={76} cy={20} r={4.6} color={PAL.gold[0]} />
    <Sparkle cx={68} cy={44} r={3.4} color="#fff" opacity={0.85} />
  </Art>
);

/* ══════════════════ 🌌 celestial — 천상 (전부 하늘) ══════════════════ */

/** 달 (epic, 하늘) — 초승달 + 크레이터 + 별. */
export const Moon: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "달"}>
    <Glow cx={40} cy={46} r={42} color={PAL.gold[0]} opacity={0.34} />
    {/* 초승달 — 바깥 원(왼쪽 반) + 안쪽 호(왼쪽으로 부푼 절단면).
        ⚠ 안쪽 호의 ry 는 현(48)의 절반 이상이어야 함. 작으면 SVG 가 반지름을 키워
        정확한 반원이 되고 결과가 '보름달'로 뭉개진다(과거 회귀). */}
    <path d="M50 22 A24 24 0 1 0 50 70 A8 28 0 1 1 50 22 Z" fill={PAL.cream[1]} />
    <path d="M50 22 A24 24 0 1 0 50 70 A22 24 0 1 1 50 22 Z" fill={PAL.cream[0]} opacity={0.7} />
    {/* 안쪽 그늘/크레이터는 살짝 앰버로 — 밝은 배경에서 크림만 쓰면 형태가 안 보인다. */}
    <path d="M50 22 A14 28 0 1 0 50 70 A8 28 0 1 1 50 22 Z" fill={PAL.amber[2]} opacity={0.28} />
    <ellipse cx={35} cy={45} rx={4.2} ry={3.4} fill={PAL.amber[2]} opacity={0.3} />
    <ellipse cx={38} cy={57} rx={3} ry={2.5} fill={PAL.amber[2]} opacity={0.26} />
    <ellipse cx={37} cy={34} rx={2.4} ry={2} fill={PAL.amber[2]} opacity={0.24} />
    <ellipse cx={31} cy={53} rx={2} ry={1.7} fill={PAL.amber[2]} opacity={0.2} />
    <path d={starPath(78, 26, 7)} fill={PAL.gold[0]} />
    <path d={starPath(86, 52, 4.6)} fill={PAL.cream[0]} opacity={0.85} />
    <path d={starPath(24, 76, 5.4)} fill={PAL.gold[1]} opacity={0.8} />
    <Sparkle cx={66} cy={72} r={3.6} color={PAL.violet[0]} opacity={0.8} />
    <circle cx={70} cy={16} r={1.8} fill={PAL.cream[0]} opacity={0.8} />
  </Art>
);

/** 별 (rare, 하늘) — 큰 별 + 작은 별 무리. */
export const Stars: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "별"}>
    <Glow cx={46} cy={44} r={42} color={PAL.gold[0]} opacity={0.3} />
    {/* 큰 별 — 그림자층/본체/하이라이트층 */}
    <path d={starPath(48, 46, 25)} fill={PAL.gold[2]} opacity={0.85} />
    <path d={starPath(46, 44, 24)} fill={PAL.gold[1]} />
    <path d={starPath(44.5, 42, 15)} fill={PAL.gold[0]} opacity={0.7} />
    <circle cx={41} cy={38} r={3.2} fill="#fff" opacity={0.55} />
    {/* 작은 별들 */}
    <path d={starPath(76, 64, 13)} fill={PAL.amber[2]} opacity={0.8} />
    <path d={starPath(75, 63, 12)} fill={PAL.amber[1]} />
    <path d={starPath(74, 61.5, 7)} fill={PAL.amber[0]} opacity={0.65} />
    <path d={starPath(24, 74, 9)} fill={PAL.cream[2]} opacity={0.8} />
    <path d={starPath(23, 73, 8)} fill={PAL.cream[1]} />
    <path d={starPath(78, 22, 7)} fill={PAL.cream[0]} opacity={0.9} />
    <Sparkle cx={62} cy={20} r={4.4} color={PAL.violet[0]} opacity={0.85} />
    <Sparkle cx={16} cy={44} r={3.4} color={PAL.cream[0]} opacity={0.8} />
    <circle cx={88} cy={40} r={2} fill={PAL.gold[0]} opacity={0.8} />
    <circle cx={38} cy={82} r={1.8} fill={PAL.cream[0]} opacity={0.7} />
  </Art>
);

/** 혜성 (epic, 하늘) — 발광 핵 + 꼬리 3겹. */
export const Comet: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  const trail: [number, number, number][] = [
    [42, 58, 2.6],
    [34, 65, 2.1],
    [26, 72, 1.6],
    [19, 78, 1.2],
  ];
  return (
    <Art {...p} title={p.title ?? "혜성"}>
      <defs>
        {/* 꼬리 페이드 — 핵(우상단) 쪽이 진하고 끝(좌하단)으로 사라진다. */}
        <linearGradient id={`dc-comet-tail${_gid}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAL.violet[1]} stopOpacity={0.85} />
          <stop offset="0.55" stopColor={PAL.violet[0]} stopOpacity={0.45} />
          <stop offset="1" stopColor={PAL.violet[0]} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`dc-comet-core${_gid}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAL.cream[0]} stopOpacity={0.9} />
          <stop offset="1" stopColor={PAL.cream[0]} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* 코마(발광) — 핵(70,30) 기준이되 꼬리 쪽으로 살짝 치우친다.
          ⚠ Art 는 overflow:visible 이라 반경이 크면 이웃 타일로 새어나간다 → 100×100 안에 가둘 것. */}
      <Glow cx={68} cy={32} r={32} color={PAL.gold[0]} opacity={0.38} />
      {/* 꼬리 — 핵에서 넓게 시작해 끝점으로 수렴(막대 금지) */}
      <path d="M77 36 C60 50 30 72 10 88 C24 62 46 38 63 23 C70 25 75 29 77 36 Z" fill={`url(#dc-comet-tail${_gid})`} />
      <path d="M73 36 C58 47 34 66 20 78 C31 58 49 40 62 28 C67 30 71 32 73 36 Z" fill={`url(#dc-comet-core${_gid})`} />
      {/* 핵 */}
      <circle cx={70} cy={30} r={10.5} fill={PAL.gold[0]} opacity={0.5} />
      <circle cx={70} cy={30} r={7.4} fill={PAL.cream[0]} />
      <circle cx={68} cy={28} r={3} fill="#fff" />
      {/* 잔광 */}
      {trail.map(([tx, ty, tr]) => (
        <circle key={`${tx}-${ty}`} cx={tx} cy={ty} r={tr} fill={PAL.cream[0]} opacity={0.75} />
      ))}
      <Sparkle cx={86} cy={16} r={5.4} color={PAL.gold[0]} />
      <Sparkle cx={52} cy={20} r={3.6} color={PAL.violet[0]} opacity={0.85} />
      <path d={starPath(26, 30, 5)} fill={PAL.cream[0]} opacity={0.7} />
      <circle cx={90} cy={52} r={2} fill={PAL.violet[0]} opacity={0.8} />
    </Art>
  );
};

/** 행성 (legendary, 하늘) — 고리 + 위성 + 글로우. */
export const Planet: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "행성"}>
    <Glow cx={50} cy={48} r={46} color={PAL.violet[0]} opacity={0.34} />
    {/* 고리 뒤쪽 */}
    <g transform="rotate(-18 50 48)">
      <ellipse cx={50} cy={48} rx={40} ry={11} fill="none" stroke={PAL.gold[2]} strokeWidth={6} />
      <ellipse cx={50} cy={48} rx={40} ry={11} fill="none" stroke={PAL.gold[1]} strokeWidth={2} opacity={0.7} />
    </g>
    {/* 행성 */}
    <Body cx={50} cy={48} rx={23} ry={23} tone={PAL.violet} />
    <path d="M30 40 Q50 46 70 40" stroke={PAL.violet[2]} strokeWidth={4} fill="none" opacity={0.3} strokeLinecap="round" />
    <path d="M32 57 Q50 63 68 57" stroke={PAL.violet[2]} strokeWidth={5} fill="none" opacity={0.28} strokeLinecap="round" />
    <ellipse cx={41} cy={38} rx={7} ry={5} fill="#fff" opacity={0.28} transform="rotate(-24 41 38)" />
    <circle cx={60} cy={54} r={4} fill={PAL.night[0]} opacity={0.28} />
    {/* 고리 앞쪽 */}
    <g transform="rotate(-18 50 48)">
      <path d="M10 48 A40 11 0 0 0 90 48" fill="none" stroke={PAL.gold[1]} strokeWidth={6} strokeLinecap="round" />
      <path d="M10 48 A40 11 0 0 0 90 48" fill="none" stroke={PAL.gold[0]} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
    </g>
    {/* 위성 */}
    <circle cx={82} cy={22} r={6} fill={PAL.cream[1]} />
    <circle cx={80} cy={20} r={2} fill={PAL.cream[0]} />
    <path d="M76 22 a6 6 0 0 0 12 0 a6 6 0 0 0 -12 0" fill={PAL.cream[2]} opacity={0.45} />
    <Sparkle cx={20} cy={20} r={5.4} color={PAL.cream[0]} />
    <Sparkle cx={88} cy={70} r={4} color={PAL.violet[0]} opacity={0.85} />
    <path d={starPath(16, 74, 5)} fill={PAL.gold[0]} opacity={0.8} />
  </Art>
);

/* ══════════════════ 폴백 ══════════════════ */

/** 알 수 없는 키 폴백 — 이끼 낀 조약돌(빈 칸처럼 보이지 않게). */
const Pebble: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "장식"}>
    <GroundShadow rx={22} ry={5} />
    <ellipse cx={50} cy={74} rx={24} ry={18} fill={PAL.gray[1]} />
    <path d="M26 74 a24 18 0 0 0 48 0 a24 18 0 0 0 -48 0" fill={PAL.gray[2]} opacity={0.4} />
    <ellipse cx={42} cy={66} rx={10} ry={6} fill={PAL.gray[0]} opacity={0.7} />
    <path d="M32 84 q8 -6 18 -4" stroke={PAL.grass[1]} strokeWidth={3} fill="none" strokeLinecap="round" />
    <Leaf cx={60} cy={82} r={8} rot={-40} tone={1} />
  </Art>
);

/* ══════════════════ 레지스트리 ══════════════════ */

/** 데코 key → 아트 컴포넌트. key 는 src/lib/island.ts 의 DECORS 와 1:1. */
export const DECOR_ART: Record<string, ArtFC> = {
  // spring
  tulip: Tulip,
  rose: Rose,
  sunflower: Sunflower,
  blossom: Blossom,
  butterfly: Butterfly,
  // cozy
  sofa: Sofa,
  chair: Chair,
  candle: Candle,
  frame: Frame,
  books: Books,
  // beach
  umbrella: Umbrella,
  shell: Shell,
  crab: Crab,
  wave: Wave,
  // couple
  hearts: Hearts,
  cheers: Cheers,
  ferris: Ferris,
  ring: Ring,
  // celestial
  moon: Moon,
  stars: Stars,
  comet: Comet,
  planet: Planet,
};

/** key 로 데코 아트 얻기(없으면 조약돌 폴백). */
export function decorArt(key: string): ArtFC {
  return DECOR_ART[key] ?? Pebble;
}

/** 하늘에 뜨는 데코(그림자 없이 상단 배치) — 섬 씬이 배치 높이를 다르게 준다. */
export const SKY_DECOR: ReadonlySet<string> = new Set(["butterfly", "moon", "stars", "comet", "planet"]);
