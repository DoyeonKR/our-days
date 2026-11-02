// 낚시 점수 · 랭킹 lock. [사용자 2026-11-02 "개인당 점수도 반영하고 … 물고기 랭킹판을 별도로 … 개인단위 그리고 커플단위로"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { catchPoints, coupleScore, type FishCatch } from "./fishing.ts";

const root = process.cwd();
const sqlFile = "20261102000000_fish_catches.sql";
const sql = readFileSync(join(root, "supabase/migrations", sqlFile), "utf8").replace(/\r\n/g, "\n");
const fish = (grade: FishCatch["grade"], stage: FishCatch["stage"]): FishCatch => ({ family: "guppy", stage, grade, difficulty: 0 });

test("한 마리 점수 — 귀할수록 · 클수록 · 잘할수록 · 담을수록 높다 · 쓰레기는 2점", () => {
  assert.equal(catchPoints(fish("흔함", 0), 0, false, false), 10);
  assert.equal(catchPoints(fish("희귀", 0), 0, false, false), 58);
  assert.equal(catchPoints(fish("태초", 0), 0, false, false), 612);
  assert.ok(catchPoints(fish("보통", 2), 0, false, false) > catchPoints(fish("보통", 1), 0, false, false));
  assert.ok(catchPoints(fish("보통", 1), 0, false, false) > catchPoints(fish("보통", 0), 0, false, false));
  assert.ok(catchPoints(fish("보통", 0), 1, false, false) > catchPoints(fish("보통", 0), 0, false, false));
  assert.ok(catchPoints(fish("보통", 0), 0, true, false) > catchPoints(fish("보통", 0), 0, false, false));
  assert.ok(catchPoints(fish("보통", 0), 0, false, true) > catchPoints(fish("보통", 0), 0, false, false));
  assert.equal(catchPoints({ ...fish("태초", 2), junk: "junk_can" }, 1, true, false), 2);
  assert.equal(catchPoints(fish("흔함", 0), 9, false, false), catchPoints(fish("흔함", 0), 1, false, false), "솜씨는 0~1 로 자른다");
});

test("커플 점수 — 둘이 나눠 낚으면 한 사람이 다 낚은 것보다 높다", () => {
  assert.equal(coupleScore(100, 0), 100);
  assert.equal(coupleScore(50, 50), 150);
  assert.ok(coupleScore(50, 50) > coupleScore(100, 0));
  assert.equal(coupleScore(30, 70), coupleScore(70, 30));
});

test("서버 공식이 화면 공식과 같은 숫자를 쓴다 · 커플 공식 · 지금 구성원 둘만 · 남의 user_id 는 안 내려간다", () => {
  for (const s of ["10 * power(1.8::double precision, v_grade)", "when 2 then 2 when 1 then 1.3", "1 + 0.5 * v_q", "then 1.1 else 1", "then 1.25 else 1", "v_pts := 2"]) assert.ok(sql.includes(s), s);
  assert.ok(sql.includes("(sum(coalesce(u.score, 0)) + min(coalesce(u.score, 0)))::bigint"), "커플 = 합 + 낮은 쪽");
  assert.ok(sql.includes("having count(*) = 2"));
  const ret = /returns table \(([^)]*)\)/.exec(sql.slice(sql.indexOf("function public.fish_board")))?.[1] ?? "";
  assert.doesNotMatch(ret, /user_id/);
  assert.doesNotMatch(sql, /errcode = '40/, "재시도 고리 오류 코드 금지(README §11)");
  assert.match(sql, /to authenticated\n\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /revoke all on function public\.fish_board\(text, text\) from public, anon/);
});

test("schema.sql 끝에 같은 복사본 · 원격에만 있던 날씨 기록의 자리표시 파일 · 다시 돌려도 안전", () => {
  const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(schema.includes(sql.trim()), "schema.sql 복사본이 migration 과 달라졌어요");
  for (const f of ["20261101144520_weather_push_persona_and_alerts.sql", "20261101145042_weather_push_persona_community.sql"]) {
    const p = join(root, "supabase/migrations", f);
    assert.ok(existsSync(p), f);
    assert.ok(readFileSync(p, "utf8").split(/\r?\n/).every((l) => !l.trim() || l.startsWith("--")), `${f} 는 주석만`);
  }
  for (const s of ["create table if not exists", "create index if not exists", "drop policy if exists", "create or replace function"]) assert.ok(sql.includes(s), s);
});

test("화면 — 끌어올린 모든 결과가 점수로 올라간다 · 놓친 판은 안 올라간다 · 랭킹 탭이 있다", () => {
  const src = readFileSync(join(root, "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes('["rank", "랭킹"]'));
  assert.ok(src.includes("<FishRank"));
  assert.equal(src.split("reportCatch(").length - 1, 5, "정의 하나 + 담기 · 팔기 · 꽝 · 닫으며 팔기");
  const lose = src.slice(src.indexOf("const loseRound"), src.indexOf("/** 끌어올렸다"));
  assert.ok(!lose.includes("reportCatch("));
  const hub = readFileSync(join(root, "src/components/GameArcade.tsx"), "utf8");
  assert.match(hub, /<FishingGame coupleId=\{coupleId\} myName=\{myName\}/);
});
