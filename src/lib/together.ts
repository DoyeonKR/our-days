// 함께 탭의 작은 순수 판정 (2026-11-05).

/** 초대코드가 만료됐는가. 만료일이 없으면(옛 행) 살아 있는 것으로 본다 — inviteExpiryText 와 같은 기준. */
export function isInviteExpired(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isFinite(t) || t <= now;
}
