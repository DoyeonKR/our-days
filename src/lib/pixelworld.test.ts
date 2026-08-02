// 홈 월드 소품 픽셀 아트 lock. [2026-08-03]
// 사용자: "모든 톤앤매너 도트 픽셀로 — 메인 화면도 그렇고 섬도 그렇고".
// 홈 화면 소품(우편함·이정표·나룻배·벤치·둥지·폴라로이드·러브레터)이 픽셀 전환의 첫 조각.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSprite } from "./pixel.ts";
import { ALL_WORLD_SPRITES, worldSprite } from "./pixelworld.ts";

const KINDS = ["mailbox", "signpost", "rowboat", "benchbook", "nestegg", "photocard", "loveletter"];

test("모든 월드 소품 스프라이트가 포맷 정합", () => {
  const errs: string[] = [];
  for (const [k, s] of Object.entries(ALL_WORLD_SPRITES)) errs.push(...validateSprite(s, k));
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("소품 7종이 전부 고유 실루엣(폴백/복붙 금지)", () => {
  const shapes = new Set(KINDS.map((k) => worldSprite(k).rows.join("")));
  assert.equal(shapes.size, KINDS.length, `7종 중 실루엣은 ${shapes.size}종뿐`);
});

test("32×32 + 바닥 정렬 — 씬에서 떠 보이지 않게", () => {
  for (const k of KINDS) {
    const s = worldSprite(k);
    assert.equal(s.w, 32, `${k}: 폭 32`);
    assert.equal(s.h, 32, `${k}: 높이 32`);
    assert.ok(/[^.]/.test(s.rows[s.rows.length - 1]), `${k}: 마지막 행이 비어 바닥이 뜬다`);
  }
});

test("소품 렌더는 WorldProp 단일 진입점만 쓴다(art/world 직접 호출 금지)", () => {
  // 홈 화면 여러 곳에 흩어진 소품 중 한 곳만 빠뜨리면 픽셀/일러스트가 같은 화면에 섞인다.
  const ALLOW = new Set(["WorldProp.tsx", "world.tsx"]);
  const NAMES = ["<Mailbox", "<Signpost", "<RowBoat", "<BenchBook", "<NestEgg", "<PhotoCard", "<LoveLetter"];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".tsx") || ALLOW.has(name)) continue;
      const src = readFileSync(p, "utf8");
      for (const n of NAMES) if (src.includes(n)) offenders.push(`${name}: ${n}`);
    }
  };
  walk(join(import.meta.dirname, "..", "components"));
  walk(join(import.meta.dirname, "..", "app"));
  assert.deepEqual(offenders, [], `SVG 소품 직접 렌더:\n${offenders.join("\n")}`);
});
