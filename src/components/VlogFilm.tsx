"use client";
import { type ReactNode } from "react";
import { slotLabel, type LogSlot } from "@/lib/logslot";
export function VlogFilmSlot({slot,current,saved,children}:{slot:LogSlot;current:boolean;saved:ReactNode;children:ReactNode}) {
 return <section className={`vlog-film-slot ${slot==="am"?"is-morning":"is-evening"}`} aria-label={`${slotLabel(slot)} 필름`}>
   <header><span className="vlog-film-index">{slot==="am"?"01":"02"}</span><div><p>{slot==="am"?"MORNING FRAME":"AFTERNOON FRAME"}</p><h2>{slotLabel(slot)}의 우리</h2></div><div className="vlog-film-state">{current&&<span>지금 남길 수 있어요</span>}{saved}</div></header>
   <div className="vlog-film-content">{children}</div>
 </section>;
}
