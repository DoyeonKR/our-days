#!/usr/bin/env python3
"""
갈라파고스 50종 + 배경 실사 기준 이미지 확보 및 AI 누끼(rembg) 파이프라인 (v2).
- 각 종마다 Wikimedia Commons 상위 후보 최대 6장을 순회하며, 잘림/세로막대/배경오염이 없는
  깨끗한 전신 실사 누끼가 나올 때까지 자동 선별
- 50종 전체 4x4 검수 시트(sheet_1..4.webp) 자동 생성
"""
import io
import json
import sys
import time
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
SOURCES_MD = OUT_DIR / "SOURCES.md"

REF_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)
SM_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "OurDaysAquariumBot/1.0 (https://github.com/DoyeonKR/our-days; contact@ourdays.app)"}

SPECIES_QUERIES = [
    ("galapagos_damselfish", "갈라파고스 자리돔", ["Stegastes beebei", "Stegastes arcifrons"], None),
    ("mandarinfish", "만다린 피쉬", ["Synchiropus splendidus side", "Synchiropus splendidus"], None),
    ("sally_lightfoot_crab", "샐리 라이트풋 게", ["Grapsus grapsus Galapagos", "Grapsus grapsus"], None),
    ("moorish_idol", "깃대돔", ["Zanclus cornutus", "Moorish idol fish"], None),
    ("picasso_triggerfish", "피카소 쥐치", ["Rhinecanthus aculeatus"], None),
    ("king_angelfish", "킹 엔젤피쉬", ["Holacanthus passer"], None),
    ("spanish_hogfish", "스패니시 호그피쉬", ["Bodianus rufus"], None),
    ("garden_eel", "정원장어", ["Heteroconger hassi", "Heteroconger"], None),
    ("porcupinefish", "가시복", ["Diodon hystrix", "Diodon holocanthus"], None),
    ("spotted_trumpetfish", "점박이 트럼펫피쉬", ["Aulostomus maculatus", "Aulostomus chinensis"], None),
    ("red_snapper", "붉은도미", ["Lutjanus campechanus", "Lutjanus argentiventris"], None),
    ("skipjack_tuna", "가다랑어", ["Katsuwonus pelamis"], None),
    ("amberjack", "잿방어", ["Seriola dumerili", "Seriola rivoliana"], None),
    ("marble_ray", "대리석가오리", ["Taeniurops meyeni", "Taeniura meyeni"], None),
    ("blacktip_reef_shark", "블랙팁 리프샤크", ["Carcharhinus melanopterus"], None),
    ("whitetip_reef_shark", "화이트팁 리프샤크", ["Triaenodon obesus"], None),
    ("pygmy_seahorse", "피그미 해마", ["Hippocampus bargibanti"], None),
    ("red_lipped_batfish", "붉은입술박쥐물고기", ["Ogcocephalus darwini"], None),
    ("galapagos_lobster", "갈라파고스 가시랍스터", ["Panulirus penicillatus", "Panulirus interruptus", "Panulirus argus"], None),
    ("clown_triggerfish", "광대쥐치", ["Balistoides conspicillum"], None),
    ("galapagos_penguin", "갈라파고스 펭귄", ["Spheniscus mendiculus swimming", "Spheniscus mendiculus"], None),
    ("hawksbill_turtle", "대모거북", ["Eretmochelys imbricata swimming", "Eretmochelys imbricata"], None),
    ("golden_cownose_ray", "황금매가오리", ["Rhinoptera bonasus", "Rhinoptera steindachneri"], None),
    ("ribbon_eel", "리본 장어", ["Rhinomuraena quaesita"], None),
    ("giant_clam", "대왕조개", ["Tridacna gigas"], None),
    ("loggerhead_turtle", "붉은바다거북", ["Caretta caretta swimming", "Caretta caretta"], None),
    ("bumphead_parrotfish", "혹머리 비늘돔", ["Bolbometopon muricatum"], None),
    ("galapagos_fur_seal", "갈라파고스 물개", ["Arctocephalus galapagoensis"], None),
    ("giant_trevally", "자이언트 트레발리", ["Caranx ignobilis"], None),
    ("wahoo", "꼬치삼치", ["Acanthocybium solandri"], None),
    ("yellowfin_tuna", "황다랑어", ["Thunnus albacares"], None),
    ("spotted_dolphin", "점박이돌고래", ["Stenella attenuata", "Stenella frontalis"], None),
    ("silky_shark", "미흑점상어", ["Carcharhinus falciformis"], None),
    ("galapagos_shark", "갈라파고스 상어", ["Carcharhinus galapagensis"], None),
    ("blue_ringed_octopus", "파란고리문어", ["Hapalochlaena lunulata", "Hapalochlaena maculosa"], None),
    ("nautilus", "앵무조개", ["Nautilus pompilius"], None),
    ("marine_iguana", "바다이구아나", ["Amblyrhynchus cristatus", "Galapagos marine iguana"], None),
    ("galapagos_sea_lion", "갈라파고스 바다사자", ["Zalophus wollebaeki", "Galapagos sea lion"], None),
    ("goliath_grouper", "골리앗 그루퍼", ["Epinephelus itajara"], None),
    ("spotted_eagle_ray", "얼룩매가오리", ["Aetobatus narinari"], None),
    ("sailfish", "돗새치", ["Istiophorus platypterus", "Istiophorus albicans"], None),
    ("scalloped_hammerhead", "홍살귀상어", ["Sphyrna lewini"], None),
    ("pilot_whale", "들쇠고래", ["Globicephala macrorhynchus", "Globicephala melas"], None),
    ("leafy_seadragon", "나뭇잎해룡", ["Phycodurus eques"], None),
    ("leatherback_turtle", "장수거북", ["Dermochelys coriacea swimming", "Dermochelys coriacea"], None),
    ("napoleon_wrasse", "나폴레옹 피쉬", ["Cheilinus undulatus"], None),
    ("mobula_ray", "악마가오리", ["Mobula tarapacana", "Mobula mobular", "Mobula munkiana"], None),
    ("blue_marlin", "청새치", ["Makaira nigricans", "Makaira mazara"], None),
    ("tiger_shark", "뱀상어", ["Galeocerdo cuvier"], None),
    ("brydes_whale", "브라이드고래", ["Balaenoptera edeni", "Balaenoptera brydei"], None),
]

BAD_WORDS = (
    "map", "distribution", "range", "diagram", "skeleton", "skull", "teeth", "jaw",
    "fossil", "stamp", "coin", "logo", "icon", "svg", "chart", "eggs", "larva",
    "dissect", "diver", "scuba", "snorkel", "tourist", "man_", "woman_", "person",
    "dead", "market", "cooked", "dish", "sushi", "fillet", "trophy", "boat", "hook",
    "caught", "fishing", "sign", "poster", "museum_label", "close-up", "closeup", "eye_of",
)


def http_get_json(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def search_commons_candidates(queries, limit=14):
    seen = set()
    scored = []
    for q in queries:
        params = urllib.parse.urlencode({
            "action": "query",
            "generator": "search",
            "gsrsearch": q,
            "gsrnamespace": "6",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": "960",
            "format": "json",
        })
        url = f"https://commons.wikimedia.org/w/api.php?{params}"
        try:
            data = http_get_json(url)
        except Exception as e:
            print(f"  [warn] search {q}: {e}")
            continue
        pages = list((data.get("query", {}).get("pages") or {}).values())
        for p in pages:
            title = p.get("title", "")
            if title in seen:
                continue
            seen.add(title)
            tl = title.lower()
            if any(w in tl for w in BAD_WORDS):
                continue
            ii = (p.get("imageinfo") or [{}])[0]
            mime = ii.get("mime", "")
            if mime not in ("image/jpeg", "image/png", "image/webp"):
                continue
            w = ii.get("width", 0)
            h = ii.get("height", 0)
            if w < 420 or h < 260:
                continue
            thumb = ii.get("thumburl") or ii.get("url")
            if not thumb:
                continue
            meta = ii.get("extmetadata") or {}
            lic = (meta.get("LicenseShortName") or {}).get("value", "Unknown")
            ratio = w / max(1, h)
            score = 0
            score += 16 if 1.2 <= ratio <= 2.3 else (8 if 0.9 <= ratio <= 2.7 else -8)
            if any(k in tl for k in ("white", "noaa", "fda", "smithsonian", "fish", "swim", "underwater", "illustration", "plate")):
                score += 4
            if any(k in lic.lower() for k in ("pd", "cc0", "public domain")):
                score += 6
            elif "cc" in lic.lower():
                score += 3
            scored.append((score, title, thumb, lic, w, h))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored


def cutout_animal(raw_bytes: bytes, session, flop_override=None):
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    img.thumbnail((960, 960), Image.LANCZOS)
    ow, oh = img.size
    cut = remove(img, session=session, alpha_matting=True, alpha_matting_foreground_threshold=238, alpha_matting_background_threshold=14, alpha_matting_erode_size=5)
    arr = np.array(cut)
    alpha = arr[:, :, 3]

    # 최대 연결 성분만 유지
    bin_mask = (alpha > 50).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bin_mask, connectivity=8)
    if num_labels <= 1:
        return None, 0.0
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest = 1 + int(np.argmax(areas))
    area = int(areas[largest - 1])
    if area < ow * oh * 0.03:
        return None, 0.0
    keep = (labels == largest)
    keep_dil = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1)
    arr[:, :, 3] = np.where(keep_dil > 0, alpha, 0)

    # 경계 닿음 비율 계산 (원본 가장자리에 너무 많이 잘려 있으면 감점)
    border_touch = (
        (keep[0, :].mean() + keep[-1, :].mean() + keep[:, 0].mean() + keep[:, -1].mean()) / 4.0
    )

    ys, xs = np.where(arr[:, :, 3] > 30)
    if len(xs) < 200:
        return None, 0.0
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    crop = arr[y0:y1, x0:x1]
    h_c, w_c = crop.shape[:2]
    aspect = w_c / max(1, h_c)
    fill = float((crop[:, :, 3] > 50).mean())

    # 품질 점수: 가로형 + 가장자리 잘림 적음 + 적당한 채움
    q = 10.0
    if aspect < 0.72:
        q -= 6.0  # 세로 막대(다이버 다리 등) 강력 감점
    elif 1.1 <= aspect <= 3.2:
        q += 4.0
    q -= border_touch * 25.0
    if fill < 0.14 or fill > 0.88:
        q -= 4.0

    # 머리 방향(오른쪽): 좌반 질량이 크면 좌우 반전
    m_c = (crop[:, :, 3] > 80).astype(np.float32)
    left_mass = float(m_c[:, : w_c // 2].sum())
    right_mass = float(m_c[:, w_c // 2 :].sum())
    should_flop = (left_mass > right_mass * 1.05) if flop_override is None else flop_override
    if should_flop:
        crop = np.ascontiguousarray(crop[:, ::-1, :])

    return Image.fromarray(crop), q


def save_stage_variants(key: str, adult_rgba: Image.Image):
    def fit_and_save(im: Image.Image, out_512: Path, out_192: Path):
        inner = im.copy()
        inner.thumbnail((468, 468), Image.LANCZOS)
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        canvas.paste(inner, ((512 - inner.width) // 2, (512 - inner.height) // 2), inner)
        canvas.save(out_512, "WEBP", quality=92, method=4)
        canvas.resize((192, 192), Image.LANCZOS).save(out_192, "WEBP", quality=88, method=4)

    def tint_young(im: Image.Image, blend: float, compact: float):
        w, h = im.size
        nw = max(32, int(w * compact))
        nh = max(32, int(h * min(1.0, compact * 1.06)))
        resized = im.resize((nw, nh), Image.LANCZOS)
        arr = np.array(resized, dtype=np.float32)
        target = np.array([232.0, 236.0, 240.0], dtype=np.float32)
        arr[:, :, :3] = arr[:, :, :3] * (1.0 - blend) + target * blend
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    fit_and_save(adult_rgba, IMG_DIR / f"{key}.webp", SM_DIR / f"{key}.webp")
    fit_and_save(tint_young(adult_rgba, 0.10, 0.94), IMG_DIR / f"juv_{key}.webp", SM_DIR / f"juv_{key}.webp")
    fit_and_save(tint_young(adult_rgba, 0.22, 0.86), IMG_DIR / f"fry_{key}.webp", SM_DIR / f"fry_{key}.webp")


def build_spot_bg():
    raw_path = REF_DIR / "spot_galapagos_raw.jpg"
    title = "File:Dry landing excursion to Isla Lobos - Leon Dormido (Kicker rock) looms far off shore (16483679247).jpg"
    lic = "CC BY-SA 2.0"
    if not raw_path.exists():
        cands = search_commons_candidates(["Kicker Rock Galapagos", "Leon Dormido Galapagos"])
        if not cands:
            return None
        _, title, url, lic, _, _ = cands[0]
        raw_path.write_bytes(http_get_bytes(url))
    im = Image.open(raw_path).convert("RGB")
    W, H = 1024, 1280
    # 원본을 가로 1024로 맞추고, 상단 하늘 + 키커 록 + 수평선이 y=410(32%) 부근에 오도록 배치
    scale = W / im.width
    nh = int(im.height * scale)
    im_r = im.resize((W, nh), Image.LANCZOS)
    arr_r = np.array(im_r, dtype=np.float32)

    # 수평선 찾기: 원본에서 키커 록 바로 아래 순수 바다 띠(하단 25%)를 추출
    # 원본 높이 nh 중 위 72%는 하늘+바위, 아래 28%는 바다
    horiz_src = int(nh * 0.72)
    top_h = 440  # 출력에서 수평선까지 높이 (약 34%)
    top_part = cv2.resize(arr_r[:horiz_src], (W, top_h), interpolation=cv2.INTER_AREA)

    # 순수 바다 영역(수평선 바로 아래 ~ 원본 맨 아래)
    sea_src = arr_r[horiz_src:, :]
    sea_h = H - top_h  # 840px
    # 바다 띠를 부드럽게 확장 + 원근감 있는 에메랄드-딥블루 그라데이션 + 잔물결 질감
    sea_base = cv2.resize(sea_src, (W, sea_h), interpolation=cv2.INTER_CUBIC)
    sea_smooth = cv2.GaussianBlur(sea_base.astype(np.uint8), (31, 11), 0).astype(np.float32)
    sea_detail = sea_base - cv2.GaussianBlur(sea_base.astype(np.uint8), (15, 7), 0).astype(np.float32)

    out = np.zeros((H, W, 3), dtype=np.float32)
    out[:top_h] = top_part
    for y in range(sea_h):
        t = y / max(1, sea_h - 1)
        # 멀리는 사진의 짙은 태평양 코발트, 가까울수록 맑은 갈라파고스 에메랄드-청록
        near_tint = np.array([18.0, 96.0, 124.0], dtype=np.float32)
        row = sea_smooth[y] * (1.0 - 0.42 * t) + near_tint * (0.42 * t) + sea_detail[y] * (0.55 - 0.35 * t)
        out[top_h + y] = row

    # 수평선 16px 부드러운 블렌딩
    for dy in range(-8, 8):
        y = top_h + dy
        if 0 <= y < H:
            w_b = (dy + 8) / 16.0
            out[y] = out[max(0, top_h - 9)] * (1.0 - w_b) + out[min(H - 1, top_h + 9)] * w_b

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(SPOT_PATH, "WEBP", quality=90, method=4)
    print(f"Built clean photorealistic {SPOT_PATH.name} ({W}x{H})")
    return (title, lic)


def build_contact_sheets():
    S = 256
    keys = [k for k, _, _, _ in SPECIES_QUERIES]
    for s_idx in range(0, len(keys), 16):
        chunk = keys[s_idx : s_idx + 16]
        sheet = Image.new("RGB", (S * 4, S * 4), (242, 246, 250))
        draw = ImageDraw.Draw(sheet)
        for i, key in enumerate(chunk):
            p = IMG_DIR / f"{key}.webp"
            if not p.exists():
                continue
            im = Image.open(p).convert("RGBA").resize((S - 16, S - 32), Image.LANCZOS)
            gx, gy = (i % 4) * S, (i // 4) * S
            sheet.paste(im, (gx + 8, gy + 4), im)
            draw.text((gx + 8, gy + S - 22), key, fill=(24, 32, 44))
        out_p = OUT_DIR / f"sheet_{s_idx // 16 + 1}.webp"
        sheet.save(out_p, "WEBP", quality=86)
        print(f"Saved contact sheet {out_p.name}")


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        idx = args.index("--only")
        only = set(s.strip() for s in args[idx + 1].split(","))
    skip_done = "--skip-done" in args
    do_spot = "--spot" in args or only is None

    session = new_session("u2net")
    records = []

    if do_spot:
        sp = build_spot_bg()
        if sp:
            records.append(("spot_galapagos", "갈라파고스 제도 배경", sp[0], sp[1]))

    targets = [s for s in SPECIES_QUERIES if only is None or s[0] in only]
    print(f"Processing {len(targets)} Galápagos species...")
    ok = 0
    for i, (key, ko, queries, flop_ov) in enumerate(targets, 1):
        if skip_done and (REF_DIR / f"{key}_raw.jpg").exists():
            ok += 1
            continue
        cands = search_commons_candidates(queries)
        best_cut, best_q, best_meta, best_raw = None, -999.0, None, None
        for _, title, url, lic, w, h in cands[:5]:
            try:
                raw = http_get_bytes(url)
                cut, q = cutout_animal(raw, session, flop_ov)
                if cut is not None and q > best_q:
                    best_cut, best_q, best_meta, best_raw = cut, q, (title, lic), raw
                if best_q >= 11.5:
                    break  # 충분히 깔끔한 전신 누끼 확보
            except Exception:
                continue
        if best_cut is None:
            print(f"  [{i}/{len(targets)}] MISS {key}")
            continue
        (REF_DIR / f"{key}_raw.jpg").write_bytes(best_raw)
        save_stage_variants(key, best_cut)
        records.append((key, ko, best_meta[0], best_meta[1]))
        ok += 1
        print(f"  [{i}/{len(targets)}] OK {key} (q={best_q:.1f}) <- {best_meta[0]} ({best_meta[1]})")
        time.sleep(0.1)

    build_contact_sheets()

    if only is None and records:
        lines = [
            "# 갈라파고스 50종 + 배경 실사 기준 이미지 출처",
            "",
            "| key | 이름 | 원본(Wikimedia Commons) | 라이선스 |",
            "|---|---|---|---|",
        ]
        for key, ko, title, lic in records:
            lines.append(f"| `{key}` | {ko} | {title} | {lic} |")
        SOURCES_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Done: {ok}/{len(targets)} species updated.")


if __name__ == "__main__":
    main()
