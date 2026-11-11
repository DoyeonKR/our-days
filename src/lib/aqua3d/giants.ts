import * as T from "three";
import { WORLD } from "./world.ts";

/** 대수족관의 먼 바다(2026-11-10) [사용자: "더 웅장하게 다듬어"] — 내 물고기가 아니라 분위기다(누를 수 없고 저장도 없다).
 *  ① 고래 그림자 — 수조 맨 뒤 깊은 물속을 큰 고래가 천천히 가로지른다(안개에 반쯤 묻혀 실루엣으로). 한 번 지나가고 한참 쉰다.
 *  ② 빛줄기 — 수면에서 비스듬히 내려오는 빛 기둥 몇 개가 천천히 흔들린다(더하기 섞기 · 깊이 쓰기 없음).
 *  모양은 우리가 짠 도형이다(실제 동물 모델 아님). 같은 시각 = 같은 모습(순수). */
export type Giants = { root: T.Group; animate: (t: number) => void; dispose: () => void };

/** 고래 몸 — 회전체(방추형) + 꼬리지느러미 둘 + 가슴지느러미 둘. 길이 1, 머리가 +x */
function whaleGeometry(): T.BufferGeometry[] {
  const prof: T.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, r = Math.sin(Math.PI * Math.pow(u, 0.8)) * (0.12 + 0.03 * (1 - u)) * (u < 0.15 ? 0.9 + u : 1);
    prof.push(new T.Vector2(Math.max(0.002, r), u - 0.5));
  }
  const body = new T.LatheGeometry(prof, 20);
  body.rotateZ(-Math.PI / 2); // 축을 x 로 — u=1(머리)이 +x
  body.scale(1, 0.85, 1);
  const fluke = new T.BufferGeometry();
  fluke.setAttribute("position", new T.Float32BufferAttribute([
    -0.5, 0, 0, -0.66, 0.01, 0.17, -0.6, 0, 0.02,
    -0.5, 0, 0, -0.6, 0, -0.02, -0.66, 0.01, -0.17,
  ], 3));
  fluke.computeVertexNormals();
  // 꼬리지느러미는 꼬리 끝(x = −0.5)을 축으로 위아래로 친다 — 축이 원점에 오게 옮겨 두고 메시를 그 자리에 놓는다(makeGiants)
  fluke.translate(0.5, 0, 0);
  const fin = new T.BufferGeometry();
  fin.setAttribute("position", new T.Float32BufferAttribute([
    0.18, -0.06, 0.08, 0.02, -0.1, 0.26, 0.06, -0.07, 0.08,
    0.18, -0.06, -0.08, 0.06, -0.07, -0.08, 0.02, -0.1, -0.26,
  ], 3));
  fin.computeVertexNormals();
  return [body, fluke, fin];
}

export function makeGiants(bounds: { halfX: number; backZ: number; top: number; whale?: boolean }): Giants {
  const root = new T.Group();
  root.name = "ambient-giants";
  root.userData.moving = true; // 묶어 그리기(scene 의 batches)가 빛줄기를 묶어도 매 프레임 자리를 따라가게
  const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [];

  // ① 고래 — 짙은 남색, 안개를 받아 먼 실루엣이 된다
  const skin = new T.MeshStandardMaterial({ color: 0x1b2f45, roughness: 0.8, metalness: 0.05, side: T.DoubleSide, transparent: true, opacity: 0 });
  materials.push(skin);
  const whale = new T.Group();
  const parts = whaleGeometry().map((g) => {
    geometries.push(g);
    const m = new T.Mesh(g, skin);
    m.raycast = () => {};
    whale.add(m);
    return m;
  });
  // 꼬리지느러미 — 예전엔 몸과 한 덩어리로 굳어 고래가 미끄러지기만 했다(2026-11-11). 꼬리 끝 축에서 천천히 위아래로 친다
  const fluke = parts[1];
  fluke.position.x = -0.5;
  // 수조 안에서만 — 옆벽 밖으로 삐져나오면 밖에서 볼 때 수조 바깥에 고래가 떠 보인다. 양끝에선 물빛 속으로 사라진다(투명도)
  const L = Math.min(9, bounds.halfX * 0.95);
  whale.scale.setScalar(L);
  if (bounds.whale !== false) root.add(whale);

  // ② 빛줄기 — 위가 밝고 아래로 사라지는 길쭉한 판 몇 장
  const beam = new T.PlaneGeometry(1, 1, 1, 8);
  beam.translate(0, -0.5, 0);
  geometries.push(beam);
  const light = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { aquaTime: { value: 0 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 vUv;uniform float aquaTime;void main(){float edge=sin(vUv.x*3.14159);float fade=pow(vUv.y,1.6);float flick=.75+.25*sin(aquaTime*.7+vUv.x*5.);gl_FragColor=vec4(vec3(.55,.85,.95)*edge*fade*flick*.3,1.);}",
  });
  materials.push(light);
  const beams: T.Mesh[] = [];
  const span = bounds.top - WORLD.floor;
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(beam, light);
    m.raycast = () => {};
    // 기울어진 빛줄기의 아래 끝이 옆벽 밖으로 나가지 않게 — 위 끝을 오른쪽으로 치우치고 기울기는 작게(아래 끝이 높이 × 0.12 만큼 왼쪽으로 간다)
    m.position.set((-0.35 + ((i + 0.5) / 6) * 1.2) * bounds.halfX, bounds.top, bounds.backZ * (0.15 + (i % 3) * 0.25));
    m.scale.set(1.2 + (i % 2) * 0.9, span * 1.05, 1);
    m.rotation.z = -0.12 + (i % 3) * 0.03;
    m.renderOrder = 3;
    root.add(m);
    beams.push(m);
  }

  const CYCLE = 75, PASS = 48;
  function animate(t: number) {
    light.uniforms.aquaTime.value = t;
    for (let i = 0; i < beams.length; i++) beams[i].rotation.z = -0.12 + (i % 3) * 0.03 + Math.sin(t * 0.13 + i * 1.7) * 0.03;
    // 75초마다 한 번, 48초에 걸쳐 왼쪽에서 오른쪽으로(다음 번엔 거꾸로) 지나간다
    const k = Math.floor(t / CYCLE), p = (t - k * CYCLE) / PASS, dir = k % 2 ? -1 : 1;
    whale.visible = p < 1 && bounds.whale !== false;
    if (!whale.visible) return;
    const reach = Math.max(0, bounds.halfX - L * 0.68); // 꼬리지느러미까지 몸길이의 0.66
    const x = dir * (-reach + p * reach * 2);
    skin.opacity = Math.min(1, Math.sin(p * Math.PI) * 2.2) * 0.92;
    whale.position.set(x, WORLD.floor + span * (0.55 + 0.08 * Math.sin(p * Math.PI * 2)), bounds.backZ);
    whale.rotation.set(0, (dir > 0 ? 0 : Math.PI) + Math.sin(t * 1.1) * 0.04, Math.sin(p * Math.PI * 4) * 0.03);
    fluke.rotation.z = Math.sin(t * 0.85) * 0.28; // 한 번 치는 데 약 7초 — 큰 몸은 느리게 친다
  }
  animate(0);
  return {
    root,
    animate,
    dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); root.removeFromParent(); },
  };
}
