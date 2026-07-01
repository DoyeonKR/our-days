// Supabase Auth 의 영문 에러 메시지를 사용자용 한국어로 매핑 (순수 함수 — 테스트 용이).
// auth.ts 가 supabase 클라이언트를 import 하므로, 매핑만 여기 분리해 node:test 로 검증한다.

/** 영문(또는 임의) 에러 메시지 → 사용자 친화 한국어. 매칭 안 되면 일반 안내. */
export function authErrorMessage(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already")
  )
    return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (m.includes("email") && (m.includes("invalid") || m.includes("unable to validate")))
    return "이메일 형식이 올바르지 않아요.";
  if (m.includes("password") && (m.includes("6") || m.includes("short") || m.includes("weak") || m.includes("at least")))
    return "비밀번호는 6자 이상이어야 해요.";
  if (m.includes("same") && m.includes("password"))
    return "새 비밀번호가 기존과 같아요.";
  if (m.includes("email not confirmed"))
    return "이메일 인증이 필요해요. 메일함을 확인해 주세요.";
  if (
    m.includes("for security purposes") ||
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("request this after")
  )
    return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed"))
    return "네트워크 연결을 확인해 주세요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}
