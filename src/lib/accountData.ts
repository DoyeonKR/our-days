import { getSupabase } from "@/lib/supabase";
import { signedPhotoUrl } from "@/lib/couple";
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
  for (let index = 0; index < ACCOUNT_EXPORT_TABLES.length; index += 1) {
    const table = ACCOUNT_EXPORT_TABLES[index];
    onProgress?.({ done: index, total: ACCOUNT_EXPORT_TABLES.length, label: table });
    const { data, error } = await sb.from(table).select("*");
    if (error) throw new Error(humanDataError(error.message));
    tables[table] = (data ?? []) as ExportRow[];
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

/** JSON과 실제 사진/영상을 ZIP으로 내려받는다. 브라우저 메모리 보호를 위해 250MB에서 중단한다. */
export async function downloadAccountArchive(
  onProgress?: (progress: ExportProgress) => void,
): Promise<{ files: number; skipped: number }> {
  const data = await buildAccountExport(onProgress);
  const paths = collectExportMediaPaths(data.tables);
  const { strToU8, zip } = await import("fflate");
  const files: Record<string, Uint8Array> = {
    "our-days-data.json": strToU8(JSON.stringify(data, null, 2)),
  };
  const failures: string[] = [];
  let totalBytes = files["our-days-data.json"].byteLength;
  const byteLimit = 250 * 1024 * 1024;

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    onProgress?.({ done: index, total: paths.length, label: path.split("/").pop() ?? path });
    try {
      const url = await signedPhotoUrl(path);
      if (!url) throw new Error("signed url missing");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (totalBytes + bytes.byteLength > byteLimit)
        throw new Error("archive size limit exceeded");
      totalBytes += bytes.byteLength;
      files[`media/${path.replace(/^\/+/, "")}`] = bytes;
    } catch {
      failures.push(path);
    }
  }
  if (failures.length) files["media-download-failures.txt"] = strToU8(failures.join("\n"));
  onProgress?.({ done: paths.length, total: paths.length, label: "압축 중" });

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), `${accountArchiveName()}.zip`);
  return { files: paths.length - failures.length, skipped: failures.length };
}

/** Edge Function만 service_role로 Storage→DB→Auth 순서의 삭제를 수행한다. */
export async function deleteRemoteAccount(): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요.");
  const { data, error } = await sb.functions.invoke<{ deleted?: boolean; error?: string }>(
    "manage-account",
    { body: { action: "delete" } },
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
