"use client";

/* 우리 수조의 카드들(2026-11-21 리뷰 ⑪ — AquariumGame.tsx 에서 옮겼다): 행사 카드 · 막대 · 물고기 카드(이름 · 이야기) · 조명 가게 ·
 * 가득 찼을 때 견주기 · 추모 칸 · 변이 도감. 규칙은 lib(순수), 여기는 그리기뿐이다. 저장은 부모(AquariumGame 의 act)가 한다. */
import { ActionButton } from "@/components/AppButtons";
import { isEventFamily } from "@/lib/eventfish";
import { SPOTS, releaseBossPlan, releaseSpot } from "@/lib/fishing";
import { MASTERY_RELEASE_N } from "@/lib/fishmastery";
import { fmtCm } from "@/lib/fishingworld";
import { josa } from "@/lib/josa";
import { AQUA_LIGHTS } from "@/lib/aqualight";
import { useState } from "react";
import { FishArt } from "@/components/AquaArt";
import { Coin } from "@/components/island/UiIcon";
import { MORPHS, MORPH_INFO, morphDex, type Morph } from "@/lib/aquamorph";
import { NAME_LEN, checkFishName } from "@/lib/aqualife";
import { memorialLine, storyLine } from "@/lib/aquastory";
import { graphemes, normalizeShortText } from "@/lib/shorttext";
import { monthDay, type ActiveEvent, type AquaEventKey } from "@/lib/aquaevent";
import type { IslandState } from "@/lib/island";
import { breedInfo } from "@/lib/aquatoday";
import { CARE_MARKS, FAVORITE_DECOR, aquaDangers, GRADES, fishAge, fishMorph, fishNick, decorOf, familyOf, fishArtKey, fishCare, fishCm, fishName, foodOf, hoursLeft, likedFood, nextForm, openFinals, releaseReward, speciesOf, type AquaFish, type AquaState, type Grade } from "@/lib/aquarium";

function duration(h: number): string {
  if (h < 1) return "1시간 안";
  if (h < 48) return `${Math.ceil(h)}시간`;
  return `${Math.ceil(h / 24)}일`;
}

const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** 계절 수조 행사 카드(2026-11-13) — 지금 열린 행사 · 남은 날 · 규칙 한 줄 · 한정 장식 받기. 행사가 없으면 다음 행사를 미리 알린다 */
export function EventCard({ events, next, busy, claimed, why, onClaim }: {
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

export function Meter({ label, value, marks = [] }: { label: string; value: number; marks?: { at: number; label: string }[] }) {
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

export function FishCard({ f, a, seen, now, who, couple, busy, onRelease, onName }: {
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
          {f.stage === 2 ? (sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small className="aqua-note">다 컸어요</small>) : <small className="aqua-note">성장 {pct}% · {duration(hoursLeft(a, f))} 남음 · 정성 {cq}</small>}
          {isEventFamily(f.family) && <span className="aqua-grade is-event">이벤트</span>}
        </span>
        <ActionButton onClick={onRelease}>보내 주기 <span className="aqua-price"><Coin /> {reward.toLocaleString()}</span></ActionButton>
      </div>
      {(() => {
        // 상성(2026-11-21 리뷰 ⑥) — 수조 아래 '상성 주의' 줄에만 있어서 물고기를 눌러도 몰랐다
        const pairs = aquaDangers(a);
        const preys = pairs.filter((x) => x.pred.id === f.id).map((x) => x.prey);
        const preds = pairs.filter((x) => x.prey.id === f.id).map((x) => x.pred);
        if (!preys.length && !preds.length) return null;
        const names = (xs: AquaFish[]) => [...new Set(xs.map((x) => fishNick(a, x.id) ?? fishName(x)))].slice(0, 3).join(" · ");
        return (
          <p className="aqua-warn aqua-fish-danger" role="note">
            {preds.length > 0 && <>{josa(names(preds), "이/가")} 이 물고기를 노려요 — 배고프면 잡아먹혀요. </>}
            {preys.length > 0 && <>배고프면 작은 물고기 {preys.length}마리({names(preys)})를 잡아먹어요.</>}
          </p>
        );
      })()}
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
export function MorphTag({ morph }: { morph: Morph | null }) {
  if (!morph) return null;
  return <span className={`aqua-morph-tag is-${morph}`}>{MORPH_INFO[morph].name}</span>;
}

/** 이름 짓기 — 10글자(자소 묶음) · 주소 금지는 엔진(nameFish)이 다시 본다. 한글 조합 중 Enter 는 보내지 않는다 */
export function NameForm({ nick, busy, onName }: { nick: string; busy: boolean; onName: (name: string) => Promise<boolean> }) {
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
export function FishStory({ f, a, who, couple }: { f: AquaFish; a: AquaState; who: string; couple: boolean }) {
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
export function LightShop({ owned, on, coins, busy, onBuy, onSet }: { owned: readonly string[]; on: string | null; coins: number; busy: boolean; onBuy: (key: string) => void; onSet: (key: string | null) => void }) {
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

/** 수조가 가득 찼을 때 — 누구를 보내면 무엇을 받나 한 장에서 견준다(2026-11-21 리뷰 ⑤). 확인창 · 저장과 같은 계산(releaseReward · releaseBossPlan · releaseSpot)
 *  다 큰 물고기를 먼저, 그 안에서 받는 하트가 많은 순. 치어 · 어린 물고기는 주인 · 숙련 덤이 없다 */
export function FullCompare({ a, st, now, busy, onRelease }: { a: AquaState; st: IslandState; now: number; busy: boolean; onRelease: (f: AquaFish) => void }) {
  const rows = a.fish.filter((f) => !f.crown).map((f) => {
    const plan = f.stage === 2 ? releaseBossPlan(st, f.id, now) : null;
    const spot = f.stage === 2 ? releaseSpot(f, a.life) : undefined;
    return { f, heart: releaseReward(f), boss: plan && "total" in plan ? { name: plan.name, h: plan.add } : null, spot: spot ? SPOTS.find((x) => x.key === spot)?.name ?? null : null };
  }).sort((x, y) => (y.f.stage === 2 ? 1 : 0) - (x.f.stage === 2 ? 1 : 0) || y.heart - x.heart).slice(0, 8);
  if (!rows.length) return null;
  return (
    <section id="aqua-full" className="aqua-card aqua-full-compare">
      <header><strong>수조가 가득 찼어요</strong><small>보내면 받는 것</small></header>
      <p className="aqua-note">다 키워 보내면 하트에 더해 그 낚시터 주인이 빨리 오고 숙련도가 올라요. 도감 기록은 남아요.</p>
      <ul>
        {rows.map(({ f, heart, boss, spot }) => (
          <li key={f.id}>
            <span className="aqua-thumb"><FishArt artKey={fishArtKey(f)} morph={fishMorph(a, f)} /></span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate">{fishNick(a, f.id) ?? fishName(f)}</strong>
              <small className="block">
                <span className="aqua-price"><Coin /> {heart.toLocaleString()}</span>
                {boss ? ` · ${boss.name} +${boss.h}시간` : ""}
                {spot ? ` · ${spot} 숙련 +${MASTERY_RELEASE_N}` : ""}
                {f.stage !== 2 ? " · 다 키우면 더 받아요" : ""}
              </small>
            </span>
            <ActionButton disabled={busy} onClick={() => onRelease(f)}>보내기</ActionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MemorialCard({ a }: { a: AquaState }) {
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
export function MorphDexCard({ a }: { a: AquaState }) {
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

/** 알(번식) 진행(2026-11-21 리뷰 ②) — 짝이 잘 지낸 시간이 쌓이면 치어 하나(lib/aquatoday 의 breedInfo, 정산과 같은 값).
 *  예전엔 화면 어디에도 없어 변이 도감을 어떻게 채우는지 알 길이 없었다 */
export function BreedCard({ a }: { a: AquaState }) {
  const b = breedInfo(a);
  if (!b.pairs.length && !b.single.length) return null;
  const famName = (k: string) => familyOf(k)?.name ?? k;
  return (
    <section className="aqua-card aqua-breed" aria-label="알 낳기">
      <header><strong>알 낳기</strong><small>다 큰 같은 물고기 한 쌍이 잘 지내면 {b.need}시간마다 알 하나 · 드물게 색 변이</small></header>
      {b.pairs.length > 0 ? (
        <>
          <div className="aqua-breed-bar" role="meter" aria-label="알까지" aria-valuemin={0} aria-valuemax={b.need} aria-valuenow={Math.round(b.h)}>
            <i aria-hidden><b style={{ width: `${Math.min(100, (b.h / b.need) * 100)}%` }} /></i>
            <small>{Math.floor(b.h)}/{b.need}시간</small>
          </div>
          <p className="aqua-note">짝: {b.pairs.map(famName).join(" · ")}{b.pairs.length > 1 ? " — 알은 그중 하나에서 나와요" : ""}</p>
          <p className="aqua-note">
            {b.blocked === "room" ? "수조가 가득 차서 알이 쌓이지 않아요 — 한 마리를 보내 주거나 수조를 넓혀 주세요."
              : b.blocked === "care" ? "먹이 · 물이 표시선 밑이라 지금은 쌓이지 않아요 — 먹이를 주고 물을 갈아 주세요."
              : `지금처럼 잘 돌보면 약 ${duration(b.leftH ?? 0)} 뒤에 알이 생겨요.`}
          </p>
        </>
      ) : null}
      {b.single.length > 0 && <p className="aqua-note">{b.single.slice(0, 4).map(famName).join(" · ")}{b.single.length > 4 ? ` 외 ${b.single.length - 4}` : ""} — 다 큰 물고기가 하나 더 있으면 짝이 돼요.</p>}
    </section>
  );
}
