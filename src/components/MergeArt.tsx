"use client";

/* 정원 합치기 타일 그림 — 13단계 식재료를 **벡터로** 직접 그렸다(100×100 좌표).
 * [사용자 2026-10-31 "이미지 도트 해상도좀 많이 올려봐 눈이 많이아파" · "레벨이 높아질수록 더 멋있고 희귀해야 … 트러플이라던가"]
 *
 * 예전엔 섬의 24×24 작물 도트를 늘려 써서 칸(약 76px)에서 뭉개졌다. 벡터라 어떤 크기·화면 배율에서도 선이 또렷하다.
 * 단계 = 희귀도: 흔한 채소(상추 · 당근 · 딸기 · 옥수수) → 귀한 산물(표고 · 인삼 · 송이) → 진귀품(사프란 · 블랙 트러플 ·
 * 루비로망 포도) → 전설(화이트 트러플 · 천종산삼 · 불로초). 높은 단계일수록 금테 · 광채 · 보석 같은 반사를 더한다.
 *
 * ⚠ 그라데이션 id 는 useId 로 — 같은 그림이 판 · 사다리 · 순위에 동시에 그려지면 고정 id 는 서로를 덮는다(README §14.5).
 * ⚠ JSX 로만 그린다(함수 직접 호출 금지 — 안쪽 useId 가 부모 훅 순서에 섞인다).
 */

import { useId, type ReactNode } from "react";

type P = { id: string };

/** 공용: 바닥 그림자 · 반짝이 별 */
const Shadow = ({ w = 30, y = 90 }: { w?: number; y?: number }) => <ellipse cx="50" cy={y} rx={w} ry="4" fill="#000" opacity=".18" />;
const Star = ({ x, y, r = 4, c = "#fff" }: { x: number; y: number; r?: number; c?: string }) => (
  <path d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`} fill={c} />
);

function Lettuce({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#d8f7a0" /><stop offset="1" stopColor="#5fae3a" /></radialGradient>
        <radialGradient id={`${id}b`} cx=".5" cy=".3" r=".8"><stop offset="0" stopColor="#efffc8" /><stop offset="1" stopColor="#8fd35a" /></radialGradient>
      </defs>
      <Shadow w={28} />
      <path d="M18 62C10 46 22 30 36 34C38 20 58 16 66 30C80 26 92 42 84 58C88 74 70 86 50 86C30 86 14 78 18 62Z" fill={`url(#${id}a)`} stroke="#2f6b1f" strokeWidth="2.5" />
      <path d="M30 64C28 50 40 42 50 46C58 38 72 44 70 58C72 70 60 78 50 78C40 78 31 74 30 64Z" fill={`url(#${id}b)`} stroke="#3f8a2a" strokeWidth="2" />
      <path d="M50 78V50M50 62L40 54M50 66L60 56M50 56L44 48M50 58L57 49" stroke="#5aa236" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M24 52C26 46 30 43 34 43M70 36C74 36 78 39 80 43" stroke="#fff" strokeOpacity=".6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
}

function Carrot({ id }: P) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" x2="1"><stop offset="0" stopColor="#ffb05a" /><stop offset=".55" stopColor="#ff8a1f" /><stop offset="1" stopColor="#d9580a" /></linearGradient>
      </defs>
      <Shadow w={22} y={92} />
      <path d="M44 26C40 16 30 10 22 12C28 18 34 22 40 28Z" fill="#4caf3c" stroke="#2c6e22" strokeWidth="2" />
      <path d="M50 24C50 12 56 6 62 6C60 14 58 20 54 26Z" fill="#5cc246" stroke="#2c6e22" strokeWidth="2" />
      <path d="M56 28C64 20 74 20 80 24C72 28 66 30 58 32Z" fill="#4caf3c" stroke="#2c6e22" strokeWidth="2" />
      <path d="M34 34C40 26 62 24 68 34C72 42 62 64 52 86C50 90 46 90 45 86C38 64 28 42 34 34Z" fill={`url(#${id}a)`} stroke="#9a3d05" strokeWidth="2.5" />
      <path d="M40 44H50M44 56H54M46 68H53M48 78H52" stroke="#b5500c" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 36C42 32 46 31 50 31" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function Strawberry({ id }: P) {
  const seeds = [[38, 44], [50, 42], [62, 44], [33, 56], [45, 54], [57, 55], [67, 56], [40, 66], [52, 66], [62, 66], [46, 76], [56, 76]];
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ff7b8a" /><stop offset=".6" stopColor="#e8203e" /><stop offset="1" stopColor="#a10f28" /></radialGradient>
      </defs>
      <Shadow w={24} />
      <path d="M50 88C34 80 22 62 24 46C26 34 38 30 50 34C62 30 74 34 76 46C78 62 66 80 50 88Z" fill={`url(#${id}a)`} stroke="#7a0a1d" strokeWidth="2.5" />
      {seeds.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="1.8" ry="2.6" fill="#ffe27a" stroke="#c99a1c" strokeWidth=".6" />)}
      <path d="M50 36L40 26L44 34L32 32L42 38L50 36L58 38L68 32L56 34L60 26Z" fill="#46b03a" stroke="#246b1c" strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 30V18" stroke="#2f7d24" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 48C33 42 37 39 42 39" stroke="#fff" strokeOpacity=".75" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function Corn({ id }: P) {
  const rows: ReactNode[] = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) rows.push(<rect key={`${r}-${c}`} x={39 + c * 6} y={22 + r * 8} width="5.2" height="7" rx="2.4" fill={(r + c) % 2 ? "#ffd84a" : "#ffe680"} stroke="#c99212" strokeWidth=".8" />);
  return (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" x2="1"><stop offset="0" stopColor="#8fd65e" /><stop offset="1" stopColor="#3f8f2c" /></linearGradient>
      </defs>
      <Shadow w={22} />
      <path d="M48 18C38 18 34 34 35 52C36 70 42 82 50 84C58 82 64 70 65 52C66 34 62 18 52 18Z" fill="#ffd23a" stroke="#a87908" strokeWidth="2.5" />
      {rows}
      <path d="M50 88C34 84 22 66 26 42C30 58 38 70 50 76Z" fill={`url(#${id}a)`} stroke="#2c6e22" strokeWidth="2.2" />
      <path d="M50 88C66 84 78 66 74 42C70 58 62 70 50 76Z" fill={`url(#${id}a)`} stroke="#2c6e22" strokeWidth="2.2" />
      <path d="M46 16C46 10 50 6 54 6C52 10 52 14 52 18" stroke="#c9a25a" strokeWidth="2" fill="none" />
    </>
  );
}

function Shiitake({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#b07a4c" /><stop offset=".7" stopColor="#6e4220" /><stop offset="1" stopColor="#4a2a12" /></radialGradient>
        <linearGradient id={`${id}b`} x1="0" x2="1"><stop offset="0" stopColor="#fff6e6" /><stop offset="1" stopColor="#e2cba8" /></linearGradient>
      </defs>
      <Shadow w={24} />
      <path d="M42 56C42 70 40 80 38 86H62C60 80 58 70 58 56Z" fill={`url(#${id}b)`} stroke="#9c7a4c" strokeWidth="2.2" />
      <path d="M14 56C14 32 32 18 50 18C68 18 86 32 86 56C86 62 74 64 50 64C26 64 14 62 14 56Z" fill={`url(#${id}a)`} stroke="#3a200c" strokeWidth="2.5" />
      <path d="M26 44L34 40M40 30L48 33M58 28L64 34M70 42L76 46M32 52L40 50M56 46L64 50M46 42L52 44" stroke="#f1dcc0" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24 40C28 30 36 25 44 23" stroke="#fff" strokeOpacity=".45" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

function Ginseng({ id, wild = false }: P & { wild?: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" x2="1"><stop offset="0" stopColor={wild ? "#fff7da" : "#fbe9c4"} /><stop offset="1" stopColor={wild ? "#d9b46a" : "#cf9f5c"} /></linearGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#7dffcf" stopOpacity=".75" /><stop offset="1" stopColor="#7dffcf" stopOpacity="0" /></radialGradient>
      </defs>
      {wild && <circle cx="50" cy="52" r="46" fill={`url(#${id}g)`} />}
      <Shadow w={20} y={93} />
      {/* 잎(오엽) + 붉은 열매 */}
      {[-60, -25, 0, 25, 60].map((a, i) => (
        <ellipse key={i} cx="50" cy="14" rx="4.5" ry="10" fill="#4fb84a" stroke="#246b1c" strokeWidth="1.5" transform={`rotate(${a} 50 24)`} />
      ))}
      <circle cx="50" cy="22" r="5" fill="#e02a3a" stroke="#8a0f1c" strokeWidth="1.5" />
      <circle cx="46" cy="20" r="2.4" fill="#ff5a6a" /><circle cx="54" cy="21" r="2.4" fill="#ff5a6a" />
      <path d="M50 26V34" stroke="#3a7a2a" strokeWidth="2.5" />
      {/* 사람 모양 뿌리 — 머리 · 몸 · 팔 · 다리 */}
      <path d="M44 34C44 30 56 30 56 34C60 40 60 52 56 58C60 66 66 76 70 86M56 58C54 70 54 80 56 90M44 58C46 70 44 80 40 90M44 58C40 66 34 74 28 82M44 34C40 40 40 52 44 58Z" fill="none" stroke={`url(#${id}a)`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 34C40 40 40 52 44 58C48 60 52 60 56 58C60 52 60 40 56 34C52 32 48 32 44 34Z" fill={`url(#${id}a)`} stroke="#8a6232" strokeWidth="2" />
      <path d="M45 40H55M45 46H55M46 52H54" stroke="#a87a42" strokeWidth="1.4" />
      <path d="M58 64C64 66 72 64 78 60M42 66C36 70 28 70 22 66" stroke="#c99a5a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {wild && <><Star x={20} y={30} r={4} c="#d6fff0" /><Star x={82} y={40} r={5} c="#fffbe0" /><Star x={76} y={78} r={3} c="#d6fff0" /></>}
    </>
  );
}

function Matsutake({ id }: P) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" x2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset=".6" stopColor="#f0e2c8" /><stop offset="1" stopColor="#c9ab80" /></linearGradient>
        <radialGradient id={`${id}b`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#a8683a" /><stop offset="1" stopColor="#5a2e12" /></radialGradient>
      </defs>
      <Shadow w={26} y={91} />
      {/* 솔잎 바닥 */}
      <path d="M18 88L34 80M26 90L44 82M60 82L80 88M66 80L84 84M40 86L58 80" stroke="#3f7a3a" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 34C36 50 34 70 36 86H64C66 70 64 50 62 34Z" fill={`url(#${id}a)`} stroke="#8a6a40" strokeWidth="2.5" />
      <path d="M40 46L44 48M56 52L60 50M42 64L46 66M54 72L58 70" stroke="#b08c5c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30 36C30 22 40 14 50 14C60 14 70 22 70 36C70 40 62 42 50 42C38 42 30 40 30 36Z" fill={`url(#${id}b)`} stroke="#3e1e08" strokeWidth="2.5" />
      <path d="M36 28C38 22 42 19 47 18M44 32L48 30M54 26L58 28M60 34L63 33" stroke="#e9c79c" strokeWidth="2" strokeLinecap="round" />
      <Star x={76} y={22} r={4} />
    </>
  );
}

function Saffron({ id }: P) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9b8ff" /><stop offset="1" stopColor="#7a3fd1" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4a2a" /><stop offset="1" stopColor="#b8160c" /></linearGradient>
      </defs>
      <Shadow w={22} y={92} />
      <path d="M50 60V90" stroke="#3f8a2a" strokeWidth="3.5" />
      <path d="M50 88C42 80 36 70 34 62M50 88C58 80 64 70 66 62" stroke="#5cb84a" strokeWidth="2.5" fill="none" />
      {/* 꽃잎 여섯 */}
      {[-70, -35, 0, 35, 70].map((a, i) => (
        <path key={i} d="M50 58C40 46 40 26 50 14C60 26 60 46 50 58Z" fill={`url(#${id}a)`} stroke="#4a1d8a" strokeWidth="2" transform={`rotate(${a} 50 58)`} />
      ))}
      <path d="M50 58C44 50 44 34 50 26C56 34 56 50 50 58Z" fill="#b48aff" stroke="#4a1d8a" strokeWidth="2" />
      {/* 붉은 암술 실(사프란) */}
      <path d="M50 56C46 44 42 36 36 30M50 56C50 44 50 34 50 24M50 56C54 44 58 36 64 30" stroke={`url(#${id}s)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="29" r="2.6" fill="#ff6a2a" /><circle cx="50" cy="23" r="2.6" fill="#ff6a2a" /><circle cx="64" cy="29" r="2.6" fill="#ff6a2a" />
      <Star x={20} y={24} r={4} c="#ffe9a8" /><Star x={82} y={48} r={3.5} c="#ffe9a8" />
    </>
  );
}

/** 울퉁불퉁한 덩이(트러플) — 원 둘레에 혹을 단 경로 */
function lumpPath(cx: number, cy: number, r: number, bumps: number, amp: number, phase = 0) {
  const pts: string[] = [];
  const n = bumps * 6;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = r + amp * Math.sin(t * bumps + phase) + amp * 0.5 * Math.sin(t * (bumps * 2 + 1));
    pts.push(`${(cx + rr * Math.cos(t)).toFixed(1)} ${(cy + rr * Math.sin(t) * 0.88).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

function BlackTruffle({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".38" cy=".32" r=".8"><stop offset="0" stopColor="#6b5a6e" /><stop offset=".55" stopColor="#2a2030" /><stop offset="1" stopColor="#120c16" /></radialGradient>
        <radialGradient id={`${id}c`} cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#5a4636" /><stop offset="1" stopColor="#2a1d14" /></radialGradient>
      </defs>
      <Shadow w={30} y={88} />
      <path d={lumpPath(44, 52, 30, 7, 2.6)} fill={`url(#${id}a)`} stroke="#000" strokeWidth="2.5" />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180, rr = 6 + ((i * 7) % 20);
        return <path key={i} d={`M${44 + rr * Math.cos(a)} ${52 + rr * Math.sin(a) * 0.88}l2 -1.6l2 1.6l-2 1.6z`} fill="#4c3d52" />;
      })}
      {/* 자른 단면 — 대리석 무늬 */}
      <ellipse cx="72" cy="70" rx="16" ry="12" fill={`url(#${id}c)`} stroke="#000" strokeWidth="2" />
      <path d="M60 68C64 64 68 72 72 66C76 62 80 70 84 66M62 74C66 72 70 78 76 74C80 72 82 76 84 74" stroke="#e8d6c0" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M26 40C30 32 38 28 46 28" stroke="#fff" strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Star x={20} y={22} r={5} c="#e6d0ff" /><Star x={82} y={34} r={4} c="#fff" />
    </>
  );
}

function RubyGrape({ id }: P) {
  const g: [number, number, number][] = [[38, 34, 9], [52, 32, 9], [66, 36, 9], [32, 48, 9], [46, 47, 9.5], [60, 48, 9.5], [72, 50, 8], [38, 62, 9], [52, 62, 9.5], [64, 63, 9], [45, 76, 8.5], [58, 76, 8.5], [51, 88, 7]];
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".32" cy=".28" r=".75"><stop offset="0" stopColor="#ff9aa8" /><stop offset=".35" stopColor="#e8193c" /><stop offset="1" stopColor="#6a0414" /></radialGradient>
        <linearGradient id={`${id}t`} x1="0" x2="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset="1" stopColor="#d9a520" /></linearGradient>
      </defs>
      <path d="M52 24C52 16 56 10 62 8" stroke="#6a4a22" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M56 18C64 10 78 12 82 18C74 22 64 22 56 18Z" fill="#4caf3c" stroke="#246b1c" strokeWidth="2" />
      {g.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={`url(#${id}a)`} stroke="#4a0210" strokeWidth="1.8" />
          <ellipse cx={x - r * 0.35} cy={y - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill="#fff" opacity=".85" />
        </g>
      ))}
      {/* 품질 인증 금꼬리표 */}
      <path d="M14 16H34L38 22L34 28H14Z" fill={`url(#${id}t)`} stroke="#8a6408" strokeWidth="1.6" />
      <circle cx="18" cy="22" r="2" fill="#8a6408" />
      <Star x={84} y={44} r={5} /><Star x={18} y={66} r={4} c="#ffd6de" />
    </>
  );
}

function WhiteTruffle({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".38" cy=".3" r=".8"><stop offset="0" stopColor="#fffbea" /><stop offset=".55" stopColor="#ecd8a8" /><stop offset="1" stopColor="#b8945a" /></radialGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c0213a" /><stop offset="1" stopColor="#6a0c1e" /></linearGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff3b0" stopOpacity=".9" /><stop offset="1" stopColor="#ffd35c" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="50" cy="48" r="46" fill={`url(#${id}g)`} />
      {/* 벨벳 방석 + 금술 */}
      <path d="M12 74C14 66 30 62 50 62C70 62 86 66 88 74C86 84 70 88 50 88C30 88 14 84 12 74Z" fill={`url(#${id}v)`} stroke="#3e0510" strokeWidth="2" />
      <path d="M16 74C30 80 70 80 84 74" stroke="#ffd35c" strokeWidth="2" fill="none" strokeDasharray="3 3" />
      <circle cx="14" cy="76" r="3" fill="#ffd35c" /><circle cx="86" cy="76" r="3" fill="#ffd35c" />
      <path d={lumpPath(50, 50, 24, 5, 3.4, 1.1)} fill={`url(#${id}a)`} stroke="#7a5a2a" strokeWidth="2.5" />
      <path d="M38 44C42 40 46 46 50 42M52 54C56 50 60 56 64 52M40 58C44 56 46 60 50 58" stroke="#c9a46a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M34 40C36 34 42 30 48 30" stroke="#fff" strokeOpacity=".85" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* 작은 왕관 */}
      <path d="M40 22L44 14L50 20L56 14L60 22Z" fill="#ffd35c" stroke="#8a6408" strokeWidth="1.6" strokeLinejoin="round" />
      <Star x={16} y={30} r={5} c="#fff6c8" /><Star x={84} y={26} r={6} c="#fff" /><Star x={80} y={56} r={3.5} c="#fff6c8" />
    </>
  );
}

function Lingzhi({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".4" cy=".3" r=".85"><stop offset="0" stopColor="#ff8a5a" /><stop offset=".45" stopColor="#c2261c" /><stop offset="1" stopColor="#5a0a08" /></radialGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff0a0" stopOpacity=".95" /><stop offset=".6" stopColor="#ffb84d" stopOpacity=".35" /><stop offset="1" stopColor="#ff6a8a" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}s`} x1="0" x2="1"><stop offset="0" stopColor="#7a2a10" /><stop offset="1" stopColor="#3a0e04" /></linearGradient>
      </defs>
      <circle cx="50" cy="48" r="48" fill={`url(#${id}g)`} />
      {/* 상서로운 구름 */}
      <path d="M8 82C8 76 16 74 20 78C22 72 32 72 34 78C38 76 42 80 40 84H10Z" fill="#fff" opacity=".9" stroke="#e8c0d0" strokeWidth="1.2" />
      <path d="M62 86C62 80 70 78 74 82C76 76 86 76 88 82C92 80 96 84 94 88H64Z" fill="#fff" opacity=".9" stroke="#e8c0d0" strokeWidth="1.2" />
      <path d="M48 52C46 64 50 76 56 88" stroke={`url(#${id}s)`} strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* 콩팥형 갓 + 나이테 */}
      <path d="M14 46C12 28 30 14 52 16C74 18 90 30 86 46C84 54 72 58 58 54C52 52 48 52 42 56C30 60 16 56 14 46Z" fill={`url(#${id}a)`} stroke="#3a0604" strokeWidth="2.5" />
      <path d="M22 44C22 32 36 24 52 24C68 24 80 32 78 44" stroke="#ffb08a" strokeWidth="2" fill="none" opacity=".75" />
      <path d="M30 44C30 36 40 30 52 30C64 30 72 36 70 44" stroke="#ffd3a8" strokeWidth="2" fill="none" opacity=".75" />
      <path d="M38 44C40 38 46 36 52 36C58 36 62 40 62 44" stroke="#fff0c8" strokeWidth="2" fill="none" opacity=".85" />
      <path d="M22 34C26 26 34 21 42 20" stroke="#fff" strokeOpacity=".8" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Star x={12} y={18} r={5} c="#fff6c8" /><Star x={88} y={14} r={6} c="#fff" /><Star x={90} y={62} r={4} c="#ffe0f0" /><Star x={30} y={66} r={3} c="#fff6c8" />
    </>
  );
}

const ART: Record<string, (p: P) => ReactNode> = {
  lettuce: (p) => <Lettuce {...p} />,
  carrot: (p) => <Carrot {...p} />,
  strawberry: (p) => <Strawberry {...p} />,
  corn: (p) => <Corn {...p} />,
  shiitake: (p) => <Shiitake {...p} />,
  ginseng: (p) => <Ginseng {...p} />,
  matsutake: (p) => <Matsutake {...p} />,
  saffron: (p) => <Saffron {...p} />,
  black_truffle: (p) => <BlackTruffle {...p} />,
  ruby_grape: (p) => <RubyGrape {...p} />,
  white_truffle: (p) => <WhiteTruffle {...p} />,
  wild_ginseng: (p) => <Ginseng {...p} wild />,
  lingzhi: (p) => <Lingzhi {...p} />,
};
export const MERGE_ART_KEYS = Object.keys(ART);

/** 합치기 타일 그림 — 크기는 부모가 정한다(width/height 100%). */
export default function MergeArt({ k, size, className }: { k: string; size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const draw = ART[k] ?? ART.lettuce;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden focusable="false">
      {draw({ id })}
    </svg>
  );
}
