"use client";

/* 홈 월드 소품 아트 — 우편함·표지판·나룻배·벤치일기·둥지알.
   계약은 parts.tsx 를 따른다(viewBox 100, 지면 y=92, 중심 x=50, 광원 좌상단, PAL).
   그라데이션을 쓰지 않아 useId 불필요(어디서든 여러 개 렌더 안전). 모션은 CSS 만. */

import { PAL, GroundShadow } from "./parts";

type P = { size?: number; title?: string };
const wrap = (title: string | undefined, fallback: string, children: React.ReactNode, size = 64) => (
  <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? fallback}>
    {children}
  </svg>
);

/** 우편함 — 쿡찌르기(마음 배달)의 집. */
export function Mailbox({ size, title }: P) {
  return wrap(
    title,
    "우편함",
    <>
      <GroundShadow cx={50} cy={92} rx={22} ry={4.4} opacity={0.22} />
      {/* 기둥 */}
      <rect x={46} y={56} width={8} height={36} rx={3} fill={PAL.brown[1]} />
      <rect x={46} y={56} width={3.5} height={36} rx={1.7} fill={PAL.brown[0]} opacity={0.7} />
      {/* 몸통(반원 지붕 통) */}
      <path d="M 24 34 L 68 34 C 77 34 84 41 84 50 L 84 58 L 24 58 Z" fill={PAL.rose[1]} />
      <path d="M 24 34 L 32 34 L 32 58 L 24 58 Z" fill={PAL.rose[0]} opacity={0.85} />
      <path d="M 68 34 C 77 34 84 41 84 50 L 84 58 L 72 58 C 74 48 73 40 68 34 Z" fill={PAL.rose[2]} opacity={0.7} />
      <path d="M 24 34 L 68 34 C 72 34 76 36 79 39 L 24 39 Z" fill={PAL.white[0]} opacity={0.35} />
      {/* 투입구 + 하트 */}
      <rect x={33} y={44} width={26} height={4.5} rx={2.2} fill={PAL.night[1]} opacity={0.55} />
      <path
        d="M 71 47 C 69.6 45.4 67.4 45.8 67.4 47.6 C 67.4 49.4 69.6 51 71 52 C 72.4 51 74.6 49.4 74.6 47.6 C 74.6 45.8 72.4 45.4 71 47 Z"
        fill={PAL.white[0]}
        opacity={0.9}
      />
      {/* 깃발 */}
      <rect x={26} y={22} width={4} height={14} rx={2} fill={PAL.gold[1]} />
      <path d="M 30 22 L 42 25.5 L 30 29 Z" fill={PAL.gold[1]} />
    </>,
    size,
  );
}

/** 표지판 — 다음 기념일을 가리킨다(캘린더 입구). */
export function Signpost({ size, title }: P) {
  return wrap(
    title,
    "표지판",
    <>
      <GroundShadow cx={50} cy={92} rx={20} ry={4.2} opacity={0.22} />
      <rect x={47} y={30} width={7} height={62} rx={3} fill={PAL.brown[1]} />
      <rect x={47} y={30} width={3} height={62} rx={1.5} fill={PAL.brown[0]} opacity={0.7} />
      {/* 화살 보드 2장(위: 오른쪽, 아래: 왼쪽) */}
      <path d="M 26 34 L 70 34 L 79 41 L 70 48 L 26 48 Z" fill={PAL.cream[1]} />
      <path d="M 26 34 L 70 34 L 73 36.5 L 26 36.5 Z" fill={PAL.white[0]} opacity={0.55} />
      <rect x={31} y={39} width={30} height={3.4} rx={1.7} fill={PAL.brown[2]} opacity={0.5} />
      <path d="M 74 52 L 32 52 L 23 59 L 32 66 L 74 66 Z" fill={PAL.cream[1]} />
      <rect x={38} y={57} width={26} height={3.4} rx={1.7} fill={PAL.brown[2]} opacity={0.4} />
      {/* 꼭대기 작은 하트 */}
      <path
        d="M 50.5 22 C 49 20.2 46.6 20.7 46.6 22.7 C 46.6 24.7 49 26.4 50.5 27.5 C 52 26.4 54.4 24.7 54.4 22.7 C 54.4 20.7 52 20.2 50.5 22 Z"
        fill={PAL.rose[1]}
      />
    </>,
    size,
  );
}

/** 나룻배 — 우리 섬으로 가는 배(게임 입구). */
export function RowBoat({ size, title }: P) {
  return wrap(
    title,
    "나룻배",
    <>
      <GroundShadow cx={50} cy={92} rx={30} ry={4.6} opacity={0.2} />
      {/* 노 */}
      <rect x={62} y={38} width={4} height={38} rx={2} fill={PAL.brown[1]} transform="rotate(24 64 57)" />
      <ellipse cx={73} cy={76} rx={6} ry={3.6} fill={PAL.brown[2]} transform="rotate(24 73 76)" />
      {/* 선체 */}
      <path d="M 16 62 L 84 62 C 80 76 68 84 50 84 C 32 84 20 76 16 62 Z" fill={PAL.brown[1]} />
      <path d="M 16 62 L 30 62 C 30 72 36 79 44 82.5 C 30 80 20 72 16 62 Z" fill={PAL.brown[0]} opacity={0.6} />
      <path d="M 84 62 L 70 62 C 70 72 62 80 52 83.4 C 68 82 80 73 84 62 Z" fill={PAL.brown[2]} opacity={0.7} />
      <rect x={14} y={59} width={72} height={6} rx={3} fill={PAL.brown[2]} />
      {/* 좌석 + 깃발 */}
      <rect x={34} y={64} width={32} height={5} rx={2.5} fill={PAL.brown[0]} opacity={0.8} />
      <rect x={48} y={34} width={3.5} height={27} rx={1.7} fill={PAL.gray[2]} />
      <path d="M 51.5 35 L 66 39 L 51.5 43 Z" fill={PAL.mint[1]} />
    </>,
    size,
  );
}

/** 벤치와 일기장 — 일기장 입구. */
export function BenchBook({ size, title }: P) {
  return wrap(
    title,
    "벤치와 일기장",
    <>
      <GroundShadow cx={50} cy={92} rx={28} ry={4.6} opacity={0.22} />
      {/* 벤치 다리 */}
      <rect x={24} y={66} width={6} height={26} rx={3} fill={PAL.brown[2]} />
      <rect x={70} y={66} width={6} height={26} rx={3} fill={PAL.brown[2]} />
      {/* 좌판 + 등받이 */}
      <rect x={16} y={60} width={68} height={9} rx={4.5} fill={PAL.brown[1]} />
      <rect x={16} y={60} width={68} height={3.6} rx={1.8} fill={PAL.brown[0]} opacity={0.7} />
      <rect x={18} y={40} width={64} height={7} rx={3.5} fill={PAL.brown[1]} />
      <rect x={22} y={47} width={4.5} height={13} rx={2.2} fill={PAL.brown[2]} />
      <rect x={73.5} y={47} width={4.5} height={13} rx={2.2} fill={PAL.brown[2]} />
      {/* 펼친 일기장 */}
      <path d="M 34 52 C 41 49 47 49 50 51 L 50 60 C 47 58 41 58 34 60 Z" fill={PAL.white[0]} />
      <path d="M 66 52 C 59 49 53 49 50 51 L 50 60 C 53 58 59 58 66 60 Z" fill={PAL.white[1]} />
      <rect x={38} y={53.4} width={8.5} height={1.6} rx={0.8} fill={PAL.gray[2]} opacity={0.7} />
      <rect x={38} y={56.2} width={7} height={1.6} rx={0.8} fill={PAL.gray[2]} opacity={0.5} />
      <path
        d="M 57.5 54.5 C 56.6 53.4 55.1 53.7 55.1 54.9 C 55.1 56.1 56.6 57.1 57.5 57.8 C 58.4 57.1 59.9 56.1 59.9 54.9 C 59.9 53.7 58.4 53.4 57.5 54.5 Z"
        fill={PAL.rose[1]}
      />
    </>,
    size,
  );
}

/** 둥지와 알 — 아직 펫이 없을 때(연동/시작 CTA). */
export function NestEgg({ size, title }: P) {
  return wrap(
    title,
    "둥지 속 알",
    <>
      <GroundShadow cx={50} cy={92} rx={26} ry={4.6} opacity={0.22} />
      {/* 알 */}
      <path d="M 50 30 C 62 30 68 44 68 56 C 68 68 60 75 50 75 C 40 75 32 68 32 56 C 32 44 38 30 50 30 Z" fill={PAL.white[0]} />
      <path d="M 50 30 C 62 30 68 44 68 56 C 68 68 60 75 50 75 C 58 70 62 60 58 44 C 56 37 53 32 50 30 Z" fill={PAL.gray[1]} opacity={0.45} />
      <ellipse cx={43} cy={44} rx={5} ry={7} fill={PAL.white[1]} opacity={0.8} />
      <circle cx={56} cy={52} r={2.6} fill={PAL.gold[1]} opacity={0.55} />
      <circle cx={45} cy={60} r={2} fill={PAL.rose[1]} opacity={0.5} />
      {/* 둥지 */}
      <path d="M 24 66 C 30 60 70 60 76 66 C 78 76 66 84 50 84 C 34 84 22 76 24 66 Z" fill={PAL.brown[1]} />
      <path d="M 24 66 C 34 62 66 62 76 66 C 70 64 30 64 24 66 Z" fill={PAL.brown[0]} />
      <path d="M 27 70 C 36 66 64 66 73 70" fill="none" stroke={PAL.brown[2]} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <path d="M 30 76 C 39 72 61 72 70 76" fill="none" stroke={PAL.brown[2]} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} />
    </>,
    size,
  );
}

/** 폴라로이드 사진 — '오늘의 우리'(순간 기록)의 상징. 월드의 매달린 폴라로이드와 한 세계. */
export function PhotoCard({ size, title }: P) {
  return wrap(
    title,
    "폴라로이드 사진",
    <>
      <GroundShadow cx={50} cy={92} rx={24} ry={4.2} opacity={0.2} />
      {/* 프레임(살짝 기운) */}
      <g transform="rotate(-7 50 58)">
        <rect x={26} y={26} width={48} height={58} rx={4} fill={PAL.white[0]} />
        <rect x={26} y={26} width={48} height={58} rx={4} fill={PAL.gray[2]} opacity={0.12} />
        {/* 사진(노을 풍경) */}
        <rect x={31} y={31} width={38} height={38} rx={2} fill={PAL.sky[1]} />
        <rect x={31} y={31} width={38} height={14} rx={2} fill={PAL.sky[0]} opacity={0.8} />
        <circle cx={60} cy={40} r={4.5} fill={PAL.gold[0]} />
        <path d="M 31 62 C 38 54 46 54 52 60 C 57 56 63 56 69 61 L 69 69 L 31 69 Z" fill={PAL.leaf[1]} />
        {/* 하단 여백에 하트 낙서 */}
        <path
          d="M 50 74.5 C 48.9 73.2 47.1 73.5 47.1 75 C 47.1 76.4 48.9 77.7 50 78.5 C 51.1 77.7 52.9 76.4 52.9 75 C 52.9 73.5 51.1 73.2 50 74.5 Z"
          fill={PAL.rose[1]}
        />
      </g>
      {/* 집게핀 */}
      <rect x={46} y={18} width={8} height={10} rx={2.5} fill={PAL.gold[1]} transform="rotate(-7 50 23)" />
    </>,
    size,
  );
}

/** 러브레터 — '오늘의 질문'(마음을 묻고 답하는) 봉투. 우편함과 같은 우편 세계관. */
export function LoveLetter({ size, title }: P) {
  return wrap(
    title,
    "러브레터",
    <>
      <GroundShadow cx={50} cy={92} rx={25} ry={4.2} opacity={0.2} />
      {/* 봉투 몸통 */}
      <rect x={22} y={38} width={56} height={40} rx={5} fill={PAL.cream[0]} />
      <rect x={22} y={38} width={56} height={40} rx={5} fill={PAL.cream[2]} opacity={0.18} />
      {/* 안쪽 편지(살짝 삐져나옴) */}
      <rect x={28} y={32} width={44} height={14} rx={2.5} fill={PAL.white[0]} />
      <rect x={33} y={36} width={22} height={2} rx={1} fill={PAL.gray[2]} opacity={0.55} />
      <rect x={33} y={40} width={15} height={2} rx={1} fill={PAL.gray[2]} opacity={0.4} />
      {/* 봉투 플랩 */}
      <path d="M 22 43 L 50 64 L 78 43 L 78 78 L 22 78 Z" fill={PAL.cream[1]} />
      <path d="M 22 43 L 50 64 L 78 43" fill="none" stroke={PAL.brown[2]} strokeWidth={1.6} opacity={0.25} />
      {/* 하트 씰 */}
      <circle cx={50} cy={62} r={7.5} fill={PAL.rose[1]} />
      <circle cx={50} cy={62} r={7.5} fill={PAL.rose[2]} opacity={0.25} />
      <path
        d="M 50 59.6 C 48.7 58.1 46.6 58.5 46.6 60.2 C 46.6 61.8 48.7 63.3 50 64.3 C 51.3 63.3 53.4 61.8 53.4 60.2 C 53.4 58.5 51.3 58.1 50 59.6 Z"
        fill={PAL.white[0]}
      />
    </>,
    size,
  );
}
