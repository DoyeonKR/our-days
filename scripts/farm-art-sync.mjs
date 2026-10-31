// 섬 작물 · 음식 그림을 앱에 넣는다 — 원본(512 · 투명 webp)과 화면용 사본(160)을 굽고 src/lib/farmimages.ts 를 다시 쓴다.
//   node scripts/farm-art-sync.mjs                 public/farm/{crop,food} 에 이미 있는 파일만 다시 정리
//   node scripts/farm-art-sync.mjs <그림 폴더> …   폴더(하위 폴더 포함)의 png · webp · jpg 를 이름으로 맞춰 가져온다
// 이름 맞추기: 파일 이름(확장자 뺀 것)이 key(strawberry) 거나 한국어 이름(딸기)이면 된다. 대소문자 · 공백 · '-' · '_' 는 무시.
// 작물 key 와 음식 key 가 겹치면(없지만) 작물이 먼저다. 맞는 게 없는 파일은 이름을 알려 주고 건너뛴다.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const root = process.cwd();

/* 섬 엔진의 표를 직접 읽지 않고(타입 제거 빌드가 필요하다) 소스에서 key · 이름만 뽑는다. */
const island = readFileSync(join(root, "src/lib/island.ts"), "utf8");
function table(name) {
  const at = island.indexOf(`export const ${name}`);
  if (at < 0) throw new Error(`${name} 표를 못 찾았어요`);
  const end = island.indexOf("\n];", at);
  const body = island.slice(at, end);
  return [...body.matchAll(/key:\s*"([a-z0-9_]+)",\s*name:\s*"([^"]+)"/g)].map((m) => ({ key: m[1], name: m[2] }));
}
const crops = table("CROPS");
const foods = [...table("PRODUCTS"), ...table("GOODS")];
if (crops.length < 20 || foods.length < 40) throw new Error(`표 읽기 실패 — 작물 ${crops.length} · 음식 ${foods.length}`);

const norm = (s) => s.normalize("NFC").toLowerCase().replace(/[\s_\-]/g, "");
const lookup = new Map();
for (const [kind, list] of [["food", foods], ["crop", crops]]) for (const { key, name } of list) {
  lookup.set(norm(key), { kind, key });
  lookup.set(norm(name), { kind, key });
}

const out = { crop: join(root, "public/farm/crop"), food: join(root, "public/farm/food") };
for (const d of Object.values(out)) mkdirSync(join(d, "sm"), { recursive: true });

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "sm" ? [] : walk(p);
    return /\.(png|webp|jpe?g)$/i.test(n) ? [p] : [];
  });
}

const sources = process.argv.slice(2);
const skipped = [];
for (const src of sources) {
  for (const file of walk(src)) {
    const hit = lookup.get(norm(basename(file, extname(file))));
    if (!hit) { skipped.push(file); continue; }
    const dest = join(out[hit.kind], `${hit.key}.webp`);
    const buf = await sharp(file).ensureAlpha().trim({ threshold: 1 }).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toBuffer();
    writeFileSync(dest, buf);
  }
}

const keys = { crop: [], food: [] };
for (const kind of ["crop", "food"]) {
  const valid = new Set((kind === "crop" ? crops : foods).map((x) => x.key));
  for (const n of readdirSync(out[kind]).filter((n) => n.endsWith(".webp"))) {
    const key = n.slice(0, -5);
    if (!valid.has(key)) { skipped.push(join(out[kind], n)); continue; }
    const big = join(out[kind], n);
    await sharp(big).resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86 }).toFile(join(out[kind], "sm", n));
    keys[kind].push(key);
  }
  keys[kind].sort();
}

const list = (ks) => ks.map((k) => `  "${k}",\n`).join("");
const file = join(root, "src/lib/farmimages.ts");
const head = readFileSync(file, "utf8").split("export const CROP_IMAGE_KEYS")[0];
writeFileSync(file, `${head}export const CROP_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([\n${list(keys.crop)}]);\nexport const FOOD_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([\n${list(keys.food)}]);\n`);

const missing = (list, have) => list.filter((x) => !have.includes(x.key)).map((x) => `${x.name}(${x.key})`);
console.log(`작물 ${keys.crop.length}/${crops.length} · 음식 ${keys.food.length}/${foods.length}`);
const mc = missing(crops, keys.crop), mf = missing(foods, keys.food);
if (mc.length) console.log(`아직 없는 작물: ${mc.join(", ")}`);
if (mf.length) console.log(`아직 없는 음식: ${mf.join(", ")}`);
if (skipped.length) console.log(`이름이 안 맞아 건너뛴 파일:\n  ${skipped.join("\n  ")}`);
if (!existsSync(file)) process.exit(1);
