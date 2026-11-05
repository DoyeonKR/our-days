// 첫 화면 크기 알림(경고만, 2026-11-05 앱 공통 리뷰 — README §10.13).
//   node scripts/first-load-size.mjs [out 폴더] [경고 기준 KB]
// out/index.html 이 부르는 _next/static 의 JS · CSS 를 gzip 으로 재서 합을 찍는다. 기준을 넘으면 GitHub 경고만 남기고
// **빌드를 실패시키지 않는다** — 크기는 빌드마다 흔들리고, 무엇이 실렸는지는 firstload.test(정적 import 그래프)가 잠근다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = process.argv[2] || "out";
const LIMIT_KB = Number(process.argv[3] || 420);
const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+\.(?:js|css))"/g)) refs.add(m[1]);

let raw = 0;
let gz = 0;
const rows = [];
for (const ref of refs) {
  const rel = ref.slice(ref.indexOf("/_next/static/") + 1);
  const file = path.join(OUT, rel);
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const g = zlib.gzipSync(buf, { level: 9 }).length;
  raw += buf.length;
  gz += g;
  rows.push([g, rel]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [g, rel] of rows.slice(0, 12)) console.log(`${(g / 1024).toFixed(1).padStart(8)} KB  ${rel}`);
const kb = gz / 1024;
console.log(`first load: ${rows.length} files · ${(raw / 1024).toFixed(1)} KB raw · ${kb.toFixed(1)} KB gzip (경고 기준 ${LIMIT_KB} KB)`);
if (kb > LIMIT_KB) {
  console.log(`::warning title=첫 화면 크기::gzip ${kb.toFixed(1)} KB 가 기준 ${LIMIT_KB} KB 를 넘었어요 — 무엇이 첫 화면에 실렸는지 확인해 주세요(README §10.8 첫 로드 다이어트).`);
}
