// '오늘의 로그' 오전/오후 2슬롯 규칙 (순수 — 테스트 용이).
// 오전 슬롯 = 00:00~11:59, 오후 슬롯 = 12:00~23:59. 슬롯당 1개(DB unique 강제).

export type LogSlot = "am" | "pm";

export function slotOf(d: Date): LogSlot {
  return d.getHours() < 12 ? "am" : "pm";
}

export function slotLabel(s: LogSlot): string {
  return s === "am" ? "오전" : "오후";
}

/** 로컬 날짜 ISO (couple_logs.log_date 용). */
export function logDateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * 해당 날짜·슬롯이 지금 작성/수정 가능한가 — '그 시간대에 찍는' 리듬 유지:
 * 오늘의 현재 슬롯만 열려 있고, 지난 슬롯·지난 날짜·미래는 잠김.
 */
export function canWriteSlot(dateIso: string, slot: LogSlot, now: Date): boolean {
  return dateIso === logDateIso(now) && slotOf(now) === slot;
}
