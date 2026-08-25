export const ACCOUNT_EXPORT_TABLES = [
  "couples",
  "couple_members",
  "pokes",
  "couple_events",
  "couple_photos",
  "mood_checkins",
  "qa_answers",
  "quiz_responses",
  "deco_entries",
  "couple_bucket",
  "entry_reactions",
  "entry_comments",
  "couple_logs",
  "chat_reads",
  "poke_reactions",
  "log_comments",
  "game_challenges",
  "game_attempts",
  "board_games",
  "board_results",
  "tetris_results",
  "couple_island",
  "letters", // 편지(UI 는 내려갔지만 실데이터가 남아 있다) — 내보내기·삭제 둘 다 포함 [리뷰 2026-08-26]
  "activity_events",
  "activity_reads",
  "notify_prefs",
  "push_subscriptions",
  "debug_logs",
  "game_daily",
  "game_ranks",
  "game_profile",
] as const;

export type AccountExportTable = (typeof ACCOUNT_EXPORT_TABLES)[number];
export type ExportRow = Record<string, unknown>;

export function safeExportMediaPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\/+/, "");
  if (!path || path.length > 1024 || path.includes("\\") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return path;
}

function rows(value: unknown): ExportRow[] {
  return Array.isArray(value)
    ? value.filter((row): row is ExportRow => !!row && typeof row === "object")
    : [];
}

/** 내보내기 데이터에서 실제 Storage 파일 경로를 중복 없이 추린다. */
export function collectExportMediaPaths(
  tables: Partial<Record<AccountExportTable, unknown>>,
): string[] {
  const paths = new Set<string>();
  const add = (value: unknown) => {
    const path = safeExportMediaPath(value);
    if (path) paths.add(path);
  };

  for (const row of rows(tables.couple_photos)) {
    add(row.storage_path);
    add(row.thumb_path);
  }
  for (const row of rows(tables.deco_entries)) {
    if (Array.isArray(row.photo_paths)) row.photo_paths.forEach(add);
  }
  for (const row of rows(tables.couple_logs)) add(row.video_path);
  return [...paths].sort();
}

export function accountArchiveName(now = new Date()): string {
  return `our-days-export-${now.toISOString().slice(0, 10)}`;
}

export function ourDaysStorageKeys(keys: readonly string[]): string[] {
  // 접두사가 둘이다: 콜론(ourdays:start 등)과 **점**(ourdays.island.solo.v1,
  // ourdays.weather.v2:* 등). 콜론만 지우면 삭제한 계정의 솔로 섬이 다음 계정의
  // 커플 섬으로 승격되고 도시 캐시가 새어간다 [리뷰 2026-08-26].
  return keys.filter((key) => key.startsWith("ourdays:") || key.startsWith("ourdays."));
}
