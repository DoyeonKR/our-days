// 모험 대전 · 저장 지키기 lock (2026-11-09 리뷰 "Fix all") — README §14.6 '대전 지키기'.
// 순위 농사(연습 판 점수 · 하루 상한 · 같은 상대 세 판) · 시드 재시도 · 팀 조작 · 저장 유실 · 옛 번들의 칸 지우기 · 사생활 · 닉네임 · 상대 고르기 · 엔진 지문.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LEGEND_KEYS, newSave, normalizeSave, type AdvSave } from "./adventure.ts";
import { DAILY_GAIN_CAP, MATCH_TTL_MIN, SAME_OPP_DAILY, TEAM_MAX, cleanNick, pickTeam, teamProblem } from "./adventurepvp.ts";
import { ACCOUNT_EXPORT_TABLES } from "./accountPolicy.ts";
import { ENGINE_HASH } from "./adventurehash.ts";
import { HASH_FILE, engineHash, hashContent } from "../../scripts/adventure-shared.mjs";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
// 주석을 뺀 코드 — 설명문이 먼저 걸리지 않게(README §10.5)
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const sqlCode = (p: string) => read(p).replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/20261107050000_adventure_guard.sql";
const mig = sqlCode(MIG);
const fn = code("supabase/functions/adventure-battle/index.ts");
const fnBody = (name: string) => {
  const at = mig.indexOf(`function ${name}`);
  assert.ok(at >= 0, name);
  return mig.slice(at, mig.indexOf("$$;", at));
};

// ── 1) 순위 농사 ──────────────────────────────────────────────────────────────

test("★ 연습 판(p_opp null)은 점수를 안 바꾸고 연습 전적만 센다 — opp := me 로 이길 때마다 +8 이 쌓였다", () => {
  const settle = fnBody("public.adventure_settle");
  const practice = settle.slice(settle.indexOf("if p_opp is null"), settle.indexOf("end if;", settle.indexOf("if p_opp is null")));
  assert.match(practice, /practice_wins = practice_wins \+/);
  assert.match(practice, /return json_build_object\('delta', 0, 'opp_delta', 0/);
  assert.doesNotMatch(practice, /rating = /, "연습 판이 점수를 바꾸면 안 된다");
  assert.doesNotMatch(settle, /opp := me/);
  assert.match(mig, /grant execute on function public\.adventure_settle\(uuid, uuid, boolean, integer, integer\) to service_role;/);
  assert.match(mig, /revoke all on function public\.adventure_settle\(uuid, uuid, boolean, integer, integer\) from public, anon, authenticated;/);
});

test("★ 하루(KST) 점수 상승 상한 — 앱 상수와 같은 값, 나 · 방어자 둘 다", () => {
  const settle = fnBody("public.adventure_settle");
  assert.match(settle, new RegExp(`v_cap constant integer := ${DAILY_GAIN_CAP};`));
  assert.match(settle, /d := least\(d, greatest\(0, v_cap - my_gain\)\);/);
  assert.match(settle, /od := least\(od, greatest\(0, v_cap - opp_gain\)\);/);
  assert.match(settle, /now\(\) at time zone 'Asia\/Seoul'/);
  // 두 판이 엇갈려 끝나도 서로를 기다리지 않게 id 순으로 잠근다(교착은 PostgreSQL 이 40P01 로 끊는다 — README §11)
  assert.match(settle, /where user_id in \(p_user, p_opp\) order by user_id for update;/);
});

test("★ 같은 상대에게 하루 세 판 — DB 트리거가 PT429(옛 함수도 탄다) · 함수는 429 'same opponent'", () => {
  const cap = fnBody("private.adventure_matches_cap");
  assert.match(cap, new RegExp(`if n >= ${SAME_OPP_DAILY} then\\s+raise exception 'same opponent' using errcode = 'PT429';`));
  assert.match(cap, /perform pg_advisory_xact_lock\(hashtextextended\('ourdays:adventure:start:'/);
  assert.match(mig, /create trigger adventure_matches_cap before insert on public\.adventure_matches/);
  assert.match(mig, /create index if not exists adventure_matches_pair_idx on public\.adventure_matches \(user_id, opponent_id, created_at desc\);/);
  // 2026-11-09 다듬기: 같은 PT429 에 하루 한도(KST)도 실려 문구로 가른다(advonline.test)
  assert.match(fn, /if \(error\.code === "PT429"\) return json\(\{ error: \/daily\/\.test\(error\.message \?\? ""\) \? "daily limit" : "same opponent" \}, 429\);/);
  // 상대 후보에서도 오늘 세 번 붙은 사람을 뺀다
  assert.match(fnBody("public.adventure_candidates"), new RegExp(`\\) < ${SAME_OPP_DAILY}\\s+order by abs`));
});

test("★ 시드 재시도 — 판 하나에 finish 한 번 · 연 지 오래된 판은 진 것 · 버린 판도 진 것 · 입력 기록을 남긴다", () => {
  assert.equal(MATCH_TTL_MIN, 10);
  assert.match(fn, /if \(elapsed \* 1000 > TTL_MS\) \{\s+start\.over = "lose";/);
  assert.match(fn, /error: "too slow"/);
  // 2026-11-09 다듬기: 닫기 · 정산은 adventure_finish 한 트랜잭션(판 행을 잠그고 active 일 때만 닫는다 — advonline.test)
  assert.match(fn, /admin\.rpc\("adventure_finish", \{/, "닫기에 성공한 한 번만 정산");
  assert.match(fn, /p_state: b, p_log: log,/, "보낸 입력 기록을 판에 남긴다");
  // 새 판을 열면 150초 지난 판은 진 것(그 안의 판은 busy — 다른 기기의 판을 지지 않게)
  assert.match(fn, /const abandoned = await closeOpen\(admin, uid, BUSY_MS\);/, "새 판을 열면 끝내지 않은 판은 진 것");
  assert.match(fn, /await closeOpen\(admin, uid, TTL_MS\);/, "me · opponents 는 TTL 이 지난 판만");
  assert.match(mig, /add column if not exists log jsonb;/);
  // 하루 넘게 열린 판 — 이 파일(050000)은 진 것으로 정산했다. 20261107070000 부터는 무효로 닫는다(advonline.test)
  const ret = fnBody("private.adventure_retention");
  assert.match(ret, /where status = 'active' and created_at < now\(\) - interval '1 day'/);
  assert.match(ret, /public\.adventure_settle\(m\.user_id, case when m\.bot then null else m\.opponent_id end, false,/);
});

// ── 2) 팀 조작 ─────────────────────────────────────────────────────────────────

function forged(patch: Record<string, unknown>, extra: Partial<AdvSave> = {}): AdvSave {
  const s = newSave("leaf_2", 3);
  return { ...s, ...extra, party: [s.party[0], { ...s.party[0], id: "m7", ...patch }] };
}

test("★ 등록 때 엔진이 못 만드는 생물은 거절한다 — 레벨 · 개체값 · 소수 · 뱃지 없는 전설 · 팀 넷", () => {
  assert.equal(teamProblem(forged({ level: 99 }), ["m7"]), "bad mon");
  assert.equal(teamProblem(forged({ level: 12.5 }), ["m7"]), "bad mon");
  assert.equal(teamProblem(forged({ gene: { hp: 8, atk: 0, def: 0, spd: 0 } }), ["m7"]), "bad mon");
  assert.equal(teamProblem(forged({ gene: { hp: 2.5, atk: 0, def: 0, spd: 0 } }), ["m7"]), "bad mon");
  assert.equal(teamProblem(forged({ gene: { hp: -1, atk: 0, def: 0, spd: 0 } }), ["m7"]), "bad mon");
  const legend = LEGEND_KEYS[0];
  assert.equal(teamProblem(forged({ species: legend, level: 40 }), ["m7"]), "legend locked", "뱃지 없이 전설");
  assert.equal(teamProblem(forged({ species: legend, level: 40 }, { badges: ["plateau"] }), ["m7"]), null, "신전을 연 뱃지(고원)면 된다");
  assert.equal(teamProblem(forged({ species: legend, level: 40 }, { badges: ["temple"] }), ["m7"]), null);
  assert.equal(teamProblem(forged({ level: 30 }), ["m1", "m7"]), null, "엔진 범위 안이면 통과");
  assert.equal(teamProblem(forged({}), ["nope"]), "empty team");
  assert.equal(teamProblem(forged({}), ["m1", "nope"]), null, "서버에 아직 없는 id(방금 잡은 생물)는 건너뛴다");
  const four = newSave("leaf_2", 3);
  four.party = ["a", "b", "c", "d"].map((id) => ({ ...four.party[0], id }));
  assert.equal(teamProblem(four, ["a", "b", "c", "d"]), "team size");
  assert.ok(TEAM_MAX === 3);
  // pickTeam 은 여전히 범위를 맞춰 새로 만든다(이중 그물)
  assert.equal(pickTeam(forged({ level: 99 }), ["m7"])[0].level, 50);
});

test("★ 함수는 팀을 고르기 전에 teamProblem 을 본다", () => {
  const reg = fn.slice(fn.indexOf('op === "register"'), fn.indexOf('op === "unregister"'));
  assert.ok(reg.indexOf("teamProblem(save, ids)") >= 0 && reg.indexOf("teamProblem(save, ids)") < reg.indexOf("pickTeam(save, ids)"));
});

// ── 3) 저장: 옛 번들이 모르는 칸 · 못 올린 진행 ─────────────────────────────────

test("★ adventure_save 는 최상위 칸을 합쳐 쓴다 — 옛 번들이 모르는 칸(장신구 등)을 못 지운다", () => {
  const save = fnBody("public.adventure_save");
  assert.match(save, /set state = adventure_saves\.state \|\| p_state, version = version \+ 1/);
  assert.match(save, /raise exception 'stale' using errcode = 'PT409';/);
  assert.match(mig, /grant execute on function public\.adventure_save\(jsonb, integer\) to authenticated;/);
});

test("★ normalizeSave 는 모르는 칸을 흘린다 — 다음 번들이 더한 칸이 이 번들의 저장 한 번에 사라지지 않게", () => {
  const s = { ...newSave("ember_2", 5), futureThing: { a: 1 }, charms: { power: 2 } };
  const n = normalizeSave(JSON.parse(JSON.stringify(s)))!;
  assert.deepEqual((n as unknown as Record<string, unknown>).futureThing, { a: 1 });
  assert.equal(n.charms?.power, 2);
  // 아는 칸은 여전히 다듬는다
  const bad = normalizeSave({ ...newSave("ember_2", 5), gold: -5, badges: ["nope", "meadow"] })!;
  assert.equal(bad.gold, 0);
  assert.deepEqual(bad.badges, ["meadow"]);
});

/** adventurestore 를 가짜 supabase · localStorage 로 띄운다(별칭 경로를 임시 파일에서 바꿔 끼운다) */
async function loadStore(fake: { row: { state: unknown; version: number } | null; fail?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), "advstore-"));
  const sbFile = join(dir, "sb.ts");
  writeFileSync(sbFile, "export const getSupabase = () => (globalThis as any).__advSb;\n");
  const src = read("src/lib/adventurestore.ts")
    .replace('"@/lib/supabase"', JSON.stringify(pathToFileURL(sbFile).href))
    .replace('"@/lib/adventure"', JSON.stringify(pathToFileURL(join(root, "src/lib/adventure.ts")).href));
  const file = join(dir, "store.ts");
  writeFileSync(file, src);
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  const calls: { p_version: number }[] = [];
  (globalThis as Record<string, unknown>).__advSb = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fake.row, error: null }) }) }) }),
    rpc: async (_n: string, args: { p_state: unknown; p_version: number }) => {
      calls.push(args);
      if (fake.fail) return { data: null, error: { code: "network", message: "offline" } };
      if (!fake.row || fake.row.version !== args.p_version) return { data: null, error: { code: "PT409", message: "stale" } };
      fake.row = { state: args.p_state, version: fake.row.version + 1 };
      return { data: fake.row.version, error: null };
    },
  };
  const mod = await import(pathToFileURL(file).href);
  return { mod, mem, calls, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("★ 서버 저장이 실패한 진행은 다음 읽기에 서버 행으로 덮이지 않고 올라간다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: base, version: 4 } as { state: unknown; version: number } | null, fail: true };
  const { mod, mem, calls, cleanup } = await loadStore(fake);
  try {
    const ahead = { ...base, gold: 9999 };
    await assert.rejects(mod.saveAdventure("u1", ahead, 4));
    assert.equal(JSON.parse(mem.get("ourdays:adventure:v1:u1")!).dirty, true, "실패하면 사본에 dirty");
    assert.equal(mod.hasPendingAdventure("u1"), true);
    fake.fail = false;
    const got = await mod.loadAdventure("u1");
    assert.equal(got.save.gold, 9999, "서버 행(옛 진행)으로 덮으면 안 된다");
    assert.equal(got.version, 5);
    assert.equal(calls.at(-1)!.p_version, 4, "같은 버전 위에서 이어 올린다");
    assert.equal(mod.hasPendingAdventure("u1"), false);
  } finally {
    cleanup();
  }
});

test("★ 다른 기기가 앞서 썼으면 서버를 쓰고 이 기기 진행은 백업 키에 남긴다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: base, version: 4 } as { state: unknown; version: number } | null, fail: true };
  const { mod, mem, cleanup } = await loadStore(fake);
  try {
    await assert.rejects(mod.saveAdventure("u2", { ...base, gold: 7777 }, 4));
    fake.fail = false;
    fake.row = { state: { ...base, gold: 1 }, version: 6 };
    const got = await mod.loadAdventure("u2");
    assert.equal(got.backup, true);
    assert.equal(got.save.gold, 1);
    // 2026-11-09 다듬기: 한 벌이 아니라 최근 셋(backupsKey) — advonline.test
    assert.equal(JSON.parse(mem.get(mod.backupsKey("u2"))!)[0].save.gold, 7777, "덮인 진행이 백업에 남는다");
  } finally {
    cleanup();
  }
});

test("★ flushAdventure 가 먼저 올려도 화면이 든 옛 버전 번호로 다음 저장이 부딪히지 않는다", async () => {
  const base = newSave("leaf_2", 1);
  const fake = { row: { state: base, version: 2 } as { state: unknown; version: number } | null, fail: true };
  const { mod, cleanup } = await loadStore(fake);
  try {
    await assert.rejects(mod.saveAdventure("u3", { ...base, gold: 10 }, 2));
    fake.fail = false;
    const flushed = await mod.flushAdventure("u3");
    assert.equal(flushed.version, 3);
    assert.equal(await mod.flushAdventure("u3"), null, "올릴 것이 없으면 null");
    const next = await mod.saveAdventure("u3", { ...base, gold: 20 }, 2);
    assert.equal(next.version, 4, "화면은 아직 2 를 들고 있지만 flush 가 이은 3 위에 쓴다");
  } finally {
    cleanup();
  }
});

// ── 4) 떠나기 · 사생활 · 내보내기 · 보관 ──────────────────────────────────────

test("★ unregister — 내 팀 행만 지운다(순위판 · 상대 목록에서 빠진다)", () => {
  const un = fn.slice(fn.indexOf('op === "unregister"'), fn.indexOf('op === "me"'));
  assert.match(un, /admin\.from\("adventure_teams"\)\.delete\(\)\.eq\("user_id", uid\)/);
  assert.match(code("src/lib/adventureonline.ts"), /export const unregisterTeam = \(\) => call<\{ ok: true \}>\("unregister"\);/);
});

test("★ 판 기록은 건 사람만 읽는다 — 방어자가 도전자의 계정 id · 팀 전체를 못 본다", () => {
  const pol = mig.slice(mig.indexOf("create policy adventure_matches_select_mine"));
  assert.match(pol, /^create policy adventure_matches_select_mine on public\.adventure_matches for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\);/);
  assert.match(mig, /drop policy if exists adventure_matches_select_mine on public\.adventure_matches;/);
});

test("★ 상대는 계정 id 가 아니라 public_id — opponents 가 user_id 를 내보내지 않고 start 는 public_id 로 찾는다", () => {
  assert.match(mig, /add column if not exists public_id uuid not null default gen_random_uuid\(\);/);
  assert.match(mig, /create unique index if not exists adventure_teams_public_id_key on public\.adventure_teams \(public_id\);/);
  const opp = fn.slice(fn.indexOf('op === "opponents"'), fn.indexOf('op === "start"'));
  assert.match(opp, /id: t\.public_id/);
  assert.doesNotMatch(opp, /user_id/, "상대 목록에 계정 id 가 섞이면 안 된다");
  const cand = fnBody("public.adventure_candidates");
  assert.doesNotMatch(cand.slice(0, cand.indexOf("as $$")), /user_id/, "후보 RPC 의 반환 칸에 계정 id 가 없다");
  assert.match(fn, /\.eq\("public_id", target\)/);
  assert.match(mig, /revoke all on function public\.adventure_candidates\(uuid, integer, integer\) from public, anon, authenticated;/);
});

test("★ 상대 고르기는 점수가 가까운 순 — 아무 200명이 아니라 DB 가 거리순으로", () => {
  assert.match(fnBody("public.adventure_candidates"), /order by abs\(coalesce\(r\.rating, 1000\) - coalesce\(p_rating, 1000\)\)/);
  assert.doesNotMatch(fn, /\.limit\(200\)/);
  assert.match(fn, /admin\.rpc\("adventure_candidates"/);
});

test("★ 내보내기에 내가 건 판 · 탈퇴하면 남의 판 기록에서 내 닉네임을 지운다 · 60일 보관 크론(비밀 없음)", () => {
  assert.ok((ACCOUNT_EXPORT_TABLES as readonly string[]).includes("adventure_matches"));
  const scrub = fnBody("private.adventure_matches_scrub_name");
  assert.match(scrub, /if old\.opponent_id is not null and new\.opponent_id is null then\s+new\.opponent_name := '탈퇴한 사용자';/);
  assert.match(scrub, /jsonb_set\(new\.state, '\{sides,1,name\}'/);
  assert.match(mig, /create trigger adventure_matches_scrub_name before update of opponent_id on public\.adventure_matches/);
  assert.match(fnBody("private.adventure_retention"), /delete from public\.adventure_matches where status <> 'active' and created_at < now\(\) - interval '60 days';/);
  const cron = mig.slice(mig.indexOf("if to_regclass('cron.job') is null then"));
  assert.match(cron, /select cron\.unschedule\(jobid\) from cron\.job where jobname = 'adventure-retention-daily'/);
  assert.match(cron, /select cron\.schedule\('adventure-retention-daily', '45 18 \* \* \*', 'select private\.adventure_retention\(\)'\)/);
  assert.doesNotMatch(mig, /select[^;]*\bcommand\b[^;]*from cron\.job/i, "크론 명령 본문(비밀)을 읽지 않는다");
  assert.doesNotMatch(mig, /x-cron-secret|CRON_SECRET|service_role_key/i);
  // 이 파일은 판 · 점수 행을 직접 지우지 않는다(정리는 크론이 나이로만)
  const top = mig.replace(fnBody("private.adventure_retention"), "");
  assert.doesNotMatch(top, /delete from public\.adventure_(matches|ratings|teams)/);
  assert.doesNotMatch(top, /drop table/i);
});

// ── 5) 닉네임 ──────────────────────────────────────────────────────────────────

test("★ 닉네임 — 한글 채움 글자 · 부드러운 하이픈 · 서식 글자는 거절, 보이는 글자가 하나는 있어야 한다", () => {
  for (const c of [0x3164, 0x115f, 0x1160, 0xffa0, 0x00ad, 0x200b, 0x200e, 0x2060, 0xfeff, 0x2800]) {
    const ch = String.fromCharCode(c);
    assert.equal(cleanNick(ch), null, c.toString(16));
    assert.equal(cleanNick(`가${ch}나`), null, `가 ${c.toString(16)} 나`);
  }
  assert.equal(cleanNick("!!! ..."), null, "글자 · 숫자가 하나도 없다");
  assert.equal(cleanNick("  숲속   탐험가 "), "숲속 탐험가");
  assert.equal(cleanNick("Kim 7"), "Kim 7");
  assert.equal(cleanNick("ᄒ" + "ᅡ" + "ᆫ"), "한", "NFC 로 모은다(같은 이름이 둘로 갈리지 않게)");
});

test("★ 닉네임은 대소문자를 무시하고 하나만 — 함수가 먼저 거르고 DB unique 가 마지막 그물(겹친 이름이 있으면 건너뛰고 알림)", () => {
  // 2026-11-09 다듬기: ilike 는 PostgREST 가 '*' 를 '%' 로 바꿔 거짓 겹침 — lower() 비교 RPC(advonline.test)
  assert.match(fn, /if \(await nickTaken\(admin, nickname, uid\)\) return json\(\{ error: "nick taken" \}, 409\);/);
  assert.match(fn, /if \(error\.code === "23505"\) return json\(\{ error: "nick taken" \}, 409\);/);
  assert.match(mig, /if exists \(select 1 from public\.adventure_teams group by lower\(nickname\) having count\(\*\) > 1\) then\s+raise notice/);
  assert.match(mig, /create unique index adventure_teams_nick_lower_key on public\.adventure_teams \(lower\(nickname\)\);/);
  assert.match(code("src/lib/adventureonline.ts"), /"nick taken": "이미 쓰는 닉네임이에요"/);
});

// ── 6) 엔진 지문 ───────────────────────────────────────────────────────────────

test("★ 엔진 지문 — 복사본에서 만든 값이 앱 · 함수 양쪽에 같고, start 는 다르면 409 · 판을 연 엔진이 바뀌면 무효", () => {
  assert.equal(ENGINE_HASH, engineHash(root), "엔진을 고쳤으면 node scripts/adventure-shared.mjs");
  assert.equal(read(`src/lib/${HASH_FILE}`), hashContent(root));
  assert.equal(read(`supabase/functions/_shared/adventure/${HASH_FILE}`), hashContent(root));
  assert.match(fn, /if \(body\.engine !== ENGINE_HASH\) return json\(\{ error: "engine", server: ENGINE_HASH \}, 409\);/);
  assert.match(fn, /engine: ENGINE_HASH \}\)\.select\("id"\)\.single\(\)/, "판에 연 엔진을 남긴다");
  // 판을 연 엔진이 바뀌었으면 무효 — 2026-11-09 다듬기부터 200 {status: "void"}(4xx 면 앱이 '앱을 새로 고쳐'로 잘못 말했다)
  assert.match(fn, /if \(m\.engine !== ENGINE_HASH\) \{\s+await voidMatch\(admin, m\.id\);\s+return json\(\{ status: "void" \}\);/);
  assert.match(mig, /check \(status in \('active', 'done', 'void'\)\)/);
  const online = code("src/lib/adventureonline.ts");
  assert.match(online, /call<[^>]+>\("start", \{ opponent, engine: ENGINE_HASH \}\)/);
  assert.match(online, /engine: "앱을 새로 고쳐 주세요"/);
});
