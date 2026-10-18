import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nextPokeVariant} from "./pokechoices.ts";
const choice={kind:"love",label:"사랑해",emoji:"❤️",message:"하나",variants:["둘","셋","둘",""]};
test("다른 문구는 직전 표현·중복·빈 후보를 제외하고 RNG 경계를 안전하게 처리한다",()=>{
  assert.equal(nextPokeVariant(choice,"하나",()=>0),"둘");
  assert.equal(nextPokeVariant(choice,"하나",()=>1),"셋");
  assert.equal(nextPokeVariant(choice,"하나",()=>NaN),"둘");
  assert.equal(nextPokeVariant(choice,"하나",()=>-1),"둘");
  assert.equal(nextPokeVariant({...choice,variants:[]},"하나"),"하나");
  assert.deepEqual(choice.variants,["둘","셋","둘",""]);
});
test("미리보기 선택·셔플은 전송하지 않고, 별도 보내기만 실제 저장을 요청한다",()=>{
  const quick=readFileSync(new URL("../components/PokeQuickSend.tsx",import.meta.url),"utf8");
  const select=quick.slice(quick.indexOf("function choose("),quick.indexOf("async function send("));
  assert.ok(!select.includes("onSend("));
  assert.match(quick,/aria-pressed=\{selected.kind===p.kind\}/);
  assert.match(quick,/aria-expanded=\{expanded\}/);
  assert.match(quick,/if\(!selected\|\|busy\|\|sending.current/);
});
test("직접 작성은 한글 조합 Enter·중복 전송을 막고 빠른 문구 전송과 초안을 분리한다",()=>{
  const ui=readFileSync(new URL("../components/CoupleSync.tsx",import.meta.url),"utf8");
  assert.match(ui,/!e.nativeEvent.isComposing && e.keyCode !== 229/);
  assert.match(ui,/busy \|\| pokeSendLock.current/);
  assert.match(ui,/if \(kind === "custom"\) setCustomMsg\(""\)/);
});
test("모바일 선택 그리드는 가로 스크롤이 없고 입력 폭·큰 글씨·포커스를 보장한다",()=>{
  const css=readFileSync(new URL("../components/Poke.module.css",import.meta.url),"utf8");
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/min-height:46px/);
  assert.match(css,/min-width:0; width:0/);
  assert.match(css,/font:400 16px/);
  assert.match(css,/:focus-visible/);
});
