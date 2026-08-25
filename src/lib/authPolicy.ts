/** 인증 폼의 입력 정책. Supabase 호출 전에 사용자에게 구체적인 원인을 알려준다. */
export const NEW_PASSWORD_MIN_LENGTH = 8;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailValidationMessage(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) return "이메일을 입력해 주세요.";
  // 완전한 RFC 파서는 브라우저/Supabase가 담당하고, 여기서는 흔한 오타만 빠르게 막는다.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "이메일 형식을 확인해 주세요.";
  return null;
}

export function newPasswordValidationMessage(value: string): string | null {
  if (value.length < NEW_PASSWORD_MIN_LENGTH)
    return `비밀번호는 ${NEW_PASSWORD_MIN_LENGTH}자 이상이어야 해요.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value))
    return "비밀번호에 영문과 숫자를 각각 1개 이상 넣어 주세요.";
  return null;
}

export function passwordResetRedirect(origin: string, basePath: string): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  const cleanBase = basePath ? `/${basePath.replace(/^\/+|\/+$/g, "")}` : "";
  return `${cleanOrigin}${cleanBase}/reset-password/`;
}
