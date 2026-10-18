"use client";

export default function VideoBeautyPicker({value,onChange,disabled,unsupported}:{value:number;onChange:(value:number)=>void;disabled:boolean;unsupported:boolean}) {
  return <section className="vlog-beauty-dock" aria-label="영상 보정">
    <div className="vlog-beauty-heading"><strong>자연스러운 피부결 보정</strong><output>{Math.round(value*100)}%</output></div>
    <div className="vlog-beauty-presets" role="group" aria-label="보정 강도 선택">
      {[{label:"끄기",value:0},{label:"자연스럽게",value:.35},{label:"매끈하게",value:.7}].map(p=><button type="button" key={p.label} disabled={disabled||(unsupported&&p.value>0)} aria-pressed={value===p.value} onClick={()=>onChange(p.value)}>{p.label}</button>)}
    </div>
    <label className="vlog-filter-strength">보정 강도<input aria-label="피부결 보정 강도" type="range" min={0} max={100} step={5} value={Math.round(value*100)} disabled={disabled||unsupported} onChange={e=>onChange(Number(e.target.value)/100)}/></label>
    <p>{unsupported?"이 환경은 보정 저장을 지원하지 않아요. 원본 촬영만 가능해요.":"잔결을 부드럽게 · 얼굴형 변경 없음 · 영상 전체에 적용해 저장"}</p>
  </section>;
}
