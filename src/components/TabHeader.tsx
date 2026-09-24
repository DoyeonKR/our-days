"use client";

/* 탭 머리글 — 기록 · 계획 · 함께 · 게임이 **같은 틀**을 쓴다. [2026-09-24 전 영역 UI 개편]
 *
 * 예전엔 탭마다 제각각이었다 — 기록·계획은 작은 머리말 한 줄, 함께는 큰 제목, 게임은 카드 속
 * "오늘 뭐 할까?". 탭을 옮길 때마다 제목 자리·크기가 바뀌어 같은 앱의 화면으로 안 읽혔다.
 * 지금은 [도트 엠블럼] [머리말 · 제목 · 한 줄 설명] [오른쪽 버튼] 한 가지다.
 *
 * ⚠ 제목 요소: 기록·계획은 하위 화면(일기장·캘린더 …)마다 sr-only h1 이 이미 있다(heading.test —
 *   뷰마다 h1 하나). 그 탭에선 titleAs="p" 로 넘겨 h1 이 두 개가 되지 않게 한다.
 * ⚠ page-bed — 대표사진 wash 위에 글씨가 앉을 바닥(globals.css 설명). 머리글은 카드 밖이라 필요하다.
 * ⚠ 엠블럼은 24×24 도트를 **정확히 2배**(48px)로 찍는다 — 정수배가 아니면 도트가 뭉갠다.
 */

import type { ReactNode } from "react";
import { EmblemIcon } from "@/components/PixelGlyph";

export default function TabHeader({
  emblem,
  eyebrow,
  title,
  sub,
  action,
  titleAs = "h1",
}: {
  /** pixelui 의 EMBLEM_ICONS 키 — records · plan · together · game */
  emblem: string;
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  titleAs?: "h1" | "p";
}) {
  const Title = titleAs;
  return (
    <header className="tab-header page-bed">
      <span className="tab-header-emblem" aria-hidden>
        <EmblemIcon k={emblem} size={48} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <Title className="tab-header-title">{title}</Title>
        {sub && <p className="tab-header-sub">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
