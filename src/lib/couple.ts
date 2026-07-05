// 커플 연동 + 쿡찌르기 데이터 계층 (Supabase).
// 인증: 이메일+비번 로그인 필수(AuthGate). ensureAnonAuth 는 세션이 없을 때의 폴백일 뿐,
// 실사용에선 항상 이메일 계정 세션이 존재한다(교차기기 연동이 이 uid 로 이어짐).
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  type UrlEntry,
  isFreshUrlEntry,
  parseStoredUrlEntries,
  persistableUrlEntries,
} from "@/lib/urlcache";
import { humanError } from "@/lib/humanError";
import type { CoupleEvent } from "@/lib/dday";
import { renderImage, resizeImage } from "@/lib/image";

export type Couple = {
  id: string;
  invite_code: string;
  start_date: string | null;
  created_by: string;
  created_at: string;
};

export type Member = {
  couple_id: string;
  user_id: string;
  nickname: string | null;
  joined_at: string;
};

export type Poke = {
  id: string;
  couple_id: string;
  from_user: string;
  kind: string;
  message: string | null;
  created_at: string;
};

export type CoupleState = { couple: Couple; members: Member[] };

/** 쿡 찌르기 프리셋. custom 은 사용자가 문구를 직접 입력. */
export const POKE_KINDS: {
  kind: string;
  emoji: string;
  label: string;
  message: string;
}[] = [
  { kind: "poke", emoji: "👉", label: "쿡 찌르기", message: "야르 ~" },
  { kind: "miss", emoji: "🥺", label: "보고싶어", message: "지금 너무 보고싶어" },
  { kind: "meal", emoji: "🍚", label: "밥 먹었어?", message: "밥 먹었어? 꼭 챙겨 먹어" },
  { kind: "love", emoji: "❤️", label: "사랑해", message: "사랑해 💗" },
  { kind: "kiss", emoji: "💋", label: "뽀뽀해줘", message: "지금 당장 뽀뽀해줘 💋" },
  { kind: "night", emoji: "😏", label: "오늘 밤 기대해", message: "오늘 밤 기대해도 돼? 😏" },
  { kind: "yaru", emoji: "🫡", label: "야르딱끼마쓰 ~", message: "야르딱끼마쓰 ~ 🫡" },
];

export function pokeEmoji(kind: string): string {
  return POKE_KINDS.find((p) => p.kind === kind)?.emoji ?? "💌";
}

export { isSupabaseConfigured };

/** 익명 로그인 보장 → 현재 user id 반환 (미설정/실패 시 null). */
export async function ensureAnonAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(`익명 로그인 실패: ${error.message}`);
  return data.user?.id ?? null;
}

/** 현재 로그인 user id (없으면 null). */
export async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** 내가 속한 커플 + 구성원. 없으면 null.
 *  RLS(couples_select=is_couple_member)가 '내 커플'만 반환하므로 멤버 임베드로
 *  단 1쿼리 — 기존 3연쇄 쿼리 대비 부팅 왕복 -2 (체감 속도 개선). */
export async function getMyCouple(): Promise<CoupleState | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await ensureAnonAuth();
  if (!uid) return null;

  const { data, error } = await sb
    .from("couples")
    .select("*, couple_members(*)")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(humanError(error.message));
  if (!data) return null;
  const { couple_members, ...couple } = data as Couple & {
    couple_members: Member[];
  };
  return { couple, members: couple_members ?? [] };
}

/** 커플 생성 → 초대코드 발급 (생성자 자동 합류). */
export async function createCouple(
  nickname: string,
  startDate: string | null,
): Promise<Couple> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  await ensureAnonAuth();
  const { data, error } = await sb.rpc("create_couple", {
    p_nickname: nickname,
    p_start: startDate,
  });
  if (error) throw new Error(humanError(error.message));
  return data as Couple;
}

/** 초대코드로 합류. */
export async function joinCouple(code: string, nickname: string): Promise<Couple> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  await ensureAnonAuth();
  const { data, error } = await sb.rpc("join_couple", {
    p_code: code.trim().toUpperCase(),
    p_nickname: nickname,
  });
  if (error) throw new Error(humanError(error.message));
  return data as Couple;
}

/** 공유 '사귄 날' 변경. */
export async function updateCoupleStartDate(
  coupleId: string,
  startDate: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couples")
    .update({ start_date: startDate })
    .eq("id", coupleId);
  if (error) throw new Error(humanError(error.message));
}

/** 커플에서 나가기 (본인 멤버십 삭제). */
export async function leaveCouple(coupleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await sb
    .from("couple_members")
    .delete()
    .eq("couple_id", coupleId)
    .eq("user_id", uid);
  if (error) throw new Error(humanError(error.message));
}

/** 쿡찌르기 보내기. */
export async function sendPoke(
  coupleId: string,
  kind: string,
  message: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("커플 연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("pokes")
    .insert({ couple_id: coupleId, from_user: uid, kind, message });
  if (error) throw new Error(humanError(error.message));
}

/** 최근 쿡찌르기 목록 (기본 20개, 최신순). */
export async function recentPokes(coupleId: string, limit = 20): Promise<Poke[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pokes")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Poke[];
}

/**
 * 실시간 쿡찌르기 구독. 상대가 보낸 새 poke 를 즉시 콜백.
 * 반환값을 호출하면 구독 해제.
 */
export function subscribePokes(
  coupleId: string,
  onInsert: (poke: Poke) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`pokes:${coupleId}`))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pokes",
        filter: `couple_id=eq.${coupleId}`,
      },
      // realtime 이 엣지케이스(RLS 필터 실패/경쟁)로 new 가 없을 수 있어 가드 — null poke 로 콜백 크래시 방지
      (payload) => {
        if (payload.new) onInsert(payload.new as Poke);
      },
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}


/** realtime 채널명 — 구독 인스턴스마다 유니크 suffix.
 *  같은 이름 채널에 두 번째 .on() 을 붙이면 "cannot add postgres_changes callbacks
 *  after subscribe()" 크래시가 난다. 동시 마운트(keep-mounted 홈+로그 탭)와
 *  StrictMode 재마운트(removeChannel 은 비동기라 이름이 잠시 살아있음) 둘 다
 *  이름 재사용이 원인 → 인스턴스별 유니크 이름으로 클래스 자체를 봉인. [2026-07-02 장애]
 */
let _chanSeq = 0;
function _chanName(base: string): string {
  return `${base}:${++_chanSeq}`;
}

/* ---------- 채팅 읽음 표시 (chat_reads) ---------- */

export type ChatRead = { user_id: string; last_read_at: string };

export async function getChatReads(coupleId: string): Promise<ChatRead[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("chat_reads")
    .select("user_id,last_read_at")
    .eq("couple_id", coupleId);
  return (data ?? []) as ChatRead[];
}

/** 내가 채팅을 지금 읽었음(마지막 읽은 시각 갱신). 실패는 조용히(부가 기능). */
export async function markChatRead(coupleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) return;
  await sb
    .from("chat_reads")
    .upsert(
      { couple_id: coupleId, user_id: uid, last_read_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id" },
    );
}

export function subscribeChatReads(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`reads:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_reads", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 쿡찌르기 이모지 반응 (poke_reactions) ---------- */

export type PokeReaction = {
  id: string;
  poke_id: string;
  emoji: string;
  created_by: string;
};

export async function listPokeReactions(coupleId: string): Promise<PokeReaction[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("poke_reactions")
    .select("id,poke_id,emoji,created_by")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as PokeReaction[];
}

export async function addPokeReaction(
  coupleId: string,
  pokeId: string,
  emoji: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("poke_reactions")
    .insert({ couple_id: coupleId, poke_id: pokeId, emoji });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(humanError(error.message));
}

export async function removePokeReaction(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("poke_reactions").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export function subscribePokeReactions(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`pokereact:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "poke_reactions", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 브이로그 댓글 (log_comments) ---------- */

export type LogComment = {
  id: string;
  log_id: string;
  body: string;
  created_by: string;
  created_at: string;
};

export async function listLogComments(coupleId: string): Promise<LogComment[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("log_comments")
    .select("id,log_id,body,created_by,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as LogComment[];
}

export async function addLogComment(
  coupleId: string,
  logId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("log_comments")
    .insert({ couple_id: coupleId, log_id: logId, body });
  if (error) throw new Error(humanError(error.message));
}

export async function deleteLogComment(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("log_comments").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export function subscribeLogComments(
  coupleId: string,
  onChange: () => void,
  key = "logcomments",
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`${key}:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "log_comments", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 커플 공유 기념일 (couple_events) ---------- */

type EventRow = {
  id: string;
  couple_id: string;
  title: string;
  event_date: string;
  repeat_yearly: boolean;
  emoji: string | null;
  category: string | null;
  created_by: string;
  created_at: string;
};

function rowToEvent(r: EventRow): CoupleEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.event_date,
    repeatYearly: r.repeat_yearly,
    emoji: r.emoji ?? undefined,
    category: r.category === "anniversary" ? "anniversary" : "plan",
    createdBy: r.created_by,
  };
}

/** 커플 공유 기념일 목록 (날짜순). */
export async function listCoupleEvents(coupleId: string): Promise<CoupleEvent[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_events")
    .select("*")
    .eq("couple_id", coupleId)
    .order("event_date");
  if (error) throw new Error(humanError(error.message));
  return (data ?? []).map((r) => rowToEvent(r as EventRow));
}

/** 커플 공유 기념일 추가. */
export async function addCoupleEvent(
  coupleId: string,
  ev: {
    title: string;
    date: string;
    repeatYearly: boolean;
    emoji?: string;
    category?: "anniversary" | "plan";
  },
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await ensureAnonAuth();
  const { error } = await sb.from("couple_events").insert({
    couple_id: coupleId,
    title: ev.title,
    event_date: ev.date,
    repeat_yearly: ev.repeatYearly,
    emoji: ev.emoji ?? null,
    category: ev.category ?? "plan",
  });
  if (error) throw new Error(humanError(error.message));
}

/** 커플 공유 기념일 삭제. */
export async function deleteCoupleEvent(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_events").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 공유 기념일 실시간 구독 (추가/삭제 시 콜백). 반환값 호출로 해제. */
export function subscribeCoupleEvents(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`events:${coupleId}`))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "couple_events",
        filter: `couple_id=eq.${coupleId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 커플 공유 사진첩 (couple_photos + Storage) ---------- */

export type Photo = {
  id: string;
  path: string;
  thumbPath: string | null;
  url: string; // 원본(대표/상세)
  thumbUrl: string; // 썸네일(그리드) — 없으면 url 폴백
  created_by: string;
  created_at: string;
};

const PHOTO_BUCKET = "couple-photos";
const _URL_TTL = 3600; // 서명 URL 유효(초)

// 서명 URL 캐시: realtime 갱신마다 전량 재서명→재다운로드하던 것을 방지.
// 같은 URL 을 재사용해야 브라우저 HTTP 캐시가 적중(재다운로드 X).
// ⭐ localStorage 영속화 — 앱 재실행/새로고침에도 TTL 내 같은 URL 재사용
//   → 사진·영상이 네트워크 없이 브라우저 캐시에서 '즉시' 뜬다(체감 속도 핵심).
const _URL_CACHE_LS = "ourdays:signedurls:v1";
const _urlCache = new Map<string, UrlEntry>();
if (typeof window !== "undefined") {
  try {
    for (const [k, v] of parseStoredUrlEntries(
      localStorage.getItem(_URL_CACHE_LS),
      Date.now(),
    ))
      _urlCache.set(k, v);
  } catch {
    /* noop */
  }
}
/** 로그아웃/계정전환 시 호출 — 공용 기기에서 커플 사진·비공개 일기·브이로그 서명URL 잔존 방지. */
export function clearSignedUrlCache(): void {
  _urlCache.clear();
  try {
    localStorage.removeItem(_URL_CACHE_LS);
  } catch {
    /* noop */
  }
}

/** 죽은/만료 의심 URL 무효화 — 미디어 onError 복구 경로가 캐시 히트로 무력화되는 것 방지. */
export function evictSignedUrls(paths: (string | null | undefined)[]): void {
  let changed = false;
  for (const p of paths) {
    if (p && _urlCache.delete(p)) changed = true;
  }
  if (changed) _persistUrlCache();
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function _persistUrlCache() {
  if (typeof window === "undefined") return;
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      // 만료 제거 + 최근 300개만(스토리지 폭주 방지)
      const entries = persistableUrlEntries([..._urlCache.entries()], Date.now());
      localStorage.setItem(_URL_CACHE_LS, JSON.stringify(entries));
    } catch {
      /* noop */
    }
  }, 500);
}

/** 여러 경로를 한 번에 서명(캐시 우선). 유효 잔여 60초 미만이면 재서명. */
async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sb = getSupabase();
  const now = Date.now();
  // 만료 항목 정리(무한 증가 방지) — 장시간 켜둔 PWA 메모리 누수 차단.
  for (const [k, v] of _urlCache) if (v.exp <= now) _urlCache.delete(k);
  const need: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const c = _urlCache.get(p);
    if (isFreshUrlEntry(c, now)) out[p] = c.url;
    else need.push(p);
  }
  if (need.length && sb) {
    // 서명 실패는 silent 빈 셀로 이어지므로 1회 재시도 (transient 회복)
    let { data, error } = await sb.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(need, _URL_TTL);
    if (error || !data) {
      ({ data, error } = await sb.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(need, _URL_TTL));
    }
    (data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) {
        out[s.path] = s.signedUrl;
        _urlCache.set(s.path, { url: s.signedUrl, exp: now + _URL_TTL * 1000 });
      }
    });
    _persistUrlCache();
  }
  return out;
}

/** 사진 업로드: 원본(1600) + 썸네일(480) 두 렌디션을 WebP 로 저장 → 그리드는 썸네일. */
export async function uploadPhoto(coupleId: string, file: File): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const [full, thumb] = await Promise.all([
    renderImage(file, 1600, 0.82),
    renderImage(file, 480, 0.7),
  ]);
  const extOf = (f: File) =>
    (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const stamp = `${new Date().getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${coupleId}/${stamp}.${extOf(full)}`;
  const thumbPath = `${coupleId}/${stamp}.thumb.${extOf(thumb)}`;
  const { error: upErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, full, { upsert: false, contentType: full.type || undefined });
  if (upErr) throw new Error("업로드 실패: " + upErr.message);
  // 썸네일 실패는 치명적이지 않음(그리드가 원본으로 폴백) — best-effort
  const { error: thErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(thumbPath, thumb, { upsert: false, contentType: thumb.type || undefined });
  const { error: metaErr } = await sb
    .from("couple_photos")
    .insert({
      couple_id: coupleId,
      storage_path: path,
      thumb_path: thErr ? null : thumbPath,
    });
  if (metaErr) throw new Error("사진 저장 실패: " + metaErr.message);
}

/** 커플 사진 목록 (서명 URL 캐시, 최신순). 그리드용 thumbUrl 포함. */
export async function listPhotos(coupleId: string): Promise<Photo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_photos")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as {
    id: string;
    storage_path: string;
    thumb_path: string | null;
    created_by: string;
    created_at: string;
  }[];
  const allPaths = rows.flatMap((r) => [r.storage_path, r.thumb_path ?? ""]);
  const urls = await signPaths(allPaths);
  return rows.map((r) => ({
    id: r.id,
    path: r.storage_path,
    thumbPath: r.thumb_path,
    url: urls[r.storage_path] ?? "",
    thumbUrl:
      (r.thumb_path && urls[r.thumb_path]) || urls[r.storage_path] || "",
    created_by: r.created_by,
    created_at: r.created_at,
  }));
}

/** 사진 삭제 (메타 먼저 → Storage best-effort — 부분실패가 '깨진 참조' 방향이 안 되게). */
export async function deletePhoto(
  id: string,
  path: string,
  thumbPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_photos").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  const paths = [path, ...(thumbPath ? [thumbPath] : [])];
  sb.storage
    .from(PHOTO_BUCKET)
    .remove(paths)
    .then(() => paths.forEach((p) => _urlCache.delete(p)))
    .catch(() => {});
}

/** 단일 경로의 서명 URL (배경/상단 이미지용, 캐시). */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const urls = await signPaths([path]);
  return urls[path] ?? null;
}

/** 사진첩 실시간 구독. */
export function subscribePhotos(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`photos:${coupleId}`))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "couple_photos",
        filter: `couple_id=eq.${coupleId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 대표 사진 (커플 공유 cover_path) ---------- */

export async function getCoupleCover(coupleId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("couples")
    .select("cover_path")
    .eq("id", coupleId)
    .single();
  return (data as { cover_path: string | null } | null)?.cover_path ?? null;
}

export async function updateCoupleCover(
  coupleId: string,
  path: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couples")
    .update({ cover_path: path })
    .eq("id", coupleId);
  if (error) throw new Error(humanError(error.message));
}

/** couples 행 변경(대표사진 등) 실시간 구독. */
export function subscribeCouple(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`couple:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "couples", filter: `id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 무드 체크인 ---------- */

export type Mood = { user_id: string; emoji: string; note: string | null; updated_at: string };

export async function getMoods(coupleId: string): Promise<Mood[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("mood_checkins")
    .select("user_id,emoji,note,updated_at")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Mood[];
}

export async function setMyMood(
  coupleId: string,
  emoji: string,
  note: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // 스키마에 unique(couple_id,user_id) 필요 — 없으면 upsert 가 조용히 insert 로 격하돼 'duplicate key' 로 실패
  const { error } = await sb
    .from("mood_checkins")
    .upsert(
      { couple_id: coupleId, user_id: uid, emoji, note: note || null, updated_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id" },
    );
  if (error) throw new Error(humanError(error.message));
}

export function subscribeMoods(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`moods:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "mood_checkins", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 오늘의 질문 ---------- */

export type Answer = { question_id: string; user_id: string; body: string; created_at: string };

/** 해당 질문의 답 목록. RLS 상 '내 답이 있어야' 상대 답이 보인다. */
export async function getAnswers(
  coupleId: string,
  questionId: string,
): Promise<Answer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("qa_answers")
    .select("question_id,user_id,body,created_at")
    .eq("couple_id", coupleId)
    .eq("question_id", questionId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Answer[];
}

/** 커플의 모든 답변(RLS: 내 답 + 내가 답한 질문의 상대 답). 보관함용. */
export async function listAllAnswers(coupleId: string): Promise<Answer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("qa_answers")
    .select("question_id,user_id,body,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Answer[];
}

export async function submitAnswer(
  coupleId: string,
  questionId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // 스키마에 unique(couple_id,question_id,user_id) 필요 — 없으면 upsert 가 insert 로 격하됨
  const { error } = await sb
    .from("qa_answers")
    .upsert(
      { couple_id: coupleId, question_id: questionId, user_id: uid, body },
      { onConflict: "couple_id,question_id,user_id" },
    );
  if (error) throw new Error(humanError(error.message));
}

export function subscribeAnswers(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`qa:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "qa_answers", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 서로 알기 퀴즈 (quiz_responses) ---------- */

export type QuizResponse = {
  question_id: string;
  user_id: string;
  self_choice: "a" | "b";
  guess_choice: "a" | "b";
};

/** 커플의 퀴즈 응답 (RLS: 내 것 + 내가 답한 문제의 상대 것만 — 스포 방지). */
export async function listQuizResponses(coupleId: string): Promise<QuizResponse[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("quiz_responses")
    .select("question_id,user_id,self_choice,guess_choice")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as QuizResponse[];
}

/** 퀴즈 응답 제출 (문제당 1회 — 이미 답했으면 무시). */
export async function submitQuiz(
  coupleId: string,
  questionId: string,
  self: "a" | "b",
  guess: "a" | "b",
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb.from("quiz_responses").insert({
    couple_id: coupleId,
    question_id: questionId,
    self_choice: self,
    guess_choice: guess,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(humanError(error.message));
}

export function subscribeQuiz(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`quiz:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "quiz_responses", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 데코북 (꾸민 일기) ---------- */

export type DecoSticker = { emoji: string };
export type DecoEntry = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  location: string | null;
  mood_emoji: string | null;
  bg: string | null;
  hashtags: string[];
  stickers: DecoSticker[];
  photo_paths: string[];
  photo_urls: string[];
  visibility: string; // 'shared' | 'private'(나만 보기 — RLS 로 작성자만 조회)
  created_by: string;
  created_at: string;
};

export type DecoInput = {
  entry_date: string;
  title: string;
  body: string;
  location: string;
  mood_emoji: string;
  bg: string;
  hashtags: string[];
  stickers: DecoSticker[];
  visibility: "shared" | "private";
};

export async function listDecoEntries(coupleId: string): Promise<DecoEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("deco_entries")
    .select("*")
    .eq("couple_id", coupleId)
    // 같은 일기날짜(둘이 같은 날 씀) 안에선 '작성 시각' 역순 — 2차 정렬이 없으면
    // DB 임의 순서라 늦게 쓴 글이 작성자에 따라 아래로 깔리는 문제(2026-07-02 리포트)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as (Omit<DecoEntry, "photo_urls"> & { photo_paths: string[] })[];
  const allPaths = rows.flatMap((r) => r.photo_paths ?? []);
  const urls = await signPaths(allPaths); // 서명 URL 캐시 재사용
  return rows.map((r) => ({
    ...r,
    hashtags: r.hashtags ?? [],
    stickers: (r.stickers ?? []) as DecoSticker[],
    photo_paths: r.photo_paths ?? [],
    photo_urls: (r.photo_paths ?? []).map((p) => urls[p] ?? "").filter(Boolean),
  }));
}

export async function addDecoEntry(
  coupleId: string,
  input: DecoInput,
  files: File[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const paths: string[] = [];
  for (const raw of files.slice(0, 2)) {
    const f = await resizeImage(raw); // 축소·압축
    const ext =
      (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const p = `${coupleId}/deco-${new Date().getTime()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(p, f, { contentType: f.type || undefined });
    if (upErr) throw new Error("사진 업로드 실패: " + upErr.message);
    paths.push(p);
  }
  const { error } = await sb.from("deco_entries").insert({
    couple_id: coupleId,
    entry_date: input.entry_date,
    title: input.title || null,
    body: input.body || null,
    location: input.location || null,
    mood_emoji: input.mood_emoji || null,
    bg: input.bg || null,
    hashtags: input.hashtags,
    stickers: input.stickers,
    photo_paths: paths,
    visibility: input.visibility,
  });
  if (error) {
    // DB insert 실패 시 방금 올린 사진은 고아 파일 → best-effort 정리(deletePhoto 등과 동일 룰)
    if (paths.length) sb.storage.from(PHOTO_BUCKET).remove(paths).catch(() => {});
    throw new Error(humanError(error.message));
  }
}

export async function deleteDecoEntry(
  id: string,
  photoPaths: string[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // DB-first: Storage 먼저 지우면 DB delete 실패 시 '사진 깨진 일기 row' 가 남는다.
  // (deletePhoto/deleteCoupleLog 와 동일 룰 — 고아 storage 파일이 깨진 row 보다 낫다.)
  const { error } = await sb.from("deco_entries").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  if (photoPaths.length) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove(photoPaths)
      .then(() => photoPaths.forEach((p) => _urlCache.delete(p)))
      .catch(() => {}); // best-effort — 실패해도 row 는 이미 삭제됨
  }
}

/** 캘린더 표시용 경량 일기 마커 (사진 서명 없음 — 날짜/제목/기분/작성자만).
 *  RLS 가 비밀일기(private)를 작성자에게만 반환하므로 캘린더에도 새지 않음. */
export type DiaryMark = {
  id: string;
  entry_date: string;
  title: string | null;
  mood_emoji: string | null;
  created_by: string;
};

export async function listDiaryMarks(coupleId: string): Promise<DiaryMark[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("deco_entries")
    .select("id,entry_date,title,mood_emoji,created_by")
    .eq("couple_id", coupleId)
    .order("entry_date");
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as DiaryMark[];
}

export function subscribeDeco(
  coupleId: string,
  onChange: () => void,
  key = "deco", // 같은 테이블을 두 곳(일기장 탭/캘린더)에서 구독할 때 채널명 충돌 방지
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`${key}:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deco_entries", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 커플 버킷리스트 (couple_bucket) ---------- */

export type Bucket = {
  id: string;
  title: string;
  category: string;
  done: boolean;
  done_at: string | null;
  created_by: string;
  created_at: string;
};

/** 버킷 목록 (최신순). */
export async function listBucket(coupleId: string): Promise<Bucket[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_bucket")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Bucket[];
}

/** 버킷 항목 추가. */
export async function addBucket(
  coupleId: string,
  title: string,
  category: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("couple_bucket")
    .insert({ couple_id: coupleId, title, category });
  if (error) throw new Error(humanError(error.message));
}

/** 완료/미완료 토글. */
export async function setBucketDone(id: string, done: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("couple_bucket")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 버킷 항목 삭제. */
export async function deleteBucket(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_bucket").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 버킷 실시간 구독 (추가/완료/삭제 시 콜백). */
export function subscribeBucket(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`bucket:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "couple_bucket", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 일기 반응(이모지) + 댓글 ---------- */

export type Reaction = {
  id: string;
  entry_id: string;
  emoji: string;
  created_by: string;
};
export type Comment = {
  id: string;
  entry_id: string;
  body: string;
  created_by: string;
  created_at: string;
};

/** 커플의 모든 일기 반응 (엔트리별 그룹은 클라에서). */
export async function listReactions(coupleId: string): Promise<Reaction[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("entry_reactions")
    .select("id,entry_id,emoji,created_by")
    .eq("couple_id", coupleId);
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Reaction[];
}

/** 커플의 모든 일기 댓글 (오래된 순). */
export async function listComments(coupleId: string): Promise<Comment[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("entry_comments")
    .select("id,entry_id,body,created_by,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Comment[];
}

export async function addReaction(
  coupleId: string,
  entryId: string,
  emoji: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("entry_reactions")
    .insert({ couple_id: coupleId, entry_id: entryId, emoji });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(humanError(error.message));
}

export async function removeReaction(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("entry_reactions").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

export async function addComment(
  coupleId: string,
  entryId: string,
  body: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb
    .from("entry_comments")
    .insert({ couple_id: coupleId, entry_id: entryId, body });
  if (error) throw new Error(humanError(error.message));
}

export async function deleteComment(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("entry_comments").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}

/** 반응·댓글 실시간 구독(두 테이블). 반환값 호출로 해제. */
export function subscribeEntryInteractions(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const ch = sb
    .channel(_chanName(`entry-interactions:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "entry_reactions", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "entry_comments", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

/* ---------- 오늘의 로그 (couple_logs — 오전/오후 2슬롯) ---------- */

export type CoupleLog = {
  id: string;
  log_date: string; // YYYY-MM-DD
  slot: "am" | "pm";
  body: string | null;
  emoji: string | null;
  video_path: string | null; // 3초 브이로그 (Storage)
  videoUrl: string; // 서명 URL(없으면 "")
  created_by: string;
  created_at: string;
};

/** 최근 로그(sinceIso 이후, 날짜 내림차순) — 영상 서명 URL 포함(캐시 재사용). */
export async function listCoupleLogs(
  coupleId: string,
  sinceIso: string,
): Promise<CoupleLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_logs")
    .select("id,log_date,slot,body,emoji,video_path,created_by,created_at")
    .eq("couple_id", coupleId)
    .gte("log_date", sinceIso)
    .order("log_date", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  const rows = (data ?? []) as Omit<CoupleLog, "videoUrl">[];
  const urls = await signPaths(rows.map((r) => r.video_path ?? ""));
  return rows.map((r) => ({
    ...r,
    videoUrl: (r.video_path && urls[r.video_path]) || "",
  }));
}

/** 3초 영상 업로드 → storage 경로 반환. */
export async function uploadLogVideo(
  coupleId: string,
  blob: Blob,
  ext: "mp4" | "webm",
): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const path = `${coupleId}/log-${new Date().getTime()}-${Math.random()
    .toString(36)
    .slice(2, 7)}.${ext}`;
  // contentType 은 ';codecs=...' 를 떼고 base MIME 만 — 버킷 allowed_mime_types 매칭 안전
  const contentType = (blob.type || `video/${ext}`).split(";")[0].trim();
  const { error } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType });
  if (error) throw new Error("영상 업로드 실패: " + error.message);
  return path;
}

/** 슬롯 로그 작성/수정 — 슬롯당 1개(unique) 라 upsert. 기존 영상 교체 시 옛 파일 정리. */
export async function upsertCoupleLog(
  coupleId: string,
  dateIso: string,
  slot: "am" | "pm",
  body: string,
  emoji: string | null,
  videoPath: string | null,
  prevVideoPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  // 스키마에 unique(couple_id,created_by,log_date,slot) 필요 — 없으면 upsert 가 insert 로 격하됨
  const { error } = await sb.from("couple_logs").upsert(
    {
      couple_id: coupleId,
      created_by: uid,
      log_date: dateIso,
      slot,
      body: body || null,
      emoji,
      video_path: videoPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "couple_id,created_by,log_date,slot" },
  );
  if (error) throw new Error(humanError(error.message));
  // 영상 교체/제거 시 옛 파일은 best-effort 정리(용량 관리)
  if (prevVideoPath && prevVideoPath !== videoPath) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove([prevVideoPath])
      .then(() => _urlCache.delete(prevVideoPath))
      .catch(() => {});
  }
}

export async function deleteCoupleLog(
  id: string,
  videoPath?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // DB 행 먼저(실패 시 파일 보존 — '행은 있는데 영상 깨짐' 방지). 파일은 best-effort.
  const { error } = await sb.from("couple_logs").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
  if (videoPath) {
    sb.storage
      .from(PHOTO_BUCKET)
      .remove([videoPath])
      .then(() => _urlCache.delete(videoPath))
      .catch(() => {});
  }
}

export function subscribeCoupleLogs(
  coupleId: string,
  onChange: () => void,
  // ⚠ 채널명은 구독자마다 달라야 한다 — 같은 이름의 채널에 두 번째 .on() 을 붙이면
  // "cannot add postgres_changes callbacks after subscribe()" 런타임 크래시.
  // keep-mounted 로 홈(TodayLogCard)과 로그 탭(TodayLog)이 동시 마운트되므로
  // 두 번째 구독자는 반드시 다른 key 를 넘길 것 (subscribeDeco 의 "deco-cal" 과 동일 패턴).
  key = "clogs",
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(_chanName(`${key}:${coupleId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "couple_logs", filter: `couple_id=eq.${coupleId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/* ---------- 홈 '우리 현황' (스트릭 + 이번 주) 통합 조회 ---------- */

export type WeekStats = { diaries: number; vlogs: number; photos: number; answers: number };

/** 홈 우리 현황 1회 조회 — deco/logs 를 90일치 한 번만 읽어 스트릭(활동일)과 주간 개수를
 *  모두 산출한다. deco/logs 중복 조회 제거(스트릭 2 + 주간 4 = 6쿼리 → 4쿼리).
 *  photos/qa 는 주간 count 만 필요. 실패는 조용히(홈을 막지 않음). */
export async function homeActivity(
  coupleId: string,
  since90Iso: string,
  since7Iso: string,
): Promise<{ activeDays: string[]; week: WeekStats }> {
  const sb = getSupabase();
  const empty = {
    activeDays: [] as string[],
    week: { diaries: 0, vlogs: 0, photos: 0, answers: 0 },
  };
  if (!sb) return empty;
  const since7Ts = `${since7Iso}T00:00:00Z`;
  const head = { count: "exact" as const, head: true };
  const [deco, logs, photos, qa] = await Promise.all([
    sb.from("deco_entries").select("entry_date").eq("couple_id", coupleId).gte("entry_date", since90Iso),
    sb.from("couple_logs").select("log_date").eq("couple_id", coupleId).gte("log_date", since90Iso),
    sb.from("couple_photos").select("id", head).eq("couple_id", coupleId).gte("created_at", since7Ts),
    sb.from("qa_answers").select("question_id", head).eq("couple_id", coupleId).gte("created_at", since7Ts),
  ]);
  const decoRows = (deco.data ?? []) as { entry_date: string }[];
  const logRows = (logs.data ?? []) as { log_date: string }[];
  const days = new Set<string>();
  for (const r of decoRows) days.add(r.entry_date);
  for (const r of logRows) days.add(r.log_date);
  return {
    activeDays: [...days],
    week: {
      // ISO 'YYYY-MM-DD' 는 사전식 비교로 날짜 비교 성립
      diaries: decoRows.filter((r) => r.entry_date >= since7Iso).length,
      vlogs: logRows.filter((r) => r.log_date >= since7Iso).length,
      photos: photos.count ?? 0,
      answers: qa.count ?? 0,
    },
  };
}

/* ---------- 미래에 열어보는 편지 (letters) ---------- */

export type Letter = {
  id: string;
  from_user: string;
  title: string | null;
  body: string;
  open_at: string;
  created_at: string;
};

/** 볼 수 있는 편지(내가 쓴 것 전부 + 받은 것 중 open_at 지난 것). RLS 가 시간게이트. */
export async function listLetters(coupleId: string): Promise<Letter[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("letters")
    .select("id,from_user,title,body,open_at,created_at")
    .eq("couple_id", coupleId)
    .order("open_at", { ascending: false });
  if (error) throw new Error(humanError(error.message));
  return (data ?? []) as Letter[];
}

/** 편지 보내기. openAt(ISO) 미지정이면 즉시 공개. */
export async function sendLetter(
  coupleId: string,
  body: string,
  title?: string,
  openAt?: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const row: Record<string, unknown> = { couple_id: coupleId, body };
  if (title) row.title = title;
  if (openAt) row.open_at = openAt;
  const { error } = await sb.from("letters").insert(row);
  if (error) throw new Error(humanError(error.message));
}

export async function deleteLetter(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("letters").delete().eq("id", id);
  if (error) throw new Error(humanError(error.message));
}
