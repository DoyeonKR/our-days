// 승인 목록(approved-fish.json)은 원본 둘(style-approvals.json · profiles.json)에서 구운 결과와 같아야 한다. [2026-11-11]
// 화면(quality.ts)은 300KB 짜리 profiles.json 대신 이 목록을 읽는다 — 원본만 고치고 node scripts/aqua-approved.mjs 를
// 안 돌리면 여기서 깨진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedForms } from "../../../scripts/aqua-approved.mjs";
import { MODEL_REVISION, isFishModelApproved } from "./quality.ts";

type Forms = Record<string, { sourceHash: string }>;
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));

test("approved-fish.json = 원본 둘에서 다시 계산한 목록(스타일 승인 ∧ 원본 지문 일치)", () => {
  const styles = json("src/lib/aqua3d/style-approvals.json") as { revision: string; forms: Forms };
  const profiles = json("src/lib/aqua3d/profiles.json") as Forms;
  const baked = json("src/lib/aqua3d/approved-fish.json") as { revision: string; forms: string[] };
  assert.equal(baked.revision, styles.revision);
  assert.equal(baked.revision, MODEL_REVISION, "승인 기준(revision)이 바뀌면 목록을 다시 굽는다");
  assert.deepEqual(baked.forms, approvedForms(styles, profiles), "node scripts/aqua-approved.mjs 를 다시 돌린다");
  assert.ok(baked.forms.length > 100, "목록이 비었다");
  // 옛 판정식(지문을 직접 비교)과 같은 답
  for (const key of new Set([...Object.keys(styles.forms), ...Object.keys(profiles), "unknown", "toString", "constructor"])) {
    const old = styles.revision === MODEL_REVISION && Object.hasOwn(styles.forms, key) && Object.hasOwn(profiles, key)
      && styles.forms[key].sourceHash === profiles[key].sourceHash;
    assert.equal(isFishModelApproved(key), old, key);
  }
});

test("화면 쪽 판정은 원본 JSON 을 싣지 않는다 — profiles.json 은 3D 장면 조각(reference-model)만", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const q = strip(readFileSync("src/lib/aqua3d/quality.ts", "utf8"));
  assert.doesNotMatch(q, /profiles\.json|style-approvals\.json/);
  const a3d = strip(readFileSync("src/components/Aquarium3D.tsx", "utf8"));
  assert.doesNotMatch(a3d, /^import (?!type )[^;]*from "@\/lib\/aqua3d\/(scene|reference-model)"/m, "3D 장면은 열 때 import() 로 받는다");
});
