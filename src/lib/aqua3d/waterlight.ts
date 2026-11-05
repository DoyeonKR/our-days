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
};

/** 모래와 같은 식 — world xz 로 투영한 일렁이는 빛. 0~1 */
export const CAUSTIC_GLSL = `float aquaCaustic(vec2 xz,float t){vec2 q=xz*2.1;float a=sin(q.x+sin(q.y*1.7+t*.22)*1.3);float b=sin(q.y*1.3+cos(q.x*1.2-t*.18)*1.1);return pow(max(0.,1.-abs(a*b)),20.);}`;

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
      .replace("#include <common>", `#include <common>\nvarying vec3 vAquaWorld;\nvarying float vAquaUp;\nuniform float aquaTime;\nuniform vec3 aquaRimColor;\n${CAUSTIC_GLSL}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        // 위를 보는 면만 빛을 받는다 — 옆면 · 밑면까지 일렁이면 빛이 어디서 오는지 흐려진다
        float aquaC=aquaCaustic(vAquaWorld.xz,aquaTime)*smoothstep(.15,.85,vAquaUp);
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
