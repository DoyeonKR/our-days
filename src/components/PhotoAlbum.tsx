"use client";

/* 사진첩 — 찍은 날 묶음 · 일정 앨범 · 휴지통 · 저장 공간. [2026-11-06 사진첩 리뷰]
 *
 * 무엇이 바뀌었나(왜):
 *  · 목록은 키셋 페이지(60장씩, 찍은 시각 내림차순). 예전엔 전체를 한 번에 받아 PostgREST 행 상한(1000)에서 옛 사진이 조용히 빠졌다.
 *  · 썸네일만 서명하고 원본은 보기를 열 때(PhotoViewer). 타일이 깨지면 그 경로만 한 번 다시 서명한다.
 *  · 여러 장 올리기는 실패해도 다음 장으로 가고 'N장 중 M장'을 말한다. 진행 N/M 을 보여 주고, 올리는 동안 실시간 재조회를 미룬다
 *    (예전엔 한 장마다 전체 재조회 + 추억 재조회가 돌았다).
 *  · 삭제는 휴지통(30일, 되살리기). 누가 올린 사진인지 확인창이 말한다.
 *  · 타일 위 버튼 셋(별 · 집 · 휴지통)이 107px 타일의 1/3 을 덮고 스크린리더가 '사진 삭제'를 사진마다 되풀이했다 → 보기 안으로 옮기고
 *    타일은 날짜가 든 라벨 하나만.
 *  · 빨랫줄 걸기는 서버 원자 토글(couple_hung_toggle) + 되돌리기 알림. 함수가 아직 없으면 page 의 onToggleHung(옛 길).
 *
 * 알림에서 들어올 때: page 가 focusPhotoId 를 넘기면 그 사진을 찾아(필요하면 더 불러와) 보기로 연다. 처리했으면 onFocusHandled.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { beginBusy } from "@/lib/busy";
import {
  type Photo,
  type PhotoCursor,
  type HungToggle,
  PHOTO_PAGE,
  currentUserId,
  deletePhoto,
  getPhoto,
  getStorageUsage,
  listCoupleEvents,
  listPhotoShotTimes,
  listPhotosInRange,
  listPhotosPage,
  listTrashedPhotos,
  purgeExpiredTrash,
  resignPaths,
  restorePhoto,
  subscribePhotos,
  swapCoupleHung,
  toggleCoupleHung,
  trashPhoto,
  uploadPhoto,
  HUNG_MAX,
} from "@/lib/couple";
import type { CoupleEvent } from "@/lib/dday";
import Icon from "@/components/Icon";
import ConnectFirst from "@/components/ConnectFirst";
import { Skeleton } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";
import { humanError } from "@/lib/humanError";
import SaveStatus, { type SaveFeedback } from "@/components/SaveStatus";
import StatePanel from "@/components/StatePanel";
import PhotoViewer from "@/components/PhotoViewer";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { useDayTick } from "@/lib/useDayTick";
import { observeInPage } from "@/lib/pageScroll";
import { withTimeout } from "@/lib/logreview";
import {
  type EventAlbum,
  type StorageUsage,
  type UploadOutcome,
  PHOTO_UPLOAD_SLOW,
  PHOTO_UPLOAD_TIMEOUT_MS,
  countByDay,
  dayLabel,
  eventAlbums,
  formatBytes,
  groupByDay,
  hungToastText,
  kstDayRange,
  nextAfterRemove,
  shortDate,
  storageSummary,
  trashDaysLeft,
  uploadSummary,
} from "@/lib/photoalbum";

const IDLE_FEEDBACK: SaveFeedback = { phase: "idle" };

export function ClotheslineStatus({
  count,
  busy,
  feedback,
  onReset,
}: {
  count: number;
  busy: boolean;
  feedback: SaveFeedback;
  onReset?: () => void;
}) {
  const automatic = count === 0;
  return (
    <div
      aria-busy={busy}
      className="mb-4 overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-amber-50 to-rose-50 p-4 shadow-[var(--shadow-sm)] ring-1 ring-amber-200/70 dark:from-amber-950/40 dark:to-rose-950/30 dark:ring-amber-700/30"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300 text-ink shadow-[var(--shadow-sm)]">
          <Icon name="house" size={20} filled />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-ink">홈 사진 빨랫줄</p>
            <span className="rounded-full bg-white/75 px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200 dark:bg-black/20 dark:text-amber-200 dark:ring-amber-700/40">
              {automatic ? "최근 사진 자동" : `${count}/${HUNG_MAX}장 선택`}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {automatic
              ? `최근 사진 ${HUNG_MAX}장이 홈에 걸려요.`
              : "번호 순서대로 홈에 걸려요."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 pt-3 dark:border-amber-700/30">
        <SaveStatus feedback={feedback} />
        {feedback.phase === "idle" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Icon name="refresh" size={12} /> 상대와 실시간 공유
          </span>
        )}
        {!automatic && onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="tap ml-auto rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200 disabled:cursor-wait disabled:opacity-50 dark:bg-black/20 dark:text-amber-100 dark:ring-amber-700/40"
          >
            최근 사진 자동으로
          </button>
        )}
      </div>
    </div>
  );
}

/** 대표 사진 지정/해제 확인 — role=dialog · Esc · 포커스 가두기(useDialogFocus). */
function CoverConfirm({ photo, isCover, onCancel, onApply }: { photo: Photo; isCover: boolean; onCancel: () => void; onApply: () => void }) {
  const ref = useDialogFocus(true, onCancel);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-8" onClick={onCancel}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-confirm-title"
        className="animate-pop glass w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-lg)] outline-none ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumbUrl || photo.url} alt="" decoding="async" className="h-40 w-full object-cover" />
        </div>
        <p id="cover-confirm-title" className="mt-3 text-center text-sm font-bold text-ink">
          {isCover ? "대표 사진을 해제할까요?" : "이 사진을 대표 사진으로 설정할까요?"}
        </p>
        <p className="mt-1 text-center text-xs text-muted">홈 상단과 배경에 표시돼요.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="tap flex-1 rounded-2xl bg-glass py-3 text-sm font-bold text-muted ring-1 ring-line">
            취소
          </button>
          <button data-dialog-initial onClick={onApply} className="tap flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]">
            {isCover ? "해제" : "대표로 설정"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Toast = { text: string; tone: "ok" | "warn" | "error"; action?: { label: string; run: () => void } };

/** 사진첩 순서 — 찍은 날 최신순, 같으면 id(목록 질의와 같은 순서). */
const byShot = (a: Photo, b: Photo) => b.shotAt.localeCompare(a.shotAt) || b.id.localeCompare(a.id);

export default function PhotoAlbum({
  coupleId,
  coverPath,
  onSetCover,
  hungPaths = [],
  onToggleHung,
  onResetHung,
  hungBusy = false,
  hungFeedback = IDLE_FEEDBACK,
  onConnect,
  focusPhotoId,
  onFocusHandled,
  active = true,
}: {
  /** 이 화면(기록 › 사진)이 지금 보이나 — 숨으면 사진 보기 · 확인창을 닫는다(아래 effect). */
  active?: boolean;
  coupleId: string | null;
  coverPath: string | null;
  onSetCover: (path: string) => void;
  /** 홈 빨랫줄에 걸린 사진 경로(커플 공유, 최대 HUNG_MAX). */
  hungPaths?: string[];
  /** 옛 길 — 서버 원자 토글(couple_hung_toggle)이 아직 없을 때만 부른다. */
  onToggleHung?: (path: string) => void;
  /** 직접 선택을 모두 지우고 최근 사진 자동 모드로 돌아간다. */
  onResetHung?: () => void;
  hungBusy?: boolean;
  hungFeedback?: SaveFeedback;
  /** 연결 전 빈 화면의 '커플 연결하러 가기' — 함께 탭으로 보낸다. */
  onConnect?: () => void;
  /** 활동함 · 알림에서 온 사진 id — 그 사진을 찾아 보기로 연다(activity 경로의 focus). */
  focusPhotoId?: string | null;
  /** focusPhotoId 를 처리했다(열었거나 못 찾았다) — page 가 값을 비우면 같은 알림을 다시 눌렀을 때 또 열린다. */
  onFocusHandled?: () => void;
}) {
  const today = useDayTick();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [next, setNext] = useState<PhotoCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [shotTimes, setShotTimes] = useState<string[]>([]);
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [album, setAlbum] = useState<{ ev: EventAlbum; photos: Photo[] | null } | null>(null);
  const [trash, setTrash] = useState<Photo[] | null>(null); // null = 휴지통 닫힘
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  // 지난 올리기에서 실패한 장 — '실패한 것만 다시 올리기'가 이것만 다시 보낸다(토스트는 몇 초면 사라져 버튼을 따로 둔다)
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Photo | null>(null); // 대표 지정 확인
  // 뷰어는 인덱스가 아니라 사진 id 로 식별 — realtime 재조회로 목록이 재정렬돼도 표시/삭제/대표 대상이 바뀌지 않게(오삭제 방지).
  const [viewerId, setViewerId] = useState<string | null>(null);
  // 서버 토글 직후의 빨랫줄 — page 의 hungPaths 가 realtime 으로 바뀌면(basis 가 달라지면) 그쪽을 믿는다
  const [hungLocal, setHungLocal] = useState<{ basis: string; paths: string[] } | null>(null);
  const [hungWorking, setHungWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const pendingRefresh = useRef(false);
  const retried = useRef(new Set<string>());
  const [thumbFix, setThumbFix] = useState<Record<string, string>>({});
  const sentinel = useRef<HTMLDivElement>(null);
  const loadedCount = useRef(PHOTO_PAGE);
  const focusDone = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const hungBasis = hungPaths.join("|");
  const hung = hungLocal && hungLocal.basis === hungBasis ? hungLocal.paths : hungPaths;
  const viewList = album?.photos ?? photos;
  const viewerPhoto = viewerId ? viewList.find((p) => p.id === viewerId) ?? null : null;

  function showToast(t: Toast, ms = 5000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // 탭이 숨으면(알림을 눌러 다른 화면으로 갔다) 전체 화면 사진 보기 · 대표 확인창을 닫는다(2026-11-09).
  // 탭은 hidden 으로 마운트된 채 남아, 예전엔 보이지 않는 사진 보기가 뒤로 가기 기록(useBackClose)을 붙잡고
  // 다음 뒤로 가기를 삼켰다. 닫으면(언마운트) 그 기록도 함께 풀린다.
  useEffect(() => {
    if (active) return;
    setViewerId(null);
    setConfirm(null);
  }, [active]);

  /* ── 목록 · 실시간(디바운스) ─────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      const request = ++revision;
      try {
        // 이미 펼친 만큼 한 번에 다시 받는다(최대 600장) — 커서를 처음부터 다시 따라가지 않게
        const r = await listPhotosPage(coupleId, null, Math.min(600, Math.max(PHOTO_PAGE, loadedCount.current)));
        if (cancelled || request !== revision) return;
        setPhotos(r.photos);
        setNext(r.next);
        setLoadError(null);
        listPhotoShotTimes(coupleId).then((t) => !cancelled && setShotTimes(t)).catch(() => {});
      } catch (e) {
        if (!cancelled && request === revision) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled && request === revision) setLoading(false);
      }
    };
    refreshRef.current = refresh;
    void refresh();
    // 실시간 — 올리는 중이면 끝날 때 한 번만, 아니면 0.7초 모아서 한 번
    const unsub = subscribePhotos(coupleId, () => {
      if (uploading.current) {
        pendingRefresh.current = true;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 700);
    });
    listCoupleEvents(coupleId).then((ev) => !cancelled && setEvents(ev)).catch(() => {});
    getStorageUsage(coupleId).then((u) => !cancelled && setUsage(u)).catch(() => {});
    currentUserId().then((u) => !cancelled && setMyUserId(u)).catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [coupleId, reload]);

  async function loadMore() {
    if (!coupleId || !next || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await listPhotosPage(coupleId, next);
      setPhotos((cur) => {
        const seen = new Set(cur.map((p) => p.id));
        const merged = [...cur, ...r.photos.filter((p) => !seen.has(p.id))];
        loadedCount.current = merged.length;
        return merged;
      });
      setNext(r.next);
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : "사진을 더 불러오지 못했어요.", tone: "error" });
    } finally {
      setLoadingMore(false);
    }
  }

  // 끝에 닿으면 저절로 다음 페이지(버튼도 남긴다 — 관찰자가 없는 브라우저 · 스크린리더)
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || album || trash) return;
    // iOS 는 main 이 스크롤한다 — root 를 그 영역으로 줘야 600px 앞에서 미리 받는다(pageScroll)
    const stop = observeInPage(el, (entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: "600px" });
    return () => stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, album, trash, loadingMore]);

  /* ── 알림에서 온 사진 ─────────────────────────────────────────────── */
  useEffect(() => {
    // page 가 값을 비우면 잊는다 — 같은 알림을 다시 눌렀을 때 또 열리게
    if (!focusPhotoId) { focusDone.current = null; return; }
    if (!coupleId || loading || focusDone.current === focusPhotoId) return;
    focusDone.current = focusPhotoId;
    void openById(focusPhotoId).finally(() => onFocusHandled?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, focusPhotoId, loading]);

  async function openById(id: string) {
    if (!coupleId) return;
    setAlbum(null);
    setTrash(null);
    if (photos.some((p) => p.id === id)) {
      setViewerId(id);
      document.getElementById(`photo-${id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    const p = await getPhoto(coupleId, id).catch(() => null);
    if (!p) {
      showToast({ text: "그 사진을 찾지 못했어요(영구 삭제됐을 수 있어요).", tone: "warn" });
      return;
    }
    if (p.deletedAt) {
      showToast({ text: "휴지통에 있는 사진이에요.", tone: "warn", action: { label: "휴지통 보기", run: () => void openTrash() } });
      return;
    }
    // 아직 안 불러온 페이지의 사진 — 목록에 끼워 넣는다(다음 페이지에서 같은 id 는 걸러진다)
    setPhotos((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p].sort(byShot)));
    setViewerId(p.id);
  }

  /* ── 올리기 ───────────────────────────────────────────────────────── */
  async function onFiles(files: FileList | File[] | null) {
    if (!coupleId || !files || !files.length || uploading.current) return;
    const list = Array.from(files);
    uploading.current = true;
    // 올리는 동안 '바쁨' — 새 버전 자동 새로고침이 남은 장을 끊지 않게, 웹에선 떠나기 전에 묻는다(lib/busy)
    const endBusy = beginBusy();
    setFailedFiles([]);
    setUpload({ done: 0, total: list.length });
    const outcome: UploadOutcome = { ok: 0, duplicate: 0, failed: [] };
    const failed: File[] = [];
    let firstId: string | null = null;
    try {
      for (let i = 0; i < list.length; i += 1) {
        const f = list[i];
        try {
          // 한 장마다 시간 제한 — 멈춘 한 장이 나머지를 붙잡지 않게
          const r = await withTimeout(uploadPhoto(coupleId, f), PHOTO_UPLOAD_TIMEOUT_MS);
          if (r.status === "duplicate") outcome.duplicate += 1;
          else {
            outcome.ok += 1;
            firstId ??= r.id;
          }
        } catch (e) {
          // 한 장이 실패해도 나머지는 계속 올린다(예전엔 첫 실패에서 멈추고 몇 장이 됐는지도 안 알렸다)
          const raw = e instanceof Error ? e.message : String(e);
          outcome.failed.push({ name: f.name, message: raw === "upload-timeout" ? PHOTO_UPLOAD_SLOW : humanError(raw) });
          failed.push(f);
        }
        setUpload({ done: i + 1, total: list.length });
      }
    } finally {
      endBusy();
      // 무슨 일이 있어도 풀린다 — 예전엔 이 둘이 finally 밖(끝없는 refresh 뒤)이라 한 번 걸리면 다시 못 올렸다
      uploading.current = false;
      setUpload(null);
    }
    pendingRefresh.current = false;
    if (fileRef.current) fileRef.current.value = "";
    setFailedFiles(failed);
    // 목록 다시 읽기도 끝이 있어야 한다(토스트가 늦게라도 뜨게)
    await withTimeout(refreshRef.current(), 15_000).catch(() => {});
    getStorageUsage(coupleId).then(setUsage).catch(() => {});
    const s = uploadSummary(list.length, outcome);
    const id = firstId;
    const action = failed.length
      ? { label: "실패한 것만 다시", run: () => void onFiles(failed) }
      : id
        ? { label: "보기", run: () => void openById(id) }
        : undefined;
    showToast({ text: s.text, tone: s.tone, action }, s.tone === "ok" ? 4000 : 8000);
  }

  /* ── 휴지통 ───────────────────────────────────────────────────────── */
  async function openTrash() {
    if (!coupleId) return;
    setAlbum(null);
    setTrash([]);
    await purgeExpiredTrash(coupleId);
    try {
      setTrash(await listTrashedPhotos(coupleId));
    } catch (e) {
      setTrash(null);
      showToast({ text: e instanceof Error ? e.message : "휴지통을 열지 못했어요.", tone: "error" });
    }
  }

  async function moveToTrash(p: Photo) {
    if (!coupleId) return;
    const mine = !!myUserId && p.created_by === myUserId;
    const onHome = coverPath === p.path || hung.includes(p.path);
    if (
      !(await confirmDialog({
        message: mine ? "이 사진을 휴지통으로 옮길까요?" : "상대가 올린 사진이에요. 휴지통으로 옮길까요?",
        detail: `30일 동안 휴지통에서 되살릴 수 있고, 그 뒤에 정리돼요.${onHome ? " 대표 사진 · 홈 빨랫줄에서도 내려가요." : ""}`,
        confirmText: "휴지통으로",
        danger: true,
      }))
    )
      return;
    const ids = viewList.map((x) => x.id);
    // 실패하면 이 사진만 제자리(찍은 순)에 되돌린다 — 예전엔 옮기기 전 목록 통째(setPhotos(prev))로 돌려
    // 그사이 올라온 사진 · 실시간 갱신 · 더 불러온 쪽을 지웠다.
    const restoreOne = (cur: Photo[]) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p].sort(byShot));
    setPhotos((cur) => cur.filter((x) => x.id !== p.id));
    if (album?.photos) setAlbum({ ...album, photos: album.photos.filter((x) => x.id !== p.id) });
    // 지운 뒤엔 보기를 닫지 않고 다음 사진으로
    if (viewerId === p.id) setViewerId(nextAfterRemove(ids, p.id));
    try {
      await trashPhoto(p.id);
      showToast({
        text: "휴지통으로 옮겼어요",
        tone: "ok",
        action: {
          label: "되돌리기",
          run: () =>
            void restorePhoto(p.id)
              .then(() => refreshRef.current())
              .catch((e) => showToast({ text: e instanceof Error ? e.message : "되돌리지 못했어요.", tone: "error" })),
        },
      });
    } catch (e) {
      setPhotos(restoreOne);
      setAlbum((cur) => (cur?.photos && cur.ev.key === album?.ev.key ? { ...cur, photos: restoreOne(cur.photos) } : cur));
      showToast({ text: e instanceof Error ? e.message : String(e), tone: "error" });
    }
  }

  async function restore(p: Photo) {
    try {
      await restorePhoto(p.id);
      setTrash((cur) => (cur ? cur.filter((x) => x.id !== p.id) : cur));
      showToast({ text: "사진첩으로 되살렸어요", tone: "ok" });
      void refreshRef.current();
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : "되살리지 못했어요.", tone: "error" });
    }
  }

  async function purgeNow(p: Photo) {
    if (!(await confirmDialog({ message: "지금 영구 삭제할까요?", detail: "되돌릴 수 없어요.", confirmText: "영구 삭제", danger: true }))) return;
    try {
      await deletePhoto(p.id, p.path, p.thumbPath);
      setTrash((cur) => (cur ? cur.filter((x) => x.id !== p.id) : cur));
      if (coupleId) getStorageUsage(coupleId).then(setUsage).catch(() => {});
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : "지우지 못했어요.", tone: "error" });
    }
  }

  /* ── 빨랫줄(원자 토글 + 되돌리기) ─────────────────────────────────── */
  async function toggleHung(p: Photo) {
    if (!coupleId || hungWorking) return;
    const before = hung;
    setHungWorking(true);
    try {
      const r: HungToggle | null = await toggleCoupleHung(coupleId, p.path);
      if (!r) {
        onToggleHung?.(p.path); // 서버 함수가 아직 없다 — 옛 길
        return;
      }
      setHungLocal({ basis: hungBasis, paths: r.paths });
      const evicted = r.evicted ? photos.find((x) => x.path === r.evicted) : null;
      showToast({
        text: hungToastText(r, evicted ? shortDate(evicted.shotAt) : null),
        tone: "ok",
        action: {
          label: "되돌리기",
          run: () =>
            void swapCoupleHung(coupleId, r.paths, before)
              .then((res) => {
                setHungLocal({ basis: hungBasis, paths: res.paths });
                if (!res.ok) showToast({ text: "그사이 상대가 빨랫줄을 바꿔서 되돌리지 않았어요", tone: "warn" });
              })
              .catch((e) => showToast({ text: e instanceof Error ? e.message : "되돌리지 못했어요.", tone: "error" })),
        },
      });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : "홈 빨랫줄을 바꾸지 못했어요.", tone: "error" });
    } finally {
      setHungWorking(false);
    }
  }

  /* ── 일정 앨범 ────────────────────────────────────────────────────── */
  const dayCounts = useMemo(() => countByDay(shotTimes), [shotTimes]);
  const albums = useMemo(() => eventAlbums(events, dayCounts, today), [events, dayCounts, today]);
  async function openAlbum(ev: EventAlbum) {
    if (!coupleId) return;
    setTrash(null);
    setAlbum({ ev, photos: null });
    try {
      const [from, to] = kstDayRange(ev.date);
      setAlbum({ ev, photos: await listPhotosInRange(coupleId, from, to) });
    } catch (e) {
      setAlbum(null);
      showToast({ text: e instanceof Error ? e.message : "앨범을 열지 못했어요.", tone: "error" });
    }
  }

  async function fixThumb(p: Photo) {
    const path = p.thumbPath || p.path;
    if (retried.current.has(path)) return;
    retried.current.add(path);
    const urls = await resignPaths([path]).catch(() => ({} as Record<string, string>));
    if (urls[path]) setThumbFix((cur) => ({ ...cur, [path]: urls[path] }));
  }

  const applyCover = () => {
    if (!confirm) return;
    onSetCover(coverPath === confirm.path ? "" : confirm.path);
    setConfirm(null);
  };

  const groups = useMemo(() => groupByDay(viewList), [viewList]);
  const storage = usage ? storageSummary(usage) : null;

  const tile = (p: Photo) => {
    const isCover = coverPath === p.path;
    const hungAt = hung.indexOf(p.path);
    const label = `${shortDate(p.shotAt)} 사진${p.caption ? `, ${p.caption}` : ""}${isCover ? ", 대표 사진" : ""}${hungAt >= 0 ? `, 홈 빨랫줄 ${hungAt + 1}번째` : ""} 크게 보기`;
    return (
      <button
        key={p.id}
        id={`photo-${p.id}`}
        type="button"
        onClick={() => setViewerId(p.id)}
        aria-label={label}
        className={`tap group relative aspect-square select-none overflow-hidden rounded-xl shadow-[var(--shadow-sm)] ring-1 ${isCover ? "ring-2 ring-rose-deep" : "ring-line"}`}
        style={{ touchAction: "manipulation" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbFix[p.thumbPath || p.path] || p.thumbUrl || p.url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => void fixThumb(p)}
          className="h-full w-full object-cover"
        />
        {/* 표시만(버튼 아님) — 대표 · 빨랫줄 자리. 라벨이 같은 말을 한다 */}
        {isCover && (
          <span aria-hidden className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-sm)]">
            <Icon name="star" size={12} filled />
          </span>
        )}
        {hungAt >= 0 && (
          <span aria-hidden className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-amber-300 px-1.5 py-0.5 text-xs font-black text-ink">
            <Icon name="house" size={10} filled />
            {hungAt + 1}
          </span>
        )}
      </button>
    );
  };

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-4">
      {/* 보이는 제목은 없다 — 위 세그먼트가 이미 '사진'이라고 말한다(DecoBook 주석 참고). */}
      <h1 className="sr-only">사진첩</h1>
      {coupleId && (loading || upload || photos.length > 0) && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void openTrash()}
            className="tap rounded-full bg-glass px-3 py-2 text-xs font-bold text-muted ring-1 ring-line"
          >
            <Icon name="trash" size={13} /> 휴지통
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!upload}
            className="tap flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            <Icon name="plus" size={15} strokeWidth={2.4} />
            {upload ? `올리는 중 ${upload.done}/${upload.total}` : "사진 올리기"}
          </button>
        </div>
      )}
      {!upload && failedFiles.length > 0 && (
        <div role="status" className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-glass px-3 py-2 text-xs text-muted ring-1 ring-line">
          <span>{failedFiles.length}장을 올리지 못했어요</span>
          <button type="button" onClick={() => void onFiles(failedFiles)} className="tap shrink-0 font-bold text-rose-deep">
            실패한 것만 다시 올리기
          </button>
        </div>
      )}
      {upload && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-glass ring-1 ring-line" role="progressbar" aria-label="사진 올리는 중" aria-valuemin={0} aria-valuemax={upload.total} aria-valuenow={upload.done}>
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((upload.done / Math.max(1, upload.total)) * 100)}%` }} />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />

      {!coupleId && (
        <ConnectFirst
          icon="image"
          title="커플 연결 후 함께 모아요"
          body="연결하면 사진을 함께 쌓고 대표 사진을 홈에 띄울 수 있어요."
          onConnect={onConnect}
        />
      )}

      {coupleId && trash && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink">휴지통 · 30일 뒤 정리돼요</p>
            <button onClick={() => setTrash(null)} className="tap rounded-full bg-glass px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-line">
              사진첩으로
            </button>
          </div>
          {trash.length === 0 ? (
            <p className="rounded-xl bg-glass2 px-3 py-6 text-center text-xs text-muted">휴지통이 비어 있어요.</p>
          ) : (
            <ul className="space-y-2">
              {trash.map((p) => {
                const mine = !!myUserId && p.created_by === myUserId;
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-card p-2 ring-1 ring-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbFix[p.thumbPath || p.path] || p.thumbUrl} onError={() => void fixThumb(p)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-bold text-ink">{shortDate(p.shotAt)} · {mine ? "내가 올림" : "상대가 올림"}</p>
                      <p className="text-muted">{p.deletedAt ? `${trashDaysLeft(p.deletedAt, Date.parse(today) + 12 * 3_600_000)}일 뒤 정리` : ""}</p>
                    </div>
                    <button onClick={() => void restore(p)} className="tap rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white" aria-label={`${shortDate(p.shotAt)} 사진 되살리기`}>
                      되살리기
                    </button>
                    {mine && (
                      <button onClick={() => void purgeNow(p)} className="tap rounded-full bg-glass px-2.5 py-1.5 text-xs font-bold text-rose-deep ring-1 ring-line" aria-label={`${shortDate(p.shotAt)} 사진 영구 삭제`}>
                        지금 지우기
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {coupleId && !trash && (
        <>
          <ClotheslineStatus count={hung.length} busy={hungBusy || hungWorking} feedback={hungFeedback} onReset={onResetHung} />
          {albums.length > 0 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" style={{ touchAction: "pan-x" }} aria-label="일정 앨범">
              {album && (
                <button onClick={() => setAlbum(null)} className="tap shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white">
                  전체 사진
                </button>
              )}
              {albums.slice(0, 20).map((a) => (
                <button
                  key={a.key}
                  onClick={() => void openAlbum(a)}
                  aria-pressed={album?.ev.key === a.key}
                  className={`tap shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${album?.ev.key === a.key ? "bg-rose/15 text-rose-deep ring-rose/40" : "bg-glass text-muted ring-line"}`}
                >
                  {a.emoji ? `${a.emoji} ` : ""}
                  {a.title} · {a.count}장
                </button>
              ))}
            </div>
          )}
          {loadError && (
            <div className="mb-4">
              <StatePanel kind="error" title="사진을 불러오지 못했어요" detail="사진은 삭제되지 않았어요. 연결을 확인하고 다시 불러와 주세요." onRetry={() => setReload((n) => n + 1)} busy={loading} />
            </div>
          )}
          {loading || (album && !album.photos) ? (
            <div className="grid grid-cols-3 gap-1.5" role="status" aria-label="사진 불러오는 중">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : loadError && photos.length === 0 ? null : viewList.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-12 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-glass text-muted ring-1 ring-line">
                <Icon name="image" size={22} />
              </div>
              <p className="text-sm font-semibold text-ink">아직 사진이 없어요</p>
              <p className="mt-1 text-xs text-muted">첫 추억을 올려볼까요?</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="tap mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)]"
              >
                <Icon name="plus" size={16} strokeWidth={2.4} />첫 사진 올리기
              </button>
            </div>
          ) : (
            <div>
              <p role="status" className="mb-3 text-xs text-muted">
                {album ? `${album.ev.title} · ${viewList.length}장` : `전체 ${shotTimes.length || photos.length}장 · ${photos.length}장 표시`}
              </p>
              {groups.map((g) => (
                <section key={g.date} aria-label={dayLabel(g.date, today)} className="mb-4">
                  <h2 className="mb-1.5 text-xs font-extrabold text-ink">
                    {dayLabel(g.date, today)}
                    <span className="ml-1 font-semibold text-muted">· {dayCounts.get(g.date) ?? g.photos.length}장</span>
                  </h2>
                  <div className="grid grid-cols-3 gap-1.5">{g.photos.map(tile)}</div>
                </section>
              ))}
              {!album && next && (
                <>
                  <div ref={sentinel} aria-hidden className="h-1" />
                  <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="tap state-panel-action mt-2 w-full">
                    {loadingMore ? "불러오는 중…" : "지난 사진 더 보기"}
                  </button>
                </>
              )}
            </div>
          )}
          {storage && usage && (
            <div className="mt-6 rounded-xl bg-glass2 p-3 ring-1 ring-line">
              <p className="text-xs font-bold text-ink">저장 공간</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-glass ring-1 ring-line" role="meter" aria-label="무료 저장 공간 사용량" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(storage.usedRatio * 100)}>
                <div className="h-full bg-brand" style={{ width: `${Math.max(2, Math.round(storage.usedRatio * 100))}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                사진 {formatBytes(usage.photos)} · 영상 {formatBytes(usage.logs)} · 일기 {formatBytes(usage.diary)}
                {storage.monthsLeft === null ? " · 남은 공간 넉넉해요" : ` · 남은 기간 약 ${storage.monthsLeft}개월`}
              </p>
            </div>
          )}
        </>
      )}

      {toast && (
        <div role={toast.tone === "error" ? "alert" : "status"} className={`fixed inset-x-4 bottom-24 z-[85] mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-lg)] ${toast.tone === "error" ? "bg-rose-deep text-white" : "bg-ink text-surface"}`}>
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                const run = toast.action!.run;
                setToast(null);
                run();
              }}
              className="tap shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {viewerPhoto && (
        <PhotoViewer
          photos={viewList}
          currentId={viewerPhoto.id}
          onChange={setViewerId}
          onClose={() => setViewerId(null)}
          coupleId={coupleId}
          myUserId={myUserId}
          blockKeys={!!confirm}
          onPhotoUpdated={(p) => {
            setPhotos((cur) => cur.map((x) => (x.id === p.id ? p : x)));
            if (album?.photos) setAlbum({ ...album, photos: album.photos.map((x) => (x.id === p.id ? p : x)) });
          }}
          actions={{
            coverPath,
            onCover: (p) => setConfirm(p),
            hungPaths: hung,
            onToggleHung: onToggleHung || coupleId ? (p) => void toggleHung(p) : undefined,
            hungBusy: hungBusy || hungWorking,
            onTrash: (p) => void moveToTrash(p),
          }}
        />
      )}

      {confirm && <CoverConfirm photo={confirm} isCover={coverPath === confirm.path} onCancel={() => setConfirm(null)} onApply={applyCover} />}
    </section>
  );
}
