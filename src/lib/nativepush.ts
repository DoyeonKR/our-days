/* 안드로이드 앱 푸시 — 앱 안 WebView 엔 웹 푸시가 없어 FCM 토큰을 서버에 맡긴다(2026-11-05).
 * 사이트는 브라우저로도 열리므로 앱 안일 때만 플러그인을 받는다. iOS 앱은 APNs 키(유료 개발자 계정)가 없어 쓰지 않는다. */
import { getSupabase } from "@/lib/supabase";
import { logDebug } from "@/lib/debug";
import { nativePlatform } from "@/lib/nativeplatform";

const TOKEN_KEY = "ourdays:native-push-token";

export { nativePlatform };

export const isAndroidApp = (): boolean => nativePlatform() === "android";

function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 권한을 묻고 기기를 등록한다. onOpen = 알림을 눌렀을 때 갈 주소. 돌려준 함수로 듣기를 끝낸다. */
export async function startNativePush(onOpen: (url: string) => void): Promise<() => void> {
  if (!isAndroidApp()) return () => {};
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handles = await Promise.all([
    PushNotifications.addListener("registration", ({ value }) => {
      try {
        localStorage.setItem(TOKEN_KEY, value);
      } catch {
        /* 저장이 막혀도 서버 등록은 된다 */
      }
      void getSupabase()?.rpc("register_native_push", { p_token: value, p_platform: "android" }).then(({ error }) => {
        logDebug(error ? "native_push_save_error" : "native_push_saved", error?.message);
      });
    }),
    PushNotifications.addListener("registrationError", ({ error }) => logDebug("native_push_error", error)),
    PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) onOpen(url);
    }),
  ]);
  try {
    let { receive } = await PushNotifications.checkPermissions();
    if (receive === "prompt" || receive === "prompt-with-rationale") ({ receive } = await PushNotifications.requestPermissions());
    if (receive === "granted") await PushNotifications.register();
    else logDebug("native_push_denied", receive);
  } catch (e) {
    logDebug("native_push_error", e instanceof Error ? e.message : String(e));
  }
  return () => handles.forEach((h) => void h.remove());
}

/** 로그아웃 — 이 기기 토큰을 지운다(로그아웃한 계정의 알림이 계속 오면 안 된다). 세션이 살아 있을 때 불러야 지워진다. */
export async function stopNativePush(): Promise<void> {
  if (!isAndroidApp()) return;
  const token = savedToken();
  if (token) {
    await getSupabase()?.from("native_push_tokens").delete().eq("token", token).then(() => undefined, () => undefined);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  }
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.unregister().catch(() => undefined);
}
