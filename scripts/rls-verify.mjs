// RLS 정책을 바꿀 때: 운영 DB 를 건드리지 않고 옛 정책 대 새 정책이 같은 결과를 내는지 로컬에서 견주는 도구. [2026-09-29]
//
//   npm i --no-save @electric-sql/pglite            (PGlite = 노드에서 도는 진짜 Postgres — 프로젝트 의존성이 아니다)
//   node scripts/rls-verify.mjs supabase/migrations/<새 migration>.sql
//
// 하는 일: (1) Supabase 흉내(역할 · auth · storage)를 세우고 schema.sql(이미 이 migration 이 붙어 있으면 뗀 판)을 그대로 올린다
//   (2) 가짜 커플 5쌍 · 사용자 12명 데이터를 넣는다 (3) **옛 정책**으로 사용자마다 모든 표에서 보이는 행의 지문(행 수 + md5) ·
//   삭제 · 수정 · 삽입 시도(내 커플 · 남의 커플 · 남 행세 · 남의 자식 행 · 상대의 비밀일기) 결과 · 함수 권한 · 실행 시간을 잰다
//   (4) migration 을 적용하고 (5) 똑같이 다시 잰다 (6) 달라지면 보고하고 종료 코드 1 (7) 한 번 더 적용해 멱등을 본다
//   (8) 신규 bootstrap(schema.sql + migration)이 같은 정책을 만드는지 본다.
// 의도한 변화(함수 권한)는 `fn` 에 옛 값 -> 새 값으로 나오니 눈으로 본다. 표나 열이 바뀌면 아래 SEED · INSERTS · UPDATES 를 함께 고친다.
// ⚠ 운영에서 쓰기 시도(DELETE · UPDATE · INSERT 를 되돌리는 방식)를 돌리지 마라 — 자동 권한 검사가 막는다(2026-09-29). 여기서 한다.
// 2026-09-29 검증: 옛 정책 61개가 운영과 같음을(정책별 지문) 확인한 뒤 돌렸고, 일부러 망가뜨린 정책 8개 중 의미가 달라진 6개를 모두 잡았다
//   (나머지 둘은 with check · 중첩 RLS 가 가려 결과가 같은 동등 변형이었다).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const readSql = (p) => fs.readFileSync(`${ROOT}/${p}`, "utf8").replace(/\r\n/g, "\n");
const MIG_ARG = process.argv[2];
if (!MIG_ARG) {
  console.error("사용법: node scripts/rls-verify.mjs supabase/migrations/<파일>.sql");
  process.exit(2);
}
const migration = fs.readFileSync(MIG_ARG, "utf8").replaceAll("\r\n", "\n");
// schema.sql 끝에 이 migration 이 이미 붙어 있으면(신규 bootstrap 과 같게 맞추는 규칙) 떼어서 '옛 상태'로 쓴다.
const fullSchema = readSql("supabase/schema.sql");
const oldSchema = fullSchema.includes(migration.trim()) ? fullSchema.replace(migration.trim(), "") : fullSchema;

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false,
  created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const SEED = `
set ourdays.suppress_activity = 'on';
insert into auth.users (id, email, is_anonymous) select md5('u'||g)::uuid, 'u'||g||'@t.test', g = 12 from generate_series(1,12) g;
insert into public.couples (id, invite_code, start_date, created_by)
  select md5('c'||g)::uuid, 'CODE'||g, date '2026-01-01', md5('u'||(2*g-1))::uuid from generate_series(1,5) g;
insert into public.couple_members (couple_id, user_id, nickname)
  select md5('c'||g)::uuid, md5('u'||u)::uuid, 'n'||u from generate_series(1,4) g, lateral (values (2*g-1),(2*g)) v(u);
insert into public.couple_members (couple_id, user_id, nickname) values (md5('c5')::uuid, md5('u9')::uuid, 'n9');
insert into public.deco_entries (id, couple_id, entry_date, title, created_by, visibility)
  select md5('e'||g||'_'||i)::uuid, md5('c'||g)::uuid, date '2026-01-01' + i, 't'||i,
         md5('u'||(case when g = 5 then 9 else 2*g - (i % 2) end))::uuid, case when i % 4 = 0 then 'private' else 'shared' end
  from generate_series(1,5) g, generate_series(1, case when g = 1 then 300 else 30 end) i;
insert into public.entry_reactions (entry_id, couple_id, emoji, created_by)
  select d.id, d.couple_id, e.emoji, case when e.emoji = 'b' and d.couple_id <> md5('c5')::uuid
    then (select m.user_id from public.couple_members m where m.couple_id = d.couple_id and m.user_id <> d.created_by limit 1) else d.created_by end
  from public.deco_entries d, (values ('a'),('b'),('c')) e(emoji);
insert into public.entry_comments (entry_id, couple_id, body, created_by)
  select d.id, d.couple_id, 'c'||n, d.created_by from public.deco_entries d, generate_series(1,2) n;
insert into public.couple_logs (couple_id, log_date, slot, body, created_by)
  select md5('c'||g)::uuid, date '2026-02-01' + d, s, 'log', md5('u'||(case when g = 5 then 9 else 2*g - (d % 2) end))::uuid
  from generate_series(1,5) g, generate_series(1,20) d, (values ('am'),('pm')) sl(s);
insert into public.log_comments (log_id, couple_id, body, created_by)
  select l.id, l.couple_id, 'lc', l.created_by from (select * from public.couple_logs order by id limit 120) l;
insert into public.pokes (id, couple_id, from_user, message)
  select md5('p'||g||'_'||i)::uuid, md5('c'||g)::uuid, md5('u'||(case when g = 5 then 9 else 2*g - (i % 2) end))::uuid, 'm'
  from generate_series(1,5) g, generate_series(1,30) i;
insert into public.poke_reactions (poke_id, couple_id, emoji, created_by)
  select p.id, p.couple_id, 'x', p.from_user from (select * from public.pokes order by id limit 20) p;
insert into public.mood_checkins (couple_id, user_id, emoji) select couple_id, user_id, 'm' from public.couple_members;
insert into public.qa_answers (couple_id, question_id, body, user_id)
  select m.couple_id, 'q'||k||'@2026-01-0'||k, 'a', m.user_id from public.couple_members m, generate_series(1,9) k where k <= 5 or substr(m.nickname, 2)::int % 2 = 1;
insert into public.quiz_responses (couple_id, question_id, self_choice, guess_choice, user_id)
  select m.couple_id, 'z'||k, 'a', 'b', m.user_id from public.couple_members m, generate_series(1,5) k where k <= 2 or substr(m.nickname, 2)::int % 2 = 1;
insert into public.letters (couple_id, from_user, body, open_at)
  select m.couple_id, m.user_id, 'l', now() + ((n - 2) || ' days')::interval from public.couple_members m, generate_series(1,3) n;
insert into public.couple_bucket (couple_id, title, created_by) select m.couple_id, 'b', m.user_id from public.couple_members m, generate_series(1,3) n;
insert into public.couple_events (couple_id, title, event_date, created_by) select m.couple_id, 'e', current_date, m.user_id from public.couple_members m, generate_series(1,3) n;
insert into public.couple_photos (couple_id, storage_path, created_by) select m.couple_id, m.couple_id||'/p'||n, m.user_id from public.couple_members m, generate_series(1,5) n;
insert into public.chat_reads (couple_id, user_id) select couple_id, user_id from public.couple_members;
insert into public.activity_reads (couple_id, user_id) select couple_id, user_id from public.couple_members;
insert into public.activity_events (couple_id, actor_user, kind) select m.couple_id, m.user_id, 'poke' from public.couple_members m, generate_series(1,4) n;
insert into public.notify_prefs (user_id) select id from auth.users where not is_anonymous;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://ep/'||id, 'k', 'a' from auth.users where not is_anonymous;
insert into public.debug_logs (user_id, tag) select id, 't' from auth.users, generate_series(1,2);
insert into public.couple_island (couple_id, state) select id, '{}'::jsonb from public.couples;
insert into storage.buckets (id, name) values ('couple-photos', 'couple-photos') on conflict do nothing;
insert into storage.objects (bucket_id, name) select 'couple-photos', c.id||'/f'||n from public.couples c, generate_series(1,4) n;
analyze;
`;

const TABLES = ["activity_events","activity_reads","chat_reads","couple_bucket","couple_events","couple_island","couple_logs",
  "couple_members","couple_photos","couples","debug_logs","deco_entries","entry_comments","entry_reactions","letters","log_comments",
  "mood_checkins","notify_prefs","poke_reactions","pokes","push_subscriptions","qa_answers","quiz_responses"];
const DELETE_TABLES = ["couple_bucket","couple_events","couple_logs","couple_members","couple_photos","deco_entries","entry_comments",
  "entry_reactions","letters","log_comments","poke_reactions","notify_prefs","push_subscriptions"];
const UPDATES = { activity_reads: "last_read_at", chat_reads: "last_read_at", couple_bucket: "title", couple_events: "title",
  couple_logs: "body", couple_members: "nickname", couples: "start_date", deco_entries: "title", mood_checkins: "emoji",
  qa_answers: "body", notify_prefs: "updated_at" };
const INSERTS = [
  ["pokes", "", "insert into public.pokes(couple_id, from_user, kind, message) values ({c},{u},'x','x')"],
  ["mood_checkins", "", "insert into public.mood_checkins(couple_id, user_id, emoji) values ({c},{u},'x')"],
  ["couple_bucket", "", "insert into public.couple_bucket(couple_id, title, created_by) values ({c},'x',{u})"],
  ["couple_events", "", "insert into public.couple_events(couple_id, title, event_date, created_by) values ({c},'x',current_date,{u})"],
  ["couple_photos", "", "insert into public.couple_photos(couple_id, storage_path, created_by) values ({c},'x/y',{u})"],
  ["deco_entries", "", "insert into public.deco_entries(couple_id, entry_date, created_by) values ({c},current_date,{u})"],
  ["letters", "", "insert into public.letters(couple_id, body, from_user) values ({c},'x',{u})"],
  ["qa_answers", "", "insert into public.qa_answers(couple_id, question_id, body, user_id) values ({c},'harness','x',{u})"],
  ["quiz_responses", "", "insert into public.quiz_responses(couple_id, question_id, self_choice, guess_choice, user_id) values ({c},'harness','a','b',{u})"],
  ["chat_reads", "", "insert into public.chat_reads(couple_id, user_id) values ({c},{u})"],
  ["activity_reads", "", "insert into public.activity_reads(couple_id, user_id) values ({c},{u})"],
  ["couple_logs", "", "insert into public.couple_logs(couple_id, log_date, slot, created_by) values ({c},(now() at time zone 'Asia/Seoul')::date,case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end,{u})"],
  ["entry_reactions", "e", "insert into public.entry_reactions(entry_id, couple_id, emoji, created_by) values ({e},{c},'x',{u})"],
  ["entry_comments", "e", "insert into public.entry_comments(entry_id, couple_id, body, created_by) values ({e},{c},'x',{u})"],
  ["log_comments", "l", "insert into public.log_comments(log_id, couple_id, body, created_by) values ({l},{c},'x',{u})"],
  ["poke_reactions", "p", "insert into public.poke_reactions(poke_id, couple_id, emoji, created_by) values ({p},{c},'x',{u})"],
];

const lit = (v) => (v == null ? "null" : `'${v}'`);
const errCode = (e) => e?.code ?? String(e?.message ?? e).slice(0, 50);

async function boot(schemaSql) {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(schemaSql);
  return db;
}
async function as(db, who) {
  await db.exec("reset role");
  if (who.kind === "anon") {
    await db.query("select set_config('request.jwt.claims', '', false)");
    await db.exec("set role anon");
  } else {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: who.id, role: "authenticated" })]);
    await db.exec("set role authenticated");
  }
}
async function attempt(db, sql) {
  await db.exec("begin");
  try {
    const r = await db.query(sql);
    return "ok:" + (r.affectedRows ?? r.rows.length);
  } catch (e) {
    return "err:" + errCode(e);
  } finally {
    await db.exec("rollback");
  }
}
async function q1(db, sql) {
  await db.exec("reset role");
  return (await db.query(sql)).rows;
}

async function usersOf(db) {
  const rows = await q1(db, `select u.id, u.is_anonymous, (select m.couple_id from public.couple_members m where m.user_id = u.id limit 1) as mc from auth.users u order by u.id`);
  const out = rows.map((r) => ({ kind: r.mc ? "member" : "lonely", id: r.id, mc: r.mc }));
  out.push({ kind: "anon", id: null, mc: null });
  return out;
}

async function snapshot(db, users) {
  const acc = {};
  for (const w of users) {
    const who = `${w.kind}|${w.id ?? "-"}`;
    await as(db, w);
    for (const t of TABLES) {
      try {
        const r = await db.query(`select count(*)::int as n, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h from public.${t} x`);
        acc[`${who}|S|${t}`] = `${r.rows[0].n}:${r.rows[0].h}`;
      } catch (e) { acc[`${who}|S|${t}`] = "err:" + errCode(e); }
    }
    try {
      const r = await db.query(`select count(*)::int as n, md5(coalesce(string_agg(o.id::text, '|' order by o.id::text), '')) as h from storage.objects o where o.bucket_id = 'couple-photos'`);
      acc[`${who}|S|storage`] = `${r.rows[0].n}:${r.rows[0].h}`;
    } catch (e) { acc[`${who}|S|storage`] = "err:" + errCode(e); }
  }
  await db.exec("reset role");
  return acc;
}

async function dml(db, users) {
  const acc = {};
  for (const w of users) {
    const who = `${w.kind}|${w.id ?? "-"}`;
    await db.exec("reset role");
    const mc = w.mc;
    const one = async (sql) => (await db.query(sql)).rows[0]?.id ?? null;
    const fc = await one(`select cc.id from public.couples cc where cc.id is distinct from ${lit(mc)} and not exists (select 1 from public.couple_members m where m.couple_id = cc.id and m.user_id ${w.id ? "= " + lit(w.id) : "is null"}) order by cc.id limit 1`);
    const oth = (await db.query(`select m.user_id as id from public.couple_members m where m.user_id is distinct from ${lit(w.id)} order by m.user_id limit 1`)).rows[0]?.id ?? null;
    const ids = {
      own: { e: await one(`select id from public.deco_entries where couple_id ${mc ? "= " + lit(mc) : "is null"} and visibility = 'shared' order by id limit 1`),
             l: await one(`select id from public.couple_logs where couple_id ${mc ? "= " + lit(mc) : "is null"} order by id limit 1`),
             p: await one(`select id from public.pokes where couple_id ${mc ? "= " + lit(mc) : "is null"} order by id limit 1`) },
      foreign: { e: await one(`select id from public.deco_entries where couple_id = ${lit(fc)} order by id limit 1`),
                 l: await one(`select id from public.couple_logs where couple_id = ${lit(fc)} order by id limit 1`),
                 p: await one(`select id from public.pokes where couple_id = ${lit(fc)} order by id limit 1`) },
      priv: { e: await one(`select id from public.deco_entries where couple_id ${mc ? "= " + lit(mc) : "is null"} and visibility = 'private' and created_by is distinct from ${lit(w.id)} order by id limit 1`) },
    };
    const list = [];
    for (const t of DELETE_TABLES) list.push([`D|${t}`, `delete from public.${t}`]);
    for (const [t, c] of Object.entries(UPDATES)) list.push([`U|${t}`, `update public.${t} set ${c} = ${c}`]);
    for (const [t, needs, tmpl] of INSERTS) {
      for (const variant of ["own", "spoof", "foreign", "crosslink", "priv"]) {
        const c = variant === "foreign" ? fc : mc;
        const u = variant === "spoof" ? oth : w.id;
        const set = variant === "foreign" || variant === "crosslink" ? ids.foreign : variant === "priv" ? { ...ids.own, e: ids.priv.e } : ids.own;
        if (variant === "crosslink" && needs === "") continue;
        if (variant === "priv" && needs !== "e") continue;
        let s = tmpl;
        const vals = { c, u, e: set.e, l: set.l, p: set.p };
        let skip = false;
        for (const k of ["c", "u", "e", "l", "p"]) if (s.includes(`{${k}}`) && vals[k] == null) skip = true;
        if (skip) continue;
        for (const k of ["c", "u", "e", "l", "p"]) s = s.replaceAll(`{${k}}`, lit(vals[k]));
        list.push([`I|${t}|${variant}`, s]);
      }
    }
    await as(db, w);
    for (const [k, sql] of list) acc[`${who}|${k}`] = await attempt(db, sql);
  }
  await db.exec("reset role");
  return acc;
}

async function fnChecks(db) {
  const acc = {};
  await db.exec("reset role");
  const mu = (await db.query(`select user_id, couple_id from public.couple_members order by couple_id, user_id limit 1`)).rows[0];
  const eOwn = (await db.query(`select id from public.deco_entries where couple_id = '${mu.couple_id}' and visibility = 'shared' limit 1`)).rows[0]?.id;
  await as(db, { kind: "anon" });
  const anon = {
    island_create: `select public.island_create('{}'::jsonb)`, island_action: `select public.island_action(0, '{}'::jsonb)`,
    create_couple: `select public.create_couple('x', current_date)`, join_couple: `select public.join_couple('000000', 'x')`,
    rotate_invite_code: `select public.rotate_invite_code('${mu.couple_id}')`, can_view_entry: `select public.can_view_entry('${eOwn}')`,
    qa_i_answered: `select public.qa_i_answered('${mu.couple_id}', 'x')`, quiz_i_answered: `select public.quiz_i_answered('${mu.couple_id}', 'x')`,
    is_couple_member: `select public.is_couple_member('${mu.couple_id}')`, my_couple_ids: `select private.my_couple_ids()`,
    capture_couple_activity: `select public.capture_couple_activity()`,
  };
  for (const [k, s] of Object.entries(anon)) acc[`F|anon|${k}`] = await attempt(db, s);
  await as(db, { kind: "member", id: mu.user_id });
  const auth = {
    my_couple_ids: `select private.my_couple_ids()`, is_couple_member: `select public.is_couple_member('${mu.couple_id}')`,
    can_view_entry: `select public.can_view_entry('${eOwn}')`, qa_i_answered: `select public.qa_i_answered('${mu.couple_id}', 'x')`,
    quiz_i_answered: `select public.quiz_i_answered('${mu.couple_id}', 'x')`, island_action_stale: `select public.island_action(-1, '{}'::jsonb)`,
    island_create: `select public.island_create('{}'::jsonb)`, join_couple: `select public.join_couple('000000', 'x')`,
    rotate_invite_code: `select public.rotate_invite_code('${mu.couple_id}')`, capture_couple_activity: `select public.capture_couple_activity()`,
    forbid_created_by_change: `select public.forbid_created_by_change()`, sync_event_recurrence: `select public.sync_event_recurrence()`,
    touch_member_updated_at: `select public.touch_member_updated_at()`,
  };
  for (const [k, s] of Object.entries(auth)) acc[`F|auth|${k}`] = await attempt(db, s);
  await db.exec("reset role");
  return acc;
}

async function timing(db) {
  const acc = {};
  await db.exec("reset role");
  const cid = (await db.query(`select couple_id from public.entry_reactions group by couple_id order by count(*) desc limit 1`)).rows[0].couple_id;
  const uid = (await db.query(`select user_id from public.couple_members where couple_id = '${cid}' order by user_id limit 1`)).rows[0].user_id;
  const qs = [
    `select id, entry_id, emoji, created_by from public.entry_reactions where couple_id = '${cid}'`,
    `select id, entry_id, body, created_by, created_at from public.entry_comments where couple_id = '${cid}' order by created_at`,
    `select id, storage_path, thumb_path, created_by, created_at from public.couple_photos where couple_id = '${cid}'`,
    `select id, log_id, body, created_by, created_at from public.log_comments where couple_id = '${cid}' order by created_at`,
    `select * from public.deco_entries where couple_id = '${cid}'`,
    `select * from public.couple_logs where couple_id = '${cid}'`,
    `select * from public.qa_answers where couple_id = '${cid}'`,
  ];
  await as(db, { kind: "member", id: uid });
  for (let k = 0; k < qs.length; k++) {
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const r = await db.query("explain (analyze, format json) " + qs[k]);
      const plan = r.rows[0]["QUERY PLAN"];
      const ms = (Array.isArray(plan) ? plan : JSON.parse(plan))[0]["Execution Time"];
      best = Math.min(best, ms);
    }
    acc[`T|${k + 1}`] = best.toFixed(2);
  }
  await db.exec("reset role");
  return acc;
}

async function policies(db) {
  return (await q1(db, `select tablename as t, policyname as p, cmd, roles::text as roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`));
}

function compare(before, after, filter) {
  const diffs = [];
  let n = 0;
  for (const k of Object.keys(before)) {
    if (!filter(k)) continue;
    n++;
    if (before[k] !== after[k]) diffs.push({ k, b: before[k], a: after[k] });
  }
  return { n, diffs };
}
function hist(map) {
  const h = {};
  for (const [k, v] of Object.entries(map)) {
    const p = k.split("|");
    if (!["D", "U", "I"].includes(p[2])) continue;
    const g = `${p[2]}${p[2] === "I" ? "." + p[4] : ""} ${/^ok:0$/.test(v) ? "ok0" : v.startsWith("ok:") ? "ok" : v}`;
    h[g] = (h[g] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(h).sort());
}

const t0 = Date.now();
const report = {};

// (1)(2) 부트스트랩 + 데이터
let db;
try {
  db = await boot(oldSchema);
} catch (e) {
  console.log("BOOTSTRAP FAILED:", errCode(e), String(e.message).slice(0, 400));
  process.exit(1);
}
await db.exec(SEED);
report.seed = (await q1(db, `select (select count(*) from public.deco_entries)::int as entries, (select count(*) from public.entry_reactions)::int as reactions, (select count(*) from public.couple_members)::int as members`))[0];
const users = await usersOf(db);
report.users = users.length;

// (3) 이전
const oldPolicies = await policies(db);
report.old_policy_count = oldPolicies.length;
report.old_roles = [...new Set(oldPolicies.map((p) => p.roles))];
const before = { ...(await snapshot(db, users)), ...(await dml(db, users)), ...(await fnChecks(db)), ...(await timing(db)) };

// (4) 마이그레이션
try {
  await db.exec(migration);
} catch (e) {
  console.log("MIGRATION FAILED:", errCode(e), String(e.message).slice(0, 600));
  process.exit(1);
}
const newPolicies = await policies(db);

// (5) 이후
const after = { ...(await snapshot(db, users)), ...(await dml(db, users)), ...(await fnChecks(db)), ...(await timing(db)) };

// (6) 비교
const snapCmp = compare(before, after, (k) => k.includes("|S|"));
const dmlCmp = compare(before, after, (k) => /\|(D|U|I)\|/.test(k));
report.snapshot = { compared: snapCmp.n, diffs: snapCmp.diffs.length, first: snapCmp.diffs.slice(0, 10) };
report.dml = { compared: dmlCmp.n, diffs: dmlCmp.diffs.length, first: dmlCmp.diffs.slice(0, 20) };
report.outcomes_after = hist(after);
report.outcomes_before_eq_after = JSON.stringify(hist(before)) === JSON.stringify(hist(after));
report.fn = Object.fromEntries(Object.keys(before).filter((k) => k.startsWith("F|")).map((k) => [k.slice(2), `${before[k]} -> ${after[k]}`]));
report.ms = Object.fromEntries(Object.keys(before).filter((k) => k.startsWith("T|")).map((k) => [k, `${before[k]} -> ${after[k]}`]));

// 정적 검사 + 운영과 정책 목록 대조
const strip = (s) => (s ?? "").replaceAll(/\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\)/gi, "");
const bareUid = newPolicies.filter((p) => /auth\.uid\(\)/.test(strip(p.qual) + strip(p.with_check)));
const oldFn = newPolicies.filter((p) => /is_couple_member\(/.test((p.qual ?? "") + (p.with_check ?? "")));
report.static = {
  new_policy_count: newPolicies.length,
  roles: [...new Set(newPolicies.map((p) => p.roles))],
  bare_auth_uid: bareUid.map((p) => `${p.t}.${p.p}`),
  still_is_couple_member: oldFn.map((p) => `${p.t}.${p.p}`),
  uses_my_couple_ids: newPolicies.filter((p) => /my_couple_ids/.test((p.qual ?? "") + (p.with_check ?? ""))).length,
};
// (7) 멱등 — 두 번째 적용
try {
  await db.exec(migration);
  const after2 = { ...(await snapshot(db, users)) };
  const c2 = compare(after, after2, (k) => k.includes("|S|"));
  const p2 = await policies(db);
  report.idempotent = { ok: true, snapshot_diffs: c2.diffs.length, same_policy_text: JSON.stringify(p2) === JSON.stringify(newPolicies) };
} catch (e) {
  report.idempotent = { ok: false, error: errCode(e), msg: String(e.message).slice(0, 300) };
}

// (8) 신규 bootstrap = schema.sql + 마이그레이션
try {
  const fresh = await boot(oldSchema.replace(/\n+$/, "\n") + "\n" + migration.trim() + "\n");
  const fp = await policies(fresh);
  report.fresh_bootstrap = { ok: true, same_policies_as_migrated: JSON.stringify(fp) === JSON.stringify(newPolicies), count: fp.length };
} catch (e) {
  report.fresh_bootstrap = { ok: false, error: errCode(e), msg: String(e.message).slice(0, 400) };
}

report.seconds = ((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify(report, null, 1));
const failed =
  report.snapshot.diffs > 0 ||
  report.dml.diffs > 0 ||
  report.static.bare_auth_uid.length > 0 ||
  report.idempotent?.ok !== true ||
  report.idempotent?.snapshot_diffs > 0 ||
  report.fresh_bootstrap?.ok !== true ||
  report.fresh_bootstrap?.same_policies_as_migrated !== true;
if (failed) {
  console.error("\n실패: 위 snapshot · dml · static · idempotent · fresh_bootstrap 를 보세요.");
  process.exit(1);
}
console.error("\n통과: 옛 정책과 새 정책이 모든 사용자 · 표 · 쓰기 시도에서 같은 결과를 냈어요.");
