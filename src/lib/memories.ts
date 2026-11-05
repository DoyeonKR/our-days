export type MemoryDiaryRow = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  mood_emoji: string | null;
  photo_paths: string[];
  created_by: string;
};

export type MemoryPhotoRow = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  created_by: string;
  created_at: string;
  /** EXIF 찍은 시각(2026-11-06~). 없으면 올린 시각으로 본다 — 옛 사진 · 옛 앱이 올린 사진. */
  taken_at?: string | null;
  caption?: string | null;
};

/** 사진의 '그날' — 찍은 시각이 있으면 그것, 없으면 올린 시각. 옛 여행 사진을 한꺼번에 올려도 그날로 간다. */
export function photoShotAt(row: { created_at: string; taken_at?: string | null }): string {
  return row.taken_at || row.created_at;
}

export type MemoryLogRow = {
  id: string;
  log_date: string;
  body: string | null;
  emoji: string | null;
  created_by: string;
  created_at: string;
};

export type MemoryAnswerRow = {
  id: string;
  question_id: string;
  body: string;
  user_id: string;
  created_at: string;
};

export type MemorySnapshot = {
  diaries: MemoryDiaryRow[];
  photos: MemoryPhotoRow[];
  logs: MemoryLogRow[];
  answers: MemoryAnswerRow[];
};

export type MemoryItem = {
  key: string;
  kind: "diary" | "photo" | "log" | "answer";
  date: string;
  yearsAgo: number;
  emoji: string;
  title: string;
  body: string | null;
  mediaPath: string | null;
  actorUser: string;
  /** 사진 추억이면 그 사진 id — 카드를 누르면 사진 보기로 연다. */
  photoId?: string;
};

export type MonthlyRecap = {
  monthKey: string;
  diaries: number;
  photos: number;
  logs: number;
  answers: number;
  activeDays: number;
  topMood: string | null;
  /** 이 달 일기의 기분 분포(많은 순). 예전엔 일기장 안에 '이번 달 우리 기분'으로 따로 있었다. */
  moods: { emoji: string; count: number }[];
  total: number;
};

// 시간대별 포매터를 한 번만 만든다 — 행마다 new Intl.DateTimeFormat 이면 3,000행에 87.6ms(재사용 1.9ms, 실측).
const _fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(timezone: string): Intl.DateTimeFormat {
  let f = _fmtCache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    _fmtCache.set(timezone, f);
  }
  return f;
}

export function dateInTimezone(iso: string, timezone = "Asia/Seoul"): string {
  // KST 는 서머타임이 없어 +9 시간 산수가 Intl 과 같다 — 가장 흔한 경로를 포매터 없이
  if (timezone === "Asia/Seoul") {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
  }
  const parts = fmtFor(timezone).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

function onSamePastDay(date: string, referenceDate: string): boolean {
  return date.slice(5) === referenceDate.slice(5) && yearOf(date) < yearOf(referenceDate);
}

export function onThisDayMemories(
  snapshot: MemorySnapshot,
  referenceDate: string,
): MemoryItem[] {
  const referenceYear = yearOf(referenceDate);
  const items: MemoryItem[] = [];
  for (const row of snapshot.diaries) {
    if (!onSamePastDay(row.entry_date, referenceDate)) continue;
    items.push({
      key: `diary:${row.id}`,
      kind: "diary",
      date: row.entry_date,
      yearsAgo: referenceYear - yearOf(row.entry_date),
      emoji: row.mood_emoji || "📔",
      title: row.title?.trim() || "그날의 일기",
      body: row.body?.trim() || null,
      mediaPath: row.photo_paths?.[0] ?? null,
      actorUser: row.created_by,
    });
  }
  for (const row of snapshot.photos) {
    const date = dateInTimezone(photoShotAt(row));
    if (!onSamePastDay(date, referenceDate)) continue;
    items.push({
      photoId: row.id,
      key: `photo:${row.id}`,
      kind: "photo",
      date,
      yearsAgo: referenceYear - yearOf(date),
      emoji: "📷",
      title: "그날 남긴 사진",
      body: null,
      mediaPath: row.thumb_path || row.storage_path,
      actorUser: row.created_by,
    });
  }
  for (const row of snapshot.logs) {
    if (!onSamePastDay(row.log_date, referenceDate)) continue;
    items.push({
      key: `log:${row.id}`,
      kind: "log",
      date: row.log_date,
      yearsAgo: referenceYear - yearOf(row.log_date),
      emoji: row.emoji || "🎥",
      title: "그날의 로그",
      body: row.body?.trim() || null,
      mediaPath: null,
      actorUser: row.created_by,
    });
  }
  for (const row of snapshot.answers) {
    const date = dateInTimezone(row.created_at);
    if (!onSamePastDay(date, referenceDate)) continue;
    items.push({
      key: `answer:${row.id}`,
      kind: "answer",
      date,
      yearsAgo: referenceYear - yearOf(date),
      emoji: "💬",
      title: "그날의 질문 답",
      body: row.body,
      mediaPath: null,
      actorUser: row.user_id,
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}

export function monthlyRecap(snapshot: MemorySnapshot, monthKey: string): MonthlyRecap {
  const diary = snapshot.diaries.filter((row) => row.entry_date.startsWith(monthKey));
  const photos = snapshot.photos.filter((row) => dateInTimezone(photoShotAt(row)).startsWith(monthKey));
  const logs = snapshot.logs.filter((row) => row.log_date.startsWith(monthKey));
  const answers = snapshot.answers.filter((row) => dateInTimezone(row.created_at).startsWith(monthKey));
  const days = new Set<string>();
  diary.forEach((row) => days.add(row.entry_date));
  photos.forEach((row) => days.add(dateInTimezone(photoShotAt(row))));
  logs.forEach((row) => days.add(row.log_date));
  answers.forEach((row) => days.add(dateInTimezone(row.created_at)));
  const moods = new Map<string, number>();
  diary.forEach((row) => {
    if (row.mood_emoji) moods.set(row.mood_emoji, (moods.get(row.mood_emoji) ?? 0) + 1);
  });
  const moodList = [...moods.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([emoji, count]) => ({ emoji, count }));
  const topMood = moodList[0]?.emoji ?? null;
  const result = {
    monthKey,
    diaries: diary.length,
    photos: photos.length,
    logs: logs.length,
    answers: answers.length,
    activeDays: days.size,
    topMood,
    moods: moodList,
    total: diary.length + photos.length + logs.length + answers.length,
  };
  return result;
}

export function shiftedMonthKey(referenceDate: string, delta: number): string {
  const [year, month] = referenceDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** todayIso 의 지난 years 년 **같은 날짜**와, 각 날의 KST 하루 범위(UTC ISO, [시작, 끝)).
 *  2월 29일은 윤년에만 있다 — 없는 해는 건너뛴다(3월 1일로 밀면 다른 날의 추억이 섞인다). */
export function pastSameDays(todayIso: string, years: number): { dates: string[]; ranges: [string, string][] } {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dates: string[] = [];
  const ranges: [string, string][] = [];
  const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
  for (let k = 1; k <= years; k++) {
    const yy = y - k;
    const t = Date.UTC(yy, m - 1, d);
    if (new Date(t).getUTCDate() !== d) continue;
    dates.push(`${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    // KST 자정 = UTC 전날 15:00
    ranges.push([iso(t - 9 * 3_600_000), iso(t + 15 * 3_600_000)]);
  }
  return { dates, ranges };
}

/** 서버 집계(memory_month_stats) 응답 → MonthlyRecap. 모양이 어긋나도 0 으로 읽는다(던지지 않는다). */
export function recapFromStats(monthKey: string, raw: unknown): MonthlyRecap {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(o[k]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };
  const moods = (Array.isArray(o.moods) ? o.moods : [])
    .map((m) => m as { emoji?: unknown; count?: unknown })
    .filter((m) => typeof m.emoji === "string" && m.emoji)
    .map((m) => ({ emoji: m.emoji as string, count: Math.max(0, Math.floor(Number(m.count) || 0)) }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  const diaries = n("diaries"), photos = n("photos"), logs = n("logs"), answers = n("answers");
  return {
    monthKey,
    diaries,
    photos,
    logs,
    answers,
    activeDays: n("active_days"),
    topMood: moods[0]?.emoji ?? null,
    moods,
    total: diaries + photos + logs + answers,
  };
}

/** 'YYYY-MM' 의 KST 한 달 범위(UTC ISO, [시작, 끝)). 사진 찍은 시각 · 답변 시각을 자를 때 쓴다. */
export function kstMonthRange(monthKey: string): [string, string] {
  const [y, m] = monthKey.split("-").map(Number);
  const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
  return [iso(Date.UTC(y, m - 1, 1) - 9 * 3_600_000), iso(Date.UTC(y, m, 1) - 9 * 3_600_000)];
}

export type MemoryGroup = { date: string; yearsAgo: number; items: MemoryItem[]; cover: MemoryItem };

/** '그날의 우리' 카드 묶기 — 같은 날의 기록은 한 장(+N). 사진 20장인 날이 카드 8칸을 다 채우던 것.
 *  대표는 사진이 있는 것 > 글이 있는 것 순. 최근 해부터. */
export function groupMemoriesByDate(items: MemoryItem[]): MemoryGroup[] {
  const by = new Map<string, MemoryItem[]>();
  for (const it of items) {
    const list = by.get(it.date);
    if (list) list.push(it);
    else by.set(it.date, [it]);
  }
  return [...by.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => {
      const cover = list.find((i) => i.kind !== "photo" && i.mediaPath) ?? list.find((i) => i.mediaPath) ?? list.find((i) => i.body) ?? list[0];
      return { date, yearsAgo: cover.yearsAgo, items: list, cover };
    });
}

/** 홈 티저 머리말 — 여러 해가 섞이면 '1년 전 오늘'이라고 하지 않는다(예전엔 '1년 전 오늘 · 추억 3개'가 3년 치를 셌다). */
export function teaserLabel(items: Pick<MemoryItem, "yearsAgo">[]): string {
  if (items.length === 0) return "";
  const years = [...new Set(items.map((i) => i.yearsAgo))].sort((a, b) => a - b);
  if (years.length > 1) return `지난해들의 오늘 ${items.length}개`;
  return items.length > 1 ? `${years[0]}년 전 오늘 · 추억 ${items.length}개` : `${years[0]}년 전 오늘`;
}
