/* 일기 저장 규칙(순수) — couple.ts 의 addDecoEntry · updateDecoEntry · updateDecoPhotos 와 편집기가 같이 쓴다.
 * 별칭(@/) import 가 없어 node --test 로 그대로 잰다(diarysave.test).
 *
 * [2026-11-11 리뷰] 응답을 잃은 뒤 다시 저장하는 길이 '성공처럼 보이는 실패'였다:
 *  · 같은 id 로 다시 넣으면 23505 를 '이미 저장됨'으로 보고 끝냈다 — 그 사이 고친 글은 버려졌다.
 *  · 사진 이름이 deco-<id>-0 으로 고정이라 다시 고른 사진이 '이미 있다'로 처리돼 첫 사진이 남았다.
 *  · 연결이 끊겨 오류 코드 없이 실패해도 방금 올린 사진을 지웠다 — 행은 이미 들어가 있어 깨진 사진이 남았다.
 * 그래서 '서버가 분명히 거절했나'(코드가 있나)와 '내 행이 이미 그 글인가'를 여기서 정한다. */

/** 사진 한 장(원본 또는 썸네일) 올리기를 기다리는 시간. 1280px 원본은 수백 KB — 느린 LTE 에서도 넉넉하다. */
export const DIARY_PHOTO_TIMEOUT_MS = 30_000;
/** 행 넣기 · 고치기 · 다시 읽기를 기다리는 시간. 끊긴 소켓에서 '저장 중…'에 갇히지 않게. */
export const DIARY_SAVE_TIMEOUT_MS = 15_000;

/** 서버가 **분명히** 거절했나 — PostgREST/PG 오류 코드가 있으면 요청이 서버에 닿아 판정된 것이다.
 *  코드가 없으면(연결 끊김 'Failed to fetch' · 시간 초과) 요청이 반영됐는지 모른다 → 사진을 지우면 안 된다. */
export function isDefiniteRejection(error: { code?: string | null } | null | undefined): boolean {
  return !!error && typeof error.code === "string" && error.code.trim() !== "";
}

/** 23505(같은 id 가 이미 있다) — 응답을 잃은 첫 시도가 이미 들어갔다는 뜻. */
export function isDuplicateKey(error: { code?: string | null; message?: string } | null | undefined): boolean {
  return !!error && (error.code === "23505" || /duplicate key/i.test(error.message ?? ""));
}

/** 사진 이름 줄기 — 시도마다 다르다. 같은 이름을 다시 쓰면 다시 고른 사진이 '이미 있다'로 처리돼 첫 사진이 남았다.
 *  ⚠ 이름 앞부분(`deco-<id>`)은 그대로 — 비밀일기 가드 · 미디어 GC 가 '<커플>/deco-' 접두사를 본다. */
export function diaryPhotoStem(id: string, now: number = Date.now(), rand: string = Math.random().toString(36).slice(2, 8)): string {
  return `${id}-${now.toString(36)}${rand}`;
}

/** 화면에 그릴 사진 주소 — photo_paths 와 **같은 자리**를 지킨다(못 받은 칸은 ''). 예전엔 빈 칸을 걸러
 *  두 번째 사진이 첫 자리로 당겨졌고, 편집기는 photo_paths[i] 옆에 다른 사진을 보여 줘서 '빼기'가 엉뚱한 파일을 지웠다.
 *  거르는 건 그릴 때만(visiblePhotoUrls). */
export function alignedPhotoUrls(
  photoPaths: readonly string[],
  thumbPaths: readonly (string | null | undefined)[],
  urls: Readonly<Record<string, string>>,
  orig: Readonly<Record<string, string>> = {},
): string[] {
  return photoPaths.map((p, i) => {
    const t = thumbPaths[i];
    return (t && urls[t]) || urls[p] || orig[p] || "";
  });
}

/** 그릴 때만 빈 칸을 뺀다. */
export const visiblePhotoUrls = (urls: readonly string[]): string[] => urls.filter(Boolean);

type DiaryContent = {
  title?: string | null;
  body?: string | null;
  location?: string | null;
  mood_emoji?: string | null;
  bg?: string | null;
  hashtags?: readonly string[] | null;
  stickers?: readonly { emoji: string }[] | null;
};
const norm = (v: string | null | undefined) => (v ?? "").trim();

/** 행이 이미 이 글인가 — 응답을 잃은 내 첫 저장이 들어가 버전이 바뀐 경우를 '다른 기기가 고침'과 가른다. */
export function sameDiaryContent(row: DiaryContent, patch: DiaryContent): boolean {
  return (
    norm(row.title) === norm(patch.title) &&
    norm(row.body) === norm(patch.body) &&
    norm(row.location) === norm(patch.location) &&
    norm(row.mood_emoji) === norm(patch.mood_emoji) &&
    norm(row.bg) === norm(patch.bg) &&
    (row.hashtags ?? []).join(" ") === (patch.hashtags ?? []).join(" ") &&
    (row.stickers ?? []).map((s) => s.emoji).join("") === (patch.stickers ?? []).map((s) => s.emoji).join("")
  );
}

/** 사진 행이 이미 이 순서인가(응답을 잃은 내 사진 저장이 들어간 경우). */
export function samePaths(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = a ?? [], y = b ?? [];
  return x.length === y.length && x.every((p, i) => p === y[i]);
}

/** 같은 id 로 다시 넣다 23505 가 났을 때 사진을 어떻게 할지 — 이번에 고른 사진이 있으면 그것으로 바꾸고,
 *  없으면(닫았다 다시 열어 초안엔 사진이 없다) 이미 들어간 사진을 남긴다. 사진을 말없이 지우지 않는다. */
export function retryPhotoPlan(
  existing: { photo_paths: readonly string[]; thumb_paths?: readonly (string | null)[] | null },
  uploaded: { paths: readonly string[]; thumbs: readonly string[] },
): { photo_paths: string[]; thumb_paths: string[]; gone: string[] } {
  if (!uploaded.paths.length) {
    return { photo_paths: [...existing.photo_paths], thumb_paths: (existing.thumb_paths ?? []).map((t) => t ?? ""), gone: [] };
  }
  const now = new Set([...uploaded.paths, ...uploaded.thumbs.filter(Boolean)]);
  const gone = [...existing.photo_paths, ...(existing.thumb_paths ?? [])].filter((p): p is string => !!p && !now.has(p));
  return { photo_paths: [...uploaded.paths], thumb_paths: [...uploaded.thumbs], gone };
}

/** 다른 기기에서 지워진 일기의 글을 '새 일기' 초안으로 옮길 때 — 이미 쓰던 새 일기 초안이 있으면 덮지 않고 뒤에 붙인다. */
export function mergeIntoNewDraft<T extends { title: string; body: string }>(existing: T | null, moved: T): T {
  if (!existing || (!existing.title.trim() && !existing.body.trim())) return moved;
  const tail = [moved.title.trim(), moved.body.trim()].filter(Boolean).join("\n");
  if (!tail) return existing;
  return { ...existing, body: existing.body.trim() ? `${existing.body}\n\n${tail}` : tail };
}

/** 기준 행이 바뀌었을 때(다른 기기 · 응답을 잃은 내 저장) 남길 사진 — 내가 남긴 것 + **내가 본 적 없는 것**.
 *  예전 사진 목록(shown)에 있었는데 keep 에 없으면 내가 뺀 것이라 뺀다. 다른 기기가 더한 사진을 말없이 지우지 않는다. */
export function rebaseKeep(keep: readonly string[], shown: readonly string[], latest: readonly string[]): string[] {
  return latest.filter((p) => keep.includes(p) || !shown.includes(p));
}
