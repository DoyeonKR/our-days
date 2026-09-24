// 이벤트 푸시 카테고리 + 수신자 설정(notify_prefs) 데이터 계층.
// 발송은 Edge(send-poke-push)가 수신자 설정·조용시간을 '서버측'에서 검사해 게이트한다.
import { getSupabase } from "@/lib/supabase";
import { pushUrlFor } from "@/lib/activity";
import type { ActivityEvent } from "@/lib/couple";

export type NotifyCategory =
  | "poke"
  | "log"
  | "diary"
  | "interact"
  | "bucket"
  | "moodq"
  | "remind"
  | "dday"
  | "question";

/* 2026-08-26 정리:
 * · 'letter'·'game' 토글 제거 — 발송처가 코드 전체에 0곳인 죽은 스위치였다(편지·대결 기능
 *   자체가 내려감). 저장된 prefs 값은 무해하게 남는다(아무도 안 읽음).
 * · 'dday'(기념일 알림) 추가 — 예전엔 기념일 D-day 푸시가 'remind'(오늘 남기기 알림) 키로
 *   게이트되어, 자기 리마인더만 끄려던 사용자가 주년 푸시까지 무통보로 잃었다. */
export const NOTIFY_CATEGORIES: { key: NotifyCategory; label: string; desc: string }[] = [
  { key: "poke", label: "쿡 찌르기", desc: "상대가 쿡 찌를 때" },
  { key: "log", label: "3초 브이로그", desc: "상대가 로그를 올릴 때" },
  { key: "diary", label: "일기", desc: "상대가 일기를 쓸 때" },
  { key: "interact", label: "반응·댓글", desc: "내 일기에 반응/댓글이 달릴 때" },
  { key: "bucket", label: "버킷리스트", desc: "버킷을 추가/이룰 때" },
  { key: "moodq", label: "기분·오늘의 질문", desc: "상대가 기분/답변을 남길 때" },
  { key: "remind", label: "오늘 남기기 알림", desc: "내가 로그/일기를 아직 안 남겼을 때" },
  { key: "dday", label: "기념일 알림", desc: "주년·기념일이 다가올 때(D-7/3/1/당일)" },
  // 2026-09-24 — 서버(daily-reminders)가 아침에 보낸다. 이미 답했으면 안 보낸다
  { key: "question", label: "아침 질문 알림", desc: "매일 아침, 오늘의 질문이 도착했다고" },
];

export type NotifyPrefs = {
  prefs: Partial<Record<NotifyCategory, boolean>>; // 저장은 '끈 것'만 false 로
  quiet_start: number | null; // KST 시(0~23) — 조용시간 시작
  quiet_end: number | null;
};

/** 내 알림 설정 (행 없으면 기본: 전부 on / 조용시간 없음). */
export async function getMyNotifyPrefs(): Promise<NotifyPrefs> {
  const sb = getSupabase();
  if (!sb) return { prefs: {}, quiet_start: null, quiet_end: null };
  const { data } = await sb
    .from("notify_prefs")
    .select("prefs, quiet_start, quiet_end")
    .maybeSingle();
  return {
    prefs: (data?.prefs ?? {}) as NotifyPrefs["prefs"],
    quiet_start: data?.quiet_start ?? null,
    quiet_end: data?.quiet_end ?? null,
  };
}

export async function saveMyNotifyPrefs(p: NotifyPrefs): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await sb.from("notify_prefs").upsert({
    user_id: uid,
    prefs: p.prefs,
    quiet_start: p.quiet_start,
    quiet_end: p.quiet_end,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** 알림을 누르면 갈 곳(활동 종류) — 카테고리의 기본값. 기분·질문(moodq)처럼 한 카테고리가 두 카드를
 *  가리키면 부르는 쪽이 go 를 직접 넘긴다(오늘의 질문 답 → "answer"). */
export const CATEGORY_GO: Partial<Record<NotifyCategory, ActivityEvent["kind"]>> = {
  poke: "poke",
  log: "log",
  diary: "diary",
  interact: "diary",
  bucket: "bucket",
  moodq: "mood",
};

/** 이벤트 푸시 발송(상대에게) — 실패는 조용히(핵심 흐름을 막지 않음).
 *  fire-and-forget 라 일시 네트워크 실패 시 조용히 누락되던 문제 → 1회 재시도(백오프)로 완화.
 *  go = 알림을 눌렀을 때 열 화면(활동 종류). 없으면 카테고리 기본값(CATEGORY_GO). */
export async function sendEventPush(
  coupleId: string,
  category: NotifyCategory,
  title: string,
  message: string,
  go?: ActivityEvent["kind"],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const target = go ?? CATEGORY_GO[category];
  const body = { couple_id: coupleId, category, title, message, ...(target ? { url: pushUrlFor(target) } : {}) };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await sb.functions.invoke("send-poke-push", { body });
      if (!error) return; // 발송 요청 성공
    } catch {
      /* 네트워크 오류 → 재시도 */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }
}
