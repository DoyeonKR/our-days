"use client";

/* 낚시 창의 장비 · 능력치 칸 — 판 진행(FishingGame)과 상관없이 사고 올리고 받는 곳. 저장은 부모의 act 가 한다. */
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ActionButton } from "@/components/AppButtons";
import { BaitIcon, CrownIcon, JunkIcon, MoonIcon } from "@/components/FishingIcons";
import { kstWhen, moonPhase, nextFullMoon, tideEffect, tideOf } from "@/lib/fishtide";
import { kstDayOf } from "@/lib/kst";
import { josa } from "@/lib/josa";
import { Coin, LockMark } from "@/components/island/UiIcon";
import { GRADES } from "@/lib/aquarium";
import { asset } from "@/lib/base";
import { useMemo, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { ALL_FORMS, FAMILIES, bossesBeaten } from "@/lib/aquarium";
import { BOSS_PHASE_NAME, bossPhase } from "@/lib/fishing";
import { BAITS, DEPTH_NAMES, familyDepth, JUNKS, NETS, RODS, SPOTS, STAT_CAP, STAT_INFO, STAT_KEYS, WATER_NAME, baitStock, castMaxMeters, catchTable, familyBaitTier, junkChance, type FishSpot, type FishStat, type FishingState, type MethodKey } from "@/lib/fishing";
import { dailyGoals, goalTotal, nextGoals, type FishGoal } from "@/lib/fishinggoals";
import { CloseButton } from "@/components/AppButtons";
import { FishArt } from "@/components/AquaArt";
import { BOSS_DUO, bossDuo, type BossHit } from "@/lib/fishingworld";
import { BOSSES, BOSS_RETURN_DAYS, EXPED_NAME, artName, EXPED_TOGETHER, MOON_FISH, TIMED_FISH, bossHp, bossReward, bossTriesLeft, expedAllBonus, expedText, expedValue, familyName, fmtCm, speciesGrade, speciesName, timedLabel, timedMatches, type BossRecord, type ExpedKey, type Expedition, type FishBoss, type FishMoment } from "@/lib/fishingworld";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import { REQUEST_ALL_BONUS, type FishRequest } from "@/lib/fishrequest";

export function GearPic({ k, label }: { k: string; label: string }) {
  if (FISHING_IMAGE_KEYS.has(k)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/fishing/${k}.webp`)} alt="" className="aqua-img fish-gear-img" draggable={false} decoding="async" />;
  }
  return <span className="aqua-decor-temp" aria-hidden>{label.slice(0, 3)}</span>;
}

function GearList<T extends { key: string; name: string; price: number }>({ title, desc, list, cur, coins, busy, stat, onBuy }: {
  title: string; desc: string; list: readonly T[]; cur: number; coins: number; busy: boolean; stat: (x: T) => string; onBuy: () => void;
}) {
  return (
    <section className="aqua-card">
      <header><strong>{title} <span className="fish-step">{cur + 1}/{list.length}단계</span></strong><small>{desc}</small></header>
      {/* 한눈에(2026-11-13) — 지금 쓰는 것과 다음에 살 것만 줄로, 그 뒤 단계는 이름만 한 줄(잠긴 줄이 버튼처럼 늘어서 있었다) */}
      <ul className="aqua-shop is-flat">
        {list.map((x, i) => (i < cur || i > cur + 1) ? null : (
          <li key={x.key}>
            <span className="aqua-shop-pic"><GearPic k={x.key} label={x.name} /></span>
            <span className="min-w-0 flex-1">
              <strong>{x.name}</strong>
              <small>{stat(x)}</small>
            </span>
            {i <= cur ? <small>{i === cur ? "쓰는 중" : "지나옴"}</small> : i === cur + 1 ? (
              <ActionButton disabled={busy || coins < x.price} onClick={onBuy}>
                <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
              </ActionButton>
            ) : null}
          </li>
        ))}
      </ul>
      {cur + 2 < list.length && <p className="aqua-note fish-later">그다음: {list.slice(cur + 2).map((x) => x.name).join(" → ")}</p>}
    </section>
  );
}

export function FishGear({ fs, coins, busy, today, onBuyRod, onBuyNet, onBuyBait }: {
  fs: FishingState; coins: number; busy: boolean; today: string; onBuyRod: () => void; onBuyNet: () => void; onBuyBait: (key: string) => void;
}) {
  return (
    <>
      <GearList title="낚싯대" desc="힘과 줄 다루기가 올라요" list={RODS} cur={fs.rod} coins={coins} busy={busy} stat={(x) => `힘 +${x.power} · 줄 다루기 +${x.line} · 최대 ${Math.round(castMaxMeters(RODS.indexOf(x), fs.stats.power))}m`} onBuy={onBuyRod} />
      <GearList title="뜰채" desc="포획 확률이 올라요 · 뜰채 낚시에서 그물이 넓어져요" list={NETS} cur={fs.net} coins={coins} busy={busy} stat={(x) => `포획 +${x.catch}`} onBuy={onBuyNet} />
      <section className="aqua-card">
        <header><strong>미끼</strong><small>한 번 던질 때마다 1회(심해는 2회) · 비싼 미끼는 귀한 물고기와 도감 · 랭킹을 위한 것이에요</small></header>
        <ul className="aqua-shop is-flat">
          {BAITS.map((b) => (
            <li key={b.key}>
              <span className="aqua-shop-pic"><BaitIcon k={b.key} /></span>
              <span className="min-w-0 flex-1">
                <strong>{b.name}</strong>
                <small>{GRADES[b.maxGrade]} 등급까지 · 묶음 {b.uses}회 · 남은 {baitStock(fs, b.key, today)}회</small>
              </span>
              <ActionButton disabled={busy || coins < b.price} onClick={() => onBuyBait(b.key)}>
                <span className="aqua-price"><Coin /> {b.price.toLocaleString()}</span>
              </ActionButton>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function GoalRow({ g, busy, onClaim }: { g: FishGoal; busy: boolean; onClaim: (id: string) => void }) {
  return (
    <li className={g.claimed ? "is-claimed" : ""}>
      <span className="min-w-0 flex-1">
        <strong>{g.name}</strong>
        <i className="fish-goal-bar" aria-hidden><b style={{ width: `${(g.now / g.need) * 100}%` }} /></i>
        <small>{g.now.toLocaleString()} / {g.need.toLocaleString()}</small>
      </span>
      {g.claimed ? <small>받음</small> : (
        <ActionButton main={g.done} disabled={busy || !g.done} aria-label={`${g.name} 보상 받기`} onClick={() => onClaim(g.id)}>
          <span className="aqua-price"><Coin /> {g.coins.toLocaleString()}</span>
        </ActionButton>
      )}
    </li>
  );
}

/** 이번 주 원정 — 둘이 합쳐 채운다 */
function ExpedCard({ e, who, couple, cheered, onCheer }: { e: Expedition; who: string; couple: boolean; cheered: boolean; onCheer: () => void }) {
  const mine = e.by[who] ?? 0, theirs = Object.entries(e.by).filter(([k]) => k !== who).reduce((n, [, v]) => n + v, 0);
  const keys: readonly ExpedKey[] = ["count", "kg", "kinds"];
  return (
    <section className="aqua-card fish-exped">
      <header><strong>이번 주 원정</strong><small>{couple ? `둘이 합쳐 채워요 · 나 ${mine} · 상대 ${theirs}마리` : `이번 주 ${mine}마리`}</small></header>
      <ul className="fish-goals">
        {keys.map((k) => {
          const v = expedValue(e, k), got = e.done.includes(k);
          return (
            <li key={k} className={got ? "is-claimed" : ""}>
              <span className="min-w-0 flex-1">
                <strong>{EXPED_NAME[k]} {expedText(k, e.need[k])}</strong>
                <i className="fish-goal-bar" aria-hidden><b style={{ width: `${Math.min(100, (v / e.need[k]) * 100)}%` }} /></i>
                <small>{expedText(k, Math.min(v, e.need[k]))} / {expedText(k, e.need[k])}</small>
              </span>
              <small>{got ? "받음" : <span className="aqua-price"><Coin /> {e.coins[k].toLocaleString()}</span>}</small>
            </li>
          );
        })}
      </ul>
      <p className="aqua-note mt-2">셋 다 채우면 <Coin /> {expedAllBonus(e).toLocaleString()} 더{couple ? ` · 둘 다 ${EXPED_TOGETHER}마리 이상 낚으면 1.5배` : ""} · 채우는 순간 바로 들어와요 · 월요일에 새로 시작</p>
      {couple && <ActionButton wide disabled={cheered} onClick={onCheer}>{cheered ? "응원을 보냈어요" : "쿡 찔러서 같이 가자고 하기"}</ActionButton>}
    </section>
  );
}

const pctOf = (hp: number) => `${Math.round(hp * 100)}%`;

function BossList({ fs, today }: { fs: FishingState; today: string }) {
  return (
    <section className="aqua-card">
      <header><strong>낚시터의 주인</strong><small>{bossesBeaten(fs.bosses)}/{BOSSES.length} 잡음</small></header>
      <ul className="fish-goals">
        {BOSSES.map((b) => {
          const r = fs.bosses[b.key], locked = fs.level < b.level, hp = bossHp(r, today);
          return (
            <li key={b.key} className={locked ? "is-claimed" : ""}>
              <span className="fish-boss-pic">{locked ? <b aria-hidden>?</b> : <FishArt artKey={b.species} />}</span>
              <span className="min-w-0 flex-1">
                <strong>{locked ? "???" : b.name}{r?.caught ? ` · ${r.caught}번 잡음` : ""}</strong>
                {!locked && <i className="fish-goal-bar is-boss" aria-hidden><b style={{ width: `${hp * 100}%` }} /></i>}
                <small>{locked ? `낚시 Lv.${b.level}` : `${SPOTS.find((x) => x.key === b.spot)?.name} · 체력 ${pctOf(hp)}`}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 크기 기록 — 칸을 고정한 표. 나는 분홍 · 상대는 파랑, 그 물고기에서 더 큰 쪽만 칠한다 */
function SizeList({ fs, who, couple }: { fs: FishingState; who: string; couple: boolean }) {
  const rows = Object.entries(fs.sizes).filter(([k]) => artName(k));
  if (!rows.length) return null;
  return (
    <section className="aqua-card">
      <header><strong>크기 기록</strong><small>내 기록을 넘기면 하트 · 경험치 1.5배</small></header>
      {couple && (
        <div className="fish-size-row fish-size-head" aria-hidden>
          <span />
          <span className="is-me">나</span>
          <span className="is-partner">상대</span>
        </div>
      )}
      <ul className="fish-sizes">
        {rows.map(([k, row]) => {
          const mine = row[who] ?? 0, other = Math.max(0, ...Object.entries(row).filter(([u]) => u !== who).map(([, v]) => v));
          const lead = !couple || mine === other ? null : mine > other ? "me" : "partner";
          return (
            <li key={k} className={`fish-size-row ${couple ? "" : "is-solo"}`}>
              <strong>{artName(k)}</strong>
              <span className={`is-me ${lead === "me" ? "is-win" : ""}`} aria-label={`나 ${mine ? fmtCm(mine) : "기록 없음"}${lead === "me" ? ", 더 큼" : ""}`}>{mine ? fmtCm(mine) : "-"}</span>
              {couple && <span className={`is-partner ${lead === "partner" ? "is-win" : ""}`} aria-label={`상대 ${other ? fmtCm(other) : "기록 없음"}${lead === "partner" ? ", 더 큼" : ""}`}>{other ? fmtCm(other) : "-"}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 오늘의 의뢰(2026-11-13) — 그 낚시터에서 그 물고기를 끌어올리면 저절로 채워지고 하트가 들어온다(받기 버튼 없음) */
function RequestCard({ list, done, couple }: { list: readonly FishRequest[]; done: readonly boolean[]; couple: boolean }) {
  if (!list.length) return null;
  const n = done.filter(Boolean).length;
  return (
    <section className="aqua-card fish-requests">
      <header><strong>오늘의 의뢰</strong><small>{n}/{list.length} · 셋 다 하면 +{REQUEST_ALL_BONUS.toLocaleString()}{couple ? " · 둘이 함께 채워요" : ""}</small></header>
      <ul>
        {list.map((r, i) => (
          <li key={`${r.spot}:${r.family}`} className={done[i] ? "is-done" : ""}>
            <span className="fish-request-pic"><FishArt artKey={`fry_${r.family}`} size={44} /></span>
            <span className="min-w-0 flex-1">
              <strong>{familyName(r.family)}</strong>
              <small>{SPOTS.find((s) => s.key === r.spot)?.name ?? r.spot}에서 · 어린 것도 돼요</small>
            </span>
            {done[i] ? <small className="fish-request-ok">완료</small> : <span className="aqua-price"><Coin /> {r.coins.toLocaleString()}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 목표 탭 — 오늘(의뢰 · 오늘의 목표 · 원정) · 낚시 목표(길게 가는 목표) · 주인 */
export function FishStats({ fs, busy, today, who, exped, couple, cheered, requests, onCheer, onClaim }: {
  fs: FishingState; busy: boolean; today: string; who: string; exped: Expedition; couple: boolean; cheered: boolean;
  requests: { list: readonly FishRequest[]; done: readonly boolean[] }; onCheer: () => void; onClaim: (id: string) => void;
}) {
  // 한눈에(2026-11-13) [사용자: "버튼 없이 한눈에"] — 칸 버튼 없이 오늘 할 것 → 길게 가는 목표 → 주인 순서로 그대로 펼친다
  const daily = dailyGoals(fs, today), next = nextGoals(fs);
  return (
    <>
      <RequestCard list={requests.list} done={requests.done} couple={couple} />
      <section className="aqua-card">
        <header><strong>오늘의 목표</strong><small>날마다 새로 시작해요</small></header>
        <ul className="fish-goals">{daily.map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
      <ExpedCard e={exped} who={who} couple={couple} cheered={cheered} onCheer={onCheer} />
      <section className="aqua-card">
        <header><strong>낚시 목표</strong><small>{fs.goals.length}/{goalTotal()} 달성</small></header>
        <ul className="fish-goals">{next.map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
      <BossList fs={fs} today={today} />
    </>
  );
}

/** 능력치(장비 탭) — 레벨마다 2점 */
export function FishAbility({ fs, eff, busy, onSpend }: { fs: FishingState; eff: Record<FishStat, number>; busy: boolean; onSpend: (k: FishStat) => void }) {
  return (
    <section className="aqua-card">
      <header><strong>능력치</strong><small>남은 점수 {fs.points} · 레벨마다 2점</small></header>
      <ul className="fish-stats">
        {STAT_KEYS.map((k) => (
          <li key={k}>
            <span className="min-w-0 flex-1">
              <strong>{STAT_INFO[k].name} {fs.stats[k]}{eff[k] !== fs.stats[k] ? ` (장비 포함 ${eff[k]})` : ""}</strong>
              <small>{STAT_INFO[k].desc}</small>
            </span>
            <ActionButton disabled={busy || fs.points <= 0 || fs.stats[k] >= STAT_CAP} aria-label={`${STAT_INFO[k].name} 올리기`} onClick={() => onSpend(k)}>+1</ActionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 크기 기록(수집 탭 '기록' 칸) */
export function FishSizes({ fs, who, couple }: { fs: FishingState; who: string; couple: boolean }) {
  return <SizeList fs={fs} who={who} couple={couple} />;
}

/** 쓰레기 수집함(수집 탭) */
export function FishJunk({ fs }: { fs: FishingState }) {
  return (
    <section className="aqua-card">
      <header><strong>쓰레기 수집함</strong><small>{JUNKS.filter((j) => (fs.junk[j.key] ?? 0) > 0).length}/{JUNKS.length}종 · 물가를 {Object.values(fs.junk).reduce((n, v) => n + v, 0)}번 치웠어요</small></header>
      <ul className="fish-junkbox">
        {JUNKS.map((j) => {
          const n = fs.junk[j.key] ?? 0;
          return (
            <li key={j.key} className={n > 0 ? "" : "is-unseen"}>
              <span><JunkIcon k={j.key} /></span>
              <strong>{n > 0 ? j.name : "???"}</strong>
              <small>{n > 0 ? `${n}개` : j.spot ? SPOTS.find((x) => x.key === j.spot)?.name : "어디서나"}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function useBackdropClose(onClose: () => void) {
  const downAt = useRef<EventTarget | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { downAt.current = e.target === e.currentTarget ? e.currentTarget : null; },
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (downAt.current === e.currentTarget && e.target === e.currentTarget) onClose();
      downAt.current = null;
    },
  };
}

/** 시트 — 열리면 포커스가 안으로 들어오고 Esc 로 닫히며, 닫히면 누른 버튼으로 돌아간다(공용 useDialogFocus) */
function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogFocus(true, onClose);
  const back = useBackdropClose(onClose);
  return (
    <div className="fish-sheet-back" {...back}>
      <div ref={ref} tabIndex={-1} className="fish-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="fish-sheet-head"><strong>{title}</strong><CloseButton onClose={onClose} label="닫기" /></header>
        {children}
      </div>
    </div>
  );
}

/** 주인 — 도전을 켜면 다음 판이 주인과의 싸움이다 */
export function BossSheet({ boss, rec, today, who, why, tries, couple, all, level, onClose, onStart }: { boss: FishBoss; rec: BossRecord | undefined; today: string; who: string; why: string | null; tries: number; couple: boolean; all: Readonly<Record<string, BossRecord>>; level: number; onClose: () => void; onStart: () => void }) {
  const hp = bossHp(rec, today), left = bossTriesLeft(rec, who, today), phase = bossPhase(hp);
  const beaten = bossesBeaten(all);
  return (
    <SheetShell title={`이 낚시터의 주인 · ${boss.name}`} onClose={onClose}>
      <div className="fish-boss-hero"><FishArt artKey={boss.species} /></div>
      <p className="fish-how">{boss.story}</p>
      <p className="aqua-note">{speciesName(boss.species)} · {speciesGrade(boss.species) ?? GRADES[0]} · 길이 {fmtCm(boss.cm)}</p>
      <i className="fish-goal-bar is-boss is-ticked mt-2" aria-hidden><b style={{ width: `${hp * 100}%` }} /><u style={{ left: "33%" }} /><u style={{ left: "66%" }} /></i>
      <p className="aqua-note">체력 {pctOf(hp)}{phase > 0 ? <b className="fish-boss-mood"> · {BOSS_PHASE_NAME[phase]}</b> : null} · 오늘 도전 {left}/{tries}번 남음 · 줄이 끊겨도 깎은 만큼 남아요{couple ? " · 둘이 함께 깎아요" : ""}</p>
      <p className="aqua-note">주인 레이드 — 화살표 쪽으로 밀어서 막고, 막으면 비틀거리는 동안 마구 두드려요. 30초 · 줄 3개</p>
      <p className="aqua-note">눈금(3분의 2 · 3분의 1) 밑으로 밀리면 화가 나서 더 빨리 덮치고 방향을 바꾸는 속임수도 써요{couple ? " · 상대가 오늘 깎았으면 비틀거리는 주인으로 시작해요" : ""}</p>
      {(rec?.caught ?? 0) > 0 && <p className="aqua-note">지금까지 {rec!.caught}번 잡았어요</p>}
      {couple && <BossRaid rec={rec} who={who} today={today} />}
      <p className="aqua-note">다 깎으면 끌어올려요 · 잡으면 왕관을 쓰고 수조에 들어와요 · 보상 <Coin /> {bossReward(boss, rec?.caught ?? 0).toLocaleString()} · {BOSS_RETURN_DAYS}일 뒤 다시 나타나요</p>
      {why ? <p className="aqua-msg">{why}</p> : <ActionButton main wide className="mt-3" onClick={onStart}>주인 레이드 시작 · 오늘 {left}번 남음</ActionButton>}
      <h3 className="fish-sheet-title">모든 주인 · {beaten}/{BOSSES.length}</h3>
      <ul className="fish-timed fish-boss-list">
        {BOSSES.map((b) => {
          const r = all[b.key], got = (r?.caught ?? 0) > 0, locked = level < b.level, h = bossHp(r, today);
          const where = SPOTS.find((x) => x.key === b.spot)?.name ?? b.spot;
          return (
            <li key={b.key} className={`${b.key === boss.key ? "is-now" : ""} ${got ? "is-got" : ""}`}>
              <span className="fish-boss-pic">{locked ? <LockMark /> : <FishArt artKey={b.species} />}</span>
              <span className="min-w-0 flex-1">
                <strong>{locked ? "???" : b.name}{got && <> <CrownIcon /></>}</strong>
                <small>{where} · {locked ? `낚시 Lv.${b.level}부터` : got ? `${r!.caught}번 잡음` : r ? `체력 ${pctOf(h)}` : "아직 겨루지 않음"}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </SheetShell>
  );
}

/** 때 손님 — 지금 이 낚시터에 누가 오는지, 언제 다시 오면 되는지 */
export function TimedSheet({ spot, moment, baitGrade, onClose }: { spot: FishSpot; moment: FishMoment; baitGrade: number; onClose: () => void }) {
  // 보름달 손님도 같은 목록에(칩의 반짝임과 같은 timedAt 기준) — 같은 품종이 두 곳에 있어 key 는 낚시터와 함께
  const here = [...TIMED_FISH, ...MOON_FISH].filter((t) => t.spot === spot.key);
  return (
    <SheetShell title="때 손님" onClose={onClose}>
      <p className="fish-how">시간과 날씨가 맞을 때만 다 큰 모습으로 무는 물고기예요. 날씨는 설정한 도시의 실제 날씨를 따라요.</p>
      <h3 className="fish-sheet-title">{spot.name}</h3>
      <ul className="fish-timed">
        {here.map((t) => {
          const now = timedMatches(t, moment), grade = speciesGrade(t.species), lowBait = grade ? GRADES.indexOf(grade) > baitGrade : false;
          return (
            <li key={`${t.spot}-${t.species}${t.moon ? "-moon" : ""}`} className={now ? "is-now" : ""}>
              <span className="fish-boss-pic"><FishArt artKey={t.species} /></span>
              <span className="min-w-0 flex-1"><strong>{speciesName(t.species)}</strong><small>{timedLabel(t)} · {grade}{now ? (lowBait ? " · 지금 왔지만 더 좋은 미끼가 필요해요" : " · 지금 와요!") : ""}</small></span>
            </li>
          );
        })}
      </ul>
      <h3 className="fish-sheet-title">다른 낚시터</h3>
      <ul className="fish-timed">
        {[...TIMED_FISH, ...MOON_FISH].filter((t) => t.spot !== spot.key).map((t) => (
          <li key={`${t.spot}-${t.species}${t.moon ? "-moon" : ""}`}><span className="min-w-0 flex-1"><strong>{speciesName(t.species)}</strong><small>{SPOTS.find((x) => x.key === t.spot)?.name} · {timedLabel(t)}</small></span></li>
        ))}
      </ul>
    </SheetShell>
  );
}

/** 물때 · 달(2026-11-12) — 오늘의 물때와 달이 낚시에 주는 것, 다음 보름, 보름달 손님. 값은 전부 fishtide.ts 한 곳에서(뽑기와 같은 식) */
export function MoonSheet({ spot, now, moment, baitGrade, onClose }: { spot: FishSpot; now: number; moment: FishMoment; baitGrade: number; onClose: () => void }) {
  const moon = moonPhase(now), tide = tideOf(now), fx = tideEffect(spot.water, moment.moon);
  const sea = spot.water === "sea", full = nextFullMoon(now), days = kstDayOf(full) - kstDayOf(now);
  const pct = (v: number) => `${Math.round(Math.abs(1 - v) * 100)}%`;
  const effect = !sea ? `강 · 호수는 물때가 없어요 — ${josa(WATER_NAME[spot.water], "은/는")} 밀물 · 썰물이 없어서 언제나 같아요.`
    : tide.kind === "sari" ? `사리 — 물살이 세서 입질이 빨라요(기다림 ${pct(fx.wait)} 짧게) · 대물이 조금 더 자주 와요.`
    : tide.kind === "jogeum" ? `조금 — 물이 거의 안 움직여 입질이 느려요(기다림 ${pct(fx.wait)} 길게).`
    : "중물 — 평소와 같아요. 사리(6~8물)엔 입질이 빨라지고 조금(13물 · 조금)엔 느려져요.";
  return (
    <SheetShell title="물때 · 달" onClose={onClose}>
      <div className="fish-moon-hero"><MoonIcon frac={moon.frac} size={72} /></div>
      <p className="fish-how">오늘의 달 <b>{moon.name}</b> · 밝기 {Math.round(moon.illum * 100)}% · 음력 {moon.lunarDay}일쯤{sea ? ` · 물때 ${tide.label}` : ""}</p>
      <h3 className="fish-sheet-title">{spot.name}</h3>
      <p className="fish-how">{effect}</p>
      {sea && <p className="fish-how">물때는 바다 낚시터에서만, 찌 · 심해 낚시의 입질까지 기다림과 물고기 길이에만 닿아요. 어떤 물고기가 무는지는 그대로예요.</p>}
      <h3 className="fish-sheet-title">보름달 손님</h3>
      {/* 세 갈래 — 망 시각이 지나면 nextFullMoon 은 다음 달로 넘어가는데 보름달 밤은 아직 남아 있다(낮에 열면 '29일 뒤'가 떴다) */}
      <p className="fish-how">{moment.moon?.full ? "보름달이 떴어요. 밤(20시~5시) 동안 이 바다에만 오는 손님이 있어요." : moon.name === "보름" ? "보름달 무렵이에요. 오늘 밤 20시부터 보름달 손님이 와요." : `다음 보름달 ${kstWhen(full)}쯤${days > 0 ? ` · ${days}일 뒤` : " · 오늘"} — 앞뒤로 이틀쯤 밤마다 와요.`}</p>
      <ul className="fish-timed">
        {MOON_FISH.map((t) => {
          const here = t.spot === spot.key, now2 = here && timedMatches(t, moment), grade = speciesGrade(t.species), lowBait = grade ? GRADES.indexOf(grade) > baitGrade : false;
          return (
            <li key={`${t.spot}-${t.species}`} className={now2 ? "is-now" : ""}>
              <span className="fish-boss-pic"><FishArt artKey={t.species} /></span>
              <span className="min-w-0 flex-1"><strong>{speciesName(t.species)}</strong><small>{SPOTS.find((x) => x.key === t.spot)?.name} · {timedLabel(t)} · {grade}{now2 ? (lowBait ? " · 지금 왔지만 더 좋은 미끼가 필요해요" : " · 지금 와요!") : ""}</small></span>
            </li>
          );
        })}
      </ul>
      <p className="fish-how">실제 날짜로 계산한 서해안 7물때식이에요(음력 1일 = 7물). 지역 · 날에 따라 실제 물때표와 하루쯤 다를 수 있어요.</p>
    </SheetShell>
  );
}

const chanceText = (v: number) => (v < 0.01 ? "1% 미만" : `${Math.round(v * 100)}%`);
/** 계열의 대표 그림 — 만난 다 큰 모습이 있으면 그것, 없으면 첫 품종 */
const famArt = (key: string, seen: ReadonlySet<string>) => {
  const f = FAMILIES.find((x) => x.key === key);
  return f?.finals.find((x) => seen.has(x.key))?.key ?? f?.finals[0].key ?? key;
};

/** 잡을 수 있는 물고기 — 지금 여기서 무는 것(확률은 실제 뽑기로 잰다)과 모든 어종이 어디서 잡히는지 */
export function FishListSheet({ spot, baitIdx, method, luck, moment, level, seen, onClose }: { spot: FishSpot; baitIdx: number; method: MethodKey; luck: number; moment: FishMoment; level: number; seen: ReadonlySet<string>; onClose: () => void }) {
  const [view, setView] = useState<"now" | "all">("now");
  const rows = useMemo(() => catchTable(spot, luck, baitIdx, method, moment), [spot, luck, baitIdx, method, moment.time, moment.wx, moment.moon?.full]); // eslint-disable-line react-hooks/exhaustive-deps
  const seenOf = (family: string) => ALL_FORMS.filter((x) => x.family === family && seen.has(x.key)).length;
  const totalOf = (family: string) => ALL_FORMS.filter((x) => x.family === family).length;
  const placed = new Set(SPOTS.flatMap((s) => s.pool.map(([k]) => k)));
  return (
    <SheetShell title="잡을 수 있는 물고기" onClose={onClose}>
      <div className="fish-rank-switch" role="group" aria-label="보기">
        <button type="button" aria-pressed={view === "now"} className={`tap ${view === "now" ? "is-on" : ""}`} onClick={() => setView("now")}>지금 여기</button>
        <button type="button" aria-pressed={view === "all"} className={`tap ${view === "all" ? "is-on" : ""}`} onClick={() => setView("all")}>모든 물고기</button>
      </div>
      {view === "now" ? (
        <>
          <p className="fish-how">{spot.name} · {BAITS[baitIdx].name} 기준이에요 · 쓰레기가 걸릴 확률 {chanceText(junkChance(luck, method))}</p>
          <ul className="fish-timed">
            {rows.map((r) => (
              <li key={r.family}>
                <span className="fish-boss-pic"><FishArt artKey={famArt(r.family, seen)} /></span>
                <span className="min-w-0 flex-1"><strong>{familyName(r.family)}</strong><small>{DEPTH_NAMES[familyDepth(r.family)]} · 도감 {seenOf(r.family)}/{totalOf(r.family)}칸 · 지금 {r.forms.length}가지 모습이 와요</small></span>
                <b className="fish-chance">{chanceText(r.chance)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="fish-how">{FAMILIES.length}종 · 도감 {ALL_FORMS.filter((x) => seen.has(x.key)).length}/{ALL_FORMS.length}칸</p>
          {SPOTS.map((s) => {
            const guests = FAMILIES.filter((f) => !placed.has(f.key) && TIMED_FISH.some((t) => t.spot === s.key && t.species === f.key));
            return (
              <section key={s.key}>
                <h3 className="fish-sheet-title">{s.name} <small>{WATER_NAME[s.water]}{level < s.minLevel ? ` · Lv.${s.minLevel}` : ""}</small></h3>
                <ul className="fish-timed">
                  {[...s.pool.map(([k]) => k), ...guests.map((f) => f.key)].map((k) => (
                    <li key={k} className={seenOf(k) ? "" : "is-unseen"}>
                      <span className="fish-boss-pic"><FishArt artKey={famArt(k, seen)} /></span>
                      <span className="min-w-0 flex-1">
                        <strong>{familyName(k)}</strong>
                        <small>{DEPTH_NAMES[familyDepth(k)]} · {BAITS[familyBaitTier(k)].name}부터 · 도감 {seenOf(k)}/{totalOf(k)}칸{guests.some((f) => f.key === k) ? ` · ${timedLabel(TIMED_FISH.find((t) => t.species === k)!)}에만` : ""}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </SheetShell>
  );
}

/** 커플 레이드(2026-11-10) [사용자: "커플이 같이 보스를 즐길 수 있는 방식으로 … 조금 더 웅장한 시스템으로"]
 *  둘이 깎은 몫(나 분홍 · 상대 파랑) · 오늘의 협공(둘 다 겨루면 판마다 1.5배) · 최근 기록 · 지난 토벌의 몫과 마지막 일격 */
function BossRaid({ rec, who, today }: { rec: BossRecord | undefined; who: string; today: string }) {
  const dmg = rec?.dmg ?? {};
  const mine = dmg[who] ?? 0, theirs = Object.entries(dmg).filter(([k]) => k !== who).reduce((a, [, v]) => a + v, 0);
  const duo = bossDuo(rec, who, today), meToday = rec?.tries[who]?.day === today;
  const name = (h: { who: string }) => (h.who === who ? "나" : "상대");
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <section className="fish-raid" aria-label="둘이 함께 잡기">
      <h3 className="fish-sheet-title">둘이 함께 잡기</h3>
      <i className="fish-raid-bar" aria-hidden>
        <b className="is-me" style={{ width: pct(mine) }} />
        <b className="is-you" style={{ width: pct(theirs) }} />
      </i>
      <p className="aqua-note"><span className="fish-raid-me">나 {pct(mine)}</span> · <span className="fish-raid-you">상대 {pct(theirs)}</span> 깎았어요</p>
      <p className={`aqua-note ${duo ? "fish-raid-on" : ""}`}>
        {duo ? `오늘 상대도 겨뤘어요 — 협공! 끌어올 때마다 ${BOSS_DUO}배로 깎여요` : meToday ? "상대가 오늘 한 번이라도 겨루면 협공이 켜져요" : `둘 다 오늘 겨루면 협공 — 판마다 ${BOSS_DUO}배로 깎여요`}
      </p>
      {(rec?.log?.length ?? 0) > 0 && (
        <ul className="fish-raid-log">
          {[...rec!.log!].reverse().slice(0, 5).map((h: BossHit, i) => (
            <li key={`${h.day}-${i}`}>{h.day.slice(5).replace("-", ".")} · {name(h)} {h.fin ? `마지막 일격 ${pct(h.d)}` : `${pct(h.d)} 깎음`}</li>
          ))}
        </ul>
      )}
      {rec?.last && (
        <p className="aqua-note">지난 토벌({rec.last.day.slice(5).replace("-", ".")}) — 마지막 일격 {rec.last.by === who ? "나" : "상대"} · 나 {pct(rec.last.dmg[who] ?? 0)} · 상대 {pct(Object.entries(rec.last.dmg).filter(([k]) => k !== who).reduce((a, [, v]) => a + v, 0))}</p>
      )}
    </section>
  );
}
