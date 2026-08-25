// 이동 가능한 계정(이메일+비번). 익명 계정을 이메일로 '저장'하면 uid 가 유지되어
// 다른 브라우저/기기에서 같은 이메일로 로그인하면 커플 연동이 그대로 따라온다.
import { getSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authError";
import { BASE } from "@/lib/base";
import { normalizeEmail, passwordResetRedirect } from "@/lib/authPolicy";

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
  const { error } = await sb.auth.updateUser({ email: normalizeEmail(email), password });
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
  const { error } = await sb.auth.signUp({ email: normalizeEmail(email), password });
  if (error) throw new Error(authErrorMessage(error.message));
}

/** 다른 기기에서 저장해둔 이메일 계정으로 로그인 (같은 uid → 커플 따라옴). */
export async function signInEmail(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw new Error(authErrorMessage(error.message));
}

/** 존재 여부를 노출하지 않는 Supabase 복구 메일 요청. */
export async function requestPasswordReset(email: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  if (typeof window === "undefined") throw new Error("브라우저에서 다시 시도해 주세요.");
  const { error } = await sb.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: passwordResetRedirect(window.location.origin, BASE),
  });
  if (error) throw new Error(authErrorMessage(error.message));
}

/**
 * 정적 reset-password 페이지에서 복구 세션을 연다.
 * PKCE의 ?code 와 implicit flow의 hash token을 모두 지원한다.
 */
export async function consumePasswordRecoveryUrl(href: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const url = new URL(href);
  const authError = url.searchParams.get("error_description");
  if (authError) throw new Error(authErrorMessage(authError));

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) throw new Error(authErrorMessage(error.message));
    return;
  }

  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hashError = hash.get("error_description");
  if (hashError) throw new Error(authErrorMessage(hashError));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error(authErrorMessage(error.message));
    return;
  }

  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(authErrorMessage(error.message));
  if (!data.session) throw new Error("복구 링크가 만료됐거나 올바르지 않아요. 새 링크를 요청해 주세요.");
}

/** 로그인 상태에서 또는 복구 세션에서 비밀번호 변경. */
export async function changePassword(
  newPassword: string,
  currentPassword?: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { error } = await sb.auth.updateUser({
    password: newPassword,
    ...(currentPassword ? { current_password: currentPassword } : {}),
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
    // 저장된 커플 id(CoupleSync LS_COUPLE)도 제거 — 다음 사용자가 이전 커플로 재연결 시도하는 것 방지.
    localStorage.removeItem("ourdays:couple");
    /* 개인 데이터 잔존 방지 [리뷰 2026-08-25]: 아래 키들은 다음 계정의 부팅이 그대로 읽어
       이전 사용자의 D-day·기념일·애칭이 홈에 뜨고, 솔로 섬은 다음 계정의 커플 섬으로
       승격(loadIsland)될 수 있다. 키 문자열은 page.tsx 의 LS 상수·soloisland.ts 와 짝.
       (테마·픽셀 토글 같은 '기기 취향'은 남긴다 — 개인 식별 정보가 아니다) */
    localStorage.removeItem("ourdays:start"); // 사귄 날
    localStorage.removeItem("ourdays:me"); // 내 애칭
    localStorage.removeItem("ourdays:events"); // 로컬 기념일 목록
    localStorage.removeItem("ourdays:cover"); // 대표사진 경로
    localStorage.removeItem("ourdays:notified"); // D-day 알림 마커
    localStorage.removeItem("ourdays.island.solo.v1"); // 솔로 섬
    /* 작성 초안(ourdays:draft:*)도 개인 데이터다 [리뷰 2026-08-26]: 초안 키에 계정 구분이
       없어, 안 지우면 다음 계정의 편집기가 이전 사용자의 (비밀일기일 수도 있는) 초안을
       그대로 복원해 보여준다. 키가 동적(entry id 포함)이라 접두사로 걷는다. */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ourdays:draft:")) localStorage.removeItem(k);
    }
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
