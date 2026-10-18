import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VIDEO_FILTERS,colorPixel,colorStrength,colorFrameSize,hasVideoColor,videoFilter} from "./videoColor.ts";
test("six whitelisted tones: original and zero strength are true identity",()=>{
 assert.equal(VIDEO_FILTERS.length,6);assert.equal(new Set(VIDEO_FILTERS.map(f=>f.id)).size,6);
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
 assert.match(capture,/captureColorStream\(canvasRef.current\)/);assert.match(capture,/colorVideoFile\(f,filter,strength,controller.signal\)/);
 assert.match(renderer,/canvas.captureStream\(24\)/);assert.match(renderer,/stream\?\.getTracks\(\).forEach\(t=>t.stop\(\)\)/);assert.match(renderer,/URL.revokeObjectURL\(url\)/);
 assert.match(capture,/recordingRef.current=true/);assert.match(capture,/화면을 벗어나 촬영을 취소/);assert.match(picker,/aria-pressed=\{value===f.id\}/);assert.match(picker,/type="range"/);
 assert.match(capture,/setInterval\(render,1000\/24\)/);assert.match(capture,/rec.onstart=/);
 assert.ok(!capture.includes("recordingRef.current = recording"),"stale render effects must not overwrite synchronous recording gates");
 assert.ok(read("../../public/licenses/cssgram.txt").includes("Copyright (c) 2015 Una Kravets"));
});
