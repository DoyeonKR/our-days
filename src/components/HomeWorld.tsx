"use client";

/* 홈 월드 — 홈이 카드 피드가 아니라 **한 폭의 살아있는 세계**가 된다(풀체인지).
   · 하늘: 실제 KST 시각(새벽/낮/노을/밤) × 계절 × 섬 날씨(비/무지개) 반영
   · D-day 가 하늘에 떠 있고, 커버 사진은 폴라로이드로 끈에 매달림(→사진첩)
   · 세계 속 오브젝트가 곧 내비게이션: 우편함(쿡)·표지판(캘린더)·나룻배(우리 섬)·벤치(일기)
   · 지면 중앙엔 펫 무대(children = HomePet hero) — 자고/걷고/말한다
   · 모션은 전부 CSS(로컬 <style>), reduced-motion 존중. active=false 면 시계 정지 */

import { type ReactNode, useEffect, useId, useState } from "react";
import { seasonOf } from "@/lib/island";
import {
  kstHourFloatOf,
  lightPos,
  moonLitPath,
  moonPhase,
  type SkyLook,
  skyLook,
  skyPhaseOf,
} from "@/lib/scenetime";
import { useGlobalPet } from "@/lib/petglobal";
import { useGlobalPoke } from "@/lib/pokeglobal";
import PixelProp from "@/components/island/WorldProp";
import { bands, haloRings } from "@/lib/pixelscene";
import PixelSprite from "@/components/island/PixelSprite";
import { ALL_FX_SPRITES, FALLER_SPRITE, PIXEL_HEART } from "@/lib/pixelfx";
import { occasionOf } from "@/lib/occasion";
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
/* 계절 입자는 스프라이트다(lib/pixelfx). OS 컬러 이모지는 기기마다 다른 그림이 나오고,
   픽셀 씬 안에서 혼자 벡터·그라데이션이라 즉시 이질적으로 보인다. */

/** 경사 입자 슬롯 — 계절 입자(6개)보다 촘촘하다. 축하는 밀도가 곧 감정이다. */
const PARTY: { x: number; d: number; dur: number }[] = [
  { x: 6, d: 0, dur: 5.5 }, { x: 17, d: 1.4, dur: 6.5 }, { x: 29, d: 2.9, dur: 5 },
  { x: 38, d: 0.7, dur: 7 }, { x: 50, d: 3.6, dur: 5.8 }, { x: 61, d: 1.9, dur: 6.2 },
  { x: 72, d: 4.3, dur: 5.2 }, { x: 83, d: 2.2, dur: 6.8 }, { x: 94, d: 0.4, dur: 6 },
];

export default function HomeWorld({
  me,
  partnerName,
  nDays,
  startLabel,
  coverUrl,
  photos,
  nextDday,
  diaryBadge,
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
  /** 끈에 걸 최근 사진(썸네일). 비면 커버 한 장만, 그것도 없으면 카메라 플레이스홀더. */
  photos?: { id: string; url: string; date: string }[];
  nextDday: { label: string; dday: string } | null; // 표지판에 표시
  /** 벤치(일기장) 배지 — 오늘 상대가 쓴 새 일기 / 내가 아직 안 씀. */
  diaryBadge?: PropBadge;
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

  const pet = useGlobalPet(); // 날씨/수면/할 일(섬과 동기)
  const poke = useGlobalPoke(); // 안 본 쿡 개수(로컬 기준선)
  const hour = kstHourFloatOf(now); // 분 단위 — 광원 궤도가 매끄럽게
  const phase = skyPhaseOf(hour);
  const season = seasonOf(now);
  const look = skyLook(phase, season);
  const weather = pet?.weather ?? "clear";
  const t = new Date(now);
  const sun = lightPos(hour); // 해/달 궤도 위치(0~1 비율)
  const mphase = moonPhase(now); // 실제 달 위상

  /* 끈에 걸 사진 — 최근 3장. 목록이 없으면 대표사진 한 장으로 폴백(기존 동작 유지).
     3장 초과는 자르지 않고 처음 3장만 — 좁은 화면에서 넷째부터는 표지판 영역을 침범한다. */
  const hung: { id: string; url: string; date: string }[] =
    photos && photos.length > 0
      ? photos.slice(0, 3)
      : coverUrl
        ? [{ id: "cover", url: coverUrl, date: "" }]
        : [];

  const windy = weather === "wind";
  /* 오늘의 경사 — 100일 단위·기념일 당일·크리스마스·새해. 데이터 비용 0(이미 있는 props 파생). */
  const occ = occasionOf(nDays, nextDday?.dday === "D-DAY", now);

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
          // 픽셀 하늘은 보간이 아니라 **색 띠**다. 계단이 스타일 자체라 밴딩을 숨기지 않는다.
          background: bands([look.top, look.upper, look.mid, look.lower, look.bottom]),
          transition: "background 1.2s",
        }}
      />
      {/* 지평선 산란 — 광원 방향에서 번지는 빛(대기감) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[38%] top-0"
        style={{
          // radial 산란 → 광원 쪽만 밝은 **가로 2단 띠**(부드러운 번짐은 도트를 뭉갠다)
          background: `linear-gradient(180deg, transparent 0%, transparent 62%, ${look.haze} 62%, ${look.haze} 100%)`,
          opacity: 0.4,
          transition: "background 1.2s",
        }}
      />
      {/* 은하수는 뺐다 — 사선 그라데이션은 도트 격자를 가로질러 흐려, 픽셀 하늘에선 얼룩으로 보인다.
          밤의 깊이는 아래 별(네모 도트)의 밀도와 밝기로 표현한다. */}
      {/* 별 — 밝기 연속값(여명/땅거미엔 은은히 남음) */}
      {look.starOpacity > 0.02 && (
        <div aria-hidden className="absolute inset-0" style={{ opacity: look.starOpacity }}>
          {STARS.map(([x, y, s, b], i) => (
            <span
              key={i}
              // 별 = **정사각 도트**. 둥근 원 + 블러 글로우는 픽셀 하늘에서 가장 먼저 티가 난다.
              // 크기는 2px/4px 두 단계로만 스냅(1.2px 같은 값은 반픽셀에 앉아 흐려진다).
              className="hw-twinkle absolute bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: s > 1.6 ? 4 : 2,
                height: s > 1.6 ? 4 : 2,
                opacity: b,
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
            {/* 후광 = 블러가 아니라 **동심 하드 링**(box-shadow spread 만 사용, blur 0) */}
            <span
              className="hw-sun-pulse block"
              style={{
                width: 24,
                height: 24,
                background: look.light,
                boxShadow: haloRings(look.glow, [6, 12, 20]),
              }}
            />
          </>
        )}
      </div>
      {/* ── 구름 — 윗면(광원색)/아랫면(그늘) 2톤, 3층 시차 ── */}
      <div aria-hidden className="hw-drift absolute left-[4%] top-[14%]" style={{ animationDuration: windy ? "11s" : "26s" }}>
        <Cloud w={92} lit={look.cloudLit} shade={look.cloudShade} o={look.night ? 0.5 : 0.95} />
      </div>
      <div aria-hidden className="hw-drift absolute left-[54%] top-[7%]" style={{ animationDelay: "-9s", animationDuration: windy ? "14s" : "34s" }}>
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
{/* 계절 입자 — 바람 부는 날엔 빠르고 **사선으로** 날린다(예전엔 wind 가 홈에서 완전히 투명) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {FALL.map((f, i) => (
          <span
            key={i}
            className={windy ? "hw-blow absolute top-0" : "hw-fall absolute top-0"}
            style={{
              left: `${f.x}%`,
              animationDuration: `${windy ? f.dur * 0.45 : f.dur}s`,
              animationDelay: `${f.d - f.dur}s`,
            }}
          >
            <PixelSprite sprite={FALLER_SPRITE[season]} size={8} />
          </span>
        ))}
      </div>
      {/* 비/무지개 — 섬 날씨와 같은 하늘 */}
{/* 비 — 겨울엔 눈보라로(같은 슬롯을 재사용해 밀도는 유지, 속도·모양만 바꾼다) */}
      {weather === "rain" && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={look.snow ? "hw-rain absolute top-0 h-1 w-1 bg-white/85" : "hw-rain absolute top-0 h-4 w-0.5 bg-white/50"}
              style={{
                left: `${(i * 137.5) % 100}%`,
                animationDuration: `${(look.snow ? 3.2 : 0.75) + ((i * 7) % 5) / 10}s`,
                animationDelay: `${(i % 13) * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* 무지개는 **해가 떠 있을 때만** — 예전엔 한밤중에도 떴다 */}
      {weather === "rainbow" && !look.moon && look.starOpacity < 0.5 && (
        <div
          aria-hidden
          className="absolute left-[8%] top-[16%] h-24 w-44 opacity-70"
          style={{
            background: "conic-gradient(from 270deg at 50% 100%, transparent 0deg, #ff9d9d 10deg, #ffd58a 25deg, #a8e6a1 40deg, #9dc9ff 55deg, #d0a8ff 70deg, transparent 82deg)",
            // 타원 마스크 → **가로 하드 컷**(곡선 마스크는 도트 경계를 반드시 부순다)
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, transparent 54%, #000 54%, #000 80%, transparent 80%)",
            maskImage: "linear-gradient(180deg, transparent 0%, transparent 54%, #000 54%, #000 80%, transparent 80%)",
          }}
        />
      )}

      {/* ── 오늘의 경사 — 하늘을 갈아끼우지 않고 **얹는다**(밤/낮 모두에서 동작) ── */}
      {occ && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
            {PARTY.map((p, i) => (
              <span
                key={i}
                className="hw-party absolute top-0"
                style={{ left: `${p.x}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.d - p.dur}s` }}
              >
                <PixelSprite sprite={ALL_FX_SPRITES[occ.fx] ?? PIXEL_HEART} size={8} />
              </span>
            ))}
          </div>
          {/* 리본 — D-day 타이포 바로 위, 펫 무대와 겹치지 않는 높이 */}
          <div className="pointer-events-none absolute inset-x-0 top-[30%] z-20 flex justify-center px-6">
            <span
              className="animate-pop px-3 py-1 text-sm font-black text-white"
              style={{ background: occ.tint, boxShadow: "0 0 0 2px rgba(0,0,0,0.28)" }}
            >
              {occ.emoji} {occ.label}
            </span>
          </div>
        </>
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
          {me && partnerName ? (
            <span className="inline-flex items-center gap-1.5 align-middle">
              {me}
              <PixelSprite sprite={PIXEL_HEART} size={8} className="inline-block" />
              {partnerName}
            </span>
          ) : me ? (
            <span className="inline-flex items-center gap-1.5 align-middle">
              {me}
              <PixelSprite sprite={PIXEL_HEART} size={8} className="inline-block" />…
            </span>
          ) : (
            "우리가 함께한 지"
          )}
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
        <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${skySub}`}>
          {startLabel} 부터 · 함께한 시간
          <PixelSprite sprite={PIXEL_HEART} size={8} className="inline-block" />
        </p>
      </div>

      {/* ── 사진 빨랫줄 — 우리 사진 여러 장이 끈에 걸려 살랑, 탭=사진첩 ──
          예전엔 56px 폴라로이드 한 장이 구석에 붙어 있어 '사진이 걸려 있다'는 느낌이 없었다.
          최근 사진을 3장까지 걸고 크기를 키운다(썸네일이 480px 라 88px×3DPR 까지 버틴다).
          정적 export 라 next/image 대신 <img> — 서명 URL 만료 대비로 onError 는 조용히 숨긴다. */}
      <div className="absolute inset-x-0 top-[7%] z-10 px-[4%]">
        {/* 빨랫줄 — 사진 뒤로 지나가는 실 한 가닥 */}
        <span
          aria-hidden
          className="absolute inset-x-[4%] top-[6px] block h-px"
          style={{ background: look.onDark ? "rgba(255,255,255,0.45)" : "rgba(60,46,31,0.35)" }}
        />
        <button
          onClick={onGoAlbum}
          aria-label={hung.length ? `사진첩 열기 — 최근 사진 ${hung.length}장` : "사진첩 열기"}
          className="tap relative flex items-start gap-2"
        >
          {hung.length > 0 ? (
            hung.map((p, i) => (
              <span
                key={p.id}
                className="hw-sway block bg-white p-1 pb-4 shadow-[var(--shadow-md)]"
                // 장마다 각도·지연을 달리해 '같은 걸 복사한' 티를 없앤다(랜덤 아님 — 인덱스 파생)
                style={{
                  rotate: `${[-6, 4, -3][i] ?? 0}deg`,
                  marginTop: [0, 6, 2][i] ?? 0,
                  animationDelay: `${i * 0.7}s`,
                }}
              >
                {/* 집게 */}
                <span aria-hidden className="absolute left-1/2 top-[-5px] h-2.5 w-1.5 -translate-x-1/2 bg-[#c9a227]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                  className="block h-[72px] w-[72px] object-cover"
                />
                <span className="mt-0.5 block text-center text-[12px] font-bold leading-none text-[#6b6357]">
                  {p.date}
                </span>
              </span>
            ))
          ) : (
            <span className="hw-sway block bg-white p-1 pb-3 shadow-[var(--shadow-md)]" style={{ rotate: "-6deg" }}>
              <span aria-hidden className="absolute left-1/2 top-[-5px] h-2.5 w-1.5 -translate-x-1/2 bg-[#c9a227]" />
              <span className="grid h-[72px] w-[72px] place-items-center bg-rose/10 text-rose">
                <Icon name="camera" size={26} />
              </span>
              <span className="mt-0.5 block text-center text-[12px] font-bold leading-none text-[#6b6357]">
                사진 걸기
              </span>
            </span>
          )}
        </button>
      </div>

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
          {/* 겨울 — 근경 능선에 쌓인 눈(계절이 지면에도 걸리게) */}
          {look.snow && (
            <path
              d="M0 186 C54 168 104 178 160 184 C212 190 258 176 312 180 C352 183 378 190 400 184 L400 196 C378 202 352 194 312 191 C258 187 212 201 160 195 C104 189 54 179 0 197 Z"
              fill="#ffffff"
              opacity={look.night ? 0.22 : 0.62}
            />
          )}
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
            // 계절 나무색(scenetime.tree). 예전엔 언덕색을 섞어 만들어 사철 같은 실루엣이었다.
            <Tree key={i} x={tr.x} s={tr.s} kind={tr.k} fill={look.tree} />
          ))}
        </svg>
      </div>
      {/* 반딧불 — 밤/땅거미에 지면 근처에서 반짝 */}
      {look.starOpacity > 0.5 && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className="hw-firefly absolute"
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: 3,
                height: 3,
                background: "#ffe98a",
                boxShadow: "0 0 0 2px rgba(255,233,138,0.45)",
                animationDelay: `${f.d}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── 세계 속 오브젝트(= 내비게이션 + 상태 표시기) ──
          예전엔 넷 다 글자만 들고 있어서 하단 탭과 똑같은 곳으로 가는 '두 번째 문'일 뿐이었다.
          이제 각자 자기 영역의 상태를 배지로 들고 있어야 탭할 이유가 생긴다. 전부 홈이 이미
          로드/구독 중인 데이터에서 파생 — 새 쿼리·새 실시간 채널 0. [2026-08-04] */}
      <WorldProp
        label="쿡찌르기"
        badge={poke.unread > 0 ? { text: poke.unread > 9 ? "9+" : String(poke.unread), urgent: true } : null}
        x="3%"
        bottom="34%"
        onClick={onGoPoke}
        onDark={look.onDark}
      >
        {/* 새 쿡이 있으면 우편함 깃발이 선다 — 배지를 못 봐도 실루엣만으로 읽힌다 */}
        <span className={poke.unread > 0 ? "hw-mail-wiggle block" : "block"}>
          <PixelProp kind="mailbox" size={64} />
        </span>
      </WorldProp>

      <WorldProp
        label={nextDday ? nextDday.dday : "캘린더"}
        sub={nextDday?.label ?? null}
        badge={nextDday?.dday === "D-DAY" ? { text: "오늘", urgent: true } : null}
        x="auto"
        right="3%"
        bottom="35%"
        onClick={onGoCalendar}
        onDark={look.onDark}
      >
        <PixelProp kind="signpost" size={64} />
      </WorldProp>

      <WorldProp
        label="우리 섬"
        sub={pet?.todoTop ?? null}
        badge={
          pet && pet.todo > 0
            ? { text: pet.todo > 9 ? "9+" : String(pet.todo), urgent: pet.urgent > 0 }
            : null
        }
        x="2%"
        bottom="4%"
        onClick={onGoIsland}
        onDark={look.onDark}
        z={30}
      >
        <span className="hw-boat-bob block">
          <PixelProp kind="rowboat" size={64} />
        </span>
      </WorldProp>

      <WorldProp
        label="일기장"
        badge={diaryBadge}
        x="auto"
        right="2%"
        bottom="3%"
        onClick={onGoDiary}
        onDark={look.onDark}
        z={30}
      >
        <PixelProp kind="benchbook" size={64} />
      </WorldProp>

      {/* ── 펫 무대(지면 중앙) — 자고/걷고/말한다 ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-1.5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(180deg, transparent 0%, transparent 55%, rgba(0,0,0,0.16) 55%, rgba(0,0,0,0.16) 78%, rgba(0,0,0,0.32) 78%)" }}
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
        /* 경사 입자 — 좌우로 흔들리며 떨어지는 축포(계절 입자보다 빠르고 촘촘) */
        @keyframes hw-party-y { 0% { transform: translate(0,-6%) rotate(0); opacity: 0 } 8% { opacity: 1 } 92% { opacity: 1 } 100% { transform: translate(18px, 92%) rotate(420deg); opacity: 0 } }
        .hw-party { animation: hw-party-y linear infinite; }
        /* 바람 — 입자가 사선으로 길게 날린다(수직 낙하와 실루엣이 확실히 다르다) */
        @keyframes hw-blow-xy { 0% { transform: translate(0,-8%) rotate(0) } 100% { transform: translate(46vw, 78vh) rotate(300deg) } }
        .hw-blow { animation: hw-blow-xy linear infinite; }
        @keyframes hw-sway-r { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .hw-sway { animation: hw-sway-r 4.5s ease-in-out infinite; transform-origin: 50% -14px; }
        /* 배지 — 급한 것만 맥동한다(상시 맥동은 금방 배경음이 된다) */
        @keyframes hw-badge-p { 0%,100% { transform: scale(1) } 50% { transform: scale(1.14) } }
        .hw-badge-pulse { animation: hw-badge-p 1.6s ease-in-out infinite; }
        /* 새 쿡 — 우편함이 살짝 들썩(배지를 못 봐도 실루엣으로 읽힌다) */
        @keyframes hw-mail-w { 0%,86%,100% { transform: translateY(0) rotate(0) } 90% { transform: translateY(-3px) rotate(-4deg) } 94% { transform: translateY(-2px) rotate(4deg) } }
        .hw-mail-wiggle { animation: hw-mail-w 3.2s ease-in-out infinite; }
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
        /* 별똥별 — 높이 2px(정수), 꼬리는 보간 대신 3단 하드 스톱 */
        .hw-shoot { top: 12%; right: 14%; width: 72px; height: 2px;
          background: linear-gradient(90deg, transparent 0%, transparent 34%, rgba(255,255,255,0.45) 34%, rgba(255,255,255,0.45) 68%, #fff 68%); animation: hw-shoot-a 14s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hw-drift, .hw-twinkle, .hw-fall, .hw-rain, .hw-sway, .hw-boat-bob,
          .hw-sun-pulse, .hw-bird, .hw-firefly, .hw-shoot,
          .hw-badge-pulse, .hw-mail-wiggle, .hw-blow, .hw-party { animation: none; }
          /* 애니만 끄면 낙하 입자·비·새가 시작 위치에 **정지 잔상**으로 남는다 → 아예 숨긴다 */
          .hw-shoot, .hw-fall, .hw-rain, .hw-bird, .hw-blow, .hw-party { opacity: 0; }
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

/** 달 — 실제 위상(초승↔보름)을 종결선 호로 그린다(moonLitPath) + 크레이터. */
function Moon({ phase, look }: { phase: number; look: SkyLook }) {
  // ⚠ id 는 useId — 같은 아트가 두 번 렌더될 때 clipPath 중복 참조로 한쪽이 깨진다(README §14.5)
  const uid = useId().replace(/:/g, "");
  const R = 22;
  const lit = moonLitPath(23, 23, R, phase);
  return (
    <div className="relative" style={{ width: 46, height: 46 }}>
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 32, height: 32, boxShadow: haloRings(look.glow, [6, 12, 18]) }}
      />
      <svg viewBox="0 0 46 46" width={46} height={46} className="relative">
        <defs>
          <clipPath id={`hw-moon-${uid}`}>
            <path d={lit} />
          </clipPath>
        </defs>
        {/* 그림자 쪽 — 완전히 지우지 않고 아주 옅게 남겨 '거기 달이 있다'를 유지 */}
        <circle cx={23} cy={23} r={R} fill={look.light} opacity={0.1} />
        {/* 밝은 쪽 — 크레이터까지 이 안에서만 보인다 */}
        <g clipPath={`url(#hw-moon-${uid})`}>
          <circle cx={23} cy={23} r={R} fill={look.light} />
          <circle cx={17} cy={17} r={4.4} fill="#000" opacity={0.07} />
          <circle cx={29} cy={26} r={5.6} fill="#000" opacity={0.06} />
          <circle cx={20} cy={31} r={3} fill="#000" opacity={0.05} />
          <circle cx={32} cy={14} r={2.4} fill="#000" opacity={0.05} />
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
/** 소품 배지 — 이 오브젝트가 지금 **무엇을 알고 있는지**.
 *  urgent = 지금 안 하면 손해(빨강·맥동) / info = 알아두면 좋은 것(크림) */
export type PropBadge = { text: string; urgent?: boolean } | null;

function WorldProp({
  label,
  sub,
  badge,
  x,
  right,
  bottom,
  z = 10,
  onDark,
  onClick,
  children,
}: {
  label: string;
  /** 라벨 아래 작은 두 번째 줄(예: 기념일 이름) — 없으면 렌더 안 함. */
  sub?: string | null;
  badge?: PropBadge;
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
      // 배지는 시각 정보라 낭독 라벨에도 넣는다 — 안 그러면 스크린리더는 '할 일 3'을 영영 모른다
      aria-label={badge ? `${label} — ${badge.text}` : label}
      className="tap absolute flex flex-col items-center"
      style={{ left: x === "auto" ? undefined : x, right, bottom, zIndex: z }}
    >
      <span className="relative block">
        {children}
        {badge && (
          <span
            aria-hidden
            className={`absolute -right-1.5 -top-1 min-w-[18px] px-1 py-px text-center text-[12px] font-black leading-[14px] ${
              badge.urgent
                ? "hw-badge-pulse bg-[#ff3b6b] text-white"
                : "bg-[#fff3c4] text-[#3c2e1f]"
            }`}
            style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.35)" }}
          >
            {badge.text}
          </span>
        )}
      </span>
      <span
        className={`-mt-1 max-w-[104px] truncate rounded-full px-2 py-0.5 text-xs font-bold ${
          onDark ? "bg-black/35 text-white" : "bg-white/80 text-ink"
        }`}
      >
        {label}
      </span>
      {sub && (
        <span
          className={`mt-0.5 max-w-[104px] truncate rounded-full px-1.5 text-[12px] font-bold ${
            onDark ? "bg-black/30 text-white/85" : "bg-white/70 text-ink/75"
          }`}
        >
          {sub}
        </span>
      )}
    </button>
  );
}
