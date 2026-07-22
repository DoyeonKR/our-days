"use client";

/**
 * 우리 섬 — 아트 파운데이션 (모든 SVG 아트의 단일 기준)
 * ============================================================================
 * 왜 있나: 펫 23 / 작물 8×4단계 / 가공품 6 / 데코 22 = 60+ 컴포넌트가 제각각이면
 * "이모지 모음"과 다를 바 없다. 팔레트·비율·조명·그림자를 여기서 하나로 고정해
 * 전부 '같은 게임의 아트'로 보이게 만든다.
 *
 * ── 스타일 계약(전 아트 공통, 반드시 지킬 것) ──────────────────────────────
 * 1) viewBox 는 항상 "0 0 100 100". 크기는 렌더 측에서 width/height 로만 조절.
 * 2) 지면(발이 닿는 선) = y 92. 캐릭터/사물은 x 50 중심. 그래야 섬 씬에 얹었을 때
 *    발밑 그림자와 정렬이 맞는다. 하늘에 뜨는 것(나비/달/별)만 예외.
 * 3) 광원은 **좌상단**. 밝은 면은 왼쪽 위, 그림자는 오른쪽 아래. 전 아트 동일.
 * 4) 외곽선은 stroke 대신 **어두운 같은 계열 색의 바탕 도형**으로 처리하거나,
 *    쓰더라도 색상은 해당 면 색의 어두운 버전(검정 금지 — 싸구려로 보임).
 * 5) 캐릭터는 둥근 실루엣(귀여움) + 2톤 셰이딩 + 하이라이트 1점.
 * 6) 채도 높은 원색 금지. 아래 PAL 팔레트에서만 고른다(테마 일관성).
 * 7) **랜덤 금지**(react purity 규칙): 흔들림/반짝임은 CSS 애니메이션으로.
 * 8) 라이트/다크 양쪽에서 보이게 — 아주 밝은 크림/아주 어두운 먹색 단독 사용 금지.
 *
 * 사용법:
 *   export const Foo: ArtFC = (p) => <Art {...p}>{…도형…}</Art>;
 */

import type { CSSProperties, ReactNode } from "react";

/** 모든 아트 컴포넌트의 공통 props. */
export type ArtProps = {
  size?: number; // px (기본 48)
  className?: string;
  style?: CSSProperties;
  title?: string; // 접근성 라벨(없으면 장식용 aria-hidden)
};
export type ArtFC = (p: ArtProps) => ReactNode;

/** 지면 기준선 — 캐릭터 발끝이 닿는 y. 섬 씬 배치와 정렬된다. */
export const GROUND_Y = 92;

/**
 * 공용 팔레트 — 여기 없는 색은 쓰지 않는다.
 * 각 계열 [밝은면, 기본, 어두운면] 3톤 = 하이라이트/바탕/그림자.
 */
export const PAL = {
  // 자연
  grass: ["#8ee36b", "#5cc447", "#3d9433"],
  leaf: ["#7fd96a", "#4fb84a", "#2f7f36"],
  soil: ["#a9744a", "#8a5a37", "#633f26"],
  sand: ["#f7e2b0", "#eccf8e", "#cfae6a"],
  water: ["#7fd8f0", "#46b6dd", "#2b87b3"],
  sky: ["#cdefff", "#9bdcf7", "#6bc2e8"],
  // 캐릭터 기본 털/피부
  cream: ["#fff3d9", "#ffe1ad", "#e8bd7e"],
  peach: ["#ffd9c2", "#ffb894", "#e08a63"],
  fur: ["#ffcf9a", "#f0a862", "#c47c3c"], // 여우 계열
  gray: ["#e6e9f2", "#c3c9da", "#949cb3"],
  charcoal: ["#5a6072", "#414657", "#2b2f3d"],
  white: ["#ffffff", "#f2f4fb", "#d5daea"],
  brown: ["#c99a6e", "#a3764f", "#775435"],
  // 포인트
  rose: ["#ffb3cd", "#ff7fae", "#e05287"],
  gold: ["#ffe08a", "#ffc93f", "#e0a02e"],
  amber: ["#ffdf9a", "#ffc247", "#dd9a1c"],
  violet: ["#d9c2ff", "#b18cf5", "#8259cf"],
  mint: ["#b6f5df", "#6fe0bf", "#3bb191"],
  berry: ["#ff9db3", "#f4607f", "#c33a5c"],
  night: ["#3d3a68", "#2a2749", "#1a1830"],
} as const;

/** 눈동자/입 등 공통 먹선 — 순수 검정 대신 살짝 보라 섞인 먹색. */
export const INK = "#3a3450";
export const INK_SOFT = "#5b5473";

/**
 * 아트 컨테이너 — viewBox·접근성·크기를 통일한다.
 * children 은 100×100 좌표계로 그린 도형.
 */
export function Art({
  size = 48,
  className,
  style,
  title,
  children,
}: ArtProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {children}
    </svg>
  );
}

/* ══════════════════ 재사용 파츠 ══════════════════ */

/** 발밑 타원 그림자 — 캐릭터/사물이 '떠 있지 않게' 만드는 핵심 1요소. */
export function GroundShadow({
  cx = 50,
  cy = GROUND_Y + 2,
  rx = 26,
  ry = 6,
  opacity = 0.22,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  opacity?: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} opacity={opacity} />;
}

/**
 * 눈 한 쌍 — 전 캐릭터 공통(같은 눈 = 같은 종족감).
 * variant: round(기본) / happy(^^) / sleepy(－) / sparkle(반짝)
 */
export function Eyes({
  cx = 50,
  y = 52,
  gap = 13,
  r = 4.6,
  variant = "round",
  color = INK,
}: {
  cx?: number;
  y?: number;
  gap?: number;
  r?: number;
  variant?: "round" | "happy" | "sleepy" | "sparkle";
  color?: string;
}) {
  const xs = [cx - gap, cx + gap];
  if (variant === "happy") {
    return (
      <>
        {xs.map((x, i) => (
          <path
            key={i}
            d={`M ${x - r} ${y + r * 0.4} Q ${x} ${y - r * 0.9} ${x + r} ${y + r * 0.4}`}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </>
    );
  }
  if (variant === "sleepy") {
    return (
      <>
        {xs.map((x, i) => (
          <path
            key={i}
            d={`M ${x - r} ${y} Q ${x} ${y + r * 0.8} ${x + r} ${y}`}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </>
    );
  }
  return (
    <>
      {xs.map((x, i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 1.08} fill={color} />
          {/* 하이라이트(좌상단 광원) */}
          <circle cx={x - r * 0.34} cy={y - r * 0.42} r={r * 0.34} fill="#fff" opacity={0.95} />
          {variant === "sparkle" && (
            <circle cx={x + r * 0.36} cy={y + r * 0.3} r={r * 0.18} fill="#fff" opacity={0.75} />
          )}
        </g>
      ))}
    </>
  );
}

/** 볼터치 — 귀여움 담당. */
export function Blush({
  cx = 50,
  y = 60,
  gap = 22,
  rx = 5,
  ry = 3.2,
  color = PAL.rose[1],
  opacity = 0.5,
}: {
  cx?: number;
  y?: number;
  gap?: number;
  rx?: number;
  ry?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <>
      <ellipse cx={cx - gap} cy={y} rx={rx} ry={ry} fill={color} opacity={opacity} />
      <ellipse cx={cx + gap} cy={y} rx={rx} ry={ry} fill={color} opacity={opacity} />
    </>
  );
}

/** 작은 입 — 기본 미소. */
export function Smile({
  cx = 50,
  y = 62,
  w = 7,
  color = INK,
}: {
  cx?: number;
  y?: number;
  w?: number;
  color?: string;
}) {
  return (
    <path
      d={`M ${cx - w} ${y} Q ${cx} ${y + w * 0.75} ${cx + w} ${y}`}
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** 4갈래 반짝임(별) — 레전드/진화 연출용. */
export function Sparkle({
  cx,
  cy,
  r = 6,
  color = "#fff8c9",
  opacity = 0.95,
}: {
  cx: number;
  cy: number;
  r?: number;
  color?: string;
  opacity?: number;
}) {
  const d = `M ${cx} ${cy - r} Q ${cx + r * 0.22} ${cy - r * 0.22} ${cx + r} ${cy}
             Q ${cx + r * 0.22} ${cy + r * 0.22} ${cx} ${cy + r}
             Q ${cx - r * 0.22} ${cy + r * 0.22} ${cx - r} ${cy}
             Q ${cx - r * 0.22} ${cy - r * 0.22} ${cx} ${cy - r} Z`;
  return <path d={d} fill={color} opacity={opacity} />;
}

/** 잎사귀 — 작물/식물 데코 공용. */
export function Leaf({
  cx,
  cy,
  r = 10,
  rot = 0,
  tone = 1,
}: {
  cx: number;
  cy: number;
  r?: number;
  rot?: number;
  tone?: 0 | 1 | 2;
}) {
  return (
    <path
      d={`M ${cx} ${cy} Q ${cx + r * 0.9} ${cy - r * 0.9} ${cx + r * 1.7} ${cy - r * 0.1}
          Q ${cx + r * 0.8} ${cy + r * 0.6} ${cx} ${cy} Z`}
      fill={PAL.leaf[tone]}
      transform={`rotate(${rot} ${cx} ${cy})`}
    />
  );
}

/**
 * 둥근 몸통 — 대부분의 캐릭터가 공유하는 기본 실루엣.
 * 좌상단 하이라이트 + 우하단 그림자로 입체감을 자동 부여.
 */
export function Body({
  cx = 50,
  cy = 62,
  rx = 27,
  ry = 26,
  tone,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  tone: readonly [string, string, string] | string[];
}) {
  return (
    <>
      {/* 바탕 */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={tone[1]} />
      {/* 우하단 그림자 */}
      <path
        d={`M ${cx - rx} ${cy} a ${rx} ${ry} 0 0 0 ${rx * 2} 0 a ${rx} ${ry} 0 0 0 ${-rx * 2} 0`}
        fill={tone[2]}
        opacity={0.35}
      />
      {/* 좌상단 하이라이트 */}
      <ellipse
        cx={cx - rx * 0.3}
        cy={cy - ry * 0.38}
        rx={rx * 0.52}
        ry={ry * 0.4}
        fill={tone[0]}
        opacity={0.55}
      />
    </>
  );
}

/** 위쪽이 밝은 세로 그라데이션 defs — 큰 면(하늘/바다/판)에 사용. */
export function VGrad({
  id,
  from,
  to,
}: {
  id: string;
  from: string;
  to: string;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

/** 별점(★) 품질 표시 — 작물 품질 1~5. 아트가 아니라 UI 배지용 소품. */
export function StarRow({ n, size = 9 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-[1px] leading-none"
      style={{ fontSize: size }}
      aria-label={`품질 ${n}성`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? "#ffc247" : "rgba(255,255,255,0.22)" }}>
          ★
        </span>
      ))}
    </span>
  );
}
