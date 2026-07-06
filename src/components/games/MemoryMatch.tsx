"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type RoundInfo, MEMORY_PAIRS, memoryDeck, memoryScore, roundSubmitLabel, roundTag } from "@/lib/game";
import Icon from "@/components/Icon";

// pairs(6) 만큼의 그림. deck 값 0..5 → 이 이모지.
const FACES = ["🍓", "🌙", "⭐", "🌸", "🐰", "🍀"];

/** 기억력 카드짝 — 같은 그림 6쌍을 빠르게(실수 적게) 맞춰요. seed 로 두 사람 동일 배치.
 *  점수는 memoryScore(경과ms, 실수) — 높을수록 좋음. */
export default function MemoryMatch({
  seed,
  round,
  onDone,
  onCancel,
}: {
  seed: number;
  round?: RoundInfo;
  onDone: (score: number) => void;
  onCancel: () => void;
}) {
  const deck = useMemo(() => memoryDeck(seed), [seed]); // 12장(값 0..5 각 2)
  const [flipped, setFlipped] = useState<number[]>([]); // 뒤집힌 인덱스(최대 2)
  const [matched, setMatched] = useState<Set<number>>(new Set()); // 맞춘 '값'
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const lockRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    startRef.current = performance.now();
    const timers = timersRef.current; // 같은 배열 참조 — push 로 계속 채워지고 unmount 시 전부 정리
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (matched.size === MEMORY_PAIRS && !done) {
      setElapsed(Math.round(performance.now() - startRef.current));
      setDone(true);
    }
  }, [matched, done]);

  function flip(i: number) {
    if (lockRef.current || done) return;
    if (flipped.includes(i) || matched.has(deck[i])) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      lockRef.current = true;
      const [a, b] = next;
      if (deck[a] === deck[b]) {
        timersRef.current.push(
          setTimeout(() => {
            setMatched((m) => new Set(m).add(deck[a]));
            setFlipped([]);
            lockRef.current = false;
          }, 320),
        );
      } else {
        setMistakes((x) => x + 1);
        timersRef.current.push(
          setTimeout(() => {
            setFlipped([]);
            lockRef.current = false;
          }, 720),
        );
      }
    }
  }

  const score = memoryScore(elapsed, mistakes);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12]"
      role="dialog"
      aria-modal="true"
      aria-label="기억력 카드짝 게임"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_-12%,rgba(255,95,151,0.22),transparent_70%)]"
      />
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          🃏 기억력{roundTag(round)} · 실수 {mistakes}
        </span>
        <button
          onClick={onCancel}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {!done ? (
        <div className="relative flex flex-1 items-center justify-center px-4">
          <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
            {deck.map((val, i) => {
              const open = flipped.includes(i) || matched.has(val);
              return (
                <button
                  key={i}
                  onClick={() => flip(i)}
                  aria-label={open ? `카드 ${FACES[val]}` : "뒤집힌 카드"}
                  className={`tap grid aspect-[3/4] place-items-center rounded-xl text-3xl ring-1 transition-transform ${
                    open
                      ? "bg-white/90 ring-white"
                      : "bg-white/10 ring-white/15 active:scale-95"
                  }`}
                >
                  {open ? FACES[val] : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-semibold text-white/70">완료! 내 점수</p>
          <p className="mt-1 text-6xl font-black tabular-nums text-white">{score}</p>
          <p className="mt-2 text-xs text-white/60">
            {(elapsed / 1000).toFixed(1)}초 · 실수 {mistakes}
          </p>
        </div>
      )}

      {done && (
        <div className="relative flex gap-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onCancel}
            className="tap rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white"
          >
            그만
          </button>
          <button
            onClick={() => onDone(score)}
            className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
          >
            {roundSubmitLabel(round, "이 점수로 도전 🃏")}
          </button>
        </div>
      )}
    </div>
  );
}
