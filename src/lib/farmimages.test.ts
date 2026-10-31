// 섬 작물 · 음식 그림 lock — 목록에 적힌 key 는 파일(원본 · 사본)이 실제로 있고, 섬 표에 있는 key 다.
// [사용자 2026-10-31 "농작물 이미지 … 다 올라가면 상점과 실제 농작물과 음식에 다 반영해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CROP_IMAGE_KEYS, FOOD_IMAGE_KEYS } from "./farmimages.ts";
import { CROPS, GOODS, PRODUCTS } from "./island.ts";

const root = process.cwd();

test("목록의 그림 파일이 원본 · 화면용 사본 둘 다 있다", () => {
  for (const [dir, keys] of [["crop", CROP_IMAGE_KEYS], ["food", FOOD_IMAGE_KEYS]] as const) {
    for (const k of keys) {
      assert.ok(existsSync(join(root, "public/farm", dir, `${k}.webp`)), `${dir}/${k}.webp`);
      assert.ok(existsSync(join(root, "public/farm", dir, "sm", `${k}.webp`)), `${dir}/sm/${k}.webp`);
    }
  }
});

test("목록의 key 는 섬 표에 있는 작물 · 음식이다", () => {
  const crops = new Set(CROPS.map((c) => c.key));
  const foods = new Set([...PRODUCTS, ...GOODS].map((p) => p.key));
  for (const k of CROP_IMAGE_KEYS) assert.ok(crops.has(k as never), k);
  for (const k of FOOD_IMAGE_KEYS) assert.ok(foods.has(k as never), k);
});

test("작물 · 음식 아이콘은 그림 파일이 있으면 설정과 상관없이 그림을 쓴다(단일 진입점 CropIcon)", () => {
  const src = readFileSync(join(root, "src/components/island/CropIcon.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /stage >= 2 && CROP_IMAGE_KEYS\.has\(cropKey\)/);
  assert.match(src, /FOOD_IMAGE_KEYS\.has\(productKey\)/);
});
