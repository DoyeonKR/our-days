/* 앱(WebView)에서 파일 저장 · 공유 — 앱 안엔 navigator.share 도, blob 내려받기도 없어서 눌러도 아무 일이 없었다(2026-11-06).
 * 캐시에 파일을 쓰고 휴대폰의 공유 시트를 연다(사진첩 저장 · 파일 저장 · 카톡 전송을 거기서 고른다).
 * 브라우저에선 false 를 돌려주고 아무것도 안 한다 — 부르는 쪽이 원래 길(웹 공유 · 내려받기)로 간다. */
import { nativePlatform } from "./nativeplatform.ts";

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/** 앱이면 공유 시트를 열고 true. 사용자가 시트를 닫아도 true(다시 묻지 않는다). */
export async function shareFileInApp(blob: Blob, name: string, title = "하루"): Promise<boolean> {
  if (!nativePlatform()) return false;
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  // 파일 이름에 경로가 섞이면 캐시 밖으로 나갈 수 있다 — 이름만 쓴다
  const path = name.replace(/[\\/:*?"<>|]+/g, "-");
  const { uri } = await Filesystem.writeFile({ path, data: await toBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title, files: [uri] });
  } catch (e) {
    if (!/cancel/i.test(e instanceof Error ? e.message : String(e))) throw e;
  }
  return true;
}
