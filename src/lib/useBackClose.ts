"use client";

/* 뒤로 가기 = 맨 위 창 닫기 (2026-11-03) — 게임 창은 라우트가 아니라서 안드로이드 뒤로 버튼 · 아이폰 쓸어 넘기기가 창을 지나쳐 페이지를 떠났다.
 * 창이 열려 있는 만큼 방문 기록을 쌓아 두고, 뒤로 가면 맨 위 창만 닫는다. 창이 겹치면(낚시 → 수조 → 시트) 위에서부터 하나씩.
 * close 가 false 를 돌려주면 안 닫힌 것(확인창을 띄웠다) — 기록을 다시 쌓는다.
 * ⚠ 기록은 창마다 바로 쌓거나 걷지 않고 한 박자 뒤에 맞춘다(sync). history.back() 은 비동기라, 낚시 → 섬처럼 한 번에 닫고 열면
 *   push 와 엉켜 기록이 한 칸 모자라게 남고, 그다음 뒤로 가기가 앱을 떠났다(실측). */
import { useEffect, useRef } from "react";

type Entry = { close: () => boolean | void };
const stack: Entry[] = [];
let depth = 0;
let ignorePops = 0;
let bound = false;
let queued = false;

const pushOne = () => {
  depth++;
  window.history.pushState({ ...window.history.state, gameLayer: depth }, "");
};

function sync() {
  queued = false;
  while (depth < stack.length) pushOne();
  if (depth > stack.length) {
    ignorePops++;
    window.history.go(stack.length - depth);
    depth = stack.length;
  }
}
function queueSync() {
  if (queued) return;
  queued = true;
  window.setTimeout(sync, 0);
}

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  if (depth > 0) depth--;
  const top = stack.pop();
  if (!top) return;
  if (top.close() === false) {
    stack.push(top);
    pushOne();
  }
}

export function useBackClose(close: () => boolean | void, active = true) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!active) return;
    if (!bound) {
      window.addEventListener("popstate", onPop);
      bound = true;
    }
    const entry: Entry = { close: () => latest.current() };
    stack.push(entry);
    queueSync();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      queueSync();
    };
  }, [active]);
}
