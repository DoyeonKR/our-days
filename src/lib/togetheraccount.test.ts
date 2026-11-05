// 함께 · 계정 · 알림 리뷰 lock (2026-11-05) — README §10.11.
//
//  1) 연결 해제가 멤버 행만 지워 초대코드가 살아 있었다 → 다음에 들어온 사람이 나간 사람의 기록을 다 봤다.
//  2) 로그아웃해도 이 기기 푸시 구독이 남아 로그아웃한 계정의 알림이 계속 왔다.
//  3) 초대코드 시도 제한이 없고 오류 문구가 코드의 존재를 알려 줬다.
//  4) reset-password 가 그냥 로그인된 세션만으로 현재 비밀번호 없이 비밀번호를 바꿔 줬다.
//  5) 알림 설정 불러오기 오류를 삼켜 실패 표시가 안 떴다.  6) 쿡 입력창이 보낼 때마다 막혀 모바일 자판이 닫혔다.
//  7) 쓰던 중 세션이 풀리면 익명 계정이 조용히 생겼다.  8) ?pokeReply 링크가 확인 없이 쿡을 보냈다.
//  9) 읽음 15초 게이트에 마지막 쓰기가 없었다.  10) 데스크톱에서 쿡 알림이 두 번 떴다.  11) 만료된 코드도 공유 버튼이 살아 있었다.
//  12) 내보내기에 낚시 · 합치기 기록이 없었다.  13) 한 계정이 두 공간에 들 수 있었다.  14) 조용시간이 KST 고정이었다.
//  +) 계정 삭제가 일정이 있는 커플 계정에서 events_created_by_immutable 에 막혀 통째로 되돌려졌다.
// 실제 동작(트리거 · 시도 제한 · 지우고 나가기 · 계정 삭제)은 PGlite 로 schema.sql 을 올려 확인했다(README §10.11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOUNT_EXPORT_TABLES } from "./accountPolicy.ts";
import { isReplyToken, replyKey, replyRecordOk, POKE_REPLY_CACHE, POKE_REPLY_TTL_MS } from "./pokereply.ts";
import { isInviteExpired } from "./together.ts";
import { LEAVE_WIPE_DETAIL, SOLO_LEAVE_DETAIL } from "./solospace.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const ts = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const jsx = (p: string) => ts(p).replace(/\{\s*\}/g, "");
const sqlNoComments = (s: string) => s.replace(/--[^\n]*/g, "");
const fnBody = (src: string, name: string) => {
  const i = src.indexOf(name);
  assert.ok(i >= 0, `${name} 를 못 찾았다`);
  return src.slice(i, src.indexOf("\n}\n", i));
};
const sqlFn = (sql: string, sig: string) => {
  const i = sql.indexOf(sig);
  assert.ok(i >= 0, `${sig} 를 못 찾았다`);
  return sql.slice(i, sql.indexOf("$$;", i));
};

const MIG = "supabase/migrations/20261106040000_together_account.sql";
const migration = read(MIG).trim();
const mig = sqlNoComments(migration);
const schema = read("supabase/schema.sql");

test("★ schema.sql 끝에 migration 이 글자 그대로 한 번 붙어 있다 · 한 트랜잭션", () => {
  assert.equal(schema.split(migration).length - 1, 1, "schema.sql 의 복사본이 없거나 다르거나 두 번이다");
  assert.ok(schema.trimEnd().endsWith(migration), "다른 migration 보다 뒤(끝)에 있어야 신규 bootstrap 이 최종 정의를 쓴다");
  assert.match(mig, /^\s*begin;/);
  assert.match(mig, /commit;\s*$/);
  assert.doesNotMatch(mig, /errcode\s*=\s*'(40001|40P01)'/, "PostgREST 가 끝없이 재시도한다(§11 장애)");
  assert.doesNotMatch(mig, /\bdrop\s+table\b/i);
});

// ── 1) 연결 해제 ──────────────────────────────────────────────────────────────

test("★ 멤버가 빠지면(옛 앱의 직접 delete 포함) 코드가 막히고, 아무도 없으면 공간이 닫힌다", () => {
  assert.match(mig, /add column if not exists closed_at timestamptz/);
  assert.match(mig, /create trigger couple_members_after_delete after delete on public\.couple_members\s+for each row execute function private\.on_member_left\(\)/);
  const t = sqlFn(mig, "function private.on_member_left()");
  assert.match(t, /security definer set search_path = ''/, "옛 앱(authenticated)은 couples 의 만료 칸을 못 고친다 — definer 라야 한다");
  assert.match(t, /invite_expires_at = case when c\.invite_expires_at is null or c\.invite_expires_at > now\(\) then now\(\)/);
  assert.match(t, /not exists \(select 1 from public\.couple_members m where m\.couple_id = c\.id\) then now\(\)/);
  assert.match(mig, /revoke all on function private\.on_member_left\(\) from public, anon, authenticated;/);
});

test("★ join_couple 은 닫힌 공간 · 만료 · 정원을 거절한다", () => {
  const j = sqlFn(mig, "create function public.join_couple(p_code text, p_nickname text)");
  assert.match(j, /v_row\.closed_at is null/);
  assert.match(j, /v_row\.invite_expires_at is null or v_row\.invite_expires_at > now\(\)/);
  assert.match(j, /if v_count < 2 then/);
});

test("★ leave_couple — 내 멤버십만 · 지우기는 내 것만 · 파일 경로는 멤버일 때만 · 로그인 사용자만", () => {
  const l = sqlFn(mig, "create or replace function public.leave_couple(p_couple uuid, p_wipe_mine boolean default false)");
  assert.match(l, /delete from public\.couple_members where couple_id = p_couple and user_id = v_uid;/);
  for (const [t, col] of [
    ["deco_entries", "created_by"], ["couple_photos", "created_by"], ["couple_logs", "created_by"], ["pokes", "from_user"],
    ["couple_events", "created_by"], ["couple_bucket", "created_by"], ["entry_comments", "created_by"], ["entry_reactions", "created_by"],
    ["log_comments", "created_by"], ["log_reactions", "user_id"], ["photo_comments", "created_by"], ["photo_reactions", "created_by"],
    ["poke_reactions", "created_by"], ["qa_answers", "user_id"], ["mood_checkins", "user_id"], ["activity_events", "actor_user"],
  ]) {
    assert.match(l, new RegExp(`delete from public\\.${t} where couple_id = p_couple and ${col} = v_uid;`), `${t} 를 내 것만 지우지 않는다`);
  }
  assert.doesNotMatch(l.replace(/delete from public\.\w+ where couple_id = p_couple and \w+ = v_uid;/g, ""), /delete from/, "내 것 밖을 지우는 delete 가 있다");
  assert.match(l, /if coalesce\(p_wipe_mine, false\) then/, "기본은 지우지 않는다");
  assert.match(l, /set_config\('ourdays\.suppress_activity', 'on', true\)/);
  const p = sqlFn(mig, "create or replace function public.my_couple_media_paths(p_couple uuid)");
  assert.match(p, /created_by = auth\.uid\(\)/);
  assert.match(p, /exists \(select 1 from public\.couple_members m where m\.couple_id = p_couple and m\.user_id = auth\.uid\(\)\)/);
  for (const sig of ["leave_couple\\(uuid, boolean\\)", "my_couple_media_paths\\(uuid\\)", "join_couple\\(text, text\\)", "rotate_invite_code\\(uuid, boolean\\)", "create_couple\\(text, date\\)"]) {
    assert.match(mig, new RegExp(`revoke execute on function public\\.${sig} from public, anon;`), sig);
    assert.match(mig, new RegExp(`grant execute on function public\\.${sig} to authenticated;`), sig);
  }
});

test("★ 떠난 사람의 기록이 남은 공간에 새 코드를 내려면 확인(p_confirm) — 옛 앱 호출(p_couple 하나)도 같은 함수에 닿는다", () => {
  assert.match(mig, /drop function if exists public\.rotate_invite_code\(uuid\);/, "옛 (uuid) 판이 남으면 p_couple 하나로 부를 때 어느 쪽인지 모호해진다");
  const r = sqlFn(mig, "create or replace function public.rotate_invite_code(p_couple uuid, p_confirm boolean default false)");
  assert.match(r, /not coalesce\(p_confirm, false\) and private\.couple_has_departed_content\(p_couple\)/);
  assert.match(r, /errcode = 'PT412'/);
  const d = sqlFn(mig, "function private.couple_has_departed_content(p_couple uuid)");
  for (const t of ["deco_entries", "couple_photos", "couple_logs", "pokes", "qa_answers", "couple_events", "photo_comments"]) assert.ok(d.includes(`public.${t} t`), t);
  const couple = ts("src/lib/couple.ts");
  assert.match(fnBody(couple, "export async function rotateInviteCode("), /error\?\.code === "PT412"\) throw new InviteNeedsConfirmError/);
  const sync = ts("src/components/CoupleSync.tsx");
  const rot = fnBody(sync, "async function handleRotateInvite()");
  assert.match(rot, /first instanceof InviteNeedsConfirmError/);
  assert.match(rot, /rotateInviteCode\(couple\.id, true\)/);
  assert.match(rot, /DEPARTED_CONTENT_WARNING/);
  assert.match(couple, /DEPARTED_CONTENT_WARNING = "이전 상대가 남긴 기록이 새로 들어오는 사람에게 보여요"/);
});

test("★ 앱: 나가기 = leave_couple RPC · 지우기면 파일 먼저 · 서명 URL 캐시를 비운다 · 화면에 '내 기록도 지우고 나가기'", () => {
  const couple = ts("src/lib/couple.ts");
  const leave = fnBody(couple, "export async function leaveCouple(");
  assert.match(leave, /sb\.rpc\("leave_couple", \{ p_couple: coupleId, p_wipe_mine: wipeMine \}\)/);
  assert.ok(leave.indexOf('rpc("my_couple_media_paths"') < leave.indexOf('rpc("leave_couple"'), "나간 뒤엔 storage 정책이 파일 삭제를 막는다 — 먼저 지운다");
  assert.match(leave, /storage\.from\(PHOTO_BUCKET\)\.remove\(/);
  assert.match(leave, /clearSignedUrlCache\(\)/);
  const sync = jsx("src/components/CoupleSync.tsx");
  assert.match(sync, /checked=\{wipeMine\}/);
  assert.match(sync, /LEAVE_WIPE_LABEL/);
  assert.match(sync, /await leaveCouple\(couple\.id, wipe\)/);
  const detail = sync.slice(sync.indexOf("async function handleLeave"), sync.indexOf("await leaveCouple("));
  assert.doesNotMatch(detail, /기록이 지워지지는 않아서/, "옛 문구: 지우지 않는다며 아무 코드로나 다시 들어올 수 있던 때의 말");
  assert.match(detail, /지금 초대코드는 바로 막혀서/);
  assert.match(detail, /내가 남긴 기록은 지워지지 않고/, "남긴 기록이 상대에게 계속 보인다는 걸 말한다");
  assert.match(SOLO_LEAVE_DETAIL, /닫혀서 초대코드로도 다시 들어올 수 없/);
  assert.match(LEAVE_WIPE_DETAIL, /되돌릴 수 없/);
});

// ── 2) 로그아웃 · 이 기기 푸시 끄기 ─────────────────────────────────────────────

test("★ 로그아웃은 signOut 전에 이 기기 구독을 지운다 · 설정에 '이 기기 푸시 끄기'", () => {
  const auth = ts("src/lib/auth.ts");
  const out = fnBody(auth, "export async function signOutAccount(");
  assert.ok(out.indexOf("disablePushOnThisDevice()") > 0 && out.indexOf("disablePushOnThisDevice()") < out.indexOf("sb.auth.signOut()"),
    "행은 본인 것만 지워진다(RLS) — 세션이 있을 때 먼저");
  const push = ts("src/lib/push.ts");
  const off = fnBody(push, "export async function disablePushOnThisDevice(");
  assert.match(off, /\.from\("push_subscriptions"\)\.delete\(\)\.eq\("endpoint", sub\.endpoint\)/, "이 기기 endpoint 하나만 — 다른 기기 구독은 그대로");
  assert.match(off, /sub\.unsubscribe\(\)/);
  const ps = jsx("src/components/PushSettings.tsx");
  assert.match(ps, /aria-label="이 기기 푸시 끄기"/);
  assert.match(ps, /role="switch"/);
});

// ── 3) 초대코드 시도 제한 ──────────────────────────────────────────────────────

test("★ join_couple: 사용자마다 1시간에 실패 10번 · 한 문구 · 실패 기록은 정상 반환(400)으로 남긴다", () => {
  assert.match(mig, /create table if not exists private\.invite_attempts/);
  assert.match(mig, /alter table private\.invite_attempts enable row level security;/);
  assert.match(mig, /revoke all on table private\.invite_attempts from public, anon, authenticated;/);
  const j = sqlFn(mig, "create function public.join_couple(p_code text, p_nickname text)");
  assert.match(j, /v_try\.attempts >= 10/);
  assert.match(j, /interval '1 hour'/);
  assert.match(j, /errcode = 'PT429'/);
  assert.match(j, /set_config\('response\.status', '400', true\)/, "예외를 내면 시도 기록도 되돌려진다");
  assert.match(j, /'message', '초대코드를 찾을 수 없거나 만료됐어요\. 상대에게 새 코드를 받아 주세요\.'/);
  assert.doesNotMatch(j, /이미 두 명이 연결된|초대 링크가 만료됐어요|errcode = 'P0002'/, "없음 · 만료 · 정원이 다른 말이면 살아 있는 코드를 알려 준다");
  // 문구에 '찾을 수 없'이 있어야 옛 앱 · 새 앱의 재연결 버튼이 확정 실패로 알아듣는다
  assert.match(ts("src/components/CoupleSync.tsx"), /\/만료\|찾을 수 없\|이미 두 명\|이미 다른 커플\//);
  const couple = ts("src/lib/couple.ts");
  assert.match(fnBody(couple, "export async function joinCouple("), /if \(!row\?\.id\) throw new Error/, "id 없는 응답을 커플로 믿지 않는다");
});

// ── 4) 비밀번호 재설정 ─────────────────────────────────────────────────────────

test("★ reset-password: 복구 링크를 받은 탭만 현재 비밀번호 없이 · 아니면 현재 비밀번호를 확인한다", () => {
  const auth = ts("src/lib/auth.ts");
  const c = fnBody(auth, "export async function consumePasswordRecoveryUrl(");
  assert.match(c, /Promise<\{ recovery: boolean \}>/);
  const tail = c.slice(c.lastIndexOf("sb.auth.getSession()"));
  assert.match(tail, /return \{ recovery: hasFreshRecovery\(\) \};/, "세션만 있는 경우를 복구로 치면 빌린 기기에서 비밀번호를 바꿀 수 있다");
  assert.match(c, /exchangeCodeForSession\(code\)[\s\S]*?markRecovery\(\);\s*return \{ recovery: true \}/);
  assert.match(fnBody(auth, "export async function changePasswordWithCurrent("), /await signInEmail\(email, currentPassword\);/);
  const page = jsx("src/app/reset-password/page.tsx");
  assert.match(page, /if \(recovery\) await changePassword\(password\);\s*else await changePasswordWithCurrent\(password, current\);/);
  assert.match(page, /aria-label="현재 비밀번호"/);
});

// ── 5) 알림 설정 불러오기 ──────────────────────────────────────────────────────

test("★ getMyNotifyPrefs 는 오류를 던진다(기본값으로 덮어쓰지 않게)", () => {
  assert.match(fnBody(ts("src/lib/notify.ts"), "export async function getMyNotifyPrefs("), /if \(error\) throw new Error\(error\.message\);/);
});

// ── 6) 쿡 입력창 ───────────────────────────────────────────────────────────────

test("★ 쿡 직접 입력창은 보내는 동안에도 열려 있다(자판 유지) — 막는 건 보내기 버튼", () => {
  const sync = jsx("src/components/CoupleSync.tsx");
  const input = sync.slice(sync.indexOf('id="poke-custom-message"'), sync.indexOf("/>", sync.indexOf('id="poke-custom-message"')));
  assert.doesNotMatch(input, /disabled=/);
  assert.match(sync, /disabled=\{busy \|\| !customMsg\.trim\(\)\}/);
  assert.match(sync, /pokeSendLock\.current = true/);
});

// ── 7) 세션 상실 ───────────────────────────────────────────────────────────────

test("★ 세션이 풀리면 익명 계정을 만들지 않고 로그인 화면으로", () => {
  const couple = ts("src/lib/couple.ts");
  assert.doesNotMatch(couple, /signInAnonymously/, "빈 익명 공간이 생겨 '기록이 다 사라졌다'가 된다");
  const ensure = fnBody(couple, "export async function ensureAnonAuth(");
  assert.match(ensure, /announceSessionLost\(\);\s*throw new Error\(SESSION_LOST_MESSAGE\)/);
  const session = ts("src/lib/session.ts");
  assert.match(session, /if \(event === "SIGNED_OUT"\) fn\(\);/);
  const page = ts("src/app/page.tsx");
  assert.match(page, /return onSessionLost\(\(\) => \{\s*setAuthed\(false\);/);
  assert.match(page, /<AuthGate notice=\{sessionLost \? SESSION_LOST_MESSAGE : null\}/);
});

// ── 8) 빠른 답장 토큰 ──────────────────────────────────────────────────────────

test("pokereply: 토큰 모양 · 키 · 저장값 판정(종류 · 만료 · 너무 먼 만료)", () => {
  assert.equal(POKE_REPLY_CACHE, "ourdays:poke-reply-tokens");
  assert.ok(isReplyToken("0123456789abcdef0123456789abcdef"));
  for (const bad of ["", "abc", "0123456789ABCDEF0123456789ABCDEF", null, 1, "../../x"]) assert.ok(!isReplyToken(bad), String(bad));
  assert.equal(replyKey("https://a.b", "f".repeat(32)), `https://a.b/__ourdays/poke-reply/${"f".repeat(32)}`);
  const now = 1_000_000;
  assert.ok(replyRecordOk({ kind: "love", exp: now + 1000 }, "love", now));
  assert.ok(!replyRecordOk({ kind: "miss", exp: now + 1000 }, "love", now), "다른 종류");
  assert.ok(!replyRecordOk({ kind: "love", exp: now }, "love", now), "지난 토큰");
  assert.ok(!replyRecordOk({ kind: "love", exp: now + POKE_REPLY_TTL_MS + 1 }, "love", now), "10분보다 먼 만료는 위조");
  assert.ok(!replyRecordOk(null, "love", now));
});

test("★ ?pokeReply 는 토큰이 맞을 때만 바로 보내고 아니면 확인창 · 주소에서 토큰도 지운다", () => {
  const sync = ts("src/components/CoupleSync.tsx");
  const i = sync.indexOf('params.get("pokeReply")');
  const block = sync.slice(i, sync.indexOf("}, [couple]);", i));
  assert.match(block, /if \(await consumeToken\(token, kind\)\) \{\s*sendReplyRef\.current\(kind\);\s*return;\s*\}/);
  assert.match(block, /const ok = await confirmDialog\(/);
  assert.match(block, /if \(ok\) sendReplyRef\.current\(kind\);/);
  assert.match(block, /u\.searchParams\.delete\("t"\)/);
  const pr = ts("src/lib/pokereply.ts");
  assert.match(fnBody(pr, "export async function consumeToken("), /await c\.delete\(key\);/, "1회용 — 읽으면 지운다");
});

// ── 9) 읽음 trailing ───────────────────────────────────────────────────────────

test("★ markChatRead: 게이트 안의 마지막 호출을 타이머로 한 번 더 쓴다(부른 시각으로)", () => {
  const m = fnBody(ts("src/lib/couple.ts"), "export async function markChatRead(");
  assert.match(m, /const wait = 15_000 - /);
  assert.match(m, /setTimeout\(\(\) => \{\s*_readTrail\.delete\(coupleId\);\s*void markChatRead\(coupleId, entry\.at\)/);
  assert.match(m, /pending\.at = Math\.max\(pending\.at, at\)/);
  assert.match(m, /last_read_at: new Date\(at\)\.toISOString\(\)/, "쓰는 시각으로 적으면 화면을 떠난 뒤 온 메시지까지 읽음이 된다");
});

// ── 10) 쿡 알림 중복 ───────────────────────────────────────────────────────────

test("★ 페이지 쿡 알림: 이 기기에 푸시 구독이 있으면 SW 에 맡기고, 띄울 땐 tag poke-<커플 id>", () => {
  const sync = ts("src/components/CoupleSync.tsx");
  const f = sync.slice(sync.indexOf("const fireNotification"), sync.indexOf("}, []);", sync.indexOf("const fireNotification")));
  assert.match(f, /if \(pushOnDevice\.current\) return;/);
  assert.match(f, /tag: `poke-\$\{p\.couple_id\}`/);
  const fn = read("supabase/functions/send-poke-push/index.ts");
  assert.match(fn, /tag: `poke-\$\{couple_id\}`/, "SW 가 같은 tag 로 묶을 수 있게 페이로드에 싣는다");
  assert.match(fn, /category: category \|\| undefined,\s*couple_id,/);
});

// ── 11) 만료된 초대 ────────────────────────────────────────────────────────────

test("isInviteExpired — 만료일이 지났거나 이상하면 만료, 없으면(옛 행) 살아 있음", () => {
  const now = Date.parse("2026-11-05T00:00:00Z");
  assert.equal(isInviteExpired("2026-11-04T23:59:59Z", now), true);
  assert.equal(isInviteExpired("2026-11-05T00:00:00Z", now), true);
  assert.equal(isInviteExpired("2026-11-06T00:00:00Z", now), false);
  assert.equal(isInviteExpired(null, now), false);
  assert.equal(isInviteExpired("nope", now), true);
});

test("★ 만료된 코드: 공유 · 복사 · QR 을 끄고 '새 코드 발급'이 주 버튼", () => {
  const sync = jsx("src/components/CoupleSync.tsx");
  assert.match(sync, /const inviteExpired = !!couple && isInviteExpired\(couple\.invite_expires_at\);/);
  assert.match(sync, /\{inviteExpired && \(\s*<button[\s\S]{0,200}?onClick=\{\(\) => void handleRotateInvite\(\)\}/);
  const share = sync.indexOf("onClick={shareCode}");
  assert.ok(sync.lastIndexOf("{!inviteExpired && (", share) > sync.indexOf("const inviteExpired"), "공유 버튼이 만료 가드 밖에 있다");
  assert.match(sync, /\{!inviteExpired && qrDataUrl && \(/);
  assert.match(sync, /isInviteExpired\(couple\.invite_expires_at\)\) \{\s*setQrDataUrl\(null\);/);
});

// ── 12) 내보내기 ───────────────────────────────────────────────────────────────

test("★ 내보내기에 낚시 · 합치기 기록(셋 다 RLS 가 본인 행만)", () => {
  for (const t of ["fish_catches", "merge_scores", "merge_runs"]) {
    assert.ok((ACCOUNT_EXPORT_TABLES as readonly string[]).includes(t), t);
    assert.match(schema, new RegExp(`create policy ${t}_select_own on public\\.${t} for select to authenticated\\s+using \\(user_id = \\(select auth\\.uid\\(\\)\\)\\);`),
      `${t} 를 남의 행까지 읽을 수 있으면 내보내기가 남의 기록을 담는다`);
  }
});

// ── 13) 한 계정 = 한 공간 ──────────────────────────────────────────────────────

test("★ couple_members.user_id unique(겹친 계정이 있으면 건너뛰고 알림) · 만들기 · 합류 · 나가기는 사용자 잠금", () => {
  assert.match(mig, /if exists \(select 1 from public\.couple_members group by user_id having count\(\*\) > 1\) then\s+raise notice/);
  assert.match(mig, /create unique index couple_members_one_per_user on public\.couple_members \(user_id\);/);
  for (const sig of ["create or replace function public.create_couple(p_nickname text, p_start date)", "create function public.join_couple(p_code text, p_nickname text)",
    "create or replace function public.leave_couple(p_couple uuid, p_wipe_mine boolean default false)"]) {
    assert.match(sqlFn(mig, sig), /perform pg_advisory_xact_lock\(hashtextextended\('ourdays:membership:' \|\| v_uid::text, 0\)\);/, sig);
  }
});

// ── 14) 시간대 ─────────────────────────────────────────────────────────────────

test("★ 기기 시간대를 내 멤버 프로필에(다를 때만) · send-poke-push 조용시간은 받는 사람 시간대", () => {
  const couple = ts("src/lib/couple.ts");
  const s = fnBody(couple, "export async function syncMyTimezone(");
  assert.match(s, /if \(!mine \|\| mine\.timezone === tz\) return;/);
  assert.match(fnBody(couple, "export function deviceTimezone("), /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(ts("src/app/page.tsx"), /void syncMyTimezone\(state\.couple\.id, state\.members, myUserId\)/);
  const fn = read("supabase/functions/send-poke-push/index.ts").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /inQuietHours\(hourIn\(tzOf\.get\(id\)\), p\.quiet_start, p\.quiet_end\)/);
  assert.doesNotMatch(fn, /const kstHour/, "KST 고정이 남아 있다");
  assert.match(fn, /\.select\("user_id, nickname, timezone"\)/);
});

// ── 15) 쿡 제목에 애칭 ────────────────────────────────────────────────────────

test("send-poke-push: 쿡 제목에 보낸 사람 애칭(없으면 옛 제목)", () => {
  const fn = read("supabase/functions/send-poke-push/index.ts");
  assert.match(fn, /category === "poke" && senderName \? `💗 \$\{senderName\}님이 쿡 찔렀어요` : "💗 쿡! 상대가 찔렀어요"/);
  assert.match(fn, /senderName = \(rows\.find\(\(m\) => m\.user_id === fromUser\)\?\.nickname \?\? ""\)\.trim\(\)\.slice\(0, 20\)/);
});

// ── +) 계정 삭제 ───────────────────────────────────────────────────────────────

test("★ 일정 작성자 잠금은 앱 사용자에게만 — 계정 삭제(서비스 롤)는 상대에게 넘길 수 있다", () => {
  const f = sqlFn(mig, "create or replace function public.forbid_created_by_change()");
  assert.match(f, /new\.created_by is distinct from old\.created_by\s+and coalesce\(auth\.role\(\)::text, ''\) <> 'service_role'/);
  assert.match(f, /errcode = '42501'/);
  assert.match(mig, /revoke execute on function public\.forbid_created_by_change\(\) from public, anon, authenticated;/);
});
