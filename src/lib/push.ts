// 웹 푸시 (백그라운드 알림) — 구독 + Supabase 저장 + 전송 트리거.
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { logDebug } from "@/lib/debug";

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
    // ready 는 활성 워커가 없으면 영원히 pending → '켜는 중…' 영구 행 사고(2026-07 SW 설치 실패 기기).
    // 5초 타임아웃으로 명확한 실패 메시지로 떨어뜨린다.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    return null;
  }
}

/**
 * 브라우저 푸시 구독 + Supabase 저장. 성공 시 true.
 * 실패 시 사용자에게 보여줄 구체적 사유를 담아 throw (안드로이드 진단용).
 */
export async function enablePush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isPushConfigured)
    throw new Error("푸시 설정이 없어요(VAPID/Supabase). 앱을 새로고침해 주세요.");
  if (!("serviceWorker" in navigator))
    throw new Error("이 브라우저는 서비스워커를 지원하지 않아요.");
  if (!("PushManager" in window))
    throw new Error("이 브라우저는 푸시를 지원하지 않아요.");
  if (typeof Notification === "undefined")
    throw new Error("이 브라우저는 알림을 지원하지 않아요.");

  const perm = await Notification.requestPermission();
  if (perm !== "granted")
    throw new Error(
      perm === "denied"
        ? "알림이 차단돼 있어요. 브라우저 사이트 설정 → 알림 → 허용 후 다시 시도해 주세요."
        : "알림 권한을 허용해야 켤 수 있어요.",
    );

  const reg = await getReg();
  if (!reg) throw new Error("서비스워커 준비 실패. 앱을 새로고침해 주세요.");

  const appKey = urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey,
      });
    } catch {
      // 기존 구독/키 충돌(InvalidStateError 등) 가능 → 정리 후 1회 재시도
      const old = await reg.pushManager.getSubscription();
      if (old) {
        try {
          await old.unsubscribe();
        } catch {
          /* noop */
        }
      }
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appKey,
        });
      } catch (e2) {
        throw new Error(
          "푸시 구독 실패: " + (e2 instanceof Error ? e2.message : String(e2)),
        );
      }
    }
  }

  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const j = sub.toJSON();
  // user_id 는 DB default auth.uid() 로 채워짐 (익명 세션 필요)
  const { error } = await sb.from("push_subscriptions").upsert(
    { endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error("구독 저장 실패: " + error.message);
  logDebug("push_enabled", { endpoint: sub.endpoint.slice(0, 40) + "…" });
  return true;
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
      body: { couple_id: coupleId, message, category: "poke" },
    });
  } catch {
    /* noop */
  }
}

/** 내 폰으로 테스트 푸시 발송 (파이프라인 진단). 결과 메시지 반환. */
export async function sendTestPush(): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "연동이 설정되지 않았어요.";
  try {
    const { data, error } = await sb.functions.invoke("send-poke-push", {
      body: { test: true },
    });
    logDebug("push_test", { data, error: error?.message });
    if (error) return "전송 실패: " + error.message;
    const sent = (data as { sent?: number; reason?: string })?.sent ?? 0;
    if (sent > 0) return "테스트 알림을 보냈어요. 잠시 후 알림이 오는지 확인하세요.";
    const reason = (data as { reason?: string })?.reason;
    if (reason === "no self subscription")
      return "이 기기에 푸시 구독이 없어요. 먼저 '백그라운드 푸시 켜기'를 해주세요.";
    return "보낼 구독이 없어요. 푸시를 먼저 켜주세요.";
  } catch (e) {
    return "전송 실패: " + (e instanceof Error ? e.message : String(e));
  }
}

/** iOS(아이폰/아이패드) 여부 — 홈화면 설치가 필요한 대상 판별용. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 는 Mac 으로 위장 + 터치
    (navigator.platform === "MacIntel" && (navigator as { maxTouchPoints?: number }).maxTouchPoints
      ? (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1
      : false)
  );
}

/** 홈 화면 설치(standalone) 모드로 실행 중인지. iOS 는 이 상태에서만 푸시 가능. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
