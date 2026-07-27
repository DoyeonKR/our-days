"use client";

/* 홈 월드 — 홈이 카드 피드가 아니라 **한 폭의 살아있는 세계**가 된다(풀체인지).
   · 하늘: 실제 KST 시각(새벽/낮/노을/밤) × 계절 × 섬 날씨(비/무지개) 반영
   · D-day 가 하늘에 떠 있고, 커버 사진은 폴라로이드로 끈에 매달림(→사진첩)
   · 세계 속 오브젝트가 곧 내비게이션: 우편함(쿡)·표지판(캘린더)·나룻배(우리 섬)·벤치(일기)
   · 지면 중앙엔 펫 무대(children = HomePet hero) — 자고/걷고/말한다
   · 모션은 전부 CSS(로컬 <style>), reduced-motion 존중. active=false 면 시계 정지 */

import { type ReactNode, useEffect, useState } from "react";
import { seasonOf } from "@/lib/island";
import { kstHourOf, skyLook, skyPhaseOf } from "@/lib/scenetime";
import { useGlobalPet } from "@/lib/petglobal";
import { Mailbox, Signpost, RowBoat, BenchBook } from "@/components/island/art/world";
import Icon from "@/components/Icon";

/** 밤하늘 별(고정 좌표 — 랜덤 금지). [x%, y%, size] */
const STARS: [number, number, number][] = [
  [6, 8, 2], [14, 22, 1.5], [22, 6, 2], [31, 16, 1.5], [40, 9, 2], [47, 24, 1.5],
  [56, 7, 2], [64, 18, 1.5], [72, 10, 2], [81, 21, 1.5], [90, 8, 2], [95, 26, 1.5],
  [10, 34, 1.5], [86, 36, 1.5],
];
/** 계절 입자(꽃잎/빛/낙엽/눈) 슬롯 — 고정 오프셋. */
const FALL: { x: number; d: number; dur: number }[] = [
  { x: 10, d: 0, dur: 9 }, { x: 28, d: 3.2, dur: 11 }, { x: 46, d: 6, dur: 8.5 },
  { x: 62, d: 1.6, dur: 10 }, { x: 78, d: 4.4, dur: 9.5 }, { x: 92, d: 7, dur: 11.5 },
];
const FALL_EMOJI = { spring: "🌸", summer: "✨", autumn: "🍂", winter: "❄️" } as const;

export default function HomeWorld({
  me,
  partnerName,
  nDays,
  startLabel,
  coverUrl,
  nextDday,
  active,
  onGoAlbum,
  onGoCalendar,
  onGoDiary,
  onGoIsland,
  onGoPoke,
  onOpenSettings,
  children,
}: {
  me: string;
  partnerName: string;
  nDays: number;
  startLabel: string; // "2025.01.01"
  coverUrl: string | null;
  nextDday: { label: string; dday: string } | null; // 표지판에 표시
  active: boolean; // 홈 탭이 보일 때만 시계/애니 갱신
  onGoAlbum: () => void;
  onGoCalendar: () => void;
  onGoDiary: () => void;
  onGoIsland: () => void;
  onGoPoke: () => void;
  onOpenSettings: () => void;
  children?: ReactNode; // 펫 무대(HomePet hero) 또는 폴백 CTA
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 60_000); // 시간대 전환용 느린 시계
    return () => clearInterval(iv);
  }, [active]);

  const pet = useGlobalPet(); // 날씨/수면(섬과 동기)
  const hour = kstHourOf(now);
  const phase = skyPhaseOf(hour);
  const season = seasonOf(now);
  const look = skyLook(phase, season);
  const weather = pet?.weather ?? "clear";
  const t = new Date(now);

  const skyText = look.onDark ? "text-white" : "text-ink";
  const skySub = look.onDark ? "text-white/75" : "text-ink/60";

  return (
    <section
      className="relative -mx-5 mb-5 overflow-hidden rounded-b-[32px] shadow-[var(--shadow-lg)]"
      style={{ height: "min(58vh, 600px)", minHeight: 470 }}
      aria-label="우리의 세계"
    >
      {/* ── 하늘 ── */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${look.top} 0%, ${look.mid} 52%, ${look.bottom} 100%)`, transition: "background 1s" }}
      />
      {/* 해/달 */}
      <div aria-hidden className="absolute right-[14%] top-[9%]">
        <div
          className="h-12 w-12 rounded-full"
          style={
            look.night
              ? { background: "#fdf6d8", boxShadow: "0 0 34px 10px rgba(253,246,216,0.35)" }
              : { background: phase === "dusk" ? "#ffb45e" : "#ffe58a", boxShadow: "0 0 40px 14px rgba(255,229,138,0.4)" }
          }
        />
        {look.night && <div className="absolute left-1 top-0 h-9 w-9 rounded-full" style={{ background: look.top, opacity: 0.9 }} />}
      </div>
      {/* 밤별 */}
      {look.night && (
        <div aria-hidden className="absolute inset-0">
          {STARS.map(([x, y, s], i) => (
            <span
              key={i}
              className="hw-twinkle absolute rounded-full bg-white"
              style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${(i % 5) * 0.7}s` }}
            />
          ))}
        </div>
      )}
      {/* 구름 */}
      <div aria-hidden className="hw-drift absolute left-[6%] top-[13%] opacity-80">
        <Cloud w={74} o={look.night ? 0.16 : 0.9} />
      </div>
      <div aria-hidden className="hw-drift absolute left-[52%] top-[6%] opacity-70" style={{ animationDelay: "-9s" }}>
        <Cloud w={52} o={look.night ? 0.12 : 0.7} />
      </div>
      {/* 계절 입자 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {FALL.map((f, i) => (
          <span
            key={i}
            className="hw-fall absolute top-0 text-sm"
            style={{ left: `${f.x}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.d - f.dur}s` }}
          >
            {FALL_EMOJI[season]}
          </span>
        ))}
      </div>
      {/* 비/무지개 — 섬 날씨와 같은 하늘 */}
      {weather === "rain" && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="hw-rain absolute top-0 h-4 w-0.5 rounded-full bg-white/50"
              style={{ left: `${(i * 137.5) % 100}%`, animationDuration: `${0.75 + ((i * 7) % 5) / 10}s`, animationDelay: `${(i % 13) * 0.1}s` }}
            />
          ))}
        </div>
      )}
      {weather === "rainbow" && (
        <div
          aria-hidden
          className="absolute left-[8%] top-[16%] h-24 w-44 opacity-70"
          style={{
            background: "conic-gradient(from 270deg at 50% 100%, transparent 0deg, #ff9d9d 10deg, #ffd58a 25deg, #a8e6a1 40deg, #9dc9ff 55deg, #d0a8ff 70deg, transparent 82deg)",
            WebkitMaskImage: "radial-gradient(ellipse 100% 100% at 50% 100%, transparent 52%, #000 56%, #000 78%, transparent 82%)",
            maskImage: "radial-gradient(ellipse 100% 100% at 50% 100%, transparent 52%, #000 56%, #000 78%, transparent 82%)",
          }}
        />
      )}

      {/* ── 헤더 오버레이 ── */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+0.7rem)]">
        <span className={`text-[15px] font-extrabold tracking-tight ${look.onDark ? "text-white" : "text-gradient"}`}>우리의 하루</span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${look.onDark ? "bg-white/15 text-white/85" : "bg-white/55 text-ink/70"} backdrop-blur-sm`}>
            {t.getMonth() + 1}.{t.getDate()} {"일월화수목금토"[t.getDay()]}
          </span>
          <button
            onClick={onOpenSettings}
            aria-label="설정"
            className={`tap grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm ${look.onDark ? "bg-white/15 text-white" : "bg-white/55 text-ink/70"}`}
          >
            <Icon name="settings" size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── D-day (하늘에 떠 있는 타이포) ── */}
      <div className="pointer-events-none absolute inset-x-0 top-[13%] z-10 text-center">
        <p className={`text-sm font-semibold tracking-tight ${skySub}`}>
          {me && partnerName ? `${me} 💕 ${partnerName}` : me ? `${me} 💕 …` : "우리가 함께한 지"}
        </p>
        <div className="mt-1 flex items-end justify-center gap-1.5">
          <span
            className={`text-[4.6rem] font-black leading-[0.9] tabular-nums tracking-[-0.03em] ${skyText}`}
            style={look.onDark ? { textShadow: "0 3px 22px rgba(0,0,0,0.45)" } : { textShadow: "0 2px 14px rgba(255,255,255,0.75)" }}
          >
            {nDays.toLocaleString()}
          </span>
          <span className={`mb-1.5 text-xl font-black ${look.onDark ? "text-white/90" : "text-rose"}`}>일째</span>
        </div>
        <p className={`mt-1 text-[11px] font-medium ${skySub}`}>{startLabel} 부터 · 함께한 시간 💗</p>
      </div>

      {/* ── 폴라로이드(대표사진) — 끈에 매달려 살랑, 탭=사진첩 ── */}
      <button
        onClick={onGoAlbum}
        aria-label="사진첩 열기"
        className="tap absolute left-[4%] top-[8%] z-10"
      >
        <span aria-hidden className="absolute left-1/2 top-[-14px] h-4 w-px bg-white/60" />
        <span className="hw-sway block rounded-md bg-white p-1 pb-3 shadow-[var(--shadow-md)]" style={{ rotate: "-6deg" }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="대표 사진" className="h-14 w-14 rounded-[3px] object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-[3px] bg-rose/10 text-lg">📷</span>
          )}
        </span>
      </button>

      {/* ── 언덕 ── */}
      <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: "46%" }}>
        <div
          className="absolute inset-x-[-10%] bottom-[16%] h-[70%]"
          style={{ background: `radial-gradient(60% 100% at 30% 100%, ${look.hillFar} 0%, transparent 72%), radial-gradient(55% 100% at 78% 100%, ${look.hillFar} 0%, transparent 70%)`, transition: "background 1s" }}
        />
        <div
          className="absolute inset-x-[-6%] bottom-0 h-[64%] rounded-[50%_50%_0_0/100%_100%_0_0]"
          style={{ background: look.hillNear, transition: "background 1s" }}
        />
      </div>

      {/* ── 세계 속 오브젝트(= 내비게이션) ── */}
      <WorldProp label="쿡찌르기" x="3%" bottom="34%" onClick={onGoPoke} onDark={look.onDark}>
        <Mailbox size={56} />
      </WorldProp>
      <WorldProp label={nextDday ? `${nextDday.dday} ${nextDday.label}` : "캘린더"} x="auto" right="3%" bottom="35%" onClick={onGoCalendar} onDark={look.onDark}>
        <Signpost size={62} />
      </WorldProp>
      <WorldProp label="우리 섬" x="2%" bottom="4%" onClick={onGoIsland} onDark={look.onDark} z={30}>
        <span className="hw-boat-bob block">
          <RowBoat size={64} />
        </span>
      </WorldProp>
      <WorldProp label="일기장" x="auto" right="2%" bottom="3%" onClick={onGoDiary} onDark={look.onDark} z={30}>
        <BenchBook size={60} />
      </WorldProp>

      {/* ── 펫 무대(지면 중앙) — 자고/걷고/말한다 ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-1.5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.30))" }}
        />
        <div className="relative">{children}</div>
      </div>

      {/* 씬 전용 모션 — 전역 오염 없이 여기서만 */}
      <style>{`
        @keyframes hw-drift-x { 0%,100% { transform: translateX(-10px) } 50% { transform: translateX(12px) } }
        .hw-drift { animation: hw-drift-x 22s ease-in-out infinite; }
        @keyframes hw-twinkle-o { 0%,100% { opacity: .9 } 50% { opacity: .35 } }
        .hw-twinkle { animation: hw-twinkle-o 3.6s ease-in-out infinite; }
        @keyframes hw-fall-y { 0% { transform: translateY(-6%) rotate(0); opacity: 0 } 12% { opacity: .9 } 88% { opacity: .9 } 100% { transform: translateY(105vh) rotate(200deg); opacity: 0 } }
        .hw-fall { animation: hw-fall-y linear infinite; }
        @keyframes hw-rain-y { 0% { transform: translateY(-8%); opacity: 0 } 12% { opacity: .85 } 100% { transform: translateY(60vh); opacity: 0 } }
        .hw-rain { animation: hw-rain-y linear infinite; }
        @keyframes hw-sway-r { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .hw-sway { animation: hw-sway-r 4.5s ease-in-out infinite; transform-origin: 50% -14px; }
        @keyframes hw-boat-y { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-4px) rotate(1.5deg) } }
        .hw-boat-bob { animation: hw-boat-y 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hw-drift, .hw-twinkle, .hw-fall, .hw-rain, .hw-sway, .hw-boat-bob { animation: none; }
        }
      `}</style>
    </section>
  );
}

/** 구름 조각. */
function Cloud({ w, o }: { w: number; o: number }) {
  return (
    <svg viewBox="0 0 80 34" width={w} height={(w * 34) / 80} aria-hidden opacity={o}>
      <ellipse cx={30} cy={20} rx={22} ry={10} fill="#fff" />
      <ellipse cx={14} cy={24} rx={13} ry={8} fill="#fff" />
      <ellipse cx={50} cy={23} rx={16} ry={8.5} fill="#fff" />
      <ellipse cx={38} cy={13} rx={13} ry={9} fill="#fff" />
    </svg>
  );
}

/** 세계 속 오브젝트 버튼 — 소품 + 유리 칩 라벨. */
function WorldProp({
  label,
  x,
  right,
  bottom,
  z = 10,
  onDark,
  onClick,
  children,
}: {
  label: string;
  x: string; // left 값("auto"면 right 사용)
  right?: string;
  bottom: string;
  z?: number;
  onDark: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="tap absolute flex flex-col items-center"
      style={{ left: x === "auto" ? undefined : x, right, bottom, zIndex: z }}
    >
      {children}
      <span
        className={`-mt-1 max-w-[92px] truncate rounded-full px-2 py-0.5 text-[9px] font-bold backdrop-blur-sm ${
          onDark ? "bg-white/18 text-white/90" : "bg-white/60 text-ink/75"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
