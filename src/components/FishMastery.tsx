"use client";
/** 수집 탭 '낚시터 숙련도'(2026-11-12) — 낚시터마다 별 · 다음 별까지 · 받은 보상 · 배경 고르기. 계산은 전부 lib/fishmastery(화면은 그리기만) */
import { SPOTS } from "@/lib/fishing";
import { bossAt } from "@/lib/fishingworld";
import { AWAKE_STAR, LOOK_NAME, LOOK_STAR, MASTERY_LUCK_PER_STAR, MASTERY_SALE_BONUS, MASTERY_SALE_STAR, MAX_STARS, awakeBossAt, looksOpen, nextNeed, setSpotLook, spotLookOf, spotMastery, starsFor, type SpotLook } from "@/lib/fishmastery";
import { ActionButton } from "@/components/AppButtons";
import { josa } from "@/lib/josa";
import type { FishTabProps } from "@/components/FishCollect";

const starText = (n: number) => "★".repeat(n) + "☆".repeat(MAX_STARS - n);

export default function FishMastery({ st, fs, busy, act }: FishTabProps) {
  const open = SPOTS.filter((x) => x.minLevel <= fs.level);
  const total = open.reduce((n, x) => n + starsFor(spotMastery(st, x.key)), 0);
  return (
    <section className="aqua-card">
      <header><strong>낚시터 숙련도</strong><small>별 {total}/{SPOTS.length * MAX_STARS}</small></header>
      <p className="aqua-note mt-2">
        끌어올린 수와 만난 종류로 별을 받아요 · 별마다 그 낚시터에서 행운 +{MASTERY_LUCK_PER_STAR} · ★{LOOK_STAR.dusk} {LOOK_NAME.dusk} 배경 · ★{LOOK_STAR.night} {LOOK_NAME.night} 배경 · ★{MASTERY_SALE_STAR} 팔기 하트 +{Math.round(MASTERY_SALE_BONUS * 100)}% · ★{AWAKE_STAR} 각성한 주인
      </p>
      <ul className="fish-goals">
        {SPOTS.map((x) => {
          if (x.minLevel > fs.level) return <li key={x.key} className="is-claimed"><span className="min-w-0 flex-1"><strong>{x.name}</strong><small>낚시 Lv.{x.minLevel}부터</small></span></li>;
          const m = spotMastery(st, x.key), stars = starsFor(m), need = nextNeed(m);
          const pct = need ? Math.min(m.n / need.n, m.kinds.length / need.kinds) * 100 : 100;
          const look = spotLookOf(st, x.key), looks = looksOpen(stars);
          const awake = awakeBossAt(st, x.key), base = bossAt(x.key);
          return (
            <li key={x.key}>
              <span className="min-w-0 flex-1">
                <strong>{x.name} <span aria-label={`별 ${stars}개`}>{starText(stars)}</span></strong>
                <i className="fish-goal-bar" aria-hidden><b style={{ width: `${pct}%` }} /></i>
                <small>
                  {need ? `다음 별까지 ${m.n.toLocaleString()}/${need.n.toLocaleString()}마리 · 종류 ${m.kinds.length}/${need.kinds}` : `${m.n.toLocaleString()}마리 · 종류 ${m.kinds.length} · 별을 다 모았어요`}
                  {stars > 0 ? ` · 행운 +${stars * MASTERY_LUCK_PER_STAR}` : ""}
                  {stars >= MASTERY_SALE_STAR ? ` · 팔기 +${Math.round(MASTERY_SALE_BONUS * 100)}%` : ""}
                  {stars >= AWAKE_STAR && base ? (awake ? ` · ${awake.name} — 낚시터의 '각성' 칩에서 도전해요` : ` · ${josa(base.name, "을/를")} 한 번 잡으면 각성한 주인이 열려요`) : ""}
                </small>
                {looks.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`${x.name} 배경`}>
                    <ActionButton on={!look} disabled={busy} aria-pressed={!look} onClick={() => void act((s) => setSpotLook(s, x.key, null))}>지금 하늘</ActionButton>
                    {looks.map((k: SpotLook) => (
                      <ActionButton key={k} on={look === k} disabled={busy} aria-pressed={look === k} onClick={() => void act((s) => setSpotLook(s, x.key, k))}>{LOOK_NAME[k]}</ActionButton>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
