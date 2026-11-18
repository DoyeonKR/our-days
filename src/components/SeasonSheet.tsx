"use client";

/* 시즌 미션 시트(2026-11-13) — 이번 달 미션 12개의 진행 · 단계 보상 받기 · 받은 칭호.
 * 게임 허브의 '이번 시즌' 카드가 열 때 받는다(next/dynamic) — 보상 코드(수조 엔진의 grantDecor)가 허브 첫 그림에 안 실리게.
 * 진행은 섬 상태에서만 읽는다(lib/season). 받기는 섬을 저장한다 — 받음 표시와 보상이 같은 저장이라 두 폰이 같이 눌러도 한 번이다.
 * 저장 응답을 잃으면 다시 읽어 이 저장의 표식(_saves)이 있으면 들어간 것으로 본다(섬 · 낚시와 같은 규칙, §10.24).
 *
 * 2026-11-18 더한 것(README §14.7.1):
 *   · 지난 달 못 받은 보상 — 다음 달 1~7일(KST)에만, 지난 달에 채운 단계만(claimSeason 의 missed).
 *   · 시즌 순위 — 이번 달 채운 수로 커플 순위(서버 season_board). 닉네임은 합치기 순위와 같은 칸(이 기기, 한 번 직접 정한다).
 *   · 펫 칭호 고르기 — 받은 칭호를 눌러 섬 화면 펫 이름 옆에 단다(s.petTitle.on). 받기와 같은 저장 고리를 쓴다. */
import { useCallback, useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { ActionButton } from "@/components/AppButtons";
import { getSeasonBoard, loadIsland, saveIsland, type SeasonRankRow } from "@/lib/couple";
import { islandSnapshot } from "@/lib/islandstore";
import { gameNow, hasSaveMark, newSaveMark } from "@/lib/islandsync";
import { useBackClose } from "@/lib/useBackClose";
import { decorOf } from "@/lib/aquarium";
import { NICK_MAX, normalizeNick } from "@/lib/merge";
import { getSupabase } from "@/lib/supabase";
import type { IslandState } from "@/lib/island";
import { GAME_NAME, GAME_ORDER, MISSED_DAYS, monthOf, seasonBoard, seasonDecorFor, tierTitleText, wearTitle, type TierReward, type TierRow } from "@/lib/season";
import { claimSeason } from "@/lib/seasonclaim";
import { readRankNick, syncSeasonRank, writeRankNick } from "@/lib/seasonrank";

type Step = { ok: true; state: IslandState; note: string } | { ok: false; reason: string };

function rewardName(r: TierReward, month: string): string {
  if (r === "decor") return `수조 장식 · ${decorOf(seasonDecorFor(month))?.name ?? "장식"}`;
  if (r === "bobber") return "시즌 찌(이미 있으면 수조 장식)";
  return `펫 칭호 · ${tierTitleText(month, 3)}`;
}

export default function SeasonSheet({ coupleId, myUserId, state, onClose }: {
  coupleId: string | null;
  myUserId: string | null;
  state: IslandState;
  onClose: () => void;
}) {
  useBackClose(onClose);
  const [now, setNow] = useState(() => gameNow());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const uid = myUserId;
  const b = seasonBoard(state, now);
  const mm = Number(b.month.slice(5, 7));
  const missed = b.missed;
  const missedOpen = missed ? missed.tiers.filter((t) => t.reached && !t.got) : [];

  useEffect(() => {
    const iv = setInterval(() => setNow(gameNow()), 30_000);
    return () => clearInterval(iv);
  }, []);

  /** 섬에 한 번 저장 — 받기 · 칭호 고르기가 같이 쓴다. 가진 섬이 낡았으면 새로 받아 다시 판정, 응답을 잃으면 표식으로 확인 */
  async function save(key: string, step: (st: IslandState) => Step) {
    if (busy) return;
    setBusy(key);
    setMsg(null);
    try {
      let lost: { mark: string; note: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const cached = attempt === 0 ? islandSnapshot(coupleId).row : null;
        const row = cached ?? (await loadIsland(coupleId).catch(() => null));
        if (!row) {
          setMsg({ text: "섬 정보를 불러오지 못했어요. 연결을 확인해 주세요.", ok: false });
          return;
        }
        if (lost && hasSaveMark(row.state, lost.mark)) {
          setMsg({ text: lost.note, ok: true });
          return;
        }
        lost = null;
        const r = step(row.state);
        if (!r.ok) {
          if (cached) continue; // 가진 섬이 낡았을 수 있다 — 새로 받아 다시 판정
          setMsg({ text: r.reason, ok: false });
          return;
        }
        if (r.state === row.state) {
          setMsg({ text: r.note, ok: true });
          return;
        }
        const mark = newSaveMark();
        try {
          await saveIsland(coupleId, row.version, r.state, mark);
          setMsg({ text: r.note, ok: true });
          return;
        } catch {
          // 상대가 그 사이 저장했다 · 응답을 잃었다 — 다시 읽어 이 표식이 있으면 들어간 것
          lost = { mark, note: r.note };
        }
      }
      setMsg({ text: "저장하지 못했어요. 잠시 후 다시 해 주세요.", ok: false });
    } finally {
      setBusy(null);
      setNow(gameNow());
    }
  }
  const claim = (tier: number, isMissed = false) =>
    void save(`${isMissed ? "m" : "c"}${tier}`, (st) => claimSeason(st, tier, gameNow(), uid ?? "me", isMissed));
  const wear = (m: string) =>
    void save(`w${m}`, (st) => ({ ok: true, state: wearTitle(st, m), note: m ? "펫 이름 옆에 칭호를 달았어요" : "칭호를 숨겼어요" }));

  const tierRow = (t: TierRow, month: string, isMissed: boolean) => {
    const key = `${isMissed ? "m" : "c"}${t.tier}`;
    return (
      <div key={key} className={`season-tier ${t.got ? "is-got" : t.reached ? "is-ready" : ""}`}>
        <span className="season-tier-need">미션 {t.need}개</span>
        <span className="season-tier-name">{rewardName(t.reward, month)}</span>
        {t.got ? (
          <span className="season-tier-state">받았어요</span>
        ) : t.reached ? (
          <ActionButton main disabled={busy !== null} onClick={() => claim(t.tier, isMissed)}>{busy === key ? "받는 중…" : "받기"}</ActionButton>
        ) : (
          <span className="season-tier-state">{isMissed ? "못 채웠어요" : `${t.need - b.done}개 남음`}</span>
        )}
      </div>
    );
  };

  return (
    <Sheet title={`${mm}월 시즌 미션`} onClose={onClose}>
      <p className="season-sub">
        {b.daysLeft > 0 ? `${b.daysLeft}일 남았어요` : "이번 시즌이 진행 중이에요"} · 둘이 함께 채워요 · 다음 달 1일에 새 미션
      </p>

      {missed && missedOpen.length > 0 && (
        <section aria-label="지난 달 못 받은 보상" className="season-missed">
          <h4 className="season-group-title">{Number(missed.month.slice(5, 7))}월 시즌 — 못 받은 보상</h4>
          <p className="season-sub">
            지난 달에 미션 {missed.done}개를 채웠어요 · {missed.daysLeft}일 안에 받을 수 있어요(이번 달 {MISSED_DAYS}일까지)
          </p>
          <div className="season-tiers">{missed.tiers.map((t) => tierRow(t, missed.month, true))}</div>
        </section>
      )}

      <section aria-label="단계 보상" className="season-tiers">
        {b.tiers.map((t) => tierRow(t, b.month, false))}
      </section>
      {msg && <p className={`season-msg ${msg.ok ? "is-ok" : ""}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}

      <SeasonRank coupleId={coupleId} month={b.month} done={b.done} now={now} />

      {GAME_ORDER.map((g) => {
        const rows = b.rows.filter((r) => r.m.game === g);
        if (!rows.length) return null;
        return (
          <section key={g} aria-label={`${GAME_NAME[g]} 미션`} className="season-group">
            <h4 className="season-group-title">{GAME_NAME[g]}</h4>
            {rows.map((r) => {
              const shown = Math.min(r.value, r.m.goal);
              return (
                <div key={r.m.id} className={`season-row ${r.done ? "is-done" : ""}`}>
                  <span className="season-row-label">{r.m.label}</span>
                  <span className="season-row-count">{r.done ? "완료" : `${shown.toLocaleString()} / ${r.m.goal.toLocaleString()}`}</span>
                  <span className="season-bar" role="progressbar" aria-label={r.m.label} aria-valuemin={0} aria-valuemax={r.m.goal} aria-valuenow={shown}>
                    <b style={{ width: `${(shown / r.m.goal) * 100}%` }} />
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}

      {b.petTitles.length > 0 && (
        <section aria-label="받은 칭호" className="season-group">
          <h4 className="season-group-title">우리 펫의 칭호</h4>
          <p className="season-sub">눌러서 섬의 펫 이름 옆에 달아요 · 단계마다 그 달 칭호가 올라가요</p>
          <div className="season-titles">
            {[...b.petTitles].reverse().map((t) => {
              const on = b.worn?.m === t.m;
              return (
                <button key={t.m} type="button" className={`tap season-title-chip is-pick ${on ? "is-on" : ""}`} aria-pressed={on} disabled={busy !== null} onClick={() => wear(t.m)}>
                  {t.m.slice(0, 4)}년 {t.text}
                </button>
              );
            })}
            <button type="button" className={`tap season-title-chip is-pick ${b.worn ? "" : "is-on"}`} aria-pressed={!b.worn} disabled={busy !== null || !b.worn} onClick={() => wear("")}>
              칭호 숨기기
            </button>
          </div>
        </section>
      )}
      <p className="season-note">보상은 하트가 아니라 꾸미기예요.</p>
    </Sheet>
  );
}

/** 시즌 순위 — 이번 달 채운 미션 수로 커플끼리. 연동(커플) 계정에서만. 열 때 우리 수를 먼저 올리고 순위를 받는다 */
function SeasonRank({ coupleId, month, done, now }: { coupleId: string | null; month: string; done: number; now: number }) {
  const online = !!getSupabase() && !!coupleId;
  const [rows, setRows] = useState<SeasonRankRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nick, setNick] = useState(readRankNick);
  const [draft, setDraft] = useState(nick);
  const [nickErr, setNickErr] = useState<string | null>(null);
  const nowMonth = monthOf(now);

  const load = useCallback(async () => {
    try {
      await syncSeasonRank(coupleId, month, nowMonth, done);
      setRows(await getSeasonBoard(null));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [coupleId, month, nowMonth, done]);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void (async () => {
      try {
        await syncSeasonRank(coupleId, month, nowMonth, done);
        const r = await getSeasonBoard(null);
        if (alive) { setRows(r); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [online, coupleId, month, nowMonth, done, nick]);

  function saveNick() {
    const v = normalizeNick(draft);
    if (!v.ok) {
      setNickErr(v.reason);
      return;
    }
    writeRankNick(v.nick);
    setNick(v.nick);
  }

  if (!online) {
    return (
      <section aria-label="시즌 순위" className="season-group">
        <h4 className="season-group-title">시즌 순위</h4>
        <p className="season-sub">커플을 연결하면 이번 달 채운 미션 수로 다른 커플과 순위를 겨뤄요.</p>
      </section>
    );
  }
  const mine = rows?.find((r) => r.is_mine);
  return (
    <section aria-label="시즌 순위" className="season-group">
      <h4 className="season-group-title">시즌 순위</h4>
      <p className="season-sub">
        이번 달 채운 미션 수로 겨뤄요 · 같으면 먼저 채운 커플이 앞{mine ? ` · 우리는 ${mine.couples}커플 중 ${mine.rank}위` : ""}
      </p>
      {!nick && (
        <form className="season-nick" onSubmit={(e) => { e.preventDefault(); saveNick(); }}>
          <input value={draft} onChange={(e) => { setDraft(e.target.value.slice(0, NICK_MAX)); setNickErr(null); }} placeholder="순위 닉네임 (12자까지)" aria-label="순위 닉네임 — 전체 공개" maxLength={NICK_MAX} aria-invalid={!!nickErr} />
          <button type="submit" className="tap" disabled={!draft.trim()}>정하기</button>
          {nickErr ? <small className="season-msg" role="alert">{nickErr}</small> : <small className="season-sub">순위판에 모두에게 보여요 · 합치기 순위와 같은 이름이에요</small>}
        </form>
      )}
      {failed ? (
        <p className="season-msg" role="alert">순위를 불러오지 못했어요. <button type="button" className="tap season-retry" onClick={() => void load()}>다시 시도</button></p>
      ) : rows === null ? (
        <p className="season-sub">순위를 불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="season-sub">아직 이번 달 순위에 오른 커플이 없어요. 미션을 채우면 우리가 첫 줄이에요.</p>
      ) : (
        <ol className="season-rank">
          {rows.map((r) => (
            <li key={`${r.rank}`} className={r.is_mine ? "is-mine" : ""}>
              <span className="season-rank-no">{r.rank}</span>
              <span className="season-rank-name">{r.names}</span>
              <span className="season-rank-done">미션 {r.done}개</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
