// 빌드 산출물에 버전 마커(out/version.json) 기록 — 앱의 새 버전 감지(UpdateChip)용.
// CI(GitHub Actions)에선 GITHUB_SHA, 로컬 빌드는 "dev"(감지 비활성).
import { writeFileSync } from "node:fs";

const v = (process.env.GITHUB_SHA || "dev").slice(0, 12);
writeFileSync("out/version.json", JSON.stringify({ v }));
console.log("[write-version] out/version.json =", v);
