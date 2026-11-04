"use client";

/* 낚시 창의 장비 · 능력치 칸 — 판 진행(FishingGame)과 상관없이 사고 올리고 받는 곳. 저장은 부모의 act 가 한다. */
import type { ReactNode } from "react";
import { ActionButton } from "@/components/AppButtons";
import { BaitIcon, JunkIcon } from "@/components/FishingIcons";
import { Coin } from "@/components/island/UiIcon";
import { GRADES } from "@/lib/aquarium";
import { asset } from "@/lib/base";
import { useMemo, useState } from "react";
import { ALL_FORMS, FAMILIES } from "@/lib/aquarium";
import { BAITS, JUNKS, NETS, RODS, SPOTS, STAT_CAP, STAT_INFO, STAT_KEYS, baitStock, castRange, catchTable, familyBaitTier, junkChance, type FishSpot, type FishStat, type FishingState, type MethodKey } from "@/lib/fishing";
import { dailyGoals, goalTotal, nextGoals, type FishGoal } from "@/lib/fishinggoals";
import { CloseButton } from "@/components/AppButtons";
import { FishArt } from "@/components/AquaArt";
import { BOSSES, BOSS_RETURN_DAYS, EXPED_NAME, artName, EXPED_TOGETHER, TIMED_FISH, bossHp, bossReward, bossTriesLeft, expedAllBonus, expedText, expedValue, familyName, fmtCm, speciesGrade, speciesName, timedLabel, timedMatches, type BossRecord, type ExpedKey, type Expedition, type FishBoss, type FishMoment } from "@/lib/fishingworld";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";

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
      <header><strong>{title}</strong><small>{desc}</small></header>
      <ul className="aqua-shop is-flat">
        {list.map((x, i) => (
          <li key={x.key} className={i > cur + 1 ? "is-locked" : ""}>
            <span className="aqua-shop-pic"><GearPic k={x.key} label={x.name} /></span>
            <span className="min-w-0 flex-1">
              <strong>{x.name}</strong>
              <small>{stat(x)}</small>
            </span>
            {i <= cur ? <small>{i === cur ? "쓰는 중" : "지나옴"}</small> : i === cur + 1 ? (
              <ActionButton disabled={busy || coins < x.price} onClick={onBuy}>
                <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
              </ActionButton>
            ) : <small>앞 단계 먼저</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FishGear({ fs, coins, busy, today, onBuyRod, onBuyNet, onBuyBait }: {
  fs: FishingState; coins: number; busy: boolean; today: string; onBuyRod: () => void; onBuyNet: () => void; onBuyBait: (key: string) => void;
}) {
  return (
    <>
      <GearList title="낚싯대" desc="힘과 줄 다루기가 올라요" list={RODS} cur={fs.rod} coins={coins} busy={busy} stat={(x) => `힘 +${x.power} · 줄 다루기 +${x.line} · 최대 ${Math.round(castRange(RODS.indexOf(x), fs.stats.power))}m`} onBuy={onBuyRod} />
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
      <header><strong>낚시터의 주인</strong><small>{BOSSES.filter((b) => fs.bosses[b.key]?.caught).length}/{BOSSES.length} 잡음</small></header>
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

/** 크기 기록 — 계열별 사람별 최고 */
function SizeList({ fs, who }: { fs: FishingState; who: string }) {
  const rows = Object.entries(fs.sizes).filter(([k]) => artName(k));
  if (!rows.length) return null;
  return (
    <section className="aqua-card">
      <header><strong>크기 기록</strong><small>내 기록을 넘기면 하트 · 경험치 1.5배</small></header>
      <ul className="fish-sizes">
        {rows.map(([k, row]) => {
          const mine = row[who] ?? 0, other = Math.max(0, ...Object.entries(row).filter(([u]) => u !== who).map(([, v]) => v));
          return (
            <li key={k}>
              <strong>{artName(k)}</strong>
              <span className={mine >= other ? "is-lead" : ""}>나 {mine ? fmtCm(mine) : "-"}</span>
              {other > 0 && <span className={other > mine ? "is-lead" : ""}>상대 {fmtCm(other)}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FishStats({ fs, eff, busy, today, who, exped, couple, cheered, onCheer, onSpend, onClaim }: {
  fs: FishingState; eff: Record<FishStat, number>; busy: boolean; today: string; who: string; exped: Expedition; couple: boolean; cheered: boolean; onCheer: () => void; onSpend: (k: FishStat) => void; onClaim: (id: string) => void;
}) {
  const next = nextGoals(fs);
  return (
    <>
      <ExpedCard e={exped} who={who} couple={couple} cheered={cheered} onCheer={onCheer} />
      <BossList fs={fs} today={today} />
      <section className="aqua-card">
        <header><strong>오늘의 목표</strong><small>날마다 새로 시작해요</small></header>
        <ul className="fish-goals">{dailyGoals(fs, today).map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
      <section className="aqua-card">
        <header><strong>낚시 목표</strong><small>{fs.goals.length}/{goalTotal()} 달성</small></header>
        <ul className="fish-goals">{next.map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
      <SizeList fs={fs} who={who} />
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
      <section className="aqua-card">
        <header><strong>쓰레기 수집함</strong><small>{JUNKS.filter((j) => (fs.junk[j.key] ?? 0) > 0).length}/{JUNKS.length}종 · 바다를 {Object.values(fs.junk).reduce((n, v) => n + v, 0)}번 치웠어요</small></header>
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
    </>
  );
}

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fish-sheet-back" onClick={onClose}>
      <div className="fish-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="fish-sheet-head"><strong>{title}</strong><CloseButton onClose={onClose} label="닫기" /></header>
        {children}
      </div>
    </div>
  );
}

/** 주인 — 도전을 켜면 다음 판이 주인과의 싸움이다 */
export function BossSheet({ boss, rec, today, who, why, on, tries, onClose, onToggle }: { boss: FishBoss; rec: BossRecord | undefined; today: string; who: string; why: string | null; on: boolean; tries: number; onClose: () => void; onToggle: () => void }) {
  const hp = bossHp(rec, today), left = bossTriesLeft(rec, who, today);
  return (
    <SheetShell title={`이 낚시터의 주인 · ${boss.name}`} onClose={onClose}>
      <div className="fish-boss-hero"><FishArt artKey={boss.species} /></div>
      <p className="fish-how">{boss.story}</p>
      <p className="aqua-note">{speciesName(boss.species)} · {speciesGrade(boss.species) ?? GRADES[0]} · 길이 {fmtCm(boss.cm)}</p>
      <i className="fish-goal-bar is-boss mt-2" aria-hidden><b style={{ width: `${hp * 100}%` }} /></i>
      <p className="aqua-note">체력 {pctOf(hp)} · 오늘 도전 {left}/{tries}번 남음 · 줄이 끊겨도 깎은 만큼 남아요{rec?.caught ? ", 둘이 함께 깎아요" : " · 둘이 함께 깎아요"}</p>
      <p className="aqua-note">찌낚시로 겨뤄요 · 잡으면 왕관을 쓰고 수조에 들어와요 · 보상 <Coin /> {bossReward(boss, rec?.caught ?? 0).toLocaleString()} · {BOSS_RETURN_DAYS}일 뒤 다시 나타나요</p>
      {why ? <p className="aqua-msg">{why}</p> : <ActionButton main wide className="mt-3" onClick={onToggle}>{on ? "도전 그만두기" : "다음 판은 주인에게 도전"}</ActionButton>}
    </SheetShell>
  );
}

/** 때 손님 — 지금 이 낚시터에 누가 오는지, 언제 다시 오면 되는지 */
export function TimedSheet({ spot, moment, baitGrade, onClose }: { spot: FishSpot; moment: FishMoment; baitGrade: number; onClose: () => void }) {
  const here = TIMED_FISH.filter((t) => t.spot === spot.key);
  return (
    <SheetShell title="때 손님" onClose={onClose}>
      <p className="fish-how">시간과 날씨가 맞을 때만 다 큰 모습으로 무는 물고기예요. 날씨는 설정한 도시의 실제 날씨를 따라요.</p>
      <h3 className="fish-sheet-title">{spot.name}</h3>
      <ul className="fish-timed">
        {here.map((t) => {
          const now = timedMatches(t, moment), grade = speciesGrade(t.species), lowBait = grade ? GRADES.indexOf(grade) > baitGrade : false;
          return (
            <li key={t.species} className={now ? "is-now" : ""}>
              <span className="fish-boss-pic"><FishArt artKey={t.species} /></span>
              <span className="min-w-0 flex-1"><strong>{speciesName(t.species)}</strong><small>{timedLabel(t)} · {grade}{now ? (lowBait ? " · 지금 왔지만 더 좋은 미끼가 필요해요" : " · 지금 와요!") : ""}</small></span>
            </li>
          );
        })}
      </ul>
      <h3 className="fish-sheet-title">다른 낚시터</h3>
      <ul className="fish-timed">
        {TIMED_FISH.filter((t) => t.spot !== spot.key).map((t) => (
          <li key={t.species}><span className="min-w-0 flex-1"><strong>{speciesName(t.species)}</strong><small>{SPOTS.find((x) => x.key === t.spot)?.name} · {timedLabel(t)}</small></span></li>
        ))}
      </ul>
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
  const rows = useMemo(() => catchTable(spot, luck, baitIdx, method, moment), [spot, luck, baitIdx, method, moment.time, moment.wx]); // eslint-disable-line react-hooks/exhaustive-deps
  const seenOf = (family: string) => ALL_FORMS.filter((x) => x.family === family && seen.has(x.key)).length;
  const totalOf = (family: string) => ALL_FORMS.filter((x) => x.family === family).length;
  const placed = new Set(SPOTS.flatMap((s) => s.pool.map(([k]) => k)));
  return (
    <SheetShell title="잡을 수 있는 물고기" onClose={onClose}>
      <div className="fish-rank-switch" role="tablist" aria-label="보기">
        <button type="button" role="tab" aria-selected={view === "now"} className={`tap ${view === "now" ? "is-on" : ""}`} onClick={() => setView("now")}>지금 여기</button>
        <button type="button" role="tab" aria-selected={view === "all"} className={`tap ${view === "all" ? "is-on" : ""}`} onClick={() => setView("all")}>모든 물고기</button>
      </div>
      {view === "now" ? (
        <>
          <p className="fish-how">{spot.name} · {BAITS[baitIdx].name} 기준이에요 · 쓰레기가 걸릴 확률 {chanceText(junkChance(luck, method))}</p>
          <ul className="fish-timed">
            {rows.map((r) => (
              <li key={r.family}>
                <span className="fish-boss-pic"><FishArt artKey={famArt(r.family, seen)} /></span>
                <span className="min-w-0 flex-1"><strong>{familyName(r.family)}</strong><small>도감 {seenOf(r.family)}/{totalOf(r.family)}칸 · 지금 {r.forms.length}가지 모습이 와요</small></span>
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
                <h3 className="fish-sheet-title">{s.name} {level < s.minLevel && <small>Lv.{s.minLevel}</small>}</h3>
                <ul className="fish-timed">
                  {[...s.pool.map(([k]) => k), ...guests.map((f) => f.key)].map((k) => (
                    <li key={k} className={seenOf(k) ? "" : "is-unseen"}>
                      <span className="fish-boss-pic"><FishArt artKey={famArt(k, seen)} /></span>
                      <span className="min-w-0 flex-1">
                        <strong>{familyName(k)}</strong>
                        <small>{BAITS[familyBaitTier(k)].name}부터 · 도감 {seenOf(k)}/{totalOf(k)}칸{guests.some((f) => f.key === k) ? ` · ${timedLabel(TIMED_FISH.find((t) => t.species === k)!)}에만` : ""}</small>
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
