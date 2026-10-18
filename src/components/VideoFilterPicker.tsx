"use client";
import { useEffect, useRef } from "react";
import { asset } from "@/lib/base";
import { VIDEO_FILTERS, colorPixel, type VideoFilterId } from "@/lib/videoColor";

function ToneSample({id}:{id:VideoFilterId}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{let cancelled=false;const image=new Image();image.onload=()=>{if(cancelled)return;const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;ctx.drawImage(image,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4){const rgb=colorPixel([pixels.data[i]/255,pixels.data[i+1]/255,pixels.data[i+2]/255],id,1);for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(rgb[c]*255);}ctx.putImageData(pixels,0,0);};image.src=asset("/assets/homeworld/summer.webp");return()=>{cancelled=true;image.onload=null;};},[id]);
  return <canvas ref={ref} width={48} height={56} aria-hidden="true"/>;
}
export default function VideoFilterPicker({value,strength,onChange,onStrength,disabled=false,unsupported=false}:{value:VideoFilterId;strength:number;onChange:(id:VideoFilterId)=>void;onStrength:(n:number)=>void;disabled?:boolean;unsupported?:boolean}) {
  return <section className="vlog-filter-dock" aria-label="브이로그 색감 필터">
    <div className="vlog-filter-title"><span>COLOR STORY</span><small>{unsupported?"필터 저장 미지원 · 원본 이용 가능":"선택한 색감 그대로 영상에 저장돼요"}</small></div>
    <div className="vlog-filter-options" role="group" aria-label="색감 선택">{VIDEO_FILTERS.map(f=><button key={f.id} type="button" className="tap vlog-filter-choice" disabled={disabled||(unsupported&&f.id!=="original")} aria-pressed={value===f.id} onClick={()=>onChange(f.id)}><ToneSample id={f.id}/><span>{f.label}</span></button>)}</div>
    <label className="vlog-filter-strength">강도<input type="range" min={0} max={100} step={5} value={value==="original"?0:Math.round(strength*100)} disabled={disabled||value==="original"||unsupported} onChange={e=>onStrength(Number(e.target.value)/100)}/><output>{value==="original"?0:Math.round(strength*100)}%</output></label>
  </section>;
}
