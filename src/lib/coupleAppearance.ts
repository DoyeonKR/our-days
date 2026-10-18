import { DEFAULT_HOME_APPEARANCE, normalizeHomeAppearance, type HomeAppearance } from "./homePersonalization.ts";
import type { ThemeId } from "./theme.ts";

export type SharedAppearance = { home:HomeAppearance; theme:ThemeId; pixelArt:boolean };
export type AppearanceRecord = { settings:SharedAppearance; version:number };
export const DEFAULT_SHARED_APPEARANCE:SharedAppearance={home:DEFAULT_HOME_APPEARANCE,theme:"rose",pixelArt:true};
export function normalizeSharedAppearance(value:unknown):SharedAppearance {
  const p=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const theme=["rose","coral","purple","blue","mint","lime"].includes(String(p.theme))?p.theme as ThemeId:"rose";
  return {home:normalizeHomeAppearance(p.home),theme,pixelArt:typeof p.pixelArt==="boolean"?p.pixelArt:true};
}
export function parseAppearanceRecord(settings:unknown,version:unknown):AppearanceRecord {
  if(!Number.isSafeInteger(version)||Number(version)<0)throw Error("공유 설정 버전을 확인하지 못했어요.");
  return {settings:normalizeSharedAppearance(settings),version:Number(version)};
}
/** Ignore late reads and replayed realtime events after a newer save. */
export function acceptAppearanceRecord(current:AppearanceRecord|null,next:AppearanceRecord):AppearanceRecord {
  return current&&current.version>next.version?current:next;
}
