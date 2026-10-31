import type { Metadata } from "next";
import Home from "../page";

/* 게임 주소 — https://doyeonkr.github.io/our-days/game/ [사용자 2026-10-31 "게임 라우팅 지정해줘 거기로 url 링크걸게" →
 * "왜 실제 url 은 그냥 /our-days 로 가질까"]. 처음엔 앱 주소(?go=merge)로 넘기는 페이지라 주소창이 /our-days/ 로 바뀌었다.
 * 이제 **같은 앱**을 이 주소에서 그대로 띄우고, 앱이 주소를 보고(/game/) 정원 합치기를 연다 — 주소가 그대로 남는다.
 * 게임을 닫으면 주소가 /our-days/ 로, 게임 탭에서 열면 /game/ 으로 바뀐다(MergeGame). 로그인을 거쳐도 이 주소에서 다시 뜬다. */
export const metadata: Metadata = {
  title: "정원 합치기 | 하루",
  description: "같은 재료를 밀어 합쳐 세계수의 씨앗까지 — 하루의 정원 합치기.",
};

export default function GamePage() {
  return <Home />;
}
