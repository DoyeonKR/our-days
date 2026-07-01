import type { CapacitorConfig } from "@capacitor/cli";

// 기존 웹앱(Next.js 정적 export)을 네이티브 껍데기에 담아 iOS/Android 스토어 배포.
// webDir = out (Capacitor 용 빌드는 basePath 없이 루트로 생성 — npm run build:app 참고).
const config: CapacitorConfig = {
  appId: "com.doyeonkr.ourdays",
  appName: "우리의 하루",
  webDir: "out",
  backgroundColor: "#fff1f5",
  ios: {
    contentInset: "always",
  },
  android: {
    // Android 12+ 스플래시 등 기본값 사용
  },
};

export default config;
