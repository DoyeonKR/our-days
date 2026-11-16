"use client";
/* 모험 커플 레이드(2026-11-13) — 지역 칸 맨 위의 이번 주 영물 카드 · 레이드 판 · 결과 창. README §14.6
 * 규칙은 lib/advraid(순수 — advraid.test), 섬에 쓰는 길은 lib/advraidstore.
 * ⚠ BattleView · lib/arena 는 정적으로 부르지 않는다 — 모험 탭을 열 때 전투 코드까지 받게 된다(advui.test).
 * ⚠ 크롬에 이모지를 쓰지 않는다 — 휘장 테 · 기세 표시는 SVG · CSS. */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { REGIONS, SPECIES, type AdvSave, type BallKey, type Battle, type ItemKey } from "@/lib/adventure";
import {
  RAID_GOLD, RAID_HEARTS, RAID_PHASE_NAME, RAID_SECONDS, RAID_TICKS, RAID_TRIES, RAID_TAKEN,
  raidBattle, raidClaim, raidClaimable, raidDmg, raidHitIsland, raidHitSolo, raidLeft, raidLog, raidMineOf, raidNow, raidOf, raidOpenIsland, raidOpenSolo,
  raidPhase, raidPoints, raidPoolOf, raidTriesLeft, raidWear, type RaidFight, type RaidShared,
} from "@/lib/advraid";
import { raidAct } from "@/lib/advraidstore";
import { useIslandStore } from "@/lib/islandstore";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import MonArt from "@/components/adventure/MonArt";
import { josa } from "@/lib/josa";

const BattleView = dynamic(() => import("@/components/adventure/BattleView"), { ssr: false });

type Bag = { balls: Record<BallKey, number>; items: Record<ItemKey, number> };
type Fight = { f: RaidFight; id: string; week: string };
type Saved = "saving" | "ok" | "fail" | "late";
type Outcome = { id: string; week: string; pts: number; down: boolean; saved: Saved; reason?: string; beatenNow?: boolean };

const TEMPLE = REGIONS.find((r) => r.key === "temple") ?? REGIONS[REGIONS.length - 1];
/** 도전 id 로 판의 시드를 — 같은 판을 다시 열 일은 없지만, 기기 시계 · 난수 없이 정한다 */
function seedOf(id: string, base: number): number {
  let h = base | 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}
const md = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

export default function RaidPanel({ save, myUserId, coupleId, partnerName, today, commit, spend, flash, onFighting }: {
  save: AdvSave;
  myUserId: string;
  coupleId: string | null;
  partnerName?: string;
  today: string;
  commit: (next: AdvSave) => void;
  spend: (bag: Bag) => void;
  flash: (s: string) => void;
  /** 레이드 판이 열려 있나 — 탭이 돌아왔을 때 다시 읽기를 미룬다 */
  onFighting: (open: boolean) => void;
}) {
  const couple = !!coupleId;
  const isle = useIslandStore(coupleId);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const [fight, setFight] = useState<Fight | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const settledId = useRef<string | null>(null);

  const me = myUserId;
  const stored = couple ? (isle.row ? raidOf(isle.row.state) : undefined) : raidMineOf(save).solo;
  const r = raidNow(stored, today, couple ? 2 : 1);
  const pool = raidPoolOf(r.size);
  const dmg = raidDmg(r);
  const mine = dmg[me] ?? 0;
  const theirs = Object.entries(dmg).reduce((s, [k, v]) => (k === me ? s : s + v), 0);
  const left = raidLeft(r);
  const phase = raidPhase(r);
  const tries = raidTriesLeft(r, me, today);
  const claim = raidClaimable(r, save);
  const mineInfo = raidMineOf(save);
  const boss = SPECIES[r.boss];
  const partner = partnerName?.trim() || "상대";
  const noIsland = couple && isle.loaded && !isle.row;
  const waiting = couple && !isle.loaded;

  async function start() {
    if (busy || fight) return;
    if (!save.party.length) return flash("팀이 있어야 싸울 수 있어요");
    enterBattleFullscreen(); // 누른 그 손짓 안에서 — 전투 화면이 뜨기 전에
    setBusy(true);
    try {
      let opened: { raid: RaidShared; id: string; week: string } | null = null;
      if (couple) {
        const res = await raidAct(coupleId!, (st) => raidOpenIsland(st, me, today));
        if (!res.ok) flash(res.reason);
        else opened = { raid: res.raid, id: res.id!, week: res.week! };
      } else {
        const o = raidOpenSolo(saveRef.current, me, today);
        if (!o.ok) flash(o.reason);
        else {
          saveRef.current = o.save;
          commit(o.save);
          opened = o;
        }
      }
      if (!opened) {
        exitBattleFullscreen();
        return;
      }
      settledId.current = null;
      setOutcome(null);
      setFight({ f: raidBattle(saveRef.current, opened.raid, seedOf(opened.id, saveRef.current.seed)), id: opened.id, week: opened.week });
      onFighting(true);
    } finally {
      setBusy(false);
    }
  }

  /** 깎은 기록을 남긴다 — 같은 id 는 몇 번을 보내도 한 번(다시 시도 · 응답을 잃은 저장) */
  async function record(id: string, week: string, pts: number, down: boolean, base: AdvSave) {
    setOutcome({ id, week, pts, down, saved: "saving" });
    if (couple) {
      commit(base);
      const res = await raidAct(coupleId!, (st) => raidHitIsland(st, id, pts, me, today, week));
      if (res.ok) setOutcome({ id, week, pts, down, saved: "ok", beatenNow: !!(res as { beatenNow?: boolean }).beatenNow });
      else setOutcome({ id, week, pts, down, saved: res.reason === RAID_TAKEN || /주가 바뀌어/.test(res.reason) ? "late" : "fail", reason: res.reason });
    } else {
      const h = raidHitSolo(base, id, pts, me, today, week);
      if (h.ok) {
        saveRef.current = h.save;
        commit(h.save);
        setOutcome({ id, week, pts, down, saved: "ok", beatenNow: h.beatenNow });
      } else {
        commit(base);
        setOutcome({ id, week, pts, down, saved: "late", reason: h.reason });
      }
    }
  }

  /** 판이 끝난 그 틱에(onSettle) — 포기는 onEnd 만 오므로 거기서도 부른다. 판마다 한 번 */
  function settle(b: Battle, bag: Bag) {
    if (!fight || settledId.current === fight.id) return;
    settledId.current = fight.id;
    const endHp = b.sides[1].team[0]?.mon.hp ?? fight.f.startHp;
    const pts = raidPoints(fight.f, endHp);
    // 쓴 약만 빠진다(팀은 사본이라 내 저장의 체력 · 경험치는 그대로)
    const base: AdvSave = { ...saveRef.current, balls: { ...bag.balls }, items: { ...bag.items } };
    saveRef.current = base;
    void record(fight.id, fight.week, pts, endHp <= 0, base);
  }
  function end(b: Battle, bag: Bag) {
    settle(b, bag);
    setFight(null);
    onFighting(false);
  }

  function takeReward() {
    const c = raidClaim(saveRef.current, r);
    if (!c) return;
    saveRef.current = c.save;
    commit(c.save);
    flash(`토벌 보상 — ${c.notes.join(" · ")}`);
  }

  const log = raidLog(r);
  const rules = [
    "영물이 예고 원을 깔면 그 자리를 피해요 — 고리 · 십자 · 소나기 · 조여들기",
    `${couple ? "커플 " : ""}몫이 절반 아래면 분노 — 더 빨라지고 패턴이 잦아져요`,
    "4분의 1 아래에서 연 판은 격노 — 공격 · 빠르기가 올라요",
    `한 판 ${RAID_SECONDS}초 · 팀은 다 회복한 채로 싸우고 쓴 약만 빠져요`,
  ];

  return (
    <section className={`adv-raid ${phase ? `is-phase-${phase}` : ""}`} aria-label="이번 주 커플 레이드">
      <div className="adv-raid-head">
        <div className="adv-raid-boss">
          <MonArt species={r.boss} size={72} mode={r.beaten ? "faded" : "full"} />
          {mineInfo.wear && <Crest species={mineInfo.wear} size={30} className="adv-raid-worn" label="달고 있는 휘장" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="adv-raid-kicker">이번 주 {couple ? "커플" : "혼자"} 레이드 · {md(r.week)}부터</p>
          <h2 className="adv-raid-title">거대 {boss?.name ?? "영물"}</h2>
          <p className="adv-raid-sub">
            {r.beaten ? "쓰러뜨렸어요 — 다음 주에 새 영물이 나타나요" : `남은 몫 ${left.toLocaleString()} / ${pool.toLocaleString()}`}
            {phase > 0 && !r.beaten && <b className="adv-raid-phase">{RAID_PHASE_NAME[phase]}</b>}
          </p>
        </div>
      </div>

      <div className="adv-raid-bar" role="img" aria-label={`나 ${mine}점 · ${couple ? `${partner} ${theirs}점 · ` : ""}남은 몫 ${left}점`}>
        <span className="is-me" style={{ width: `${(Math.min(mine, pool) / pool) * 100}%` }} />
        {couple && <span className="is-you" style={{ width: `${(Math.min(theirs, pool - Math.min(mine, pool)) / pool) * 100}%` }} />}
        <i className="adv-raid-tick" style={{ left: "50%" }} aria-hidden />
        <i className="adv-raid-tick" style={{ left: "75%" }} aria-hidden />
      </div>
      <div className="adv-raid-legend">
        <span><u className="is-me" />나 {mine.toLocaleString()}</span>
        {couple && <span><u className="is-you" />{partner} {theirs.toLocaleString()}</span>}
        <span className="ml-auto">오늘 남은 도전 {tries}/{RAID_TRIES}</span>
      </div>

      {noIsland && <p className="adv-raid-note">우리 섬을 먼저 열면 둘이 같이 싸울 수 있어요(게임 탭 › 우리 섬)</p>}
      {couple && isle.error && !isle.row && <p className="adv-raid-note">섬을 불러오지 못했어요 — 연결을 확인해 주세요</p>}

      <div className="adv-raid-actions">
        {claim ? (
          <button type="button" className="tap adv-btn adv-btn-main" onClick={takeReward}>
            {claim.week === r.week ? "토벌 보상 받기" : "지난 주 토벌 보상 받기"}
          </button>
        ) : (
          <button type="button" className="tap adv-btn adv-btn-main" disabled={busy || waiting || noIsland || !!r.beaten || tries <= 0} onClick={() => void start()}>
            {busy ? "여는 중…" : r.beaten ? "다음 주에 만나요" : tries <= 0 ? "내일 다시" : "레이드 도전"}
          </button>
        )}
        <button type="button" className="tap adv-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>{more ? "접기" : "기록 · 휘장"}</button>
      </div>

      {more && (
        <div className="adv-raid-more">
          <h3 className="adv-raid-h">최근 도전</h3>
          {log.length ? (
            <ul className="adv-raid-log">
              {log.map((h) => (
                <li key={h.id} className={h.who === me ? "is-me" : "is-you"}>
                  <b>{h.who === me ? "나" : partner}</b>
                  <span>{md(h.day)} {h.n}번째</span>
                  <em>{h.d.toLocaleString()}점{r.beaten?.id === h.id ? " · 마지막 일격" : ""}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adv-raid-note">아직 이번 주 기록이 없어요</p>
          )}
          {r.last && (
            <p className="adv-raid-note">
              지난 주 {SPECIES[r.last.boss]?.name ?? "영물"} — {r.last.beaten ? `${r.last.beaten.by === me ? "내가" : josa(partner, "이/가")} 마지막 일격` : "다 못 깎았어요"} · 나 {(r.last.dmg[me] ?? 0).toLocaleString()}점
            </p>
          )}
          <h3 className="adv-raid-h">싸우는 법</h3>
          <ul className="adv-raid-rules">{rules.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3 className="adv-raid-h">한정 휘장 <small>꾸밈 — 능력치와 무관해요</small></h3>
          <p className="adv-raid-note">토벌한 주의 영물 휘장을 받아요. 그 주에만 얻을 수 있어요 · 보상: 골드 {RAID_GOLD.toLocaleString()} · 물방울공 · 별빛공 · 큰상처약{couple ? ` · 커플 하트 ${RAID_HEARTS}(한 번)` : ""}</p>
          {mineInfo.crests.length ? (
            <div className="adv-raid-crests">
              {mineInfo.crests.map((k) => (
                <button key={k} type="button" className={`tap adv-raid-crestbtn ${mineInfo.wear === k ? "is-on" : ""}`} aria-pressed={mineInfo.wear === k} onClick={() => commit(raidWear(saveRef.current, mineInfo.wear === k ? null : k))}>
                  <Crest species={k} size={44} label={`${SPECIES[k]?.name ?? k} 휘장`} />
                  <span>{SPECIES[k]?.name ?? k}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="adv-raid-note">아직 휘장이 없어요</p>
          )}
        </div>
      )}

      {fight && (
        <BattleView
          battle={fight.f.battle}
          region={TEMPLE}
          bag={{ balls: save.balls, items: save.items }}
          limit={RAID_TICKS}
          raid={{ unit: fight.f.unit }}
          onSettle={settle}
          onEnd={end}
          onSpend={spend}
        />
      )}
      {outcome && !fight && (
        <RaidResult
          outcome={outcome}
          r={r}
          me={me}
          partner={couple ? partner : null}
          canClaim={!!claim}
          onClaim={takeReward}
          onRetry={() => void record(outcome.id, outcome.week, outcome.pts, outcome.down, saveRef.current)}
          onClose={() => setOutcome(null)}
        />
      )}
    </section>
  );
}

/** 휘장 — 영물 그림을 금빛 테가 감싼다(SVG 테 + 원화). 꾸밈뿐 */
function Crest({ species, size, label, className = "" }: { species: string; size: number; label: string; className?: string }) {
  const inner = Math.round(size * 0.64);
  return (
    <span className={`adv-raid-crest ${className}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="adv-crest-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff2b0" />
            <stop offset=".5" stopColor="#e8b23a" />
            <stop offset="1" stopColor="#9a6418" />
          </linearGradient>
        </defs>
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M24 1.5 L27 7 L21 7 Z" fill="url(#adv-crest-g)" transform={`rotate(${i * 45} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="18.5" fill="#2a1a4a" stroke="url(#adv-crest-g)" strokeWidth="3" />
        <circle cx="24" cy="24" r="15.5" fill="none" stroke="#fff2b0" strokeOpacity=".5" strokeWidth=".8" />
      </svg>
      <span className="adv-raid-crestart"><MonArt species={species} size={inner} /></span>
    </span>
  );
}

function RaidResult({ outcome, r, me, partner, canClaim, onClaim, onRetry, onClose }: {
  outcome: Outcome;
  r: RaidShared;
  me: string;
  partner: string | null;
  canClaim: boolean;
  onClaim: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  useBackClose(onClose);
  const ref = useDialogFocus(true, onClose);
  const pool = raidPoolOf(r.size);
  const dmg = raidDmg(r);
  const mine = dmg[me] ?? 0;
  const theirs = Object.entries(dmg).reduce((s, [k, v]) => (k === me ? s : s + v), 0);
  const won = outcome.saved === "ok" && (outcome.beatenNow || (r.beaten && r.beaten.id === outcome.id));
  const title = won ? "영물을 쓰러뜨렸어요!" : outcome.saved === "late" ? outcome.reason ?? RAID_TAKEN : `${outcome.pts.toLocaleString()}점 깎았어요`;
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="레이드 결과">
      <div ref={ref} tabIndex={-1} className={`adv-card adv-raid-result w-full max-w-sm ${won ? "is-won" : ""}`}>
        <div className="flex items-center gap-3">
          <MonArt species={r.boss} size={64} mode={r.beaten ? "faded" : "full"} />
          <div className="min-w-0 flex-1">
            <h2 className="adv-raid-title">{title}</h2>
            <p className="adv-raid-sub">
              {outcome.saved === "saving" ? `${partner ? "커플 " : ""}몫에 남기는 중…` : outcome.saved === "fail" ? outcome.reason ?? "기록하지 못했어요" : outcome.saved === "late" ? `이번 판 ${outcome.pts.toLocaleString()}점은 남지 않았어요` : `이번 판 ${outcome.pts.toLocaleString()}점이 ${partner ? "커플 " : ""}몫에 남았어요`}
            </p>
          </div>
        </div>
        <div className="adv-raid-bar mt-3" role="img" aria-label={`나 ${mine}점${partner ? ` · ${partner} ${theirs}점` : ""} · 몫 ${pool}점`}>
          <span className="is-me" style={{ width: `${(Math.min(mine, pool) / pool) * 100}%` }} />
          {partner && <span className="is-you" style={{ width: `${(Math.min(theirs, pool - Math.min(mine, pool)) / pool) * 100}%` }} />}
        </div>
        <div className="adv-raid-legend">
          <span><u className="is-me" />나 {mine.toLocaleString()}</span>
          {partner && <span><u className="is-you" />{partner} {theirs.toLocaleString()}</span>}
          <span className="ml-auto">{r.beaten ? "토벌!" : `남은 ${raidLeft(r).toLocaleString()}`}</span>
        </div>
        {won && <p className="adv-raid-note">둘 다 보상을 받을 수 있어요{partner ? ` · 커플 하트 +${RAID_HEARTS}` : ""}</p>}
        <div className="mt-4 flex gap-2">
          {outcome.saved === "fail" && <button type="button" className="tap adv-btn adv-btn-main flex-1" onClick={onRetry}>다시 남기기</button>}
          {canClaim && outcome.saved !== "fail" && <button type="button" className="tap adv-btn adv-btn-main flex-1" onClick={onClaim}>보상 받기</button>}
          <button type="button" data-dialog-initial className={`tap adv-btn flex-1 ${outcome.saved === "fail" || canClaim ? "" : "adv-btn-main"}`} onClick={onClose}>계속</button>
        </div>
      </div>
    </div>
  );
}
