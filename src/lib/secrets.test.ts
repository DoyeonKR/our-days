// 비밀값 lock — Supabase 개인 토큰 · 비밀 키가 레포에 들어오지 않는다. [2026-09-27 Claude 직접 접근]
//
// Claude 가 운영 프로젝트에 직접 붙도록 .mcp.json 을 레포에 두었다. 헤더는 환경 변수(SUPABASE_ACCESS_TOKEN)만 가리킨다 —
// 여기에 토큰 값을 붙여 넣으면 **공개 레포**에 그대로 올라간다(PAT 는 계정 전체 권한이다). 스크립트 · 문서 · 테스트 픽스처에
// 토큰을 적는 실수도 같이 막는다. 넣는 곳은 scripts/supabase-token.ps1 하나다(README §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");

test("★ .mcp.json 은 토큰을 환경 변수로만 가리키고, 이 프로젝트 하나에만 붙는다", () => {
  const cfg = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
  const s = cfg.mcpServers.supabase;
  assert.equal(s.headers.Authorization, "Bearer ${SUPABASE_ACCESS_TOKEN}");
  const url = new URL(s.url);
  assert.equal(url.origin, "https://mcp.supabase.com");
  assert.equal(url.searchParams.get("project_ref"), "tqegatiuembcvphxmujl");
  // 계정 도구(프로젝트 만들기 · 지우기 · 조직)가 열리지 않게 기능을 묶어 둔다
  assert.ok(!(url.searchParams.get("features") ?? "").split(",").includes("account"));
});

test("★ 추적되는 파일에 Supabase 개인 토큰 · 비밀 키 · service_role JWT 가 없다", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((f) => f && !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp3|mp4|webm|zip|pdf)$/i.test(f));
  const PAT = /sbp_[0-9a-f]{40}/;
  const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{16,}/;
  const JWT = /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g;
  const hits: string[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(join(root, f), "utf8");
    } catch {
      continue; // 지워졌지만 아직 커밋 전인 파일
    }
    if (PAT.test(text) || SECRET_KEY.test(text)) hits.push(f);
    for (const m of text.matchAll(JWT)) {
      const payload = Buffer.from(m[1], "base64url").toString("utf8");
      if (/"role"\s*:\s*"service_role"/.test(payload)) hits.push(`${f} (service_role JWT)`);
    }
  }
  assert.deepEqual(hits, [], "비밀값이 레포에 있다 — 지우고, 그 토큰 · 키는 대시보드에서 폐기해야 한다");
});
