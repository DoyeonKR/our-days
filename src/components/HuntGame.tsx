"use client";

/* 사냥 — 방치형(idle) 화면.
 *
 * [사용자 요청 2026-08-06 "저 무기로 몬스터를 사냥하는 키우기류 게임"]
 *
 * 이 화면의 책임은 **보여주기**뿐이다. 전투 계산은 전부 lib/hunt.ts 의 settle() 이 하고,
 * 화면이 켜져 있든(1초마다) 껐다 켰든(몇 시간을 한 번에) 같은 함수를 부른다.
 * 계산을 화면에 흩뿌리면 "보고 있을 때만 이득"이 생겨 방치형이 아니게 된다.
 *
 * ⚠ **서버에 매초 커밋하지 않는다.** 무료 티어에서 초당 쓰기는 그 자체로 사고다.
 *   진행은 로컬 상태로 굴리고, 서버 커밋은 (a) 30초마다 (b) 스테이지가 올랐을 때
 *   (c) 화면을 닫을 때만 한다. 커밋을 놓쳐도 다음 진입의 오프라인 정산이 시간을 다시 세므로
 *   **진행이 사라지지 않는다** — 이게 이 설계의 핵심 안전장치다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { commitIslandAction, getIsland, type IslandRow } from "@/lib/couple";
import {
  heroAtk,
  huntOf,
  huntTick,
  petForm,
  petNow,
  type IslandState,
} from "@/lib/island";
import {
  HUNT_KILLS_PER_STAGE,
  OFFLINE_CAP_MS,
  OFFLINE_RATE,
  dailyCap,
  dailyLeft,
  dps,
  hpPct,
  isBoss,
  monsterAt,
  stageHp,
  type HuntGain,
} from "@/lib/hunt";
import HuntStage from "@/components/island/HuntStage";
import { kstHourFloatOf, skyLook, skyPhaseOf } from "@/lib/scenetime";
import { seasonOf } from "@/lib/island";

const COMMIT_MS = 30_000;
const won = (v: number) => Math.round(v).toLocaleString();

export default function HuntGame({
  coupleId,
  myUserId,
  onClose,
}: {
  coupleId: string;
  myUserId: string | null;
  onClose: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<HuntGain | null>(null); // 오프라인 정산 결과
  const [hitKey, setHitKey] = useState(0); // 피격 연출 트리거
  const dirty = useRef(false); // 마지막 커밋 이후 진행이 있었나
  const lastCommit = useRef(0);
  const mounted = useRef(true);
  /* ⚠ 렌더 중에 Date.now() 를 부르지 않는다(react-hooks/purity). 시계는 상태로 둔다 —
     어차피 1초 틱이 이미 돌고 있어 타이머가 늘지도 않는다. */
  const [now, setNow] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** 서버 커밋 — 버전 충돌이면 최신을 다시 읽어 이어간다(진행은 시간 기반이라 안 사라진다). */
  const push = useCallback(
    async (next: IslandState, version: number) => {
      try {
        const updated = await commitIslandAction(version, next);
        if (mounted.current) setRow(updated);
        dirty.current = false;
      } catch {
        const fresh = await getIsland(coupleId).catch(() => null);
        if (fresh && mounted.current) setRow(fresh);
      }
    },
    [coupleId],
  );

  // 첫 진입 — 상태를 읽고 **오프라인 정산**을 한 번 돌린다(방치형의 보상 순간).
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getIsland(coupleId).catch(() => null);
      if (!alive) return;
      if (!r) {
        setErr("섬을 먼저 시작해 주세요 — 게임 탭 → 우리 섬");
        return;
      }
      const t0 = Date.now();
      setNow(t0);
      const { state, gain } = huntTick(r.state, t0, true);
      setRow({ ...r, state });
      if (gain.kills > 0) setWelcome(gain);
      if (gain.kills > 0) {
        dirty.current = true;
        void push(state, r.version);
      }
      lastCommit.current = Date.now();
    })();
    return () => {
      alive = false;
    };
  }, [coupleId, push]);

  // 1초 틱 — 화면용 진행. 커밋은 조건부(위 주석 참조).
  useEffect(() => {
    if (!row) return;
    const iv = setInterval(() => {
      setRow((cur) => {
        if (!cur) return cur;
        const t = Date.now();
        setNow(t);
        const { state, gain } = huntTick(cur.state, t, false);
        if (gain.kills > 0) {
          dirty.current = true;
          setHitKey((k) => k + 1);
        }
        const stageUp = gain.stageUp > 0;
        if (dirty.current && (stageUp || t - lastCommit.current > COMMIT_MS)) {
          lastCommit.current = t;
          void push(state, cur.version);
        }
        return { ...cur, state };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [row, push]);

  // 닫을 때 마지막 진행을 흘려보낸다(놓쳐도 다음 진입에서 시간으로 복구되긴 한다).
  const close = () => {
    if (row && dirty.current) void push(row.state, row.version);
    onClose();
  };

  if (err) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-center text-sm text-white/70">{err}</p>
      </Shell>
    );
  }
  if (!row) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-center text-sm text-white/60">불러오는 중…</p>
      </Shell>
    );
  }

  const s = row.state;
  const hunt = huntOf(s, now);
  const atk = heroAtk(s);
  const lv = petNow(s, now).level;
  const power = dps(atk, lv);
  const mon = monsterAt(hunt.stage);
  const boss = isBoss(hunt.stage);
  const look = skyLook(skyPhaseOf(kstHourFloatOf(now)), seasonOf(now));
  const weapon = s.hero?.equip?.weapon ?? null;

  return (
    <Shell onClose={close}>
      <div className="px-4 pb-6">
        {/* 스테이지 · 몬스터 */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-base font-extrabold text-white">
            스테이지 {hunt.stage}
            {boss && <span className="ml-1.5 rounded-full bg-rose-500/30 px-2 py-0.5 text-xs font-black text-rose-200">BOSS</span>}
          </p>
          <p className="text-sm text-white/60">최고 {hunt.best} · 누적 {won(hunt.total)}마리</p>
        </div>

        {/* 무대 — 히어로가 무기를 들고 자동으로 때린다 */}
        <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <HuntStage
            form={s.pet.form}
            monster={mon.key}
            look={look}
            weapon={weapon}
            hitKey={hitKey}
          />
        </div>

        {/* 몬스터 체력 */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-white/85">{mon.emoji} {mon.name}</span>
            <span className="tabular-nums text-white/60">
              {won(Math.max(0, stageHp(hunt.stage) - hunt.dmg))} / {won(stageHp(hunt.stage))}
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300"
              style={{ width: `${hpPct(hunt) * 100}%`, transition: "width .3s linear" }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-white/50">
            <span>다음 스테이지까지 {HUNT_KILLS_PER_STAGE - hunt.kills}마리</span>
            <span className="tabular-nums">DPS {power}</span>
          </div>
        </div>

        {/* 전투력 — 무기가 주역이라는 걸 대놓고 보여준다 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="무기 공격력" value={atk > 0 ? `${atk}` : "맨손 (1)"} hint={atk > 0 ? undefined : "섬 → 펫 탭에서 무기를 사보세요"} />
          <Stat label="히어로 Lv." value={`${lv}`} hint={`레벨당 +12%`} />
        </div>
        {/* 오늘 남은 한도 — 안 보이면 "왜 하트가 안 오르지?" 가 된다.
            한도에 닿아도 처치·스테이지는 계속 오른다는 걸 같이 알린다. */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white/70">오늘 받을 하트</span>
            <span className="tabular-nums text-white/60">
              {won(dailyCap(hunt.best) - dailyLeft(hunt, now))} / {won(dailyCap(hunt.best))}💗
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-300"
              style={{
                width: `${Math.min(100, ((dailyCap(hunt.best) - dailyLeft(hunt, now)) / dailyCap(hunt.best)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-white/45">
            {dailyLeft(hunt, now) <= 0
              ? "오늘 한도를 다 받았어요. 처치와 스테이지는 계속 올라가요(내일 한도도 같이 올라요)."
              : `스테이지가 오르면 한도도 같이 올라요 (지금 최고 ${hunt.best})`}
          </p>
        </div>

        <p className="mt-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs leading-relaxed text-white/60 ring-1 ring-white/10">
          {petForm(s.pet.form).emoji} 안 보고 있어도 계속 싸워요. 앱을 껐다 켜면 그동안 잡은 만큼 정산돼요
          (최대 {OFFLINE_CAP_MS / 3_600_000}시간, 효율 {Math.round(OFFLINE_RATE * 100)}%).
        </p>
      </div>

      {/* 오프라인 정산 — 돌아왔을 때의 보상 순간 */}
      {welcome && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-6" onClick={() => setWelcome(null)}>
          <div className="animate-pop w-full max-w-xs rounded-2xl bg-[#1a2540] p-5 text-center ring-1 ring-white/15">
            <p className="text-2xl">⚔️</p>
            <p className="mt-1 text-base font-extrabold text-white">그동안 싸우고 있었어요</p>
            <p className="mt-3 text-sm text-white/80">
              {won(welcome.kills)}마리 처치 · <span className="font-black text-pink-200">+{won(welcome.coins)}💗</span>
            </p>
            {welcome.stageUp > 0 && (
              <p className="mt-1 text-sm font-bold text-amber-200">스테이지 {welcome.stageUp} 상승!</p>
            )}
            {welcome.capped && (
              <p className="mt-2 text-xs text-white/50">
                {OFFLINE_CAP_MS / 3_600_000}시간까지만 쌓여요 — 자주 들러 주세요
              </p>
            )}
            <button
              onClick={() => setWelcome(null)}
              className="tap mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[var(--ink-on-light)]"
            >
              받기
            </button>
          </div>
        </div>
      )}
      {myUserId === null && null}
    </Shell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-amber-200/80">{hint}</p>}
    </div>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#101828]">
      <div className="mx-auto min-h-full w-full max-w-md">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#101828]/95 px-4 py-3">
          <p className="text-base font-extrabold text-white">⚔️ 사냥</p>
          <button onClick={onClose} className="tap rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
