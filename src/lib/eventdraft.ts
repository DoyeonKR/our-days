/* '새 일정' 시트의 id 규칙(2026-11-11 2차) — 화면(page.tsx AddEvent)과 데이터 계층(couple.addCoupleEvent)이 같이 쓴다.
 *
 * 새 일정의 id 는 시트를 열 때 한 번 만들어 초안에도 적는다(응답을 잃고 다시 열어 저장해도 서버가 한 줄로 본다 — §10.24).
 * 그 대가: 초안의 id 가 이미 저장된 일정의 것일 수 있다(첫 저장은 들어갔고 응답만 잃었다). 그 초안을 다른 일정으로 고쳐 저장하면
 * 예전엔 첫 일정을 덮었다(목록에 있으면 updated_at 없이 update, 서버에서 만나면 23505 뒤 update).
 *  · 시트를 열 때(restoreNewEventDraft) — 목록에 그 id 가 있으면: 내용이 같으면 이미 저장된 것(초안을 버린다), 다르면 새 id.
 *  · 서버에서 만났을 때(dupKeyDecision) — 같은 내용이면 성공, **이 시트가 보낸 내용 그대로인 행**일 때만 덮고, 그 밖엔 거절(새 id 로).
 * node --test 가 읽는다 — 다른 모듈은 상대 경로로만. */
import { eventContentMatches, type CoupleEvent } from "./dday.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 되살린 '새 일정' 초안 — keep: 그 id 로 이어 저장 · saved: 이미 저장된 일정(초안을 버린다) · fresh: 내용은 두고 새 id */
export function restoreNewEventDraft(draft: CoupleEvent, known: readonly CoupleEvent[]): "keep" | "saved" | "fresh" {
  if (!UUID.test(draft.id)) return "keep";
  const id = draft.id.toLowerCase();
  const hit = known.find((e) => e.id.toLowerCase() === id);
  if (!hit) return "keep";
  return eventContentMatches(hit, { ...draft, title: draft.title.trim() }) ? "saved" : "fresh";
}

/** 새 일정 저장이 같은 id 의 행을 만났다(23505).
 *  same — 같은 내용(응답만 잃은 재시도) · update — 이 시트가 앞서 보낸 내용 그대로인 행(같은 시트에서 고쳐 다시 눌렀다) · taken — 그 밖 */
export function dupKeyDecision(existing: CoupleEvent, sent: CoupleEvent, sentBefore: readonly CoupleEvent[]): "same" | "update" | "taken" {
  if (eventContentMatches(existing, sent)) return "same";
  if (sentBefore.some((p) => p.id.toLowerCase() === existing.id.toLowerCase() && eventContentMatches(existing, p))) return "update";
  return "taken";
}
