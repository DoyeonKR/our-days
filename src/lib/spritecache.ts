/* 생물 그림 축소본 캐시(순수) — 종 × 크기 단(2의 거듭제곱)마다 한 장, 최근에 쓴 것만 남긴다. README §14.6
 * 예전(BattleView spriteOf)엔 종마다 크기 하나만 기억해서, 필드가 같은 종을 여러 크기(수풀 · 동료 · 나 · 트레이너 펫 · 대장)로
 * 그리면 프레임마다 원화를 다시 줄여 캔버스를 새로 만들었다 — DPR 3 아이폰에서 초당 수십 MB 쓰레기, iOS 캔버스 메모리 한도에 닿으면 캔버스가 빈다.
 * 단 하나에 한 장만 굽고 나머지 배율은 drawImage 가 맞춘다(단 안에서는 최대 2배 축소라 거칠어지지 않는다). */

/** 그릴 크기(기기 픽셀) 이상인 가장 작은 2의 거듭제곱 — min ~ max 사이 */
export function sizeBucket(target: number, min = 32, max = 1024): number {
  let b = min;
  while (b < target && b < max) b *= 2;
  return b;
}

export class SpriteLRU<T> {
  private map = new Map<string, T>();
  private readonly max: number;
  private readonly make: (species: string, bucket: number) => T | null;
  private readonly drop?: (value: T) => void;
  /** make: 단 하나를 굽는다 — 그림이 아직 안 왔으면 null(캐시에 안 남기고 다음 프레임에 다시).
   *  drop: 밀려난 것을 정리한다(캔버스 크기를 0 으로 — iOS 는 그래야 메모리를 바로 돌려준다).
   *  (node 테스트의 타입 지우기 모드는 생성자 매개변수 속성을 못 읽어 필드로 둔다) */
  constructor(max: number, make: (species: string, bucket: number) => T | null, drop?: (value: T) => void) {
    this.max = max;
    this.make = make;
    this.drop = drop;
  }

  get(species: string, target: number): T | null {
    const key = `${species}@${sizeBucket(target)}`;
    const hit = this.map.get(key);
    if (hit !== undefined) {
      // 최근에 쓴 것을 맨 뒤로
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const made = this.make(species, sizeBucket(target));
    if (made == null) return null;
    this.map.set(key, made);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string;
      const v = this.map.get(oldest) as T;
      this.map.delete(oldest);
      this.drop?.(v);
    }
    return made;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    for (const v of this.map.values()) this.drop?.(v);
    this.map.clear();
  }
}
