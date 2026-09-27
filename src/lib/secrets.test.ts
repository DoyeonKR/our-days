// 비밀값 lock — Supabase 개인 토큰 · 비밀 키 · service_role JWT 가 레포에 들어오지 않는다. [2026-09-27]
//
// Claude 가 운영 프로젝트에 직접 붙는 길은 claude.ai 의 Supabase 커넥터(OAuth)다 — 토큰을 주고받지 않는다(README §7).
// 그래도 스크립트 · 문서 · 테스트 픽스처에 토큰을 붙여 넣는 실수는 **공개 레포**에 그대로 올라간다(PAT 는 계정 전체 권한이다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");

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
