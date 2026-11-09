// PWA 서비스워커 — 재배포 후 stale chunk 문제 회피 + basePath(하위경로) 무관 동작.
// 경로는 sw.js 위치 기준 상대(addAll)로 해석되어 /our-days/ 하위에서도 맞는다.
// v10(2026-08-25): res.ok 가드·스코프 필터·pushsubscriptionchange·옛 청크 청소.
// v11(2026-11-05, 앱 공통 리뷰 README §10.13):
//   · 청소가 activate 에서만 돌아 SW 가 안 바뀌면 옛 청크가 계속 쌓였다 → 페이지가 하루 한 번 {type:"gc"} 를 보내면 청소한다.
//   · 문서를 쿼리째 저장해(?f=<id> 알림 주소) 같은 화면이 여러 벌 쌓였다 → 경로만으로 저장 · ignoreSearch 로 찾는다.
//   · iOS 는 푸시마다 알림을 안 띄우면 구독을 끊을 수 있다 → 앱이 앞에 있어도 잠깐 띄웠다 닫는다.
//   · 공개 그림(heroes · aqua · fishing · merge · farm · island · assets · fonts)은 stale-while-revalidate + 상한.
//   버전을 올려 쿼리째 쌓인 v10 문서 · 청크를 한 번 비운다(다음 방문에 다시 채운다).
// 2026-11-09(README §10.23): 문서가 3.5초 안에 안 오면 저장된 같은 문서를 먼저 낸다(raceDocument) · 앱이 앞에 있어
//   쿡 알림을 숨길 때 그 창에 {type:"pokePush"} 를 보낸다. 캐시 모양은 그대로라 CACHE 이름은 안 올린다.
//
// ── 빠른 답장 토큰 계약(?pokeReply) ───────────────────────────────────────────────
// 알림의 답장 버튼으로 앱이 **새 창**으로 열릴 때만 쓴다(열린 창이 있으면 postMessage 로 바로 전한다).
//   1) SW: 토큰 t = 소문자 hex 32자(getRandomValues 16바이트). caches.open("ourdays:poke-reply-tokens") 에
//      키 self.location.origin + "/__ourdays/poke-reply/" + t, 값 new Response(JSON.stringify({ kind, exp: 지금 + 10분 })).
//      넣을 때 만료된 토큰을 같이 지운다.
//   2) SW: 알림 주소 + ("?" 가 있으면 "&" 없으면 "?") + "pokeReply=" + kind + "&t=" + t 를 연다(kind 는 영소문자만).
//   3) 앱(src/lib/pokereply.ts): 같은 캐시 · 같은 키의 토큰이 있고 kind 가 같고 만료 전이면 한 번 쓰고 지운다. 아니면 보내지 않는다
//      — 주소만 아는 링크(외부에서 만든 ?pokeReply=)로 쿡이 저절로 나가지 않게.
//   캐시 이름 · 키 · 값 모양을 바꾸면 양쪽을 같이 바꾼다. 만료 토큰은 gc 도 지운다.
const CACHE = "ourdays-v11";
const PRECACHE = ["./", "./manifest.webmanifest", "./icon-192.png", "./apple-touch-icon.png"];
// 사진첩 썸네일 전용 캐시(2026-11-06) — 서명 URL 은 토큰이 바뀔 때마다 주소가 달라져 HTTP 캐시가 빗나갔고,
// 매시간 재서명마다 썸네일을 전부 다시 받았다. 썸네일만 '토큰을 뗀 경로'로 저장해 토큰이 바뀌어도 같은 그림을 쓴다.
// · 대상은 couple-photos 버킷의 '.thumb.' 파일뿐(원본 · 영상 · 일기 사진은 그대로 네트워크).
// · 이 기기 안에만 남는다(커플 사진 썸네일). 로그아웃하면 앱이 이 캐시를 지운다(couple.ts clearSignedUrlCache).
// · 경로는 올릴 때마다 새 이름(시각+난수)이라 같은 경로의 내용이 바뀌지 않는다 — 캐시가 낡을 일이 없다.
const THUMBS = "ourdays-thumbs-v1";
const THUMB_MAX = 1500;
// 공개 그림 캐시 — 앱 버전과 무관해 배포마다 비우지 않는다. 개수 · 바이트 상한으로 오래 넣은 것부터 덜어 낸다.
const ART = "ourdays-art-v1";
const ART_MAX = 600;
const ART_MAX_BYTES = 80 * 1024 * 1024;
const ART_DIRS = ["heroes/", "aqua/", "fishing/", "merge/", "farm/", "island/", "assets/", "fonts/"];
const POKE_REPLY = "ourdays:poke-reply-tokens"; // src/lib/pokereply.ts 와 같은 이름
// _next/static 상한 — 한 배포가 대략 150~250개라 두세 배포 분량이면 충분하다
const STATIC_MAX = 500;
const GC_EVERY_MS = 86400000;
const GC_STAMP = "./__sw-gc-at";

/** 썸네일이면 토큰을 뗀 캐시 키, 아니면 null. */
function thumbKey(url) {
  if (url.pathname.indexOf("/storage/v1/object/sign/couple-photos/") < 0) return null;
  if (!/\.thumb\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return url.origin + url.pathname;
}

/** 공개 그림이면 true — 이 앱 스코프 안의 정해진 폴더만. */
function isArt(url) {
  const root = appRootUrl();
  if (url.origin !== root.origin || url.pathname.indexOf(root.pathname) !== 0) return false;
  const rest = url.pathname.slice(root.pathname.length);
  return ART_DIRS.some((d) => rest.indexOf(d) === 0);
}

/** 문서 캐시 키 — 쿼리를 뗀 경로 하나(?f= · ?go= 가 달라도 같은 화면이다). */
function docKey(url) {
  return url.origin + url.pathname;
}

// 문서 네트워크 기다림 상한(2026-11-09) — 넘으면 저장해 둔 같은 문서를 먼저 낸다(캐시가 없으면 계속 기다린다).
const DOC_TIMEOUT_MS = 3500;

/** 네트워크 문서(net)와 시간 제한을 겨룬다. 제때 오면 그것, 늦으면 저장된 문서(getCached) — 그때도 net 은 keep 으로
 *  살려 둬 도착하면 캐시를 갈아 끼운다. 저장된 문서가 없으면 net 을 그대로 기다린다. net 이 제한 전에 실패하면 던진다(호출부가 캐시로). */
async function raceDocument(net, getCached, ms, keep) {
  const LATE = {};
  let timer;
  const late = new Promise((r) => {
    timer = setTimeout(() => r(LATE), ms);
  });
  let first;
  try {
    first = await Promise.race([net, late]);
  } finally {
    clearTimeout(timer);
  }
  if (first !== LATE) return first;
  const cached = await getCached();
  if (cached) {
    keep(net.catch(() => {}));
    return cached;
  }
  return net;
}

/** WebKit(사파리 · iOS 홈 화면 앱) — 조용한 푸시를 벌하는 엔진. */
function isWebKitPush() {
  const ua = (self.navigator && self.navigator.userAgent) || "";
  return /AppleWebKit/i.test(ua) && !/(Chrome|Chromium|Android|Edg|Firefox)\//i.test(ua);
}

/** 답장 토큰 — 소문자 hex 32자. 안전한 난수가 없으면 null(토큰 없이 열면 앱이 보내지 않는다 — 안전한 쪽). */
function randomToken() {
  try {
    const b = new Uint8Array(16);
    self.crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function replyTokenKey(t) {
  return self.location.origin + "/__ourdays/poke-reply/" + t;
}

/** 만료(exp 지남) · 깨진 답장 토큰을 지운다 */
async function purgeReplyTokens(c) {
  for (const k of await c.keys()) {
    let exp = 0;
    try {
      const res = await c.match(k);
      exp = Number(JSON.parse(await res.text()).exp) || 0;
    } catch {
      exp = 0;
    }
    if (exp < Date.now()) await c.delete(k);
  }
}

const trimming = {};
/** 넣은 순서대로 돌아온다 — 오래 넣은 것부터 max 개만 남긴다. */
async function trimCache(name, max) {
  if (trimming[name]) return;
  trimming[name] = true;
  try {
    const c = await caches.open(name);
    const keys = await c.keys();
    for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
  } catch {
    /* 정리 실패는 무해 */
  } finally {
    trimming[name] = false;
  }
}
const trimThumbs = () => trimCache(THUMBS, THUMB_MAX);

/** 하루 한 번 청소. keep = 지금 페이지가 쓰는 _next/static 주소(페이지가 보낸다). */
async function gc(keep) {
  const c = await caches.open(CACHE);
  const stamp = await c.match(GC_STAMP);
  const last = stamp ? Number(await stamp.text()) : 0;
  if (last && Date.now() - last < GC_EVERY_MS) return;
  await c.put(GC_STAMP, new Response(String(Date.now())));
  const keepSet = new Set((keep || []).map((u) => String(u).split("#")[0]));
  const cutoff = Date.now() - 7 * 86400000;
  const statics = [];
  for (const r of await c.keys()) {
    const u = new URL(r.url);
    if (u.pathname.indexOf("/_next/static/") >= 0) {
      if (keepSet.has(r.url)) continue;
      // 지금 페이지가 안 쓰고 7일 넘게 묵은 청크 = 옛 배포
      const res = await c.match(r);
      const at = res && Date.parse(res.headers.get("date") || "");
      if (at && at < cutoff) await c.delete(r);
      else statics.push(r);
    } else if (u.search) {
      // v10 이 쿼리째 저장한 문서 — 경로 키 하나로 충분하다
      await c.delete(r);
    }
  }
  // 상한은 청크에만 — 앱 셸(프리캐시) · 문서는 덜어 내지 않는다. 지금 페이지가 쓰는 청크는 위에서 빠져 있다.
  for (let i = 0; i < statics.length - STATIC_MAX; i++) await c.delete(statics[i]);
  await trimThumbs();
  // 그림: 개수 상한 + content-length 합 상한
  try {
    const a = await caches.open(ART);
    const keys = await a.keys();
    let bytes = 0;
    const sizes = [];
    for (const k of keys) {
      const res = await a.match(k);
      const n = Number((res && res.headers.get("content-length")) || 0);
      sizes.push(n);
      bytes += n;
    }
    for (let i = 0; i < keys.length && (keys.length - i > ART_MAX || bytes > ART_MAX_BYTES); i++) {
      bytes -= sizes[i];
      await a.delete(keys[i]);
    }
  } catch {
    /* 무해 */
  }
  // 쓰지 않고 만료된 답장 토큰
  try {
    await purgeReplyTokens(await caches.open(POKE_REPLY));
  } catch {
    /* 무해 */
  }
}

function appRootUrl() {
  return new URL(self.registration.scope || "./", self.location.href);
}

// 이 앱 스코프의 창만 — 같은 오리진(doyeonkr.github.io)에 다른 프로젝트 페이지(날씨 앱 등)도
// 있어서, 오리진 전체 matchAll 을 그대로 쓰면 남의 탭이 알림을 삼키고 클릭 포커스를 가로챈다.
async function appWindows() {
  const root = appRootUrl().href;
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return all.filter((c) => c.url && c.url.indexOf(root) === 0);
}

function notificationTargetUrl(raw) {
  const appRoot = appRootUrl();
  if (!raw || raw === "/" || raw === "./") return appRoot.href;
  const value = String(raw);
  if (value.startsWith("//")) return appRoot.href;

  let target;
  try {
    target = value.startsWith("/")
      ? new URL(value, appRoot.origin)
      : new URL(value, appRoot.href);
  } catch {
    return appRoot.href;
  }

  if (target.origin !== appRoot.origin) return appRoot.href;
  if (target.pathname.startsWith(appRoot.pathname)) return target.href;
  return appRoot.href;
}

self.addEventListener("install", (e) => {
  // addAll 은 하나라도 404 면 전체 reject → install 실패로 워커가 영영 안 뜨는 사고(2026-07 icon.svg 삭제)가 있었다.
  // 개별 add + allSettled 로 프리캐시 일부 실패가 설치를 죽이지 않게 한다.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // 썸네일 · 그림 · 답장 토큰 캐시는 앱 버전과 무관하다 — 배포마다 비우면 처음부터 다시 받는다(토큰은 답장이 끊긴다)
        Promise.all(keys.filter((k) => k !== CACHE && k !== THUMBS && k !== ART && k !== POKE_REPLY).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// 페이지 → SW 메시지. gc 는 하루 한 번만 실제로 돈다(도장은 캐시에 — SW 는 수시로 꺼져 전역 변수가 사라진다).
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "gc") {
    const keep = Array.isArray(d.keep) ? d.keep.slice(0, 2000) : [];
    e.waitUntil(gc(keep).catch(() => {}));
  }
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 1) 문서(내비게이션): 항상 네트워크 우선(no-store), 오프라인이면 캐시 폴백(마지막으로 본 문서).
  if (request.mode === "navigate") {
    // no-store: HTTP 캐시(max-age)까지 우회해 항상 최신 문서 → 옛 청크에 안 묶임.
    // 이벤트 수명 연장 — 응답을 돌려준 뒤에 부르면 던질 수 있어 감싼다
    const keep = (p) => {
      try {
        e.waitUntil(p);
      } catch {
        /* 이미 끝난 이벤트 */
      }
    };
    e.respondWith(
      (async () => {
        const net = (async () => {
          const res = await fetch(request, { cache: "no-store" });
          // 성공 문서는 **경로 키**로 갱신 저장 — 쿼리째 저장하면 알림 주소(?f=<id>)마다 한 벌씩 쌓인다
          if (res.ok) {
            const copy = res.clone();
            keep(caches.open(CACHE).then((c) => c.put(docKey(url), copy)).catch(() => {}));
            return res;
          }
          if (res.status !== 404) return res;
          // 404 → 앱 루트로 폴백 (알림 클릭 등 잘못된 하위경로 진입 구제)
          const appRoot = appRootUrl();
          if (url.origin === appRoot.origin && url.pathname.startsWith(appRoot.pathname)) {
            const rootRes = await fetch(appRoot.href, { cache: "no-store" });
            if (rootRes.ok) return rootRes;
          }
          return res;
        })();
        try {
          // 3.5초 안에 문서가 안 오면(지하철 · 약한 와이파이) 마지막으로 본 같은 문서를 먼저 보여 준다(2026-11-09).
          // 예전엔 끊김(throw)일 때만 캐시로 갔고, 느린 연결에선 흰 화면으로 수십 초를 기다렸다.
          // 늦게 온 새 문서는 버리지 않고 캐시만 갱신한다 — 다음에 열 때 새 판, 지금 판은 UpdateChip 이 새 버전을 알아챈다.
          return await raceDocument(net, () => caches.match(docKey(url), { ignoreSearch: true }), DOC_TIMEOUT_MS, keep);
        } catch {
          return (
            (await caches.match(docKey(url), { ignoreSearch: true })) ||
            (await caches.match(request, { ignoreSearch: true })) ||
            caches.match(appRootUrl().href, { ignoreSearch: true })
          );
        }
      })(),
    );
    return;
  }

  // 2) 해시된 불변 정적 자산(_next/static): cache-first (basePath 유무 무관하게 매칭).
  if (url.pathname.includes("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          // fetch 실패(일시적 네트워크 오류) 시에도 캐시 폴백 — 폴백까지 실패해야 reject.
          fetch(request)
            .then((res) => {
              // ⚠ res.ok 일 때만 저장 — cache-first 라 404/503 을 저장하면 그 청크가 영구히 실패 응답을 받는다.
              if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
              }
              return res;
            })
            .catch(() => caches.match(request)),
      ),
    );
    return;
  }

  // 3) 사진첩 썸네일: 토큰을 뗀 경로로 캐시 우선. cors 로 다시 받아야 응답 상태를 볼 수 있다
  //    (img 의 no-cors 응답은 불투명이라 실패도 저장되고, 크롬은 불투명 응답을 몇 MB 로 쳐서 용량을 잡아먹는다).
  const tKey = thumbKey(url);
  if (tKey) {
    e.respondWith(
      (async () => {
        try {
          const c = await caches.open(THUMBS);
          const hit = await c.match(tKey);
          if (hit) return hit;
          const res = await fetch(request.url, { mode: "cors", credentials: "omit" });
          if (res.ok) {
            const copy = res.clone();
            c.put(tKey, copy).then(trimThumbs).catch(() => {});
          }
          return res;
        } catch {
          return fetch(request);
        }
      })(),
    );
    return;
  }

  // 4) 공개 그림 · 서체: stale-while-revalidate. 캐시가 있으면 바로 주고 뒤에서 새로 받아 둔다.
  //    ⚠ 200 만 저장한다 — Range 요청의 206 은 cache.put 이 거부하고, 실패 응답을 저장하면 그림이 계속 깨진다.
  if (isArt(url) && !request.headers.has("range")) {
    e.respondWith(
      (async () => {
        const c = await caches.open(ART);
        const hit = await c.match(request);
        const refresh = fetch(request)
          .then((res) => {
            if (res.status === 200 && res.type === "basic") {
              const copy = res.clone();
              c.put(request, copy).then(() => trimCache(ART, ART_MAX)).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
        if (hit) {
          e.waitUntil(refresh);
          return hit;
        }
        return (await refresh) || fetch(request);
      })(),
    );
    return;
  }

  // 5) 그 외: 네트워크 우선, 실패 시 캐시 폴백.
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

// 웹 푸시 수신 (앱이 닫혀 있어도 도착).
self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      let d = {};
      try {
        d = e.data ? e.data.json() : {};
      } catch {
        d = { body: e.data ? e.data.text() : "" };
      }
      const wins = await appWindows();
      const title = d.title || "💗 콕!";
      // 앱이 앞에 있으면 실시간 배너가 처리한다(중복 방지). 단 force(테스트)면 항상 표시.
      // 배너가 있는 건 쿡뿐이다 — 일기 반응 · 댓글 같은 알림은 앱을 보고 있어도 띄운다(2026-11-08, 예전엔 아무 표시 없이 사라졌다).
      const hasBanner = d.category === "poke" || (!d.category && /쿡|콕/.test(title));
      if (!d.force && hasBanner && wins.some((c) => c.focused)) {
        // 앞에 있는 창에 알린다(2026-11-09) — 폰이 잠에서 깬 직후엔 실시간 연결이 죽은 걸 25~50초 뒤에야 알아채,
        // 그 사이 온 쿡은 배너도 알림도 없이 사라졌다. 앱(CoupleSync)이 최근 쿡을 다시 읽어 쿡 id 로 거르므로 실시간과 겹쳐도 한 번만 뜬다.
        for (const c of wins) {
          if (c.focused) c.postMessage({ type: "pokePush", couple_id: d.couple_id || d.coupleId || null, body: d.body || "" });
        }
        // ⚠ WebKit 은 푸시마다 알림을 띄우지 않으면 구독을 끊을 수 있다(조용한 푸시 금지) — 고정 태그로 띄우고 곧 닫는다.
        if (!isWebKitPush()) return;
        const tag = "ourdays-foreground";
        await self.registration.showNotification(title, { body: d.body || "", tag, silent: true, icon: "./icon-192.png" });
        await new Promise((r) => setTimeout(r, 1500));
        const shown = await self.registration.getNotifications({ tag });
        for (const n of shown) n.close();
        return;
      }
      // 쿡찌르기 알림엔 빠른 답장 버튼(Android). category 우선, 없으면 제목 휴리스틱.
      const isPoke = d.category === "poke" || /쿡|콕/.test(title);
      const opts = {
        body: d.body || "콕!",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        data: { url: notificationTargetUrl(d.url) },
      };
      // 같은 태그는 쌓이지 않고 한 장이 갈린다(renotify 로 소리 · 진동은 다시). 서버가 준 tag(쿡은 "poke-<couple_id>")가 먼저,
      // 없으면 쿡은 couple_id 로, 그 밖엔 category 로(옛 함수가 보낸 페이로드).
      // ⚠ 아이폰(WebKit)은 renotify 를 안 지켜서 같은 태그의 새 알림이 소리 없이 갈린다 — 태그를 쓰지 않고 쌓는다(2026-11-08 [사용자: 일기 반응 알림이 안 온다]).
      const tag = isWebKitPush() ? "" : d.tag || (isPoke && (d.couple_id || d.coupleId) ? "poke-" + (d.couple_id || d.coupleId) : d.category);
      if (tag) {
        opts.tag = String(tag).slice(0, 64);
        opts.renotify = true;
      }
      if (isPoke) {
        opts.actions = [
          { action: "reply-love", title: "❤️ 사랑해" },
          { action: "reply-miss", title: "🥺 보고싶어" },
        ];
      }
      await self.registration.showNotification(title, opts);
    })(),
  );
});

// 브라우저가 푸시 구독을 교체/만료시키면(iOS PWA 만료, 푸시 토큰 회전) 여기로 온다.
// 처리 없이는 새 endpoint 가 서버에 저장될 길이 없어 푸시가 조용히 영영 끊긴다.
// 같은 키로 재구독하고, 열린 앱에 저장(re-sync)을 맡긴다. 앱이 닫혀 있으면
// 다음 부팅의 resyncPushSubscription(push.ts)이 현재 구독을 서버에 다시 올린다.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      try {
        const key =
          (e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey) || null;
        if (!key) return;
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        const wins = await appWindows();
        for (const c of wins) c.postMessage({ type: "pushResync" });
      } catch {
        /* 재구독 실패 — 다음 앱 부팅 re-sync 가 잡는다 */
      }
    })(),
  );
});

// 알림 클릭 → 앱 포커스(있으면) 또는 새 창. 빠른 답장 버튼은 kind 를 앱에 전달해 전송.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const action = e.action || "";
  const url = notificationTargetUrl(e.notification.data && e.notification.data.url);
  e.waitUntil(
    (async () => {
      const all = await appWindows();
      // 빠른 답장(reply-<kind>): 열린 앱이 있으면 postMessage 로 전송, 없으면 일회용 토큰과 함께 ?pokeReply 로 열기
      if (action.indexOf("reply-") === 0) {
        const kind = action.slice(6);
        if (!/^[a-z]{1,16}$/.test(kind)) return;
        if (all.length) {
          const c = all[0];
          if ("focus" in c) await c.focus();
          c.postMessage({ type: "pokeReply", kind });
          return;
        }
        if (self.clients.openWindow) {
          const t = randomToken();
          if (!t) return self.clients.openWindow(url); // 토큰 없이 ?pokeReply 를 열지 않는다
          try {
            const c = await caches.open(POKE_REPLY);
            await purgeReplyTokens(c);
            await c.put(replyTokenKey(t), new Response(JSON.stringify({ kind, exp: Date.now() + 600000 })));
          } catch {
            /* 토큰을 못 넣으면 앱이 답장을 보내지 않는다(안전한 쪽) — 앱은 그대로 열린다 */
          }
          return self.clients.openWindow(url + (url.indexOf("?") >= 0 ? "&" : "?") + "pokeReply=" + kind + "&t=" + t);
        }
        return;
      }
      // 일반 클릭 — 열린 앱이 있으면 앞으로 가져온 뒤 **어디로 갈지**(?go=)를 전한다.
      // 예전엔 focus 만 해서, 알림이 무엇이었든 앱이 보던 화면 그대로였다 [2026-09-24].
      // 새 창으로 열 땐 주소의 ?go= 를 앱이 부팅 때 읽는다(lib/activity 의 goKindOf).
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          c.postMessage({ type: "openRoute", url });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
