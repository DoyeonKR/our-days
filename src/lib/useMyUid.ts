"use client";

// 표시 정체성 = 저장 정체성 보장 훅. [2026-07-28]
// page.tsx 가 내려주는 uid(getAuthInfo)는 최초 fetch 가 실패하면(catch(() => {}) + 재시도
// 없음 — 모바일 네트워크 흔들림) **영구 null** 이 된다. 그 상태로 내/상대 귀속을 하면
// ownerSplit 회귀(상대 오귀속)가 재발하므로, prop 이 비어 있으면 저장 경로(setMyMood 등)가
// 쓰는 것과 **같은** ensureAnonAuth 로 uid 를 직접 복구한다.

import { useEffect, useState } from "react";
import { ensureAnonAuth } from "@/lib/couple";

export function useMyUid(propUid: string | null): string | null {
  const [uid, setUid] = useState(propUid);
  useEffect(() => {
    if (propUid) {
      setUid(propUid);
      return;
    }
    let cancelled = false;
    ensureAnonAuth()
      .then((u) => {
        if (!cancelled && u) setUid(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [propUid]);
  return uid;
}
