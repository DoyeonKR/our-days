// 사진첩의 순수 규칙(임포트 0 — node --test 로 바로 읽는다). 화면(PhotoAlbum · PhotoViewer · MemoriesRecap)과
// 데이터 계층(couple.ts)이 같은 규칙을 쓴다. [2026-11-06 사진첩 리뷰]

/** KST 'YYYY-MM-DD' — 사진의 '그날'은 두 사람이 같은 하루(KST)로 본다. */
export function kstDay(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜 머리말 — "오늘" · "어제" · 올해는 "3월 2일 (일)" · 그 밖엔 "2025년 3월 2일 (일)". */
export function dayLabel(date: string, todayIso: string): string {
  if (!date) return "날짜 모름";
  if (date === todayIso) return "오늘";
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  if (Date.UTC(ty, tm - 1, td) - t === 86_400_000) return "어제";
  const w = WEEK[new Date(t).getUTCDay()];
  return y === ty ? `${m}월 ${d}일 (${w})` : `${y}년 ${m}월 ${d}일 (${w})`;
}

/** 짧은 날짜 — 스크린리더 라벨 · 휴지통 줄. "2025년 3월 2일". */
export function shortDate(iso: string): string {
  const day = kstDay(iso);
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export type DatedPhoto = { id: string; shotAt: string };

/** 찍은 날 묶음 — 들어온 순서(찍은 시각 내림차순)를 그대로 지키며 날짜가 바뀔 때마다 새 묶음. */
export function groupByDay<T extends DatedPhoto>(photos: readonly T[]): { date: string; photos: T[] }[] {
  const out: { date: string; photos: T[] }[] = [];
  for (const p of photos) {
    const date = kstDay(p.shotAt);
    const last = out[out.length - 1];
    if (last && last.date === date) last.photos.push(p);
    else out.push({ date, photos: [p] });
  }
  return out;
}

export type AlbumEvent = {
  id: string;
  title: string;
  date: string;
  emoji?: string;
  recurrence?: string;
  repeatYearly?: boolean;
};

export type EventAlbum = { key: string; eventId: string; title: string; emoji: string; date: string; count: number };

/** 일정이 있던 날 찍은 사진을 '제주 여행' 같은 앨범으로. dayCounts = KST 날짜별 사진 수(전체 — 불러온 페이지만이 아니다).
 *  매년 반복(기념일)은 해마다 따로(같은 날 다른 해는 다른 추억이다), 매달 반복은 너무 잦아 뺀다. 최근 날짜부터. */
export function eventAlbums(events: readonly AlbumEvent[], dayCounts: ReadonlyMap<string, number>, todayIso: string): EventAlbum[] {
  const out: EventAlbum[] = [];
  for (const ev of events) {
    if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
    const rec = ev.recurrence ?? (ev.repeatYearly ? "yearly" : "none");
    if (rec === "monthly") continue;
    const days: string[] = [];
    if (rec === "yearly") {
      const md = ev.date.slice(5);
      for (const day of dayCounts.keys()) if (day.slice(5) === md && day >= ev.date && day <= todayIso) days.push(day);
    } else if (ev.date <= todayIso) days.push(ev.date);
    for (const day of days) {
      const count = dayCounts.get(day) ?? 0;
      if (!count) continue;
      const title = rec === "yearly" ? `${ev.title.trim() || "기념일"} · ${day.slice(0, 4)}` : ev.title.trim() || "그날";
      out.push({ key: `${ev.id}@${day}`, eventId: ev.id, title, emoji: ev.emoji || "", date: day, count });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** 날짜별 사진 수 — 찍은 시각 목록(전체)에서. */
export function countByDay(shotAts: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of shotAts) {
    const d = kstDay(s);
    if (d) m.set(d, (m.get(d) ?? 0) + 1);
  }
  return m;
}

/** 키셋 커서 — 찍은 시각이 같으면 id 로 가른다(같은 초에 여러 장). PostgREST or() 필터 문자열.
 *  값은 큰따옴표로 감싼다 — 시각의 ':' 가 논리 연산 구문과 부딪히지 않게(listOnThisDaySnapshot 과 같은 이유). */
export function keysetFilter(cursor: { shotAt: string; id: string }, column = "shot_at"): string {
  const t = `"${cursor.shotAt}"`;
  return `${column}.lt.${t},and(${column}.eq.${t},id.lt.${cursor.id})`;
}

export type UploadOutcome = { ok: number; duplicate: number; failed: { name: string; message: string }[] };

/** 여러 장 올리기 결과 한 줄 — 몇 장 중 몇 장이 됐는지 먼저, 실패 이유는 대표 하나만. */
export function uploadSummary(total: number, r: UploadOutcome): { text: string; tone: "ok" | "warn" | "error" } {
  const parts: string[] = [];
  if (total <= 1 && r.ok === 1) return { text: "사진을 올렸어요", tone: "ok" };
  if (r.ok > 0) parts.push(total > 1 ? `${total}장 중 ${r.ok}장을 올렸어요` : "사진을 올렸어요");
  else parts.push(total > 1 ? `${total}장 모두 올리지 못했어요` : "사진을 올리지 못했어요");
  if (r.duplicate) parts.push(`이미 있는 사진 ${r.duplicate}장은 건너뛰었어요`);
  if (r.failed.length) {
    const first = r.failed[0];
    parts.push(r.failed.length > 1 ? `${r.failed.length}장 실패 — ${first.message}` : first.message);
  }
  const tone = r.failed.length === 0 && r.duplicate === 0 ? "ok" : r.ok > 0 || r.duplicate > 0 ? "warn" : "error";
  return { text: parts.join(" · "), tone };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0MB";
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)}GB`;
  return mb >= 10 ? `${Math.round(mb)}MB` : `${mb.toFixed(1)}MB`;
}

export type StorageUsage = {
  photos: number;
  diary: number;
  logs: number;
  recent30: number;
  bucket_total: number;
  bucket_recent30: number;
};

/** 무료 스토리지 1GB(프로젝트 전체). */
export const FREE_STORAGE_BYTES = 1024 * 1024 * 1024;

/** 저장 공간 막대 — 우리 사진 · 영상 · 일기와, 지난 30일 속도로 남은 기간(개월). 늘지 않으면 null(넉넉). */
export function storageSummary(u: StorageUsage): { mine: number; usedRatio: number; monthsLeft: number | null } {
  const mine = u.photos + u.diary + u.logs;
  const left = Math.max(0, FREE_STORAGE_BYTES - u.bucket_total);
  const monthsLeft = u.bucket_recent30 > 0 ? Math.floor(left / u.bucket_recent30) : null;
  return { mine, usedRatio: Math.min(1, u.bucket_total / FREE_STORAGE_BYTES), monthsLeft };
}

/** 월간 공유 카드의 '좋은 사진 4장' — 하트 많은 것 > 댓글 많은 것 > 캡션 있는 것 > 최근. */
export function bestPhotos<T extends { id: string; shotAt: string; caption?: string | null }>(
  photos: readonly T[],
  hearts: ReadonlyMap<string, number>,
  comments: ReadonlyMap<string, number>,
  n = 4,
): T[] {
  return [...photos]
    .sort(
      (a, b) =>
        (hearts.get(b.id) ?? 0) - (hearts.get(a.id) ?? 0) ||
        (comments.get(b.id) ?? 0) - (comments.get(a.id) ?? 0) ||
        Number(!!b.caption) - Number(!!a.caption) ||
        b.shotAt.localeCompare(a.shotAt),
    )
    .slice(0, n);
}

/** 사진 보기에서 지운 뒤 갈 곳 — 다음 사진, 마지막이었으면 이전, 남은 게 없으면 닫기(null). */
export function nextAfterRemove(ids: readonly string[], removedId: string): string | null {
  const i = ids.indexOf(removedId);
  if (i < 0) return ids[0] ?? null;
  return ids[i + 1] ?? ids[i - 1] ?? null;
}

/** 미리 받아 둘 이웃(앞뒤 하나씩) — 넘길 때 원본이 이미 와 있게. */
export function neighborIds(ids: readonly string[], currentId: string, span = 1): string[] {
  const i = ids.indexOf(currentId);
  if (i < 0) return [];
  const out: string[] = [];
  for (let k = 1; k <= span; k++) {
    if (ids[i + k]) out.push(ids[i + k]);
    if (ids[i - k]) out.push(ids[i - k]);
  }
  return out;
}

/** 빨랫줄 토글 결과 문구 — 가득 차서 내려간 사진이 있으면 그걸 말한다(예전엔 FIFO 로 상대가 고른 사진이 조용히 빠졌다). */
export function hungToastText(r: { added: boolean; evicted: string | null }, evictedLabel: string | null): string {
  if (!r.added) return "홈 빨랫줄에서 내렸어요";
  if (r.evicted) return `홈에 걸었어요 · ${evictedLabel ? `${evictedLabel} 사진` : "가장 먼저 건 사진"}이 내려갔어요`;
  return "홈 빨랫줄에 걸었어요";
}

/** 휴지통 남은 날 — 30일 뒤 정리. */
export const TRASH_DAYS = 30;
export function trashDaysLeft(deletedAt: string, now: number): number {
  const t = Date.parse(deletedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + TRASH_DAYS * 86_400_000 - now) / 86_400_000));
}

/** KST 하루 범위(UTC ISO, [시작, 끝)) — 일정 앨범 · 그날 사진을 서버에서 자를 때. */
export function kstDayRange(date: string): [string, string] {
  const [y, m, d] = date.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d) - 9 * 3_600_000;
  const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
  return [iso(start), iso(start + 86_400_000)];
}

/** 두 손가락 확대 — 시작 거리 대비 지금 거리로 배율(1~4). */
export function pinchScale(startDist: number, nowDist: number, startScale: number): number {
  if (!(startDist > 0) || !(nowDist > 0)) return startScale;
  return Math.min(4, Math.max(1, startScale * (nowDist / startDist)));
}

/** 확대한 채 끌 때 사진이 화면 밖으로 다 빠지지 않게 — 한 변 기준 최대 이동량. */
export function clampPan(offset: number, size: number, scale: number): number {
  const max = Math.max(0, (size * (scale - 1)) / 2);
  return Math.min(max, Math.max(-max, offset)) || 0; // -0 을 0 으로(transform 문자열에 -0px 가 찍히지 않게)
}
