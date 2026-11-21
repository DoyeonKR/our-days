// 수조 전체 보기(기본) · 목록에서 고르면 수조로 올리기(아이폰) — 2026-11-21
// [사용자: "수조 전체뷰를 만들어줘 전체적으로 넓게 볼 수 있는 뷰 그게 메인이어야해" · "아이폰에서 하단에 물고기 목록을 선택하면 … 올라가져야 하는데 그렇지 못해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("전체 보기가 기본 — 가로를 다 담고, 가로로 긴 수조는 내려다보고, 수조 칸 높이를 모양에 맞춘다", () => {
  const scene = read("src/lib/aqua3d/scene.ts"), ui = read("src/components/Aquarium3D.tsx");
  assert.match(scene, /const over=state\.overview!==false;/, "값이 없으면 전체 보기");
  assert.match(scene, /fitW=over\?\(5\*wide\*1\.04\)\/\(half\*camera\.aspect\)\+3\*deep/, "가로(5·wide)를 다 담는다");
  assert.match(scene, /const far=Math\.max\(110,camD\+6\*deep\+40\)/, "멀리 물러나도 뒷벽을 그린다");
  assert.match(scene, /overK\*overEl\*\(1-focusK\)\*\(1-beachK\)\*\(1-mealK\)/, "물고기를 고르면 · 사냥 장면이면 내려다보기를 거둔다");
  assert.match(scene, /events\.shape\?\.\(r\)/);
  assert.match(ui, /overview: !close/);
  assert.match(ui, /const \[close, setClose\] = useState\(false\);/, "가까이 보기는 메뉴에서 고를 때만");
  assert.match(ui, /const \[outside, setOutside\] = useState\(true\);/, "터널 · 돔 단계도 밖에서 전체를 먼저");
  assert.match(ui, /label: close \? "수조 전체 보기" : "가까이 보기"/);
  assert.match(ui, /Math\.min\(2\.4, Math\.max\(0\.8, shape\)\)/, "수조 칸은 4:5 보다 길어지지 않고 2.4 까지 납작하게");
});

test("목록에서 고르면 수조로 — 고정 창 안을 직접 스크롤(부드러운 스크롤 · scrollIntoView 는 아이폰에서 안 움직였다)", () => {
  const rv = read("src/lib/revealtop.ts"), g = read("src/components/AquariumGame.tsx");
  assert.match(rv, /box\.scrollTop = Math\.max\(0, top\);/);
  assert.match(rv, /querySelectorAll\("\.game-head"\)/, "붙박이 머리글 아래로");
  assert.match(rv, /window\.setTimeout\(once, 100\)/, "프레임이 멈춘 탭에서도");
  assert.match(g, /if \(on\) revealTop\(stageRef\.current\);/);
  assert.doesNotMatch(g, /stageRef\.current\?\.scrollIntoView/);
});
