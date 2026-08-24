import { useEffect, useRef } from "react";

/** 언마운트 가드 ref — 비동기 완료 후 setState 전에 `.current` 를 확인한다.
 *  ⚠ Strict Mode 는 effect 를 두 번 돌리므로 재실행 때 반드시 true 로 되돌린다
 *  (HomePet 에서 실제로 겪은 함정). 같은 코드가 게임 화면마다 복사돼 있던 것 통합. */
export function useMountedRef(): { readonly current: boolean } {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
