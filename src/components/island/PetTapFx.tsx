"use client";

/* 펫 탭 반응 레이어 — **무대와 무관하게** 홈과 같은 손맛을 입힌다.
 *
 * 왜 분리했나: 홈은 PetYard(투명 무대 + PetPixel), 섬은 PixelPet(도트로 그린 캔버스 씬)으로
 * **무대가 다르다**. 무대를 통일하려고 섬을 PetYard 로 바꿨더니 배경이 CSS 그라데이션이 되어
 * 오히려 픽셀이 아니게 됐다(사용자: "픽셀로 맞춰달라는건데"). 무대는 각자 두고,
 * 반응만 이 래퍼가 담당한다.
 *
 * 스펙은 순수 함수 tapReaction(vibe, combo, r) 하나 — PetYard 와 **같은 소스**라
 * 두 화면의 단계·파티클·진동·링·흔들림이 정의상 같다.
 *
 * ⚠ 자식이 **캔버스 씬**이면 stageMotion={false} 로 꺼라.
 *   캔버스 한 장에 하늘·잔디·나무·펫이 다 들어 있어서, 래퍼에 transform 을 걸면
 *   그림 전체(=네모)가 통째로 움직인다(사용자 리포트 2026-08-05 "네모 픽셀 자체가 움직이고").
 *   그 경우 점프는 캔버스가 **자기 안에서** 스프라이트만 옮겨 그린다(PixelPet + tapHop).
 *   파티클·링·외침은 DOM 오버레이라 그대로 얹힌다 — 그건 무대를 안 움직인다.
 *   회전은 어느 쪽이든 쓰지 않는다(도트가 격자를 벗어난다 — README §14.5).
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type PetVibe, TAP_COMBO_MS, tapReaction } from "@/lib/petmotion";

type Particle = { id: number; emoji: string; dx: number };

export default function PetTapFx({
  vibe,
  onTap,
  stageMotion = true,
  children,
}: {
  vibe: PetVibe;
  /** 반응을 재생한 뒤 호출 — 보상/대사 등 화면별 로직은 호출부가 맡는다. */
  onTap?: (tier: number, combo: number) => void;
  /** 자식에 CSS 변형/흔들림을 걸지 여부. 캔버스 씬이면 false(자식이 스스로 움직인다). */
  stageMotion?: boolean;
  /** 무대(캔버스든 DOM 이든). 탭 히트영역은 이 래퍼 전체다. */
  children: ReactNode;
}) {
  const [tapClass, setTapClass] = useState("animate-pet-squish-1");
  const [tapKey, setTapKey] = useState(0);
  const [parts, setParts] = useState<Particle[]>([]);
  const [ring, setRing] = useState<{ id: number; tier: number } | null>(null);
  const [cry, setCry] = useState<{ id: number; text: string } | null>(null);
  const [shake, setShake] = useState(0);

  // ⚠ 콤보는 **ref** 로 센다. state 로 두면 같은 틱에 들어온 연타가 전부 stale 한 값을 읽어
  //   (0+1, 0+1, …) 콤보가 1 에서 멈춘다 — 실측으로 확인했다. 점프 높이가 콤보에 비례하는
  //   지금은 이게 바로 '연타해도 안 커진다'가 된다. 화면에 콤보 숫자를 쓰지 않으므로 ref 로 충분하다.
  const comboRef = useRef(0);
  const comboAt = useRef(0);
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 발화된 타이머는 목록에서 빼 둔다 — 섬 화면은 오래 열려 있어 배열이 무한 증식하면 안 된다.
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  function fire() {
    const t = Date.now();
    const n = t - comboAt.current < TAP_COMBO_MS ? comboRef.current + 1 : 1;
    comboAt.current = t;
    comboRef.current = n;
    const R = tapReaction(vibe, n, Math.random());

    const made: Particle[] = Array.from({ length: R.count }, (_, i) => ({
      id: ++seq.current,
      emoji: R.particle,
      dx: (i / Math.max(1, R.count - 1) - 0.5) * 2 * R.spread + (Math.random() * 8 - 4),
    }));
    setParts((p) => [...p, ...made]);
    later(() => setParts((p) => p.filter((q) => !made.some((m) => m.id === q.id))), 1100);

    setTapClass(`animate-pet-${R.anim}`);
    setTapKey((k) => k + 1);
    try {
      navigator.vibrate?.(R.vibrate);
    } catch {
      /* noop */
    }
    if (R.ring) {
      const rid = ++seq.current;
      setRing({ id: rid, tier: R.tier });
      later(() => setRing((c) => (c?.id === rid ? null : c)), 700);
    }
    if (R.shake && stageMotion) setShake((k) => k + 1);
    if (R.cry) {
      const cid = ++seq.current;
      setCry({ id: cid, text: R.cry });
      later(() => setCry((c) => (c?.id === cid ? null : c)), 1000);
    }
    onTap?.(R.tier, n);
  }

  return (
    <div
      // 흔들림은 동일 키프레임 두 개를 번갈아 걸어 재생만 재시작한다.
      // (루트 key 를 바꾸면 React 가 DOM 서브트리를 파괴/재생성해 캔버스가 다시 굽힌다.)
      className={`relative${shake ? (shake % 2 ? " animate-yard-shake" : " animate-yard-shake-b") : ""}`}
    >
      <button onClick={fire} className="tap pet-hit-target block w-full" aria-label="펫 쓰다듬기">
        {/* stageMotion=false 면 **아무 변형도 걸지 않는다** — 캔버스 씬은 자기 안에서 움직인다.
            key 도 붙이지 않는다(재마운트되면 캔버스가 배경을 다시 굽는다). */}
        {stageMotion ? (
          <span key={tapKey} className={`${tapClass} block`}>
            {children}
          </span>
        ) : (
          <span className="block">{children}</span>
        )}
      </button>

      {/* 파티클 — 무대 가운데 위에서 퍼진다 */}
      <span className="pointer-events-none absolute inset-x-0 top-1/3 block">
        {parts.map((p) => (
          <span
            key={p.id}
            className="animate-pet-particle absolute left-1/2 top-0 text-lg"
            style={{ ["--pdx" as string]: `${p.dx}px` }}
          >
            {p.emoji}
          </span>
        ))}
      </span>

      {/* 충격파 링 — 블러 없는 하드 링(도트 톤 유지) */}
      {ring && (
        <span
          key={`rg${ring.id}`}
          className="pointer-events-none absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="animate-tap-ring block rounded-full"
            style={{
              width: 18,
              height: 18,
              boxShadow: ring.tier >= 4 ? "0 0 0 3px #fff3c4, 0 0 0 6px #ffb703" : "0 0 0 3px #ffffff",
            }}
          />
        </span>
      )}

      {/* 짧은 외침 */}
      {cry && (
        <span
          key={`cy${cry.id}`}
          className="animate-pet-cry pointer-events-none absolute left-1/2 top-[18%] z-10 -translate-x-1/2 whitespace-nowrap bg-white px-1.5 py-0.5 text-xs font-black text-[var(--ink-on-light)]"
          style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.3)" }}
        >
          {cry.text}
        </span>
      )}
    </div>
  );
}
