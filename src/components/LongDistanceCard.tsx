"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { type Member, updateMyMemberProfile } from "@/lib/couple";
import {
  DEFAULT_DISTANCE_CITY,
  DISTANCE_CITIES,
  cityClock,
  cityCurrentWeatherUrl,
  cityDistanceKm,
  isDistanceCity,
  type DistanceCityKey,
} from "@/lib/distance";
import { showNotice } from "@/lib/notice";
import { wmoInfo } from "@/lib/weather";

type CityWeather = { temperature: number; label: string };
type CachedWeather = CityWeather & { fetchedAt: number };
const WEATHER_TTL = 30 * 60_000;

function memberCity(member: Member | undefined): DistanceCityKey {
  return isDistanceCity(member?.city_key) ? member.city_key : DEFAULT_DISTANCE_CITY;
}

function readWeather(key: DistanceCityKey): CachedWeather | null {
  try {
    const raw = localStorage.getItem(`ourdays:ldr-weather:${key}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as CachedWeather;
    return Date.now() - value.fetchedAt < WEATHER_TTL ? value : null;
  } catch {
    return null;
  }
}

export default function LongDistanceCard({
  coupleId,
  uid,
  members,
  onUpdated,
}: {
  coupleId: string;
  uid: string | null;
  members: Member[];
  onUpdated: (member: Member) => void;
}) {
  const mine = members.find((member) => member.user_id === uid);
  const partner = members.find((member) => member.user_id !== uid);
  const myCity = memberCity(mine);
  const partnerCity = memberCity(partner);
  const [selected, setSelected] = useState<DistanceCityKey>(myCity);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Partial<Record<DistanceCityKey, CityWeather>>>({});

  useEffect(() => setSelected(myCity), [myCity]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const cities = useMemo(() => [...new Set([myCity, partnerCity])], [myCity, partnerCity]);
  useEffect(() => {
    let cancelled = false;
    for (const key of cities) {
      const cached = readWeather(key);
      if (cached) {
        setWeather((current) => ({ ...current, [key]: cached }));
        continue;
      }
      fetch(cityCurrentWeatherUrl(key))
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<{ current?: { temperature_2m?: number; weather_code?: number } }>;
        })
        .then((data) => {
          if (cancelled || data.current?.temperature_2m == null || data.current.weather_code == null) return;
          const next: CachedWeather = {
            temperature: Math.round(data.current.temperature_2m),
            label: wmoInfo(data.current.weather_code).label,
            fetchedAt: Date.now(),
          };
          setWeather((current) => ({ ...current, [key]: next }));
          try {
            localStorage.setItem(`ourdays:ldr-weather:${key}`, JSON.stringify(next));
          } catch {
            /* cache is optional */
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [cities]);

  async function saveCity() {
    setBusy(true);
    try {
      const city = DISTANCE_CITIES[selected];
      const updated = await updateMyMemberProfile(coupleId, {
        cityKey: selected,
        timezone: city.timezone,
      });
      if (updated.city_key !== selected || updated.timezone !== city.timezone)
        throw new Error("서버에서 도시 저장을 확인하지 못했어요.");
      onUpdated(updated);
      setEditing(false);
      showNotice("내 도시와 시간대를 저장했어요.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "도시를 저장하지 못했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    { key: myCity, label: "나", member: mine },
    { key: partnerCity, label: partner?.nickname || "상대", member: partner },
  ] as const;

  return (
    <section className="rounded-xl bg-glass2 p-3 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ink">두 도시의 지금</p>
          <p className="mt-0.5 text-xs text-muted">
            {myCity === partnerCity ? "같은 도시에서 함께" : `${cityDistanceKm(myCity, partnerCity).toLocaleString("ko-KR")}km 떨어져 있어도 같은 하루`}
          </p>
        </div>
        <button onClick={() => setEditing((value) => !value)} className="tap grid h-9 w-9 place-items-center text-muted" aria-label="내 도시 설정">
          <Icon name="settings" size={17} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {cards.map(({ key, label, member }, index) => {
          const clock = cityClock(DISTANCE_CITIES[key].timezone, now);
          const current = weather[key];
          return (
            <div key={`${member?.user_id ?? index}:${key}`} className="min-w-0 rounded-xl bg-card px-3 py-3 ring-1 ring-line">
              <p className="truncate text-xs font-bold text-rose-deep">{label}</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-ink">{clock.time}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{DISTANCE_CITIES[key].name} · {clock.date}</p>
              <p className="mt-2 truncate text-xs font-semibold text-ink">
                {current ? `${current.label} · ${current.temperature}°` : "날씨 확인 중…"}
              </p>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <label className="min-w-0 flex-1">
            <span className="sr-only">내 도시</span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value as DistanceCityKey)}
              disabled={busy}
              className="w-full rounded-lg border border-line bg-card px-2 py-2 text-sm text-ink outline-none focus:border-rose"
            >
              {(Object.keys(DISTANCE_CITIES) as DistanceCityKey[]).map((key) => (
                <option key={key} value={key}>{DISTANCE_CITIES[key].name} · {DISTANCE_CITIES[key].country}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} onClick={() => void saveCity()} className="tap shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-45">
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
    </section>
  );
}
