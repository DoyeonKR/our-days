import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VIDEO_FILTERS,colorPixel,colorStrength,colorFrameSize,hasVideoColor,videoFilter} from "./videoColor.ts";
test("whitelisted tones: original and zero strength are true identity",()=>{
 assert.equal(VIDEO_FILTERS.length,15);assert.equal(new Set(VIDEO_FILTERS.map(f=>f.id)).size,15);
 assert.equal(videoFilter("bogus").id,"original");
 for(const rgb of [[0,0,0],[1,1,1],[.8,.2,.1],[.15,.8,.4]])for(const f of VIDEO_FILTERS){assert.deepEqual(colorPixel(rgb,f.id,0),rgb);const out=colorPixel(rgb,f.id,1);assert.ok(out.every(c=>c>=0&&c<=1));if(f.id==="original")out.forEach((c,i)=>assert.ok(Math.abs(c-rgb[i])<1e-6));}
 assert.equal(colorStrength(NaN),0);assert.equal(colorStrength(Infinity),0);assert.equal(colorStrength(-2),0);assert.equal(colorStrength(2),1);
 assert.equal(hasVideoColor("warm",0),false);assert.equal(hasVideoColor("original",1),false);assert.equal(hasVideoColor("mono",.5),true);
});
test("monochrome has equal channels, warm boosts red, strength interpolates full effect",()=>{
 const rgb=[.7,.35,.2],mono=colorPixel(rgb,"mono",1);assert.ok(Math.max(...mono)-Math.min(...mono)<1e-6);
 const warm=colorPixel(rgb,"warm",1);assert.ok(warm[0]>rgb[0]);
 for(const f of VIDEO_FILTERS){const end=colorPixel(rgb,f.id,1),half=colorPixel(rgb,f.id,.5);half.forEach((c,i)=>assert.ok(Math.abs(c-(rgb[i]+end[i])/2)<1e-6));}
});
test("recorded frames are bounded, even-sized and preserve aspect without stretching",()=>{
 assert.deepEqual(colorFrameSize(1920,1080),{width:960,height:540});assert.deepEqual(colorFrameSize(720,1280),{width:540,height:960});
 assert.deepEqual(colorFrameSize(640,480),{width:640,height:480});assert.deepEqual(colorFrameSize(641,481),{width:642,height:482});
 for(const pair of [[0,1],[-1,4],[Infinity,5],[5,NaN]])assert.throws(()=>colorFrameSize(...pair as [number,number]));
});
test("capture uses processed bitmap stream and fail-closed file export, never a CSS-only promise",()=>{
 const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");const capture=read("../components/LogCapture.tsx"),renderer=read("./videoColorRenderer.ts"),picker=read("../components/VideoFilterPicker.tsx");
 assert.match(capture,/captureColorStream\(canvasRef.current\)/);assert.match(capture,/colorVideoFile\(f,filter,strength,controller.signal,beauty,beautyStyle\)/);
 assert.match(renderer,/canvas.captureStream\(24\)/);assert.match(renderer,/stream\?\.getTracks\(\).forEach\(t=>t.stop\(\)\)/);assert.match(renderer,/URL.revokeObjectURL\(url\)/);
 assert.match(capture,/recordingRef.current=true/);assert.match(capture,/화면을 벗어나 촬영을 취소/);assert.match(picker,/aria-pressed=\{value===f.id\}/);assert.match(picker,/type="range"/);
 assert.match(capture,/setInterval\(render,1000\/24\)/);assert.match(capture,/rec.onstart=/);
 assert.ok(!capture.includes("recordingRef.current = recording"),"stale render effects must not overwrite synchronous recording gates");
 assert.ok(read("../../public/licenses/cssgram.txt").includes("Copyright (c) 2015 Una Kravets"));
});
test("beauty is a separate baked, edge-aware pass; mobile comments are never disclosure-gated",()=>{
 const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
 const capture=read("../components/LogCapture.tsx"),renderer=read("./videoColorRenderer.ts"),thread=read("../components/TodayLog.tsx"),css=read("../app/globals.css");
 assert.match(renderer,/colorStrength\(beauty\)===0/);
 assert.match(renderer,/renderer!\.draw\(video,id,strength,false,beauty,preset\)/);
 assert.match(renderer,/frameTimer=setInterval\(draw,1000\/24\)/);
 assert.match(renderer,/clearInterval\(frameTimer\)/);
 assert.match(capture,/hasVideoColor\(filter,strength\)\|\|beauty>0/);
 assert.match(capture,/toneRef.current.strength,mirrorRef.current,toneRef.current.beauty/);
 assert.match(capture,/viewport.addEventListener\("resize",sync\)/);
 assert.match(capture,/viewport.removeEventListener\("resize",sync\)/);
 assert.doesNotMatch(thread,/if \(cs.length === 0/);
 assert.match(thread,/showInput=\{false\}/);
 assert.match(css,/object-fit: contain/);
});

// 2026-11-06 색감 15가지 [사용자: "좀 더 사람들이 많이 쓰는 필터 적용해줄 수 없어 ? 카메라에"]
test("새 색감 — 옛 6가지 id 는 그대로 · 결마다 실제로 다르다 · 흑백 둘은 채널이 같다 · 바랜 필름은 검정을 들어 올린다",()=>{
 const ids=VIDEO_FILTERS.map(f=>f.id);
 for(const old of ["original","warm","pastel","vintage","mono","cinema"])assert.ok(ids.includes(old as typeof ids[number]),`${old} — 저장된 선택 · 옛 화면이 읽는 id`);
 const probes=[[.9,.7,.6],[.2,.3,.5],[.5,.5,.5],[.05,.05,.08]];
 const sig=(id:string)=>probes.flatMap(p=>colorPixel(p,id as typeof ids[number],1).map(v=>Math.round(v*200))).join(",");
 assert.equal(new Set(VIDEO_FILTERS.filter(f=>f.id!=="noir"&&f.id!=="mono").map(f=>sig(f.id))).size,13,"흑백 둘을 빼면 결이 서로 달라야 한다");
 for(const id of ["mono","noir"] as const){const o=colorPixel([.8,.3,.2],id,1);assert.ok(Math.max(...o)-Math.min(...o)<1e-6,id);}
 assert.ok(colorPixel([0,0,0],"film",1)[0]>.03,"필름은 검정이 떠야 한다(바랜 그림자)");
 assert.ok(colorPixel([.85,.85,.85],"golden",1)[2]<colorPixel([.85,.85,.85],"golden",1)[0],"노을은 밝은 곳이 따뜻하다");
 assert.ok(colorPixel([.2,.2,.2],"cinema",1)[2]>colorPixel([.2,.2,.2],"cinema",1)[0],"시네마는 그림자가 푸르다");
});
test("셰이더도 같은 결 — 바랜 그림자 · 그림자/빛 색 · 가장자리 · 알갱이, 정밀도는 가능하면 highp",()=>{
 const r=readFileSync(new URL("./videoColorRenderer.ts",import.meta.url),"utf8");
 assert.match(r,/uniform vec4 look; uniform vec3 shade; uniform vec3 light;/);
 assert.match(r,/c=look\.x\+c\*\(1\.0-look\.x\)/);
 assert.match(r,/mix\(shade,light,smoothstep\(0\.0,1\.0,m\)\)/);
 assert.match(r,/#ifdef GL_FRAGMENT_PRECISION_HIGH/);
 assert.match(r,/gl\.uniform4f\(lookLocation,k\.fade,k\.vignette,k\.grain,frame\*13\.0\)/);
 const picker=readFileSync(new URL("../components/VideoFilterPicker.tsx",import.meta.url),"utf8"),css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/\.vlog-filter-options \{[^}]*overflow-x: auto;[^}]*touch-action: pan-x;/,"가로 띠는 자기 요소에 pan-x");
 assert.match(picker,/row\.scrollTo\(\{left,behavior:"smooth"\}\)/,"고른 색감을 가로로만 보이게");
});
test("셰이더 원문은 ASCII 만 — GLSL ES 1.0 은 주석 속 한글도 컴파일 오류로 보는 기기가 있다",()=>{
 const r=readFileSync(new URL("./videoColorRenderer.ts",import.meta.url),"utf8");
 for(const name of ["VERTEX","FRAGMENT"]){const a=r.indexOf(`const ${name}=\``)+name.length+8,src=r.slice(a,r.indexOf("`;",a));assert.ok(src.length>50,name);assert.ok(/^[\x00-\x7f]*$/.test(src),`${name} 에 ASCII 밖 글자`);}
});

