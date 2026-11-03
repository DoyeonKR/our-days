"use client";

/* 낚시 랭킹판 — 점수(이번 달 · 전체)와 물고기 종류별 크기. 커플 순위는 2026-11-03 뺐다[사용자: "커플랭킹은 없애버리자"]. 점수 계산은 서버(submit_fish_catch), 순위도 서버(fish_board) — 여기는 보여 주기만 한다.
 * 이름이 없는 계정은 합치기 순위판과 같은 닉네임 칸(이 기기)을 쓴다. */
import { useEffect, useState } from "react";
import { GRADES } from "@/lib/aquarium";
import { getFishBoard, getFishSizeBoard, type FishBoardPeriod, type FishBoardRow, type FishSizeRow } from "@/lib/couple";
import { FAMILIES } from "@/lib/aquarium";
import { familyName, fmtCm } from "@/lib/fishingworld";

/** 모든 어종 — 때 손님(은어 · 메기 · 해파리)도 빠지지 않게 물고기 표에서 바로 읽는다 */
const RANK_FAMILIES = FAMILIES.map((f) => f.key);

const NICK_KEY = "ourdays:merge:nick";
export function readFishNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function FishRank({ myName }: { myName: string }) {
  const [view, setView] = useState<"score" | "size">("score");
  const [period, setPeriod] = useState<FishBoardPeriod>("month");
  const [family, setFamily] = useState(RANK_FAMILIES[0]);
  const [board, setBoard] = useState<{ key: string; rows: FishBoardRow[]; failed: boolean } | null>(null);
  const [sizes, setSizes] = useState<{ key: string; rows: FishSizeRow[]; failed: boolean } | null>(null);
  const [nick, setNick] = useState(readFishNick);

  useEffect(() => {
    if (view !== "score") return;
    let alive = true;
    void getFishBoard(period)
      .then((rows) => { if (alive) setBoard({ key: period, rows, failed: false }); })
      .catch(() => { if (alive) setBoard({ key: period, rows: [], failed: true }); });
    return () => { alive = false; };
  }, [view, period]);
  useEffect(() => {
    if (view !== "size") return;
    let alive = true;
    void getFishSizeBoard(family)
      .then((rows) => { if (alive) setSizes({ key: family, rows, failed: false }); })
      .catch(() => { if (alive) setSizes({ key: family, rows: [], failed: true }); });
    return () => { alive = false; };
  }, [view, family]);

  const now = board?.key === period ? board : null;
  const sizeNow = sizes?.key === family ? sizes : null;

  return (
    <section className="aqua-card fish-rank">
      <header><strong>낚시 랭킹</strong><small>{view === "score" ? "끌어올린 물고기가 점수가 돼요" : "사람마다 가장 긴 한 마리"}</small></header>
      <div className="fish-rank-switch" role="tablist" aria-label="순위 종류">
        {([["score", "점수"], ["size", "크기"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={`tap ${view === k ? "is-on" : ""}`} onClick={() => setView(k)}>{label}</button>
        ))}
      </div>
      {view === "score" ? (
        <>
          <div className="fish-rank-switch is-small" role="tablist" aria-label="기간">
            {([["month", "이번 달"], ["all", "전체"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={period === k} className={`tap ${period === k ? "is-on" : ""}`} onClick={() => setPeriod(k)}>{label}</button>
            ))}
          </div>
          {!now ? <p className="aqua-note fish-rank-empty">불러오는 중…</p>
            : now.failed ? <p className="aqua-note fish-rank-empty">순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
            : now.rows.length === 0 ? <p className="aqua-note fish-rank-empty">아직 기록이 없어요. 첫 물고기의 주인공이 되어 보세요!</p>
            : (
              <ol className="fish-rank-list">
                {now.rows.map((r) => (
                  <li key={r.rank} className={`${r.is_me ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""}`}>
                    <b className="fish-rank-no">{r.rank}</b>
                    <span className="min-w-0 flex-1">
                      <strong>{r.name}</strong>
                      <small>{r.catches.toLocaleString()}마리{r.best_name ? ` · 최고 ${r.best_name}` : ""}{r.best_name && r.best_grade !== null ? ` (${GRADES[r.best_grade]})` : ""}</small>
                    </span>
                    <em>{r.score.toLocaleString()}<i>점</i></em>
                  </li>
                ))}
              </ol>
            )}
        </>
      ) : (
        <>
          <div className="fish-rank-families" role="tablist" aria-label="물고기 종류">
            {RANK_FAMILIES.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={family === k} className={`tap ${family === k ? "is-on" : ""}`} onClick={() => setFamily(k)}>{familyName(k)}</button>
            ))}
          </div>
          {!sizeNow ? <p className="aqua-note fish-rank-empty">불러오는 중…</p>
            : sizeNow.failed ? <p className="aqua-note fish-rank-empty">순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
            : sizeNow.rows.length === 0 ? <p className="aqua-note fish-rank-empty">아직 잰 사람이 없어요. 가장 먼저 올려 보세요!</p>
            : (
              <ol className="fish-rank-list">
                {sizeNow.rows.map((r) => (
                  <li key={r.rank} className={`${r.is_me ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""}`}>
                    <b className="fish-rank-no">{r.rank}</b>
                    <span className="min-w-0 flex-1"><strong>{r.name}</strong><small>{r.catch_name}</small></span>
                    <em>{fmtCm(r.cm)}</em>
                  </li>
                ))}
              </ol>
            )}
          <p className="aqua-note">주인과 쓰레기는 크기 순위에 안 올라요</p>
        </>
      )}

      {!myName.trim() && (
        <label className="fish-rank-nick">
          <span>순위에 올릴 이름</span>
          <input
            value={nick}
            maxLength={12}
            placeholder="닉네임"
            onChange={(e) => {
              setNick(e.target.value);
              try {
                localStorage.setItem(NICK_KEY, e.target.value.trim());
              } catch {
                /* 저장 못 해도 이번 화면은 된다 */
              }
            }}
          />
        </label>
      )}

      {view === "score" && (
        <details className="fish-rank-rule">
          <summary>점수는 어떻게 매겨요?</summary>
          <ul>
            <li>등급이 한 칸 오를 때마다 1.8배 — 흔함 10점 · 희귀 58점 · 태초 612점</li>
            <li>어린 물고기 1.3배 · 다 큰 물고기 2배</li>
            <li>줄 다루기 솜씨로 최대 1.5배 · 완벽한 챔질 1.1배</li>
            <li>수조에 담으면 1.25배 · 놓치거나 팔아도 끌어올렸으면 점수는 받아요</li>
            <li>쓰레기는 2점. 줄이 끊어지거나 도망치면 0점</li>
          </ul>
        </details>
      )}
    </section>
  );
}
