/* 홈 히어로 계절 원화의 32×48 축소판(WebP, 한 장에 400바이트 안팎). [2026-09-24]
 *
 * 원화(250~470KB)가 오기 전 히어로는 옅은 살구색 바탕에 흰 D-day 숫자만 떠서 거의 안 읽혔다.
 * 이 축소판을 image-rendering: pixelated 로 깔면 같은 그림이 **굵은 도트**로 먼저 보이고, 원화가 오면
 * 그 위를 덮는다 — 도트 앱이라 저해상도 미리보기가 어색하지 않다.
 * 만든 법: sharp 로 public/assets/homeworld/<계절>.webp 를 32×48(cover, lanczos3) · WebP q72.
 * 원화를 바꾸면 이것도 다시 굽는다(heropreview.test 가 네 계절이 다 있는지만 본다). */

export const HERO_PREVIEW: Record<"spring" | "summer" | "autumn" | "winter", string> = {
  spring: "data:image/webp;base64,UklGRtIBAABXRUJQVlA4IMYBAAAwCQCdASogADAAPo08lEglI6IhNVv4AKARiWwAnTPCuqf5upBgHo8L89c573uNXjU3ORKF1M4zzODb6wmvaS0Yj6HQBjPGKTTPKsFjgnoSAin4AP7/HYLgvOfNLSDiPkCbQDOhbJHa0qg3AHg7B4j4/NNUv3XrFWbg4muGHjFpHiCZf/+enJ/uwX/ScnLvl9fQoTCNpwFek5MX96HV2X5ilkmAqDhCqVE3NjU2C6apKqOBmz0wJNeshvoxWmv4Vw1ZH6uAiAbM/7KaWhKXaS6G+dO9WPK4SlI+JUDvtCyCHsWWIRRCpKejz0piFjlH3f1dvVcllf22rSZD/5Y2q4tIGV+DojnIQsfOspGRR+upIFxZzw9GlWvWtZsDtjZgccnjiqd9OCNAlAuE4QAXjQzvA2HLAqNv7nIZS0bQLiHidrnPNoUsxXYOpgBIpApgkdalXQlcnU0q7epw3AyNt4keEYrVtawIXp3p+rZ/PAx4Og4uRdm5+YcTB5w4Cqt7qAoccnlts7nNUEjrIMtG9hmR5hSSWlNc9yNandwrvaQjU02wSQQ2fxyWGxsbQ/Q+C49E0MUNn6mk2iRy/cM8GGwmHdn99IAA",
  summer: "data:image/webp;base64,UklGRj4BAABXRUJQVlA4IDIBAACwBwCdASogADAAPok2lkglIyIhOrZoAKARCWoAqotry36q0d1EoNlOc1DCWJ0K6xQane/ZMl5V4GUgDfsZtW/ZMLqgWvYAAP7+SGADdkHmUx9NPOzdP2FsqI/4tVG3fgVmRJY58BZs6kQhesTw4EtZGXLPClYEsZSIY42/bwxAKE9Xr1W+kj5Bx4BkMRkZ7h9mgkCKDq7VF8Jqs/RVjSGyRMsoCn0frzY0cMj/cfpDvcRqCuYe+gXcK482too+k41l/uPN+yO3aoxn+PN0pziQpvpWo6mF+6GZimCzENUoEpiZvcDdschBUusaAiwd+5MEKtogd1LJcKlV12lnDn+5JHw/3O2WzcSC3j5IZg9VsACJUvEWkRGwn0RjGTX3PpimfsFbcqN4ILFL6BWmjbl84AA=",
  autumn: "data:image/webp;base64,UklGRsIBAABXRUJQVlA4ILYBAABQCgCdASogADAAPpU6l0gloyIhNVgIALASiWwAnTN2vjEhtbvZ4Bu2459j0KbwBvNlmm2z2G1ve41tCRYGiWybSg/4pt+QbX6kIqQB8J8GT2pM/RoGSMILDskAAP7/VrDnZLhsZzMT+HUbR8eo+/uV+qZeEvS+ldclPy2vSLxlbLE1VZMZlS0CXf9Vbvz/Gv23uSIz5kJLYCPsewiHoMrI7sWkMWy4GkidDtpnna+jz3k6C0722U76ASqdrn+mVFtALiHPAIu+HmdsV23MCh0rPB7Hp0P55Dj1/Ql2eGIfngXFApAj4jhEHW5mM5Hux1fdsv+y5MyrwOmbXJqOrCWYVzpPLXXTP7wflYgvJIlNUtdq5C21poca37ZIc4UKUfbCV+uVvtEpua/nbPkV5uh2g+0WsA1LLMqRTGe7k24I0VpRY6lwssqeLC3/C9x0pAX3+kbmhnkZLAGryPs+mWOWjcSHw+wq0IAltJAmiUJ1LeaOkEUyTPi6J+360Ujg942H4qO4J03pcGZyGQ+vHVPiuM1ANMDxxY+AHfImkaFry3aveHB91QQLVIYKpB8rf7YNmGlgAAA=",
  winter: "data:image/webp;base64,UklGRloBAABXRUJQVlA4IE4BAACwBwCdASogADAAPpU+mEiloyIhKqwAsBKJZACdMzRHH9M6z/lBEj/EixyC6rf1W4woQMNDYLkR16QxaxxQOl5YfQO2kCd4AP7/KslIlybsFDSc/+Z7/23z/9DL/+oX7NbBh+QG6W4nvXjVBmAjM1M9+akp9XMRDsQ4If5s1CMYBDFotz8c3axYQP/qENGYjrj+21ga2SuzOoPKv8yRzqzLL8epWm7EpHf+2nI6jE6R7RxmG2XylHyL/lZ+pjFAs7RQ58Hi+8lhH7SjQU6ZYfyXaJsgJMz/keNfCR1+rsmMdH/KE/rrRZW+Usifs+MCQorxvc/ZTDkJE6fqlysyPx0VjkhWnLMXC1dDJbZ+9v8tL7ZBN/bK7QHB9ayRPx4q+93ERhhAmosrk9bCh+L5FXr6A5Kr7nvtEFY7VNuwV1FKqglAh+A0SvlwIgv5wAAA",
};
