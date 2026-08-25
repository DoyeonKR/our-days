export function normalizeInviteCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, "")
    .slice(0, 6);
}

export function inviteCodeFromHref(href: string): string | null {
  try {
    const code = normalizeInviteCode(new URL(href).searchParams.get("invite") ?? "");
    return code.length >= 4 ? code : null;
  } catch {
    return null;
  }
}

export function buildInviteUrl(href: string, code: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", normalizeInviteCode(code));
  return url.toString();
}

export function inviteExpiryText(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "만료일 없음";
  const expires = new Date(iso).getTime();
  if (!Number.isFinite(expires) || expires <= now) return "만료됨";
  const days = Math.max(1, Math.ceil((expires - now) / 86_400_000));
  return `${days}일 뒤 만료`;
}
