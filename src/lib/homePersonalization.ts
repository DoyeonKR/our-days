/** Personal home appearance only. Never changes anniversary dates or unread counts. */
export const HOME_TEXT_LIMITS = { greeting:40, subtitle:80, story:60, dayLabel:12 } as const;
export type HomeAppearance = {
  greeting:string;
  subtitle:string|null;
  story:string;
  dayLabel:string;
  font:"clean"|"pixel"|"serif";
  align:"left"|"center";
  accent:"ink"|"theme"|"partner";
  showDays:boolean;
  showUnread:boolean;
  dayFormat:"days"|"dplus";
};
export const DEFAULT_HOME_APPEARANCE:HomeAppearance = {
  greeting:"오늘도, 우리답게.", subtitle:null, story:"함께 쌓아 가는 중", dayLabel:"일째",
  font:"clean",align:"left",accent:"ink",showDays:true,showUnread:true,dayFormat:"days",
};
const LEGACY_STORY="OUR STORY, STILL GROWING";
type Store = Pick<Storage,"getItem"|"setItem">;
const choices = <T extends string>(v:unknown, options:readonly T[], fallback:T):T => typeof v === "string" && options.includes(v as T) ? v as T : fallback;
export function homeAppearanceKey(scope:string):string {return `ourdays:home-appearance:v1:${scope}`;}
export function normalizeHomeAppearance(value:unknown):HomeAppearance {
  const p = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const text=(key:keyof typeof HOME_TEXT_LIMITS,fallback:string):string=>typeof p[key] === "string" ? Array.from(p[key].replace(/\s+/g," ").trim()).slice(0,HOME_TEXT_LIMITS[key]).join("") : fallback;
  return {
    greeting:text("greeting",DEFAULT_HOME_APPEARANCE.greeting),
    subtitle:typeof p.subtitle === "string" ? text("subtitle","") : null,
    // 옛 기본값(영어 머리말)을 그대로 둔 저장분은 새 기본값으로 읽는다 — 사용자가 고친 문구는 그대로(2026-10-30)
    story:((v)=>v===LEGACY_STORY?DEFAULT_HOME_APPEARANCE.story:v)(text("story",DEFAULT_HOME_APPEARANCE.story)),dayLabel:text("dayLabel",DEFAULT_HOME_APPEARANCE.dayLabel),
    font:choices(p.font,["clean","pixel","serif"],"clean"),align:choices(p.align,["left","center"],"left"),accent:choices(p.accent,["ink","theme","partner"],"ink"),
    showDays:typeof p.showDays === "boolean" ? p.showDays : true,showUnread:typeof p.showUnread === "boolean" ? p.showUnread : true,
    dayFormat:choices(p.dayFormat,["days","dplus"],"days"),
  };
}
export function readHomeAppearance(storage:Store,key:string):HomeAppearance {
  try{return normalizeHomeAppearance(JSON.parse(storage.getItem(key) ?? "null"));}catch{return {...DEFAULT_HOME_APPEARANCE};}
}
export function writeHomeAppearance(storage:Store,key:string,value:HomeAppearance):boolean {
  try{storage.setItem(key,JSON.stringify(normalizeHomeAppearance(value)));return true;}catch{return false;}
}
export function homeSubtitle(p:HomeAppearance,hasPartner:boolean):string {
  return p.subtitle ?? (hasPartner?"둘이 함께 채워가는 작은 일상":"작은 순간부터 차곡차곡 쌓아가요");
}

/** 첫·끝 이모지가 혼자 다음 줄로 떨어지지 않게 옆 글자와 붙인다(U+2060 WORD JOINER).
 *  "🤍도요새와 팽나무🤍" 의 끝 하트가 375·320px 에서 홀로 둘째 줄에 남았다(2026-10-30 UX 점검).
 *  자소 단위(Intl.Segmenter)로 보므로 ZWJ 이모지·피부색 조합을 쪼개지 않는다. */
export function glueEdgeEmoji(text:string):string {
  const Seg=(Intl as unknown as {Segmenter?:new(l?:string,o?:{granularity:"grapheme"})=>{segment(s:string):Iterable<{segment:string}>}}).Segmenter;
  if(!Seg)return text;
  const g=Array.from(new Seg(undefined,{granularity:"grapheme"}).segment(text),(x)=>x.segment);
  if(g.length<2)return text;
  const pic=(s:string)=>/\p{Extended_Pictographic}/u.test(s);
  const solid=(s:string)=>!/^\s$/u.test(s);
  if(pic(g[g.length-1])&&solid(g[g.length-2]))g[g.length-1]="⁠"+g[g.length-1];
  if(pic(g[0])&&solid(g[1]))g[0]=g[0]+"⁠";
  return g.join("");
}
