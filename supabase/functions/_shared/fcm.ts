// 안드로이드 앱 푸시(FCM HTTP v1). 앱 안 WebView 엔 웹 푸시가 없어서 앱 기기는 이 길로 받는다(2026-11-05).
// 비밀값 FCM_SERVICE_ACCOUNT(Firebase 서비스 계정 JSON 통째로)이 없으면 아무것도 안 한다 — 웹 푸시는 그대로 나간다.
// ⚠ 여기서 던지지 않는다. FCM 이 실패해도 웹 푸시 · 알림 장부 흐름을 깨면 안 된다.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
// deno-lint-ignore no-explicit-any
type Sb = any;

let account: ServiceAccount | null | undefined;
let cached: { token: string; until: number } | null = null;

function loadAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  try {
    const parsed = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "null");
    account = parsed?.project_id && parsed?.client_email && parsed?.private_key ? parsed : null;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT is not valid JSON");
    account = null;
  }
  return account;
}

const b64url = (data: Uint8Array | string): string => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.until > now + 60) return cached.token;
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`fcm token ${res.status}`);
  const body = await res.json();
  cached = { token: body.access_token, until: now + Number(body.expires_in ?? 3600) };
  return cached.token;
}

export type FcmMessage = { title: string; body: string; url?: string; tag?: string };
export type FcmResult = { sent: number; failed: number; transient: number };

/** 그 사람들의 앱 기기로 보낸다. 없어진 기기(404 · UNREGISTERED)는 지운다. transient = 다시 하면 갈 수 있는 실패. */
export async function sendFcm(sb: Sb, userIds: string[], message: FcmMessage): Promise<FcmResult> {
  const result: FcmResult = { sent: 0, failed: 0, transient: 0 };
  const sa = loadAccount();
  if (!sa || !userIds.length) return result;
  try {
    const { data, error } = await sb.from("native_push_tokens").select("token").in("user_id", userIds);
    if (error || !data?.length) return result;
    const auth = await accessToken(sa);
    await Promise.all((data as { token: string }[]).map(async ({ token }) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: { url: message.url ?? "./" },
            android: { priority: "HIGH", notification: { sound: "default", ...(message.tag ? { tag: message.tag } : {}) } },
          },
        }),
      }).catch(() => null);
      if (res?.ok) {
        result.sent++;
        return;
      }
      result.failed++;
      const text = res ? await res.text().catch(() => "") : "";
      if (res?.status === 404 || text.includes("UNREGISTERED")) {
        await sb.from("native_push_tokens").delete().eq("token", token);
      } else {
        result.transient++;
        console.error("fcm delivery failed", res?.status ?? "network");
      }
    }));
  } catch (e) {
    result.transient++;
    console.error("fcm failed", e instanceof Error ? e.message : "unknown");
  }
  return result;
}
