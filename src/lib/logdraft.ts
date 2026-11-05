/* 3초 로그 임시 보관함(IndexedDB) [2026-11-06]
 *
 * 오프라인이거나 업로드가 실패한 채 촬영기를 닫으면 찍은 영상(blob)이 메모리와 함께 사라졌다.
 * 올리기를 누른 순간 이 기기에 한 편 넣어 두고, 저장에 성공하면 지운다 — 앱이 꺼져도 남는다.
 * 다시 올리는 쪽(TodayLog)은 `online` 이벤트와 화면을 열 때 슬롯 유예(서버 RLS 의 5분)를 보고:
 * 아직 그 슬롯이면 저절로 올리고, 지났으면 사용자에게 알려 '기기에 저장' 또는 '지우기'를 고르게 한다.
 * 슬롯 하나에 한 편(키 = 커플:날짜:슬롯) — 같은 슬롯을 다시 찍어 실패하면 새 것으로 바뀐다.
 * IndexedDB 가 없는 환경(사생활 보호 창 등)에선 조용히 아무것도 안 한다. */
import type { LogSlot } from "./logslot.ts";
import { nativePlatform } from "./nativeplatform.ts";
import { shareFileInApp } from "./nativefile.ts";

export type LogDraft = {
  key: string;
  coupleId: string;
  dateIso: string;
  slot: LogSlot;
  capturedAt: string;
  blob: Blob;
  mime: string;
  poster: Blob | null;
  body: string;
  savedAt: string;
};

const DB = "ourdays-logdrafts";
const STORE = "drafts";

export function draftKey(coupleId: string, dateIso: string, slot: LogSlot): string {
  return `${coupleId}:${dateIso}:${slot}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req ? (req.result as T) : null); };
      tx.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function putLogDraft(d: Omit<LogDraft, "key" | "savedAt">): Promise<boolean> {
  const row: LogDraft = { ...d, key: draftKey(d.coupleId, d.dateIso, d.slot), savedAt: new Date().toISOString() };
  const ok = await run("readwrite", (s) => s.put(row));
  return ok !== null;
}

export async function listLogDrafts(coupleId: string): Promise<LogDraft[]> {
  const all = await run<LogDraft[]>("readonly", (s) => s.getAll() as IDBRequest<LogDraft[]>);
  return (all ?? []).filter((d) => d && d.coupleId === coupleId && d.blob instanceof Blob);
}

export async function deleteLogDraft(key: string): Promise<void> {
  await run("readwrite", (s) => s.delete(key));
}

/** 기기에 영상 파일로 내려받기(슬롯이 지나 못 올린 영상). */
export function downloadBlob(blob: Blob, name: string): void {
  if (typeof document === "undefined") return;
  if (nativePlatform()) {
    void shareFileInApp(blob, name).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
