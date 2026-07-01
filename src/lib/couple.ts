// 커플 연동 + 쿡찌르기 데이터 계층 (Supabase).
// 인증은 익명 로그인(anonymous sign-in) — 이메일/비번 없이 기기별 지속 신원.
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CoupleEvent } from "@/lib/dday";

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

/** 쿡찌르기 프리셋. custom 은 사용자가 문구를 직접 입력. */
export const POKE_KINDS: {
  kind: string;
  emoji: string;
  label: string;
  message: string;
}[] = [
  { kind: "poke", emoji: "👉", label: "콕 찌르기", message: "콕! 나 여기 있어" },
  { kind: "miss", emoji: "🥺", label: "보고싶어", message: "지금 너무 보고싶어" },
  { kind: "meal", emoji: "🍚", label: "밥 먹었어?", message: "밥 먹었어? 꼭 챙겨 먹어" },
  { kind: "love", emoji: "❤️", label: "사랑해", message: "사랑해 💗" },
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

/** 내가 속한 커플 + 구성원. 없으면 null. */
export async function getMyCouple(): Promise<CoupleState | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await ensureAnonAuth();
  if (!uid) return null;

  const { data: mine, error: mErr } = await sb
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!mine) return null;

  const { data: couple, error: cErr } = await sb
    .from("couples")
    .select("*")
    .eq("id", mine.couple_id)
    .single();
  if (cErr) throw new Error(cErr.message);

  const { data: members, error: memErr } = await sb
    .from("couple_members")
    .select("*")
    .eq("couple_id", mine.couple_id);
  if (memErr) throw new Error(memErr.message);

  return { couple: couple as Couple, members: (members ?? []) as Member[] };
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
    .channel(`pokes:${coupleId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pokes",
        filter: `couple_id=eq.${coupleId}`,
      },
      (payload) => onInsert(payload.new as Poke),
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
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToEvent(r as EventRow));
}

/** 커플 공유 기념일 추가. */
export async function addCoupleEvent(
  coupleId: string,
  ev: { title: string; date: string; repeatYearly: boolean; emoji?: string },
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
  });
  if (error) throw new Error(error.message);
}

/** 커플 공유 기념일 삭제. */
export async function deleteCoupleEvent(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("couple_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** 공유 기념일 실시간 구독 (추가/삭제 시 콜백). 반환값 호출로 해제. */
export function subscribeCoupleEvents(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`events:${coupleId}`)
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
  url: string;
  created_by: string;
  created_at: string;
};

const PHOTO_BUCKET = "couple-photos";

/** 사진 업로드 (Storage {coupleId}/파일 + 메타 insert). */
export async function uploadPhoto(coupleId: string, file: File): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const uid = await ensureAnonAuth();
  if (!uid) throw new Error("로그인이 필요해요.");
  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${coupleId}/${new Date().getTime()}-${rand}.${ext}`;
  const { error: upErr } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) throw new Error("업로드 실패: " + upErr.message);
  const { error: metaErr } = await sb
    .from("couple_photos")
    .insert({ couple_id: coupleId, storage_path: path });
  if (metaErr) throw new Error("사진 저장 실패: " + metaErr.message);
}

/** 커플 사진 목록 (서명 URL 포함, 최신순). */
export async function listPhotos(coupleId: string): Promise<Photo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("couple_photos")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    storage_path: string;
    created_by: string;
    created_at: string;
  }[];
  const urls: Record<string, string> = {};
  const paths = rows.map((r) => r.storage_path);
  if (paths.length) {
    const { data: signed } = await sb.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    });
  }
  return rows.map((r) => ({
    id: r.id,
    path: r.storage_path,
    url: urls[r.storage_path] ?? "",
    created_by: r.created_by,
    created_at: r.created_at,
  }));
}

/** 사진 삭제 (Storage + 메타). */
export async function deletePhoto(id: string, path: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.storage.from(PHOTO_BUCKET).remove([path]);
  const { error } = await sb.from("couple_photos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** 단일 경로의 서명 URL (배경/상단 이미지용). */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !path) return null;
  const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** 사진첩 실시간 구독. */
export function subscribePhotos(
  coupleId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`photos:${coupleId}`)
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
  if (error) throw new Error(error.message);
}

/** couples 행 변경(대표사진 등) 실시간 구독. */
export function subscribeCouple(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`couple:${coupleId}`)
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
  if (error) throw new Error(error.message);
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
  const { error } = await sb
    .from("mood_checkins")
    .upsert(
      { couple_id: coupleId, user_id: uid, emoji, note: note || null, updated_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

export function subscribeMoods(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`moods:${coupleId}`)
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
  if (error) throw new Error(error.message);
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
  const { error } = await sb
    .from("qa_answers")
    .upsert(
      { couple_id: coupleId, question_id: questionId, user_id: uid, body },
      { onConflict: "couple_id,question_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

export function subscribeAnswers(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`qa:${coupleId}`)
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
};

export async function listDecoEntries(coupleId: string): Promise<DecoEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("deco_entries")
    .select("*")
    .eq("couple_id", coupleId)
    .order("entry_date", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (Omit<DecoEntry, "photo_urls"> & { photo_paths: string[] })[];
  const allPaths = rows.flatMap((r) => r.photo_paths ?? []);
  const urls: Record<string, string> = {};
  if (allPaths.length) {
    const { data: signed } = await sb.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(allPaths, 3600);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    });
  }
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
  for (const f of files.slice(0, 2)) {
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
  });
  if (error) throw new Error(error.message);
}

export async function deleteDecoEntry(
  id: string,
  photoPaths: string[],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (photoPaths.length) await sb.storage.from(PHOTO_BUCKET).remove(photoPaths);
  const { error } = await sb.from("deco_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function subscribeDeco(coupleId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`deco:${coupleId}`)
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
