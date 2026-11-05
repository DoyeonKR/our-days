import type { CapacitorConfig } from "@capacitor/cli";

// 웹앱을 네이티브 껍데기에 담는다. 스토어에 올리지 않고 APK/IPA 로 직접 설치한다(2026-11-05).
// server.url — 앱 안에 화면을 넣지 않고 배포된 사이트를 연다. 웹을 배포하면 앱을 다시 설치하지 않아도 바뀐다.
// ⚠ 그래서 인터넷이 없으면 첫 화면이 안 뜰 수 있다. 스토어에 올리려면 server 를 빼고 webDir 을 out 으로 돌린 뒤 npm run build:app 으로 묶어야 한다
//   (사이트만 감싼 앱은 심사에서 거절될 수 있다 — docs/APP-RELEASE.md).
const config: CapacitorConfig = {
  appId: "com.doyeonkr.ourdays",
  appName: "하루",
  webDir: "native-shell", // 사이트에 못 닿을 때의 안내 한 장만 앱에 넣는다(out 을 넣으면 85MB 였다)
  backgroundColor: "#fff1f5",
  server: {
    url: "https://doyeonkr.github.io/our-days/",
    errorPath: "index.html",
  },
  ios: {
    contentInset: "never", // 웹이 viewport-fit=cover + safe-area 로 스스로 비켜 앉는다 — always 면 두 번 밀린다
  },
  android: {
    // Android 12+ 스플래시 등 기본값 사용
  },
};

export default config;
