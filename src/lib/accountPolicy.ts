// 옛 게임 표(game_*, board_*, tetris_results)는 2026-09-24 뺐다 — migrations/20260924000000_drop_old_game_tables.sql 이
// 표를 내리므로 목록에 남아 있으면 내보내기가 없는 표를 읽다 멈춘다(drop-old-games-sync.test).
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
  // 2026-11-06 기록 리뷰에서 생긴 표 — 사진 댓글 · 하트, 3초 로그 반응(내보내기 · 삭제 모두 같은 목록)
  "photo_comments",
  "photo_reactions",
  "log_reactions",
  "couple_island",
  "letters", // 편지(UI 는 내려갔지만 실데이터가 남아 있다) — 내보내기·삭제 둘 다 포함 [리뷰 2026-08-26]
  "activity_events",
  "activity_reads",
  "notify_prefs",
  // 2026-11-05 — 게임 기록(낚시 한 마리 · 정원 합치기 최고 · 판마다 기록)이 빠져 있었다. 셋 다 RLS 가 본인 행만 보여 준다
  // (fish_catches_select_own · merge_scores_select_own · merge_runs_select_own) — 순위판의 남의 기록은 RPC 로만 나온다.
  "fish_catches",
  "merge_scores",
  "merge_runs",
  "adventure_saves", // 2026-11-07 모험 — 본인 행만 보인다(adventure_saves_select_own)
  "adventure_teams", // 2026-11-08 온라인 대전 팀 · 점수(본인 행만)
  "adventure_ratings",
  // 2026-11-09 — 내가 건 대전 판(입력 기록 포함). 방어한 판은 RLS 가 안 보여 준다(adventure_matches_select_mine — 20261107050000)
  "adventure_matches",
  "push_subscriptions",
  "native_push_tokens",
  "debug_logs",
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
    if (Array.isArray(row.thumb_paths)) row.thumb_paths.forEach(add); // 2026-11-06 일기 사진 480px 썸네일
  }
  for (const row of rows(tables.couple_logs)) {
    add(row.video_path);
    add(row.poster_path); // 2026-11-06 3초 로그 첫 장면
  }
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
