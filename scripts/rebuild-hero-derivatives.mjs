import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
const records = JSON.parse(await readFile("design/hero-v3-sources.json", "utf8"));
// In-progress records survive an interrupted generation session; the committed manifest is complete at release.
try {
  for (const name of await readdir(".qa/hero-art/sources")) {
    if (name.endsWith(".json")) records.push(JSON.parse(await readFile(`.qa/hero-art/sources/${name}`, "utf8")));
  }
} catch { /* released checkout: no local work-in-progress records */ }
const unique = [...new Map(records.map((r) => [r.key, r])).values()];
for (const { key, source } of unique) {
  const original = isAbsolute(source) ? source : join(process.env.CODEX_HOME || join(homedir(), ".codex"), source);
  const run = spawnSync(process.execPath, ["scripts/prepare-hero-asset.mjs", original, key], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`${key}: ${run.stderr}`);
  console.log(run.stdout.trim());
}
console.log(`Rebuilt ${unique.length} originals and thumbnails.`);
