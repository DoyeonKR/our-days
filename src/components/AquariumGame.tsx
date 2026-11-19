"use client";

/* 우리 수조 화면 — 규칙은 전부 lib/aquarium(순수). 여기는 그리기와 저장뿐이다.
 * 저장은 사람이 무언가 했을 때 + 정산에 저장할 변화(자람 · 알 · 그물 판매 · 오늘의 손님 · 시계 보정)가 있을 때만 한다(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더).
 * 매분 다시 그리는 건 저장하지 않는 미리보기다. */
import { HUNGRY_BELOW } from "@/lib/predation";
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { GameCoach, GameHead, coachSeen } from "@/components/GameHead";
import { SPOTS, formsSeen, releaseBossPlan, releaseToSea, releaseXp } from "@/lib/fishing";
import { fmtCm } from "@/lib/fishingworld";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { getAuthInfo } from "@/lib/auth";
import { josa } from "@/lib/josa";
import { AQUA_LIGHTS, aquaLightRec, buyAquaLight, setAquaLight } from "@/lib/aqualight";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DecorArt, FishArt } from "@/components/AquaArt";
import Aquarium3D from "@/components/Aquarium3D";
import DecorPreview from "@/components/DecorPreview";
import { Coin } from "@/components/island/UiIcon";
import { confirmDialog } from "@/lib/confirm";
// 먹이를 줄 때마다 뿌리는 자리가 다르다(같은 횟수 = 같은 자리) — 늘 가운데라 터널 축 · 돔 한가운데로 몰렸다(2026-11-11)
import { feedSpot } from "@/lib/aqua3d/world";
import { MEAL_END_EVENT, MEAL_LONGEST, MEAL_WAIT_MAX, TEMP_LINGER, eatenCardWaits, mealEndOf } from "@/lib/aqua3d/hunt";
import {
  ALL_FORMS, AQUA_COMBOS, BEAUTY_GROW_CAP, CARE_MARKS, DECOR, FAMILIES, FAVORITE_DECOR, FOODS, GOOD_HUNGER, GOOD_WATER, GRADES, MIN_WATER, NET_MAX, TANKS, WIDE_STEPS, DEEP_STEPS, SINK_STEPS,
  aquaDangers, aquaEffects, buyDecor, eatenReplays, fishAge, fishMorph, fishNick, nameFish, careHoursLeft, careToOpen, claimRequest, cleanWater, decorBeauty, decorOf, decorPose, familyOf, feedFish, fishArtKey, fishCare, fishCm, fishCount,
  fishName, fishRoom, foodOf, gearOutclassed, growBlock, hoursLeft, junkCoupons, likedFood, makeFood, moveDecor, netHoursLeft, netToTank, nextForm, openFinals, placeDecor,
  releaseReward, requestMet, requestText, seeNews, sellNet, speciesOf, storeDecor, syncAqua, tankGate, tankOf, unseenNews, upgradeTank, waterPrice, widenTank, deepenTank, sinkTank,
  type AquaFish, type AquaNews, type AquaResult, type AquaState, type DecorKind, type Grade, type PlacedDecor,
} from "@/lib/aquarium";
import { loadIsland, saveIsland, watchIsland, type IslandRow } from "@/lib/couple";
import { MORPHS, MORPH_INFO, morphDex, type Morph } from "@/lib/aquamorph";
import { NAME_LEN, checkFishName } from "@/lib/aqualife";
import { memorialLine, storyLine } from "@/lib/aquastory";
import { graphemes, normalizeShortText } from "@/lib/shorttext";
import { gameNow } from "@/lib/islandsync";
import { eventDef, eventGuest, eventsAt, modsAt, monthDay, nextEventAfter, occurrence, type ActiveEvent, type AquaEventKey } from "@/lib/aquaevent";
import { claimBlock, claimEventDecor, eventSaveOf, eventTints, hasClaimed, tintedInBag, tintName } from "@/lib/aquaeventclaim";
import type { IslandState } from "@/lib/island";

type Tab = "tank" | "decor" | "dex";
const TABS: readonly (readonly [Tab, string])[] = [["tank", "수조"], ["decor", "악세사리"], ["dex", "도감"]];
const KIND_LABEL: Record<DecorKind, string> = { gear: "장비", plant: "수초", rock: "돌 · 나무", ornament: "장식" };
const EFFECT_LABEL = { clean: "물이 오래 깨끗해요", grow: "더 빨리 자라요", feed: "포만이 오래 가요" } as const;
type DexFilter = "all" | "seen" | "missing";
const DEX_FILTERS: readonly (readonly [DexFilter, string])[] = [["all", "전체"], ["seen", "만난 것"], ["missing", "못 만난 것"]];

function duration(h: number): string {
  if (h < 1) return "1시간 안";
  if (h < 48) return `${Math.ceil(h)}시간`;
  return `${Math.ceil(h / 24)}일`;
}
/** 개발 빌드 전용 — 콘솔에서 window.__aquaEvent = "autumn" 처럼 두면 행사 카드 · 3D 그림만 그 행사로 보인다(정산 · 받기는 진짜 날짜 그대로). 배포 빌드엔 없다 */
function devEvent(now: number): ActiveEvent | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const key = (window as { __aquaEvent?: unknown }).__aquaEvent;
  const def = typeof key === "string" ? eventDef(key) : undefined;
  if (!def) return null;
  const y = Number(new Date(now + 9 * 3_600_000).toISOString().slice(0, 4));
  const o = occurrence(def.key, y) ?? { start: "2026-12-20", end: "2026-12-27" };
  return { def, id: `${def.key}:dev`, start: o.start, end: o.end, daysLeft: 7 };
}
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;
/** 도감 빈칸의 길잡이 — 어디서 잡히나 · 정성 얼마면 열리나 */
function dexHint(family: string, stage: 0 | 1 | 2, index: number): string {
  if (stage === 2) return index <= 0 ? "다 키우면 만나요" : `정성 ${careToOpen(index)} 넘게 키우면`;
  const spots = SPOTS.filter((s) => s.pool.some(([k]) => k === family)).map((s) => s.name);
  return spots.length ? `${spots[0]}${spots.length > 1 ? ` 외 ${spots.length - 1}곳` : ""}에서 잡혀요` : "때 손님 · 주인으로 와요";
}

export default function AquariumGame({ coupleId, myUserId, myName = "", partnerName = "", onClose, onOpenIsland, onFish, onFeedFx }: {
  coupleId: string | null;
  /** 누가 보는가 — 소식 · 둘이 돌봄을 사람마다 센다. 빠지면 로그인 정보에서 찾는다(혼자 섬은 "me") */
  myUserId?: string | null;
  /** 수조 사진 카드에 적을 이름(2026-11-13) — 모르면 빈 값(카드엔 날짜만) */
  myName?: string; partnerName?: string;
  onClose: () => void;
  onOpenIsland: () => void;
  onFish: () => void;
  /** 먹이를 준 순간 — 바깥 화면이 따로 반응할 자리(선택). 3D 수조의 먹이 알갱이는 여기가 아니라 feedSignal → scene.feed 가 그린다(2026-11-12 — 이 콜백을 넘기는 곳이 없어 먹이가 안 보였다) */
  onFeedFx?: () => void;
}) {
  useBackClose(onClose);
  const [coach, setCoach] = useState(() => !coachSeen("aquarium"));
  /** 먹이를 준 횟수 — 3D 수조가 바뀐 걸 보고 물고기를 수면으로 모은다(scene.feed) */
  const [feedN, setFeedN] = useState(0);
  // 잡아먹힌 물고기 다시 보기(2026-11-12) — 사냥꾼 시점으로 수조에서 다시 그린다(Aquarium3D → scene.replay). k 는 누를 때마다 바뀐다.
  //   replaying — 다시 보기가 도는 동안 소식 카드 줄을 멈춘다(2026-11-13: 다음 카드가 곧바로 장면을 덮었다). mealDone — 끝 알림을 받은 실제 사냥 장면의 소식 번호
  const [replay, setReplay] = useState<{ n: number; k: number } | null>(null);
  const [replayNote, setReplayNote] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  // 사진 모드가 열린 동안(2026-11-13) — 수조 시계가 서 있어 소식 카드 · 사냥 장면을 띄우지 않는다
  const [photoOpen, setPhotoOpen] = useState(false);
  const [mealDone, setMealDone] = useState<number[]>([]);
  const replayK = useRef(0);
  const [authId, setAuthId] = useState<string | null>(null);
  const who = myUserId ?? authId ?? "me";
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("tank");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // 안내 띠는 머리글 밑에 붙어 스크롤해도 보이지만, 그만큼 수조 윗부분을 가린다 — 5초 뒤 저절로 접는다('바로 놓기'가 있는 동안은 둔다)
  const [justBought, setJustBought] = useState<string | null>(null);
  const [selFish, setSelFish] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const [selDecor, setSelDecor] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [draft, setDraft] = useState<PlacedDecor | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [food, setFood] = useState("flake");
  const [dexFilter, setDexFilter] = useState<DexFilter>("all");
  const [localSeen, setLocalSeen] = useState(0);
  const busyRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // 게임 탭이 사람 id 를 안 넘겨 줘도 둘이 각자 소식을 보게 — 세션에서 읽는다(혼자 섬은 사람이 하나라 필요 없다)
  useEffect(() => {
    if (myUserId !== undefined || !coupleId) return;
    let live = true;
    void getAuthInfo().then((i) => { if (live && i) setAuthId(i.id); }).catch(() => {});
    return () => { live = false; };
  }, [myUserId, coupleId]);

  /** 최신 상태를 읽어 정산 → 동작 → 저장. 충돌이면 다시 읽어 한 번 더. 안내는 다음 동작까지 남는다. */
  const act = useCallback(async (make?: (st: IslandState, t: number) => AquaResult): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await loadIsland(coupleId).catch(() => null);
        if (!r) {
          setMsg("불러오지 못했어요. 잠시 후 다시 해 주세요.");
          return false;
        }
        const t = gameNow(); // 서버 시각에 맞춘 지금 — 폰 날짜를 바꿔 손님 · 돌보기 하루를 다시 열지 못하게
        const synced = syncAqua(r.state, t);
        const res: AquaResult = make ? make(synced.state, t) : { ok: true, state: synced.state };
        if (!res.ok) {
          setMsg(res.reason);
          setRow(r);
          setNow(t);
          if (!synced.dirty) return false; // 정산에 남길 변화가 없으면 저장할 것도 없다
        }
        try {
          const saved = await saveIsland(coupleId, r.version, res.ok ? res.state : synced.state);
          setRow(saved);
          setNow(t);
          const sold = synced.netSold ? `대기 그물의 ${synced.netSold}마리가 하루가 지나 팔렸어요 — 하트 +${synced.netCoins.toLocaleString()}` : null;
          if (res.ok) setMsg([res.note, sold].filter(Boolean).join(" · ") || null);
          else if (sold) setMsg(sold);
          return res.ok;
        } catch {
          /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 한 번 더 */
        }
      }
      setMsg("저장하지 못했어요. 잠시 후 다시 해 주세요.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [coupleId]);

  const load = useCallback(async () => {
    const r = await loadIsland(coupleId).catch(() => null);
    setRow(r);
    setNow(gameNow());
    setLoaded(true);
  }, [coupleId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => watchIsland(coupleId, () => void load()), [coupleId, load]);
  useEffect(() => {
    const iv = setInterval(() => setNow(gameNow()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const view = useMemo(() => (row && now ? syncAqua(row.state, now) : null), [row, now]);
  // 자람 · 알 · 그물 판매 · 오늘의 손님이 생겼으면 한 번 저장한다(도감 · 모습 · 손님이 두 기기에서 같아지게)
  const dirty = view?.dirty ?? false;
  useEffect(() => {
    if (dirty) void act();
  }, [dirty, act]);

  // 본 소식 — 카드는 바로 넘기고, 다 넘긴 뒤 한 번에 저장한다(카드마다 저장을 기다리지 않게)
  const news = view ? unseenNews(view.a, who).filter((n) => n.n > localSeen) : [];
  const savedSeen = view?.a.newsSeen?.[who] ?? 0;
  useEffect(() => {
    if (!busy && news.length === 0 && localSeen > savedSeen) void act((st, t) => seeNews(st, who, localSeen, t));
  }, [busy, news.length, localSeen, savedSeen, who, act]);

  /** 꾸미기 · 놓기를 시작하면 수조를 머리글 밑으로 — 고정 머리글이 수조 윗부분을 가렸다 */
  const showStage = useCallback(() => {
    setMsg(null); // 머리글 밑에 붙는 안내가 수조 윗부분을 다시 가리지 않게
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, []);

  /** 다시 보기를 연다 — 카드는 수조 탭 밖에도 뜨므로 수조 탭으로 옮기고, 꾸미는 중이면 끝낸다(꾸미는 동안은 수조 시계가 서서 장면이 안 돈다).
   *  요청은 수조가 준비될 때까지 Aquarium3D 가 들고 있다가 틀고, 결과(onReplay)를 받으면 지운다 */
  const startReplay = (n: number) => {
    setReplayNote(null);
    replayK.current += 1;
    setReplay({ n, k: replayK.current });
    setReplaying(true);
    setTab("tank");
    setEditing(false);
    setPlacing(null);
    setMoving(false);
    setDraft(null);
    setSelDecor(null);
    setSelFish(null);
    showStage();
  };
  const onReplay = useCallback((res: string) => {
    setReplay(null); // 처리한 요청 — 수조가 다시 붙어도(탭 · 연결 복구) 또 틀지 않는다
    if (res === "ok") { setReplaying(true); return; }
    setReplaying(false);
    setReplayNote(res === "busy" ? "지금 다른 사냥 장면이 나오는 중이에요 — 끝나면 다시 눌러 주세요" : res === "reduced" ? "움직임 줄이기 설정이라 장면을 보여 줄 수 없어요" : res === "stopped" ? null : res === "error" ? "수조를 열지 못해 장면을 다시 볼 수 없어요" : "이 장면은 다시 볼 수 없어요(모델을 불러오지 못했어요)");
  }, []);
  // 수조가 쏘는 장면 끝 알림(hunt.ts mealEndOf) — 다시 보기 끝이면 카드 줄을 다시 열고, 실제 사냥이면 그 번호를 모아 둔다(카드는 붙기 전에 온 알림도 본다)
  useEffect(() => {
    const onEnd = (e: Event) => {
      const d = mealEndOf(e);
      if (!d) return;
      if (d.replay) setReplaying(false);
      else setMealDone((done) => (done.includes(d.n) ? done : [...done.slice(-19), d.n]));
    };
    window.addEventListener(MEAL_END_EVENT, onEnd);
    return () => window.removeEventListener(MEAL_END_EVENT, onEnd);
  }, []);
  // 끝 알림을 못 들으면(수조가 닫힘 등) 가장 긴 장면 + 모델 기다림 + 물러나기 뒤에 카드 줄을 다시 연다. 요청이 수조에 닿은 뒤부터 잰다
  useEffect(() => {
    if (!replaying || replay) return;
    const t = setTimeout(() => setReplaying(false), (MEAL_LONGEST + MEAL_WAIT_MAX + TEMP_LINGER) * 1000 + 3000);
    return () => clearTimeout(t);
  }, [replaying, replay]);
  // 다시 보기 안내는 수조 위에 잠깐(4초)
  useEffect(() => {
    if (!replayNote) return;
    const t = setTimeout(() => setReplayNote(null), 4000);
    return () => clearTimeout(t);
  }, [replayNote]);

  const shell = (children: ReactNode) => (
    <div className="aqua-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md pb-10">
        <GameHead title="우리 수조" coins={row?.state.coins} onClose={onClose} />
        {children}
      </div>
    </div>
  );

  if (!loaded) return shell(<p className="p-6 text-center text-sm">불러오는 중…</p>);
  if (!row || !view) {
    return shell(
      <div className="p-6 text-center">
        <p className="text-sm">수조는 섬 하트로 꾸며요. 먼저 섬을 시작해 주세요.</p>
        <ActionButton main className="mt-4" onClick={onOpenIsland}>우리 섬으로 가기</ActionButton>
      </div>,
    );
  }

  const a = view.a;
  const seenForms = formsSeen({ fishing: row?.state.fishing, aquarium: a });
  const coins = view.state.coins;
  // 수조 조명(2026-11-18, lib/aqualight) — 산 것 · 켠 것. 장면(Aquarium3D)과 꾸미기 탭의 가게가 같이 본다
  const lights = aquaLightRec(view.state);
  // 10 · 11단계는 하트만으론 못 산다 — 낚시 기록 조건과 진행을 버튼 위에 보인다(upgradeTank 와 같은 판정)
  const nextGate = tankGate(view.state, a, a.tank + 1);
  /** 상성이 안 맞는 짝(lib/predation) — 배가 고프면 잡아먹는다. 미리 알려 먹이로 지킬 수 있게 */
  const dangers = aquaDangers(a);
  // 잡아먹기 소식 — 24시간 안의 것만 최근 것부터 6개(2026-11-15 — 지나면 다시 보기 목록에서 저절로 빠진다, eatenReplays)
  const eaten = eatenReplays(a.news, now || gameNow());
  const tk = tankOf(a);
  // 계절 수조 행사(2026-11-13, lib/aquaevent) — 정산과 같은 배율로 남은 시간을 보인다. 카드 · 3D 그림은 개발용 덮어쓰기를 따른다
  const fx = aquaEffects(a, modsAt(a.at));
  const dev = devEvent(now);
  const events: ActiveEvent[] = dev ? [dev] : eventsAt(now);
  const nextEv = events.length ? null : nextEventAfter(now);
  const evSave = eventSaveOf(view.state);
  const tints = eventTints(evSave, a.placed);
  const guest = a.req ? eventGuest(a.req.day) : null;
  const block = a.fish.length ? growBlock(a) : null;
  const left = careHoursLeft(a);
  const sel = a.fish.find((f) => f.id === selFish) ?? null;
  const decorSel = a.placed.find((p) => p.id === selDecor) ?? null;
  const bagList = Object.entries(a.bag).filter(([, n]) => n > 0);
  const nextTank = TANKS[a.tank];
  const nextWide = WIDE_STEPS[a.wide ?? 0], nextDeep = DEEP_STEPS[a.deepen ?? 0], nextSink = SINK_STEPS[a.sink ?? 0];
  const coupons = junkCoupons(view.state, a);
  const foods = FOODS.filter((x) => x.cost === 0 || (a.food?.[x.key] ?? 0) > 0);
  const pick = foods.some((x) => x.key === food) ? food : "flake";
  const hiddenFish = a.alien?.fish.length ?? 0;

  function onPlaceAt(x: number, y: number) {
    if (busy) return;
    if (!editing || (!placing && !(moving && selDecor))) return;
    if (moving && selDecor) {
      if (decorSel) setDraft({ ...(draft ?? decorSel), x, y });
    } else if (placing) {
      setDraft({ ...(draft ?? { id: -1, key: placing, rotation: 0, scale: 1 }), x, y });
    }
  }

  async function confirmPlacement() {
    if (!draft || busy) return;
    const p = draft, pose = decorPose(p);
    const ok = await act((st, t) => p.id === -1 ? placeDecor(st, p.key, p.x, p.y, t, pose) : moveDecor(st, p.id, p.x, p.y, t, pose));
    if (ok) { setDraft(null); setPlacing(null); setMoving(false); setSelDecor(null); }
  }

  async function release(f: AquaFish) {
    const reward = releaseReward(f), xp = releaseXp(f);
    // 보내 주면 그 낚시터 주인이 빨리 온다(2026-11-18, lib/bosscall) — 몇 시간인지 · 왜 효과가 없는지 미리 말한다(저장도 같은 계산)
    const plan = view && f.stage === 2 ? releaseBossPlan(view.state, f.id, gameNow()) : null;
    // 24시간을 모아야 하루 일찍 온다 — '몇 시간 빨리'만 말하면 다시 나타나는 날이 그대로인데 거짓말이 된다(2026-11-18 화면 확인)
    const call = !plan ? "" : "total" in plan
      ? ` 바다에서 소문이 퍼져 ${plan.name}에게 ${plan.add}시간이 모여요 — 24시간마다 하루 일찍 와요(지금 ${plan.total % 24 === 0 && plan.days > 0 ? 24 : plan.total % 24}/24${plan.days > 0 ? ` · 이번에 하루 당겨져 ${plan.left}일 뒤` : ""}).`
      : ` (${plan.name}: ${plan.why})`;
    const ok = await confirmDialog(f.crown ? {
      // 주인은 며칠을 겨뤄 잡았고, 다시 나타나기까지 7일이 걸린다 — 흔한 물고기와 같은 확인창으로 보내면 안 된다
      message: `${f.crown} — 낚시터의 주인이에요. 정말 보내 줄까요?`,
      detail: `하트 ${reward.toLocaleString()}개를 받아요. 주인은 다시 잡으려면 며칠을 다시 겨뤄야 하고, 왕관 쓴 모습은 수조에서 사라져요.${call}`,
      confirmText: "그래도 보내 주기",
      danger: true,
    } : {
      message: `${josa(fishName(f), "을/를")} 보내 줄까요?`,
      detail: `하트 ${reward.toLocaleString()}개${xp > 0 ? ` · 낚시 경험치 +${xp}` : ""}를 받아요.${f.stage !== 2 ? " 다 키워서 보내면 더 받고, 그 낚시터 주인도 빨리 와요." : ""}${call} 도감 기록은 남아요.`,
      confirmText: "보내 주기",
    });
    if (!ok) return;
    setSelFish(null);
    void act((st, t) => {
      const r = releaseToSea(st, f.id, t);
      return r.ok ? { ok: true, state: r.state, note: r.note } : r;
    });
  }

  async function feed() {
    const ok = await act((st, t) => feedFish(st, t, { food: pick, who }));
    if (ok) {
      setFeedN((n) => n + 1);
      onFeedFx?.();
    }
  }

  function startPlacing(key: string) {
    setTab("tank");
    setEditing(true);
    setPlacing(key);
    setSelDecor(null);
    setMoving(false);
    setDraft(null);
    setSelFish(null);
    setJustBought(null);
    showStage();
  }

  return shell(
    <div className="px-4">
      {coach && <GameCoach fixed id="aquarium" title="우리 수조" steps={["낚시로 담은 물고기가 여기서 자라요", "먹이와 물을 챙겨 주면 오래 키워 다 큰 모습이 돼요", "장식을 사서 놓고, 수조를 넓힐 수 있어요"]} onDone={() => setCoach(false)} />}
      <div className="aqua-tabs" role="tablist" aria-label="우리 수조">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`aqua-tab-${k}`} aria-controls={`aqua-panel-${k}`} aria-selected={tab === k} className={`tap ${tab === k ? "is-on" : ""}`} disabled={busy} onClick={() => { if (k !== tab) { setReplay(null); setReplaying(false); } setTab(k); setDraft(null); setPlacing(null); setMoving(false); }}>{label}</button>
        ))}
      </div>
      {msg && <MsgTimer msg={msg} hold={!!justBought && (a.bag[justBought] ?? 0) > 0} onDone={() => setMsg((m) => (m === msg ? null : m))} />}
      {msg && (
        <div className="aqua-msg" aria-live="polite">
          <p>{msg}</p>
          {justBought && (a.bag[justBought] ?? 0) > 0 && <ActionButton main disabled={busy} onClick={() => startPlacing(justBought)}>바로 놓기</ActionButton>}
          <CloseButton onClose={() => setMsg(null)} ariaLabel="안내 닫기" />
        </div>
      )}

      <div role="tabpanel" id={`aqua-panel-${tab}`} aria-labelledby={`aqua-tab-${tab}`}>
      {tab === "tank" && (
        <>
          <div ref={stageRef} className="aqua-stage">
            <Aquarium3D feedSignal={feedN} feedX={feedSpot(feedN, a.wide)} view={{ aquarium: a, editing, placing: !!placing || moving, selectedFish: selFish, selectedDecor: selDecor, preview: draft, season: { keys: events.map((e) => e.def.key), tints, clock: gameNow, seed: coupleId ?? "" }, light: lights.on }}
              onFish={id => setSelFish(selFish === id ? null : id)}
              onDecor={id => { if (!placing && !moving) setSelDecor(id); }} onPlace={onPlaceAt} replaySignal={replay} onReplay={onReplay} replaying={replaying} replayNote={replayNote}
              people={[myName, partnerName]} onPhoto={setPhotoOpen} />
          </div>

          <EventCard events={events} next={nextEv} busy={busy} claimed={(id) => hasClaimed(view.state, id)}
            why={(k) => claimBlock(view.state, k, now)} onClaim={(k) => void act((st, t) => claimEventDecor(st, k, t))} />

          {a.fish.length === 0 ? (
            <section className="aqua-card aqua-empty-card">
              <header><strong>아직 물고기가 없어요</strong></header>
              <p className="aqua-note">낚시로 담아 오세요 — 끌어올린 물고기를 &lsquo;수조에 담기&rsquo; 하면 여기서 자라요.</p>
              <ActionButton main wide onClick={onFish}>낚시하러 가기</ActionButton>
            </section>
          ) : <ActionButton main wide onClick={onFish}>낚시하러 가기</ActionButton>}
          {hiddenFish > 0 && <p className="aqua-note mt-2">새 버전에서만 보이는 물고기 {hiddenFish}마리가 함께 살아요 — 앱을 새로 고치면 보여요.</p>}

          <div className="aqua-meters">
            <Meter label="포만" value={a.hunger} marks={[{ at: GOOD_HUNGER, label: "정성" }]} />
            <Meter label="물 상태" value={a.water} marks={[{ at: GOOD_WATER, label: "정성" }, { at: MIN_WATER, label: "성장 멈춤" }]} />
            {dangers.length > 0 && (
              <p className={`aqua-danger ${a.hunger < 60 ? "is-hungry" : ""}`} role="note">
                <b>상성 주의</b> {dangerLine(dangers)}
                <small>{a.hunger < HUNGRY_BELOW ? "배가 고파요 — 지금 먹이를 주지 않으면 잡아먹힐 수 있어요" : `약 ${Math.max(1, Math.round(((a.hunger - HUNGRY_BELOW) * fx.hungerHours) / 100))}시간 뒤 포만이 ${HUNGRY_BELOW} 밑으로 내려가면 잡아먹어요`}</small>
              </p>
            )}
            {eaten.length > 0 && (
              <section className="aqua-eaten-log" aria-label="잡아먹힌 물고기">
                <p className="aqua-eaten-log-head"><b>잡아먹힌 물고기</b><small>사냥꾼 시점으로 다시 볼 수 있어요</small></p>
                <ul>
                  {eaten.map((g) => (
                    <li key={g.n}>
                      <span className="aqua-eaten-log-pics" aria-hidden><span><FishArt artKey={fishArtKey({ family: g.family, stage: g.stage, species: g.species })} /></span><i>▶</i><span className="is-gone"><FishArt artKey={fishArtKey(g.ate!)} /></span></span>
                      <span className="min-w-0 flex-1"><strong>{josa(fishName({ family: g.family, stage: g.stage, species: g.species }), "이/가")} {fishName(g.ate!)}</strong></span>
                      <button type="button" className="tap aqua-replay" onClick={() => startReplay(g.n)} aria-label={`${fishName(g.ate!)} 잡아먹힌 장면 다시 보기`}>▶ 다시 보기</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {a.fish.length > 0 && (
            <p className="aqua-note mt-1">
              {left.feed > 0 ? `다음 먹이까지 ${duration(left.feed)}` : "지금 먹이를 주세요 — 정성이 멈췄어요"} · {left.clean > 0 ? `물 갈기까지 ${duration(left.clean)}` : "물을 갈아 주세요"} · 표시선 위에서만 정성이 쌓여요
            </p>
          )}
          {block && <p className="aqua-warn">{block}</p>}
          {foods.length > 1 && (
            <div className="aqua-food" role="radiogroup" aria-label="먹이 고르기">
              {foods.map((x) => (
                <button key={x.key} type="button" role="radio" aria-checked={pick === x.key} className={`tap ${pick === x.key ? "is-on" : ""}`} onClick={() => setFood(x.key)}>
                  {x.name}{x.cost > 0 ? ` ×${a.food?.[x.key] ?? 0}` : ""}
                </button>
              ))}
            </div>
          )}
          <div className="aqua-actions">
            <ActionButton main disabled={busy} onClick={() => void feed()}>먹이 주기</ActionButton>
            <ActionButton disabled={busy || coins < waterPrice(a.tank)} onClick={() => { void act((st, t) => cleanWater(st, t, { who })); }}>물 갈기 <span className="aqua-price"><Coin /> {waterPrice(a.tank)}</span></ActionButton>
            <ActionButton
              on={editing}
              onClick={() => {
                const on = !editing;
                setEditing(on);
                setPlacing(null);
                setSelDecor(null);
                setMoving(false);
                setDraft(null);
                setSelFish(null);
                if (on) showStage();
              }}
            >
              {editing ? "꾸미기 끝" : "꾸미기"}
            </ActionButton>
          </div>

          {editing && (
            <section className="aqua-card">
              <header><strong>꾸미기</strong><small>놓은 것 {a.placed.length}/{tk.decor}</small></header>
              <p className="aqua-note">장식을 고르고 수조 바닥을 눌러 미리 보세요. 두 장식을 가까이 두면 조합이 생겨요(찾은 조합 {(a.combos ?? []).length}/{AQUA_COMBOS.length}).</p>
              {fx.combos.length > 0 && <p className="aqua-note">지금 조합: {fx.combos.map((id) => AQUA_COMBOS.find((c) => c.id === id)?.name).join(" · ")} · 성장 +{Math.round(fx.comboGrow * 100)}%</p>}
              {(placing || moving) && <div className="aqua-placement-tools" aria-label="3D 장식 배치 조절">
                <strong>{decorOf(draft?.key ?? placing ?? decorSel?.key ?? "")?.name} · {draft ? "미리보기" : "바닥을 눌러 주세요"}</strong>
                {draft && <>
                  <div className="aqua-placement-buttons">
                    <ActionButton disabled={busy} aria-label="장식 왼쪽으로 30도 회전" onClick={() => setDraft(p => p && ({ ...p, rotation: decorPose(p).rotation - 30 }))}>↶ 30°</ActionButton>
                    <ActionButton disabled={busy} aria-label="장식 오른쪽으로 30도 회전" onClick={() => setDraft(p => p && ({ ...p, rotation: decorPose(p).rotation + 30 }))}>↷ 30°</ActionButton>
                    <span>{Math.round(decorPose(draft).rotation)}°</span>
                  </div>
                  <label>크기 {Math.round(decorPose(draft).scale * 100)}%
                    <input aria-label="장식 크기" type="range" min="60" max="160" step="10" disabled={busy} value={Math.round(decorPose(draft).scale * 100)} onChange={e => setDraft(p => p && ({ ...p, scale: Number(e.target.value) / 100 }))} />
                  </label>
                  <ActionButton main wide disabled={busy} onClick={() => void confirmPlacement()}>{busy ? "저장 중…" : "이 위치에 배치 확정"}</ActionButton>
                </>}
                <ActionButton disabled={busy} onClick={() => { setDraft(null); setPlacing(null); setMoving(false); }}>배치 취소</ActionButton>
              </div>}
              {a.placed.length > 0 && <div className="aqua-3d-decor-list" aria-label="놓인 장식 선택">
                {a.placed.map(p => <ActionButton key={p.id} aria-pressed={selDecor===p.id}
                  disabled={busy} onClick={() => { setSelDecor(p.id); setMoving(false); setPlacing(null); setDraft(null); }}>{(tints[p.id] && tintName(tints[p.id])) || decorOf(p.key)?.name}</ActionButton>)}
              </div>}
              {decorSel && !moving ? (
                <div className="aqua-row">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{(tints[decorSel.id] && tintName(tints[decorSel.id])) || decorOf(decorSel.key)?.name}</span>
                  <ActionButton disabled={busy} onClick={() => { setMoving(true); setPlacing(null); setDraft({ ...decorSel, ...decorPose(decorSel) }); showStage(); }}>이동·회전·크기</ActionButton>
                  <ActionButton
                    disabled={busy} onClick={() => {
                      const id = decorSel.id;
                      setSelDecor(null);
                      setDraft(null);
                      void act((st, t) => storeDecor(st, id, t));
                    }}
                  >
                    보관함으로
                  </ActionButton>
                </div>
              ) : bagList.length === 0 ? (
                <p className="aqua-note">보관함이 비었어요. 악세사리 칸에서 사 오거나, 놓인 것을 눌러 옮겨 보세요.</p>
              ) : (
                <div className="aqua-bag">
                  {bagList.map(([k, n]) => (
                    <button
                      key={k}
                      type="button"
                      className={`tap ${placing === k ? "is-on" : ""}`}
                      aria-label={`${decorOf(k)?.name ?? k}${n > 1 ? ` ×${n}` : ""}`}
                      aria-pressed={placing === k}
                      disabled={busy}
                      onClick={() => {
                        setPlacing(placing === k ? null : k);
                        setSelDecor(null);
                        setMoving(false);
                        setDraft(null);
                        if (placing !== k) showStage();
                      }}
                    >
                      <span className="aqua-bag-pic"><DecorArt artKey={k} /></span>
                      <small>{decorOf(k)?.name}{n > 1 ? ` ×${n}` : ""}</small>
                      {(() => { const lim = tintedInBag(evSave, k, a.placed.filter((p) => p.key === k).length); return lim.length > 0 && <small className="aqua-event-tag">한정 {lim.length}</small>; })()}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {sel && !editing && <FishCard key={sel.id} f={sel} a={a} seen={seenForms} now={now} who={who} couple={!!coupleId} busy={busy}
            onRelease={() => void release(sel)} onName={(name) => act((st, t) => nameFish(st, sel.id, name, t, coupleId ? who : undefined))} />}

          {a.req && (
            <section className="aqua-card aqua-req">
              <header><strong>오늘의 손님</strong><small><Coin /> {a.req.reward}</small></header>
              {guest && <p className="aqua-note aqua-event-guest">{guest.event.name} 손님 — {josa(guest.name, "이/가")} 찾아왔어요</p>}
              <p className="aqua-note">{requestText(a.req)}</p>
              {a.req.done ? <p className="aqua-note">손님이 기뻐하며 돌아갔어요. 내일 또 와요.</p> : (
                <ActionButton wide main={requestMet(a)} disabled={busy || !requestMet(a)} onClick={() => void act((st, t) => claimRequest(st, t))}>
                  {requestMet(a) ? `보여 주기 · 하트 +${a.req.reward}` : "아직 준비가 안 됐어요"}
                </ActionButton>
              )}
            </section>
          )}

          {(a.net?.length ?? 0) > 0 && (
            <section className="aqua-card">
              <header><strong>대기 그물</strong><small>{a.net!.length}/{NET_MAX} · 하루가 지나면 잡을 때 값에 팔려요</small></header>
              <ul className="aqua-net">
                {a.net!.map((n, i) => (
                  <li key={`${n.family}-${n.at}-${i}`} className="aqua-net-row">
                    <span className="aqua-thumb"><FishArt artKey={fishArtKey(n)} /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{fishName(n)}</strong><small>{duration(netHoursLeft(n, now))} 남음</small></span>
                    <ActionButton main disabled={busy || fishRoom(a) <= 0} onClick={() => void act((st, t) => netToTank(st, i, t))}>수조로</ActionButton>
                    <ActionButton disabled={busy} onClick={() => void act((st, t) => sellNet(st, i, t))}><span className="aqua-price"><Coin /> {n.value.toLocaleString()}</span></ActionButton>
                  </li>
                ))}
              </ul>
              {fishRoom(a) <= 0 && <p className="aqua-note mt-2">수조가 가득 찼어요 — 한 마리를 보내 주면 옮길 수 있어요.</p>}
            </section>
          )}

          <section className="aqua-card">
            <header><strong>{tk.name}</strong><small>물고기 {fishCount(a)}/{tk.fish} · 악세사리 {a.placed.length}/{tk.decor}</small></header>
            <p className="aqua-note">
              아름다움 {fx.beauty}{fx.beautyGrow > 0 ? ` · 성장 +${Math.round((fx.beautyGrow + fx.comboGrow) * 100)}%` : ""} · 먹이 한 번에 {Math.round(fx.hungerHours)}시간 · 물 한 번에 {Math.round(fx.waterHours)}시간
            </p>
            {nextWide ? (
              <ActionButton wide className="aqua-btn-wrap" disabled={busy || coins < nextWide.price} onClick={() => void act((st, t) => widenTank(st, t))}>
                옆으로 늘리기 {(a.wide ?? 0) + 1}/{WIDE_STEPS.length}{(a.wide ?? 0) >= 3 ? " · 폭 1.5배" : ""} · 물고기 +{nextWide.fish} · 장식 +{nextWide.decor} <span className="aqua-price"><Coin /> {nextWide.price.toLocaleString()}</span>
              </ActionButton>
            ) : <p className="aqua-note">어항을 옆으로 끝까지 늘렸어요</p>}
            {nextDeep ? (
              <ActionButton wide className="aqua-btn-wrap" disabled={busy || coins < nextDeep.price} onClick={() => void act((st, t) => deepenTank(st, t))}>
                앞뒤로 늘리기 {(a.deepen ?? 0) + 1}/{DEEP_STEPS.length} · 깊이 1.5배 · 물고기 +{nextDeep.fish} · 장식 +{nextDeep.decor} <span className="aqua-price"><Coin /> {nextDeep.price.toLocaleString()}</span>
              </ActionButton>
            ) : <p className="aqua-note">어항을 앞뒤로 끝까지 늘렸어요</p>}
            {nextSink ? (
              <ActionButton wide className="aqua-btn-wrap" disabled={busy || coins < nextSink.price} onClick={() => void act((st, t) => sinkTank(st, t))}>
                아래로 깊게 {(a.sink ?? 0) + 1}/{SINK_STEPS.length} · 수심 1.5배 · 물고기 +{nextSink.fish} · 장식 +{nextSink.decor} <span className="aqua-price"><Coin /> {nextSink.price.toLocaleString()}</span>
              </ActionButton>
            ) : <p className="aqua-note">어항을 끝까지 깊게 했어요</p>}
            {nextTank && nextGate.items.length > 0 && (
              <div className={`aqua-gate ${nextGate.ok ? "is-ok" : ""}`}>
                <strong>{nextTank.name} — {nextGate.ok ? "조건을 다 채웠어요" : "이 기록이 있어야 열려요"}</strong>
                <ul>
                  {nextGate.items.map((x) => (
                    <li key={x.label} className={x.have >= x.need ? "is-done" : ""}>
                      <span>{x.label}</span>
                      <i aria-hidden><b style={{ width: `${Math.min(1, x.have / x.need) * 100}%` }} /></i>
                      <small>{Math.min(x.have, x.need).toLocaleString()}/{x.need.toLocaleString()}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nextTank ? (
              <ActionButton wide className="aqua-btn-wrap" disabled={busy || coins < nextTank.price || !nextGate.ok} onClick={() => void act((st, t) => upgradeTank(st, t))}>
                수조 넓히기 · {nextTank.name} · 물고기 {tk.fish}→{tankOf({ ...a, tank: a.tank + 1 }).fish} <span className="aqua-price"><Coin /> {nextTank.price.toLocaleString()}</span>
              </ActionButton>
            ) : <p className="aqua-note">가장 큰 수조예요.</p>}
            {coupons > 0 || Object.keys(a.food ?? {}).length > 0 ? (
              <details className="aqua-foodshop">
                <summary>먹이 만들기 · 분리수거 쿠폰 {coupons}장</summary>
                <p className="aqua-note">낚시에서 건진 쓰레기 하나가 쿠폰 한 장이에요(수집함 숫자는 그대로예요). 좋아하는 먹이를 주면 정성이 더 쌓이고 조금 더 빨리 자라요.</p>
                <ul className="aqua-shop is-flat">
                  {FOODS.filter((x) => x.cost > 0).map((x) => (
                    <li key={x.key}>
                      <span className="min-w-0 flex-1"><strong>{x.name}</strong><small>{x.desc} · 남은 {a.food?.[x.key] ?? 0}번</small></span>
                      <ActionButton disabled={busy || coupons < x.cost} onClick={() => void act((st, t) => makeFood(st, x.key, t))}>쿠폰 {x.cost}장</ActionButton>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {a.fish.length > 0 && (
            <section className="aqua-card">
              <header><strong>우리 물고기</strong></header>
              <ul className="aqua-list">
                {a.fish.map((f) => {
                  const sp = speciesOf(f.species);
                  return (
                    <li key={f.id}>
                      <button type="button" className={`tap ${selFish === f.id ? "is-on" : ""}`} aria-pressed={selFish === f.id} onClick={() => { const on = selFish !== f.id; setSelFish(on ? f.id : null); /* 2026-11-14 [사용자: "하단에 물고기 선택하면 수조에 포커싱 되도록"] — 목록은 수조 아래라 골라도 카메라가 다가가는 걸 못 봤다. 고르면 수조로 올라간다 */ if (on) stageRef.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }}>
                        <span className="aqua-thumb"><FishArt artKey={fishArtKey(f)} morph={fishMorph(a, f)} /></span>
                        {/* 변이 표는 이름 칸 안에 — 오른쪽 등급 · 남은 시간 칸을 375px 밖으로 밀어내지 않게(넘치면 길이 글이 먼저 잘린다) */}
                        <span className="min-w-0 flex-1 truncate font-bold">{fishNick(a, f.id) ? <>{fishNick(a, f.id)} <small className="font-normal">{fishName(f)}</small></> : fishName(f)}<MorphTag morph={fishMorph(a, f)} /> <small className="font-normal">{fmtCm(fishCm(f))}{f.bred ? " · 수조에서 태어남" : ""}</small></span>
                        {f.stage === 2 && sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small>{duration(hoursLeft(a, f))} 남음</small>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {(a.life?.memorial.length ?? 0) > 0 && <MemorialCard a={a} />}
        </>
      )}

      {tab === "decor" && (
        <>
          <LightShop owned={lights.owned} on={lights.on} coins={coins} busy={busy}
            onBuy={(k) => void act((st) => buyAquaLight(st, k))} onSet={(k) => void act((st) => setAquaLight(st, k))} />
          {fx.beautyGrow >= BEAUTY_GROW_CAP && <p className="aqua-note mt-3">아름다움 성장 보너스가 가득 찼어요(+{Math.round(BEAUTY_GROW_CAP * 100)}%) — 장식을 더 놓으면 보기만 좋아져요. 조합은 따로 성장을 더해요.</p>}
          {(["gear", "plant", "rock", "ornament"] as const).map((kind) => (
            <section key={kind} className="aqua-card">
              <header><strong>{KIND_LABEL[kind]}</strong>{kind === "gear" && <small>종류마다 가장 좋은 하나만 들어요</small>}</header>
              <ul className="aqua-shop is-flat">
                {DECOR.filter((x) => x.kind === kind).map((x) => {
                  const better = gearOutclassed(a, x.key);
                  const combos = AQUA_COMBOS.filter((c) => c.a === x.key || c.b === x.key);
                  return (
                    <li key={x.key} className={better ? "is-locked" : ""}>
                      <button type="button" className="aqua-shop-pic aqua-preview-trigger" aria-label={`${x.name} 3D 미리보기`} onClick={() => setInspect(x.key)}><DecorArt artKey={x.key} /><small>3D 보기</small></button>
                      <span className="min-w-0 flex-1">
                        <strong>{x.name}</strong>
                        <small>
                          {x.effect ? `${EFFECT_LABEL[x.effect.type]} +${Math.round(x.effect.amount * 100)}%` : `아름다움 +${decorBeauty(x)}`}
                          {(a.bag[x.key] ?? 0) > 0 ? ` · 보관 ${a.bag[x.key]}` : ""}
                        </small>
                        {better && <small className="aqua-lock">이미 더 좋은 {josa(better, "이/가")} 있어요 — 사도 안 들어요</small>}
                        {combos.length > 0 && <small>조합: {combos.map((c) => `${c.name}(${decorOf(c.a === x.key ? c.b : c.a)?.name})${(a.combos ?? []).includes(c.id) ? " ✓" : ""}`).join(" · ")}</small>}
                      </span>
                      <ActionButton disabled={busy || coins < x.price} onClick={() => { setJustBought(x.key); void act((st, t) => buyDecor(st, x.key, t)); }}>
                        <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {tab === "dex" && (
        <>
          <p className="aqua-note mt-3">
            만난 물고기 {ALL_FORMS.filter((x) => seenForms.has(x.key)).length}/{ALL_FORMS.length} · 치어 · 어린 모습 · 다 큰 모습이 각각 한 칸이에요
            {Object.keys(a.released ?? {}).length > 0 && ` · 바다로 보내 준 물고기 ${Object.values(a.released ?? {}).reduce((n, v) => n + v, 0)}마리`}
            {` · 찾은 장식 조합 ${(a.combos ?? []).length}/${AQUA_COMBOS.length}`}
          </p>
          <div className="aqua-food mt-2" role="radiogroup" aria-label="도감 거르기">
            {DEX_FILTERS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={dexFilter === k} className={`tap ${dexFilter === k ? "is-on" : ""}`} onClick={() => setDexFilter(k)}>{label}</button>)}
          </div>
          <MorphDexCard a={a} />
          <div className="aqua-dex-fams">
          {FAMILIES.map((fam) => {
            const forms = ALL_FORMS.filter((x) => x.family === fam.key);
            const met = forms.filter((x) => seenForms.has(x.key)).length;
            const shown = forms.filter((x) => (dexFilter === "seen" ? seenForms.has(x.key) : dexFilter === "missing" ? !seenForms.has(x.key) : true));
            if (!shown.length) return null;
            return (
              <details key={fam.key} className="aqua-card aqua-dex-fam" open={dexFilter !== "all" ? true : undefined}>
                <summary><strong>{fam.name}</strong><small>{met}/{forms.length}{a.released?.[fam.key] ? ` · 보내 줌 ${a.released[fam.key]}` : ""}</small></summary>
                <div className="aqua-dex">
                  {shown.map((form) => {
                    const seen = seenForms.has(form.key);
                    const idx = form.species ? fam.finals.findIndex((x) => x.key === form.species) : -1;
                    return (
                      <div key={form.key} className={seen ? "" : "is-hidden"}>
                        <span className="aqua-dex-pic">{seen ? <FishArt artKey={form.key} /> : <b aria-hidden>?</b>}</span>
                        <small>{seen ? fishName(form) : "???"}</small>
                        <span className={gradeClass(form.grade)}>{form.grade}</span>
                        {!seen && <small className="aqua-dex-hint">{dexHint(fam.key, form.stage, idx)}</small>}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
          </div>
        </>
      )}
      </div>

      {news[0] && !replaying && !photoOpen && <GrownCard key={news[0].n} g={news[0]} waits={tab === "tank" && eatenCardWaits(news[0].n, news.filter((x) => x.ate).map((x) => x.n), mealDone)} morph={news[0].egg ? (a.morph?.by[String(news[0].id)] ?? null) : null} onNext={() => setLocalSeen(news[0].n)} onReplay={() => { setLocalSeen(news[0].n); startReplay(news[0].n); }} />}
      {inspect && <DecorPreview artKey={inspect} onClose={() => setInspect(null)} />}
    </div>,
  );
}

/** 상성 주의 한 줄 — 짝을 하나씩 늘어놓으면 '표범상어 → 베타 · 표범상어 → 디스커스 외 102' 처럼 읽을 수 없었다. 사냥꾼끼리 묶는다 */
export function dangerLine(dangers: { pred: AquaFish; prey: AquaFish }[]): string {
  const preds = new Map<number, AquaFish>(), prey = new Set<number>();
  for (const d of dangers) { preds.set(d.pred.id, d.pred); prey.add(d.prey.id); }
  const names = [...new Set([...preds.values()].map(fishName))];
  const who = names.length > 2 ? `${names.slice(0, 2).join(" · ")} 외 ${names.length - 2}종` : names.join(" · ");
  return `${josa(who, "이/가")} 작은 물고기 ${prey.size}마리를 노려요`;
}

function GrownCard({ g, morph, waits, onNext, onReplay }: { g: AquaNews; morph: Morph | null; waits: boolean; onNext: () => void; onReplay?: () => void }) {
  // 잡아먹기 소식은 수조의 사냥 장면이 끝난 뒤에 — 카드가 장면을 가리면 안 된다. waits = 수조가 그리는 장면(안 본 잡아먹기 중 가장 새 것)이고 그 번호의 끝 알림 전(hunt.ts eatenCardWaits).
  //   다른 카드(그려지지 않는 장면 · 자람 · 알)는 바로. 끝 알림을 못 들으면(장면을 못 열었다 · 옛 수조) 가장 긴 장면 + 모델을 기다리는 상한 뒤에
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!waits) return;
    const t = setTimeout(() => setLate(true), (MEAL_LONGEST + MEAL_WAIT_MAX) * 1000 + 300);
    return () => clearTimeout(t);
  }, [waits]);
  if (waits && !late) return null;
  return g.ate ? <EatenCard g={g} onNext={onNext} onReplay={onReplay} /> : <GrownCardInner g={g} morph={morph} onNext={onNext} />;
}

function EatenCard({ g, onNext, onReplay }: { g: AquaNews; onNext: () => void; onReplay?: () => void }) {
  const ref = useDialogFocus(true, onNext);
  const pred = { family: g.family, stage: g.stage, species: g.species }, prey = g.ate!;
  return (
    <div className="aqua-grown is-eaten" role="dialog" aria-modal="true" aria-label="물고기가 잡아먹혔어요" ref={ref} tabIndex={-1}>
      <div>
        <p className="aqua-grown-kicker">잡아먹혔어요…</p>
        <span className="aqua-eaten-pics"><span className="aqua-grown-pic"><FishArt artKey={fishArtKey(pred)} /></span><i aria-hidden>▶</i><span className="aqua-grown-pic is-gone"><FishArt artKey={fishArtKey(prey)} /></span></span>
        <strong>{josa(fishName(pred), "이/가")} {josa(fishName(prey), "을/를")} 잡아먹었어요</strong>
        <small className="aqua-note">상성이 안 맞는 물고기는 배가 고프면 사냥해요. 포만을 {HUNGRY_BELOW} 위로 두면 안전해요</small>
        <ActionButton main wide data-dialog-initial onClick={onNext}>확인</ActionButton>
        {onReplay && <ActionButton wide onClick={onReplay}>▶ 사냥꾼 시점으로 다시 보기</ActionButton>}
      </div>
    </div>
  );
}

function GrownCardInner({ g, morph, onNext }: { g: AquaNews; morph: Morph | null; onNext: () => void }) {
  const ref = useDialogFocus(true, onNext);
  const look = { family: g.family, stage: g.stage, species: g.species };
  const sp = speciesOf(g.species);
  return (
    <div className="aqua-grown" role="dialog" aria-modal="true" aria-label={g.egg ? "알에서 치어가 나왔어요" : "물고기가 자랐어요"} ref={ref} tabIndex={-1}>
      <div>
        <p className="aqua-grown-kicker">{g.egg ? (morph ? `${MORPH_INFO[morph].name} 변이 치어가 나왔어요!` : "알에서 치어가 나왔어요!") : g.stage === 2 ? "최종 형태!" : "쑥쑥 자랐어요"}</p>
        <span className="aqua-grown-pic"><FishArt artKey={fishArtKey(look)} morph={morph} /></span>
        <strong>{fishName(look)}</strong>
        {morph && <small className="aqua-note">{MORPH_INFO[morph].desc} · 변이 도감에 남아요</small>}
        {sp && <span className={gradeClass(sp.grade)}>{sp.grade}</span>}
        <ActionButton main wide data-dialog-initial onClick={onNext}>확인</ActionButton>
      </div>
    </div>
  );
}

/** 계절 수조 행사 카드(2026-11-13) — 지금 열린 행사 · 남은 날 · 규칙 한 줄 · 한정 장식 받기. 행사가 없으면 다음 행사를 미리 알린다 */
function EventCard({ events, next, busy, claimed, why, onClaim }: {
  events: readonly ActiveEvent[]; next: { def: { name: string }; start: string; inDays: number } | null; busy: boolean;
  claimed: (id: string) => boolean; why: (k: AquaEventKey) => string | null; onClaim: (k: AquaEventKey) => void;
}) {
  if (!events.length) {
    if (!next) return null;
    return <p className="aqua-note aqua-event-next">다음 수조 행사 · {next.def.name} — {monthDay(next.start)}부터({next.inDays}일 뒤)</p>;
  }
  return (
    <section className="aqua-card aqua-event" aria-label="계절 수조 행사">
      {events.map((e) => {
        const got = claimed(e.id), block = got ? null : why(e.def.key);
        return (
          <div key={e.id} className="aqua-event-row" style={{ ["--ev" as string]: hex(e.def.decor.tint) }}>
            <header><strong>{e.def.name}</strong><small>{e.daysLeft <= 1 ? "오늘까지" : `${e.daysLeft}일 남았어요`}</small></header>
            <p className="aqua-note">{e.def.blurb}</p>
            <div className="aqua-event-claim">
              <span className="aqua-event-swatch" aria-hidden />
              <span className="min-w-0 flex-1"><b>{e.def.decor.name}</b><small>한정 장식 · 행사마다 한 번</small></span>
              <ActionButton main={!got && !block} disabled={busy || got || !!block} onClick={() => onClaim(e.def.key)}>{got ? "받았어요" : "받기"}</ActionButton>
            </div>
            {!got && block && <p className="aqua-note">{block}</p>}
          </div>
        );
      })}
    </section>
  );
}

function Meter({ label, value, marks = [] }: { label: string; value: number; marks?: { at: number; label: string }[] }) {
  const v = Math.round(value);
  const low = marks.length ? v < marks[0].at : v < 30;
  return (
    <div className="aqua-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-valuetext={`${label} ${v}${marks.length ? ` — ${marks.map((m) => `${m.label} ${m.at}`).join(" · ")}` : ""}`}>
      <span>{label}</span>
      <i aria-hidden>
        <b className={low ? "is-low" : ""} style={{ width: `${v}%` }} />
        {marks.map((m) => <s key={m.at} style={{ left: `${m.at}%` }} title={`${m.label} ${m.at}`} />)}
      </i>
      <em>{v}</em>
    </div>
  );
}

function FishCard({ f, a, seen, now, who, couple, busy, onRelease, onName }: {
  f: AquaFish; a: AquaState; seen: Set<string>; now: number; who: string; couple: boolean; busy: boolean; onRelease: () => void;
  /** 이름 짓기 · 지우기(빈 값) — 저장까지 끝나면 true */
  onName: (name: string) => Promise<boolean>;
}) {
  const fam = familyOf(f.family);
  const cq = fishCare(f);
  const sp = speciesOf(f.species);
  const pct = fam ? Math.min(100, Math.round((f.growH / fam.hours) * 100)) : 0;
  const forms = fam?.finals.length ?? 1;
  const next = fam && f.stage !== 2 ? nextForm(fam, cq) : null;
  const fav = FAVORITE_DECOR[f.family];
  const favOn = !!fav && a.placed.some((p) => p.key === fav);
  const reward = releaseReward(f);
  const morph = fishMorph(a, f), nick = fishNick(a, f.id), age = fishAge(a, f.id, now);
  return (
    <section className="aqua-card" aria-label={`${nick ?? fishName(f)} 자세히`}>
      <div className="aqua-row">
        <span className="aqua-thumb is-big"><FishArt artKey={fishArtKey(f)} morph={morph} /></span>
        <span className="min-w-0 flex-1">
          {nick && <strong className="aqua-fish-nick block truncate">{nick}</strong>}
          <strong className="block truncate">{fishName(f)} · {fmtCm(fishCm(f))}</strong>
          <span className="aqua-fish-meta">
            <MorphTag morph={morph} />
            {age && <small className="aqua-note">우리 수조 {age.days}일째{age.approx ? " 넘게" : ""}</small>}
          </span>
          {f.stage === 2 && sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small className="aqua-note">성장 {pct}% · {duration(hoursLeft(a, f))} 남음 · 정성 {cq}</small>}
        </span>
        <ActionButton onClick={onRelease}>보내 주기 <span className="aqua-price"><Coin /> {reward.toLocaleString()}</span></ActionButton>
      </div>
      {f.crown && <p className="aqua-warn">낚시터의 주인이에요 — 보내면 다시 잡기까지 며칠을 겨뤄야 해요.</p>}
      {f.stage !== 2 && fam && (
        <>
          <div className="aqua-care" role="meter" aria-label="정성" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cq} aria-valuetext={`정성 ${cq}`}>
            <i aria-hidden>
              <b style={{ width: `${cq}%` }} />
              {forms > 1 && CARE_MARKS.slice(0, forms - 1).map((m) => <s key={m} style={{ left: `${m}%` }} />)}
            </i>
            {forms > 1 && <small>{CARE_MARKS.slice(0, forms - 1).map((m) => <span key={m} style={{ left: `${m}%` }}>{m}</span>)}</small>}
          </div>
          {forms > 1 ? (
            <>
              <p className="aqua-note mt-1">지금 정성이면 최종 형태 {openFinals(cq)}/{forms}까지 열려요 · 아직 못 만난 형태가 먼저 나와요.</p>
              {next && (
                <p className="aqua-note aqua-next">
                  <span className="aqua-silhouette" aria-hidden><FishArt artKey={next.sp.key} /></span>
                  {seen.has(next.sp.key) ? next.sp.name : "다음 형태"} — 정성 {next.care} 넘게 키우면 열려요
                </p>
              )}
            </>
          ) : <p className="aqua-note mt-1">다 크면 {josa(fam.finals[0].name, "이/가")} 돼요.</p>}
          <p className="aqua-note">하루 두 번 먹이를 주고 물을 깨끗하게 하면 정성이 올라요 · 둘이 같은 날 돌보면 조금 더.</p>
        </>
      )}
      <p className="aqua-note">
        좋아하는 먹이 {foodOf(likedFood(f.family))?.name}
        {fav ? ` · 좋아하는 장식 ${decorOf(fav)?.name}${favOn ? "(놓여 있어요 — 정성이 더 빨리 차요)" : "(놓아 주면 정성이 더 빨리 차요)"}` : ""}
      </p>
      {morph && <p className="aqua-note">{MORPH_INFO[morph].name} 변이 — {MORPH_INFO[morph].desc}. 보기만 달라요(값 · 성장은 같아요)</p>}
      <NameForm nick={nick ?? ""} busy={busy} onName={onName} />
      <FishStory f={f} a={a} who={who} couple={couple} />
    </section>
  );
}

/** 색 변이 표 — 변이가 없으면 아무것도 안 그린다 */
function MorphTag({ morph }: { morph: Morph | null }) {
  if (!morph) return null;
  return <span className={`aqua-morph-tag is-${morph}`}>{MORPH_INFO[morph].name}</span>;
}

/** 이름 짓기 — 10글자(자소 묶음) · 주소 금지는 엔진(nameFish)이 다시 본다. 한글 조합 중 Enter 는 보내지 않는다 */
function NameForm({ nick, busy, onName }: { nick: string; busy: boolean; onName: (name: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(nick);
  const [err, setErr] = useState<string | null>(null);
  const n = graphemes(normalizeShortText(draft)).length;
  const same = normalizeShortText(draft) === nick;
  async function submit() {
    const c = checkFishName(draft);
    if (!c.ok) { setErr(c.reason); return; }
    setErr(null);
    if (await onName(c.name)) setDraft(c.name);
  }
  return (
    <form className="aqua-name" onSubmit={(e) => { e.preventDefault(); if (!busy && !same) void submit(); }}>
      <label>
        <span>이름</span>
        <input value={draft} maxLength={40} placeholder="이름을 지어 주세요" enterKeyHint="done" autoComplete="off" aria-describedby="aqua-name-count"
          onChange={(e) => { setDraft(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault(); }} />
        <small id="aqua-name-count" className={n > NAME_LEN ? "is-over" : ""}>{n}/{NAME_LEN}</small>
      </label>
      <ActionButton type="submit" disabled={busy || same || n > NAME_LEN}>{nick && !normalizeShortText(draft) ? "지우기" : "저장"}</ActionButton>
      {err && <p className="aqua-warn" role="alert">{err}</p>}
    </form>
  );
}

/** 개체 이야기 — 오래된 것부터. 처음 한 줄(어떻게 왔나)과 최근 11줄이 남는다 */
function FishStory({ f, a, who, couple }: { f: AquaFish; a: AquaState; who: string; couple: boolean }) {
  const log = a.life?.log[String(f.id)] ?? [];
  if (!log.length) return null;
  return (
    <section className="aqua-story" aria-label="이 물고기의 이야기">
      <strong>이야기</strong>
      <ol>
        {log.map((e, i) => {
          const [when, text] = storyLine(e, { who, couple, a });
          return <li key={`${e.t}-${i}`}><small>{when}</small><span>{text}</span></li>;
        })}
      </ol>
    </section>
  );
}

/** 추모 칸 — 떠난 물고기(잡아먹힘 · 보내 줌 · 옛 앱에서 떠남) 최근 30마리 */
/** 수조 조명 가게(2026-11-18) — 다 산 뒤 쌓이는 하트를 받는 늦은 소모처. 빛 색만 바뀐다(능력치 없음 · 되팔기 없음).
 *  사다리 순서대로 들인다 — 다음 하나만 '들이기', 그 뒤는 잠금. 가진 조명은 눌러 켜고 끈다(둘이 같이 보는 수조라 켠 것은 하나) */
function LightShop({ owned, on, coins, busy, onBuy, onSet }: { owned: readonly string[]; on: string | null; coins: number; busy: boolean; onBuy: (key: string) => void; onSet: (key: string | null) => void }) {
  const next = AQUA_LIGHTS.find((x) => !owned.includes(x.key));
  return (
    <section className="aqua-card aqua-light-shop">
      <header><strong>수조 조명</strong><small>빛 색만 바뀌어요 · {owned.length}/{AQUA_LIGHTS.length}</small></header>
      <ul className="aqua-shop is-flat">
        {AQUA_LIGHTS.map((x) => {
          const have = owned.includes(x.key), isOn = on === x.key, locked = !have && next?.key !== x.key;
          return (
            <li key={x.key} className={locked ? "is-locked" : ""}>
              <i className={`aqua-light-swatch ${isOn ? "is-on" : ""}`} style={{ background: x.swatch }} aria-hidden />
              <span className="min-w-0 flex-1">
                <strong>{x.name}</strong>
                <small>{x.desc}{locked && next ? ` · ${next.name} 다음에 들여요` : ""}</small>
              </span>
              {have ? (
                <ActionButton main={isOn} disabled={busy} onClick={() => onSet(isOn ? null : x.key)}>{isOn ? "켜짐" : "켜기"}</ActionButton>
              ) : (
                <ActionButton disabled={busy || locked || coins < x.price} onClick={() => onBuy(x.key)}><span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span></ActionButton>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MemorialCard({ a }: { a: AquaState }) {
  const list = a.life?.memorial ?? [];
  return (
    <details className="aqua-card aqua-memorial">
      <summary><strong>추모 칸</strong><small>떠난 물고기 {list.length}마리 · 최근 30마리까지 남아요</small></summary>
      <ul>
        {list.map((m) => {
          const l = memorialLine(m, a);
          return (
            <li key={m.id}>
              <span className="aqua-thumb"><FishArt artKey={m.key} morph={m.morph ?? null} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate">{l.name}{l.name !== l.form ? <small> {l.form}</small> : null} <MorphTag morph={m.morph ?? null} /></strong>
                <small className="block">{l.cause}</small>
                <small className="block">{l.span}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** 변이 도감 — 계열마다 만난 변이(알에서 깬 수). 낚시로는 안 오고 수조의 알에서만 나온다 */
function MorphDexCard({ a }: { a: AquaState }) {
  const rows = morphDex(a.morph);
  const byFam = new Map<string, Map<Morph, number>>();
  for (const r of rows) {
    const m = byFam.get(r.family) ?? new Map<Morph, number>();
    m.set(r.morph, r.n);
    byFam.set(r.family, m);
  }
  const kinds = new Set(rows.map((r) => r.morph));
  return (
    <section className="aqua-card aqua-morph-dex" aria-label="변이 도감">
      <header><strong>변이 도감</strong><small>만난 변이 {rows.length}칸 · 종류 {kinds.size}/{MORPHS.length}</small></header>
      <p className="aqua-note">수조의 알에서 드물게 색이 다른 치어가 깨어나요(5%). 엄마 · 아빠가 변이면 더 잘 나오고 닮기도 해요. 보기만 달라요.</p>
      <ul className="aqua-morph-legend">
        {MORPHS.map((m) => <li key={m}><MorphTag morph={m} /><small>{MORPH_INFO[m].desc}</small></li>)}
      </ul>
      {byFam.size > 0 && (
        <ul className="aqua-morph-rows">
          {[...byFam].map(([fam, got]) => (
            <li key={fam}>
              <span className="aqua-thumb"><FishArt artKey={`fry_${fam}`} /></span>
              <strong className="min-w-0 flex-1 truncate">{familyOf(fam)?.name ?? fam}</strong>
              <span className="aqua-morph-cells">
                {MORPHS.map((m) => (
                  <span key={m} className={`aqua-morph-cell ${got.has(m) ? "is-seen" : ""}`} title={MORPH_INFO[m].name}>
                    {got.has(m) ? <><b className={`aqua-morph-dot is-${m}`} aria-hidden />{MORPH_INFO[m].name} {got.get(m)}</> : "?"}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 안내 띠를 5초 뒤 접는다 — 같은 글이 다시 오면 시계를 새로 잰다 */
function MsgTimer({ msg, hold, onDone }: { msg: string; hold: boolean; onDone: () => void }) {
  useEffect(() => {
    if (hold) return;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [msg, hold]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
