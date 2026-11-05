"use client";

/* 게임 탭 — 낚시(메인) · 우리 섬 · 정원 합치기 · 우리 수조 허브. 같은 지갑(하트)을 쓴다.
 * 카드는 섬 상태를 읽어 보여 주기만 하고, 저장은 각 게임 화면이 한다. */

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import IslandGame from "@/components/IslandGame";
import MergeGame from "@/components/MergeGame";
import MergeArt from "@/components/MergeArt";
import AquariumGame from "@/components/AquariumGame";
import FishingGame from "@/components/FishingGame";
import GameWindowGuard from "@/components/GameWindowGuard";
import { asset } from "@/lib/base";
import { fishingOf, formsSeen, spotArtKey, SPOTS } from "@/lib/fishing";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import { TANK_IMAGE_KEYS } from "@/lib/aquaimages";
import { FishArt } from "@/components/AquaArt";
import { ALL_FORMS, aquaOf, fishArtKey, growBlock, tickAqua } from "@/lib/aquarium";
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
  openMergeReq,
  openAquaReq,
  openFishReq,
}: {
  coupleId: string | null;
  myUserId: string | null;
  myName?: string;
  partnerName?: string;
  startDate?: string | null;
  /** 홈 펫 탭 등 외부에서 섬을 열라는 신호(값이 바뀌면 오버레이 오픈). */
  openIslandReq?: number;
  /** 링크(?go=merge · /game/)로 들어오면 정원 합치기를 바로 연다. */
  openMergeReq?: number;
  /** 링크(?go=aquarium)로 들어오면 우리 수조를 바로 연다. */
  openAquaReq?: number;
  /** 링크(?go=fishing)로 들어오면 낚시를 바로 연다. */
  openFishReq?: number;
}) {
  const [open, setOpen] = useState<"island" | "merge" | "aquarium" | "fishing" | null>(null);
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
  useEffect(() => {
    if (openMergeReq) setOpen("merge");
  }, [openMergeReq]);
  useEffect(() => {
    if (openAquaReq) setOpen("aquarium");
  }, [openAquaReq]);
  useEffect(() => {
    if (openFishReq) setOpen("fishing");
  }, [openFishReq]);

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
  // 카드의 수조 · 섬 요약이 살아 있게 — 30초면 충분하다(여긴 요약이지 게임 화면이 아니다)
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
      같아서"] — 섬·낚시는 혼자서도 통째로 돈다(로컬 섬). 연동하면 그 섬이
      그대로 우리 섬으로 승격된다(couple.ts loadIsland). */}

  const s = row?.state ?? null;
  const sum = s && now ? islandSummary(s, now) : null;
  const tier = s ? ratingTier(islandRating(s)) : null;
  const mrec = s ? mergeOf(s) : null;
  const myKey = myUserId ?? "me";
  const myMergeBest = mrec?.best[myKey] ?? 0;
  const myMergeTop = mrec?.top[myKey] ?? 0;
  const aqua = s && now ? tickAqua(aquaOf(s, now), now).a : null;
  const fishStat = s ? fishingOf(s) : null;
  const aquaLead = aqua?.fish[aqua.fish.length - 1];
  const aquaWarn = aqua && aqua.fish.length ? growBlock(aqua) : null;
  /* 카드 배경은 그 게임의 실제 그림 — 지금 내 낚시터 · 내 수조가 그대로 보인다 */
  const openSpots = fishStat ? SPOTS.filter((x) => x.minLevel <= fishStat.level) : SPOTS.slice(0, 1);
  const spotKey = spotArtKey(openSpots[openSpots.length - 1]);
  const tankKey = `tank_${aqua?.tank ?? 1}`;
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
      <TabHeader emblem="game" eyebrow="오늘 뭐 할까?" title="게임" sub="낚시하고, 섬을 가꾸고, 작물을 합쳐 보세요." />
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

      {/* 카드는 '읽는 표'가 아니라 '들어가고 싶은 그림'이다 [사용자: "너무 카드 형태가 예전스타일이야"] — 게임 그림을 깔고,
          이름 · 지금 상태 한 줄 · 할 일 버튼만 얹는다. 번호 · 영어 배지 · 점선 구분선은 걷었다. */}
      {/* ── 낚시 ── 게임 탭의 주인공. 잡은 물고기만 수조에 들어간다 [사용자: "낚시 게임을 메인으로"] */}
      <button type="button" onClick={() => setOpen("fishing")} className="tap game-mode-card game-mode-fish is-hero block w-full text-left">
        <GameBg src={FISHING_IMAGE_KEYS.has(spotKey) ? `/fishing/${spotKey}.webp` : null} />
        <span className="game-card-art is-float">
          <FishArt artKey={aquaLead ? fishArtKey(aquaLead) : "fry_guppy"} size={118} />
        </span>
        <span className="game-card-body">
          <strong className="game-card-title">낚시</strong>
          <span className="game-card-sub">
            {fishStat && fishStat.landed > 0
              ? `Lv.${fishStat.level} · 낚시터 ${openSpots.length}/${SPOTS.length} · 지금까지 담은 ${fishStat.stored}마리`
              : "던지고, 챔질하고, 줄을 감아 수조에 담아요"}
          </span>
          <span className="game-mode-cta">낚시하러 가기</span>
        </span>
      </button>

      {/* ── 우리 섬 ── */}
      <button
        type="button"
        disabled={!s && (loading || !!loadError)}
        onClick={() => setOpen("island")}
        className="tap game-mode-card game-mode-island is-wide block w-full text-left"
      >
        <GameBg src="/island/village-autumn-v1.webp" />
        <span className="game-card-art">
          <PetIcon form={s ? s.pet.form : "egg"} size={92} active={false} />
        </span>
        <span className="game-card-body">
          <strong className="game-card-title">우리 섬</strong>
          <span className="game-card-sub">
            {s && sum
              ? `${s.pet.name} · ${petForm(s.pet.form).name} Lv.${sum.pet.level}`
              : "펫을 키우고 정원 · 섬을 가꿔요"}
          </span>
          {sum && (
            <span className="game-card-bars">
              <Bar label="포만" v={sum.pet.stats.hunger} c="#fb923c" />
              <Bar label="행복" v={sum.pet.stats.happy} c="#f472b6" />
              <Bar label="기력" v={sum.pet.stats.energy} c="#fbbf24" />
              <Bar label="청결" v={sum.pet.stats.clean} c="#38bdf8" />
            </span>
          )}
          {todos.length > 0 && (
            <span className="game-card-todos">
              {todos.map((t) => (
                <span key={t.key} className="game-todo-chip">
                  <TodoIcon k={t.key} />
                  {t.label}
                </span>
              ))}
            </span>
          )}
          <span className="game-mode-cta">섬 돌보기</span>
        </span>
      </button>

      <div className="game-card-pair">
        {/* ── 정원 합치기 ── 혼자서도, 섬이 없어도 할 수 있다(점수가 하트가 되는 건 섬이 있을 때) */}
        <button type="button" onClick={() => setOpen("merge")} className="tap game-mode-card game-mode-merge is-tile block w-full text-left">
          <span className="game-card-art"><MergeArt k={CHAIN[Math.max(1, myMergeTop) - 1].key} size={84} /></span>
          <span className="game-card-body">
            <strong className="game-card-title">정원 합치기</strong>
            <span className="game-card-sub">
              {myMergeBest > 0
                ? `최고 ${won(myMergeBest)}점${partnerMergeBest !== undefined ? ` · ${partnerName || "상대"} ${won(partnerMergeBest)}점` : ` · ${CHAIN[Math.max(1, myMergeTop) - 1].name}까지`}`
                : "같은 재료를 밀어 합쳐요"}
            </span>
            <span className="game-mode-cta">한 판 하기</span>
          </span>
        </button>

        {/* ── 우리 수조 ── 낚시로 잡은 물고기를 오래 키운다 */}
        <button type="button" onClick={() => setOpen("aquarium")} className="tap game-mode-card game-mode-aqua is-tile block w-full text-left">
          <GameBg src={TANK_IMAGE_KEYS.has(tankKey) ? `/aqua/tank/${tankKey}.webp` : null} />
          <span className="game-card-art"><FishArt artKey={aquaLead ? fishArtKey(aquaLead) : "cobra_guppy"} size={84} /></span>
          <span className="game-card-body">
            <strong className="game-card-title">우리 수조</strong>
            <span className="game-card-sub">
              {aquaWarn ?? (aqua && aqua.fish.length > 0
                ? `물고기 ${aqua.fish.length}마리 · 도감 ${s ? formsSeen(s).size : 0}/${ALL_FORMS.length}`
                : "잡은 물고기를 키워요")}
            </span>
            <span className="game-mode-cta">수조 보기</span>
          </span>
        </button>
      </div>

      {open === "island" && (
        <IslandGame
          coupleId={coupleId}
          myUserId={myUserId}
          partnerName={partnerName}
          startDate={startDate}
          onClose={() => setOpen(null)}
        />
      )}
      {open && <GameWindowGuard />}
      {open === "aquarium" && (
        <AquariumGame coupleId={coupleId} myUserId={myUserId} onClose={() => setOpen(null)} onOpenIsland={() => setOpen("island")} onFish={() => setOpen("fishing")} />
      )}
      {open === "fishing" && (
        <FishingGame coupleId={coupleId} myUserId={myUserId} myName={myName} onClose={() => setOpen(null)} onOpenIsland={() => setOpen("island")} />
      )}
      {open === "merge" && (
        <MergeGame coupleId={coupleId} myUserId={myUserId} myName={myName} partnerName={partnerName} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function GameBg({ src }: { src: string | null }) {
  return src ? <i className="game-card-bg" aria-hidden style={{ backgroundImage: `url(${asset(src)})` }} /> : null;
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
    <span className="flex items-center gap-1.5">
      <span className="w-7 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: c }} />
      </span>
    </span>
  );
}
