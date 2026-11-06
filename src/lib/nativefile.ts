/* 앱(WebView)에서 파일 저장 · 공유 — 앱 안엔 navigator.share 도, blob 내려받기도 없어서 눌러도 아무 일이 없었다(2026-11-06).
 * 캐시에 파일을 쓰고 휴대폰의 공유 시트를 연다(사진첩 저장 · 파일 저장 · 카톡 전송을 거기서 고른다).
 * 브라우저에선 false 를 돌려주고 아무것도 안 한다 — 부르는 쪽이 원래 길(웹 공유 · 내려받기)로 간다.
 * [2026-11-06 앱 · 푸시 리뷰] 200MB 백업 조각을 base64 한 줄(약 270MB 문자열)로 만들어 넘겨 메모리가 터질 수 있었다 →
 * 3MB 씩 잘라 첫 조각은 writeFile, 나머지는 appendFile. 공유가 끝난 파일은 다음 공유 때 치운다(아래 sweep). */
import { nativePlatform } from "./nativeplatform.ts";

/** 한 번에 base64 로 바꿀 바이트 — 3 의 배수여야 조각마다 따로 바꾼 base64 를 이어 붙여도 통째로 바꾼 것과 같다(중간에 '=' 가 안 낀다). */
export const WRITE_CHUNK_BYTES = 3 * 1024 * 1024;
/** 공유용 파일을 두는 캐시 안 폴더 — 여기 것만 치운다. */
export const SHARE_DIR = "share";
/** 받는 앱(드라이브 · 메일)이 공유 뒤에도 파일을 읽을 수 있어 바로 지우지 않고, 이만큼 지난 것만 다음 공유 때 지운다. */
export const SHARE_KEEP_MS = 10 * 60 * 1000;

export type ShareOutcome = "unsupported" | "shared" | "cancelled";

/** [시작, 끝) 바이트 구간 목록. 빈 파일도 한 구간(빈 파일을 쓴다). */
export function chunkRanges(size: number, chunk = WRITE_CHUNK_BYTES): Array<[number, number]> {
  if (chunk <= 0 || chunk % 3 !== 0) throw new Error("chunk must be a positive multiple of 3");
  const out: Array<[number, number]> = [];
  for (let start = 0; start < size; start += chunk) out.push([start, Math.min(size, start + chunk)]);
  return out.length ? out : [[0, 0]];
}

/** 사용자가 공유 시트를 닫은 것 — 오류가 아니다(안드로이드 · iOS 둘 다 'Share canceled'). */
export function isShareCancel(e: unknown): boolean {
  return /cancel/i.test(e instanceof Error ? e.message : String(e));
}

/** 파일 이름에 경로가 섞이면 캐시 밖으로 나갈 수 있다 — 이름만 쓴다 */
export function safeShareName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+/, "").trim();
  return clean || "haru-file";
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

type Fs = typeof import("@capacitor/filesystem");

/** 지난 공유 파일 정리 — 실패해도 공유는 막지 않는다(캐시는 OS 도 치운다). */
async function sweepShared({ Directory, Filesystem }: Fs, keep: string, now = Date.now()): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({ path: SHARE_DIR, directory: Directory.Cache });
    await Promise.all(
      files
        .filter((f) => f.type === "file" && f.name !== keep && now - Number(f.mtime ?? 0) > SHARE_KEEP_MS)
        .map((f) => Filesystem.deleteFile({ path: `${SHARE_DIR}/${f.name}`, directory: Directory.Cache }).catch(() => undefined)),
    );
  } catch {
    /* 폴더가 아직 없다 · 옛 플러그인 */
  }
}

/** 앱이면 파일을 나눠 쓰고 공유 시트를 연다. 결과: shared · cancelled(사용자가 닫음) · unsupported(브라우저).
 *  실제 오류(쓰기 실패 · 시트 열기 실패)는 던진다 — 부르는 쪽이 사용자에게 보여 준다. 한 번에 하나씩 불러야 한다
 *  (공유 시트가 열려 있는 동안 또 부르면 플러그인이 'Can't share while sharing is in progress' 로 거절한다). */
export async function shareFileInAppResult(blob: Blob, name: string, title = "하루"): Promise<ShareOutcome> {
  if (!nativePlatform()) return "unsupported";
  const [fs, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const { Directory, Filesystem } = fs;
  const file = safeShareName(name);
  const path = `${SHARE_DIR}/${file}`;
  await sweepShared(fs, file);
  let keepFile = false;
  try {
    let uri = "";
    const ranges = chunkRanges(blob.size);
    for (let i = 0; i < ranges.length; i += 1) {
      const data = await toBase64(blob.slice(ranges[i][0], ranges[i][1]));
      if (i === 0) ({ uri } = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true }));
      else await Filesystem.appendFile({ path, data, directory: Directory.Cache });
    }
    try {
      await Share.share({ title, files: [uri] });
    } catch (e) {
      if (isShareCancel(e)) return "cancelled";
      throw e;
    }
    keepFile = true; // 받는 앱이 아직 읽는 중일 수 있다 — 다음 공유의 sweep 이 지운다
    return "shared";
  } finally {
    if (!keepFile) await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined);
  }
}

/** 앱이면 공유 시트를 열고 true. 사용자가 시트를 닫아도 true(다시 묻지 않는다). */
export async function shareFileInApp(blob: Blob, name: string, title = "하루"): Promise<boolean> {
  return (await shareFileInAppResult(blob, name, title)) !== "unsupported";
}
