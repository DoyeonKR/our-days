/** 이벤트 물고기(2026-11-26) [사용자: "갓파는 이벤트 뱃지 달아주고 무조건 확률 1% 설정해놓고 가장 인기없는 낚시터에 배치하자" →
 *  "한번 수조에 넣은 기록이 있으면 그만 낚이게 설정해줘 수조에 넣는게 성공했을 경우에만이야"]
 *  · 그 낚시터에서 던질 때마다 정확히 chance(미끼 · 행운 · 방식 · 시간 · 날씨 무관 — lib/fishing 의 rollCatch 가 따로 뽑는다)
 *  · 수조에 한 번 넣는 데 성공하면(aquarium.addFish) 섬 맨 위 칸 `eventKept` 에 남고, 그 뒤로는 안 온다(보내 줘도 그대로)
 *  · 도감 · 수조 · 낚시 결과에 '이벤트' 뱃지
 *  값만 둔다(다른 모듈을 부르지 않는다) — aquarium · fishing 둘 다 부르므로 순환 import 를 피한다.
 *  "가장 인기 없는 낚시터"는 서버 기록에 낚시터 칸이 없어 데이터로 못 골라 사용자가 봉화 계곡으로 정했다. */
export type EventFish = { species: string; spot: string; chance: number };
// 유진(2026-11-27 [사용자: "유진이 낚시 잡힐 확률 5%로 올리고 수조에 넣을 확률을 0.5% 낮춰"]) — 청계천(brook, Lv.1)에서 던질 때마다 5%
export const EVENT_FISH: readonly EventFish[] = [{ species: "kappa", spot: "bonghwa", chance: 0.01 }, { species: "yujin", spot: "brook", chance: 0.05 }];
export const EVENT_SEED = 0x6b617070; // 'kapp' — 다른 뽑기와 겹치지 않는 주사위
export const isEventFamily = (family: string | undefined): boolean => !!family && EVENT_FISH.some((e) => e.species === family);
export const eventOf = (family: string | undefined): EventFish | undefined => EVENT_FISH.find((e) => e.species === family);
