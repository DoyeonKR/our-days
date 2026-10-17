// Mechanical production derivatives only: preserve generated transparency and add motion padding.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const [source, form] = process.argv.slice(2);
if (!source || !/^[a-z]+(?:_[a-z0-9]+)*$/.test(form ?? "")) throw new Error("Expected source PNG and safe form key");
const dest = join(process.cwd(), "public/heroes/v3");
await mkdir(dest, { recursive: true });
const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha || Math.min(metadata.width, metadata.height) < 768) {
  throw new Error(`${form}: expected a high-resolution transparent original`);
}
const trimmed = await sharp(source).trim({ background: "#00000000", threshold: 1 }).toBuffer();
for (const [size, pad, suffix] of [[768, 32, ""], [192, 8, "-icon"]]) {
  const info = await sharp(trimmed)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", position: suffix ? "centre" : "bottom", background: "#00000000", kernel: "lanczos3" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#00000000" })
    .webp({ quality: 94, alphaQuality: 100, effort: 4 })
    .toFile(join(dest, `${form}${suffix}.webp`));
  console.log(`${form}${suffix}: ${size}px, ${Math.round(info.size / 1024)} KiB`);
}
