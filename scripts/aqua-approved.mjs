// 승인된 물고기 모델 목록 굽기(2026-11-11) — profiles.json 이나 style-approvals.json 을 바꾸면 다시 돌린다:
//   node scripts/aqua-approved.mjs   (aqua-model-profiles.mjs 가 끝에 부른다)
// 승인 판정(quality.ts)은 '스타일 승인의 원본 지문 === 지금 프로필의 원본 지문'이 전부인데, 그 지문 하나를 보려고
// 300KB 짜리 profiles.json(압축 약 96KB)과 style-approvals.json(38KB)을 수조 · 낚시 조각에 싣고 있었다.
// 그 결과(승인된 key 목록)만 approved-fish.json 에 적는다. aquaapproved.test 가 두 원본에서 다시 계산해 이 파일과
// 같은지 본다 — 원본만 고치고 이걸 안 돌리면 테스트가 깨진다.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** quality.ts 의 옛 판정과 같은 식: 스타일 승인에 있고, 프로필이 있고, 원본 지문이 같다 */
export function approvedForms(styles, profiles) {
  return Object.keys(styles.forms)
    .filter((key) => Object.hasOwn(profiles, key) && !!styles.forms[key] && styles.forms[key].sourceHash === profiles[key]?.sourceHash)
    .sort();
}

export async function writeApproved() {
  const styles = JSON.parse(await readFile("src/lib/aqua3d/style-approvals.json", "utf8"));
  const profiles = JSON.parse(await readFile("src/lib/aqua3d/profiles.json", "utf8"));
  const out = { revision: styles.revision, forms: approvedForms(styles, profiles) };
  await writeFile("src/lib/aqua3d/approved-fish.json", JSON.stringify(out) + "\n");
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await writeApproved();
  console.log(`approved-fish.json: ${out.forms.length} forms (${out.revision})`);
}
