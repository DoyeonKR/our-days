"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useSharedAppearance } from "@/components/SharedAppearanceProvider";
import HomeWorld from "@/components/HomeWorld";
import Icon from "@/components/Icon";
import HomeAppearanceEditor from "@/components/HomeAppearanceEditor";
import { DEFAULT_HOME_APPEARANCE, homeAppearanceKey, homeSubtitle, normalizeHomeAppearance, readHomeAppearance, writeHomeAppearance, type HomeAppearance } from "@/lib/homePersonalization";

export function HomeCommandCards({ actions }: { actions: {label:string; icon:"pencil"|"plus"|"send"|"heart"; onClick:()=>void}[] }) {
  return <>{actions.map((item,index)=><button type="button" key={item.label} onClick={item.onClick} className={`tap home-command-card ${index === 0 ? "is-featured" : ""}`}>
    <span className="home-command-icon"><Icon name={item.icon} size={index === 0 ? 24 : 20}/></span>
    <span className="min-w-0"><strong>{item.label}</strong><small>{item.icon === "pencil" ? "오늘을 기억하는 가장 좋은 방법" : item.icon === "plus" ? "기다려지는 다음 약속" : item.icon === "send" ? "짧게 전하는 오늘의 마음" : "우리의 이야기를 시작해요"}</small></span>
    <Icon name="chevronRight" size={16}/>
  </button>)}</>;
}

/** The home is now a journal cover + a living landscape + a separate memory strip.
 * Reuse the real world renderer so weather, seasonal art and pet hit targets keep working. */
type HomeProps = Omit<ComponentProps<typeof HomeWorld>, "sceneOnly"> & {personalizationScope?:string};
export default function HomeExperience(props:HomeProps) {
  const key=homeAppearanceKey(props.personalizationScope ?? "device");
  // Remount on account/couple changes: old drafts and preferences never bleed into another scope.
  return <PersonalHome key={key} {...props} storageKey={key}/>;
}

function PersonalHome(props:HomeProps & {storageKey:string}) {
  const { me, partnerName, nDays, startLabel, photos, coverUrl, onGoAlbum, onOpenSettings, onOpenInbox, inboxUnread = 0 } = props;
  const shared=useSharedAppearance();
  const [localAppearance,setAppearance]=useState<HomeAppearance>({...DEFAULT_HOME_APPEARANCE});
  const appearance=shared?.record.settings.home??localAppearance;
  const editVersion=useRef(0);
  const [ready,setReady]=useState(false);
  const [editing,setEditing]=useState(false);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{if(shared)return;try{setAppearance(readHomeAppearance(localStorage,props.storageKey));}catch{setAppearance({...DEFAULT_HOME_APPEARANCE});}setReady(true);},[props.storageKey,shared]);
  const subtitle=homeSubtitle(appearance,!!partnerName);
  async function save(next:HomeAppearance) {
    if(shared)await shared.save({home:normalizeHomeAppearance(next)},editVersion.current);
    else try{if(!writeHomeAppearance(localStorage,props.storageKey,next))return false;}catch{return false;}
    setAppearance(normalizeHomeAppearance(next));setEditing(false);setSaved(true);return true;
  }
  const memories = photos?.length ? photos.slice(0, 4) : coverUrl ? [{id:"cover",url:coverUrl,date:""}] : [];
  return <div className="home-experience-v3" data-home-font={appearance.font} data-home-align={appearance.align} data-home-accent={appearance.accent}>
    <header className="home-greeting-v3">
      <div className="home-personal-heading min-w-0"><h1>하루</h1>{appearance.greeting && <p className="home-personal-greeting">{appearance.greeting}</p>}{subtitle && <span className="home-personal-subtitle">{subtitle}</span>}</div>
      <div className="home-header-tools">
        {onOpenInbox && <button type="button" onClick={onOpenInbox} aria-label={inboxUnread > 0 ? `우리 활동함, 새 소식 ${inboxUnread}개` : "우리 활동함"} className="tap"><Icon name="bell" size={20}/>{appearance.showUnread && inboxUnread > 0 && <span>{Math.min(99,inboxUnread)}</span>}</button>}
        <button type="button" onClick={onOpenSettings} aria-label="설정" className="tap"><Icon name="settings" size={20}/></button>
      </div>
    </header>
    <div className="home-personal-toolbar"><button type="button" onClick={()=>{editVersion.current=shared?.record.version??0;setEditing(true);setSaved(false);}} disabled={shared?!shared.ready||shared.busy:!ready} className="tap home-personal-edit"><Icon name="pencil" size={14}/>문구 꾸미기</button><span role="status">{saved?(shared?.linked?"커플 공통 설정에 저장했어요":"이 기기에 저장했어요"):shared?.linked?"둘이 함께 쓰는 홈":""}</span></div>
    <section className="home-story-v3" aria-label="함께한 시간">
      <div className="home-personal-story-block">{appearance.story && <p className="home-kicker home-personal-story">{appearance.story}</p>}{appearance.showDays && <p className={`home-day-count home-personal-days ${nDays >= 10000 || appearance.dayFormat === "dplus" ? "is-long" : ""}`}><strong>{appearance.dayFormat === "dplus"?"D+":""}{nDays.toLocaleString()}</strong>{appearance.dayLabel && <span>{appearance.dayLabel}</span>}</p>}</div>
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
    {editing && <HomeAppearanceEditor value={appearance} shared={shared?.linked??false} legacyValue={shared?.linked?shared.legacyHome:null} hasPartner={!!partnerName} days={nDays} onSave={save} onClose={()=>setEditing(false)}/>}
  </div>;
}
