// 안드로이드 앱 푸시(FCM HTTP v1). 앱 안 WebView 엔 웹 푸시가 없어서 앱 기기는 이 길로 받는다(2026-11-05).
// 비밀값 FCM_SERVICE_ACCOUNT(Firebase 서비스 계정 JSON 통째로)이 없으면 아무것도 안 한다 — 웹 푸시는 그대로 나간다.
// ⚠ 여기서 던지지 않는다. FCM 이 실패해도 웹 푸시 · 알림 장부 흐름을 깨면 안 된다(fcmpush.test 가 실제로 돌려 잠근다).
// ⚠ 받는 사람 설정(알림 종류 끔 · 조용시간)은 부르는 쪽이 먼저 거른다 — 여기는 받은 목록에 그대로 보낸다.

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
  return account ?? null;
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

/** category = 알림 종류(poke · dday · question · remind …). 안드로이드 채널을 고르는 데만 쓴다. */
export type FcmMessage = { title: string; body: string; url?: string; tag?: string; category?: string };
/** targets = 보낼 대상으로 찾은 토큰 수(0 이면 그 사람 · 그 기기가 등록돼 있지 않다). disabled = 비밀값이 없어 FCM 을 건너뛰었다. */
export type FcmResult = { sent: number; failed: number; transient: number; targets: number; disabled?: boolean };
/** onlyToken — 이 토큰 하나에만(그 사용자 것일 때만). 설정의 '테스트 알림'이 누른 기기만 확인하게. */
export type FcmOptions = { onlyToken?: string };

/** 알림 종류 → 안드로이드 채널 id. 앱이 같은 id 로 채널을 만든다(src/lib/nativepush.ts 의 NATIVE_CHANNELS — fcmpush.test 가 비교).
 *  채널이 없는 옛 기기는 FCM 이 기본 채널로 보내므로 안전하다. */
export function channelFor(category?: string): string {
  if (category === "poke") return "poke";
  if (category === "dday") return "reminders";
  if (category === "question") return "question";
  return "activity";
}

/** 다시 보내도 안 갈 토큰인가 — 지워야 쌓이지 않는다.
 *  404 · UNREGISTERED = 앱이 지워졌거나 토큰이 바뀜, 400 INVALID_ARGUMENT 중 토큰 탓, 403 SENDER_ID_MISMATCH = 다른 프로젝트 토큰.
 *  400 이어도 메시지(본문 칸) 탓이면 토큰은 멀쩡하다 — 지우지 않는다. */
export function isDeadToken(status: number | undefined, text: string): boolean {
  if (status === 404 || text.includes("UNREGISTERED")) return true;
  if (text.includes("SENDER_ID_MISMATCH")) return true;
  if (status === 400 && text.includes("INVALID_ARGUMENT") && /registration token|message\.token/i.test(text)) return true;
  return false;
}

/** 그 사람들의 앱 기기로 보낸다. 죽은 토큰(isDeadToken)은 지운다. transient = 다시 하면 갈 수 있는 실패. 절대 던지지 않는다. */
export async function sendFcm(sb: Sb, userIds: string[], message: FcmMessage, opts: FcmOptions = {}): Promise<FcmResult> {
  const result: FcmResult = { sent: 0, failed: 0, transient: 0, targets: 0 };
  try {
    if (!userIds.length) return result;
    const sa = loadAccount();
    if (!sa) {
      result.disabled = true;
      return result;
    }
    let query = sb.from("native_push_tokens").select("token").in("user_id", userIds);
    if (opts.onlyToken) query = query.eq("token", opts.onlyToken);
    const { data, error } = await query;
    if (error || !data?.length) return result;
    result.targets = data.length;
    const auth = await accessToken(sa);
    const channel = channelFor(message.category);
    await Promise.all((data as { token: string }[]).map(async ({ token }) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: { url: message.url ?? "./" },
              android: {
                priority: "HIGH",
                notification: { sound: "default", channel_id: channel, ...(message.tag ? { tag: message.tag } : {}) },
              },
            },
          }),
        }).catch(() => null);
        if (res?.ok) {
          result.sent++;
          return;
        }
        result.failed++;
        const text = res ? await res.text().catch(() => "") : "";
        if (res && isDeadToken(res.status, text)) {
          const { error: delError } = await sb.from("native_push_tokens").delete().eq("token", token);
          if (delError) console.error("fcm token cleanup failed", delError.message);
        } else {
          result.transient++;
          console.error("fcm delivery failed", res?.status ?? "network");
        }
      } catch (e) {
        result.transient++;
        console.error("fcm delivery failed", e instanceof Error ? e.message : "unknown");
      }
    }));
  } catch (e) {
    result.transient++;
    console.error("fcm failed", e instanceof Error ? e.message : "unknown");
  }
  return result;
}
