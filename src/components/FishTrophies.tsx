"use client";
/** 어탁첩(2026-11-12) — 수집 탭의 한 칸. 크기 기록을 깬 물고기가 먹물 실루엣으로 모이고, 누르면 어탁 카드(공유 · 섬 벽에 걸기).
 *  [사용자: "크기 기록을 깬 물고기를 먹물로 찍어 낸 '어탁' 카드로 만들어 … 공유 카드로 내보냅니다(이름 · cm · 낚시터 · 날짜 · 잡은 사람)"]
 *  - 칸의 작은 그림은 캔버스가 아니라 물고기 그림을 CSS 로 까맣게 누른 것이다 — 120칸을 캔버스로 찍으면 폰이 멈춘다. 진짜 어탁(lib/gyotaku)은 열 때 한 장만.
 *  - 공유는 열 때 미리 만든 파일로, 누른 순간 바로 부른다(iOS 는 await 뒤의 공유를 거절한다 — lib/sharefile 머리말).
 *  - 섬에는 벽 · 게시판 화면이 없어서 '걸어 둔 어탁'은 이 칸 맨 위 줄이다(fishPlus.hung). */
import { useEffect, useMemo, useState } from "react";
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { FishArt } from "@/components/AquaArt";
import { readFishNick } from "@/components/FishRank";
import type { FishTabProps } from "@/components/FishCollect";
import { HUNG_MAX, hungOf, toggleHung, trophyView, type TrophyCard } from "@/lib/fishtrophy";
import { fmtCm } from "@/lib/fishingworld";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { nativePlatform } from "@/lib/nativeplatform";
import { shareFileInApp } from "@/lib/nativefile";
import { webShareOrDownload } from "@/lib/sharefile";

/** 한 칸 — 먹으로 누른 물고기 + 이름 · 길이 */
function TrophyTile({ t, onOpen, hung }: { t: TrophyCard; onOpen: () => void; hung: boolean }) {
  return (
    <li>
      <button type="button" className={`tap fish-trophy-tile ${hung ? "is-hung" : ""}`} onClick={onOpen} aria-label={`${t.name} ${fmtCm(t.cm)} 어탁 보기`}>
        <span className="fish-trophy-ink" aria-hidden><FishArt artKey={t.key} /></span>
        <b>{t.name}</b>
        <small>{fmtCm(t.cm)}{t.ratio >= 1.3 ? " · 대물" : ""}</small>
      </button>
    </li>
  );
}

/** 어탁 카드 — 결과 카드의 '어탁 만들기'도 같은 창을 연다. onToggleHung 이 없으면 걸기 버튼을 숨긴다(저장된 어탁이 아닐 때) */
export function TrophySheet({ card, hung, hungFull, busy, onToggleHung, onClose }: { card: TrophyCard; hung?: boolean; hungFull?: boolean; busy?: boolean; onToggleHung?: () => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const ref = useDialogFocus(true, onClose);
  useBackClose(() => onClose());

  useEffect(() => {
    let alive = true, made: string | null = null;
    void import("@/lib/gyotaku")
      .then(async ({ renderGyotaku, gyotakuFileName }) => {
        const blob = await renderGyotaku(card);
        if (!alive) return;
        if (!blob) { setFailed(true); return; }
        made = URL.createObjectURL(blob);
        setUrl(made);
        setFile(new File([blob], gyotakuFileName(card), { type: "image/png" }));
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [card]);

  /** ⚠ 브라우저 길은 첫 await 전에 공유를 부른다 — 파일은 열 때 만들어 두었다 */
  function share() {
    if (!file || sharing) return;
    setNote(null);
    setSharing(true);
    const run: Promise<"shared" | "saved" | "cancelled"> = nativePlatform()
      ? shareFileInApp(file, file.name, "어탁").then((ok) => (ok ? "shared" : webShareOrDownload(file, "어탁")))
      : webShareOrDownload(file, "어탁");
    void run
      .then((how) => { if (how === "saved") setNote("카드를 저장했어요"); })
      .catch(() => setNote("카드를 내보내지 못했어요. 다시 시도해 주세요."))
      .finally(() => setSharing(false));
  }

  return (
    <div className="fixed inset-0 fish-trophy-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="fish-trophy-sheet" role="dialog" aria-modal="true" aria-label={`${card.name} 어탁`}>
        <header>
          <strong>어탁</strong>
          <CloseButton onClose={onClose} />
        </header>
        <div className="fish-trophy-card">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${card.name} ${fmtCm(card.cm)} 어탁 카드`} />
          ) : (
            <p className="fish-trophy-wait" aria-live="polite">{failed ? "어탁을 찍지 못했어요" : "먹을 묻히는 중…"}</p>
          )}
        </div>
        {note && <p className="aqua-note" role="status">{note}</p>}
        <div className="fish-trophy-actions">
          <ActionButton main wide onClick={share} disabled={!file || sharing} data-dialog-initial>{sharing ? "내보내는 중…" : "공유하기"}</ActionButton>
          {onToggleHung && (
            <ActionButton wide on={hung} onClick={onToggleHung} disabled={busy || (!hung && hungFull)}>
              {hung ? "벽에서 내리기" : hungFull ? `벽이 가득 찼어요(${HUNG_MAX}장)` : "섬 벽에 걸기"}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FishTrophies(p: FishTabProps) {
  const [meName] = useState(readFishNick);
  const cards = useMemo(() => trophyView(p.st, p.who, meName, p.couple), [p.st, p.who, meName, p.couple]);
  const hung = useMemo(() => hungOf(p.st), [p.st]);
  // 연 카드는 그때의 한 장으로 붙잡는다 — 벽에 걸면 섬 상태가 바뀌어 목록이 새로 만들어지는데, 그때마다 어탁을 다시 찍지 않게
  const [shown, setOpen] = useState<TrophyCard | null>(null);
  const hungCards = hung.map((k) => cards.find((c) => c.key === k)).filter((c): c is TrophyCard => !!c);

  return (
    <section className="fish-trophies" aria-labelledby="fish-trophies-h">
      <h3 id="fish-trophies-h">어탁첩 <small>{cards.length}장</small></h3>
      {cards.length === 0 ? (
        <p className="aqua-note">물고기를 낚으면 그 모습의 가장 긴 한 마리가 먹물 그림으로 남아요.</p>
      ) : (
        <>
          {hungCards.length > 0 && (
            <>
              <p className="fish-trophy-kicker">걸어 둔 어탁</p>
              <ul className="fish-trophy-grid is-hung">
                {hungCards.map((t) => <TrophyTile key={t.key} t={t} hung onOpen={() => setOpen(t)} />)}
              </ul>
            </>
          )}
          <p className="fish-trophy-kicker">모든 어탁 · 모습마다 가장 긴 한 마리</p>
          <ul className="fish-trophy-grid">
            {cards.map((t) => <TrophyTile key={t.key} t={t} hung={hung.includes(t.key)} onOpen={() => setOpen(t)} />)}
          </ul>
        </>
      )}
      {shown && (
        <TrophySheet
          card={shown}
          hung={hung.includes(shown.key)}
          hungFull={hung.length >= HUNG_MAX}
          busy={p.busy}
          onToggleHung={() => { void p.act((s) => toggleHung(s, shown.key)); }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
