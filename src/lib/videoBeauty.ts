export const BEAUTY_PRESETS = [
  {id:"natural",label:"내추럴",note:"피부결은 살짝, 원래 느낌은 그대로",smoothing:1,exposure:.01,detail:.08,glow:0},
  {id:"smooth",label:"매끈 피부",note:"잔결을 더 부드럽게 정돈",smoothing:1.4,exposure:.015,detail:.02,glow:.02},
  {id:"clear",label:"또렷하게",note:"윤곽과 디테일을 선명하게",smoothing:.65,exposure:.01,detail:.5,glow:0},
  {id:"bright",label:"화사하게",note:"어두운 중간톤을 밝고 깨끗하게",smoothing:.8,exposure:.1,detail:.12,glow:0},
  {id:"soft",label:"소프트 글로우",note:"부드러운 결에 은은한 빛을 더해",smoothing:1.1,exposure:.025,detail:0,glow:.18},
  {id:"night",label:"저조도 보정",note:"어두운 장면의 밝기와 잔결 균형",smoothing:1.2,exposure:.18,detail:.06,glow:0},
  {id:"portrait",label:"균형 보정",note:"피부결·밝기·선명도를 고르게",smoothing:1.05,exposure:.035,detail:.28,glow:.04},
] as const;
export type BeautyPresetId = typeof BEAUTY_PRESETS[number]["id"];
export const beautyPreset=(id:string)=>BEAUTY_PRESETS.find(p=>p.id===id)??BEAUTY_PRESETS[0];

/** Numeric oracle for the shader's post-smoothing pass. All effects fade to identity. */
export function beautyPixel(raw:readonly number[],smooth:readonly number[],id:string,amount:number):number[] {
  const p=beautyPreset(id),a=Number.isFinite(amount)?Math.max(0,Math.min(1,amount)):0;
  return raw.map((v,i)=>{
    const base=v+(smooth[i]-v)*Math.min(1,a*p.smoothing*.85)+(v-smooth[i])*p.detail*a;
    const lit=Math.max(0,Math.min(1,base+p.exposure*a*(1-base)));
    return lit+(Math.sqrt(lit)-lit)*p.glow*a;
  });
}
