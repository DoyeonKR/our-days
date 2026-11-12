import * as T from "three";
import { WORLD } from "./world.ts";
import { asset } from "../base.ts";
import type { Obstacle } from "./habits.ts";

/** 심연 돔 궁전(2026-11-11, 11단계 — 가장 높은 단계) [사용자: "저거보다 더 윗등급의 수조"]
 *  터널(앞에서 안으로 걷는다)과 구조가 다르다 — 수족관 한가운데 바닥에 유리 돔이 앉아 있고, 카메라가 그 안에서 360도 둘러본다.
 *  돔 둘레로 금속 띠 · 아래엔 둥근 관람 바닥 · 빛 고리. 둘러볼 때 앞쪽(앞유리 너머)이 비지 않게 앞에도 바다 벽을 세운다.
 *  물고기는 돔 둘레를 장애물로 비켜 간다(domeObstacles). 같은 시각 = 같은 모습. */
export const DOME_R = 2.7;

export function domeObstacles(tall: number): Obstacle[] {
  return [{ x: 0, z: 0, r: DOME_R * 1.02, h: (DOME_R + 0.3) / tall }];
}

export type Dome = { root: T.Group; animate: (t: number) => void; dispose: () => void; /** 돔 안에서 볼 때만 앞 바다 벽을 세운다(밖에서 보면 수조를 가린다) */ setInside: (on: boolean) => void };

/** scenery — 수조(habitat)가 이미 받은 같은 배경 그림을 빌려 쓴다(2026-11-11 — 11단계에서 tank_9 를 두 번 받아 GPU 에도 두 장 올렸다).
 *  빌린 그림은 수조가 지운다 — 여기선 지우지 않는다. 없을 때만 art 로 직접 받는다 */
export function makeDome(opts: { front: number; wide: number; top: number; water: number; high: number; art?: number; scenery?: () => T.Texture | null }): Dome {
  const root = new T.Group();
  root.name = "dome-palace";
  const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [];
  const time = { value: 0 };
  const floor = WORLD.floor, R = DOME_R;
  const add = (g: T.BufferGeometry, m: T.Material, setup?: (o: T.Mesh) => void) => {
    geometries.push(g);
    const o = new T.Mesh(g, m);
    o.raycast = () => {};
    setup?.(o);
    root.add(o);
    return o;
  };

  // 유리 돔 — 반구, 가장자리일수록 짙게 비치고 천천히 흐르는 물빛 결
  const glass = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, forceSinglePass: true,
    uniforms: { aquaTime: time },
    vertexShader: "varying vec3 vN;varying vec3 vW;void main(){vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: `varying vec3 vN;varying vec3 vW;uniform float aquaTime;
      void main(){vec3 v=normalize(cameraPosition-vW);float f=pow(1.-abs(dot(normalize(vN),v)),3.);
        float band=pow(max(0.,sin(atan(vW.z,vW.x)*6.+vW.y*1.3-aquaTime*.2)),30.);
        vec3 c=mix(vec3(.55,.85,.95),vec3(1.),f);
        gl_FragColor=vec4(c,.025+f*.3+band*.05);
        #include <colorspace_fragment>
      }`,
  });
  materials.push(glass);
  add(new T.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, (o) => { o.position.y = floor; o.renderOrder = 2; });

  // 금속 띠 — 바닥 고리 하나 · 자오선 여섯
  // 뼈대는 가늘고 밝은 금빛 — 굵고 어두우면 돔 안에서 시야를 막는다
  const metal = new T.MeshStandardMaterial({ color: 0xc9b37a, metalness: 0.9, roughness: 0.28, emissive: 0x3a2a08, emissiveIntensity: 0.5 });
  materials.push(metal);
  add(new T.TorusGeometry(R + 0.04, 0.07, 8, 64), metal, (o) => { o.rotation.x = Math.PI / 2; o.position.y = floor + 0.05; });
  // 자오선은 더 가늘고 스스로 빛나는 금빛으로(2026-11-12) — 돔 한가운데서 보면 자오선이 늘 곧은 세로줄이라, 0.022 굵기 · 어두운 금속은 뒤에서 빛을 받아
  //   화면 한가운데를 가르는 굵고 검은 기둥으로 보였다(세로 화면은 시야가 좁아 여섯 줄 중 하나가 자주 가운데에 온다)
  const ribMetal = new T.MeshStandardMaterial({ color: 0xe6cf8f, metalness: 0.6, roughness: 0.3, emissive: 0x9a7a2c, emissiveIntensity: 0.6 });
  materials.push(ribMetal);
  const rib = new T.TorusGeometry(R + 0.03, 0.008, 5, 40, Math.PI / 2);
  geometries.push(rib);
  for (let i = 0; i < 6; i++) {
    const o = new T.Mesh(rib, ribMetal);
    o.raycast = () => {};
    o.position.y = floor;
    // 바닥에서 꼭대기까지 4분의 1 호(xy 평면) — 묶음째 y 축 둘레로 돌려 여섯 줄
    const holder = new T.Group();
    holder.rotation.y = (i / 6) * Math.PI * 2;
    holder.add(o);
    root.add(holder);
  }

  // 둥근 관람 바닥 + 빛 고리
  const stone = new T.MeshStandardMaterial({ color: 0x2c2f48, roughness: 0.35, metalness: 0.4, emissive: 0x120d30, emissiveIntensity: 0.6 });
  const glow = new T.MeshBasicMaterial({ color: 0xffd77a });
  materials.push(stone, glow);
  add(new T.CylinderGeometry(R - 0.05, R + 0.1, 0.36, 48), stone, (o) => { o.position.y = floor + 0.16; });
  add(new T.TorusGeometry(R * 0.8, 0.03, 6, 64), glow, (o) => { o.rotation.x = Math.PI / 2; o.position.y = floor + 0.36; });
  add(new T.TorusGeometry(R * 0.45, 0.025, 6, 48), glow, (o) => { o.rotation.x = Math.PI / 2; o.position.y = floor + 0.36; });

  // 앞 바다 벽 — 앞유리 바로 앞에 안쪽을 보는 물빛 판(돔 안에서 뒤돌아봐도 바깥 방이 아니라 바다가 보이게)
  // 뒷벽과 같은 바다 그림(좌우를 뒤집어 이어지게) — 받기 전엔 물빛만. ⚠ 셰이더 원문은 ASCII 만(engine.test)
  const sea = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: { low: { value: new T.Color(opts.water).multiplyScalar(0.5) }, high: { value: new T.Color(opts.high) }, aquaTime: time, scenery: { value: null as T.Texture | null }, ready: { value: 0 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv;uniform vec3 low;uniform vec3 high;uniform float aquaTime;uniform sampler2D scenery;uniform float ready;
      void main(){float h=smoothstep(0.,1.,vUv.y);vec3 c=mix(low,high,h*.7);
        if(ready>.5){vec3 sc=texture2D(scenery,vec2(.1+(1.-vUv.x)*.8,.22+vUv.y*.78)).rgb*.62;c=mix(c,sc,.85);}
        float shafts=pow(max(0.,sin(vUv.x*14.+vUv.y*1.5+sin(aquaTime*.1)*.2)),12.);c+=vec3(.02,.04,.05)*shafts*h;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.push(sea);
  const span = opts.top - floor;
  let photo: T.Texture | null = null, gone = false;
  if (typeof document !== "undefined" && opts.art && !opts.scenery) photo = new T.TextureLoader().load(asset(`/aqua/tank/tank_${opts.art}.webp`), (tx) => {
    if (gone) { tx.dispose(); return; }
    tx.colorSpace = T.SRGBColorSpace; sea.uniforms.scenery.value = tx; sea.uniforms.ready.value = 1;
  }, undefined, () => { photo?.dispose(); photo = null; });
  const seaWall = add(new T.PlaneGeometry(10.2 * opts.wide, span + 0.6), sea, (o) => { o.position.set(0, floor + span / 2, opts.front + 0.08); o.rotation.y = Math.PI; o.visible = false; });

  return {
    root,
    animate(t) {
      time.value = t;
      if (!sea.uniforms.ready.value && opts.scenery) { const tx = opts.scenery(); if (tx) { sea.uniforms.scenery.value = tx; sea.uniforms.ready.value = 1; } }
    },
    setInside(on) { seaWall.visible = on; },
    dispose() { gone = true; photo?.dispose(); geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); root.removeFromParent(); },
  };
}
