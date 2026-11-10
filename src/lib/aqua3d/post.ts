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
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4, depthBuffer: true });
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
        float coc(vec2 p){return clamp(abs(viewZ(p)-focus)/max(focus,1.)*aperture,0.,1.);}
        float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        void main(){
          vec2 uv=vUv;
          // 물속 일렁임 — 화면이 아주 조금 굴절해 흔들린다(가장자리일수록 조금 더)
          vec2 d=uv-.5;float r2=dot(d,d);
          uv+=vec2(sin(uv.y*24.+time*1.25),cos(uv.x*19.+time*1.05))*(.0007+r2*.002);
          // 가장자리 색 갈라짐 — 물과 유리를 지나온 빛
          vec2 ca=d*r2*.014;
          vec3 c=vec3(texture2D(tColor,uv+ca).r,texture2D(tColor,uv).g,texture2D(tColor,uv-ca).b);
          // 피사계 심도 — 원판 위 12점, 흐림 반지름은 그 점의 초점 거리 차이(앞의 선명한 물고기가 뒤로 번지지 않게 표본마다 다시 잰다)
          float r0=coc(uv);
          if(aperture>.001){
            vec3 acc=c;float wsum=1.;
            for(int i=0;i<12;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/12.);vec2 o=vec2(cos(a),sin(a))*rr*texel*14.;
              vec2 q=uv+o*max(r0,.0);float rq=coc(q);float w=smoothstep(0.,1.,rq*1.2);
              acc+=texture2D(tColor,q).rgb*w;wsum+=w;}
            c=mix(c,acc/wsum,smoothstep(.05,.45,r0));
          }
          // 빛 번짐 — 밝은 곳만 둘레 8곳에서 모아 은은하게
          vec3 glow=vec3(0.);
          for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*texel*9.;
            vec3 s=texture2D(tColor,uv+o).rgb+texture2D(tColor,uv+o*2.2).rgb;glow+=max(s-1.6,0.);}
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
