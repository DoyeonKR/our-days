// 대표사진 lock. [사용자 2026-09-08 "배경 메인 사진이 너무 안 보인다" → 2026-11-05 실계정 리뷰]
//
// 사진은 보여야 하지만 화면 전체에 고정하면 제목마다 바탕색 띠가 필요하고, 띠가 없는 글자는 얼굴 위에 놓인다.
// 지금은 페이지 맨 위에만 깔리고 아래로 사라진다. 그 위 머리글은 흐린 색 없이 --ink 만 쓴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appCss } from "./cssfiles.ts";

const here = import.meta.dirname;
const css = appCss();
const page = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
const head = readFileSync(join(here, "..", "components", "WorldSectionHead.tsx"), "utf8");
const tabHeader = readFileSync(join(here, "..", "components", "TabHeader.tsx"), "utf8");
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("페이지 바탕 정의는 --page-bg 한 곳이고 body 가 쓴다", () => {
  assert.match(bare, /--page-bg:\s*radial-gradient\(/);
  assert.match(bare, /background:\s*var\(--page-bg\)/);
});

test("사진은 맨 위에만 — 고정 전체 배경으로 돌아가지 않는다", () => {
  const m = page.match(/cover-wash pointer-events-none absolute inset-x-0 top-0 -z-10 bg-cover bg-center opacity-\[([\d.]+)\]/);
  assert.ok(m, "대표사진 레이어가 맨 위 absolute 가 아니다");
  assert.ok(Number(m![1]) >= 0.3, "요청은 '더 보이게' 였다");
  assert.ok(!/fixed inset-0 -z-10 bg-cover/.test(page), "사진이 화면 전체 고정으로 돌아왔다");
  assert.match(bare, /\.cover-wash \{[^}]*mask-image: linear-gradient/, "아래로 사라지지 않는다");
});

test("머리글에 바탕색 띠가 없고, 사진 위 글씨는 어떤 사진에서도 읽힌다", () => {
  assert.doesNotMatch(tabHeader, /page-bed/);
  assert.doesNotMatch(head, /page-bed/);
  assert.doesNotMatch(bare, /\.page-bed/);
  const op = Number(page.match(/bg-center opacity-\[([\d.]+)\]/)![1]);
  const mix = (photo: number, base: number[]) => base.map((b) => photo * op + b * (1 - op));
  // 라이트: 진한 글씨 + 가장 어두운 사진, 다크: 밝은 글씨 + 가장 밝은 사진 — 최악의 짝
  assert.ok(ratio([28, 26, 32], mix(0, [246, 244, 241])) >= 4.5, "라이트 최악 대비");
  assert.ok(ratio([244, 244, 246], mix(255, [16, 16, 21])) >= 4.5, "다크 최악 대비");
  assert.match(bare, /\.tab-header-v2 \.eyebrow \{[^}]*color: var\(--ink\)/);
  assert.match(bare, /\.tab-header-v2 \.tab-header-sub \{[^}]*color: var\(--ink\)/);
  const uses = page.match(/<TabHeader /g) ?? [];
  assert.equal(uses.length, 2, "기록·계획은 공용 머리글, 일기는 일기장 자체 머리글을 쓴다");
});

test("실계정 리뷰 잠금 — 섬 머리글 한 줄 · 영어 머리말 없음 · 머리글 불투명 · 일정이 기본", () => {
  const island = readFileSync(join(here, "..", "components", "IslandGame.tsx"), "utf8");
  const pet = readFileSync(join(here, "..", "components", "island", "PetPanels.tsx"), "utf8");
  assert.doesNotMatch(island + pet, />(OUR ISLAND|GARDEN|WORKSHOP|DECORATE|CARE DECK|HERO SKILLS|EVOLUTION|NEXT QUEST)</);
  assert.doesNotMatch(island, /aspect-ratio: 39 \/ 34.*island-village/);
  assert.match(bare, /\.island-village-art \{ aspect-ratio: 39 \/ 22; \}/, "첫 돌봄 카드가 첫 화면에 들어와야 한다");
  assert.doesNotMatch(island, /var\(--vv-bottom, 0px\) \+ 92px/, "미니 펫이 카드 한가운데로 돌아왔다");
  assert.match(bare, /\.aqua-head \{ background: #06263d; \}/, "게임 머리글 뒤로 글자가 비친다");
  assert.match(bare, /\.merge-head \{ background: var\(--bg-1\); \}/, "게임 머리글 뒤로 글자가 비친다");
  const open = page.slice(page.indexOf("function openAddEvent("), page.indexOf("function openAddEvent(") + 300);
  assert.match(open, /category \?\? "plan"/, "일정 탭의 추가가 기념일로 열린다");
  const deco = readFileSync(join(here, "..", "components", "DecoBook.tsx"), "utf8");
  assert.doesNotMatch(deco, /WEDNESDAY/);
});
