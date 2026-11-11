// 이동 가능한 계정(이메일+비번). 익명 계정을 이메일로 '저장'하면 uid 가 유지되어
// 다른 브라우저/기기에서 같은 이메일로 로그인하면 커플 연동이 그대로 따라온다.
import { getSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authError";
import { BASE } from "@/lib/base";
import { normalizeEmail, passwordResetRedirect } from "@/lib/authPolicy";
import { NETWORK_RETRY_MESSAGE, forgetStoredSession, isAuthNetworkError, storedSessionUser } from "@/lib/session";

/** offline — 토큰 갱신이 네트워크로 실패해 저장소의 세션으로 대신 읽었다(연결되면 auth-js 가 다시 갱신한다). */
export type AuthInfo = { id: string; email: string | null; isAnonymous: boolean; offline?: boolean };

/** 서버에 닿지 못해 로그인 상태를 확인하지 못했다 — '로그인이 풀렸다'가 아니다(호출부는 로그인 화면으로 보내지 말고 다시 시도). */
export class AuthOfflineError extends Error {
  constructor() {
    super(NETWORK_RETRY_MESSAGE);
    this.name = "AuthOfflineError";
  }
}

/** 현재 로그인 상태 (uid/이메일/익명 여부) — 부팅 시 1회 호출.
 *  getSession(로컬 저장 세션, 0-RTT)을 우선 사용 — getUser(네트워크 필수)만 쓰면
 *  오프라인/일시 API 장애 때 로그인된 사용자에게 로그인 화면이 떠버린다.
 *  [2026-11-09] 토큰이 만료된 채 오프라인이면 getSession 이 { session: null, error } 를 준다(저장된 세션은 남는다).
 *  예전엔 그걸 null(로그인 안 됨)로 돌려 부팅이 로그인 화면으로 떨어졌다. 이제 저장소의 세션으로 읽고,
 *  그것도 없으면 AuthOfflineError 를 던진다. 세션이 정말 없을 때(오류 없음)만 null 이다. */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  const u = data.session?.user;
  if (u) return { id: u.id, email: u.email ?? null, isAnonymous: !!u.is_anonymous };
  if (error && isAuthNetworkError(error)) {
    const stored = storedSessionUser();
    if (!stored) throw new AuthOfflineError();
    return { id: stored.id, email: stored.email, isAnonymous: stored.is_anonymous, offline: true };
  }
  return null;
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

/** 이 탭이 복구 링크를 직접 받았다는 표식(sessionStorage — 탭마다 따로, 닫으면 사라진다).
 *  링크의 code/hash 를 세션으로 바꾼 순간에만 남긴다. 주소를 지운 뒤 새로고침해도 이어지게 30분 동안 믿는다. */
export const RECOVERY_FLAG = "ourdays:recovery-at";
const RECOVERY_TTL_MS = 30 * 60_000;

function markRecovery(): void {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    /* noop */
  }
}
function hasFreshRecovery(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(RECOVERY_FLAG));
    return Number.isFinite(at) && at > 0 && now - at < RECOVERY_TTL_MS;
  } catch {
    return false;
  }
}
export function clearRecoveryFlag(): void {
  try {
    sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* noop */
  }
}

/**
 * 정적 reset-password 페이지에서 복구 세션을 연다.
 * PKCE의 ?code 와 implicit flow의 hash token을 모두 지원한다.
 * recovery = 이 탭이 복구 링크로 들어왔는가. false 면 '그냥 로그인돼 있는' 세션이라 현재 비밀번호 없이 바꾸면 안 된다 —
 * 예전엔 getSession 폴백만 보고 바로 바꿔 줘서, 잠깐 빌린 기기에서 이 주소만 열면 남의 비밀번호를 바꿀 수 있었다 [2026-11-05].
 */
export async function consumePasswordRecoveryUrl(href: string): Promise<{ recovery: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const url = new URL(href);
  const authError = url.searchParams.get("error_description");
  if (authError) throw new Error(authErrorMessage(authError));

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) throw new Error(authErrorMessage(error.message));
    markRecovery();
    return { recovery: true };
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
    // implicit 링크는 type=recovery 가 붙어 온다 — 그 밖의 토큰(가입 확인 등)은 복구로 치지 않는다
    if (hash.get("type") === "recovery") {
      markRecovery();
      return { recovery: true };
    }
    return { recovery: hasFreshRecovery() };
  }

  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(authErrorMessage(error.message));
  if (!data.session) throw new Error("복구 링크가 만료됐거나 올바르지 않아요. 새 링크를 요청해 주세요.");
  return { recovery: hasFreshRecovery() };
}

/** 복구 링크 없이 비밀번호를 바꿀 때 — 현재 비밀번호를 다시 확인한 뒤에만(설정 › 계정과 같은 순서). */
export async function changePasswordWithCurrent(newPassword: string, currentPassword: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data } = await sb.auth.getSession();
  const email = data.session?.user.email;
  if (!email) throw new Error("로그인이 필요해요.");
  await signInEmail(email, currentPassword);
  await changePassword(newPassword, currentPassword);
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

/** 로그아웃 (이후 앱은 로그인 화면으로). */
export async function signOutAccount(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // 이 기기의 푸시 구독부터 — 행은 본인 것만 지울 수 있어서 세션이 있을 때 지운다. 남으면 로그아웃한 계정의 알림이
  // 이 기기에 계속 온다. 느린 네트워크에서 로그아웃이 멎지 않게 4초까지만 기다린다.
  try {
    const { disablePushOnThisDevice } = await import("@/lib/push");
    await Promise.race([disablePushOnThisDevice(), new Promise((r) => setTimeout(r, 4000))]);
  } catch {
    /* noop */
  }
  clearRecoveryFlag();
  /* [2026-11-09] signOut 은 실패를 던지지 않고 { error } 로 준다. auth-js 는 네트워크 오류면 세션을 지우지 않고
     일찍 돌아오는데, 예전엔 그걸 안 보고 아래에서 기기 데이터를 지운 뒤 새로고침해서 — 다시 열면 여전히 로그인돼 있었다.
     전역(global) 로그아웃이 실패하면 이 기기만(local) 다시 시도하고, 그것도 실패하면 던져서 화면이 알린다
     (데이터는 그대로 둔다 — 로그인된 채 데이터만 지우면 반쯤 로그아웃된 상태가 된다). */
  const { error } = await sb.auth.signOut();
  if (error) {
    const { error: localError } = await sb.auth.signOut({ scope: "local" });
    // local 도 서버를 먼저 부른다 — 연결이 없으면 저장된 세션을 직접 지운다(서버 토큰은 만료까지 남는다).
    if (localError && isAuthNetworkError(localError) && forgetStoredSession()) {
      /* 이 기기에서는 로그아웃됐다 — 아래 정리로 이어 간다 */
    } else if (localError)
      throw new Error(
        isAuthNetworkError(localError)
          ? "연결을 확인해 주세요. 로그아웃하지 못했어요."
          : authErrorMessage(localError.message),
      );
  }
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
    // [2026-11-11 2차] 이 기기의 시계 어긋남(11-11 배포가 남긴 값 — islandsync.CLOCK_KEY)
    localStorage.removeItem("ourdays.clockOffset.v1");
    /* 작성 초안(ourdays:draft:*)도 개인 데이터다 [리뷰 2026-08-26]: 초안 키에 계정 구분이
       없어, 안 지우면 다음 계정의 편집기가 이전 사용자의 (비밀일기일 수도 있는) 초안을
       그대로 복원해 보여준다. 키가 동적(entry id 포함)이라 접두사로 걷는다. */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ourdays:draft:")) localStorage.removeItem(k);
      // 못 보낸 섬 초안(IslandGame pendingKey — 커플 · 사람마다). 남기면 같은 계정이 다시 들어와 낡은 초안을 보내거나,
      // 다른 계정의 기기 저장소에 이전 사람의 섬 상태가 남는다. 키가 동적이라 접두사로 걷는다.
      else if (k && k.startsWith("ourdays:island:pending:")) localStorage.removeItem(k);
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
