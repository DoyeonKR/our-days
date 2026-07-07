"use client";

// 테트리스 룰북 — 버튼으로 열어 정독하는 상세 규칙(부루마블 RuleBook 과 동형).
// 상수(ULTRA_SECONDS 등)에서 실제 값을 인용해 규칙·코드 불일치를 방지한다.

import type { ReactNode } from "react";
import { ULTRA_SECONDS } from "@/lib/tetris";
import { DAILY_MATCHES, ROUNDS_PER_MATCH } from "@/lib/game";

const SECTIONS: { icon: string; title: string; body: ReactNode }[] = [
  {
    icon: "🎯",
    title: "게임 목표",
    body: (
      <>
        떨어지는 블록을 쌓아 <b className="text-white">가로 한 줄</b>을 빈틈없이 채우면 줄이
        지워져요. 블록이 천장까지 차면 패배!
      </>
    ),
  },
  {
    icon: "🎮",
    title: "모드 2가지",
    body: (
      <>
        <b className="text-white">🏆 점수 대결</b> — 다른 미니게임과 같은 룰: 하루 {DAILY_MATCHES}판,
        1판 = {ROUNDS_PER_MATCH}라운드({ULTRA_SECONDS / 60}분씩) 평균 점수로 승부. 둘이{" "}
        <b className="text-white">같은 블록 순서</b>를 받아 공정해요. 최고 기록은 순위판에 자동
        반영. <br />
        <b className="text-white">⚔️ 실시간 대결</b> — 둘 다 접속하면 <b className="text-white">무제한</b>!
        줄을 지워 상대를 공격하고, 먼저 가득 차면 패배.
      </>
    ),
  },
  {
    icon: "👆",
    title: "조작법 (터치)",
    body: (
      <>
        보드를 <b className="text-white">좌우로 드래그</b> = 블록 이동 · <b className="text-white">탭</b> = 회전 ·{" "}
        <b className="text-white">아래로 드래그</b> = 천천히 내리기 · <b className="text-white">아래로 빠르게 플릭</b> = 즉시
        떨어뜨리기. 하단 버튼(◀ ▶ ⟲ ⟳ ⤓)으로도 조작할 수 있어요. 키보드는 ←→↓, ↑/X(회전),
        Z(반대 회전), 스페이스(하드드롭), C(홀드).
      </>
    ),
  },
  {
    icon: "📦",
    title: "홀드 · 다음 블록",
    body: (
      <>
        왼쪽 위 <b className="text-white">홀드 박스를 탭</b>하면 지금 블록을 보관하고 바꿔요(블록당 1회).
        오른쪽엔 <b className="text-white">다음 블록 3개</b>가 미리 보여요. 반투명 블록은{" "}
        <b className="text-white">고스트</b> — 지금 떨어뜨리면 닿을 자리예요.
      </>
    ),
  },
  {
    icon: "💥",
    title: "공격 (실시간 대결)",
    body: (
      <>
        한 번에 여러 줄을 지우면 상대 바닥에 <b className="text-white">쓰레기 줄</b>이 올라가요:{" "}
        <b className="text-white">2줄=1 · 3줄=2 · 4줄(테트리스)=4</b>. T-스핀 더블은 4, 연속
        테트리스(B2B)는 +1, 콤보가 이어지면 추가 보너스, 퍼펙트 클리어는 +6!
      </>
    ),
  },
  {
    icon: "🛡️",
    title: "상쇄(캔슬)",
    body: (
      <>
        공격이 날아오는 중(보드 왼쪽 <b className="text-white">빨간 게이지</b>)에 나도 줄을 지우면{" "}
        <b className="text-white">서로 상쇄</b>돼요. 위기일수록 침착하게 줄을 지우는 게 방어!
      </>
    ),
  },
  {
    icon: "🧱",
    title: "쓰레기 줄",
    body: (
      <>
        상대 공격은 내 블록이 <b className="text-white">다음에 놓일 때</b> 바닥에서 올라와요. 구멍이{" "}
        <b className="text-white">한 칸</b>씩 뚫려 있으니 그 열을 채워 되지우면 반격 기회!
      </>
    ),
  },
  {
    icon: "🔥",
    title: "B2B · 콤보",
    body: (
      <>
        <b className="text-white">B2B(백투백)</b>: 테트리스/T-스핀을 연달아 하면 점수 ×1.5 + 공격 +1.{" "}
        <b className="text-white">콤보</b>: 블록을 놓을 때마다 연속으로 줄을 지우면 점수·공격이 더 붙어요.
      </>
    ),
  },
  {
    icon: "🌀",
    title: "T-스핀",
    body: (
      <>
        T 블록을 <b className="text-white">회전으로 틈에 끼워 넣고</b> 줄을 지우면 T-스핀! 일반
        클리어보다 점수·공격이 훨씬 커요(더블 기준 공격 4 — 테트리스급).
      </>
    ),
  },
  {
    icon: "✨",
    title: "퍼펙트 클리어",
    body: (
      <>
        줄을 지워 보드를 <b className="text-white">완전히 비우면</b> 보너스 +2000점(레벨 배수) + 공격 +6.
        초반에 노려볼 만한 대박!
      </>
    ),
  },
  {
    icon: "⏱️",
    title: "속도 · 레벨",
    body: (
      <>
        10줄 지울 때마다 레벨이 올라 블록이 <b className="text-white">점점 빨리</b> 떨어져요. 바닥에 닿아도
        잠깐의 <b className="text-white">여유(락 딜레이)</b>가 있어 밀어 넣기가 가능해요.
      </>
    ),
  },
  {
    icon: "🏆",
    title: "승패 판정",
    body: (
      <>
        <b className="text-white">점수 대결</b>: {ROUNDS_PER_MATCH}라운드 평균 점수가 높은 쪽 승(동점 무승부).{" "}
        <b className="text-white">실시간 대결</b>: 상대 보드가 먼저 가득 차면 승리! 동시에 끝나면 점수
        비교, 그래도 같으면 무승부. 전적은 테트리스 입장 화면에 쌓여요.
      </>
    ),
  },
];

export default function TetrisRuleBook({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#140e18] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="테트리스 룰북"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <h3 className="text-lg font-black">📖 테트리스 룰북</h3>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="tap grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg text-white/80"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <ol className="space-y-3">
          {SECTIONS.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{s.icon}</span>
                <h4 className="text-[15px] font-extrabold text-white">
                  <span className="text-white/40">{i + 1}. </span>
                  {s.title}
                </h4>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{s.body}</p>
            </li>
          ))}
        </ol>
        <button
          onClick={onClose}
          className="tap mt-5 w-full rounded-2xl bg-white/15 py-3.5 text-sm font-bold text-white"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
