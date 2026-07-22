"use client";

import { useId } from "react";

/**
 * 우리 섬 — 펫 아트 23종 (메인 캐릭터)
 * ============================================================================
 * 설계 원칙
 *  1) **진화 계보 = 실루엣 계승**. 종별 베이스 함수(foxBase/catBase/bearBase/
 *     pandaBase/owlBase/wolfBase)가 귀·주둥이·꼬리 모양을 소유하고,
 *     stage4 최종형은 그 베이스에 "색 승급 + 장식"만 얹는다.
 *     → 사용자가 한눈에 "얘가 걔의 최종형"임을 알 수 있고, 코드 중복도 없다.
 *  2) 좌우 대칭 파츠(귀/팔/날개/발)는 한 번만 그리고 <Mirror> 로 복제(x=50 기준).
 *  3) parts.tsx 의 Art/Body/Eyes/Blush/Smile/Sparkle/Leaf/GroundShadow/VGrad 재사용.
 *  4) 광원 좌상단 · 지면 y=92 · PAL 팔레트 · 랜덤 금지 — parts.tsx 계약 그대로.
 *
 * 스테이지
 *  0 egg / 1 hatchling / 2 sunny·cozy·moody / 3 fox·cat·bear·panda·owl·wolf
 *  4 (각 stage3 → 2갈래) celestial_fox·starlight_fox / royal_cat·lucky_cat /
 *    guardian_bear·honey_bear / zen_panda·dream_panda / arcane_owl·sage_owl /
 *    lunar_wolf·spirit_wolf
 */

import type { ReactNode } from "react";
import {
  Art,
  Blush,
  Body,
  Eyes,
  GroundShadow,
  GROUND_Y,
  INK,
  INK_SOFT,
  Leaf,
  PAL,
  Smile,
  Sparkle,
  VGrad,
  type ArtFC,
} from "./parts";

/* ══════════════════════ 공용 소품 ══════════════════════ */

/** PAL 한 계열(밝은면/기본/어두운면). */
type Tone = readonly [string, string, string];
type EyeVariant = "round" | "happy" | "sleepy" | "sparkle";

/** 좌우 대칭 복제 — x=50 을 축으로 뒤집는다. 귀·팔·날개·발에 사용. */
function Mirror({ children }: { children: ReactNode }) {
  return <g transform="translate(100,0) scale(-1,1)">{children}</g>;
}

/** 뒤광(오라) — 최종형의 '레전드감' 담당. 캐릭터보다 먼저 그린다. */
function Aura({
  color,
  cx = 50,
  cy = 56,
  r = 44,
}: {
  color: string;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.1} />
      <circle cx={cx} cy={cy} r={r * 0.76} fill={color} opacity={0.13} />
      <circle cx={cx} cy={cy} r={r * 0.52} fill={color} opacity={0.12} />
    </>
  );
}

/** 머리 위 후광 링. */
function Halo({
  cx = 50,
  cy = 20,
  rx = 19,
  ry = 5.5,
  tone = PAL.gold,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  tone?: Tone;
}) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={tone[2]} strokeWidth={4} opacity={0.55} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={tone[1]} strokeWidth={2.6} />
      <ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.5} rx={rx * 0.42} ry={ry * 0.5} fill="none" stroke={tone[0]} strokeWidth={1.3} />
    </>
  );
}

/** 마름모 보석 — 왕관/목걸이/이마 장식. */
function Gem({ cx, cy, r = 4, tone = PAL.berry }: { cx: number; cy: number; r?: number; tone?: Tone }) {
  const w = r * 0.82;
  return (
    <>
      <path d={`M ${cx} ${cy - r} L ${cx + w} ${cy} L ${cx} ${cy + r} L ${cx - w} ${cy} Z`} fill={tone[1]} />
      <path d={`M ${cx} ${cy - r} L ${cx - w} ${cy} L ${cx} ${cy} Z`} fill={tone[0]} />
      <path d={`M ${cx} ${cy} L ${cx + w} ${cy} L ${cx} ${cy + r} Z`} fill={tone[2]} opacity={0.85} />
    </>
  );
}

/** 왕관 — 왕고양이/수호곰 등. */
function Crown({ cx = 50, y = 22, w = 17 }: { cx?: number; y?: number; w?: number }) {
  return (
    <>
      <path
        d={`M ${cx - w} ${y + 9} L ${cx - w} ${y - 3} L ${cx - w * 0.5} ${y + 4} L ${cx} ${y - 9}
            L ${cx + w * 0.5} ${y + 4} L ${cx + w} ${y - 3} L ${cx + w} ${y + 9} Z`}
        fill={PAL.gold[1]}
      />
      <path
        d={`M ${cx - w} ${y + 9} L ${cx - w} ${y - 3} L ${cx - w * 0.5} ${y + 4} L ${cx} ${y - 9} L ${cx} ${y + 9} Z`}
        fill={PAL.gold[0]}
        opacity={0.75}
      />
      <rect x={cx - w} y={y + 7} width={w * 2} height={4.4} rx={2.2} fill={PAL.gold[2]} />
      <Gem cx={cx} cy={y + 9.2} r={3.2} tone={PAL.berry} />
      <circle cx={cx - w} cy={y - 3} r={2.2} fill={PAL.gold[0]} />
      <circle cx={cx + w} cy={y - 3} r={2.2} fill={PAL.gold[0]} />
    </>
  );
}

/** 별 4갈래 묶음 — Sparkle 을 세 개 배치한 관용 패턴. */
function SparkleTrio({ tone = PAL.gold }: { tone?: Tone }) {
  return (
    <>
      <Sparkle cx={17} cy={30} r={6.5} color={tone[0]} />
      <Sparkle cx={84} cy={24} r={5} color={tone[1]} opacity={0.9} />
      <Sparkle cx={78} cy={52} r={3.6} color={tone[0]} opacity={0.8} />
    </>
  );
}

/* ══════════════════════ stage 0 · 1 · 2 ══════════════════════ */

/** 알 — 진화 0단계. 파스텔 무늬 + 금 간 껍질. */
export const Egg: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "알"}>
    <GroundShadow cx={50} cy={GROUND_Y + 1} rx={19} ry={5} />
    {/* 껍질 */}
    <path
      d="M 50 16 C 66 16 75 40 75 58 C 75 78 64 91 50 91 C 36 91 25 78 25 58 C 25 40 34 16 50 16 Z"
      fill={PAL.cream[1]}
    />
    {/* 우하단 그림자 */}
    <path
      d="M 50 16 C 66 16 75 40 75 58 C 75 78 64 91 50 91 C 58 84 62 70 61 56 C 60 38 56 24 50 16 Z"
      fill={PAL.cream[2]}
      opacity={0.45}
    />
    {/* 좌상단 하이라이트 */}
    <ellipse cx={40} cy={40} rx={7} ry={11} fill={PAL.white[0]} opacity={0.65} transform="rotate(-16 40 40)" />
    {/* 파스텔 무늬 */}
    <ellipse cx={38} cy={64} rx={5.4} ry={4.2} fill={PAL.mint[1]} opacity={0.75} />
    <ellipse cx={60} cy={70} rx={4.6} ry={3.6} fill={PAL.rose[1]} opacity={0.7} />
    <ellipse cx={56} cy={36} rx={4} ry={3.2} fill={PAL.violet[1]} opacity={0.65} />
    <ellipse cx={33} cy={50} rx={3.2} ry={2.6} fill={PAL.amber[1]} opacity={0.6} />
    <ellipse cx={50} cy={80} rx={4.2} ry={3} fill={PAL.sky[1]} opacity={0.6} />
    {/* 금 — 곧 부화한다는 신호 */}
    <path
      d="M 28 52 L 35 46 L 40 55 L 47 44 L 53 55 L 60 45 L 66 53 L 72 47"
      stroke={PAL.cream[2]}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Sparkle cx={80} cy={30} r={5} color={PAL.gold[0]} />
    <Sparkle cx={22} cy={26} r={3.2} color={PAL.white[0]} opacity={0.85} />
  </Art>
);

/** 아기 — 알 껍질을 머리에 쓴 갓 부화한 생물. */
export const Hatchling: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "아기"}>
    <GroundShadow cx={50} cy={GROUND_Y + 1} rx={21} ry={5} />
    {/* 발 */}
    <path d="M 41 84 l -6 6 M 41 84 l -1 7 M 41 84 l 5 6" stroke={PAL.amber[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <Mirror>
      <path d="M 41 84 l -6 6 M 41 84 l -1 7 M 41 84 l 5 6" stroke={PAL.amber[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Mirror>
    {/* 몸 */}
    <Body cx={50} cy={66} rx={22} ry={20} tone={PAL.gold} />
    {/* 날개 */}
    <ellipse cx={29} cy={68} rx={6.5} ry={10} fill={PAL.amber[1]} transform="rotate(16 29 68)" />
    <Mirror>
      <ellipse cx={29} cy={68} rx={6.5} ry={10} fill={PAL.amber[1]} transform="rotate(16 29 68)" />
    </Mirror>
    {/* 머리 */}
    <ellipse cx={50} cy={45} rx={18} ry={16.5} fill={PAL.gold[1]} />
    <ellipse cx={43} cy={38} rx={9} ry={6.5} fill={PAL.gold[0]} opacity={0.6} />
    <path d="M 50 28.5 A 18 16.5 0 0 1 50 61.5 Z" fill={PAL.gold[2]} opacity={0.16} />
    {/* 알 껍질 모자 */}
    <path
      d="M 31 34 C 32 18 40 11 50 11 C 60 11 68 18 69 34 L 62 29 L 56 36 L 50 27 L 44 36 L 38 29 Z"
      fill={PAL.cream[1]}
    />
    <path d="M 50 11 C 60 11 68 18 69 34 L 62 29 L 58 34 C 58 22 55 15 50 11 Z" fill={PAL.cream[2]} opacity={0.5} />
    <ellipse cx={41} cy={22} rx={4.5} ry={3.4} fill={PAL.mint[1]} opacity={0.6} />
    <ellipse cx={58} cy={20} rx={3.4} ry={2.6} fill={PAL.rose[1]} opacity={0.6} />
    {/* 얼굴 */}
    <Eyes cx={50} y={45} gap={9.5} r={4.2} variant="sparkle" />
    <path d="M 46 53 L 50 50 L 54 53 L 50 57 Z" fill={PAL.amber[2]} />
    <Blush cx={50} y={53} gap={16} rx={4.4} ry={2.8} />
    <Sparkle cx={78} cy={30} r={4.4} color={PAL.gold[0]} />
  </Art>
);

/**
 * stage2 공통 몸 — 세 형제(햇살이/포근이/그늘이)가 같은 실루엣을 공유한다.
 * 입은 형제마다 다르므로(부리/미소/무표정) 호출측이 넘긴다 — 베이스가 부리를
 * 그려버리면 그 위에 미소를 또 얹게 돼 입이 두 개로 보인다.
 */
function blobBase({
  tone,
  belly,
  eyeVariant = "round",
  eyeColor = INK,
  wing,
  mouth,
}: {
  tone: Tone;
  belly: Tone;
  eyeVariant?: EyeVariant;
  eyeColor?: string;
  wing: Tone;
  mouth: ReactNode;
}): ReactNode {
  const foot = (
    <path d="M 41 85 l -6 6 M 41 85 l -1 7 M 41 85 l 5 6" stroke={PAL.amber[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
  );
  const arm = <ellipse cx={26} cy={68} rx={7} ry={11} fill={wing[1]} transform="rotate(18 26 68)" />;
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={23} ry={5.5} />
      {foot}
      <Mirror>{foot}</Mirror>
      {arm}
      <Mirror>{arm}</Mirror>
      <Body cx={50} cy={62} rx={26} ry={25} tone={tone} />
      {/* 배 */}
      <ellipse cx={50} cy={70} rx={15} ry={14} fill={belly[0]} opacity={0.85} />
      <Eyes cx={50} y={54} gap={11} r={4.8} variant={eyeVariant} color={eyeColor} />
      {mouth}
      <Blush cx={50} y={63} gap={19} rx={5} ry={3.2} />
    </>
  );
}

/** 햇살이 — 밝은 노랑, 머리에 햇살 뿔. 생기 넘치는 갈래. */
export const Sunny: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "햇살이"}>
    <defs>
      <VGrad id={`sunny-glow${_gid}`} from={PAL.gold[0]} to={PAL.amber[1]} />
    </defs>
    <circle cx={50} cy={56} r={44} fill={`url(#sunny-glow${_gid})`} opacity={0.18} />
    {/* 햇살 뿔 */}
    <path d="M 50 34 L 44 14 L 56 16 Z" fill={PAL.amber[1]} />
    <path d="M 36 40 L 22 26 L 32 22 Z" fill={PAL.amber[1]} opacity={0.9} />
    <path d="M 64 40 L 78 26 L 68 22 Z" fill={PAL.amber[2]} opacity={0.85} />
    {blobBase({
      tone: PAL.gold,
      belly: PAL.cream,
      wing: PAL.amber,
      eyeVariant: "happy",
      // 활짝 벌린 부리 — 하츨링의 부리를 물려받되 더 씩씩하게
      mouth: (
        <>
          <path d="M 44 60 L 50 57 L 56 60 L 50 63 Z" fill={PAL.amber[2]} />
          <path d="M 44 60 L 50 63 L 56 60 Q 50 69 44 60 Z" fill={PAL.berry[2]} />
        </>
      ),
    })}
    <Sparkle cx={19} cy={40} r={5.4} color={PAL.gold[0]} />
    <Sparkle cx={83} cy={54} r={4} color={PAL.amber[0]} opacity={0.85} />
  </Art>
  );
};

/** 포근이 — 크림/복숭아, 목도리 두른 포근한 갈래. */
export const Cozy: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "포근이"}>
    <circle cx={50} cy={58} r={42} fill={PAL.peach[1]} opacity={0.12} />
    {blobBase({
      tone: PAL.cream,
      belly: PAL.white,
      wing: PAL.peach,
      eyeVariant: "sleepy",
      mouth: <Smile cx={50} y={61} w={6.5} />,
    })}
    {/* 머리 위 곱슬 한 가닥 — 닫힌 고리(스트로크 곡선)로 그리면 알파벳 'P' 로 읽혀서
        끝이 가늘어지는 채움 도형으로. 몸 뒤가 아니라 위에 얹어야 뿌리가 붙어 보인다. */}
    <path
      d="M 47 41 C 45 32 48 25 55 23 C 60 22 63 26 61 29 C 60 26 57 26 55 28 C 51 31 50 35 51 41 Z"
      fill={PAL.peach[2]}
    />
    <path d="M 47 41 C 45 33 47 27 53 24 C 49 29 48 35 49 41 Z" fill={PAL.peach[0]} opacity={0.55} />
    {/* 목도리 */}
    <path d="M 28 67 Q 50 77 72 67 L 71 74 Q 50 84 29 74 Z" fill={PAL.rose[1]} />
    <path d="M 28 67 Q 39 73 50 74 L 50 81 Q 38 79 29 74 Z" fill={PAL.rose[0]} opacity={0.75} />
    <path d="M 65 73 L 73 86 L 65 85 L 61 75 Z" fill={PAL.rose[2]} />
    {/* 포근한 김 */}
    <path d="M 26 30 q 4 -6 0 -11 q -4 -5 0 -9" stroke={PAL.white[0]} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.55} />
    <Sparkle cx={80} cy={34} r={4.2} color={PAL.rose[0]} opacity={0.8} />
  </Art>
);

/** 그늘이 — 회청/차콜, 눈 위 앞머리 + 작은 먹구름. 시크한 갈래. */
export const Moody: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "그늘이"}>
    <circle cx={50} cy={58} r={42} fill={PAL.night[0]} opacity={0.14} />
    {blobBase({
      tone: PAL.charcoal,
      belly: PAL.gray,
      wing: PAL.night,
      eyeVariant: "sleepy",
      eyeColor: PAL.sky[0],
      // 시큰둥한 일자 입 — 형제 중 유일하게 웃지 않는다
      mouth: <path d="M 45 61 L 55 61" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />,
    })}
    {/* 앞머리 — 한쪽 눈을 덮어 시크함 */}
    <path d="M 26 48 C 28 32 38 26 50 26 C 62 26 72 32 74 46 C 66 38 60 42 55 46 C 50 38 40 40 34 47 C 32 44 29 45 26 48 Z" fill={PAL.charcoal[2]} />
    <path d="M 34 47 C 40 40 50 38 55 46 C 50 43 42 43 34 47 Z" fill={PAL.charcoal[0]} opacity={0.4} />
    {/* 한쪽 눈을 덮는 옆머리 — 아래로 더 뻗으면 옆 날개와 한 덩어리로 뭉쳐 보여
        눈높이(y≈58)에서 끊는다. */}
    <path d="M 29 43 C 32 49 34 53 33 58 L 40 55 C 41 50 40 47 37 43 Z" fill={PAL.charcoal[2]} />
    <path d="M 29 43 C 32 48 33 52 33 56 C 31 51 29 47 29 43 Z" fill={PAL.charcoal[0]} opacity={0.4} />
    {/* 작은 먹구름 */}
    <ellipse cx={70} cy={18} rx={12} ry={7} fill={PAL.gray[1]} opacity={0.9} />
    <ellipse cx={62} cy={20} rx={7} ry={5} fill={PAL.gray[0]} opacity={0.9} />
    <ellipse cx={77} cy={21} rx={7} ry={5} fill={PAL.gray[2]} opacity={0.8} />
    <path d="M 68 26 L 66 33 L 70 31 L 68 37" stroke={PAL.sky[1]} strokeWidth={2} strokeLinecap="round" fill="none" />
  </Art>
);

/* ══════════════════════ stage 3 · 4 — 종별 베이스 ══════════════════════ */

type BaseOpts = {
  fur: Tone;
  belly: Tone;
  inner?: Tone;
  eyeVariant?: EyeVariant;
  eyeColor?: string;
  /** 발밑 그림자 농도(영혼늑대처럼 뜬 개체는 0 에 가깝게). */
  shadow?: number;
};

/* ── 여우: 큰 삼각 귀 + 뾰족 주둥이 + 흰 꼬리끝 부채꼬리 ─────────────── */
function foxBase({ fur, belly, inner = PAL.peach, eyeVariant = "round", eyeColor = INK, shadow = 0.22 }: BaseOpts): ReactNode {
  const ear = (
    <>
      <path d="M 32 33 L 24 9 L 47 24 Z" fill={fur[1]} />
      <path d="M 24 9 L 32 33 L 36 28 Z" fill={fur[0]} opacity={0.5} />
      <path d="M 33 29 L 29 16 L 43 25 Z" fill={inner[1]} />
    </>
  );
  const foot = <ellipse cx={39} cy={87.5} rx={8.5} ry={4.5} fill={belly[1]} />;
  const cheek = <path d="M 29 49 L 18 44 L 30 58 Z" fill={fur[0]} />;
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={26} ry={5.5} opacity={shadow} />
      {/* 굵은 꼬리 — 끝을 뾰족하게 빼면 흰 꼬리끝을 얹을 자리가 없어(폭 4 남짓)
          타원이 밖으로 삐져나가 '떠 있는 공'으로 읽힌다. 끝을 둥글고 넓게. */}
      <path d="M 66 74 C 74 70 80 62 82 54 C 84 47 94 48 95 56 C 96 64 96 74 91 82 C 85 90 74 90 68 86 Z" fill={fur[1]} />
      <path d="M 95 56 C 96 66 95 76 90 83 C 84 90 74 90 68 86 C 79 87 88 79 90 69 C 91 62 93 58 95 56 Z" fill={fur[2]} opacity={0.4} />
      <ellipse cx={88.5} cy={54} rx={6.5} ry={6} fill={belly[0]} transform="rotate(10 88.5 54)" />
      {foot}
      <Mirror>{foot}</Mirror>
      <Body cx={50} cy={74} rx={21} ry={17} tone={fur} />
      <ellipse cx={50} cy={79} rx={12.5} ry={11} fill={belly[0]} opacity={0.92} />
      {ear}
      <Mirror>{ear}</Mirror>
      {cheek}
      <Mirror>{cheek}</Mirror>
      {/* 머리 */}
      <ellipse cx={50} cy={46} rx={22} ry={19.5} fill={fur[1]} />
      <ellipse cx={42} cy={38} rx={11} ry={8} fill={fur[0]} opacity={0.5} />
      <path d="M 50 26.5 A 22 19.5 0 0 1 50 65.5 Z" fill={fur[2]} opacity={0.18} />
      {/* 뾰족 주둥이 */}
      <path d="M 36 52 Q 50 44 64 52 Q 61 68 50 68 Q 39 68 36 52 Z" fill={belly[0]} />
      <path d="M 50 46.5 Q 61 49 64 52 Q 61 68 50 68 Z" fill={belly[2]} opacity={0.22} />
      <path d="M 46 53 Q 50 51 54 53 Q 50 58.5 46 53 Z" fill={INK} />
      <path d="M 50 57.5 L 50 60.5 M 50 60.5 Q 46 63.5 43.5 60 M 50 60.5 Q 54 63.5 56.5 60" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Eyes cx={50} y={45} gap={11.5} r={4.4} variant={eyeVariant} color={eyeColor} />
      <Blush cx={50} y={53} gap={19.5} rx={4.6} ry={3} />
    </>
  );
}

/* ── 고양이: 작고 넓은 귀 + 수염 + 갈고리 꼬리 ────────────────────────── */
function catBase({ fur, belly, inner = PAL.rose, eyeVariant = "round", eyeColor = INK, shadow = 0.22 }: BaseOpts): ReactNode {
  const ear = (
    <>
      <path d="M 33 32 L 29 12 L 48 25 Z" fill={fur[1]} />
      <path d="M 29 12 L 33 32 L 36 28 Z" fill={fur[0]} opacity={0.5} />
      <path d="M 34 28 L 32 18 L 44 26 Z" fill={inner[1]} />
    </>
  );
  const foot = <ellipse cx={39} cy={87.5} rx={8} ry={4.5} fill={belly[1]} />;
  const whisk = (
    <path
      d="M 34 55 L 19 51 M 34 58 L 18 59 M 34 61 L 20 66"
      stroke={INK_SOFT}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
      opacity={0.8}
    />
  );
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={25} ry={5.5} opacity={shadow} />
      {/* 갈고리 꼬리 */}
      <path d="M 67 84 C 83 87 91 75 86 63 C 83 55 74 53 70 58 C 77 59 80 66 78 72 C 75 80 71 82 66 79 Z" fill={fur[1]} />
      <path d="M 86 63 C 88 70 87 77 83 82 C 87 76 88 69 86 63 Z" fill={fur[2]} opacity={0.5} />
      {foot}
      <Mirror>{foot}</Mirror>
      <Body cx={50} cy={75} rx={20.5} ry={16.5} tone={fur} />
      <ellipse cx={50} cy={79} rx={12} ry={11} fill={belly[0]} opacity={0.9} />
      {ear}
      <Mirror>{ear}</Mirror>
      <ellipse cx={50} cy={47} rx={21} ry={19} fill={fur[1]} />
      <ellipse cx={42} cy={39} rx={10.5} ry={7.5} fill={fur[0]} opacity={0.5} />
      <path d="M 50 28 A 21 19 0 0 1 50 66 Z" fill={fur[2]} opacity={0.18} />
      {/* 이마 줄무늬 */}
      <path d="M 44 33 q 3 -4 6 -1 M 50 31 q 3 -4 6 0 M 38 37 q 3 -4 6 -1" stroke={fur[2]} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.65} />
      {whisk}
      <Mirror>{whisk}</Mirror>
      {/* 주둥이 */}
      <ellipse cx={44.5} cy={59} rx={8} ry={5.8} fill={belly[0]} />
      <ellipse cx={55.5} cy={59} rx={8} ry={5.8} fill={belly[0]} />
      <path d="M 46.3 52.6 Q 50 50.8 53.7 52.6 Q 50 57 46.3 52.6 Z" fill={inner[2]} />
      <path d="M 50 56 L 50 58 M 50 58 Q 46.5 61.5 43.5 58 M 50 58 Q 53.5 61.5 56.5 58" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Eyes cx={50} y={45} gap={11} r={4.8} variant={eyeVariant} color={eyeColor} />
      <Blush cx={50} y={53} gap={19} rx={4.6} ry={3} />
    </>
  );
}

/* ── 곰/판다 공용: 동그란 귀 + 큰 주둥이 + 두툼한 팔다리 ─────────────── */
function bearBase({
  fur,
  belly,
  inner = PAL.peach,
  eyeVariant = "round",
  eyeColor = INK,
  shadow = 0.22,
  ear = undefined,
  limb = undefined,
  patch = undefined,
}: BaseOpts & { ear?: Tone; limb?: Tone; patch?: Tone }): ReactNode {
  const earTone = ear ?? fur;
  const limbTone = limb ?? fur;
  const earNode = (
    <>
      <circle cx={29} cy={28} r={9.5} fill={earTone[1]} />
      <circle cx={26.5} cy={25.5} r={5} fill={earTone[0]} opacity={0.6} />
      <circle cx={30} cy={29} r={5} fill={inner[1]} opacity={0.85} />
    </>
  );
  const armNode = <ellipse cx={27} cy={73} rx={7.5} ry={10.5} fill={limbTone[1]} transform="rotate(18 27 73)" />;
  const footNode = (
    <>
      <ellipse cx={37} cy={87} rx={10} ry={5.5} fill={limbTone[1]} />
      <ellipse cx={34} cy={86} rx={3.4} ry={2.6} fill={belly[0]} opacity={0.9} />
      <circle cx={39} cy={84.5} r={1.5} fill={belly[0]} opacity={0.8} />
      <circle cx={42.5} cy={86} r={1.5} fill={belly[0]} opacity={0.8} />
    </>
  );
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={27} ry={5.5} opacity={shadow} />
      {earNode}
      <Mirror>{earNode}</Mirror>
      {armNode}
      <Mirror>{armNode}</Mirror>
      {footNode}
      <Mirror>{footNode}</Mirror>
      <Body cx={50} cy={74} rx={24} ry={17} tone={fur} />
      <ellipse cx={50} cy={78} rx={15} ry={12.5} fill={belly[0]} opacity={0.9} />
      <ellipse cx={50} cy={48} rx={23} ry={20.5} fill={fur[1]} />
      <ellipse cx={41} cy={39} rx={11.5} ry={8.5} fill={fur[0]} opacity={0.5} />
      <path d="M 50 27.5 A 23 20.5 0 0 1 50 68.5 Z" fill={fur[2]} opacity={0.16} />
      {patch && (
        <>
          <ellipse cx={38} cy={46} rx={9.5} ry={11.5} fill={patch[1]} transform="rotate(-20 38 46)" />
          <ellipse cx={62} cy={46} rx={9.5} ry={11.5} fill={patch[1]} transform="rotate(20 62 46)" />
          <ellipse cx={35.5} cy={41} rx={4} ry={4.6} fill={patch[0]} opacity={0.45} transform="rotate(-20 35.5 41)" />
        </>
      )}
      {/* 주둥이 */}
      <ellipse cx={50} cy={60} rx={14.5} ry={10} fill={belly[0]} />
      <path d="M 50 50 Q 62 52 64.5 60 Q 62 70 50 70 Z" fill={belly[2]} opacity={0.2} />
      <ellipse cx={50} cy={55} rx={4.6} ry={3.4} fill={INK} />
      <ellipse cx={48.4} cy={54} rx={1.6} ry={1.1} fill={PAL.white[0]} opacity={0.7} />
      <path d="M 50 58.5 L 50 61 M 50 61 Q 46 64.5 43 61 M 50 61 Q 54 64.5 57 61" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* 눈 흰자 — 판다처럼 검은 눈꺼풀 무늬(patch) 위에 눈이 얹히면 INK(#3a3450) 와
          charcoal(#414657) 의 대비가 1.25:1 이라 눈이 통째로 사라진다. 무늬가 있을
          때만 흰 바탕을 깔아 실제 판다처럼 '검은 무늬 안의 흰 눈'으로 읽히게 한다. */}
      {patch && (
        <>
          <ellipse cx={37.5} cy={46} rx={6} ry={6.6} fill={PAL.white[0]} />
          <ellipse cx={62.5} cy={46} rx={6} ry={6.6} fill={PAL.white[0]} />
          <ellipse cx={35.8} cy={43.6} rx={2.4} ry={2.2} fill={patch[0]} opacity={0.25} />
        </>
      )}
      <Eyes cx={50} y={46} gap={12.5} r={4.4} variant={eyeVariant} color={eyeColor} />
      {!patch && <Blush cx={50} y={55} gap={21} rx={5} ry={3.2} />}
    </>
  );
}

/* ── 부엉이: 통짜 타원 + 귀깃 + 얼굴판 + 부리 + 날개 ──────────────────── */
function owlBase({ fur, belly, inner = PAL.gold, eyeVariant = "round", eyeColor = INK, shadow = 0.22 }: BaseOpts): ReactNode {
  const tuft = (
    <>
      <path d="M 31 36 L 24 13 L 44 29 Z" fill={fur[2]} />
      <path d="M 24 13 L 31 36 L 34 30 Z" fill={fur[1]} opacity={0.7} />
    </>
  );
  const wing = (
    <>
      <path d="M 26 50 Q 15 66 21 84 Q 31 79 30 57 Z" fill={fur[2]} />
      <path d="M 26 50 Q 19 62 21 76 Q 26 70 27 55 Z" fill={fur[1]} opacity={0.6} />
    </>
  );
  const talon = (
    <path d="M 40 86 l -6 6 M 40 86 l -1 7 M 40 86 l 5 6" stroke={inner[2]} strokeWidth={2.8} strokeLinecap="round" fill="none" />
  );
  const brow = <path d="M 29 40 Q 39 34 47 40" stroke={fur[2]} strokeWidth={3} strokeLinecap="round" fill="none" />;
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={25} ry={5.5} opacity={shadow} />
      {talon}
      <Mirror>{talon}</Mirror>
      {tuft}
      <Mirror>{tuft}</Mirror>
      {/* 몸통 = 머리 (부엉이 실루엣) */}
      <ellipse cx={50} cy={57} rx={26} ry={30} fill={fur[1]} />
      <ellipse cx={40} cy={42} rx={12} ry={11} fill={fur[0]} opacity={0.45} />
      <path d="M 50 27 A 26 30 0 0 1 50 87 Z" fill={fur[2]} opacity={0.18} />
      {wing}
      <Mirror>{wing}</Mirror>
      {/* 배 무늬 */}
      <path d="M 42 70 q 8 6 16 0 M 44 77 q 6 5 12 0 M 46 84 q 4 4 8 0" stroke={fur[2]} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.45} />
      {/* 얼굴판 */}
      <path d="M 27 45 Q 50 30 73 45 Q 73 66 50 71 Q 27 66 27 45 Z" fill={belly[0]} opacity={0.95} />
      <path d="M 50 34 Q 66 37 73 45 Q 73 66 50 71 Z" fill={belly[2]} opacity={0.18} />
      <circle cx={39} cy={49} r={9.6} fill={PAL.white[0]} />
      <circle cx={61} cy={49} r={9.6} fill={PAL.white[0]} />
      <circle cx={39} cy={49} r={9.6} fill={fur[2]} opacity={0.12} />
      <circle cx={61} cy={49} r={9.6} fill={fur[2]} opacity={0.12} />
      <Eyes cx={50} y={49} gap={11} r={5} variant={eyeVariant} color={eyeColor} />
      {brow}
      <Mirror>{brow}</Mirror>
      {/* 부리 */}
      <path d="M 50 54 L 44.5 61 Q 50 65 55.5 61 Z" fill={inner[1]} />
      <path d="M 50 54 L 55.5 61 Q 53 63 50 63 Z" fill={inner[2]} opacity={0.8} />
    </>
  );
}

/* ── 늑대: 각진 귀 + 긴 주둥이 + 목덜미 갈기 + 아래로 뻗은 꼬리 ───────── */
function wolfBase({ fur, belly, inner = PAL.charcoal, eyeVariant = "round", eyeColor = INK, shadow = 0.22 }: BaseOpts): ReactNode {
  const ear = (
    <>
      <path d="M 32 32 L 22 10 L 46 24 Z" fill={fur[1]} />
      <path d="M 22 10 L 32 32 L 35 27 Z" fill={fur[0]} opacity={0.45} />
      <path d="M 32.5 28 L 27 16 L 42 25 Z" fill={inner[1]} opacity={0.85} />
    </>
  );
  const foot = <ellipse cx={38} cy={87.5} rx={9} ry={4.5} fill={belly[1]} />;
  return (
    <>
      <GroundShadow cx={50} cy={GROUND_Y + 1} rx={26} ry={5.5} opacity={shadow} />
      {/* 굵은 꼬리(좌측) — 여우 꼬리를 x=50 기준으로 뒤집은 형태.
          몸과 같은 fur[1] 로 칠하면 한 덩어리로 뭉쳐 보여서 한 톤 밝은 fur[0] 로 띄운다. */}
      <path d="M 34 74 C 26 70 20 62 18 54 C 16 47 6 48 5 56 C 4 64 4 74 9 82 C 15 90 26 90 32 86 Z" fill={fur[0]} />
      <path d="M 5 56 C 4 66 5 76 10 83 C 16 90 26 90 32 86 C 21 87 12 79 10 69 C 9 62 7 58 5 56 Z" fill={fur[2]} opacity={0.45} />
      <ellipse cx={11.5} cy={54} rx={6.5} ry={6} fill={belly[0]} transform="rotate(-10 11.5 54)" />
      {foot}
      <Mirror>{foot}</Mirror>
      <Body cx={50} cy={75} rx={21.5} ry={16} tone={fur} />
      {/* 가슴 갈기 */}
      <path d="M 32 69 L 38 60 L 43 69 L 50 59 L 57 69 L 62 60 L 68 69 Q 50 84 32 69 Z" fill={belly[0]} opacity={0.95} />
      {ear}
      <Mirror>{ear}</Mirror>
      <ellipse cx={50} cy={46} rx={22} ry={19} fill={fur[1]} />
      <ellipse cx={42} cy={38} rx={11} ry={8} fill={fur[0]} opacity={0.45} />
      <path d="M 50 27 A 22 19 0 0 1 50 65 Z" fill={fur[2]} opacity={0.18} />
      {/* 긴 주둥이 */}
      <path d="M 36 51 Q 50 43 64 51 Q 61 70 50 70 Q 39 70 36 51 Z" fill={belly[0]} />
      <path d="M 50 45.5 Q 61 48 64 51 Q 61 70 50 70 Z" fill={belly[2]} opacity={0.22} />
      <path d="M 45.5 52 Q 50 49.5 54.5 52 Q 50 58.5 45.5 52 Z" fill={INK} />
      <path d="M 50 57.5 L 50 61 M 50 61 Q 45.5 64.5 42.5 60.5 M 50 61 Q 54.5 64.5 57.5 60.5" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* 매서운 눈썹 */}
      <path d="M 33 37 L 45 40.5 M 67 37 L 55 40.5" stroke={fur[2]} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Eyes cx={50} y={46} gap={11.5} r={4.3} variant={eyeVariant} color={eyeColor} />
    </>
  );
}

/* ══════════════════════ stage 3 (6종) ══════════════════════ */

export const Fox: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "여우"}>{foxBase({ fur: PAL.fur, belly: PAL.cream })}</Art>
);

export const Cat: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "고양이"}>{catBase({ fur: PAL.gray, belly: PAL.white })}</Art>
);

export const Bear: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "곰"}>{bearBase({ fur: PAL.brown, belly: PAL.cream })}</Art>
);

export const Panda: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "판다"}>
    {bearBase({
      fur: PAL.white,
      belly: PAL.white,
      ear: PAL.charcoal,
      limb: PAL.charcoal,
      patch: PAL.charcoal,
      inner: PAL.gray,
      eyeColor: INK,
    })}
  </Art>
);

export const Owl: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "부엉이"}>{owlBase({ fur: PAL.brown, belly: PAL.cream })}</Art>
);

/**
 * 늑대 — 유일하게 털이 PAL.charcoal(팔레트 최암부)이라 기본값을 쓰면 얼굴에서 사라지는
 * 파츠가 둘 있다. 계보 선배인 그늘이(Moody)와 같은 처리로 맞춘다.
 *  · 눈: INK(#3a3450) vs charcoal[1](#414657) = 대비 1.25:1 → 눈동자가 통째로 증발.
 *        Moody 와 같은 sky[0] 로 올려 7.8:1 (moody → wolf 계보도 눈색으로 이어진다).
 *  · 귀 안쪽: 기본 inner=PAL.charcoal 이라 귀 바탕(fur=charcoal)과 **완전 동일색** →
 *        형태 소실. 여우/고양이처럼 '바탕보다 밝은 안쪽' 관례에 맞춰 gray 로.
 */
export const Wolf: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "늑대"}>
    {wolfBase({ fur: PAL.charcoal, belly: PAL.gray, inner: PAL.gray, eyeColor: PAL.sky[0] })}
  </Art>
);

/* ══════════════════════ stage 4 — 여우 계열 ══════════════════════ */

/** 천상여우 — 흰금 승급 + 후광 + 이마 보석. 여우 실루엣 그대로. */
export const CelestialFox: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "천상여우"}>
    <defs>
      <VGrad id={`cfox-aura${_gid}`} from={PAL.gold[0]} to={PAL.violet[1]} />
    </defs>
    <circle cx={50} cy={54} r={46} fill={`url(#cfox-aura${_gid})`} opacity={0.2} />
    <Aura color={PAL.gold[0]} />
    <Halo cx={50} cy={16} rx={20} ry={5.5} />
    {foxBase({ fur: PAL.cream, belly: PAL.white, inner: PAL.rose, eyeVariant: "sparkle" })}
    {/* 이마 보석 */}
    <Gem cx={50} cy={34} r={4.6} tone={PAL.violet} />
    {/* 꼬리 별무늬 */}
    <Sparkle cx={88} cy={78} r={4.4} color={PAL.gold[0]} />
    <Sparkle cx={78} cy={87} r={3} color={PAL.white[0]} opacity={0.9} />
    <SparkleTrio />
  </Art>
  );
};

/** 별빛여우 — 밤보라 승급 + 별 왕관 + 별무늬. */
export const StarlightFox: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "별빛여우"}>
    <defs>
      <VGrad id={`sfox-aura${_gid}`} from={PAL.violet[0]} to={PAL.night[0]} />
    </defs>
    <circle cx={50} cy={54} r={46} fill={`url(#sfox-aura${_gid})`} opacity={0.24} />
    <Aura color={PAL.violet[0]} />
    {/* 별 왕관 */}
    <Sparkle cx={50} cy={13} r={8} color={PAL.gold[0]} />
    <Sparkle cx={33} cy={19} r={5} color={PAL.violet[0]} />
    <Sparkle cx={67} cy={19} r={5} color={PAL.violet[0]} />
    {foxBase({ fur: PAL.violet, belly: PAL.white, inner: PAL.rose, eyeVariant: "sparkle", eyeColor: PAL.night[2] })}
    {/* 몸·꼬리 별무늬 */}
    <Sparkle cx={44} cy={76} r={3.4} color={PAL.gold[0]} opacity={0.9} />
    <Sparkle cx={58} cy={82} r={2.6} color={PAL.white[0]} opacity={0.85} />
    <Sparkle cx={89} cy={72} r={4.2} color={PAL.gold[0]} />
    <Sparkle cx={92} cy={60} r={5.4} color={PAL.white[0]} opacity={0.95} />
    <Sparkle cx={14} cy={40} r={4.4} color={PAL.violet[0]} opacity={0.9} />
  </Art>
  );
};

/* ══════════════════════ stage 4 — 고양이 계열 ══════════════════════ */

/** 왕고양이 — 은백 승급 + 왕관 + 자주 망토 + 보석 목걸이. */
export const RoyalCat: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "왕고양이"}>
    <Aura color={PAL.gold[0]} />
    {/* 망토 — 몸 뒤 */}
    <path d="M 30 56 Q 50 49 70 56 L 80 90 Q 50 97 20 90 Z" fill={PAL.violet[1]} />
    <path d="M 30 56 Q 40 52 50 51 L 50 94 Q 33 93 20 90 Z" fill={PAL.violet[0]} opacity={0.5} />
    <path d="M 21 87 Q 50 94 79 87 L 80 90 Q 50 97 20 90 Z" fill={PAL.white[0]} opacity={0.85} />
    {catBase({ fur: PAL.white, belly: PAL.cream, inner: PAL.rose, eyeVariant: "sparkle", eyeColor: PAL.night[1] })}
    {/* 목걸이 */}
    <path d="M 36 68 Q 50 76 64 68" stroke={PAL.gold[1]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
    <Gem cx={50} cy={75} r={4.6} tone={PAL.berry} />
    <Crown cx={50} y={19} w={17} />
    <Sparkle cx={20} cy={34} r={5} color={PAL.gold[0]} />
    <Sparkle cx={82} cy={40} r={4} color={PAL.gold[0]} opacity={0.9} />
  </Art>
);

/** 행운고양이 — 마네키네코. 든 앞발 + 금화 + 방울 + 네잎클로버. */
export const LuckyCat: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "행운고양이"}>
    <Aura color={PAL.mint[0]} />
    {catBase({ fur: PAL.cream, belly: PAL.white, inner: PAL.rose, eyeVariant: "happy" })}
    {/* 무늬 */}
    <ellipse cx={64} cy={38} rx={7} ry={5} fill={PAL.amber[1]} opacity={0.55} transform="rotate(18 64 38)" />
    <ellipse cx={36} cy={72} rx={6} ry={4.4} fill={PAL.amber[1]} opacity={0.45} />
    {/* 든 앞발(복 부르는 손) */}
    <ellipse cx={28} cy={58} rx={7} ry={9.5} fill={PAL.cream[1]} transform="rotate(-22 28 58)" />
    <ellipse cx={26} cy={52} rx={5.2} ry={4.6} fill={PAL.white[0]} />
    <circle cx={24} cy={50} r={1.6} fill={PAL.rose[1]} opacity={0.8} />
    {/* 목줄 + 방울 */}
    <path d="M 35 67 Q 50 75 65 67" stroke={PAL.berry[1]} strokeWidth={4} strokeLinecap="round" fill="none" />
    <circle cx={50} cy={75} r={5.4} fill={PAL.gold[1]} />
    <circle cx={48} cy={73} r={2} fill={PAL.gold[0]} />
    <path d="M 45 75.5 L 55 75.5 M 50 75.5 L 50 80" stroke={PAL.gold[2]} strokeWidth={1.6} strokeLinecap="round" />
    {/* 금화 */}
    <ellipse cx={72} cy={84} rx={10} ry={7.5} fill={PAL.gold[1]} transform="rotate(-12 72 84)" />
    <ellipse cx={70} cy={82} rx={6} ry={4.4} fill={PAL.gold[0]} transform="rotate(-12 70 82)" />
    <rect x={69} y={81} width={5} height={5} rx={1} fill={PAL.gold[2]} transform="rotate(-12 71.5 83.5)" />
    {/* 네잎클로버 */}
    <Leaf cx={30} cy={22} r={6} rot={-100} tone={0} />
    <Leaf cx={30} cy={22} r={6} rot={-10} tone={1} />
    <Leaf cx={30} cy={22} r={6} rot={80} tone={0} />
    <Leaf cx={30} cy={22} r={6} rot={170} tone={2} />
    <Sparkle cx={82} cy={28} r={5} color={PAL.gold[0]} />
  </Art>
);

/* ══════════════════════ stage 4 — 곰 계열 ══════════════════════ */

/** 수호곰 — 갑옷 + 방패 + 이마 투구. 곰 실루엣 유지. */
export const GuardianBear: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "수호곰"}>
    <Aura color={PAL.sky[0]} />
    {bearBase({ fur: PAL.brown, belly: PAL.cream, eyeColor: INK })}
    {/* 어깨 갑옷 */}
    <path d="M 22 66 Q 32 60 40 66 Q 33 74 22 72 Z" fill={PAL.gray[1]} />
    <path d="M 78 66 Q 68 60 60 66 Q 67 74 78 72 Z" fill={PAL.gray[2]} />
    <path d="M 22 66 Q 30 61 37 65 Q 30 67 22 68 Z" fill={PAL.gray[0]} opacity={0.8} />
    {/* 가슴 갑옷 */}
    <path d="M 36 70 Q 50 65 64 70 L 62 85 Q 50 90 38 85 Z" fill={PAL.gray[1]} />
    <path d="M 36 70 Q 43 67 50 66 L 50 88 Q 43 87 38 85 Z" fill={PAL.gray[0]} opacity={0.55} />
    <path d="M 36 70 Q 50 65 64 70 L 63.4 73 Q 50 68 36.6 73 Z" fill={PAL.gold[1]} />
    <Gem cx={50} cy={78} r={4.4} tone={PAL.sky} />
    {/* 투구 이마 밴드 */}
    <path d="M 27 40 Q 50 29 73 40 L 71.5 45.5 Q 50 35 28.5 45.5 Z" fill={PAL.gray[1]} />
    <path d="M 27 40 Q 50 29 73 40 L 72.4 42 Q 50 31.5 27.6 42 Z" fill={PAL.gold[1]} />
    <Gem cx={50} cy={35} r={4} tone={PAL.berry} />
    {/* 방패 */}
    <path d="M 12 62 Q 22 58 32 62 Q 32 80 22 87 Q 12 80 12 62 Z" fill={PAL.gray[1]} />
    <path d="M 12 62 Q 17 60 22 60 L 22 87 Q 12 80 12 62 Z" fill={PAL.gray[0]} opacity={0.6} />
    <path d="M 22 64 L 22 82 M 15 71 L 29 71" stroke={PAL.gold[1]} strokeWidth={2.6} strokeLinecap="round" />
    <Sparkle cx={84} cy={30} r={4.6} color={PAL.sky[0]} />
  </Art>
);

/** 꿀곰 — 황금 승급 + 꿀단지 + 흘러내리는 꿀. */
export const HoneyBear: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "꿀곰"}>
    <defs>
      <VGrad id={`hbear-aura${_gid}`} from={PAL.gold[0]} to={PAL.amber[2]} />
    </defs>
    <circle cx={50} cy={56} r={45} fill={`url(#hbear-aura${_gid})`} opacity={0.2} />
    <Aura color={PAL.amber[0]} />
    {bearBase({ fur: PAL.amber, belly: PAL.cream, inner: PAL.rose, eyeVariant: "happy" })}
    {/* 머리 위 꿀 방울 */}
    <path d="M 34 30 Q 50 22 66 30 Q 62 38 56 33 Q 50 40 44 33 Q 38 38 34 30 Z" fill={PAL.gold[1]} opacity={0.9} />
    <path d="M 40 28 Q 48 24 56 27 Q 48 26 40 28 Z" fill={PAL.gold[0]} />
    <circle cx={57} cy={41} r={2.6} fill={PAL.gold[1]} opacity={0.9} />
    {/* 꿀단지 */}
    <path d="M 66 76 Q 66 71 72 71 L 86 71 Q 92 71 92 76 L 90 90 Q 79 93 68 90 Z" fill={PAL.brown[1]} />
    <path d="M 66 76 Q 66 71 72 71 L 79 71 L 79 92 Q 72 92 68 90 Z" fill={PAL.brown[0]} opacity={0.55} />
    <rect x={64} y={68} width={30} height={5.5} rx={2.6} fill={PAL.brown[2]} />
    <path d="M 70 78 Q 79 74 88 78 L 87 83 Q 79 79 71 83 Z" fill={PAL.cream[0]} opacity={0.9} />
    <path d="M 88 78 Q 92 84 89 89" stroke={PAL.gold[1]} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Sparkle cx={20} cy={30} r={5.4} color={PAL.gold[0]} />
    <Sparkle cx={78} cy={26} r={3.8} color={PAL.amber[0]} opacity={0.9} />
  </Art>
  );
};

/* ══════════════════════ stage 4 — 판다 계열 ══════════════════════ */

/** 선판다 — 후광 + 음양 메달 + 대나무 잎 + 연꽃 방석. */
export const ZenPanda: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "선판다"}>
    <Aura color={PAL.mint[0]} />
    <Halo cx={50} cy={17} rx={21} ry={6} tone={PAL.mint} />
    {/* 연꽃 방석 */}
    <ellipse cx={50} cy={90} rx={31} ry={7} fill={PAL.rose[1]} opacity={0.5} />
    <path d="M 19 90 Q 27 80 35 90 Z" fill={PAL.rose[0]} />
    <path d="M 35 91 Q 43 79 50 91 Z" fill={PAL.rose[1]} />
    <path d="M 50 91 Q 57 79 65 91 Z" fill={PAL.rose[0]} />
    <path d="M 65 90 Q 73 80 81 90 Z" fill={PAL.rose[2]} opacity={0.9} />
    {bearBase({
      fur: PAL.white,
      belly: PAL.white,
      ear: PAL.charcoal,
      limb: PAL.charcoal,
      patch: PAL.charcoal,
      inner: PAL.gray,
      eyeVariant: "happy",
      shadow: 0.1,
    })}
    {/* 음양 메달 */}
    <circle cx={50} cy={77} r={8.4} fill={PAL.white[0]} />
    <path d="M 50 68.6 A 8.4 8.4 0 0 1 50 85.4 A 4.2 4.2 0 0 1 50 77 A 4.2 4.2 0 0 0 50 68.6 Z" fill={PAL.charcoal[1]} />
    <circle cx={50} cy={72.8} r={1.6} fill={PAL.charcoal[1]} />
    <circle cx={50} cy={81.2} r={1.6} fill={PAL.white[0]} />
    <circle cx={50} cy={77} r={8.4} fill="none" stroke={PAL.mint[2]} strokeWidth={1.6} opacity={0.8} />
    {/* 대나무 잎 */}
    <path d="M 14 88 L 14 56" stroke={PAL.leaf[2]} strokeWidth={3.4} strokeLinecap="round" />
    <Leaf cx={14} cy={60} r={9} rot={-40} tone={1} />
    <Leaf cx={14} cy={68} r={8} rot={-150} tone={0} />
    <Leaf cx={86} cy={62} r={8} rot={40} tone={2} />
    <Sparkle cx={80} cy={34} r={4.6} color={PAL.mint[0]} />
    <Sparkle cx={22} cy={38} r={3.4} color={PAL.mint[0]} opacity={0.85} />
  </Art>
);

/** 꿈판다 — 밤보라 오라 + 수면모자 + 별·구름. */
export const DreamPanda: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "꿈판다"}>
    <defs>
      <VGrad id={`dpanda-aura${_gid}`} from={PAL.violet[0]} to={PAL.night[0]} />
    </defs>
    <circle cx={50} cy={56} r={46} fill={`url(#dpanda-aura${_gid})`} opacity={0.24} />
    <Aura color={PAL.violet[0]} />
    {/* 구름 방석 */}
    <ellipse cx={50} cy={89} rx={28} ry={8} fill={PAL.white[0]} opacity={0.85} />
    <ellipse cx={30} cy={87} rx={11} ry={7} fill={PAL.white[0]} opacity={0.8} />
    <ellipse cx={70} cy={87} rx={11} ry={7} fill={PAL.gray[0]} opacity={0.8} />
    {bearBase({
      fur: PAL.white,
      belly: PAL.white,
      ear: PAL.charcoal,
      limb: PAL.charcoal,
      patch: PAL.charcoal,
      inner: PAL.violet,
      eyeVariant: "sleepy",
      shadow: 0.08,
    })}
    {/* 수면 모자 */}
    <path d="M 26 32 Q 34 12 54 11 Q 74 10 80 22 L 74 30 Q 50 20 27 38 Z" fill={PAL.violet[1]} />
    <path d="M 26 32 Q 34 12 54 11 Q 44 18 38 34 Z" fill={PAL.violet[0]} opacity={0.6} />
    <path d="M 24 34 Q 50 20 76 30 L 74 37 Q 50 27 26 41 Z" fill={PAL.white[0]} opacity={0.95} />
    <circle cx={84} cy={20} r={6} fill={PAL.white[0]} />
    <circle cx={82} cy={18} r={2.6} fill={PAL.gray[0]} opacity={0.7} />
    {/* 꿈 별 */}
    <Sparkle cx={18} cy={46} r={5} color={PAL.violet[0]} />
    <Sparkle cx={88} cy={52} r={4} color={PAL.white[0]} opacity={0.9} />
    <Sparkle cx={26} cy={62} r={3} color={PAL.violet[0]} opacity={0.8} />
  </Art>
  );
};

/* ══════════════════════ stage 4 — 부엉이 계열 ══════════════════════ */

/** 마도부엉이 — 마법사 모자 + 룬 원 + 떠 있는 마법 구슬. */
export const ArcaneOwl: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "마도부엉이"}>
    <defs>
      <VGrad id={`aowl-orb${_gid}`} from={PAL.violet[0]} to={PAL.night[1]} />
    </defs>
    <Aura color={PAL.violet[0]} />
    {/* 룬 원 */}
    <circle cx={50} cy={62} r={40} fill="none" stroke={PAL.violet[0]} strokeWidth={1.4} opacity={0.5} />
    <circle cx={50} cy={62} r={34} fill="none" stroke={PAL.violet[1]} strokeWidth={0.9} opacity={0.45} />
    {owlBase({ fur: PAL.night, belly: PAL.violet, inner: PAL.gold, eyeVariant: "sparkle", eyeColor: PAL.night[2] })}
    {/* 마법사 모자 */}
    <g transform="rotate(-7 50 32)">
      <path d="M 50 2 L 70 32 L 30 32 Z" fill={PAL.night[1]} />
      <path d="M 50 2 L 50 32 L 30 32 Z" fill={PAL.night[0]} opacity={0.7} />
      <ellipse cx={50} cy={32} rx={27} ry={6.5} fill={PAL.night[1]} />
      <ellipse cx={50} cy={31} rx={27} ry={6.5} fill={PAL.night[0]} opacity={0.55} />
      <path d="M 36 27 Q 50 22 64 27 L 63 32 Q 50 27 37 32 Z" fill={PAL.violet[1]} />
      <Sparkle cx={54} cy={16} r={4} color={PAL.gold[0]} />
      <Sparkle cx={44} cy={24} r={2.6} color={PAL.white[0]} opacity={0.9} />
    </g>
    {/* 마법 구슬 */}
    <circle cx={80} cy={74} r={11} fill={`url(#aowl-orb${_gid})`} />
    <circle cx={80} cy={74} r={11} fill={PAL.violet[1]} opacity={0.45} />
    <ellipse cx={76} cy={70} rx={4} ry={3} fill={PAL.white[0]} opacity={0.7} />
    <circle cx={80} cy={74} r={13.5} fill={PAL.violet[0]} opacity={0.18} />
    <Sparkle cx={18} cy={30} r={5} color={PAL.violet[0]} />
  </Art>
  );
};

/** 현자부엉이 — 금테 안경 + 두루마리 + 긴 눈썹. */
export const SageOwl: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "현자부엉이"}>
    <Aura color={PAL.gold[0]} />
    <Halo cx={50} cy={14} rx={19} ry={5} />
    {owlBase({ fur: PAL.cream, belly: PAL.white, inner: PAL.gold, eyeVariant: "happy" })}
    {/* 금테 안경 */}
    <circle cx={39} cy={49} r={10} fill={PAL.sky[0]} opacity={0.25} />
    <circle cx={61} cy={49} r={10} fill={PAL.sky[0]} opacity={0.25} />
    <circle cx={39} cy={49} r={10} fill="none" stroke={PAL.gold[1]} strokeWidth={2.4} />
    <circle cx={61} cy={49} r={10} fill="none" stroke={PAL.gold[1]} strokeWidth={2.4} />
    <path d="M 49 48 Q 50 45.5 51 48" stroke={PAL.gold[1]} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    <path d="M 29 47 L 22 43 M 71 47 L 78 43" stroke={PAL.gold[2]} strokeWidth={2} strokeLinecap="round" />
    {/* 긴 흰 눈썹 */}
    <path d="M 28 38 Q 38 31 48 37" stroke={PAL.white[0]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
    <path d="M 72 38 Q 62 31 52 37" stroke={PAL.white[0]} strokeWidth={3.4} strokeLinecap="round" fill="none" />
    {/* 두루마리 */}
    <rect x={70} y={72} width={22} height={15} rx={2} fill={PAL.cream[0]} transform="rotate(-10 81 79.5)" />
    <path d="M 74 77 L 88 74 M 74 81 L 88 78 M 74 85 L 83 83" stroke={INK_SOFT} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
    <ellipse cx={70} cy={81} rx={3.4} ry={8} fill={PAL.brown[1]} transform="rotate(-10 70 81)" />
    <ellipse cx={92} cy={77} rx={3.4} ry={8} fill={PAL.brown[2]} transform="rotate(-10 92 77)" />
    <Sparkle cx={18} cy={34} r={4.6} color={PAL.gold[0]} />
  </Art>
);

/* ══════════════════════ stage 4 — 늑대 계열 ══════════════════════ */

/** 달늑대 — 뒤에 뜬 달 + 이마 초승달 + 은청 승급 + 금빛 눈. */
export const LunarWolf: ArtFC = (p) => {
  const _gid = useId().replace(/:/g, "");
  return (
  <Art {...p} title={p.title ?? "달늑대"}>
    <defs>
      <VGrad id={`lwolf-aura${_gid}`} from={PAL.sky[0]} to={PAL.night[0]} />
    </defs>
    <circle cx={50} cy={54} r={46} fill={`url(#lwolf-aura${_gid})`} opacity={0.22} />
    {/* 달 */}
    <circle cx={50} cy={36} r={31} fill={PAL.cream[0]} opacity={0.4} />
    <circle cx={50} cy={36} r={31} fill="none" stroke={PAL.cream[1]} strokeWidth={1.4} opacity={0.6} />
    <circle cx={36} cy={24} r={5} fill={PAL.cream[2]} opacity={0.28} />
    <circle cx={64} cy={20} r={3.4} fill={PAL.cream[2]} opacity={0.24} />
    <circle cx={62} cy={34} r={4.2} fill={PAL.cream[2]} opacity={0.2} />
    {wolfBase({ fur: PAL.gray, belly: PAL.white, inner: PAL.night, eyeVariant: "sparkle", eyeColor: PAL.gold[2] })}
    {/* 이마 초승달 — 호(A)는 두 번째 반지름이 현보다 작으면 SVG 가 반지름을 키워
        보름달로 뭉개진다. 초승달은 굵기를 직접 통제할 수 있는 2차 곡선으로 그린다. */}
    <path d="M 48 29 Q 35 36 48 43 Q 43 36 48 29 Z" fill={PAL.gold[1]} />
    <Sparkle cx={16} cy={34} r={5} color={PAL.sky[0]} />
    <Sparkle cx={86} cy={28} r={4} color={PAL.white[0]} opacity={0.9} />
    <Sparkle cx={80} cy={48} r={3} color={PAL.sky[0]} opacity={0.8} />
  </Art>
  );
};

/** 영혼늑대 — 반투명 민트 승급 + 지면에서 살짝 떠 있고 꼬리가 혼불로 흩어진다. */
export const SpiritWolf: ArtFC = (p) => (
  <Art {...p} title={p.title ?? "영혼늑대"}>
    <Aura color={PAL.mint[0]} />
    <GroundShadow cx={50} cy={GROUND_Y + 2} rx={22} ry={4.5} opacity={0.1} />
    <g transform="translate(0,-5)" opacity={0.86}>
      {wolfBase({
        fur: PAL.mint,
        belly: PAL.white,
        inner: PAL.sky,
        eyeVariant: "sparkle",
        // 민트 얼굴에 민트 눈동자는 묻힌다 — 혼령의 텅 빈 눈은 밤색으로.
        eyeColor: PAL.night[1],
        shadow: 0,
      })}
    </g>
    {/* 흩어지는 혼불 */}
    <circle cx={14} cy={52} r={5} fill={PAL.mint[0]} opacity={0.55} />
    <circle cx={8} cy={62} r={3.4} fill={PAL.mint[0]} opacity={0.45} />
    <circle cx={18} cy={40} r={2.6} fill={PAL.white[0]} opacity={0.5} />
    <circle cx={86} cy={56} r={4} fill={PAL.mint[0]} opacity={0.4} />
    <circle cx={92} cy={46} r={2.4} fill={PAL.white[0]} opacity={0.4} />
    {/* 발밑 안개 */}
    <ellipse cx={50} cy={88} rx={28} ry={6} fill={PAL.mint[0]} opacity={0.3} />
    <ellipse cx={34} cy={86} rx={10} ry={4} fill={PAL.white[0]} opacity={0.28} />
    <ellipse cx={66} cy={87} rx={9} ry={3.6} fill={PAL.mint[0]} opacity={0.26} />
    <Sparkle cx={78} cy={26} r={4.6} color={PAL.mint[0]} />
    <Sparkle cx={22} cy={24} r={3.4} color={PAL.white[0]} opacity={0.8} />
  </Art>
);

/* ══════════════════════ 조회 테이블 ══════════════════════ */

/** 폼 키 → 아트. island.ts 의 PET_FORMS 23종(0~4단계)과 1:1. */
export const PET_ART: Record<string, ArtFC> = {
  egg: Egg,
  hatchling: Hatchling,
  sunny: Sunny,
  cozy: Cozy,
  moody: Moody,
  fox: Fox,
  cat: Cat,
  bear: Bear,
  panda: Panda,
  owl: Owl,
  wolf: Wolf,
  celestial_fox: CelestialFox,
  starlight_fox: StarlightFox,
  royal_cat: RoyalCat,
  lucky_cat: LuckyCat,
  guardian_bear: GuardianBear,
  honey_bear: HoneyBear,
  zen_panda: ZenPanda,
  dream_panda: DreamPanda,
  arcane_owl: ArcaneOwl,
  sage_owl: SageOwl,
  lunar_wolf: LunarWolf,
  spirit_wolf: SpiritWolf,
};

/** 폼 키로 아트 조회(없으면 알). */
export function petArt(form: string): ArtFC {
  return PET_ART[form] ?? Egg;
}
