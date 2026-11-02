"use client";
import { useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/AppButtons";
import { decorOf } from "@/lib/aquarium";
import { useDialogFocus } from "@/lib/useDialogFocus";

export default function DecorPreview({artKey,onClose}:{artKey:string;onClose:()=>void}) {
  const host=useRef<HTMLDivElement>(null),dialog=useDialogFocus(true,onClose);
  const [error,setError]=useState(false);
  useEffect(()=>{let cancelled=false,viewer:{dispose:()=>void}|undefined;
    void import("@/lib/aqua3d/decor-preview").then(({createDecorPreview})=>{if(cancelled||!host.current)return;try{viewer=createDecorPreview(host.current,artKey);}catch{setError(true);}}).catch(()=>{if(!cancelled)setError(true);});
    return()=>{cancelled=true;viewer?.dispose();};
  },[artKey]);
  return <div className="aqua-preview-back" onClick={onClose}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="aqua-preview-title" className="aqua-preview-dialog" onClick={e=>e.stopPropagation()}>
    <header><div><small>실제 수조와 같은 3D 모델</small><h2 id="aqua-preview-title">{decorOf(artKey)?.name}</h2></div><CloseButton onClose={onClose}/></header>
    <div ref={host} className="aqua-model-viewer" />
    <p role={error?"alert":undefined}>{error?"3D 미리보기를 열지 못했어요. 창을 닫고 다시 시도해 주세요.":"드래그해서 앞·뒤·옆면을 살펴보세요"}</p>
    <small>구매한 장식은 수조 → 꾸미기에서 놓을 수 있어요.</small>
  </section></div>;
}
