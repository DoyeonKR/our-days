"use client";

/* 진화 시네마틱 — 3.2초 5비트 (게임 최대의 한 방).
   타임라인(전부 CSS 딜레이, JS 타이머 없음):
     0.0s  배경 딤 + 옛 모습 차징(점점 세게 떨림)
     1.15s 화이트 플래시
     1.3s  갓레이(회전 광선) 페이드 인
     1.6s  새 모습 팝(등장) + 확장 링 ×3
     1.9s  별 12개 방사(3중 중첩 — 바깥 정적 각도 > 중간 방사 애니 > 안쪽 역회전)
     2.4s  이름 카드 + 닫기
   · 커밋(onStart)은 마운트 즉시 낙관적 발사 — 네트워크가 연출을 끊지 않는다.
   · 아무 곳이나 탭하면 스킵(최종 상태로 점프). prefers-reduced-motion 은 정적 카드.
   · 성능: transform/opacity 만, 파티클 12개 상한, 컨테이너에만 will-change. */

import { useEffect, useState } from "react";
import { petForm } from "@/lib/island";
import PetIcon from "@/components/island/PetIcon";

export default function EvoCinematic({
  fromForm,
  toForm,
  petName,
  onStart,
  onClose,
}: {
  fromForm: string;
  toForm: string;
  petName: string;
  onStart: () => void; // 진화 커밋(낙관적 — 마운트 즉시 1회)
  onClose: () => void;
}) {
  const [skip, setSkip] = useState(false);
  const [reduced] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // 연출 시작과 동시에 커밋(1회) — 실패 시 act 가 최신 재조회, pendingEvolve 로 재시도 가능
  useEffect(() => {
    onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tf = petForm(toForm);
  // 레지스트리 조회 — 같은 key 면 모듈 스코프 동일 참조(재마운트 없음). JSX 로만 렌더(useId 훅 순서).

  const finalOnly = skip || reduced; // 최종 상태로 점프(스킵/모션 최소화)

  return (
    <div
      className="fixed inset-0 z-[86] flex items-center justify-center overflow-hidden px-8"
      role="dialog"
      aria-modal="true"
      aria-label="진화"
      onClick={() => setSkip(true)}
    >
      {/* 딤 */}
      <div className={`absolute inset-0 bg-black/75 ${finalOnly ? "" : "animate-evo-dim"}`} />

      <div className="relative grid w-full max-w-sm place-items-center" style={{ willChange: "transform" }}>
        {!finalOnly && (
          <>
            {/* 1비트 — 옛 모습 차징(떨림은 전용 래퍼에만) */}
            <span className="animate-evo-charge absolute block">
              <PetIcon form={fromForm} size={96} active={false} />
            </span>
            {/* 빛 알갱이 흡수 — 바깥 정적 각도 / 안쪽 흡입 애니 */}
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="pointer-events-none absolute" style={{ transform: `rotate(${i * 36}deg)` }}>
                <span className="animate-evo-mote block h-2 w-2 rounded-full bg-amber-200/90" />
              </span>
            ))}
            {/* 2비트 — 플래시 */}
            <span
              className="animate-evo-flash pointer-events-none absolute h-48 w-48 rounded-full"
              style={{ background: "radial-gradient(circle,#fff 0%,#fff 40%,transparent 70%)" }}
            />
            {/* 3비트 — 갓레이(transform 애니 + opacity 애니를 서로 다른 속성으로 분리) */}
            <span
              className="animate-evo-rays pointer-events-none absolute h-72 w-72"
              style={{
                background: "repeating-conic-gradient(from 0deg, rgba(255,240,190,0.85) 0 4deg, transparent 4deg 12deg)",
                WebkitMaskImage: "radial-gradient(circle,#000 12%,transparent 62%)",
                maskImage: "radial-gradient(circle,#000 12%,transparent 62%)",
              }}
            />
            {/* 확장 링 ×3 */}
            {[0, 0.18, 0.36].map((d) => (
              <span
                key={d}
                className="animate-evo-ring pointer-events-none absolute h-24 w-24 rounded-full border-2 border-amber-200/90"
                style={{ animationDelay: `${1.65 + d}s` }}
              />
            ))}
            {/* 별 12개 — 바깥 정적 각도 > 중간 방사 애니 > 안쪽 역회전(이모지 안 기울게) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={`s${i}`} className="pointer-events-none absolute" style={{ transform: `rotate(${i * 30}deg)` }}>
                <span
                  className="animate-evo-burst block"
                  style={{ ["--d" as string]: `${64 + (i % 3) * 16}px`, animationDelay: `${1.9 + (i % 4) * 0.06}s` }}
                >
                  <span className="block text-base" style={{ transform: `rotate(${i * -30}deg)` }}>
                    {i % 3 === 0 ? "⭐" : i % 3 === 1 ? "✨" : "💫"}
                  </span>
                </span>
              </span>
            ))}
          </>
        )}

        {/* 4비트 — 새 모습 등장(스킵 시 즉시) */}
        <span className={finalOnly ? "block" : "animate-evo-emerge block"}>
          <PetIcon form={toForm} size={132} active={false} title={tf.name} />
        </span>

        {/* 5비트 — 이름 카드 + 닫기 */}
        <div className={`${finalOnly ? "" : "animate-evo-name"} mt-4 w-full text-center`}>
          <p className="text-xs text-white/60">진화!</p>
          <p className="mt-1 text-xl font-black text-white">
            {petName}, {tf.name}(으)로! 🎉
          </p>
          <p className="mt-1 text-[11px] text-white/55">정성껏 돌본 결과예요 ✨</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="tap mt-4 w-full rounded-xl bg-amber-300 py-3 text-sm font-extrabold text-ink"
          >
            좋아! 💛
          </button>
        </div>
      </div>
    </div>
  );
}
