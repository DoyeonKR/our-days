// 디버그/에러 로그 인프라. 앱에서 진단 실행 + 이벤트를 debug_logs 에 기록/조회.
import { getSupabase } from "@/lib/supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type DebugLog = {
  id: string;
  tag: string;
  detail: string | null;
  created_at: string;
};

function ua(): string | null {
  return typeof navigator !== "undefined" ? navigator.userAgent : null;
}

/** 이벤트/에러를 debug_logs 에 기록 (best-effort). */
export async function logDebug(tag: string, detail?: unknown): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const d =
      typeof detail === "string"
        ? detail
        : detail !== undefined
          ? JSON.stringify(detail)
          : null;
    await sb.from("debug_logs").insert({ tag, detail: d, ua: ua() });
  } catch {
    /* noop */
  }
}

/** 내 최근 로그 조회. */
export async function getDebugLogs(limit = 30): Promise<DebugLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("debug_logs")
    .select("id,tag,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as DebugLog[];
}

export type Diag = {
  permission: string;
  pushSupported: boolean;
  swRegistered: boolean;
  subscribed: boolean;
  endpoint: string | null;
  savedInDb: boolean;
  vapidPresent: boolean;
  ios: boolean;
  standalone: boolean;
};

function iosLocal(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints !== undefined &&
      (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)
  );
}
function standaloneLocal(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** 푸시 파이프라인 전 구간 상태 점검. */
export async function runDiagnostics(): Promise<Diag> {
  const sb = getSupabase();
  const permission =
    typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const pushSupported =
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "serviceWorker" in navigator;
  let swRegistered = false;
  let subscribed = false;
  let endpoint: string | null = null;
  let savedInDb = false;
  try {
    const reg =
      typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
    swRegistered = !!reg;
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    subscribed = !!sub;
    endpoint = sub?.endpoint ?? null;
    if (sub && sb) {
      const { data } = await sb
        .from("push_subscriptions")
        .select("endpoint")
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      savedInDb = !!data;
    }
  } catch {
    /* noop */
  }
  return {
    permission,
    pushSupported,
    swRegistered,
    subscribed,
    endpoint,
    savedInDb,
    vapidPresent: !!VAPID_PUBLIC,
    ios: iosLocal(),
    standalone: standaloneLocal(),
  };
}
