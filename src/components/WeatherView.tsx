"use client";

/* 날씨 탭 — 서울 실시간 + 오늘 오전/오후 + 주간 예보.
 * [사용자 요청 2026-08-11 "로그/일기장 잠시 숨기고 그 자리에 날씨.
 *  실시간 한국 기준, 오늘 오전 오후 / 1주일 예보"]
 *
 * 데이터 규약은 lib/weather.ts 에 있다(왜 Open-Meteo 인지 포함).
 * 여기는 가져오고 그리는 일만 한다 — 집계(오전/오후·대표 날씨)는 전부 순수 함수라
 * weather.test.ts 가 잠근다.
 *
 * 갱신: 마운트 때 + 30분마다 + 수동 새로고침. 실패하면 **아까 본 것**을 그대로 두고
 * 관측 시각만 남긴다 — PWA 오프라인에서 빈 화면보다 어제 하늘이 낫다.
 */

import Icon from "@/components/Icon";
import PixelSprite from "@/components/island/PixelSprite";
import { PLACE, dayLabelOf, halfDayOf, kstDateStr, wmoInfo } from "@/lib/weather";
import { weatherSprite } from "@/lib/pixelweather";
import { useForecast } from "@/lib/useforecast";

export default function WeatherView() {
  const { cached, busy, failed, reload } = useForecast();
  

  const fc = cached?.fc ?? null;
  const todayStr = cached ? kstDateStr(cached.fetchedAt) : "";
  const cur = fc ? wmoInfo(fc.current.weather_code) : null;
  const am = fc ? halfDayOf(fc.hourly, todayStr, "am") : null;
  const pm = fc ? halfDayOf(fc.hourly, todayStr, "pm") : null;

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <p className="eyebrow">하늘 정찰</p>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">오늘의 하늘</h1>

      {!fc && (
        <div className="glass rounded-[var(--radius-card)] bg-card px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
          <p className="text-sm font-bold text-ink">
            {failed ? "날씨를 불러오지 못했어요" : "하늘을 살피는 중…"}
          </p>
          {failed && (
            <button
              onClick={() => reload(true)}
              className="tap mt-3 rounded-full bg-glass px-4 py-1.5 text-sm font-semibold text-rose-deep ring-1 ring-line"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {fc && cur && (
        <>
          {/* 지금 */}
          <div className="glass rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-md)] ring-1 ring-line">
            <div className="flex items-center gap-4">
              <PixelSprite sprite={weatherSprite(cur.icon)} size={72} title={cur.label} />
              <div className="min-w-0">
                <p className="text-4xl font-extrabold leading-none tracking-tight text-ink">
                  {Math.round(fc.current.temperature_2m)}°
                </p>
                <p className="mt-1.5 truncate text-sm font-semibold text-muted">
                  {cur.label} · {PLACE.name}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              습도 {Math.round(fc.current.relative_humidity_2m)}% · 바람{" "}
              {Math.round(fc.current.wind_speed_10m)}km/h
            </p>
          </div>

          {/* 오늘 오전 / 오후 */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["오전", am],
                ["오후", pm],
              ] as const
            ).map(([name, h]) => (
              <div
                key={name}
                className="glass rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line"
              >
                <p className="text-xs font-bold text-muted">{name}</p>
                {h ? (
                  <>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <PixelSprite sprite={weatherSprite(h.icon)} size={48} title={h.label} />
                      <p className="text-lg font-extrabold text-ink">
                        {h.tMin}°<span className="text-muted">~</span>
                        {h.tMax}°
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {h.label} · 강수 {h.pop}%
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted">지나갔어요</p>
                )}
              </div>
            ))}
          </div>

          {/* 주간 */}
          <div className="glass mt-3 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
            <p className="mb-2 text-xs font-bold text-muted">앞으로 일주일</p>
            <div className="space-y-1">
              {fc.daily.time.map((d, i) => {
                const info = wmoInfo(fc.daily.weather_code[i]);
                const pop = Math.round(fc.daily.precipitation_probability_max[i] ?? 0);
                const today = d === todayStr;
                return (
                  <div key={d} className="flex items-center gap-3 py-0.5">
                    <span
                      className={`w-9 shrink-0 text-sm ${today ? "font-extrabold text-ink" : "font-semibold text-muted"}`}
                    >
                      {dayLabelOf(d, todayStr)}
                    </span>
                    <PixelSprite sprite={weatherSprite(info.icon)} size={24} title={info.label} />
                    {/* 강수확률 — 우산 판단이 이 화면의 존재 이유라 낮아도 숨기지 않는다.
                        60% 부터 강조색 — 그날은 우산이 선택이 아니다.
                        ⚠ 색은 테마 토큰만(text-sky-* 리터럴은 라이트 카드에서 안 보인다) */}
                    <span
                      className={`w-11 shrink-0 text-xs ${pop >= 60 ? "font-extrabold text-rose-deep" : "font-semibold text-muted"}`}
                    >
                      {pop}%
                    </span>
                    <span className="ml-auto text-sm font-semibold text-ink">
                      <span className="text-muted">{Math.round(fc.daily.temperature_2m_min[i])}°</span>
                      {" / "}
                      {Math.round(fc.daily.temperature_2m_max[i])}°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 출처·갱신 — 데이터 화면의 예의 */}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
            <span>
              {PLACE.name} ·{" "}
              {new Date(cached!.fetchedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              갱신 · Open-Meteo
            </span>
            <button
              onClick={() => reload(true)}
              disabled={busy}
              aria-label="새로고침"
              className="tap rounded-full p-1 text-rose-deep disabled:opacity-50"
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>
          {failed && (
            <p className="mt-1 text-center text-xs text-muted">
              방금 갱신에 실패해서 아까 본 걸 보여주고 있어요
            </p>
          )}
        </>
      )}
    </section>
  );
}
