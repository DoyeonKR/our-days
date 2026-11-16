// 수조 엔진 리뷰 lock (2026-11-05) — 누수 · 다시 짓기 · 메모리 · 그리기 호출 · 물속 빛.
// 소스 스캔은 주석을 먼저 지운다(설명문이 먼저 잡힌다 — README §10.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as T from "three";
import { makeHabitat, sandMap, softShadowTexture, surfaceMap, HABITAT_THEMES } from "./habitat.ts";
import { GlbLibrary, disposeGlbScene, flushGlbCache, glbCacheState, setGlbSource } from "./glb.ts";
import { ModelKit } from "./models.ts";
import { waterLit, CAUSTIC_GLSL } from "./waterlight.ts";
import { appCss } from "../cssfiles.ts";

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const read = (p: string) => readFileSync(p, "utf8");
const scene = strip(read("src/lib/aqua3d/scene.ts"));
const toLinear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const linear = (data: Uint8Array) => { let s = 0, n = 0; for (let i = 0; i < data.length; i += 4) { s += toLinear(data[i + 1] / 255); n++; } return s / n; };

test("짓다가 던지면 캔버스 · 관찰자 · WebGL 을 걷는다 · 한 마리 · 장식 하나가 못 지어져도 나머지는 그린다", () => {
  assert.match(scene, /catch \(e\) \{ dispose\(\); throw e; \}/);
  assert.match(scene, /try\{addFish\(f\);\}catch\(e\)\{skip\(/);
  assert.match(scene, /try\{m=addDecor\(p\);\}catch\(e\)\{skip\(/);
  // 리스너는 한 곳(unbind)에 모아 dispose 가 전부 뗀다
  assert.match(scene, /for\(const off of unbind\.splice\(0\)\)off\(\)/);
  assert.doesNotMatch(scene, /canvas\.addEventListener/);
});

test("넓히면 안 움직이는 묶음(틀 · LED · 유리 · 접지 그림자)도 새 폭으로 다시 올린다", () => {
  assert.match(scene, /if\(nextWide!==wide\)\{wide=nextWide;if\(habitat\)\{habitat\.root\.scale\.x=wide;habitat\.root\.updateMatrix\(\);\}topologyChanged=true;\}/);
});

test("제작 모델이 있는 물고기는 피부 그림을 받지 않는다 · 못 받으면 그때 받는다 · 갈아 끼운 key 의 그림은 놓는다", () => {
  const kit = new ModelKit(), calls: string[] = [];
  kit.skinless = new Set(["cobra_guppy"]);
  kit.referenceTexture("cobra_guppy", () => calls.push("ready"));
  assert.equal(kit.referenceTextures.size, 0, "제작 모델이 올 물고기에 그림을 받았다");
  kit.loadDeferred("cobra_guppy"); // 노드엔 document 가 없어 실제로 받지는 않는다 — 미뤄 둔 목록이 비는지만
  kit.referenceTexture("cobra_guppy", () => {});
  kit.disposeReferences();
  assert.match(scene, /kit\.skinless = FISH_GLB/);
  assert.match(scene, /filter\(m=>!m\.glb\)/, "갈아 끼운 물고기의 key 까지 붙잡고 있다");
  // 2026-11-12 — 못 받은 표시(glbFail)를 남긴다: 자라는 물고기가 옛 몸을 더 들고 있지 않고 임시 몸으로 넘어간다
  assert.match(scene, /if\(!src\)\{m\.glbFail=true;if\(swimmers\.get\(f\.id\)===m\)kit\.loadDeferred\(key\);/);
});

test("제작 모델 도착은 모아서 한 프레임에 갈아 끼운다 · 돌아가는 중엔 update 가 그리지 않는다 · 새 물고기만 방향을 바로 맞춘다", () => {
  assert.doesNotMatch(scene, /refresh\(\)/);
  assert.match(scene, /queueSwap\(\(\)=>/);
  assert.match(scene, /if\(swaps\.length&&time-lastFlush>=150\)\{lastFlush=time;flushSwaps\(\);\}/);
  assert.match(scene, /if\(dt===0\|\|m\.fresh\|\|qk>=1\)\{m\.root\.quaternion\.copy\(targetQuat\);m\.fresh=false;\}/);
  // 바로 맞추는 건 새 물고기 · 물고 있는 사냥 장면의 둘뿐(qk 1) — 나머지는 초당 2.8 로 따라 돈다
  assert.match(scene, /const qk=m===mealGhost\|\|m===mealPredS\?\(mealLock\?1:dt\*10\):dt\*2\.8;/);
  // 크기만 바뀌면(주소창 · 전체 보기) 돌아가는 중엔 그리지 않는다
  assert.match(scene, /const resize=\(\)=>\{[\s\S]*?if\(!active\)draw\(0\);\};/);
});

test("WebGL 이 끊기면 되돌려 받거나, 화면이 다시 보일 때 몇 번까지 저절로 다시 연다", () => {
  assert.match(scene, /"webglcontextrestored"/);
  assert.match(scene, /if\(events\.lost\)events\.lost\(\);else events\.error\(ERROR_LOST\)/);
  const ui = strip(read("src/components/Aquarium3D.tsx"));
  assert.match(ui, /const AUTO_RECOVER = 3;/);
  assert.match(ui, /lost: \(\) => \{ lostAt = Date\.now\(\); recover\(\); \}/);
  assert.match(ui, /document\.addEventListener\("visibilitychange", recover\)/);
  assert.match(ui, /if \(recovered\.current >= AUTO_RECOVER\)/);
  assert.match(ui, /ready: \(\) => \{ if \(!cancelled\) setReady\(true\); \}/, "첫 장을 그린 뒤에 준비 문구를 걷는다");
});

test("GLB 는 key 마다 세어 들고 · 다시 열면 그대로 쓰고 · 아무도 안 쓰면 지운다(ImageBitmap 도 닫는다)", async () => {
  let fetched = 0, disposed = 0;
  setGlbSource(async () => { fetched++; const g = new T.Group(), geo = new T.BoxGeometry(); geo.addEventListener("dispose", () => { disposed++; }); g.add(new T.Mesh(geo, new T.MeshStandardMaterial())); return g; });
  try {
    flushGlbCache();
    const a = new GlbLibrary(), b = new GlbLibrary();
    const [x, y] = await Promise.all([a.load("fish", "fry_guppy"), b.load("fish", "fry_guppy")]);
    assert.equal(fetched, 1, "같은 모델을 두 번 받았다");
    assert.equal(x, y);
    assert.equal(((x!.children[0] as T.Mesh).material as T.Material).userData.aquaLit, "rim", "물고기 GLB 에 가장자리 테가 없다");
    a.dispose();
    flushGlbCache();
    assert.equal(disposed, 0, "아직 쓰는 수조가 있는데 지웠다");
    // 탭을 바꿨다가 다시 연 수조 — 같은 모델을 다시 받지 않는다
    b.dispose();
    const c = new GlbLibrary();
    await c.load("fish", "fry_guppy");
    assert.equal(fetched, 1, "다시 열었는데 또 받았다");
    // 자라서 key 가 바뀌었다 — 옛 key 는 놓는다
    await c.load("fish", "juv_guppy");
    c.release("fish", "fry_guppy");
    assert.deepEqual(glbCacheState().find(e => e.id === "fish/fry_guppy")?.refs, 0);
    flushGlbCache();
    assert.equal(disposed, 1);
    assert.equal(glbCacheState().some(e => e.id === "fish/fry_guppy"), false);
    c.dispose(); flushGlbCache();
    assert.equal(glbCacheState().length, 0);
  } finally { setGlbSource(null); }
  // ImageBitmap — dispose 로는 디코딩된 픽셀이 안 풀린다
  const g = globalThis as { ImageBitmap?: unknown };
  const had = g.ImageBitmap;
  let closed = 0;
  class FakeBitmap { width = 1; height = 1; close() { closed++; } }
  g.ImageBitmap = FakeBitmap;
  try {
    const tex = new T.Texture(new FakeBitmap() as unknown as HTMLImageElement), root = new T.Group();
    root.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ map: tex })));
    disposeGlbScene(root);
    assert.equal(closed, 1);
  } finally { g.ImageBitmap = had; }
  const glb = strip(read("src/lib/aqua3d/glb.ts"));
  assert.match(glb, /setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(glb, /import\("three\/examples\/jsm\/libs\/meshopt_decoder\.module\.js"\)/, "압축 해제기는 처음 받을 때 불러온다");
  assert.doesNotMatch(glb, /from "three\/examples\/jsm\/libs\/meshopt/);
});

test("모래 · 표면 픽셀은 한 번만 굽는다(수조를 다시 열 때 512² 잡음을 다시 계산하지 않는다)", () => {
  const a = sandMap(512), b = sandMap(512);
  assert.notEqual(a.map, b.map, "텍스처는 수조마다 새로(닫을 때 지운다)");
  assert.equal(a.map.image.data, b.map.image.data);
  assert.equal(surfaceMap("stone", 128).map.image.data, surfaceMap("stone", 128).map.image.data);
  const h = makeHabitat(2, { anisotropy: 16 }), floor = h.floor.material as T.MeshStandardMaterial;
  assert.equal(floor.map!.anisotropy, 4);
  h.dispose();
});

test("어두운 바위 — 큰 바위가 구멍처럼 검게 보이지 않는다(선형 반사율이 예전의 2.5배 이상 · 0.07 이상)", (t) => {
  const stone = linear(surfaceMap("stone").map.image.data as Uint8Array), rock = linear(surfaceMap("rock").map.image.data as Uint8Array);
  for (let tier = 1; tier <= 6; tier++) {
    const h = makeHabitat(tier), m = h.root.getObjectByName("weathered-hardscape") as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
    const c = m.geometry.attributes.color; let s = 0; for (let i = 0; i < c.count; i++) s += c.getY(i);
    const now = m.material.color.g * rock * (s / c.count), before = new T.Color(HABITAT_THEMES[tier - 1].rock).g * stone * .83;
    t.diagnostic(`tier ${tier}: ${before.toFixed(3)} → ${now.toFixed(3)}`);
    assert.ok(now > before * 2.5 && now > .07, `tier ${tier}: ${now}`);
    h.dispose();
  }
});

test("수조 그리기 호출 — 돌 · 접지 그림자 · 유목 · 흡입구가 한 덩어리 · 거품은 점 입자 한 묶음 · 행렬은 한 번만", (t) => {
  for (let tier = 1; tier <= 6; tier++) {
    const h = makeHabitat(tier), names: string[] = [];
    // 그리기 호출 수 — 장면은 같은 형상 · 재질이 셋 이상이면 한 묶음으로 그린다(scene.ts rebuildBatches)
    let auto = 0;
    const groups = new Map<string, number>();
    h.root.traverse(o => { names.push(o.name); if (o.matrixAutoUpdate) auto++;
      if (o instanceof T.Mesh || o instanceof T.Points) { const k = o instanceof T.InstancedMesh || o instanceof T.Points ? o.uuid : o.geometry.uuid + (o.material as T.Material).uuid; groups.set(k, (groups.get(k) ?? 0) + 1); } });
    const drawables = [...groups.values()].reduce((n, c) => n + (c >= 3 ? 1 : c), 0);
    t.diagnostic(`tier ${tier}: 그리기 ${drawables}`);
    for (const n of ["weathered-hardscape", "soft-contact-shadow", "filter-glass-pipe"]) assert.equal(names.filter(x => x === n).length, 1, `${tier}: ${n}`);
    assert.ok(names.filter(x => x === "gnarled-driftwood").length <= 1);
    assert.equal(names.includes("filter-intake-ring"), false);
    assert.equal(auto, 0, "수조 안 물건 행렬이 매 프레임 다시 계산된다");
    const bubbles = h.root.getObjectByName("diffuser-bubbles") as T.Points;
    assert.ok(bubbles instanceof T.Points && bubbles.geometry.attributes.position.count >= 100 && bubbles.geometry.attributes.position.count <= 200);
    const shafts = h.root.getObjectByName("light-shafts") as T.InstancedMesh;
    assert.ok(shafts instanceof T.InstancedMesh && shafts.count >= 4 && shafts.count <= 6, "빛줄기");
    assert.ok(drawables < 60, `${tier}: ${drawables}`);
    // 유리는 기본 재질 한 번 그리기, 수면은 양면을 한 번에
    const glass = h.root.getObjectByName("side-glass") as T.Mesh;
    assert.ok(glass.material instanceof T.MeshBasicMaterial && glass.material.forceSinglePass);
    const surface = h.root.getObjectByName("rippling-water-surface") as T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
    assert.ok(surface.material.forceSinglePass);
    // 톤 매핑 · 색 공간 — 빠지면 수면 · 떠다니는 입자만 탁하다
    for (const name of ["rippling-water-surface", "suspended-water-particles", "diffuser-bubbles", "light-shafts"]) {
      const o = h.root.getObjectByName(name) as T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
      assert.match(o.material.fragmentShader, /#include <tonemapping_fragment>[\s\S]*#include <colorspace_fragment>/, name);
    }
    // 스넬의 창 · 흐르는 반짝임
    assert.match(surface.material.fragmentShader, /cameraPosition-vWorld/);
    assert.match(surface.material.fragmentShader, /sparkle/);
    // 먼 벽 안개
    const back = h.root.getObjectByName("deep-water-backdrop") as T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
    assert.equal(back.material.fog, true); assert.match(back.material.fragmentShader, /fogColor/);
    h.dispose();
  }
  assert.match(scene, /scene\.matrixAutoUpdate = false; scene\.matrixWorldAutoUpdate = false;/);
  assert.match(scene, /p\.userData\.type==="fish"\|\|p\.userData\.moving/, "장식 묶음은 흔들리는 부품만 매 프레임 올린다");
  assert.match(strip(read("src/lib/aqua3d/decor.ts")), /m\.node\.userData\.moving=true/);
  assert.match(strip(read("src/lib/aqua3d/glb.ts")), /o\.userData\.moving = true/);
});

test("접지 그림자 텍스처는 멀리서도 반짝이지 않는다(Linear)", () => {
  const t = softShadowTexture();
  assert.equal(t.minFilter, T.LinearFilter); assert.equal(t.magFilter, T.LinearFilter);
});

test("보기 모드 누르기 — 물고기만 · 빗나가면 24px 안의 가장 가까운 물고기", () => {
  assert.match(scene, /ray\.intersectObjects\(\[\.\.\.swimmers\.values\(\)\]\.map\(m=>m\.root\),true\)/);
  assert.doesNotMatch(scene, /\[\.\.\.swimmers\.values\(\),\.\.\.decorations\.values\(\)\]/);
  assert.match(scene, /let best=-1,bestD=24;/);
});

test("첫 장은 크기를 잰 뒤 · 셰이더를 다 지은 뒤에 그린다 — 실제로 그릴 그림을 묶고 짓는다(2026-11-11)", () => {
  assert.match(scene, /postNow\.compile\(scene,camera\)/);
  assert.match(scene, /if\(disposed\|\|!sized\|\|!compiled\)return;/);
  // 묶음(인스턴스) 재질도 그리기 전에 — 묶음은 draw 안에서만 지어져 첫 장에서 다시 지었다
  assert.match(scene, /function precompile\(\)\{\s*if\(disposed\)return;\s*if\(batchesDirty\)\{batchesDirty=false;rebuildBatches\(\);\}/);
  const post = strip(read("src/lib/aqua3d/post.ts"));
  // 그림을 묶은 채 짓고 바로 푼다 — 묶지 않고 지으면 톤 매핑 · sRGB 가 화면용으로 붙은 프로그램이 나와 첫 장에서 전부 다시 지었다
  assert.match(post, /renderer\.setRenderTarget\(target\);\s*jobs\.push\(renderer\.compileAsync\(scene, camera\)\);\s*renderer\.setRenderTarget\(half\);/);
  assert.match(post, /renderer\.setRenderTarget\(null\);\s*quad\.material = mat;\s*jobs\.push\(renderer\.compileAsync\(postScene, postCam\)\);/);
});

test("왕관은 갈아 끼운 몸에 다시 맞춘다 · 전체 보기는 위아래 끌기를 브라우저가 가져가지 않는다", () => {
  assert.match(scene, /m\.crown\.userData\.aquaKeep=true/);
  assert.match(scene, /placeCrown\(m\);\}\);/);
  const css = appCss().replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.aqua-tank-3d\.is-full \.aqua-webgl canvas \{ touch-action: none; \}/);
});

test("상점 미리보기는 안 보이면 멈춘다 · 같은 톤 매핑 · 거품을 이어 돌린다", () => {
  const preview = strip(read("src/lib/aqua3d/decor-preview.ts"));
  assert.match(preview, /new IntersectionObserver/);
  assert.match(preview, /intersection\.disconnect\(\)/);
  assert.match(preview, /T\.NeutralToneMapping/);
  assert.match(preview, /animate=t=>\{fx\(t\);parts\(t\);\}/);
  assert.match(scene, /renderer\.toneMapping = T\.NeutralToneMapping/);
  assert.doesNotMatch(scene, /ACESFilmicToneMapping/);
});

test("물속 빛 — 모래와 같은 일렁임 식을 장식 · 물고기 재질이 같이 쓰고, 물고기만 가장자리 테", () => {
  const habitat = strip(read("src/lib/aqua3d/habitat.ts"));
  assert.match(habitat, /\$\{CAUSTIC_GLSL\}/);
  assert.match(habitat, /aquaCaustic\(vAquaPosition\.xz,aquaTime\)/);
  const shader = () => ({ uniforms: {} as Record<string, unknown>, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader });
  const fish = new T.MeshStandardMaterial(), rock = new T.MeshStandardMaterial();
  waterLit(fish, true); waterLit(rock, false); waterLit(fish, true);
  const a = shader(), b = shader();
  fish.onBeforeCompile(a as never, {} as never); rock.onBeforeCompile(b as never, {} as never);
  for (const s of [a, b]) {
    assert.ok(s.fragmentShader.includes(CAUSTIC_GLSL)); assert.match(s.fragmentShader, /aquaCaustic\(vAquaWorld\.xz,aquaTime\)/);
    assert.match(s.vertexShader, /vAquaWorld=\(modelMatrix\*aquaW\)\.xyz/); assert.match(s.vertexShader, /instanceMatrix\*aquaW/);
  }
  assert.match(a.fragmentShader, /float aquaRim=/); assert.doesNotMatch(b.fragmentShader, /float aquaRim=/);
  assert.notEqual(fish.customProgramCacheKey(), rock.customProgramCacheKey(), "테가 있는 재질과 없는 재질이 같은 프로그램을 쓴다");
  assert.equal(a.fragmentShader.split("aquaRim=").length, 2, "두 번 달렸다");
  assert.match(scene, /waterLitTree\(animal\.root,false\)/); assert.match(scene, /waterLitTree\(made\.root,false\)/);
});

test("깊이 안개 · 물고기 그림자", () => {
  // 안개는 카메라 거리를 따라간다 — 고른 물고기를 따라 다가가면(dist) 같이 당겨진다
  assert.match(scene, /scene\.fog\.near=dist-2;scene\.fog\.far=dist\+9;/);
  assert.match(scene, /dist=camD\+\(near-camD\)\*focusK/);
  assert.match(scene, /"fish-floor-shadows"/);
  assert.match(scene, /fishShadows\.setMatrixAt\(i,shadowDummy\.matrix\)/);
  assert.match(scene, /diffuseColor\.a\*=vColor\.g/);
});

test("움직임 자리 — 먹이 · 장식 피하기 · 서로 비켜 가기에 쓸 값을 매 프레임 할당 없이 채운다", () => {
  // 2026-11-05 통합 — 자리표시(// motion: …)를 실제 연결로 바꿨다: 길 함수가 장식 · 먹이를 받고, 겹침 밀기가 돈다
  // 2026-11-11 — 한 프레임의 물고기 자리는 fishstep.ts(테스트도 같은 식을 돌린다). 화면은 장식 · 먹이 · 터널 · 돔을 넘긴다
  const step = readFileSync(join(import.meta.dirname, "fishstep.ts"), "utf8");
  assert.match(scene, /stepFish\(swimmers,schools,[^;]*\{wide,tall,deep,heightAt,obstacles:motion\.obstacles,feed:motion\.feed,hall:motion\.hall\},motion\)/);
  assert.match(step, /schoolCourse\(sc\?\.leader \?\? id, sc\?\.slot \?\? 0, id, elapsed, m\.length, habitKey\(m\.family, m\.key\), wide, opts\)/);
  // 2026-11-12 — 옵션은 모듈 객체(SEP)를 다시 쓰고, 몸 방향 · 둥근 판을 넘겨 긴 몸 · 바닥 물고기는 몸통 캡슐로 본다
  assert.match(step, /SEP\.n = n; SEP\.pinned = b\.pinned; SEP\.scale = wide; SEP\.deep = deep; SEP\.heading = b\.heading; SEP\.disc = DISC; separate\(b\.positions, b\.lengths, off, dt, SEP\)/);
  assert.match(scene, /bankAngle\(m\.course\.turn\)/);
  assert.match(scene, /m\.animate\(m\.phase,1,m\.course\)/);
  // 2026-11-12 — 멈춰 있으면(움직임 줄이기) 먹이 알갱이를 한 장면으로 그리는 줄이 뒤에 붙었다
  assert.match(scene, /feed\(atX\)\{if\(disposed\)return;motion\.feed=\{t:elapsed,x:clamp\(atX\?\?0,-4\.5\*wide,4\.5\*wide\)\};/);
  assert.match(scene, /motion\.obstacles=\[\.\.\.decorations\.values\(\)\]/);
  assert.match(step, /b\.positions\[n \* 3\] = c\.x/);
  assert.doesNotMatch(step.slice(step.indexOf("export function stepFish")), /new Float32Array/);
  // 프레임마다 새 배열을 만들지 않는다 — 배열은 물고기 수가 바뀔 때만 다시 만든다
  const draw = scene.slice(scene.indexOf("function draw("), scene.indexOf("const syncPointScale"));
  assert.doesNotMatch(draw, /new Float32Array/);
  const ui = strip(read("src/components/Aquarium3D.tsx"));
  assert.match(ui, /controller\.current\?\.feed\(feedX\)/);
});

test("엔진 — 물속 환경광 · 후처리 한 번(그림에 그린 뒤 톤 매핑 · sRGB 는 마지막 한 번만)", () => {
  const post = readFileSync(join(import.meta.dirname, "post.ts"), "utf8");
  assert.match(post, /PMREMGenerator/);
  assert.ok(post.includes("hdr ? T.HalfFloatType : T.UnsignedByteType, samples: 0"), "멀티샘플 깊이가 깨져 물고기가 줄무늬가 됐다 — 멀티샘플 없이 FXAA");
  assert.ok(post.includes("vec3 fxaa(vec2 p)"));
  assert.ok(post.includes("min(v,vec3(2.))"), "파이어플라이 상한");
  assert.match(post, /#include <tonemapping_fragment>[\s\S]*#include <colorspace_fragment>/);
  assert.match(post, /setRenderTarget\(target\)[\s\S]*setRenderTarget\(null\)/);
  assert.match(post, /if \(!opts\.still\(\)\) mat\.uniforms\.time\.value = time/, "움직임 줄이기면 일렁임을 멈춘다");
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
  assert.match(scene, /scene\.environment = envMap/);
  assert.match(scene, /postNow\.render\(scene,camera,elapsed,\{distance:focusDist,strength:/, "초점 · 흐림 세기를 넘긴다");
  assert.doesNotMatch(scene, /renderer\.render\(scene,camera\)/, "화면에 바로 그리지 않는다(후처리를 건너뛴다)");
  assert.match(scene, /post\?\.dispose\(\);envMap\?\.dispose\(\)/);
});

// ── 폰 부담 줄이기(2026-11-11) ──────────────────────────────────────────
test("셰이더 원문은 ASCII 만 — 후처리 · 환경광 · 빛줄기 · 돔 · 터널(GLSL ES 는 주석 속 한글도 컴파일 오류로 보는 기기가 있다)", async () => {
  const post = await import("./post.ts");
  const { BEAM_VERT } = await import("./giants.ts");
  const { makeDome } = await import("./dome.ts");
  const { makeTunnel } = await import("./tunnel.ts");
  const food = await import("./food.ts"), murk = await import("./murk.ts");
  const shaders: [string, string][] = [["ENV", post.ENV_FRAG], ["DOWN", post.DOWN_FRAG], ["GLOW", post.GLOW_FRAG], ["BLUR", post.BLUR_FRAG], ["FINAL", post.FINAL_FRAG], ["BEAM", BEAM_VERT],
    ["FOOD:v", food.FOOD_VERT], ["FOOD:f", food.FOOD_FRAG], ["MOTE:v", murk.MOTE_VERT], ["MOTE:f", murk.MOTE_FRAG]];
  const dome = makeDome({ front: 7, wide: 1, top: 9, water: 0x1a4a6a, high: 0x9fe3ef }), tunnel = makeTunnel(2.4);
  for (const [name, root] of [["dome", dome.root], ["tunnel", tunnel.root]] as const)
    root.traverse((o) => { const m = (o as T.Mesh).material; if (m instanceof T.ShaderMaterial) shaders.push([`${name}:${m.uuid.slice(0, 4)}:v`, m.vertexShader], [`${name}:${m.uuid.slice(0, 4)}:f`, m.fragmentShader]); });
  assert.ok(shaders.length >= 10);
  for (const [name, src] of shaders) assert.ok(/^[\x00-\x7f]*$/.test(src), `${name} 에 ASCII 밖 글자`);
  dome.dispose(); tunnel.dispose();
});

test("후처리 — 반 크기에서 빛 번짐 · 흐림을 모으고 마지막엔 한 번씩만 읽는다 · 8비트 그림은 sRGB · 디더링은 화면 좌표 잡음", async () => {
  const post = await import("./post.ts");
  const taps = (src: string) => (src.match(/texture2D\(/g) ?? []).length;
  // 마지막 그리기: 빛 번짐 1 · 흐림 1 — 예전엔 픽셀마다 빛 번짐 16 · 흐림 깊이+색 12쌍을 읽었다
  assert.equal(post.FINAL_FRAG.match(/texture2D\(tGlow/g)?.length, 1);
  assert.equal(post.FINAL_FRAG.match(/texture2D\(tBlur/g)?.length, 1);
  assert.doesNotMatch(post.FINAL_FRAG, /for\(int/, "마지막 그리기엔 탭 고리가 없다");
  // 줄이기: 2×2 를 하나씩 걸러(fix) 평균 — 거르기 전에 섞으면 NaN 이 번진다. 알파엔 흐림 반지름
  assert.equal(post.DOWN_FRAG.match(/fix\(vUv\+vec2/g)?.length, 4);
  assert.match(post.DOWN_FRAG, /gl_FragColor=vec4\(c\*\.25,aperture>\.001\?coc\(vUv\):0\.\)/);
  assert.equal(taps(post.GLOW_FRAG), 2, "빛 번짐 고리 한 바퀴에 두 점(8방향 × 2)");
  assert.match(post.BLUR_FRAG, /s\.a\*1\.2/, "흐림 표본마다 그 점의 흐림 반지름(알파)으로 무게");
  // 8비트 그림은 sRGB 로 담는다 — 선형 색을 8비트에 그대로 담으면 어두운 물빛이 계단처럼 끊겼다(GPU 가 쓸 때 담고 읽을 때 풀어 셰이더는 그대로)
  const src = read("src/lib/aqua3d/post.ts");
  assert.match(src, /colorSpace = hdr \? T\.NoColorSpace : T\.SRGBColorSpace/);
  assert.match(src, /target\.texture\.colorSpace = colorSpace/);
  assert.match(src, /depthBuffer: false, samples: 0/, "반 · 4분의 1 그림은 깊이 없이");
  // 디더링 — sin 해시는 시간이 커지면 무너진다
  assert.match(post.FINAL_FRAG, /float ign\(vec2 p\)\{return fract\(52\.9829189\*fract\(dot\(p,vec2\(\.06711056,\.00583715\)\)\)\);\}/);
  assert.match(post.FINAL_FRAG, /mod\(time,64\.\)/);
  assert.doesNotMatch(post.FINAL_FRAG, /43758\.5453/);
  // 빛 번짐 · 흐림이 꺼지면 줄이기부터 건너뛴다
  assert.match(src, /if \(bloom \|\| dof\) draw\(down, half\);\s*if \(bloom\) draw\(glow, glowT\);\s*if \(dof\) draw\(blur, blurT\);/);
  // 환경광 그림 자체도 지운다 · 반정밀을 못 그리는 기기는 굽지 않는다
  assert.match(src, /rt\.texture\.addEventListener\("dispose", done\)/);
  assert.match(src, /if \(!canRenderHalf\(renderer\)\) return null;/);
});

test("캔버스는 멀티샘플 · 깊이 · 스텐실을 안 받는다(장면은 후처리 그림에, 캔버스엔 깊이를 안 쓰는 네모 하나)", () => {
  assert.match(scene, /new T\.WebGLRenderer\(\{ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" \}\)/);
  const src = read("src/lib/aqua3d/post.ts");
  assert.match(src, /new T\.ShaderMaterial\(\{\s*depthTest: false, depthWrite: false,/, "화면에 그리는 마지막 네모는 깊이를 안 쓴다");
});

test("되돌려 받은 연결 — 환경광을 다시 굽고 셰이더를 모아 다시 짓는다", () => {
  const restored = scene.slice(scene.indexOf('"webglcontextrestored"'), scene.indexOf("const down=("));
  assert.match(restored, /envMap=underwaterEnvironment\(renderer\);scene\.environment=envMap;/);
  assert.match(restored, /compiled=false;schedule\(\);precompile\(\);/);
  assert.match(scene, /\.then\(\(\)=>\{if\(disposed\|\|lost\)return;compiled=true;/);
});

test("따라가기 — 깊은 수조 끝까지 · 초점은 물고기 몸 · 카메라는 물고기를 옮긴 뒤에", () => {
  assert.match(scene, /const zReach=3\*deep-\.6;/);
  assert.match(scene, /focusGoal\.z=clamp\(focusGoal\.z,-zReach,zReach\)/);
  assert.doesNotMatch(scene, /focusGoal\.z=clamp\(focusGoal\.z,-2\.4,2\.4\)/);
  assert.match(scene, /camera\.position\.distanceTo\(mealK>\.5\?focusLook:sel\?sel\.root\.position:focusLook\)/);
  const draw = scene.slice(scene.indexOf("function draw("), scene.indexOf("const syncPointScale"));
  const moved = draw.indexOf("m.root.position.set(x,y,z)"), placed = draw.indexOf("placeCamera();"), halo = draw.indexOf("halo.quaternion.copy(camera.quaternion)");
  assert.ok(moved > 0 && placed > moved, "물고기 자리를 먼저 옮긴다");
  assert.ok(halo > placed, "후광은 이번 프레임 카메라를 본다");
  assert.equal(draw.split("placeCamera();").length, 2, "한 번만 놓는다");
});

test("터널 · 돔 안에선 위아래 끌기를 브라우저가 가져가지 않는다 · 돔은 폰에서 물고기가 주인공", () => {
  assert.match(scene, /canvas\.style\.touchAction=inTunnel\?"none":"";/);
  const raw = read("src/lib/aqua3d/scene.ts");
  const m = /const DOME_EYE = ([\d.]+), DOME_UP = ([\d.]+), DOME_FOV = (\d+), TUNNEL_UP = ([\d.]+);/.exec(raw);
  assert.ok(m, "안에서 보기 값");
  const [eye, up, fov, tunnelUp] = m!.slice(1).map(Number);
  // 돔(반지름 2.7) 안에 머문다 · 둘레 수초보다 높이 보되 꼭대기 뼈대에 붙지 않는다
  assert.ok(eye >= 1.7 && eye <= 2.1, String(eye));
  // 11단계 물고기는 대부분 눈보다 5~8 위 — 화면 아래 끝이 수평선보다 위(수초 · 바위가 첫 장을 덮지 않게)
  assert.ok(up - (fov / 2) * Math.PI / 180 > .1, `아래 끝 ${(up * 180 / Math.PI - fov / 2).toFixed(0)}°`);
  // 터널은 예전 각(.58 rad · 33°) 그대로 — 원래도 물고기가 잘 보였다
  assert.ok(fov < 72 && tunnelUp >= .58);
  // 위아래 둘러보기 범위 — 기본 각을 올려도 끝까지 내리면 예전 바닥(돔 .18 · 터널 .26 rad)까지 닿는다(끌기 하한 -.10)
  const down = /const DOME_DOWN = ([\d.]+), TUNNEL_DOWN = ([\d.]+);/.exec(raw);
  assert.ok(down);
  assert.ok(up - .10 * Number(down![1]) <= .19, "돔 아래 끝");
  assert.ok(tunnelUp - .10 * Number(down![2]) <= .27, "터널 아래 끝 — 터널을 따라 앞을 본다");
  assert.match(scene, /up=DOME_UP\+pitch\*\(pitch<0\?DOME_DOWN:3\.2\)/);
  assert.match(scene, /up=TUNNEL_UP\+pitch\*\(pitch<0\?TUNNEL_DOWN:3\.2\)/);
});

test("닫은 수조의 렌더러를 GLB 캐시가 붙잡지 않는다 — 나눠 쓰는 형상 · 재질 · 텍스처에 단 리스너를 뗀다", () => {
  assert.match(scene, /scene\.traverse\(collectBorrowed\);for\(const r of borrowed\)r\.dispose\(\);borrowed\.clear\(\);/);
  const disposeFn = scene.slice(scene.indexOf("function dispose(){"), scene.indexOf("let post:Post"));
  assert.ok(disposeFn.indexOf("r.dispose()") < disposeFn.indexOf("renderer.dispose()"), "렌더러를 닫기 전에");
  // 갈아 끼운 몸이 떠나도(치어 → 어린 모습) 그 형상의 리스너를 떼도록, 도착할 때마다 모아 둔다
  assert.match(scene, /for\(const job of jobs\)\{try\{job\(\);\}catch\(e\)\{skip\("제작 모델",e\);\}\}\s*scene\.traverse\(collectBorrowed\);/);
  // 실측(2026-11-11, 크롬 · 같은 수조를 네 번 열고 닫기): 캐시 재질의 dispose 리스너 1 → 2 → 3 → 4 로 쌓이던 것이 닫을 때마다 0
});

test("빛줄기 · 고래는 한 번에 그린다 · 11단계 돔은 수조의 배경 그림을 빌린다(같은 tank_9 를 두 번 받지 않는다)", async () => {
  assert.match(scene, /scenery:\(\)=>habitatScenery\(habitat\)/);
  const dome = read("src/lib/aqua3d/dome.ts");
  assert.match(dome, /opts\.art && !opts\.scenery\) photo =/);
  const { makeDome } = await import("./dome.ts");
  const tx = new T.Texture();
  let ready: T.Texture | null = null;
  const d = makeDome({ front: 7, wide: 1, top: 9, water: 0, high: 0, art: 9, scenery: () => ready });
  const sea = (() => { let m: T.ShaderMaterial | null = null; d.root.traverse((o) => { const x = (o as T.Mesh).material; if (x instanceof T.ShaderMaterial && "scenery" in x.uniforms) m = x; }); return m as unknown as T.ShaderMaterial; })();
  d.animate(1); assert.equal(sea.uniforms.ready.value, 0, "받기 전엔 물빛만");
  ready = tx; d.animate(2); assert.equal(sea.uniforms.scenery.value, tx); assert.equal(sea.uniforms.ready.value, 1);
  let gone = false; tx.addEventListener("dispose", () => { gone = true; });
  d.dispose(); assert.equal(gone, false, "빌린 그림은 수조가 지운다");
});

test("고른 물고기 따라가기도 가리는 것을 비킨다 · 끌면 그 각에서 다시 고른다 · 터널 · 돔은 안 한다", () => {
  assert.match(scene, /else if\(sel&&!state\.editing&&!inTunnel&&!inDome\)\{/);
  assert.match(scene, /if\(Math\.abs\(angle-followBase\)>\.02\)\{followPick=null;followBase=angle;\}/);
  assert.match(scene, /fillBlockers\(sel\);followPick=clearShot\(/);
});
