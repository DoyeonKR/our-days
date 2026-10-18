"use client";

import {useRef,useState} from "react";
import Icon from "@/components/Icon";
import {MoodGlyph} from "@/components/PixelGlyph";
import {nextPokeVariant,type PokeChoice} from "@/lib/pokechoices";
import styles from "./Poke.module.css";

export default function PokeQuickSend({choices,busy,onSend}:{choices:readonly PokeChoice[];busy:boolean;onSend:(kind:string,message:string)=>Promise<boolean>}) {
  const [expanded,setExpanded] = useState(false);
  const [feedback,setFeedback] = useState("");
  const history=useRef(new Map<string,string>());
  const sending=useRef(false);
  const order=["love","miss","cheer","meal","thanks","poke","kiss","morning","sleep","night","yaru"];
  const sorted=[...choices].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
  const visible=expanded?sorted:sorted.slice(0,6);
  async function send(choice:PokeChoice) {
    if(busy||sending.current)return;
    sending.current=true;
    setFeedback("마음 전하는 중…");
    const message=nextPokeVariant(choice,history.current.get(choice.kind)??"");
    try {
      if(await onSend(choice.kind,message)){
        history.current.set(choice.kind,message);
        setFeedback(`${choice.label} 마음을 보냈어요.`);
      } else setFeedback("전송하지 못했어요. 잠시 후 다시 눌러주세요.");
    } catch {setFeedback("전송하지 못했어요. 잠시 후 다시 눌러주세요.");
    } finally {sending.current=false;}
  }
  if(!choices.length)return null;
  return <div className={styles.quick}>
    <div className={styles.quickHeading}><strong>한 번 콕, 마음 보내기</strong><span>{choices.reduce((n,p)=>n+1+p.variants.length,0)}가지 랜덤 문구</span></div>
    <div className={styles.categories} role="group" aria-label="랜덤 쿡 바로 보내기">
      {visible.map((p)=><button key={p.kind} type="button" disabled={busy} onClick={()=>void send(p)}>
        <MoodGlyph e={p.emoji} size={16} />{p.label}
      </button>)}
    </div>
    <button type="button" className={styles.more} disabled={busy} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
      {expanded?"기본 마음만 보기":`다른 마음 ${Math.max(0,choices.length-6)}가지 더 보기`}<Icon name="chevronDown" size={12}/>
    </button>
    <p className={styles.feedback} role="status">{feedback||"버튼을 누르면 해당 마음의 랜덤 문구가 바로 전송돼요."}</p>
  </div>;
}
