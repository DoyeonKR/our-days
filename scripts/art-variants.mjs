// 작은 그림 사본 굽기(2026-11-11 첫 화면 다이어트) — 원화를 바꾸면 다시 돌린다: node scripts/art-variants.mjs
//
// · 홈 히어로(계절 원화 1200×1800) → 같은 폴더의 <계절>-800w.webp. 화면 폭이 448px 를 넘지 않아 DPR 2 폰은 800w 면
//   충분하다(srcset — DPR 3 폰은 그대로 1200 을 받는다). 경로 · srcset 은 lib/homeworldart.ts 한 곳.
// · 게임 탭 카드 배경(낚시터 · 수조 · 섬 마을, 1024~1200px 원화) → public/cards/ 의 작은 사본. 원화 그대로는 탭을 열 때마다
//   0.8~1MB 를 받았다. 반 칸 카드(수조)는 480px, 화면 폭 카드(낚시 · 섬)는 720px — 448px 칸을 DPR 2 남짓으로 덮는다
//   (480px 면 화면 폭 카드가 3배 화면에서 눈에 띄게 흐려진다). 이름 규칙은 lib/cardart.ts.
// 리사이즈는 sharp lanczos3(레포의 다른 사본과 같은 방식), WebP q82 · effort 6.
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const Q = { quality: 82, effort: 6 };
const jobs = [];
for (const s of ["spring", "summer", "autumn", "winter"]) {
  jobs.push({ from: `public/assets/homeworld/${s}.webp`, to: `public/assets/homeworld/${s}-800w.webp`, width: 800 });
}
await mkdir("public/cards", { recursive: true });
for (const f of await readdir("public/fishing")) {
  if (/^spot_.+\.webp$/.test(f)) jobs.push({ from: `public/fishing/${f}`, to: `public/cards/fishing-${f}`, width: 720 });
}
for (const f of await readdir("public/aqua/tank")) {
  if (/^tank_\d+\.webp$/.test(f)) jobs.push({ from: `public/aqua/tank/${f}`, to: `public/cards/aqua-${f}`, width: 480 });
}
jobs.push({ from: "public/island/village-autumn-v1.webp", to: "public/cards/island-village-autumn-v1.webp", width: 720 });

for (const j of jobs) {
  const info = await sharp(j.from).resize({ width: j.width, kernel: "lanczos3", withoutEnlargement: true }).webp(Q).toFile(join(j.to));
  console.log(`${j.to}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)}KB`);
}
