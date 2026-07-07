"use client";

import { useEffect } from "react";
import { OVERLAY_SELECTOR, lockBodyScroll } from "@/lib/scrollLock";

/**
 * 전역 스크롤 락 매니저 — 앱 루트에 1회 마운트.
 *
 * DOM 에 풀스크린 오버레이(모달/시트/게임뷰 = `fixed inset-0`, 장식성 pointer-events-none
 * 제외)가 하나라도 있으면 body 스크롤을 잠근다 → 앞 뷰가 떠 있을 때 뒤 페이지가
 * 스와이프/스크롤로 움직이는 블리드를 막는다.
 *
 * 왜 컴포넌트마다 훅을 안 심고 여기서 감지하나:
 * - 오버레이가 13개 컴포넌트에 20+개, 일부는 중첩 서브컴포넌트라 개별 배선은 오배선 위험.
 * - 전 오버레이가 `fixed inset-0` 관용을 100% 지키므로 DOM 감지가 단일·견고하고,
 *   앞으로 추가되는 오버레이도 자동 적용된다.
 * - 중첩(시트 위 다이얼로그)은 참조카운트 primitive(lockBodyScroll)가 처리.
 *
 * childList(subtree) 만 관찰: 오버레이는 조건부 mount/unmount 로 뜨고 지므로 노드 추가/삭제로
 * 잡힌다. 텍스트/속성 변경(게임 타이머 등 빈번)엔 반응 안 해 가볍다.
 */
export default function ScrollLockManager() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    let release: (() => void) | null = null;

    const sync = () => {
      const hasOverlay = document.querySelector(OVERLAY_SELECTOR) !== null;
      if (hasOverlay && !release) {
        release = lockBodyScroll();
      } else if (!hasOverlay && release) {
        release();
        release = null;
      }
    };

    // 추가/삭제된 노드(또는 그 서브트리)에 오버레이가 있을 때만 재평가.
    const touchesOverlay = (nodes: NodeList): boolean => {
      for (const n of Array.from(nodes)) {
        if (n.nodeType !== 1) continue; // 요소만
        const el = n as Element;
        if (el.matches?.(OVERLAY_SELECTOR) || el.querySelector?.(OVERLAY_SELECTOR)) {
          return true;
        }
      }
      return false;
    };

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (touchesOverlay(r.addedNodes) || touchesOverlay(r.removedNodes)) {
          sync();
          return;
        }
      }
    });

    sync(); // 초기 상태(마운트 시 이미 열린 오버레이 대응)
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      if (release) {
        release();
        release = null;
      }
    };
  }, []);

  return null;
}
