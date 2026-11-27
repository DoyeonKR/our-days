#!/usr/bin/env python3
"""Fix left-facing, diagonal, and broken Galápagos 2D reference images
so ALL 50 species are clean, single-specimen, horizontal, head-RIGHT (+X)
cutouts ready for 3D volumeFish GLB generation."""
import io
import json
import os
import time
import urllib.parse
import urllib.request
import numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session

ROOT = "/Users/kdy7854/.gemini/antigravity/scratch/our-days"
FISH_DIR = os.path.join(ROOT, "public/aqua/fish")
OUT_DIR = os.path.join(ROOT, "design/aqua3d-review/galapagos")

# 1. Flip horizontally (currently head-LEFT -> head-RIGHT)
FLIP_KEYS = [
    "picasso_triggerfish",
    "king_angelfish",
    "spanish_hogfish",
    "whitetip_reef_shark",
    "sailfish",
    "tiger_shark",
    "goliath_grouper",
    "pilot_whale",
]

# 2. Rotate to horizontal (degrees CCW in PIL: positive=CCW, negative=CW)
ROTATE_KEYS = {
    "spotted_trumpetfish": 26,
    "bumphead_parrotfish": -26,
    "galapagos_shark": -22,
    "ribbon_eel": -30,
}

# 3. Re-fetch genuinely broken cutouts from Wikimedia Commons
REFETCH = {
    "wahoo": [
        "Acanthocybium solandri",
        "Wahoo fish drawing",
        "Acanthocybium solandri NOAA",
    ],
    "scalloped_hammerhead": [
        "Sphyrna lewini drawing",
        "Sphyrna lewini NOAA",
        "Scalloped hammerhead shark illustration",
    ],
    "silky_shark": [
        "Carcharhinus falciformis drawing",
        "Carcharhinus falciformis NOAA",
        "Silky shark illustration",
    ],
    "mobula_ray": [
        "Mobula birostris drawing",
        "Mobula mobular drawing",
        "Devil ray illustration",
    ],
    "spotted_dolphin": [
        "Stenella attenuata drawing",
        "Pantropical spotted dolphin illustration",
        "Stenella attenuata NOAA",
    ],
    "garden_eel": [
        "Heteroconger hassi",
        "Taenioconger hassi",
        "Spotted garden eel",
    ],
    "brydes_whale": [
        "Balaenoptera edeni drawing",
        "Balaenoptera brydei illustration",
        "Bryde's whale NOAA",
    ],
}

HEADERS = {"User-Agent": "OurDaysAquariumArt/1.0 (https://github.com/DoyeonKR/our-days)"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_bytes(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def center_pad_512(img: Image.Image, pad=0.08) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    ys, xs = np.where(arr[:, :, 3] > 28)
    if len(xs) == 0:
        return rgba.resize((512, 512), Image.LANCZOS)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    crop = rgba.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    box = int(512 * (1 - 2 * pad))
    scale = min(box / max(1, cw), box / max(1, ch))
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.paste(resized, ((512 - nw) // 2, (512 - nh) // 2), resized)
    return canvas


def make_stages(key: str, adult: Image.Image):
    adult.save(os.path.join(FISH_DIR, f"{key}.webp"), "WEBP", quality=92, method=5)
    # Juvenile: slightly more compact (92% width, 96% height), slightly brighter
    juv_arr = np.array(adult).astype(np.float32)
    juv_arr[:, :, :3] = np.clip(juv_arr[:, :, :3] * 1.05 + 4, 0, 255)
    juv = center_pad_512(Image.fromarray(juv_arr.astype(np.uint8), "RGBA"), pad=0.11)
    juv.save(os.path.join(FISH_DIR, f"juv_{key}.webp"), "WEBP", quality=90, method=5)
    # Fry: smaller & slightly brighter
    fry_arr = np.array(adult).astype(np.float32)
    fry_arr[:, :, :3] = np.clip(fry_arr[:, :, :3] * 1.10 + 8, 0, 255)
    fry = center_pad_512(Image.fromarray(fry_arr.astype(np.uint8), "RGBA"), pad=0.15)
    fry.save(os.path.join(FISH_DIR, f"fry_{key}.webp"), "WEBP", quality=90, method=5)


def search_wikimedia(query: str):
    q = urllib.parse.quote(query)
    url = (
        f"https://commons.wikimedia.org/w/api.php?action=query&generator=search"
        f"&gsrnamespace=6&gsrsearch={q}&gsrlimit=8&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1024&format=json"
    )
    data = fetch_json(url)
    pages = list((data.get("query") or {}).get("pages", {}).values())
    results = []
    for p in pages:
        title = p.get("title", "")
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime", "")
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w < 300 or h < 150:
            continue
        # Prefer wider-than-tall lateral images and clean drawings/photos, skip maps/ranges/skulls/heads
        tl = title.lower()
        if any(bad in tl for bad in ("map", "range", "dist", "skull", "jaw", "tooth", "teeth", "head", "caught", "market", "boat", "diver", "school", "stamp", "logo", "icon", "flag")):
            continue
        score = (w / max(1, h)) * 10
        if any(good in tl for good in ("noaa", "drawing", "illustration", "plate", "side", "lateral", "fmib", "duane", "raver")):
            score += 25
        u = ii.get("thumburl") or ii.get("url")
        if u:
            results.append((score, title, u))
    results.sort(reverse=True)
    return results


def ensure_head_right(img: Image.Image) -> Image.Image:
    """Heuristic: for fish/sharks/whales, tail end has less mass/vertical thickness
    around the 15%..30% peduncle vs the 65%..85% head/trunk. If left half has much
    more vertical thickness than right half, flip horizontally."""
    arr = np.array(img)
    alpha = arr[:, :, 3] > 60
    ys, xs = np.where(alpha)
    if len(xs) < 100:
        return img
    x0, x1 = xs.min(), xs.max()
    w = max(1, x1 - x0)
    left_mass = alpha[:, x0 + int(w * 0.12):x0 + int(w * 0.42)].sum()
    right_mass = alpha[:, x0 + int(w * 0.58):x0 + int(w * 0.88)].sum()
    if left_mass > right_mass * 1.12:
        return ImageOps.mirror(img)
    return img


def main():
    # Step 1: Flip left-facing species
    for key in FLIP_KEYS:
        p = os.path.join(FISH_DIR, f"{key}.webp")
        im = Image.open(p).convert("RGBA")
        im = center_pad_512(ImageOps.mirror(im))
        make_stages(key, im)
        print(f"FLIPPED {key}")

    # Step 2: Rotate diagonal species
    for key, deg in ROTATE_KEYS.items():
        p = os.path.join(FISH_DIR, f"{key}.webp")
        im = Image.open(p).convert("RGBA")
        im = im.rotate(deg, resample=Image.BICUBIC, expand=True)
        im = center_pad_512(im)
        make_stages(key, im)
        print(f"ROTATED {key} by {deg} deg")

    # Step 3: Re-fetch the 7 broken cutouts
    session = new_session("u2net")
    fixed_keys = []
    for key, queries in REFETCH.items():
        done = False
        for q in queries:
            try:
                cands = search_wikimedia(q)
            except Exception as e:
                print(f"  search err {key} ({q}): {e}")
                continue
            for score, title, url in cands[:4]:
                try:
                    raw = fetch_bytes(url)
                    im = Image.open(io.BytesIO(raw)).convert("RGBA")
                    # Check if already transparent PNG
                    arr0 = np.array(im)
                    if (arr0[:, :, 3] < 20).mean() > 0.15:
                        cut = im
                    else:
                        cut = remove(im, session=session)
                    cut = center_pad_512(cut)
                    arr = np.array(cut)
                    cov = (arr[:, :, 3] > 40).mean()
                    if cov < 0.04 or cov > 0.78:
                        continue
                    # Check bounding box aspect ratio (avoid weird ovals/squares for sharks/whales/wahoo)
                    ys, xs = np.where(arr[:, :, 3] > 40)
                    ar = (xs.max() - xs.min() + 1) / max(1, (ys.max() - ys.min() + 1))
                    if key in ("wahoo", "scalloped_hammerhead", "silky_shark", "brydes_whale", "spotted_dolphin") and ar < 1.35:
                        continue
                    cut = ensure_head_right(cut)
                    make_stages(key, cut)
                    print(f"REFETCHED {key} <- {title} (ar={ar:.2f}, cov={cov:.2f})")
                    fixed_keys.append(key)
                    done = True
                    break
                except Exception as e:
                    print(f"  cand err {key} ({title}): {e}")
                    continue
            if done:
                break
            time.sleep(0.3)
        if not done:
            print(f"WARN: could not refetch {key}")

    # Build quick review sheet of all modified keys
    all_mod = list(dict.fromkeys(FLIP_KEYS + list(ROTATE_KEYS.keys()) + fixed_keys))
    cols = 4
    rows = (len(all_mod) + cols - 1) // cols
    S = 256
    sheet = Image.new("RGBA", (cols * S, rows * S), (242, 246, 250, 255))
    for i, k in enumerate(all_mod):
        im = Image.open(os.path.join(FISH_DIR, f"{k}.webp")).convert("RGBA").resize((S - 16, S - 16), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * S + 8, (i // cols) * S + 8), im)
    sheet.save(os.path.join(OUT_DIR, "sheet_fixed_3d_refs.webp"), "WEBP", quality=90)
    print(f"Saved sheet_fixed_3d_refs.webp ({len(all_mod)} species)")


if __name__ == "__main__":
    main()
