/* 안드로이드 앱 푸시 — 앱 안 WebView 엔 웹 푸시가 없어 FCM 토큰을 서버에 맡긴다(2026-11-05).
 * 사이트는 브라우저로도 열리므로 앱 안일 때만 플러그인을 받는다. iOS 앱은 APNs 키(유료 개발자 계정)가 없어 쓰지 않는다.
 * ⚠ 설치된 APK 는 이 사이트를 그대로 연다 — 새 코드가 옛 껍데기에서도 돌아야 한다. 플러그인 · 메서드가 없을 수 있어 전부 감싼다.
 * [2026-11-06 앱 · 푸시 리뷰] 채널 · 권한 상태 · 로그아웃 순서 · 토큰 다시 맞추기 — README §10.19. 순수 부분은 nativepushstate.ts. */
import { getSupabase } from "@/lib/supabase";
import { logDebug } from "@/lib/debug";
import { showNotice } from "@/lib/notice";
import { nativePlatform } from "@/lib/nativeplatform";
import {
  NATIVE_CHANNELS,
  SYNCED_KEY,
  TOKEN_KEY,
  addUnbind,
  normalizePermission,
  readUnbind,
  removeUnbind,
  shellShowsForeground,
  syncedMark,
  type NativePushStatus,
} from "@/lib/nativepushstate";

export { nativePlatform };
export type { NativePushStatus };

/** 상태가 바뀌면(토큰 · 등록 · 권한) 설정 화면이 다시 읽는다 */
export const NATIVE_PUSH_EVENT = "ourdays:native-push";

export const isAndroidApp = (): boolean => nativePlatform() === "android";

type PushPlugin = (typeof import("@capacitor/push-notifications"))["PushNotifications"];

function pluginAvailable(name: string): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  // 옛 Capacitor 는 isPluginAvailable 이 없을 수 있다 — 그땐 있다고 보고 호출을 감싼다
  return cap?.isPluginAvailable ? cap.isPluginAvailable(name) : true;
}

async function pushPlugin(): Promise<PushPlugin | null> {
  if (!isAndroidApp() || !pluginAvailable("PushNotifications")) return null;
  try {
    return (await import("@capacitor/push-notifications")).PushNotifications;
  } catch {
    return null;
  }
}

const ls = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 저장이 막혀도 서버 등록은 된다 */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};
const store = { getItem: ls.get, setItem: ls.set, removeItem: ls.remove };

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NATIVE_PUSH_EVENT));
}

/** 이 기기의 FCM 토큰(설정의 테스트 알림이 이 토큰으로만 보낸다) */
export function nativePushToken(): string | null {
  return ls.get(TOKEN_KEY);
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = (await getSupabase()?.auth.getSession()) ?? { data: null };
    return data?.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** 받은 토큰을 서버에 맡긴다. force = 앱을 켠 첫 등록(서버 행이 지워졌어도 되살린다). 아니면 '사용자:토큰'이 같을 때 건너뛴다. */
async function syncToken(value: string, force: boolean): Promise<void> {
  ls.set(TOKEN_KEY, value);
  removeUnbind(store, value); // 이 기기가 다시 쓰는 토큰 — 지울 목록에 남아 있으면 새 계정 알림까지 끊긴다
  const uid = await currentUserId();
  if (!uid) return emit();
  if (!force && ls.get(SYNCED_KEY) === syncedMark(uid, value)) return emit();
  const sb = getSupabase();
  if (!sb) return emit();
  try {
    const { error } = await sb.rpc("register_native_push", { p_token: value, p_platform: "android" });
    if (error) {
      ls.remove(SYNCED_KEY);
      logDebug("native_push_save_error", error.message);
    } else {
      ls.set(SYNCED_KEY, syncedMark(uid, value));
      logDebug("native_push_saved");
    }
  } catch (e) {
    ls.remove(SYNCED_KEY);
    logDebug("native_push_save_error", e instanceof Error ? e.message : String(e));
  }
  emit();
}

/** 서버에서 이 토큰의 행을 지운다 — 토큰만으로 지우는 RPC(로그아웃 뒤 세션이 없어도 된다). 아직 RPC 가 없는 DB 면 내 행 직접 삭제. */
async function unbindOnServer(token: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("unregister_native_push", { p_token: token });
    if (!error) return true;
    if (error.code !== "PGRST202" && error.code !== "42883") return false; // 네트워크 · 서버 오류 — 다음 실행에 다시
    const { error: delError } = await sb.from("native_push_tokens").delete().eq("token", token);
    return !delError;
  } catch {
    return false;
  }
}

let flushing: Promise<void> | null = null;
/** 로그아웃 때 못 지운 토큰을 지운다(앱을 켤 때). 한 번에 하나만 돈다 — startNativePush 가 이걸 기다린 뒤 등록한다. */
export function flushNativeUnbind(): Promise<void> {
  if (!isAndroidApp()) return Promise.resolve();
  flushing ??= (async () => {
    for (const token of readUnbind(store)) {
      if (await unbindOnServer(token)) removeUnbind(store, token);
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

// 로그인 안 한 채 열어도(로그아웃한 기기) 지울 토큰이 남았으면 지운다 — page.tsx 는 로그인해야 startNativePush 를 부른다
if (typeof window !== "undefined" && isAndroidApp() && readUnbind(store).length) void flushNativeUnbind();

/** 지금 권한 · 토큰 · 서버 등록 여부. 플러그인이 없으면 unavailable. */
export async function nativePushStatus(): Promise<NativePushStatus> {
  const token = nativePushToken();
  const uid = token ? await currentUserId() : null;
  const registered = !!token && !!uid && ls.get(SYNCED_KEY) === syncedMark(uid, token);
  const P = await pushPlugin();
  if (!P) return { permission: "unavailable", token, registered };
  try {
    const { receive } = await P.checkPermissions();
    return { permission: normalizePermission(receive), token, registered };
  } catch {
    return { permission: "unavailable", token, registered };
  }
}

let forceNext = false;
/** 설정의 '알림 켜기' · '다시 등록' — 권한을 묻고(이미 거절됐으면 못 묻는다) 등록한다. 토큰은 registration 이벤트로 온다. */
export async function requestNativePush(): Promise<NativePushStatus> {
  const P = await pushPlugin();
  if (P) {
    try {
      let { receive } = await P.checkPermissions();
      if (normalizePermission(receive) === "prompt") ({ receive } = await P.requestPermissions());
      if (receive === "granted") {
        forceNext = true;
        await P.register();
      }
    } catch (e) {
      logDebug("native_push_error", e instanceof Error ? e.message : String(e));
    }
  }
  emit();
  return nativePushStatus();
}

async function createChannels(P: PushPlugin): Promise<void> {
  // 채널은 안드로이드 8+ 의 '알림 종류' — 서버가 channel_id 로 고른다. 이미 있으면 이름만 갱신된다. 옛 플러그인이면 조용히 건너뛴다.
  await Promise.all(
    NATIVE_CHANNELS.map((c) =>
      P.createChannel({ id: c.id, name: c.name, description: c.description, importance: c.importance, visibility: 1 }).catch(() => undefined),
    ),
  );
}

async function shellBuild(): Promise<string | null> {
  if (!pluginAvailable("App")) return null;
  try {
    return (await (await import("@capacitor/app")).App.getInfo()).build;
  } catch {
    return null;
  }
}

/** 권한을 묻고 기기를 등록한다. onOpen = 알림을 눌렀을 때 갈 주소. 돌려준 함수로 듣기를 끝낸다. */
export async function startNativePush(onOpen: (url: string) => void): Promise<() => void> {
  const P = await pushPlugin();
  if (!P) return () => {};
  // 지난 로그아웃에서 못 지운 토큰부터 — 같은 토큰을 새 계정으로 등록한 뒤에 지우면 새 계정 알림이 끊긴다
  await flushNativeUnbind();
  await createChannels(P);
  // presentationOptions 가 없는 옛 APK 는 앱을 켜 둔 동안 온 알림을 아무도 안 띄운다 — 그때만 앱 안 안내로
  const foreground = shellShowsForeground(await shellBuild());
  forceNext = true;
  const cleanups: Array<() => void> = [];
  try {
    const handles = await Promise.all([
      P.addListener("registration", ({ value }) => {
        const force = forceNext;
        forceNext = false;
        void syncToken(value, force);
      }),
      P.addListener("registrationError", ({ error }) => logDebug("native_push_error", error)),
      P.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url;
        if (url) onOpen(url);
      }),
      P.addListener("pushNotificationReceived", (n) => {
        if (foreground) return;
        const text = [n.title, n.body].filter(Boolean).join(" · ");
        if (text) showNotice(text, "info", 5_000);
      }),
    ]);
    cleanups.push(() => handles.forEach((h) => void h.remove().catch(() => undefined)));
  } catch (e) {
    logDebug("native_push_error", e instanceof Error ? e.message : String(e));
  }
  try {
    let { receive } = await P.checkPermissions();
    if (normalizePermission(receive) === "prompt") ({ receive } = await P.requestPermissions());
    if (receive === "granted") await P.register();
    else logDebug("native_push_denied", receive);
    emit();
  } catch (e) {
    logDebug("native_push_error", e instanceof Error ? e.message : String(e));
  }
  /* 돌아올 때마다 지금 토큰을 다시 받아 저장한 것과 견준다(registration → syncToken 이 다를 때만 등록).
     빠르게 로그아웃 → 로그인하면 지우던 옛 토큰을 등록하고, 새 토큰은 나중에 나와 서버에 영영 안 올라갔다.
     휴대폰 설정에서 권한을 켜고 돌아온 경우도 여기서 등록된다. */
  let last = 0;
  const recheck = () => {
    if (document.visibilityState === "hidden" || Date.now() - last < 3_000) return;
    last = Date.now();
    void (async () => {
      try {
        const { receive } = await P.checkPermissions();
        if (receive === "granted") await P.register();
      } catch {
        /* 옛 껍데기 · 일시 오류 — 다음에 다시 */
      }
      emit();
    })();
  };
  document.addEventListener("visibilitychange", recheck);
  document.addEventListener("resume", recheck);
  cleanups.push(() => {
    document.removeEventListener("visibilitychange", recheck);
    document.removeEventListener("resume", recheck);
  });
  return () => cleanups.forEach((f) => f());
}

/** 로그아웃 — 이 기기의 알림을 먼저 끊고(FCM 토큰 삭제) 서버 행을 지운다. 행 삭제가 실패하면 토큰을 '지울 목록'에 남겨
 *  다음 실행에 지운다(예전엔 실패를 삼키고 토큰까지 잊어, 연결이 나쁠 때 로그아웃한 계정의 알림이 계속 왔다). */
export async function stopNativePush(): Promise<void> {
  if (!isAndroidApp()) return;
  const token = nativePushToken();
  if (token) addUnbind(store, token); // 먼저 적어 둔다 — 아래가 끝나기 전에 앱이 닫혀도 다음 실행에 지운다
  const P = await pushPlugin();
  // unregister 는 FCM 의 deleteToken 을 시작만 하고 바로 돌아온다(끝을 기다릴 방법이 플러그인에 없다)
  if (P) await P.unregister().catch(() => undefined);
  ls.remove(TOKEN_KEY);
  ls.remove(SYNCED_KEY);
  if (token && (await unbindOnServer(token))) removeUnbind(store, token);
  emit();
}
