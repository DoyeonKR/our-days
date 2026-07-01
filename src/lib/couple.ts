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
