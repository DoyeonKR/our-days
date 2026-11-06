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
  plugins: {
    // 앱을 켜 둔 동안 온 알림도 시스템이 띄운다(2026-11-06). 없으면 FCM 이 앞에 있는 앱엔 아무것도 안 띄워 '테스트 알림'이 고장 난 것처럼 보였다.
    // ⚠ 이 값은 cap sync 때 APK 안에 들어간다 — APK 를 다시 빌드해야 적용된다(versionCode 3 부터, lib/nativepushstate 의 FOREGROUND_SHELL_BUILD).
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
