// 낚시 그림 — 프롬프트 문서 만들기 · 그림 넣기.
//   node scripts/fishing-art.mjs prompts            design/FISHING-ART.md 를 다시 쓴다
//   node scripts/fishing-art.mjs sync [그림 폴더] … 파일 이름(key)으로 맞춰 public/fishing 에 굽고 src/lib/fishingimages.ts 를 다시 쓴다
// 낚시터 배경 1024×1280 · 장비 512×512(투명). 표의 key 는 src/lib/fishing.ts 와 같아야 한다(fishing.test 가 대조한다).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export const SPOT_STYLE = "Premium hand-painted mobile fishing game background, portrait 4:5 (1024x1280), viewed from the shore looking out over the water. Horizon at about 34% from the top: scenery and sky above it, a wide calm open water surface filling the lower 66%. The water surface must stay open and uncluttered because the bobber, fishing line and fish shadow are drawn on top in the game. No people, no fishing rod, no boats in the middle, no fish, no text, no UI, no border, no watermark.";
export const GEAR_STYLE = "Premium hand-painted mobile game item icon, cute but believable, glossy rich shading, soft light from the upper left, clean readable silhouette at 52 pixels. Single object drawn diagonally, whole object inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No hands, no water, no scenery, no cast shadow, no text, no border, no watermark. 1024x1024.";

export const SPOTS = [
  ["spot_brook", "동네 개울", "A small friendly neighborhood stream in a Korean countryside village: smooth stones along the far bank, reeds, a little wooden footbridge in the distance, gentle morning light, clear shallow blue-green water."],
  ["spot_pond", "연꽃 연못", "A quiet lotus pond at golden hour: pink lotus flowers and pads only along the far edge, a small traditional Korean pavilion far away, warm peach sky, calm jade water."],
  ["spot_jungle", "열대 강", "A wide tropical jungle river: dense layered rainforest on the far bank, hanging vines, misty light rays, deep green-brown water."],
  ["spot_reef", "산호초 바다", "A sunny tropical lagoon: turquoise water, a white sand spit and palm trees far away, hints of coral color under the far shallows only, bright clear sky."],
  ["spot_ocean", "먼 바다", "The open ocean far from land: deep navy-blue water with gentle swells, huge towering clouds on the horizon, a distant lighthouse rock, dramatic but calm."],
  ["spot_palace", "용궁 앞바다", "A magical sea at dusk above the Korean Dragon King's palace: violet-pink sky, glowing lanterns floating on the far horizon, silhouettes of curved palace roofs rising from the distant water, deep indigo water with soft golden glints."],
  ["spot_starsea", "별의 바다", "A cosmic sea under a galaxy: the night sky full of stars and a huge spiral nebula, the water mirrors the stars like liquid night, faint aurora on the horizon. Awe-inspiring, the final fishing spot."],
];
export const GEAR = [
  ["rod_bamboo", "대나무 낚싯대", "Simple old bamboo fishing rod with a plain string and a small wooden reel."],
  ["rod_glass", "유리섬유 낚싯대", "Light fiberglass fishing rod, pale blue, simple silver spinning reel."],
  ["rod_carbon", "카본 낚싯대", "Sleek black carbon fishing rod with red wraps and a modern spinning reel."],
  ["rod_titan", "티타늄 낚싯대", "Premium brushed titanium fishing rod with gold accents and a heavy machined reel."],
  ["rod_dragon", "용골 낚싯대", "Fantasy fishing rod carved from a dragon bone, ivory with jade inlays, small dragon head at the grip, glowing jade reel."],
  ["rod_star", "별빛 낚싯대", "Legendary fishing rod made of starlight: dark indigo shaft filled with stars, glowing silver line, a tiny comet orbiting the tip, crystal reel."],
  ["net_bug", "잠자리채", "Cheap childhood bug-catching net: thin wire hoop, white mesh, short wooden stick."],
  ["net_cotton", "면 뜰채", "Fishing landing net with a wooden hoop and soft cream cotton mesh."],
  ["net_rubber", "고무 뜰채", "Modern landing net with a black aluminum hoop and clear-green rubber mesh."],
  ["net_silver", "은실 뜰채", "Elegant landing net with a polished silver hoop and shimmering silver-thread mesh."],
  ["net_gold", "황금 뜰채", "Luxurious landing net with an ornate gold hoop and fine golden mesh, small gems on the handle."],
  ["net_moon", "달빛 뜰채", "Legendary landing net: hoop shaped like a crescent moon, mesh woven from glowing moonlight, soft silver sparkles."],
];

function prompts() {
  const rows = (list) => list.map(([k, ko, t]) => `| \`${k}\` | ${ko} | ${t} |`).join("\n");
  writeFileSync("design/FISHING-ART.md", `# 낚시 그림 목록 · 프롬프트

> 이 파일은 \`node scripts/fishing-art.mjs prompts\` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다.
> 모두 **${SPOTS.length + GEAR.length}장**: 낚시터 배경 ${SPOTS.length} · 장비 ${GEAR.length}. 물고기는 수조 그림(design/AQUARIUM-ART.md)을 그대로 쓴다.

## 넣는 법

1. 파일 이름을 **key** 로 저장한다(예: \`spot_brook.png\`, \`rod_carbon.png\`).
2. \`node scripts/fishing-art.mjs sync <그림 폴더>\` — \`public/fishing/\` 에 굽고 그림 목록을 다시 쓴다. 일부만 그려도 된다(없는 그림은 임시 그림).

## 공통 프롬프트

각 그림의 프롬프트 = **공통 문장 + 표의 설명**. 실제 게임 화면을 따라 그리지 않는다.

**낚시터 공통**

\`\`\`
${SPOT_STYLE}
\`\`\`

**장비 공통**

\`\`\`
${GEAR_STYLE}
\`\`\`

## 낚시터 (${SPOTS.length}장)

| key | 이름 | 설명 |
|---|---|---|
${rows(SPOTS)}

## 장비 (${GEAR.length}장)

| key | 이름 | 설명 |
|---|---|---|
${rows(GEAR)}
`);
  console.log(`design/FISHING-ART.md ${SPOTS.length + GEAR.length}장`);
}

async function sync(from) {
  const { default: sharp } = await import("sharp");
  const out = join(process.cwd(), "public/fishing");
  mkdirSync(out, { recursive: true });
  const known = new Set([...SPOTS, ...GEAR].map((x) => x[0]));
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(png|webp|jpe?g)$/i.test(n) ? [p] : [];
  });
  const skipped = [];
  for (const dir of from) for (const file of walk(dir)) {
    const key = basename(file, extname(file)).toLowerCase();
    if (!known.has(key)) { skipped.push(file); continue; }
    const pic = key.startsWith("spot_")
      ? sharp(file).resize(1024, 1280, { fit: "cover" }).webp({ quality: 86 })
      : sharp(file).ensureAlpha().trim({ threshold: 1 })
        .resize(410, 410, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 88 });
    writeFileSync(join(out, `${key}.webp`), await pic.toBuffer());
  }
  const have = readdirSync(out).filter((n) => n.endsWith(".webp")).map((n) => n.slice(0, -5)).filter((k) => known.has(k)).sort();
  const file = join(process.cwd(), "src/lib/fishingimages.ts");
  const head = readFileSync(file, "utf8").split("export const FISHING_IMAGE_KEYS")[0];
  writeFileSync(file, `${head}export const FISHING_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([\n${have.map((k) => `  "${k}",\n`).join("")}]);\n`);
  console.log(`낚시 그림 ${have.length}/${known.size}`);
  const miss = [...known].filter((k) => !have.includes(k));
  if (miss.length) console.log(`아직 없음: ${miss.join(", ")}`);
  if (skipped.length) console.log(`이름이 안 맞아 건너뜀:\n  ${skipped.join("\n  ")}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "prompts") prompts();
else if (cmd === "sync") await sync(rest);
