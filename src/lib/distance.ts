export const DISTANCE_CITIES = {
  seoul: { name: "서울", country: "한국", lat: 37.5665, lon: 126.978, timezone: "Asia/Seoul" },
  incheon: { name: "인천", country: "한국", lat: 37.4563, lon: 126.7052, timezone: "Asia/Seoul" },
  busan: { name: "부산", country: "한국", lat: 35.1796, lon: 129.0756, timezone: "Asia/Seoul" },
  jeju: { name: "제주", country: "한국", lat: 33.4996, lon: 126.5312, timezone: "Asia/Seoul" },
  tokyo: { name: "도쿄", country: "일본", lat: 35.6762, lon: 139.6503, timezone: "Asia/Tokyo" },
  osaka: { name: "오사카", country: "일본", lat: 34.6937, lon: 135.5023, timezone: "Asia/Tokyo" },
  singapore: { name: "싱가포르", country: "싱가포르", lat: 1.3521, lon: 103.8198, timezone: "Asia/Singapore" },
  london: { name: "런던", country: "영국", lat: 51.5072, lon: -0.1276, timezone: "Europe/London" },
  paris: { name: "파리", country: "프랑스", lat: 48.8566, lon: 2.3522, timezone: "Europe/Paris" },
  new_york: { name: "뉴욕", country: "미국", lat: 40.7128, lon: -74.006, timezone: "America/New_York" },
  los_angeles: { name: "로스앤젤레스", country: "미국", lat: 34.0522, lon: -118.2437, timezone: "America/Los_Angeles" },
  sydney: { name: "시드니", country: "호주", lat: -33.8688, lon: 151.2093, timezone: "Australia/Sydney" },
} as const;

export type DistanceCityKey = keyof typeof DISTANCE_CITIES;
export const DEFAULT_DISTANCE_CITY: DistanceCityKey = "seoul";

export function isDistanceCity(value: string | null | undefined): value is DistanceCityKey {
  return !!value && value in DISTANCE_CITIES;
}

export function cityClock(timezone: string, now = new Date()): { time: string; date: string } {
  return {
    time: new Intl.DateTimeFormat("ko-KR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
    date: new Intl.DateTimeFormat("ko-KR", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(now),
  };
}

export function cityDistanceKm(a: DistanceCityKey, b: DistanceCityKey): number {
  const left = DISTANCE_CITIES[a];
  const right = DISTANCE_CITIES[b];
  const rad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = rad(right.lat - left.lat);
  const dLon = rad(right.lon - left.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(left.lat)) * Math.cos(rad(right.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function cityCurrentWeatherUrl(key: DistanceCityKey): string {
  const city = DISTANCE_CITIES[key];
  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "temperature_2m,weather_code",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
