import sharp from "sharp";
import { petSprites } from "../src/lib/pixelart.ts";

const scale = 5;
const cell = 260;
const cols = 7;
const forms = [
  "egg", "hatchling", "sunny", "cozy", "moody", "fox", "cat",
  "bear", "panda", "owl", "wolf", "celestial_fox", "starlight_fox", "royal_cat",
  "lucky_cat", "guardian_bear", "honey_bear", "zen_panda", "dream_panda", "arcane_owl", "sage_owl",
  "lunar_wolf", "spirit_wolf", "tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe",
];

function rgba(hex: string): [number, number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}

const width = cols * cell;
const height = 4 * cell;
const data = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  data.set([17, 14, 29, 255], i * 4);
}
for (const [index, form] of forms.entries()) {
  const sprite = petSprites(form)[0];
  const ox = (index % cols) * cell + 10;
  const oy = Math.floor(index / cols) * cell + 10;
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    const key = sprite.rows[y][x];
    if (key === "." || key === " ") continue;
    const color = rgba(sprite.pal[key]);
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
      data.set(color, ((oy + y * scale + yy) * width + ox + x * scale + xx) * 4);
    }
  }
}

await sharp(data, { raw: { width, height, channels: 4 } })
  .png()
  .toFile("design/hero-redesign-implemented.png");
