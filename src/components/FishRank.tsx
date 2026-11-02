"use client";

/* 낚시 랭킹판 — 개인 · 커플, 이번 달 · 전체. 점수 계산은 서버(submit_fish_catch), 순위도 서버(fish_board) — 여기는 보여 주기만 한다.
 * 이름이 없는 계정은 합치기 순위판과 같은 닉네임 칸(이 기기)을 쓴다. */
import { useEffect, useState } from "react";
import { GRADES } from "@/lib/aquarium";
import { getFishBoard, type FishBoardPeriod, type FishBoardRow, type FishBoardScope } from "@/lib/couple";

const NICK_KEY = "ourdays:merge:nick";
export function readFishNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function FishRank({ coupleId, myName }: { coupleId: string | null; myName: string }) {
  const [scope, setScope] = useState<FishBoardScope>("person");
  const [period, setPeriod] = useState<FishBoardPeriod>("month");
  const [board, setBoard] = useState<{ key: string; rows: FishBoardRow[]; failed: boolean } | null>(null);
  const [nick, setNick] = useState(readFishNick);
  const key = `${scope}:${period}`;

  useEffect(() => {
    let alive = true;
    void getFishBoard(scope, period)
      .then((rows) => { if (alive) setBoard({ key: `${scope}:${period}`, rows, failed: false }); })
      .catch(() => { if (alive) setBoard({ key: `${scope}:${period}`, rows: [], failed: true }); });
    return () => { alive = false; };
  }, [scope, period]);

  const now = board?.key === key ? board : null;
  const rows = now?.rows ?? [];

  return (
    <section className="aqua-card fish-rank">
      <header><strong>낚시 랭킹</strong><small>끌어올린 물고기가 점수가 돼요</small></header>
      <div className="fish-rank-switch" role="tablist" aria-label="순위 단위">
        {([["person", "개인"], ["couple", "커플"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={scope === k} className={`tap ${scope === k ? "is-on" : ""}`} onClick={() => setScope(k)}>{label}</button>
        ))}
      </div>
      <div className="fish-rank-switch is-small" role="tablist" aria-label="기간">
        {([["month", "이번 달"], ["all", "전체"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={period === k} className={`tap ${period === k ? "is-on" : ""}`} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>

      {scope === "couple" && !coupleId && <p className="aqua-note">커플을 연결하면 둘의 점수로 순위에 올라요.</p>}
      {!now ? <p className="aqua-note fish-rank-empty">불러오는 중…</p>
        : now.failed ? <p className="aqua-note fish-rank-empty">순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        : rows.length === 0 ? <p className="aqua-note fish-rank-empty">아직 기록이 없어요. 첫 물고기의 주인공이 되어 보세요!</p>
        : (
          <ol className="fish-rank-list">
            {rows.map((r) => (
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

      <details className="fish-rank-rule">
        <summary>점수는 어떻게 매겨요?</summary>
        <ul>
          <li>등급이 한 칸 오를 때마다 1.8배 — 흔함 10점 · 희귀 58점 · 태초 612점</li>
          <li>어린 물고기 1.3배 · 다 큰 물고기 2배</li>
          <li>줄 다루기 솜씨로 최대 1.5배 · 완벽한 챔질 1.1배</li>
          <li>수조에 담으면 1.25배 · 놓치거나 팔아도 끌어올렸으면 점수는 받아요</li>
          <li>쓰레기는 2점. 줄이 끊어지거나 도망치면 0점</li>
          <li><b>개인</b> = 내 점수의 합</li>
          <li><b>커플</b> = 둘의 합 + 낮은 쪽 점수 — 둘 다 낚시할수록 유리해요</li>
        </ul>
      </details>
    </section>
  );
}
