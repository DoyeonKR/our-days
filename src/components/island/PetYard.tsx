"use client";

/* 살아있는 메인 캐릭터 — 펫이 마당을 돌아다니고, 터치하면 반응한다.
   · 이동은 left(%) + CSS transition (rAF 없이 부드럽게 = 배터리 친화)
   · 각 애니메이션은 '한 요소 = 한 transform' 원칙으로 중첩(서로 덮어쓰지 않게)
   · 기분(기력/포만/행복/아픔)에 따라 속도·깡총·이모트가 달라진다 (petmotion.ts 순수 로직)
   · 접근성: 펫은 button, prefers-reduced-motion 이면 배회를 끈다 */

import { useEffect, useRef, useState } from "react";
import type { ArtFC } from "@/components/island/art/parts";
import {
  type PetStatsLike,
  PET_TAPS_FOR_HUG,
  motionFor,
  nextX,
  pettingAfterTap,
  speechFor,
  tapParticle,
  vibeOf,
} from "@/lib/petmotion";

type Particle = { id: number; emoji: string; dx: number };

export default function PetYard({
  Art,
  name,
  stats,
  sick,
  pendingEvolve,
  canHug,
  onHug,
}: {
  Art: ArtFC;
  name: string;
  stats: PetStatsLike;
  sick: boolean;
  pendingEvolve: boolean;
  canHug: boolean; // 안아주기 쿨다운이 열려 있는지
  onHug: () => void; // 쓰다듬기 게이지가 가득 찼을 때 실제 안아주기
}) {
  const vibe = vibeOf(stats, sick);
  const motion = motionFor(vibe);

  const [x, setX] = useState(50);
  const [facing, setFacing] = useState(1); // 1=오른쪽 보기, -1=왼쪽
  const [walking, setWalking] = useState(false);
  const [hopKey, setHopKey] = useState(0); // 값이 바뀌면 깡총 애니 재시작
  const [hopping, setHopping] = useState(false); // 깡총 '중'인지 — 끝나면 다시 숨쉬기로 복귀
  const [tapKey, setTapKey] = useState(0);
  const [speech, setSpeech] = useState<{ text: string; id: number } | null>(null);
  const [parts, setParts] = useState<Particle[]>([]);
  const [pets, setPets] = useState(0); // 쓰다듬기 누적

  const xRef = useRef(50);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);
  const reducedRef = useRef(false);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  };
  /** 깡총 1회 — 애니가 끝나면 hopping 을 내려 숨쉬기(bob)로 돌아온다. */
  const doHop = () => {
    setHopKey((k) => k + 1);
    setHopping(true);
    later(() => setHopping(false), 700);
  };

  useEffect(() => {
    reducedRef.current =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // 배회 루프 — 기분이 바뀌면 새 파라미터로 재시작
  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;
      if (motion.wander && !reducedRef.current) {
        const tx = nextX(xRef.current, Math.random());
        setFacing(tx > xRef.current ? 1 : -1);
        xRef.current = tx;
        setX(tx);
        setWalking(true);
        later(() => {
          if (!alive) return;
          setWalking(false);
          if (Math.random() < motion.hopChance) doHop();
          later(step, motion.pauseMin + Math.random() * (motion.pauseMax - motion.pauseMin));
        }, motion.walkMs);
      } else {
        // 안 돌아다니는 기분(졸림/아픔) — 가끔 까딱거리기만
        later(step, motion.pauseMax);
      }
    };
    const first = later(step, 700);
    return () => {
      alive = false;
      clearTimeout(first);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vibe]);

  // 터치 반응 — 즉시 피드백(스쿼시+파티클+말풍선+햅틱) & 쓰다듬기 게이지
  function onTap() {
    setTapKey((k) => k + 1);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* noop */
    }
    // 말풍선
    const id = ++seq.current;
    setSpeech({ text: speechFor(vibe, Math.random()), id });
    later(() => setSpeech((sp) => (sp?.id === id ? null : sp)), 1900);
    // 파티클 3개
    const emoji = tapParticle(vibe);
    const made: Particle[] = [0, 1, 2].map((i) => ({
      id: ++seq.current,
      emoji,
      dx: (i - 1) * 18 + (Math.random() * 10 - 5),
    }));
    setParts((p) => [...p, ...made]);
    later(() => setParts((p) => p.filter((q) => !made.some((m) => m.id === q.id))), 1100);
    // 쓰다듬기 → 가득 차면 실제 안아주기(쿨다운 열렸을 때만)
    const r = pettingAfterTap(pets);
    setPets(r.count);
    if (r.full) {
      doHop();
      if (canHug) onHug();
    }
  }

  // 걷는 중 > 깡총 중 > 평상시 숨쉬기. hopping 은 애니 종료 후 내려가 항상 bob 으로 복귀한다.
  const bobClass = walking ? "animate-pet-walk" : hopping ? "animate-pet-hop" : "animate-pet-bob";
  const bobStyle = walking || hopping ? undefined : { animationDuration: `${motion.bobMs}ms` };

  return (
    <div
      className="relative h-[172px] w-full overflow-hidden rounded-2xl ring-1 ring-white/10"
      style={{ background: "linear-gradient(180deg,#bfe9ff 0%,#d9f2ff 42%,#cdeaa8 42%,#a8d97e 100%)" }}
    >
      {/* 먼 언덕 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[38%] h-10 opacity-70"
        style={{ background: "radial-gradient(60% 100% at 30% 100%,#9ed97a 0%,transparent 70%), radial-gradient(50% 100% at 75% 100%,#8fd06b 0%,transparent 70%)" }}
      />
      {/* 진화 대기 오라 */}
      {pendingEvolve && (
        <div
          className="animate-pet-aura pointer-events-none absolute bottom-[22%] left-1/2 h-24 w-24 -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(255,224,138,0.85) 0%,rgba(255,224,138,0) 70%)" }}
        />
      )}

      {/* 펫 — left 로 이동(transition), 내부는 한 요소당 하나의 transform */}
      <div
        className="absolute bottom-[20%] ease-linear"
        style={{
          left: `${x}%`,
          transform: "translateX(-50%)",
          transitionProperty: "left",
          transitionDuration: `${motion.walkMs}ms`,
        }}
      >
        {/* 파티클 */}
        <span className="pointer-events-none absolute inset-x-0 top-0 block">
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
        {/* 말풍선 */}
        {speech && (
          <span
            key={speech.id}
            className="animate-pet-speech pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-ink shadow-[var(--shadow-sm)]"
          >
            {speech.text}
          </span>
        )}
        {/* 상시 이모트(졸림/아픔/배고픔) */}
        {motion.emote && !speech && (
          <span className="animate-floaty pointer-events-none absolute -top-5 left-[62%] text-base">
            {motion.emote}
          </span>
        )}

        <button
          onClick={onTap}
          aria-label={`${name} 쓰다듬기`}
          className="block select-none"
        >
          <span className={motion.jitter ? "animate-pet-jitter block" : "block"}>
            <span className="block" style={{ transform: `scaleX(${facing})` }}>
              <span key={hopKey} className={`${bobClass} block`} style={bobStyle}>
                <span key={tapKey} className={tapKey ? "animate-pet-tap block" : "block"}>
                  <Art size={96} title={name} />
                </span>
              </span>
            </span>
          </span>
        </button>
      </div>

      {/* 쓰다듬기 게이지 — 몇 번 더 만지면 안아주기 */}
      {pets > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/35 px-2.5 py-1">
          <span className="text-[10px] font-bold text-white/90">쓰다듬는 중</span>
          <span className="flex gap-0.5">
            {Array.from({ length: PET_TAPS_FOR_HUG }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i < pets ? "bg-pink-300" : "bg-white/30"}`}
              />
            ))}
          </span>
        </div>
      )}
      {/* 힌트 */}
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/25 px-2 py-0.5 text-[9px] font-bold text-white/80">
        탭해서 쓰다듬기
      </span>
    </div>
  );
}
