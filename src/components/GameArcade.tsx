"use client";

/* 게임 탭 — **우리 섬**과 **정원 합치기** 허브. 사냥(방치형)은 2026-10-31 사용자 요청으로 뺐다
 * [사용자: "사냥을 없애버려 게임에서"] — 화면(HuntGame · HuntStage)은 지웠고, 섬 상태의 hunt 칸 · 엔진(lib/hunt)은
 * 섬 규칙(사신 주작 축 · 요리/기술의 사냥 효과)이 아직 읽어서 남겨 뒀다.
 *
 * (아래는 옛 설명 — 카드 둘 시절)
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
 * 둘 다 같은 지갑(하트)과 같은 히어로·무기를 쓴다 — 섬은 돌보는 것, 사냥은 두고 보는 것.
 *
 * 지운 것: 아케이드 5종 · 부루마블 · 테트리스 · 순위판(2026-08-06), 보글보글(2026-08-07 붙었다가
 * 2026-09-24 — 손으로 하는 액션이라 앱의 나머지와 결이 달랐고 백호 분기 말고는 섬과 이어지지 않았다).
 * 엔진·데이터 계층까지 함께 지웠다. 되살리려면 git 이력에서 꺼내라.
 * 옛 게임 DB 테이블(game_*, board_*, tetris_results)은 migrations/20260924_drop_old_game_tables.sql 로 내린다.
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import IslandGame from "@/components/IslandGame";
import MergeGame from "@/components/MergeGame";
import { CropIcon } from "@/components/island/CropIcon";
import { CHAIN, mergeOf } from "@/lib/merge";
import PetIcon from "@/components/island/PetIcon";
import { Coin, MicroIcon, TodoIcon } from "@/components/island/UiIcon";
import TabHeader from "@/components/TabHeader";
import StatePanel from "@/components/StatePanel";
import { loadIsland, watchIsland, type IslandRow } from "@/lib/couple";
import {
  islandRating,
  islandSummary,
  isAsleep,
  petForm,
  ratingTier,
  cropStage,
} from "@/lib/island";

const won = (v: number) => Math.round(v).toLocaleString();

export default function GameArcade({
  coupleId,
  myUserId,
  myName = "",
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
  const [open, setOpen] = useState<"island" | "merge" | null>(null);
  const [row, setRow] = useState<IslandRow | null>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const request = useRef(0);
  const previousOpen = useRef<typeof open>(null);
  const cancelLoad = useCallback(() => { request.current++; }, []);

  useEffect(() => {
    if (openIslandReq) setOpen("island");
  }, [openIslandReq]);

  const load = useCallback(async () => {
    // 솔로(coupleId null)도 로컬 섬을 읽는다 — loadIsland 가 저장소를 가른다 [2026-08-12]
    const current = ++request.current;
    setLoading(true);
    try {
      const r = await loadIsland(coupleId);
      if (current !== request.current) return;
      setRow(r);
      setNow(Date.now());
      setLoadError(null);
    } catch {
      if (current === request.current) setLoadError("게임 정보를 불러오지 못했어요. 저장된 섬은 그대로예요.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    setRow(null);
    void load();
    return cancelLoad;
  }, [load, cancelLoad]);
  // 상대가 뭘 하면 카드도 따라 갱신된다(muxOn 경유 — 채널을 새로 만들지 않는다). 솔로는 no-op.
  useEffect(() => watchIsland(coupleId, () => void load()), [coupleId, load]);
  // 카드 안의 사냥 진행도 살아 있게 — 30초면 충분하다(여긴 요약이지 전투 화면이 아니다)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  // 오버레이를 닫고 돌아오면 최신 상태로
  useEffect(() => {
    if (open === null && previousOpen.current !== null) void load();
    previousOpen.current = open;
  }, [open, load]);

  {/* 잠금 카드는 뺐다 [사용자 리포트 2026-08-12 "같이할 상대방이 없으면 즐길 수 없는 것
      같아서"] — 섬·사냥은 혼자서도 통째로 돈다(로컬 섬). 연동하면 그 섬이
      그대로 우리 섬으로 승격된다(couple.ts loadIsland). */}

  const s = row?.state ?? null;
  const sum = s && now ? islandSummary(s, now) : null;
  const tier = s ? ratingTier(islandRating(s)) : null;
  const mrec = s ? mergeOf(s) : null;
  const myKey = myUserId ?? "me";
  const myMergeBest = mrec?.best[myKey] ?? 0;
  const myMergeTop = mrec?.top[myKey] ?? 0;
  const partnerMergeBest = mrec ? Object.entries(mrec.best).find(([k]) => k !== myKey)?.[1] : undefined;

  /* 지금 할 일 — '들어갈 이유'를 카드에 미리 띄운다. 없으면 배지도 없다(빈 배지는 소음).
     아이콘은 섬의 '지금 할 일' 칩과 같은 도트(TodoIcon) — 키도 같은 이름을 쓴다. */
  const todos: { key: string; label: string }[] = [];
  if (s && sum && now) {
    if (sum.pet.stats.hunger < 40) todos.push({ key: "hunger", label: "배고파요" });
    if (sum.pet.stats.happy < 40) todos.push({ key: "happy", label: "심심해요" });
    if (s.pet.sick) todos.push({ key: "sick", label: "아파요" });
    if (s.pet.pendingEvolve) todos.push({ key: "evolve", label: "진화 가능" });
    if (isAsleep(s, now)) todos.push({ key: "asleep", label: "자는 중" });
    const ready = s.farm.plots.filter((p) => p.crop && cropStage(s, p, now).ripe).length;
    if (ready > 0) todos.push({ key: "harvest", label: `수확 ${ready}칸` });
  }

  return (
    <div className="game-hub mx-auto max-w-md space-y-4 px-5 pb-28 pt-8">
      {/* 탭 머리글 — 기록·계획·함께와 같은 틀(TabHeader). 예전의 'PIXEL ARCADE' 카드 머리는 걷었다. */}
      <TabHeader emblem="game" eyebrow="오늘 뭐 할까?" title="게임" sub="섬을 가꾸고, 작물을 합쳐 보세요." />
      {loadError && <StatePanel kind="error" title="게임 정보를 확인해 주세요" detail={loadError} onRetry={() => void load()} busy={loading} />}
      {loading && !s && !loadError && <StatePanel kind="loading" title="우리 섬을 불러오는 중" detail="히어로와 모험 기록을 확인하고 있어요." />}

      {/* 공용 요약 띠 — 두 게임이 같은 지갑·같은 히어로를 쓴다는 걸 한눈에 */}
      {s && sum && (
        <div className="game-scoreboard grid grid-cols-3">
          <Chip label="하트" value={<>{won(s.coins)}<Coin /></>} />
          <Chip label="섬 평점" value={tier ? <><MicroIcon k={`tier_${tier.key}`} size={12} className="mr-1" />{tier.label}</> : "-"} />
          <Chip label="합치기 최고" value={myMergeBest > 0 ? won(myMergeBest) : "-"} />
        </div>
      )}

      {/* ── 우리 섬 ── */}
      <button
        type="button"
        disabled={!s && (loading || !!loadError)}
        onClick={() => setOpen("island")}
        className="tap game-mode-card game-mode-island block w-full p-4 text-left"
      >
        <span className="game-mode-number">01</span>
        <div className="flex items-center gap-3">
          <span className="game-mode-icon grid h-16 w-16 shrink-0 place-items-center">
            {s ? <PetIcon form={s.pet.form} size={54} face active={false} /> : <PetIcon form="egg" size={54} face active={false} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
              우리 섬 <span className="game-mode-badge">LIFE</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {s && sum
                ? `${s.pet.name} · ${petForm(s.pet.form).name} Lv.${sum.pet.level} ${sum.pet.mood}`
                : "펫을 키우고 정원·섬을 가꿔요"}
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
              <span key={t.key} className="game-todo-chip">
                <TodoIcon k={t.key} />
                {t.label}
              </span>
            ))}
          </div>
        )}
        <span className="game-mode-cta">섬 돌보기 <span aria-hidden>→</span></span>
      </button>

      {/* ── 정원 합치기 ── 혼자서도, 섬이 없어도 할 수 있다(점수가 하트가 되는 건 섬이 있을 때) */}
      <button
        type="button"
        onClick={() => setOpen("merge")}
        className="tap game-mode-card game-mode-merge block w-full p-4 text-left"
      >
        <span className="game-mode-number">02</span>
        <div className="flex items-center gap-3">
          <span className="game-mode-icon grid h-16 w-16 shrink-0 place-items-center">
            <CropIcon cropKey={CHAIN[Math.max(1, myMergeTop) - 1].key} stage={3} size={48} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
              정원 합치기 <span className="game-mode-badge">PUZZLE</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {myMergeBest > 0
                ? `내 최고 ${won(myMergeBest)}점 · ${CHAIN[Math.max(1, myMergeTop) - 1].name}까지`
                : "같은 작물을 밀어 합쳐 무등산수박까지"}
            </span>
          </span>
        </div>
        {partnerMergeBest !== undefined && (
          <p className="mt-2.5 text-xs text-muted">
            {partnerName || "상대"} 최고 {won(partnerMergeBest)}점{myMergeBest > partnerMergeBest ? " · 지금은 내가 앞서요" : myMergeBest < partnerMergeBest ? " · 따라잡아 볼까요?" : ""}
          </p>
        )}
        <span className="game-mode-cta">한 판 하기 <span aria-hidden>→</span></span>
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
      {open === "merge" && (
        <MergeGame coupleId={coupleId} myUserId={myUserId} myName={myName} partnerName={partnerName} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="game-score-cell px-2 py-2.5 text-center">
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
