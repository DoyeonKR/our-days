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
  assert.match(scene, /if\(!src\)\{if\(swimmers\.get\(f\.id\)===m\)kit\.loadDeferred\(key\);return;\}/);
});

test("제작 모델 도착은 모아서 한 프레임에 갈아 끼운다 · 돌아가는 중엔 update 가 그리지 않는다 · 새 물고기만 방향을 바로 맞춘다", () => {
  assert.doesNotMatch(scene, /refresh\(\)/);
  assert.match(scene, /queueSwap\(\(\)=>/);
  assert.match(scene, /if\(swaps\.length&&time-lastFlush>=150\)\{lastFlush=time;flushSwaps\(\);\}/);
  assert.match(scene, /if\(dt===0\|\|m\.fresh\)\{m\.root\.quaternion\.copy\(targetQuat\);m\.fresh=false;\}/);
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

test("첫 장은 크기를 잰 뒤 · 셰이더를 다 지은 뒤에 그린다", () => {
  assert.match(scene, /renderer\.compileAsync\(scene,camera\)/);
  assert.match(scene, /if\(disposed\|\|!sized\|\|!compiled\)return;/);
});

test("왕관은 갈아 끼운 몸에 다시 맞춘다 · 전체 보기는 위아래 끌기를 브라우저가 가져가지 않는다", () => {
  assert.match(scene, /m\.crown\.userData\.aquaKeep=true/);
  assert.match(scene, /placeCrown\(m\);\}\);/);
  const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
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
  assert.match(scene, /schoolCourse\([^)]*\{obstacles:motion\.obstacles,feed:motion\.feed,leaderLength:/);
  assert.match(scene, /separate\(motion\.positions,motion\.lengths,motion\.offsets,dt,\{n,pinned:motion\.pinned,scale:wide\}\)/);
  assert.match(scene, /bankAngle\(m\.course\.turn\)/);
  assert.match(scene, /m\.animate\(m\.phase,1,m\.course\)/);
  assert.match(scene, /feed\(atX\)\{if\(disposed\)return;motion\.feed=\{t:elapsed,x:clamp\(atX\?\?0,-4\.5\*wide,4\.5\*wide\)\};\}/);
  assert.match(scene, /motion\.obstacles=\[\.\.\.decorations\.values\(\)\]/);
  assert.match(scene, /motion\.positions\[n\*3\]=c\.x/);
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
