"use client";

/* 정원 합치기 12 · 15~17단계 임시 벡터 그림 — 진짜 그림(public/merge/<key>.webp)은 다른 세션이 그린다(2026-11-01).
 * 파일이 들어오면 lib/mergeimages 목록에 key 를 더하는 순간 이 그림은 안 쓰인다. 그때까지 칸이 비거나 상추로 보이지 않게만 둔다.
 * 단계가 오를수록 빛무리 · 빛줄기 · 별을 늘려 '더 귀하다'가 그림에서도 보이게 했다.
 * ⚠ 그라데이션 id 는 부모(MergeArt)의 useId 로 받는다 — 같은 그림이 여러 번 그려져도 안 섞인다. */

type P = { id: string };

const Star = ({ x, y, r = 4, c = "#fff" }: { x: number; y: number; r?: number; c?: string }) => (
  <path d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`} fill={c} />
);

/** 빛줄기 — 가운데에서 n갈래(정적인 부채꼴) */
const Rays = ({ n, c, o = 0.5, r = 50 }: { n: number; c: string; o?: number; r?: number }) => (
  <g opacity={o}>
    {Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n / 2.2;
      const p = (t: number) => `${(50 + r * Math.cos(t)).toFixed(1)} ${(50 + r * Math.sin(t)).toFixed(1)}`;
      return <path key={i} d={`M50 50L${p(a - w)}L${p(a + w)}Z`} fill={c} />;
    })}
  </g>
);

/** 무등산수박(12 · 전설) — 줄무늬 없는 진초록 껍질의 큰 타원(실물), 볏짚 똬리 위 */
export function MudeungWatermelon({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#5fa84a" /><stop offset=".45" stopColor="#1f5a24" /><stop offset="1" stopColor="#0a2a10" /></radialGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#d6ffb0" stopOpacity=".9" /><stop offset="1" stopColor="#8fe05a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}g)`} />
      <Rays n={10} c="#f4ffd0" o={0.35} />
      <ellipse cx="50" cy="82" rx="34" ry="8" fill="#e8c46a" stroke="#8a6420" strokeWidth="2" />
      <ellipse cx="50" cy="52" rx="38" ry="31" fill={`url(#${id}a)`} stroke="#04160a" strokeWidth="2.5" />
      <ellipse cx="34" cy="36" rx="14" ry="7" fill="#fff" opacity=".28" transform="rotate(-20 34 36)" />
      <ellipse cx="30" cy="34" rx="5" ry="2.6" fill="#fff" opacity=".7" transform="rotate(-20 30 34)" />
      <path d="M50 21C50 15 54 11 58 10" stroke="#5a3a12" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Star x={14} y={26} r={5} c="#fffbe0" /><Star x={86} y={30} r={6} /><Star x={84} y={64} r={4} c="#e8ffd0" />
    </>
  );
}

/** 천도복숭아(15 · 선계) — 홈 파인 분홍 복숭아 + 구름 · 분홍 빛무리 */
export function ImmortalPeach({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}a`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#fff2f4" /><stop offset=".45" stopColor="#ff9ab5" /><stop offset="1" stopColor="#d23a6a" /></radialGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffe0ec" /><stop offset=".6" stopColor="#ff9ec7" stopOpacity=".45" /><stop offset="1" stopColor="#ff9ec7" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#${id}g)`} />
      <Rays n={12} c="#fff0f6" o={0.45} />
      <path d="M6 86C6 79 15 77 19 81C21 74 33 74 35 80C40 78 45 82 43 87H8Z" fill="#fff" stroke="#f3c0d6" strokeWidth="1.3" />
      <path d="M58 88C58 81 67 79 71 83C73 76 85 76 87 82C92 80 97 84 95 89H60Z" fill="#fff" stroke="#f3c0d6" strokeWidth="1.3" />
      <path d="M50 20C38 20 22 32 22 52C22 70 36 82 50 82C64 82 78 70 78 52C78 32 62 20 50 20Z" fill={`url(#${id}a)`} stroke="#8a1a3e" strokeWidth="2.5" />
      <path d="M50 22C46 36 46 62 50 80" stroke="#c22a5a" strokeWidth="2.2" fill="none" opacity=".7" />
      <path d="M53 12C40 4 28 10 26 18C36 20 46 18 53 12Z" fill="#5cc246" stroke="#246b1c" strokeWidth="1.8" />
      <ellipse cx="36" cy="40" rx="7" ry="10" fill="#fff" opacity=".55" transform="rotate(20 36 40)" />
      <Star x={12} y={14} r={5} /><Star x={88} y={22} r={6} c="#fff0f6" /><Star x={90} y={56} r={4} />
    </>
  );
}

/** 월궁 계수열매(16 · 천계) — 밤하늘 · 초승달 · 은빛 열매 */
export function MoonLaurel({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}b`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#2a3a7a" /><stop offset="1" stopColor="#0a1030" /></radialGradient>
        <radialGradient id={`${id}a`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#cfe4ff" /><stop offset="1" stopColor="#7a9ad8" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}b)`} />
      <Rays n={16} c="#cfe0ff" o={0.35} />
      <path d="M70 14A26 26 0 1 0 86 52A20 20 0 1 1 70 14Z" fill="#fff6c8" stroke="#d6b44a" strokeWidth="1.4" />
      <path d="M18 74C30 64 40 56 50 50" stroke="#c8d6f0" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {[[52, 52, 11], [64, 62, 9], [46, 66, 8]].map(([x, y, r], i) => (
        <g key={i}><circle cx={x} cy={y} r={r} fill={`url(#${id}a)`} stroke="#4a62a8" strokeWidth="1.8" /><ellipse cx={x - r * 0.35} cy={y - r * 0.38} rx={r * 0.3} ry={r * 0.2} fill="#fff" /></g>
      ))}
      {[[12, 20, 4], [26, 10, 3], [88, 74, 4], [14, 44, 3], [76, 88, 3]].map(([x, y, r], i) => <Star key={i} x={x} y={y} r={r} c="#f0f6ff" />)}
    </>
  );
}

/** 세계수의 씨앗(17 · 태초) — 금빛 씨앗에서 솟는 작은 세계수, 무지갯빛 빛무리 · 두 겹 빛줄기 */
export function WorldSeed({ id }: P) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fffbe0" /><stop offset=".35" stopColor="#ffd35c" stopOpacity=".75" /><stop offset=".7" stopColor="#b07aff" stopOpacity=".35" /><stop offset="1" stopColor="#5fe0ff" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}a`} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#fffbe0" /><stop offset=".4" stopColor="#ffd35c" /><stop offset="1" stopColor="#a8700c" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id}g)`} />
      <Rays n={20} c="#fff6c8" o={0.55} />
      <Rays n={10} c="#e0c8ff" o={0.3} r={46} />
      <path d="M50 52C49 40 50 30 50 22" stroke="#4a8a3a" strokeWidth="4" strokeLinecap="round" fill="none" />
      {[[34, 24, 8], [50, 16, 10], [66, 20, 8], [42, 18, 7], [58, 14, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#7ae08a" : "#5fd06a"} stroke="#2a7a3a" strokeWidth="1.4" />)}
      <path d="M50 46C36 46 28 58 30 70C32 82 42 88 50 88C58 88 68 82 70 70C72 58 64 46 50 46Z" fill={`url(#${id}a)`} stroke="#6a4400" strokeWidth="2.5" />
      <path d="M38 58C40 54 44 52 48 51" stroke="#fff" strokeOpacity=".9" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="68" rx="30" ry="9" fill="none" stroke="#fff3b0" strokeWidth="1.6" strokeDasharray="2 3" />
      <Star x={10} y={30} r={5} /><Star x={90} y={24} r={6} c="#ffe9a8" /><Star x={12} y={74} r={4} c="#d6c8ff" /><Star x={88} y={70} r={5} c="#c8f6ff" />
    </>
  );
}
