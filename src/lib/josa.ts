// 받침에 맞는 조사 — "튤립이(가)" · "달 를" 같은 문장을 만들지 않으려고. [2026-09-24]
//
// 화면 문장에 이름을 끼울 때 조사를 괄호로 둘 다 적거나(을(를)) 한쪽으로 고정하면 절반은 틀린다
// (꾸미기 힌트가 실제로 "달 를 사서 나란히 놓아 보세요" 라고 떴다). 마지막 글자의 받침으로 고른다.
// 한글이 아니면(영문·기호) 받침 없는 쪽을 쓴다 — 숫자는 읽는 소리로 판단한다(1 일 · 3 삼 …).

export type JosaPair = "이/가" | "을/를" | "은/는" | "과/와" | "으로/로" | "이에요/예요";

/** 마지막 글자에 받침이 있나. 판단할 수 없으면 null. */
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

/** 단어 + 알맞은 조사. `josa("달", "을/를")` → "달을", `josa("튤립", "이/가")` → "튤립이". */
export function josa(word: string, pair: JosaPair): string {
  const [withB, without] = pair.split("/") as [string, string];
  const b = batchim(word);
  if (!b) return word + without;
  // '으로'는 ㄹ 받침이면 '로'(물로 · 길로) — 받침이 있어도 예외
  if (pair === "으로/로" && b.rieul) return word + without;
  return word + (b.has ? withB : without);
}
