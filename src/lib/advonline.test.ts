// 대전 · 저장 다듬기 lock (2026-11-09) — README §14.6 '대전 · 저장 다듬기'.
// finish 멱등 · 한 트랜잭션 정산 · start 순서와 busy · KST 하루 한도 · 상승 한도의 방어자 몫 · 보관 크론 무효 · 엔진 409 문구 ·
// 쓰기 표 · 백그라운드 복귀 · 백업 셋 · 등록 전 올리기 · 닉네임 '*' · 싸우던 판 정산 · 기기 사본 먼저 · 대전 현황 · 순위 이웃.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { newSave, normalizeSave, type AdvSave } from "./adventure.ts";
import { DAILY_DUELS, DAILY_GAIN_CAP, SAME_OPP_DAILY } from "./adventurepvp.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const sqlCode = (p: string) => read(p).replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/20261107070000_adventure_finish.sql";
const mig = sqlCode(MIG);
const fn = code("supabase/functions/adventure-battle/index.ts");
const fnBody = (name: string) => {
  const at = mig.indexOf(`function ${name}`);
  assert.ok(at >= 0, name);
  return mig.slice(at, mig.indexOf("$$;", at));
};
const migFiles = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
/** 이 함수를 마지막으로 정의한 migration — 뒤에 다른 파일이 옛 정의로 덮지 않았나 */
const latestDefiner = (name: string) => {
  const re = new RegExp(`create or replace function ${name.replace(".", "\\.")}\\(`);
  return migFiles.filter((f) => re.test(sqlCode(`supabase/migrations/${f}`))).at(-1);
};
const opBlock = (op: string, next: string) => fn.slice(fn.indexOf(`op === "${op}"`), fn.indexOf(next, fn.indexOf(`op === "${op}"`)));

// ── 1 · 2) finish — 한 트랜잭션 · 판 id 로 멱등 ─────────────────────────────────

test("★ 1·2 닫기 · 정산 · delta 는 adventure_finish 한 번 — 함수에 따로 닫거나 정산하는 길이 없다", () => {
  assert.equal(latestDefiner("public.adventure_finish"), "20261107070000_adventure_finish.sql");
  const f = fnBody("public.adventure_finish");
  assert.match(f, /where id = p_match and user_id = p_user\s+for update;/, "판 행을 잠근다(두 요청이 동시에 와도 한 번)");
  assert.match(f, /if m\.status <> 'active' then[\s\S]*?'again', true\);/, "이미 끝난 판은 남긴 결과를 그대로");
  assert.ok(f.indexOf("status = 'done'") < f.indexOf("public.adventure_settle(") && f.indexOf("public.adventure_settle(") < f.indexOf("set delta ="), "닫기 → 정산 → delta 가 한 함수 안");
  assert.match(mig, /revoke all on function public\.adventure_finish\(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer\) from public, anon, authenticated;/);
  assert.match(mig, /grant execute on function public\.adventure_finish\(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer\) to service_role;/);
  // 함수 쪽: 예전의 따로 닫기 · 따로 정산 · 되열기가 없다
  assert.match(fn, /admin\.rpc\("adventure_finish", \{/);
  assert.doesNotMatch(fn, /\.update\(\{ status: "done"/);
  assert.doesNotMatch(fn, /\.update\(\{ status: "active" \}\)/, "정산 실패 뒤 되열던 길");
  assert.doesNotMatch(fn, /admin\.rpc\("adventure_settle"/);
});

test("★ 1 이미 끝난 판의 finish · forfeit 는 200 과 남긴 결과 · 무효는 200 void · 없는 판만 404", () => {
  const blk = opBlock("finish", "bad op");
  assert.match(blk, /if \(!m\) return json\(\{ error: "no match" \}, 404\);/);
  assert.doesNotMatch(blk, /m\.status !== "active"\) return json\(\{ error/, "예전엔 끝난 판에 404 — 응답을 잃은 앱의 재시도가 전부 실패했다");
  assert.match(blk, /if \(m\.status !== "active"\) return settledReply\(await finish\(admin, m, m\.state as Battle, 0\)\);/);
  const reply = fn.slice(fn.indexOf("function settledReply"), fn.indexOf("async function voidMatch"));
  assert.match(reply, /if \(r\.status === "void"\) return json\(\{ status: "void" \}\);/);
  assert.match(reply, /return json\(\{ status: "done", result: r\.result/);
  // 거절한 판(늦음 · 깨진 기록 · 빠름)은 4xx 에 결과를 싣는다 — 앱이 버리지 않는다
  for (const reason of ["too slow", "bad log", "too fast"]) assert.match(blk, new RegExp(`json\\(\\{ error: "${reason}", \\.\\.\\.r \\}, 422\\)`), reason);
});

/** adventureonline 을 가짜 supabase · localStorage 로 띄운다 */
async function loadOnline(invoke: (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  const dir = mkdtempSync(join(tmpdir(), "advonline-"));
  writeFileSync(join(dir, "sb.ts"), "export const getSupabase = () => (globalThis as any).__advSb;\n");
  writeFileSync(join(dir, "base.ts"), 'export const BASE = "";\n');
  const src = read("src/lib/adventureonline.ts")
    .replace('"@/lib/supabase"', JSON.stringify(pathToFileURL(join(dir, "sb.ts")).href))
    .replace('"@/lib/base"', JSON.stringify(pathToFileURL(join(dir, "base.ts")).href))
    .replace('"@/lib/adventurehash"', JSON.stringify(pathToFileURL(join(root, "src/lib/adventurehash.ts")).href));
  writeFileSync(join(dir, "online.ts"), src);
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  (globalThis as Record<string, unknown>).__advSb = { functions: { invoke: (_n: string, o: { body: Record<string, unknown> }) => invoke(o.body) } };
  const mod = await import(pathToFileURL(join(dir, "online.ts")).href);
  return { mod, mem, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const httpError = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });

test("★ 1 앱 — 4xx 본문(진 것으로 친 결과)을 버리지 않고, 4xx 는 다시 보내지 않는다(연결 끊김 · 5xx 만)", async () => {
  let reply = httpError(422, { error: "too slow", status: "done", result: "lose", delta: -16, rating: 984 });
  const { mod, cleanup } = await loadOnline(async () => reply);
  try {
    const e = await mod.duelFinish("m1", []).catch((x: unknown) => x);
    assert.equal(e.code, "too slow");
    assert.equal(e.status, 422);
    assert.equal(mod.retryable(e), false, "4xx 는 서버가 정한 답");
    assert.deepEqual(mod.resultOf(e), { error: "too slow", status: "done", result: "lose", delta: -16, rating: 984 });
    assert.equal(mod.duelMessage(e), "판을 연 지 너무 오래돼 진 것으로 기록됐어요");
    reply = httpError(503, { error: "internal error" });
    assert.equal(mod.retryable(await mod.duelFinish("m1", []).catch((x: unknown) => x)), true);
    reply = { data: null, error: new Error("Failed to fetch") } as never;
    assert.equal(mod.retryable(await mod.duelFinish("m1", []).catch((x: unknown) => x)), true, "연결 끊김은 다시");
    reply = { data: { status: "void" }, error: null } as never;
    const v = await mod.duelFinish("m1", []);
    assert.equal(mod.resultNote(v), "무효가 된 판이에요 — 점수는 그대로예요");
    assert.equal(mod.resultNote({ status: "done", result: "win", delta: 3, capped: true }), "오늘 상승 한도에 닿았어요");
    assert.match(mod.resultNote({ status: "done", result: "win", delta: 3, again: true }), /이미 정산된 판/);
  } finally {
    cleanup();
  }
});

test("★ 1 앱 — 못 보낸 기록은 이 기기에 {match, log, at} · 10분 안만 다시 · 그 판만 지운다", async () => {
  const { mod, mem, cleanup } = await loadOnline(async () => ({ data: null, error: null }));
  try {
    const now = 1_000_000_000;
    mod.keepUnsent({ match: "m1", log: [[1, 0, 0, 0]], at: now, opponent: "상대" });
    assert.equal(mod.readUnsent(now + 60_000)?.match, "m1");
    mod.clearUnsent("other");
    assert.ok(mem.get(mod.UNSENT_KEY), "다른 판의 답으로 지우지 않는다");
    assert.equal(mod.readUnsent(now + mod.UNSENT_TTL_MS + 1), null, "10분이 지나면 버린다(서버가 '늦음'으로 닫는다)");
    assert.equal(mem.get(mod.UNSENT_KEY), undefined);
    assert.ok(mod.UNSENT_TTL_MS < 10 * 60_000);
    assert.equal(mod.unsentLive({ match: "m", log: "x", at: now }, now), false);
  } finally {
    cleanup();
  }
});

test("★ 1 화면 — BattleView 는 4xx 면 바로 멈추고, DuelPanel 은 보내기 전에 남기고 · 열 때 · 새 판 전에 다시 보낸다", () => {
  const b = code("src/components/adventure/BattleView.tsx");
  const loop = b.slice(b.indexOf("for (let tries = 0; ; tries++)"), b.indexOf("setSending(null);", b.indexOf("for (let tries = 0; ; tries++)")));
  assert.ok(loop.indexOf("if (online.retryable && !online.retryable(err)) break;") >= 0 && loop.indexOf("if (online.retryable && !online.retryable(err)) break;") < loop.indexOf("다시 보낼게요"), "4xx 를 다섯 번 다시 보내지 않는다");
  const d = code("src/components/adventure/DuelPanel.tsx");
  const fin = d.slice(d.indexOf("finish: async (log) => {"), d.indexOf("forfeit: async () => {"));
  assert.ok(fin.indexOf("keepUnsent(") >= 0 && fin.indexOf("keepUnsent(") < fin.indexOf("await duelFinish("), "보내기 전에 남긴다");
  assert.match(fin, /if \(!retryable\(e\)\) \{\s+clearUnsent\(live\.match\);\s+outcome\.current = gotOfError\(e\);/);
  assert.match(d, /errorText: duelMessage,\s+retryable,/);
  const mount = d.slice(d.indexOf("const resendRef"), d.indexOf("async function register"));
  assert.ok(mount.indexOf("readUnsent()") < mount.indexOf("await load()"), "열면 못 보낸 결과부터(me 가 그 판을 닫기 전에)");
  const ch = d.slice(d.indexOf("async function challenge"), d.indexOf("async function resend"));
  assert.ok(ch.indexOf("readUnsent()") < ch.indexOf("await startDuel(id)"), "새 판을 열기 전에 다시 보낸다");
  assert.match(d, /무효가 된 판이에요 — 점수는 그대로예요/);
  assert.match(d, /result\.note && <p/);
});

// ── 3 · 4) start — 검사 먼저 · busy · KST 하루 한도 ─────────────────────────────

test("★ 3 start 는 검사를 다 한 뒤에만 열린 판을 닫고, 150초 안에 연 판이 있으면 409 busy", () => {
  const st = opBlock("start", 'op === "finish"');
  const at = (s: string) => {
    const i = st.indexOf(s);
    assert.ok(i >= 0, s);
    return i;
  };
  const close = at("const abandoned = await closeOpen(admin, uid, BUSY_MS);");
  for (const before of ["body.engine !== ENGINE_HASH", "await myTeam(admin, uid)", "await duelsToday(admin, uid)", '.eq("public_id", target)', 'error: "self"', 'return json({ error: "busy" }, 409);']) {
    assert.ok(at(before) < close, `${before} 는 닫기 전에`);
  }
  assert.ok(close < at('.from("adventure_matches")\n        .insert('), "닫기는 넣기 바로 앞");
  assert.match(fn, /const BUSY_MS = 150_000;/);
  assert.doesNotMatch(fn, /closeOpen\(admin, uid, true\)/, "예전엔 맨 먼저 전부 진 것으로 닫았다");
  assert.match(st, /if \(error\.code === "PT409"\) return json\(\{ error: "busy" \}, 409\);/);
  assert.match(read("src/lib/adventureonline.ts"), /busy: "다른 기기에서 대전 중이에요/);
});

test("★ 4 하루 판 수는 KST 자정부터 · 무효 판은 빼고 · 사용자 잠금 안의 트리거가 마지막 그물", () => {
  assert.equal(latestDefiner("private.adventure_matches_cap"), "20261107070000_adventure_finish.sql");
  const cap = fnBody("private.adventure_matches_cap");
  const lock = cap.indexOf("pg_advisory_xact_lock(hashtextextended('ourdays:adventure:start:'");
  assert.ok(lock >= 0 && lock < cap.indexOf("raise exception 'busy'") && lock < cap.indexOf("raise exception 'daily limit'"), "잠금 안에서 센다(두 기기 동시 시작)");
  assert.ok(lock < cap.indexOf("if new.opponent_id is null or new.bot then"), "연습 판도 잠그고 하루 판에 센다");
  assert.match(cap, /v_since timestamptz := \(date_trunc\('day', now\(\) at time zone 'Asia\/Seoul'\) at time zone 'Asia\/Seoul'\);/);
  assert.match(cap, new RegExp(`where user_id = new\\.user_id and status <> 'void' and created_at >= v_since;\\s+if n >= ${DAILY_DUELS} then\\s+raise exception 'daily limit' using errcode = 'PT429';`));
  assert.match(cap, new RegExp(`and status <> 'void'\\s+and created_at >= v_since;\\s+if n >= ${SAME_OPP_DAILY} then\\s+raise exception 'same opponent'`));
  assert.match(cap, /created_at > now\(\) - interval '150 seconds'\) then\s+raise exception 'busy' using errcode = 'PT409';/);
  assert.match(fnBody("public.adventure_candidates"), /m\.status <> 'void'/, "상대 후보도 같은 규칙");
  // 함수의 앞 검사도 같은 규칙(지난 24시간이 아니라)
  const today = fn.slice(fn.indexOf("async function duelsToday"), fn.indexOf("async function nickTaken"));
  assert.match(today, /\.neq\("status", "void"\)\.gte\("created_at", kstMidnight\(\)\)/);
  assert.doesNotMatch(fn, /24 \* 3600_000/);
  assert.match(fn, /return json\(\{ error: \/daily\/\.test\(error\.message \?\? ""\) \? "daily limit" : "same opponent" \}, 429\);/);
});

// ── 5 · 6) 정산 · 보관 ──────────────────────────────────────────────────────

test("★ 5 상승 한도에 걸리면 방어자가 잃는 점수도 같은 비율(다 찼으면 0) · capped 를 돌려준다", () => {
  assert.equal(latestDefiner("public.adventure_settle"), "20261107070000_adventure_finish.sql");
  const s = fnBody("public.adventure_settle");
  assert.match(s, new RegExp(`v_cap constant integer := ${DAILY_GAIN_CAP};`));
  assert.match(s, /d := least\(d_raw, greatest\(0, v_cap - my_gain\)\);\s+if d < d_raw then\s+v_capped := true;[\s\S]*?od := round\(od \* d::numeric \/ d_raw\);/);
  assert.ok(s.indexOf("od := round(od * d::numeric / d_raw)") < s.indexOf("if od > 0 then"), "방어자 상승 한도는 그 뒤에 따로");
  assert.match(s, /'capped', v_capped\)/);
  assert.match(s, /where user_id in \(p_user, p_opp\) order by user_id for update;/, "잠금 순서 그대로");
  assert.match(mig, /grant execute on function public\.adventure_settle\(uuid, uuid, boolean, integer, integer\) to service_role;/);
  assert.match(read("src/lib/adventureonline.ts"), /if \(r\.capped\) return "오늘 상승 한도에 닿았어요";/);
});

test("★ 6 보관 크론은 하루 넘게 열린 판을 무효로 — 고정 K 로 진 것으로 정산하지 않는다", () => {
  assert.equal(latestDefiner("private.adventure_retention"), "20261107070000_adventure_finish.sql");
  const r = fnBody("private.adventure_retention");
  assert.match(r, /update public\.adventure_matches set status = 'void', finished_at = now\(\)\s+where status = 'active' and created_at < now\(\) - interval '1 day';/);
  assert.doesNotMatch(r, /adventure_settle/);
  assert.match(r, /delete from public\.adventure_matches where status <> 'active' and created_at < now\(\) - interval '60 days';/, "60일 정리는 그대로");
  // 이 파일은 행을 지우지 않는다(정리 함수 본문 밖)
  assert.doesNotMatch(mig.replace(r, ""), /delete from|drop table|truncate/i);
  assert.match(mig, /^begin;$/m);
  assert.match(mig.trimEnd(), /commit;$/);
  assert.doesNotMatch(mig, /errcode = '40001'|errcode = '40P01'/);
  for (const name of ["adventure_finish", "adventure_today", "adventure_nick_taken", "adventure_settle", "adventure_board"]) {
    assert.match(fnBody(`public.${name}`), /security definer\s+set search_path = /, name);
  }
});

// ── 7) 엔진 409 ───────────────────────────────────────────────────────────

test("★ 7 엔진이 다르면 서버 지문을 싣고 — 앱은 배포된 버전으로 '서버 업데이트 중' · '새 버전 받기'를 가른다", async () => {
  assert.match(fn, /return json\(\{ error: "engine", server: ENGINE_HASH \}, 409\);/);
  const { mod, cleanup } = await loadOnline(async () => ({ data: null, error: null }));
  try {
    assert.equal(mod.engineVerdict("abc123", "abc123"), "server", "지금 앱이 배포된 최신 — 서버(함수)가 뒤처졌다");
    assert.equal(mod.engineVerdict("def456", "abc123"), "reload");
    assert.equal(mod.engineVerdict(null, "abc123"), "reload");
    assert.equal(mod.engineVerdict("dev", "dev"), "reload", "로컬 빌드는 가를 수 없다");
    assert.equal(mod.duelText("engine server"), "서버 업데이트 중이에요. 잠시 뒤 다시 해 주세요");
  } finally {
    cleanup();
  }
  const on = code("src/lib/adventureonline.ts");
  assert.match(on, /fetch\(`\$\{BASE\}\/version\.json\?t=\$\{Date\.now\(\)\}`, \{ cache: "no-store" \}\)/);
  assert.match(on, /u\.searchParams\.set\("_r", String\(Date\.now\(\)\)\);\s+location\.replace/, "캐시를 건너뛰는 새로고침");
  const d = code("src/components/adventure/DuelPanel.tsx");
  assert.match(d, /if \(\(await engineAdvice\(\)\) === "server"\) flash\(duelText\("engine server"\)\);\s+else setStale\(true\);/);
  assert.match(d, /onClick=\{reloadFresh\}>새 버전 받기/);
});

// ── 8 · 14) 저장 — 쓰기 표 · 기기 사본 먼저 · 시간 제한 ───────────────────────────

type Row = { state: Record<string, unknown>; version: number };
/** adventurestore 를 가짜 supabase 로 — lose: 서버엔 쓰고 응답만 잃는다 */
async function loadStore(fake: { row: Row | null; lose?: boolean; fail?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), "advstore2-"));
  writeFileSync(join(dir, "sb.ts"), "export const getSupabase = () => (globalThis as any).__advSb;\n");
  const src = read("src/lib/adventurestore.ts")
    .replace('"@/lib/supabase"', JSON.stringify(pathToFileURL(join(dir, "sb.ts")).href))
    .replace('"@/lib/adventure"', JSON.stringify(pathToFileURL(join(root, "src/lib/adventure.ts")).href));
  writeFileSync(join(dir, "store.ts"), src);
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  (globalThis as Record<string, unknown>).__advSb = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fake.row, error: null }) }) }) }),
    rpc: async (_n: string, args: { p_state: Record<string, unknown>; p_version: number }) => {
      if (fake.fail) return { data: null, error: { code: "network", message: "offline" } };
      if (!fake.row || fake.row.version !== args.p_version) return { data: null, error: { code: "PT409", message: "stale" } };
      fake.row = { state: { ...fake.row.state, ...args.p_state }, version: fake.row.version + 1 };
      if (fake.lose) return { data: null, error: { code: "network", message: "Failed to fetch" } };
      return { data: fake.row.version, error: null };
    },
  };
  const mod = await import(pathToFileURL(join(dir, "store.ts")).href);
  return { mod, mem, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const plain = (s: AdvSave) => JSON.parse(JSON.stringify(s)) as Record<string, unknown>;

test("★ 8 저장은 닿았는데 응답만 잃었다 — 다음 저장의 PT409 를 '다른 기기'로 보지 않고 그 버전 위에 잇는다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: plain(base), version: 4 } as Row | null, lose: true };
  const { mod, mem, cleanup } = await loadStore(fake);
  try {
    await assert.rejects(mod.saveAdventure("u1", { ...base, gold: 10 }, 4));
    assert.equal(fake.row!.version, 5, "서버엔 닿았다");
    assert.equal(typeof fake.row!.state._w, "string", "쓰기 표가 저장에 실린다");
    fake.lose = false;
    // 화면은 응답을 못 받아 아직 4 를 들고 있다
    const r = await mod.saveAdventure("u1", { ...base, gold: 20 }, 4);
    assert.equal(r.version, 6, "StaleSave 가 아니라 5 위에 이어 썼다");
    assert.equal(fake.row!.state.gold, 20);
    assert.equal(mem.get(mod.backupsKey("u1")), undefined, "백업(충돌)으로 보지 않는다");
    // 진짜 다른 기기가 쓰면 여전히 충돌
    fake.row = { state: { ...plain(base), gold: 1, _w: "other" }, version: 9 };
    await assert.rejects(mod.saveAdventure("u1", { ...base, gold: 30 }, 6), (e: unknown) => e instanceof mod.StaleSave);
  } finally {
    cleanup();
  }
});

test("★ 8 다시 열 때도 — 서버 행이 이 기기가 보낸 저장이면 백업 · '다른 기기' 알림 없이 잇는다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: plain(base), version: 2 } as Row | null, lose: true };
  const { mod, cleanup } = await loadStore(fake);
  try {
    await assert.rejects(mod.saveAdventure("u2", { ...base, gold: 77 }, 2));
    fake.lose = false;
    const got = await mod.loadAdventure("u2");
    assert.equal(got.backup, undefined);
    assert.equal(got.version, 3);
    assert.equal(got.save.gold, 77);
    assert.equal(mod.hasPendingAdventure("u2"), false);
  } finally {
    cleanup();
  }
});

test("★ 8 · 14 응답을 잃은 뒤 사본에 더 새 진행을 써 두면 — 다시 열 때 서버 행(이 기기 것)이 아니라 그 사본을 올린다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: plain(base), version: 3 } as Row | null, lose: true };
  const { mod, cleanup } = await loadStore(fake);
  try {
    await assert.rejects(mod.saveAdventure("u5", { ...base, gold: 40 }, 3));
    // 화면의 다음 진행 — 지난 서버 행의 쓰기 표를 그대로 들고 있다
    mod.stageAdventure("u5", { ...base, gold: 50, _w: fake.row!.state._w } as AdvSave, 3);
    fake.lose = false;
    const got = await mod.loadAdventure("u5");
    assert.equal(got.save.gold, 50, "사본을 버리지 않는다");
    assert.equal(got.version, 5);
    assert.equal(got.backup, undefined);
  } finally {
    cleanup();
  }
});

test("★ 8 normalizeSave 는 쓰기 표(_w) · 싸우던 판(_fight)을 지우지 않는다(모르는 칸을 흘린다 — adventure.ts)", () => {
  const s = { ...newSave("ember_2", 5), _w: "abc", _fight: { kind: "boss", startedAt: 1, region: "meadow", isBoss: true } };
  const n = normalizeSave(JSON.parse(JSON.stringify(s))) as unknown as Record<string, unknown>;
  assert.equal(n._w, "abc");
  assert.deepEqual(n._fight, s._fight);
});

test("★ 14 기기 사본은 줄을 기다리지 않는다 · RPC 는 12초에 끊는다 · 서버 응답이 더 새 사본을 덮지 않는다", async () => {
  const st = code("src/lib/adventurestore.ts");
  assert.match(st, /export const RPC_TIMEOUT_MS = 12_000;/);
  assert.match(st, /await withTimeout\(sb\.rpc\("adventure_save", \{ p_state: compactSave\(body\), p_version: from \}\)\)/);
  assert.match(st, /if \(!now \|\| extra\(now\.save\)\._w === w\) writeLocal\(uid, s, false\);/);
  const tab = code("src/components/adventure/AdventureTab.tsx");
  const commit = tab.slice(tab.indexOf("function commit(next: AdvSave)"), tab.indexOf("async function syncNow"));
  assert.ok(commit.indexOf("store.stageAdventure(myUserId, next, version.current);") >= 0 && commit.indexOf("store.stageAdventure(") < commit.indexOf("saving.current = saving.current.then"), "사본 먼저");
  const base = newSave("leaf_2", 1);
  const { mod, mem, cleanup } = await loadStore({ row: { state: plain(base), version: 1 } });
  try {
    mod.stageAdventure("u3", { ...base, gold: 5 }, 1);
    const local = JSON.parse(mem.get("ourdays:adventure:v1:u3")!);
    assert.equal(local.dirty, true);
    assert.equal(local.save.gold, 5);
  } finally {
    cleanup();
  }
});

// ── 9) 백그라운드에서 돌아오면 ───────────────────────────────────────────────

test("★ 9 돌아오면 서버 버전만 보고 — 앞서 갔고 안 올린 진행이 없으면 다시 읽고, 둘 다 바뀌면 충돌 길 · flush 의 StaleSave 를 삼키지 않는다", () => {
  const t = code("src/components/adventure/AdventureTab.tsx");
  const eff = t.slice(t.indexOf("const flush = () => {"), t.indexOf("function onStale"));
  assert.match(eff, /store\.flushAdventure\(myUserId\)\)\.catch\(\(e\) => void staleRef\.current\(e\)\)/);
  assert.match(eff, /store\.serverVersion\(myUserId\)/);
  assert.match(eff, /if \(!store\.hasPendingAdventure\(myUserId\) && !pending\.current\) void load\(\);\s+else flush\(\);/);
  assert.match(eff, /if \(battleOpen\.current\) return;/, "전투 중엔 다시 읽지 않는다");
  assert.doesNotMatch(t, /flushAdventure\([^)]*\)\)?\.catch\(\(\) => \{\}\)/, "StaleSave 를 삼키던 길");
  assert.match(t, /if \(!onStale\(e\)\) flash\("저장하지 못했어요/);
  assert.match(code("src/lib/adventurestore.ts"), /select\("version"\)\.eq\("user_id", uid\)/, "버전만 가볍게");
});

// ── 10) 백업 셋 ────────────────────────────────────────────────────────────

test("★ 10 백업은 최근 셋(때 · 최고 레벨 · 골드 · 도감) · 되살리기는 지금 서버 버전 위에 · 팀 칸에 '보관한 기록'", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: plain(base), version: 1 } as Row | null };
  const { mod, mem, cleanup } = await loadStore(fake);
  try {
    for (const g of [11, 22, 33, 44]) {
      fake.row = { state: { ...plain(base), gold: 1, _w: `x${g}` }, version: fake.row!.version + 1 };
      await assert.rejects(mod.saveAdventure("u4", { ...base, gold: g }, 1));
    }
    const list = mod.listBackups("u4");
    assert.equal(list.length, 3, "셋까지");
    assert.deepEqual(list.map((b: { gold: number }) => b.gold), [44, 33, 22], "새것부터");
    assert.equal(list[0].level, 5);
    assert.equal(list[0].dex, base.caught.length);
    assert.equal(JSON.parse(mem.get(mod.backupsKey("u4"))!).length, 3);
    const r = await mod.restoreBackup("u4", 1, { ...base, gold: 1 });
    assert.equal(fake.row!.state.gold, 33);
    assert.equal(fake.row!.state._fight, null, "싸우던 판 표시는 되살리지 않는다");
    assert.equal(r.version, fake.row!.version);
    assert.ok(mod.listBackups("u4").some((b: { gold: number }) => b.gold === 1), "지금 진행도 보관해 되돌릴 수 있다");
  } finally {
    cleanup();
  }
  const tab = code("src/components/adventure/AdventureTab.tsx");
  assert.match(tab, /\{sub === "team" && myUserId && <SaveBackups uid=\{myUserId\}/);
  const sb = code("src/components/adventure/SaveBackups.tsx");
  assert.match(sb, /보관한 기록/);
  assert.match(sb, /await confirmDialog\(/, "되살리기 전에 묻는다");
});

// ── 11 · 12) 등록 · 닉네임 ───────────────────────────────────────────────────

test("★ 11 등록 전에 모험 기록을 서버까지 올리고, 돌아온 팀이 고른 것보다 작으면 알린다", () => {
  const d = code("src/components/adventure/DuelPanel.tsx");
  const reg = d.slice(d.indexOf("async function register"), d.indexOf("async function challenge"));
  assert.ok(reg.indexOf("await sync?.();") >= 0 && reg.indexOf("await sync?.();") < reg.indexOf("await registerTeam(pick, nick)"));
  assert.match(reg, /const dropped = pick\.length - r\.team\.length;/);
  assert.match(reg, /아직 서버 기록에 없어 빠졌어요/);
  const t = code("src/components/adventure/AdventureTab.tsx");
  assert.match(t, /<DuelPanel save=\{s\} flash=\{flash\} sync=\{syncNow\} \/>/);
  const sync = t.slice(t.indexOf("async function syncNow"), t.indexOf("function flash"));
  assert.ok(sync.indexOf("await saving.current;") < sync.indexOf("store.flushAdventure(myUserId)"), "줄에 선 저장 뒤에 올린다");
});

test("★ 12 닉네임 — '*' 를 '%' 로 바꾸는 ilike 대신 lower() 비교 RPC · 팀이 있으면 서버 닉네임을 보여 준다", () => {
  assert.doesNotMatch(fn, /\.ilike\(/);
  assert.match(fn, /admin\.rpc\("adventure_nick_taken", \{ p_nick: nickname, p_user: uid \}\)/);
  const f = fnBody("public.adventure_nick_taken");
  assert.match(f, /where lower\(t\.nickname\) = lower\(p_nick\) and t\.user_id is distinct from p_user/);
  assert.match(mig, /grant execute on function public\.adventure_nick_taken\(text, uuid\) to service_role;/);
  const d = code("src/components/adventure/DuelPanel.tsx");
  assert.match(d, /if \(!nickTouched\.current\) setNick\(m\.team\.nickname\);/);
  assert.doesNotMatch(d, /setNick\(\(n\) => n \|\| m\.team/, "이 기기의 옛 이름이 먼저 보이던 길");
});

// ── 13) 싸우던 판 ─────────────────────────────────────────────────────────

test("★ 13 판을 버리면 다음 읽기가 정산 — 쓴 공 · 약은 그대로, 대장 · 트레이너는 진 것(골드 10%), 야생은 도망 · 다른 기기 판은 30분 뒤", async () => {
  const { mod, cleanup } = await loadStore({ row: null });
  try {
    const base = { ...newSave("leaf_2", 1), gold: 1000 };
    base.party = base.party.map((m) => ({ ...m, hp: 1 }));
    const now = 5_000_000;
    const boss = mod.markFight(base, { kind: "boss", region: "meadow", isBoss: true }, now);
    const dev = mod.deviceId();
    const s = mod.settleFight(boss, dev, now + 1000);
    assert.equal(s.save.gold, 900);
    assert.ok(s.save.party.every((m: { hp: number }) => m.hp > 1), "쉼터 회복(진 판과 같다)");
    assert.equal(s.save._fight, null, "표시는 null 로 지운다(합쳐 쓰므로)");
    assert.match(s.note, /대장 승부는 진 것으로/);
    const wild = mod.settleFight(mod.markFight(base, { kind: "wild", region: "meadow", isBoss: false }, now), dev, now);
    assert.equal(wild.save.gold, 1000);
    assert.match(wild.note, /도망친 것으로/);
    assert.equal(mod.settleFight(mod.markFight(base, { kind: "tower", region: "meadow", isBoss: false }, now), dev, now).save.gold, 1000, "탑은 원래 골드를 잃지 않는다");
    const other = { ...boss, _fight: { ...boss._fight, dev: "other-device" } };
    assert.equal(mod.settleFight(other, dev, now + 60_000), null, "다른 기기에서 아직 싸우는 중일 수 있다");
    assert.equal(mod.settleFight(other, dev, now + mod.FIGHT_STALE_MS + 1).save.gold, 900);
    assert.equal(mod.settleFight(base, dev, now), null, "표시가 없으면 아무것도 안 한다");
  } finally {
    cleanup();
  }
  const t = code("src/components/adventure/AdventureTab.tsx");
  for (const start of ["startWild(s, r)", "startWild(s, field, { species, level })", "startTrainer(s, r, trainersOf(r)[slot])", "startTower(s, floor)", "startBoss(s, r)"]) {
    const at = t.indexOf(start);
    assert.ok(at > 0, start);
    assert.match(t.slice(at, at + 200), /commit\(withFight\(next, b, /, `${start} — 판을 여는 저장에 표시`);
  }
  assert.match(t, /commit\(store\.clearFight\(out\.save\)\);/, "판이 끝나면 지운다");
  assert.match(t, /onSettle=\{settle\} onEnd=\{endBattle\} onSpend=\{spend\}/);
  assert.match(t, /store\.stageAdventure\(myUserId, \{ \.\.\.s, balls: \{ \.\.\.bag\.balls \}, items: \{ \.\.\.bag\.items \} \}, version\.current\);/, "던진 공 · 쓴 약을 그 틱에 사본으로");
  const b = code("src/components/adventure/BattleView.tsx");
  const tick = b.slice(b.indexOf("stepArena(a, inp);"), b.indexOf("handle(a.ev);"));
  assert.match(tick, /if \(left < bagLeft\.current\) onSpendRef\.current\?\.\(/);
  assert.match(code("src/lib/adventurestore.ts"), /const f = settleFight\(s\.save, deviceId\(\)\);/, "읽을 때 정산");
});

// ── 15) 대전 현황 · 순위 이웃 ─────────────────────────────────────────────────

test("★ 15 me 가 오늘 현황(판 n/60 · 오른 점수 n/120 · 상대마다 판 수 public_id)을 주고 화면이 보여 준다", () => {
  const me = opBlock("me", 'op === "opponents"');
  assert.match(me, /admin\.rpc\("adventure_today", \{ p_user: uid \}\)/);
  assert.match(me, /duelsMax: DAILY_DUELS, gain: t\.gain, gainMax: DAILY_GAIN_CAP, sameMax: SAME_OPP_DAILY/);
  const today = fnBody("public.adventure_today");
  assert.match(today, /m\.status <> 'void' and m\.created_at >= since\.at/);
  assert.match(today, /json_build_object\('id', t\.public_id, 'n', x\.n\)/, "상대는 public_id 로만");
  assert.doesNotMatch(today, /'id', (x\.|m\.)?(opponent_id|user_id)/, "계정 id 를 내보내지 않는다");
  assert.match(mig, /grant execute on function public\.adventure_today\(uuid\) to service_role;/);
  const d = code("src/components/adventure/DuelPanel.tsx");
  assert.match(d, /오늘 남은 대전 \{Math\.max\(0, today\.duelsMax - today\.duels\)\}\/\{today\.duelsMax\} · 오늘 오른 점수 \{today\.gain\}\/\{today\.gainMax\}/);
  assert.match(d, /오늘 \$\{Math\.max\(0, today\.sameMax - \(metToday\.get\(o\.id\) \?\? 0\)\)\}판 남음/);
});

test("★ 15 순위는 위 30 + 내 앞뒤 다섯 · 같은 점수는 처음 들어온 순(updated_at 이 아니라) · 서명 그대로", () => {
  assert.equal(latestDefiner("public.adventure_board"), "20261107070000_adventure_finish.sql");
  const b = fnBody("public.adventure_board");
  assert.match(b, /row_number\(\) over \(order by r\.rating desc, r\.created_at, r\.user_id\) as rank/);
  assert.doesNotMatch(b, /updated_at/);
  assert.match(b, /or exists \(select 1 from mine where abs\(ranked\.rank - mine\.rank\) <= 5\)/);
  assert.match(mig, /returns table \(rank bigint, nickname text, rating integer, wins integer, losses integer, lead text, is_me boolean\)/);
  assert.doesNotMatch(b, /select[^;]*\bt\.team\b(?! -> 0)/, "순위에 팀 전체가 나가지 않는다");
  assert.match(mig, /add column if not exists created_at timestamptz not null default now\(\);/);
  assert.match(code("src/components/adventure/DuelPanel.tsx"), /r\.rank > board\[i - 1\]\.rank \+ 1 \?/, "사이가 비면 표시");
});
