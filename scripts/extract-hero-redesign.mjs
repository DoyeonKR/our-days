import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const forms = [
  "egg", "hatchling", "sunny", "cozy", "moody", "fox", "cat",
  "bear", "panda", "owl", "wolf", "celestial_fox", "starlight_fox", "royal_cat",
  "lucky_cat", "guardian_bear", "honey_bear", "zen_panda", "dream_panda", "arcane_owl", "sage_owl",
  "lunar_wolf", "spirit_wolf", "tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe",
];

const source = join(process.cwd(), "design", "hero-redesign-reference.png");
const output = join(process.cwd(), "public", "heroes", "v2");
await mkdir(output, { recursive: true });
const meta = await sharp(source).metadata();
const cellW = meta.width / 7;
const cellH = meta.height / 4;

for (let i = 0; i < forms.length; i++) {
  const col = i % 7;
  const row = Math.floor(i / 7);
  // 생성 시트의 이웃 캐릭터 광채가 셀 경계를 2~4px 넘는 경우가 있어 안전 여백을 둔다.
  const left = Math.round(col * cellW) + (col === 0 ? 0 : 7);
  const top = Math.round(row * cellH) + (row === 0 ? 0 : 4);
  const right = Math.round((col + 1) * cellW) - (col === 6 ? 0 : 7);
  const bottom = Math.round((row + 1) * cellH) - (row === 3 ? 0 : 4);
  const { data, info } = await sharp(source)
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const seen = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(info.width * info.height);
  let head = 0;
  let tail = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const p = y * info.width + x;
    if (seen[p]) return;
    const k = p * 4;
    const dr = data[k] - 3;
    const dg = data[k + 1] - 7;
    const db = data[k + 2] - 22;
    if (dr * dr + dg * dg + db * db > 2300) return;
    seen[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < info.width; x++) { push(x, 0); push(x, info.height - 1); }
  for (let y = 0; y < info.height; y++) { push(0, y); push(info.width - 1, y); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % info.width;
    const y = Math.floor(p / info.width);
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  for (let p = 0; p < seen.length; p++) if (seen[p]) data[p * 4 + 3] = 0;

  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(232, 232, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(output, `${forms[i]}.png`));
}

console.log(`wrote ${forms.length} hero assets to ${output}`);
