// PWA 서비스워커 — 재배포 후 stale chunk 문제 회피 + basePath(하위경로) 무관 동작.
// 경로는 sw.js 위치 기준 상대(addAll)로 해석되어 /our-days/ 하위에서도 맞는다.
// (실 푸시 알림은 phase 2: web-push + 서버 필요)
const CACHE = "ourdays-v3";
const PRECACHE = ["./", "./manifest.webmanifest", "./icon.svg", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
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
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 2) 해시된 불변 정적 자산(_next/static): cache-first (basePath 유무 무관하게 매칭).
  if (url.pathname.includes("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          }),
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
      await self.registration.showNotification(d.title || "💗 콕!", {
        body: d.body || "콕!",
        icon: "./icon.svg",
        badge: "./icon.svg",
        data: { url: d.url || "./" },
      });
    })(),
  );
});

// 알림 클릭 → 앱 포커스(있으면) 또는 새 창.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of all) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
