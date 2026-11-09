/* 모험 캔버스의 생물 그림 — 384px(-md) 를 받고, 그보다 크게 그릴 때만 768px 원화를 받는다. README §14.6
 * 크기 단마다 한 장만 구워 두고(lib/spritecache) 나머지 배율은 drawImage 가 맞춘다. */
import { heroAsset } from "@/lib/heroassets";
import { asset } from "@/lib/base";
import { SpriteLRU, sizeBucket } from "@/lib/spritecache";

/** -md 파일 한 변(heroAsset: 128 이하 칸 = 384px) */
const MD_PX = 384;

const imgs = new Map<string, HTMLImageElement>();
function load(species: string, full: boolean): HTMLImageElement {
  const k = full ? `${species}#full` : species;
  let im = imgs.get(k);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    // heroAsset 의 크기 인자: 128 이하 → 384px(-md), 그 위 → 원화
    im.src = asset(heroAsset(species, full ? 256 : 128));
    imgs.set(k, im);
  }
  return im;
}
const ready = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;

/** 전투 · 필드를 열 때 미리 받아 둔다 */
export function preloadSprite(species: string): void {
  load(species, false);
}

/** 원본을 단 크기 가까이까지 반씩 줄인다 — 한 번에 크게 줄이면 사파리에서 거칠어진다 */
function bake(src: HTMLImageElement, bucket: number): CanvasImageSource | null {
  let out: CanvasImageSource = src;
  let w = src.naturalWidth;
  let h = src.naturalHeight;
  while (w / 2 >= bucket) {
    const c = document.createElement("canvas");
    c.width = Math.round(w / 2);
    c.height = Math.round(h / 2);
    const x = c.getContext("2d");
    if (!x) break;
    x.imageSmoothingQuality = "high";
    x.drawImage(out, 0, 0, c.width, c.height);
    out = c;
    w = c.width;
    h = c.height;
  }
  return out;
}

const cache = new SpriteLRU<CanvasImageSource>(
  40,
  (species, bucket) => {
    const im = bucket > MD_PX ? load(species, true) : load(species, false);
    return ready(im) ? bake(im, bucket) : null;
  },
  (v) => {
    if (typeof HTMLCanvasElement !== "undefined" && v instanceof HTMLCanvasElement) {
      v.width = 0;
      v.height = 0;
    }
  },
);

/** 기기 픽셀 target 크기로 그릴 그림. 아직 못 받았으면 null */
export function spriteOf(species: string, target: number): CanvasImageSource | null {
  if (sizeBucket(target) > MD_PX && !ready(load(species, true))) {
    // 원화가 오기 전엔 -md 를 그대로 늘려 그린다(캐시에 안 남겨 원화가 오면 갈아 낀다)
    const md = load(species, false);
    return ready(md) ? md : null;
  }
  return cache.get(species, target);
}
