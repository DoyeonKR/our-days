/* 오늘의 질문 — 자정을 넘긴 초안 규칙(순수). DailyQuestion 이 쓰고 questiondraft.test 가 잰다.
 *
 * [2026-11-11 리뷰] KST 자정 전에 쓰기 시작한 답은 시작한 질문(draftQid)에 저장되는데, 화면은 **오늘 질문 글** 아래에
 * 그 답을 보여 줬다 — 오늘 질문에 답한 줄 알았는데 어제 질문에 들어갔다. 다시 열면 어제 키의 초안은 말없이 지워졌다.
 * 이제: 질문이 다르면 그 초안의 질문 글을 '어제 질문'으로 보여 주고, 오늘 질문으로 옮길 수 있다.
 * 어제 질문에 그대로 내는 건 자정 뒤 몇 시간(QUESTION_GRACE_MS)까지만 — 그 뒤엔 옮기거나 지운다. */
import { kstDate } from "./kst.ts";

/** 자정을 넘긴 뒤에도 어제 질문에 답을 낼 수 있는 시간. 새벽 3시(KST)까지. */
export const QUESTION_GRACE_MS = 3 * 3_600_000;

const dateOf = (id: string): string | null => /@(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1] ?? null;

/** 초안이 어느 질문 것인가 — 'today'(지금 질문) · 'grace'(어제 질문, 아직 낼 수 있음) · 'expired'(옮기거나 지워야 함). */
export function questionDraftState(draftQid: string | null, todayQid: string, now: number): "today" | "grace" | "expired" {
  if (!draftQid || draftQid === todayQid) return "today";
  const d = dateOf(draftQid);
  // 옛 id(날짜 없음)는 언제 질문인지 모른다 — 내지 않고 옮기게 한다
  if (!d) return "expired";
  return kstDate(now - QUESTION_GRACE_MS) <= d ? "grace" : "expired";
}

export type QuestionDraft = { body: string; questionId: string; offered?: boolean };

/** 지금 질문이 아닌 초안 키들 중 **한 번 보여 줄** 것 하나와 지울 키들을 고른다.
 *  예전엔 오늘 키가 아니면 전부 지웠다(쓰던 답이 말없이 사라졌다). 이제 글이 있고 아직 안 보여 준 가장 최근 것 하나는
 *  화면에 되살리고(그때 offered 표시), 이미 보여 준 것 · 빈 것 · 더 오래된 것은 지운다. */
export function pickStaleQuestionDraft(
  entries: readonly { key: string; value: QuestionDraft | null }[],
): { offer: { key: string; value: QuestionDraft } | null; remove: string[] } {
  const live = entries.filter((e): e is { key: string; value: QuestionDraft } => !!e.value?.body?.trim() && !e.value.offered && !!e.value.questionId);
  live.sort((a, b) => (dateOf(b.value.questionId) ?? "").localeCompare(dateOf(a.value.questionId) ?? ""));
  const offer = live[0] ?? null;
  return { offer, remove: entries.map((e) => e.key).filter((k) => k !== offer?.key) };
}
