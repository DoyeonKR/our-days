// '오늘의 로그' 오전/오후 2슬롯 규칙 (순수 — 테스트 용이).
// 오전 슬롯 = 00:00~11:59, 오후 슬롯 = 12:00~23:59 (⚠ KST 기준 — 서버 RLS 와 동일).
// 기기 로컬 시간이 아니라 Asia/Seoul 로 판정해 해외에서도 서버 거부와 어긋나지 않는다.

export type LogSlot = "am" | "pm";

/** d 를 KST 로 환산한 (YYYY-MM-DD, 시). */
function kstParts(d: Date): { iso: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // 일부 엔진의 24:00 표기 방어
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

export function slotOf(d: Date): LogSlot {
  return kstParts(d).hour < 12 ? "am" : "pm";
}

export function slotLabel(s: LogSlot): string {
  return s === "am" ? "오전" : "오후";
}

/** KST 날짜 ISO (couple_logs.log_date 용). */
export function logDateIso(d: Date): string {
  return kstParts(d).iso;
}

/**
 * 해당 날짜·슬롯이 지금 작성/수정 가능한가 — '그 시간대에 찍는' 리듬 유지:
 * 오늘(KST)의 현재 슬롯만 열려 있고, 지난 슬롯·지난 날짜·미래는 잠김.
 */
export function canWriteSlot(dateIso: string, slot: LogSlot, now: Date): boolean {
  return dateIso === logDateIso(now) && slotOf(now) === slot;
}
