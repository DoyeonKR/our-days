import { getSupabase } from "@/lib/supabase";
import { signedPhotoUrls } from "@/lib/couple";
import {
  ACCOUNT_EXPORT_TABLES,
  accountArchiveName,
  collectExportMediaPaths,
  ourDaysStorageKeys,
  type AccountExportTable,
  type ExportRow,
} from "@/lib/accountPolicy";

export type AccountExport = {
  format: "our-days-account-export";
  version: 1;
  exportedAt: string;
  scope: "rows-visible-to-current-account";
  account: {
    id: string;
    email: string | null;
    createdAt: string | null;
  };
  tables: Record<AccountExportTable, ExportRow[]>;
};

export type ExportProgress = {
  done: number;
  total: number;
  label: string;
};

function humanDataError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network"))
    return "네트워크 연결을 확인해 주세요.";
  return "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/** 현재 계정이 RLS로 볼 수 있는 공유 공간/개인 설정을 하나의 JSON으로 만든다. */
export async function buildAccountExport(
  onProgress?: (progress: ExportProgress) => void,
): Promise<AccountExport> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) throw new Error("로그인이 필요해요.");

  const tables = {} as Record<AccountExportTable, ExportRow[]>;
  const PAGE = 1000; // PostgREST Max Rows 기본값 — 단발 select(*) 는 여기서 조용히 잘렸다
  for (let index = 0; index < ACCOUNT_EXPORT_TABLES.length; index += 1) {
    const table = ACCOUNT_EXPORT_TABLES[index];
    onProgress?.({ done: index, total: ACCOUNT_EXPORT_TABLES.length, label: table });
    /* 페이지네이션 필수 [리뷰 2026-08-26]: 장기 사용 커플은 pokes·activity_events 가
       1,000행을 쉽게 넘고, 이 백업은 계정 삭제 직전의 마지막 사본이라 잘림 = 영구 유실이다.
       (media-gc 의 allRows 와 같은 방식) */
    const all: ExportRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await sb.from(table).select("*").range(offset, offset + PAGE - 1);
      // 새 표(2026-11-06)가 아직 운영 DB 에 없으면(마이그레이션 전) 그 표만 빈 것으로 — 내보내기 전체가 멈추지 않게
      if (error && (error.code === "42P01" || error.code === "PGRST205")) break;
      if (error) throw new Error(humanDataError(error.message));
      const page = (data ?? []) as ExportRow[];
      all.push(...page);
      if (page.length < PAGE) break;
    }
    tables[table] = all;
  }
  onProgress?.({
    done: ACCOUNT_EXPORT_TABLES.length,
    total: ACCOUNT_EXPORT_TABLES.length,
    label: "완료",
  });

  return {
    format: "our-days-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    scope: "rows-visible-to-current-account",
    account: {
      id: authData.user.id,
      email: authData.user.email ?? null,
      createdAt: authData.user.created_at ?? null,
    },
    tables,
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadAccountJson(
  onProgress?: (progress: ExportProgress) => void,
): Promise<AccountExport> {
  const data = await buildAccountExport(onProgress);
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }),
    `${accountArchiveName()}.json`,
  );
  return data;
}

/** ZIP 한 개의 상한 — 넘으면 다음 파일(-2.zip …)로 나눈다. 예전엔 250MB 에서 '실패'로 끝났는데 버킷이 이미 246MB 였다. */
export const ARCHIVE_PART_BYTES = 200 * 1024 * 1024;
const SIGN_BATCH = 100;

/** 이미 압축된 미디어(WebP · JPEG · MP4)는 다시 압축해도 안 준다 — 저장만(level 0), 글(JSON)만 deflate. */
export function zipLevelFor(name: string): 0 | 6 {
  return /\.(webp|jpe?g|png|gif|mp4|webm|mov|heic)$/i.test(name) ? 0 : 6;
}

/** JSON과 실제 사진/영상을 ZIP으로 내려받는다(2026-11-06 다시 짬).
 *  · 한 번에 메모리에 다 올리지 않는다 — fflate Zip 스트림이 만든 조각을 Blob 으로 넘겨 브라우저가 디스크에 둘 수 있게
 *    (예전엔 파일 전부 + 압축 결과를 메모리에 함께 들고 있다가 iOS 에서 탭이 죽었다).
 *  · 200MB 마다 파일을 나눈다(-1.zip, -2.zip …). 서명은 100개씩 한 번에. */
export async function downloadAccountArchive(
  onProgress?: (progress: ExportProgress) => void,
): Promise<{ files: number; skipped: number; parts: number }> {
  const data = await buildAccountExport(onProgress);
  const paths = collectExportMediaPaths(data.tables);
  const { strToU8, Zip, ZipDeflate, ZipPassThrough } = await import("fflate");
  const base = accountArchiveName();
  const finished: Blob[] = [];
  let zip: InstanceType<typeof Zip> | null = null;
  let chunks: Uint8Array[] = [];
  let parts: Blob[] = [];
  let partBytes = 0;
  let done: Promise<void> = Promise.resolve();

  const openPart = () => {
    chunks = [];
    parts = [];
    partBytes = 0;
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    done = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    zip = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      chunks.push(chunk);
      // 16MB 마다 Blob 으로 넘긴다 — 큰 Blob 은 브라우저가 디스크로 내린다
      if (chunks.reduce((n, c) => n + c.byteLength, 0) > 16 * 1024 * 1024) {
        parts.push(new Blob(chunks as BlobPart[]));
        chunks = [];
      }
      if (final) {
        parts.push(new Blob(chunks as BlobPart[]));
        chunks = [];
        finished.push(new Blob(parts, { type: "application/zip" }));
        parts = [];
        resolve();
      }
    });
  };
  const addFile = (name: string, bytes: Uint8Array) => {
    const entry = zipLevelFor(name) === 0 ? new ZipPassThrough(name) : new ZipDeflate(name, { level: 6 });
    zip!.add(entry);
    entry.push(bytes, true);
    partBytes += bytes.byteLength;
  };
  const closePart = async () => {
    zip!.end();
    await done;
  };

  openPart();
  addFile("our-days-data.json", strToU8(JSON.stringify(data, null, 2)));
  const failures: string[] = [];
  for (let start = 0; start < paths.length; start += SIGN_BATCH) {
    const batch = paths.slice(start, start + SIGN_BATCH);
    let urls: Record<string, string> = {};
    try {
      urls = await signedPhotoUrls(batch);
    } catch {
      /* 아래에서 경로마다 실패로 센다 */
    }
    for (let k = 0; k < batch.length; k += 1) {
      const path = batch[k];
      onProgress?.({ done: start + k, total: paths.length, label: path.split("/").pop() ?? path });
      try {
        const url = urls[path];
        if (!url) throw new Error("signed url missing");
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (partBytes > 0 && partBytes + bytes.byteLength > ARCHIVE_PART_BYTES) {
          await closePart();
          openPart();
        }
        addFile(`media/${path.replace(/^\/+/, "")}`, bytes);
      } catch {
        failures.push(path);
      }
    }
  }
  if (failures.length) addFile("media-download-failures.txt", strToU8(failures.join("\n")));
  onProgress?.({ done: paths.length, total: paths.length, label: "압축 중" });
  await closePart();
  finished.forEach((blob, i) =>
    downloadBlob(blob, finished.length > 1 ? `${base}-${i + 1}.zip` : `${base}.zip`),
  );
  return { files: paths.length - failures.length, skipped: failures.length, parts: finished.length };
}

/** Edge Function만 service_role로 DB purge→Storage→Auth 순서의 삭제를 수행한다.
 *  현재 비밀번호는 **서버가** 재검증한다(클라 확인만으론 탈취 세션 직접 호출을 못 막는다). */
export async function deleteRemoteAccount(password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data, error } = await sb.functions.invoke<{ deleted?: boolean; error?: string }>(
    "manage-account",
    { body: { action: "delete", password } },
  );
  if (error) throw new Error(humanDataError(error.message));
  if (!data?.deleted) throw new Error(data?.error || "계정을 삭제하지 못했어요.");
  // 서버에서 사용자가 사라진 뒤에는 원격 로그아웃이 실패할 수 있으므로 로컬 세션만 지운다.
  await sb.auth.signOut({ scope: "local" }).catch(() => {});
}

/** 이 앱의 로컬 캐시/초안만 삭제한다. 같은 origin의 타 서비스와 Supabase 세션은 건드리지 않는다. */
export function clearOurDaysDeviceData(storage: Storage = localStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => !!key,
  );
  for (const key of ourDaysStorageKeys(keys)) storage.removeItem(key);
}
