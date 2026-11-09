// 쓰던 중 세션이 풀렸을 때 (2026-11-05) — 로그인 화면으로 돌려보낸다.
//
// 예전엔 부팅 때 한 번만 로그인 여부를 보고, 그 뒤 세션이 풀리면(리프레시 토큰 만료 · 다른 탭 로그아웃 · 저장소 비움)
// ensureAnonAuth(couple.ts)가 조용히 익명 계정을 새로 만들었다 — 빈 공간이라 사용자는 "기록이 다 사라졌다"고 느꼈다.
// 이제 ensureAnonAuth 는 던지면서 SESSION_LOST_EVENT 를 쏘고, supabase 의 SIGNED_OUT 도 같은 길로 받는다.
import { getSupabase } from "@/lib/supabase";

export const SESSION_LOST_EVENT = "ourdays:session-lost";
export const SESSION_LOST_MESSAGE = "로그인이 풀렸어요. 다시 로그인해 주세요.";

export function announceSessionLost(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_LOST_EVENT));
}

/** 세션이 풀리면 fn 을 부른다(SIGNED_OUT 이벤트 · 데이터 계층이 세션 없음을 만났을 때). 해제 함수를 돌려준다. */
export function onSessionLost(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_LOST_EVENT, fn);
  const sb = getSupabase();
  const sub = sb?.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") fn();
  });
  return () => {
    window.removeEventListener(SESSION_LOST_EVENT, fn);
    sub?.data.subscription.unsubscribe();
  };
}

/* 오프라인이면 '로그인이 풀렸다'가 아니다 [2026-11-09].
 * auth-js getSession() 은 토큰이 만료돼 갱신을 시도했다가 네트워크로 실패하면(AuthRetryableFetchError)
 * { session: null, error } 를 돌려준다 — 저장된 세션은 지우지 않은 채로. 예전엔 session 만 보고 '풀렸다'고
 * 알려서, 연결이 나쁜 곳에서 앱을 열거나 쓰면 로그인 화면이 떴다. 이제 오류가 있으면 연결 오류로만 다룬다. */
export const NETWORK_RETRY_MESSAGE = "연결을 확인해 주세요. 연결되면 다시 시도할게요.";

/** auth 오류가 '서버에 닿지 못함'인가(재시도하면 풀릴 일). AuthRetryableFetchError · fetch 실패 · 오프라인. */
export function isAuthNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const e = error as { name?: string; message?: string; status?: number };
  if (e.name === "AuthRetryableFetchError") return true;
  // 요청이 아예 못 나간 경우 auth-js 는 status 0 으로 감싼다
  if (e.status === 0) return true;
  return /failed to fetch|network|load failed|fetch failed/i.test(e.message ?? "");
}

/** 저장소에 남은 세션의 user — getSession 이 네트워크로 실패했을 때만 쓴다(부팅을 로그인 화면으로 떨어뜨리지 않으려고).
 *  키는 supabase-js 의 storageKey(런타임 필드)를 그대로 읽는다 — 직접 만들면 라이브러리 기본값이 바뀔 때 어긋난다. */
export function storedSessionUser(): { id: string; email: string | null; is_anonymous: boolean } | null {
  try {
    const sb = getSupabase();
    const key = (sb as unknown as { storageKey?: string } | null)?.storageKey;
    if (!key || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const user = (JSON.parse(raw) as { user?: { id?: unknown; email?: unknown; is_anonymous?: unknown } } | null)?.user;
    if (!user || typeof user.id !== "string") return null;
    return {
      id: user.id,
      email: typeof user.email === "string" ? user.email : null,
      is_anonymous: user.is_anonymous === true,
    };
  } catch {
    return null;
  }
}
