"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { DEFAULT_HOME_APPEARANCE, HOME_TEXT_LIMITS, homeSubtitle, normalizeHomeAppearance, type HomeAppearance } from "@/lib/homePersonalization";

export default function HomeAppearanceEditor({ value, hasPartner, days, onSave, onClose }: {value:HomeAppearance;hasPartner:boolean;days:number;onSave:(p:HomeAppearance)=>boolean;onClose:()=>void}) {
  const [draft,setDraft]=useState(()=>({...value}));
  const [error,setError]=useState("");
  const ref=useDialogFocus(true,onClose);
  useEffect(()=>{const before=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=before;};},[]);
  const normalized=normalizeHomeAppearance(draft);
  const update=<K extends keyof HomeAppearance>(key:K,next:HomeAppearance[K])=>{setDraft(d=>({...d,[key]:next}));setError("");};
  return <div className="home-appearance-backdrop" onClick={onClose}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="홈 문구 꾸미기" className="home-appearance-editor reading" onClick={e=>e.stopPropagation()}>
      <header><div><p className="home-kicker">MAKE IT YOURS</p><h2>홈 문구 꾸미기</h2></div><button type="button" onClick={onClose} aria-label="홈 문구 꾸미기 닫기" className="tap home-appearance-close"><Icon name="x" size={20}/></button></header>
      <p className="home-appearance-hint">이 브라우저에 계정별로 저장돼요. 상대방이나 다른 기기에는 적용되지 않아요. 문구를 비우면 해당 문구를 숨겨요.</p>
      <div className="home-appearance-preview" data-home-font={draft.font} data-home-align={draft.align} data-home-accent={draft.accent} aria-label="홈 문구 미리보기">
        {normalized.greeting && <p className="home-personal-greeting">{normalized.greeting}</p>}
        {homeSubtitle(normalized,hasPartner) && <p className="home-personal-subtitle">{homeSubtitle(normalized,hasPartner)}</p>}
        {normalized.story && <p className="home-kicker home-personal-story">{normalized.story}</p>}
        {draft.showDays && <p className="home-personal-days"><strong>{draft.dayFormat === "dplus"?"D+":""}{days.toLocaleString()}</strong> {normalized.dayLabel}</p>}
      </div>
      <form onSubmit={e=>{e.preventDefault();if(!onSave(normalized))setError("이 브라우저에 저장하지 못했어요. 저장 공간이나 사이트 저장 권한을 확인하고 다시 시도해 주세요.");}}>
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
        <div className="home-appearance-actions"><button type="button" onClick={()=>{setDraft({...DEFAULT_HOME_APPEARANCE});setError("");}} className="tap">기본값으로</button><button type="button" onClick={onClose} className="tap">취소</button><button type="submit" className="tap">저장하기</button></div>
      </form>
    </div>
  </div>;
}
