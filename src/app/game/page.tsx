import type { Metadata } from "next";
import GameRedirect from "./GameRedirect";

/* 짧은 게임 주소 — https://doyeonkr.github.io/our-days/game/ 를 공유하면 정원 합치기가 바로 열린다
 * [사용자 2026-10-31 "게임 라우팅 지정해줘 거기로 url 링크걸게"]. 정적 export 라 서버 리디렉트가 없어서
 * 이 페이지가 앱 주소(?go=merge)로 넘긴다. 로그인 전이면 로그인 뒤 홈이 아니라 게임으로 이어진다(app/page 의 ?go= 처리). */
export const metadata: Metadata = {
  title: "정원 합치기 | 하루",
  description: "같은 재료를 밀어 합쳐 세계수의 씨앗까지 — 하루의 정원 합치기.",
  robots: { index: false, follow: true },
};

export default function GamePage() {
  return <GameRedirect />;
}
