// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
export type JosaPair = "이/가" | "을/를" | "은/는" | "과/와" | "으로/로" | "이에요/예요";

function batchim(word: string): { has: boolean; rieul: boolean } | null {
  const last = word.trim().slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { has: jong !== 0, rieul: jong === 8 };
  }
  if (/[0-9]/.test(last)) return { has: "013678".includes(last), rieul: "178".includes(last) };
  return null;
}

export function josa(word: string, pair: JosaPair): string {
  const [withB, without] = pair.split("/") as [string, string];
  const b = batchim(word);
  if (!b) return word + without;
  if (pair === "으로/로" && b.rieul) return word + without;
  return word + (b.has ? withB : without);
}
