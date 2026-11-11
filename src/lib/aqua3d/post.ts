import * as T from "three";

/** 3D 엔진 다듬기(2026-11-10) [사용자: "3d 엔진을 우리는 더 디벨럽해야해 아직 10점 만점중 3점"]
 *
 *  ① 물속 환경광(underwaterEnvironment) — 예전엔 해 하나 · 하늘빛 하나 · 보조등 하나뿐이라 물고기 비늘 · 바위 · 금속 · 유리에 비치는 것이 없어 장난감처럼 납작했다.
 *     위는 밝은 물빛 · 아래는 어두운 심해 · 수면엔 빛 창이 난 구를 한 번 구워(PMREM) scene.environment 로 쓴다. 구울 때 한 번뿐이라 매 프레임 비용은 없다.
 *  ② 물속 후처리(makePost) — 장면을 선형 HDR 그림(멀티샘플)에 그린 뒤 화면에 한 번 옮기면서:
 *     물속 일렁임(아주 작은 굴절) · 가장자리 색 갈라짐 · 밝은 곳의 빛 번짐(8탭) · 위가 밝은 물빛 그라데이션 · 비네트 · 톤 매핑 · sRGB · 디더링.
 *     장면의 셰이더들은 그림(렌더 타깃)에 그릴 땐 톤 매핑 · 색 공간을 건너뛰므로(three 규칙) 여기서 한 번만 한다 — 두 번 하면 색이 바랜다.
 *  움직임 줄이기면 일렁임을 멈춘다(빛 번짐 · 비네트는 그대로). */

export function underwaterEnvironment(renderer: T.WebGLRenderer, top = 0x9fe3ef, deep = 0x0a2a3a): T.Texture {
  const env = new T.Scene();
  const sky = new T.Mesh(
    new T.SphereGeometry(10, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: { top: { value: new T.Color(top) }, deep: { value: new T.Color(deep) } },
      vertexShader: "varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      // 위로 갈수록 밝은 물빛, 꼭대기엔 수면의 빛 창(스넬의 창), 옆엔 은은한 띠
      fragmentShader: "varying vec3 vP;uniform vec3 top;uniform vec3 deep;void main(){float h=vP.y*.5+.5;vec3 c=mix(deep,top,pow(h,1.4));c+=vec3(1.,.97,.9)*smoothstep(.86,.98,vP.y)*3.;c+=top*.25*pow(1.-abs(vP.y),6.);gl_FragColor=vec4(c,1.);}",
    }),
  );
  env.add(sky);
  const pmrem = new T.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  sky.geometry.dispose();
  (sky.material as T.Material).dispose();
  return rt.texture;
}

/** 초점 — 카메라에서 초점까지 거리(월드 단위) · 흐림 세기(0 = 없음, 1 = 따라가기 확대) */
export type Focus = { distance: number; strength: number };
export type Post = { render: (scene: T.Scene, camera: T.PerspectiveCamera, time: number, focus?: Focus) => void; dispose: () => void };

export function makePost(renderer: T.WebGLRenderer, opts: { still: () => boolean }): Post {
  const size = new T.Vector2();
  // ③ 피사계 심도(2026-11-10) — 깊이 그림을 같이 받아 초점에서 먼 곳일수록 원판 12탭으로 흐린다. 물고기를 따라가면 그 물고기에 초점
  // ⚠ 멀티샘플(samples)을 쓰지 않는다(2026-11-11) — 멀티샘플 그림의 깊이 그림이 줄 단위로 깨져 와서 피사계 심도가 물고기를 흰 가로줄로 부쉈다
  //   (가까운 비단잉어가 통째로 줄무늬가 됐다 · samples 0 이면 멀쩡). 계단은 아래 FXAA 가 다듬는다
  // 반정밀 그림을 못 그리는 기기(확장 없음)는 보통 그림으로 — 빛 번짐이 약해질 뿐 수조가 검게 나오지 않는다
  const hdr = renderer.extensions.has("EXT_color_buffer_half_float") || renderer.extensions.has("EXT_color_buffer_float");
  const target = new T.WebGLRenderTarget(1, 1, { type: hdr ? T.HalfFloatType : T.UnsignedByteType, samples: 0, depthBuffer: true });
  target.depthTexture = new T.DepthTexture(1, 1);
  const quad = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    new T.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: target.texture }, tDepth: { value: target.depthTexture }, time: { value: 0 }, texel: { value: new T.Vector2(1, 1) },
        near: { value: 0.1 }, far: { value: 100 }, focus: { value: 20 }, aperture: { value: 0 } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: `varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform float time;uniform vec2 texel;uniform float near;uniform float far;uniform float focus;uniform float aperture;
        float viewZ(vec2 p){float d=texture2D(tDepth,p).x;return (near*far)/(far-(far-near)*d);}
        float coc(vec2 p){float f=max(focus,1.);return clamp(max(abs(viewZ(p)-focus)-f*.35,0.)/f*aperture,0.,1.);}
        // 깨진 값(NaN · 무한) 거르기 — 법선이 0 인 면이 환경광을 읽으면 NaN 이 나와 검은 점이 되고, 빛 번짐 · 흐림이 그걸 번지게 했다
        bool bad(vec3 v){return any(isnan(v))||any(isinf(v));}
        vec3 tap(vec2 p){vec3 v=texture2D(tColor,p).rgb;return bad(v)?vec3(-1.):min(v,vec3(32.));}
        // 그물 — 얇은 지느러미가 환경광을 비스듬히 받으면 한 픽셀이 수십 배로 튀었다(파이어플라이, 2026-11-11 — 법선은 멀쩡했다). 피사계 심도 · 빛 번짐이 그 점을 원판 모양 흰 점 무리로 퍼뜨렸다 → 읽는 값을 2 로 누른다(뉴트럴 톤 매핑 뒤엔 거의 같은 흰색), 깨진 점은 0
        vec3 fix(vec2 p){vec3 v=tap(p);return v.r>=0.?min(v,vec3(2.)):vec3(0.);}
        // FXAA(가볍게) — 멀티샘플 대신 가장자리만 그 방향으로 두 점 더 읽어 섞는다
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
        float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        void main(){
          vec2 uv=vUv;
          // 물속 일렁임 — 화면이 아주 조금 굴절해 흔들린다(가장자리일수록 조금 더)
          vec2 d=uv-.5;float r2=dot(d,d);
          uv+=vec2(sin(uv.y*24.+time*1.25),cos(uv.x*19.+time*1.05))*(.0007+r2*.002);
          // 가장자리 색 갈라짐 — 물과 유리를 지나온 빛
          vec2 ca=d*r2*.014;
          vec3 c=fxaa(uv);c.r=mix(c.r,fix(uv+ca).r,smoothstep(.04,.2,r2));c.b=mix(c.b,fix(uv-ca).b,smoothstep(.04,.2,r2));
          // 피사계 심도(2026-11-11 약하게 — "포커스되면 주위 블러가 너무 심해") — 초점 앞뒤 35% 는 선명한 띠, 반지름 8 텍셀 · 최대 75% 만 섞는다. 원판 위 12점, 흐림 반지름은 그 점의 초점 거리 차이(앞의 선명한 물고기가 뒤로 번지지 않게 표본마다 다시 잰다)
          float r0=coc(uv);
          if(aperture>.001){
            vec3 acc=c;float wsum=1.;
            for(int i=0;i<12;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/12.);vec2 o=vec2(cos(a),sin(a))*rr*texel*8.;
              vec2 q=uv+o*max(r0,.0);float rq=coc(q);float w=smoothstep(0.,1.,rq*1.2);
              acc+=fix(q)*w;wsum+=w;}
            c=mix(c,acc/wsum,.75*smoothstep(.1,.7,r0));
          }
          // 빛 번짐 — 밝은 곳만 둘레 8곳에서 모아 은은하게
          vec3 glow=vec3(0.);
          for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*texel*9.;
            vec3 s=fix(uv+o)+fix(uv+o*2.2);glow+=max(s-1.6,0.);}
          c+=glow*.05;
          // 물빛 — 위쪽은 수면 빛을 받아 조금 밝고, 아래는 짙다
          c*=mix(.84,1.1,smoothstep(.0,1.,uv.y));
          // 비네트
          c*=1.-smoothstep(.12,.55,r2)*.42;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          // 디더링 — 짙은 물빛 그라데이션의 띠를 없앤다
          gl_FragColor.rgb+=(hash(gl_FragCoord.xy+time)-.5)/255.;
        }`,
    }),
  );
  quad.frustumCulled = false;
  const postScene = new T.Scene();
  postScene.add(quad);
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = quad.material as T.ShaderMaterial;
  return {
    render(scene, camera, time, focus) {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) {
        target.setSize(size.x, size.y);
        mat.uniforms.texel.value.set(1 / Math.max(1, size.x), 1 / Math.max(1, size.y));
      }
      if (!opts.still()) mat.uniforms.time.value = time;
      mat.uniforms.near.value = camera.near;
      mat.uniforms.far.value = camera.far;
      mat.uniforms.focus.value = focus?.distance ?? 20;
      mat.uniforms.aperture.value = focus?.strength ?? 0;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      quad.geometry.dispose();
      mat.dispose();
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
