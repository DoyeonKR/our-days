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
