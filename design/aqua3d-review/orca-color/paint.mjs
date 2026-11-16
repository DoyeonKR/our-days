// User-supplied mesh recolouring only: original vertex/index/normal buffers unchanged.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const INPUT='C:/Users/kdy78/Downloads/orca whale 3d model.glb',DIR='design/aqua3d-review/orca-color';
const src=await readFile(INPUT),jsonLength=src.readUInt32LE(12),j=JSON.parse(src.toString('utf8',20,20+jsonLength)),bin=src.subarray(28+jsonLength,28+jsonLength+src.readUInt32LE(20+jsonLength));
const original=structuredClone(j),clamp=x=>Math.max(0,Math.min(1,x)),smooth=(lo,hi,x)=>{const t=clamp((x-lo)/(hi-lo));return t*t*(3-2*t);},mix=(a,b,t)=>a+(b-a)*t;
function readAcc(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],at=(v.byteOffset??0)+(a.byteOffset??0);if(v.byteStride)throw Error('Unexpected interleaved input');return new C(bin.buffer.slice(bin.byteOffset+at,bin.byteOffset+at+a.count*n*C.BYTES_PER_ELEMENT));}
const prim=j.meshes[0].primitives[0],P=readAcc(prim.attributes.POSITION),N=readAcc(prim.attributes.NORMAL),colors=new Float32Array(P.length),counts={white:0,saddle:0,black:0,eyes:0};
const line=[[-.50,.135],[-.40,.107],[-.33,.101],[-.24,.096],[-.10,.103],[.05,.116],[.16,.132],[.27,.156],[.36,.179],[.46,.187],[.51,.188]];
function belly(x){let i=0;while(i<line.length-2&&line[i+1][0]<x)i++;const[a,y]=line[i],[b,z]=line[i+1];return mix(y,z,clamp((x-a)/(b-a)));}
const toLinear=c=>{c=clamp(c/255);return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
for(let i=0;i<P.length;i+=3){const x=P[i],y=P[i+1],z=P[i+2],az=Math.abs(z),ny=N[i+1],grain=(Math.sin(x*843+y*721+z*637)*Math.sin(z*957-x*411))*1.1,black=[11+grain,16+grain,21+grain],white=[230+grain,231+grain,224+grain];let color=black;
 // Continuous bilateral ventral pattern; upper boundary includes the rising flank patch.
 const q=(x+.165)/.108,flank=.102+.064*Math.pow(Math.max(0,1-q*q),.7),boundary=Math.max(belly(x),flank),ventral=1-smooth(boundary-.0018,boundary+.0018,y);
 const flipper=smooth(.042,.073,az)*(1-smooth(.133,.153,y))*smooth(.09,.13,x)*(1-smooth(.31,.35,x)),fluke=(1-smooth(-.36,-.33,x))*smooth(.032,.060,az),ventralMask=ventral*(1-flipper)*(1-fluke);
 color=color.map((c,k)=>mix(c,white[k],ventralMask));
 // Natural grey saddle behind the dorsal fin, wrapping over the back but not painting the fin.
 const saddleX=x+.100+.35*(y-.245),saddleQ=Math.pow(saddleX/.072,2)+Math.pow((y-.245)/.045,2),saddle=(1-smooth(.72,1.1,saddleQ))*smooth(.195,.216,y)*(1-smooth(.286,.303,y));
 color=color.map((c,k)=>mix(c,[87+grain,94+grain,97+grain][k],saddle*.86));
 // Eye patches live on the two flanks, not on the dorsal face; true eye lies forward/below.
 const ex=(x-.335),ey=(y-.221)+ex*.10,eq=Math.pow(ex/.049,2)+Math.pow(ey/.0185,2),eyePatch=(1-smooth(.88,1.08,eq))*smooth(.033,.052,az);
 color=color.map((c,k)=>mix(c,white[k],eyePatch));
 const pupil=Math.pow((x-.418)/.0060,2)+Math.pow((y-.208)/.0048,2),rim=(1-smooth(.85,1.28,pupil))*smooth(.030,.045,az);
 color=color.map((c,k)=>mix(c,[40,45,46][k],rim));const dark=(1-smooth(.55,.85,pupil))*smooth(.03,.045,az);color=color.map(c=>mix(c,4,dark));
 // Preserve a closed-mouth seam as a subtle dark lip, without changing any geometry.
 const mouthY=.181+.052*(x-.35),lip=Math.exp(-Math.pow((y-mouthY)/.0017,2))*smooth(.35,.40,x)*(1-smooth(.495,.505,x))*smooth(.018,.042,az);color=color.map(c=>mix(c,9,lip*.82));
 if(eyePatch>.5||ventralMask>.5)counts.white++;else if(saddle>.5)counts.saddle++;else counts.black++;if(dark>.5)counts.eyes++;
 colors.set(color.map(toLinear),i);
}
const pad=(4-bin.length%4)%4,colorOffset=bin.length+pad,colorBytes=Buffer.from(colors.buffer),nextBin=Buffer.concat([bin,Buffer.alloc(pad),colorBytes]);
j.bufferViews.push({buffer:0,byteOffset:colorOffset,byteLength:colorBytes.length,target:34962});j.accessors.push({bufferView:j.bufferViews.length-1,componentType:5126,count:P.length/3,type:'VEC3'});prim.attributes.COLOR_0=j.accessors.length-1;j.buffers[0].byteLength=nextBin.length;
j.materials=[{name:'Orca natural black white skin',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.66}}];prim.material=0;
function pack(json,bin){const raw=Buffer.from(JSON.stringify(json)),text=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),out=Buffer.alloc(28+text.length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);out.writeUInt32LE(bin.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);bin.copy(out,28+text.length);return out;}
const output=pack(j,nextBin),sha=b=>createHash('sha256').update(b).digest('hex');
for(const index of Object.values(original.meshes[0].primitives[0].attributes).concat(original.meshes[0].primitives[0].indices)){const a=original.accessors[index],v=original.bufferViews[a.bufferView];assert.ok(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength).equals(nextBin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)));}
await mkdir(DIR,{recursive:true});await writeFile(DIR+'/source.glb',src);await writeFile(DIR+'/orca-colored.glb',output);
let download='C:/Users/kdy78/Downloads/orca whale 3d model-colored.glb';for(let version=2;;version++){try{await access(download);if(sha(await readFile(download))===sha(output))break;download=`C:/Users/kdy78/Downloads/orca whale 3d model-colored-v${version}.glb`;}catch(e){if(e.code!=='ENOENT')throw e;break;}}await writeFile(download,output);
const validator=createRequire(path.join(tmpdir(),'our-days-glb-validator','package.json'))('gltf-validator'),before=await validator.validateBytes(new Uint8Array(src),{maxIssues:1000}),after=await validator.validateBytes(new Uint8Array(output),{maxIssues:1000});assert.equal(after.issues.numErrors,0,JSON.stringify(after.issues.messages.filter(m=>m.severity===0)));
const report={source:INPUT,output:download,sourceSHA256:sha(src),sha256:sha(output),vertices:P.length/3,triangles:original.accessors[original.meshes[0].primitives[0].indices].count/3,sourceBytes:src.length,bytes:output.length,paintMethod:'Linear RGB COLOR_0 vertex paint; standard PBR material, no external textures or UV dependence.',sourceGeometryBuffersUnchanged:true,sourceNodeTransformsUnchanged:true,skins:original.skins?.length??0,animations:original.animations?.length??0,validation:{sourceErrors:before.issues.numErrors,outputErrors:after.issues.numErrors,warnings:after.issues.numWarnings,messages:after.issues.messages},counts,visualApproval:'pending',gameActivation:'not enabled'};
await writeFile(DIR+'/validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
