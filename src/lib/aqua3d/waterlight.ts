/* 물속 빛 (2026-11-05) — 모래 · 장식 · 물고기가 같은 일렁이는 빛(caustics)을 받고, 물고기 가장자리는 물빛으로 테가 진다.
 * 예전엔 모래에만 일렁임이 있어서 바위 · 물고기가 물 밖에서 찍은 사진을 붙인 것처럼 떠 보였다.
 * 그림자 지도 · 후처리 없이 재질 셰이더에 몇 줄만 더한다(폰 프레임). 시간 · 색은 모듈 하나의 값을 모든 재질이 같이 본다. */
import * as T from "three";

/** 한 번에 하나의 수조만 돈다 — 값 하나를 모든 재질이 참조한다(재질마다 시간을 올리지 않는다) */
export const WATER_LIGHT = {
  aquaTime: { value: 0 },
  /** 물고기 가장자리 테의 색(선형) — 수조 단계의 물빛을 따른다 */
  aquaRimColor: { value: new T.Color(0x3b8580) },
  /** 점 입자 크기 환산 — 그리는 버퍼 높이의 절반(three PointsMaterial 과 같은 정의) */
  aquaPointScale: { value: 400 },
  /** 물 맑기(0~1, 2026-11-12) — 물이 더러우면 장식 · 물고기에 비치는 일렁임이 흐려진다(수조 scene 이 물 값으로 정한다).
   *  모래는 habitat 이 자기 시계로 같은 식(CAUSTIC_GLSL)을 그려 여기 안 묶인다 — CAUSTIC_GLSL 안에 uniform 을 넣으면 모래 셰이더엔 묶이지 않은 0 이 들어가 일렁임이 꺼진다.
   *  모든 재질이 같은 값을 본다 — 미리보기(decor-preview)도 쓰므로 기본은 1, 수조를 닫으면 1 로 되돌린다 */
  aquaClarity: { value: 1 },
};

/** 모래와 같은 식 — world xz 로 투영한 일렁이는 빛. 0~1
 *  2026-11-12 [사용자: 일렁임이 멈춘 그림 같다] — 예전엔 한 겹이 28초에 한 번 꿈틀대서 멈춘 무늬로 보였다.
 *  크기 · 방향 · 빠르기가 다른 두 겹(두 번째는 37° 돌리고 1.6배 촘촘하게)을 서로 반대쪽으로 흘리고 작은 쪽(min)만 남긴다 —
 *  두 그물이 겹치는 곳만 밝아서 빛 줄이 끊기고 이어지며 4~6초 박자로 살아 움직인다(물밑 사진의 일렁임이 이렇다).
 *  한 겹은 지수를 낮춰(20 → 5 를 min 뒤에) 굵게 둔다 — 평균 밝기가 옛 식과 같다(약 0.1, aquafx.test 가 잰다): 모래 · 장식 노출이 안 바뀐다.
 *  셰이더 원문은 ASCII 만(설명은 여기 TS 주석에). sin 4 · cos 2 · pow 1 — 픽셀당 몇 줄 */
export const CAUSTIC_GLSL = `float aquaCausticLayer(vec2 q,float t){float a=sin(q.x+sin(q.y*1.7+t)*1.3);float b=sin(q.y*1.3+cos(q.x*1.2-t*.83)*1.1);return max(0.,1.-abs(a*b));}
float aquaCaustic(vec2 xz,float t){float c1=aquaCausticLayer(xz*2.1+vec2(.31,.17)*t,t*1.1);float c2=aquaCausticLayer(mat2(.8,.6,-.6,.8)*xz*3.4+vec2(-.23,.37)*t,t*1.5+2.);return pow(min(c1,c2),5.);}`;
/** CPU 에서 같은 식(시험 · 밝기 재기용) — CAUSTIC_GLSL 과 한 글자씩 맞춘다 */
export function causticAt(x: number, z: number, t: number): number {
  const layer = (qx: number, qy: number, tt: number) => Math.max(0, 1 - Math.abs(Math.sin(qx + Math.sin(qy * 1.7 + tt) * 1.3) * Math.sin(qy * 1.3 + Math.cos(qx * 1.2 - tt * 0.83) * 1.1)));
  const c1 = layer(x * 2.1 + 0.31 * t, z * 2.1 + 0.17 * t, t * 1.1);
  // GLSL mat2 는 열 우선 — mat2(.8,.6,-.6,.8)*v = (.8x - .6z, .6x + .8z)
  const c2 = layer((0.8 * x - 0.6 * z) * 3.4 - 0.23 * t, (0.6 * x + 0.8 * z) * 3.4 + 0.37 * t, t * 1.5 + 2);
  return Math.min(c1, c2) ** 5;
}

const KEY = "aqua-water-light-v1";

/** 표준 재질 하나에 물속 빛을 단다. 이미 달린 재질(나눠 쓰는 GLB · 키트 재질)은 건너뛴다.
 *  rim: 물고기만 — 장식에까지 테를 두르면 돌이 유리처럼 보인다. */
export function waterLit(material: T.Material, rim: boolean): void {
  if (!(material instanceof T.MeshStandardMaterial) || material.userData.aquaLit) return;
  material.userData.aquaLit = rim ? "rim" : "caustic";
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.aquaTime = WATER_LIGHT.aquaTime;
    shader.uniforms.aquaRimColor = WATER_LIGHT.aquaRimColor;
    shader.uniforms.aquaClarity = WATER_LIGHT.aquaClarity;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAquaWorld;\nvarying float vAquaUp;")
      .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\nvAquaUp=(vec4(transformedNormal,0.)*viewMatrix).y;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 aquaW=vec4(transformed,1.);
        #ifdef USE_BATCHING
        aquaW=batchingMatrix*aquaW;
        #endif
        #ifdef USE_INSTANCING
        aquaW=instanceMatrix*aquaW;
        #endif
        vAquaWorld=(modelMatrix*aquaW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vAquaWorld;\nvarying float vAquaUp;\nuniform float aquaTime;\nuniform vec3 aquaRimColor;\nuniform float aquaClarity;\n${CAUSTIC_GLSL}`)
      // 위를 보는 면만 빛을 받는다 — 옆면 · 밑면까지 일렁이면 빛이 어디서 오는지 흐려진다.
      //   (이 설명은 셰이더 원문 밖에 둔다 — 2026-11-12 전엔 GLSL 주석으로 들어가 있었다. GLSL ES 는 주석 속 한글도 컴파일 오류로 보는 기기가 있다)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float aquaC=aquaCaustic(vAquaWorld.xz,aquaTime)*smoothstep(.15,.85,vAquaUp)*aquaClarity;
        totalEmissiveRadiance+=diffuseColor.rgb*vec3(.55,.72,.62)*aquaC;
        ${rim ? `float aquaRim=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);
        totalEmissiveRadiance+=aquaRimColor*aquaRim*.7;` : ""}`);
  };
  material.customProgramCacheKey = () => `${previousKey}|${KEY}|${rim ? 1 : 0}`;
  material.needsUpdate = true;
}

/** 한 모델 안의 모든 표준 재질 */
export function waterLitTree(root: T.Object3D, rim: boolean): void {
  root.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) waterLit(m, rim);
  });
}
