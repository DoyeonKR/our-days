// 낚시 그림 — 프롬프트 문서 만들기 · 그림 넣기.
//   node scripts/fishing-art.mjs prompts            design/FISHING-ART.md 를 다시 쓴다
//   node scripts/fishing-art.mjs sync [그림 폴더] … 파일 이름(key)으로 맞춰 public/fishing 에 굽고 src/lib/fishingimages.ts 를 다시 쓴다
// 낚시터 배경 1024×1280 · 장비 512×512(투명). 표의 key 는 src/lib/fishing.ts 와 같아야 한다(fishing.test 가 대조한다).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export const SPOT_STYLE = "Premium hand-painted mobile fishing game background, portrait 4:5 (1024x1280), viewed from the shore looking out over the water. Horizon at about 34% from the top: scenery and sky above it, a wide calm open water surface filling the lower 66%. The water surface must stay open and uncluttered because the bobber, fishing line and fish shadow are drawn on top in the game. No people, no fishing rod, no boats in the middle, no fish, no text, no UI, no border, no watermark.";
export const GEAR_STYLE = "Premium hand-painted mobile game item icon, cute but believable, glossy rich shading, soft light from the upper left, clean readable silhouette at 52 pixels. Single object drawn diagonally, whole object inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No hands, no water, no scenery, no cast shadow, no text, no border, no watermark. 1024x1024.";

export const SPOTS = [
  ["spot_harbor", "남해 항구 · 활성화 준비", "South-coast Korean harbour, distant coastal village and red lighthouse, small boats along far shore only. Horizon at 32% height; calm uncluttered blue-green water fills the lower 68%. Warm clear morning light."],
  ["spot_brook", "동네 개울", "A small friendly neighborhood stream in a Korean countryside village: smooth stones along the far bank, reeds, a little wooden footbridge in the distance, gentle morning light, clear shallow blue-green water."],
  ["spot_pond", "연꽃 연못", "A quiet lotus pond at golden hour: pink lotus flowers and pads only along the far edge, a small traditional Korean pavilion far away, warm peach sky, calm jade water."],
  ["spot_jungle", "열대 강", "A wide tropical jungle river: dense layered rainforest on the far bank, hanging vines, misty light rays, deep green-brown water."],
  ["spot_reef", "산호초 바다", "A sunny tropical lagoon: turquoise water, a white sand spit and palm trees far away, hints of coral color under the far shallows only, bright clear sky."],
  ["spot_ocean", "먼 바다", "The open ocean far from land: deep navy-blue water with gentle swells, huge towering clouds on the horizon, a distant lighthouse rock, dramatic but calm."],
  ["spot_palace", "용궁 앞바다", "A magical sea at dusk above the Korean Dragon King's palace: violet-pink sky, glowing lanterns floating on the far horizon, silhouettes of curved palace roofs rising from the distant water, deep indigo water with soft golden glints."],
  ["spot_starsea", "별의 바다", "A cosmic sea under a galaxy: the night sky full of stars and a huge spiral nebula, the water mirrors the stars like liquid night, faint aurora on the horizon. Awe-inspiring, the final fishing spot."],
];
export const GEAR = [
  ["rod_bamboo", "대나무 낚싯대", "Simple old bamboo fishing rod with a small wooden reel."],
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

export const BAIT_ART = [
  ["bait_worm", "지렁이", "A plump pink earthworm curled in an S shape, moist highlights."],
  ["bait_shrimp", "민물새우", "A small translucent freshwater shrimp with long feelers, pinkish, curled tail."],
  ["bait_squid", "오징어살", "A tender piece of white squid with a little tentacle tuft, wet glossy shine."],
  ["bait_paste", "황금 떡밥", "A soft round ball of golden fishing paste bait, grainy texture, warm honey glow."],
  ["bait_glow", "심해 발광 미끼", "A teardrop bait from the deep sea that glows cyan from within, with soft light bloom."],
  ["bait_pearl", "용궁 진주 미끼", "A luminous pearl resting in a small violet clam shell, Korean Dragon King's palace treasure."],
  ["bait_star", "별가루 미끼", "A small handful of star dust forming a glowing golden star shape with tiny sparkles orbiting it."],
];
export const JUNK_ART = [
  ["junk_can", "찌그러진 깡통", "A crumpled drink can with faded red label, dented, a little wet sheen."],
  ["junk_boot", "장화 한 짝", "A single old yellow rubber boot, a bit muddy, slightly bent at the ankle."],
  ["junk_bottle", "페트병", "A scuffed clear plastic bottle with blue cap and a peeling label."],
  ["junk_bag", "비닐봉지", "A limp white plastic shopping bag, soft flowing shape almost like a jellyfish."],
  ["junk_sock", "구멍 난 양말", "A single limp pink striped sock with a big hole at the toe."],
  ["junk_tire", "낡은 타이어", "A worn black car tire with a little seaweed hanging from it."],
  ["junk_umbrella", "살이 부러진 우산", "A broken purple umbrella, bent ribs poking out, half folded."],
  ["junk_duck", "고무 오리", "A faded yellow rubber duck, slightly scuffed, adorable blank stare."],
  ["junk_slipper", "삼선 슬리퍼", "A single black rubber slide sandal with three white stripes, wet."],
  ["junk_coin", "소원 동전", "A shiny old gold wishing coin with a tiny star engraved, a bit of pond algae on it."],
  ["junk_hat", "탐험가 모자", "A worn khaki explorer's pith hat with a brown band, a small leaf stuck on it."],
  ["junk_glasses", "깨진 선글라스", "A pair of black sunglasses with one cracked lens, tiny coral stuck on the frame."],
  ["junk_letter", "유리병 편지", "A corked green glass bottle with a rolled parchment letter inside."],
  ["junk_bill", "용왕의 고지서", "An ancient parchment invoice with a red royal seal and wavy ocean ornament border, no readable text."],
  ["junk_satellite", "인공위성 조각", "A broken piece of a small satellite with one bent blue solar panel, sparkling with stardust."],
];

function prompts() {
  const rows = (list) => list.map(([k, ko, t]) => `| \`${k}\` | ${ko} | ${t} |`).join("\n");
  writeFileSync("design/FISHING-ART.md", `# 낚시 그림 목록 · 프롬프트

> 이 파일은 \`node scripts/fishing-art.mjs prompts\` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다.
> **이 문서의 그림은 전부 2D 다.** 수조 내부의 3D 모델은 별도 제작·검수하며(\`design/aqua3d-review/\`), 이 문서의 낚시터 · 장비 · 미끼 · 쓰레기를 대체하지 않는다.
> 낚시 결과 카드 · 게임 탭 카드의 물고기는 2D 그림(\`public/aqua/fish\`, design/AQUARIUM-ART.md)을 그대로 쓴다 — 수조가 3D 가 돼도 지우지 않는다.
>
> 모두 **${SPOTS.length + GEAR.length + BAIT_ART.length + JUNK_ART.length}장**: 낚시터 배경 ${SPOTS.length} · 장비 ${GEAR.length} · 미끼 ${BAIT_ART.length} · 꽝 쓰레기 ${JUNK_ART.length}. 미끼 · 쓰레기는 없으면 화면이 벡터 아이콘으로 그린다.

## 넣는 법

1. 파일 이름을 **key** 로 저장한다(예: \`spot_brook.png\`, \`rod_carbon.png\`).
2. \`node scripts/fishing-art.mjs sync <그림 폴더>\` — \`public/fishing/\` 에 굽고 그림 목록을 다시 쓴다. 일부만 그려도 된다(없는 그림은 임시 그림).

## 공통 프롬프트

각 그림의 프롬프트 = **공통 문장 + 표의 설명**. 실제 게임 화면을 따라 그리지 않는다. 3D 렌더풍(CG · 플라스틱 질감)이 아니라 전부 손으로 칠한 그림체로 맞춘다.

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

**낚싯대 규칙** — 그림이 낚시터에 그대로 나온다. 프로그램이 그림을 세운 뒤 띠로 잘라 휘게 하므로:
- 낚싯대 전체가 **대각선 한 줄**로 곧게 놓여야 한다(손잡이 끝이 아래쪽 모서리, 끝이 반대쪽 위 모서리). 그림 안에서 많이 휘면 휜 채로 또 휜다.
- 줄을 늘어뜨리지 않는다 — 줄과 찌는 게임이 그린다. 끝에 매달린 장식도 작게.
- ⚠ 낚싯대를 다시 그리면 \`src/lib/fishingfx.ts\` 의 \`FX_ROD_ART\`(손잡이 끝 · 낚싯대 끝 · 릴 자리)를 그 그림에 맞춰 다시 잰다. 안 재면 줄이 낚싯대 끝에서 떨어진다.

**뜰채 규칙** — 뜰채 낚시에서 물 위로 내리꽂히고 조준 원과 겹친다. 둥근 테가 위쪽 절반에, 자루가 오른쪽 아래로 오게 그린다.

| key | 이름 | 설명 |
|---|---|---|
${rows(GEAR)}

## 미끼 (${BAIT_ART.length}장) — 장비 공통 프롬프트

| key | 이름 | 설명 |
|---|---|---|
${rows(BAIT_ART)}

## 꽝 쓰레기 (${JUNK_ART.length}장) — 장비 공통 프롬프트(귀엽게, 더럽지 않게)

| key | 이름 | 설명 |
|---|---|---|
${rows(JUNK_ART)}
`);
  console.log(`design/FISHING-ART.md ${SPOTS.length + GEAR.length + BAIT_ART.length + JUNK_ART.length}장`);
}

async function sync(from) {
  const { default: sharp } = await import("sharp");
  const out = join(process.cwd(), "public/fishing");
  mkdirSync(out, { recursive: true });
  const known = new Set([...SPOTS, ...GEAR, ...BAIT_ART, ...JUNK_ART].map((x) => x[0]));
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
