// 우리 수조 그림을 앱에 넣는다 — 원본과 화면용 사본을 굽고 src/lib/aquaimages.ts 를 다시 쓴다.
//   node scripts/aqua-art-sync.mjs               public/aqua 에 이미 있는 파일만 다시 정리
//   node scripts/aqua-art-sync.mjs <그림 폴더> … 폴더(하위 폴더 포함)의 png · webp · jpg 를 파일 이름(key)으로 맞춰 가져온다
// 파일 이름 = design/AQUARIUM-ART.md 의 key(예: fry_guppy.png · cobra_guppy.webp · treasure.png · tank_1.png).
// 물고기 · 악세사리 → 512px 원본 + 192px 사본(투명 유지, 그림 둘레 빈칸을 잘라 가운데 맞춤) · 수조 배경 → 1024×1280.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const src = readFileSync(join(root, "src/lib/aquarium.ts"), "utf8");
const families = [...src.matchAll(/\{ key: "([a-z0-9_]+)", name: "[^"]+", price:/g)].map((m) => m[1]);
const species = [...src.matchAll(/\bs\("([a-z0-9_]+)", "/g)].map((m) => m[1]);
const decor = [...src.matchAll(/\bd\("([a-z0-9_]+)", "/g)].map((m) => m[1]);
const tanks = [...src.matchAll(/\{ name: "[^"]+", fish: \d+, decor: \d+, price: \d+ \}/g)].map((_, i) => `tank_${i + 1}`);
const fish = [...families.flatMap((f) => [`fry_${f}`, `juv_${f}`]), ...species];
if (families.length < 12 || species.length < 30 || decor.length < 30 || tanks.length < 6) throw new Error("표 읽기 실패");

const kinds = { fish: { keys: fish }, decor: { keys: decor }, tank: { keys: tanks } };
const dirOf = (kind) => join(root, "public/aqua", kind);
for (const kind of Object.keys(kinds)) mkdirSync(join(dirOf(kind), "sm"), { recursive: true });

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "sm" ? [] : walk(p);
    return /\.(png|webp|jpe?g)$/i.test(n) ? [p] : [];
  });
}
const kindOf = (key) => Object.keys(kinds).find((k) => kinds[k].keys.includes(key));

const skipped = [];
for (const from of process.argv.slice(2)) {
  for (const file of walk(from)) {
    const key = basename(file, extname(file)).toLowerCase();
    const kind = kindOf(key);
    if (!kind) { skipped.push(file); continue; }
    const pic = kind === "tank"
      ? sharp(file).resize(1024, 1280, { fit: "cover" }).webp({ quality: 86 })
      : sharp(file).ensureAlpha().trim({ threshold: 1 }).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 });
    writeFileSync(join(dirOf(kind), `${key}.webp`), await pic.toBuffer());
  }
}

const have = { fish: [], decor: [], tank: [] };
for (const kind of Object.keys(kinds)) {
  for (const n of readdirSync(dirOf(kind)).filter((x) => x.endsWith(".webp"))) {
    const key = n.slice(0, -5);
    if (!kinds[kind].keys.includes(key)) { skipped.push(join(dirOf(kind), n)); continue; }
    if (kind !== "tank") {
      await sharp(join(dirOf(kind), n)).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86 }).toFile(join(dirOf(kind), "sm", n));
    }
    have[kind].push(key);
  }
  have[kind].sort();
}

const file = join(root, "src/lib/aquaimages.ts");
const head = readFileSync(file, "utf8").split("export const FISH_IMAGE_KEYS")[0];
const list = (ks) => ks.map((k) => `  "${k}",\n`).join("");
const set = (name, ks) => `export const ${name}: ReadonlySet<string> = new Set<string>([\n${list(ks)}]);\n`;
writeFileSync(file, head + set("FISH_IMAGE_KEYS", have.fish) + set("DECOR_IMAGE_KEYS", have.decor) + set("TANK_IMAGE_KEYS", have.tank));

console.log(`물고기 ${have.fish.length}/${fish.length} · 악세사리 ${have.decor.length}/${decor.length} · 수조 ${have.tank.length}/${tanks.length}`);
for (const kind of Object.keys(kinds)) {
  const miss = kinds[kind].keys.filter((k) => !have[kind].includes(k));
  if (miss.length) console.log(`아직 없는 ${kind}: ${miss.join(", ")}`);
}
if (skipped.length) console.log(`이름이 안 맞아 건너뛴 파일:\n  ${skipped.join("\n  ")}`);
