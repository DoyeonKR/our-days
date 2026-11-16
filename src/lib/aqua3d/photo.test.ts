// 수조 사진 모드(2026-11-13) — 순수 계산(필터 · 카메라 범위 · 찍는 배율 · 카드 · 이름표) + 엔진 · 화면 계약.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PHOTO_BOUNDS, PHOTO_FILTERS, captureRatio, clampPhotoCam, gradePixel, photoCaption, photoCardLayout, photoDistance, photoFileName, photoGrade, pinchZoom, placeLabels } from "./photo.ts";
import { FINAL_FRAG } from "./post.ts";

const root = process.cwd();
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("필터는 다섯 — 원본 · 따뜻한 바다 · 심해 푸른빛 · 흑백 · 빛바랜 필름, 원본은 셰이더를 끈다", () => {
  assert.deepEqual(PHOTO_FILTERS.map((f) => f.label), ["원본", "따뜻한 바다", "심해 푸른빛", "흑백", "빛바랜 필름"]);
  assert.equal(new Set(PHOTO_FILTERS.map((f) => f.id)).size, 5);
  assert.equal(photoGrade("none").on, 0);
  assert.equal(photoGrade("모르는 값").on, 0, "모르는 id 는 원본");
  for (const f of PHOTO_FILTERS.slice(1)) assert.equal(photoGrade(f.id).on, 1, f.id);
  // 원본은 색 그대로
  assert.deepEqual(gradePixel([0.2, 0.5, 0.7], photoGrade("none")), [0.2, 0.5, 0.7]);
});

test("필터 값 — 흑백은 채도 0, 따뜻한 바다는 붉게 · 심해는 푸르게, 필름은 검정이 뜬다, 결과는 늘 0~1", () => {
  const [r, g, b] = gradePixel([0.8, 0.3, 0.2], photoGrade("mono"));
  assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9, "흑백");
  const mid: [number, number, number] = [0.5, 0.5, 0.5];
  const warm = gradePixel(mid, photoGrade("warm")), deep = gradePixel(mid, photoGrade("deep"));
  assert.ok(warm[0] > warm[2], "따뜻한 바다는 빨강 > 파랑");
  assert.ok(deep[2] > deep[0], "심해는 파랑 > 빨강");
  assert.ok(gradePixel([0, 0, 0], photoGrade("film"))[0] > 0.05, "필름은 검정을 들어 올린다");
  for (const f of PHOTO_FILTERS) {
    const g0 = photoGrade(f.id);
    assert.ok(g0.vignette >= 0 && g0.vignette <= 0.4 && g0.grain >= 0 && g0.grain <= 0.06, f.id);
    for (const c of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0.1, 0.9, 0.4]] as const) for (const v of gradePixel(c, g0)) assert.ok(v >= 0 && v <= 1, `${f.id} ${c}`);
  }
});

test("셰이더 — 필터는 톤 매핑 · sRGB 뒤 · 디더링 앞, 원본이면 건너뛴다(평소 화면 그대로)", () => {
  assert.match(FINAL_FRAG, /uniform float gradeOn;uniform vec4 grade;uniform vec3 gradeTint;uniform vec3 gradeShade;uniform float gradeGrain;/);
  const cs = FINAL_FRAG.indexOf("#include <colorspace_fragment>"), gr = FINAL_FRAG.indexOf("if(gradeOn>.5)"), dither = FINAL_FRAG.lastIndexOf("gl_FragColor.rgb+=(ign(gl_FragCoord.xy");
  assert.ok(cs > 0 && gr > cs && dither > gr, "colorspace → grade → dither");
  assert.ok(/^[\x00-\x7f]*$/.test(FINAL_FRAG), "셰이더는 ASCII 만");
});

test("카메라 범위 — 사진에서만 조금 넓고, NaN 은 기본값, 돔 둘러보기는 한 바퀴를 넘어도 된다", () => {
  const out = clampPhotoCam({ angle: 9, pitch: -9, zoom: 99, yaw: 12 }, "outside");
  assert.deepEqual(out, { angle: PHOTO_BOUNDS.outside.angle[1], pitch: PHOTO_BOUNDS.outside.pitch[0], zoom: PHOTO_BOUNDS.outside.zoom[1], yaw: 12 });
  assert.deepEqual(clampPhotoCam({ angle: NaN, pitch: NaN, zoom: NaN, yaw: NaN }, "tunnel"), { angle: 0, pitch: 0, zoom: 1, yaw: 0 });
  for (const v of ["outside", "tunnel", "dome"] as const) {
    const b = PHOTO_BOUNDS[v];
    // 평소 끌기 범위(scene.ts angle ±0.4 · pitch −0.10 ~ 0.13)를 품는다 — 들어올 때의 카메라가 잘리지 않게
    assert.ok(b.angle[0] <= -0.4 && b.angle[1] >= 0.4 && b.pitch[0] <= -0.1 && b.pitch[1] >= 0.13, v);
    assert.ok(b.zoom[0] < 1 && b.zoom[1] >= 1 && b.zoom[0] >= 0.5, v);
    // 들어올 때 값(확대 1)은 그대로 남는다
    assert.deepEqual(clampPhotoCam({ angle: 0.3, pitch: 0.1, zoom: 1, yaw: -2 }, v), { angle: 0.3, pitch: 0.1, zoom: 1, yaw: -2 });
  }
});

test("밖에서 확대 — 앞유리(z = 3·깊이) 안으로 못 들어가고, 따라가는 중엔 물고기와 2.4 보다 가까이 안 간다", () => {
  for (const deep of [1, 1.6, 2.4]) for (const angle of [-0.6, 0, 0.6]) for (const dist of [19, 30, 60]) {
    const d = photoDistance({ dist, zoom: 0.5, angle, deep, following: false });
    assert.ok(d * Math.cos(angle) >= 3 * deep + 1.2 - 1e-9, `deep ${deep} angle ${angle} dist ${dist}`);
    assert.ok(d <= Math.max(dist * 0.5, (3 * deep + 1.2) / Math.cos(angle)) + 1e-9);
  }
  assert.equal(photoDistance({ dist: 30, zoom: 1, angle: 0, deep: 1, following: false }), 30, "확대 1 은 그대로");
  assert.equal(photoDistance({ dist: 4, zoom: 0.5, angle: 0, deep: 1, following: true }), 2.4);
  assert.equal(photoDistance({ dist: 40, zoom: 1.25, angle: 0, deep: 1, following: false }), 50);
});

test("집어 확대 — 벌리면 가까이(확대 값이 작아진다), 잘못된 거리는 그대로", () => {
  assert.equal(pinchZoom(1, 100, 200), 0.5);
  assert.equal(pinchZoom(1, 200, 100), 2);
  assert.equal(pinchZoom(0.8, 0, 100), 0.8);
  assert.equal(pinchZoom(0.8, 100, NaN), 0.8);
});

test("찍는 배율 — 캔버스의 2배까지, GPU 최대 크기 · 픽셀 예산 안, 지금보다 낮추지 않는다", () => {
  // 375×520 · 배율 1.5(폰) → 3 (1125×1560 = 1.75M 픽셀)
  assert.equal(captureRatio({ cssW: 375, cssH: 520, ratio: 1.5, maxSize: 4096 }), 3);
  // 전체 화면 430×932 · 배율 1.5 → 2배면 3.9M 픽셀이라 예산(3M)에서 멈춘다
  const r = captureRatio({ cssW: 430, cssH: 932, ratio: 1.5, maxSize: 8192 });
  assert.ok(r < 3 && r >= 1.5 && 430 * 932 * r * r <= 3_000_000, String(r));
  // 최대 그림 크기 2048 이면 긴 변이 2048 안
  const s = captureRatio({ cssW: 800, cssH: 1200, ratio: 1, maxSize: 2048 });
  assert.ok(1200 * s <= 2048, String(s));
  // 이미 한계를 넘는 기기는 지금 배율 그대로
  assert.equal(captureRatio({ cssW: 1000, cssH: 1000, ratio: 3, maxSize: 2048 }), 3);
  assert.equal(captureRatio({ cssW: 0, cssH: 520, ratio: 1.5, maxSize: 4096 }), 1.5);
});

test("카드 글 — 날짜와 이름 0 ~ 2명, 빈 이름 · 같은 이름 · 긴 이름 정리, 이모지 없음", () => {
  assert.deepEqual(photoCaption("2026-11-13", ["도윤", "서연"]), { title: "우리 수조", sub: "2026.11.13 · 도윤 & 서연" });
  assert.deepEqual(photoCaption("2026-11-13", ["도윤", " "]), { title: "우리 수조", sub: "2026.11.13 · 도윤" });
  assert.deepEqual(photoCaption("2026-11-13", []), { title: "우리 수조", sub: "2026.11.13" });
  assert.deepEqual(photoCaption("2026-11-13", ["하늘", "하늘"]).sub, "2026.11.13 · 하늘");
  assert.equal(photoCaption("2026-11-13", ["아주아주아주아주긴이름입니다"]).sub, "2026.11.13 · 아주아주아주아주긴이름입");
  assert.equal(photoCaption("엉망", [null, undefined, "나"]).sub, "나");
  assert.equal(photoFileName(Date.UTC(2026, 10, 13, 6, 5, 9)), "haru-aquarium-20261113-150509.jpg", "한국 시각");
});

test("카드 자리 — 사진 · 제목 · 이름 줄이 카드 안에서 겹치지 않고, 글은 사진 아래", () => {
  for (const [w, h] of [[1125, 1560], [562, 780], [2048, 1100], [300, 900], [120, 90]]) {
    const L = photoCardLayout(w, h);
    const p = L.photo;
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= L.width && p.y + p.h <= L.height, `${w}×${h} 사진이 카드 안`);
    assert.equal(p.w, w); assert.equal(p.h, h);
    const titleTop = L.title.y - L.title.size, subTop = L.sub.y - L.sub.size;
    assert.ok(titleTop >= p.y + p.h, `${w}×${h} 제목은 사진 아래`);
    assert.ok(subTop >= L.title.y, `${w}×${h} 이름 줄은 제목 아래`);
    assert.ok(L.sub.y + L.sub.size * 0.3 <= L.height, `${w}×${h} 이름 줄이 카드 안`);
    assert.ok(L.title.size >= 18 && L.sub.size >= 13);
  }
});

test("이름표 — 가까운 물고기부터, 서로 안 겹치고 화면 안, 화면 밖 점 · 빈 이름은 뺀다", () => {
  const pts = [
    { id: 1, x: 100, y: 100, depth: 5, text: "흰동가리" },
    { id: 2, x: 104, y: 102, depth: 3, text: "구피 치어" },
    { id: 3, x: 108, y: 98, depth: 8, text: "베타" },
    { id: 4, x: -5, y: 50, depth: 1, text: "밖" },
    { id: 5, x: 200, y: 300, depth: 2, text: "  " },
    { id: 6, x: 370, y: 515, depth: 4, text: "고래상어 다 큰 개체 이름이 아주 김" },
  ];
  const out = placeLabels(pts, 375, 520, { font: 12 });
  assert.equal(out[0].id, 2, "가장 가까운 것부터");
  assert.ok(!out.some((l) => l.id === 4 || l.id === 5));
  for (const a of out) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 375 && a.y + a.h <= 520, `${a.id} 화면 안`);
    for (const b of out) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id}·${b.id} 겹침`);
  }
  assert.ok(out.every((l) => [...l.text].length <= 14));
  assert.equal(placeLabels(pts, 375, 520, { font: 12, max: 1 }).length, 1);
});

test("엔진 계약 — 사진 모드는 시계를 세우고, 사냥 장면 · 다시 보기를 미루고, 고른 표시를 숨기고, 끝나면 카메라를 되돌린다", () => {
  const scene = code("src/lib/aqua3d/scene.ts");
  assert.match(scene, /&&!state\.editing&&!photoOn;/, "schedule 이 사진 모드면 돌지 않는다");
  assert.match(scene, /if\(photoOn\)\{recheck=true;return false;\}/, "안 본 사냥은 끝낼 때");
  assert.match(scene, /if\(photoOn\)return "busy";if\(meal&&meal\.kind==="real"\)return "busy";/, "다시 보기는 바쁨");
  assert.match(scene, /halo\.visible=!!selected&&!photoOn;/);
  assert.match(scene, /photoSaved=\{angle,pitch,pan,yaw:domeYaw\}/);
  assert.match(scene, /angle=photoSaved\.angle;pitch=photoSaved\.pitch;pan=photoSaved\.pan;domeYaw=photoSaved\.yaw;/);
  assert.match(scene, /postNow\.setGrade\(null\)/, "끝내면 필터를 끈다");
  // 찍기 — 배율을 올려 그린 뒤 같은 일 안에서 2D 캔버스로 옮기고, 점 크기를 맞추고, 끝나면 되돌린다. preserveDrawingBuffer 는 켜지 않는다
  assert.match(scene, /renderer\.setPixelRatio\(ratio\);syncPointScale\(\);draw\(0\);/);
  assert.match(scene, /ctx\.drawImage\(canvas,0,0,w,h\)/);
  assert.match(scene, /renderer\.setPixelRatio\(cur\);syncPointScale\(\);draw\(0\);/);
  assert.match(scene, /isContextLost\(\)\)return null/);
  assert.doesNotMatch(scene, /preserveDrawingBuffer/);
  const shoot = scene.slice(scene.indexOf("const shoot="), scene.indexOf("return shot;"));
  assert.doesNotMatch(shoot, /await/, "그리기와 옮기기 사이에 기다리지 않는다");
  // 사진 모드에서 누르기는 물고기를 고르지 않는다(끌기 · 집기만)
  assert.match(scene, /const end=\(e:PointerEvent\)=>\{if\(photoOn\)\{photoUp\(e\);return;\}/);
});

test("화면 계약 — 사진 도구는 누를 때 받고, 공유는 탭 안에서 바로, 다시 찍기 · 닫기, 수조가 다시 지어지면 끝낸다", () => {
  const ui = code("src/components/Aquarium3D.tsx"), photo = code("src/components/AquaPhoto.tsx");
  assert.match(ui, /dynamic\(\(\) => import\("@\/components\/AquaPhoto"\)/);
  assert.doesNotMatch(ui, /from "three"/);
  assert.match(ui, /if \(photo && \(error \|\| !ready \|\| given\.editing \|\| replaying\)\) exitPhoto\(\);/);
  assert.match(ui, /useBackClose\(exitPhoto, !!photo\)/);
  assert.match(photo, /다시 찍기/);
  assert.match(photo, /<CloseButton/);
  // 공유 함수 안에는 await 가 없다(iOS 사파리)
  const share = photo.slice(photo.indexOf("const share = () =>"), photo.indexOf("const retake"));
  assert.doesNotMatch(share, /await/);
  assert.match(share, /shareFileInAppResult\(/);
  assert.match(share, /webShareOrDownload\(/);
  const game = code("src/components/AquariumGame.tsx");
  assert.match(game, /news\[0\] && !replaying && !photoOpen && <GrownCard/, "사진 모드 동안 소식 카드를 멈춘다");
});
