// 일기장(타임라인/회상/검색) 순수 로직 — UI·데이터 계층과 분리해 테스트 용이.

type DatedEntry = { entry_date: string };

/** 'YYYY-MM' 월 키. */
export function entryMonthKey(e: DatedEntry): string {
  return e.entry_date.slice(0, 7);
}

/** 'YYYY-MM' → '2026년 7월'. */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** entry_date 로 월별 그룹(최신 월 먼저, 그룹 내 원래 순서 유지). */
export function groupByMonth<T extends DatedEntry>(
  entries: T[],
): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const k = entryMonthKey(e);
    const arr = map.get(k);
    if (arr) arr.push(e);
    else map.set(k, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({ key, label: monthLabel(key), items }));
}

// '작년 오늘'(onThisDay·yearsAgo)과 기분 집계(moodCounts)는 2026-09-24 에 뺐다 — 일기장 안의 두 블록이
// 기록 › 추억 칸으로 합쳐지면서 lib/memories(onThisDayMemories · monthlyRecap.moods)가 같은 일을 한다.

/**
 * 기록 히트맵 셀 — 최근 `weeks`주를 주(열)×요일(행, 일~토) 격자로. 컬럼-메이저
 * (index i → 열 floor(i/7), 행 i%7). 각 셀은 그 날 일기 유무. 오늘 이후(현재 주의
 * 미래 요일)는 null. 순수(테스트 용이) — endIso 를 받아 결정적.
 */
export function heatmapCells(
  entries: { entry_date: string }[],
  endIso: string,
  weeks = 24,
): ({ iso: string; has: boolean } | null)[] {
  const has = new Set(entries.map((e) => e.entry_date));
  const [ey, em, ed] = endIso.split("-").map(Number);
  const end = new Date(ey, em - 1, ed); // 로컬 자정
  // day 0 = 첫 열의 일요일: 뒤로 (weeks-1)*7 + 오늘 요일 만큼
  const back = (weeks - 1) * 7 + end.getDay();
  const cells: ({ iso: string; has: boolean } | null)[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - back + i);
    if (d.getTime() > end.getTime()) {
      cells.push(null); // 현재 주의 미래 요일
      continue;
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    cells.push({ iso, has: has.has(iso) });
  }
  return cells;
}

/**
 * 연속 기록일 — 오늘(또는 어제)부터 하루도 안 빠지고 일기가 있는 날 수.
 * 오늘·어제 둘 다 없으면 0(끊김). 결정적(todayIso 주입).
 */
export function currentStreak(entryDates: string[], todayIso: string): number {
  const set = new Set(entryDates);
  const [y, m, d] = todayIso.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
  // 오늘 없으면 어제부터 시작(오늘 아직 안 썼어도 어제까지 이어졌으면 살아있음)
  if (!set.has(iso(cur))) {
    cur.setDate(cur.getDate() - 1);
    if (!set.has(iso(cur))) return 0;
  }
  let count = 0;
  while (set.has(iso(cur))) {
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}

/* ── 해시태그 [2026-11-06 일기 리뷰] ─────────────────────────────────
 * 태그는 '#' 없이 저장한다(카드가 앞에 '#' 을 붙여 그린다). 예전 검색은 질의의 '#' 을 그대로 두고
 * 붙여 쓴 문자열에서 찾아서 "#여행" 이 0편이었다 — 사람은 태그를 '#여행' 으로 기억한다.
 * 저장할 때도 '##여행' · 중복 · 한 줄짜리 긴 태그가 그대로 들어갔다. 규칙을 여기 한 곳에 둔다. */
export const MAX_TAGS = 10;
export const MAX_TAG_LEN = 20;

/** 앞의 '#'(여러 개여도) 를 떼고 다듬은 한 낱말. 빈 문자열이면 태그가 아니다. */
export function cleanTag(raw: string): string {
  return [...raw.trim().replace(/^#+/, "").trim()].slice(0, MAX_TAG_LEN).join("");
}

/** 입력칸 글('#여행, #제주 맛집') 또는 배열 → 저장할 태그 목록. 대소문자만 다른 중복도 하나로. */
export function normalizeTags(input: string | readonly string[]): string[] {
  const parts = typeof input === "string" ? input.split(/[\s,]+/) : input.flatMap((t) => t.split(/[\s,]+/));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = cleanTag(p);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * 검색 — 낱말마다(공백으로 나눔) 모두 맞아야 한다(AND). '#' 로 시작하는 낱말은 해시태그에서만 찾는다.
 * 대소문자 무시, 빈 질의는 항상 true.
 * 예전엔 질의 전체를 한 덩어리로 찾아서 "제주 바다"처럼 떨어진 두 낱말은 못 찾았다.
 */
export function matchesQuery(
  e: {
    title?: string | null;
    body?: string | null;
    location?: string | null;
    hashtags?: string[];
  },
  q: string,
): boolean {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const tags = (e.hashtags ?? []).map((t) => cleanTag(t).toLowerCase());
  const hay = [e.title, e.body, e.location, ...tags].filter(Boolean).join(" ").toLowerCase();
  return tokens.every((tok) => {
    if (tok.startsWith("#")) {
      const t = cleanTag(tok).toLowerCase();
      return !t || tags.some((x) => x.includes(t));
    }
    return hay.includes(tok);
  });
}

/** 태그 구름 — 많이 쓴 순(같으면 가나다순), 상위 limit 개. */
export function tagCloud(entries: { hashtags?: string[] }[], limit = 12): { tag: string; n: number }[] {
  const m = new Map<string, { tag: string; n: number }>();
  for (const e of entries) {
    const seen = new Set<string>(); // 한 일기 안의 같은 태그('a' · 'A')는 한 번만 센다
    for (const raw of (e.hashtags ?? []).map(cleanTag)) {
      const k = raw.toLowerCase();
      if (!raw || seen.has(k)) continue;
      seen.add(k);
      const cur = m.get(k);
      if (cur) cur.n++;
      else m.set(k, { tag: raw, n: 1 });
    }
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag, "ko")).slice(0, limit);
}

/** 검색칸에서 태그 하나를 켜고/끄는 결과 — 칩을 누를 때. 다른 낱말은 그대로 둔다. */
export function toggleTagQuery(q: string, tag: string): string {
  const t = cleanTag(tag);
  if (!t) return q;
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  const key = `#${t}`.toLowerCase();
  const has = tokens.some((x) => x.toLowerCase() === key);
  return (has ? tokens.filter((x) => x.toLowerCase() !== key) : [...tokens, `#${t}`]).join(" ");
}

/** 검색칸이 그 태그를 켜 두었는지(칩의 눌림 표시). */
export function hasTagQuery(q: string, tag: string): boolean {
  const key = `#${cleanTag(tag)}`.toLowerCase();
  return q.trim().split(/\s+/).some((x) => x.toLowerCase() === key);
}

/* ── 교환일기 보기 [F4] ─────────────────────────────────────────────
 * 같은 날 둘이 쓴 일기를 나란히. 한쪽만 썼으면 다른 칸은 '기다리는 중'. 날짜는 최신 먼저. */
export function exchangeDays<T extends { entry_date: string; created_by: string }>(
  entries: readonly T[],
  myUserId: string | null,
): { date: string; mine: T[]; partner: T[] }[] {
  const m = new Map<string, { date: string; mine: T[]; partner: T[] }>();
  for (const e of entries) {
    let d = m.get(e.entry_date);
    if (!d) m.set(e.entry_date, (d = { date: e.entry_date, mine: [], partner: [] }));
    (e.created_by === myUserId ? d.mine : d.partner).push(e);
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ── 초안 [2026-11-06] ──────────────────────────────────────────────
 * 새 일기 초안 키에 날짜를 넣었더니, 밤에 쓰다 자정을 넘기면 어제 키에 남은 글을 다시 열 길이 없었다(고아).
 * 이제 키는 날짜 없이 커플마다 하나, 날짜는 초안 안에 둔다 — 지난 날짜면 "어제 쓰던 글이 있어요" 로 묻는다.
 * 고친 일기의 초안은 원본의 updated_at(없으면 created_at)을 base 로 같이 저장한다 — 다른 기기에서 더 새로
 * 고쳤으면(base 가 다르면) 옛 초안이 새 글을 덮지 않게 버린다. */
export function isStaleDraft(draftDate: string | null | undefined, todayIso: string): boolean {
  return !draftDate || draftDate < todayIso;
}
export function entryVersion(e: { updated_at?: string | null; created_at: string }): string {
  return e.updated_at || e.created_at;
}
/** 옛 날짜 키(ourdays:draft:diary:<커플>:YYYY-MM-DD) 중 가장 최근 것 — 새 키로 한 번 옮긴다. */
export function legacyDraftKey(keys: readonly string[], coupleId: string): string | null {
  const prefix = `ourdays:draft:diary:${coupleId}:`;
  const dated = keys.filter((k) => k.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(prefix.length))).sort();
  return dated.at(-1) ?? null;
}
export function legacyDraftDate(key: string): string | null {
  return /:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1] ?? null;
}

/* ── 실시간 반영 [2026-11-06] ───────────────────────────────────────
 * 예전엔 한 행이 바뀌면 일기 · 반응 · 댓글을 통째로 다시 받았다(197편 + 서명 400개). 반응 · 댓글은 소켓이
 * 준 행을 그대로 적용하고, 일기는 그 한 편만 다시 읽는다. 연결이 다시 붙으면(resync) 예전처럼 통째로.
 * 돌려주는 값이 null 이면 '이 신호로는 못 고친다' — 부르는 쪽이 통째로 다시 받는다. */
export type RowPayload = { eventType: string; new?: unknown; old?: unknown };
export function applyRowChange<T extends { id: string }>(
  list: readonly T[],
  p: RowPayload,
  sortKey?: (x: T) => string,
): T[] | null {
  if (p.eventType === "DELETE") {
    const id = (p.old as { id?: string } | undefined)?.id;
    return id ? list.filter((x) => x.id !== id) : null;
  }
  if (p.eventType !== "INSERT" && p.eventType !== "UPDATE") return null;
  const row = p.new as T | undefined;
  if (!row?.id) return null;
  const next = list.some((x) => x.id === row.id)
    ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x))
    : [...list, row];
  if (!sortKey) return next;
  return next.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** 일기 목록 정렬(서버와 같은 규칙) — 날짜 최신 먼저, 같은 날은 늦게 쓴 글 먼저. */
export function sortEntries<T extends { entry_date: string; created_at: string }>(list: T[]): T[] {
  return list.sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });
}

/* ── 날씨 꼬리표 [F7] ───────────────────────────────────────────────
 * 저장할 때 오늘(KST) 예보 캐시에서 한 줄만 붙인다 — 도시 단위('서울 · 맑음 21°/12°'). 위치 권한은 묻지 않는다.
 * 오늘 칸이 없는 캐시(며칠 묵음)면 붙이지 않는다 — 다른 날 날씨를 붙이면 그건 거짓말이다. */
export function weatherTag(
  fc:
    | { daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } }
    | null
    | undefined,
  placeName: string,
  todayIso: string,
  labelOf: (code: number) => string,
): string | null {
  const d = fc?.daily;
  if (!d?.time) return null;
  const i = d.time.indexOf(todayIso);
  if (i < 0) return null;
  const hi = d.temperature_2m_max?.[i];
  const lo = d.temperature_2m_min?.[i];
  const temp = Number.isFinite(hi) && Number.isFinite(lo) ? ` ${Math.round(hi)}°/${Math.round(lo)}°` : "";
  return `${placeName} · ${labelOf(d.weather_code?.[i] ?? 3)}${temp}`.slice(0, 60);
}

/* ── 일기책 내보내기 [F8] ───────────────────────────────────────────
 * 고른 해(또는 기간)의 일기를 인쇄용 HTML 한 장으로 — 새 창에서 열고 '인쇄 → PDF 로 저장'.
 * 사용자 글은 전부 이스케이프한다(제목에 태그를 쓰면 그 창에서 실행되면 안 된다). 사진은 지금 받은 서명 URL. */
export function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}
export type BookEntry = {
  entry_date: string;
  title: string | null;
  body: string | null;
  location: string | null;
  mood_emoji: string | null;
  hashtags: string[];
  photo_urls: string[];
  weather?: string | null;
  created_by: string;
};
export function diaryBookHtml(
  entries: readonly BookEntry[],
  opts: { title: string; from: string; to: string; nameOf: (uid: string) => string },
): string {
  const picked = entries
    .filter((e) => e.entry_date >= opts.from && e.entry_date <= opts.to)
    .slice()
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0));
  const pages = picked
    .map((e) => {
      const head = [e.entry_date.replaceAll("-", "."), opts.nameOf(e.created_by), e.mood_emoji ?? ""]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" · ");
      const meta = [e.location, e.weather].filter((x): x is string => !!x).map(escapeHtml).join(" · ");
      const photos = e.photo_urls.length
        ? `<div class="ph">${e.photo_urls.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join("")}</div>`
        : "";
      const tags = e.hashtags.length ? `<p class="tg">${e.hashtags.map((t) => `#${escapeHtml(t)}`).join(" ")}</p>` : "";
      const title = e.title ? `<h2>${escapeHtml(e.title)}</h2>` : "";
      const body = e.body ? `<p class="bd">${escapeHtml(e.body)}</p>` : "";
      return `<section class="pg"><p class="hd">${head}</p>${meta ? `<p class="mt">${meta}</p>` : ""}${title}${photos}${body}${tags}</section>`;
    })
    .join("\n");
  const css = [
    "body{font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#2c2027;margin:0;padding:24px;word-break:keep-all;overflow-wrap:anywhere}",
    ".bk{font-size:22px;font-weight:800;margin:0 0 4px}.sub{color:#93818b;font-size:13px;margin:0 0 24px}",
    ".pg{break-inside:avoid;page-break-inside:avoid;border-top:1px solid #f0d5df;padding:16px 0}",
    ".hd{font-size:12px;font-weight:700;color:#e5407a;margin:0}.mt{font-size:12px;color:#93818b;margin:2px 0 0}",
    "h2{font-size:16px;margin:8px 0 0}.bd{white-space:pre-wrap;line-height:1.7;font-size:14px;margin:8px 0 0}",
    ".tg{font-size:12px;color:#e5407a;margin:8px 0 0}.ph{display:flex;gap:8px;margin-top:8px}",
    ".ph img{max-width:48%;max-height:260px;object-fit:cover;border-radius:12px}",
    "@media print{body{padding:0}}",
  ].join("");
  const range = `${opts.from.replaceAll("-", ".")} ~ ${opts.to.replaceAll("-", ".")} · ${picked.length}편`;
  return (
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(opts.title)}</title><style>${css}</style></head><body>` +
    `<p class="bk">${escapeHtml(opts.title)}</p><p class="sub">${range}</p>${pages || "<p>이 기간엔 일기가 없어요.</p>"}</body></html>`
  );
}
