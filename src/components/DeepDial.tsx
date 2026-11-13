"use client";

/* 심해 릴 다이얼(2026-11-13 다시 그림) [사용자: "심해의 릴 돌리는 릴의 이미지가 너무 퀄리티가 낮아"]
 * 예전엔 납작한 원 몇 개였다 — 바늘이 반투명 스풀 밑에 깔려 손잡이가 둘인 것처럼 보였고, 어두운 트랙은 깊은 물에 묻혔다.
 * 지금: 금속 스풀(그라디언트 · 테 · 감긴 줄 · 구멍 · 별 손잡이) · 굵어지는 손잡이 팔 · 노란 손잡이 공 · 눈금 · 바늘은 스풀 위.
 *
 * 성능 — 손가락이 움직일 때마다 2,200줄짜리 FishingGame 을 다시 그리지 않는다. 도는 각도는 turn() 이 SVG 속성으로 바로 쓴다.
 * 그라디언트 id 는 useId() 로(한 화면에 둘이어도 안 겹친다). CSS filter · 그림자 없음(폰). 움직임 줄이기면 잔상 · 깜빡임 없음(games.css). */
import { useId, useImperativeHandle, useRef, type Ref } from "react";

export type DeepDialHandle = {
  /** ang = 다이얼 회전(라디안, 0 이면 손잡이가 맨 위), dir = 마지막으로 돈 방향(+1 시계 · -1 반시계) */
  turn: (ang: number, dir: number) => void;
};

/** 바늘 · 눈금이 그리는 빠르기의 끝(초당 바퀴) — 0 은 트랙 시작(왼쪽 아래), 3 은 끝(오른쪽 아래) */
export const DIAL_MAX_RPS = 3;
/** 다이얼 SVG 좌표: 중심 60,60 · 손잡이 공은 반지름 32 자리 */
const C = 60, KNOB_R = 32;
/** 빠르기 v(초당 바퀴) 가 놓이는 각도(도, SVG 기준: 0 = 오른쪽, 시계 방향 +) */
const speedDeg = (v: number) => 135 + (Math.max(0, Math.min(DIAL_MAX_RPS, v)) / DIAL_MAX_RPS) * 270;
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
};
const f1 = (n: number) => Math.round(n * 100) / 100;

/** 별 모양 드래그 손잡이(6점) */
const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const p = polar(-90 + i * 30, i % 2 ? 5.6 : 9);
    pts.push(`${f1(p.x)} ${f1(p.y)}`);
  }
  return `M${pts.join("L")}Z`;
})();

/** 원 위 a1 → a2(도) 시계 방향 호 + 끝 화살촉 — 처음 한 바퀴를 돌 때까지 보이는 안내 */
function arrowArc(a1: number, a2: number, r: number) {
  const p1 = polar(a1, r), p2 = polar(a2, r);
  const t = ((a2 + 90) * Math.PI) / 180; // 끝에서의 진행 방향(시계)
  const back = { x: p2.x - Math.cos(t) * 4.5, y: p2.y - Math.sin(t) * 4.5 };
  const n = { x: -Math.sin(t) * 3.2, y: Math.cos(t) * 3.2 };
  return `M${f1(p1.x)} ${f1(p1.y)}A${r} ${r} 0 0 1 ${f1(p2.x)} ${f1(p2.y)}M${f1(back.x + n.x)} ${f1(back.y + n.y)}L${f1(p2.x)} ${f1(p2.y)}L${f1(back.x - n.x)} ${f1(back.y - n.y)}`;
}
const GUIDE_ARROWS = arrowArc(-30, 22, 44) + arrowArc(150, 202, 44);

/** 끝 표시 — 느린 끝은 흰 꺾쇠 하나, 빠른 끝(끊어지는 쪽)은 붉은 겹꺾쇠. 시계 방향(빨라지는 쪽)을 가리킨다 */
function chevron(deg: number, double: boolean) {
  const p = polar(deg, 54), rot = deg + 90;
  const one = (dx: number) => `M${dx - 2} -3L${dx + 1} 0L${dx - 2} 3`;
  return { d: double ? one(-2) + one(2) : one(0), transform: `translate(${f1(p.x)} ${f1(p.y)}) rotate(${rot})` };
}
const SLOW_CHEV = chevron(126, false), FAST_CHEV = chevron(54, true);

const TICKS = [0, 1, 2, 3].map((v) => {
  const a = polar(speedDeg(v), 46), b = polar(speedDeg(v), 50);
  return `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
}).join("");
const STRIPES = Array.from({ length: 6 }, (_, i) => {
  const a = polar(i * 60, 22.6), b = polar(i * 60, 29.4);
  return `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
}).join("");
const HOLES = [45, 135, 225, 315].map((d) => polar(d, 15));

export default function DeepDial({ spin, lo, hi, warn, dive, guide, line, handle }: {
  /** 지금 빠르기(초당 바퀴) */
  spin: number;
  /** 좋은 빠르기 칸(초당 바퀴) */
  lo: number;
  hi: number;
  /** 곧 파고든다(예고) */
  warn: boolean;
  /** 파고드는 중 — 멈춰야 한다 */
  dive: boolean;
  /** 처음 한 바퀴를 돌기 전 — 손잡이가 도는 길 · 방향 안내 */
  guide: boolean;
  /** 고른 줄 색(감긴 줄 띠) */
  line: string;
  handle: Ref<DeepDialHandle>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rot = useRef<SVGGElement>(null);
  const knob = useRef<SVGGElement>(null);
  const ghost = useRef<SVGGElement>(null);
  useImperativeHandle(handle, () => ({
    turn(ang: number, dir: number) {
      const deg = f1((ang * 180) / Math.PI);
      rot.current?.setAttribute("transform", `rotate(${deg} ${C} ${C})`);
      // 손잡이 공은 돌리지 않고 옮긴다 — 왼쪽 위의 빛이 그대로 왼쪽 위에 있어야 공처럼 보인다
      knob.current?.setAttribute("transform", `translate(${f1(Math.sin(ang) * KNOB_R)} ${f1(KNOB_R - Math.cos(ang) * KNOB_R)})`);
      ghost.current?.setAttribute("transform", `rotate(${deg} ${C} ${C})${dir < 0 ? ` scale(-1 1) translate(${-2 * C} 0)` : ""}`);
    },
  }), []);

  const inBand = spin >= lo && spin <= hi && spin > 0;
  const state = dive ? "is-dive" : warn ? "is-warn" : "";
  const speedState = inBand ? "is-in" : spin > hi ? "is-fast" : "is-slow";
  const span = (Math.max(0, Math.min(DIAL_MAX_RPS, hi) - Math.max(0, lo)) / DIAL_MAX_RPS) * 75;
  const off = -(Math.max(0, lo) / DIAL_MAX_RPS) * 75;
  const needleDeg = f1(speedDeg(spin) + 90); // 바늘은 위(-90°)를 보고 그렸다
  const g = (k: string) => `${id}-${k}`;
  return (
    <div className={`fish-dial ${state}`} aria-hidden>
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id={g("band")} gradientUnits="userSpaceOnUse" x1="6" y1="60" x2="114" y2="60">
            <stop offset="0" stopColor="#86efac" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <radialGradient id={g("spool")} cx="0.36" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#f1f5f9" />
            <stop offset="0.55" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#475569" />
          </radialGradient>
          <radialGradient id={g("knob")} cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#fef08a" />
            <stop offset="1" stopColor="#eab308" />
          </radialGradient>
        </defs>

        {/* 트랙 — 어두운 띠 + 바깥 흰 테(깊은 물에서도 띠의 끝이 보인다) */}
        <circle cx={C} cy={C} r="54" className="fish-dial-track" pathLength={100} strokeDasharray="75 100" transform={`rotate(135 ${C} ${C})`} />
        <circle cx={C} cy={C} r="59.25" className="fish-dial-edge" pathLength={100} strokeDasharray="75 100" transform={`rotate(135 ${C} ${C})`} />
        <circle cx={C} cy={C} r="54" className="fish-dial-band" stroke={`url(#${g("band")})`} pathLength={100} strokeDasharray={`${f1(span)} 100`} strokeDashoffset={f1(off)} transform={`rotate(135 ${C} ${C})`} />
        <circle cx={C} cy={C} r="50.5" className="fish-dial-band-hi" pathLength={100} strokeDasharray={`${f1(span)} 100`} strokeDashoffset={f1(off)} transform={`rotate(135 ${C} ${C})`} />
        <path d={TICKS} className="fish-dial-tick" />
        <path d={SLOW_CHEV.d} transform={SLOW_CHEV.transform} className="fish-dial-chev" />
        <path d={FAST_CHEV.d} transform={FAST_CHEV.transform} className="fish-dial-chev is-fast" />
        {/* 지금 빠르기 상태 — 손가락이 덮지 않는 다이얼 위쪽에 한 번 더 */}
        <path d={`M${f1(polar(-130, 65).x)} ${f1(polar(-130, 65).y)}A65 65 0 0 1 ${f1(polar(-50, 65).x)} ${f1(polar(-50, 65).y)}`} className={`fish-dial-state ${speedState}`} />

        {guide && (
          <g className="fish-dial-guide">
            <circle cx={C} cy={C} r="44" />
            <path d={GUIDE_ARROWS} />
          </g>
        )}

        {/* 스풀 — 바탕(빛은 왼쪽 위에 고정) */}
        <circle cx={C} cy={C} r="36" fill={`url(#${g("spool")})`} />
        <circle cx={C} cy={C} r="26" className="fish-dial-wound" stroke={line} />
        <circle cx={C} cy={C} r="34.5" className="fish-dial-rim" />
        <circle cx={C} cy={C} r="32.6" className="fish-dial-rim-hi" />
        {/* 도는 부분 — 감긴 줄 무늬 · 구멍 · 별 손잡이 · 팔 */}
        <g ref={rot}>
          <path d={STRIPES} className="fish-dial-stripe" />
          {HOLES.map((p, i) => <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r="5" className="fish-dial-hole" />)}
          <path d={`M${C - 2.5} ${C}L${C + 2.5} ${C}L${C + 3.5} ${C - KNOB_R}L${C - 3.5} ${C - KNOB_R}Z`} className="fish-dial-arm" />
          <path d={`M${C - 2.5} ${C}L${C} ${C}L${C} ${C - KNOB_R}L${C - 3.5} ${C - KNOB_R}Z`} className="fish-dial-arm-hi" />
          <path d={STAR} className="fish-dial-hub" />
          <circle cx={C} cy={C} r="2.2" className="fish-dial-hub-pin" />
        </g>
        {/* 빨리 돌 때 손잡이 잔상 — 18° · 36° 뒤 */}
        {spin > 1.5 && (
          <g ref={ghost} className="fish-dial-ghost">
            <circle cx={C} cy={C - KNOB_R} r="12" transform={`rotate(-18 ${C} ${C})`} opacity="0.25" />
            <circle cx={C} cy={C - KNOB_R} r="12" transform={`rotate(-36 ${C} ${C})`} opacity="0.12" />
          </g>
        )}
        <g ref={knob}>
          <circle cx={C} cy={C - KNOB_R} r="12" fill={`url(#${g("knob")})`} className="fish-dial-knob" />
          <ellipse cx={C - 4} cy={C - KNOB_R - 4.5} rx="3.6" ry="2.4" className="fish-dial-knob-hi" />
          <rect x={C - 10} y={C - KNOB_R - 2} width="20" height="4" rx="1.6" className="fish-dial-stop" transform={`rotate(-40 ${C} ${C - KNOB_R})`} />
        </g>

        {/* 바늘 — 스풀 위(예전엔 스풀 밑에 깔려 손잡이 팔이 하나 더 있는 것처럼 보였다). 가운데서 나오지 않는 쐐기 */}
        <g transform={`rotate(${needleDeg} ${C} ${C})`}>
          <path d={`M${C - 2.6} ${C - 40}L${C + 2.6} ${C - 40}L${C + 0.6} ${C - 58}L${C - 0.6} ${C - 58}Z`} className="fish-dial-needle" />
          {inBand && !dive && (
            <g className="fish-dial-pip">
              <circle cx={C} cy={C - 63} r="3.6" />
              <path d={`M${C - 1.7} ${C - 63}L${C - 0.4} ${C - 61.7}L${C + 1.8} ${C - 64.3}`} />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
