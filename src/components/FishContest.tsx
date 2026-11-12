"use client";
/** 수집 탭 '이달의 대회'(2026-11-12) — [사용자: "달마다 물고기 한 종을 정해 크기를 겨루고, 1등에게 칭호와 한정 찌를 줍니다"]
 *  규칙은 lib/fishcontest(그 달의 어종 · 달 경계 · 상품 받기), 순위는 서버(fish_month_contest). 화면은 그리기 + 지난달 1등이면 상품 받기 한 번.
 *  - 서버에 함수가 아직 없으면(migration 적용 전) '대회 준비 중' — 오류로 떠들지 않는다.
 *  - 상품 받기는 서버가 지난달 내 줄을 1등이라 할 때만, 이 화면이 열려 있는 동안 달마다 한 번(act 는 거절 사유를 띄우므로 미리 canClaim 으로 거른다). */
import { useEffect, useRef, useState } from "react";
import type { FishTabProps } from "@/components/FishCollect";
import { FishArt } from "@/components/AquaArt";
import { familyOf } from "@/lib/aquarium";
import { getFishMonthContest } from "@/lib/couple";
import { canClaim, claimContest, claimedMonth, contestFamily, contestFamilyName, daysLeft, kstMonthOf, monthLabel, myTitles, shiftMonth, type ContestRow } from "@/lib/fishcontest";
import { fmtCm } from "@/lib/fishingworld";
import { TROPHY_BOBBER, lookById } from "@/lib/fishlooks";

/** rows null = 서버에 대회가 아직 없다(준비 중) */
type Board = { month: string; rows: ContestRow[] | null; failed: boolean };

function useContest(month: string): Board | null {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    let alive = true;
    void getFishMonthContest(month)
      .then((rows) => { if (alive) setBoard({ month, rows, failed: false }); })
      .catch(() => { if (alive) setBoard({ month, rows: [], failed: true }); });
    return () => { alive = false; };
  }, [month]);
  // 달이 바뀐 직후엔 옛 달의 결과를 보이지 않는다
  return board?.month === month ? board : null;
}

export default function FishContest(p: FishTabProps) {
  const month = kstMonthOf(p.now);
  const last = shiftMonth(month, -1);
  const fam = contestFamily(month) ?? "crucian";
  const lastFam = contestFamily(last) ?? "crucian";
  const cur = useContest(month);
  const prev = useContest(last);
  const tried = useRef<string | null>(null);

  const claimable = !!prev?.rows && canClaim(p.st, last, prev.rows, p.now);
  useEffect(() => {
    if (!claimable || p.busy || tried.current === last) return;
    tried.current = last;
    // 판정(canClaim)과 같은 시계(p.now — 서버 보정) — 기기 시계가 늦으면 '끝나지 않은 대회'로 거절돼 사유가 뜬다
    const at = p.now;
    void p.act((s) => claimContest(s, p.who, last, lastFam, at));
  }, [claimable, p.busy, last, lastFam, p]);

  const name = contestFamilyName(fam);
  const art = familyOf(fam)?.finals[0].key ?? fam;
  const trophy = lookById(TROPHY_BOBBER);
  const titles = myTitles(p.st, p.who);
  const mine = cur?.rows?.find((r) => r.is_me);
  const lastTop = prev?.rows?.find((r) => r.rank === 1);

  return (
    <section className="aqua-card fish-contest">
      <header><strong>이달의 대회</strong><small>{Number(month.slice(5))}월 · {daysLeft(p.now)}일 남음</small></header>
      {cur && cur.rows === null ? (
        <p className="aqua-note fish-rank-empty">대회 준비 중이에요. 곧 열려요</p>
      ) : (
        <>
          <div className="fish-contest-head">
            <span className="fish-contest-art" aria-hidden><FishArt artKey={art} size={64} /></span>
            <span className="min-w-0 flex-1">
              <strong>{name}</strong>
              <small>이번 달엔 {name}만 재요 · 사람마다 가장 긴 한 마리 · 같은 길이면 먼저 잡은 사람</small>
              <small>내 기록 {mine ? `${fmtCm(mine.cm)} · ${mine.rank}등` : "아직 없어요"}</small>
            </span>
          </div>
          {!cur ? <p className="aqua-note fish-rank-empty">불러오는 중…</p>
            : cur.failed ? <p className="aqua-note fish-rank-empty">순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
            : cur.rows && cur.rows.length === 0 ? <p className="aqua-note fish-rank-empty">아직 잰 사람이 없어요. 가장 먼저 올려 보세요!</p>
            : (
              <div className="fish-cm-board">
                <section>
                  <h4>{monthLabel(month)} 순위</h4>
                  <ol>
                    {(cur.rows ?? []).map((r) => {
                      const form = r.catch_name.replace(name, "").trim();
                      return (
                        <li key={r.rank} className={r.is_me ? "is-me" : ""}>
                          <b>{r.rank}</b>
                          <span>{r.name}{form && <small>{form}</small>}</span>
                          <em>{fmtCm(r.cm)}</em>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </div>
            )}
        </>
      )}
      {/* 불러오지 못했으면 '기록이 없었어요'로 말하지 않는다 */}
      {prev?.rows && !prev.failed && (
        <p className="aqua-note">
          지난달({monthLabel(last)} {contestFamilyName(lastFam)}) 1등 — {lastTop ? `${lastTop.name} · ${fmtCm(lastTop.cm)}` : "기록이 없었어요"}
          {lastTop?.is_me ? (claimedMonth(p.st, last) ? " · 상품을 받았어요" : " · 상품을 받는 중이에요") : ""}
        </p>
      )}
      <p className="aqua-note">
        1등 상품: 칭호 &apos;이달의 강태공&apos; · 한정 &apos;{trophy?.name ?? "강태공 찌"}&apos;(장비 탭의 꾸미기에서 껴요) · 달이 끝난 뒤 이 칸을 열면 받아요 · 모습만 바뀌어요
      </p>
      {titles.length > 0 && (
        <ul className="fish-contest-titles" aria-label="내 칭호">
          {titles.map((t) => <li key={t.id}>{t.text}</li>)}
        </ul>
      )}
    </section>
  );
}
