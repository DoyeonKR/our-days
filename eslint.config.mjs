import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 부팅 시 localStorage/권한 상태를 state 로 올리는 클라이언트 전용 패턴(18곳)에
      // 일괄 발화 — 이 앱 구조(SSG + 클라 하이드레이션)에선 의도된 패턴이라 off.
      // refs/purity 등 나머지 react-hooks 신규 규칙은 유지(실제 버그 잡음).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
