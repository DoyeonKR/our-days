"use client";
/* 모험 › 팀 › 보관한 기록 — 다른 기기의 저장에 밀린 이 기기 진행(최근 셋)을 보고 하나를 되살린다. README §14.6 '대전 · 저장 다듬기'
 * 예전엔 백업이 한 벌이라 다음 충돌에 덮였고, 화면 어디에도 되살릴 길이 없었다(알림 한 줄뿐). */
import { useState } from "react";
import type { AdvSave } from "@/lib/adventure";
import * as advStore from "@/lib/adventurestore";
import type { BackupMeta, Stored } from "@/lib/adventurestore";
import { confirmDialog } from "@/lib/confirm";

const { listBackups, restoreBackup } = advStore;

const when = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "때를 모름" : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function SaveBackups({ uid, save, flash, onRestored }: {
  uid: string;
  save: AdvSave;
  flash: (s: string) => void;
  onRestored: (r: Stored) => void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<BackupMeta[]>(() => listBackups(uid));
  const [busy, setBusy] = useState(false);

  async function restore(i: number, b: BackupMeta) {
    const ok = await confirmDialog({
      message: `${when(b.at)}에 보관한 기록(최고 Lv.${b.level} · 골드 ${b.gold.toLocaleString()} · 도감 ${b.dex}종)으로 되돌릴까요? 지금 진행은 보관한 기록에 남겨 둬요.`,
      confirmText: "되살리기",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await restoreBackup(uid, i, save);
      onRestored(r);
      setList(listBackups(uid));
      flash("보관한 기록을 되살렸어요");
    } catch {
      flash("되살리지 못했어요 — 연결을 확인해 주세요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adv-card mt-3">
      <button type="button" className="tap adv-chip" aria-expanded={open} onClick={() => { setList(listBackups(uid)); setOpen((o) => !o); }}>
        보관한 기록{list.length ? ` ${list.length}개` : ""} {open ? "접기" : "보기"}
      </button>
      {open && (
        <div className="mt-2 grid gap-1.5">
          <p className="text-[12px] text-muted">{list.length ? "다른 기기의 저장에 밀린 이 기기의 진행이에요. 최근 셋까지 남아요." : "아직 없어요. 다른 기기의 저장에 이 기기 진행이 밀리면 여기 남아요."}</p>
          {list.map((b, i) => (
            <div key={`${b.at}-${i}`} className="adv-mission">
              <span>{when(b.at)}<small>최고 Lv.{b.level} · 골드 {b.gold.toLocaleString()} · 도감 {b.dex}종</small></span>
              <button type="button" className="tap adv-chip" disabled={busy} onClick={() => void restore(i, b)}>되살리기</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
