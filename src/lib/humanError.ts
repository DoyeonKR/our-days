// Supabase/네트워크 원문 오류(영문)를 사용자용 한국어로 변환.
// 데이터 레이어 전반(couple.ts)의 throw 에서 사용 — 영어 원문이 화면에 그대로
// 노출되던 문제 해소. 매핑에 없는 메시지는 원문을 괄호로 보존(진단 가능성 유지).
const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|network request failed/i, "네트워크 연결을 확인해 주세요."],
  [/jwt expired|invalid jwt|token is expired|refresh token/i, "로그인이 만료됐어요. 앱을 새로고침해 주세요."],
  [/row-level security|permission denied|not authorized/i, "권한이 없어요. 다시 로그인해 주세요."],
  [/duplicate key|already exists|unique constraint/i, "이미 등록돼 있어요."],
  [/payload too large|exceeded the maximum allowed size|too large/i, "파일이 너무 커요. 조금 줄여서 다시 시도해 주세요."],
  [/timeout|timed out/i, "응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요."],
  [/rate limit|too many requests/i, "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요."],
];

export function humanError(raw: string | null | undefined): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
  // 이미 한국어 메시지면 그대로 (이중 래핑 방지)
  if (/[가-힣]/.test(msg)) return msg;
  for (const [re, ko] of RULES) if (re.test(msg)) return ko;
  return `문제가 생겼어요. 잠시 후 다시 시도해 주세요. (${msg.slice(0, 80)})`;
}
