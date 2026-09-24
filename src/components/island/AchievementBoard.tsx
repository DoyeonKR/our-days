"use client";

/* 업적 보드 — 모아보기의 업적 칸. [2026-09-24 전 영역 UI 개편]
 *
 * 예전엔 이모지 + 이름(못 딴 건 '???') 53칸이 벽처럼 깔려서 무엇을 하면 되는지 안 보였다.
 * 지금은 (1) '다음 목표' — 가장 가까운 셋을 진행 막대 · 방법 한 줄과 함께 위에, (2) 분류별 메달
 * (직접 찍은 도트 — 리본 색 = 분류, 못 딴 건 같은 그림을 회색으로)을 누르면 그 업적을 풀어 보여 준다.
 * 진화(32)는 비밀이 많아 메달 대신 진행 막대 한 줄 — 모습은 바로 아래 도감에서 본다.
 * 파생은 엔진(achievementViews · nextAchievements) 한 곳 — 여기는 그리기만 한다.
 */

import { useMemo, useState } from "react";
import PixelSprite from "@/components/island/PixelSprite";
import {
  ACHIEVEMENT_GROUPS,
  type AchievementView,
  type IslandState,
  achievementViews,
  nextAchievements,
} from "@/lib/island";
import { medalIcon } from "@/lib/pixelui";

function Medal({ v, size = 48 }: { v: AchievementView; size?: number }) {
  const sp = medalIcon(v.group, v.done);
  return sp ? <PixelSprite sprite={sp} size={size} /> : null;
}

function Bar({ prog, done }: { prog: [number, number]; done: boolean }) {
  const pct = Math.round((prog[0] / Math.max(1, prog[1])) * 100);
  return (
    <div className="achv-bar" role="progressbar" aria-valuenow={prog[0]} aria-valuemax={prog[1]} aria-valuemin={0}>
      <span className={done ? "is-done" : ""} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function AchievementBoard({ s, now }: { s: IslandState; now: number }) {
  const views = useMemo(() => achievementViews(s, now), [s, now]);
  const next = nextAchievements(views, 3);
  const [pick, setPick] = useState<string | null>(null);
  const picked = views.find((v) => v.key === pick) ?? null;
  const doneN = views.filter((v) => v.done).length;

  return (
    <section className="achv-board" aria-label="업적">
      <div className="achv-head">
        <span className="font-bold">업적</span>
        <span className="tabular-nums text-white/60">
          {doneN}/{views.length}
        </span>
      </div>

      {next.length > 0 && (
        <div className="achv-next">
          <p className="achv-label">다음 목표</p>
          {next.map((v) => (
            <button key={v.key} type="button" onClick={() => setPick(v.key)} className="tap achv-next-row">
              <Medal v={v} />
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">{v.name}</span>
                  <span className="shrink-0 text-xs text-amber-200">+{v.reward.toLocaleString()}</span>
                </span>
                {v.hint && <span className="mt-0.5 block text-xs leading-snug text-white/60">{v.hint}</span>}
                {v.prog && (
                  <span className="mt-1 flex items-center gap-2">
                    <Bar prog={v.prog} done={false} />
                    <span className="shrink-0 text-xs tabular-nums text-white/60">
                      {v.prog[0]}/{v.prog[1]}
                    </span>
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {ACHIEVEMENT_GROUPS.map((g) => {
        const list = views.filter((v) => v.group === g.key);
        const got = list.filter((v) => v.done).length;
        if (g.key === "pet") {
          // 진화 — 비밀이 많아 메달 32개 대신 진행 한 줄 + 딴 메달만
          return (
            <div key={g.key} className="achv-group">
              <p className="achv-group-head">
                <span>{g.label}</span>
                <span className="tabular-nums">
                  {got}/{list.length}
                </span>
              </p>
              <Bar prog={[got, list.length]} done={got === list.length} />
              <p className="mt-1 text-xs text-white/50">최종형부터 진화할 때마다 메달 — 모습은 아래 도감에서</p>
              {got > 0 && (
                <div className="achv-medals mt-2">
                  {list
                    .filter((v) => v.done)
                    .map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        aria-label={v.name}
                        onClick={() => setPick(pick === v.key ? null : v.key)}
                        className={`tap achv-medal ${pick === v.key ? "is-picked" : ""}`}
                      >
                        <Medal v={v} />
                      </button>
                    ))}
                </div>
              )}
              {picked?.group === g.key && <Detail v={picked} />}
            </div>
          );
        }
        return (
          <div key={g.key} className="achv-group">
            <p className="achv-group-head">
              <span>{g.label}</span>
              <span className="tabular-nums">
                {got}/{list.length}
              </span>
            </p>
            <div className="achv-medals">
              {list.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-label={`${v.name}${v.done ? " (달성)" : ""}`}
                  aria-pressed={pick === v.key}
                  onClick={() => setPick(pick === v.key ? null : v.key)}
                  className={`tap achv-medal ${v.done ? "is-done" : ""} ${pick === v.key ? "is-picked" : ""}`}
                >
                  <Medal v={v} />
                </button>
              ))}
            </div>
            {picked?.group === g.key && <Detail v={picked} />}
          </div>
        );
      })}
    </section>
  );
}

/** 누른 메달 — 이름 · 보상 · 방법 · 진행. 비밀(못 본 진화)은 이름을 가린다. */
function Detail({ v }: { v: AchievementView }) {
  return (
    <div className="achv-detail" aria-live="polite">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{v.secret ? "???" : v.name}</span>
        <span className={`shrink-0 text-xs ${v.done ? "text-emerald-300" : "text-amber-200"}`}>
          {v.done ? "달성!" : `보상 +${v.reward.toLocaleString()}`}
        </span>
      </p>
      {v.hint && <p className="mt-0.5 text-xs leading-snug text-white/65">{v.hint}</p>}
      {v.prog && !v.done && (
        <div className="mt-1.5 flex items-center gap-2">
          <Bar prog={v.prog} done={false} />
          <span className="shrink-0 text-xs tabular-nums text-white/60">
            {v.prog[0]}/{v.prog[1]}
          </span>
        </div>
      )}
    </div>
  );
}
