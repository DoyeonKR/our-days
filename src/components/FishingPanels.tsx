"use client";

/* 낚시 창의 장비 · 능력치 칸 — 판 진행(FishingGame)과 상관없이 사고 올리고 받는 곳. 저장은 부모의 act 가 한다. */
import { ActionButton } from "@/components/AppButtons";
import { BaitIcon, JunkIcon } from "@/components/FishingIcons";
import { Coin } from "@/components/island/UiIcon";
import { GRADES } from "@/lib/aquarium";
import { asset } from "@/lib/base";
import { BAITS, JUNKS, NETS, RODS, SPOTS, STAT_CAP, STAT_INFO, STAT_KEYS, baitStock, castRange, type FishStat, type FishingState } from "@/lib/fishing";
import { dailyGoals, goalTotal, nextGoals, type FishGoal } from "@/lib/fishinggoals";
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

export function FishStats({ fs, eff, busy, today, onSpend, onClaim }: {
  fs: FishingState; eff: Record<FishStat, number>; busy: boolean; today: string; onSpend: (k: FishStat) => void; onClaim: (id: string) => void;
}) {
  const next = nextGoals(fs);
  return (
    <>
      <section className="aqua-card">
        <header><strong>오늘의 목표</strong><small>날마다 새로 시작해요</small></header>
        <ul className="fish-goals">{dailyGoals(fs, today).map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
      <section className="aqua-card">
        <header><strong>낚시 목표</strong><small>{fs.goals.length}/{goalTotal()} 달성</small></header>
        <ul className="fish-goals">{next.map((g) => <GoalRow key={g.id} g={g} busy={busy} onClaim={onClaim} />)}</ul>
      </section>
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
