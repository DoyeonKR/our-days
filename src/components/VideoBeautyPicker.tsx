"use client";
import {BEAUTY_PRESETS,beautyPreset,type BeautyPresetId} from "@/lib/videoBeauty";

export default function VideoBeautyPicker({value,onChange,preset,onPresetChange,disabled,unsupported}:{value:number;onChange:(value:number)=>void;preset:BeautyPresetId;onPresetChange:(value:BeautyPresetId)=>void;disabled:boolean;unsupported:boolean}) {
  return <section className="vlog-beauty-dock" aria-label="영상 보정">
    <div className="vlog-beauty-heading"><strong>나에게 맞는 영상 보정</strong><output>{Math.round(value*100)}%</output></div>
    <div className="vlog-beauty-presets" role="group" aria-label="보정 강도 선택">
      <button type="button" disabled={disabled} aria-pressed={value===0} onClick={()=>onChange(0)}>보정 끄기</button>
      {BEAUTY_PRESETS.map(p=><button type="button" key={p.id} disabled={disabled||unsupported} aria-pressed={value>0&&preset===p.id} onClick={()=>{onPresetChange(p.id);if(value===0)onChange(.5);}}>{p.label}</button>)}
    </div>
    <label className="vlog-filter-strength">보정 강도<input aria-label="영상 보정 강도" type="range" min={0} max={100} step={5} value={Math.round(value*100)} disabled={disabled||unsupported} onChange={e=>onChange(Number(e.target.value)/100)}/></label>
    <p>{unsupported?"이 환경은 보정 저장을 지원하지 않아요. 원본 촬영만 가능해요.":`${beautyPreset(preset).note} · 얼굴형 변경 없음 · 영상 전체에 적용해 저장`}</p>
  </section>;
}
