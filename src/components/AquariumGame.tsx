"use client";

/* 우리 수조 화면 — 규칙은 전부 lib/aquarium(순수). 여기는 그리기와 저장뿐이다.
 * 저장은 사람이 무언가 했을 때 + 정산에 저장할 변화(자람 · 알 · 그물 판매 · 오늘의 손님 · 시계 보정)가 있을 때만 한다(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더).
 * 매분 다시 그리는 건 저장하지 않는 미리보기다. */
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { GameCoach, GameHead, coachSeen } from "@/components/GameHead";
import { SPOTS, formsSeen, releaseToSea, releaseXp } from "@/lib/fishing";
import { fmtCm } from "@/lib/fishingworld";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { getAuthInfo } from "@/lib/auth";
import { josa } from "@/lib/josa";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DecorArt, FishArt } from "@/components/AquaArt";
import Aquarium3D from "@/components/Aquarium3D";
import DecorPreview from "@/components/DecorPreview";
import { Coin } from "@/components/island/UiIcon";
import { confirmDialog } from "@/lib/confirm";
// 먹이를 줄 때마다 뿌리는 자리가 다르다(같은 횟수 = 같은 자리) — 늘 가운데라 터널 축 · 돔 한가운데로 몰렸다(2026-11-11)
import { feedSpot } from "@/lib/aqua3d/world";
import {
  ALL_FORMS, AQUA_COMBOS, BEAUTY_GROW_CAP, CARE_MARKS, DECOR, FAMILIES, FAVORITE_DECOR, FOODS, GOOD_HUNGER, GOOD_WATER, GRADES, MIN_WATER, NET_MAX, TANKS, WIDE_STEPS,
  aquaEffects, buyDecor, careHoursLeft, careToOpen, claimRequest, cleanWater, decorBeauty, decorOf, decorPose, familyOf, feedFish, fishArtKey, fishCare, fishCm, fishCount,
  fishName, fishRoom, foodOf, gearOutclassed, growBlock, hoursLeft, junkCoupons, likedFood, makeFood, moveDecor, netHoursLeft, netToTank, nextForm, openFinals, placeDecor,
  releaseReward, requestMet, requestText, seeNews, sellNet, speciesOf, storeDecor, syncAqua, tankGate, tankOf, unseenNews, upgradeTank, waterPrice, widenTank,
  type AquaFish, type AquaNews, type AquaResult, type AquaState, type DecorKind, type Grade, type PlacedDecor,
} from "@/lib/aquarium";
import { loadIsland, saveIsland, watchIsland, type IslandRow } from "@/lib/couple";
import { gameNow } from "@/lib/islandsync";
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
const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;
/** 도감 빈칸의 길잡이 — 어디서 잡히나 · 정성 얼마면 열리나 */
function dexHint(family: string, stage: 0 | 1 | 2, index: number): string {
  if (stage === 2) return index <= 0 ? "다 키우면 만나요" : `정성 ${careToOpen(index)} 넘게 키우면`;
  const spots = SPOTS.filter((s) => s.pool.some(([k]) => k === family)).map((s) => s.name);
  return spots.length ? `${spots[0]}${spots.length > 1 ? ` 외 ${spots.length - 1}곳` : ""}에서 잡혀요` : "때 손님 · 주인으로 와요";
}

export default function AquariumGame({ coupleId, myUserId, onClose, onOpenIsland, onFish, onFeedFx }: {
  coupleId: string | null;
  /** 누가 보는가 — 소식 · 둘이 돌봄을 사람마다 센다. 빠지면 로그인 정보에서 찾는다(혼자 섬은 "me") */
  myUserId?: string | null;
  onClose: () => void;
  onOpenIsland: () => void;
  onFish: () => void;
  /** 먹이를 준 순간 — 3D 수조의 먹이 연출을 부르는 자리(부르는 쪽이 Aquarium3D 에 잇는다) */
  onFeedFx?: () => void;
}) {
  useBackClose(onClose);
  const [coach, setCoach] = useState(() => !coachSeen("aquarium"));
  /** 먹이를 준 횟수 — 3D 수조가 바뀐 걸 보고 물고기를 수면으로 모은다(scene.feed) */
  const [feedN, setFeedN] = useState(0);
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
  // 10 · 11단계는 하트만으론 못 산다 — 낚시 기록 조건과 진행을 버튼 위에 보인다(upgradeTank 와 같은 판정)
  const nextGate = tankGate(view.state, a, a.tank + 1);
  const tk = tankOf(a);
  const fx = aquaEffects(a);
  const block = a.fish.length ? growBlock(a) : null;
  const left = careHoursLeft(a);
  const sel = a.fish.find((f) => f.id === selFish) ?? null;
  const decorSel = a.placed.find((p) => p.id === selDecor) ?? null;
  const bagList = Object.entries(a.bag).filter(([, n]) => n > 0);
  const nextTank = TANKS[a.tank];
  const nextWide = WIDE_STEPS[a.wide ?? 0];
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
    const ok = await confirmDialog(f.crown ? {
      // 주인은 며칠을 겨뤄 잡았고, 다시 나타나기까지 7일이 걸린다 — 흔한 물고기와 같은 확인창으로 보내면 안 된다
      message: `${f.crown} — 낚시터의 주인이에요. 정말 보내 줄까요?`,
      detail: `하트 ${reward.toLocaleString()}개를 받아요. 주인은 다시 잡으려면 며칠을 다시 겨뤄야 하고, 왕관 쓴 모습은 수조에서 사라져요.`,
      confirmText: "그래도 보내 주기",
      danger: true,
    } : {
      message: `${josa(fishName(f), "을/를")} 보내 줄까요?`,
      detail: `하트 ${reward.toLocaleString()}개${xp > 0 ? ` · 낚시 경험치 +${xp}` : ""}를 받아요.${f.stage !== 2 ? " 다 키워서 보내면 더 받아요." : ""} 도감 기록은 남아요.`,
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
          <button key={k} type="button" role="tab" id={`aqua-tab-${k}`} aria-controls={`aqua-panel-${k}`} aria-selected={tab === k} className={`tap ${tab === k ? "is-on" : ""}`} disabled={busy} onClick={() => { setTab(k); setDraft(null); setPlacing(null); setMoving(false); }}>{label}</button>
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
            <Aquarium3D feedSignal={feedN} feedX={feedSpot(feedN, a.wide)} view={{ aquarium: a, editing, placing: !!placing || moving, selectedFish: selFish, selectedDecor: selDecor, preview: draft }}
              onFish={id => setSelFish(selFish === id ? null : id)}
              onDecor={id => { if (!placing && !moving) setSelDecor(id); }} onPlace={onPlaceAt} />
          </div>

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
                  disabled={busy} onClick={() => { setSelDecor(p.id); setMoving(false); setPlacing(null); setDraft(null); }}>{decorOf(p.key)?.name}</ActionButton>)}
              </div>}
              {decorSel && !moving ? (
                <div className="aqua-row">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{decorOf(decorSel.key)?.name}</span>
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
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {sel && !editing && <FishCard f={sel} a={a} seen={seenForms} onRelease={() => void release(sel)} />}

          {a.req && (
            <section className="aqua-card aqua-req">
              <header><strong>오늘의 손님</strong><small><Coin /> {a.req.reward}</small></header>
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
                옆으로 늘리기 {(a.wide ?? 0) + 1}/{WIDE_STEPS.length} · 물고기 +{nextWide.fish} · 장식 +{nextWide.decor} <span className="aqua-price"><Coin /> {nextWide.price.toLocaleString()}</span>
              </ActionButton>
            ) : <p className="aqua-note">어항을 끝까지 늘렸어요</p>}
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
                      <button type="button" className={`tap ${selFish === f.id ? "is-on" : ""}`} aria-pressed={selFish === f.id} onClick={() => setSelFish(selFish === f.id ? null : f.id)}>
                        <span className="aqua-thumb"><FishArt artKey={fishArtKey(f)} /></span>
                        <span className="min-w-0 flex-1 truncate font-bold">{fishName(f)} <small className="font-normal">{fmtCm(fishCm(f))}{f.bred ? " · 수조에서 태어남" : ""}</small></span>
                        {f.stage === 2 && sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small>{duration(hoursLeft(a, f))} 남음</small>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === "decor" && (
        <>
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

      {news[0] && <GrownCard key={news[0].n} g={news[0]} onNext={() => setLocalSeen(news[0].n)} />}
      {inspect && <DecorPreview artKey={inspect} onClose={() => setInspect(null)} />}
    </div>,
  );
}

function GrownCard({ g, onNext }: { g: AquaNews; onNext: () => void }) {
  const ref = useDialogFocus(true, onNext);
  const look = { family: g.family, stage: g.stage, species: g.species };
  const sp = speciesOf(g.species);
  return (
    <div className="aqua-grown" role="dialog" aria-modal="true" aria-label={g.egg ? "알에서 치어가 나왔어요" : "물고기가 자랐어요"} ref={ref} tabIndex={-1}>
      <div>
        <p className="aqua-grown-kicker">{g.egg ? "알에서 치어가 나왔어요!" : g.stage === 2 ? "최종 형태!" : "쑥쑥 자랐어요"}</p>
        <span className="aqua-grown-pic"><FishArt artKey={fishArtKey(look)} /></span>
        <strong>{fishName(look)}</strong>
        {sp && <span className={gradeClass(sp.grade)}>{sp.grade}</span>}
        <ActionButton main wide data-dialog-initial onClick={onNext}>확인</ActionButton>
      </div>
    </div>
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

function FishCard({ f, a, seen, onRelease }: { f: AquaFish; a: AquaState; seen: Set<string>; onRelease: () => void }) {
  const fam = familyOf(f.family);
  const cq = fishCare(f);
  const sp = speciesOf(f.species);
  const pct = fam ? Math.min(100, Math.round((f.growH / fam.hours) * 100)) : 0;
  const forms = fam?.finals.length ?? 1;
  const next = fam && f.stage !== 2 ? nextForm(fam, cq) : null;
  const fav = FAVORITE_DECOR[f.family];
  const favOn = !!fav && a.placed.some((p) => p.key === fav);
  const reward = releaseReward(f);
  return (
    <section className="aqua-card">
      <div className="aqua-row">
        <span className="aqua-thumb is-big"><FishArt artKey={fishArtKey(f)} /></span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{fishName(f)} · {fmtCm(fishCm(f))}</strong>
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
