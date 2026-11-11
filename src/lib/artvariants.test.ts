// 작은 그림 사본 · 홈 히어로 미리 받기 lock. [2026-11-11 첫 화면 다이어트]
// 사본은 scripts/art-variants.mjs 가 굽는다 — 원화를 더하거나 바꾸면 다시 돌린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { seasonOf } from "./kst.ts";
import { HOME_WORLD_SIZES, SEASONS, SEASON_WORLD, heroPreloadScript, homeWorldSrcSet, seasonWorld800 } from "./homeworldart.ts";
import { ISLAND_CARD_ART, fishingCardArt, tankCardArt } from "./cardart.ts";

const root = join(import.meta.dirname, "..", "..");
const pub = (p: string) => join(root, "public", p);
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

test("홈 히어로 — 계절마다 800w 사본이 있고 원화와 같은 비율이다", async () => {
  for (const s of SEASONS) {
    const big = await sharp(pub(SEASON_WORLD[s])).metadata();
    const small = await sharp(pub(seasonWorld800(s))).metadata();
    assert.equal(small.width, 800, s);
    assert.equal(big.width, 1200, `${s} — srcset 이 1200w 라고 적혀 있다`);
    assert.ok(Math.abs(small.height! / small.width! - big.height! / big.width!) < 0.01, s);
  }
});

test("홈 히어로 — <img> 와 preload 가 같은 주소 · srcset · sizes 를 쓴다(다르면 두 번 받는다)", () => {
  const world = code("src/components/HomeWorld.tsx");
  // srcSet · sizes 가 src 보다 먼저(사파리는 src 가 들어오는 순간 받는다 — next/image 도 src 를 맨 끝에 둔다)
  assert.match(world, /srcSet=\{homeWorldSrcSet\(season, BASE\)\}\s+sizes=\{HOME_WORLD_SIZES\}\s+src=\{asset\(SEASON_WORLD\[season\]\)\}/);
  assert.match(code("src/app/layout.tsx"), /heroPreloadScript\(BASE, !!supabaseOrigin\)/);
});

/** 인라인 스크립트를 가짜 브라우저에서 돌려 붙인 link 를 돌려준다 */
function runPreload(o: { base: string; path: string; search?: string; keys: string[]; now: number; needSession: boolean }) {
  const links: Record<string, string>[] = [];
  const fakeDoc = {
    createElement: () => {
      const el: Record<string, string> & { setAttribute?: (k: string, v: string) => void } = {};
      el.setAttribute = (k: string, v: string) => { el[k] = v; };
      return el;
    },
    head: { appendChild: (el: Record<string, string>) => links.push(el) },
  };
  const fakeStorage = { length: o.keys.length, key: (i: number) => o.keys[i] ?? null };
  const RealDate = Date;
  class FakeDate extends RealDate { static now() { return o.now; } }
  new Function("location", "localStorage", "document", "Date", heroPreloadScript(o.base, o.needSession))(
    { pathname: o.path, search: o.search ?? "" }, fakeStorage, fakeDoc, FakeDate,
  );
  return links;
}

test("미리 받기 — 홈 주소 · 로그인 기록이 있을 때만, 이 달(KST) 계절 그림을 같은 srcset 으로", () => {
  const base = "/our-days";
  const session = ["ourdays:theme", "sb-abcdefg-auth-token"];
  // 계절 경계(KST) — 2026-02-28 15:00Z = 3월 1일 0시 KST 는 봄
  for (const iso of ["2026-01-15T03:00:00Z", "2026-02-28T14:59:00Z", "2026-02-28T15:00:00Z", "2026-06-01T00:00:00Z", "2026-08-31T15:30:00Z", "2026-11-30T15:00:00Z"]) {
    const now = Date.parse(iso);
    const [l] = runPreload({ base, path: "/our-days/", keys: session, now, needSession: true });
    const s = seasonOf(now);
    assert.ok(l, iso);
    assert.equal(l.rel, "preload");
    assert.equal(l.as, "image");
    assert.equal(l.href, `${base}${SEASON_WORLD[s]}`, iso);
    assert.equal(l.imagesrcset, homeWorldSrcSet(s, base), iso);
    assert.equal(l.imagesizes, HOME_WORLD_SIZES);
  }
  const now = Date.parse("2026-11-11T00:00:00Z");
  assert.equal(runPreload({ base, path: "/our-days/", keys: ["ourdays:theme"], now, needSession: true }).length, 0, "로그인 기록이 없으면(로그인 화면) 받지 않는다");
  assert.equal(runPreload({ base, path: "/our-days/privacy/", keys: session, now, needSession: true }).length, 0, "다른 페이지에선 받지 않는다");
  assert.equal(runPreload({ base, path: "/our-days/", search: "?go=fishing", keys: session, now, needSession: true }).length, 0, "링크로 다른 화면에 들어올 땐 받지 않는다");
  assert.equal(runPreload({ base: "", path: "/", keys: [], now, needSession: false }).length, 1, "서버 없는 로컬 빌드는 로그인 없이 홈이다");
});

test("게임 탭 카드 — 원화마다 작은 사본이 있고 카드는 사본을 쓴다", async () => {
  const spots = readdirSync(pub("fishing")).filter((f) => /^spot_.+\.webp$/.test(f)).map((f) => f.replace(/\.webp$/, ""));
  const tanks = readdirSync(pub("aqua/tank")).filter((f) => /^tank_\d+\.webp$/.test(f)).map((f) => f.replace(/\.webp$/, ""));
  assert.ok(spots.length >= 15 && tanks.length >= 9);
  for (const [p, w] of [...spots.map((k) => [fishingCardArt(k), 720] as const), ...tanks.map((k) => [tankCardArt(k), 480] as const), [ISLAND_CARD_ART, 720] as const]) {
    assert.ok(existsSync(pub(p.slice(1))), `${p} 가 없다 — node scripts/art-variants.mjs`);
    assert.equal((await sharp(pub(p.slice(1))).metadata()).width, w, p);
  }
  const hub = code("src/components/GameArcade.tsx");
  assert.match(hub, /<GameBg src=\{FISHING_IMAGE_KEYS\.has\(spotKey\) \? fishingCardArt\(spotKey\) : null\} \/>/);
  assert.match(hub, /<GameBg src=\{TANK_IMAGE_KEYS\.has\(tankKey\) \? tankCardArt\(tankKey\) : null\} \/>/);
  assert.match(hub, /<GameBg src=\{ISLAND_CARD_ART\} \/>/);
  assert.doesNotMatch(hub, /<GameBg src=\{?["`]\/(fishing|aqua|island)\//, "카드에 원화를 깔았다");
});
