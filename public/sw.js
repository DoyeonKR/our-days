// PWA 서비스워커 — 재배포 후 stale chunk 문제를 피하는 캐시 전략.
// (실 푸시 알림은 phase 2: web-push + 서버 필요)
const CACHE = "ourdays-v2";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg", "/apple-touch-icon.png"];

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

  // 1) 문서(내비게이션): 항상 네트워크 우선 — 문서를 캐시에 저장하지 않는다.
  //    (오래된 HTML 이 이미 지워진 청크 해시를 참조해 흰 화면 나는 것 방지.)
  //    오프라인일 때만 마지막 수단으로 프리캐시된 앱 셸을 시도.
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 2) 해시된 불변 정적 자산(_next/static) + 프리캐시 자산: cache-first (빠르고 오프라인 안전).
  if (url.origin === self.location.origin &&
      (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname))) {
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
