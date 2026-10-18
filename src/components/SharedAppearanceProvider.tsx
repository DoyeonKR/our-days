"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {getCoupleAppearance,saveCoupleAppearance,subscribeCouple} from "@/lib/couple";
import {DEFAULT_SHARED_APPEARANCE,acceptAppearanceRecord,normalizeSharedAppearance,type AppearanceRecord,type SharedAppearance} from "@/lib/coupleAppearance";
import {homeAppearanceKey,readHomeAppearance,writeHomeAppearance,type HomeAppearance} from "@/lib/homePersonalization";
import {getTheme,setTheme} from "@/lib/theme";
import {getPixelArt,setPixelArt} from "@/lib/pixelpref";

type SharedContext={record:AppearanceRecord;linked:boolean;ready:boolean;busy:boolean;error:string;legacyHome:HomeAppearance|null;refresh:()=>void;save:(patch:Partial<SharedAppearance>,version:number)=>Promise<void>};
export type AppearanceServices={load:typeof getCoupleAppearance;save:typeof saveCoupleAppearance;subscribe:typeof subscribeCouple};
const serverServices:AppearanceServices={load:getCoupleAppearance,save:saveCoupleAppearance,subscribe:subscribeCouple};
const Context=createContext<SharedContext|null>(null);
export function useSharedAppearance(){return useContext(Context);}
export default function SharedAppearanceProvider({coupleId,scope,children,services=serverServices}:{coupleId:string|null;scope:string;children:ReactNode;services?:AppearanceServices}){
  return <ScopedAppearance key={`${coupleId??"solo"}:${scope}`} coupleId={coupleId} scope={scope} services={services}>{children}</ScopedAppearance>;
}
function ScopedAppearance({coupleId,scope,children,services}:{coupleId:string|null;scope:string;children:ReactNode;services:AppearanceServices}){
  const [record,setRecord]=useState<AppearanceRecord>({settings:DEFAULT_SHARED_APPEARANCE,version:0});
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loadError,setLoadError]=useState(""),[saveError,setSaveError]=useState("");
  const error=saveError||loadError;
  const [legacyHome,setLegacyHome]=useState<HomeAppearance|null>(null);
  const current=useRef<AppearanceRecord|null>(null),alive=useRef(true),saving=useRef(false),refreshRef=useRef<()=>void>(()=>{});
  const localKey=homeAppearanceKey(scope);
  function adopt(next:AppearanceRecord){
    if(!alive.current)return;
    const accepted=acceptAppearanceRecord(current.current,next);current.current=accepted;setRecord(accepted);
    setTheme(accepted.settings.theme);setPixelArt(accepted.settings.pixelArt);setReady(true);
  }
  useEffect(()=>{
    alive.current=true;
    try{if(localStorage.getItem(localKey)!==null)setLegacyHome(readHomeAppearance(localStorage,localKey));}catch{}
    if(!coupleId){
      let home=DEFAULT_SHARED_APPEARANCE.home;try{home=readHomeAppearance(localStorage,localKey);}catch{}
      adopt({settings:{home,theme:getTheme(),pixelArt:getPixelArt()},version:0});
      return()=>{alive.current=false;};
    }
    let reading=false,again=false;
    async function refresh(){
      if(!alive.current)return;
      if(reading){again=true;return;}
      reading=true;
      try{adopt(await services.load(coupleId!));if(alive.current)setLoadError("");}
      catch(e){if(alive.current)setLoadError(e instanceof Error?e.message:"공유 설정을 불러오지 못했어요.");}
      finally{reading=false;if(again&&alive.current){again=false;void refresh();}}
    }
    refreshRef.current=()=>{void refresh();};
    const unsub=services.subscribe(coupleId,()=>{void refresh();});
    const foreground=()=>{if(document.visibilityState==="visible")void refresh();};
    const timer=setInterval(foreground,30000);
    document.addEventListener("visibilitychange",foreground);window.addEventListener("online",foreground);window.addEventListener("focus",foreground);
    void refresh();
    return()=>{alive.current=false;refreshRef.current=()=>{};clearInterval(timer);unsub();document.removeEventListener("visibilitychange",foreground);window.removeEventListener("online",foreground);window.removeEventListener("focus",foreground);};
    // This scope remounts on account/couple change; never import stale local values into a linked couple.
  },[coupleId,localKey,services]);
  async function save(patch:Partial<SharedAppearance>,version:number){
    if(!ready||!current.current)throw Error("공유 설정을 불러온 후 다시 시도해 주세요.");
    if(saving.current)throw Error("앞선 설정을 저장하는 중이에요.");
    saving.current=true;setBusy(true);setSaveError("");setLoadError("");
    try{
      const next=normalizeSharedAppearance({...current.current.settings,...patch});
      if(coupleId)adopt(await services.save(coupleId,next,version));
      else{
        if(!writeHomeAppearance(localStorage,localKey,next.home))throw Error("기기 저장 공간을 확인해 주세요.");
        adopt({settings:next,version:current.current.version+1});
      }
    }catch(e){const message=e instanceof Error?e.message:"저장하지 못했어요. 다시 시도해 주세요.";if(alive.current){setSaveError(message);refreshRef.current();}throw Error(message);}
    finally{saving.current=false;if(alive.current)setBusy(false);}
  }
  return <Context.Provider value={{record,linked:!!coupleId,ready,busy,error,legacyHome,refresh:()=>refreshRef.current(),save}}>
    {error&&<div role="alert" className="mx-auto max-w-md px-5 py-3 text-sm text-rose-deep">공유 설정: {error} <button type="button" onClick={()=>{setSaveError("");refreshRef.current();}} className="tap min-h-11 underline">다시 연결</button></div>}
    {children}
  </Context.Provider>;
}
