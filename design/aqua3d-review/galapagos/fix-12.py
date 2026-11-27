#!/usr/bin/env python3
"""
검수 시트에서 발견된 12종 사진 교체 + 왼쪽 향한 8종 좌우 반전(머리 오른쪽) + spot_galapagos.webp 수평선 정확 보정.
"""
import io
import json
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[3]
REF_DIR = ROOT / "design/aqua3d-review/galapagos/reference"
OUT_DIR = ROOT / "design/aqua3d-review/galapagos"
IMG_DIR = ROOT / "public/aqua/fish"
SM_DIR = ROOT / "public/aqua/fish/sm"
SPOT_PATH = ROOT / "public/fishing/spot_galapagos.webp"

HEADERS = {"User-Agent": "OurDaysAquariumBot/1.0 (https://github.com/DoyeonKR/our-days; contact@ourdays.app)"}

# 좌우 반전이 필요한 종 (현재 머리가 왼쪽을 향함 -> 머리 오른쪽으로)
FLIP_KEYS = [
    "picasso_triggerfish",
    "king_angelfish",
    "spanish_hogfish",
    "whitetip_reef_shark",
    "nautilus",
    "sailfish",
    "tiger_shark",
    "spotted_trumpetfish",
    "porcupinefish",
]

# 교체할 12종 — 정확한 단일 개체 실사/자연사 도판 검색어 + 필요 시 좌우반전 지정
REPLACE_12 = [
    ("galapagos_damselfish", ["Stegastes beebei", "Stegastes leucostictus", "Abudefduf troschelii"], None),
    ("moorish_idol", ["Zanclus cornutus aquarium", "Zanclus cornutus Hawaii", "Moorish Idol"], None),
    ("galapagos_lobster", ["Panulirus argus", "Spiny lobster", "Panulirus interruptus"], None),
    ("wahoo", ["Acanthocybium solandri", "Wahoo fish Duane Raver", "Wahoo NOAA"], None),
    ("goliath_grouper", ["Epinephelus itajara aquarium", "Goliath grouper Duane Raver", "Epinephelus lanceolatus"], None),
    ("scalloped_hammerhead", ["Sphyrna lewini swimming", "Hammerhead shark underwater", "Sphyrna mokarran"], None),
    ("mobula_ray", ["Mobula birostris", "Mobula alfredi", "Devil ray underwater"], None),
    ("blue_ringed_octopus", ["Hapalochlaena lunulata", "Greater blue-ringed octopus", "Blue-ringed octopus"], None),
    ("pilot_whale", ["Globicephala macrorhynchus NOAA", "Pilot whale illustration", "Globicephala melas drawing"], None),
    ("blue_marlin", ["Makaira nigricans Duane Raver", "Blue marlin NOAA", "Makaira nigricans illustration"], None),
    ("brydes_whale", ["Balaenoptera edeni NOAA", "Bryde whale illustration", "Balaenoptera borealis NOAA"], None),
    ("silky_shark", ["Carcharhinus falciformis swimming", "Silky shark underwater", "Carcharhinus galapagensis"], None),
]

BAD = ("diver", "scuba", "box", "crate", "market", "dead", "pile", "caught", "boat", "map", "range", "distribution", "svg", "diagram", "skeleton", "skull", "teeth", "jaw", "fossil", "stamp", "coin", "emergency", "pad", "person", "man", "woman", "reef0565", "atlanticgoliathgrouper", "sphyrna lewini 02", "spinetail devil ray", "hapalochlaena maculosa.jpg", "photo of the week", "acanthocybium solandri1", "carcharhinus falciformis piro4")


def http_get_json(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def search_cands(queries):
    seen, out = set(), []
    for q in queries:
        params = urllib.parse.urlencode({
            "action": "query", "generator": "search", "gsrsearch": q, "gsrnamespace": "6", "gsrlimit": "15",
            "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "960", "format": "json",
        })
        try:
            data = http_get_json(f"https://commons.wikimedia.org/w/api.php?{params}")
        except Exception:
            continue
        for p in (data.get("query", {}).get("pages") or {}).values():
            title = p.get("title", "")
            tl = title.lower()
            if title in seen or any(w in tl for w in BAD):
                continue
            seen.add(title)
            ii = (p.get("imageinfo") or [{}])[0]
            if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 400 or h < 220:
                continue
            url = ii.get("thumburl") or ii.get("url")
            if not url:
                continue
            ratio = w / max(1, h)
            score = 15 if 1.2 <= ratio <= 2.6 else (6 if 0.9 <= ratio <= 3.2 else -8)
            if any(k in tl for k in ("duane", "raver", "noaa", "fda", "illustration", "drawing", "swimming", "aquarium")):
                score += 10
            out.append((score, title, url))
    out.sort(key=lambda x: x[0], reverse=True)
    return out


def cutout(raw_bytes: bytes, session, flop_override=None):
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    img.thumbnail((960, 960), Image.LANCZOS)
    ow, oh = img.size
    cut = remove(img, session=session, alpha_matting=True, alpha_matting_foreground_threshold=238, alpha_matting_background_threshold=14, alpha_matting_erode_size=5)
    arr = np.array(cut)
    alpha = arr[:, :, 3]
    bin_mask = (alpha > 50).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(bin_mask, connectivity=8)
    if n <= 1:
        return None, -99
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest = 1 + int(np.argmax(areas))
    if areas[largest - 1] < ow * oh * 0.03:
        return None, -99
    keep = (labels == largest)
    keep_dil = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1)
    arr[:, :, 3] = np.where(keep_dil > 0, alpha, 0)
    border = (keep[0, :].mean() + keep[-1, :].mean() + keep[:, 0].mean() + keep[:, -1].mean()) / 4.0
    ys, xs = np.where(arr[:, :, 3] > 30)
    if len(xs) < 200:
        return None, -99
    crop = arr[int(ys.min()):int(ys.max()) + 1, int(xs.min()):int(xs.max()) + 1]
    hc, wc = crop.shape[:2]
    aspect = wc / max(1, hc)
    q = 10.0 + (4.0 if 1.1 <= aspect <= 3.4 else -4.0) - border * 25.0
    mc = (crop[:, :, 3] > 80).astype(np.float32)
    should_flop = (float(mc[:, :wc // 2].sum()) > float(mc[:, wc // 2:].sum()) * 1.05) if flop_override is None else flop_override
    if should_flop:
        crop = np.ascontiguousarray(crop[:, ::-1, :])
    return Image.fromarray(crop), q


def save_variants(key: str, adult_rgba: Image.Image):
    def fit_and_save(im: Image.Image, out_512: Path, out_192: Path):
        inner = im.copy()
        inner.thumbnail((468, 468), Image.LANCZOS)
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        canvas.paste(inner, ((512 - inner.width) // 2, (512 - inner.height) // 2), inner)
        canvas.save(out_512, "WEBP", quality=92, method=4)
        canvas.resize((192, 192), Image.LANCZOS).save(out_192, "WEBP", quality=88, method=4)

    def tint_young(im: Image.Image, blend: float, compact: float):
        w, h = im.size
        resized = im.resize((max(32, int(w * compact)), max(32, int(h * min(1.0, compact * 1.06)))), Image.LANCZOS)
        arr = np.array(resized, dtype=np.float32)
        arr[:, :, :3] = arr[:, :, :3] * (1.0 - blend) + np.array([232.0, 236.0, 240.0]) * blend
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    fit_and_save(adult_rgba, IMG_DIR / f"{key}.webp", SM_DIR / f"{key}.webp")
    fit_and_save(tint_young(adult_rgba, 0.10, 0.94), IMG_DIR / f"juv_{key}.webp", SM_DIR / f"juv_{key}.webp")
    fit_and_save(tint_young(adult_rgba, 0.22, 0.86), IMG_DIR / f"fry_{key}.webp", SM_DIR / f"fry_{key}.webp")


# 1. 왼쪽 향한 9종 좌우 반전 (머리 오른쪽으로)
for k in FLIP_KEYS:
    for pfx in ("", "juv_", "fry_"):
        p512 = IMG_DIR / f"{pfx}{k}.webp"
        p192 = SM_DIR / f"{pfx}{k}.webp"
        if p512.exists():
            im = Image.open(p512).transpose(Image.FLIP_LEFT_RIGHT)
            im.save(p512, "WEBP", quality=92, method=4)
            im.resize((192, 192), Image.LANCZOS).save(p192, "WEBP", quality=88, method=4)
print(f"Flipped {len(FLIP_KEYS)} species to face RIGHT.")

# 2. spot_galapagos.webp 수평선 정확 보정 (원본에서 바위가 끝나는 수평선을 정확히 찾아 왜곡 없이 배치)
raw_spot = Image.open(REF_DIR / "spot_galapagos_raw.jpg").convert("RGB")
W, H = 1024, 1280
im_r = raw_spot.resize((W, int(raw_spot.height * W / raw_spot.width)), Image.LANCZOS)
arr = np.array(im_r, dtype=np.float32)
# 원본에서 푸른 바다가 시작되는 수평선 행 자동 탐지 (B - R 이 급격히 커지는 행)
row_blue = (arr[:, :, 2] - arr[:, :, 0]).mean(axis=1)
# 하단 절반에서 가장 급격히 파래지는 수평선 탐색
nh = arr.shape[0]
horiz_src = int(nh * 0.5) + int(np.argmax(np.diff(row_blue[int(nh * 0.5):int(nh * 0.92)]))) + 1
print(f"Detected real horizon in spot photo at y={horiz_src}/{nh} ({horiz_src/nh:.2%})")

top_h = 435  # 34%
top_part = cv2.resize(arr[:horiz_src], (W, top_h), interpolation=cv2.INTER_AREA)
sea_src = arr[horiz_src + 4 :, :]  # 수평선 아래 순수 바다만!
sea_h = H - top_h
sea_base = cv2.resize(sea_src, (W, sea_h), interpolation=cv2.INTER_CUBIC)
sea_smooth = cv2.GaussianBlur(sea_base.astype(np.uint8), (25, 9), 0).astype(np.float32)
sea_detail = sea_base - cv2.GaussianBlur(sea_base.astype(np.uint8), (11, 5), 0).astype(np.float32)

out = np.zeros((H, W, 3), dtype=np.float32)
out[:top_h] = top_part
for y in range(sea_h):
    t = y / max(1, sea_h - 1)
    near_tint = np.array([16.0, 92.0, 126.0], dtype=np.float32)
    out[top_h + y] = sea_smooth[y] * (1.0 - 0.38 * t) + near_tint * (0.38 * t) + sea_detail[y] * (0.5 - 0.3 * t)
for dy in range(-6, 6):
    y = top_h + dy
    w_b = (dy + 6) / 12.0
    out[y] = out[top_h - 7] * (1.0 - w_b) + out[top_h + 7] * w_b
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(SPOT_PATH, "WEBP", quality=90, method=4)
print("Rebuilt clean undistorted spot_galapagos.webp")

# 3. 12종 사진 교체
session = new_session("u2net")
sheet = Image.new("RGB", (256 * 4, 256 * 3), (242, 246, 250))
draw = ImageDraw.Draw(sheet)

for idx, (key, queries, flop_ov) in enumerate(REPLACE_12):
    cands = search_cands(queries)
    best_cut, best_q, best_t = None, -999, ""
    for _, title, url in cands[:5]:
        try:
            raw = http_get_bytes(url)
            cut, q = cutout(raw, session, flop_ov)
            if cut is not None and q > best_q:
                best_cut, best_q, best_t = cut, q, title
            if best_q >= 12.0:
                break
        except Exception:
            continue
    if best_cut is not None:
        save_variants(key, best_cut)
        print(f"  REPLACED {key} (q={best_q:.1f}) <- {best_t}")
        im = Image.open(IMG_DIR / f"{key}.webp").convert("RGBA").resize((240, 224), Image.LANCZOS)
        gx, gy = (idx % 4) * 256, (idx // 4) * 256
        sheet.paste(im, (gx + 8, gy + 4), im)
        draw.text((gx + 8, gy + 234), key, fill=(24, 32, 44))
    else:
        print(f"  KEEP {key} (no better candidate)")

sheet.save(OUT_DIR / "sheet_fix12.webp", "WEBP", quality=86)
print("Saved sheet_fix12.webp")
