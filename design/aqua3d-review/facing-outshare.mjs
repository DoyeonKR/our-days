import {readFile} from 'node:fs/promises';import {parseGLB,expandGLB} from './glb-compress.mjs';
const acc=(json,bin,a,n)=>{const A=json.accessors[a],v=json.bufferViews[A.bufferView];const C=A.componentType===5126?Float32Array:Uint16Array;return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(A.byteOffset||0),A.count*n);};
// 몸통 축(x 조각마다 y·z 가운데)에서 바깥을 향하는 법선의 몫
export async function outShare(f){const {json,bin}=parseGLB(await expandGLB(await readFile(f)));let o=0,i=0;
 for(const m of json.meshes)for(const p of m.primitives){const P=acc(json,bin,p.attributes.POSITION,3),N=acc(json,bin,p.attributes.NORMAL,3),n=P.length/3;let x0=1e9,x1=-1e9;for(let k=0;k<n;k++){x0=Math.min(x0,P[k*3]);x1=Math.max(x1,P[k*3]);}
  const B=40,sy=new Float64Array(B),sz=new Float64Array(B),c=new Float64Array(B),bi=x=>Math.min(B-1,Math.floor((x-x0)/(x1-x0+1e-9)*B));for(let k=0;k<n;k++){const b=bi(P[k*3]);sy[b]+=P[k*3+1];sz[b]+=P[k*3+2];c[b]++;}
  for(let k=0;k<n;k++){const b=bi(P[k*3]),dy=P[k*3+1]-sy[b]/c[b],dz=P[k*3+2]-sz[b]/c[b];const d=N[k*3+1]*dy+N[k*3+2]*dz;if(Math.hypot(dy,dz)<1e-4)continue;if(d>0)o++;else i++;}}
 return o/(o+i);}
if(process.argv[1].endsWith('facing-outshare.mjs'))for(const f of process.argv.slice(2))console.log(f.split('/').pop(),(await outShare(f)).toFixed(2));
