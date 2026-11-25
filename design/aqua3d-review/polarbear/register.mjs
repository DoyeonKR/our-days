// 북극곰 세 모습을 모델 목록 · 승인 · 캐시 해시에 올린다(다시 지으면 다시 돌린다)
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadMesh} from '../floating-parts-node.mjs';
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const j = JSON.parse(readFileSync('design/aqua3d-review/models.json', 'utf8'));
const sa = JSON.parse(readFileSync('src/lib/aqua3d/style-approvals.json', 'utf8'));
let rev = readFileSync('src/lib/aqua3d/model-revisions.ts', 'utf8');
const FORM = {fry_polar_bear: ['fry', 'fry_walrus'], juv_polar_bear: ['juvenile', 'juv_walrus'], polar_bear: ['adult', 'walrus']};
for (const [key, [form, tpl]] of Object.entries(FORM)) {
  const file = `public/aqua/models/fish/${key}.glb`, h = sha(file), src = sha(`public/aqua/fish/${key}.webp`), {tris} = await loadMesh(file);
  const m = structuredClone(j.models[key] ?? j.models[tpl]);
  Object.assign(m, {family: 'polar_bear', form, file, triangles: tris.length / 3, bytes: readFileSync(file).length, sha256: h, sourceSHA256: src, anatomyKind: 'mammal',
    authoringProfile: {key: 'polar_bear', name: '북극곰', grade: '태초', cm: 250, water: 'sea', body: 'polar_bear', widthRatio: 0.42, life: '수면 가까이 머리를 내밀고 앞발을 번갈아 저어 나아간다(개헤엄) · 뒷다리는 키처럼 끌린다 · 숨 쉬러 자주 오르고 모래사장 · 바위에서 쉰다'},
    geometryAuthoring: 'part-built (design/aqua3d-review/polarbear/polarbear-build.mjs) · 비율 · 털빛은 USFWS · Ltshears · Unsplash(CC0) 사진(polarbear/reference/SOURCES.md) — 2D 카드는 이 모델을 찍은 그림',
    visualApproval: 'user_requested_2026-11-25', approval: 'user_requested_2026-11-25', remodel: '2026-11-25 새로 지음'});
  j.models[key] = m;
  sa.forms[key] = {sourceHash: src, sheet: 'design/aqua3d-review/polarbear/review.webp'};
  const line = ` ${key}:'${h.slice(0, 12)}',`, re = new RegExp(`^ ${key}:'[0-9a-f]{12}',`, 'm');
  rev = re.test(rev) ? rev.replace(re, line) : rev.replace(/Object\.freeze\(\{(\r?\n)/, (m0, nl) => m0 + line + nl);
}
writeFileSync('design/aqua3d-review/models.json', JSON.stringify(j, null, 2) + '\n');
writeFileSync('src/lib/aqua3d/style-approvals.json', JSON.stringify(sa, null, 2) + '\n');
writeFileSync('src/lib/aqua3d/model-revisions.ts', rev);
console.log('ok');
