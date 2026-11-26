// 모델 · 그림을 다시 구운 뒤 해시 맞추기(2026-11-26) — model-revisions.ts(GLB 앞 12자리) · style-approvals.json(그림 sourceHash, 검수 시트)
// node design/aqua3d-review/polar/sync-hashes.mjs <sheet> <key...>
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [sheet, ...keys] = process.argv.slice(2);
if (!sheet || !keys.length) throw Error('sheet 와 key 를 주세요');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const REV = 'src/lib/aqua3d/model-revisions.ts';
let rev = readFileSync(REV, 'utf8');
for (const k of keys) {
  const h = sha(`public/aqua/models/fish/${k}.glb`).slice(0, 12), re = new RegExp(`^ ${k}:'[0-9a-f]{12}',$`, 'm');
  if (re.test(rev)) rev = rev.replace(re, ` ${k}:'${h}',`);
  else rev = rev.replace('Object.freeze({\n', `Object.freeze({\n ${k}:'${h}',\n`);
}
writeFileSync(REV, rev);
const AP = 'src/lib/aqua3d/style-approvals.json', ap = JSON.parse(readFileSync(AP, 'utf8'));
for (const k of keys) ap.forms[k] = {...(ap.forms[k] ?? {}), sourceHash: sha(`public/aqua/fish/${k}.webp`), sheet};
writeFileSync(AP, JSON.stringify(ap, null, 2) + '\n');
// 승인 목록(approved-fish.json)은 승인 지문과 profiles 가 같은 폼만 담는다 — aqua-model-profiles 가 지문을 맞추기 전에 쓰면 그 폼이 빠진다. 여기서 다시 쓴다
const {writeApproved} = await import('../../../scripts/aqua-approved.mjs');
const out = await writeApproved();
console.log('ok', keys.join(' '), '· approved', out.forms.length);
