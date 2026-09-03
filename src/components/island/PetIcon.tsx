"use client";

/* 펫 아이콘 — 앱 어디서든 "이 폼의 펫"을 그리는 **단일 진입점**.
 *
 * 왜 하나로 모으나: 펫은 홈 히어로·쿡찌르기·게임 카드·도감·계보도 등 아홉 군데에 나온다.
 * 각 자리에서 `petArt(form)` 를 직접 부르면, 아트 스타일을 바꿀 때마다 아홉 곳을 다 고쳐야 하고
 * 한 곳만 빠뜨려도 같은 펫이 화면마다 다른 그림으로 나온다. 여기 한 곳만 보면 되게 한다.
 *
 * 기본은 픽셀(usePixelArt). 사용자가 섬에서 일러스트로 바꾸면 전역이 같이 바뀐다.
 *
 * ⚠ SVG 아트는 **JSX 로만 렌더**한다(`A(props)` 함수 호출 금지) — 내부 useId 가 부모 훅 순서에
 *   섞여 폼 전환 시 훅 개수가 달라진다. 레지스트리 조회라 static-components 는 예외 처리.
 */

import { petArt } from "@/components/island/art/pets";
import HeroV2 from "@/components/island/HeroV2";
import { usePixelArt } from "@/lib/pixelpref";

export default function PetIcon({
  form,
  size = 34,
  asleep = false,
  active = true,
  shadow = false,
  face = false,
  className,
  title,
  onTap,
}: {
  form: string;
  size?: number;
  asleep?: boolean;
  active?: boolean;
  shadow?: boolean;
  face?: boolean; // 24px 이하 칸은 얼굴 크롭 — 전신은 최소 34px 라 넘친다
  className?: string;
  title?: string;
  onTap?: () => void;
}) {
  const pixel = usePixelArt();
  if (pixel) {
    return (
      <HeroV2
        form={form}
        size={size}
        asleep={asleep}
        active={active}
        shadow={shadow}
        face={face}
        className={className}
        title={title}
        onTap={onTap}
      />
    );
  }
  // 레지스트리 조회 — 같은 form 이면 모듈 스코프의 동일 컴포넌트 참조라 재마운트가 없다.
  // 린트는 이걸 '렌더 중 컴포넌트 생성'으로 보지만, 이 저장소의 아트는 전부 이 방식이다
  // (IslandScene 도 동일). ⚠ `petArt(form)({...})` 로 **호출**하면 아트 내부 useId 가 이
  // 컴포넌트의 훅 순서에 섞여 form 전환 시 훅 개수가 달라진다 → 반드시 JSX 로 렌더.
  const A = petArt(form);
  return (
    <span className={className} onClick={onTap}>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <A size={size} />
    </span>
  );
}
