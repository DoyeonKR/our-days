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
