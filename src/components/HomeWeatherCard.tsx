"use client";

/* 홈 날씨 카드 — 로그 카드(TodayLogCard)가 잠시 비운 자리에 앉는다.
 * [사용자 요청 2026-08-11 "메인화면 로그쪽에 오늘 날씨를 표시해주는게 좋을 것 같아"]
 *
 * 한 줄 요약만 한다: 지금 + 오늘 오전/오후. 상세(주간)는 탭 전체 화면(WeatherView)의
 * 일이다 — 홈 카드가 커지면 히어로 아래 세로 예산(README §10.5)을 먹는다.
 * 카드 전체가 버튼이고, 누르면 날씨 탭으로 간다.
 * 커플 연동과 무관하게 뜬다 — 공개 API 라 coupleId 가 필요 없다. */

import PixelSprite from "@/components/island/PixelSprite";
import WorldSectionHead from "@/components/WorldSectionHead";
import { halfDayOf, kstDateStr, wmoInfo } from "@/lib/weather";
import { weatherSprite } from "@/lib/pixelweather";
import { useForecast } from "@/lib/useforecast";

export default function HomeWeatherCard({ onOpen }: { onOpen: () => void }) {
  const { cached } = useForecast();
  const fc = cached?.fc ?? null;
  if (!fc) return null; // 홈에서는 로딩·실패를 떠들지 않는다 — 데이터가 오면 조용히 나타난다

  const todayStr = kstDateStr(cached!.fetchedAt);
  const cur = wmoInfo(fc.current.weather_code);
  const am = halfDayOf(fc.hourly, todayStr, "am");
  const pm = halfDayOf(fc.hourly, todayStr, "pm");

  return (
    <div className="mt-8">
      {/* 헤더 소품 = 지금 하늘 그대로 — 비 오면 홈 헤더에도 비구름이 뜬다 */}
      <WorldSectionHead
        prop={<PixelSprite sprite={weatherSprite(cur.icon)} size={36} title={cur.label} />}
        title="오늘의 하늘"
        sub={`${cur.label} · 지금 ${Math.round(fc.current.temperature_2m)}°`}
      />
      <button
        onClick={onOpen}
        className="tap glass block w-full rounded-[var(--radius-card)] bg-card p-4 text-left shadow-[var(--shadow-md)] ring-1 ring-line"
        aria-label="날씨 자세히 보기"
      >
        <div className="flex items-center gap-3">
          {(
            [
              ["오전", am],
              ["오후", pm],
            ] as const
          ).map(([name, h]) => (
            <div key={name} className="flex min-w-0 flex-1 items-center gap-2.5">
              <PixelSprite sprite={weatherSprite((h ?? cur).icon)} size={48} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted">{name}</p>
                {h ? (
                  <>
                    <p className="text-base font-extrabold text-ink">
                      {h.tMin}°<span className="text-muted">~</span>
                      {h.tMax}°
                    </p>
                    {/* 강수 60% 부터 강조 — 우산 없이 나가는 걸 막는 게 이 카드의 일 */}
                    <p
                      className={`text-xs ${h.pop >= 60 ? "font-extrabold text-rose-deep" : "font-semibold text-muted"}`}
                    >
                      강수 {h.pop}%
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted">지나갔어요</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </button>
    </div>
  );
}
