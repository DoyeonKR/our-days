import {readFile} from 'node:fs/promises';import {parseGLB,expandGLB} from './glb-compress.mjs';
const acc=(json,bin,a,n)=>{const A=json.accessors[a],v=json.bufferViews[A.bufferView];const C=A.componentType===5126?Float32Array:A.componentType===5125?Uint32Array:A.componentType===5123?Uint16Array:Uint8Array;return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(A.byteOffset||0),A.count*n);};
export async function windShare(f){const {json,bin}=parseGLB(await expandGLB(await readFile(f)));let agree=0,dis=0;
 for(const m of json.meshes)for(const p of m.primitives){if(p.attributes.NORMAL===undefined)continue;const P=acc(json,bin,p.attributes.POSITION,3),Nn=acc(json,bin,p.attributes.NORMAL,3),I=acc(json,bin,p.indices,1);
  for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;const u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],w=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]];const nx=u[1]*w[2]-u[2]*w[1],ny=u[2]*w[0]-u[0]*w[2],nz=u[0]*w[1]-u[1]*w[0];const vn=[Nn[a]+Nn[b]+Nn[c],Nn[a+1]+Nn[b+1]+Nn[c+1],Nn[a+2]+Nn[b+2]+Nn[c+2]];const d=nx*vn[0]+ny*vn[1]+nz*vn[2],ar=Math.hypot(nx,ny,nz);if(d>=0)agree+=ar;else dis+=ar;}}
 return agree/(agree+dis);}
if(process.argv[1].endsWith('facing-wind.mjs'))for(const f of process.argv.slice(2))console.log(f.split('/').pop(),(await windShare(f)).toFixed(2));
