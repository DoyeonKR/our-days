# 앱스토어 출시 지침서 (Capacitor)

기존 웹앱을 Capacitor 로 감싼 네이티브 앱을 iOS App Store / Google Play 에 올리는 절차.
코드/빌드 준비는 끝나 있고, **아래 계정·서명·업로드·심사 제출은 유진님 계정으로** 진행.

## 0. 개요
- 앱 이름: 우리의 하루 · appId: `com.doyeonkr.ourdays`
- 구조: Next.js 정적 export(`out/`)를 Capacitor 가 네이티브 WebView 로 로드. DB/인증/실시간은
  Supabase 그대로. `capacitor.config.ts` 참고.
- 네이티브 프로젝트: `ios/`(Xcode), `android/`(Android Studio). 웹 자산은 `cap sync` 로 주입.

## 1. 필요한 것 (유진님 준비)
| 항목 | 비고 |
|---|---|
| Apple Developer Program | $99/년. iOS 출시 필수(계정·결제·서명 유진님 명의) |
| Google Play Console | $25 1회. 안드 출시 |
| Mac + Xcode | iOS 빌드/업로드(서명은 Apple ID) |
| Android Studio + JDK | 안드 빌드(키스토어 생성) |
| 개인정보처리방침 URL | 스토어 필수. 초안 `docs/PRIVACY.md` (GitHub Pages 로 게시 가능) |

## 2. 빌드 전 항상 (웹 변경 반영)
```bash
npm run build:app     # basePath 없이 out/ 생성 (앱 전용)
npx cap sync          # out/ + 플러그인 → 네이티브 프로젝트로 복사
```
> 웹(GitHub Pages) 배포와 앱 배포는 별개. 앱은 위 두 명령 후 아래로.

## 3. Android (Google Play)
1. `npx cap open android` → Android Studio.
2. 버전: `android/app/build.gradle` 의 `versionCode`(정수 증가)/`versionName`.
3. 키스토어 생성(최초 1회): Studio → Build → Generate Signed Bundle/APK → Android App Bundle →
   새 키스토어 만들기(비번·별칭 안전 보관, 분실 시 업데이트 불가).
4. **AAB(.aab)** 빌드(release, 서명).
5. Play Console → 앱 만들기 → 프로덕션(또는 비공개 테스트) → AAB 업로드.
6. 스토어 등록정보: 이름/설명/스크린샷(폰)/아이콘/카테고리(라이프스타일)/개인정보처리방침 URL/
   데이터 안전 설문.
7. 검토 제출 → Google 심사(보통 수시간~수일).

## 4. iOS (App Store)
1. `npx cap open ios` → Xcode.
2. Signing & Capabilities → Team(개발자 계정) 선택, Bundle Identifier `com.doyeonkr.ourdays`,
   자동 서명.
3. 버전/빌드 번호 설정(General).
4. App Store Connect 에서 앱 생성(같은 Bundle ID).
5. Xcode → Product → Archive → Distribute App → App Store Connect 업로드
   (또는 Transporter 앱).
6. App Store Connect: 스크린샷(기기별)/설명/키워드/개인정보처리방침 URL/App Privacy 설문/
   연령등급.
7. 심사 제출 → Apple 심사(보통 1~3일). ⚠ "단순 웹 래핑"으로 반려될 수 있으니 5절 네이티브
   푸시까지 넣으면 통과율↑.

## 5. 네이티브 푸시 (FCM/APNs) — v1.1, 무료
현재 앱은 웹 기능은 다 되지만, **네이티브 백그라운드 푸시**는 아래 설정이 필요(무료, DB 이전 아님):
1. **무료 Firebase 프로젝트** 생성(Spark, 카드 불필요) → Android 앱 등록 →
   `google-services.json` 을 `android/app/` 에 추가. (Cloud Functions 안 씀 = Blaze 불필요)
2. iOS: Apple 개발자 계정에서 **APNs 인증키(.p8)** 발급 → Firebase 에 업로드.
3. Capacitor `@capacitor/push-notifications` 로 기기 등록 → 네이티브 토큰을 Supabase
   `native_push_tokens`(신규 테이블) 에 저장.
4. Supabase Edge Function 이 쿡찌르기/예약 시 **FCM HTTP v1 API**(서비스계정 키)로 전송
   (Android=FCM, iOS=FCM→APNs 브리지). → 카드 없이 무료.
   - 클라 등록 코드/테이블/전송 함수는 요청 시 이어서 붙임(계정 준비되면).

## 6. 업데이트 배포
- 웹 로직만 바꾼 경우에도 앱은 재빌드 필요: `npm run build:app && npx cap sync` → 버전 올리고
  다시 아카이브/AAB → 스토어 업로드 → 심사.
- (선택) Capacitor Live Update/OTA 로 심사 없이 웹 자산만 교체하는 방법도 있으나 별도 설정 필요.

## 7. 롤백
- 스토어에서 이전 버전으로 되돌리기: Play/App Store Connect 에서 직전 빌드로 단계적 출시 중단/
  교체. 심각 시 앱 비공개 전환.
- 네이티브 문제 시 웹(PWA, https://doyeonkr.github.io/our-days/)은 그대로 살아있음.
