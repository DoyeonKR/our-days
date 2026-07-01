// 웹 푸시 (백그라운드 알림) — 구독 + Supabase 저장 + 전송 트리거.
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** 푸시 사용 가능 여부 (VAPID 공개키 + Supabase 설정). */
export const isPushConfigured = Boolean(VAPID_PUBLIC) && isSupabaseConfigured;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getReg(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** 브라우저 푸시 구독 + Supabase 저장. 권한 거부/미지원/미설정 시 false. */
export async function enablePush(): Promise<boolean> {
  if (!isPushConfigured) return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined") return false;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const reg = await getReg();
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
  }

  const sb = getSupabase();
  if (!sb) return false;
  const j = sub.toJSON();
  // user_id 는 DB default auth.uid() 로 채워짐 (익명 세션 필요)
  const { error } = await sb.from("push_subscriptions").upsert(
    { endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth },
    { onConflict: "endpoint" },
  );
  return !error;
}

/** 이 기기가 이미 푸시 구독 상태인지. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushConfigured || typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  const reg = await getReg();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/** 쿡찌르기 후 상대에게 푸시 발송 (Edge Function). 실패는 조용히 — 실시간/인앱 알림은 별도. */
export async function sendPokePush(coupleId: string, message: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.functions.invoke("send-poke-push", {
      body: { couple_id: coupleId, message },
    });
  } catch {
    /* noop */
  }
}
