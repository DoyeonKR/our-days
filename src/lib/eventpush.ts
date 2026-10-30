// 새 일정 푸시 본문 — 순수 함수(node --test 가 바로 읽게 별도 파일). [2026-10-30 "일정 추가한것도 알람이 가게 해줘 푸쉬 알람"]
/** "☕ 커피 · 11월 3일 · 매달" — 이모지 · 제목 · 날짜 · 반복. */
export function eventPushMessage(ev: { title: string; date: string; emoji?: string; recurrence?: string; repeatYearly?: boolean; time?: string }): string {
  const [, m, d] = ev.date.split("-").map(Number);
  const at = ev.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(ev.time) ? ev.time : "";
  const when = (m && d ? `${m}월 ${d}일` : ev.date) + (at ? ` ${at}` : "");
  const rep = ev.recurrence === "monthly" ? " · 매달" : ev.recurrence === "yearly" || ev.repeatYearly ? " · 매년" : "";
  const title = ev.title.trim() || "새 일정";
  return `${ev.emoji ? ev.emoji + " " : ""}${title} · ${when}${rep}`;
}
