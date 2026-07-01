// 이동 가능한 계정(이메일+비번). 익명 계정을 이메일로 '저장'하면 uid 가 유지되어
// 다른 브라우저/기기에서 같은 이메일로 로그인하면 커플 연동이 그대로 따라온다.
import { getSupabase } from "@/lib/supabase";

export type AuthInfo = { email: string | null; isAnonymous: boolean };

/** 현재 로그인 상태 (이메일 / 익명 여부). */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return { email: u.email ?? null, isAnonymous: !!u.is_anonymous };
}

/** 현재(익명) 계정에 이메일+비번을 설정 → 영구 계정으로 전환. uid 유지. */
export async function linkEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.updateUser({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

/** 회원가입. 익명 세션이 있으면 전환(데이터 유지), 없으면 새 계정. autoconfirm 이라 즉시 로그인. */
export async function signUpEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data } = await sb.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await sb.auth.updateUser({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

/** 다른 기기에서 저장해둔 이메일 계정으로 로그인 (같은 uid → 커플 따라옴). */
export async function signInEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
}

/** 로그아웃 (이후 앱은 새 익명 계정으로 시작). */
export async function signOutAccount(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
