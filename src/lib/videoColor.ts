// Selected tone formulas adapted from CSSgram (MIT, Una Kravets).
// Inkwell / Reyes inspired only; overlays omitted and app-specific tones added.
// Full attribution: public/licenses/cssgram.txt. Not an exact Instagram simulation.
/* 2026-11-06 [사용자: "좀 더 사람들이 많이 쓰는 필터 적용해줄 수 없어 ? 카메라에"] — 카메라 앱에서 흔한 색감 결을 더했다.
 * 이름 · 수치는 우리 것이다(특정 앱 필터의 복제가 아니다). 새 칸은 전부 선택값이고 없으면 아무것도 안 한다:
 *   fade    — 검정을 들어 올린다(필름의 바랜 그림자). c = fade + c·(1 − fade)
 *   shade   — 어두운 곳에 곱하는 색(밝기로 섞는다) · light — 밝은 곳에 곱하는 색(그림자 · 빛 색 나누기)
 *   vignette — 가장자리를 어둡게(0~0.4) · grain — 필름 알갱이(0~0.08, 프레임마다 바뀐다)
 * vignette · grain 은 자리에 따라 다른 효과라 CPU 계산(colorPixel · 미리보기 칸)에는 없다 — 셰이더만. */
type Look = { id: string; label: string; note: string; sepia: number; contrast: number; brightness: number; saturation: number; tint: readonly [number, number, number];
  fade?: number; shade?: readonly [number, number, number]; light?: readonly [number, number, number]; vignette?: number; grain?: number };
export const VIDEO_FILTERS = [
  {id:"original",label:"원본",note:"지금 그대로",sepia:0,contrast:1,brightness:1,saturation:1,tint:[1,1,1]},
  {id:"film",label:"필름",note:"필름 카메라 감성",sepia:.08,contrast:.96,brightness:1.02,saturation:.92,tint:[1.03,1,.95],fade:.06,shade:[.96,1,1.04],light:[1.05,1,.92],vignette:.18,grain:.05},
  {id:"clear",label:"청량",note:"맑은 여름 하늘",sepia:0,contrast:1.05,brightness:1.07,saturation:1.15,tint:[.95,1.01,1.07],shade:[.97,1,1.05],light:[1,1,1.02]},
  {id:"peach",label:"복숭아",note:"발그레한 볼",sepia:.1,contrast:.95,brightness:1.06,saturation:.95,tint:[1.06,.99,.97],fade:.04,shade:[1.03,.98,1],light:[1.04,1,.98]},
  {id:"vivid",label:"선명",note:"또렷한 색",sepia:0,contrast:1.12,brightness:1.02,saturation:1.3,tint:[1,1,1]},
  {id:"soft",label:"몽글",note:"포근한 빛",sepia:.05,contrast:.82,brightness:1.12,saturation:.9,tint:[1.02,1,1.01],fade:.1},
  {id:"golden",label:"노을",note:"해 질 녘 금빛",sepia:.15,contrast:1.06,brightness:1.02,saturation:1.12,tint:[1.1,1,.84],shade:[1,.96,.96],light:[1.08,1,.85],vignette:.2},
  {id:"warm",label:"따뜻함",note:"포근한 햇살",sepia:.2,contrast:1.03,brightness:1.04,saturation:1.08,tint:[1.04,1,.94]},
  {id:"pastel",label:"파스텔",note:"부드러운 하루",sepia:.22,contrast:.85,brightness:1.1,saturation:.75,tint:[1,1,1]},
  {id:"retro",label:"레트로",note:"90년대 캠코더",sepia:.12,contrast:.92,brightness:1,saturation:.85,tint:[1.02,1.02,.92],fade:.08,shade:[.92,1.04,1.02],light:[1.06,1.03,.88],vignette:.22,grain:.06},
  {id:"vintage",label:"빈티지",note:"오래된 필름",sepia:.4,contrast:.9,brightness:1.03,saturation:.8,tint:[1.06,1,.9],fade:.05,vignette:.15},
  {id:"cinema",label:"시네마",note:"영화 같은 순간",sepia:0,contrast:1.16,brightness:.95,saturation:.78,tint:[.96,1.02,1.06],shade:[.92,1,1.08],light:[1.06,1,.92],vignette:.25},
  {id:"mood",label:"무드",note:"차분한 밤",sepia:0,contrast:1.05,brightness:.92,saturation:.7,tint:[.97,1,1.03],fade:.05,shade:[.95,.98,1.06],vignette:.3},
  {id:"mono",label:"흑백",note:"빛과 그림자",sepia:.3,contrast:1.1,brightness:1.1,saturation:0,tint:[1,1,1]},
  {id:"noir",label:"느와르",note:"진한 흑백 필름",sepia:0,contrast:1.3,brightness:1.02,saturation:0,tint:[1,1,1],vignette:.3,grain:.07},
] as const satisfies readonly Look[];
export type VideoFilterId = typeof VIDEO_FILTERS[number]["id"];
export const videoFilter=(id:string):Look=>VIDEO_FILTERS.find(f=>f.id===id)??VIDEO_FILTERS[0];
export const colorStrength=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export const hasVideoColor=(id:VideoFilterId,strength:number)=>id!=="original"&&colorStrength(strength)>0;
export function colorFrameSize(width:number,height:number) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error("영상 크기를 읽지 못했어요.");
  const scale=Math.min(1,960/Math.max(width,height));
  return {width:Math.max(2,Math.round(width*scale/2)*2),height:Math.max(2,Math.round(height*scale/2)*2)};
}
/** 저장 영상은 언제나 3:4 — 카메라가 정사각 · 4:3 · 16:9 무엇을 주든 가운데를 3:4 로 잘라 굽는다.
 *  예전엔 ideal 640×640 요청에 기기마다 정사각이나 4:3 이 와서, 같은 3:4 칸(contain)에 넣으면 한 사람은
 *  위아래 · 다른 사람은 좌우에 검은 띠가 생겨 두 칸이 서로 다른 모양으로 보였다.
 *  crop 은 원본 텍스처 좌표(0~1)의 [왼쪽, 아래, 폭, 높이]. 출력은 최대 720×960 · 4의 배수 높이 · 짝수 폭. */
export const LOG_FRAME_W = 720, LOG_FRAME_H = 960;
export function cropFrame34(width:number,height:number):{width:number;height:number;crop:[number,number,number,number]} {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error("영상 크기를 읽지 못했어요.");
  const target=LOG_FRAME_W/LOG_FRAME_H,aspect=width/height;
  let sw=1,sh=1;
  if(aspect>target)sw=target/aspect;else sh=aspect/target;
  const outH=Math.max(4,Math.round(Math.min(LOG_FRAME_H,height*sh)/4)*4);
  const outW=Math.max(2,Math.round(outH*target/2)*2);
  return {width:outW,height:outH,crop:[(1-sw)/2,(1-sh)/2,sw,sh]};
}
/** CPU oracle for color math and tiny swatch thumbnails. RGB range 0..1. */
export function colorPixel(rgb:readonly number[],id:VideoFilterId,strength:number):number[] {
  const f=videoFilter(id),s=colorStrength(strength),[r,g,b]=rgb;
  const sep=[r*.393+g*.769+b*.189,r*.349+g*.686+b*.168,r*.272+g*.534+b*.131];
  const c=rgb.map((v,i)=>(((v*(1-f.sepia)+sep[i]*f.sepia)*f.brightness-.5)*f.contrast+.5)*f.tint[i]);
  const l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const sat=c.map(v=>Math.max(0,Math.min(1,l+(v-l)*f.saturation)));
  const k=filterLook(f),lifted=sat.map(v=>k.fade+v*(1-k.fade));
  const m=lifted[0]*.2126+lifted[1]*.7152+lifted[2]*.0722,t=m*m*(3-2*m);
  const toned=lifted.map((v,i)=>Math.max(0,Math.min(1,v*(k.shade[i]+(k.light[i]-k.shade[i])*t))));
  return toned.map((v,i)=>rgb[i]*(1-s)+v*s);
}
/** 새 칸의 기본값을 채운 결 — 셰이더 · CPU 계산이 같은 값을 쓴다 */
export function filterLook(f:Look):{fade:number;shade:readonly [number,number,number];light:readonly [number,number,number];vignette:number;grain:number} {
  return {fade:f.fade??0,shade:f.shade??[1,1,1],light:f.light??[1,1,1],vignette:f.vignette??0,grain:f.grain??0};
}
