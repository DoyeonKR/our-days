// 알림 '빠른 답장' 1회용 토큰 (2026-11-05).
//
// 문제: 알림의 답장 버튼(❤️ 사랑해 · 🥺 보고싶어)은 앱이 닫혀 있으면 `?pokeReply=<kind>` 로 새 창을 연다.
// 앱은 그 주소를 보면 확인 없이 쿡을 보냈다 — 누구든 그 링크를 보내면 받은 사람 이름으로 쿡이 나갔다.
// 이제 서비스워커(public/sw.js)가 답장 버튼을 누른 순간 토큰을 하나 만들어 저장하고 주소에 싣는다.
// 앱은 토큰이 저장소에 있고 · 종류가 같고 · 안 지났을 때만 바로 보내고, 아니면 확인창을 띄운다.
//
// ── 약속(서비스워커와 앱이 같이 지킨다 — sw.js 는 이 파일을 import 못 하니 아래를 그대로 따라 쓴다) ──
//   저장소   Cache Storage, 이름 "ourdays:poke-reply-tokens" (POKE_REPLY_CACHE)
//   키       `${origin}/__ourdays/poke-reply/${token}` — origin 은 self.location.origin(SW) / location.origin(앱)
//   토큰     소문자 hex 32자(crypto.getRandomValues 16바이트)
//   값       new Response(JSON.stringify({ kind, exp }))  — exp = 만든 시각 + 10분(ms, POKE_REPLY_TTL_MS)
//   주소     url + (url 에 ? 가 있으면 "&" 아니면 "?") + "pokeReply=" + kind + "&t=" + token
//   소비     앱이 읽으면 맞든 틀리든 그 키를 지운다(한 번만 쓰인다). 만들 때 지난 키는 같이 치운다.
//   열린 앱에 postMessage({ type: "pokeReply", kind }) 로 보내는 길은 토큰이 필요 없다 — 메시지를 보낼 수 있는 건 우리 SW 뿐이다.
//   ⚠ sw.js 의 activate 청소는 CACHE · THUMBS 말고는 다 지운다 — 이 이름도 남기는 목록에 넣는다
//     (빠뜨려도 새 SW 가 켜질 때 쌓인 토큰을 잃을 뿐이고, 그 답장은 확인창으로 떨어진다).
//   옛 SW(토큰 없이 ?pokeReply=<kind> 만 싣는 판)로 열려도 앱은 확인창을 띄운다.
//
// SW 쪽 예시(그대로 옮겨 쓰면 된다):
//   const t = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
//   const c = await caches.open("ourdays:poke-reply-tokens");
//   await c.put(self.location.origin + "/__ourdays/poke-reply/" + t, new Response(JSON.stringify({ kind, exp: Date.now() + 600000 })));

export const POKE_REPLY_CACHE = "ourdays:poke-reply-tokens";
export const POKE_REPLY_TTL_MS = 10 * 60_000;
const KEY_PATH = "/__ourdays/poke-reply/";

export type ReplyRecord = { kind: string; exp: number };

export const isReplyToken = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{32}$/.test(t);

export function replyKey(origin: string, token: string): string {
  return `${origin}${KEY_PATH}${token}`;
}

/** 저장된 값이 이 답장(kind)에 쓸 수 있는가 — 순수 판정. */
export function replyRecordOk(rec: unknown, kind: string, now: number): boolean {
  if (!rec || typeof rec !== "object") return false;
  const r = rec as Partial<ReplyRecord>;
  return r.kind === kind && typeof r.exp === "number" && r.exp > now && r.exp - now <= POKE_REPLY_TTL_MS;
}

export function newReplyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 토큰을 만들어 저장하고 돌려준다(SW 와 같은 방식 — 앱 쪽에서 쓸 일이 생기면). */
export async function issueToken(kind: string, origin = location.origin, now = Date.now()): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  try {
    const c = await caches.open(POKE_REPLY_CACHE);
    for (const req of await c.keys()) {
      const rec = await (await c.match(req))?.json().catch(() => null);
      if (!rec || typeof rec.exp !== "number" || rec.exp <= now) await c.delete(req);
    }
    const token = newReplyToken();
    await c.put(replyKey(origin, token), new Response(JSON.stringify({ kind, exp: now + POKE_REPLY_TTL_MS })));
    return token;
  } catch {
    return null;
  }
}

/** 주소의 토큰이 SW 가 만든 것이고 이 kind 에 맞는가 — 맞든 틀리든 지운다(1회용). */
export async function consumeToken(token: string | null, kind: string, origin = location.origin, now = Date.now()): Promise<boolean> {
  if (!isReplyToken(token) || typeof caches === "undefined") return false;
  try {
    const c = await caches.open(POKE_REPLY_CACHE);
    const key = replyKey(origin, token);
    const res = await c.match(key);
    if (!res) return false;
    const rec = await res.json().catch(() => null);
    await c.delete(key);
    return replyRecordOk(rec, kind, now);
  } catch {
    return false;
  }
}
