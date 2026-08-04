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
  IDLE_MS,
  PET_TAPS_FOR_HUG,
  idleFor,
  motionFor,
  nextX,
  pettingAfterTap,
  speechFor,
  tapParticle,
  TAP_COMBO_MS,
  tapReaction,
  vibeOf,
} from "@/lib/petmotion";
import { type PetActionKind, petFx } from "@/lib/petfx";
import PetPixel from "@/components/island/PetPixel";
import { usePixelArt } from "@/lib/pixelpref";

type Particle = { id: number; emoji: string; dx: number };

export default function PetYard({
  Art,
  form,
  name,
  stats,
  sick,
  pendingEvolve,
  petReward = 0,
  onPet,
  onDisplayTap,
  active = true,
  bare = false,
  height = 172,
  asleep = false,
  fx = null,
  onWake,
}: {
  Art: ArtFC;
  form?: string; // 픽셀 모드일 때 그릴 폼. 없으면 항상 일러스트(SVG).
  name: string;
  stats: PetStatsLike;
  sick: boolean;
  pendingEvolve: boolean;
  petReward?: number; // 이번에 게이지를 채우면 받을 코인(0이면 일일캡 소진 — 코인 없이 애정만)
  onPet?: () => void; // 있으면 쓰다듬기(보상) 모드(섬). 없으면 표시 모드(홈).
  onDisplayTap?: () => void; // 표시 모드(홈)에서 캐릭터를 탭하면 호출(예: 다음 대사로 넘기기)
  active?: boolean; // false 면 배회 루프 정지(안 보이는 탭에서 헛돌지 않게). 기본 true.
  bare?: boolean; // true 면 배경/링/언덕/힌트 없이 투명 무대만 — 히어로 카드 등 다른 배경 위에 얹을 때
  height?: number; // 무대 높이(px). 히어로 통합용 컴팩트 변형
  asleep?: boolean; // 자는 중(sleepUntil 파생) — 눕는 포즈 + 💤 + 무대 딤, 배회 정지
  fx?: { kind: PetActionKind; ts: number } | null; // 액션 연출(씻기/밥/재우기…) — petFx 스펙대로 재생
  onWake?: () => void; // 자는 펫을 탭하면 깨우기(없으면 읽기전용 — 살짝 '쉿' 말풍선만)
}) {
  const displayMode = !onPet; // onPet 이 없으면 홈 등 읽기전용 표시 모드
  // 픽셀 모드 + 폼을 받은 경우에만 도트로 그린다(폼을 안 넘긴 호출부는 그대로 SVG).
  const pixel = usePixelArt();
  const pix = pixel && form ? form : null;
  const vibe = vibeOf(stats, sick);
  const motion = motionFor(vibe);

  const [x, setX] = useState(50);
  const [facing, setFacing] = useState(1); // 1=오른쪽 보기, -1=왼쪽
  const [walking, setWalking] = useState(false);
  const [hopKey, setHopKey] = useState(0); // 값이 바뀌면 깡총 애니 재시작
  const [hopping, setHopping] = useState(false); // 깡총 '중'인지 — 끝나면 다시 숨쉬기로 복귀
  const [tapKey, setTapKey] = useState(0);
  const [tapClass, setTapClass] = useState("animate-pet-squish-1"); // 크레센도: 1~2탭 / 3~4탭 / 만탭
  const [speech, setSpeech] = useState<{ text: string; id: number } | null>(null);
  const [parts, setParts] = useState<Particle[]>([]);
  const [pets, setPets] = useState(0); // 쓰다듬기 누적
  const [coin, setCoin] = useState<{ id: number; amt: number } | null>(null); // 보상 코인 플로팅
  const [burst, setBurst] = useState(0); // 하트 12개 폭발(게이지 만탭)
  const [idle, setIdle] = useState<{ cls: string; id: number } | null>(null); // 유휴 연출(하품/기지개…)
  // 홈 탭 콤보 — 연타를 누적해 단계가 오른다(반응이 한 가지면 두 번째 탭부터 '눌러도 그대로'다)
  const [ring, setRing] = useState<{ id: number; tier: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [cry, setCry] = useState<{ id: number; text: string } | null>(null);
  const [combo, setCombo] = useState(0);
  const comboAt = useRef(0);

  const xRef = useRef(50);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);
  const reducedRef = useRef(false);

  // 발화되면 자기 id 를 목록에서 제거 → timers.current 에는 '대기 중' 타이머만 남는다.
  // (홈의 HomePet 은 세션 내내 마운트 유지 → prune 없으면 배회 루프가 배열을 무한 증식시킴)
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
    return t;
  };
  /** 깡총 1회 — 애니가 끝나면 hopping 을 내려 숨쉬기(bob)로 돌아온다. */
  const doHop = () => {
    setHopKey((k) => k + 1);
    setHopping(true);
    later(() => setHopping(false), 700);
  };
  /** 유휴 연출 1회(하품/기지개/두리번/꼬리/앉기) — 끝나면 스스로 해제되어 bob 복귀. */
  const doIdle = () => {
    const n = ++seq.current;
    const kind = idleFor(vibe, n);
    setIdle({ cls: `animate-pet-${kind}`, id: n });
    later(() => setIdle((cur) => (cur?.id === n ? null : cur)), IDLE_MS[kind]);
  };

  useEffect(() => {
    reducedRef.current =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // 배회 루프 — 기분이 바뀌면 새 파라미터로 재시작. active=false(안 보이는 탭)/수면 중엔 정지.
  useEffect(() => {
    if (!active || asleep) return;
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
          else if (Math.random() < 0.45) doIdle(); // 멈춘 김에 하품/기지개/두리번…
          later(step, motion.pauseMin + Math.random() * (motion.pauseMax - motion.pauseMin));
        }, motion.walkMs);
      } else {
        // 안 돌아다니는 기분(졸림/아픔) — 가끔 하품·앉기 같은 유휴 연출만
        if (Math.random() < 0.6) doIdle();
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
  }, [vibe, active, asleep]);

  // 터치 반응 — 크레센도 스쿼시(1~2탭 < 3~4탭 < 만탭 폭발) + 파티클 + 햅틱
  function onTap() {
    // 자는 중 — 탭하면 깨우기(onWake). 읽기전용(홈)이면 '쉿' 말풍선만.
    if (asleep) {
      if (onWake) {
        try {
          navigator.vibrate?.(14);
        } catch {
          /* noop */
        }
        onWake();
      } else {
        const id = ++seq.current;
        setSpeech({ text: "쿨쿨… 💤", id });
        later(() => setSpeech((sp) => (sp?.id === id ? null : sp)), 1500);
      }
      return;
    }
    // 파티클 3개 (양 모드 공통)
    // 표시 모드(홈): 연타 콤보 → 단계가 오를수록 과격해진다. 스펙은 순수 모듈(tapReaction).
    if (displayMode) {
      const t = Date.now();
      const n = t - comboAt.current < TAP_COMBO_MS ? combo + 1 : 1;
      comboAt.current = t;
      setCombo(n);
      const R = tapReaction(vibe, n, Math.random());

      const made: Particle[] = Array.from({ length: R.count }, (_, i) => ({
        id: ++seq.current,
        emoji: R.particle,
        // 개수가 늘어도 뭉치지 않게 좌우로 고르게 편 뒤 살짝 흩는다
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
      if (R.shake) {
        setShake((k) => k + 1);
      }
      if (R.cry) {
        const cid = ++seq.current;
        setCry({ id: cid, text: R.cry });
        later(() => setCry((c) => (c?.id === cid ? null : c)), 1000);
      }
      // 콤보가 끊기면 단계도 처음으로(다음 탭이 다시 1단계에서 시작)
      later(() => {
        if (Date.now() - comboAt.current >= TAP_COMBO_MS) setCombo(0);
      }, TAP_COMBO_MS + 60);
      if (R.tier === 1) doHop();
      onDisplayTap?.();
      return;
    }

    const emoji = tapParticle(vibe);
    const made: Particle[] = [0, 1, 2].map((i) => ({
      id: ++seq.current,
      emoji,
      dx: (i - 1) * 18 + (Math.random() * 10 - 5),
    }));
    setParts((p) => [...p, ...made]);
    later(() => setParts((p) => p.filter((q) => !made.some((m) => m.id === q.id))), 1100);
    // 내부 말풍선(쓰다듬기 모드) — 기분에 맞는 랜덤 한마디
    const id = ++seq.current;
    setSpeech({ text: speechFor(vibe, Math.random()), id });
    later(() => setSpeech((sp) => (sp?.id === id ? null : sp)), 1900);
    // 쓰다듬기 크레센도 → 가득 차면 조이점프+하트폭발+보상(엔진에서 일일캡)
    const r = pettingAfterTap(pets);
    setPets(r.count);
    const tier = r.full ? 3 : r.count <= 2 ? 1 : 2;
    setTapClass(tier === 3 ? "animate-pet-joy" : tier === 2 ? "animate-pet-squish-2" : "animate-pet-squish-1");
    setTapKey((k) => k + 1);
    try {
      navigator.vibrate?.(tier === 3 ? [12, 40, 18] : tier === 2 ? 16 : 10);
    } catch {
      /* noop */
    }
    if (r.full) {
      const bid = ++seq.current;
      setBurst(bid); // 하트 12개 + 러브펄스
      later(() => setBurst((b) => (b === bid ? 0 : b)), 1000);
      onPet?.();
      if (petReward > 0) {
        const cid = ++seq.current;
        setCoin({ id: cid, amt: petReward });
        later(() => setCoin((c) => (c?.id === cid ? null : c)), 1200);
      }
    }
  }

  // 걷는 중 > 깡총 중 > 평상시 숨쉬기. hopping 은 애니 종료 후 내려가 항상 bob 으로 복귀한다.
  const bobClass = walking ? "animate-pet-walk" : hopping ? "animate-pet-hop" : "animate-pet-bob";
  const bobStyle = walking || hopping ? undefined : { animationDuration: `${motion.bobMs}ms` };
  // 액션 연출(씻기/밥/재우기…) — 스펙은 순수 모듈(petfx)이 단일 소스
  const fxSpec = fx ? petFx(fx.kind) : null;

  return (
    <div
      key={`yard${shake}`}
      className={`${bare ? "relative w-full overflow-hidden" : "relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10"}${shake ? " animate-yard-shake" : ""}`}
      style={{
        height: `${height}px`,
        background: bare ? undefined : "linear-gradient(180deg,#bfe9ff 0%,#d9f2ff 42%,#cdeaa8 42%,#a8d97e 100%)",
      }}
    >
      {/* 먼 언덕 */}
      {!bare && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[38%] h-10 opacity-70"
          style={{ background: "radial-gradient(60% 100% at 30% 100%,#9ed97a 0%,transparent 70%), radial-gradient(50% 100% at 75% 100%,#8fd06b 0%,transparent 70%)" }}
        />
      )}
      {/* 수면/재우기 — 무대가 은은히 어두워진다 */}
      {(asleep || fxSpec?.dim) && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] bg-[#1a1b3a]/35 transition-opacity duration-700" />
      )}
      {/* 진화 대기 오라 */}
      {pendingEvolve && (
        <div
          className="animate-pet-aura pointer-events-none absolute bottom-[22%] left-1/2 h-24 w-24 -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(255,224,138,0.85) 0%,rgba(255,224,138,0) 70%)" }}
        />
      )}

      {/* 펫 — left 로 이동(transition), 내부는 한 요소당 하나의 transform */}
      <div
        // bare(홈 히어로)는 언덕 그래픽이 없고 무대가 낮아(128px) 20% 를 쓰면 펫 머리가
        // 위 6px 까지 올라와 외침·파티클이 통째로 잘린다 → 아래로 붙여 머리 위를 비운다.
        className={bare ? "absolute bottom-[6%] ease-linear" : "absolute bottom-[20%] ease-linear"}
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
            className="animate-pet-speech pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-sm font-extrabold text-ink shadow-[var(--shadow-sm)]"
          >
            {speech.text}
          </span>
        )}
        {/* 쓰다듬기 보상 코인 — 위로 떠오르며 사라짐 */}
        {coin && (
          <span
            key={coin.id}
            className="animate-pet-coin pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-2 py-0.5 text-sm font-black text-ink shadow-[var(--shadow-sm)]"
          >
            +{coin.amt}💗
          </span>
        )}
        {/* 상시 이모트(졸림/아픔/배고픔) */}
        {motion.emote && !speech && (
          <span className="animate-floaty pointer-events-none absolute -top-5 left-[62%] text-base">
            {motion.emote}
          </span>
        )}

        {/* 게이지 만탭 — 하트 12개 방사(바깥 정적 각도 > 중간 방사 애니 > 안쪽 역회전) + 러브펄스 */}
        {burst > 0 && (
          <span key={`hb${burst}`} className="pointer-events-none absolute left-1/2 top-1/2 z-10 block">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="absolute block" style={{ transform: `rotate(${i * 30}deg)` }}>
                <span className="animate-heart-burst block" style={{ animationDelay: `${i * 18}ms` }}>
                  <span className="block text-sm" style={{ transform: `rotate(${i * -30}deg)` }}>
                    💗
                  </span>
                </span>
              </span>
            ))}
          </span>
        )}
        {burst > 0 && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 block -translate-x-1/2">
            <span
              key={`lp${burst}`}
              className="animate-love-pulse block h-14 w-14 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,127,174,0.55), transparent 70%)" }}
            />
          </span>
        )}

        {/* 연타 충격파 링 — 3단계부터. 도트 톤이라 **블러 없는 사각 링**(원형 글로우는 즉시 이질적) */}
        {ring && (
          <span key={`rg${ring.id}`} className="pointer-events-none absolute bottom-2 left-1/2 block -translate-x-1/2">
            <span
              className="animate-tap-ring block"
              style={{
                width: 18,
                height: 18,
                boxShadow: ring.tier >= 4 ? "0 0 0 3px #fff3c4, 0 0 0 6px #ffb703" : "0 0 0 3px #ffffff",
              }}
            />
          </span>
        )}
        {/* 짧은 외침 — 부모(HomePet)의 대사 말풍선과 역할이 다르다(즉각 반응 vs 컨텍스트).
            무대 안쪽 머리 위에 띄운다 — 무대는 overflow-hidden 이라 밖으로 나가면 잘린다. */}
        {cry && (
          <span
            key={`cy${cry.id}`}
            className="animate-pet-cry pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-white px-1.5 py-0.5 text-xs font-black text-ink"
            style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.3)" }}
          >
            {cry.text}
          </span>
        )}

        {/* 액션 소품(밥그릇·거품·알람…) — 펫 주변에 뜬다 */}
        {fxSpec && fx && (
          <span key={`fx${fx.ts}`} className="pointer-events-none absolute left-1/2 top-1/2 z-10 block">
            {fxSpec.props.map((p, i) => (
              <span
                key={i}
                className={`animate-${p.anim} absolute block text-lg`}
                style={{ left: p.x, top: p.y, animationDelay: `${p.delay ?? 0}ms` }}
              >
                {p.emoji}
              </span>
            ))}
          </span>
        )}
        {/* 수면 💤 — 잠든 동안 무한 둥둥 */}
        {asleep && (
          <span className="pointer-events-none absolute left-1/2 top-0 z-10 block">
            <span className="animate-zzz-rise absolute block text-base" style={{ left: 10, top: -6 }}>
              💤
            </span>
            <span className="animate-zzz-rise absolute block text-xs" style={{ left: 28, top: 2, animationDelay: "1.1s" }}>
              💤
            </span>
          </span>
        )}

        <button
          onClick={onTap}
          aria-label={asleep ? `${name} 깨우기` : displayMode ? `${name}에게 말 걸기` : `${name} 쓰다듬기`}
          className="block select-none"
        >
          <span className={motion.jitter && !asleep ? "animate-pet-jitter block" : "block"}>
            <span className="block" style={{ transform: `scaleX(${facing})` }}>
              {asleep ? (
                /* 잠 — 픽셀은 전용 웅크린 스프라이트가 있으니 그대로, SVG 는 옆으로 폴싹 눕힌다
                   (도트를 회전시키면 픽셀 격자가 깨져 뭉개진다 — 픽셀 아트의 금기). */
                <span
                  className="block origin-bottom"
                  style={pix ? undefined : { transform: "rotate(-85deg) translateY(6%)" }}
                >
                  <span className="animate-pet-sleep-breathe block">
                    {pix ? (
                      <PetPixel form={pix} size={96} asleep active={active} shadow={false} bob={false} title={name} />
                    ) : (
                      <Art size={96} title={name} />
                    )}
                  </span>
                </span>
              ) : (
                <span key={hopKey} className={`${bobClass} block`} style={bobStyle}>
                  {/* 유휴 전용 레이어 — bob 래퍼와 절대 합치지 말 것(합치면 transform 이 덮여 (0,0) 튐) */}
                  <span key={idle?.id ?? "idle"} className={idle ? `${idle.cls} block` : "block"}>
                    {/* 액션 몸 애니(냠냠/부들부들/화들짝) 전용 레이어 */}
                    <span key={fx?.ts ?? "fxb"} className={fxSpec?.body ? `${fxSpec.body} block` : "block"}>
                      <span key={tapKey} className={tapKey ? `${tapClass} block` : "block"}>
                        {pix ? (
                          <PetPixel form={pix} size={96} active={active} shadow={false} bob={false} title={name} />
                        ) : (
                          <Art size={96} title={name} />
                        )}
                      </span>
                    </span>
                  </span>
                </span>
              )}
            </span>
          </span>
        </button>
      </div>

      {/* 쓰다듬기 게이지 — 몇 번 더 만지면 안아주기 (표시 모드에선 숨김) */}
      {!displayMode && pets > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/35 px-2.5 py-1">
          <span className="text-xs font-bold text-white/90">쓰다듬는 중</span>
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
      {/* 힌트 (bare 히어로 모드에선 생략 — 카드 자체 라벨과 중복) */}
      {!bare && (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold text-white/80">
          {asleep ? (onWake ? "탭해서 깨우기 ⏰" : "쉿, 자는 중 💤") : displayMode ? "탭해서 대화 💬" : "탭해서 쓰다듬기 💗"}
        </span>
      )}
    </div>
  );
}
