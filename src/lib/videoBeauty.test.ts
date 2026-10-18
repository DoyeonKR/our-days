import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BEAUTY_PRESETS,beautyPreset,beautyPixel} from "./videoBeauty.ts";
test("보정 7종은 서로 다른 파라미터, 안전한 범위와 원본 복원을 가진다",()=>{
  assert.equal(BEAUTY_PRESETS.length,7);
  assert.equal(new Set(BEAUTY_PRESETS.map(p=>p.id)).size,7);
  assert.equal(new Set(BEAUTY_PRESETS.map(p=>[p.smoothing,p.exposure,p.detail,p.glow].join())).size,7);
  assert.equal(beautyPreset("unknown").id,"natural");
  for(const p of BEAUTY_PRESETS){
    for(const raw of [[0,0,0],[1,1,1],[.15,.22,.27],[.7,.5,.4]]){
      const smooth=raw.map(v=>Math.min(1,v+.08));
      for(const a of [0,.5,1,NaN,Infinity,-1,2]){
        const out=beautyPixel(raw,smooth,p.id,a);
        assert.ok(out.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
        if(a===0||!Number.isFinite(a)||a<0)assert.deepEqual(out,raw);
      }
    }
  }
});
test("밝기·글로우·디테일 보정은 피부결 강도와 별개로 실제 픽셀 결과를 바꾼다",()=>{
  const raw=[.2,.25,.3],smooth=[.18,.23,.28];
  const results=BEAUTY_PRESETS.map(p=>beautyPixel(raw,smooth,p.id,.7));
  assert.equal(new Set(results.map(v=>v.join())).size,7);
  const natural=beautyPixel(raw,smooth,"natural",1),night=beautyPixel(raw,smooth,"night",1);
  assert.ok(night.every((v,i)=>v>natural[i]));
  const clear=beautyPixel(raw,smooth,"clear",1),soft=beautyPixel(raw,smooth,"smooth",1);
  assert.ok(clear[0]>soft[0]);
});
test("선택한 보정 스타일은 실시간·촬영 시작·파일 업로드의 같은 렌더러에 전달된다",()=>{
  const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
  const capture=read("../components/LogCapture.tsx"),renderer=read("./videoColorRenderer.ts"),picker=read("../components/VideoBeautyPicker.tsx");
  assert.equal((capture.match(/toneRef.current.beauty,toneRef.current.preset/g)??[]).length,2);
  assert.match(capture,/filter,strength,false,beauty,beautyStyle/);
  assert.match(capture,/controller.signal,beauty,beautyStyle/);
  assert.match(renderer,/renderer!\.draw\(video,id,strength,false,beauty,preset\)/);
  assert.match(renderer,/gl.uniform4f\(correction,b.smoothing,b.exposure,b.detail,b.glow\)/);
  assert.match(picker,/disabled=\{disabled\|\|unsupported\}/);
  assert.match(picker,/if\(value===0\)onChange\(.5\)/);
  assert.match(capture,/recordingRef.current\|\|processingRef.current/);
});
