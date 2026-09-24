// 전 영역 UI 개편 lock. [2026-09-24 — 사용자: "UI 가 더 좋은 형태로 … 모든 영역에서", "UI 에셋을 직접 제작해서"]
//
// 잠그는 것: 탭 머리글이 한 틀인가 · 직접 찍은 도트가 제 자리에 있는가(이모지로 돌아가지 않는가) ·
// 페이지 바탕이 이음새 없는 한 톤인가 · 설정 탭이 한 줄에 다 들어가는가 · 히어로에 미리보기가 깔리는가.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMBLEM_ICONS, STATUS_ICONS, TODO_ICON_KEYS, todoIcon } from "./pixelui.ts";
import { HERO_PREVIEW } from "./heroPreview.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("새 도트 — 엠블럼 4 · 상태 6 이 전부 24×24 이고 쓰는 색이 팔레트에 있다", () => {
  const all = { ...EMBLEM_ICONS, ...STATUS_ICONS };
  assert.deepEqual(Object.keys(EMBLEM_ICONS).sort(), ["game", "plan", "records", "together"]);
  for (const [k, sp] of Object.entries(all)) {
    assert.equal(sp.w, 24, `${k} 폭`);
    assert.equal(sp.rows.length, 24, `${k} 높이`);
    for (const row of sp.rows) {
      assert.equal(row.length, 24, `${k} 의 줄 길이가 24 가 아니다`);
      for (const ch of row) if (ch !== ".") assert.ok(sp.pal[ch], `${k}: 팔레트에 없는 글자 '${ch}'`);
    }
    // 빈 그림 금지 — 잉크가 칸의 1/4 이상
    const ink = sp.rows.join("").replace(/\./g, "").length;
    assert.ok(ink >= 144, `${k} 잉크 ${ink}칸 — 거의 비었다`);
  }
});

test("엠블럼은 서로 다른 그림이다 — 색만 바꾼 같은 실루엣이면 탭이 구분 안 된다", () => {
  const shape = (k: string) => EMBLEM_ICONS[k].rows.map((r) => r.replace(/[^.]/g, "#")).join("");
  const keys = Object.keys(EMBLEM_ICONS);
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = shape(keys[i]), b = shape(keys[j]);
      let diff = 0;
      for (let x = 0; x < a.length; x++) if (a[x] !== b[x]) diff++;
      assert.ok(diff >= 40, `${keys[i]} ↔ ${keys[j]} 실루엣 차이 ${diff}칸`);
    }
});

test("'지금 할 일' — 엔진이 내는 모든 키에 도트가 있다(빠지면 칩이 이모지로 돌아간다)", () => {
  const island = read("lib/island.ts");
  const body = island.slice(island.indexOf("export function islandTodos"), island.indexOf("// ── 진행 요약"));
  const keys = [...body.matchAll(/push\("([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 14, `할 일 키를 ${keys.length}개밖에 못 찾았다`);
  const arcade = read("components/GameArcade.tsx");
  const hub = [...arcade.matchAll(/todos\.push\(\{ key: "([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(hub.length >= 6, "게임 허브 할 일 키를 못 찾았다");
  for (const k of new Set([...keys, ...hub])) {
    assert.ok(TODO_ICON_KEYS.includes(k) && todoIcon(k), `'${k}' 할 일에 그림이 없다`);
  }
});

test("칩이 이모지를 직접 찍지 않는다 — 섬 · 게임 허브 둘 다 TodoIcon", () => {
  const island = code("components/IslandGame.tsx");
  assert.match(island, /<TodoIcon k=\{t\.key\} fallback=\{t\.emoji\} \/>/);
  assert.ok(!/<span aria-hidden>\{t\.emoji\}<\/span>/.test(island), "섬 할 일 칩이 이모지를 그대로 찍는다");
  const arcade = code("components/GameArcade.tsx");
  assert.match(arcade, /<TodoIcon k=\{t\.key\} \/>/);
  assert.ok(!/[🍖😢🤒✨💤🌾]/u.test(arcade), "게임 허브에 이모지 할 일이 남았다");
  // 사냥 카드 — 이모지(슬라임 = 🟢) 대신 몬스터 도트
  assert.ok(!/mon \? mon\.emoji/.test(arcade), "사냥 카드가 몬스터 이모지를 찍는다");
  assert.match(arcade, /<MonsterFace k=\{mon\.key\} \/>/);
});

test("탭 머리글 — 기록·계획·함께·게임이 한 틀(TabHeader)이고 엠블럼이 제각각이다", () => {
  const page = code("app/page.tsx");
  const arcade = code("components/GameArcade.tsx");
  const emblems = [...`${page}\n${arcade}`.matchAll(/<TabHeader emblem="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(emblems.sort(), ["game", "plan", "records", "together"]);
  // 하위 화면에 sr-only h1 이 있는 탭(기록·계획)은 제목을 p 로 — h1 이 두 개가 되면 안 된다
  for (const e of ["records", "plan"]) assert.match(page, new RegExp(`<TabHeader emblem="${e}"[^>]*titleAs="p"`), `${e} 머리글이 h1 을 하나 더 만든다`);
  assert.ok(!/game-hub-header/.test(arcade), "게임 허브가 옛 카드 머리를 쓴다");
  // 엠블럼은 24칸을 정확히 2배로
  assert.match(read("components/TabHeader.tsx"), /<EmblemIcon k=\{emblem\} size=\{48\} \/>/);
});

test("페이지 바탕 — 이음새(하드 스톱 밴드) 없이 한 톤 + 도트 격자", () => {
  const css = read("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const def = css.slice(css.indexOf("--page-bg:"), css.indexOf(";", css.indexOf("--page-bg:")));
  assert.ok(!/42%|74%/.test(def), "뷰포트 42%·74% 에서 끊기던 밴드가 돌아왔다");
  assert.ok(!/var\(--bg-2\)|var\(--bg-3\)/.test(def), "한 톤이 아니다");
  assert.match(def, /var\(--page-dot\) 2px/, "도트 격자가 없다");
  // 게임 허브도 같은 바탕 — 자기 그라데이션을 다시 깔면 탭을 옮길 때 다른 앱처럼 보인다
  const hub = css.slice(css.indexOf(".game-hub {"), css.indexOf("}", css.indexOf(".game-hub {")));
  assert.ok(!/background/.test(hub), "게임 허브가 자기 바탕을 깐다");
});

test("설정 — 다섯 칸이 한 줄에 전부 보인다(가로 스크롤로 '도움말'이 잘리지 않게)", () => {
  const page = code("app/page.tsx");
  assert.match(page, /className="grid grid-cols-5 gap-1\.5" role="tablist" aria-label="설정 영역"/);
  const bar = page.slice(page.indexOf('aria-label="설정 영역"') - 200, page.indexOf('aria-label="설정 영역"'));
  assert.ok(!/overflow-x-auto/.test(bar), "설정 탭이 다시 가로 스크롤이 됐다");
});

test("홈 히어로 — 원화가 오기 전 같은 그림의 도트 미리보기가 깔린다", () => {
  for (const k of ["spring", "summer", "autumn", "winter"] as const) {
    assert.match(HERO_PREVIEW[k], /^data:image\/webp;base64,/, `${k} 미리보기`);
    assert.ok(HERO_PREVIEW[k].length < 2000, `${k} 미리보기가 ${HERO_PREVIEW[k].length}자 — 번들이 무거워진다`);
  }
  const world = code("components/HomeWorld.tsx");
  const pre = world.indexOf("HERO_PREVIEW[season]");
  const img = world.indexOf("src={asset(SEASON_WORLD[season])}");
  assert.ok(pre > 0 && img > pre, "미리보기는 원화 **아래**(먼저) 깔려야 원화가 오면 덮는다");
  assert.match(world.slice(pre, pre + 300), /imageRendering: "pixelated"/, "미리보기가 뭉개져 보인다(pixelated 아님)");
});

test("섬 펫 무대 그림 — 2.6MB PNG 대신 WebP", () => {
  const island = code("components/IslandGame.tsx");
  assert.match(island, /\/island\/village-autumn-v1\.webp/);
  assert.ok(!/village-autumn-v1\.png/.test(island));
});
