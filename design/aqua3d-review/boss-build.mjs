import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {bossHull,readBossViews} from './boss-hull.mjs';
import {makeAppendages} from './boss-geometry.mjs';
import {textureParts} from './boss-texture.mjs';
import {rigBoss,BOSS_BONES} from './boss-rig.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {finishPacked} from './remodel-material.mjs';
import {compressGLB} from './glb-compress.mjs';
const DIR='design/aqua3d-review',OUT='public/aqua/models/boss',sha=b=>createHash('sha256').update(b).digest('hex'),records={models:{},visualApproval:'pending',activation:'not enabled',gameCodeWrites:false,committed:false};await mkdir(OUT,{recursive:true});await mkdir(DIR+'/boss-textures',{recursive:true});await MeshoptSimplifier.ready;
for(const key of ['boss_sanho','boss_geomeun']){const views=await readBossViews(key),hull=await bossHull(views,{key}),hullStats=hull.userData.hull,extras=makeAppendages(key,hull),fixed=extras.reduce((n,p)=>n+p.geometry.index.count/3,0),target=Math.min(hull.index.count/3,4900-fixed);if(target<500)throw Error('Appendages exceed budget: '+fixed);
 if(hull.index.count/3>target){const [I]=MeshoptSimplifier.simplify(Uint32Array.from(hull.index.array),Float32Array.from(hull.attributes.position.array),3,Math.floor(target)*3,.06,['Regularize']);hull.setIndex(new T.BufferAttribute(I,1));hull.computeVertexNormals();}
 const parts=[{name:'body',geometry:hull,role:'body',paint:null},...extras],tex=await textureParts(key,parts,views),g=mergeVertices(tex.geometry,1e-6),rig=rigBoss(g,key);g.computeBoundingBox();const box=g.boundingBox,centerX=(box.max.x+box.min.x)*.5,scale=2/(box.max.x-box.min.x);g.translate(-centerX,0,0);g.scale(scale,scale,scale);rig.bones[0].position.x-=centerX;for(const b of rig.bones)b.position.multiplyScalar(scale);rig.bones[0].updateMatrixWorld(true);
 const item={key,family:key==='boss_sanho'?'sea_turtle':'bluefin',category:'boss'},packed=finishPacked(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'four-view-visual-hull-boss',legacyImagePlaneShader:false,rigidShellJoint:rig.rigidShellJoint,bodyReference:key+'-sheet.png'}}],tex.png,rig.bones),item),bytes=await compressGLB(packed,{webpQuality:88});if(g.index.count/3>5000||bytes.length>300000)throw Error('Budget failure '+key);
 const file=OUT+'/'+key+'.glb';await writeFile(file,bytes);await writeFile(DIR+'/boss-textures/'+key+'.png',tex.png);records.models[key]={key,file,triangles:g.index.count/3,bytes:bytes.length,sha256:sha(bytes),bones:BOSS_BONES,parents:rig.parent,textureSize:[512,512],materials:1,skinnedMeshes:1,animations:0,hull:hullStats,parts:parts.map(p=>({name:p.name,role:p.role,paint:p.paint,triangles:p.geometry.index.count/3})),textureLayout:tex.tiles,paletteSampleCounts:tex.paletteSampleCounts,rig:rig.notes,visualApproval:'pending',activation:'not enabled'};console.log(key+': '+records.models[key].triangles+' triangles / '+bytes.length+' bytes, '+extras.length+' solid appendages');}
await writeFile(DIR+'/boss-models.json',JSON.stringify(records,null,2)+'\n');
