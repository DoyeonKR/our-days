"use client";

/* 시즌 미션 시트(2026-11-13) — 이번 달 미션 12개의 진행 · 단계 보상 받기 · 받은 칭호.
 * 게임 허브의 '이번 시즌' 카드가 열 때 받는다(next/dynamic) — 보상 코드(수조 엔진의 grantDecor)가 허브 첫 그림에 안 실리게.
 * 진행은 섬 상태에서만 읽는다(lib/season). 받기는 섬을 저장한다 — 받음 표시와 보상이 같은 저장이라 두 폰이 같이 눌러도 한 번이다.
 * 저장 응답을 잃으면 다시 읽어 이 저장의 표식(_saves)이 있으면 들어간 것으로 본다(섬 · 낚시와 같은 규칙, §10.24). */
import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { ActionButton } from "@/components/AppButtons";
import { loadIsland, saveIsland } from "@/lib/couple";
import { islandSnapshot } from "@/lib/islandstore";
import { gameNow, hasSaveMark, newSaveMark } from "@/lib/islandsync";
import { useBackClose } from "@/lib/useBackClose";
import { decorOf } from "@/lib/aquarium";
import type { IslandState } from "@/lib/island";
import { GAME_NAME, GAME_ORDER, seasonBoard, seasonDecorFor, titleText, type TierReward } from "@/lib/season";
import { claimSeason } from "@/lib/seasonclaim";

function rewardName(r: TierReward, month: string): string {
  if (r === "decor") return `수조 장식 · ${decorOf(seasonDecorFor(month))?.name ?? "장식"}`;
  if (r === "bobber") return "시즌 찌(이미 있으면 수조 장식)";
  return `펫 칭호 · ${titleText(month)}`;
}

export default function SeasonSheet({ coupleId, myUserId, state, onClose }: {
  coupleId: string | null;
  myUserId: string | null;
  state: IslandState;
  onClose: () => void;
}) {
  useBackClose(onClose);
  const [now, setNow] = useState(() => gameNow());
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const uid = myUserId;
  const b = seasonBoard(state, now);
  const mm = Number(b.month.slice(5, 7));

  useEffect(() => {
    const iv = setInterval(() => setNow(gameNow()), 30_000);
    return () => clearInterval(iv);
  }, []);

  async function claim(tier: number) {
    if (busy) return;
    setBusy(tier);
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
        const r = claimSeason(row.state, tier, gameNow(), uid ?? "me");
        if (!r.ok) {
          if (cached) continue; // 가진 섬이 낡았을 수 있다 — 새로 받아 다시 판정
          setMsg({ text: r.reason, ok: false });
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

  return (
    <Sheet title={`${mm}월 시즌 미션`} onClose={onClose}>
      <p className="season-sub">
        {b.daysLeft > 0 ? `${b.daysLeft}일 남았어요` : "이번 시즌이 진행 중이에요"} · 둘이 함께 채워요 · 다음 달 1일에 새 미션
      </p>

      <section aria-label="단계 보상" className="season-tiers">
        {b.tiers.map((t) => (
          <div key={t.tier} className={`season-tier ${t.got ? "is-got" : t.reached ? "is-ready" : ""}`}>
            <span className="season-tier-need">미션 {t.need}개</span>
            <span className="season-tier-name">{rewardName(t.reward, b.month)}</span>
            {t.got ? (
              <span className="season-tier-state">받았어요</span>
            ) : t.reached ? (
              <ActionButton main disabled={busy !== null} onClick={() => void claim(t.tier)}>{busy === t.tier ? "받는 중…" : "받기"}</ActionButton>
            ) : (
              <span className="season-tier-state">{t.need - b.done}개 남음</span>
            )}
          </div>
        ))}
      </section>
      {msg && <p className={`season-msg ${msg.ok ? "is-ok" : ""}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}

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

      {b.titles.length > 0 && (
        <section aria-label="받은 칭호" className="season-group">
          <h4 className="season-group-title">우리 펫의 칭호</h4>
          <div className="season-titles">
            {[...b.titles].reverse().map((t) => <span key={t.m} className="season-title-chip">{t.m.slice(0, 4)}년 {titleText(t.m)}</span>)}
          </div>
        </section>
      )}
      <p className="season-note">보상은 하트가 아니라 꾸미기예요.</p>
    </Sheet>
  );
}
