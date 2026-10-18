"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { DEFAULT_HOME_APPEARANCE, HOME_TEXT_LIMITS, homeSubtitle, normalizeHomeAppearance, type HomeAppearance } from "@/lib/homePersonalization";

export default function HomeAppearanceEditor({ value, hasPartner, days, onSave, onClose,shared=false,legacyValue=null }: {value:HomeAppearance;hasPartner:boolean;days:number;onSave:(p:HomeAppearance)=>boolean|Promise<boolean>;onClose:()=>void;shared?:boolean;legacyValue?:HomeAppearance|null}) {
  const [draft,setDraft]=useState(()=>({...value}));
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const close=()=>{if(!saving.current)onClose();};
  const ref=useDialogFocus(true,close);
  useEffect(()=>{const before=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=before;};},[]);
  const normalized=normalizeHomeAppearance(draft);
  const update=<K extends keyof HomeAppearance>(key:K,next:HomeAppearance[K])=>{setDraft(d=>({...d,[key]:next}));setError("");};
  return <div className="home-appearance-backdrop" onClick={close}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="홈 문구 꾸미기" className="home-appearance-editor reading" onClick={e=>e.stopPropagation()}>
      <header><div><p className="home-kicker">MAKE IT YOURS</p><h2>홈 문구 꾸미기</h2></div><button type="button" onClick={close} disabled={busy} aria-label="홈 문구 꾸미기 닫기" className="tap home-appearance-close"><Icon name="x" size={20}/></button></header>
      <p className="home-appearance-hint">{shared?"연결된 커플의 공통 설정이에요. 저장하면 상대방과 다른 기기에도 적용돼요.":"커플 연결 전에는 이 기기에 저장돼요."} 문구를 비우면 해당 문구를 숨겨요.</p>
      {shared&&legacyValue&&<button type="button" disabled={busy} className="tap min-h-11 text-sm underline" onClick={()=>{setDraft({...legacyValue});setError("");}}>이 기기의 예전 문구 가져오기 (저장 전까지 공유 안 됨)</button>}
      <div className="home-appearance-preview" data-home-font={draft.font} data-home-align={draft.align} data-home-accent={draft.accent} aria-label="홈 문구 미리보기">
        {normalized.greeting && <p className="home-personal-greeting">{normalized.greeting}</p>}
        {homeSubtitle(normalized,hasPartner) && <p className="home-personal-subtitle">{homeSubtitle(normalized,hasPartner)}</p>}
        {normalized.story && <p className="home-kicker home-personal-story">{normalized.story}</p>}
        {draft.showDays && <p className="home-personal-days"><strong>{draft.dayFormat === "dplus"?"D+":""}{days.toLocaleString()}</strong> {normalized.dayLabel}</p>}
      </div>
      <form onSubmit={async e=>{e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError("");try{if(!await onSave(normalized))setError("저장하지 못했어요. 연결 상태와 저장 공간을 확인해 주세요.");}catch(e){setError(e instanceof Error?e.message:"저장하지 못했어요. 다시 시도해 주세요.");}finally{saving.current=false;setBusy(false);}}}>
        <fieldset disabled={busy} className="contents">
        {([ ["greeting","메인 인사말"],["subtitle","설명 문구"],["story","함께한 시간의 제목"],["dayLabel","날짜 숫자 뒤 문구"] ] as const).map(([key,label],i)=><label key={key} className="home-appearance-field"><span>{label}<small>{Array.from(key === "subtitle"?homeSubtitle(draft,hasPartner):draft[key]).length}/{HOME_TEXT_LIMITS[key]}</small></span><input data-dialog-initial={i===0?true:undefined} value={key==="subtitle"?homeSubtitle(draft,hasPartner):draft[key]} maxLength={HOME_TEXT_LIMITS[key]} onChange={e=>update(key,e.target.value)} placeholder="비우면 숨김"/></label>)}
        <div className="home-appearance-options">
          <label>글꼴<select value={draft.font} onChange={e=>update("font",e.target.value as HomeAppearance["font"])}><option value="clean">또렷한 글꼴</option><option value="pixel">도트 글꼴</option><option value="serif">편지 글꼴</option></select></label>
          <label>문구 정렬<select value={draft.align} onChange={e=>update("align",e.target.value as HomeAppearance["align"])}><option value="left">왼쪽</option><option value="center">가운데</option></select></label>
          <label>강조색<select value={draft.accent} onChange={e=>update("accent",e.target.value as HomeAppearance["accent"])}><option value="ink">기본 글자색</option><option value="theme">테마 강조색</option><option value="partner">보조 강조색</option></select></label>
          <label>날짜 숫자 형식<select value={draft.dayFormat} onChange={e=>update("dayFormat",e.target.value as HomeAppearance["dayFormat"])}><option value="days">숫자만</option><option value="dplus">D+숫자</option></select></label>
        </div>
        <label className="home-appearance-check"><input type="checkbox" checked={draft.showDays} onChange={e=>update("showDays",e.target.checked)}/>함께한 날짜 숫자 표시</label>
        <label className="home-appearance-check"><input type="checkbox" checked={draft.showUnread} onChange={e=>update("showUnread",e.target.checked)}/>활동함 알림 숫자 배지 표시</label>
        <p className="home-appearance-hint">날짜와 알림 숫자는 실제 값이에요. 임의의 숫자로 바꾸지는 않으며, 날짜 변경은 설정의 시작일에서 할 수 있어요.</p>
        {error && <p role="alert" className="home-appearance-error">{error}</p>}
        <div className="home-appearance-actions"><button type="button" onClick={()=>{setDraft({...DEFAULT_HOME_APPEARANCE});setError("");}} className="tap">기본값으로</button><button type="button" onClick={close} className="tap">취소</button><button type="submit" className="tap">{busy?"저장 중…":"저장하기"}</button></div>
        </fieldset>
      </form>
    </div>
  </div>;
}
