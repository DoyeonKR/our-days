// 앱 · 푸시 리뷰 lock (2026-11-06 — README §10.20). 사용자: "Fix all".
// 앱 백업 파일 유실 · 앱을 켜 둔 동안 알림 없음 · 안드로이드 알림 카드 상태 · 로그아웃 뒤 옛 계정 알림 · 죽은 토큰 · IPA 워크플로 권한 ·
// 빠른 재로그인 토큰 · 웹 푸시를 쓰는 함수의 FCM 순서. 소스 스캔은 주석을 먼저 지운다(README §10.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { WRITE_CHUNK_BYTES, chunkRanges, isShareCancel, safeShareName } from "./nativefile.ts";
import {
  DEFAULT_CHANNEL_ID,
  FOREGROUND_SHELL_BUILD,
  NATIVE_CHANNELS,
  UNBIND_KEY,
  addUnbind,
  isFcmTokenShape,
  nativePushView,
  nativeTestMessage,
  normalizePermission,
  readUnbind,
  removeUnbind,
  shellShowsForeground,
} from "./nativepushstate.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
// 줄 주석 지우기 — 'https://' 의 // 는 코드라 남긴다(지우면 그 줄의 { 가 사라져 본문 자르기가 어긋난다)
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const sql = (p: string) => read(p).replace(/--[^\n]*/g, "");
/** name 으로 시작하는 함수의 본문까지 — 본문 여는 { 는 줄 끝에 온다(인자 · 반환 타입의 { … } 는 한 줄 안에서 닫힌다) */
function body(src: string, name: string): string {
  const a = src.indexOf(name);
  assert.ok(a >= 0, `${name} 를 못 찾았다`);
  const open = src.slice(a).search(/\{\n/);
  assert.ok(open >= 0, name);
  let depth = 0;
  for (let i = a + open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(a, i + 1);
  }
  throw new Error(name);
}
const TOKEN = "fA1b2C3d4E5:APA91b" + "x".repeat(120);

// ── 1) 앱 백업 — 조각을 하나씩 기다리고, 나눠 쓰고, 오류를 보여 준다 ───────────────────────────────

test("① 파일 쓰기 조각은 3 의 배수 — 조각마다 base64 해서 이어 붙여도 통째로 바꾼 것과 같다", () => {
  assert.equal(WRITE_CHUNK_BYTES % 3, 0);
  assert.ok(WRITE_CHUNK_BYTES >= 2 * 1024 * 1024 && WRITE_CHUNK_BYTES <= 4 * 1024 * 1024, "2~4MB");
  assert.throws(() => chunkRanges(10, 4), "3 의 배수가 아닌 조각은 거절");
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 37) % 256));
  for (const chunk of [3, 6, 30, 999]) {
    const ranges = chunkRanges(bytes.length, chunk);
    assert.equal(ranges[0][0], 0);
    assert.equal(ranges.at(-1)![1], bytes.length);
    for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i][0], ranges[i - 1][1], "구간이 이어진다");
    const joined = ranges.map(([a, b]) => bytes.subarray(a, b).toString("base64")).join("");
    assert.equal(joined, bytes.toString("base64"), `chunk ${chunk}`);
  }
  assert.deepEqual(chunkRanges(0), [[0, 0]], "빈 파일도 한 번은 쓴다");
  const big = 200 * 1024 * 1024;
  assert.equal(chunkRanges(big).length, Math.ceil(big / WRITE_CHUNK_BYTES));
});

test("① 공유 취소는 오류가 아니다 · 파일 이름은 캐시 밖으로 못 나간다", () => {
  assert.equal(isShareCancel(new Error("Share canceled")), true);
  assert.equal(isShareCancel("Share canceled"), true);
  assert.equal(isShareCancel(new Error("Can't share while sharing is in progress")), false);
  const evil = safeShareName("../../a/b.zip");
  assert.ok(!evil.includes("/") && !evil.startsWith("."), evil);
  assert.equal(safeShareName(""), "haru-file");
});

test("① nativefile — writeFile 첫 조각 · appendFile 나머지 · 실패 · 취소면 지운다 · 남은 파일은 다음 공유가 치운다", () => {
  const src = code("src/lib/nativefile.ts");
  const fn = body(src, "export async function shareFileInAppResult(");
  assert.match(fn, /chunkRanges\(blob\.size\)/);
  assert.match(fn, /blob\.slice\(ranges\[i\]\[0\], ranges\[i\]\[1\]\)/, "Blob 을 잘라서 조각마다 base64");
  assert.match(fn, /Filesystem\.writeFile\(/);
  assert.match(fn, /Filesystem\.appendFile\(/);
  assert.doesNotMatch(fn, /toBase64\(blob\)/, "통째 base64(200MB → 270MB 문자열)가 돌아왔다");
  assert.match(fn, /finally \{\s*if \(!keepFile\) await Filesystem\.deleteFile/);
  assert.match(fn, /if \(isShareCancel\(e\)\) return "cancelled";\s*throw e;/, "취소 말고는 던진다");
  assert.match(fn, /await sweepShared\(/);
  // 옛 호출부(사진 · 카드 · 로그)는 boolean 그대로
  assert.match(src, /export async function shareFileInApp\(blob: Blob, name: string, title = "하루"\): Promise<boolean>/);
});

test("① 내보내기 — 앱은 조각을 하나씩 기다리고 사이에 몇 번째인지 묻는다 · 오류를 삼키지 않는다 · 웹은 그대로", () => {
  const src = code("src/lib/accountData.ts");
  assert.doesNotMatch(src, /void shareFileInApp/, "기다리지 않고 오류를 삼키던 호출이 돌아왔다");
  assert.doesNotMatch(src, /\.catch\(\(\) => undefined\)/);
  const archive = body(src, "export async function downloadAccountArchive(");
  const native = archive.slice(archive.indexOf("if (nativePlatform())"));
  assert.match(native, /for \(let i = 0; i < total; i \+= 1\)/);
  assert.match(native, /await confirmDialog\(/, "조각 사이에 묻는다");
  assert.match(native, /\$\{total\}개 중 \$\{i \+ 1\}번째 파일/);
  assert.match(native, /if \(await saveInApp\(finished\[i\], nameOf\(i\)\)\) saved \+= 1;/, "하나씩 await");
  assert.doesNotMatch(native.slice(0, native.indexOf("} else {")), /forEach/, "앱에서 조각을 한꺼번에 열면 두 번째부터 거절된다");
  assert.match(archive, /\} else \{\s*finished\.forEach\(\(blob, i\) => downloadBlob\(blob, nameOf\(i\)\)\);/, "웹 길은 그대로");
  const save = body(src, "async function saveInApp(");
  assert.match(save, /=== "shared"/);
  assert.match(save, /throw new Error\(/, "진짜 오류는 화면까지 올라간다");
  const json = body(src, "export async function downloadAccountJson(");
  assert.match(json, /saved: await saveInApp\(blob, name\)/);
  const ui = code("src/components/AccountSection.tsx");
  assert.match(ui, /result\.saved < result\.parts/, "취소 · 일부만 저장을 성공처럼 말하지 않는다");
  assert.match(ui, /const \{ saved \} = await downloadAccountJson\(setExportProgress\)/);
  assert.match(body(ui, "async function runExport("), /setErr\(e instanceof Error \? e\.message : String\(e\)\)/);
});

// ── 2) 앱을 켜 둔 동안의 알림 · 채널 · 아이콘 ───────────────────────────────────────────────

test("② presentationOptions · 작은 아이콘 · 기본 채널 · versionCode", () => {
  const cfg = code("capacitor.config.ts");
  assert.match(cfg, /PushNotifications: \{\s*presentationOptions: \["badge", "sound", "alert"\],?\s*\}/);
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /com\.google\.firebase\.messaging\.default_notification_icon"\s+android:resource="@drawable\/ic_stat_haru"/);
  const ch = /com\.google\.firebase\.messaging\.default_notification_channel_id"\s+android:value="([a-z]+)"/.exec(manifest);
  assert.ok(ch, "기본 채널 meta-data 가 없다");
  assert.equal(ch![1], DEFAULT_CHANNEL_ID);
  assert.ok(NATIVE_CHANNELS.some((c) => c.id === DEFAULT_CHANNEL_ID), "기본 채널을 앱이 만들어야 한다");
  const icon = read("android/app/src/main/res/drawable/ic_stat_haru.xml");
  assert.match(icon, /<vector /);
  assert.match(icon, /android:fillColor="#FFFFFFFF"/, "상태 표시줄 아이콘은 흰 실루엣");
  assert.doesNotMatch(icon, /fillColor="#(?!FFFFFFFF)/, "다른 색이 섞이면 회색 네모로 나온다");
  assert.ok(existsSync(join(root, "android/app/src/main/res/values/notification.xml")));
  const gradle = read("android/app/build.gradle");
  const vc = Number(/versionCode (\d+)/.exec(gradle)?.[1]);
  assert.ok(vc >= FOREGROUND_SHELL_BUILD, "presentationOptions 가 든 APK 의 versionCode 가 기준보다 작다");
  assert.equal(shellShowsForeground(String(FOREGROUND_SHELL_BUILD)), true);
  assert.equal(shellShowsForeground("2"), false);
  assert.equal(shellShowsForeground(null), false);
});

test("② 앱이 채널을 만들고(안드로이드) · 옛 껍데기만 앱 안 안내로 · 플러그인이 없어도 안 깨진다", () => {
  const src = code("src/lib/nativepush.ts");
  assert.match(body(src, "async function createChannels("), /P\.createChannel\(\{ id: c\.id[\s\S]*?\.catch\(\(\) => undefined\)/);
  const start = body(src, "export async function startNativePush(");
  assert.match(start, /await createChannels\(P\)/);
  assert.match(start, /const foreground = shellShowsForeground\(await shellBuild\(\)\)/);
  assert.match(start, /addListener\("pushNotificationReceived", \(n\) => \{\s*if \(foreground\) return;/, "새 APK 에선 시스템이 띄운다 — 두 번 띄우지 않는다");
  assert.match(body(src, "async function pushPlugin("), /pluginAvailable\("PushNotifications"\)/);
  assert.match(body(src, "async function shellBuild("), /pluginAvailable\("App"\)/);
});

// ── 3) 설정의 앱 알림 카드 ────────────────────────────────────────────────────────────

test("③ 알림 카드는 실제 상태를 말한다 — 거절이면 설정 길 + 다시 확인, 아직이면 묻기, 등록 안 됐으면 다시 등록", () => {
  assert.equal(normalizePermission("prompt-with-rationale"), "prompt");
  assert.equal(normalizePermission(undefined), "unavailable");
  const denied = nativePushView({ permission: "denied", token: TOKEN, registered: true });
  assert.equal(denied.action, "recheck");
  assert.match(denied.howTo ?? "", /설정 → 애플리케이션\(앱\) → 하루 → 알림/);
  assert.equal(denied.canTest, false);
  assert.equal(nativePushView({ permission: "prompt", token: null, registered: false }).action, "request");
  assert.equal(nativePushView({ permission: "granted", token: null, registered: false }).action, "register");
  const unsynced = nativePushView({ permission: "granted", token: TOKEN, registered: false });
  assert.equal(unsynced.action, "register");
  const ok = nativePushView({ permission: "granted", token: TOKEN, registered: true });
  assert.equal(ok.tone, "ok");
  assert.equal(ok.action, null);
  assert.equal(ok.canTest, true);
  const ui = code("src/components/PushSettings.tsx");
  assert.doesNotMatch(ui, /앱 알림을 쓰고 있어요\./, "상태와 무관한 고정 문구가 돌아왔다");
  assert.match(ui, /nativePushView\(native\)/);
  assert.match(ui, /sendTestPush\(\{ nativeToken: nativePushToken\(\) \}\)/, "테스트는 이 기기 토큰으로");
  assert.match(ui, /window\.addEventListener\(NATIVE_PUSH_EVENT, read\)/);
});

test("③ 테스트 알림 — 이 기기 토큰 하나에만 보내고 등록 여부를 돌려준다", () => {
  const push = code("src/lib/push.ts");
  const fn = body(push, "export async function sendTestPush(");
  assert.match(fn, /if \(native && !opts\.nativeToken\) return /, "토큰이 없으면 보내지 않고 바로 말한다");
  assert.match(fn, /\{ test: true, native_token: opts\.nativeToken \}/);
  const edge = code("supabase/functions/send-poke-push/index.ts");
  assert.match(edge, /if \(test && nativeToken\) \{\s*const mine = await sendFcm\(sb, \[fromUser\], notice, \{ onlyToken: nativeToken \}\);/, "내 토큰일 때만(user_id = 나)");
  assert.match(edge, /targets: mine\.targets/);
  assert.match(nativeTestMessage({ sent: 0, native: { sent: 0, targets: 0 } }), /등록돼 있지 않아요/);
  assert.match(nativeTestMessage({ sent: 1, native: { sent: 1, targets: 1 } }), /이 휴대폰으로 테스트 알림을 보냈어요/);
  assert.match(nativeTestMessage({ sent: 1 }), /옛 버전/, "옛 함수(native 없음)는 그렇다고 말한다");
  assert.match(nativeTestMessage({ sent: 0, native: { disabled: true } }), /FCM/);
});

// ── 4) 로그아웃 — 받기부터 끊고, 못 지운 행은 다음 실행에 ─────────────────────────────────────

test("④ stopNativePush — 지울 목록에 먼저 적고 → unregister → 서버 삭제, 성공해야 목록에서 뺀다", () => {
  const src = code("src/lib/nativepush.ts");
  const stop = body(src, "export async function stopNativePush(");
  const iAdd = stop.indexOf("addUnbind(store, token)");
  const iUnreg = stop.indexOf("P.unregister()");
  const iServer = stop.indexOf("unbindOnServer(token)");
  assert.ok(iAdd >= 0 && iUnreg > iAdd && iServer > iUnreg, "순서: 적기 → unregister → 서버");
  assert.match(stop, /if \(token && \(await unbindOnServer\(token\)\)\) removeUnbind\(store, token\);/);
  assert.doesNotMatch(stop, /then\(\(\) => undefined, \(\) => undefined\)/, "삭제 실패를 삼키던 모양");
  const unbind = body(src, "async function unbindOnServer(");
  assert.match(unbind, /sb\.rpc\("unregister_native_push", \{ p_token: token \}\)/);
  // 지울 토큰을 먼저 처리한 뒤에 등록한다 — 같은 토큰을 새 계정으로 맡긴 뒤 지우면 새 계정 알림이 끊긴다
  const start = body(src, "export async function startNativePush(");
  assert.ok(start.indexOf("await flushNativeUnbind()") < start.indexOf('addListener("registration"'));
  assert.match(body(src, "async function syncToken("), /removeUnbind\(store, value\)/, "다시 쓰는 토큰은 지울 목록에서 뺀다");
  assert.match(src, /if \(typeof window !== "undefined" && isAndroidApp\(\) && readUnbind\(store\)\.length\) void flushNativeUnbind\(\);/, "로그인 안 한 채 열어도");
});

test("④ 지울 목록 — 토큰 모양만 · 중복 없이 · 최근 10개", () => {
  const m = new Map<string, string>();
  const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  addUnbind(store, "bogus");
  assert.deepEqual(readUnbind(store), []);
  addUnbind(store, TOKEN);
  addUnbind(store, TOKEN);
  assert.deepEqual(readUnbind(store), [TOKEN]);
  for (let i = 0; i < 15; i++) addUnbind(store, `${TOKEN}${i}`);
  assert.equal(readUnbind(store).length, 10);
  removeUnbind(store, `${TOKEN}14`);
  assert.ok(!readUnbind(store).includes(`${TOKEN}14`));
  m.set(UNBIND_KEY, "{not json");
  assert.deepEqual(readUnbind(store), [], "깨진 값이어도 던지지 않는다");
});

// ── 5) 토큰 정리 · 상한(migration) ────────────────────────────────────────────────────

const MIG = "supabase/migrations/20261107020000_native_push_hardening.sql";

test("⑤ register_native_push — 토큰 모양 · 512자 · 최신 5개(등록할 때 그 사용자만) · migration 은 행을 일괄 삭제하지 않는다", () => {
  const m = sql(MIG);
  const reg = m.slice(m.indexOf("create or replace function public.register_native_push("), m.indexOf("create or replace function public.unregister_native_push("));
  assert.match(reg, /char_length\(p_token\) > 512/);
  assert.match(reg, /p_token !~ '\^\[A-Za-z0-9:_-\]\+\$'/);
  assert.match(reg, /errcode = 'PT400'/);
  assert.match(reg, /where t\.user_id = v_uid\s+and t\.token <> p_token/, "지금 등록한 토큰은 안 지운다");
  assert.match(reg, /offset 5/);
  assert.match(reg, /security definer\s+set search_path = public/);
  // 함수 본문($$ … $$) 밖에 delete 가 없다 = 이 파일이 적용될 때 기존 행을 안 지운다
  const outside = m.replace(/\$\$[\s\S]*?\$\$/g, "");
  assert.doesNotMatch(outside, /\bdelete\b/i);
  assert.doesNotMatch(outside, /\btruncate\b|\bdrop table\b/i);
  // 앱 · 서버 · DB 가 같은 토큰 모양을 쓴다
  assert.equal(isFcmTokenShape(TOKEN), true);
  assert.equal(isFcmTokenShape("x".repeat(19)), false);
  assert.equal(isFcmTokenShape("x".repeat(513)), false);
  assert.equal(isFcmTokenShape("abc def ghi jkl mno pqr"), false);
  assert.match(code("supabase/functions/send-poke-push/index.ts"), /\/\^\[A-Za-z0-9:_-\]\{20,512\}\$\/\.test\(native_token\)/);
});

test("⑤ unregister_native_push — 그 토큰 행만 지운다 · anon 도 부른다 · public 은 막는다", () => {
  const m = sql(MIG);
  const fn = m.slice(m.indexOf("create or replace function public.unregister_native_push("));
  assert.match(fn, /delete from public\.native_push_tokens where token = p_token;/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf("$$;")), /auth\.uid\(\)|update |insert /, "토큰 행 삭제 말고 다른 효과가 없다");
  assert.match(m, /revoke all on function public\.unregister_native_push\(text\) from public;/);
  assert.match(m, /grant execute on function public\.unregister_native_push\(text\) to anon, authenticated;/);
  assert.match(m, /revoke all on function public\.register_native_push\(text, text\) from public, anon;/);
});

// ── 5) fcm.ts — 실제로 돌려 본다(가짜 fetch · 가짜 DB) ─────────────────────────────────────

type FcmMod = {
  sendFcm: (sb: unknown, ids: string[], msg: { title: string; body: string; url?: string; category?: string }, opts?: { onlyToken?: string }) => Promise<{ sent: number; failed: number; transient: number; targets: number; disabled?: boolean }>;
  channelFor: (c?: string) => string;
  isDeadToken: (status: number | undefined, text: string) => boolean;
};
const fcmUrl = pathToFileURL(join(root, "supabase/functions/_shared/fcm.ts")).href;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
let denoEnv: Record<string, string | undefined> = {};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => denoEnv[k] } };

type Row = { token: string; user_id: string };
function fakeSb(rows: Row[], o: { selectThrows?: boolean; deleteThrows?: boolean } = {}) {
  const deleted: string[] = [];
  const sb = {
    from() {
      const filters: Array<(r: Row) => boolean> = [];
      let del = false;
      const q = {
        select: () => q,
        in: (col: keyof Row, vals: string[]) => (filters.push((r) => vals.includes(r[col])), q),
        delete: () => ((del = true), q),
        eq: (col: keyof Row, v: string) => {
          if (del) {
            if (o.deleteThrows) return Promise.reject(new Error("db down"));
            deleted.push(v);
            return Promise.resolve({ error: null });
          }
          filters.push((r) => r[col] === v);
          return q;
        },
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          (o.selectThrows ? Promise.reject(new Error("db down")) : Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))).map((r) => ({ token: r.token })), error: null })).then(res, rej),
      };
      return q;
    },
  };
  return { sb, deleted };
}
type Reply = { status: number; text: string } | "throw";
const sent: Array<{ token: string; channel: string }> = [];
let replies: Record<string, Reply> = {};
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
  const msg = JSON.parse(String(init?.body)).message;
  sent.push({ token: msg.token, channel: msg.android.notification.channel_id });
  const r = replies[msg.token] ?? { status: 200, text: "{}" };
  if (r === "throw") throw new Error("network");
  return new Response(r.text, { status: r.status });
}) as typeof fetch;
const silence = () => {
  const orig = console.error;
  console.error = () => {};
  return () => void (console.error = orig);
};

test("⑤ fcm — 죽은 토큰(404 · UNREGISTERED · 400 토큰 탓 · 403 SENDER_ID_MISMATCH)만 지우고, 본문 탓 400 · 500 · 네트워크는 남긴다", async () => {
  denoEnv = { FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "e@x", private_key: privateKey }) };
  const fcm = (await import(fcmUrl)) as FcmMod;
  const t = (n: string) => `tok_${n}_${"a".repeat(30)}`;
  replies = {
    [t("ok")]: { status: 200, text: "{}" },
    [t("gone")]: { status: 404, text: '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}' },
    [t("bad")]: { status: 400, text: '{"error":{"message":"The registration token is not a valid FCM registration token","status":"INVALID_ARGUMENT"}}' },
    [t("other")]: { status: 403, text: '{"error":{"status":"PERMISSION_DENIED","details":[{"errorCode":"SENDER_ID_MISMATCH"}]}}' },
    [t("payload")]: { status: 400, text: '{"error":{"message":"Invalid value at \'message.android.notification.color\'","status":"INVALID_ARGUMENT"}}' },
    [t("busy")]: { status: 503, text: '{"error":{"status":"UNAVAILABLE"}}' },
    [t("net")]: "throw",
  };
  const rows = Object.keys(replies).map((token) => ({ token, user_id: "u1" }));
  const { sb, deleted } = fakeSb([...rows, { token: t("stranger"), user_id: "u2" }]);
  const restore = silence();
  const r = await fcm.sendFcm(sb, ["u1"], { title: "t", body: "b", category: "poke" });
  restore();
  assert.equal(r.targets, 7, "u2 의 토큰은 안 고른다");
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 6);
  assert.equal(r.transient, 3);
  assert.deepEqual(deleted.sort(), [t("bad"), t("gone"), t("other")].sort());
  assert.ok(sent.every((s) => s.channel === "poke"), "쿡은 poke 채널");
  assert.equal(fcm.isDeadToken(400, '{"error":{"status":"INVALID_ARGUMENT","message":"Request contains an invalid argument."}}'), false);

  sent.length = 0;
  const only = await fcm.sendFcm(sb, ["u1"], { title: "t", body: "b" }, { onlyToken: t("ok") });
  assert.equal(only.targets, 1);
  assert.deepEqual(sent.map((s) => s.token), [t("ok")], "이 기기 토큰에만");
  assert.equal(sent[0].channel, "activity");
  const stranger = await fcm.sendFcm(sb, ["u1"], { title: "t", body: "b" }, { onlyToken: t("stranger") });
  assert.equal(stranger.targets, 0, "남의 토큰을 넘겨도 내 것이 아니면 안 보낸다");
});

test("⑤ fcm — 어떤 실패도 부르는 쪽으로 던지지 않는다(DB · 삭제 · 네트워크 · 비밀값 없음)", async () => {
  const fcm = (await import(fcmUrl)) as FcmMod;
  const t = `tok_gone_${"b".repeat(30)}`;
  replies = { [t]: { status: 404, text: "UNREGISTERED" } };
  const restore = silence();
  try {
    const a = await fcm.sendFcm(fakeSb([{ token: t, user_id: "u1" }], { selectThrows: true }).sb, ["u1"], { title: "t", body: "b" });
    assert.equal(a.sent, 0);
    assert.ok(a.transient >= 1);
    const b = await fcm.sendFcm(fakeSb([{ token: t, user_id: "u1" }], { deleteThrows: true }).sb, ["u1"], { title: "t", body: "b" });
    assert.equal(b.failed, 1);
    const c = await fcm.sendFcm(null, ["u1"], { title: "t", body: "b" });
    assert.equal(c.sent, 0, "sb 가 없어도");
    assert.deepEqual(await fcm.sendFcm(fakeSb([]).sb, [], { title: "t", body: "b" }), { sent: 0, failed: 0, transient: 0, targets: 0 });
    denoEnv = {};
    const fresh = (await import(`${fcmUrl}?disabled`)) as FcmMod;
    const d = await fresh.sendFcm(fakeSb([{ token: t, user_id: "u1" }]).sb, ["u1"], { title: "t", body: "b" });
    assert.equal(d.disabled, true, "비밀값이 없으면 건너뛰었다고 말한다");
  } finally {
    restore();
  }
  // 모양으로도: 함수 전체가 try … catch 안
  const src = code("supabase/functions/_shared/fcm.ts");
  const fn = body(src, "export async function sendFcm(");
  assert.match(fn, /const result: FcmResult = [^\n]+\n\s*try \{/);
  assert.match(fn, /\} catch \(e\) \{\s*result\.transient\+\+;[\s\S]*\}\s*return result;\s*\}$/);
  assert.match(body(fn, "async ({ token }) =>"), /^async \(\{ token \}\) => \{\s*try \{/, "토큰마다도 감싼다");
});

test("⑤ 채널 — 서버 channelFor 의 답 = 앱이 만드는 채널", async () => {
  const fcm = (await import(fcmUrl)) as FcmMod;
  const ids = new Set(NATIVE_CHANNELS.map((c) => c.id));
  for (const cat of [undefined, "poke", "dday", "question", "remind", "log", "diary", "interact", "letter", "bucket", "moodq", "rank", "event"]) {
    assert.ok(ids.has(fcm.channelFor(cat) as (typeof NATIVE_CHANNELS)[number]["id"]), `${cat} → ${fcm.channelFor(cat)}`);
  }
  assert.equal(fcm.channelFor("poke"), "poke");
  assert.equal(fcm.channelFor("dday"), "reminders");
  assert.equal(fcm.channelFor("question"), "question");
  assert.equal(fcm.channelFor("remind"), DEFAULT_CHANNEL_ID);
  const dr = code("supabase/functions/daily-reminders/index.ts");
  assert.match(dr, /url: reminderUrl\(claimed\),\s*category: "dday",/);
  assert.equal((dr.match(/category: "question"/g) ?? []).length, 2, "아침 · 저녁 질문 둘 다");
  assert.match(body(dr, "async function sendTo("), /const \{ category: _category, \.\.\.web \} = body;\s*const payload = JSON\.stringify\(web\);/, "웹 페이로드엔 category 를 안 싣는다(SW 가 tag 로 쓴다)");
  assert.match(code("supabase/functions/activity-nudge/index.ts"), /category: "remind" \}\)/);
});

// ── 7) 돌아올 때 토큰 다시 맞추기 ─────────────────────────────────────────────────────

test("⑦ 앱으로 돌아올 때 지금 토큰을 받아 저장한 것과 견주고, 다르면(또는 다른 사용자면) 다시 등록한다", () => {
  const src = code("src/lib/nativepush.ts");
  const start = body(src, "export async function startNativePush(");
  assert.match(start, /document\.addEventListener\("visibilitychange", recheck\)/);
  assert.match(start, /document\.addEventListener\("resume", recheck\)/);
  assert.match(body(start, "const recheck = () =>"), /if \(receive === "granted"\) await P\.register\(\);/);
  const sync = body(src, "async function syncToken(");
  assert.match(sync, /if \(!force && ls\.get\(SYNCED_KEY\) === syncedMark\(uid, value\)\) return emit\(\);/);
  assert.match(sync, /ls\.remove\(SYNCED_KEY\)/, "실패하면 다음에 다시");
  assert.match(start, /forceNext = true;/, "앱을 켠 첫 등록은 늘 서버에 맡긴다(상한 5개로 밀려났어도 되살린다)");
});

// ── 8) 웹 푸시를 쓰는 함수 — FCM 은 받는 사람 설정을 거른 뒤에만 ───────────────────────────────

test("⑧ webpush 를 쓰는 엣지 함수는 모두 sendFcm 을 부르고, 설정 · 조용시간 필터 뒤에만 부른다", () => {
  const dir = join(root, "supabase/functions");
  const users = readdirSync(dir)
    .filter((d) => d !== "_shared" && existsSync(join(dir, d, "index.ts")))
    .filter((d) => /from "npm:web-push@/.test(read(`supabase/functions/${d}/index.ts`)))
    .sort();
  assert.deepEqual(users, ["activity-nudge", "daily-reminders", "send-poke-push"], "웹 푸시를 쓰는 새 함수 — 앱 기기(FCM)도 보내는지 · 필터 순서를 여기에 더한다");
  const calls = (s: string) => [...s.matchAll(/sendFcm\(/g)].map((m) => m.index!);
  for (const d of users) assert.match(code(`supabase/functions/${d}/index.ts`), /import \{ sendFcm \} from "\.\.\/_shared\/fcm\.ts";/, d);

  const poke = code("supabase/functions/send-poke-push/index.ts");
  const firstFilter = poke.indexOf("await allowed(");
  assert.ok(firstFilter > 0);
  for (const i of calls(poke)) assert.ok(i > firstFilter, "send-poke-push: allowed() 앞의 sendFcm");
  assert.match(poke, /ids = await allowed\(ids, category,/);
  assert.match(poke, /sendFcm\(sb, \[v\.user_id\], notice\)/);
  assert.match(poke, /for \(const v of victims\.filter\(\(x\) => to\.includes\(x\.user_id\)\)\)/, "역전 알림도 거른 사람에게만");

  const nudge = code("supabase/functions/activity-nudge/index.ts");
  const gate = nudge.indexOf("if (!canNudge(pref, kstHour)) continue;");
  assert.ok(gate > 0);
  for (const i of calls(nudge)) assert.ok(i > gate, "activity-nudge: canNudge 앞의 sendFcm");
  const can = body(nudge, "function canNudge(");
  assert.match(can, /p\.prefs\["remind"\] === false/);
  assert.match(can, /inQuietHours\(/);

  const dr = code("supabase/functions/daily-reminders/index.ts");
  const sendTo = body(dr, "async function sendTo(");
  const deliver = body(dr, "async function deliver(");
  assert.equal(calls(dr).length, 1);
  assert.ok(sendTo.includes("sendFcm("), "daily-reminders: sendFcm 은 sendTo 안에만");
  const sendToCalls = [...dr.matchAll(/(?<!function )\bsendTo\(sb/g)].map((m) => m.index!);
  assert.equal(sendToCalls.length, 1);
  assert.ok(sendToCalls[0] > dr.indexOf(deliver) && sendToCalls[0] < dr.indexOf(deliver) + deliver.length, "sendTo 는 deliver 에서만");
  const quiet = dr.indexOf("if (inQuietHours(hour, pref?.quiet_start, pref?.quiet_end)) continue;");
  assert.ok(quiet > 0);
  const deliveries = [...dr.matchAll(/await deliver\(sb,/g)].map((m) => m.index!);
  assert.equal(deliveries.length, 3);
  for (const i of deliveries) assert.ok(i > quiet, "조용시간 앞의 deliver");
  assert.ok(dr.lastIndexOf("pref?.prefs?.dday !== false", deliveries[0]) > quiet);
  for (const i of deliveries.slice(1)) assert.ok(dr.lastIndexOf("pref?.prefs?.question !== false", i) > quiet);
});

// ── 6) IPA 워크플로 ────────────────────────────────────────────────────────────────

test("⑥ build-ipa — 빌드는 읽기 전용 · 올리기만 쓰기 · 자격 증명 안 남김 · 액션은 SHA 고정 · 올리기는 안 끊는다", () => {
  const raw = read(".github/workflows/build-ipa.yml");
  const y = raw.replace(/#[^\n]*/g, "");
  assert.match(raw, /docs\/APP-INSTALL\.md/);
  assert.doesNotMatch(raw, /APP-RELEASE\.md/, "머리 주석이 출시 문서를 가리켰다");
  assert.match(y, /^permissions:\s*\n\s+contents: read/m);
  const build = y.slice(y.indexOf("\n  build:"), y.indexOf("\n  publish:"));
  const publish = y.slice(y.indexOf("\n  publish:"));
  assert.doesNotMatch(build, /contents: write/);
  assert.match(build, /persist-credentials: false/);
  assert.match(build, /cancel-in-progress: true/);
  assert.match(publish, /needs: build/);
  assert.match(publish, /contents: write/);
  assert.match(publish, /cancel-in-progress: false/);
  assert.doesNotMatch(publish, /npm |npx |actions\/checkout/, "쓰기 권한 job 에서 남의 코드를 돌리지 않는다");
  assert.doesNotMatch(y, /delete-asset|release delete/, "지운 뒤 올리면 그 사이 파일이 없다");
  assert.match(publish, /gh release upload app-latest Haru-unsigned\.ipa --clobber/);
  const uses = [...y.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 4);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u}: 태그 대신 커밋 SHA`);
});

test("3초 로그 '기기에 저장'도 앱에서 실패를 삼키지 않는다", () => {
  const src = readFileSync(join(root, "src/lib/logdraft.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /shareFileInApp\([^)]*\)\.catch\(\(\) => undefined\)/);
  assert.match(src, /\.catch\(\(\) => showNotice\(/);
});

