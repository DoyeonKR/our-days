// 몸 모양 고치기 — 2026-11-19 [사용자: "귀상어는 달라도 너무 많이 다르고 개복치는 정면에서 보았을때 너무 얇아"]
// GLB 를 펼쳐 바인드 자세의 꼭짓점만 옮긴다(뼈 · 가중치 · 텍스처 · uv 는 그대로). 법선은 같은 늘림의 역으로 고친다(n' ∝ n / 늘림).
//  · 개복치(sunfish · 새끼 · 어린) — 몸 원판 한가운데가 몸 높이의 13% 두께였다(실제 개복치는 정면에서 몸 높이의 3분의 1 남짓).
//    몸 타원(지느러미 빼고) 안쪽일수록 z 를 최대 2.6배 — 등 · 뒷지느러미와 키지느러미(꼬리)는 그대로 얇다.
//  · 귀상어(hammerhead · 새끼 · 어린) — 머리 날개(망치)가 앞뒤 폭 몸길이의 4% 인 얇은 판이었다. 날개 쪽 꼭짓점의 앞뒤 폭을 2.4배로,
//    끝으로 갈수록 조금 뒤로 젖힌다(위에서 보면 T 자 · 끝에 눈). 수조에선 위에서 본 몸 다듬기(topview)를 끈다(glb.ts NOT_FUSIFORM) — 망치를 몸통 방추형으로 깎아 버렸다.
// node design/aqua3d-review/reshape-body.mjs sunfish|hammerhead
import {readFile,writeFile} from 'node:fs/promises';import {parseGLB,expandGLB,compressGLB} from './glb-compress.mjs';
function writeGLB(json,bin){const s=Buffer.from(JSON.stringify(json)),jp=Buffer.concat([s,Buffer.alloc((4-s.length%4)%4,32)]),bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),out=Buffer.alloc(28+jp.length+bp.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jp.length,12);out.writeUInt32LE(0x4e4f534a,16);jp.copy(out,20);out.writeUInt32LE(bp.length,20+jp.length);out.writeUInt32LE(0x004e4942,24+jp.length);bp.copy(out,28+jp.length);return out;}
const view=(json,bin,a)=>{const A=json.accessors[a],v=json.bufferViews[A.bufferView];return new Float32Array(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(A.byteOffset||0),A.count*3);};
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
// 모양마다: (x,y,z, 상자) → [x',y',z', 늘림(sx,sy,sz)]
const SHAPES={
 sunfish(x,y,z,b){const L=b.max[0]-b.min[0],cx=b.min[0]+L*.52,cy=(b.min[1]+b.max[1])*.5-L*.03,rx=L*.44,ry=L*.31;
  const d=Math.hypot((x-cx)/rx,(y-cy)/ry),k=1+1.6*(1-ss(.35,1.05,d));return [x,y,z*k,[1,1,k]];},
 hammerhead(x,y,z,b){const L=b.max[0]-b.min[0],front=b.max[0],w=Math.abs(z)/L;
  // 날개 = 머리 앞 12% 안에서 몸통(반폭 4.5%) 밖으로 나간 꼭짓점
  const head=ss(front-L*.14,front-L*.09,x),wing=ss(.055,.075,w)*head;if(wing<=0)return [x,y,z,[1,1,1]];
  const back=(front-x)*1.4*wing+L*.05*ss(.06,.17,w)*wing;return [x-back,y,z,[1+1.4*wing,1,1]];},
};
export async function reshape(file,shape){const {json,bin:b0}=parseGLB(await expandGLB(await readFile(file))),bin=Buffer.from(b0),fn=SHAPES[shape];
 for(const m of json.meshes)for(const p of m.primitives){const A=json.accessors[p.attributes.POSITION],P=view(json,bin,p.attributes.POSITION),N=p.attributes.NORMAL!==undefined?view(json,bin,p.attributes.NORMAL):null,b={min:[...A.min],max:[...A.max]};
  for(let i=0;i<A.count;i++){const [x,y,z,s]=fn(P[i*3],P[i*3+1],P[i*3+2],b);P[i*3]=x;P[i*3+1]=y;P[i*3+2]=z;
   if(N){let nx=N[i*3]/s[0],ny=N[i*3+1]/s[1],nz=N[i*3+2]/s[2];const l=Math.hypot(nx,ny,nz)||1;N[i*3]=nx/l;N[i*3+1]=ny/l;N[i*3+2]=nz/l;}}
  A.min=[1e9,1e9,1e9];A.max=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i++){A.min[i%3]=Math.min(A.min[i%3],P[i]);A.max[i%3]=Math.max(A.max[i%3],P[i]);}}
 await writeFile(file,await compressGLB(writeGLB(json,bin),{webpQuality:95}));}
if(process.argv[1].endsWith('reshape-body.mjs'))for(const shape of process.argv.slice(2))for(const pre of ['','fry_','juv_']){const f=`public/aqua/models/fish/${pre}${shape}.glb`;await reshape(f,shape);console.log('reshaped',f);}
