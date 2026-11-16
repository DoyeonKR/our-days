"use client";

/* 수조 사진 모드(2026-11-13) — 3D 수조 위에 펼치는 사진 도구. 수조(scene.ts)의 photo* 를 부르고, 찍은 장면에 테 · 글 · 이름표를 얹어 공유 카드로 만든다.
 * - 공유: iOS 사파리는 navigator.share 를 탭 안에서만 받는다(sharefile.ts) — 그래서 찍기(탭 1)에서 카드를 다 만들어 두고, 공유(탭 2)는 첫 await 전에 부른다.
 *   앱(Capacitor)은 nativefile 의 공유 시트, 공유가 안 되는 브라우저는 내려받기.
 * - 수조가 다시 지어지면(연결 끊김 · 다시 시도) 사진 모드는 끝난다(Aquarium3D) — 이미 찍은 카드는 남아서 공유할 수 있다. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton, CloseButton } from "@/components/AppButtons";
import type { TankHandle } from "@/lib/aqua3d/scene";
import { PHOTO_BOUNDS, PHOTO_FILTERS, photoCaption, photoCardLayout, photoFileName, placeLabels, type PhotoFilterId, type PhotoView, type PlacedLabel } from "@/lib/aqua3d/photo";
import { kstDate } from "@/lib/kst";
import { nativePlatform } from "@/lib/nativeplatform";
import { shareFileInAppResult } from "@/lib/nativefile";
import { webShareOrDownload } from "@/lib/sharefile";

/** 이름표 글자 크기(CSS px) — 카드에선 찍은 배율만큼 키운다 */
const LABEL_FONT = 12;
const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

type Shot = { file: File; url: string };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 이름표 상자를 그린다 — 화면 미리보기와 같은 자리(placeLabels), 크기만 배율대로 */
function drawLabels(ctx: CanvasRenderingContext2D, labels: readonly PlacedLabel[], font: number, ox: number, oy: number) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `700 ${font}px ${FONT}`;
  for (const l of labels) {
    ctx.fillStyle = "rgba(3, 38, 51, 0.74)";
    roundRect(ctx, ox + l.x, oy + l.y, l.w, l.h, l.h / 2);
    ctx.fill();
    ctx.fillStyle = "#eaf7f6";
    ctx.fillText(l.text, ox + l.x + l.w / 2, oy + l.y + l.h / 2);
  }
}

/** 찍은 장면 → 공유 카드(JPEG). 크림색 테 · 아래 글 두 줄(우리 수조 · 날짜와 이름) */
async function composeCard(photo: HTMLCanvasElement, labels: readonly PlacedLabel[], labelFont: number, caption: { title: string; sub: string }): Promise<Blob | null> {
  const L = photoCardLayout(photo.width, photo.height);
  const card = document.createElement("canvas");
  card.width = L.width;
  card.height = L.height;
  const ctx = card.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f6f2ea";
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.save();
  roundRect(ctx, L.photo.x, L.photo.y, L.photo.w, L.photo.h, L.radius);
  ctx.clip();
  ctx.drawImage(photo, L.photo.x, L.photo.y, L.photo.w, L.photo.h);
  if (labels.length) drawLabels(ctx, labels, labelFont, L.photo.x, L.photo.y);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1f3a40";
  ctx.font = `800 ${L.title.size}px ${FONT}`;
  ctx.fillText(caption.title, L.title.x, L.title.y);
  if (caption.sub) {
    ctx.fillStyle = "#5a6f72";
    ctx.font = `600 ${L.sub.size}px ${FONT}`;
    ctx.fillText(caption.sub, L.sub.x, L.sub.y);
  }
  return new Promise((resolve) => card.toBlob((b) => resolve(b), "image/jpeg", 0.92));
}

export default function AquaPhoto({ tank, host, view, fishNames, people, subscribe, onExit, dead = false, onShot }: {
  tank: TankHandle;
  /** 수조 칸(캔버스를 감싼 상자) — 이름표 자리를 CSS 픽셀로 잰다 */
  host: HTMLElement | null;
  view: PhotoView;
  /** 물고기 id → 이름(aquarium.fishName) */
  fishNames: ReadonlyMap<number, string>;
  /** 카드에 적을 두 사람 이름(없거나 하나여도 된다) */
  people: readonly string[];
  /** 끌기 · 집기로 카메라가 바뀔 때 부른다 — 확대 막대 · 이름표를 맞춘다 */
  subscribe: (fn: () => void) => () => void;
  onExit: () => void;
  /** 수조가 다시 지어져 이 사진 도구의 수조가 사라졌다 — 찍은 카드만 남는다(다시 찍기 = 사진 모드 끝) */
  dead?: boolean;
  /** 찍은 카드가 있는지 — 수조가 다시 지어져도 카드를 남길지 화면이 정한다 */
  onShot?: (has: boolean) => void;
}) {
  const [filter, setFilter] = useState<PhotoFilterId>("none");
  const [names, setNames] = useState(false);
  const [zoom, setZoom] = useState(() => tank.photoCamera().zoom);
  const [labels, setLabels] = useState<PlacedLabel[]>([]);
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const frame = useRef(0);
  const [zMin, zMax] = PHOTO_BOUNDS[view].zoom;

  const measure = useCallback(() => {
    if (!names || !host) { setLabels([]); return; }
    const r = host.getBoundingClientRect();
    const pts = tank.photoPoints().map((p) => ({ id: p.id, x: p.x * r.width, y: p.y * r.height, depth: p.depth, text: fishNames.get(p.id) ?? "" }));
    setLabels(placeLabels(pts, r.width, r.height, { font: LABEL_FONT }));
  }, [names, host, tank, fishNames]);

  // 끌기 · 집기 — 한 프레임에 한 번만 다시 잰다
  useEffect(() => subscribe(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; setZoom(tank.photoCamera().zoom); measure(); });
  }), [subscribe, tank, measure]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => { measure(); }, [measure]);
  useEffect(() => { tank.photoFilter(filter); }, [tank, filter]);
  // 찍은 카드 주소는 다시 찍거나 닫을 때 놓는다
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  useEffect(() => { onShot?.(!!shot); }, [shot, onShot]);

  const setZoomTo = (z: number) => { const c = tank.photoCamera({ zoom: z }); setZoom(c.zoom); measure(); };

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = host?.getBoundingClientRect();
      const photo = tank.photoCapture();
      if (!photo || !r?.width) { setNote("사진을 찍지 못했어요. 한 번 더 눌러 주세요."); return; }
      // 이름표 — 화면에서 본 자리 그대로, 찍은 배율만큼 크게
      const k = photo.width / r.width;
      const cardLabels = names
        ? placeLabels(tank.photoPoints().map((p) => ({ id: p.id, x: p.x * photo.width, y: p.y * photo.height, depth: p.depth, text: fishNames.get(p.id) ?? "" })), photo.width, photo.height, { font: Math.round(LABEL_FONT * k) })
        : [];
      const blob = await composeCard(photo, cardLabels, Math.round(LABEL_FONT * k), photoCaption(kstDate(Date.now()), people));
      if (!blob) { setNote("사진을 만들지 못했어요. 한 번 더 눌러 주세요."); return; }
      const name = photoFileName(Date.now());
      setShot({ file: new File([blob], name, { type: "image/jpeg" }), url: URL.createObjectURL(blob) });
    } finally {
      setBusy(false);
    }
  };

  // ⚠ 공유는 이 탭 안에서 바로 — 앞에 await 를 두지 않는다(iOS 사파리가 거절한다)
  const share = () => {
    if (!shot) return;
    const done = (how: string) => setNote(how === "saved" ? "사진을 내려받았어요" : how === "cancelled" ? null : "공유했어요");
    if (nativePlatform()) {
      void shareFileInAppResult(shot.file, shot.file.name, "우리 수조").then(done, () => setNote("공유하지 못했어요. 다시 해 주세요."));
      return;
    }
    void webShareOrDownload(shot.file, "우리 수조").then(done);
  };
  const retake = () => { if (dead) { onExit(); return; } setShot(null); setNote(null); };

  const zoomPct = useMemo(() => Math.round(((zMax - zoom) / (zMax - zMin)) * 100), [zoom, zMin, zMax]);

  return <div className="aqua-photo" role="group" aria-label="수조 사진 모드">
    <CloseButton onClose={onExit} label="닫기" ariaLabel="사진 모드 끝내기" className="aqua-photo-exit" />
    {names && !shot && <div className="aqua-photo-labels" aria-hidden>
      {labels.map((l) => <span key={l.id} className="aqua-photo-label" style={{ left: l.x, top: l.y, width: l.w, height: l.h }}>{l.text}</span>)}
    </div>}
    {!shot && <p className="aqua-photo-guide" aria-hidden>{view === "dome" ? "끌어서 둘러보고 두 손가락으로 확대해요" : "끌어서 돌리고 두 손가락으로 확대해요"}</p>}
    {note && <p className="aqua-photo-note" role="status">{note}</p>}
    {shot ? (
      <div className="aqua-photo-preview">
        {/* eslint-disable-next-line @next/next/no-img-element -- 방금 만든 카드(blob 주소) */}
        <img src={shot.url} alt="찍은 수조 사진 카드" />
        <div className="aqua-photo-row">
          <ActionButton onClick={retake}>다시 찍기</ActionButton>
          <ActionButton main onClick={share}>공유하기</ActionButton>
        </div>
      </div>
    ) : (
      <div className="aqua-photo-panel">
        <div className="aqua-photo-filters" role="radiogroup" aria-label="필터">
          {PHOTO_FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`tap aqua-photo-chip ${filter === f.id ? "is-on" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <label className="aqua-photo-zoom">
          <span>확대</span>
          <input type="range" min={0} max={100} step={1} value={zoomPct} aria-valuetext={`${zoomPct}%`}
            onChange={(e) => setZoomTo(zMax - (Number(e.target.value) / 100) * (zMax - zMin))} />
        </label>
        <div className="aqua-photo-row">
          <ActionButton on={names} aria-pressed={names} onClick={() => setNames((v) => !v)}>이름표</ActionButton>
          <ActionButton main disabled={busy} onClick={() => { void capture(); }}>{busy ? "찍는 중…" : "찍기"}</ActionButton>
        </div>
      </div>
    )}
  </div>;
}
