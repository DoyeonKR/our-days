"use client";

/* 게임 탭 — **우리 섬**과 **사냥** 두 개뿐인 허브.
 *
 * [사용자 요청 2026-08-06] 게임 탭을 우리 섬 + 사냥 둘만 남기고 정리
 * [사용자 요청 2026-08-07 "게임탭이 너무 허전해 2개로 좀 꽉 채워줄 수 있는걸 만들어"]
 *
 * 카드가 둘이면 허전한 게 당연하다 — **개수가 아니라 밀도**로 채운다.
 * 각 카드가 지금 상태를 실제로 보여주고, 볼 게 있으니 누를 이유도 생긴다:
 *   · 우리 섬 — 펫 얼굴·레벨·기분 + 스탯 4줄 + **지금 할 일 배지**(배고픔·수확·진화)
 *   · 사냥 — 스테이지·몬스터·체력 게이지·DPS + **지금 들어가면 받을 정산**(순수 미리보기)
 * 맨 위엔 공용 요약 띠(코인·섬 평점·최고 스테이지).
 *
 * ⚠ 미리보기는 **커밋하지 않는다**. settle() 은 순수 함수라 결과만 계산해 보여주고,
 *   실제 반영은 사냥 화면에 들어갔을 때 한 번만 한다. 여기서 커밋하면 탭을 열 때마다
 *   정산이 일어나 '들어가서 받는 재미'가 사라진다.
 *
 * [사용자 요청 2026-08-07] 세 번째로 **보글보글**(손으로 하는 액션)이 붙었다.
 * 셋의 성격을 일부러 갈라 놨다 — 섬은 돌보는 것, 사냥은 두고 보는 것, 보글보글은 직접 하는 것.
 * 셋 다 같은 지갑(하트)과 같은 히어로·무기를 쓴다.
 *
 * 지운 것: 아케이드 5종 · 부루마블 · 테트리스 · 순위판. 엔진·데이터 계층까지 함께 지웠다.
 * ⚠ DB 테이블(game_*, board_games)은 그대로 뒀다 — 삭제는 되돌릴 수 없다.
 */

import { useCallback, useEffect, useState } from "react";
import IslandGame from "@/components/IslandGame";
import HuntGame from "@/components/HuntGame";
import BubbleGame from "@/components/BubbleGame";
import PetIcon from "@/components/island/PetIcon";
import { loadIsland, watchIsland, type IslandRow } from "@/lib/couple";
import {
  bubbleOf,
  heroAtk,
  huntOf,
  islandRating,
  islandSummary,
  isAsleep,
  petForm,
  petNow,
  ratingTier,
  cropStage,
} from "@/lib/island";
import { dps, hpPct, isBoss, monsterAt, settle, stageHp } from "@/lib/hunt";
import { bubbleRange, monsterCount, reloadMs } from "@/lib/bubble";

const won = (v: number) => Math.round(v).toLocaleString();

export default function GameArcade({
  coupleId,
  myUserId,
  partnerName = "",
  startDate = null,
  openIslandReq,
}: {
  coupleId: string | null;
  myUserId: string | null;
  myName?: string;
  partnerName?: string;
  startDate?: string | null;
  /** 홈 펫 탭 등 외부에서 섬을 열라는 신호(값이 바뀌면 오버레이 오픈). */
  openIslandReq?: number;
}) {
  const [open, setOpen] = useState<"island" | "hunt" | "bubble" | null>(null);
  const [row, setRow] = useState<IslandRow | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (openIslandReq) setOpen("island");
  }, [openIslandReq]);

  const load = useCallback(async () => {
    // 솔로(coupleId null)도 로컬 섬을 읽는다 — loadIsland 가 저장소를 가른다 [2026-08-12]
    const r = await loadIsland(coupleId).catch(() => null);
    setRow(r);
    setNow(Date.now());
  }, [coupleId]);

  useEffect(() => {
    void load();
  }, [load]);
  // 상대가 뭘 하면 카드도 따라 갱신된다(muxOn 경유 — 채널을 새로 만들지 않는다). 솔로는 no-op.
  useEffect(() => watchIsland(coupleId, () => void load()), [coupleId, load]);
  // 카드 안의 사냥 진행도 살아 있게 — 30초면 충분하다(여긴 요약이지 전투 화면이 아니다)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  // 오버레이를 닫고 돌아오면 최신 상태로
  useEffect(() => {
    if (open === null) void load();
  }, [open, load]);

  {/* 잠금 카드는 뺐다 [사용자 리포트 2026-08-12 "같이할 상대방이 없으면 즐길 수 없는 것
      같아서"] — 섬·사냥·보글보글은 혼자서도 통째로 돈다(로컬 섬). 연동하면 그 섬이
      그대로 우리 섬으로 승격된다(couple.ts loadIsland). */}

  const s = row?.state ?? null;
  const sum = s && now ? islandSummary(s, now) : null;
  const hunt = s && now ? huntOf(s, now) : null;
  const lv = s && now ? petNow(s, now).level : 1;
  const atk = s ? heroAtk(s) : 0;
  const power = dps(atk, lv);
  const mon = hunt ? monsterAt(hunt.stage) : null;
  // 지금 들어가면 받을 정산 — 순수 계산만, **커밋하지 않는다**
  const pending = s && hunt && now ? settle(hunt, now, atk, lv, true).gain : null;
  const tier = s ? ratingTier(islandRating(s)) : null;
  const rec = s ? bubbleOf(s) : null;
  // 다음에 도전할 스테이지 — 최고 기록 다음 판이 목표가 된다
  const nextBubble = rec ? rec.best + 1 : 1;

  /* 지금 할 일 — '들어갈 이유'를 카드에 미리 띄운다. 없으면 배지도 없다(빈 배지는 소음). */
  const todos: string[] = [];
  if (s && sum && now) {
    if (sum.pet.stats.hunger < 40) todos.push("🍖 배고파요");
    if (sum.pet.stats.happy < 40) todos.push("😢 심심해요");
    if (s.pet.sick) todos.push("🤒 아파요");
    if (s.pet.pendingEvolve) todos.push("✨ 진화 가능");
    if (isAsleep(s, now)) todos.push("💤 자는 중");
    const ready = s.farm.plots.filter((p) => p.crop && cropStage(s, p, now).ripe).length;
    if (ready > 0) todos.push(`🌾 수확 ${ready}칸`);
  }

  return (
    <div className="game-hub space-y-4 px-4 pb-28 pt-4">
      <header className="game-hub-header">
        <span className="game-hub-kicker">PIXEL ARCADE</span>
        <div className="mt-2">
          <h1 className="text-xl font-black tracking-tight text-ink">오늘 뭐 할까?</h1>
          <p className="mt-1 text-sm text-muted">같은 히어로와 장비로 세 가지 모험을 즐겨요.</p>
        </div>
      </header>

      {/* 공용 요약 띠 — 두 게임이 같은 지갑·같은 히어로를 쓴다는 걸 한눈에 */}
      {s && sum && (
        <div className="game-scoreboard grid grid-cols-3">
          <Chip label="하트" value={`${won(s.coins)}💗`} />
          <Chip label="섬 평점" value={tier ? `${tier.emoji} ${tier.label}` : "-"} />
          <Chip label="최고 스테이지" value={hunt ? `${hunt.best}` : "-"} />
        </div>
      )}

      {/* ── 우리 섬 ── */}
      <button
        onClick={() => setOpen("island")}
        className="tap game-mode-card game-mode-island block w-full p-4 text-left"
      >
        <span className="game-mode-number">01</span>
        <div className="flex items-center gap-3">
          <span className="game-mode-icon grid h-16 w-16 shrink-0 place-items-center">
            {s ? <PetIcon form={s.pet.form} size={54} face active={false} /> : <span className="text-3xl">🏝️</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
              우리 섬 <span className="game-mode-badge">LIFE</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {s && sum
                ? `${s.pet.name} · ${petForm(s.pet.form).name} Lv.${sum.pet.level} ${sum.pet.mood}`
                : "펫을 키우고 정원·섬을 가꿔요 🥚→🦊"}
            </span>
          </span>
        </div>

        {sum && (
          <div className="game-stat-panel mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <Bar label="포만" v={sum.pet.stats.hunger} c="#fb923c" />
            <Bar label="행복" v={sum.pet.stats.happy} c="#f472b6" />
            <Bar label="기력" v={sum.pet.stats.energy} c="#fbbf24" />
            <Bar label="청결" v={sum.pet.stats.clean} c="#38bdf8" />
          </div>
        )}
        {todos.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {todos.map((t) => (
              <span key={t} className="game-todo-chip">
                {t}
              </span>
            ))}
          </div>
        )}
        <span className="game-mode-cta">섬 돌보기 <span aria-hidden>→</span></span>
      </button>

      {/* ── 사냥 ── */}
      <button
        onClick={() => setOpen("hunt")}
        className="tap game-mode-card game-mode-hunt block w-full p-4 text-left"
      >
        <span className="game-mode-number">02</span>
        <div className="flex items-center gap-3">
          <span className="game-mode-icon grid h-16 w-16 shrink-0 place-items-center text-4xl">
            {mon ? mon.emoji : "⚔️"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
              사냥 <span className="game-mode-badge">IDLE</span>
              {hunt && isBoss(hunt.stage) && (
                <span className="game-mode-badge game-mode-boss">BOSS</span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {hunt && mon
                ? `스테이지 ${hunt.stage} · ${mon.name} 사냥 중`
                : "안 보고 있어도 알아서 싸워요"}
            </span>
          </span>
        </div>

        {hunt && (
          <>
            <div className="game-progress mt-3 h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-amber-300"
                style={{ width: `${hpPct(hunt) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span className="tabular-nums">
                {won(Math.max(0, stageHp(hunt.stage) - hunt.dmg))} / {won(stageHp(hunt.stage))}
              </span>
              <span className="tabular-nums">
                {atk > 0 ? `무기 ${atk}` : "맨손"} · DPS {power}
              </span>
            </div>
          </>
        )}
        {pending && pending.kills > 0 ? (
          <p className="game-reward mt-2.5 px-3 py-2 text-sm font-extrabold text-ink">
            지금 들어가면 {won(pending.kills)}마리 · +{won(pending.coins)}💗 받아요
          </p>
        ) : (
          atk === 0 && (
            <p className="mt-2.5 rounded-xl bg-white/10 px-3 py-2 text-xs text-muted ring-1 ring-white/10">
              섬 → 펫 탭에서 무기를 사면 공격력이 오릅니다 (막대 2 → 지팡이 8 → 수박검 30)
            </p>
          )
        )}
        <span className="game-mode-cta">사냥 확인 <span aria-hidden>→</span></span>
      </button>

      {/* ── 보글보글 ── */}
      <button
        onClick={() => setOpen("bubble")}
        className="tap game-mode-card game-mode-bubble block w-full p-4 text-left"
      >
        <span className="game-mode-number">03</span>
        <div className="flex items-center gap-3">
          <span className="game-mode-icon grid h-16 w-16 shrink-0 place-items-center text-4xl">
            🫧
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
              보글보글 <span className="game-mode-badge">ACTION</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {rec && rec.best > 0
                ? `최고 스테이지 ${rec.best} · ${won(rec.score)}점`
                : "거품으로 가두고 터뜨려 잡아요"}
            </span>
          </span>
        </div>

        {/* 다음 판이 어떤지 미리 — 카드가 목표를 들고 있어야 누를 이유가 생긴다 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Mini label="다음 스테이지" value={`${nextBubble}`} />
          <Mini label="몬스터" value={`${monsterCount(nextBubble)}마리`} />
          <Mini label="거품 사거리" value={`${Math.round(bubbleRange(atk))}`} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {atk > 0
            ? `무기 ${atk}, 재장전 ${(reloadMs(atk) / 1000).toFixed(2)}초`
            : "무기를 사면 거품이 멀리·빨리 나가요"}
        </p>
        <span className="game-mode-cta">플레이 시작 <span aria-hidden>→</span></span>
      </button>

      {open === "island" && (
        <IslandGame
          coupleId={coupleId}
          myUserId={myUserId}
          partnerName={partnerName}
          startDate={startDate}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "hunt" && (
        <HuntGame coupleId={coupleId} myUserId={myUserId} onClose={() => setOpen(null)} />
      )}
      {open === "bubble" && <BubbleGame coupleId={coupleId} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-score-cell px-2 py-2.5 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-mini-stat px-2 py-2 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}

function Bar({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-xs text-muted">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/25">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: c }} />
      </span>
    </div>
  );
}
