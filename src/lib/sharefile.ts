/* 브라우저에서 파일 공유 · 내려받기 — 사진 보기 · 매달 카드가 같이 쓴다. [2026-11-11]
 *
 * iOS 사파리는 navigator.share 를 **사용자 동작(탭) 안에서만** 받는다. 탭한 뒤 fetch · canvas 처럼 await 를 하나라도
 * 지나면 동작이 풀려 NotAllowedError 로 거절되고, 예전엔 그게 그대로 '저장하지 못했어요'가 됐다.
 * - 이 함수는 첫 await 전에 share 를 부른다 — 파일을 미리 받아 둔 쪽은 탭 안에서 바로 부르면 된다.
 * - 그래도 거절되면(NotAllowedError 등, 취소가 아닌 오류) 내려받기로 넘어간다(logmontage.shareOrDownload 와 같은 규칙).
 * - 사용자가 공유 시트를 닫은 것(AbortError)은 오류가 아니다 — "cancelled".
 * 앱(Capacitor)은 nativefile 의 공유 시트를 따로 쓴다 — 여기는 브라우저 길만. */

export type WebShareOutcome = "shared" | "saved" | "cancelled";

/** a[download] 로 내려받기(공유를 못 하는 브라우저 · 거절된 경우). */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 공유가 되면 공유 시트, 아니면(또는 거절되면) 내려받기. ⚠ share 는 이 함수 안에서 **동기로** 불린다 — 앞에 await 를 넣지 마라. */
export function webShareOrDownload(file: File, title: string): Promise<WebShareOutcome> {
  const nav = (typeof navigator === "undefined" ? undefined : navigator) as (Navigator & { canShare?: (d: ShareData) => boolean }) | undefined;
  let canShareFile = false;
  try {
    canShareFile = !!nav && typeof nav.share === "function" && !!nav.canShare?.({ files: [file] });
  } catch {
    canShareFile = false;
  }
  if (canShareFile && nav) {
    let pending: Promise<void>;
    try {
      pending = nav.share({ files: [file], title });
    } catch (e) {
      pending = Promise.reject(e);
    }
    return pending.then(
      () => "shared" as const,
      (e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return "cancelled" as const;
        // NotAllowedError(탭 동작이 풀렸다) · 그 밖의 거절 — 사진은 받아 둔 게 있으니 내려받기로
        downloadFile(file);
        return "saved" as const;
      },
    );
  }
  downloadFile(file);
  return Promise.resolve("saved");
}
