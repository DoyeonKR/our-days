"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/AppButtons";
import type { TankHandle, TankView } from "@/lib/aqua3d/scene";
import { fishArtKey } from "@/lib/aquarium";
import { isFishModelApproved } from "@/lib/aqua3d/quality";
import { DOME_TIER, TUNNEL_TIER } from "@/lib/aqua3d/tiers";
import { useBackClose } from "@/lib/useBackClose";

/** 연결이 끊긴 뒤 저절로 다시 여는 횟수 — 넘으면 '다시 시도' 화면 */
const AUTO_RECOVER = 3;

/** feedSignal: 먹이를 줄 때마다 바뀌는 값(횟수 · 시각). 바뀌면 수조의 feed 를 부른다(feedX = 수조 가로 위치, 없으면 가운데) */
const MEAL_SEEN_KEY = "ourdays:aqua:mealSeen";

export default function Aquarium3D({ view: given, onFish, onDecor, onPlace, feedSignal, feedX }: { view: TankView;
  onFish: (id: number) => void; onDecor: (id: number) => void; onPlace: (x: number, y: number) => void;
  feedSignal?: number; feedX?: number;
}) {
  // 10단계(터널) · 11단계(돔)는 안에서 보는 것이 기본 — '밖에서 보기'로 바꿀 수 있다(꾸미는 동안은 밖). 기준값은 tunnel.ts 한곳
  const [outside, setOutside] = useState(false);
  const canTunnel = given.aquarium.tank >= TUNNEL_TIER && !given.editing;
  const inside = given.aquarium.tank >= DOME_TIER ? "돔 안으로" : "터널 안으로";
  // 이 기기에서 이미 본 사냥 장면(lib/predation · scene.ts) — 다시 열어도 같은 장면을 또 그리지 않게
  const [mealSeen] = useState(() => { try { return Number(localStorage.getItem(MEAL_SEEN_KEY)) || 0; } catch { return 0; } });
  const view = useMemo(() => ({ ...given, tunnel: canTunnel && !outside, mealSeen }), [given, canTunnel, outside, mealSeen]);
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ view, onFish, onDecor, onPlace });
  const controller = useRef<TankHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // 전체 보기 — 아이폰 사파리엔 요소 전체 화면이 없어서 화면 위에 펼치는 방식이 기본이고, 되는 브라우저는 진짜 전체 화면까지 쓴다
  const [full, setFull] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  // 끊긴 뒤 저절로 다시 연 횟수 — 수조를 새로 열면(다시 시도) 0
  const recovered = useRef(0);
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = () => {
    const next = !full;
    setFull(next);
    if (next) void shell.current?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  useBackClose(() => { if (full) toggleFull(); }, full);
  const pendingCount = view.aquarium.fish.filter(f => !isFishModelApproved(fishArtKey(f))).length;
  useEffect(() => { latest.current = { view, onFish, onDecor, onPlace }; controller.current?.update(view); }, [view, onFish, onDecor, onPlace]);
  // 처음 붙을 때의 값은 '방금 준 먹이'가 아니다 — 탭을 오가며 다시 붙을 때마다 물고기가 수면으로 몰리지 않게 바뀐 때만 부른다
  const fedSeen = useRef(feedSignal);
  useEffect(() => {
    if (feedSignal === undefined || feedSignal === fedSeen.current) return;
    fedSeen.current = feedSignal;
    controller.current?.feed(feedX);
  }, [feedSignal, feedX]);
  useEffect(() => {
    let cancelled = false, lostAt = 0, timer = 0;
    const mount = host.current;
    if (!mount) return;
    // 연결이 끊겼다(아이폰은 앱을 내렸다 올리면 자주) — 화면이 다시 보이고 브라우저가 되돌려 주지 않으면 새로 연다
    const recover = () => {
      if (cancelled || !lostAt || document.hidden) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (cancelled || !lostAt || document.hidden) return;
        if (recovered.current >= AUTO_RECOVER) { setError("3D 그래픽 연결이 끊어졌어요. 다시 열어 주세요."); return; }
        recovered.current++; setReady(false); setAttempt(n => n + 1);
      }, 1500);
    };
    document.addEventListener("visibilitychange", recover);
    void import("@/lib/aqua3d/scene").then(({ createTank }) => {
      if (cancelled) return;
      try {
        controller.current = createTank(mount, latest.current.view, {
          fish: id => latest.current.onFish(id), decor: id => latest.current.onDecor(id),
          place: (x,y) => latest.current.onPlace(x,y), error: msg => { if (!cancelled) setError(msg); },
          ready: () => { if (!cancelled) setReady(true); },
          lost: () => { lostAt = Date.now(); recover(); },
          restored: () => { lostAt = 0; window.clearTimeout(timer); },
          meal: (n) => { try { localStorage.setItem(MEAL_SEEN_KEY, String(n)); } catch { /* 이번만 */ } },
        });
      } catch {
        setError("이 기기에서 3D 수조를 열지 못했어요. WebGL 2 지원과 하드웨어 가속 설정을 확인해 주세요.");
      }
    }).catch(() => { if (!cancelled) setError("3D 그래픽을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요."); });
    return () => { cancelled = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", recover); controller.current?.dispose(); controller.current = null; };
  }, [attempt]);
  return <div ref={shell} className={`aqua-tank aqua-tank-3d ${view.editing ? "is-editing" : ""} ${full ? "is-full" : ""}`}>
    <div ref={host} className="aqua-webgl" />
    <CloseButton onClose={toggleFull} label={full ? "닫기" : "전체 보기"} className="aqua-full-btn" />
    {canTunnel && ready && !error && <CloseButton onClose={() => setOutside((o) => !o)} label={outside ? inside : "밖에서 보기"} className="aqua-tunnel-btn" />}
    {!ready && !error && <p className="aqua-empty" role="status">입체 수조를 준비하고 있어요…</p>}
    {error && <div className="aqua-3d-error" role="alert"><p>{error}</p><button type="button" className="tap aqua-btn" onClick={() => { recovered.current = 0; setError(null); setReady(false); setAttempt(n=>n+1); }}>다시 시도</button></div>}
    {ready && !error && view.aquarium.fish.length===0 && !view.editing && <p className="aqua-empty">낚시로 만난 물고기를<br/>입체 수조에서 키워 보세요</p>}
    {ready && !error && pendingCount > 0 && !view.editing && <div className="aqua-3d-quality-note" role="status">
      <strong>물고기 {pendingCount}마리 · 3D 모델 준비 중</strong>
      <span>원본과의 유사도 검수를 통과한 모델만 표시해요.<br/>보유 물고기는 그대로이며 아래 목록에서 확인할 수 있어요.</span>
    </div>}
    {view.editing && !error && <p className="aqua-hint">{view.preview ? "미리보기 · 아래에서 회전·크기를 조절하고 확정하세요" : view.placing ? "바닥을 눌러 장식을 미리 놓아 보세요" : "장식을 눌러 선택하세요"}</p>}
    {!view.editing && ready && !error && <span className="aqua-3d-guide" aria-hidden>{view.tunnel ? (given.aquarium.tank >= DOME_TIER ? "끌어서 한 바퀴 둘러보기 · 물고기를 누르면 그쪽을 봐요" : "끌어서 둘러보기 · 물고기를 누르면 올려다봐요") : "좌우로 드래그해 둘러보기"}</span>}
  </div>;
}
