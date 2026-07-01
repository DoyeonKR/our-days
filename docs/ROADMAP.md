# 개선 로드맵 · 진행 트래커

> 커플앱 경쟁사 리서치(2026-07-01, 에이전트 10 / 아이디어 82 / 경쟁사 64) 기반
> 자율 개선 큐. 무료 스택(정적 호스팅 + Supabase 무료 + 웹푸시, 네이티브 없음)
> 제약 내에서 "버그 0" 원칙으로 배치 단위 배포. 각 배치: tsc + build + 유닛(회귀 lock) green → 커밋 → 배포.

## 완료 (deployed)

- [x] 캘린더 탭 일정 삭제 (홈에서만 되던 것)
- [x] 미리보기 작성자 색 구분 (내=로즈 / 상대=블루)
- [x] 일정 종류(기념일=노랑 / 일정=작성자색) — couple_events.category + 백필
- [x] **신뢰/버그**: 기념일 이관 데이터 유실 방지 · 로그인 에러 한국어화(authError) · debug_logs 정본화(schema.sql)
- [x] **인프라**: Supabase keep-alive GitHub Action (7일 미사용 pause 방지)
- [x] **신규**: 커플 버킷리스트 (🎯 탭, couple_bucket + RLS + realtime, 진행률/추천시드/낙관적갱신)
- [x] **UX/UI 대개편**: 은은한 로맨틱 프리미엄 + 다크 모드(시스템 자동). globals 토큰 전면
  개편(라이트/다크 팔레트·로즈틴트 그림자·라운드·모션·glass/tap/text-gradient/bg-brand 유틸),
  전 화면·13개 파일 토큰화(bg-white/*→glass, amber/sky→anniv/partner), 히어로 그라디언트
  숫자·글래스 네비(활성 pill)·프리미엄 시트·마이크로 인터랙션
- [x] **아이콘 시스템 + 캘린더 재설계**(2차 리서치): 인라인 SVG 아이콘(icons.ts/Icon)으로
  크롬 이모지 전면 교체, 하단탭 활성 표시, 캘린더 점+아젠다·today/selected 구분·상대날짜
- [x] **P1 인터랙션**: SegmentedControl · 로딩 스켈레톤 · shimmer 모션 · 공용 확인 모달(ConfirmHost)
- [x] **이미지 고속화**: WebP+썸네일 이중 저장 + 서명URL 캐시. 대표사진 더블탭/별버튼 확인
- [x] **테스트 강화 + CI 게이트**: 유닛 33, deploy 전 tsc+test 게이트
- [x] **일기장 대개편**: 검색·필터·월타임라인·'작년 오늘'·이번 달 기분 / 이모지 반응·한줄 댓글(실시간)
  / 비밀일기(visibility RLS)
- [x] **미래 편지**(letters): open_at 시간게이트 RLS(봉인 전 수신자 미노출)
- [x] **적대적 코드리뷰 확정결함 전량 수정**: 비밀일기 RLS 구멍(반응/댓글·deco_update/delete
  소유자·can_view_entry) · 캘린더 날짜 오버플로우 clamp · 대표사진 롤백 · 캐시 무효화/prune ·
  다크 대비(--rose) · 접근성(대표지정 버튼·터치타깃·alt·role) 등 16건

## 다음 (안전·무푸시 우선 → 푸시계열은 Quiet Hours 이후)

우선순위: 라이브 푸시 delivery 를 건드리지 않는 안전 기능 먼저(디바이스 테스트 불가),
푸시 볼륨을 늘리는 기능(쿠폰/질문 자동배달/100일 푸시/재회 리마인더)은 **Quiet Hours 선행 후**.

- [ ] LDR 프리센스 lite: 듀얼클록 + Open-Meteo 날씨(무키) — 홈 카드, couple_members에 timezone/city 컬럼 (무푸시)
- [ ] "작년 오늘 / 이달의 추억" 회상 — 홈 카드, deco/photos 재사용 (무푸시, 비었으면 숨김)
- [ ] Forget-Me-Nots 서로의 취향/선물힌트 카드 — prefs 테이블(secret 지원) (무푸시)
- [ ] 오늘의 질문 주제팩(정적 JSON) + 지난 질문 UX 개선 (무푸시 부분)
- [ ] **Quiet Hours + 알림 카테고리 on/off** (improve rank1) — 이후 모든 푸시의 선행 안전장치. Edge Function(daily-reminders/send-poke-push) 수정 + 수신자 timezone DB. ⚠ 라이브 푸시 경로라 신중 + 배포 후 사용자 10초 푸시 테스트 요청.
- [ ] 푸시 구독 수명주기: 410/404 Gone 시 구독 정리 (Edge Function, 신중)
- [ ] 관계 쿠폰(발행→사용→푸시, poke 인프라 재사용) — Quiet Hours 후
- [ ] 오늘의 질문 자동배달(cron 매시, 수신자 timezone) — Quiet Hours 후
- [ ] 100/200일 일수 기념일 복원 + 음력(lunar 클라 변환) — Quiet Hours 후
- [ ] 러브탱크 게이지(무드 지속상태화) / 공동 streak + 배지
- [ ] 월말 자동 리캡(pg_cron 집계)
- [ ] 데이터 백업/내보내기(Edge zip + signed URL)
- [ ] 앱 잠금(WebAuthn/PIN, '어깨너머 방지' 포지셔닝)

## 접기로 한 것 (제약)

- 홈스크린/잠금화면 네이티브 위젯 (iOS PWA 불가) → 홈 히어로 근사만
- 실시간 위치, 진동(iOS 웹 미지원)
- 외부 캘린더(Google/Apple) 연동 (OAuth 서버 필요)
- DRM 동기재생(넷플릭스 등). 유튜브 같이보기는 Realtime 2M msg/월 폭증 리스크로 최후순위
- 실시간 드로잉 캔버스(broadcast 폭증) → 완성 PNG 저장만 고려

## IA 메모

하단 탭은 5개(홈/캘린더/버킷/일기장/사진첩)로 포화 — 이후 기능은 **홈 카드** 또는
설정 하위 화면으로. 탭 추가 금지.
