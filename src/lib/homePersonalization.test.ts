import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_HOME_APPEARANCE, homeAppearanceKey, homeSubtitle, normalizeHomeAppearance, readHomeAppearance, writeHomeAppearance } from "./homePersonalization.ts";

test("home hero has no upper-left scenery caption covering the artwork",()=>{
  const world=readFileSync(new URL("../components/HomeWorld.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.doesNotMatch(world,/home-scene-caption|OUR LITTLE WORLD|둘만의 작은 세계/);
  assert.doesNotMatch(css,/\.home-scene-caption/);
});

test("appearance defaults retain dynamic solo/couple subtitles; empty strings deliberately hide copy",()=>{
  const defaults=normalizeHomeAppearance(null);
  assert.deepEqual(defaults,DEFAULT_HOME_APPEARANCE);
  assert.match(homeSubtitle(defaults,true),/둘이 함께/);
  assert.match(homeSubtitle(defaults,false),/작은 순간/);
  const hidden=normalizeHomeAppearance({greeting:"",subtitle:"",story:"",dayLabel:""});
  assert.equal(homeSubtitle(hidden,true),"");assert.equal(hidden.greeting,"");assert.equal(hidden.story,"");
});
test("stored appearance is whitelisted, bounded, Unicode safe and has no numeric overrides",()=>{
  const result=normalizeHomeAppearance({greeting:" 🌻".repeat(80),subtitle:"  함께\n  걷자  ",font:"url(evil)",accent:"red",align:"right",showDays:"false",showUnread:false,dayFormat:"dplus",nDays:999,inboxUnread:0});
  assert.ok(Array.from(result.greeting).length<=40);
  assert.ok(!/[\uD800-\uDBFF]$/.test(result.greeting));
  assert.equal(result.subtitle,"함께 걷자");assert.equal(result.font,"clean");assert.equal(result.accent,"ink");assert.equal(result.align,"left");
  assert.equal(result.showDays,true);assert.equal(result.showUnread,false);assert.equal(result.dayFormat,"dplus");
  assert.ok(!("nDays" in result));assert.ok(!("inboxUnread" in result));
});
test("appearance saves/reloads within only its account/couple scope and reports quota failures",()=>{
  const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  const a=homeAppearanceKey("a:couple"),b=homeAppearanceKey("b:couple");
  const value=normalizeHomeAppearance({greeting:"매일 너와",font:"pixel",align:"center"});
  assert.equal(writeHomeAppearance(storage,a,value),true);
  assert.deepEqual(readHomeAppearance(storage,a),value);assert.deepEqual(readHomeAppearance(storage,b),DEFAULT_HOME_APPEARANCE);
  storage.setItem(a,"not json");assert.deepEqual(readHomeAppearance(storage,a),DEFAULT_HOME_APPEARANCE);
  const blocked={getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("quota");}};
  assert.deepEqual(readHomeAppearance(blocked,a),DEFAULT_HOME_APPEARANCE);assert.equal(writeHomeAppearance(blocked,a,value),false);
});
test("home personalization is explicitly editable, scoped and preserves real computed counters",()=>{
  const read=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
  const home=read("../components/HomeExperience.tsx"),editor=read("../components/HomeAppearanceEditor.tsx"),page=read("../app/page.tsx");
  assert.match(home,/문구 꾸미기/);assert.match(home,/key=\{key\}/);assert.match(home,/nDays.toLocaleString\(\)/);assert.match(home,/appearance.showUnread && inboxUnread > 0/);
  assert.match(page,/personalizationScope=\{`\$\{myUserId/);
  assert.match(editor,/useDialogFocus\(true,close\)/);assert.match(editor,/상대방과 다른 기기에도 적용돼요/);assert.match(editor,/role="alert"/);
  assert.match(home,/shared.save\(\{home:normalizeHomeAppearance\(next\)\},editVersion.current\)/);
  assert.match(page,/<SharedAppearanceProvider coupleId=\{coupleId\}/);
  assert.ok(!home.includes("dangerouslySetInnerHTML"));
});
