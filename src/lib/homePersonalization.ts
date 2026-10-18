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
  greeting:"오늘도, 우리답게.", subtitle:null, story:"OUR STORY, STILL GROWING", dayLabel:"일째",
  font:"clean",align:"left",accent:"ink",showDays:true,showUnread:true,dayFormat:"days",
};
type Store = Pick<Storage,"getItem"|"setItem">;
const choices = <T extends string>(v:unknown, options:readonly T[], fallback:T):T => typeof v === "string" && options.includes(v as T) ? v as T : fallback;
export function homeAppearanceKey(scope:string):string {return `ourdays:home-appearance:v1:${scope}`;}
export function normalizeHomeAppearance(value:unknown):HomeAppearance {
  const p = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const text=(key:keyof typeof HOME_TEXT_LIMITS,fallback:string):string=>typeof p[key] === "string" ? Array.from(p[key].replace(/\s+/g," ").trim()).slice(0,HOME_TEXT_LIMITS[key]).join("") : fallback;
  return {
    greeting:text("greeting",DEFAULT_HOME_APPEARANCE.greeting),
    subtitle:typeof p.subtitle === "string" ? text("subtitle","") : null,
    story:text("story",DEFAULT_HOME_APPEARANCE.story),dayLabel:text("dayLabel",DEFAULT_HOME_APPEARANCE.dayLabel),
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
