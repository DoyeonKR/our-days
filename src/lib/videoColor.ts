// Selected tone formulas adapted from CSSgram (MIT, Una Kravets).
// Inkwell / Reyes inspired only; overlays omitted and app-specific tones added.
// Full attribution: public/licenses/cssgram.txt. Not an exact Instagram simulation.
export const VIDEO_FILTERS = [
  {id:"original",label:"원본",note:"지금 그대로",sepia:0,contrast:1,brightness:1,saturation:1,tint:[1,1,1],css:"none"},
  {id:"warm",label:"따뜻함",note:"포근한 햇살",sepia:.2,contrast:1.03,brightness:1.04,saturation:1.08,tint:[1.04,1,.94],css:"sepia(.2) brightness(1.04) contrast(1.03) saturate(1.08)"},
  {id:"pastel",label:"파스텔",note:"부드러운 하루",sepia:.22,contrast:.85,brightness:1.1,saturation:.75,tint:[1,1,1],css:"sepia(.22) brightness(1.1) contrast(.85) saturate(.75)"},
  {id:"vintage",label:"빈티지",note:"오래된 필름",sepia:.4,contrast:.9,brightness:1.03,saturation:.8,tint:[1.06,1,.9],css:"sepia(.4) brightness(1.03) contrast(.9) saturate(.8)"},
  {id:"mono",label:"흑백",note:"빛과 그림자",sepia:.3,contrast:1.1,brightness:1.1,saturation:0,tint:[1,1,1],css:"sepia(.3) brightness(1.1) contrast(1.1) grayscale(1)"},
  {id:"cinema",label:"시네마",note:"영화 같은 순간",sepia:0,contrast:1.16,brightness:.95,saturation:.78,tint:[.96,1.02,1.06],css:"brightness(.95) contrast(1.16) saturate(.78)"},
] as const;
export type VideoFilterId = typeof VIDEO_FILTERS[number]["id"];
export const videoFilter=(id:string)=>VIDEO_FILTERS.find(f=>f.id===id)??VIDEO_FILTERS[0];
export const colorStrength=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export const hasVideoColor=(id:VideoFilterId,strength:number)=>id!=="original"&&colorStrength(strength)>0;
export function colorFrameSize(width:number,height:number) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error("영상 크기를 읽지 못했어요.");
  const scale=Math.min(1,960/Math.max(width,height));
  return {width:Math.max(2,Math.round(width*scale/2)*2),height:Math.max(2,Math.round(height*scale/2)*2)};
}
/** CPU oracle for color math and tiny swatch thumbnails. RGB range 0..1. */
export function colorPixel(rgb:readonly number[],id:VideoFilterId,strength:number):number[] {
  const f=videoFilter(id),s=colorStrength(strength),[r,g,b]=rgb;
  const sep=[r*.393+g*.769+b*.189,r*.349+g*.686+b*.168,r*.272+g*.534+b*.131];
  const c=rgb.map((v,i)=>(((v*(1-f.sepia)+sep[i]*f.sepia)*f.brightness-.5)*f.contrast+.5)*f.tint[i]);
  const l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  return c.map((v,i)=>rgb[i]*(1-s)+Math.max(0,Math.min(1,l+(v-l)*f.saturation))*s);
}
