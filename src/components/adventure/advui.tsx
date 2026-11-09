"use client";
/* 모험 화면 공용 조각 — 공 · 체력바 · 경험치바 · 기술 성격 · 누름 처리. README §14.6
 * ⚠ 여기선 전투 엔진(lib/arena) · 연출(lib/battlefx) · BattleView 를 부르지 않는다 — 모험 탭이 이 파일만 정적으로 불러서,
 *   탭을 열 때는 전투 코드를 받지 않고 전투를 시작할 때 받는다(AdventureTab 의 dynamic). advui.test 가 잠근다. */
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { xpFor, type BallKey, type Move, type Status } from "@/lib/adventure";

export const STATUS_LABEL: Record<Status, string> = { burn: "화상", poison: "독", para: "마비", sleep: "잠듦" };
export const STAT_LABEL = { atk: "공격", def: "방어", spd: "스피드" } as const;
export const SHAPE_LABEL = { dash: "돌진", combo: "연타 돌진", leap: "도약", fan: "부채꼴", shot: "탄", orb: "추적탄", wave: "파동", beam: "광선", rain: "낙하", blast: "지정 폭발", nova: "주변", self: "강화", ward: "방어막", hex: "방해" } as const;

/** 기술 버튼의 성격 표 — 연속 · 흡수 · 반동 · 선제 · 급소 · 움찔 · 상태이상 */
export function moveTags(mv: Move): string[] {
  const t: string[] = [];
  if (mv.hits) t.push(`${mv.hits[0]}~${mv.hits[1]}연타`);
  if (mv.priority) t.push("빠른 시전");
  if (mv.drain) t.push("흡수");
  if (mv.recoil) t.push("반동");
  if (mv.crit) t.push("급소↑");
  if (mv.flinch) t.push("움찔");
  if (mv.inflict) t.push(STATUS_LABEL[mv.inflict.status]);
  if (mv.heal) t.push("회복");
  if (mv.boost) t.push(`${mv.boost.self ? "내" : "상대"} ${STAT_LABEL[mv.boost.stat]}${mv.boost.by > 0 ? "▲" : "▼"}`);
  return t;
}

/** 실시간 버튼 — 손가락은 누르는 순간(pointerdown), 키보드 · 보조기기는 click(detail 0)으로. 손가락의 click(detail ≥ 1)은 무시해 두 번 나가지 않는다 */
export function pressProps(fire: () => void) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      fire();
    },
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (e.detail === 0) fire();
    },
  };
}

/** 길게 누르기(2026-11-09 기술 버튼) — 누르는 순간은 pressProps 와 같고, 손을 떼거나 손가락이 끊기면 end.
 *  손가락은 누른 버튼에 붙잡혀(암묵적 포인터 캡처) 밖에서 떼도 그 버튼이 pointerup 을 받는다 */
export function holdProps(start: () => void, end: () => void) {
  return { ...pressProps(start), onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onPointerLeave: end };
}

/** #rrggbb 밝기 바꾸기 */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.min(255, Math.max(0, k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 체력바 — 앞 막대는 바로, 뒤 잔상은 조금 늦게 따라 준다(얼마나 깎였는지 보이게) */
export function HpBar({ hp, max }: { hp: number; max: number }) {
  const r = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const color = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
  return (
    <span className="adv-hpbar" role="meter" aria-label="체력" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span className="adv-hpbar-lag" style={{ width: `${r * 100}%` }} />
      <span className="adv-hpbar-now" style={{ width: `${r * 100}%`, background: color }} />
    </span>
  );
}

export function XpBar({ level, xp }: { level: number; xp: number }) {
  const a = xpFor(level);
  const b = xpFor(level + 1);
  const r = b > a ? (xp - a) / (b - a) : 1;
  return (
    <span className="adv-xpbar" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(1, r)) * 100}%` }} />
    </span>
  );
}

/** 공 — 도토리 모양 씨앗 공(이 앱 것). ⚠ 위아래 두 색 + 가운데 띠 + 단추 모양의 공은 원작 게임의 상징이라 쓰지 않는다. */
export function BallIcon({ k, size = 18 }: { k: BallKey; size?: number }) {
  const body = k === "basic" ? "#6cbf4a" : k === "great" ? "#3f8fd8" : "#8a5ad8";
  const dark = k === "basic" ? "#3f8a2e" : k === "great" ? "#2763a3" : "#5d38a6";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="inline-block align-[-3px]">
      <path d="M10 1.2v2.6" stroke="#6b4a2b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10.6c0 4.4 2.7 7.9 6 7.9s6-3.5 6-7.9z" fill={body} stroke={dark} strokeWidth="1.3" />
      <path d="M6.2 12c.3 2.2 1.4 3.9 2.8 4.6" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M2.6 10.8C2.6 6.6 6 3.6 10 3.6s7.4 3 7.4 7.2z" fill="#a8743f" stroke="#6b4a2b" strokeWidth="1.3" />
      <path d="M5 8.2h10M4 10h12M7 5.6l-1.6 4.6M10 4.4v6M13 5.6l1.6 4.6" stroke="#6b4a2b" strokeOpacity=".55" strokeWidth=".8" />
      {k === "star" && <path d="M10 11.6l.8 1.7 1.8.2-1.4 1.2.5 1.8-1.7-1-1.7 1 .5-1.8-1.4-1.2 1.8-.2z" fill="#ffe27a" />}
      {k === "great" && <circle cx="10" cy="14" r="1.6" fill="#fff" fillOpacity=".85" />}
    </svg>
  );
}
