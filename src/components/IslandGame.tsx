"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type IslandState,
  type CropKey,
  type ProductKey,
  CROPS,
  PRODUCTS,
  DECORS,
  DECOR_SETS,
  DECOR_COLS,
  DECOR_ROWS,
  TUNING,
  ACHIEVEMENTS,
  RARITY_PRICE,
  SEASON_LABEL,
  createIsland,
  islandSummary,
  petForm,
  petStage,
  nextEvolution,
  cropOf,
  cropStage,
  productOf,
  craftReady,
  decorDef,
  xpForBondLevel,
  feedPet,
  cleanPet,
  playPet,
  hugPet,
  restPet,
  medicinePet,
  evolve,
  retirePet,
  coopStart,
  coopConfirm,
  plant,
  waterPlot,
  harvest,
  expandPlots,
  startCraft,
  collectCraft,
  buyTool,
  buyFertilizer,
  placeDecor,
  removeDecor,
  claimVisit,
  claimQuest,
  giftPartner,
} from "@/lib/island";
import {
  type IslandRow,
  getIsland,
  createIsland as createIslandRow,
  commitIslandAction,
  subscribeIsland,
} from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";

type Tab = "pet" | "farm" | "craft" | "decor" | "more";
const won = (v: number) => v.toLocaleString();

/** 스탯 막대. */
function StatBar({ label, emoji, value, color }: { label: string; emoji: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-center text-xs">{emoji}</span>
      <span className="w-8 shrink-0 text-[10px] text-white/60">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-[10px] tabular-nums text-white/70">{Math.round(value)}</span>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15">
      {children}
    </span>
  );
}

export default function IslandGame({
  coupleId,
  myUserId,
  partnerName,
  startDate,
  onEarnedSpent,
  onClose,
}: {
  coupleId: string;
  myUserId: string | null;
  partnerName: string;
  startDate: string | null; // 사귄 날(D-day)
  onEarnedSpent?: () => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pet");
  const [now, setNow] = useState(() => Date.now());
  const [petName, setPetName] = useState("");
  const [seedFor, setSeedFor] = useState<number | null>(null); // 씨앗 시트: plotId
  const [craftFor, setCraftFor] = useState<number | null>(null); // 가공 시트: slotId
  const [shopOpen, setShopOpen] = useState(false); // 데코 상점
  const [placeKey, setPlaceKey] = useState<string | null>(null); // 배치 대기 데코
  const [celebrate, setCelebrate] = useState<string | null>(null); // 진화 축하 form key

  const visitedRef = useRef(false);

  // 살아있는 시계(게이지/쿨다운 갱신)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(iv);
  }, []);

  // 로드 + 구독
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const load = () =>
      getIsland(coupleId)
        .then((r) => !cancelled && setRow(r))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const unsub = subscribeIsland(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const s: IslandState | null = row?.state ?? null;

  // 방문 처리(1회) — 출석/함께/D-day/퀘스트
  useEffect(() => {
    if (!row || !myUserId || visitedRef.current) return;
    visitedRef.current = true;
    commit(claimVisit(row.state, myUserId, Date.now()), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.couple_id, myUserId]);

  // 진화 대기 감지 → 축하
  useEffect(() => {
    if (s?.pet.pendingEvolve && !celebrate) {
      const next = nextEvolution(s.pet.form, s.pet.cq, s.bond.level, s.pet.neglect);
      if (next) setCelebrate(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.pet.pendingEvolve, s?.pet.form]);

  // 상태 커밋(버전 낙관적 락). silent=방문 등 조용한 커밋.
  async function commit(next: IslandState, silent = false) {
    if (!row || (busy && !silent)) return;
    if (!silent) setBusy(true);
    try {
      const updated = await commitIslandAction(row.version, next);
      setRow(updated);
      onEarnedSpent?.();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      getIsland(coupleId).then(setRow).catch(() => {});
      if (!silent)
        setErr(
          code === "40001"
            ? "상대가 방금 뭔가 했어요 — 최신으로 맞췄으니 다시 눌러요."
            : (e as { message?: string })?.message ?? "오류가 났어요.",
        );
    } finally {
      if (!silent) setBusy(false);
    }
  }
  const act = (fn: (s: IslandState) => IslandState) => {
    if (s) commit(fn(s));
  };

  async function startGame() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const init = createIsland(petName.trim() || "우리 펫", startDate, Date.now());
      const created = await createIslandRow(init);
      setRow(created);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "시작 실패");
    } finally {
      setBusy(false);
    }
  }

  // ── 렌더 셸 ─────────────────────────────────────────────────
  const shell = (inner: ReactNode) => (
    <div
      className="fixed inset-0 z-[75] flex flex-col text-white"
      style={{ background: "linear-gradient(180deg,#1b2b4a 0%,#20304e 40%,#25506e 100%)" }}
      role="dialog"
      aria-modal="true"
      aria-label="우리 섬"
    >
      {inner}
    </div>
  );

  if (loading) return shell(<div className="flex flex-1 items-center justify-center text-sm text-white/60">불러오는 중…</div>);

  if (!row || !s) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="text-6xl">🏝️</span>
        <h2 className="mt-4 text-2xl font-black">우리 섬</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
          둘이 함께 가꾸는 섬이에요. 알을 정성껏 돌보면 <b className="text-white">다양한 모습으로 진화</b>하고,
          정원을 키우고 섬을 꾸미며 <b className="text-white">유대</b>를 쌓아가요.
        </p>
        <input
          value={petName}
          onChange={(e) => setPetName(e.target.value.slice(0, 12))}
          placeholder="펫 이름 (예: 방울이)"
          className="mt-6 w-full max-w-xs rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          onClick={startGame}
          disabled={busy}
          className="tap mt-4 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "섬 시작하기 🥚"}
        </button>
        {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}
        <button onClick={onClose} className="tap mt-3 text-xs text-white/50 underline">
          닫기
        </button>
      </div>,
    );
  }

  const sum = islandSummary(s, now);
  const pf = petForm(s.pet.form);
  const stage = petStage(s.pet.form);
  const cdLeft = (key: string, hrs: number) => Math.max(0, (s.pet.cd[key] ?? 0) + hrs * 3600_000 - now);
  const cdLabel = (ms: number) => (ms <= 0 ? "" : ms > 3600_000 ? `${Math.ceil(ms / 3600_000)}시간` : `${Math.ceil(ms / 60000)}분`);

  const TABS: { k: Tab; label: string; emoji: string }[] = [
    { k: "pet", label: "펫", emoji: pf.emoji },
    { k: "farm", label: "정원", emoji: "🌱" },
    { k: "craft", label: "공방", emoji: "🍯" },
    { k: "decor", label: "꾸미기", emoji: "🌸" },
    { k: "more", label: "모아보기", emoji: "📖" },
  ];

  return shell(
    <>
      {/* 헤더 */}
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Pill>💗 {won(s.coins)}</Pill>
            <Pill>
              {sum.ratingTier.emoji} {won(sum.rating)}
            </Pill>
            <Pill>💞 {s.bond.level}</Pill>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="tap grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {/* 섬 레벨 바 + 계절 */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-bold text-white/70">섬 Lv.{s.level}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (s.xp / sum.xpNext) * 100)}%` }} />
          </div>
          <span className="text-[11px] text-white/60">{SEASON_LABEL[sum.season]}</span>
        </div>
      </div>

      {/* 탭 */}
      <div className="mt-2 flex gap-1 px-3">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`tap flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
              tab === t.k ? "bg-white/20 ring-1 ring-white/40" : "bg-white/[0.06] text-white/60"
            }`}
          >
            <span className="text-sm">{t.emoji}</span>
            <br />
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="px-4 pt-1 text-center text-[11px] text-rose-300">{err}</p>}

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {/* ── 펫 ── */}
        {tab === "pet" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-black/20 p-4 text-center ring-1 ring-white/10">
              <div className="text-6xl leading-none">{pf.emoji}</div>
              <p className="mt-2 text-sm font-extrabold">
                {s.pet.name} <span className="text-white/50">· {pf.name}</span> {sum.pet.mood}
              </p>
              <p className="text-[11px] text-white/50">
                Lv.{sum.pet.level} · 스테이지 {stage}/4 · 정성 {Math.round(s.pet.cq)}
                {s.pet.sick && " · 아파요 🤒"}
              </p>
              {/* 스탯 */}
              <div className="mt-3 space-y-1.5 text-left">
                <StatBar label="포만" emoji="🍖" value={sum.pet.stats.hunger} color="#fb923c" />
                <StatBar label="행복" emoji="😊" value={sum.pet.stats.happy} color="#f472b6" />
                <StatBar label="기력" emoji="⚡" value={sum.pet.stats.energy} color="#fbbf24" />
                <StatBar label="청결" emoji="🧼" value={sum.pet.stats.clean} color="#38bdf8" />
                <StatBar label="건강" emoji="❤️" value={sum.pet.stats.health} color="#f87171" />
              </div>
              {s.pet.pendingEvolve && (
                <button
                  onClick={() => setCelebrate(nextEvolution(s.pet.form, s.pet.cq, s.bond.level, s.pet.neglect))}
                  className="tap mt-3 w-full animate-pop rounded-xl bg-amber-300 py-2.5 text-sm font-extrabold text-ink"
                >
                  ✨ 진화할 수 있어요! 확인하기
                </button>
              )}
              {stage === 4 && (
                <button
                  onClick={async () => {
                    const name = "새 친구";
                    if (await confirmDialog({ message: `${pf.name}를 박물관에 보내고 새 알을 시작할까요?`, detail: "지금까지의 진화형은 박물관에 남아요.", confirmText: "새 알" }))
                      act((st) => retirePet(st, name, Date.now()));
                  }}
                  className="tap mt-2 w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80"
                >
                  🏛️ 박물관에 보내고 새 알 시작
                </button>
              )}
            </div>
            {/* 케어 액션 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "feed", label: "밥주기", emoji: "🍚", cd: 4, fn: feedPet, cost: TUNING.pet.action.feed.cost },
                { k: "play", label: "놀기", emoji: "🎾", cd: 3, fn: playPet },
                { k: "clean", label: "씻기기", emoji: "🛁", cd: 6, fn: cleanPet },
                { k: "hug", label: "안아주기", emoji: "🤗", cd: 2, fn: hugPet },
                { k: "rest", label: "재우기", emoji: "😴", cd: 8, fn: restPet },
                { k: "medicine", label: "약", emoji: "💊", cd: 0, fn: medicinePet, cost: TUNING.pet.action.medicine.cost },
              ].map((a) => {
                const left = a.cd ? cdLeft(a.k, a.cd) : 0;
                const disabled = busy || left > 0 || (a.cost != null && s.coins < a.cost);
                return (
                  <button
                    key={a.k}
                    disabled={disabled}
                    onClick={() => act((st) => a.fn(st, Date.now()))}
                    className="tap flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.08] py-2.5 ring-1 ring-white/10 disabled:opacity-35"
                  >
                    <span className="text-xl">{a.emoji}</span>
                    <span className="text-[11px] font-bold">{a.label}</span>
                    <span className="text-[9px] text-white/45">
                      {left > 0 ? cdLabel(left) : a.cost ? `${a.cost}💗` : "무료"}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* 함께 놀기 */}
            {s.pending.some((p) => p.type === "coop" && p.by !== myUserId) ? (
              <button
                onClick={() => act((st) => coopConfirm(st, myUserId ?? "", Date.now()))}
                className="tap w-full animate-pop rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
              >
                💞 {partnerName}가 함께 놀자고 해요 — 같이 놀기!
              </button>
            ) : s.pending.some((p) => p.type === "coop") ? (
              <p className="rounded-xl bg-white/[0.06] py-2.5 text-center text-xs text-white/60">💞 함께 놀기 대기 중 — 상대가 오면 완성돼요</p>
            ) : (
              <button
                onClick={() => act((st) => coopStart(st, myUserId ?? "", Date.now()))}
                className="tap w-full rounded-xl bg-white/[0.08] py-3 text-sm font-bold ring-1 ring-white/10"
              >
                💞 함께 놀기 걸어두기 (유대 +)
              </button>
            )}
            <p className="text-center text-[10px] text-white/40">정성껏 자주 돌볼수록 더 멋진 모습으로 진화해요 ✨</p>
          </div>
        )}

        {/* ── 정원 ── */}
        {tab === "farm" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>농사 Lv.{sum.skill} · {SEASON_LABEL[sum.season]} 제철 작물이 잘 자라요</span>
              <span>{s.farm.plots.length}칸</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {s.farm.plots.map((plot, i) => {
                const st = cropStage(s, plot, now);
                const c = plot.crop ? cropOf(plot.crop) : null;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!plot.crop) setSeedFor(i);
                      else if (st.ripe) act((x) => harvest(x, i, Date.now()));
                      else act((x) => waterPlot(x, i, Date.now()));
                    }}
                    className="tap relative flex aspect-square flex-col items-center justify-center rounded-xl bg-[#3b2f1d]/60 ring-1 ring-amber-900/40"
                  >
                    {!plot.crop ? (
                      <span className="text-lg text-white/30">＋</span>
                    ) : st.ripe ? (
                      <>
                        <span className="animate-pop text-2xl">{c!.emoji}</span>
                        <span className="text-[8px] font-bold text-emerald-300">수확!</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">{st.progress < 0.4 ? "🌱" : st.progress < 0.8 ? "🌿" : "🌾"}</span>
                        <span className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-black/40">
                          <span className="block h-full bg-emerald-400" style={{ width: `${st.progress * 100}%` }} />
                        </span>
                        {plot.wateredAt != null && now - plot.wateredAt < 86400000 ? null : (
                          <span className="absolute right-0.5 top-0.5 text-[9px]">💧</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[10px] text-white/40">빈 칸=심기 · 자라는 중=물주기 · 다 자람=수확</p>
            {/* 도구/확장 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy || s.farm.plots.length >= 24 || s.coins < (TUNING.farm.plotBatches[Math.floor((s.farm.plots.length - 4) / 2)] ?? 1e9)}
                onClick={() => act((x) => expandPlots(x))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                밭 넓히기 {s.farm.plots.length < 24 ? `(${won(TUNING.farm.plotBatches[Math.floor((s.farm.plots.length - 4) / 2)] ?? 0)}💗)` : "MAX"}
              </button>
              <button
                onClick={() => act((x) => buyFertilizer(x, false))}
                disabled={busy || s.coins < TUNING.farm.fertilizer}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                비료 사기 ({TUNING.farm.fertilizer}💗) · 보유 {s.farm.fert}
              </button>
              <button
                disabled={busy || s.farm.sprinkler || s.coins < TUNING.farm.sprinkler}
                onClick={() => act((x) => buyTool(x, "sprinkler", Date.now()))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                💧 스프링클러 {s.farm.sprinkler ? "✓" : `(${won(TUNING.farm.sprinkler)}💗)`}
              </button>
              <button
                disabled={busy || s.farm.greenhouse || s.coins < TUNING.farm.greenhouse}
                onClick={() => act((x) => buyTool(x, "greenhouse", Date.now()))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                🏡 온실 {s.farm.greenhouse ? "✓" : `(${won(TUNING.farm.greenhouse)}💗)`}
              </button>
            </div>
          </div>
        )}

        {/* ── 공방 ── */}
        {tab === "craft" && (
          <div className="space-y-3">
            {s.level < 6 && <p className="rounded-xl bg-white/[0.06] py-3 text-center text-xs text-white/60">섬 Lv.6부터 공방이 열려요 🍯</p>}
            {/* 창고 */}
            <div>
              <p className="mb-1 text-[11px] font-bold text-white/60">창고 (수확물)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.farm.barn).length === 0 && <span className="text-[11px] text-white/40">비었어요 — 정원에서 수확해요</span>}
                {Object.entries(s.farm.barn).map(([k, v]) => (
                  <Pill key={k}>
                    {cropOf(k as CropKey).emoji} {v.qty} <span className="text-amber-300">{"★".repeat(v.star)}</span>
                  </Pill>
                ))}
              </div>
            </div>
            {/* 가공 슬롯 */}
            {s.farm.craft.map((slot, i) => {
              const ready = craftReady(slot, now);
              const p = slot.product ? productOf(slot.product) : null;
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <span className="text-2xl">{p ? p.emoji : "🍳"}</span>
                  <div className="min-w-0 flex-1">
                    {!p ? (
                      <p className="text-xs text-white/60">비어있는 조리대</p>
                    ) : ready ? (
                      <p className="text-xs font-bold text-emerald-300">{p.name} 완성!</p>
                    ) : (
                      <p className="text-xs text-white/70">{p.name} 만드는 중…</p>
                    )}
                  </div>
                  {!p ? (
                    <button
                      disabled={s.level < 6}
                      onClick={() => setCraftFor(i)}
                      className="tap rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold disabled:opacity-35"
                    >
                      만들기
                    </button>
                  ) : ready ? (
                    <button onClick={() => act((x) => collectCraft(x, i, Date.now()))} className="tap rounded-lg bg-brand px-3 py-1.5 text-xs font-extrabold text-white">
                      수령
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/40">진행중</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 꾸미기 ── */}
        {tab === "decor" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white/60">{placeKey ? `${decorDef(placeKey).emoji} 놓을 칸을 탭` : "칸을 탭해 배치 / 배치된 것 탭해 치우기"}</p>
              <button onClick={() => setShopOpen(true)} className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold ring-1 ring-white/15">
                🛒 상점
              </button>
            </div>
            <div
              className="grid gap-1.5 rounded-2xl bg-emerald-900/30 p-2 ring-1 ring-emerald-700/30"
              style={{ gridTemplateColumns: `repeat(${DECOR_COLS},1fr)` }}
            >
              {Array.from({ length: DECOR_COLS * DECOR_ROWS }).map((_, idx) => {
                const x = idx % DECOR_COLS;
                const y = Math.floor(idx / DECOR_COLS);
                const it = s.decor.find((d) => d.x === x && d.y === y);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (it) act((st) => removeDecor(st, it.id));
                      else if (placeKey) {
                        act((st) => placeDecor(st, placeKey, x, y, Date.now()));
                        setPlaceKey(null);
                      }
                    }}
                    className="tap grid aspect-square place-items-center rounded-lg bg-black/15 text-xl ring-1 ring-white/5"
                  >
                    {it ? decorDef(it.key).emoji : ""}
                  </button>
                );
              })}
            </div>
            {/* 세트 진행 */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-white/60">테마 세트</p>
              {DECOR_SETS.map((set) => {
                const items = DECORS.filter((d) => d.set === set.id);
                const have = items.filter((d) => s.decor.some((p) => p.key === d.key)).length;
                const done = s.sets.includes(set.id);
                return (
                  <div key={set.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${done ? "bg-amber-400/15 ring-1 ring-amber-300/40" : "bg-white/[0.05]"}`}>
                    <span>{set.emoji}</span>
                    <span className="flex-1 font-bold">{set.name}</span>
                    <span className="text-white/50">{have}/{items.length}</span>
                    {done && <span className="text-[10px] text-amber-300">완성 · {set.perk}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 모아보기(퀘스트·유대·업적·도감) ── */}
        {tab === "more" && (
          <div className="space-y-4">
            {/* 일일 퀘스트 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-white/70">오늘의 퀘스트 🎯</p>
              <div className="space-y-1.5">
                {s.quest.list.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{q.label}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-emerald-400" style={{ width: `${(q.prog / q.goal) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-white/50 tabular-nums">{q.prog}/{q.goal}</span>
                    {q.claimed ? (
                      <span className="text-[10px] text-emerald-300">완료 ✓</span>
                    ) : (
                      <button
                        disabled={busy || q.prog < q.goal}
                        onClick={() => act((x) => claimQuest(x, q.id, Date.now()))}
                        className="tap rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-30"
                      >
                        +{q.reward}💗
                      </button>
                    )}
                  </div>
                ))}
                {s.quest.chest && <p className="text-center text-[10px] text-amber-300">오늘 퀘스트 전부 완료! 🎁</p>}
              </div>
            </div>
            {/* 유대 */}
            <div className="rounded-xl bg-white/[0.06] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">💞 유대 Lv.{s.bond.level}</span>
                <button onClick={() => act((x) => giftPartner(x, 10, Date.now()))} className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">
                  🎁 마음 전하기
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-pink-400" style={{ width: `${Math.min(100, (s.bond.xp / xpForBondLevel(s.bond.level + 1)) * 100)}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-white/45">함께 놀기·선물·둘 다 출석·기념일로 깊어져요</p>
            </div>
            {/* 업적 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-white/70">업적 🏆 ({s.achievements.length}/{ACHIEVEMENTS.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {ACHIEVEMENTS.map((a) => {
                  const got = s.achievements.includes(a.key);
                  return (
                    <span
                      key={a.key}
                      title={a.name}
                      className={`rounded-lg px-2 py-1 text-[11px] ${got ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40" : "bg-white/[0.05] text-white/30"}`}
                    >
                      {a.emoji} {got ? a.name : "???"}
                    </span>
                  );
                })}
              </div>
            </div>
            {/* 펫 박물관 */}
            {s.museum.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold text-white/70">펫 박물관 🏛️</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.museum.map((k) => (
                    <Pill key={k}>
                      {petForm(k).emoji} {petForm(k).name}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
            <p className="text-center text-[10px] text-white/40">도감 {s.catalog.length}종 발견 · 아케이드/부루마블/테트리스 승리로도 💗코인이 쌓여요</p>
          </div>
        )}
      </div>

      {/* 씨앗 시트 */}
      {seedFor != null && (
        <SheetShell onClose={() => setSeedFor(null)} title="무엇을 심을까요?">
          <div className="grid grid-cols-2 gap-2">
            {CROPS.map((c) => {
              const inSeason = s.farm.greenhouse || c.season === sum.season;
              return (
                <button
                  key={c.key}
                  disabled={busy || s.coins < c.seed}
                  onClick={() => {
                    act((x) => plant(x, seedFor, c.key, Date.now()));
                    setSeedFor(null);
                  }}
                  className="tap flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-35"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">
                      {c.name} {!inSeason && <span className="text-[9px] text-rose-300">비제철</span>}
                    </p>
                    <p className="text-[10px] text-white/50">씨앗 {c.seed}💗 · {c.growDays < 1 ? Math.round(c.growDays * 24) + "시간" : c.growDays + "일"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* 가공 시트 */}
      {craftFor != null && (
        <SheetShell onClose={() => setCraftFor(null)} title="무엇을 만들까요?">
          <div className="space-y-2">
            {PRODUCTS.map((p) => {
              const canLevel = s.level >= p.minLevel;
              const enough = Object.entries(p.recipe).every(([ck, n]) => (s.farm.barn[ck]?.qty ?? 0) >= (n as number));
              return (
                <button
                  key={p.key}
                  disabled={busy || !canLevel || !enough}
                  onClick={() => {
                    act((x) => startCraft(x, craftFor, p.key as ProductKey, Date.now()));
                    setCraftFor(null);
                  }}
                  className="tap flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-35"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{p.name} {!canLevel && <span className="text-[9px] text-rose-300">Lv.{p.minLevel}</span>}</p>
                    <p className="text-[10px] text-white/50">
                      {Object.entries(p.recipe).map(([ck, n]) => `${cropOf(ck as CropKey).emoji}${n}`).join(" ")} · {p.days < 1 ? Math.round(p.days * 24) + "시간" : p.days + "일"} · ~{won(p.sell)}💗
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* 데코 상점 */}
      {shopOpen && (
        <SheetShell onClose={() => setShopOpen(false)} title="🛒 데코 상점">
          <div className="grid grid-cols-3 gap-2">
            {DECORS.map((d) => {
              const owned = s.decor.some((p) => p.key === d.key);
              const price = RARITY_PRICE[d.rarity];
              const locked = s.level < d.minLevel || (d.set === "couple" && s.bond.level < 3);
              return (
                <button
                  key={d.key}
                  disabled={owned || locked || s.coins < price}
                  onClick={() => {
                    setPlaceKey(d.key);
                    setShopOpen(false);
                  }}
                  className={`tap flex flex-col items-center gap-0.5 rounded-xl py-2.5 ring-1 disabled:opacity-40 ${
                    d.rarity === "legendary" ? "bg-amber-400/10 ring-amber-300/40" : d.rarity === "epic" ? "bg-purple-400/10 ring-purple-300/30" : "bg-white/[0.06] ring-white/10"
                  }`}
                >
                  <span className="text-2xl">{d.emoji}</span>
                  <span className="text-[10px] font-bold">{d.name}</span>
                  <span className="text-[9px] text-amber-300">{owned ? "보유" : locked ? (d.set === "couple" ? "유대3" : `Lv${d.minLevel}`) : `${price}💗`}</span>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* 진화 축하 */}
      {celebrate && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 px-8 backdrop-blur-sm">
          <div className="animate-pop w-full max-w-sm rounded-2xl bg-[#1a2540] p-6 text-center ring-1 ring-white/15">
            <p className="text-xs text-white/60">진화!</p>
            <div className="mt-2 flex items-center justify-center gap-3 text-5xl">
              <span className="opacity-50">{pf.emoji}</span>
              <span>→</span>
              <span className="animate-pop">{petForm(celebrate).emoji}</span>
            </div>
            <p className="mt-3 text-lg font-black">{petForm(celebrate).name}(으)로!</p>
            <p className="mt-1 text-[11px] text-white/55">정성껏 돌본 결과예요 ✨</p>
            <button
              onClick={() => {
                act((x) => evolve(x, Date.now()));
                setCelebrate(null);
              }}
              className="tap mt-4 w-full rounded-xl bg-amber-300 py-3 text-sm font-extrabold text-ink"
            >
              진화 확정 🎉
            </button>
          </div>
        </div>
      )}
    </>,
  );
}

/** 공용 바텀시트. */
function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#1a2540] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-white ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        <h3 className="mb-3 text-base font-extrabold">{title}</h3>
        {children}
        <button onClick={onClose} className="tap mt-4 w-full rounded-xl bg-white/15 py-2.5 text-sm font-bold">
          닫기
        </button>
      </div>
    </div>
  );
}
