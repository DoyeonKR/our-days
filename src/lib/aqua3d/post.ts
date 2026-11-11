import * as T from "three";

/** 3D 엔진 다듬기(2026-11-10) [사용자: "3d 엔진을 우리는 더 디벨럽해야해 아직 10점 만점중 3점"]
 *
 *  ① 물속 환경광(underwaterEnvironment) — 예전엔 해 하나 · 하늘빛 하나 · 보조등 하나뿐이라 물고기 비늘 · 바위 · 금속 · 유리에 비치는 것이 없어 장난감처럼 납작했다.
 *     위는 밝은 물빛 · 아래는 어두운 심해 · 수면엔 빛 창이 난 구를 한 번 구워(PMREM) scene.environment 로 쓴다. 구울 때 한 번뿐이라 매 프레임 비용은 없다.
 *  ② 물속 후처리(makePost) — 장면을 선형 HDR 그림에 그린 뒤 화면에 한 번 옮기면서:
 *     물속 일렁임(아주 작은 굴절) · 가장자리 색 갈라짐 · 밝은 곳의 빛 번짐 · 위가 밝은 물빛 그라데이션 · 비네트 · 톤 매핑 · sRGB · 디더링.
 *     장면의 셰이더들은 그림(렌더 타깃)에 그릴 땐 톤 매핑 · 색 공간을 건너뛰므로(three 규칙) 여기서 한 번만 한다 — 두 번 하면 색이 바랜다.
 *  움직임 줄이기면 일렁임을 멈춘다(빛 번짐 · 비네트는 그대로).
 *
 *  ③ 폰 부담 줄이기(2026-11-11) — 빛 번짐(16탭) · 피사계 심도(깊이+색 12쌍)를 화면 픽셀마다 읽어 후처리만 픽셀당 24~52번 읽었다.
 *     이제 장면 그림을 한 번 반으로 줄이고(4점 평균 · 흐림 반지름은 알파에), 빛 번짐은 4분의 1, 흐림은 반 크기에서 모은 뒤 마지막에 한 번씩만 읽는다.
 *     마지막 그리기는 픽셀당 FXAA 5~9 + 색 갈라짐 2 + 빛 번짐 1 (+ 따라갈 때 깊이 1 · 흐림 1).
 *  ⚠ 셰이더 원문은 ASCII 만 — GLSL ES 는 주석 속 한글도 컴파일 오류로 보는 기기가 있다(videoColor 와 같은 규칙, engine.test 가 본다). 설명은 이 TS 주석에 둔다. */

/** 반정밀(HalfFloat) 그림에 그릴 수 있나 — 못 그리는 기기는 8비트 그림으로 떨어지고 환경광(PMREM 은 반정밀만)도 건너뛴다 */
export const canRenderHalf = (renderer: T.WebGLRenderer) => renderer.extensions.has("EXT_color_buffer_half_float") || renderer.extensions.has("EXT_color_buffer_float");

// 위로 갈수록 밝은 물빛, 꼭대기엔 수면의 빛 창(스넬의 창), 옆엔 은은한 띠
export const ENV_FRAG = "varying vec3 vP;uniform vec3 top;uniform vec3 deep;void main(){float h=vP.y*.5+.5;vec3 c=mix(deep,top,pow(h,1.4));c+=vec3(1.,.97,.9)*smoothstep(.86,.98,vP.y)*3.;c+=top*.25*pow(1.-abs(vP.y),6.);gl_FragColor=vec4(c,1.);}";
const ENV_VERT = "varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";

/** 굽는다. 반정밀 그림을 못 그리는 기기는 null(PMREM 이 깨진 그림에 굽고 경고만 쏟았다).
 *  ⚠ r0.187 PMREM 은 면 크기 하한이 256 이다(options.size 를 64 로 줘도 256) — 작은 원본으로 줄이는 건 three 가 막는다.
 *  구운 그림의 텍스처를 지우면 그림(렌더 타깃) 자체도 같이 지운다 — 예전엔 텍스처만 지워 프레임버퍼가 남았다. */
export function underwaterEnvironment(renderer: T.WebGLRenderer, top = 0x9fe3ef, deep = 0x0a2a3a): T.Texture | null {
  if (!canRenderHalf(renderer)) return null;
  const env = new T.Scene();
  const sky = new T.Mesh(
    new T.SphereGeometry(10, 32, 16),
    new T.ShaderMaterial({ side: T.BackSide, uniforms: { top: { value: new T.Color(top) }, deep: { value: new T.Color(deep) } }, vertexShader: ENV_VERT, fragmentShader: ENV_FRAG }),
  );
  env.add(sky);
  const pmrem = new T.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  sky.geometry.dispose();
  (sky.material as T.Material).dispose();
  const done = () => { rt.texture.removeEventListener("dispose", done); rt.dispose(); };
  rt.texture.addEventListener("dispose", done);
  return rt.texture;
}

/** 초점 — 카메라에서 초점까지 거리(월드 단위) · 흐림 세기(0 = 없음, 1 = 따라가기 확대) */
export type Focus = { distance: number; strength: number };
/** 느린 폰 계단(framepace.POST_LEVELS) — 0 전부 · 1 색 갈라짐 끔 · 2 빛 번짐도 끔 · 3 장면 그림을 0.75배로 */
export type Post = {
  render: (scene: T.Scene, camera: T.PerspectiveCamera, time: number, focus?: Focus) => void;
  /** 그리기 전에 장면 · 후처리 셰이더를 실제로 그릴 그림에 맞춰 짓는다 */
  compile: (scene: T.Scene, camera: T.Camera) => Promise<unknown>;
  setLevel: (level: number) => void;
  /** 장면 그림 크기 ÷ 화면 그림 크기(계단 3 이면 .75) — 점 입자 크기를 맞춘다 */
  scale: () => number;
  /** 지금 그림들이 쓰는 GPU 바이트(색 · 깊이) — 개발 진단용 */
  bytes: () => number;
  dispose: () => void;
};

const QUAD_VERT = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
// 깊이 → 거리 · 흐림 반지름(초점 앞뒤 35% 는 선명한 띠) · 깨진 값(NaN · 무한) 거르기 · 파이어플라이 상한 2
// 깨진 값 — 법선이 0 인 면이 환경광을 읽으면 NaN 이 나와 검은 점이 되고, 빛 번짐 · 흐림이 그걸 번지게 했다
// 상한 2 — 얇은 지느러미가 환경광을 비스듬히 받으면 한 픽셀이 수십 배로 튀었다(2026-11-11). 뉴트럴 톤 매핑 뒤엔 거의 같은 흰색, 깨진 점은 0
const COMMON = `uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 texel;uniform vec2 px;uniform float near;uniform float far;uniform float focus;uniform float aperture;
float viewZ(vec2 p){float d=texture2D(tDepth,p).x;return (near*far)/(far-(far-near)*d);}
float coc(vec2 p){float f=max(focus,1.);return clamp(max(abs(viewZ(p)-focus)-f*.35,0.)/f*aperture,0.,1.);}
bool bad(vec3 v){return any(isnan(v))||any(isinf(v));}
vec3 tap(vec2 p){vec3 v=texture2D(tColor,p).rgb;return bad(v)?vec3(-1.):min(v,vec3(32.));}
vec3 fix(vec2 p){vec3 v=tap(p);return v.r>=0.?min(v,vec3(2.)):vec3(0.);}
`;
/** 반으로 줄이기 — 장면 그림 2×2 를 하나씩 걸러(fix) 평균한다(거르기 전에 섞으면 NaN 이 번진다). 알파엔 흐림 반지름 */
export const DOWN_FRAG = `varying vec2 vUv;${COMMON}
void main(){vec2 h=texel*.5;
  vec3 c=fix(vUv+vec2(-h.x,-h.y))+fix(vUv+vec2(h.x,-h.y))+fix(vUv+vec2(-h.x,h.y))+fix(vUv+vec2(h.x,h.y));
  gl_FragColor=vec4(c*.25,aperture>.001?coc(vUv):0.);}`;
/** 빛 번짐 — 4분의 1 크기에서, 예전과 같은 둘레 8방향 × 두 거리(화면 9 · 19.8 픽셀)에서 밝은 곳만 */
export const GLOW_FRAG = `varying vec2 vUv;uniform sampler2D tHalf;uniform vec2 px;
void main(){vec3 g=vec3(0.);
  for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*px*9.;
    vec3 s=texture2D(tHalf,vUv+o).rgb+texture2D(tHalf,vUv+o*2.2).rgb;g+=max(s-1.6,0.);}
  gl_FragColor=vec4(g*.05,1.);}`;
/** 피사계 심도 — 반 크기에서 원판 위 12점(반지름 화면 8 픽셀 × 흐림 반지름). 표본마다 그 점의 흐림 반지름(알파)으로 무게를 줘 앞의 선명한 물고기가 뒤로 번지지 않는다 */
export const BLUR_FRAG = `varying vec2 vUv;uniform sampler2D tHalf;uniform vec2 px;
void main(){vec4 m=texture2D(tHalf,vUv);float r0=m.a;vec3 acc=m.rgb;float wsum=1.;
  for(int i=0;i<12;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/12.);vec2 o=vec2(cos(a),sin(a))*rr*px*8.;
    vec4 s=texture2D(tHalf,vUv+o*r0);float w=smoothstep(0.,1.,s.a*1.2);acc+=s.rgb*w;wsum+=w;}
  gl_FragColor=vec4(acc/wsum,r0);}`;
/** 마지막 — 일렁임 · FXAA · 색 갈라짐 · (흐림 섞기) · 빛 번짐 더하기 · 물빛 · 비네트 · 톤 매핑 · sRGB · 디더링.
 *  FXAA — 멀티샘플 대신 가장자리만 그 방향으로 두 점 더 읽어 섞는다(⚠ 멀티샘플 그림의 깊이 그림이 줄 단위로 깨져 피사계 심도가 물고기를 흰 가로줄로 부쉈다, 2026-11-11).
 *  디더링 — 짙은 물빛 그라데이션의 띠를 없앤다. 예전 sin 해시는 시간이 커지면(수십 분) 정밀도가 무너져 무늬가 났다 → 화면 좌표만 쓰는 interleaved gradient noise, 시간은 64 초로 돌린다. */
export const FINAL_FRAG = `varying vec2 vUv;${COMMON}uniform sampler2D tBlur;uniform sampler2D tGlow;uniform float time;uniform float split;uniform float bloom;
float luma(vec3 c){return dot(min(c,vec3(1.)),vec3(.299,.587,.114));}
vec3 fxaa(vec2 p){
  vec3 m=fix(p);float lm=luma(m);
  float nw=luma(fix(p+vec2(-1.,-1.)*texel)),ne=luma(fix(p+vec2(1.,-1.)*texel)),sw=luma(fix(p+vec2(-1.,1.)*texel)),se=luma(fix(p+vec2(1.,1.)*texel));
  float lo=min(lm,min(min(nw,ne),min(sw,se))),hi=max(lm,max(max(nw,ne),max(sw,se)));
  if(hi-lo<max(.04,hi*.12))return m;
  vec2 d=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
  float red=max((nw+ne+sw+se)*.03125,1./128.);
  d=clamp(d/(min(abs(d.x),abs(d.y))+red),-8.,8.)*texel;
  vec3 a=.5*(fix(p+d*(-1./6.))+fix(p+d*(1./6.)));
  vec3 b=a*.5+.25*(fix(p-d*.5)+fix(p+d*.5));
  float lb=luma(b);return (lb<lo||lb>hi)?a:b;
}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
void main(){
  vec2 uv=vUv;
  vec2 d=uv-.5;float r2=dot(d,d);
  uv+=vec2(sin(uv.y*24.+time*1.25),cos(uv.x*19.+time*1.05))*(.0007+r2*.002);
  vec3 c=fxaa(uv);
  if(split>.5){vec2 ca=d*r2*.014;float k=smoothstep(.04,.2,r2);c.r=mix(c.r,fix(uv+ca).r,k);c.b=mix(c.b,fix(uv-ca).b,k);}
  if(aperture>.001){float r0=coc(uv);c=mix(c,texture2D(tBlur,uv).rgb,.75*smoothstep(.1,.7,r0));}
  if(bloom>.5)c+=texture2D(tGlow,uv).rgb;
  c*=mix(.84,1.1,smoothstep(.0,1.,uv.y));
  c*=1.-smoothstep(.12,.55,r2)*.42;
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb+=(ign(gl_FragCoord.xy+5.588238*floor(mod(time,64.)*30.))-.5)/255.;
}`;

export function makePost(renderer: T.WebGLRenderer, opts: { still: () => boolean }): Post {
  const size = new T.Vector2();
  // ⚠ 멀티샘플(samples)을 쓰지 않는다(2026-11-11) — 멀티샘플 그림의 깊이 그림이 줄 단위로 깨져 와서 피사계 심도가 물고기를 흰 가로줄로 부쉈다
  //   (가까운 비단잉어가 통째로 줄무늬가 됐다 · samples 0 이면 멀쩡). 계단은 FXAA 가 다듬는다
  // 반정밀 그림을 못 그리는 기기(확장 없음)는 보통 그림으로 — 빛 번짐이 약해질 뿐 수조가 검게 나오지 않는다.
  // 그때 그림은 sRGB 로 담는다(2026-11-11) — 선형 색을 8비트에 그대로 담으면 어두운 물빛이 계단처럼 끊겼다. 쓸 때 GPU 가 sRGB 로 담고 읽을 때 선형으로 풀어 주므로 셰이더는 그대로다
  const hdr = canRenderHalf(renderer);
  const type = hdr ? T.HalfFloatType : T.UnsignedByteType, colorSpace = hdr ? T.NoColorSpace : T.SRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: hdr ? T.HalfFloatType : T.UnsignedByteType, samples: 0, depthBuffer: true });
  target.texture.colorSpace = colorSpace;
  target.depthTexture = new T.DepthTexture(1, 1);
  // 반 · 4분의 1 그림 — 깊이 없이(빛 번짐 · 흐림은 깊이를 안 쓴다), 둘레는 늘여 읽는다
  const small = () => { const t = new T.WebGLRenderTarget(1, 1, { type, depthBuffer: false, samples: 0 }); t.texture.colorSpace = colorSpace; return t; };
  const half = small(), blurT = small(), glowT = small();
  const shared = { texel: { value: new T.Vector2(1, 1) }, px: { value: new T.Vector2(1, 1) }, near: { value: 0.1 }, far: { value: 100 }, focus: { value: 20 }, aperture: { value: 0 },
    tColor: { value: target.texture }, tDepth: { value: target.depthTexture }, tHalf: { value: half.texture } };
  const pass = (fragmentShader: string, extra: Record<string, T.IUniform> = {}) =>
    new T.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, uniforms: { ...shared, ...extra }, vertexShader: QUAD_VERT, fragmentShader });
  const down = pass(DOWN_FRAG), glow = pass(GLOW_FRAG), blur = pass(BLUR_FRAG);
  const mat = new T.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { ...shared, tBlur: { value: blurT.texture }, tGlow: { value: glowT.texture }, time: { value: 0 }, split: { value: 1 }, bloom: { value: 1 } },
    vertexShader: QUAD_VERT, fragmentShader: FINAL_FRAG,
  });
  const quad = new T.Mesh<T.BufferGeometry, T.Material>(new T.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new T.Scene();
  postScene.add(quad);
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let level = 0;
  const sceneScale = () => (level >= 3 ? 0.75 : 1);
  const fit = (t: T.WebGLRenderTarget, w: number, h: number) => { if (t.width !== w || t.height !== h) t.setSize(w, h); };
  const draw = (m: T.Material, to: T.WebGLRenderTarget | null) => { quad.material = m; renderer.setRenderTarget(to); renderer.render(postScene, postCam); };
  return {
    render(scene, camera, time, focus) {
      renderer.getDrawingBufferSize(size);
      const k = sceneScale(), w = Math.max(1, Math.round(size.x * k)), h = Math.max(1, Math.round(size.y * k));
      fit(target, w, h);
      const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2));
      fit(half, hw, hh); fit(blurT, hw, hh); fit(glowT, Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)));
      shared.texel.value.set(1 / w, 1 / h);
      // 빛 번짐 · 흐림 반지름은 화면 픽셀로 잰다 — 장면 그림을 줄여도(계단 3) 번지는 크기는 같다
      shared.px.value.set(1 / Math.max(1, size.x), 1 / Math.max(1, size.y));
      if (!opts.still()) mat.uniforms.time.value = time;
      shared.near.value = camera.near;
      shared.far.value = camera.far;
      shared.focus.value = focus?.distance ?? 20;
      const aperture = focus?.strength ?? 0;
      shared.aperture.value = aperture;
      const bloom = level < 2, dof = aperture > 0.001;
      mat.uniforms.split.value = level < 1 ? 1 : 0;
      mat.uniforms.bloom.value = bloom ? 1 : 0;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      // 빛 번짐도 흐림도 없으면(계단 2 이상 · 따라가지 않을 때) 줄이기부터 건너뛴다
      if (bloom || dof) draw(down, half);
      if (bloom) draw(glow, glowT);
      if (dof) draw(blur, blurT);
      draw(mat, null);
      renderer.setRenderTarget(null);
    },
    compile(scene, camera) {
      // ⚠ 그림(렌더 타깃)을 묶고 지어야 한다(2026-11-11) — 묶지 않고 지으면 톤 매핑 · sRGB 가 화면용으로 붙은 프로그램이 나와,
      //   실제로 그림에 그리는 첫 장에서 전부 다시 지었다(아이폰은 수조를 열 때마다 멈칫). compile 은 그 순간 묶인 그림을 읽으므로 짓자마자 푼다
      const jobs: Promise<unknown>[] = [];
      renderer.setRenderTarget(target);
      jobs.push(renderer.compileAsync(scene, camera));
      renderer.setRenderTarget(half);
      for (const m of [down, glow, blur]) { quad.material = m; jobs.push(renderer.compileAsync(quad, postCam, postScene)); }
      renderer.setRenderTarget(null);
      quad.material = mat;
      jobs.push(renderer.compileAsync(postScene, postCam));
      return Promise.all(jobs);
    },
    setLevel(next) { level = Math.max(0, Math.min(3, Math.round(next))); },
    scale: sceneScale,
    bytes() {
      const per = hdr ? 8 : 4;
      return target.width * target.height * (per + 4) + [half, blurT, glowT].reduce((n, t) => n + t.width * t.height * per, 0);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      half.dispose(); blurT.dispose(); glowT.dispose();
      quad.geometry.dispose();
      for (const m of [mat, down, glow, blur]) m.dispose();
    },
  };
}

/** 깨진 법선 안전망(2026-11-10) — 흰 점 · 흰 줄의 원인이라 의심해 넣었지만 실측으로 고친 개수가 0 이었다(진짜 원인은 멀티샘플 깊이 그림 · 지느러미 반사 — makePost · calmSpecular).
 *  길이 0 · NaN 인 법선만 위(0,1,0)로 바꾸고, 바뀐 게 있을 때만 다시 올린다(압축 모델의 양자화된 법선을 매번 고쳐 쓰지 않는다 — 셰이더가 정규화한다). 형상마다 한 번(userData 표시). */
export function repairNormals(root: T.Object3D): number {
  let fixed = 0;
  root.traverse((o) => {
    const g = (o as T.Mesh).geometry as T.BufferGeometry | undefined;
    if (!g || !(o as T.Mesh).isMesh || g.userData.normalsOk) return;
    let n = g.attributes.normal as T.BufferAttribute | undefined;
    if (!n) { g.computeVertexNormals(); n = g.attributes.normal as T.BufferAttribute; }
    let here = 0;
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = Math.hypot(x, y, z);
      if (!Number.isFinite(l) || l < 1e-6) { n.setXYZ(i, 0, 1, 0); here++; }
    }
    if (here) n.needsUpdate = true;
    fixed += here;
    g.userData.normalsOk = true;
  });
  return fixed;
}

/** 물고기 반사 다듬기(2026-11-11) — 환경광을 넣자 매끈한 지느러미(금붕어 · 베타)가 비스듬한 각도에서 한 픽셀씩 수십 배로 튀었다(파이어플라이).
 *  물고기 재질만 거칠기 하한 .32 · 환경광 반사 .6 으로 — 비늘 광택은 남기고 바늘 같은 반짝임만 없앤다. 여러 번 불러도 같다. */
/** 물고기 몸의 부피감(2026-11-11) — 빛이 한쪽에서만 와서 몸이 납작한 그림처럼 보였다.
 *  ① 테두리 빛: 시선에 비스듬한 가장자리일수록 물빛이 번진다(물속에서 몸 윤곽이 빛나는 것) ② 등 쪽은 조금 밝게 · 배 쪽은 조금 어둡게(위에서 오는 물빛).
 *  셰이더 한 줄 덧붙이기 — 재질마다 한 번(같은 종은 재질을 나눠 쓴다). 그림 색은 건드리지 않고 빛만 더한다 */
export function fishShading(root: T.Object3D): void {
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof T.MeshStandardMaterial) || m.userData.fishShaded) continue;
      m.userData.fishShaded = true;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader, r) => {
        prev?.call(m, shader, r);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            vec3 fv = normalize(vViewPosition);
            float rim = pow(1.0 - clamp(abs(dot(normal, fv)), 0.0, 1.0), 2.6);
            totalEmissiveRadiance += vec3(0.42, 0.72, 0.9) * rim * 0.32 * diffuseColor.rgb + vec3(0.25, 0.55, 0.7) * rim * 0.12;
            float up = normal.y * 0.5 + 0.5;
            diffuseColor.rgb *= mix(0.82, 1.08, up);
          }`,
        );
      };
      const key = m.customProgramCacheKey?.bind(m);
      m.customProgramCacheKey = () => (key ? key() : "") + "|fishShade1";
      m.needsUpdate = true;
    }
  });
}

/** 턱(2026-11-11) [사용자: "물고기 모델이 입으로 씹어야한다고 물고기를"] — 모델엔 턱뼈가 없어 셰이더로 연다.
 *  모델은 머리가 +x · 위가 +y(제작 규칙 — glb 의 spine_0 이 +x 끝). 형상 상자에서 머리 끝 22% · 몸 가운데 높이 아래를 아래턱으로 보고,
 *  경첩(머리 끝에서 몸길이 24% 뒤 · 가운데 높이)을 축으로 아래로 돌린다(윗턱은 조금 들린다). 경계는 부드럽게 섞여 찢어지지 않는다.
 *  뼈대 변형(헤엄) 전, 모델 자리에서 돈다. **먹고 있는 그 한 마리만** — 같은 종은 재질을 나눠 쓰므로 그 재질을 복제해 갈아 끼우고 거기에만 턱을 단다
 *  (예전엔 같은 종 사냥꾼이 다 같이 입을 벌렸다). 사냥 장면이 끝나면 restore 가 원래 재질로 되돌리고 복제를 지운다 — 평소엔 턱 셰이더 비용이 0 이다.
 *  복제는 원래 재질의 셰이더 덧붙이기(물빛 · 몸 둘레 빛)를 그대로 이어받는다 */
export type Jaw = { set: (open: number) => void; restore: () => void; count: number };
export function addJaw(root: T.Object3D): Jaw {
  const uniforms: { value: number }[] = [];
  const swaps: { mesh: T.Mesh; orig: T.Material | T.Material[]; clones: T.Material[] }[] = [];
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    if (!bb) return;
    const L = Math.max(1e-6, bb.max.x - bb.min.x);
    // 경첩 높이는 머리 부분(앞 30%)의 위아래로 잰다 — 몸 전체 상자는 꼬리 · 등지느러미까지 들어가 너무 낮게 잡혔다(턱이 거의 안 벌어졌다)
    const pos = g.getAttribute("position") as T.BufferAttribute | undefined;
    let hy0 = Infinity, hy1 = -Infinity;
    if (pos) for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); if (x > bb.max.x - L * 0.3) { const y = pos.getY(i); if (y < hy0) hy0 = y; if (y > hy1) hy1 = y; } }
    if (!(hy1 > hy0)) { hy0 = bb.min.y; hy1 = bb.max.y; }
    const orig = mesh.material, clones: T.Material[] = [];
    const next = (Array.isArray(orig) ? orig : [orig]).map((src) => {
      if (!(src instanceof T.MeshStandardMaterial)) return src;
      const m = src.clone();
      m.onBeforeCompile = src.onBeforeCompile;
      m.customProgramCacheKey = src.customProgramCacheKey;
      clones.push(m);
      {
        const u = { value: 0 };
        const hinge = new T.Vector4(bb.max.x - L * 0.24, hy0 + (hy1 - hy0) * 0.44, bb.max.x, L);
        // 벌린 틈으로 보이는 안쪽 면 = 입속 — 뒷면도 그린다(닫혀 있을 땐 몸 껍질에 가려 안 보인다)
        m.side = T.DoubleSide;
        const prev = m.onBeforeCompile;
        m.onBeforeCompile = (shader, r) => {
          prev?.call(m, shader, r);
          shader.uniforms.jawOpen = u!;
          shader.uniforms.jawHinge = { value: hinge };
          shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float jawOpen;varying float vJaw;varying float vLow;varying float vJawX;")
            .replace("#include <dithering_fragment>", `#include <dithering_fragment>
            if (jawOpen > 0.001 && vJaw > 0.3) {
              float band = 1.0 - abs(vLow * 2.0 - 1.0);
              float open = smoothstep(0.0, 0.12, jawOpen);
              float maw = smoothstep(0.32, 0.62, band) * open;
              // 이빨 — 입 가장자리에 톱니(뾰족한 삼각형이 줄지어)
              float saw = 0.1 + 0.26 * (1.0 - abs(fract(vJawX) * 2.0 - 1.0));
              float teeth = smoothstep(0.04, 0.08, band) * (1.0 - smoothstep(saw - 0.03, saw, band)) * smoothstep(0.15, 0.35, jawOpen);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(0.17, 0.01, 0.03), vec3(0.03, 0.0, 0.005), smoothstep(0.35, 0.8, band)), maw);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95, 0.93, 0.86), teeth * 0.9);
              if (!gl_FrontFacing) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.3, 0.02, 0.05), 0.92);
            }`);
          shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float jawOpen;uniform vec4 jawHinge;varying float vJaw;varying float vLow;varying float vJawX;")
            .replace("#include <begin_vertex>", `#include <begin_vertex>
            vJaw = 0.0; vLow = 0.0; vJawX = 0.0;
            if (jawOpen > 0.001) {
              float L = jawHinge.w, hx = jawHinge.x, hy = jawHinge.y;
              float front = smoothstep(hx - L * 0.04, hx + L * 0.06, transformed.x);
              vJaw = front;
              float low = smoothstep(hy + L * 0.004, hy - L * 0.004, transformed.y);
              vLow = low; vJawX = (transformed.x - hx) / L * 46.0;
              float a = -jawOpen * 0.78 * front * low + jawOpen * 0.22 * front * (1.0 - low);
              vec2 p = transformed.xy - vec2(hx, hy);
              float c = cos(a), s = sin(a);
              transformed.xy = vec2(hx, hy) + vec2(p.x * c - p.y * s, p.x * s + p.y * c);
            }`);
        };
        const key = m.customProgramCacheKey?.bind(m);
        m.customProgramCacheKey = () => (key ? key() : "") + "|jaw1";
        m.needsUpdate = true;
        uniforms.push(u);
      }
      return m;
    });
    if (clones.length) { mesh.material = Array.isArray(orig) ? next : next[0]; swaps.push({ mesh, orig, clones }); }
  });
  return {
    set: (open) => { for (const u of uniforms) u.value = open; },
    restore: () => { for (const s of swaps.splice(0)) { s.mesh.material = s.orig; for (const c of s.clones) c.dispose(); } uniforms.length = 0; },
    count: uniforms.length,
  };
}

export function calmSpecular(root: T.Object3D): void {
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof T.MeshStandardMaterial)) continue;
      m.roughness = Math.max(m.roughness, 0.32);
      m.envMapIntensity = Math.min(m.envMapIntensity, 0.6);
    }
  });
}
