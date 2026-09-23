// 펫 탭 개편 lock — 배치 순서 · 케어 데크 · 도트 아이콘. [2026-09-24]
// [사용자: "펫 탭도 리뷰하고 완전 UI/UX 개편 … 케어 데크도 … UI 는 너가 직접 그려서 만들도록해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GEARS, HERO_SKILLS, type CareKey } from "./island.ts";
import { ACTION_ICONS, GEAR_ICONS, STAT_ICONS } from "./pixelui.ts";

const root = join(import.meta.dirname, "..");
const strip = (p: string) =>
  readFileSync(join(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
const game = strip("components/IslandGame.tsx");
const panels = strip("components/island/PetPanels.tsx");
const css = readFileSync(join(root, "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// ── 1. 배치 ───────────────────────────────────────────────────────

test("★ 무대 → 스탯 판 → 칸 선택 → 케어 데크 순서다(DOM = 화면) — 케어 데크가 두 화면 아래로 밀리지 않게", () => {
  const view = game.slice(game.indexOf('tab === "pet"'), game.indexOf('tab === "farm"'));
  const at = (s: string) => view.indexOf(s);
  assert.ok(at("ref={stageRef}") > 0 && at("<StatHud") > at("ref={stageRef}"), "스탯 판이 무대 바로 밑이 아니다");
  assert.ok(at('aria-label="펫 메뉴"') > at("<StatHud"), "칸 선택이 스탯 판 위에 있다");
  assert.ok(at("<CareDeck") > at('aria-label="펫 메뉴"'), "케어 데크가 칸 선택보다 위에 있다");
  // 예전 order 규칙(카드 1 · 목표 2 · 나머지 3) — 되살아나면 DOM 과 화면 순서가 다시 갈린다
  assert.doesNotMatch(css, /\.island-pet-view > [^{]*\{\s*order:/, "펫 화면에 flex order 가 되살아났다");
  assert.doesNotMatch(css, /section\.island-panel button:nth-child/, "케어 버튼 색을 nth-child 로 다시 준다(순서가 바뀌면 색이 엉뚱한 카드로 간다)");
});

test("세 칸(돌봄·장비·성장) — 무대와 스탯 판은 어느 칸에서든 보인다", () => {
  for (const k of ['"care"', '"gear"', '"growth"']) assert.ok(game.includes(`petView === ${k}`), `${k} 칸이 없다`);
  const stage = game.indexOf("ref={stageRef}");
  const firstView = game.indexOf("petView === \"care\" &&");
  assert.ok(stage < firstView, "무대가 칸 안으로 들어갔다 — 칸을 바꾸면 펫이 사라진다");
});

test("떠다니는 미니 펫은 돌봄 칸에서만 — 장비·성장 칸에선 오른쪽 버튼을 가렸다", () => {
  assert.match(game, /!stageVis && petView === "care" &&/);
});

// ── 2. 케어 데크 ──────────────────────────────────────────────────

test("★ 케어 데크는 엔진의 판정을 읽는다 — 켜진 채 무반응인 버튼 금지", () => {
  assert.match(panels, /careStatus\(s, c\.k, now\)/, "돌봄 카드가 careStatus 를 안 본다");
  assert.match(panels, /heroSkillStatus\(s, d\.key, now\)/, "기술 카드가 heroSkillStatus 를 안 본다");
  assert.match(panels, /disabled=\{busy \|\| !st\.ok\}/, "돌봄 카드가 판정과 따로 켜진다");
  // 잠긴 기술은 막지 않고 그 슬롯의 장비 칸으로 보낸다 — '어떻게 여는지'가 버튼이다
  assert.match(panels, /locked \? onLocked\(d\.slot\)/);
});

test("스탯을 누르면 그 스탯을 올리는 돌봄으로 — 스탯과 행동을 잇는다", () => {
  assert.match(game, /onPick=\{\(k\) => \{\s*setPetView\("care"\);\s*setCareFocus/);
  assert.match(panels, /querySelector\(`\[data-care="\$\{focus\.k\}"\]`\)/, "누른 스탯의 카드로 안 간다");
});

test("기술 결과는 토스트로 — 섬 화면엔 로그가 안 보여서 채집한 작물이 어디에도 안 나왔다", () => {
  assert.match(game, /runHeroSkill\(st, k, nowMs\)/);
  assert.match(game, /fireSkillToast\(k, line, nowMs\)/);
  // 펫 이모지(로그의 첫 토큰)를 떼는 정규식 — 셸 이스케이프에 역슬래시가 먹혀 /^S+s/ 가 된 적이 있다
  assert.ok(game.includes("line.replace(/^\\S+\\s/, \"\")"), "토스트가 펫 이모지를 떼지 않는다(또는 정규식이 깨졌다)");
});

// ── 3. 직접 그린 도트 ─────────────────────────────────────────────

test("★ 돌봄 6 · 기술 3 · 장비 15 · 스탯 5 전부 도트가 있다 — 표에 추가하면 그림도 추가", () => {
  const care: CareKey[] = ["feed", "play", "clean", "hug", "rest", "medicine"];
  for (const k of care) assert.ok(ACTION_ICONS[k], `돌봄 '${k}' 아이콘이 없다`);
  for (const d of HERO_SKILLS) assert.ok(ACTION_ICONS[d.key], `기술 '${d.name}' 아이콘이 없다`);
  for (const g of GEARS) assert.ok(GEAR_ICONS[g.key], `장비 '${g.name}' 아이콘이 없다`);
  for (const k of ["hunger", "happy", "energy", "clean", "health"]) assert.ok(STAT_ICONS[k], `스탯 '${k}' 아이콘이 없다`);
});

test("도트 규격 — 24×24 / 12×12, 팔레트에 없는 글자 금지, 비어 있지 않다", () => {
  const check = (name: string, sp: { w: number; h: number; rows: string[]; pal: Record<string, string> }, n: number) => {
    assert.equal(sp.w, n, `${name} 폭`);
    assert.equal(sp.h, n, `${name} 높이`);
    for (const r of sp.rows) assert.equal(r.length, n, `${name} 행 길이`);
    const bad = [...new Set(sp.rows.join("").split("").filter((ch) => ch !== "." && !(ch in sp.pal)))];
    assert.deepEqual(bad, [], `${name} 에 팔레트 밖 글자 ${bad.join("")}`);
    const ink = sp.rows.join("").split("").filter((ch) => ch !== ".").length;
    assert.ok(ink > n * n * 0.15, `${name} 이 너무 비었다(${ink})`);
  };
  for (const [k, sp] of Object.entries(ACTION_ICONS)) check(k, sp, 24);
  for (const [k, sp] of Object.entries(GEAR_ICONS)) check(k, sp, 24);
  for (const [k, sp] of Object.entries(STAT_ICONS)) check(k, sp, 12);
});

test("★ 장비 아이콘끼리 실루엣이 다르다 — 같은 모양 리컬러로 때우지 않았다", () => {
  const mask = (rows: string[]) => rows.map((r) => r.replace(/[^.]/g, "#")).join("");
  const keys = Object.keys(GEAR_ICONS);
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = mask(GEAR_ICONS[keys[i]].rows), b = mask(GEAR_ICONS[keys[j]].rows);
      let diff = 0;
      for (let p = 0; p < a.length; p++) if (a[p] !== b[p]) diff++;
      assert.ok(diff >= 12, `${keys[i]} 와 ${keys[j]} 의 실루엣이 거의 같다(${diff}칸)`);
    }
});

test("펫 탭 UI 에 이모지 아이콘이 되돌아오지 않는다 — ⊠ 로 깨지던 장비 이모지", () => {
  // 예전 장비 칩은 g.emoji(🪵🪄🪶…)를 그대로 찍었고 픽셀 서체엔 그 글리프가 없었다
  assert.doesNotMatch(panels, /\{g\.emoji\}/, "장비 이모지를 다시 찍는다");
  assert.match(panels, /<GearIcon k=\{g\.key\}/);
  assert.match(panels, /<ActionIcon k=/);
  assert.match(panels, /<StatIcon k=\{st\.k\}/);
});
