// 사용법: node art/run.mjs <계보> [scale]  → out/<계보>.png (밝은·어두운 바탕 두 줄) + out/<계보>.json(행)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { palette, sheet, toSprite } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const key = process.argv[2];
const scale = Number(process.argv[3] ?? 6);
const L = (await import(`./lineages/${key}.mjs`)).default;

const stages = [];
const notes = [];
for (const fn of L.stages) {
  const cv = fn();
  cv.outline();
  const shift = 43 - cv.floor();
  if (shift !== 0) { cv.shiftY(shift); notes.push(`${key} 단계${stages.length + 2}: 바닥에 맞추려 ${shift > 0 ? "아래로" : "위로"} ${Math.abs(shift)}행 이동`); }
  const rows = cv.rows();
  if (!/[^.]/.test(rows[43])) throw new Error(`${key}: 43행이 비었다 — 다리와 안 이어진다`);
  stages.push(rows);
}
const pals = stages.map((_, i) => palette(L.pals ? L.pals[i] : L.pal));
const sprites = stages.map((rows, i) => toSprite(rows, pals[i], L.fur, L.pad));
const dims = sheet(sprites, join(here, "out", `${key}.png`), { scale });
writeFileSync(join(here, "out", `${key}.json`), JSON.stringify({ key, fur: L.fur, pad: L.pad, pals: L.pals ?? stages.map(() => L.pal), stages }, null, 1));
console.log(`${key}: ${dims.w}x${dims.h}`);
for (const n of notes) console.log("  " + n);
// 얼굴 크롭 창(행 0~29)에 눈이 들어오는지 — 눈 윗선(o)이 크롭 안, 눈 아랫선도 29 이하여야 한다
stages.forEach((rows, i) => { const eyeRows = rows.map((r, y) => (r.includes("L") || /e/.test(r) ? y : -1)).filter((y) => y >= 0); console.log(`  단계${i + 2}: 위 ${rows.findIndex((r) => /[^.]/.test(r))}행 · 눈 ${Math.min(...eyeRows)}~${Math.max(...eyeRows)}행`); });
