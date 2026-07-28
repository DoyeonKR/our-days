"use client";

/* 함께 놀기 플레이 세션. [2026-07-28]
   사용자: "지금은 그냥 터치하면 끝이잖아" → 걸어두기/응답 각각에 15초 하트 탭 세션을 넣고
   두 사람 점수 합으로 유대 보너스가 스케일된다(엔진 coopStart/coopConfirm 의 score).
   설계:
   · 펫 주위로 하트/장난감 버블이 떠오르고, 사라지기 전에 탭하면 점수+콤보(끊기면 리셋)
   · 콤보 3+ 부터 하트가 조금 더 자주 — 잘할수록 화면이 풍성해지는 정적 보상
   · 비동기 철학: 두 사람이 '같은 시간'에 있을 필요 없음 — 각자의 세션 점수가 합쳐진다
   · reduced-motion: 부유/팝 애니 정지(정적 페이드), 기능 동일 */

import { useEffect, useRef, useState } from "react";
import type { ArtFC } from "@/components/island/art/parts";

const PLAY_MS = 15_000;
const BUBBLE_TTL = 1700;

type Bubble = { id: number; x: number; y: number; e: string; born: number };
const BUBBLE_EMOJI = ["💗", "💖", "🧶", "🎾", "✨"];

export default function CoopPlay({
  Art,
  petName,
  mode,
  partnerName,
  onDone,
  onClose,
}: {
  Art: ArtFC;
  petName: string;
  mode: "start" | "confirm";
  partnerName: string;
  onDone: (score: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [leftMs, setLeftMs] = useState(PLAY_MS);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hop, setHop] = useState(false); // 탭 성공 시 펫 폴짝
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  // ⚠ 버블 소스는 ref, state 는 렌더용 미러 — setState updater 안에 부수효과(ref 변경·타 setState)를
  // 넣으면 StrictMode 이중 호출로 이중 득점/콤보 꼬임이 난다(순수성 계약)
  const bubblesRef = useRef<Bubble[]>([]);
  const poppedRef = useRef<Set<number>>(new Set()); // 더블탭/멀티터치 이중 득점 가드

  // 플레이 루프 — 스폰/만료/타이머를 한 인터벌에서(200ms 틱)
  useEffect(() => {
    if (phase !== "play") return;
    const startedAt = Date.now();
    let lastSpawn = 0;
    const t = setInterval(() => {
      const now = Date.now();
      const left = PLAY_MS - (now - startedAt);
      if (left <= 0) {
        setPhase("done");
        return;
      }
      setLeftMs(left);
      // 만료 정리 — 하나라도 놓쳤으면 콤보 리셋
      const before = bubblesRef.current.length;
      bubblesRef.current = bubblesRef.current.filter((b) => now - b.born < BUBBLE_TTL);
      if (bubblesRef.current.length !== before && comboRef.current > 0) {
        comboRef.current = 0;
        setCombo(0);
      }
      // 스폰 — 기본 750ms, 콤보 3+ 는 600ms(잘할수록 풍성). 동시 최대 4개
      const gap = comboRef.current >= 3 ? 600 : 750;
      if (now - lastSpawn >= gap && bubblesRef.current.length < 4) {
        lastSpawn = now;
        bubblesRef.current = [
          ...bubblesRef.current,
          {
            id: idRef.current++,
            x: 8 + Math.random() * 76, // % (버블 폭 고려)
            y: 12 + Math.random() * 60,
            e: BUBBLE_EMOJI[Math.floor(Math.random() * BUBBLE_EMOJI.length)],
            born: now,
          },
        ];
      }
      setBubbles(bubblesRef.current);
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  function popBubble(id: number) {
    if (poppedRef.current.has(id) || !bubblesRef.current.some((b) => b.id === id)) return;
    poppedRef.current.add(id);
    bubblesRef.current = bubblesRef.current.filter((b) => b.id !== id);
    setBubbles(bubblesRef.current);
    scoreRef.current += 1;
    comboRef.current += 1;
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setBestCombo((b) => Math.max(b, comboRef.current));
    setHop(true);
    setTimeout(() => setHop(false), 320);
  }

  const modeTitle = mode === "start" ? "내 마음 담기" : `${partnerName}의 마음에 답하기`;
  const modeSub =
    mode === "start"
      ? `점수만큼 마음이 담겨요 — ${partnerName}가 답하면 합산!`
      : "둘의 점수가 합쳐져 유대 보너스가 커져요";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-[#1c1526] p-4 ring-1 ring-white/12 shadow-[var(--shadow-lg)]">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-white">💞 함께 놀기 — {modeTitle}</p>
          {phase !== "play" && (
            <button onClick={onClose} aria-label="닫기" className="tap rounded-full px-2 py-1 text-xs text-white/50">
              ✕
            </button>
          )}
        </div>

        {phase === "intro" && (
          <div className="mt-3 text-center">
            <div className="mx-auto w-fit animate-floaty">
              <Art size={92} />
            </div>
            <p className="mt-2 text-sm font-bold text-white">
              {petName} 곁에 떠오르는 하트를 <span className="text-rose">15초 동안 탭!</span>
            </p>
            <p className="mt-1 text-[11px] text-white/55">{modeSub}</p>
            <p className="mt-0.5 text-[11px] text-white/45">놓치면 콤보가 끊겨요 — 콤보가 오르면 더 빨라져요</p>
            <button
              onClick={() => setPhase("play")}
              className="tap mt-3 w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
            >
              시작! 🎾
            </button>
          </div>
        )}

        {phase === "play" && (
          <div className="mt-3">
            {/* 타이머 + 점수 */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose transition-[width] duration-200 ease-linear"
                  style={{ width: `${(leftMs / PLAY_MS) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-extrabold text-white">
                {score}💗{combo >= 2 && <span className="ml-1 text-rose">x{combo}</span>}
              </span>
            </div>
            {/* 무대 */}
            <div className="relative mt-2 h-64 overflow-hidden rounded-xl bg-gradient-to-b from-[#241a30] to-[#150f18] ring-1 ring-white/10">
              <div
                className={`absolute bottom-2 left-1/2 -translate-x-1/2 transition-transform duration-150 ${hop ? "-translate-y-3" : ""}`}
              >
                <Art size={84} />
              </div>
              {bubbles.map((b) => (
                <button
                  key={b.id}
                  onPointerDown={() => popBubble(b.id)}
                  aria-label="하트 탭"
                  className="animate-pop absolute grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl ring-1 ring-white/20"
                  style={{ left: `${b.x}%`, top: `${b.y}%` }}
                >
                  {b.e}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-3 text-center">
            <div className="mx-auto w-fit animate-pop">
              <Art size={92} />
            </div>
            <p className="mt-2 text-lg font-extrabold text-white">
              {score}💗 <span className="text-sm font-bold text-white/60">(최고 콤보 x{bestCombo})</span>
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              {mode === "start"
                ? `${partnerName}가 답하면 점수가 합쳐져요!`
                : "둘의 점수를 합쳐 유대에 반영할게요!"}
            </p>
            <button
              onClick={() => onDone(score)}
              className="tap mt-3 w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
            >
              {mode === "start" ? "💌 마음 걸어두기" : "💞 유대에 반영하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
