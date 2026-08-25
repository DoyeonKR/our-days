/**
 * Realtime 재연결 뒤 서버 스냅샷과 아직 저장 응답을 기다리는 낙관적 쿡을 합친다.
 *
 * 서버 목록으로 통째 교체하면 전송 중인 tmp 행이 사라지고, 반대로 단순 append 하면
 * 재연결 공백에 들어온 행과 기존 행이 중복된다. 같은 내용의 서버 행은 tmp 한 개와만
 * 짝지어 동일 문구를 빠르게 연속 전송한 경우도 보존한다.
 */
export type PokeLike = {
  id: string;
  from_user: string;
  kind: string;
  message: string | null;
};

function sameSend(a: PokeLike, b: PokeLike): boolean {
  return (
    a.from_user === b.from_user &&
    a.kind === b.kind &&
    (a.message ?? "") === (b.message ?? "")
  );
}

export function reconcilePokeSnapshot<T extends PokeLike>(
  snapshot: readonly T[],
  current: readonly T[],
  limit = 200,
): T[] {
  const matched = new Set<number>();
  const pending = current.filter((row) => row.id.startsWith("tmp-")).filter((tmp) => {
    const i = snapshot.findIndex((server, index) => !matched.has(index) && sameSend(tmp, server));
    if (i < 0) return true;
    matched.add(i);
    return false;
  });

  const seen = new Set(pending.map((row) => row.id));
  /* 삽입 전용 데이터라 **합집합**이 정답이다. 스냅샷 SELECT 이후 확정돼 이미 화면에 있는
     실 id 행(재연결 공백에 realtime 으로 먼저 도착했거나 confirmPokeSend 로 치환된 것)을
     '스냅샷에 없다'고 버리면, 방금 배너·알림까지 뜬 쿡이 채팅에서 사라진다 [리뷰 2026-08-26].
     pokes 는 삭제가 없어 잔존 걱정이 없고, 순서상 스냅샷보다 새 행이라 앞에 둔다. */
  const snapshotIds = new Set(snapshot.map((row) => row.id));
  const fresh = current.filter(
    (row) => !row.id.startsWith("tmp-") && !snapshotIds.has(row.id) && !seen.has(row.id),
  );
  for (const row of fresh) seen.add(row.id);
  const server = snapshot.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return [...pending, ...fresh, ...server].slice(0, limit);
}

/** 실시간 INSERT 한 건을 합친다. 같은 문구의 tmp가 여러 개여도 한 개만 확정 처리한다. */
export function mergePokeInsert<T extends PokeLike>(
  incoming: T,
  current: readonly T[],
  limit = 200,
): T[] {
  if (current.some((row) => row.id === incoming.id)) return current.slice() as T[];
  let matched = false;
  const remaining = incoming.id.startsWith("tmp-")
    ? current
    : current.filter((row) => {
        if (!matched && row.id.startsWith("tmp-") && sameSend(row, incoming)) {
          matched = true;
          return false;
        }
        return true;
      });
  return [incoming, ...remaining].slice(0, limit);
}

/** 전송 API 응답으로 특정 tmp를 확정한다. echo가 먼저 와 tmp가 없어도 저장 행은 보존한다. */
export function confirmPokeSend<T extends PokeLike>(
  current: readonly T[],
  tmpId: string,
  saved: T | null,
  limit = 200,
): T[] {
  if (!saved) return current.filter((row) => row.id !== tmpId);
  if (current.some((row) => row.id === saved.id)) {
    return current.filter((row) => row.id !== tmpId);
  }
  const index = current.findIndex((row) => row.id === tmpId);
  if (index < 0) return [saved, ...current].slice(0, limit);
  return current.map((row, i) => (i === index ? saved : row));
}
