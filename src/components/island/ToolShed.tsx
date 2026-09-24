"use client";

/* 정원 · 농기구 창고 — 도구 5종 × 3단계. [2026-09-24]
 *
 * [사용자: "정원 툴 들을 좀 개선해야되지 않겠어 ? 기능도 늘리고"]
 * 예전 도구 칸은 한 번 사면 끝인 버튼 둘(스프링클러 · 온실)이 전부였다. 이제 도구마다 단계가 있고,
 * 새 도구 셋(비료 살포기 · 퇴비통 · 파종기)은 이 카드 안에서 바로 쓴다 — 살포 · 퇴비 넣고 받기 · 자동 파종 켜고 끄기.
 * ⚠ 살 수 있는지 · 왜 못 사는지는 엔진(toolLockReason) 한 곳이 정한다. 화면이 따로 판정하면
 *   '켜져 있는데 눌러도 아무 일 없는' 버튼이 된다.
 */

import { useState } from "react";
import {
  COMPOST,
  TOOLS,
  autoReplantOn,
  compostBins,
  compostCandidates,
  compostMs,
  compostReady,
  cropOf,
  spreadPreview,
  toolLevel,
  toolLockReason,
  type CropKey,
  type IslandState,
  type ToolDef,
  type ToolKey,
} from "@/lib/island";
import { Coin, LockMark, ToolIcon } from "@/components/island/UiIcon";
import { CropIcon } from "@/components/island/CropIcon";

const won = (v: number) => v.toLocaleString();
const left = (ms: number) => (ms >= 3_600_000 ? `${Math.ceil(ms / 3_600_000)}시간` : `${Math.max(1, Math.ceil(ms / 60_000))}분`);

export default function ToolShed({
  s,
  now,
  busy,
  onUpgrade,
  onSpread,
  onCompostStart,
  onCompostCollect,
  onToggleReplant,
}: {
  s: IslandState;
  now: number;
  busy: boolean;
  onUpgrade: (k: ToolKey) => void;
  onSpread: () => void;
  onCompostStart: (bin: number, crop: CropKey) => void;
  onCompostCollect: (bin: number) => void;
  onToggleReplant: (on: boolean) => void;
}) {
  const [pickBin, setPickBin] = useState<number | null>(null);
  const owned = TOOLS.filter((t) => toolLevel(s, t.key) > 0).length;
  return (
    <section className="island-panel p-3" aria-label="농기구 창고">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="island-section-kicker">TOOL SHED</p>
          <h3 className="text-sm font-black">농기구 창고</h3>
        </div>
        <p className="shrink-0 text-right text-xs text-white/55">
          {owned}/{TOOLS.length} 설치
        </p>
      </div>
      <div className="space-y-2">
        {TOOLS.map((t) => (
          <ToolCard key={t.key} s={s} def={t} busy={busy} onUpgrade={() => onUpgrade(t.key)}>
            {t.key === "spreader" && toolLevel(s, "spreader") > 0 && (() => {
              const pv = spreadPreview(s);
              return (
                <button
                  disabled={busy || pv.plots === 0}
                  onClick={onSpread}
                  className="tap mt-2 w-full rounded-lg bg-amber-300/15 py-2 text-xs font-extrabold text-amber-200 ring-1 ring-amber-300/30 disabled:opacity-40"
                >
                  {pv.plots > 0
                    ? `모든 밭에 뿌리기 · ${pv.plots}칸 · 비료 ${pv.fert}개`
                    : s.farm.fert <= 0
                      ? "비료가 없어요 — 사거나 퇴비로 만들어요"
                      : "모든 밭이 이미 최대 단계예요"}
                </button>
              );
            })()}
            {t.key === "compost" && toolLevel(s, "compost") > 0 && (
              <CompostBins
                s={s}
                now={now}
                busy={busy}
                pickBin={pickBin}
                onPick={setPickBin}
                onStart={(bin, crop) => {
                  setPickBin(null);
                  onCompostStart(bin, crop);
                }}
                onCollect={onCompostCollect}
              />
            )}
            {t.key === "seeder" && toolLevel(s, "seeder") > 0 && (
              <>
                <button
                  disabled={busy}
                  onClick={() => onToggleReplant(!autoReplantOn(s))}
                  aria-pressed={autoReplantOn(s)}
                  className={`tap mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold ring-1 ${
                    autoReplantOn(s) ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/35" : "bg-white/[0.05] text-white/60 ring-white/10"
                  }`}
                >
                  <span className="whitespace-nowrap">자동 다시 심기</span>
                  <span className="whitespace-nowrap">{autoReplantOn(s) ? "켜짐 ●" : "꺼짐 ○"}</span>
                </button>
                <p className="mt-1 text-xs text-white/45">
                  씨앗값 {toolLevel(s, "seeder") >= 2 ? "25% 할인" : "그대로"} · 제철 작물만(온실 칸은 전부) · 전설은 직접 심어요
                </p>
              </>
            )}
          </ToolCard>
        ))}
      </div>
    </section>
  );
}

function ToolCard({
  s,
  def,
  busy,
  onUpgrade,
  children,
}: {
  s: IslandState;
  def: ToolDef;
  busy: boolean;
  onUpgrade: () => void;
  children?: React.ReactNode;
}) {
  const lv = toolLevel(s, def.key);
  const next = def.levels[lv];
  const lock = toolLockReason(s, def.key);
  const max = lv >= def.levels.length;
  return (
    <div className={`rounded-xl p-2.5 ring-1 ${lv > 0 ? "bg-white/[0.06] ring-white/12" : "bg-white/[0.03] ring-white/8"}`}>
      <div className="flex items-start gap-2.5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${lv > 0 ? "bg-white/[0.08]" : "bg-white/[0.04] opacity-60"}`}>
          <ToolIcon k={def.key} size={40} title={def.name} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 이름은 한 덩어리 — body 의 overflow-wrap:anywhere 때문에 320px 에서 "스프링클 / 러"로 꺾였다.
              모자라면 이름 대신 단계 점이 다음 줄로 내려간다 [2026-09-25] */}
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-extrabold">
            <span className="whitespace-nowrap">{def.name}</span>
            <span className="flex gap-0.5" aria-label={`${lv}단계 / ${def.levels.length}단계`}>
              {def.levels.map((_, i) => (
                <span key={i} className={`h-2 w-2 rounded-sm ${i < lv ? "bg-emerald-300" : "bg-white/15"}`} />
              ))}
            </span>
          </p>
          <p className="text-xs text-white/65">{lv > 0 ? def.levels.slice(0, lv).map((l) => l.text).at(-1) : `아직 없어요 — ${def.blurb}`}</p>
          {!max && next && (
            <p className="mt-0.5 text-xs text-white/45">
              {lv > 0 ? "다음" : "설치하면"}: {next.text}
            </p>
          )}
          {lock && !max && <p className="mt-0.5 text-xs font-bold text-amber-300"><LockMark />{lock}</p>}
        </div>
        {max ? (
          <span className="shrink-0 rounded-lg bg-emerald-400/15 px-2 py-1.5 text-xs font-extrabold text-emerald-200">최고 단계</span>
        ) : (
          <button
            disabled={busy || !!lock}
            onClick={onUpgrade}
            className="tap shrink-0 rounded-lg bg-white/[0.1] px-2.5 py-1.5 text-xs font-extrabold ring-1 ring-white/15 disabled:opacity-40"
          >
            {lv > 0 ? "올리기" : "설치"}
            <span className="block text-xs font-bold text-amber-200">{won(next!.price)}<Coin /></span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function CompostBins({
  s,
  now,
  busy,
  pickBin,
  onPick,
  onStart,
  onCollect,
}: {
  s: IslandState;
  now: number;
  busy: boolean;
  pickBin: number | null;
  onPick: (bin: number | null) => void;
  onStart: (bin: number, crop: CropKey) => void;
  onCollect: (bin: number) => void;
}) {
  const bins = compostBins(s);
  const total = compostMs(s);
  const cands = compostCandidates(s);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}>
        {bins.map((bin, i) => {
          const ready = compostReady(s, bin, now);
          const busyBin = bin.startAt != null && !ready;
          const pct = busyBin ? Math.min(100, ((now - (bin.startAt ?? now)) / total) * 100) : 0;
          return (
            <button
              key={i}
              disabled={busy || busyBin}
              onClick={() => (ready ? onCollect(i) : onPick(pickBin === i ? null : i))}
              aria-pressed={pickBin === i}
              className={`tap relative overflow-hidden rounded-lg px-2 py-2 text-left text-xs font-bold ring-1 ${
                ready
                  ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/45"
                  : pickBin === i
                    ? "bg-amber-300/15 text-amber-100 ring-amber-300/45"
                    : "bg-black/20 text-white/70 ring-white/10"
              }`}
            >
              <span className="flex items-center gap-1">
                {bin.crop ? <CropIcon cropKey={bin.crop} stage={3} size={16} /> : <ToolIcon k="compost" size={16} />}
                통 {i + 1}
              </span>
              <span className="mt-0.5 block text-xs font-normal">
                {ready ? `비료 ${COMPOST.out}개 받기` : busyBin ? `${left(total - (now - (bin.startAt ?? now)))} 남음` : "작물 넣기"}
              </span>
              {busyBin && <span aria-hidden className="absolute bottom-0 left-0 h-1 bg-amber-300/80" style={{ width: `${pct}%` }} />}
            </button>
          );
        })}
      </div>
      {pickBin != null && (
        <div className="rounded-lg bg-black/25 p-2 ring-1 ring-white/10">
          <p className="mb-1.5 text-xs text-white/60">
            작물 {COMPOST.need}개 → 비료 {COMPOST.out}개. 싼 작물일수록 파는 것보다 이득이에요.
          </p>
          {cands.length === 0 ? (
            <p className="text-xs text-white/45">창고에 3개 이상 있는 작물이 없어요 — 정원에서 거둬 와요</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {cands.slice(0, 8).map((c) => (
                <button
                  key={c.key}
                  disabled={busy}
                  onClick={() => onStart(pickBin, c.key)}
                  className="tap flex items-center gap-1 rounded-full bg-white/[0.08] py-1 pl-1 pr-2.5 text-xs font-bold ring-1 ring-white/12"
                >
                  <CropIcon cropKey={c.key} stage={3} size={18} />
                  {cropOf(c.key).name} ×{c.qty}
                  <span className="font-normal text-white/45">({c.sell}<Coin />)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
