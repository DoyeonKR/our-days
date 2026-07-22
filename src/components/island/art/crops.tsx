"use client";

/**
 * 우리 섬 — 작물 8종(성장 4단계) + 가공품 6종
 * ============================================================================
 * 계약은 전부 parts.tsx 를 따른다: viewBox 0~100, 지면 y=92, 중심 x=50,
 * 광원 좌상단, PAL 팔레트 외 색 금지, 랜덤 금지, 만화 외곽선(stroke 두르기) 금지.
 *
 * 구성 원칙
 *  - 흙 두둑(<SoilBed/>)은 작물 4단계 전부 공통 → 밭이 '같은 밭'으로 보인다.
 *  - 0 씨앗 / 1 새싹 은 팩토리(makeSeed·makeSprout)로 공유하고 작물 색 힌트만 주입.
 *  - 2 자라는 중 / 3 수확기 는 작물별 전용. 특히 3은 실루엣이 한눈에 구분되게
 *    (열매 모양·잎 형태·배치) 가장 공들인 단계.
 *  - 열매처럼 여러 번 쓰는 덩어리는 지역 좌표(0,0 중심) 컴포넌트로 만들고
 *    <g transform="translate() scale()"> 로 배치 → 작은 열매/큰 열매 재사용.
 *
 * 팔레트에 '진짜 빨강'이 없어 딸기/토마토/버섯은 berry·rose 계열을 공유한다.
 * 대신 실루엣(하트+씨앗 / 구+별꼭지 / 갓+대)과 보조 오버레이로 확실히 구분한다.
 */

import {
  Art,
  type ArtFC,
  PAL,
  INK_SOFT,
  GroundShadow,
  Leaf,
  Sparkle,
} from "./parts";

type Tone = readonly [string, string, string];

/** 작물 성장 단계 — 0 씨앗 / 1 새싹 / 2 자라는 중 / 3 수확기. */
export type CropStage = 0 | 1 | 2 | 3;

const STAGE_LABEL = ["씨앗", "새싹", "자라는 중", "수확기"] as const;

/* ══════════════════ 공통 파츠 ══════════════════ */

/**
 * 흙 두둑 — 작물 전 단계 공통 지면.
 * 좌측 밝은 면 / 우측 어두운 면 + 흙 알갱이로 평평한 색면이 되지 않게 한다.
 */
function SoilBed() {
  return (
    <>
      <GroundShadow cx={50} cy={93} rx={31} ry={5} opacity={0.2} />
      <path
        d="M 16 92 C 16 78 30 72.5 50 72.5 C 70 72.5 84 78 84 92 Z"
        fill={PAL.soil[1]}
      />
      <path
        d="M 18 92 C 18.5 80 31 75 50 74.4 C 36.5 78 28.5 84 27 92 Z"
        fill={PAL.soil[0]}
        opacity={0.5}
      />
      <path
        d="M 84 92 C 83.5 80.5 71.5 75 54 74.4 C 68 78 76 84 77 92 Z"
        fill={PAL.soil[2]}
        opacity={0.45}
      />
      <ellipse cx={50} cy={74.6} rx={16} ry={3.2} fill={PAL.soil[2]} opacity={0.26} />
      <circle cx={33} cy={85} r={1.5} fill={PAL.soil[2]} opacity={0.45} />
      <circle cx={63} cy={83.5} r={1.2} fill={PAL.soil[0]} opacity={0.55} />
      <circle cx={47} cy={88.5} r={1.7} fill={PAL.soil[2]} opacity={0.32} />
    </>
  );
}

/** 2톤 줄기 — 어두운 바탕 위에 밝은 선을 살짝 왼쪽으로 얹어 원통감을 준다. */
function Stalk({
  d,
  w = 3.2,
  tone = PAL.leaf,
}: {
  d: string;
  w?: number;
  tone?: Tone;
}) {
  return (
    <>
      <path d={d} stroke={tone[2]} strokeWidth={w} strokeLinecap="round" fill="none" />
      <path
        d={d}
        stroke={tone[1]}
        strokeWidth={w * 0.45}
        strokeLinecap="round"
        fill="none"
        transform="translate(-0.8 -0.5)"
      />
    </>
  );
}

/** 잎맥 — 잎 위에 얇게 얹어 '색면 한 장'을 면 분할로 바꾼다. */
function Vein({ d, opacity = 0.45 }: { d: string; opacity?: number }) {
  return (
    <path
      d={d}
      stroke={PAL.leaf[2]}
      strokeWidth={1}
      strokeLinecap="round"
      opacity={opacity}
      fill="none"
    />
  );
}

/* ══════════════════ 단계 0·1 (전 작물 공용 팩토리) ══════════════════ */

/** 0단계 — 갓 심은 씨앗. 흙 자리 + 씨앗 2톨 + 작물 색 촉. */
function makeSeed(name: string, accent: Tone): ArtFC {
  const Seed: ArtFC = (p) => (
    <Art {...p} title={p.title ?? `${name} ${STAGE_LABEL[0]}`}>
      <SoilBed />
      {/* 심은 자리(움푹) */}
      <ellipse cx={50} cy={74} rx={9.5} ry={3.4} fill={PAL.soil[2]} opacity={0.5} />
      {/* 씨앗 2톨 */}
      <g transform="rotate(-18 45 72.6)">
        <ellipse cx={45} cy={72.6} rx={3.6} ry={2.7} fill={PAL.brown[1]} />
        <ellipse cx={43.9} cy={71.7} rx={1.7} ry={1.1} fill={PAL.brown[0]} opacity={0.85} />
      </g>
      <g transform="rotate(15 56 73.4)">
        <ellipse cx={56} cy={73.4} rx={3} ry={2.3} fill={PAL.brown[2]} />
        <ellipse cx={55.1} cy={72.7} rx={1.3} ry={0.9} fill={PAL.brown[1]} opacity={0.8} />
      </g>
      {/* 갓 튼 촉 — 작물 색 힌트 */}
      <Stalk d="M 51 71.5 C 51 67 52.5 64.5 55 63.2" w={2.3} />
      <ellipse
        cx={55.8}
        cy={62.4}
        rx={2.8}
        ry={1.9}
        fill={accent[1]}
        transform="rotate(-34 55.8 62.4)"
      />
      <ellipse
        cx={55}
        cy={61.7}
        rx={1.2}
        ry={0.75}
        fill={accent[0]}
        opacity={0.9}
        transform="rotate(-34 55 61.7)"
      />
      <Sparkle cx={68} cy={65} r={3.4} color={PAL.white[0]} opacity={0.55} />
    </Art>
  );
  return Seed;
}

/** 1단계 — 떡잎 2장. 가운데 봉오리에만 작물 색을 살짝 준다. */
function makeSprout(name: string, accent: Tone): ArtFC {
  const Sprout: ArtFC = (p) => (
    <Art {...p} title={p.title ?? `${name} ${STAGE_LABEL[1]}`}>
      <SoilBed />
      <ellipse cx={50} cy={74.4} rx={8} ry={2.8} fill={PAL.soil[2]} opacity={0.4} />
      {/* 줄기 */}
      <Stalk d="M 50 76 C 49.3 68 49.6 63.5 50 59" w={3.2} />
      {/* 떡잎 2장(좌: 그늘 / 우: 광원) */}
      <Leaf cx={49} cy={60.5} r={10.5} rot={-158} tone={2} />
      <Leaf cx={51} cy={59.5} r={11.5} rot={-24} tone={1} />
      <Vein d="M 48 60 C 42.5 58.2 38.5 57.6 34.5 58.2" />
      <Vein d="M 52 59 C 58 56.6 62.5 56 67 57" opacity={0.35} />
      {/* 가운데 봉오리 — 작물 색 힌트 */}
      <ellipse cx={50.4} cy={55.6} rx={3.1} ry={3.6} fill={accent[1]} />
      <ellipse cx={49.3} cy={54.4} rx={1.3} ry={1.6} fill={accent[0]} opacity={0.9} />
      <path
        d="M 47.6 56.6 C 48.6 58.6 52.2 58.6 53.2 56.6"
        stroke={PAL.leaf[2]}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Sparkle cx={70} cy={50} r={3} color={PAL.white[0]} opacity={0.5} />
    </Art>
  );
  return Sprout;
}

/* ══════════════════ 반복 사용 덩어리 (지역 좌표 0,0 중심) ══════════════════ */

/** 딸기 열매 — 하트 어깨 + 뾰족한 끝 + 씨앗 + 꼭지. */
function StrawFruit({
  cx,
  cy,
  s = 1,
  tone = PAL.berry,
  seeds = true,
}: {
  cx: number;
  cy: number;
  s?: number;
  tone?: Tone;
  seeds?: boolean;
}) {
  const body =
    "M 0 -11 C -3.5 -15.5 -11 -15 -14 -10 C -17.5 -4.5 -15.5 2.5 -8 7 " +
    "C -4.5 9.2 -2 10.5 0 11.5 C 2 10.5 4.5 9.2 8 7 C 15.5 2.5 17.5 -4.5 14 -10 " +
    "C 11 -15 3.5 -15.5 0 -11 Z";
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d={body} fill={tone[1]} />
      {/* 우하단 그림자 */}
      <path
        d="M 3 -13 C 11 -15 17 -8 15 -2 C 13 5 6 9.5 0 11.5 C 5 6 9 -2 3 -13 Z"
        fill={tone[2]}
        opacity={0.5}
      />
      {/* 좌상단 하이라이트 */}
      <ellipse cx={-6.5} cy={-5} rx={4.6} ry={5.6} fill={tone[0]} opacity={0.65} transform="rotate(-18 -6.5 -5)" />
      <ellipse cx={-8} cy={-7.5} rx={1.9} ry={2.4} fill={PAL.white[0]} opacity={0.55} transform="rotate(-18 -8 -7.5)" />
      {seeds && (
        <>
          {[
            [-9, -3.5],
            [-3.5, -6.5],
            [3, -5.5],
            [8.5, -2],
            [-6, 2.5],
            [0.5, 1],
            [6, 3],
            [-1.5, 6.5],
          ].map(([x, y], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={1.15}
              ry={0.8}
              fill={PAL.gold[0]}
              opacity={0.9}
              transform={`rotate(${i % 2 ? 24 : -22} ${x} ${y})`}
            />
          ))}
        </>
      )}
      {/* 꼭지(5갈래) + 짧은 줄기 */}
      <path
        d="M 0 -12.5 C -4 -17 -10 -18 -12.5 -15 C -8 -14 -5 -12.5 -2 -10.5 Z"
        fill={PAL.leaf[2]}
      />
      <path
        d="M 0 -12.5 C 4 -17 10 -18 12.5 -15 C 8 -14 5 -12.5 2 -10.5 Z"
        fill={PAL.leaf[1]}
      />
      <path d="M -1.6 -13 C -3 -17.5 -1 -19.5 0.6 -20 C 1.2 -17 1 -14.5 1.6 -12.8 Z" fill={PAL.leaf[0]} />
      <path
        d="M 0 -13 C 0.4 -17 1.4 -19.5 3 -21.5"
        stroke={PAL.leaf[2]}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** 토마토 열매 — 매끈한 구 + 별 모양 꼭지. amber 를 얇게 덮어 따뜻한 붉은색으로. */
function TomatoFruit({
  cx,
  cy,
  s = 1,
  ripe = true,
}: {
  cx: number;
  cy: number;
  s?: number;
  ripe?: boolean;
}) {
  const tone: Tone = ripe ? PAL.berry : PAL.leaf;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={13} ry={11.8} fill={tone[1]} />
      {ripe && <ellipse cx={0} cy={0} rx={13} ry={11.8} fill={PAL.amber[2]} opacity={0.16} />}
      {/* 우하단 그림자 */}
      <path
        d="M -13 0 a 13 11.8 0 0 0 26 0 a 13 11.8 0 0 0 -26 0"
        fill={tone[2]}
        opacity={0.42}
      />
      {/* 좌상단 광원 */}
      <ellipse cx={-4.2} cy={-4.6} rx={6} ry={4.8} fill={tone[0]} opacity={0.6} />
      <ellipse cx={-5.6} cy={-6} rx={2.4} ry={1.7} fill={PAL.white[0]} opacity={0.7} transform="rotate(-24 -5.6 -6)" />
      {/* 세로 볼륨선 */}
      <path
        d="M 6.5 -9 C 9 -4 9 4 6 8.5"
        stroke={tone[2]}
        strokeWidth={1.1}
        opacity={0.35}
        fill="none"
      />
      {/* 별 꼭지 5갈래 */}
      <path d="M 0 -8 L -9.5 -13 L -2.5 -12.5 Z" fill={PAL.leaf[2]} />
      <path d="M 0 -8 L 9.5 -13 L 2.5 -12.5 Z" fill={PAL.leaf[1]} />
      <path d="M 0 -8 L -6 -16.5 L -0.8 -13 Z" fill={PAL.leaf[1]} />
      <path d="M 0 -8 L 6 -16.5 L 0.8 -13 Z" fill={PAL.leaf[0]} />
      <path d="M 0 -8 L 0 -17 L 2 -13 Z" fill={PAL.leaf[1]} />
      <path
        d="M 0 -11 L 0 -16.5"
        stroke={PAL.leaf[2]}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** 포도 알 하나 — 톤을 섞어 송이 안에서 앞뒤가 생기게. */
function GrapeBead({ cx, cy, r, t }: { cx: number; cy: number; r: number; t: 1 | 2 }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={PAL.violet[t]} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.34} r={r * 0.42} fill={PAL.violet[0]} opacity={0.6} />
      <circle cx={cx - r * 0.36} cy={cy - r * 0.42} r={r * 0.17} fill={PAL.white[0]} opacity={0.75} />
    </>
  );
}

/** 버섯 한 송이 — 갓(둥근 삼각 돔) + 물방울 무늬 + 통통한 대. */
function Shroom({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      {/* 대 */}
      <path
        d="M -6.5 -1 C -7.6 7 -7 13 -8.6 17.5 C -3 20 3 20 8.6 17.5 C 7 13 7.6 7 6.5 -1 Z"
        fill={PAL.cream[1]}
      />
      <path
        d="M 2 -1 C 3.4 7 3 13 4.6 17.9 C 6 18 7.4 17.8 8.6 17.5 C 7 13 7.6 7 6.5 -1 Z"
        fill={PAL.cream[2]}
        opacity={0.7}
      />
      <path d="M -5.4 1 C -6.2 7 -6 12 -7 16" stroke={PAL.white[0]} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} fill="none" />
      {/* 갓 아래 주름(턱받이) */}
      <path d="M -9 -1.5 C -4 2.5 4 2.5 9 -1.5 C 5 1.6 -5 1.6 -9 -1.5 Z" fill={PAL.cream[2]} />
      {/* 갓 */}
      <path
        d="M -18 -0.5 C -18 -13.5 -9.5 -21 0 -21 C 9.5 -21 18 -13.5 18 -0.5 C 11 3 -11 3 -18 -0.5 Z"
        fill={PAL.berry[1]}
      />
      <path
        d="M 4 -20.4 C 12 -18.5 18 -11 18 -0.5 C 13.5 1.7 5 2.6 -1 2.4 C 8 -2 11 -12 4 -20.4 Z"
        fill={PAL.berry[2]}
        opacity={0.5}
      />
      <path
        d="M -15.5 -3.5 C -15 -13 -8.5 -18.5 -1.5 -19 C -7 -16 -11.5 -10.5 -12.5 -2.5 Z"
        fill={PAL.peach[0]}
        opacity={0.55}
      />
      {/* 물방울 무늬 */}
      <ellipse cx={-7.5} cy={-11} rx={3.4} ry={2.8} fill={PAL.white[0]} opacity={0.9} />
      <ellipse cx={2.5} cy={-14.5} rx={2.6} ry={2.1} fill={PAL.white[0]} opacity={0.85} />
      <ellipse cx={9.5} cy={-7.5} rx={2.9} ry={2.3} fill={PAL.white[1]} opacity={0.8} />
      <ellipse cx={-13} cy={-4.5} rx={2.1} ry={1.6} fill={PAL.white[1]} opacity={0.7} />
      <ellipse cx={1} cy={-5} rx={2.3} ry={1.7} fill={PAL.white[1]} opacity={0.6} />
    </g>
  );
}

/** 풀 포기 — 버섯/양배추 밑동을 심심하지 않게. */
function GrassTuft({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d="M 0 0 C -1 -4 -3.5 -6.5 -6 -8 C -4 -4.5 -2.5 -2 -2 0 Z" fill={PAL.grass[2]} />
      <path d="M 0 0 C 0.4 -4.5 0.2 -7.5 -0.4 -10.5 C 2 -7 2.6 -3.5 2.2 0 Z" fill={PAL.grass[1]} />
      <path d="M 1.5 0 C 3 -3.5 5 -5.5 7.5 -7 C 5.5 -4 4.5 -2 4.2 0 Z" fill={PAL.grass[0]} />
    </g>
  );
}

/* ══════════════════ 1. 딸기 ══════════════════ */

const StrawberryGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `딸기 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    <Stalk d="M 50 76 C 48 68 47 63 46 58" />
    <Stalk d="M 52 76 C 56 70 60 66 64 63" w={2.6} />
    <Leaf cx={45} cy={59} r={12} rot={-162} tone={2} />
    <Leaf cx={47} cy={57} r={11} rot={-96} tone={1} />
    <Leaf cx={49} cy={59} r={12.5} rot={-30} tone={1} />
    <Vein d="M 44 58.5 C 38 56.5 33.5 56.2 29.5 57" />
    <Vein d="M 50 58 C 56 55.4 61 55 66 56" opacity={0.35} />
    {/* 흰 꽃 */}
    <g transform="translate(66 62)">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-4.6}
          rx={2.9}
          ry={3.6}
          fill={PAL.white[a % 144 === 0 ? 0 : 1]}
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx={0} cy={0} r={2.4} fill={PAL.gold[1]} />
      <circle cx={-0.8} cy={-0.8} r={1} fill={PAL.gold[0]} />
    </g>
    {/* 아직 안 익은 열매 */}
    <StrawFruit cx={40} cy={74} s={0.52} tone={PAL.leaf} seeds={false} />
    <Sparkle cx={30} cy={48} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const StrawberryRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `딸기 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <Stalk d="M 48 76 C 46 68 45 62 44 56" />
    <Stalk d="M 52 76 C 55 70 58 66 62 63" w={2.6} />
    <Leaf cx={42} cy={56} r={13} rot={-165} tone={2} />
    <Leaf cx={44} cy={53} r={12} rot={-100} tone={1} />
    <Leaf cx={47} cy={55} r={13} rot={-34} tone={1} />
    <Leaf cx={46} cy={62} r={9} rot={-140} tone={0} />
    <Vein d="M 41 55.5 C 35 53.5 30.5 53.2 26.5 54" />
    <Vein d="M 48 54 C 54 51.4 59 51 64 52" opacity={0.35} />
    {/* 흰 꽃 */}
    <g transform="translate(30 63)">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-3.9}
          rx={2.4}
          ry={3}
          fill={PAL.white[a % 144 === 0 ? 0 : 1]}
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx={0} cy={0} r={2} fill={PAL.gold[1]} />
    </g>
    {/* 큰 딸기 + 작은 딸기 */}
    <StrawFruit cx={57} cy={78} s={1.05} />
    <StrawFruit cx={36} cy={81} s={0.6} />
    <Sparkle cx={74} cy={58} r={4.6} color={PAL.white[0]} opacity={0.7} />
    <Sparkle cx={24} cy={70} r={2.6} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

/* ══════════════════ 2. 당근 ══════════════════ */

/**
 * 당근 잎 — 가는 잎자루 + 끝의 3갈래 잎뭉치.
 * 잎뭉치를 1장만 두면 성냥개비처럼 보여서 3갈래로 갈라 '깃털 잎' 느낌을 낸다.
 */
function CarrotFrond({ d, tip, tone = 1 }: { d: string; tip: [number, number]; tone?: 0 | 1 | 2 }) {
  const [tx, ty] = tip;
  return (
    <>
      <path d={d} stroke={PAL.leaf[2]} strokeWidth={2} strokeLinecap="round" fill="none" />
      <path d={d} stroke={PAL.leaf[tone]} strokeWidth={1} strokeLinecap="round" fill="none" transform="translate(-0.6 -0.4)" />
      <ellipse cx={tx - 3.4} cy={ty + 1.4} rx={3.4} ry={2.2} fill={PAL.leaf[2]} transform={`rotate(-52 ${tx - 3.4} ${ty + 1.4})`} />
      <ellipse cx={tx + 3.2} cy={ty + 1.2} rx={3.4} ry={2.2} fill={PAL.leaf[tone]} transform={`rotate(38 ${tx + 3.2} ${ty + 1.2})`} />
      <ellipse cx={tx} cy={ty - 2.4} rx={3.6} ry={2.4} fill={PAL.leaf[tone]} transform={`rotate(-78 ${tx} ${ty - 2.4})`} />
      <ellipse cx={tx - 0.9} cy={ty - 3.6} rx={1.5} ry={0.9} fill={PAL.leaf[0]} opacity={0.85} transform={`rotate(-78 ${tx - 0.9} ${ty - 3.6})`} />
    </>
  );
}

const CarrotGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `당근 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    {/* 잎(뿌리보다 먼저 = 뒤) */}
    <CarrotFrond d="M 47 71 C 44 65 41 61 37.5 57" tip={[36.5, 56]} tone={2} />
    <CarrotFrond d="M 49.5 70.5 C 49 64 49 59 49.5 54.5" tip={[49.5, 53.5]} tone={1} />
    <CarrotFrond d="M 52 71 C 55 65.5 58 62 61.5 58.5" tip={[62.5, 57.5]} tone={1} />
    <CarrotFrond d="M 51 71.5 C 53 67 55 64.5 57 62.5" tip={[57.5, 61.5]} tone={0} />
    {/* 흙 위로 올라온 어깨 */}
    <path d="M 41 72.5 C 42 69.5 46 68 50 68 C 54 68 58 69.5 59 72.5 C 57.5 77 54 81 50 83.5 C 46 81 42.5 77 41 72.5 Z" fill={PAL.fur[1]} />
    <path d="M 52 68.3 C 56 68.9 58.4 70.4 59 72.5 C 57.5 77 54 81 50 83.5 C 54.5 78.5 55.5 73.5 52 68.3 Z" fill={PAL.fur[2]} opacity={0.5} />
    <path d="M 44.5 71.5 C 45 75 46.5 78.5 48.5 81" stroke={PAL.fur[0]} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} fill="none" />
    <path d="M 42.5 71.5 C 46 69.4 54 69.4 57.5 71.5 C 54 73 46 73 42.5 71.5 Z" fill={PAL.fur[0]} opacity={0.5} />
    <Sparkle cx={72} cy={64} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const CarrotRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `당근 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    {/* 잎 다발(뿌리보다 먼저 그려 뒤로) */}
    <CarrotFrond d="M 46 68 C 41 62 37 57 32.5 52.5" tip={[31.5, 51.5]} tone={2} />
    <CarrotFrond d="M 48 67 C 45 60 44 54 44 48.5" tip={[43.5, 47.5]} tone={1} />
    <CarrotFrond d="M 51 67 C 51 60 52 54 54 49" tip={[54.5, 48]} tone={0} />
    <CarrotFrond d="M 53 68 C 57 62 61 57.5 65.5 53.5" tip={[66.5, 52.5]} tone={1} />
    <CarrotFrond d="M 52 69 C 55 65 57.5 62.5 59.5 61" tip={[60, 60]} tone={2} />
    {/* 뿌리 — 어깨는 살짝 볼록, 끝은 뾰족 */}
    <path
      d="M 38.6 69 C 39.6 65.4 44.8 63.6 50 63.6 C 55.2 63.6 60.4 65.4 61.4 69
         C 60.8 75.4 57 83.4 51.5 90.4 Q 50 92.3 48.5 90.4 C 43 83.4 39.2 75.4 38.6 69 Z"
      fill={PAL.fur[1]}
    />
    {/* 우하단 그림자 */}
    <path
      d="M 53 63.9 C 57.8 64.5 60.7 66.2 61.4 69 C 60.8 75.4 57 83.4 51.5 90.4 Q 50.9 91.2 50.3 91.1
         C 55 82 57.6 72.6 53 63.9 Z"
      fill={PAL.fur[2]}
      opacity={0.55}
    />
    {/* 좌상단 광원(가는 띠 — 넓게 덮으면 색이 바래 보인다) */}
    <path
      d="M 43.4 68 C 43.4 74.6 45.4 82 48.2 87.6"
      stroke={PAL.fur[0]}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.65}
      fill="none"
    />
    {/* 결(잔뿌리 자국) */}
    <path d="M 41.6 73.5 Q 50 76.6 58.4 73.5" stroke={PAL.fur[2]} strokeWidth={1.2} opacity={0.45} fill="none" />
    <path d="M 43.8 79 Q 50 81.6 56.2 79" stroke={PAL.fur[2]} strokeWidth={1.2} opacity={0.4} fill="none" />
    <path d="M 45.8 84.5 Q 50 86.4 54.2 84.5" stroke={PAL.fur[2]} strokeWidth={1} opacity={0.35} fill="none" />
    {/* 어깨 테 */}
    <path d="M 40.5 67.5 C 43.5 64.6 56.5 64.6 59.5 67.5 C 55 69.6 45 69.6 40.5 67.5 Z" fill={PAL.fur[0]} opacity={0.55} />
    <Sparkle cx={72} cy={72} r={4.2} color={PAL.white[0]} opacity={0.65} />
  </Art>
);

/* ══════════════════ 3. 토마토 ══════════════════ */

const TomatoGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `토마토 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    {/* 지지대 */}
    <path d="M 67 88 L 65 42" stroke={PAL.brown[2]} strokeWidth={3.2} strokeLinecap="round" fill="none" />
    <path d="M 66.2 86 L 64.4 44" stroke={PAL.brown[0]} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} fill="none" />
    <Stalk d="M 49 76 C 49 68 51 60 55 54" />
    <Leaf cx={48} cy={66} r={11} rot={-160} tone={2} />
    <Leaf cx={53} cy={60} r={10} rot={-32} tone={1} />
    <Leaf cx={50} cy={62} r={9} rot={-104} tone={1} />
    <Vein d="M 47 65.5 C 41.5 63.5 37.5 63 34 63.6" />
    <TomatoFruit cx={44} cy={76} s={0.62} ripe={false} />
    <TomatoFruit cx={58} cy={70} s={0.45} ripe={false} />
    <Sparkle cx={30} cy={54} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const TomatoRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `토마토 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <path d="M 72 89 L 70 34" stroke={PAL.brown[2]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
    <path d="M 71.2 87 L 69.4 36" stroke={PAL.brown[0]} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} fill="none" />
    <Stalk d="M 48 76 C 47 66 50 54 58 46" w={3.6} />
    <Stalk d="M 51 62 C 55 60 60 58 65 58" w={2.4} />
    <Leaf cx={45} cy={62} r={12.5} rot={-162} tone={2} />
    <Leaf cx={52} cy={50} r={11} rot={-38} tone={1} />
    <Leaf cx={50} cy={53} r={10} rot={-108} tone={0} />
    <Vein d="M 44 61.5 C 38 59.5 33.5 59 29.5 59.8" />
    <Vein d="M 53 49.5 C 58.5 46.8 63 46.2 67.5 47" opacity={0.35} />
    {/* 매달린 토마토 */}
    <TomatoFruit cx={57} cy={73} s={1.05} />
    <TomatoFruit cx={36} cy={76} s={0.62} />
    <Sparkle cx={76} cy={58} r={4.4} color={PAL.white[0]} opacity={0.68} />
    <Sparkle cx={26} cy={70} r={2.6} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

/* ══════════════════ 4. 옥수수 ══════════════════ */

/**
 * 이삭 알갱이 좌표(결정적) — 랜덤 금지 규칙 때문에 모듈 로드 시 1회 계산.
 * 행마다 반 칸씩 엇갈린 벽돌 쌓기 + 위아래 끝은 좁게 → '옥수수 알'로 읽힌다.
 * ⚠ 알을 바탕보다 밝게 칠하면 거품처럼 뭉개진다. 바탕(gold[2])을 어둡게 깔고
 *   그 위에 밝은 알을 얹어 알 사이 어두운 틈이 생기게 하는 게 핵심.
 */
const CORN_KERNELS: readonly (readonly [number, number])[] = (() => {
  const rows = [45.8, 50.2, 54.6, 59, 63.4, 67.8, 72.2, 76.6];
  const out: [number, number][] = [];
  rows.forEach((y, r) => {
    const edge = r === 0 || r === rows.length - 1;
    const xs = edge
      ? [53.2, 58.8]
      : r % 2 === 1
        ? [50.4, 56, 61.6]
        : [47.6, 53.2, 58.8, 64.4];
    xs.forEach((x) => out.push([x, y]));
  });
  return out;
})();

const CornGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `옥수수 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    <Stalk d="M 47 78 C 46.5 66 47 56 47.6 49" w={4.2} />
    {/* 넓은 칼잎 — 얇으면 잡초처럼 보인다. 잎맥은 두 가장자리의 중간선으로 계산해 잎 밖으로 새지 않게 */}
    <path d="M 46.5 66 C 37 63 28 56 21 46 C 24 59 32 69 45.5 72 Z" fill={PAL.leaf[2]} />
    <path d="M 48 56 C 58 53 66 47 72 38 C 71 50 63 59 48.5 61 Z" fill={PAL.leaf[1]} />
    <path d="M 47.5 48 C 40 45 34 39 30 31 C 31 41 37 48 47 51 Z" fill={PAL.leaf[0]} />
    <Vein d="M 46 69 C 34.5 66 26 57.5 21 46" opacity={0.4} />
    <Vein d="M 48.3 58.5 C 60.5 56 68.5 48.5 72 38" opacity={0.3} />
    <Vein d="M 47.3 49.5 C 38.5 46.5 32.5 40 30 31" opacity={0.35} />
    {/* 어린 이삭 — 줄기에 붙여 매달리게 */}
    <ellipse cx={55} cy={64} rx={6} ry={10} fill={PAL.leaf[1]} transform="rotate(12 55 64)" />
    <path d="M 56 54.5 C 59 61 59 69 56 74.5 C 60.4 70.5 61.4 60.5 58.4 54.8 Z" fill={PAL.leaf[2]} opacity={0.6} />
    <path d="M 53 57 C 51.6 63 51.8 69 53.4 73.6" stroke={PAL.leaf[0]} strokeWidth={1.6} strokeLinecap="round" opacity={0.65} fill="none" />
    <path d="M 57.4 56 C 56.6 62.5 56.8 68.5 58 73" stroke={PAL.leaf[2]} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} fill="none" />
    <path d="M 56 54.5 C 58 50 60 47.5 62.5 46" stroke={PAL.amber[1]} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    <Sparkle cx={30} cy={70} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const CornRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `옥수수 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <Stalk d="M 42 80 C 41 62 42 46 44 32" w={4.6} />
    {/* 칼잎 3장 — 잎맥은 두 가장자리의 중간선 */}
    <path d="M 42 68 C 31 65 20 57 12 44 C 15 59 24 70 40.5 74 Z" fill={PAL.leaf[2]} />
    <path d="M 42.5 54 C 32 51 23 43 17 31 C 18 45 26 55 41.5 59 Z" fill={PAL.leaf[1]} />
    <path d="M 44 42 C 52 39 59 33 64 24 C 63 36 56 43 44.5 45.5 Z" fill={PAL.leaf[0]} />
    <Vein d="M 41.3 71 C 27.5 67.5 17.5 58 12 44" opacity={0.4} />
    <Vein d="M 42 56.5 C 29 53 20.5 44 17 31" opacity={0.35} />
    <Vein d="M 44.3 43.8 C 54 41 61 34.5 64 24" opacity={0.3} />
    {/* 이삭 자루 — 줄기에서 뻗어 나온 게 보이게 */}
    <path d="M 43 64 C 47 68 50 72 51.5 76" stroke={PAL.leaf[2]} strokeWidth={3} strokeLinecap="round" fill="none" />
    {/* 뒤쪽 껍질 */}
    <path d="M 50 44 C 43.5 54 43 68 47 79 C 38.5 70 37.5 52 45 41 Z" fill={PAL.leaf[2]} />
    <path d="M 62 43 C 68.5 53 69 68 65 79 C 73.5 70 74.5 52 67 41 Z" fill={PAL.leaf[2]} />
    {/* 수염 */}
    <path d="M 54 42 C 51 37 50.5 32 53 28.5" stroke={PAL.amber[1]} strokeWidth={2} strokeLinecap="round" fill="none" />
    <path d="M 58 41.5 C 59.5 36 62 32 65 29.5" stroke={PAL.amber[0]} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    <path d="M 56 41.5 C 56 36.5 56.5 32.5 57.5 29.5" stroke={PAL.amber[2]} strokeWidth={1.5} strokeLinecap="round" opacity={0.85} fill="none" />
    {/* 이삭 — 어두운 바탕 위에 밝은 알을 얹어 알 사이 틈을 만든다 */}
    <path
      d="M 56 41 C 63 41 67 46.5 67 55 L 67 67 C 67 76 62.5 81 56 81
         C 49.5 81 45 76 45 67 L 45 55 C 45 46.5 49 41 56 41 Z"
      fill={PAL.gold[2]}
    />
    {CORN_KERNELS.map(([x, y], i) => (
      <ellipse
        key={i}
        cx={x}
        cy={y}
        rx={2.9}
        ry={2.3}
        fill={x < 56 && y < 62 ? PAL.gold[0] : PAL.gold[1]}
      />
    ))}
    {/* 이삭 우하단 그늘 / 좌상단 광원 */}
    <path
      d="M 62 42.5 C 66 46 67 50 67 55 L 67 67 C 67 76 62.5 81 56 81 C 60 77 62 70 62 60 C 62 52 62 46 62 42.5 Z"
      fill={PAL.amber[2]}
      opacity={0.35}
    />
    <path d="M 49.5 45 C 47.5 48 47 51.5 47 56 L 47 64 C 46 57 46 49 49.5 45 Z" fill={PAL.white[0]} opacity={0.35} />
    {/* 벗겨 내린 앞 껍질 */}
    <path d="M 49.5 60 C 45.5 69 45 78 47.5 84 C 41 78 40.5 66 46 57.5 Z" fill={PAL.leaf[1]} />
    <path d="M 48.6 62 C 45.6 69.5 45.4 77 47.4 82 C 43.6 76.5 43.8 67 47.4 60 Z" fill={PAL.leaf[0]} opacity={0.6} />
    <Sparkle cx={80} cy={44} r={4.4} color={PAL.white[0]} opacity={0.65} />
  </Art>
);

/* ══════════════════ 5. 호박 ══════════════════ */

/**
 * 호박잎 — 둥근 5갈래(부드러운 결각).
 * 결각을 깊고 뾰족하게 파면 호랑가시(크리스마스)처럼 보여서, 완만한 곡선 로브로 만든다.
 */
function PumpkinLeaf({ cx, cy, s = 1, flip = false, tone = 1 }: { cx: number; cy: number; s?: number; flip?: boolean; tone?: 0 | 1 | 2 }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip ? -s : s} ${s})`}>
      <path
        d="M 0 0 C -4 -3.5 -9.5 -4.5 -13 -8 C -16.5 -12 -14.5 -18 -9.5 -20.5
           C -6.5 -25 0 -27.5 3.5 -25.5 C 9 -26.5 14 -22.5 13.5 -17.5
           C 15.5 -12.5 12 -6.5 6 -4 C 3.5 -2.8 1.4 -1.4 0 0 Z"
        fill={PAL.leaf[tone]}
      />
      <path
        d="M 3.5 -25.5 C 9 -26.5 14 -22.5 13.5 -17.5 C 15.5 -12.5 12 -6.5 6 -4
           C 3.5 -2.8 1.4 -1.4 0 0 C 7 -7.5 8 -17.5 3.5 -25.5 Z"
        fill={PAL.leaf[2]}
        opacity={0.34}
      />
      <path d="M 0 -1.5 C 0.4 -9 1.4 -17 3 -24" stroke={PAL.leaf[2]} strokeWidth={1.1} opacity={0.45} fill="none" />
      <path d="M 0.6 -9 C -3 -11.5 -6.5 -13 -10.5 -13.5" stroke={PAL.leaf[2]} strokeWidth={0.9} opacity={0.38} fill="none" />
      <path d="M 1.6 -14 C 4.8 -16 8 -17.5 11.5 -18" stroke={PAL.leaf[2]} strokeWidth={0.9} opacity={0.38} fill="none" />
    </g>
  );
}

const PumpkinGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `호박 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    <Stalk d="M 44 78 C 48 72 54 68 62 66" w={3} />
    <PumpkinLeaf cx={38} cy={72} s={0.8} tone={1} />
    <PumpkinLeaf cx={66} cy={66} s={0.6} flip tone={2} />
    {/* 덩굴손 */}
    <path
      d="M 66 66 C 71 65 73 61 71 58.5 C 69.4 56.8 66.6 58 67.4 60.4"
      stroke={PAL.leaf[1]}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
    {/* 어린 호박 */}
    <ellipse cx={52} cy={80} rx={11} ry={9.5} fill={PAL.leaf[1]} />
    <path d="M 52 70.5 a 11 9.5 0 0 1 0 19 a 11 9.5 0 0 1 0 -19" fill={PAL.leaf[2]} opacity={0.3} />
    <ellipse cx={48} cy={76.5} rx={4} ry={3} fill={PAL.leaf[0]} opacity={0.6} />
    <path d="M 45 80 C 46 84 48 87 52 88.5" stroke={PAL.leaf[2]} strokeWidth={1.1} opacity={0.45} fill="none" />
    <path d="M 59 80 C 58 84 56 87 52 88.5" stroke={PAL.leaf[2]} strokeWidth={1.1} opacity={0.45} fill="none" />
    <path d="M 52 71 C 52 68 51 66 49.5 64.5" stroke={PAL.brown[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <Sparkle cx={30} cy={62} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const PumpkinRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `호박 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <Stalk d="M 26 84 C 30 76 36 71 44 68" w={3} />
    <PumpkinLeaf cx={26} cy={80} s={0.95} tone={1} />
    <PumpkinLeaf cx={76} cy={74} s={0.72} flip tone={2} />
    <path
      d="M 76 74 C 82 72.5 84 68 81.5 65 C 79.6 62.8 76.4 64.4 77.4 67.2"
      stroke={PAL.leaf[1]}
      strokeWidth={1.7}
      strokeLinecap="round"
      fill="none"
    />
    {/* 호박 — 뒤쪽 큰 결 → 앞쪽 순으로 겹쳐 골(ribs)을 만든다 */}
    <ellipse cx={38.5} cy={76} rx={11.5} ry={14.5} fill={PAL.amber[2]} />
    <ellipse cx={61.5} cy={76} rx={11.5} ry={14.5} fill={PAL.amber[2]} />
    <ellipse cx={43} cy={75.5} rx={12} ry={15.5} fill={PAL.amber[1]} />
    <ellipse cx={57} cy={75.5} rx={12} ry={15.5} fill={PAL.amber[1]} />
    <ellipse cx={50} cy={75} rx={13} ry={16} fill={PAL.amber[1]} />
    {/* 골 음영 */}
    <path d="M 43.4 60.5 C 40 66 39.6 84 43.4 89.6 C 40 86 39 64 43.4 60.5 Z" fill={PAL.amber[2]} opacity={0.55} />
    <path d="M 57 60.5 C 60.4 66 60.8 84 57 89.6 C 60.4 86 61.4 64 57 60.5 Z" fill={PAL.amber[2]} opacity={0.55} />
    <path d="M 63 62 C 68 68 68.5 84 63.5 89.5 C 70 86 71 66 63 62 Z" fill={PAL.amber[2]} opacity={0.4} />
    {/* 좌상단 광원 */}
    <ellipse cx={43} cy={68} rx={6.5} ry={7} fill={PAL.amber[0]} opacity={0.6} transform="rotate(-16 43 68)" />
    <ellipse cx={41} cy={66} rx={2.4} ry={3} fill={PAL.white[0]} opacity={0.5} transform="rotate(-16 41 66)" />
    {/* 꼭지 */}
    <path d="M 47.5 60.5 C 47 55 48 51.5 50.5 49.5 C 53 51 53.5 55 53 60 Z" fill={PAL.brown[1]} />
    <path d="M 50.6 49.6 C 53 51 53.5 55 53 60 L 50.4 60.2 C 51.6 55.5 51.6 52 50.6 49.6 Z" fill={PAL.brown[2]} opacity={0.7} />
    <path d="M 50.5 49.5 C 54 47.5 57 48 59 50" stroke={PAL.leaf[2]} strokeWidth={2} strokeLinecap="round" fill="none" />
    <Sparkle cx={72} cy={56} r={4.6} color={PAL.white[0]} opacity={0.65} />
  </Art>
);

/* ══════════════════ 6. 포도 ══════════════════ */

/** 포도잎 — 하트 밑동 + 완만한 3갈래 로브. */
function GrapeLeaf({ cx, cy, s = 1, flip = false, tone = 1 }: { cx: number; cy: number; s?: number; flip?: boolean; tone?: 0 | 1 | 2 }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip ? -s : s} ${s})`}>
      <path
        d="M 0 0 C -3.5 -4 -8.5 -6 -12 -8.5 C -16.5 -11.5 -16.5 -17 -12.5 -19.5
           C -11 -24 -5.5 -27 -1 -25.5 C 3 -28 9.5 -25.5 11 -21
           C 15 -18 15 -11.5 10 -8.5 C 6 -6 2.5 -3 0 0 Z"
        fill={PAL.leaf[tone]}
      />
      <path
        d="M -1 -25.5 C 3 -28 9.5 -25.5 11 -21 C 15 -18 15 -11.5 10 -8.5 C 6 -6 2.5 -3 0 0
           C 5 -8 4 -18.5 -1 -25.5 Z"
        fill={PAL.leaf[2]}
        opacity={0.32}
      />
      <path d="M 0 -1.5 C -0.4 -9 -0.6 -17 -1 -23.5" stroke={PAL.leaf[2]} strokeWidth={1} opacity={0.45} fill="none" />
      <path d="M -0.4 -8.5 C -4 -11 -7.5 -12.5 -11 -13.5" stroke={PAL.leaf[2]} strokeWidth={0.9} opacity={0.36} fill="none" />
      <path d="M -0.6 -13.5 C 2.8 -15.5 6 -17 9.5 -17.5" stroke={PAL.leaf[2]} strokeWidth={0.9} opacity={0.36} fill="none" />
    </g>
  );
}

const GrapeGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `포도 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    <Stalk d="M 46 78 C 45 68 47 58 52 51" w={3.4} />
    <GrapeLeaf cx={36} cy={68} s={0.85} tone={2} />
    <GrapeLeaf cx={64} cy={60} s={0.7} flip tone={1} />
    <path
      d="M 52 51 C 58 49 61 45 59 42 C 57.4 40 54.6 41.4 55.6 43.8"
      stroke={PAL.leaf[1]}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
    {/* 아직 초록인 송이 */}
    {(
      [
        [50, 62, 4.2, 1],
        [57, 63, 4.2, 2],
        [53.5, 69, 4, 1],
        [60, 70, 3.8, 2],
        [56, 75.5, 3.6, 1],
      ] as const
    ).map(([x, y, r], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={r} fill={PAL.leaf[i % 3 === 0 ? 1 : 2]} />
        <circle cx={x - r * 0.3} cy={y - r * 0.34} r={r * 0.4} fill={PAL.leaf[0]} opacity={0.55} />
      </g>
    ))}
    <Sparkle cx={30} cy={50} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const GrapeRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `포도 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <Stalk d="M 42 78 C 40 66 43 54 50 46" w={3.6} />
    <Stalk d="M 50 46 C 55 43 62 42 68 43" w={2.6} />
    <GrapeLeaf cx={30} cy={68} s={0.95} tone={2} />
    <GrapeLeaf cx={72} cy={50} s={0.8} flip tone={1} />
    <path
      d="M 66 44 C 72 42 74.5 37.5 72 34.5 C 70 32.2 66.8 33.8 67.8 36.6"
      stroke={PAL.leaf[1]}
      strokeWidth={1.7}
      strokeLinecap="round"
      fill="none"
    />
    <path d="M 56 45 C 56.5 49 56.5 52 56 55" stroke={PAL.leaf[2]} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    {/* 송이 — 위 4 / 3 / 3 / 2 / 1 */}
    {(
      [
        [46.5, 58, 5.2],
        [53.5, 56.5, 5.4],
        [60.5, 57.5, 5.2],
        [66.5, 60, 4.6],
        [49, 65.5, 5.4],
        [56, 64.5, 5.6],
        [63, 66, 5.2],
        [51.5, 73, 5.2],
        [58.5, 72.5, 5.4],
        [54.5, 80, 5],
        [60.5, 79, 4.4],
        [56.5, 86, 4.2],
      ] as const
    ).map(([x, y, r], i) => (
      <GrapeBead key={i} cx={x} cy={y} r={r} t={i % 3 === 1 ? 2 : 1} />
    ))}
    <Sparkle cx={78} cy={66} r={4.4} color={PAL.white[0]} opacity={0.62} />
    <Sparkle cx={34} cy={52} r={2.8} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

/* ══════════════════ 7. 양배추 ══════════════════ */

const CabbageGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `양배추 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    {/* 벌어진 겉잎 */}
    <path d="M 50 76 C 38 76 28 70 26 62 C 33 66 42 67 50 66 Z" fill={PAL.leaf[2]} />
    <path d="M 50 76 C 62 76 72 70 74 62 C 67 66 58 67 50 66 Z" fill={PAL.leaf[1]} />
    <path d="M 50 74 C 42 72 36 65 36 57 C 41 62 46 65 50 66 Z" fill={PAL.leaf[1]} />
    <path d="M 50 74 C 58 72 64 65 64 57 C 59 62 54 65 50 66 Z" fill={PAL.leaf[0]} />
    {/* 속 구 */}
    <ellipse cx={50} cy={68} rx={13} ry={11} fill={PAL.grass[1]} />
    <path d="M 50 57 a 13 11 0 0 1 0 22 a 13 11 0 0 1 0 -22" fill={PAL.grass[2]} opacity={0.32} />
    {/* 수확기와 같은 3겹 구성(축소) — 단계가 넘어가도 같은 양배추로 보이게 */}
    <path d="M 46.6 78.1 C 41.6 74.1 40.7 61.9 48.1 57.5 A 13 11 0 0 0 46.6 78.1 Z" fill={PAL.grass[0]} opacity={0.42} />
    <path d="M 53.7 78.4 C 58 74.1 59 62.5 52.5 57.4 A 13 11 0 0 1 53.7 78.4 Z" fill={PAL.grass[2]} opacity={0.3} />
    <path d="M 46.6 78.1 C 41.6 74.1 40.7 61.9 48.1 57.5" stroke={PAL.grass[2]} strokeWidth={1.4} strokeLinecap="round" opacity={0.5} fill="none" />
    <path d="M 53.7 78.4 C 58 74.1 59 62.5 52.5 57.4" stroke={PAL.grass[2]} strokeWidth={1.4} strokeLinecap="round" opacity={0.45} fill="none" />
    <path d="M 39.5 66.2 C 44.4 68 55.6 68 60.5 64.3" stroke={PAL.grass[2]} strokeWidth={1.1} strokeLinecap="round" opacity={0.32} fill="none" />
    <ellipse cx={45.5} cy={64} rx={5} ry={4} fill={PAL.grass[0]} opacity={0.6} />
    <GrassTuft cx={30} cy={88} s={0.9} />
    <Sparkle cx={72} cy={54} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const CabbageRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `양배추 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    {/* 겉잎(뒤 → 앞) */}
    <path d="M 50 82 C 32 82 18 74 15 62 C 25 69 38 72 50 71 Z" fill={PAL.leaf[2]} />
    <path d="M 50 82 C 68 82 82 74 85 62 C 75 69 62 72 50 71 Z" fill={PAL.leaf[1]} />
    <path d="M 50 80 C 36 78 26 68 25 55 C 33 64 42 70 50 71 Z" fill={PAL.leaf[1]} />
    <path d="M 50 80 C 64 78 74 68 75 55 C 67 64 58 70 50 71 Z" fill={PAL.leaf[0]} />
    {/* 잎맥은 겉잎(두 가장자리)의 중간선 — 속 구에 가려진 잎 위로 그으면
        구 옆 허공에 수염처럼 뜬다(구 반경 21 이 잎 밑동을 통째로 덮는다). */}
    <Vein d="M 46.4 76.5 C 34.1 76.1 23.1 71.6 16.7 64.2" opacity={0.4} />
    <Vein d="M 53.6 76.5 C 65.9 76.1 76.9 71.6 83.3 64.2" opacity={0.3} />
    {/* 속 구 */}
    <ellipse cx={50} cy={70} rx={21} ry={18} fill={PAL.grass[1]} />
    <path d="M 50 52 a 21 18 0 0 1 0 36 a 21 18 0 0 1 0 -36" fill={PAL.grass[2]} opacity={0.32} />
    {/* 겉을 감싼 잎 3겹 — 구를 세로로 갈라 '말린 잎'으로 읽히게 한다.
        ⚠ 결(seam)은 반드시 구 안쪽에서만. 밖으로 새면 허공에 선이 뜬다.
        ⚠ 폭 1.1 / opacity 0.3 대 결은 48px 렌더에서 사라져 민둥 구슬이 된다. */}
    <path d="M 44.5 86.5 C 36.5 80 35 60 47 52.8 A 21 18 0 0 0 44.5 86.5 Z" fill={PAL.grass[0]} opacity={0.42} />
    <path d="M 56 87 C 63 80 64.5 61 54 52.6 A 21 18 0 0 1 56 87 Z" fill={PAL.grass[2]} opacity={0.3} />
    <path d="M 44.5 86.5 C 36.5 80 35 60 47 52.8" stroke={PAL.grass[2]} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} fill="none" />
    <path d="M 56 87 C 63 80 64.5 61 54 52.6" stroke={PAL.grass[2]} strokeWidth={1.6} strokeLinecap="round" opacity={0.45} fill="none" />
    <path d="M 33 67 C 41 70 59 70 67 64" stroke={PAL.grass[2]} strokeWidth={1.3} strokeLinecap="round" opacity={0.35} fill="none" />
    {/* 가운데 말린 속잎 */}
    <path d="M 50 53.5 C 45.5 57 44.5 62 47 65.5 C 51.5 63 53.5 58 52.5 54.2 Z" fill={PAL.grass[0]} opacity={0.5} />
    <ellipse cx={43} cy={63} rx={8.5} ry={6.5} fill={PAL.grass[0]} opacity={0.6} transform="rotate(-18 43 63)" />
    <ellipse cx={41.5} cy={60.5} rx={3.2} ry={2.2} fill={PAL.white[0]} opacity={0.4} transform="rotate(-18 41.5 60.5)" />
    <GrassTuft cx={24} cy={89} s={1} />
    <GrassTuft cx={78} cy={89} s={0.8} />
    <Sparkle cx={76} cy={48} r={4.2} color={PAL.white[0]} opacity={0.6} />
  </Art>
);

/* ══════════════════ 8. 버섯 ══════════════════ */

const MushroomGrowing: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `버섯 ${STAGE_LABEL[2]}`}>
    <SoilBed />
    <GrassTuft cx={28} cy={87} s={0.9} />
    <GrassTuft cx={72} cy={86} s={0.8} />
    <Shroom cx={52} cy={73} s={0.6} />
    {/* 갓이 아직 안 벌어진 봉오리 */}
    <path d="M 33 82 C 33 76.5 35.5 73 39 73 C 42.5 73 45 76.5 45 82 C 41.5 84 36.5 84 33 82 Z" fill={PAL.berry[2]} />
    <path d="M 34.5 79.5 C 35 75.5 37 73.4 39.4 73.1 C 37 75 35.6 77.5 35.4 80.5 Z" fill={PAL.peach[0]} opacity={0.5} />
    <path d="M 35 82 C 35.4 86 35 88.5 34 90.5 C 37 91.6 41 91.6 44 90.5 C 43 88.5 42.6 86 43 82 Z" fill={PAL.cream[1]} />
    <ellipse cx={40} cy={77.5} rx={1.7} ry={1.3} fill={PAL.white[0]} opacity={0.8} />
    <Sparkle cx={64} cy={62} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

const MushroomRipe: ArtFC = (p) => (
  <Art {...p} title={p.title ?? `버섯 ${STAGE_LABEL[3]}`}>
    <SoilBed />
    <GrassTuft cx={22} cy={88} s={1} />
    <GrassTuft cx={80} cy={87} s={0.85} />
    {/* 뒤쪽 작은 버섯 → 앞쪽 큰 버섯 */}
    <Shroom cx={70} cy={76} s={0.55} />
    <Shroom cx={43} cy={70} s={1.05} />
    <Sparkle cx={64} cy={50} r={4.4} color={PAL.white[0]} opacity={0.65} />
    <Sparkle cx={24} cy={62} r={2.8} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

/* ══════════════════ 폴백(등록 안 된 key) ══════════════════ */

function makeBush(name: string, accent: Tone, ripe: boolean): ArtFC {
  const Bush: ArtFC = (p) => (
    <Art {...p} title={p.title ?? `${name} ${STAGE_LABEL[ripe ? 3 : 2]}`}>
      <SoilBed />
      <Stalk d="M 50 77 C 49 68 49.5 60 50 54" w={3.4} />
      <Leaf cx={48} cy={64} r={ripe ? 13 : 10} rot={-160} tone={2} />
      <Leaf cx={52} cy={62} r={ripe ? 13 : 10} rot={-26} tone={1} />
      <Leaf cx={49} cy={56} r={ripe ? 11 : 9} rot={-100} tone={0} />
      <Vein d="M 47 63.5 C 41 61.5 36.5 61 32.5 61.8" />
      {ripe ? (
        <>
          <circle cx={44} cy={74} r={6} fill={accent[1]} />
          <circle cx={42.2} cy={72} r={2.2} fill={accent[0]} opacity={0.8} />
          <circle cx={57} cy={72} r={5.2} fill={accent[1]} />
          <circle cx={55.5} cy={70.2} r={1.9} fill={accent[0]} opacity={0.8} />
          <circle cx={51} cy={80} r={4.4} fill={accent[2]} />
        </>
      ) : (
        <>
          <circle cx={53} cy={71} r={3.6} fill={PAL.leaf[1]} />
          <circle cx={52} cy={69.8} r={1.4} fill={PAL.leaf[0]} opacity={0.8} />
        </>
      )}
      <Sparkle cx={72} cy={58} r={3.2} color={PAL.white[0]} opacity={0.5} />
    </Art>
  );
  return Bush;
}

/* ══════════════════ 작물 레지스트리 ══════════════════ */

type CropSet = readonly [ArtFC, ArtFC, ArtFC, ArtFC];

/** key → [씨앗, 새싹, 자라는 중, 수확기]. island.ts 의 CROPS key 와 1:1. */
export const CROP_ART: Record<string, CropSet> = {
  strawberry: [makeSeed("딸기", PAL.rose), makeSprout("딸기", PAL.rose), StrawberryGrowing, StrawberryRipe],
  carrot: [makeSeed("당근", PAL.fur), makeSprout("당근", PAL.fur), CarrotGrowing, CarrotRipe],
  tomato: [makeSeed("토마토", PAL.berry), makeSprout("토마토", PAL.berry), TomatoGrowing, TomatoRipe],
  corn: [makeSeed("옥수수", PAL.gold), makeSprout("옥수수", PAL.gold), CornGrowing, CornRipe],
  pumpkin: [makeSeed("호박", PAL.amber), makeSprout("호박", PAL.amber), PumpkinGrowing, PumpkinRipe],
  grape: [makeSeed("포도", PAL.violet), makeSprout("포도", PAL.violet), GrapeGrowing, GrapeRipe],
  cabbage: [makeSeed("양배추", PAL.mint), makeSprout("양배추", PAL.mint), CabbageGrowing, CabbageRipe],
  mushroom: [makeSeed("버섯", PAL.peach), makeSprout("버섯", PAL.peach), MushroomGrowing, MushroomRipe],
};

const GENERIC_CROP: CropSet = [
  makeSeed("작물", PAL.grass),
  makeSprout("작물", PAL.grass),
  makeBush("작물", PAL.grass, false),
  makeBush("작물", PAL.grass, true),
];

/**
 * 작물 아트 조회 — 컴포넌트 identity 가 안정적이어야 리렌더가 튀지 않으므로
 * 모듈 로드 시 만들어 둔 레지스트리에서 꺼내 쓴다(호출마다 새로 만들지 않음).
 */
export function cropArt(key: string, stage: CropStage): ArtFC {
  return (CROP_ART[key] ?? GENERIC_CROP)[stage];
}

/* ══════════════════ 가공품 6종 ══════════════════ */

/** 유리 하이라이트 세로 줄 — 병/잔 공통. */
function GlassShine({ x, y, h, w = 3.4 }: { x: number; y: number; h: number; w?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={w / 2} fill={PAL.white[0]} opacity={0.5} />
      <rect x={x + w + 2} y={y + h * 0.15} width={w * 0.5} height={h * 0.5} rx={w / 4} fill={PAL.white[0]} opacity={0.3} />
    </>
  );
}

/** 잼 — 딸기잼 유리병. */
const Jam: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "잼"}>
    <GroundShadow cx={50} cy={92} rx={24} ry={4.6} opacity={0.22} />
    {/* 병 */}
    <rect x={30} y={51} width={40} height={40} rx={8} fill={PAL.white[1]} />
    <rect x={30} y={51} width={40} height={40} rx={8} fill={PAL.gray[2]} opacity={0.25} />
    {/* 잼 */}
    <path d="M 33.5 60 C 40 57.5 60 57.5 66.5 60 L 66.5 84 C 66.5 87 63 88 50 88 C 37 88 33.5 87 33.5 84 Z" fill={PAL.berry[1]} />
    <path d="M 58 58.5 C 63 59 66.5 59.6 66.5 60 L 66.5 84 C 66.5 87 63 88 50 88 C 60 86 63 74 58 58.5 Z" fill={PAL.berry[2]} opacity={0.45} />
    <path d="M 33.5 60 C 38 58.4 44 57.7 50 57.8 C 44 59.4 38.5 61.6 33.5 64 Z" fill={PAL.berry[0]} opacity={0.7} />
    {/* 과육 알갱이 */}
    <circle cx={41} cy={70} r={2.2} fill={PAL.berry[0]} opacity={0.65} />
    <circle cx={57} cy={77} r={1.8} fill={PAL.berry[0]} opacity={0.5} />
    <circle cx={47} cy={81} r={1.5} fill={PAL.rose[0]} opacity={0.55} />
    {/* 뚜껑 */}
    <rect x={27} y={40} width={46} height={12} rx={4} fill={PAL.amber[1]} />
    <rect x={27} y={40} width={46} height={5} rx={2.5} fill={PAL.amber[0]} opacity={0.85} />
    <rect x={27} y={48.5} width={46} height={3.5} rx={1.8} fill={PAL.amber[2]} opacity={0.7} />
    {/* 라벨 */}
    <rect x={37} y={68} width={26} height={15} rx={3} fill={PAL.cream[0]} />
    <path d="M 48 73 C 46.6 71.4 44.4 71.8 44.4 73.6 C 44.4 75.4 46.6 77 48 78 C 49.4 77 51.6 75.4 51.6 73.6 C 51.6 71.8 49.4 71.4 48 73 Z" fill={PAL.berry[1]} />
    <rect x={53} y={73} width={7.5} height={1.5} rx={0.75} fill={INK_SOFT} opacity={0.45} />
    <rect x={53} y={76.5} width={5.5} height={1.5} rx={0.75} fill={INK_SOFT} opacity={0.3} />
    <GlassShine x={34.5} y={57} h={26} />
  </Art>
);

/** 팝콘 — 줄무늬 컵에서 넘치는 팝콘. */
function Puff({ cx, cy, s = 1, t = 1 }: { cx: number; cy: number; s?: number; t?: 0 | 1 | 2 }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path
        d="M 0 -6.5 C 4.5 -10 10 -6.5 8.5 -2 C 12 0.5 10.5 6 6 7 C 4.5 10.5 -1.5 10.5 -3.5 7.5
           C -8 8 -10.5 3 -8 -0.5 C -10 -5 -5 -9.5 0 -6.5 Z"
        fill={PAL.cream[t]}
      />
      <path
        d="M 3 -8 C 8 -8.5 11 -4 8.5 -2 C 12 0.5 10.5 6 6 7 C 4.5 10.5 -1.5 10.5 -3.5 7.5 C 3 8 8 0 3 -8 Z"
        fill={PAL.cream[2]}
        opacity={0.45}
      />
      <ellipse cx={-3.5} cy={-3.5} rx={3} ry={2.4} fill={PAL.white[0]} opacity={0.6} transform="rotate(-24 -3.5 -3.5)" />
    </g>
  );
}

const Popcorn: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "팝콘"}>
    <GroundShadow cx={50} cy={92} rx={27} ry={4.8} opacity={0.22} />
    {/* 흘러넘친 팝콘(컵 뒤) */}
    <Puff cx={22} cy={85} s={0.72} t={1} />
    <Puff cx={79} cy={86} s={0.66} t={0} />
    {/* 컵 */}
    <path d="M 31 55 L 69 55 L 63.5 89 C 63.5 90.6 36.5 90.6 36.5 89 Z" fill={PAL.white[1]} />
    <path d="M 41 55 L 46 55 L 43.5 89.9 L 39.6 89.9 Z" fill={PAL.rose[1]} opacity={0.85} />
    <path d="M 52.5 55 L 57.5 55 L 57.8 89.9 L 53.9 89.9 Z" fill={PAL.rose[1]} opacity={0.85} />
    <path d="M 63 55 L 69 55 L 66.4 74 L 61.6 74 Z" fill={PAL.rose[2]} opacity={0.55} />
    <path d="M 62 55 L 69 55 L 63.5 89 C 63.5 89.9 60.5 90.3 57 90.5 C 60.5 85 62.5 70 62 55 Z" fill={PAL.gray[2]} opacity={0.28} />
    <rect x={29.5} y={51} width={41} height={6} rx={3} fill={PAL.white[0]} />
    <rect x={29.5} y={55.4} width={41} height={2.2} rx={1.1} fill={PAL.gray[2]} opacity={0.4} />
    {/* 팝콘 산 */}
    <Puff cx={35} cy={51} s={0.85} t={1} />
    <Puff cx={64} cy={50} s={0.9} t={2} />
    <Puff cx={44} cy={44} s={1} t={0} />
    <Puff cx={56} cy={42} s={1.05} t={1} />
    <Puff cx={50} cy={49} s={0.9} t={1} />
    <Puff cx={49} cy={33} s={0.8} t={0} />
    <Sparkle cx={72} cy={34} r={4} color={PAL.white[0]} opacity={0.6} />
  </Art>
);

/** 주스 — 포도주스 잔 + 빨대. */
const Juice: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "주스"}>
    <GroundShadow cx={50} cy={92} rx={23} ry={4.4} opacity={0.22} />
    {/* 빨대(잔 뒤에서 시작) */}
    <path d="M 45 60 L 62 26" stroke={PAL.rose[1]} strokeWidth={5} strokeLinecap="round" fill="none" />
    <path d="M 52 46 L 57 36" stroke={PAL.white[0]} strokeWidth={5} strokeLinecap="round" opacity={0.85} fill="none" />
    <path d="M 45 60 L 62 26" stroke={PAL.rose[2]} strokeWidth={1.4} strokeLinecap="round" opacity={0.4} fill="none" transform="translate(1.6 0.8)" />
    {/* 잔 */}
    <path d="M 34 45 L 66 45 L 61.5 87 C 61.5 90 38.5 90 38.5 87 Z" fill={PAL.white[1]} opacity={0.55} />
    {/* 주스 */}
    <path d="M 36.4 56 L 63.6 56 L 61.2 86.5 C 61.2 89 38.8 89 38.8 86.5 Z" fill={PAL.violet[1]} />
    <path d="M 57 56 L 63.6 56 L 61.2 86.5 C 61.2 88 57.6 88.6 54 88.8 C 58.5 80 59 68 57 56 Z" fill={PAL.violet[2]} opacity={0.45} />
    <ellipse cx={50} cy={56} rx={13.6} ry={2.8} fill={PAL.violet[0]} opacity={0.9} />
    {/* 얼음 */}
    <rect x={40} y={60} width={9} height={8} rx={2.2} fill={PAL.white[0]} opacity={0.42} transform="rotate(-16 44.5 64)" />
    <rect x={52} y={68} width={8} height={7} rx={2} fill={PAL.white[0]} opacity={0.34} transform="rotate(12 56 71.5)" />
    {/* 기포 */}
    <circle cx={44} cy={78} r={1.8} fill={PAL.white[0]} opacity={0.45} />
    <circle cx={49} cy={83} r={1.3} fill={PAL.white[0]} opacity={0.4} />
    <circle cx={55} cy={79} r={1.1} fill={PAL.white[0]} opacity={0.35} />
    {/* 잔 테두리 + 광택 */}
    <ellipse cx={50} cy={45} rx={16} ry={3.4} fill={PAL.white[0]} opacity={0.75} />
    <ellipse cx={50} cy={45} rx={13.4} ry={2.2} fill={PAL.violet[2]} opacity={0.2} />
    <GlassShine x={38} y={52} h={30} />
    <Sparkle cx={70} cy={40} r={4} color={PAL.white[0]} opacity={0.6} />
  </Art>
);

/** 피클 — 오이가 담긴 유리병. */
const Pickles: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "피클"}>
    <GroundShadow cx={50} cy={92} rx={23} ry={4.4} opacity={0.22} />
    {/* 병 */}
    <rect x={32} y={46} width={36} height={45} rx={8} fill={PAL.white[1]} />
    <rect x={32} y={46} width={36} height={45} rx={8} fill={PAL.gray[2]} opacity={0.22} />
    {/* 브라인 */}
    <path d="M 35 54 L 65 54 L 65 84 C 65 87.5 61.5 88.5 50 88.5 C 38.5 88.5 35 87.5 35 84 Z" fill={PAL.mint[1]} opacity={0.5} />
    {/* 오이 3개 */}
    <g transform="rotate(-7 42 71)">
      <rect x={37.5} y={57} width={9} height={28} rx={4.5} fill={PAL.leaf[1]} />
      <rect x={38.6} y={58.5} width={2.8} height={24} rx={1.4} fill={PAL.leaf[0]} opacity={0.7} />
      <rect x={44} y={60} width={2} height={22} rx={1} fill={PAL.leaf[2]} opacity={0.5} />
    </g>
    <g transform="rotate(4 50 72)">
      <rect x={45.5} y={59} width={9.5} height={29} rx={4.75} fill={PAL.grass[1]} />
      <rect x={46.7} y={60.5} width={3} height={25} rx={1.5} fill={PAL.grass[0]} opacity={0.7} />
      <rect x={52.4} y={62} width={2} height={23} rx={1} fill={PAL.grass[2]} opacity={0.45} />
    </g>
    <g transform="rotate(10 59 72)">
      <rect x={55} y={58} width={8.5} height={27} rx={4.25} fill={PAL.leaf[2]} />
      <rect x={56} y={59.5} width={2.6} height={23} rx={1.3} fill={PAL.leaf[1]} opacity={0.75} />
    </g>
    {/* 향신료 */}
    <circle cx={39} cy={86} r={1.5} fill={PAL.brown[2]} opacity={0.7} />
    <circle cx={61} cy={85} r={1.3} fill={PAL.brown[1]} opacity={0.6} />
    <path d="M 57 66 C 60 63 62 61.5 64 61" stroke={PAL.leaf[0]} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} fill="none" />
    <path d="M 38 63 C 40 60.5 41.5 59.5 43 59" stroke={PAL.leaf[0]} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} fill="none" />
    {/* 뚜껑 */}
    <rect x={29} y={34} width={42} height={13} rx={4} fill={PAL.mint[2]} />
    <rect x={29} y={34} width={42} height={5.5} rx={2.7} fill={PAL.mint[1]} opacity={0.9} />
    <rect x={29} y={43} width={42} height={4} rx={2} fill={PAL.charcoal[0]} opacity={0.25} />
    <GlassShine x={35.5} y={52} h={30} />
  </Art>
);

/**
 * 파이 가장자리 주름 좌표 — 테두리 타원을 따라 한 바퀴.
 * 앞쪽 한 줄로만 늘어놓으면 '구슬 목걸이'로 보인다. 링을 따라 돌아야 파이 테두리로 읽힘.
 * (Math 는 모듈 로드 시 1회 — 렌더 중 랜덤/부수효과 없음.)
 */
const PIE_CRIMP = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + 0.2;
  return { x: 50 + 34 * Math.cos(a), y: 69 + 10 * Math.sin(a), front: Math.sin(a) > 0 };
});

/** 파이 — 크림프 테두리 + 드러난 호박 필링. */
const Pie: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "파이"}>
    <GroundShadow cx={50} cy={92} rx={34} ry={5} opacity={0.22} />
    {/* 접시 */}
    <ellipse cx={50} cy={86} rx={41} ry={7.5} fill={PAL.gray[2]} />
    <ellipse cx={50} cy={84.4} rx={41} ry={7.5} fill={PAL.gray[0]} />
    <ellipse cx={50} cy={83.4} rx={33} ry={5.6} fill={PAL.gray[1]} opacity={0.5} />
    {/* 뒤쪽 주름(테두리 안쪽 = 어둡게) */}
    {PIE_CRIMP.filter((c) => !c.front).map((c) => (
      <ellipse key={`b${c.x.toFixed(1)}`} cx={c.x} cy={c.y} rx={5.4} ry={4.6} fill={PAL.cream[2]} />
    ))}
    {/* 필링(호박) */}
    <ellipse cx={50} cy={69} rx={29} ry={8.6} fill={PAL.amber[2]} />
    <ellipse cx={50} cy={68} rx={27.5} ry={7.8} fill={PAL.amber[1]} />
    <ellipse cx={41} cy={65.8} rx={11} ry={3} fill={PAL.amber[0]} opacity={0.55} transform="rotate(-5 41 65.8)" />
    <path d="M 30 70.5 C 37 73.4 63 73.4 70 70.5 C 63 74.4 37 74.4 30 70.5 Z" fill={PAL.brown[2]} opacity={0.26} />
    {/* 파이 벽(앞면) */}
    <path
      d="M 16 69 C 16 79.5 30 85.5 50 85.5 C 70 85.5 84 79.5 84 69
         C 84 75.5 69 79.5 50 79.5 C 31 79.5 16 75.5 16 69 Z"
      fill={PAL.cream[1]}
    />
    <path d="M 63 78.6 C 76 76.8 84 72.8 84 69 C 84 79.5 70 85.5 50 85.5 C 45.4 85.5 41 85.2 37 84.6 C 52.5 84 61 80.8 63 78.6 Z" fill={PAL.cream[2]} opacity={0.75} />
    <path d="M 19 71.5 C 20 76.5 25.5 80.5 33 82.6 C 24.5 81.6 18.4 77.4 17.6 72 Z" fill={PAL.white[0]} opacity={0.4} />
    {/* 앞쪽 주름(밝은 봉우리) */}
    {PIE_CRIMP.filter((c) => c.front).map((c) => (
      <g key={`f${c.x.toFixed(1)}`}>
        <ellipse cx={c.x} cy={c.y + 1} rx={5.4} ry={4.6} fill={PAL.cream[2]} />
        <ellipse cx={c.x} cy={c.y} rx={5} ry={4.2} fill={c.x < 50 ? PAL.cream[0] : PAL.cream[1]} />
        <ellipse cx={c.x - 1.4} cy={c.y - 1.3} rx={1.8} ry={1.2} fill={PAL.white[0]} opacity={0.4} />
      </g>
    ))}
    <Sparkle cx={76} cy={52} r={4.4} color={PAL.white[0]} opacity={0.6} />
    <Sparkle cx={26} cy={48} r={3} color={PAL.white[0]} opacity={0.45} />
  </Art>
);

/** 와인 — 병 + 채워진 잔. */
const Wine: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "와인"}>
    <GroundShadow cx={50} cy={92} rx={32} ry={5} opacity={0.22} />
    {/* ── 병 ── */}
    <path
      d="M 24 66 C 24 57 32 54 32 46 L 32 30 L 42 30 L 42 46 C 42 54 50 57 50 66 L 50 86
         C 50 89.5 47 91 37 91 C 27 91 24 89.5 24 86 Z"
      fill={PAL.night[1]}
    />
    <path
      d="M 42 30 L 42 46 C 42 54 50 57 50 66 L 50 86 C 50 89.5 47 91 37 91 C 44 89 45.5 86 45.5 78
         C 45.5 68 44 58 38.5 52 C 38.5 44 38.5 36 38.5 30 Z"
      fill={PAL.night[2]}
      opacity={0.75}
    />
    <path d="M 27 68 C 27 60 34 56 34.5 47 L 34.5 33" stroke={PAL.white[0]} strokeWidth={2.4} strokeLinecap="round" opacity={0.3} fill="none" />
    {/* 캡슐 + 코르크 */}
    <rect x={30.5} y={24} width={13} height={9} rx={2.5} fill={PAL.violet[2]} />
    <rect x={30.5} y={24} width={13} height={3.6} rx={1.8} fill={PAL.violet[1]} opacity={0.9} />
    {/* 라벨 */}
    <rect x={23.5} y={68} width={27} height={16} rx={2.5} fill={PAL.cream[0]} />
    <rect x={23.5} y={68} width={27} height={3.6} fill={PAL.violet[1]} opacity={0.85} />
    <circle cx={31} cy={77} r={3.4} fill={PAL.violet[1]} opacity={0.55} />
    <rect x={36.5} y={75} width={11} height={1.6} rx={0.8} fill={INK_SOFT} opacity={0.45} />
    <rect x={36.5} y={79} width={8} height={1.6} rx={0.8} fill={INK_SOFT} opacity={0.3} />
    {/* ── 잔 ── */}
    <path d="M 58 50 C 58 66 63 74 70 74 C 77 74 82 66 82 50 Z" fill={PAL.white[1]} opacity={0.5} />
    <path d="M 59.6 56 C 60.6 68 64.6 72.6 70 72.6 C 75.4 72.6 79.4 68 80.4 56 Z" fill={PAL.violet[1]} />
    <path d="M 75 56 C 74.6 66 72.6 71.5 69 72.5 C 74 72.4 77.6 68 78.8 56 Z" fill={PAL.violet[2]} opacity={0.6} />
    <ellipse cx={70} cy={56} rx={10.4} ry={2.2} fill={PAL.violet[0]} opacity={0.9} />
    <path d="M 62 58 C 62.6 65 64.4 69.5 67 71.5" stroke={PAL.white[0]} strokeWidth={2} strokeLinecap="round" opacity={0.4} fill="none" />
    <rect x={68.8} y={73} width={2.6} height={13} rx={1.3} fill={PAL.white[1]} opacity={0.7} />
    <ellipse cx={70} cy={87.5} rx={10} ry={2.8} fill={PAL.white[1]} opacity={0.75} />
    <ellipse cx={70} cy={86.6} rx={10} ry={2.4} fill={PAL.white[0]} opacity={0.5} />
    <ellipse cx={70} cy={50} rx={12} ry={2.6} fill={PAL.white[0]} opacity={0.55} />
    <Sparkle cx={62} cy={38} r={4} color={PAL.white[0]} opacity={0.6} />
  </Art>
);

/** 폴백 — 등록 안 된 가공품 key 용 나무 상자. */
const Crate: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "가공품"}>
    <GroundShadow cx={50} cy={92} rx={28} ry={5} opacity={0.22} />
    <rect x={22} y={56} width={56} height={35} rx={4} fill={PAL.brown[1]} />
    <rect x={22} y={56} width={56} height={7} rx={3} fill={PAL.brown[0]} />
    <rect x={22} y={83} width={56} height={8} rx={3} fill={PAL.brown[2]} opacity={0.8} />
    <path d="M 62 56 L 78 56 L 78 91 L 62 91 Z" fill={PAL.brown[2]} opacity={0.4} />
    <path d="M 24 63 L 76 84" stroke={PAL.brown[2]} strokeWidth={2.4} opacity={0.5} fill="none" />
    <path d="M 76 63 L 24 84" stroke={PAL.brown[2]} strokeWidth={2.4} opacity={0.5} fill="none" />
    <rect x={26} y={59} width={3} height={29} rx={1.5} fill={PAL.brown[0]} opacity={0.6} />
    <Sparkle cx={72} cy={48} r={3.4} color={PAL.white[0]} opacity={0.5} />
  </Art>
);

/** key → 가공품 아트. island.ts 의 PRODUCTS key 와 1:1. */
export const PRODUCT_ART: Record<string, ArtFC> = {
  jam: Jam,
  popcorn: Popcorn,
  juice: Juice,
  pickles: Pickles,
  pie: Pie,
  wine: Wine,
};

/** 가공품 아트 조회 — 미등록 key 는 나무 상자로 폴백. */
export function productArt(key: string): ArtFC {
  return PRODUCT_ART[key] ?? Crate;
}
