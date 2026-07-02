// 조용시간 판정 — Edge Function(send-poke-push)의 서버측 게이트와 동일 로직의 미러.
// Deno(Edge)에서 이 파일을 import 할 수 없어 함수 본문을 복사해 쓰므로,
// 여기를 고치면 supabase/functions/send-poke-push/index.ts 도 함께 갱신할 것.
export function inQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null || start === end) return false;
  // wrap-around: 23~08 처럼 자정을 넘는 범위 지원
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
