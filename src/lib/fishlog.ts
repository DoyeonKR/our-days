// 오늘 잡은 물고기(2026-11-21) [사용자: 리뷰 "낚시에 오늘 잡은 물고기 기록이 없어요 … 결과 카드를 넘기면 끝" → "다 진행해"]
// 결과 카드를 넘기면 무엇을 잡았는지 돌아볼 곳이 없었다(크기 기록 · 도감은 최고 기록만 남긴다).
// 이 기기의 이 사람 기록이다 — 섬 저장(커플 공유 · 버전 잠금)에 끼우면 낚을 때마다 저장이 커지고 옛 앱과 섞인다. 날이 바뀌면(KST) 비운다.
// 순수 부분(addLog · summarize)과 저장소 부분(readFishLog · noteFishLog)을 나눴다 — 저장소가 막힌 기기(프라이빗 모드)에선 조용히 아무것도 안 남긴다.

export type FishLogOut = "stored" | "netted" | "sold" | "slipped" | "junk";
export type FishLogEntry = { t: number; name: string; art: string; cm?: number; out: FishLogOut; coins: number; grade: number };
export type FishLog = { day: string; list: FishLogEntry[] };

/** 하루 기록 상한 — 오래 낚아도 기기 저장이 끝없이 크지 않게(오래된 것부터 버린다) */
export const FISH_LOG_MAX = 120;

export function addLog(log: FishLog | null, day: string, e: FishLogEntry): FishLog {
  const base = log && log.day === day ? log.list : [];
  return { day, list: [...base, e].slice(-FISH_LOG_MAX) };
}

export type FishLogSummary = { n: number; fish: number; junk: number; stored: number; coins: number; biggest: FishLogEntry | null; best: FishLogEntry | null };
export function summarize(log: FishLog | null, day: string): FishLogSummary {
  const list = log && log.day === day ? log.list : [];
  const fish = list.filter((x) => x.out !== "junk");
  const biggest = fish.reduce<FishLogEntry | null>((m, x) => (x.cm && (!m || (m.cm ?? 0) < x.cm) ? x : m), null);
  const best = fish.reduce<FishLogEntry | null>((m, x) => (!m || x.grade > m.grade ? x : m), null);
  return {
    n: list.length,
    fish: fish.length,
    junk: list.length - fish.length,
    stored: fish.filter((x) => x.out === "stored" || x.out === "netted").length,
    coins: list.reduce((s, x) => s + Math.max(0, x.coins), 0),
    biggest,
    best,
  };
}

export const fishLogKey = (seed: number | string, who: string) => `ourdays:fishlog:v1:${seed}:${who}`;
export function readFishLog(key: string): FishLog | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as FishLog;
    return v && typeof v.day === "string" && Array.isArray(v.list) ? v : null;
  } catch {
    return null;
  }
}
export function noteFishLog(key: string, day: string, e: FishLogEntry): void {
  try {
    localStorage.setItem(key, JSON.stringify(addLog(readFishLog(key), day, e)));
  } catch {
    /* 저장소가 막힌 기기 — 기록만 못 남긴다 */
  }
}
