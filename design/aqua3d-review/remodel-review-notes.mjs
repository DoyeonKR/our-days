import {readFile,writeFile} from 'node:fs/promises';
const DIR='design/aqua3d-review',status=JSON.parse(await readFile(DIR+'/remodel-status.json','utf8')),notes={
 spotted_seal:'주둥이·눈 둘레의 입체 굴곡이 단순하고, 앞지느러미 단면과 뺨 연결은 추가 정리가 필요합니다.',
 fur_seal:'정면 목·가슴 단면과 지느러미 뿌리의 곡률이 단순합니다. 코·귀의 작은 형상도 부족합니다.',
 steller_sea_lion:'목·어깨의 큰 부피는 있으나 턱과 가슴 단면이 각지고, 갈기와 뒷지느러미 연결 디테일이 부족합니다.',
 japanese_sea_lion:'이마·귀·목의 세부 굴곡과 앞지느러미 접합부를 실제 표본과 더 대조해야 합니다.',
 sea_otter:'앞발이 손가락 있는 짧은 발보다 지느러미처럼 보입니다. 발목·발가락·뒷발 두께를 수동으로 더 모델링해야 합니다.',
 otter:'앞뒤 다리와 발목·발가락이 납작하고 단순합니다. 배와 다리 연결의 실제 체형 재현이 부족합니다.',
 orca:'눈·입선과 눈 패치 경계가 대부분 텍스처 표현입니다. 머리와 등지느러미의 정밀 굴곡은 목표 참고 모델보다 부족합니다.',
 octopus:'외투막·머리 단면이 여전히 각지고 팔 뿌리가 두껍게 뭉칩니다. 빨판은 별도 입체 돌출이 아닌 텍스처 중심입니다.',
 squid:'팔 8개와 촉수 2개는 관으로 분리됐으나, 머리·외투막 경계와 촉수 끝·빨판의 정밀 형상이 부족합니다.',
 giant_squid:'긴 촉수의 분리와 부피는 있으나 머리 단면·촉수 끝 클럽·빨판의 세밀한 굴곡은 추가 제작이 필요합니다.',
 kraken:'머리와 팔 뿌리 단면이 각지고 밀집된 부분의 부피가 과합니다. 고리·빨판·흉터는 주로 텍스처이며 정밀 조형은 미완료입니다.'
};
const perKey={};for(const m of Object.values(status.models)){perKey[m.key]=notes[m.family];m.manualReviewNotes=[notes[m.family]];m.visualApproval='pending';m.activation='not enabled';}
status.qualityTargetAssessment='Not achieved as a final-quality sign-off. All 33 are structurally valid review drafts; visible anatomical and cross-view consistency shortcomings remain.';
status.knownLimitations=['Independently generated views have residual pose and anatomical inconsistencies. Matching alpha extents does not make them an exact calibrated multi-view capture.','Visual hull cannot recover concave facial features, paw joints or sucker relief from silhouettes alone.','The requested ten-bone skeleton is retained; independent multi-joint control of each cephalopod arm is not included.'];
await writeFile(DIR+'/remodel-status.json',JSON.stringify(status,null,2)+'\n');
await writeFile(DIR+'/remodel-review-notes.json',JSON.stringify({visualApproval:'pending',activation:'not enabled',artifactGenerationComplete:true,targetQualitySignoff:false,assessment:'검수용 33종 생성과 구조 검증은 끝났으나, Tripo 참고 수준의 정밀 형상까지 완료한 것으로 보지 않습니다.',perKey},null,2)+'\n');
console.log('Recorded one-line remaining issues for all 33 keys; no assets enabled.');
