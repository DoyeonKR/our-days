// 이동 가능한 계정(이메일+비번). 익명 계정을 이메일로 '저장'하면 uid 가 유지되어
// 다른 브라우저/기기에서 같은 이메일로 로그인하면 커플 연동이 그대로 따라온다.
import { getSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authError";

export type AuthInfo = { id: string; email: string | null; isAnonymous: boolean };

/** 현재 로그인 상태 (uid/이메일/익명 여부) — 부팅 시 1회 호출.
 *  getSession(로컬 저장 세션, 0-RTT)을 우선 사용 — getUser(네트워크 필수)만 쓰면
 *  오프라인/일시 API 장애 때 로그인된 사용자에게 로그인 화면이 떠버린다. */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  return { id: u.id, email: u.email ?? null, isAnonymous: !!u.is_anonymous };
}

/** 현재(익명) 계정에 이메일+비번을 설정 → 영구 계정으로 전환. uid 유지. */
export async function linkEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.updateUser({ email: email.trim(), password });
  if (error) throw new Error(authErrorMessage(error.message));
}

/** 회원가입. 익명 세션이 있으면 전환(데이터 유지), 없으면 새 계정. autoconfirm 이라 즉시 로그인. */
export async function signUpEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data } = await sb.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await sb.auth.updateUser({ email: email.trim(), password });
    if (error) throw new Error(authErrorMessage(error.message));
    return;
  }
  const { error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(authErrorMessage(error.message));
}

/** 다른 기기에서 저장해둔 이메일 계정으로 로그인 (같은 uid → 커플 따라옴). */
export async function signInEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(authErrorMessage(error.message));
}

/** 로그아웃 (이후 앱은 새 익명 계정으로 시작). */
export async function signOutAccount(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  // 공용 기기 프라이버시: 영속화된 서명URL 캐시(커플 사진/영상에 접근 가능한 bearer URL) 제거.
  // 동적 import 실패에 대비해 localStorage 는 직접도 지운다(키는 couple.ts _URL_CACHE_LS 와 일치).
  try {
    localStorage.removeItem("ourdays:signedurls:v1");
  } catch {
    /* noop */
  }
  try {
    const { clearSignedUrlCache } = await import("@/lib/couple");
    clearSignedUrlCache();
  } catch {
    /* noop */
  }
}
