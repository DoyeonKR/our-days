"use client";

import {useRef,useState} from "react";
import Icon from "@/components/Icon";
import {MoodGlyph} from "@/components/PixelGlyph";
import {nextPokeVariant,type PokeChoice} from "@/lib/pokechoices";
import styles from "./Poke.module.css";

export default function PokeQuickSend({choices,busy,onSend}:{choices:readonly PokeChoice[];busy:boolean;onSend:(kind:string,message:string)=>Promise<boolean>}) {
  const [selected,setSelected] = useState(choices.find((p)=>p.kind==="love")??choices[0]);
  const [message,setMessage] = useState(selected?.message??"");
  const [expanded,setExpanded] = useState(false);
  const [feedback,setFeedback] = useState("");
  const history=useRef(new Map<string,string>());
  const sending=useRef(false);
  const order=["love","miss","cheer","meal","thanks","poke","kiss","morning","sleep","night","yaru"];
  const sorted=[...choices].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
  const visible=expanded?sorted:sorted.slice(0,6);
  function choose(choice:PokeChoice) {
    const next=nextPokeVariant(choice,history.current.get(choice.kind)??(selected?.kind===choice.kind?message:""));
    history.current.set(choice.kind,next);
    setSelected(choice);setMessage(next);setFeedback("");
  }
  async function send() {
    if(!selected||busy||sending.current||!message)return;
    sending.current=true;
    try {
      if(await onSend(selected.kind,message))setFeedback("마음을 보냈어요. 다음 문구는 ‘다른 문구’로 골라보세요.");
    } finally {sending.current=false;}
  }
  if(!selected)return null;
  return <div className={styles.quick}>
    <div className={styles.quickHeading}><strong>어떤 마음을 보낼까요?</strong><span>{choices.reduce((n,p)=>n+1+p.variants.length,0)}가지 작은 표현</span></div>
    <div className={styles.categories} role="group" aria-label="보낼 마음 선택">
      {visible.map((p)=><button key={p.kind} type="button" disabled={busy} aria-pressed={selected.kind===p.kind} onClick={()=>choose(p)}>
        <MoodGlyph e={p.emoji} size={16} />{p.label}
      </button>)}
    </div>
    <button type="button" className={styles.more} disabled={busy} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
      {expanded?"기본 마음만 보기":`다른 마음 ${Math.max(0,choices.length-6)}가지 더 보기`}<Icon name="chevronDown" size={12}/>
    </button>
    <div className={styles.preview}>
      <div className={styles.previewLabel}><span><MoodGlyph e={selected.emoji} size={16}/>{selected.label} · 미리보기</span><button type="button" disabled={busy} onClick={()=>choose(selected)} aria-label="다른 문구 보기"><Icon name="refresh" size={12}/>다른 문구</button></div>
      <p aria-live="polite" aria-atomic="true">{message}</p>
      <button type="button" className={styles.sendPreview} disabled={busy} onClick={()=>void send()}><Icon name="send" size={16}/>{busy?"마음 전하는 중…":"이 마음 보내기"}</button>
    </div>
    <p className={styles.feedback} role="status">{feedback||"선택만으로 전송되지 않아요. 문구를 확인하고 보내주세요."}</p>
  </div>;
}
