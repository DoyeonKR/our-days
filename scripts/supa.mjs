// Supabase Management API 도구 — 운영 프로젝트에 SQL · 로그 · 엣지 함수 배포를 브라우저 없이. [2026-09-27]
// Claude 가 쓰려고 만들었다(MCP 가 안 붙은 세션 · 앱을 다시 켜기 전에도 된다). 사람이 써도 같다.
//
// 토큰: 환경 변수 SUPABASE_ACCESS_TOKEN, 없으면 Windows 사용자 환경 변수(레지스트리)에서 읽는다 —
//   방금 토큰을 넣었어도 앱을 다시 켤 필요가 없다. 넣기 · 바꾸기는 scripts/supabase-token.ps1.
//   ⚠ 토큰을 출력하는 코드를 넣지 않는다 — 이 도구의 출력은 Claude 의 대화에 그대로 들어간다.
//
//   node scripts/supa.mjs status                      프로젝트 · 서비스 상태
//   node scripts/supa.mjs sql "select 1"              SQL — 기본은 읽기 전용 트랜잭션(쓰기는 DB 가 거절한다)
//   node scripts/supa.mjs sql -f q.sql                파일의 SQL
//   node scripts/supa.mjs sql --write "..."           쓰기 SQL — ⚠ 운영 DB. 사람에게 먼저 확인
//   node scripts/supa.mjs logs postgres [분] [검색어]  최근 로그(postgres · api · rest · auth · functions · realtime · storage)
//   node scripts/supa.mjs functions                   엣지 함수 목록
//   node scripts/supa.mjs deploy <함수>               엣지 함수 배포 — verify_jwt 는 지금 값 그대로, _shared 를 쓰면 같이 올린다
//
// ⚠ 스키마 변경(마이그레이션)은 이걸로 돌리지 않는다 — supabase/migrations 에 파일로 넣고 main 에 push 하면
//   GitHub 연동이 적용한다(README §7). 직접 SQL 은 조회 · 진단 · 급한 불 끄기용이다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REF = process.env.SUPABASE_PROJECT_REF || "tqegatiuembcvphxmujl";
const API = "https://api.supabase.com/v1";
const ROOT = join(import.meta.dirname, "..");

let cached;
function token() {
  if (cached) return cached;
  let t = process.env.SUPABASE_ACCESS_TOKEN;
  if (!t && process.platform === "win32") {
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "SUPABASE_ACCESS_TOKEN"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      t = out.match(/SUPABASE_ACCESS_TOKEN\s+REG_(?:EXPAND_)?SZ\s+(\S+)/)?.[1];
    } catch {
      // 값이 없으면 reg 가 실패한다 — 아래 안내로 넘어간다
    }
  }
  if (!t) {
    console.error(
      "SUPABASE_ACCESS_TOKEN 이 없어요 — 넣기: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-token.ps1",
    );
    process.exit(2);
  }
  return (cached = t.trim());
}

async function api(path, init = {}, { allow404 = false } = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...init.headers },
  });
  if (allow404 && res.status === 404) return null;
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // JSON 이 아니면 글자 그대로
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${init.method ?? "GET"} ${path.split("?")[0]}`);
    console.error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    process.exit(1);
  }
  return body;
}

// 레포 기준 경로로 파일을 모은다 — 배포 때 파일 이름이 곧 서버 쪽 경로다(CLI 와 같다)
function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out.sort();
}

function usage() {
  const lines = readFileSync(new URL(import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("//   node "));
  console.error(lines.map((l) => l.slice(5)).join("\n"));
  process.exit(64);
}

const [cmd, ...args] = process.argv.slice(2);

const commands = {
  async status() {
    const p = await api(`/projects/${REF}`);
    console.log(`${p.name} (${REF}) — ${p.status} · ${p.region} · Postgres ${p.database?.version ?? "?"}`);
    const health = await api(`/projects/${REF}/health?services=auth,db,realtime,rest,storage&timeout_ms=5000`);
    for (const s of health) {
      console.log(`  ${String(s.name).padEnd(9)} ${s.healthy ? "ok " : "ERR"} ${s.status ?? ""}${s.error ? ` — ${s.error}` : ""}`);
    }
  },

  async sql() {
    let write = false;
    let file = null;
    const words = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--write") write = true;
      else if (args[i] === "-f") file = args[++i];
      else words.push(args[i]);
    }
    const query = file ? readFileSync(file, "utf8") : words.join(" ");
    if (!query.trim()) usage();
    const rows = await api(`/projects/${REF}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, read_only: !write }),
    });
    console.log(JSON.stringify(rows, null, 2));
  },

  async logs() {
    const TABLES = {
      postgres: "postgres_logs",
      api: "edge_logs",
      rest: "postgrest_logs",
      auth: "auth_logs",
      functions: "function_logs",
      realtime: "realtime_logs",
      storage: "storage_logs",
    };
    const [src = "postgres", minutes = "30", ...rest] = args;
    const table = TABLES[src];
    if (!table || !(Number(minutes) > 0)) usage();
    const search = rest.join(" ").replace(/['"\\]/g, ""); // 따옴표는 SQL 문자열을 깨뜨린다
    const where = search ? ` where regexp_contains(event_message, '${search}')` : "";
    const end = new Date();
    const start = new Date(end.getTime() - Number(minutes) * 60_000);
    const q = new URLSearchParams({
      sql: `select timestamp, event_message from ${table}${where} order by timestamp desc limit 100`,
      iso_timestamp_start: start.toISOString(),
      iso_timestamp_end: end.toISOString(),
    });
    const out = await api(`/projects/${REF}/analytics/endpoints/logs.all?${q}`);
    if (out?.error) {
      console.error(JSON.stringify(out.error, null, 2));
      process.exit(1);
    }
    const rows = (out?.result ?? []).reverse(); // 오래된 것부터
    for (const r of rows) {
      const at = new Date(Number(r.timestamp) / 1000).toISOString(); // 마이크로초
      console.log(`${at}  ${String(r.event_message).replace(/\s+/g, " ").slice(0, 400)}`);
    }
    if (!rows.length) console.log(`(${src} 로그 ${minutes}분 동안 없음)`);
  },

  async functions() {
    const fns = await api(`/projects/${REF}/functions`);
    for (const f of fns) {
      console.log(`${f.slug.padEnd(16)} v${f.version}  ${f.status}  verify_jwt=${f.verify_jwt}  ${new Date(f.updated_at).toISOString()}`);
    }
  },

  async deploy() {
    const slug = args.find((a) => !a.startsWith("--"));
    if (!slug || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(slug)) usage();
    const dir = `supabase/functions/${slug}`;
    if (!existsSync(join(ROOT, dir, "index.ts"))) {
      console.error(`${dir}/index.ts 가 없어요`);
      process.exit(1);
    }
    const files = walk(dir);
    // ../_shared/ 를 import 하면 서버가 같이 묶어야 하므로 함께 올린다
    if (files.some((f) => readFileSync(join(ROOT, f), "utf8").includes("../_shared/"))) {
      files.push(...walk("supabase/functions/_shared"));
    }
    // verify_jwt 를 빠뜨리면 기본값(true)으로 바뀐다 — 크론이 부르는 daily-reminders 는 false 라 알림이 조용히 멎는다
    const cur = await api(`/projects/${REF}/functions/${slug}`, {}, { allow404: true });
    const verify_jwt = args.includes("--no-verify-jwt")
      ? false
      : args.includes("--verify-jwt")
        ? true
        : (cur?.verify_jwt ?? true);
    const form = new FormData();
    const meta = { name: slug, entrypoint_path: `${dir}/index.ts`, verify_jwt };
    form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    for (const f of files) {
      form.append("file", new Blob([readFileSync(join(ROOT, f))], { type: "application/typescript" }), f);
    }
    console.log(`${slug} ← ${files.join(", ")} · verify_jwt=${verify_jwt}${cur ? ` · 지금 v${cur.version}` : " · 새 함수"}`);
    const out = await api(`/projects/${REF}/functions/deploy?slug=${slug}`, { method: "POST", body: form });
    console.log(`배포됨 — ${out.slug} v${out.version} ${out.status} verify_jwt=${out.verify_jwt}`);
  },
};

const run = commands[cmd];
if (!run) usage();
await run();
