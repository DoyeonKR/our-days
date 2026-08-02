"use client";

/* 홈 월드 — 홈이 카드 피드가 아니라 **한 폭의 살아있는 세계**가 된다(풀체인지).
   · 하늘: 실제 KST 시각(새벽/낮/노을/밤) × 계절 × 섬 날씨(비/무지개) 반영
   · D-day 가 하늘에 떠 있고, 커버 사진은 폴라로이드로 끈에 매달림(→사진첩)
   · 세계 속 오브젝트가 곧 내비게이션: 우편함(쿡)·표지판(캘린더)·나룻배(우리 섬)·벤치(일기)
   · 지면 중앙엔 펫 무대(children = HomePet hero) — 자고/걷고/말한다
   · 모션은 전부 CSS(로컬 <style>), reduced-motion 존중. active=false 면 시계 정지 */

import { type ReactNode, useEffect, useState } from "react";
import { seasonOf } from "@/lib/island";
import {
  kstHourFloatOf,
  lightPos,
  moonPhase,
  type SkyLook,
  skyLook,
  skyPhaseOf,
} from "@/lib/scenetime";
import { useGlobalPet } from "@/lib/petglobal";
import PixelProp from "@/components/island/WorldProp";
import Icon from "@/components/Icon";

/** 밤하늘 별(고정 좌표 — 랜덤 금지). [x%, y%, size, 밝기] — 크기·밝기를 흩어 깊이감. */
const STARS: [number, number, number, number][] = [
  [6, 8, 2, 1], [14, 22, 1.4, 0.6], [22, 6, 2.4, 1], [31, 16, 1.2, 0.5], [40, 9, 1.8, 0.85],
  [47, 24, 1.3, 0.55], [56, 7, 2.2, 1], [64, 18, 1.4, 0.6], [72, 10, 1.9, 0.9],
  [81, 21, 1.2, 0.5], [90, 8, 2.3, 1], [95, 26, 1.4, 0.6], [10, 34, 1.3, 0.5],
  [86, 36, 1.5, 0.65], [35, 30, 1.1, 0.45], [52, 33, 1.2, 0.5], [26, 40, 1, 0.4],
  [68, 38, 1.1, 0.45], [3, 18, 1.3, 0.55], [44, 14, 1, 0.4], [59, 27, 1.6, 0.7],
  [77, 30, 1, 0.4], [18, 12, 1.5, 0.7], [88, 16, 1.1, 0.45],
];
/** 새 실루엣 궤적(낮에만) — 고정 슬롯. */
const BIRDS: { y: number; d: number; dur: number; s: number }[] = [
  { y: 22, d: 0, dur: 26, s: 1 },
  { y: 17, d: -7, dur: 31, s: 0.75 },
  { y: 27, d: -15, dur: 35, s: 0.6 },
];
/** 반딧불(밤/땅거미) — 고정 좌표. */
const FIREFLIES: { x: number; y: number; d: number }[] = [
  { x: 12, y: 74, d: 0 }, { x: 27, y: 82, d: 1.7 }, { x: 41, y: 70, d: 3.1 },
  { x: 63, y: 79, d: 0.9 }, { x: 78, y: 72, d: 2.4 }, { x: 90, y: 84, d: 4.2 },
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
  const hour = kstHourFloatOf(now); // 분 단위 — 광원 궤도가 매끄럽게
  const phase = skyPhaseOf(hour);
  const season = seasonOf(now);
  const look = skyLook(phase, season);
  const weather = pet?.weather ?? "clear";
  const t = new Date(now);
  const sun = lightPos(hour); // 해/달 궤도 위치(0~1 비율)
  const mphase = moonPhase(now); // 실제 달 위상

  const skyText = look.onDark ? "text-white" : "text-ink";
  const skySub = look.onDark ? "text-white/75" : "text-ink/60";

  return (
    <section
      className="relative -mx-5 mb-5 overflow-hidden rounded-b-[32px] shadow-[var(--shadow-lg)]"
      style={{ height: "min(58vh, 600px)", minHeight: 470 }}
      aria-label="우리의 세계"
    >
      {/* ── 하늘 — 5-스톱 대기층 + 지평선 헤이즈(광원 쪽이 더 밝다) ── */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${look.top} 0%, ${look.upper} 26%, ${look.mid} 52%, ${look.lower} 76%, ${look.bottom} 100%)`,
          transition: "background 1.2s",
        }}
      />
      {/* 지평선 산란 — 광원 방향에서 번지는 빛(대기감) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[38%] top-0"
        style={{
          background: `radial-gradient(120% 62% at ${sun.x * 100}% 100%, ${look.haze} 0%, transparent 68%)`,
          opacity: 0.55,
          transition: "background 1.2s",
        }}
      />
      {/* 은하수 — 깊은 밤에만 아주 은은하게 */}
      {look.starOpacity > 0.9 && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[46%]"
          style={{
            background: "linear-gradient(104deg, transparent 34%, rgba(190,205,255,0.16) 48%, rgba(226,214,255,0.1) 56%, transparent 68%)",
          }}
        />
      )}
      {/* 별 — 밝기 연속값(여명/땅거미엔 은은히 남음) */}
      {look.starOpacity > 0.02 && (
        <div aria-hidden className="absolute inset-0" style={{ opacity: look.starOpacity }}>
          {STARS.map(([x, y, s, b], i) => (
            <span
              key={i}
              className="hw-twinkle absolute rounded-full bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: s,
                height: s,
                opacity: b,
                boxShadow: s > 2 ? "0 0 4px rgba(255,255,255,0.9)" : undefined,
                animationDelay: `${(i % 7) * 0.55}s`,
                animationDuration: `${3 + (i % 4)}s`,
              }}
            />
          ))}
          {/* 별똥별 — 가끔 스윽 (깊은 밤 한정) */}
          {look.starOpacity > 0.9 && <span className="hw-shoot absolute" />}
        </div>
      )}
      {/* ── 해 / 달 — 시각에 따라 궤도를 돈다 ── */}
      <div
        aria-hidden
        className="absolute"
        style={{ left: `${sun.x * 100}%`, top: `${sun.y * 100}%`, transform: "translate(-50%,-50%)", transition: "left 1.2s, top 1.2s" }}
      >
        {look.moon ? (
          <Moon phase={mphase} look={look} />
        ) : (
          <>
            {/* 후광 — 낮은 고도(일출/노을)일수록 크고 붉게 */}
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 190, height: 190, background: `radial-gradient(circle, ${look.glow} 0%, transparent 66%)` }}
            />
            <span
              className="hw-sun-pulse block rounded-full"
              style={{
                width: 46,
                height: 46,
                background: `radial-gradient(circle at 38% 34%, #fff 0%, ${look.light} 46%, ${look.light} 100%)`,
                boxShadow: `0 0 30px 8px ${look.glow}`,
              }}
            />
          </>
        )}
      </div>
      {/* ── 구름 — 윗면(광원색)/아랫면(그늘) 2톤, 3층 시차 ── */}
      <div aria-hidden className="hw-drift absolute left-[4%] top-[14%]" style={{ animationDuration: "26s" }}>
        <Cloud w={92} lit={look.cloudLit} shade={look.cloudShade} o={look.night ? 0.5 : 0.95} />
      </div>
      <div aria-hidden className="hw-drift absolute left-[54%] top-[7%]" style={{ animationDelay: "-9s", animationDuration: "34s" }}>
        <Cloud w={62} lit={look.cloudLit} shade={look.cloudShade} o={look.night ? 0.4 : 0.8} />
      </div>
      <div aria-hidden className="hw-drift absolute left-[28%] top-[24%]" style={{ animationDelay: "-17s", animationDuration: "44s" }}>
        <Cloud w={44} lit={look.cloudLit} shade={look.cloudShade} o={look.night ? 0.3 : 0.55} />
      </div>
      {/* 새 — 낮 시간대의 생기 */}
      {(phase === "morning" || phase === "day" || phase === "golden") && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {BIRDS.map((b, i) => (
            <span
              key={i}
              className="hw-bird absolute"
              style={{ top: `${b.y}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.d}s`, transform: `scale(${b.s})` }}
            >
              <Birds tint={look.cloudShade} />
            </span>
          ))}
        </div>
      )}
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
        <span className={`text-sm font-extrabold tracking-tight ${look.headerDark ? "text-white" : "text-gradient"}`}>우리의 하루</span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${look.headerDark ? "bg-white/15 text-white/85" : "bg-white/55 text-ink/70"}`}>
            {t.getMonth() + 1}.{t.getDate()} {"일월화수목금토"[t.getDay()]}
            <span className="ml-1.5 font-semibold opacity-75">{look.label}</span>
          </span>
          <button
            onClick={onOpenSettings}
            aria-label="설정"
            className={`tap grid h-8 w-8 place-items-center rounded-full ${look.headerDark ? "bg-white/15 text-white" : "bg-white/55 text-ink/70"}`}
          >
            <Icon name="settings" size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── D-day (하늘에 떠 있는 타이포) ── */}
      <div className="pointer-events-none absolute inset-x-0 top-[17%] z-10 text-center">
        <p className={`text-sm font-semibold tracking-tight ${skySub}`}>
          {me && partnerName ? `${me} 💕 ${partnerName}` : me ? `${me} 💕 …` : "우리가 함께한 지"}
        </p>
        <div className="mt-1 flex items-end justify-center gap-1.5">
          <span
            /* 72px = Galmuri11 격자(12)의 6배. 4.6rem(73.6px)이나 음수 자간은 반픽셀에 앉아 흐려진다.
               그림자도 블러 대신 **하드 오프셋 2도트** — 픽셀 톤에서 blur 는 도트를 뭉갠다. */
            className={`text-[72px] font-black leading-[76px] tabular-nums ${skyText}`}
            style={look.onDark ? { textShadow: "4px 4px 0 rgba(0,0,0,0.45)" } : { textShadow: "4px 4px 0 rgba(255,255,255,0.75)" }}
          >
            {nDays.toLocaleString()}
          </span>
          <span className={`mb-1.5 text-xl font-black ${look.onDark ? "text-white/90" : "text-rose"}`}>일째</span>
        </div>
        <p className={`mt-1 text-sm font-medium ${skySub}`}>{startLabel} 부터 · 함께한 시간 💗</p>
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

      {/* ── 풍경 — 원경 산 → 먼 언덕 → 중경(나무숲) → 근경. 대기 원근으로 겹겹이 ── */}
      <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: "52%" }}>
        <svg viewBox="0 0 400 210" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {/* 원경 산줄기 — 봉우리 높이·간격을 불규칙하게(균일 삼각형은 조악해 보임) */}
          <path
            d="M0 104 L26 88 L44 95 L74 62 L96 79 L112 71 L140 92 L164 80 L186 97 L212 55 L238 86 L262 76 L286 99 L316 83 L340 93 L364 74 L382 90 L400 82 L400 210 L0 210 Z"
            fill={mixColor(look.hillFar, look.haze, 0.68)}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 설선/능선 하이라이트 — 큰 봉우리 두 개에만(디테일) */}
          <path
            d="M74 62 L84 73 L78 74 L70 79 Z M212 55 L224 69 L216 70 L206 74 Z"
            fill={mixColor(look.light, look.haze, 0.35)}
            opacity={look.night ? 0.12 : 0.32}
          />
          {/* 산자락 안개 — 원경과 중경 사이 대기층 */}
          <rect
            x="0"
            y="92"
            width="400"
            height="42"
            fill={look.haze}
            opacity={0.45}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 먼 언덕 */}
          <path
            d="M0 128 C46 100 92 104 136 124 C176 142 214 118 254 112 C298 106 340 124 400 108 L400 210 L0 210 Z"
            fill={look.hillFar}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 중경 언덕 */}
          <path
            d="M0 158 C58 132 108 146 158 156 C206 166 250 142 300 148 C342 153 372 166 400 156 L400 210 L0 210 Z"
            fill={look.hillMid}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 근경 — 부드러운 능선 */}
          <path
            d="M0 186 C54 168 104 178 160 184 C212 190 258 176 312 180 C352 183 378 190 400 184 L400 210 L0 210 Z"
            fill={look.hillNear}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 근경 하이라이트 — 광원 방향에서 능선에 닿는 빛 */}
          <path
            d="M0 186 C54 168 104 178 160 184 C212 190 258 176 312 180 C352 183 378 190 400 184 L400 191 C378 197 352 190 312 187 C258 183 212 197 160 191 C104 185 54 175 0 193 Z"
            fill={look.light}
            opacity={look.night ? 0.06 : look.onDark ? 0.28 : 0.18}
          />
        </svg>
        {/* 중경 나무숲 실루엣 — 언덕에 얹혀 깊이를 만든다(비율 유지 SVG) */}
        <svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0" style={{ bottom: "22%", height: "18%" }}>
          {TREES.map((tr, i) => (
            <Tree key={i} x={tr.x} s={tr.s} kind={tr.k} fill={mixColor(look.hillNear, look.night ? "#000000" : look.hillFar, look.night ? 0.3 : 0.42)} />
          ))}
        </svg>
      </div>
      {/* 반딧불 — 밤/땅거미에 지면 근처에서 반짝 */}
      {look.starOpacity > 0.5 && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className="hw-firefly absolute rounded-full"
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: 3,
                height: 3,
                background: "#ffe98a",
                boxShadow: "0 0 6px 2px rgba(255,233,138,0.65)",
                animationDelay: `${f.d}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── 세계 속 오브젝트(= 내비게이션) ── */}
      <WorldProp label="쿡찌르기" x="3%" bottom="34%" onClick={onGoPoke} onDark={look.onDark}>
        <PixelProp kind="mailbox" size={56} />
      </WorldProp>
      <WorldProp label={nextDday ? `${nextDday.dday} ${nextDday.label}` : "캘린더"} x="auto" right="3%" bottom="35%" onClick={onGoCalendar} onDark={look.onDark}>
        <PixelProp kind="signpost" size={62} />
      </WorldProp>
      <WorldProp label="우리 섬" x="2%" bottom="4%" onClick={onGoIsland} onDark={look.onDark} z={30}>
        <span className="hw-boat-bob block">
          <PixelProp kind="rowboat" size={64} />
        </span>
      </WorldProp>
      <WorldProp label="일기장" x="auto" right="2%" bottom="3%" onClick={onGoDiary} onDark={look.onDark} z={30}>
        <PixelProp kind="benchbook" size={60} />
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
        @keyframes hw-sun-b { 0%,100% { filter: brightness(1) } 50% { filter: brightness(1.08) } }
        .hw-sun-pulse { animation: hw-sun-b 7s ease-in-out infinite; }
        @keyframes hw-bird-x { 0% { transform: translateX(-14vw) } 100% { transform: translateX(114vw) } }
        .hw-bird { animation: hw-bird-x linear infinite; left: 0; }
        @keyframes hw-ff { 0%,100% { opacity: 0; transform: translate(0,0) } 20% { opacity: .95 } 50% { opacity: .5; transform: translate(9px,-12px) } 80% { opacity: .9; transform: translate(-6px,-4px) } }
        .hw-firefly { animation: hw-ff 6.5s ease-in-out infinite; }
        @keyframes hw-shoot-a {
          0%, 92% { opacity: 0; transform: translate(0,0) }
          93% { opacity: 1 }
          100% { opacity: 0; transform: translate(-160px, 90px) }
        }
        .hw-shoot { top: 12%; right: 14%; width: 74px; height: 1.5px; border-radius: 2px;
          background: linear-gradient(90deg, transparent, #fff); animation: hw-shoot-a 14s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hw-drift, .hw-twinkle, .hw-fall, .hw-rain, .hw-sway, .hw-boat-bob,
          .hw-sun-pulse, .hw-bird, .hw-firefly, .hw-shoot { animation: none; }
          .hw-shoot { opacity: 0; }
        }
      `}</style>
    </section>
  );
}

/** 두 색 혼합(#rrggbb) — scenetime.mixHex 와 같은 계약을 씬 로컬에서도 사용. */
function mixColor(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 중경 나무 실루엣 슬롯(고정) — k: 침엽수/활엽수. */
const TREES: { x: number; s: number; k: "pine" | "round" }[] = [
  { x: 14, s: 0.8, k: "pine" }, { x: 30, s: 1, k: "round" }, { x: 46, s: 0.7, k: "pine" },
  { x: 68, s: 0.9, k: "round" }, { x: 96, s: 0.65, k: "pine" }, { x: 128, s: 1.05, k: "round" },
  { x: 150, s: 0.75, k: "pine" }, { x: 176, s: 0.9, k: "round" }, { x: 208, s: 0.7, k: "pine" },
  { x: 232, s: 1, k: "round" }, { x: 256, s: 0.8, k: "pine" }, { x: 284, s: 0.95, k: "round" },
  { x: 312, s: 0.7, k: "pine" }, { x: 338, s: 0.85, k: "round" }, { x: 366, s: 0.75, k: "pine" },
  { x: 388, s: 0.9, k: "round" },
];

/** 나무 한 그루(실루엣) — 바닥선 y=58 기준. */
function Tree({ x, s, kind, fill }: { x: number; s: number; kind: "pine" | "round"; fill: string }) {
  const h = 30 * s;
  const w = 11 * s;
  return kind === "pine" ? (
    <path
      d={`M${x} ${58 - h} L${x + w} 58 L${x - w} 58 Z`}
      fill={fill}
      style={{ transition: "fill 1.2s" }}
    />
  ) : (
    <g style={{ transition: "fill 1.2s" }} fill={fill}>
      <rect x={x - 1 * s} y={58 - h * 0.45} width={2 * s} height={h * 0.45} />
      <ellipse cx={x} cy={58 - h * 0.62} rx={w * 1.05} ry={h * 0.42} />
    </g>
  );
}

/** 달 — 실제 위상(초승↔보름)을 그림자 원 오프셋으로 표현 + 크레이터. */
function Moon({ phase, look }: { phase: number; look: SkyLook }) {
  // phase 0=삭 · 0.5=보름 — 그림자 원을 좌우로 밀어 위상을 만든다
  const k = Math.cos(phase * Math.PI * 2); // 1(삭) → -1(보름)
  const shadowDx = k * 30;
  return (
    <div className="relative" style={{ width: 46, height: 46 }}>
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 150, height: 150, background: `radial-gradient(circle, ${look.glow} 0%, transparent 62%)` }}
      />
      <svg viewBox="0 0 46 46" width={46} height={46} className="relative">
        <defs>
          <clipPath id="hw-moon-clip">
            <circle cx={23} cy={23} r={22} />
          </clipPath>
        </defs>
        <g clipPath="url(#hw-moon-clip)">
          <circle cx={23} cy={23} r={22} fill={look.light} />
          {/* 크레이터 — 디테일 */}
          <circle cx={17} cy={17} r={4.4} fill="#000" opacity={0.07} />
          <circle cx={29} cy={26} r={5.6} fill="#000" opacity={0.06} />
          <circle cx={20} cy={31} r={3} fill="#000" opacity={0.05} />
          <circle cx={32} cy={14} r={2.4} fill="#000" opacity={0.05} />
          {/* 위상 그림자 */}
          <circle cx={23 + shadowDx} cy={23} r={22} fill={look.top} opacity={0.94} />
        </g>
      </svg>
    </div>
  );
}

/** 구름 — 윗면은 광원색, 아랫면은 그늘색(2톤이라 볼륨이 산다). */
function Cloud({ w, lit, shade, o }: { w: number; lit: string; shade: string; o: number }) {
  return (
    <svg viewBox="0 0 92 40" width={w} height={(w * 40) / 92} aria-hidden opacity={o}>
      {/* 그늘(아랫배) */}
      <g fill={shade} style={{ transition: "fill 1.2s" }}>
        <ellipse cx={34} cy={27} rx={26} ry={11} />
        <ellipse cx={15} cy={30} rx={14} ry={8} />
        <ellipse cx={58} cy={29} rx={18} ry={9} />
      </g>
      {/* 광원 받는 윗면 */}
      <g fill={lit} style={{ transition: "fill 1.2s" }}>
        <ellipse cx={34} cy={22} rx={25} ry={10.5} />
        <ellipse cx={16} cy={25} rx={13} ry={7.5} />
        <ellipse cx={57} cy={24} rx={17} ry={8.5} />
        <ellipse cx={42} cy={14} rx={15} ry={9.5} />
        <ellipse cx={26} cy={16} rx={11} ry={7.5} />
      </g>
    </svg>
  );
}

/** 새 두 마리 실루엣(V자). */
function Birds({ tint }: { tint: string }) {
  return (
    <svg viewBox="0 0 34 14" width={26} height={11} aria-hidden>
      <g fill="none" stroke={tint} strokeWidth={1.4} strokeLinecap="round" opacity={0.7}>
        <path d="M2 7 Q6 3 10 7" />
        <path d="M10 7 Q14 2.4 18 7" />
        <path d="M20 10 Q23 7 26 10" />
      </g>
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
        className={`-mt-1 max-w-[92px] truncate rounded-full px-2 py-0.5 text-xs font-bold ${
          onDark ? "bg-white/18 text-white/90" : "bg-white/60 text-ink/75"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
