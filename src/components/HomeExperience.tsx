"use client";

import type { ComponentProps } from "react";
import HomeWorld from "@/components/HomeWorld";
import Icon from "@/components/Icon";

export function HomeCommandCards({ actions }: { actions: {label:string; icon:"pencil"|"plus"|"send"|"heart"; onClick:()=>void}[] }) {
  return <>{actions.map((item,index)=><button type="button" key={item.label} onClick={item.onClick} className={`tap home-command-card ${index === 0 ? "is-featured" : ""}`}>
    <span className="home-command-icon"><Icon name={item.icon} size={index === 0 ? 24 : 20}/></span>
    <span className="min-w-0"><strong>{item.label}</strong><small>{item.icon === "pencil" ? "오늘을 기억하는 가장 좋은 방법" : item.icon === "plus" ? "기다려지는 다음 약속" : item.icon === "send" ? "짧게 전하는 오늘의 마음" : "우리의 이야기를 시작해요"}</small></span>
    <Icon name="chevronRight" size={16}/>
  </button>)}</>;
}

/** The home is now a journal cover + a living landscape + a separate memory strip.
 * Reuse the real world renderer so weather, seasonal art and pet hit targets keep working. */
export default function HomeExperience(props: Omit<ComponentProps<typeof HomeWorld>, "sceneOnly">) {
  const { me, partnerName, nDays, startLabel, photos, coverUrl, onGoAlbum, onOpenSettings, onOpenInbox, inboxUnread = 0 } = props;
  const memories = photos?.length ? photos.slice(0, 4) : coverUrl ? [{id:"cover",url:coverUrl,date:""}] : [];
  return <div className="home-experience-v3">
    <header className="home-greeting-v3">
      <div className="min-w-0"><h1>하루</h1><p>오늘도, 우리답게.</p><span>{partnerName ? "둘이 함께 채워가는 작은 일상" : "작은 순간부터 차곡차곡 쌓아가요"}</span></div>
      <div className="home-header-tools">
        {onOpenInbox && <button type="button" onClick={onOpenInbox} aria-label={inboxUnread > 0 ? `우리 활동함, 새 소식 ${inboxUnread}개` : "우리 활동함"} className="tap"><Icon name="bell" size={20}/>{inboxUnread > 0 && <span>{Math.min(99,inboxUnread)}</span>}</button>}
        <button type="button" onClick={onOpenSettings} aria-label="설정" className="tap"><Icon name="settings" size={20}/></button>
      </div>
    </header>
    <section className="home-story-v3" aria-label="함께한 시간">
      <div><p className="home-kicker">OUR STORY, STILL GROWING</p><p className={`home-day-count ${nDays >= 10000 ? "is-long" : ""}`}><strong>{nDays.toLocaleString()}</strong><span>일째</span></p></div>
      <div className="home-story-names"><p>{me || "나"}<span aria-hidden="true"> ♥ </span>{partnerName || "우리의 이야기"}</p><span>{startLabel}부터</span>{props.nextDday && <span className="home-next-tag">{props.nextDday.dday} · {props.nextDday.label}</span>}</div>
    </section>
    <HomeWorld {...props} sceneOnly />
    <section className="home-memory-v3" aria-label="최근 사진">
      <div className="home-memory-head"><div><p className="home-kicker">LITTLE MOMENTS</p><h2>아껴둔 우리의 장면</h2></div><button type="button" onClick={onGoAlbum} className="tap" aria-label="사진첩 모두 보기">모두 보기 <Icon name="chevronRight" size={14}/></button></div>
      <button type="button" onClick={onGoAlbum} aria-label={memories.length ? `사진첩 열기, 최근 사진 ${memories.length}장` : "첫 사진을 남기러 사진첩 열기"} className={`tap home-memory-strip ${memories.length ? "" : "is-empty"}`}>
        {memories.length ? memories.map((photo, i)=><span key={photo.id} className="home-memory-frame" style={{rotate:`${[-3,2,-2,3][i]}deg`}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" loading="lazy" decoding="async" onError={(event)=>{event.currentTarget.style.visibility="hidden";}} />
          <small>{photo.date || "우리의 순간"}</small>
        </span>) : <><Icon name="camera" size={28}/><span>오늘의 첫 장면을 남겨볼까요?<small>사진 한 장으로 시작하는 우리의 기록</small></span><Icon name="plus" size={20}/></>}
      </button>
    </section>
  </div>;
}
