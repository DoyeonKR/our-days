// PWA 서비스워커 — 재배포 후 stale chunk 문제 회피 + basePath(하위경로) 무관 동작.
// 경로는 sw.js 위치 기준 상대(addAll)로 해석되어 /our-days/ 하위에서도 맞는다.
// (실 푸시 알림은 phase 2: web-push + 서버 필요)
const CACHE = "ourdays-v9";
const PRECACHE = ["./", "./manifest.webmanifest", "./icon-192.png", "./apple-touch-icon.png"];

function appRootUrl() {
  return new URL(self.registration.scope || "./", self.location.href);
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
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 1) 문서(내비게이션): 항상 네트워크 우선(문서 캐시 저장 안 함 → 오래된 청크 참조 방지),
  //    오프라인이면 캐시 폴백(설치 시 프리캐시한 앱 셸).
  if (request.mode === "navigate") {
    // no-store: HTTP 캐시(max-age)까지 우회해 항상 최신 문서 → 옛 청크에 안 묶임.
    // 성공한 문서는 캐시에 갱신 저장 → 오프라인 폴백 셸이 '설치 시점'이 아닌 '마지막으로 본 문서'.
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(request, { cache: "no-store" });
          // 성공 문서는 캐시 갱신 저장 → 오프라인 폴백 셸이 '설치 시점'이 아닌 '마지막으로 본 문서'
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
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
        } catch {
          return (
            (await caches.match(request)) || caches.match(appRootUrl().href)
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
          // (미스+오류로 undefined 를 반환해 화면이 비던 문제 방지; 아래 3)번과 동일 패턴)
          fetch(request)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
              return res;
            })
            .catch(() => caches.match(request)),
      ),
    );
    return;
  }

  // 3) 그 외(이미지/폰트 등): 네트워크 우선, 실패 시 캐시 폴백.
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

// 웹 푸시 수신 (앱이 닫혀 있어도 도착). 앱이 포커스돼 있으면 in-app 배너가 처리하므로 중복 방지.
self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      let d = {};
      try {
        d = e.data ? e.data.json() : {};
      } catch {
        d = { body: e.data ? e.data.text() : "" };
      }
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // 앱이 포커스면 실시간 배너가 처리(중복 방지). 단 force(테스트)면 항상 표시.
      if (!d.force && wins.some((c) => c.focused)) return;
      const title = d.title || "💗 콕!";
      // 쿡찌르기 알림엔 빠른 답장 버튼(Android). category 우선, 없으면 제목 휴리스틱.
      const isPoke = d.category === "poke" || /쿡|콕/.test(title);
      const opts = {
        body: d.body || "콕!",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        data: { url: notificationTargetUrl(d.url) },
      };
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

// 알림 클릭 → 앱 포커스(있으면) 또는 새 창. 빠른 답장 버튼은 kind 를 앱에 전달해 전송.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const action = e.action || "";
  const url = notificationTargetUrl(e.notification.data && e.notification.data.url);
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // 빠른 답장(reply-<kind>): 열린 앱이 있으면 postMessage 로 전송, 없으면 ?pokeReply 로 열기
      if (action.indexOf("reply-") === 0) {
        const kind = action.slice(6);
        if (all.length) {
          const c = all[0];
          if ("focus" in c) await c.focus();
          c.postMessage({ type: "pokeReply", kind });
          return;
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(
            url + (url.indexOf("?") >= 0 ? "&" : "?") + "pokeReply=" + kind,
          );
        }
        return;
      }
      // 일반 클릭
      for (const c of all) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
