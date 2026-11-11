/** 화면이 미리 만드는 행 id(uuid v4) — 응답을 잃고 다시 보내도 같은 id 라 서버의 unique 가 중복 줄을 막는다.
 *  page.tsx 의 newEventId 와 같은 식(randomUUID 가 없는 옛 브라우저는 getRandomValues 로 같은 모양). */
export function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

/** 버킷 추가 재시도 — 같은 글 · 같은 분류를 다시 보내면 지난번 id 를 다시 쓴다(첫 요청이 들어갔으면 23505 = 성공).
 *  다른 글이면 새 id. 순수 — 테스트가 직접 부른다. */
export type PendingAdd = { id: string; title: string; category: string };
export function retryIdFor(pending: PendingAdd | null, title: string, category: string, fresh: () => string): string {
  return pending && pending.title === title && pending.category === category ? pending.id : fresh();
}
