"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useSharedAppearance } from "@/components/SharedAppearanceProvider";
import HomeWorld from "@/components/HomeWorld";
import Icon from "@/components/Icon";
import HomeAppearanceEditor from "@/components/HomeAppearanceEditor";
import { DEFAULT_HOME_APPEARANCE, homeAppearanceKey, homeSubtitle, glueEdgeEmoji, normalizeHomeAppearance, readHomeAppearance, writeHomeAppearance, type HomeAppearance } from "@/lib/homePersonalization";
import { ambientMoodOf, nextMilestoneOf } from "@/lib/homeMilestone";
import { kstHourFloatOf } from "@/lib/scenetime";
import { haptic } from "@/lib/haptic";

export function HomeCommandCards({ actions }: { actions: {label:string; icon:"pencil"|"plus"|"send"|"heart"; onClick:()=>void}[] }) {
  return <>{actions.map((item,index)=><button type="button" key={item.label} onClick={()=>{haptic(8);item.onClick();}} className={`tap home-command-card ${index === 0 ? "is-primary-action" : ""} ${index === 0 && actions.length > 2 ? "is-featured" : ""}`}>
    <span className="home-command-icon"><Icon name={item.icon} size={index === 0 ? 22 : 20}/></span>
    <span className="min-w-0"><strong>{item.label}</strong><small>{item.icon === "pencil" ? "오늘을 기억하는 가장 좋은 방법" : item.icon === "plus" ? "기다려지는 다음 약속" : item.icon === "send" ? "짧게 전하는 오늘의 마음" : "우리의 이야기를 시작해요"}</small></span>
    <Icon name="chevronRight" size={16} className="home-command-arrow"/>
  </button>)}</>;
}

/** 홈 '최근 사진' 한 장 — 서명 주소(1시간)가 만료돼 못 불러오면 그 경로만 한 번 다시 서명해 갈아 끼우고, 두 번째 실패만 숨긴다.
 *  2026-11-09: 예전 복구 코드는 HomeWorld 의 빨랫줄(!sceneOnly)에 있었는데 홈은 HomeWorld 를 sceneOnly 로만 그려
 *  한 번도 돌지 않았다 — 여기 사진줄은 첫 실패에 바로 숨겨 앱을 한 시간 넘게 켜 두면 사진이 사라졌다. */
function MemoryPhoto({ url, path, onExpired }: { url: string; path?: string; onExpired?: (path: string) => Promise<string | null> }) {
  const [fixed, setFixed] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [hidden, setHidden] = useState(false);
  // 목록이 새 주소를 주면(다시 받음) 처음부터 — 렌더 중 맞추기(effect 를 거치면 옛 주소로 한 번 더 실패한다)
  const [base, setBase] = useState(url);
  if (base !== url) {
    setBase(url);
    setFixed(null);
    setTried(false);
    setHidden(false);
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fixed ?? url}
      alt=""
      loading="lazy"
      decoding="async"
      style={hidden ? { visibility: "hidden" } : undefined}
      onError={() => {
        if (!path || !onExpired || tried) {
          setHidden(true);
          return;
        }
        setTried(true);
        void onExpired(path)
          .then((next) => (next ? setFixed(next) : setHidden(true)))
          .catch(() => setHidden(true));
      }}
    />
  );
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
  const [heartPulse,setHeartPulse]=useState(0);
  const [ambient,setAmbient]=useState(()=>ambientMoodOf(12));
  useEffect(()=>{
    const update=()=>setAmbient(ambientMoodOf(kstHourFloatOf(Date.now())));
    update();
    const id=window.setInterval(update, 5 * 60_000);
    return ()=>window.clearInterval(id);
  },[]);
  useEffect(()=>{if(shared)return;try{setAppearance(readHomeAppearance(localStorage,props.storageKey));}catch{setAppearance({...DEFAULT_HOME_APPEARANCE});}setReady(true);},[props.storageKey,shared]);
  const subtitle=homeSubtitle(appearance,!!partnerName);
  const milestone=nextMilestoneOf(nDays);
  async function save(next:HomeAppearance) {
    if(shared)await shared.save({home:normalizeHomeAppearance(next)},editVersion.current);
    else try{if(!writeHomeAppearance(localStorage,props.storageKey,next))return false;}catch{return false;}
    setAppearance(normalizeHomeAppearance(next));setEditing(false);setSaved(true);return true;
  }
  const memories = photos?.length ? photos.slice(0, 4) : coverUrl ? [{id:"cover",url:coverUrl,date:""}] : [];
  return <div className="home-experience-v3 home-experience-v5" data-home-font={appearance.font} data-home-align={appearance.align} data-home-accent={appearance.accent} data-home-tone={ambient.tone}>
    <header className="home-greeting-v3">
      {/* 맨 윗줄은 앱 이름과 버튼뿐 — 문구를 버튼 옆에 두면 남은 폭이 좁아 두 줄로 꺾이고, 가운데 정렬도 화면 가운데가 아니게 된다(2026-11-05) */}
      <div className="home-greeting-top">
        <div className="home-brand-cluster">
          <h1>하루</h1>
          <span className="home-ambient-pill" aria-hidden="true"><i className="home-ambient-dot"/>{ambient.badge}</span>
        </div>
        <div className="home-header-tools">
          {onOpenInbox && <button type="button" onClick={onOpenInbox} aria-label={inboxUnread > 0 ? `우리 활동함, 새 소식 ${inboxUnread}개` : "우리 활동함"} className="tap"><Icon name="bell" size={20}/>{appearance.showUnread && inboxUnread > 0 && <span>{Math.min(99,inboxUnread)}</span>}</button>}
          <button type="button" onClick={()=>{editVersion.current=shared?.record.version??0;setEditing(true);setSaved(false);}} disabled={shared?!shared.ready||shared.busy:!ready} aria-label="문구 꾸미기" className="tap"><Icon name="pencil" size={20}/></button>
          <button type="button" onClick={onOpenSettings} aria-label="설정" className="tap"><Icon name="settings" size={20}/></button>
        </div>
      </div>
      {(appearance.greeting || subtitle) && <div className="home-personal-heading min-w-0">{appearance.greeting && <p className="home-personal-greeting">{glueEdgeEmoji(appearance.greeting)}</p>}{subtitle && <span className="home-personal-subtitle">{subtitle}</span>}</div>}
    </header>
    <p className="home-personal-saved" role="status">{saved?(shared?.linked?"커플 공통 설정에 저장했어요":"이 기기에 저장했어요"):""}</p>
    <section className={`home-story-v3 ${milestone.isToday ? "is-milestone-day" : ""}`} aria-label="함께한 시간">
      <div className="home-personal-story-block">{appearance.story && <p className="home-kicker home-personal-story">{appearance.story}</p>}{appearance.showDays && <p className={`home-day-count home-personal-days ${nDays >= 10000 || appearance.dayFormat === "dplus" ? "is-long" : ""}`}><strong>{appearance.dayFormat === "dplus"?"D+":""}{nDays.toLocaleString()}</strong>{appearance.dayLabel && <span>{appearance.dayLabel}</span>}</p>}</div>
      <div className="home-story-names">{/* 상대가 없으면 이름 자리에 문구를 넣지 않는다 — "도연 ♥ 우리의 이야기"가 사람 이름처럼 읽혔다(2026-10-30) */}
        <p>
          {me || "나"}
          {partnerName && (
            <>
              <button
                type="button"
                className="home-story-heart"
                aria-label="마음 두근거리기"
                onClick={() => { haptic([10, 40, 14]); setHeartPulse((n) => n + 1); }}
              >
                <span aria-hidden="true">♥</span>
                {heartPulse > 0 && <i key={heartPulse} className="home-heart-bloom" aria-hidden="true">♥</i>}
              </button>
              {partnerName}
            </>
          )}
        </p>
        <span>{startLabel}부터</span>
        {props.nextDday && <span className="home-next-tag">{props.nextDday.dday} · {props.nextDday.label}</span>}
      </div>
      {appearance.showDays && (
        <div className="home-milestone-bar" aria-label={`다음 이정표 ${milestone.label}`}>
          <div className="home-milestone-meta">
            <span>{milestone.label}</span>
            <small>{milestone.pct}%</small>
          </div>
          <div className="home-milestone-track" aria-hidden="true">
            <span style={{ width: `${milestone.pct}%` }} />
          </div>
        </div>
      )}
    </section>
    <HomeWorld {...props} sceneOnly />
    <section className="home-memory-v3" aria-label="최근 사진">
      <div className="home-memory-head"><div><p className="home-kicker">최근 사진</p><h2>아껴둔 우리의 장면</h2></div><button type="button" onClick={onGoAlbum} className="tap" aria-label="사진첩 모두 보기">모두 보기 <Icon name="chevronRight" size={14}/></button></div>
      <button type="button" onClick={onGoAlbum} aria-label={memories.length ? `사진첩 열기, 최근 사진 ${memories.length}장` : "첫 사진을 남기러 사진첩 열기"} className={`tap home-memory-strip ${memories.length ? "" : "is-empty"}`}>
        {memories.length ? memories.map((photo, i)=><span key={photo.id} className="home-memory-frame" style={{rotate:`${[-3,2,-2,3][i]}deg`}}>
          <MemoryPhoto url={photo.url} path={"path" in photo ? photo.path : undefined} onExpired={props.onPhotoExpired} />
          <small>{photo.date || "우리의 순간"}</small>
        </span>) : <><span className="home-memory-empty-icon" aria-hidden="true"><Icon name="camera" size={24}/></span><span>오늘의 첫 장면을 남겨볼까요?<small>사진 한 장으로 시작하는 우리의 기록</small></span><Icon name="plus" size={20}/></>}
      </button>
    </section>
    {editing && <HomeAppearanceEditor value={appearance} shared={shared?.linked??false} legacyValue={shared?.linked?shared.legacyHome:null} hasPartner={!!partnerName} days={nDays} onSave={save} onClose={()=>setEditing(false)}/>}
  </div>;
}
