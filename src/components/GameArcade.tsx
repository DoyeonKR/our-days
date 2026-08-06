"use client";

/* 게임 탭 — **우리 섬**과 **사냥** 두 개뿐인 허브.
 *
 * [사용자 요청 2026-08-06 "게임에서 우리 섬 말고는 다 삭제하고,
 *  저 무기로 몬스터를 사냥하는 키우기류 게임을 하나 만들자"]
 *
 * 지운 것: 아케이드 5종(반응·기억·연타·순서·타이밍) · 부루마블 · 테트리스(점수전/공격전) ·
 * 전체 순위판. 관련 엔진(game/boardgame/tetris)과 데이터 계층도 함께 지웠다 —
 * 컴포넌트만 떼고 엔진을 남기면 아무도 안 부르는 5,000 줄이 조용히 남는다.
 *
 * ⚠ DB 테이블(game_*, board_games)은 **건드리지 않았다**. 지우는 건 되돌릴 수 없고,
 *   남아 있어도 앱이 안 읽으면 비용이 0 이다. 정말 지울 거면 그건 따로 결정할 일이다.
 */

import { useEffect, useState } from "react";
import IslandGame from "@/components/IslandGame";
import HuntGame from "@/components/HuntGame";
import PetIcon from "@/components/island/PetIcon";
import { useGlobalPet } from "@/lib/petglobal";

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
  const [open, setOpen] = useState<"island" | "hunt" | null>(null);
  const pet = useGlobalPet();

  useEffect(() => {
    if (openIslandReq) setOpen("island");
  }, [openIslandReq]);

  if (!coupleId) {
    return (
      <div className="rounded-2xl bg-glass p-6 text-center ring-1 ring-line">
        <p className="text-sm font-bold text-ink">커플 연결 후에 열려요</p>
        <p className="mt-1 text-sm text-muted">홈에서 초대코드로 연결해 주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 우리 섬 — 메인 게임(히어로가 사는 곳) */}
      <button
        onClick={() => setOpen("island")}
        className="tap flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-sky-500/20 p-4 text-left ring-1 ring-white/15"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/25 ring-1 ring-white/15">
          {pet ? <PetIcon form={pet.form} size={48} face active={false} /> : <span className="text-3xl">🏝️</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            우리 섬 <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">MAIN</span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            {pet ? `${pet.name}${pet.mood} 가 기다리고 있어요 — 펫·정원·꾸미기` : "펫을 키우고 정원·섬을 가꿔요 🥚→🦊"}
          </span>
        </span>
      </button>

      {/* 사냥 — 방치형. 섬에서 산 무기가 그대로 공격력이 된다 */}
      <button
        onClick={() => setOpen("hunt")}
        className="tap flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 p-4 text-left ring-1 ring-white/15"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/25 text-3xl ring-1 ring-white/15">
          ⚔️
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            사냥 <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">방치형</span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            안 보고 있어도 알아서 싸워요 — 섬에서 산 무기가 곧 공격력
          </span>
        </span>
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
    </div>
  );
}
