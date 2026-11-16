import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openedCore,clamp} from './remodel-hull.mjs';
function bodyBox(view){const s=openedCore(view,.65);let top=256,bottom=-1;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(s.mask[y*256+x]){top=Math.min(top,y);bottom=Math.max(bottom,y);}return{center:2*(top+bottom),height:4*(bottom-top+1)};}
// A spread arm fan can dominate total silhouette height. Calibrate the body
// cross-section, not that fan, to the side-view body. X/Z registration stays
// unchanged and the original generated reference is never modified.
export async function calibrateFront(key,records,alphaBounds){
 const source={};for(const view of ['side','front']){const r=await sharp(records[view].file).ensureAlpha().raw().toBuffer({resolveWithObject:true});source[view]={...r,width:r.info.width,height:r.info.height};}
 const side=bodyBox(source.side),front=bodyBox(source.front),scaleY=clamp(side.height/front.height,.25,1.8),record=records.front,b=record.bounds,height=Math.max(1,Math.round(b.height*scaleY)),desiredTop=Math.round(side.center-(front.center-b.top)*scaleY),top=clamp(desiredTop,102,Math.max(102,922-height)),width=b.width,left=b.left;
 if(height>820)return{applied:false,reason:'Calibrated silhouette exceeds 10% margin'};
 const image=await sharp(record.file).extract({left:b.left,top:b.top,width:b.width,height:b.height}).resize(width,height,{fit:'fill'}).extend({left,right:1024-width-left,top,bottom:1024-height-top,background:'#00000000'}).png().toBuffer();await writeFile(record.file,image);const r=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});record.bounds=alphaBounds(r.data,r.info.width,r.info.height);record.sha256=createHash('sha256').update(image).digest('hex');record.scale[1]*=scaleY;return{applied:true,scaleY,sideCore:side,frontCore:front,desiredTop,registeredTop:top,method:'opened torso Y extent / shared torso center; spread-arm height excluded'};
}
