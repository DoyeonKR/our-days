// 안쪽을 보는 모델 뒤집기 — 2026-11-19 [사용자: "귀신고래는 계속 몸이 투명하게 보이고있어"]
// 고래 · 물범류 · 톱상어 · 새우를 지은 관(tube) 빌더가 삼각형을 안쪽으로 감고 법선도 안쪽으로 냈다. 양면 재질이라 빛은 멀쩡했지만,
// 가려진 물고기 윤곽(post.ts xray — 깊이만 그리는 앞면 재질)은 가까운 껍질을 뒷면으로 버리고 먼 껍질을 그려 몸 전체를
// '뒤에 숨은 물고기'로 보고 옅게 칠했다(몸이 두꺼울수록 — 귀신고래). 삼각형 감기와 법선을 함께 뒤집는다.
// node design/aqua3d-review/flip-inward.mjs <glb...>
import {readFile,writeFile} from 'node:fs/promises';import {parseGLB,expandGLB,compressGLB} from './glb-compress.mjs';
function writeGLB(json,bin){const s=Buffer.from(JSON.stringify(json)),jp=Buffer.concat([s,Buffer.alloc((4-s.length%4)%4,32)]),bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),out=Buffer.alloc(28+jp.length+bp.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jp.length,12);out.writeUInt32LE(0x4e4f534a,16);jp.copy(out,20);out.writeUInt32LE(bp.length,20+jp.length);out.writeUInt32LE(0x004e4942,24+jp.length);bp.copy(out,28+jp.length);return out;}
const view=(json,bin,a,n)=>{const A=json.accessors[a],v=json.bufferViews[A.bufferView];const C=A.componentType===5126?Float32Array:A.componentType===5125?Uint32Array:A.componentType===5123?Uint16Array:Uint8Array;return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(A.byteOffset||0),A.count*n);};
export async function flip(file){const {json,bin:b0}=parseGLB(await expandGLB(await readFile(file))),bin=Buffer.from(b0),doneI=new Set(),doneN=new Set();
 for(const m of json.meshes)for(const p of m.primitives){if(!doneI.has(p.indices)){doneI.add(p.indices);const I=view(json,bin,p.indices,1);for(let t=0;t<I.length;t+=3){const x=I[t+1];I[t+1]=I[t+2];I[t+2]=x;}}
  const na=p.attributes.NORMAL;if(na!==undefined&&!doneN.has(na)){doneN.add(na);const N=view(json,bin,na,3);for(let k=0;k<N.length;k++)N[k]=-N[k];const A=json.accessors[na];if(A.min&&A.max){const mn=A.max.map(v=>-v),mx=A.min.map(v=>-v);A.min=mn;A.max=mx;}}}
 await writeFile(file,await compressGLB(writeGLB(json,bin),{webpQuality:95}));}
if(process.argv[1].endsWith('flip-inward.mjs'))for(const f of process.argv.slice(2)){await flip(f);console.log('flipped',f);}
