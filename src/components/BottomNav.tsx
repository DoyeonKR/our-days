"use client";

/* 하단 탭 네비(GNB) — 6칸.
 *
 * ⚠ 중앙 정렬에 `left-1/2 + w-full + -translate-x-1/2` 를 쓰지 않는다.
 *   변환 **전** 박스가 50vw~150vw 라, fixed 요소를 문서 스크롤 폭에 넣는 모바일 엔진에서
 *   가로 스크롤이 생긴다(사용자 리포트 2026-08-04). inset-x-0 + mx-auto 는 변환이 없다.
 *
 * ⚠ 6칸이 **넘치면 마지막 칸(게임)부터 잘린다.** flex 아이템의 기본 min-width 는 auto 라
 *   `whitespace-nowrap` 라벨보다 좁아지지 않는다 → 좁은 기기·넓은 시스템 서체에서 폭이
 *   모자라면 줄어드는 대신 오른쪽으로 삐져나간다(사용자 리포트 2026-08-05 "gnb 가 짤려
 *   게임쪽이 안나와"). 라벨 폭은 --font-prose(시스템 서체 스택)라 기기마다 다르다.
 *   → min-w-0 로 줄어들 수 있게 하고, 라벨은 넘칠 때만 줄어드는 clamp 크기를 쓴다.
 *   navfit.test.ts 가 이 두 가지를 잠근다.
 *
 * page.tsx 에서 분리한 이유: 실제 화면이 로그인 뒤라 프로브로 못 띄웠다. 떼어 두면
 * 320~430px 폭에서 진짜 서체로 재볼 수 있다(말풍선 대비 때 같은 방법으로 실수를 잡았다).
 */

import Icon, { type IconName } from "@/components/Icon";

export type NavView = "home" | "log" | "calendar" | "deco" | "album" | "game";

export const NAV_TABS = [
  { k: "home", icon: "house", label: "홈" },
  { k: "log", icon: "camera", label: "로그" },
  { k: "calendar", icon: "calendar", label: "캘린더" },
  { k: "deco", icon: "book", label: "일기장" },
  { k: "album", icon: "image", label: "사진첩" },
  { k: "game", icon: "gamepad", label: "게임" },
] as const satisfies readonly { k: NavView; icon: IconName; label: string }[];

export default function BottomNav({
  view,
  onSelect,
}: {
  view: NavView;
  onSelect: (v: NavView) => void;
}) {
  return (
    // .ui-sans — 탭 라벨만 읽기 서체로(아이콘은 픽셀 유지). 6칸이라 칸당 폭이 가장 좁아
    // 픽셀 격자에서 한글이 제일 먼저 뭉치는 자리다. [사용자 피드백 2026-08-04]
    // ⚠ 아래 여백은 **네온 베젤(.app-frame, z-60) 안쪽**을 비켜 앉기 위한 값이다.
    //   베젤은 GNB(z-20) 보다 위에 그려지는데, 실측(375×812)에서 베젤 안쪽 경계가
    //   x 8~367 · 아래 y 805 인데 탭은 x 4~371 · 아래 806 까지 뻗어 있었다.
    //   → 맨 오른쪽 '게임' 탭이 오른쪽 변 + 아래 변 + 26px 모서리 곡선 **세 방향**에서
    //     동시에 덮이고, 거기에 0 0 22px 네온 글로우가 안쪽으로 번진다
    //     (사용자 리포트 2026-08-05 "gnb 가 짤려 게임쪽이 안나와").
    //   베젤 계산: 좌우 padding 5px + border 3px = 8px, 아래 safe-area + 4px + border 3px = +7px.
    //   여기 값을 줄이려면 globals.css 의 .app-frame 을 같이 봐야 한다. navfit.test.ts 가 짝을 잠근다.
    // ⚠ bottom 은 0 이 아니라 --vv-bottom 이다(ViewportFit 이 채운다).
    //   Chromium 모바일은 fixed 의 기준을 **툴바가 접힌 큰 뷰포트**로 잡아서, 툴바가 펼쳐진
    //   첫 진입에는 bottom:0 이 화면 밖(툴바 뒤)에 있다. 삼성 인터넷은 주소창이 아래라 정통으로 맞는다
    //   (사용자 리포트 2026-08-05 "처음 접속했을 때 gnb 가 안 보이고 스크롤해야 보여").
    //   미지원 브라우저는 fallback 0px → 기존 동작.
    <nav
      style={{
        bottom: "var(--vv-bottom, 0px)",
        // ⚠ max-w-md(28rem) 만으로는 모자란다. 문서가 화면보다 넓어지면 일부 모바일 엔진은
        //   fixed 를 **문서 폭** 기준으로 눕혀서, 6칸이 화면보다 넓게 펼쳐지고 맨 오른쪽
        //   '게임' 탭이 밖으로 밀린다(제보 스크린샷: 탭이 5개만 보였다).
        //   실제 보이는 폭(--vv-w)으로 한 번 더 조인다. 미지원이면 100vw.
        maxWidth: "min(28rem, var(--vv-w, 100vw))",
      }}
      className="ui-sans glass fixed inset-x-0 z-20 mx-auto w-full border-t border-line bg-[var(--surface-nav)] pb-[calc(env(safe-area-inset-bottom)+8px)]"
    >
      {/* overflow-hidden 은 **최후의 방어선**이다. 어떤 서체가 와도 GNB 가 화면 밖으로
          삐져나가 가로 스크롤을 만들지는 않게 한다(아래 min-w-0 로 애초에 안 넘치게 하고). */}
      <div className="flex overflow-hidden px-2.5 py-1.5">
        {NAV_TABS.map((tab) => {
          const active = view === tab.k;
          return (
            <button
              key={tab.k}
              onClick={() => onSelect(tab.k)}
              aria-current={active ? "page" : undefined}
              // min-w-0: flex 기본값(auto)이면 라벨보다 좁아지지 못해 6칸이 넘칠 때 잘린다.
              className={`tap relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-0.5 py-1.5 ${
                active ? "text-rose-deep" : "text-muted"
              }`}
            >
              {/* 활성 인디케이터 바 (색 외 형태로도 이중 인코딩) — 네온 글로우로 프레임과 통일 */}
              <span
                className={`absolute top-0 h-1 rounded-full bg-neon shadow-[0_0_0_2px_var(--neon-glow)] transition-all duration-200 ${
                  active ? "w-6 opacity-100" : "w-0 opacity-0"
                }`}
              />
              <Icon name={tab.icon} size={23} strokeWidth={active ? 2.4 : 1.9} />
              {/* clamp — 좁은 기기에선 10px 까지 줄고 넓으면 12px 로 돌아온다.
                  고정 크기면 서체 폭이 큰 기기에서 그대로 넘친다(라벨 3글자 × 6칸). */}
              <span
                className={`w-full truncate text-center leading-none ${active ? "font-bold" : "font-medium"}`}
                style={{ fontSize: "clamp(10px, 2.9vw, 12px)" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
