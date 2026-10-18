"use client";

import Icon from "@/components/Icon";

export function HomeNextPlan({ event, onOpen, onAdd }: {event: {label:string; dday:string; emoji:string; days:number} | null; onOpen:()=>void; onAdd:()=>void}) {
  return <section className="home-next-plan" aria-label="다음 일정">
    <header><div><span className="home-feed-eyebrow">OUR NEXT CHAPTER</span><h2>다음에 함께할 일</h2></div><Icon name="calendar" size={24}/></header>
    {event ? <button type="button" className="tap home-plan-ticket" onClick={onOpen} aria-label={`다음 일정 ${event.label} ${event.dday} — 계획에서 보기`}>
      <span className={`home-ticket-date ${event.days === 0 ? "is-today" : ""}`}><strong>{event.dday}</strong><small>{event.days === 0 ? "바로 오늘" : "기다리는 중"}</small></span>
      <span className="home-ticket-body"><span aria-hidden="true">{event.emoji}</span><strong>{event.label}</strong><small>약속 자세히 보기 →</small></span>
    </button> : <button type="button" className="tap home-plan-empty" onClick={onAdd}><Icon name="plus" size={22}/><span><strong>기다려지는 약속을 만들어볼까요?</strong><small>둘만의 다음 장면, 일정 추가하기</small></span></button>}
  </section>;
}

export function HomeJournalEnd({ onOpen }: {onOpen:()=>void}) {
  return <button type="button" onClick={onOpen} className="tap home-journal-end"><span aria-hidden="true">✦</span><span><small>TO BE CONTINUED</small><strong>우리의 이야기는 계속 쌓이는 중</strong><span>지난 기록 펼쳐보기 →</span></span></button>;
}
