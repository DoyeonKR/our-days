"use client";

import { useEffect, useRef, useState } from "react";
import type { TankView } from "@/lib/aqua3d/scene";
import { fishArtKey } from "@/lib/aquarium";
import { isFishModelApproved } from "@/lib/aqua3d/quality";

export default function Aquarium3D({ view, onFish, onDecor, onPlace }: { view: TankView;
  onFish: (id: number) => void; onDecor: (id: number) => void; onPlace: (x: number, y: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ view, onFish, onDecor, onPlace });
  const controller = useRef<ReturnType<typeof import("@/lib/aqua3d/scene").createTank> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pendingCount = view.aquarium.fish.filter(f => !isFishModelApproved(fishArtKey(f))).length;
  useEffect(() => { latest.current = { view, onFish, onDecor, onPlace }; controller.current?.update(view); }, [view, onFish, onDecor, onPlace]);
  useEffect(() => {
    let cancelled = false;
    const mount = host.current;
    if (!mount) return;
    void import("@/lib/aqua3d/scene").then(({ createTank }) => {
      if (cancelled) return;
      try {
        controller.current = createTank(mount, latest.current.view, {
          fish: id => latest.current.onFish(id), decor: id => latest.current.onDecor(id),
          place: (x,y) => latest.current.onPlace(x,y), error: msg => { if (!cancelled) setError(msg); },
        });
        setReady(true);
      } catch {
        setError("이 기기에서 3D 수조를 열지 못했어요. WebGL 2 지원과 하드웨어 가속 설정을 확인해 주세요.");
      }
    }).catch(() => { if (!cancelled) setError("3D 그래픽을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요."); });
    return () => { cancelled = true; controller.current?.dispose(); controller.current = null; };
  }, [attempt]);
  return <div className={`aqua-tank aqua-tank-3d ${view.editing ? "is-editing" : ""}`}>
    <div ref={host} className="aqua-webgl" />
    {!ready && !error && <p className="aqua-empty" role="status">입체 수조를 준비하고 있어요…</p>}
    {error && <div className="aqua-3d-error" role="alert"><p>{error}</p><button type="button" className="tap aqua-btn" onClick={() => { setError(null); setReady(false); setAttempt(n=>n+1); }}>다시 시도</button></div>}
    {ready && !error && view.aquarium.fish.length===0 && !view.editing && <p className="aqua-empty">낚시로 만난 물고기를<br/>입체 수조에서 키워 보세요</p>}
    {ready && !error && pendingCount > 0 && !view.editing && <div className="aqua-3d-quality-note" role="status">
      <strong>물고기 {pendingCount}마리 · 3D 모델 준비 중</strong>
      <span>원본과의 유사도 검수를 통과한 모델만 표시해요.<br/>보유 물고기는 그대로이며 아래 목록에서 확인할 수 있어요.</span>
    </div>}
    {view.editing && !error && <p className="aqua-hint">{view.placing ? "바닥을 눌러 장식을 놓아 주세요" : "장식을 눌러 선택하세요"}</p>}
    {!view.editing && ready && !error && <span className="aqua-3d-guide" aria-hidden>좌우로 드래그해 둘러보기</span>}
  </div>;
}
