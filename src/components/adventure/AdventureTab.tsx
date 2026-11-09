"use client";
/* 모험 탭 — 지역 · 팀 · 도감 · 상점. 저장은 사람마다 한 행(lib/adventurestore). README §14.6
 * ⚠ 이 게임의 생물 · 기술 · 규칙은 전부 이 앱 것이다(원작 게임 자료를 쓰지 않는다 — lib/adventure 머리 주석). */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  BALLS, CHARMS, CHARM_KEYS, DEX_REWARDS, ITEMS, MOVES, TRAITS, PARTY_MAX, REGIONS, SPECIES, SPECIES_KEYS, STARTERS, TYPE_COLOR, MISSIONS, TOWER_MAX, bossLevel, claimDex, claimMission, cycleCharm, dailyOf, effectiveness, finishBattle, healMon, learnedAt, movesOf, newSave, nextGoal, openChest, openLevel, regionOpen, releaseMon,
  startBoss, startTower, startTrainer, startWild, statsOf, towerLevel, towerOpen, towerRegion, towerReward, towerTeam, trainersOf, applyItem, type AdvSave, type BallKey, type Battle, type ItemKey, type Mon, type MonType, type Region,
} from "@/lib/adventure";
import { useDayTick } from "@/lib/useDayTick";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { confirmDialog } from "@/lib/confirm";
import * as advStore from "@/lib/adventurestore";
import { isSupabaseConfigured } from "@/lib/supabase";
import TabHeader from "@/components/TabHeader";
import SegmentedControl from "@/components/SegmentedControl";
import StatePanel from "@/components/StatePanel";
import MonArt from "@/components/adventure/MonArt";
import { CloseButton } from "@/components/AppButtons";
// ⚠ BattleView · lib/arena · lib/battlefx 는 정적으로 부르지 않는다 — 탭을 열 때 전투 코드까지 받았다(advui.test)
import { BallIcon, HpBar, SHAPE_LABEL, XpBar, moveTags } from "@/components/adventure/advui";
import { enterBattleFullscreen } from "@/lib/battlefull";
import { josa } from "@/lib/josa";
import type { FieldState } from "@/lib/adventurefield";

const { loadAdventure, saveAdventure, StaleSave } = advStore;
/** 저장소의 바로 보내기(flushAdventure) — 전투가 끝난 틱 · 화면을 떠날 때 · 연결이 돌아올 때 */
const store = advStore;

const BattleView = dynamic(() => import("@/components/adventure/BattleView"), { ssr: false });
// 온라인 대전 — 대전 칸을 열 때 받는다
const DuelPanel = dynamic(() => import("@/components/adventure/DuelPanel"), { ssr: false });
const FieldView = dynamic(() => import("@/components/adventure/FieldView"), { ssr: false });
// 보관한 기록(최근 셋) — 팀 칸 맨 아래 작은 줄
const SaveBackups = dynamic(() => import("@/components/adventure/SaveBackups"), { ssr: false });


type Sub = "map" | "team" | "duel" | "dex" | "shop";

export default function AdventureTab({ myUserId: signedIn }: { myUserId: string | null }) {
  // 서버 설정이 없는 로컬 모드(개발 · 체험)에선 이 기기에만 저장한다
  const myUserId = signedIn ?? (isSupabaseConfigured ? null : "local");
  const [save, setSave] = useState<AdvSave | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<Sub>("map");
  const [battle, setBattle] = useState<{ b: Battle; region: Region } | null>(null);
  const [result, setResult] = useState<{ title: string; notes: string[]; art: string[]; gold: number; xp: number; again?: Region } | null>(null);
  const [evos, setEvos] = useState<{ from: string; to: string }[]>([]);
  const [field, setField] = useState<Region | null>(null);
  const [fieldOutcome, setFieldOutcome] = useState<{ n: number; over: Battle["over"] } | null>(null);
  // 지역마다 걷던 필드 — 나갔다 들어와도 서 있던 자리 그대로(FieldView 가 읽고 쓴다, 날이 바뀌면 비운다). 2026-11-09
  const [fieldKeep] = useState(() => ({ day: "", m: new Map<string, FieldState>() }));
  // 오늘의 임무 · 상자는 KST 하루 — 탭을 켜 둔 채 자정을 넘기면 바뀐다(예전엔 연 순간의 날짜에 머물렀다)
  const today = useDayTick();
  const [toast, setToast] = useState<string | null>(null);
  const version = useRef(0);
  const saving = useRef<Promise<void>>(Promise.resolve());
  /** 아직 서버에 닿지 않은 마지막 저장 */
  const pending = useRef<AdvSave | null>(null);
  /** 판이 끝난 그 틱에 정산한 결과 — 연출 뒤 화면을 닫을 때 다시 셈하지 않는다 */
  const settled = useRef<{ b: Battle; out: ReturnType<typeof finishBattle> } | null>(null);
  /** 다른 기기가 앞서 쓴 저장(StaleSave)을 받았을 때 — commit · flush 가 같은 처리를 쓴다(flush 가 삼키지 않게) */
  const staleRef = useRef<(e: unknown) => boolean>(() => false);
  /** 전투 화면이 열려 있나 — 돌아왔을 때 다시 읽기가 판 도중의 저장을 바꾸지 않게 */
  const battleOpen = useRef(false);

  const load = useCallback(async () => {
    if (!myUserId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await loadAdventure(myUserId);
      version.current = s?.version ?? 0;
      setSave(s?.save ?? null);
      // 이 기기에만 있던 더 새 기록이 다른 기기의 저장과 부딪쳤다 — 저장소가 따로 보관했다(backup, 팀 칸의 '보관한 기록')
      // 앱을 꺼서 버린 판은 저장소가 정산했다(fight — 쓴 공 · 약은 그대로 빠지고 대장 · 트레이너는 진 것)
      const note = [s?.fight, s?.backup ? "이 기기에만 있던 기록은 따로 보관했어요(팀 › 보관한 기록) — 다른 기기에서 더 최근에 저장됐어요" : null].filter(Boolean).join(" · ");
      if (note) {
        setToast(note);
        window.setTimeout(() => setToast((t) => (t === note ? null : t)), 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [myUserId]);

  useEffect(() => {
    // 처음 열 때 한 번 — 탭을 열기 전엔 안 부른다(page 가 처음 열 때 그린다)
    void load();
  }, [load]);

  // 앱이 닫히거나(pagehide · 숨김) 연결이 돌아오면(online) 남은 저장을 바로 보낸다(저장소의 flushAdventure — 이 기기 사본은 그 자리에서 써진다)
  // 다른 기기가 앞서 썼으면(StaleSave) commit 과 같은 처리로 — 예전엔 삼켜서 이 기기가 옛 진행 위에서 계속 놀았다
  // 돌아오면(visible) 서버 버전만 가볍게 본다 — 다른 기기가 앞서 갔고 이 기기에 안 올린 진행이 없으면 다시 읽고, 둘 다 바뀌었으면 flush 가 충돌 길로 간다
  useEffect(() => {
    if (!myUserId) return;
    const flush = () => {
      void Promise.resolve(store.flushAdventure(myUserId)).catch((e) => void staleRef.current(e));
    };
    const checkServer = () => {
      if (battleOpen.current) return;
      void store.serverVersion(myUserId).then((v) => {
        if (v == null || battleOpen.current || v <= store.latestVersion(myUserId, version.current)) return;
        if (!store.hasPendingAdventure(myUserId) && !pending.current) void load();
        else flush();
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
      else checkServer();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [myUserId, load]);

  /** 다른 기기가 앞서 쓴 저장을 받았다 — 서버 것으로 잇는다(덮인 이 기기 진행은 저장소가 '보관한 기록'에 남겼다). 처리했으면 true */
  function onStale(e: unknown): boolean {
    if (!(e instanceof StaleSave) || !e.latest) return false;
    version.current = e.latest.version;
    setSave(e.latest.save);
    flash("다른 기기에서 진행한 기록을 불러왔어요 — 이 기기 것은 팀 › 보관한 기록에");
    return true;
  }
  useEffect(() => {
    staleRef.current = onStale;
    battleOpen.current = !!battle;
  });

  /** 저장은 차례대로(앞 저장이 끝난 뒤) — 버전이 엉키지 않게. 이 기기 사본은 줄을 기다리지 않고 지금 쓴다(멈춘 저장 뒤에 묶이지 않게) */
  function commit(next: AdvSave) {
    setSave(next);
    if (!myUserId) return;
    store.stageAdventure(myUserId, next, version.current);
    pending.current = next;
    saving.current = saving.current.then(async () => {
      try {
        const r = await saveAdventure(myUserId, next, version.current);
        version.current = r.version;
      } catch (e) {
        if (!onStale(e)) flash("저장하지 못했어요 — 연결을 확인해 주세요");
      } finally {
        if (pending.current === next) pending.current = null;
      }
    });
  }

  /** 지금까지의 저장을 서버까지 — 대전 팀 등록 전에(방금 잡은 생물이 서버 기록에 없으면 팀에서 빠진다) */
  async function syncNow() {
    if (!myUserId) return;
    await saving.current;
    await store.flushAdventure(myUserId).catch((e) => void onStale(e));
  }

  function flash(s: string) {
    setToast(s);
    window.setTimeout(() => setToast((t) => (t === s ? null : t)), 2600);
  }

  if (!myUserId) return <StatePanel kind="empty" title="로그인하면 모험을 시작할 수 있어요" />;

  const header = (
    <TabHeader emblem="game" eyebrow="생물을 잡고 키워요" title="모험" sub="지역을 돌며 공을 던져 잡고, 키운 팀으로 싸워요." />
  );

  if (loading && !save) return <div className="px-4">{header}<StatePanel kind="loading" title="모험 기록을 불러오는 중" /></div>;
  if (error && !save) return <div className="px-4">{header}<StatePanel kind="error" title="모험 기록을 불러오지 못했어요" detail={error} onRetry={() => void load()} /></div>;

  if (!save)
    return (
      <div className="px-4 pb-8">
        {header}
        <section className="adv-card mt-3">
          <h2 className="text-[15px] font-bold">함께 떠날 첫 생물을 골라 주세요</h2>
          <p className="mt-1 text-[12px] text-muted">셋 다 나중에 모두 만날 수 있어요. 속성 상성이 서로 물고 물려요.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {STARTERS.map((k) => {
              const sp = SPECIES[k];
              return (
                <button key={k} type="button" className="tap adv-starter" onClick={() => commit(newSave(k, (Date.now() ^ k.length * 7919) | 0))}>
                  <MonArt species={k} size={84} />
                  <b>{sp.name}</b>
                  <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );

  const s = save;
  const allDown = s.party.every((m) => m.hp <= 0);

  function explore(r: Region) {
    if (allDown) {
      flash("팀이 모두 지쳤어요 — 먼저 쉼터에서 쉬어요");
      return;
    }
    enterBattleFullscreen(); // 탭 안에서만 열린다 — 전투 화면이 뜨기 전에
    const { battle: b, save: next } = startWild(s, r);
    commit(withFight(next, b, r));
    setBattle({ b, region: r });
  }

  function encounter(species: string, level: number) {
    if (!field) return;
    const { battle: b, save: next } = startWild(s, field, { species, level });
    commit(withFight(next, b, field));
    setBattle({ b, region: field });
  }

  function trainer(r: Region, slot: number) {
    if (allDown) return flash("팀이 모두 지쳤어요 — 먼저 쉬어요");
    const { battle: b, save: next } = startTrainer(s, r, trainersOf(r)[slot]);
    commit(withFight(next, b, r));
    setBattle({ b, region: r });
  }

  function climb() {
    const floor = Math.min(TOWER_MAX, (s.tower ?? 0) + 1);
    enterBattleFullscreen();
    const { battle: b, save: next } = startTower(s, floor);
    commit(withFight(next, b, towerRegion(floor)));
    setBattle({ b, region: towerRegion(floor) });
  }

  function chest(r: Region, slot: number) {
    const got = openChest(s, r, slot, today);
    if (!got) return;
    commit(got.save);
    const g = got.reward;
    flash(`상자에서 골드 ${g.gold}${g.ball ? ` · ${BALLS[g.ball].name} ×${g.balls}` : ""}${g.item ? ` · ${ITEMS[g.item].name} ×${g.items}` : ""}!`);
  }

  function challenge(r: Region) {
    if (allDown) {
      flash("팀이 모두 지쳤어요 — 먼저 쉼터에서 쉬어요");
      return;
    }
    enterBattleFullscreen();
    const { battle: b, save: next } = startBoss(s, r);
    commit(withFight(next, b, r));
    setBattle({ b, region: r });
  }

  type Bag = { balls: Record<BallKey, number>; items: Record<ItemKey, number> };
  /** 판을 여는 저장에 '싸우는 중' 표시를 남긴다 — 앱을 꺼서 판을 버리면 다음 읽기가 정산한다(진 것 · 도망, 쓴 공 · 약은 그대로) */
  function withFight(next: AdvSave, b: Battle, r: Region): AdvSave {
    const kind = b.boss ? "boss" : b.tower != null ? "tower" : b.trainer ? "trainer" : "wild";
    return store.markFight(next, { kind, region: r.key, isBoss: !!b.boss });
  }
  /** 공을 던지거나 약을 쓴 그 틱에(BattleView onSpend) — 이 기기 사본에만 바로 쓴다(숨길 때 flush 가 서버까지). 앱을 꺼도 쓴 것은 쓴 것 */
  function spend(bag: Bag) {
    if (!myUserId) return;
    store.stageAdventure(myUserId, { ...s, balls: { ...bag.balls }, items: { ...bag.items } }, version.current);
  }
  /** 판이 끝난 그 틱에 진행을 저장한다(BattleView onSettle). 한 판에 한 번 */
  function settle(b: Battle, bag: Bag) {
    if (settled.current?.b === b) return settled.current.out;
    const out = finishBattle(s, b, bag, today);
    settled.current = { b, out };
    // 싸우는 중 표시를 지운다(최상위 칸은 합쳐 쓰므로 null 로)
    commit(store.clearFight(out.save));
    // 판이 끝난 저장은 바로 서버까지
    if (myUserId) {
      const uid = myUserId;
      void saving.current.then(() => store.flushAdventure(uid)).catch((e) => void onStale(e));
    }
    return out;
  }

  function endBattle(b: Battle, bag: Bag) {
    // 대개 이미 정산됐다(onSettle) — 포기처럼 틱 밖에서 끝난 판만 여기서 정산한다
    const out = settle(b, bag);
    settled.current = null;
    setBattle(null);
    setFieldOutcome((p) => ({ n: (p?.n ?? 0) + 1, over: b.over }));
    if (out.evos.length) setEvos(out.evos);
    const wild = SPECIES[b.sides[1].team[0].mon.species].name;
    const title = b.over === "win" ? `${b.boss ? "대장을 이겼다" : b.tower != null ? `${b.tower}층 돌파` : b.trainer ? "승부에서 이겼다" : "이겼다"}! 골드 +${out.gold}` : b.over === "caught" ? `${josa(wild, "을/를")} 잡았다!` : b.over === "run" ? "무사히 도망쳤다" : "졌다…";
    if (b.over === "run" && !out.notes.length) flash(title);
    else setResult({ title, notes: out.notes, art: out.evos.length ? out.art.filter((k) => !out.evos.some((e) => e.to === k)) : out.art, gold: out.gold, xp: out.xp, again: !field && !b.boss && b.over !== "lose" ? REGIONS.find((r) => r.key === b.region) : undefined });
  }

  const caughtN = s.caught.length;

  return (
    <div className="px-4 pb-10">
      {header}
      <div className="adv-strip mt-3">
        <span>골드 <b>{s.gold.toLocaleString()}</b></span>
        <span><BallIcon k="basic" /> <b>{s.balls.basic}</b> <BallIcon k="great" /> <b>{s.balls.great}</b> <BallIcon k="star" /> <b>{s.balls.star}</b></span>
        <span>도감 <b>{caughtN}</b>/{SPECIES_KEYS.length}</span>
        <span>뱃지 <b>{(s.badges ?? []).length}</b>/{REGIONS.length}</span>
      </div>
      <div className="mt-3">
        <SegmentedControl<Sub>
          value={sub}
          onChange={setSub}
          options={[
            { value: "map", label: "지역" },
            { value: "team", label: "팀" },
            { value: "dex", label: "도감" },
            { value: "duel", label: "대전" },
            { value: "shop", label: "상점" },
          ]}
        />
      </div>

      {sub === "map" && (
        <div className="mt-3 grid gap-3">
          <div className="adv-goal"><b>다음 목표</b><span>{nextGoal(s).text}</span></div>
          <section className="adv-card">
            <h2 className="adv-h">오늘의 임무</h2>
            <div className="mt-2 grid gap-1.5">
              {MISSIONS.map((m, i) => {
                const d = dailyOf(s, today);
                const got = Math.min(m.need, d[m.key]);
                const done = d.claimed.includes(i);
                return (
                  <div key={m.key} className="adv-mission">
                    <span>{m.label}<small>골드 {m.gold} · {BALLS[m.ball].name} ×{m.balls}</small></span>
                    <b>{got}/{m.need}</b>
                    <button type="button" className="tap adv-chip" disabled={done || got < m.need} onClick={() => { const n = claimMission(s, i, today); if (n) { commit(n); flash("임무 보상을 받았어요"); } }}>{done ? "받음" : "받기"}</button>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="adv-card flex items-center gap-3">
            <div className="flex -space-x-3">{s.party.slice(0, 3).map((m) => <MonArt key={m.id} species={m.species} size={40} mode={m.hp > 0 ? "full" : "faded"} />)}</div>
            <p className="min-w-0 flex-1 text-[12px]">
              {allDown ? "팀이 모두 지쳤어요" : `팀 ${s.party.length}마리 · 체력 ${Math.round((s.party.reduce((a, m) => a + m.hp, 0) / s.party.reduce((a, m) => a + statsOf(m).hp, 0)) * 100)}%`}
            </p>
            <button type="button" className="tap adv-btn" onClick={() => { commit({ ...s, party: s.party.map(healMon) }); flash("쉼터에서 푹 쉬었어요 — 모두 회복!"); }}>쉼터에서 쉬기</button>
          </div>
          {REGIONS.map((r) => {
            const open = regionOpen(s, r);
            const met = r.table.map(([k]) => k).filter((k, i, a) => a.indexOf(k) === i);
            return (
              <section key={r.key} className={`adv-region ${open ? "" : "is-locked"}`} style={{ background: `linear-gradient(${r.sky[0]}, ${r.sky[1]} 70%, ${r.ground} 70%)` }}>
                <div className="adv-region-mons" aria-hidden>
                  {met.slice(0, 5).map((k) => <MonArt key={k} species={k} size={46} mode={s.caught.includes(k) ? "full" : s.seen.includes(k) ? "faded" : "silhouette"} />)}
                </div>
                <div className="adv-region-body">
                  <h3>{r.name} <small>Lv.{r.levels[0]}~{r.levels[1]}</small></h3>
                  <p>{open ? r.blurb : `앞 지역 대장을 이기면 열려요 · 또는 팀에 Lv.${openLevel(r)}`}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="tap adv-btn adv-btn-main" disabled={!open} onClick={() => { enterBattleFullscreen(); setField(r); }}>
                      {open ? "탐험하기" : "잠겨 있어요"}
                    </button>
                    {open && <button type="button" className="tap adv-btn" onClick={() => explore(r)}>바로 전투</button>}
                    {open && r.boss && (
                      <button type="button" className="tap adv-btn" onClick={() => challenge(r)}>
                        {(s.badges ?? []).includes(r.key) ? `${r.boss.name} 다시` : `대장 Lv.${bossLevel(r)}`}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
          <section className="adv-card">
            <div className="adv-tower">
              <div className="flex -space-x-3">{towerTeam(Math.min(TOWER_MAX, (s.tower ?? 0) + 1)).map(([k], i) => <MonArt key={i} species={k} size={42} mode={towerOpen(s) ? "full" : "silhouette"} />)}</div>
              <div className="min-w-0 flex-1">
                <h2 className="adv-h">도전의 탑 <small>최고 {s.tower ?? 0}층 / {TOWER_MAX}층</small></h2>
                <p className="text-[12px] text-muted">{towerOpen(s) ? (s.tower ?? 0) >= TOWER_MAX ? "탑 꼭대기에 올랐어요!" : `다음 ${(s.tower ?? 0) + 1}층 · 권장 Lv.${towerLevel((s.tower ?? 0) + 1)} · 처음 깨면 골드 ${towerReward((s.tower ?? 0) + 1).gold} · 팀을 회복하고 올라요` : "첫 대장을 이기면 열려요"}</p>
              </div>
              <button type="button" className="tap adv-btn adv-btn-main" disabled={!towerOpen(s) || (s.tower ?? 0) >= TOWER_MAX} onClick={climb}>오르기</button>
            </div>
          </section>
        </div>
      )}

      {sub === "team" && <TeamView save={s} onChange={commit} flash={flash} />}
      {sub === "team" && myUserId && <SaveBackups uid={myUserId} save={s} flash={flash} onRestored={(r) => { version.current = r.version; setSave(r.save); }} />}
      {sub === "dex" && <DexView save={s} onChange={commit} flash={flash} />}
      {sub === "shop" && <ShopView save={s} onChange={commit} flash={flash} />}
      {sub === "duel" && (isSupabaseConfigured ? <DuelPanel save={s} flash={flash} sync={syncNow} /> : <div className="mt-3"><StatePanel kind="empty" title="온라인 대전은 로그인한 앱에서만 열려요" /></div>)}

      {field && (
        <FieldView
          region={field}
          save={s}
          paused={!!battle || !!result || evos.length > 0}
          outcome={fieldOutcome}
          opened={s.field?.day === today ? s.field.opened : []}
          onEncounter={encounter}
          onBoss={() => challenge(field)}
          onTrainer={(slot) => trainer(field, slot)}
          onIntro={() => commit({ ...s, intro: [...(s.intro ?? []), field.key] })}
          onHeal={() => { commit({ ...s, party: s.party.map(healMon) }); flash("샘물을 마시고 모두 회복했어요"); }}
          onChest={(slot) => chest(field, slot)}
          onClose={() => setField(null)}
          keep={fieldKeep}
          day={today}
        />
      )}
      {battle && <BattleView battle={battle.b} region={battle.region} bag={{ balls: s.balls, items: s.items }} onSettle={settle} onEnd={endBattle} onSpend={spend} keepFull={!!field} />}
      {evos.length > 0 && <EvoScene key={evos[0].to} from={evos[0].from} to={evos[0].to} onDone={() => setEvos((e) => e.slice(1))} />}

      {result && evos.length === 0 && <ResultDialog result={result} onAgain={result.again ? () => { const r = result.again!; setResult(null); explore(r); } : undefined} onClose={() => setResult(null)} />}
      {/* 필드 · 전투 위에선 위쪽에 — 아래에 뜨면 막대 · 기술을 덮었다(2026-11-09, 손가락은 늘 지나간다) */}
      {toast && <div className={`adv-toast${field || battle ? " is-top" : ""}`} role="status">{toast}</div>}
    </div>
  );
}

type Result = { title: string; notes: string[]; art: string[]; gold: number; xp: number; again?: Region };

/** 전투 결과 — 뒤로 가기 · Esc 는 이 창만 닫는다(예전엔 밑의 필드까지 닫혔다) */
function ResultDialog({ result, onAgain, onClose }: { result: Result; onAgain?: () => void; onClose: () => void }) {
  useBackClose(onClose);
  const ref = useDialogFocus(true, onClose);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="전투 결과">
      <div ref={ref} tabIndex={-1} className="adv-card w-full max-w-sm">
        <h2 className="text-[15px] font-bold">{result.title}</h2>
        {(result.gold !== 0 || result.xp > 0) && (
          <div className="adv-result-gain">
            {result.xp > 0 && <span>경험치 +{result.xp.toLocaleString()}</span>}
            {result.gold !== 0 && <span>골드 {result.gold > 0 ? "+" : ""}{result.gold.toLocaleString()}</span>}
          </div>
        )}
        {result.art.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-2">{result.art.map((k, i) => <MonArt key={i} species={k} size={88} />)}</div>}
        {result.notes.length > 0 && <ul className="mt-2 grid gap-1 text-[15px]">{result.notes.map((n, i) => <li key={i}>· {n}</li>)}</ul>}
        <div className="mt-4 flex gap-2">
          {onAgain && <button type="button" className="tap adv-btn adv-btn-main flex-1" onClick={onAgain}>한 번 더</button>}
          <button type="button" data-dialog-initial className={`tap adv-btn flex-1 ${onAgain ? "" : "adv-btn-main"}`} onClick={onClose}>계속</button>
        </div>
      </div>
    </div>
  );
}

/** 진화 장면 — fixed inset-0 이라야 스크롤 잠금(ScrollLockManager)이 알아본다. 뒤로 가기 · Esc 는 장면만 넘긴다 */
function EvoScene({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  useBackClose(onDone);
  const ref = useDialogFocus(true, onDone);
  return (
    <div ref={ref} tabIndex={-1} className="adv-evo fixed inset-0" role="dialog" aria-modal="true" aria-label="진화">
      <div className="adv-evo-stage">
        <span className="adv-evo-burst" />
        <MonArt species={from} size={190} className="adv-evo-from" />
        <MonArt species={to} size={190} className="adv-evo-to" />
      </div>
      <p>{josa(SPECIES[from].name, "이/가")} {josa(SPECIES[to].name, "으로/로")} 진화했다!</p>
      <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main" onClick={onDone}>계속</button>
    </div>
  );
}

const TYPES = Object.keys(TYPE_COLOR) as MonType[];
function TypeChart() {
  return (
    <div className="adv-typechart mt-2">
      {TYPES.map((t) => {
        const good = TYPES.filter((d) => effectiveness(t, d) > 1);
        const bad = TYPES.filter((d) => effectiveness(t, d) < 1);
        return (
          <div key={t}>
            <i className="adv-type" style={{ background: TYPE_COLOR[t] }}>{t}</i>
            <span>{good.length ? `강함 ${good.join(" · ")}` : ""}{good.length && bad.length ? " / " : ""}{bad.length ? `약함 ${bad.join(" · ")}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonRow({ m, children }: { m: Mon; children?: ReactNode }) {
  const sp = SPECIES[m.species];
  const st = statsOf(m);
  return (
    <div className="adv-monrow">
      <MonArt species={m.species} size={56} mode={m.hp > 0 ? "full" : "faded"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <b className="truncate">{sp.name}</b>
          <small>Lv.{m.level}</small>
          <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
        </div>
        <HpBar hp={m.hp} max={st.hp} />
        <div className="mt-0.5 flex items-center justify-between text-[12px] text-muted">
          <span>{m.hp}/{st.hp} · 공 {st.atk} · 방 {st.def} · 빠 {st.spd}</span>
          {sp.evolves && <span>Lv.{sp.evolves.at} 진화</span>}
        </div>
        <p className="text-[12px] text-muted">특성 {TRAITS[sp.type].name} — {TRAITS[sp.type].note}</p>
        <XpBar level={m.level} xp={m.xp} />
        {children && <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>}
      </div>
    </div>
  );
}

function TeamView({ save: s, onChange, flash }: { save: AdvSave; onChange: (s: AdvSave) => void; flash: (t: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const editing = edit ? s.party.find((m) => m.id === edit) : undefined;
  const potion = (m: Mon, k: ItemKey) => {
    const used = applyItem(m, k);
    if (!used || s.items[k] <= 0) return flash("지금은 쓸 수 없어요");
    onChange({ ...s, items: { ...s.items, [k]: s.items[k] - 1 }, party: s.party.map((x) => (x.id === m.id ? used : x)) });
  };
  const release = async (m: Mon) => {
    if (!(await confirmDialog({ message: `${josa(SPECIES[m.species].name, "을/를")} 놓아줄까요? 되돌릴 수 없어요.`, confirmText: "놓아주기", danger: true }))) return;
    onChange(releaseMon(s, m.id));
    flash(`골드 +${m.level * 10}`);
  };
  return (
    <div className="mt-3 grid gap-3">
      <section className="adv-card">
        <h2 className="adv-h">팀 <small>{s.party.length}/{PARTY_MAX} · 맨 앞이 먼저 나가요</small></h2>
        <div className="mt-2 grid gap-2">
          {s.party.map((m, i) => (
            <MonRow key={m.id} m={m}>
              <button type="button" className="tap adv-chip" onClick={() => setEdit(m.id)}>기술 고르기</button>
              {CHARM_KEYS.some((k) => (s.charms?.[k] ?? 0) > 0) && <button type="button" className="tap adv-chip" onClick={() => onChange(cycleCharm(s, m.id))}>장신구: {m.charm ? CHARMS[m.charm].name : "없음"}</button>}
              {i > 0 && <button type="button" className="tap adv-chip" onClick={() => onChange({ ...s, party: [m, ...s.party.filter((x) => x.id !== m.id)] })}>맨 앞으로</button>}
              {i > 0 && <button type="button" className="tap adv-chip" onClick={() => { const p = [...s.party]; [p[i - 1], p[i]] = [p[i], p[i - 1]]; onChange({ ...s, party: p }); }}>위로</button>}
              {s.party.length > 1 && <button type="button" className="tap adv-chip" onClick={() => onChange({ ...s, party: s.party.filter((x) => x.id !== m.id), box: [...s.box, m] })}>보관함으로</button>}
              {s.items.potion > 0 && m.hp > 0 && m.hp < statsOf(m).hp && <button type="button" className="tap adv-chip" onClick={() => potion(m, "potion")}>상처약 ×{s.items.potion}</button>}
              {s.items.cure > 0 && m.status && <button type="button" className="tap adv-chip" onClick={() => potion(m, "cure")}>깨움약</button>}
            </MonRow>
          ))}
        </div>
      </section>
      <section className="adv-card">
        <h2 className="adv-h">보관함 <small>{s.box.length}마리</small></h2>
        {s.box.length === 0 ? <p className="mt-1 text-[12px] text-muted">팀이 가득 찬 뒤 잡은 생물이 여기로 와요.</p> : (
          <div className="mt-2 grid gap-2">
            {s.box.map((m) => (
              <MonRow key={m.id} m={m}>
                <button type="button" className="tap adv-chip" disabled={s.party.length >= PARTY_MAX} onClick={() => onChange({ ...s, box: s.box.filter((x) => x.id !== m.id), party: [...s.party, m] })}>
                  {s.party.length >= PARTY_MAX ? "팀이 가득 찼어요" : "팀에 넣기"}
                </button>
                <button type="button" className="tap adv-chip" onClick={() => void release(m)}>놓아주기 +{m.level * 10}</button>
              </MonRow>
            ))}
          </div>
        )}
      </section>
      {editing && (
        <MoveEditor
          m={editing}
          onClose={() => setEdit(null)}
          onSave={(picked) => {
            const next = { ...editing, picked };
            onChange({ ...s, party: s.party.map((x) => (x.id === editing.id ? { ...next, moves: movesOf(next).map((id) => ({ id, pp: MOVES[id].pp })) } : x)) });
            setEdit(null);
            flash("기술을 바꿨어요");
          }}
        />
      )}
    </div>
  );
}

type Shape = keyof typeof SHAPE_LABEL;

function MoveEditor({ m, onSave, onClose }: { m: Mon; onSave: (picked: string[]) => void; onClose: () => void }) {
  const learned = learnedAt(m.species, m.level);
  const [on, setOn] = useState<string[]>(() => movesOf(m));
  // 기술이 나가는 모양은 전투 엔진의 표에 있다 — 이 창을 열 때 받는다(탭을 열 때 엔진을 받지 않게)
  const [shapeOf, setShapeOf] = useState<((id: string) => Shape) | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/lib/arena").then((e) => {
      if (live) setShapeOf(() => (id: string) => e.skillOf(id).shape);
    }, () => {});
    return () => {
      live = false;
    };
  }, []);
  useBackClose(onClose);
  const ref = useDialogFocus(true, onClose);
  const need = Math.min(4, learned.length);
  const toggle = (id: string) => setOn((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="기술 고르기">
      <div ref={ref} tabIndex={-1} className="adv-card flex max-h-[80vh] w-full max-w-sm flex-col">
        <h2 className="adv-h">{SPECIES[m.species].name} 기술 <small>{on.length}/{need} 골랐어요</small></h2>
        <div className="mt-2 grid gap-1.5 overflow-y-auto">
          {learned.map((id) => {
            const mv = MOVES[id];
            const sel = on.includes(id);
            return (
              <button key={id} type="button" aria-pressed={sel} className={`tap adv-shoprow text-left ${sel ? "ring-2 ring-[var(--accent,#e27fb3)]" : ""}`} onClick={() => toggle(id)}>
                <i className="adv-type" style={{ background: TYPE_COLOR[mv.type] }}>{mv.type}</i>
                <span className="min-w-0 flex-1">
                  <b>{mv.name}</b> <small>{shapeOf ? SHAPE_LABEL[shapeOf(id)] : ""}{shapeOf && mv.power ? " · " : ""}{mv.power ? `위력 ${mv.power}` : ""}</small>
                  <small className="block">{mv.note}{moveTags(mv).length ? ` · ${moveTags(mv).join(" · ")}` : ""}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <CloseButton onClose={onClose} />
          <button type="button" className="tap adv-btn adv-btn-main flex-1" disabled={on.length !== need} onClick={() => onSave(on)}>저장</button>
        </div>
      </div>
    </div>
  );
}

function DexView({ save: s, onChange, flash }: { save: AdvSave; onChange: (s: AdvSave) => void; flash: (t: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [type, setType] = useState<MonType | null>(null);
  const [chart, setChart] = useState(false);
  const sp = pick ? SPECIES[pick] : null;
  const chain = sp ? SPECIES_KEYS.filter((k) => SPECIES[k].lineage === sp.lineage) : [];
  return (
    <section className="adv-card mt-3">
      <h2 className="adv-h">도감 <small>잡음 {s.caught.length} · 만남 {s.seen.length} / {SPECIES_KEYS.length}</small></h2>
      <div className="mt-2 grid gap-1.5">
        {DEX_REWARDS.filter((r) => !(s.dexClaimed ?? []).includes(r.need)).slice(0, 2).map((r) => (
          <div key={r.need} className="adv-mission">
            <span>{r.need}종 잡기<small>골드 {r.gold.toLocaleString()}{r.star ? ` · 별빛공 ×${r.star}` : ""}</small></span>
            <b>{Math.min(r.need, s.caught.length)}/{r.need}</b>
            <button type="button" className="tap adv-chip" disabled={s.caught.length < r.need} onClick={() => { const n = claimDex(s, r.need); if (n) { onChange(n); flash("도감 보상을 받았어요"); } }}>받기</button>
          </div>
        ))}
      </div>
      <div className="adv-typefilter mt-2">
        <button type="button" className={type ? "" : "is-on"} onClick={() => setType(null)}>전체</button>
        {TYPES.map((t) => <button key={t} type="button" className={type === t ? "is-on" : ""} onClick={() => setType(t)}>{t}</button>)}
      </div>
      <button type="button" className="tap adv-chip mt-1" aria-expanded={chart} onClick={() => setChart((c) => !c)}>속성 상성표 {chart ? "접기" : "보기"}</button>
      {chart && <TypeChart />}
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {SPECIES_KEYS.map((k, i) => {
          if (type && !(SPECIES[k].type === type && s.seen.includes(k))) return null;
          const mode = s.caught.includes(k) ? "full" : s.seen.includes(k) ? "faded" : "silhouette";
          return (
            <button key={k} type="button" className={`tap adv-dex ${pick === k ? "is-on" : ""}`} onClick={() => setPick(k)} aria-label={mode === "silhouette" ? `${i + 1}번 — 아직 못 만남` : SPECIES[k].name}>
              <MonArt species={k} size={48} mode={mode} />
              <small>{String(i + 1).padStart(2, "0")}</small>
            </button>
          );
        })}
      </div>
      {sp && (
        <div className="adv-dexinfo mt-3">
          {s.seen.includes(sp.key) ? (
            <>
              <div className="flex items-center gap-2">
                <b>{sp.name}</b>
                <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
                <small>{s.caught.includes(sp.key) ? "잡음" : "만나기만 함"}</small>
              </div>
              <p className="mt-1 text-[12px]">{sp.note}</p>
              <p className="mt-1 text-[12px]">특성 {TRAITS[sp.type].name} — {TRAITS[sp.type].note}</p>
              <p className="mt-1 text-[12px]">기본 능력 — 체력 {sp.base.hp} · 공격 {sp.base.atk} · 방어 {sp.base.def} · 빠르기 {sp.base.spd}</p>
              {chain.length > 1 && <div className="mt-1 flex items-center gap-1">{chain.map((k) => <MonArt key={k} species={k} size={44} mode={s.caught.includes(k) ? "full" : s.seen.includes(k) ? "faded" : "silhouette"} />)}</div>}
              {s.caught.includes(sp.key) && <p className="mt-1 text-[12px] text-muted">배우는 기술: {sp.learn.map(([lv, id]) => `${MOVES[id].name}(${lv})`).join(" · ")}</p>}
              <p className="mt-1 text-[12px] text-muted">
                사는 곳: {REGIONS.filter((r) => r.table.some(([k]) => k === sp.key)).map((r) => r.name).join(" · ") || "진화로만 만나요"}
                {sp.evolves && ` · Lv.${sp.evolves.at} 에 ${josa(SPECIES[sp.evolves.to].name, "으로/로")} 진화`}
              </p>
            </>
          ) : <p className="text-[12px] text-muted">아직 못 만났어요. 수풀을 헤쳐 보세요.</p>}
        </div>
      )}
    </section>
  );
}

function ShopView({ save: s, onChange, flash }: { save: AdvSave; onChange: (s: AdvSave) => void; flash: (t: string) => void }) {
  const buy = (kind: "ball" | "item", k: string, price: number, name: string, n = 1) => {
    if (s.gold < price * n) return flash("골드가 모자라요");
    if (kind === "ball") onChange({ ...s, gold: s.gold - price * n, balls: { ...s.balls, [k]: s.balls[k as BallKey] + n } });
    else onChange({ ...s, gold: s.gold - price * n, items: { ...s.items, [k]: s.items[k as ItemKey] + n } });
    flash(`${josa(name, "을/를")} ${n > 1 ? `${n}개 ` : ""}샀어요`);
  };
  return (
    <section className="adv-card mt-3">
      <h2 className="adv-h">상점 <small>가진 골드 {s.gold.toLocaleString()}</small></h2>
      <div className="mt-2 grid gap-2">
        {(Object.keys(BALLS) as BallKey[]).map((k) => (
          <div key={k} className="adv-shoprow">
            <BallIcon k={k} size={26} />
            <span className="min-w-0 flex-1"><b>{BALLS[k].name}</b> <small>{BALLS[k].note} · 가진 것 {s.balls[k]}</small></span>
            <button type="button" className="tap adv-btn" disabled={s.gold < BALLS[k].price} onClick={() => buy("ball", k, BALLS[k].price, BALLS[k].name)}>{BALLS[k].price}</button>
            <button type="button" className="tap adv-btn" disabled={s.gold < BALLS[k].price * 5} onClick={() => buy("ball", k, BALLS[k].price, BALLS[k].name, 5)}>×5</button>
          </div>
        ))}
        {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
          <div key={k} className="adv-shoprow">
            <span className="adv-itemdot" aria-hidden>{k === "cure" ? "✚" : "♥"}</span>
            <span className="min-w-0 flex-1"><b>{ITEMS[k].name}</b> <small>{ITEMS[k].note} · 가진 것 {s.items[k]}</small></span>
            <button type="button" className="tap adv-btn" disabled={s.gold < ITEMS[k].price} onClick={() => buy("item", k, ITEMS[k].price, ITEMS[k].name)}>{ITEMS[k].price}</button>
          </div>
        ))}
      </div>
      <h2 className="adv-h mt-4">장신구 <small>팀 화면에서 끼워요 · 대전엔 안 들어요</small></h2>
      <div className="mt-2 grid gap-2">
        {CHARM_KEYS.map((k) => (
          <div key={k} className="adv-shoprow">
            <span className="adv-itemdot" aria-hidden>◆</span>
            <span className="min-w-0 flex-1"><b>{CHARMS[k].name}</b> <small>{CHARMS[k].note} · 가진 것 {s.charms?.[k] ?? 0}</small></span>
            <button type="button" className="tap adv-btn" disabled={s.gold < CHARMS[k].price} onClick={() => { onChange({ ...s, gold: s.gold - CHARMS[k].price, charms: { ...s.charms, [k]: (s.charms?.[k] ?? 0) + 1 } }); flash(`${josa(CHARMS[k].name, "을/를")} 샀어요`); }}>{CHARMS[k].price}</button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted">골드는 야생 생물을 이기거나, 필드의 상자를 열면 받아요. 상자는 매일 다시 채워져요.</p>
    </section>
  );
}
