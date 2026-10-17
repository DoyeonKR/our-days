// 열 계보 30폼을 한 장에 — 10행(계보) × 3열(단계). 통일감 · 구조 변화 · 색 겹침을 한눈에.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { grid, palette, toSprite } from "./lib.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const order = ["ember", "volt", "burr", "puff", "leaf", "beetle", "conch", "snow", "bat", "ghost"];
const items = [];
for (const k of order) {
  const j = JSON.parse(readFileSync(join(here, "out", `${k}.json`), "utf8"));
  j.stages.forEach((rows, i) => items.push(toSprite(rows, palette(j.pals[i]), j.fur, j.pad)));
}
const cols = Number(process.argv[2] ?? 6);
const scale = Number(process.argv[3] ?? 4);
console.log(JSON.stringify(grid(items, cols, join(here, "out", "all.png"), { scale })));
