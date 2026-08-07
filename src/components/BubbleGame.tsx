"use client";

/* 보글보글 — 손으로 하는 액션 게임.
 *
 * [사용자 요청 2026-08-07 "히어로인을 이용할 수 있는 보글보글 게임 만들어줘
 *  보글보글은 스테이지 별로 난이도가 올라가야해"]
 *
 * 섬에서 키운 **그 히어로**가 그대로 나오고, 사 준 **그 무기**가 거품 성능이 된다
 * (사거리·재장전). 게임을 따로 만들면 섬에서 번 돈이 갈 곳이 하나 더 생길 뿐이지만,
 * 같은 히어로를 쓰면 "무기를 왜 사는지"가 손끝으로 설명된다.
 *
 * ⚠ 서버에는 **판이 끝났을 때 한 번만** 쓴다. 60fps 물리를 무료 티어 DB 에 올릴 이유가 없다.
 *   중간에 앱이 죽으면 그 판은 날아가지만, 그건 원래 액션 게임이 그렇다.
 *
 * ⚠ 프레임 루프는 **고정 타임스텝 + 누적자**다. rAF 간격을 그대로 dt 로 쓰면 느린 기기에서
 *   한 프레임에 몇십 px 씩 움직여 발판을 뚫는다. 대신 밀린 만큼 여러 번 step() 한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { commitIslandAction, getIsland, type IslandRow } from "@/lib/couple";
import { finishBubble, heroAtk, bubbleOf, petForm, petNow, seasonOf } from "@/lib/island";
import {
  CLEAR_MS,
  DT,
  START_LIVES,
  createStage,
  monsterCount,
  captureMs,
  nextStage,
  step,
  type BubbleState,
  type Input,
} from "@/lib/bubble";
import BubbleStage from "@/components/island/BubbleStage";
import { kstHourFloatOf, skyLook, skyPhaseOf } from "@/lib/scenetime";

const won = (v: number) => Math.round(v).toLocaleString();

/** 한 프레임에 몰아서 돌릴 수 있는 최대 step 수. 탭을 오래 두고 돌아왔을 때
 *  수천 프레임을 한 번에 돌리면 브라우저가 멈춘다 — 그냥 그만큼은 버린다. */
const MAX_CATCHUP = 6;

export default function BubbleGame({
  coupleId,
  onClose,
}: {
  coupleId: string;
  onClose: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [game, setGame] = useState<BubbleState | null>(null);
  const [saved, setSaved] = useState<number | null>(null); // 정산 결과(하트)
  const gameRef = useRef<BubbleState | null>(null);
  const inputRef = useRef<Input>({ left: false, right: false, jump: false, fire: false });
  const atkRef = useRef(0);
  const lvRef = useRef(1);
  const mounted = useRef(true);
  const settled = useRef(false); // 이 판을 이미 서버에 반영했나(이중 지급 방지)
  /* ⚠ 렌더 중에 Date.now() 를 부르지 않는다(react-hooks/purity). 하늘색을 정하는 데만
     쓰이니 10분에 한 번이면 충분하다 — 프레임 루프의 시계와는 별개다. */
  const [clock, setClock] = useState(0);
  useEffect(() => {
    setClock(Date.now());
    const iv = setInterval(() => setClock(Date.now()), 600_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 섬 상태를 읽어 히어로/무기를 가져온다
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getIsland(coupleId).catch(() => null);
      if (!alive) return;
      if (!r) {
        setErr("섬을 먼저 시작해 주세요 — 게임 탭 → 우리 섬");
        return;
      }
      setRow(r);
      atkRef.current = heroAtk(r.state);
      lvRef.current = petNow(r.state, Date.now()).level;
      const fresh = createStage(1, (r.state.seed ?? 1) + Math.floor(Date.now() / 60000));
      gameRef.current = fresh;
      setGame(fresh);
    })();
    return () => {
      alive = false;
    };
  }, [coupleId]);

  /** 판을 서버에 반영 — 기록 갱신 + 모은 하트 지급. 한 판에 한 번만. */
  const settle = useCallback(async () => {
    const g = gameRef.current;
    const r = row;
    if (!g || !r || settled.current) return;
    settled.current = true;
    const next = finishBubble(r.state, { stage: g.stage, score: g.score, coins: g.coins });
    if (next === r.state) return;
    try {
      const updated = await commitIslandAction(r.version, next);
      if (mounted.current) {
        setRow(updated);
        setSaved(g.coins);
      }
    } catch {
      // 버전 충돌 — 최신을 다시 읽어 한 번 더 시도한다(액션 게임 보상은 놓치면 티가 크다)
      const fresh = await getIsland(coupleId).catch(() => null);
      if (!fresh) return;
      const retry = finishBubble(fresh.state, { stage: g.stage, score: g.score, coins: g.coins });
      await commitIslandAction(fresh.version, retry).catch(() => null);
      if (mounted.current) setSaved(g.coins);
    }
  }, [row, coupleId]);

  // ── 프레임 루프 ──
  useEffect(() => {
    if (!game) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    let clearHold = 0;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      acc += Math.min(250, t - prev); // 탭 복귀 시 폭주 방지
      prev = t;
      let n = 0;
      while (acc >= DT && n < MAX_CATCHUP) {
        acc -= DT;
        n += 1;
        const cur = gameRef.current;
        if (!cur) return;
        if (cur.phase === "clear") {
          clearHold += DT;
          if (clearHold >= CLEAR_MS) {
            clearHold = 0;
            gameRef.current = nextStage(cur, cur.stage * 31 + 7);
            continue;
          }
        }
        if (cur.phase === "over") {
          void settle();
          continue;
        }
        gameRef.current = step(cur, inputRef.current, atkRef.current, lvRef.current).state;
      }
      if (acc > DT * MAX_CATCHUP) acc = 0; // 따라잡기 포기
      // 화면 갱신은 프레임당 한 번(상태 객체를 그대로 넘긴다 — 렌더러는 ref 로 읽는다)
      if (gameRef.current) setGame(gameRef.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // game 은 의도적으로 뺐다 — 매 프레임 루프를 다시 세우면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game !== null, settle]);

  // 데스크톱에서도 해볼 수 있게 키보드를 받는다(모바일이 주인공이지만 검증에 필요하다)
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key;
      const i = inputRef.current;
      if (k === "ArrowLeft" || k === "a") i.left = on;
      else if (k === "ArrowRight" || k === "d") i.right = on;
      else if (k === "ArrowUp" || k === "w" || k === " ") i.jump = on;
      else if (k === "z" || k === "Enter" || k === "Shift") i.fire = on;
      else return;
      e.preventDefault();
    };
    const dn = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    addEventListener("keydown", dn);
    addEventListener("keyup", up);
    return () => {
      removeEventListener("keydown", dn);
      removeEventListener("keyup", up);
    };
  }, []);

  const restart = () => {
    settled.current = false;
    setSaved(null);
    const fresh = createStage(1, Math.floor(Date.now() / 1000));
    gameRef.current = fresh;
    setGame(fresh);
  };

  // 판을 접고 나갈 때도 반영한다(모은 하트를 버리고 나가면 억울하다)
  const close = () => {
    void settle();
    onClose();
  };

  if (err) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-center text-sm text-white/70">{err}</p>
      </Shell>
    );
  }
  if (!row || !game) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-center text-sm text-white/60">불러오는 중…</p>
      </Shell>
    );
  }

  const s = row.state;
  const rec = bubbleOf(s);
  const look = skyLook(skyPhaseOf(kstHourFloatOf(clock)), seasonOf(clock));
  const alive = game.mons.filter((m) => m.st !== "dead").length;

  return (
    <Shell onClose={close}>
      <div className="px-3 pb-4">
        {/* 상태 줄 */}
        <div className="flex items-center justify-between pt-2 text-sm">
          <p className="font-extrabold text-white">
            스테이지 {game.stage}
            <span className="ml-2 text-xs font-bold text-white/50">최고 {rec.best}</span>
          </p>
          <p className="flex items-center gap-2 text-white/70">
            <span>{"❤️".repeat(Math.max(0, game.lives))}</span>
            <span className="tabular-nums">{won(game.score)}점</span>
          </p>
        </div>

        {/* 무대 */}
        <div className="relative mt-2 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <BubbleStage state={game} form={s.pet.form} look={look} />

          {game.phase === "clear" && (
            <Overlay>
              <p className="text-2xl">🫧</p>
              <p className="mt-1 text-base font-extrabold text-white">스테이지 {game.stage} 클리어!</p>
              <p className="mt-0.5 text-sm text-white/70">
                다음은 몬스터 {monsterCount(game.stage + 1)}마리 · 가둠 {(captureMs(game.stage + 1) / 1000).toFixed(1)}초
              </p>
            </Overlay>
          )}
          {game.phase === "over" && (
            <Overlay>
              <p className="text-2xl">💫</p>
              <p className="mt-1 text-base font-extrabold text-white">스테이지 {game.stage} 에서 끝</p>
              <p className="mt-0.5 text-sm text-white/70">
                {won(game.score)}점 · {won(game.coins)}💗 획득
                {saved !== null && <span className="ml-1 text-emerald-300">저장됨</span>}
              </p>
              <button
                onClick={restart}
                className="tap mt-3 rounded-full bg-white px-5 py-2 text-sm font-extrabold text-[#1a2540]"
              >
                다시 하기
              </button>
            </Overlay>
          )}
        </div>

        {/* 남은 몬스터 · 이번 판 수확 */}
        <div className="mt-2 flex items-center justify-between text-xs text-white/55">
          <span>남은 몬스터 {alive}마리</span>
          <span className="tabular-nums">이번 판 {won(game.coins)}💗</span>
        </div>

        {/* 조작 — 모바일이 주인공이라 버튼이 크고, 누르는 동안 계속 먹는다 */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex gap-2">
            <Pad label="◀" onHold={(on) => (inputRef.current.left = on)} />
            <Pad label="▶" onHold={(on) => (inputRef.current.right = on)} />
          </div>
          <div className="flex gap-2">
            <Pad label="🫧" big onHold={(on) => (inputRef.current.fire = on)} />
            <Pad label="⤒" big onHold={(on) => (inputRef.current.jump = on)} />
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-xs leading-relaxed text-white/55 ring-1 ring-white/10">
          {petForm(s.pet.form).emoji} 🫧 로 몬스터를 가두고, 거품에 <b>부딪혀 터뜨리면</b> 잡혀요.
          붙어 있는 거품은 한 번에 터져서 점수가 커져요. 무기가 좋을수록 거품이 멀리·빨리 나가요.
        </p>
      </div>
    </Shell>
  );
}

/* 누르고 있는 동안 입력이 유지되는 패드.
   ⚠ onClick 이 아니라 포인터 down/up 이다 — 클릭은 뗀 뒤에 오니 '이동'을 만들 수 없다.
   ⚠ 손가락이 버튼 밖으로 나가도 뗀 것으로 쳐야 한다(안 그러면 계속 달린다). */
function Pad({
  label,
  big = false,
  onHold,
}: {
  label: string;
  big?: boolean;
  onHold: (on: boolean) => void;
}) {
  const [on, setOn] = useState(false);
  const hold = (v: boolean) => {
    setOn(v);
    onHold(v);
  };
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        hold(true);
      }}
      onPointerUp={() => hold(false)}
      onPointerCancel={() => hold(false)}
      onLostPointerCapture={() => hold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none rounded-2xl ring-1 ring-white/15 transition-transform ${
        big ? "h-16 w-16 text-2xl" : "h-14 w-14 text-xl"
      } ${on ? "scale-95 bg-white/30" : "bg-white/12"} grid place-items-center font-black text-white`}
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 text-center">
      <div className="animate-pop px-4">{children}</div>
    </div>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0e1730]">
      <div className="mx-auto w-full max-w-md">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0e1730]/95 px-4 py-3 backdrop-blur">
          <p className="text-base font-extrabold text-white">🫧 보글보글</p>
          <button
            onClick={onClose}
            className="tap rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white ring-1 ring-white/15"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { START_LIVES };
