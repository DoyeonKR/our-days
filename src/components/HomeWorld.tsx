"use client";

/* 홈 월드 — 홈이 카드 피드가 아니라 **한 폭의 살아있는 세계**가 된다(풀체인지).
   · 하늘: 실제 KST 시각(새벽/낮/노을/밤) × 계절 × 섬 날씨(비/무지개) 반영
   · D-day 가 하늘에 떠 있고, 커버 사진은 폴라로이드로 끈에 매달림(→사진첩)
   · 지면 중앙엔 펫 무대(children = HomePet hero) — 자고/걷고/말한다
   · 모션은 전부 CSS(로컬 <style>), reduced-motion 존중. active=false 면 시계 정지 */

import { type ReactNode, useEffect, useState } from "react";
import { seasonOf } from "@/lib/island";
import {
  kstHourFloatOf,
  lightPos,
  mixHex,
  moonPhase,
  type SkyLook,
  skyLook,
  skyPhaseOf,
} from "@/lib/scenetime";
import { useGlobalPet } from "@/lib/petglobal";
import { bands, haloRings, sampleCubics, stepPath, stepPolyline, type Cubic } from "@/lib/pixelscene";
import PixelSprite from "@/components/island/PixelSprite";
import { birdSprite, cloudSprite, discPath, moonLitPath as moonLitDots } from "@/lib/pixelsky";
import { ALL_FX_SPRITES, FALLER_SPRITE, PIXEL_HEART } from "@/lib/pixelfx";
import { occasionOf } from "@/lib/occasion";
import { heroWxOf } from "@/lib/sceneweather";
import { wmoInfo } from "@/lib/weather";
import { useForecast } from "@/lib/useforecast";
import { useWeatherPlace } from "@/lib/weatherplace";
import Icon from "@/components/Icon";
import { asset } from "@/lib/base";

const SEASON_WORLD: Record<ReturnType<typeof seasonOf>, string> = {
  spring: "/assets/homeworld/spring.webp",
  summer: "/assets/homeworld/summer.webp",
  autumn: "/assets/homeworld/autumn.webp",
  winter: "/assets/homeworld/winter.webp",
};

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
  active,
  onGoAlbum,
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
  /** 다음 기념일 — 하늘의 '오늘의 경사' 판정에 쓴다(표지판은 제거됨). */
  nextDday: { label: string; dday: string } | null;
  active: boolean; // 홈 탭이 보일 때만 시계/애니 갱신
  onGoAlbum: () => void;
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

  const pet = useGlobalPet(); // 수면/할 일(섬과 동기)
  const hour = kstHourFloatOf(now); // 분 단위 — 광원 궤도가 매끄럽게
  const phase = skyPhaseOf(hour);
  const season = seasonOf(now);
  const look = skyLook(phase, season);
  /* 하늘 날씨 = **실제 하늘**(Open-Meteo) 우선, 없으면 섬 게임 날씨 폴백 [2026-08-11].
     매핑 규약과 이유는 lib/sceneweather.ts — 하늘 그라데이션은 안 건드리고 전부 얹는다. */
  const { cached: fcCache } = useForecast(useWeatherPlace()); // 고른 도시의 하늘
  const realKind = fcCache ? wmoInfo(fcCache.fc.current.weather_code).icon : null;
  const wx = heroWxOf(realKind, pet?.weather ?? "clear", look.snow);
  const t = new Date(now);
  const sun = lightPos(hour); // 해/달 궤도 위치(0~1 비율)
  const mphase = moonPhase(now); // 실제 달 위상

  /* 끈에 걸 사진 — 최대 4장. 목록이 없으면 대표사진 한 장으로 폴백(기존 동작 유지).
     ⚠ 4장이 360px 화면에 들어가려면 장당 62px 이 상한이다:
        4×(62+8 패딩) + 3×6 간격 = 298 ≤ 328(좌우 px-4 제외한 가용폭). */
  const hung: { id: string; url: string; date: string }[] =
    photos && photos.length > 0
      ? photos.slice(0, 4)
      : coverUrl
        ? [{ id: "cover", url: coverUrl, date: "" }]
        : [];

  const windy = wx.windMul > 1;
  /* 오늘의 경사 — 100일 단위·기념일 당일·크리스마스·새해. 데이터 비용 0(이미 있는 props 파생). */
  const occ = occasionOf(nDays, nextDday?.dday === "D-DAY", now);

  const skyText = "text-white";
  const skySub = "text-white/80";
  // 고해상도 계절 원화는 지형 디테일을 맡고, 시간대는 기존 8단계 조명으로 입힌다.
  // 원화를 시간대마다 32장 굽지 않아도 날씨·광원 전환이 즉시 유지된다.
  const worldLight: Record<typeof phase, string> = {
    night: "brightness(.46) saturate(.9)",
    blueHour: "brightness(.62) saturate(.95)",
    sunrise: "brightness(.9) saturate(1.08) sepia(.08)",
    morning: "brightness(1.18) saturate(.92)",
    day: "brightness(1.3) saturate(.9)",
    golden: "brightness(1.06) saturate(1.12) sepia(.12)",
    sunset: "brightness(.82) saturate(1.24) sepia(.1)",
    twilight: "brightness(.58) saturate(1.05)",
  };

  return (
    <section
      className="relative -mx-5 mb-5 overflow-hidden rounded-b-[32px] shadow-[var(--shadow-lg)]"
      style={{ height: "min(58vh, 600px)", minHeight: 470 }}
      aria-label="우리의 세계"
    >
      {/* 계절 원화는 하늘부터 발밑까지 한 장면이다. bottom 52% 안에 넣으면 정확히 반으로
          끊기므로 히어로 루트 전체에 배치한다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden
        src={asset(SEASON_WORLD[season])}
        alt=""
        width={1200}
        height={1800}
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[center_46%]"
        style={{ filter: worldLight[phase], transition: "filter 1.2s" }}
      />
      {/* ── 하늘 — 5-스톱 대기층 + 지평선 헤이즈(광원 쪽이 더 밝다) ── */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          // 픽셀 하늘은 보간이 아니라 **색 띠**다. 계단이 스타일 자체라 밴딩을 숨기지 않는다.
          background: bands([look.top, look.upper, look.mid, look.lower, look.bottom]),
          opacity: look.night ? 0.32 : 0.22,
          mixBlendMode: "color",
          transition: "background 1.2s",
        }}
      />
      {/* 지평선 산란 — 광원 방향에서 번지는 빛(대기감) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[38%] top-0"
        style={{
          // 고해상도 원화 위에서는 62% 하드 컷이 흰 띠로 보였다. 산란은 연속 투명도로만
          // 얹어 원화의 하늘→산맥 경계를 가리지 않는다.
          background: `linear-gradient(180deg, transparent 30%, ${look.haze} 100%)`,
          opacity: 0.16,
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
          /* 달도 흐림 감쇠를 받는다 — 뇌우 밤에 달만 쨍하면 하늘이 둘로 갈린다 */
          <span className="block" style={{ opacity: wx.overcast === 2 ? 0.35 : 1, transition: "opacity 1.2s" }}>
            <Moon phase={mphase} look={look} />
          </span>
        ) : (
          <>
            {/* 후광 — 낮은 고도(일출/노을)일수록 크고 붉게 */}
            {/* 후광 = 블러가 아니라 **동심 하드 링**(box-shadow spread 만 사용, blur 0) */}
            {/* 해 — border-radius 원은 가장자리가 매끈해 도트가 아니다. **계단 원반**으로 그린다. */}
            {/* 흐림(overcast 2)엔 해가 흐려진다 — 하늘색(skyLook)은 대비 lock 이 걸린 축이라
                안 건드리고, 해·후광의 불투명도만 낮춘다. 구름 뒤에서 희미하게 비치는 해다. */}
            <span
              className="hw-sun-pulse block"
              style={{
                width: 24,
                height: 24,
                boxShadow: haloRings(look.glow, [6, 12, 20]),
                opacity: wx.overcast === 2 ? 0.35 : 1,
                transition: "opacity 1.2s",
              }}
            >
              <svg viewBox="0 0 24 24" width={24} height={24} shapeRendering="crispEdges">
                <path d={discPath(12, 12, 11, 2)} fill={look.light} />
              </svg>
            </span>
          </>
        )}
      </div>
      {/* ── 구름 — 윗면(광원색)/아랫면(그늘) 2톤, 3층 시차 ── */}
      <div aria-hidden className="hw-drift absolute left-[4%] top-[14%]" style={{ animationDuration: windy ? "11s" : "26s" }}>
        <span className="block" style={{ opacity: look.night ? 0.5 : 0.95 }}>
          <PixelSprite sprite={cloudSprite("l", look.cloudLit, look.cloudShade)} size={3} />
        </span>
      </div>
      <div aria-hidden className="hw-drift absolute left-[54%] top-[7%]" style={{ animationDelay: "-9s", animationDuration: windy ? "14s" : "34s" }}>
        <span className="block" style={{ opacity: look.night ? 0.4 : 0.8 }}>
          <PixelSprite sprite={cloudSprite("m", look.cloudLit, look.cloudShade)} size={3} />
        </span>
      </div>
      <div aria-hidden className="hw-drift absolute left-[28%] top-[24%]" style={{ animationDelay: "-17s", animationDuration: "44s" }}>
        <span className="block" style={{ opacity: look.night ? 0.3 : 0.55 }}>
          <PixelSprite sprite={cloudSprite("s", look.cloudLit, look.cloudShade)} size={3} />
        </span>
      </div>
      {/* 실제 하늘이 흐리면 구름이 **더 많아진다** — 하늘색은 그대로, 구름 밀도로 말한다.
          overcast 1(구름 많음)에 한 층, 2(흐림)에 두 층 더. 그늘색 구름이라 무거워 보인다. */}
      {wx.overcast >= 1 && (
        <div aria-hidden className="hw-drift absolute left-[70%] top-[18%]" style={{ animationDelay: "-5s", animationDuration: windy ? "12s" : "30s" }}>
          <span className="block" style={{ opacity: look.night ? 0.45 : 0.9 }}>
            <PixelSprite sprite={cloudSprite("m", look.cloudShade, look.cloudShade)} size={3} />
          </span>
        </div>
      )}
      {wx.overcast >= 2 && (
        <>
          <div aria-hidden className="hw-drift absolute left-[12%] top-[5%]" style={{ animationDelay: "-21s", animationDuration: windy ? "13s" : "38s" }}>
            <span className="block" style={{ opacity: look.night ? 0.5 : 0.95 }}>
              <PixelSprite sprite={cloudSprite("l", look.cloudShade, look.cloudShade)} size={3} />
            </span>
          </div>
          <div aria-hidden className="hw-drift absolute left-[44%] top-[12%]" style={{ animationDelay: "-2s", animationDuration: windy ? "15s" : "42s" }}>
            <span className="block" style={{ opacity: look.night ? 0.45 : 0.9 }}>
              <PixelSprite sprite={cloudSprite("l", look.cloudShade, look.cloudShade)} size={3} />
            </span>
          </div>
        </>
      )}
      {/* 새 — 낮 시간대의 생기 */}
      {(phase === "morning" || phase === "day" || phase === "golden") && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {BIRDS.map((b, i) => (
            <span
              key={i}
              className="hw-bird absolute"
              style={{ top: `${b.y}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.d}s`, transform: `scale(${b.s})` }}
            >
              {/* 곡선 stroke 는 아무리 얇아도 도트가 아니다. V 자를 점으로 찍고 두 프레임으로 퍼덕인다. */}
              <span className="hw-flap block">
                <PixelSprite sprite={birdSprite(i % 2, look.cloudShade)} size={2} />
              </span>
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
      {/* 강수 — 실제 하늘을 따른다(폴백은 섬 날씨). 눈은 계절 무관 — 3월에 눈 오면 눈이 온다.
          이슬비는 방울 수 절반 + 느리게. 같은 슬롯 재사용이라 밀도 규약은 유지된다. */}
      {(wx.precip !== "none" || wx.snow) && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: wx.snow ? 16 : wx.precip === "drizzle" ? 8 : 16 }).map((_, i) => (
            <span
              key={i}
              className={wx.snow ? "hw-rain absolute top-0 h-1 w-1 bg-white/85" : "hw-rain absolute top-0 h-4 w-0.5 bg-white/50"}
              style={{
                left: `${(i * 137.5) % 100}%`,
                animationDuration: `${(wx.snow ? 3.2 : wx.precip === "drizzle" ? 1.3 : 0.75) + ((i * 7) % 5) / 10}s`,
                animationDelay: `${(i % 13) * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* 번개 — 뇌우일 때만, 은은한 이중 깜빡임. ⚠ 화면 전체를 하얗게 때리지 않는다
          (최대 불투명도 0.28 · 8초에 한 번) — 광과민 안전과 도트 톤 유지를 같이 잡는 선.
          reduced-motion 에선 통째로 숨긴다(멈춘 플래시는 뿌연 막일 뿐이다). */}
      {wx.thunder && (
        <div
          aria-hidden
          className="hw-thunder pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, #eaf1ff 0%, #cdd9f2 55%, transparent 100%)" }}
        />
      )}
      {/* 안개 — 가로 띠 두 장이 천천히 흐른다(하드 엣지 — 픽셀 문법). 낮은 하늘을 지운다. */}
      {wx.fog && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="hw-fogband absolute left-[-30%] top-[30%] h-4 w-[160%] bg-white/30" />
          <span
            className="hw-fogband absolute left-[-30%] top-[40%] h-3 w-[160%] bg-white/20"
            style={{ animationDelay: "-14s", animationDuration: "52s" }}
          />
        </div>
      )}
      {/* 무지개는 **해가 떠 있을 때만** — 예전엔 한밤중에도 떴다.
          섬 게임 날씨의 선물이라 실제 하늘이 맑을 때만 얹는다(sceneweather 규약). */}
      {wx.rainbow && !look.moon && look.starOpacity < 0.5 && (
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
        <span className={`text-sm font-extrabold tracking-tight ${look.headerDark ? "text-white" : "text-gradient"}`}>하루</span>
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
      {/* ⚠ 세로 예산이 빡빡하다: 위로는 헤더(~y40), 아래로는 D-day 숫자(y104~). 4장이 되면서
          줄이 화면 전폭을 덮으므로 **날짜 캡션을 빼서** 높이를 줄였다 — 사진 자체가 콘텐츠라
          크기(62px)를 지키는 쪽을 택했다. 날짜는 탭해서 들어간 사진첩에 있다. */}
      <div className="absolute inset-x-0 top-[7%] z-10 px-[4%]">
        {/* 빨랫줄 — 사진 뒤로 지나가는 실 한 가닥 */}
        <span
          aria-hidden
          className="absolute inset-x-[4%] top-[6px] block h-px"
          style={{ background: look.onDark ? "rgba(255,255,255,0.45)" : "rgba(60,46,31,0.35)" }}
        />
        <button
          onClick={onGoAlbum}
          aria-label={hung.length ? `사진첩 열기, 최근 사진 ${hung.length}장` : "사진첩 열기"}
          className="tap relative flex items-start gap-1.5"
        >
          {hung.length > 0 ? (
            hung.map((p, i) => (
              <span
                key={p.id}
                className="hw-sway block bg-white p-1 pb-2 shadow-[var(--shadow-md)]"
                // 장마다 각도·지연을 달리해 '같은 걸 복사한' 티를 없앤다(랜덤 아님 — 인덱스 파생)
                style={{
                  rotate: `${[-6, 4, -3, 5][i] ?? 0}deg`,
                  marginTop: [0, 5, 2, 6][i] ?? 0,
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
                  className="block h-[62px] w-[62px] object-cover"
                />
              </span>
            ))
          ) : (
            <span className="hw-sway block bg-white p-1 pb-2 shadow-[var(--shadow-md)]" style={{ rotate: "-6deg" }}>
              <span aria-hidden className="absolute left-1/2 top-[-5px] h-2.5 w-1.5 -translate-x-1/2 bg-[#c9a227]" />
              <span className="grid h-[62px] w-[62px] place-items-center bg-rose/10 text-rose">
                <Icon name="camera" size={26} />
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ── 풍경 — 원경 산 → 먼 언덕 → 중경(나무숲) → 근경. 대기 원근으로 겹겹이 ── */}
      <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: "52%" }}>
        <svg
          viewBox="0 0 400 210"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-10"
          /* ⚠ 계단 경로를 부드럽게 깎으면(안티에일리어싱) 격자로 만든 의미가 없다.
             crispEdges 가 경계를 픽셀에 딱 맞춰 자른다. */
          shapeRendering="crispEdges"
        >
          {/* 원경 산줄기 — 봉우리 높이·간격을 불규칙하게(균일 삼각형은 조악해 보임) */}
          <path d={D_MOUNT} fill={mixHex(look.hillFar, look.haze, 0.68)} style={{ transition: "fill 1.2s" }} />
          {/* 설선/능선 하이라이트 — 큰 봉우리 두 개에만(디테일) */}
          <path
            d="M74 62 L84 73 L78 74 L70 79 Z M212 55 L224 69 L216 70 L206 74 Z"
            fill={mixHex(look.light, look.haze, 0.35)}
            opacity={look.night ? 0.12 : 0.32}
          />
          {/* 산자락 안개 — 원경과 중경 사이 대기층 */}
          <rect
            x="0"
            y="90"
            width="400"
            height="42"
            fill={look.haze}
            opacity={0.45}
            style={{ transition: "fill 1.2s" }}
          />
          {/* 먼 언덕 */}
          <path d={D_FAR} fill={look.hillFar} style={{ transition: "fill 1.2s" }} />
          {/* 중경 언덕 */}
          <path d={D_MID} fill={look.hillMid} style={{ transition: "fill 1.2s" }} />
          {/* 근경 — 부드러운 능선 */}
          <path d={D_NEAR} fill={look.hillNear} style={{ transition: "fill 1.2s" }} />
          {/* 겨울 — 근경 능선에 쌓인 눈(계절이 지면에도 걸리게) */}
          {look.snow && (
            <path d={D_NEAR_BAND} fill="#ffffff" opacity={look.night ? 0.22 : 0.62} />
          )}
          {/* 근경 하이라이트 — 광원 방향에서 능선에 닿는 빛 */}
          <path d={D_NEAR_BAND} fill={look.light} opacity={look.night ? 0.06 : look.onDark ? 0.28 : 0.18} />
        </svg>
        {/* 중경 나무숲 실루엣 — 언덕에 얹혀 깊이를 만든다(비율 유지 SVG) */}
        <svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 opacity-10" style={{ bottom: "22%", height: "18%" }}>
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

      {/* 세계 속 내비게이션 소품(우편함·표지판·나룻배·벤치)은 제거했다 [2026-08-04].
          하단 탭에 캘린더·일기장·게임이 이미 있어 **같은 곳으로 가는 두 번째 문**이었고,
          상태 배지를 달아도 사용자에겐 여전히 군더더기였다. 히어로는 하늘·풍경·사진·펫만.
          되살릴 땐 히트테스트(스테이지 pointer-events)와 말풍선 폭 계산을 함께 되돌려야 한다. */}
      {/* ── 펫 무대(지면 중앙) — 자고/걷고/말한다 ── */}
      {/* ⚠ pointer-events-none 필수. 이 박스는 화면 전폭 × 컬럼 높이(약 240px)라 투명해도
          히트테스트를 먹어 **뒤의 우편함·표지판을 못 누르게 만든다**(z-20 vs 소품 z-10).
          누를 수 있어야 하는 자식(펫 버튼·이름 행)만 pointer-events-auto 로 되돌린다. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-1.5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(180deg, transparent 0%, transparent 55%, rgba(0,0,0,0.16) 55%, rgba(0,0,0,0.16) 78%, rgba(0,0,0,0.32) 78%)" }}
        />
        <div className="relative">{children}</div>
      </div>

      {/* 씬 전용 모션 — 전역 오염 없이 여기서만 */}
      <style>{`
        @keyframes hw-flap-y { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        .hw-flap { animation: hw-flap-y .5s steps(2, end) infinite; }
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
        /* 번개 — 이중 깜빡임 후 긴 침묵. ⚠ 최대 불투명도 0.28(광과민 안전선) —
           sceneweather.test 가 이 상한을 잠근다. rotate 없음(도트 규약). */
        @keyframes hw-flash-a {
          0%, 88% { opacity: 0 }
          89% { opacity: 0.28 }
          90.5% { opacity: 0.05 }
          92% { opacity: 0.22 }
          94%, 100% { opacity: 0 }
        }
        .hw-thunder { opacity: 0; animation: hw-flash-a 8s linear infinite; }
        @keyframes hw-fog-x { 0% { transform: translateX(0) } 100% { transform: translateX(12%) } }
        .hw-fogband { animation: hw-fog-x 38s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .hw-drift, .hw-twinkle, .hw-fall, .hw-rain, .hw-sway,
          .hw-sun-pulse, .hw-bird, .hw-firefly, .hw-shoot,
          .hw-badge-pulse, .hw-mail-wiggle, .hw-blow, .hw-party, .hw-fogband { animation: none; }
          /* 애니만 끄면 낙하 입자·비·새가 시작 위치에 **정지 잔상**으로 남는다 → 아예 숨긴다.
             번개도 같다 — 멈춘 플래시는 뿌연 막일 뿐이다. 안개 띠는 서 있어도 안개라 남긴다. */
          .hw-shoot, .hw-fall, .hw-rain, .hw-bird, .hw-blow, .hw-party { opacity: 0; }
          .hw-thunder { animation: none; opacity: 0; }
        }
      `}</style>
    </section>
  );
}

/** 중경 나무 실루엣 슬롯(고정) — k: 침엽수/활엽수. */
/* ── 풍경 실루엣 → 계단 경로 ────────────────────────────────────────────
 * [사용자 요청 2026-08-07 "홈화면 배경 픽셀들 개선"]
 *
 * 예전엔 이 좌표들이 SVG 베지어 곡선 그대로였다. 그 위에 1px 격자로 딱 끊긴 펫이
 * 서 있으니 펫이 벡터 그림에 붙인 스티커처럼 보였다 — **문법이 둘로 갈려 있었다.**
 * 픽셀 아트에 곡선은 없다. 실루엣은 그대로 두고 격자에만 맞춘다.
 *
 * ⚠ 모듈 최상단에서 한 번만 계산한다. 좌표가 고정이라 매 렌더 다시 만들 이유가 없다.
 * ⚠ 격자 단위는 **멀수록 크게**(원경 6 → 근경 3). 대기 원근이 계단 굵기로도 표현된다.
 */
const SCENE_W = 400;
const SCENE_H = 210;

const MOUNT_PTS: [number, number][] = [
  [0, 104], [26, 88], [44, 95], [74, 62], [96, 79], [112, 71], [140, 92], [164, 80],
  [186, 97], [212, 55], [238, 86], [262, 76], [286, 99], [316, 83], [340, 93],
  [364, 74], [382, 90], [400, 82],
];
const HILL_FAR: Cubic[] = [
  [46, 100, 92, 104, 136, 124], [176, 142, 214, 118, 254, 112], [298, 106, 340, 124, 400, 108],
];
const HILL_MID: Cubic[] = [
  [58, 132, 108, 146, 158, 156], [206, 166, 250, 142, 300, 148], [342, 153, 372, 166, 400, 156],
];
const HILL_NEAR: Cubic[] = [
  [54, 168, 104, 178, 160, 184], [212, 190, 258, 176, 312, 180], [352, 183, 378, 190, 400, 184],
];

const D_MOUNT = stepPolyline(MOUNT_PTS, 6, SCENE_W, SCENE_H);
const D_FAR = stepPath(sampleCubics(128, HILL_FAR), 5, SCENE_W, SCENE_H);
const D_MID = stepPath(sampleCubics(158, HILL_MID), 4, SCENE_W, SCENE_H);
const D_NEAR = stepPath(sampleCubics(186, HILL_NEAR), 3, SCENE_W, SCENE_H);
/** 근경 능선 위에 얹는 띠(눈·빛) — 같은 계단을 아래로 6 내려 만든다. */
const D_NEAR_BAND = stepPath(
  sampleCubics(186, HILL_NEAR).map(([x, y]) => [x, y] as [number, number]),
  3,
  SCENE_W,
  198,
);

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
  /* 예전엔 clipPath + 반투명 크레이터였다. 계단 조각으로 그리면 clipPath 자체가 필요 없어
     useId 도 안 쓴다 — 중복 id 로 한쪽이 깨지던 걱정이 통째로 사라졌다. */
  return (
    <div className="relative" style={{ width: 46, height: 46 }}>
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 32, height: 32, boxShadow: haloRings(look.glow, [6, 12, 18]) }}
      />
      {/* 달 — 원과 반투명 크레이터는 픽셀 문법이 아니다. 원반도 종결선도 **계단**으로 만든다. */}
      <svg viewBox="0 0 46 46" width={46} height={46} className="relative" shapeRendering="crispEdges">
        {/* 그늘 쪽 — 완전히 지우지 않고 옅게 남겨 "거기 달이 있다"를 유지 */}
        <path d={discPath(23, 23, 15, 2)} fill={look.light} opacity={0.1} />
        {/* 밝은 쪽 — 위상에 따라 잘린 계단 조각들 */}
        <path d={moonLitDots(23, 23, 15, phase, 2)} fill={look.light} />
      </svg>
    </div>
  );
}
