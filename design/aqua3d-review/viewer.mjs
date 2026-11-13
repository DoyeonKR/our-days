import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// 2026-11-05 배포 GLB 는 meshopt 압축본 — 게임(glb.ts)과 똑같이 디코더를 단다. 없으면 모든 모델이 못 열린다
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {zipSync,strToU8} from '/node_modules/fflate/esm/browser.js';
import {anatomy,bendProfile,swimAngles,swimClock,stepSwim,jellyPulse,bendAxisFor} from './runtime-swim.mjs';
import {MODEL_COLOR,modelColorTree,modelTextureQuality,COLOR_REVISION} from './runtime-color.mjs';
import {waterLitTree} from './runtime-waterlight.mjs';
import {fishShading,calmSpecular} from './runtime-post.mjs';
import {createFishFace,disposeFishFace,FACE_PROFILES,FACE_REVISION} from './runtime-faces.mjs';
const report=await(await fetch('./models.json')).json(),expansion=await(await fetch('./expansion-prompts.json')).json(),expansion2=await(await fetch('./expansion2-prompts.json')).json(),native=await(await fetch('./native-prompts.json')).json(),set=new URLSearchParams(location.search).get('set'),expansion4=set==='expansion4'?await(await fetch('./expansion4-prompts.json')).json():null,mammals=set==='mammals'?await(await fetch('./mammals-prompts.json')).json():null,familySet=set==='mammals'?mammals.species.map(s=>s.key):set==='timed'?['catfish','sweetfish','jellyfish']:set==='expansion'?expansion.species.map(([f])=>f):set==='expansion2'?expansion2.species.map(s=>s.key):set==='native'?native.species.map(s=>s.key):set==='expansion4'?expansion4.species.map(s=>s.key):null,keys=Object.keys(report.models).filter(k=>!familySet||familySet.includes(report.models[k].family)),select=document.querySelector('#model'),status=document.querySelector('#status'),host=document.querySelector('#viewer');
const isRay=k=>report.models[k].referenceDorsal||report.models[k].kind==='fish'&&(['ray','manta'].includes(report.models[k].family)||k==='aurora_ray'||report.models[k].anatomyKind==='star'||(report.models[k].family==='flounder'&&k!=='fry_flounder'));
document.querySelector('h1').textContent=`우리 수조 GLB · 전체 ${keys.length}종`;
document.title=`수조 GLB ${keys.length}종 검수`;
const nativeLink=document.createElement('a');nativeLink.href='?set=native';nativeLink.textContent='한국 토종·실제 어종 60개 형태 검수';document.querySelector('#model').before(nativeLink,document.createElement('br'));
if(set==='native')document.querySelector('.warning').textContent='토종·실제 어종 20종의 치어·어린 개체·성체 60개 모델입니다. 정면·측면·사선과 뼈대 움직임을 원화와 비교해 주세요. 구조 검사 통과는 외형 승인이 아니며, 게임 출현 설정과 승인 기록은 별도로 확인해야 합니다.';
document.querySelector('#export').textContent=`${keys.length}종 전체 3각도 렌더 ZIP 저장`;
for(const key of keys){const o=document.createElement('option');o.value=key;o.textContent=`${report.models[key].kind==='fish'?'물고기':'장식'} · ${key}`;select.add(o);}
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(512,512);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.05;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','검수 GLB 렌더');renderer.domElement.setAttribute('role','img');
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xd7e8ee,0x4a5240,2));const light=new T.DirectionalLight(0xffedce,2.4);light.position.set(3,5,6);scene.add(light);const fill=new T.DirectionalLight(0x8ac7d2,1);fill.position.set(-4,1,-3);scene.add(fill);
const camera=new T.OrthographicCamera(-2,2,2,-2,.01,100),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let model=null,key=keys[0],center=new T.Vector3(),span=1,start=null,angle=.5,pitch=.25,loading=0;
let motion=false,currentView='oblique',previewClock=swimClock(),previousMs=0;
let legacyColor=false;
let gameEffects=false;
let colorZipURL=null;
let faceDetail=false,faceZoom=false,faceOpen=false,faceBreath=false,faceRig=null;
for(const id of ['faceDetail','faceZoom','faceOpen','faceBreath'])document.querySelector('#'+id).onclick=async()=>{
 if(id==='faceDetail'){faceDetail=!faceDetail;document.querySelector('#'+id).setAttribute('aria-pressed',String(faceDetail));await load(select.value);return;}
 if(id==='faceZoom')faceZoom=!faceZoom;if(id==='faceOpen')faceOpen=!faceOpen;if(id==='faceBreath')faceBreath=!faceBreath;
 document.querySelector('#'+id).setAttribute('aria-pressed',String(id==='faceZoom'?faceZoom:id==='faceOpen'?faceOpen:faceBreath));faceRig?.setBite(faceOpen?.85:0);faceRig?.animate(0);draw(currentView);
};
function colorLook(legacy){legacyColor=legacy;MODEL_COLOR.strength.value=legacy?0:.28;renderer.toneMapping=legacy?T.ACESFilmicToneMapping:T.NeutralToneMapping;document.querySelector('#legacyColor').setAttribute('aria-pressed',String(legacy));}
document.querySelector('#legacyColor').onclick=()=>{colorLook(!legacyColor);draw(currentView);};
document.querySelector('#gameEffects').onclick=async()=>{gameEffects=!gameEffects;document.querySelector('#gameEffects').setAttribute('aria-pressed',String(gameEffects));await load(select.value);};
const previewAngles=new Float32Array(10);
function resetPose(){model?.traverse(o=>{if(o.isBone)o.rotation.set(0,0,0);});model?.updateMatrixWorld(true);}
document.querySelector('#motion').onclick=()=>{motion=!motion;document.querySelector('#motion').setAttribute('aria-pressed',String(motion));if(!motion){resetPose();draw(currentView);}};
function poseAt(phase,finPhase=phase){
 const meta=report.models[key],p=bendProfile(meta.family,key);swimAngles(p,phase,{amp:1},previewAngles);
 if(p.kind!=='ray')for(let s=0;s<2;s++){const sign=s?1:-1;previewAngles[6+s*2]=sign*Math.sin(finPhase)*p.fin;previewAngles[7+s*2]=sign*Math.sin(finPhase-.7)*p.fin*1.3;}
 model.traverse(o=>{if(!o.isBone)return;
  const arm=/^arm_(\d+)_(\d+)$/.exec(o.name);if(arm){const i=+arm[1],j=+arm[2],star=meta.anatomyKind==='star',a=i*Math.PI*2/(star?5:8),wave=Math.sin(phase-i*.67-j*.65)*(star?.065:.10+j*.075);o.quaternion.setFromAxisAngle(new T.Vector3(star?-Math.sin(a):0,star?0:Math.cos(a),star?Math.cos(a):Math.sin(a)).normalize(),wave);return;}
  const spine=/^spine_(\d)$/.exec(o.name);if(spine){const i=+spine[1];o.rotation.set(0,0,0);
   if(p.kind==='jelly'){o.rotation.z=Math.sin(phase-i*.6)*(.045+i*.012);if(!i){const b={x:1,y:1,z:1};jellyPulse(Math.sin(phase),'x',b);o.scale.set(b.x,b.y,b.z);}}
   else o.rotation[bendAxisFor(meta.family,key)]=previewAngles[i];
  }else{const n=['fin_L','fin_L_tip','fin_R','fin_R_tip'].indexOf(o.name);if(n>=0)o.rotation.set(previewAngles[6+n],0,0);}});
 model.updateMatrixWorld(true);
}
function animateFrame(ms){requestAnimationFrame(animateFrame);const dt=previousMs?Math.min(.1,(ms-previousMs)*.001):0;previousMs=ms;if(!model||document.hidden)return;
 if(faceBreath){faceRig?.animate(ms*.001);renderer.render(scene,camera);}if(!motion)return;
 const meta=report.models[key],a=anatomy(meta.family,key),p=bendProfile(meta.family,key);
 stepSwim(previewClock,a,p,ms*.001,dt,{amp:1,effort:1});poseAt(previewClock.beat,previewClock.fin);renderer.render(scene,camera);
}
requestAnimationFrame(animateFrame);
const views={front:k=>report.models[k].kind==='fish'?[1,0,0]:[0,0,1],side:k=>report.models[k].kind==='fish'?[0,0,1]:[1,0,0],oblique:()=>[1,.55,1.6],top:()=>[0,1,.001],rear:()=>[-1,0,0],bottom:()=>[0,-1,.001],reverse:()=>[0,0,-1],high:()=>[-1,1.1,-1.6]};
function dispose(root){disposeFishFace(root);const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.isMesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const t of Object.values(m))if(t?.isTexture)ts.add(t);}o.skeleton?.dispose();}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
function draw(view='oblique'){if(!model)return;currentView=view;const direction=views[view](key),focus=center.clone(),zoom=faceZoom&&report.models[key].kind==='fish',s=zoom?span*.31:span;if(zoom){const b=new T.Box3().setFromObject(model),p=FACE_PROFILES[key];focus.x=b.min.x+(p?.mouth?.[0]??.9)*(b.max.x-b.min.x)-span*.08;focus.y=b.max.y-(p?.mouth?.[1]??.5)*(b.max.y-b.min.y);}camera.left=-s;camera.right=s;camera.top=s;camera.bottom=-s;camera.updateProjectionMatrix();camera.position.copy(focus).add(new T.Vector3(...direction).normalize().multiplyScalar(15));camera.lookAt(focus);renderer.render(scene,camera);}
async function load(next){const ticket=++loading,keyMeta=report.models[next];status.textContent=`${next} 로딩 중…`;const data=await(await fetch('/'+keyMeta.file)).arrayBuffer(),gltf=await loader.parseAsync(data,'/');if(ticket!==loading){dispose(gltf.scene);return;}
 if(model){scene.remove(model);dispose(model);}model=gltf.scene;modelColorTree(model);modelTextureQuality(model,renderer.capabilities.getMaxAnisotropy());if(gameEffects){waterLitTree(model,keyMeta.kind==='fish');if(keyMeta.kind==='fish'){calmSpecular(model);fishShading(model);}}key=next;previewClock=swimClock();scene.add(model);model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model);box.getCenter(center);const size=box.getSize(new T.Vector3());span=Math.max(size.x,size.y,size.z)*.64;
 document.querySelector('#reference').src=`/public/aqua/${keyMeta.kind}/${next}.webp`;document.querySelector('#reference').style.transform=keyMeta.referenceRotation?`rotate(${keyMeta.referenceRotation}deg)`:keyMeta.family==='jellyfish'||next==='moon_jelly'?'rotate(90deg)':'';const skins=[];model.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
status.textContent=`${next} · 삼각형 ${keyMeta.triangles.toLocaleString()} · ${(data.byteLength/1000).toFixed(1)} KB\n뼈 ${skins[0]?.skeleton.bones.map(b=>b.name).join(', ')??'없음'}\n구조 검사: 오류 ${keyMeta.validation?.errors??'검사 전'} · 외형 승인: 대기\n${keyMeta.kind==='decor'?'원본 수준의 세부 조형은 아직 미완성입니다.':'보이지 않는 면의 체적과 지느러미 연결부를 확인해 주세요.'}`;draw();
 faceRig=faceDetail&&keyMeta.kind==='fish'?createFishFace(model,keyMeta.family,next):null;faceRig?.setBite(faceOpen?.85:0);faceRig?.animate(0);if(faceDetail)status.textContent+=`\n${FACE_REVISION}: ${faceRig?`원래 얼굴 표면·턱 변형, 구강 ${faceRig.triangles} 삼각형 추가`:'해당 생물의 기존 구강 구조 유지'} · 신규 어종 출현 설정은 변경하지 않음`;draw();
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
select.onchange=()=>load(select.value).catch(e=>status.textContent='GLB 로딩 오류: '+e.message);for(const view of Object.keys(views)){const button=document.querySelector('#'+view);if(button)button.onclick=()=>draw(view);}
const headExport=document.createElement('button');headExport.textContent='형상 수정 30개 · 다각도 로컬 저장';headExport.id='headExport';document.querySelector('#audit').after(headExport);
headExport.onclick=async()=>{
 const previous=select.value,saved={faceDetail,faceZoom,faceOpen,faceBreath,motion,gameEffects};headExport.disabled=true;select.disabled=true;
 try{
  faceDetail=false;faceZoom=false;faceOpen=false;faceBreath=false;motion=false;gameEffects=false;
  const audit=await(await fetch('./head-audit.json')).json(),files={},proof={renderer:'Actual GLTFLoader / WebGL PBR, source GLB geometry correction; runtime face effects OFF',models:{}};
  for(const k of audit.changedKeys){
   const sha256=await load(k);select.value=k;resetPose();const c=document.createElement('canvas');c.width=1536;c.height=1120;const ctx=c.getContext('2d');ctx.fillStyle='#10262e';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.font='20px sans-serif';
   ctx.fillText(k+' / reference, previous GLB, corrected GLB / PENDING REVIEW',12,24);
   const ref=document.querySelector('#reference');await ref.decode();ctx.drawImage(ref,0,48,512,512);ctx.fillText('REFERENCE',12,48);
   const before=new Image();before.src='./heads/before/'+k+'-side.webp';await before.decode();ctx.drawImage(before,512,48,512,512);ctx.fillText('PREVIOUS GLB',524,48);
   const viewsToSave=['side','front','oblique','top'];
   for(let i=0;i<4;i++){draw(viewsToSave[i]);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));files[k+'-'+viewsToSave[i]+'.png']=new Uint8Array(await blob.arrayBuffer());const n=i+2,x=n%3*512,y=48+Math.floor(n/3)*536;ctx.drawImage(renderer.domElement,x,y,512,512);ctx.fillText('CORRECTED '+viewsToSave[i],x+12,y);}
   const card=await new Promise(r=>c.toBlob(r,'image/webp',.94));files[k+'-comparison.webp']=new Uint8Array(await card.arrayBuffer());proof.models[k]={sha256,views:viewsToSave};status.textContent='머리 형상 렌더 저장 중 · '+k;
  }
  files['manifest.json']=strToU8(JSON.stringify(proof,null,2));const response=await fetch('http://127.0.0.1:4198/heads',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:zipSync(files,{level:0})});if(!response.ok)throw Error('로컬 수신기를 확인해 주세요');
  status.textContent='형상 30개 실제 GLB 다각도 저장 완료';
 }catch(e){status.textContent='머리 형상 렌더 오류: '+e.message;}finally{({faceDetail,faceZoom,faceOpen,faceBreath,motion,gameEffects}=saved);await load(previous);select.value=previous;select.disabled=false;headExport.disabled=false;}
};
document.querySelector('#audit').onclick=async()=>{
 const button=document.querySelector('#audit');button.disabled=true;const previousMotion=motion,previousView=currentView;motion=false;resetPose();
 try{
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=2240;const ctx=canvas.getContext('2d');ctx.fillStyle='#10262e';ctx.fillRect(0,0,1536,2240);ctx.fillStyle='#edf1e8';ctx.font='24px sans-serif';ctx.fillText(`${key} / actual GLB WebGL PBR / pending user review`,20,34);
  const labels=['reference',...Object.keys(views),'swim 0','swim 2.1','swim 4.2'];
  const reference=document.querySelector('#reference');await reference.decode();
  for(let i=0;i<labels.length;i++){
   const x=i%3*512,y=56+Math.floor(i/3)*544;ctx.fillStyle='#edf1e8';ctx.font='20px sans-serif';ctx.fillText(labels[i],x+14,y+26);
   if(!i){ctx.drawImage(reference,x,y+32,512,512);continue;}
   if(i<=8){resetPose();draw(Object.keys(views)[i-1]);}else{poseAt((i-9)*2.1,(i-9)*2.1*bendProfile(report.models[key].family,key).finRate);draw('oblique');}
   ctx.drawImage(renderer.domElement,x,y+32,512,512);
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${key}-webgl-audit.png`;a.click();URL.revokeObjectURL(url);
 }finally{resetPose();draw(previousView);motion=previousMotion;button.disabled=false;}
};
renderer.domElement.onpointerdown=e=>{start={x:e.clientX,y:e.clientY,angle,pitch};renderer.domElement.setPointerCapture(e.pointerId);};renderer.domElement.onpointermove=e=>{if(!start||!model)return;angle=start.angle+(e.clientX-start.x)*.01;pitch=Math.max(-1.2,Math.min(1.2,start.pitch+(e.clientY-start.y)*.008));camera.position.copy(center).add(new T.Vector3(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch)).multiplyScalar(15));camera.lookAt(center);renderer.render(scene,camera);};renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>{start=null;};
document.querySelector('#faceExport').onclick=async()=>{
 const button=document.querySelector('#faceExport'),progress=document.querySelector('#faceProgress'),previous=select.value,saved={faceDetail,faceZoom,faceOpen,faceBreath,motion,gameEffects};button.disabled=true;select.disabled=true;
 try{faceDetail=true;faceZoom=true;faceOpen=false;faceBreath=false;motion=false;gameEffects=true;
  const list=keys.filter(k=>report.models[k].kind==='fish'),files={},proof={status:'runtime_surface_release',revision:FACE_REVISION,renderer:'actual Three.js WebGL PBR; runtime facial sculpture and jaw deformation, source GLB unchanged',models:{}};
  for(let i=0;i<list.length;i++){const k=list[i],hash=await load(k);select.value=k;const c=document.createElement('canvas');c.width=768;c.height=560;const ctx=c.getContext('2d');ctx.fillStyle='#10262e';ctx.fillRect(0,0,768,560);ctx.font='14px sans-serif';ctx.fillStyle='#fff';ctx.fillText(k+' / reference + runtime surface V2',10,18);
   const reference=document.querySelector('#reference');await reference.decode();ctx.drawImage(reference,0,28,256,256);
   const viewsToSave=['side','front','oblique','top','side'];for(let j=0;j<5;j++){faceRig?.setBite(j===4?.85:0);faceRig?.animate(0);draw(viewsToSave[j]);const n=j+1,x=n%3*256,y=28+Math.floor(n/3)*266;ctx.drawImage(renderer.domElement,x,y,256,256);ctx.fillText(j===4?'gape / open':viewsToSave[j],x+6,y+248);}
   const blob=await new Promise(r=>c.toBlob(r,'image/webp',.92));files[k+'.webp']=new Uint8Array(await blob.arrayBuffer());proof.models[k]={sha256:hash,profile:FACE_PROFILES[k],trianglesAdded:faceRig?.triangles??0,mode:faceRig?'runtime_geometry':'preserved_anatomy'};progress.textContent=`얼굴 실제 렌더 ${i+1}/${list.length} · ${k}`;await new Promise(r=>requestAnimationFrame(r));
  }
  files['manifest.json']=strToU8(JSON.stringify(proof,null,2));const zip=zipSync(files,{level:0});const response=await fetch('http://127.0.0.1:4198/faces',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:zip});if(!response.ok)throw new Error('로컬 검수 저장 실패');progress.textContent=`얼굴 ${list.length}형태 대조표 저장 완료 · 외형 승인 대기`;
 }catch(e){progress.textContent='얼굴 검수 오류: '+e.message;}finally{({faceDetail,faceZoom,faceOpen,faceBreath,motion,gameEffects}=saved);await load(previous);select.value=previous;select.disabled=false;button.disabled=false;}
};
document.querySelector('#export').onclick=async()=>{const button=document.querySelector('#export'),progress=document.querySelector('#progress'),previous=select.value;button.disabled=true;select.disabled=true;try{const files={},proof={renderer:'three.js WebGL PBR / actual GLBLoader rest pose',models:{}};
 motion=false;document.querySelector('#motion').setAttribute('aria-pressed','false');document.querySelector('#motion').disabled=true;resetPose();
 for(let i=0;i<keys.length;i++){const k=keys[i],hash=await load(k),list=['front','side','oblique',...(isRay(k)?['top']:[])];select.value=k;
  if((set==='expansion4'||set==='mammals')&&!list.includes('top'))list.push('top');
  for(const view of list){draw(view);const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));files[`${k}-${view}.png`]=new Uint8Array(await blob.arrayBuffer());}
  proof.models[k]={sha256:hash,views:list};progress.textContent=`실제 GLB 렌더 ${i+1}/${keys.length} · ${k}`;await new Promise(resolve=>requestAnimationFrame(resolve));
 }
 files['native-render.json']=strToU8(JSON.stringify(proof,null,2));const blob=new Blob([zipSync(files,{level:0})],{type:'application/zip'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='aqua-all-native-renders.zip';link.click();URL.revokeObjectURL(link.href);progress.textContent=`완료 · 실제 GLB 렌더 ${Object.keys(files).length-1}장과 해시 증명 저장`;await load(previous);select.value=previous;
 }catch(e){progress.textContent='렌더 오류: '+e.message;}finally{button.disabled=false;select.disabled=false;document.querySelector('#motion').disabled=false;}};
if(set==='mammals'){
 document.querySelector('.warning').textContent='해양·민물 포유류 6계열 18형태 준비 자산입니다. 원화와 최신 GLB 해시를 대조한 실제 WebGL/PBR 정면·측면·사선·윗면 72장을 저장했습니다. 외형 승인 대기 / 게임 출현 미연결. 물고기 얼굴 보정·수영은 포유류 검수에 적용하지 마세요.';
 document.querySelector('#export').textContent='18종 전체 4각도 렌더 ZIP 저장';
 document.querySelector('#motion').disabled=true;document.querySelector('#faceDetail').disabled=true;
 for(let page=1;page<=3;page++)for(const type of ['models','top']){const img=document.createElement('img');img.src=`./mammals-${type}-${page}.webp`;img.alt=`포유류 ${type} 대조표 ${page}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
}
else if(set==='expansion4'){
 const nativeProof=keys.every(k=>report.models[k].renderMethod?.startsWith('Actual'));
 document.querySelector('.warning').textContent=`4차 준비 자산 ${keys.length}/162개. 일반 체형 153개는 평면 몸통판을 제거한 V3 볼륨·연속 UV로 개선했고, 특수 체형 9개는 기존 구조를 유지했습니다. 승인 대기이며 게임에는 연결하지 않았습니다. ${nativeProof?'대조표도 최신 GLB 해시를 대조한 실제 WebGL PBR 렌더입니다.':'정적 대조표는 CPU proof입니다.'} 위 뷰어는 실제 WebGL GLB이며 수영 미리보기는 게임의 모션 함수를 공유합니다.`;
 const status4=await(await fetch('./expansion4-status.json')).json();
 for(let batch=0;batch<6;batch++){
  const families=expansion4.species.slice(batch*10,batch*10+10).map(s=>s.key),reviewed=status4.items.filter(i=>families.includes(i.family)&&i.review);
  for(let page=0;page<Math.ceil(reviewed.length/6);page++)for(const type of ['models','top']){const img=document.createElement('img');img.src=`./expansion4-${type}-${batch*5+page+1}.webp`;img.alt=`4차 ${type} 검수 ${batch+1}-${page+1}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
 }
}
else if(set==='colors'){
 document.querySelector('.warning').textContent=`레포 GLB ${keys.length}개 전체 색감 검수입니다. 기존 모델과 준비 중 모델·장식을 모두 포함합니다. 기본은 Neutral + 모델 색 보정, ‘이전 색감 비교’는 ACES + 무보정입니다. 원본 GLB·텍스처와 게임 출현 설정은 변경하지 않습니다.`;
 document.querySelector('#comparisons').parentElement.querySelector('summary').textContent='418개 모델 색감 전후 대조표 · 왼쪽 이전 / 오른쪽 개선';
 for(let i=1;i<=3;i++){const img=document.createElement('img');img.src=`./color-quality/comparison-${i}.webp`;img.alt=`대표 모델 색감 전후 ${i} · 왼쪽 이전, 오른쪽 개선`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
 for(let i=1;i<=10;i++){const img=document.createElement('img');img.src=`./color-quality/overview-${i}.webp`;img.alt=`전체 모델 색감 검수 ${i} · 각 쌍의 왼쪽 이전, 오른쪽 개선`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
}
else if(set==='native')for(let i=1;i<=10;i++){const img=document.createElement('img');img.src=`./native-models-${i}.webp`;img.alt=`토종·실제 어종 대조표 ${i}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
else if(set==='expansion2')for(let i=1;i<=5;i++){const img=document.createElement('img');img.src=`./expansion2-models-${i}.webp`;img.alt=`2차 생물 대조표 ${i}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
else if(set==='expansion')for(let i=1;i<=7;i++){const img=document.createElement('img');img.src=`./expansion-models-${i}.webp`;img.alt=`새 42종 대조표 ${i}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
else if(set==='timed'){const img=document.createElement('img');img.src='./timed-fish-models.webp';img.alt='새 9종 대조표';document.querySelector('#comparisons').append(img);}
else for(const kind of ['fish','decor'])for(let i=1;i<=Math.ceil(keys.filter(k=>report.models[k].kind===kind).length/5);i++){const img=document.createElement('img');img.src=`./stage1-${kind}-comparison-${i}.webp`;img.alt=`${kind} 대조표 ${i}`;img.loading='lazy';document.querySelector('#comparisons').append(img);}
document.querySelector('#colorExport').onclick=async()=>{
 const button=document.querySelector('#colorExport'),progress=document.querySelector('#colorProgress'),previous=select.value,previousMotion=motion,previousLook=legacyColor;
 button.disabled=true;select.disabled=true;motion=false;resetPose();
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const stats=()=>{ctx.clearRect(0,0,160,160);ctx.drawImage(renderer.domElement,0,0,160,160);const data=ctx.getImageData(0,0,160,160).data;let n=0,sat=0,y=0,clip=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<192)continue;const a=[data[i],data[i+1],data[i+2]],hi=Math.max(...a),lo=Math.min(...a);n++;sat+=hi?(hi-lo)/hi:0;y+=(a[0]*.2126+a[1]*.7152+a[2]*.0722)/255;clip+=hi>=254?1:0;}return {pixels:n,saturation:n?sat/n:0,luminance:n?y/n:0,highlightFraction:n?clip/n:0};};
 try{const files={},proof={renderer:'Actual GLTFLoader / three.js WebGL PBR',revision:COLOR_REVISION,models:{},looks:{before:'ACES, exposure 1.05, strength 0',after:'Neutral, exposure 1.05, strength .28'},note:'Colour/render audit only, not a geometry approval or visual score.'};
  for(let i=0;i<keys.length;i++){const k=keys[i],sha256=await load(k),metrics={};select.value=k;
   for(const view of ['side','oblique'])for(const look of ['before','after']){colorLook(look==='before');draw(view);metrics[`${view}-${look}`]=stats();const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));files[`${k}-${view}-${look}.png`]=new Uint8Array(await blob.arrayBuffer());}
   proof.models[k]={kind:report.models[k].kind,sha256,metrics};progress.textContent=`색감 전후 렌더 ${i+1}/${keys.length} · ${k}`;await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  files['color-render.json']=strToU8(JSON.stringify(proof,null,2));if(colorZipURL)URL.revokeObjectURL(colorZipURL);colorZipURL=URL.createObjectURL(new Blob([zipSync(files,{level:0})],{type:'application/zip'}));const a=document.createElement('a');a.href=colorZipURL;a.download='aqua-color-audit.zip';a.id='colorDownload';a.textContent='색감 전후 ZIP 내려받기';progress.replaceChildren(document.createTextNode(`완료 · ${keys.length}개 모델, ${Object.keys(files).length-1}장 실제 WebGL 전후 렌더 · `),a);
 }catch(e){progress.textContent='색감 렌더 오류: '+e.message;}finally{await load(previous);select.value=previous;colorLook(previousLook);motion=previousMotion;draw(currentView);button.disabled=false;select.disabled=false;}
};
document.querySelector('#colorSaveLocal').onclick=async()=>{
 const button=document.querySelector('#colorSaveLocal'),progress=document.querySelector('#colorProgress');button.disabled=true;
 try{if(!colorZipURL)throw new Error('먼저 전체 색감 전후 렌더를 저장해 주세요.');const zip=await(await fetch(colorZipURL)).arrayBuffer(),response=await fetch('http://127.0.0.1:4198/audit',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:zip});if(!response.ok)throw new Error(`로컬 저장 ${response.status}`);const result=await response.json();progress.append(document.createTextNode(` · 레포 검수 폴더 저장 완료 (${result.bytes.toLocaleString()} bytes)`));}
 catch(e){progress.append(document.createTextNode(` · ${e.message}`));}finally{button.disabled=false;}
};
await load(key);
