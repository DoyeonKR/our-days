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
};

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

export function dateInTimezone(iso: string, timezone = "Asia/Seoul"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
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
    const date = dateInTimezone(row.created_at);
    if (!onSamePastDay(date, referenceDate)) continue;
    items.push({
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
  const photos = snapshot.photos.filter((row) => dateInTimezone(row.created_at).startsWith(monthKey));
  const logs = snapshot.logs.filter((row) => row.log_date.startsWith(monthKey));
  const answers = snapshot.answers.filter((row) => dateInTimezone(row.created_at).startsWith(monthKey));
  const days = new Set<string>();
  diary.forEach((row) => days.add(row.entry_date));
  photos.forEach((row) => days.add(dateInTimezone(row.created_at)));
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
