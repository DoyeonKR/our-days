import * as T from "three";
import { decorPose, fishArtKey, fishCm, type AquaFish, type AquaState, type PlacedDecor } from "../aquarium.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { stepFish } from "./fishstep.ts";
import { makeSandPuffs } from "./sandpuff.ts";
import { makeShoal, type Shoal } from "./shoal.ts";
import { calmSpecular, makePost, repairNormals, underwaterEnvironment, type Post } from "./post.ts";
import { makeGiants, type Giants } from "./giants.ts";
import { DOME_TIER, SHOAL_TIER, TUNNEL_R, TUNNEL_TIER, WHALE_TIER, makeTunnel, tankDeep, tunnelObstacles, tunnelSpan, type Tunnel } from "./tunnel.ts";
import { DOME_R, domeObstacles, makeDome, type Dome } from "./dome.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { seatDecor } from "./decor-layout.ts";
import { isFishModelApproved } from "./quality.ts";
import { MIN_FRAME_MS, createPacer, ratioFloor } from "./framepace.ts";
import { type Course, type Hall, type Obstacle as CourseObstacle } from "./habits.ts";
import { bankAngle, decorToWorld, hallFrom, obstacleFromBox, schoolsOf, tallY, tankDisplay, tankTall, wideScale, worldToDecor, WORLD, clamp,fishLength } from "./world.ts";
import { bodyMeasure, glbUpright } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { makeHabitat, rockObstacles, softShadowTexture, HABITAT_THEMES, type Habitat } from "./habitat.ts";
import { DECOR_GLB, FISH_GLB, GlbLibrary, bodyBounds, decorMotion, fishMotion, swapBody } from "./glb.ts";
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null; preview?: PlacedDecor | null;
  /** 안에서 보기 — 10단계 터널 · 11단계 돔만. 꾸미는 동안은 밖에서 본다 */ tunnel?: boolean };
/** lost · restored · ready 가 없으면 예전처럼 error 로 알린다 */
export type TankEvents = { fish: (id: number) => void; decor: (id: number) => void; place: (x: number, y: number) => void; error: (message: string) => void;
  /** WebGL 연결이 끊겼다 — 화면이 다시 보이면 새로 열어 본다(Aquarium3D) */
  lost?: () => void; restored?: () => void;
  /** 첫 장면을 그렸다 */
  ready?: () => void };
/** 먹이 — 언제(수조 시계, 초) 어디(가로 x)에 줬나 */
export type FeedEvent = { t: number; x: number };
/** 물고기가 비켜 가야 할 장식 — 바닥의 원(가로 x · 깊이 z · 반지름) + 높이(낮은 장식은 넘어간다) */
export type Obstacle = CourseObstacle;
export type TankHandle = { update: (next: TankView) => void; feed: (atX?: number) => void; dispose: () => void };

/** 낚시터 주인의 왕관 — 금빛 고리 + 뾰족한 다섯 개 */
/** 주인의 왕관(2026-11-10) — 금 띠 하나에 원뿔 다섯이던 것을 위아래 테 · 바깥으로 벌어진 뾰족 끝 · 끝마다 진주 · 띠에 박힌 보석으로. 재질은 넷뿐(그리기 호출이 크게 안 는다). */
function makeCrown(r:number):T.Group{const g=new T.Group();
  const gold=new T.MeshStandardMaterial({color:0xf5c542,metalness:.85,roughness:.24,emissive:0x6a4600,emissiveIntensity:.55,side:T.DoubleSide});
  const pearl=new T.MeshStandardMaterial({color:0xfff6e6,metalness:.1,roughness:.18,emissive:0x40382c});
  const gems=[0xe0245e,0x2f7fe8,0x22b07d].map(c=>new T.MeshStandardMaterial({color:c,metalness:.3,roughness:.08,emissive:c,emissiveIntensity:.35}));
  g.add(new T.Mesh(new T.CylinderGeometry(r,r*.9,r*.42,28,1,true),gold));
  for(const[y,rr]of[[-r*.21,r*.92],[r*.21,r*1.01]]as const){const rim=new T.Mesh(new T.TorusGeometry(rr,r*.065,8,36),gold);rim.rotation.x=Math.PI/2;rim.position.y=y;g.add(rim);}
  const spike=new T.ConeGeometry(r*.22,r*.78,10),ball=new T.SphereGeometry(r*.12,12,8),stone=new T.OctahedronGeometry(r*.13);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,arm=new T.Group();arm.rotation.y=-a;
    const t=new T.Mesh(spike,gold);t.position.set(r*.97,r*.56,0);t.rotation.z=-.2;arm.add(t);
    const p=new T.Mesh(ball,pearl);p.position.set(r*1.05,r*.98,0);arm.add(p);
    // 뾰족 끝 사이 띠에 보석 하나
    const gemArm=new T.Group();gemArm.rotation.y=-(a+Math.PI/5);const gem=new T.Mesh(stone,gems[i%3]);gem.position.set(r*.97,0,0);gem.scale.set(.55,1,1);gemArm.add(gem);g.add(gemArm);
    g.add(arm);}
  return g;}
type Swimmer = AnimalModel & { key: string; family: string; length: number; phase: number; scale: number;
  /** 제작 모델로 갈아 끼웠나 */ glb: boolean; /** 쥐고 있는 GLB key(놓을 때 돌려준다) */ glbKey: string | null;
  /** 방금 들어왔다 — 첫 프레임은 방향을 바로 맞춘다(다른 물고기는 부드럽게 돈다) */ fresh: boolean; crown: T.Group | null;
  /** 이번 프레임 길 — 매 프레임 새 객체를 안 만들게 물고기마다 하나 들고 쓴다 */ course: Course };
type Decoration = DecorModel & { key: string; glb: boolean; glbKey: string | null; pose: string };

const ERROR_GPU = "이 기기에서 3D 그래픽을 처리하지 못했어요. 하드웨어 가속 설정을 확인한 뒤 다시 시도해 주세요.";
const ERROR_LOST = "3D 그래픽 연결이 끊어졌어요. 다시 열어 주세요.";
/** 한 마리 · 장식 하나가 못 지어져도 수조 전체를 멈추지 않는다 — 개발 중엔 콘솔에 남긴다 */
const skip = (what: string, e: unknown) => { if (process.env.NODE_ENV !== "production") console.warn(`[aqua3d] ${what} 건너뜀`, e); };

/** Three/WebGL2 is loaded only for the open tank. Local textures, no image billboards or state writes.
 *  2026-11-05 — 짓다가 던지면(모르는 장식 key 등) 붙여 둔 캔버스 · 관찰자 · 리스너 · WebGL 연결을 전부 걷고 다시 던진다.
 *  예전엔 그대로 남아 '다시 시도'를 누를 때마다 캔버스가 하나씩 쌓였다. */
export function createTank(host: HTMLDivElement, initial: TankView, events: TankEvents): TankHandle {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  const dpr = window.devicePixelRatio || 1;
  // 해상도 바닥은 기기 배율을 따른다(DPR 2 이상은 CSS 픽셀 1:1) — framepace.ts
  const pacer = createPacer(Math.min(dpr, 1.5), ratioFloor(dpr));
  const canvas = renderer.domElement;
  let disposed = false, lost = false, frame = 0, swapFrame = 0;
  let observer: ResizeObserver | null = null, intersection: IntersectionObserver | null = null;
  const unbind: (() => void)[] = [];
  const on = (target: HTMLElement | Document | MediaQueryList, type: string, fn: (e: never) => void) => {
    target.addEventListener(type, fn as EventListener); unbind.push(() => target.removeEventListener(type, fn as EventListener));
  };
  const scene = new T.Scene(), kit = new ModelKit(), glb = new GlbLibrary();

  function dispose(){
    if(disposed)return;disposed=true;active=false;cancelAnimationFrame(frame);cancelAnimationFrame(swapFrame);glb.dispose();if(observer)observer.disconnect();intersection?.disconnect();
    for(const off of unbind.splice(0))off();
    post?.dispose();envMap?.dispose();habitat?.dispose();tunnel?.dispose();dome?.dispose();shoal?.dispose();giants?.dispose();
    // 나눠 쓰는 GLB 형상 · 재질은 glb 가 센다(다른 수조 · 미리보기가 곧 다시 쓴다) — 여기선 지우지 않는다
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();if(o.userData.glbShared)return;geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}}});
    geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }

  // ── 아래는 짓는 도중 던질 수 있다 — catch 가 dispose 로 걷는다
  let post:Post|null=null,envMap:T.Texture|null=null,normalsFixed=0;
  let tunnel:Tunnel|null=null,inTunnel=false,deep=1,shoal:Shoal|null=null,giants:Giants|null=null,dome:Dome|null=null,inDome=false,domeYaw=0;
  let habitat:Habitat|null=null, habitatTier=0, wide=1, tall=1, pan=0, schools=new Map<number,{leader:number;slot:number}>();
  let state = initial, elapsed=0, previous=0, lastRaf=0, lastFlush=0, visible=true, active=false, angle=0, pitch=0, sized=false, compiled=false, announced=false;
  try {
  renderer.setPixelRatio(pacer.ratio());
  // 톤 매핑 — ACES 는 노랑을 주황으로 · 파랑을 청록으로 밀고 어두운 쪽을 눌러 2D 원화(물고기 그림)보다 탁했다.
  // Neutral(Khronos PBR Neutral)은 0.8 아래 색을 거의 그대로 두어 그림의 색과 가장 가깝다. 중간 밝기를 ACES ×1.1 과 맞추려고 노출 1.3
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.3;
  canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const camera = new T.PerspectiveCamera(44, 0.8, 0.1, 110);
  // 장면 행렬은 draw 가 한 번만 계산한다 — 렌더러가 또 계산하면 프레임마다 두 번이었다. 수조 · 장식은 놓을 때만 다시 잰다
  scene.matrixAutoUpdate = false; scene.matrixWorldAutoUpdate = false;
  scene.background = new T.Color(0x07191e); scene.fog = new T.Fog(0x063949, 18, 34);
  // 물속 환경광 — 비늘 · 바위 · 금속 · 유리에 물빛이 비친다(post.ts). 그만큼 하늘빛 조명은 줄였다
  envMap = underwaterEnvironment(renderer); scene.environment = envMap; scene.environmentIntensity = .55;
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 1.35); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe3ad, 2.3); sun.position.set(-4,9,6); scene.add(sun);
  const fill = new T.PointLight(0x5ec8df, 20, 24, 2); fill.position.set(3,2,-1); scene.add(fill);
  const swimmers = new Map<number,Swimmer>(), decorations = new Map<number,Decoration>();
  // 제작 모델이 피부 그림을 대신한다 — 곧 갈아 끼울 물고기엔 그림을 받지 않는다(models.ts)
  kit.skinless = FISH_GLB;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Batch repeated eyes, leaves, stems and masonry without losing their original joint hierarchy.
  // Original mesh nodes remain for accurate ray picking; only the batch is drawn.
  const batches: { mesh: T.InstancedMesh; originals: T.Mesh[]; dynamic: boolean; ready: boolean }[] = [];
  let batchesDirty = true;
  // 물고기 몸 · 흔들리는 장식 부품 밑이 아니면 안 움직인다 — 위치를 매 프레임 GPU 로 다시 올리지 않는다.
  // ⚠ 예전엔 장식 밑이면 전부 '움직인다'로 쳐서 장식 묶음이 매 프레임 다시 올라갔다
  const moves=(o:T.Object3D)=>{for(let p:T.Object3D|null=o;p;p=p.parent)if(p.userData.type==="fish"||p.userData.moving)return true;return false;};
  function rebuildBatches(){
    for(const b of batches){for(const m of b.originals)m.visible=true;b.mesh.removeFromParent();b.mesh.dispose();}batches.length=0;
    const groups=new Map<string,T.Mesh[]>();
    // 셰이더 재질은 묶지 않는다 — instanceMatrix 를 안 읽어서 묶으면 전부 원점에 겹쳐 그려진다(2026-11-10 빛줄기가 수조 가운데 흰 네모가 됐다)
    scene.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o instanceof T.SkinnedMesh)&&!Array.isArray(o.material)&&!(o.material instanceof T.ShaderMaterial)&&o!==halo){
      const key=o.geometry.uuid+o.material.uuid;const list=groups.get(key)??[];list.push(o);groups.set(key,list);
    }});
    for(const originals of groups.values())if(originals.length>=3){const mesh=new T.InstancedMesh(originals[0].geometry,originals[0].material,originals.length);mesh.frustumCulled=false;mesh.raycast=()=>{};
      for(const m of originals)m.visible=false;scene.add(mesh);batches.push({mesh,originals,dynamic:originals.some(moves),ready:false});}
  }
  let focusK=0,focusLen=1;const focusGoal=new T.Vector3(0,-.1,0),focusLook=new T.Vector3(0,-.1,0),lookAt=new T.Vector3();
  const ray = new T.Raycaster(), ndc = new T.Vector2(), floorPlane = new T.Plane(new T.Vector3(0,1,0),-WORLD.floor), hitPoint = new T.Vector3(), projected = new T.Vector3();
  const basis = new T.Matrix4(), direction = new T.Vector3(), targetQuat = new T.Quaternion(), up = new T.Vector3(0,1,0), side = new T.Vector3(), vertical = new T.Vector3();
  const halo = new T.Mesh(new T.TorusGeometry(.7,.018,8,48),new T.MeshBasicMaterial({color:0xf4e2a0,transparent:true,opacity:.75})); halo.visible=false;halo.raycast=()=>{};scene.add(halo);
  // 물고기 그림자 — 바닥 돌과 같은 부드러운 원을 물고기 밑 모래 위에 하나씩(인스턴스 한 묶음). 높이 뜰수록 넓고 옅다
  const shadowMaterial = new T.MeshBasicMaterial({ map: softShadowTexture(), color: 0x000000, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  // 인스턴스 색의 초록 값을 그림자 진하기로 쓴다(검정 그림자라 색은 안 쓴다)
  shadowMaterial.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n#ifdef USE_COLOR\ndiffuseColor.a*=vColor.g;\n#endif"); };
  const shadowGeometry = new T.PlaneGeometry(1, 1); shadowGeometry.rotateX(-Math.PI / 2);
  const makeShadows = (n: number) => { const m = new T.InstancedMesh(shadowGeometry, shadowMaterial, n); m.frustumCulled = false; m.raycast = () => {}; m.name = "fish-floor-shadows"; m.count = 0; scene.add(m); return m; };
  let fishShadows = makeShadows(4);
  const shadowTint = new T.Color(), shadowDummy = new T.Object3D();
  // 물고기끼리 비켜 가기 · 먹이 · 장식 피하기에 쓰는 이번 프레임 값 — 할당 없이 채운다(움직임 함수가 받을 자리)
  const motion = { feed: null as FeedEvent | null, obstacles: [] as Obstacle[], hall: null as Hall | null, positions: new Float32Array(3), lengths: new Float32Array(1), heading: new Float32Array(3), count: 0, rolls: new Float32Array(1),
    /** 겹침 밀기 보정값(x,y,z) · 바닥에 붙어 사는 정도 · 이번 프레임 길 — 물고기 수가 바뀔 때만 다시 잡는다 */
    offsets: new Float32Array(3), pinned: new Float32Array(1), courses: [] as Course[] };
  const bankQ = new T.Quaternion(), FORWARD = new T.Vector3(1, 0, 0);
  const heightAt = (x: number, z: number) => habitat?.heightAt(x, z) ?? WORLD.floor;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  // 모래 먼지 — 바닥 물고기가 내려앉으면(course.puff) 점 60 알을 돌려 쓴다. 움직임 줄이기면 안 그린다
  const puffs=makeSandPuffs(heightAt);scene.add(puffs.points);
  // 물속 후처리 — 장면을 HDR 그림에 그린 뒤 일렁임 · 빛 번짐 · 비네트 · 톤 매핑을 한 번에(post.ts)
  const postNow=makePost(renderer,{still:()=>reduced.matches});post=postNow;
  renderer.debug.onShaderError=()=>{lost=true;schedule();events.error(ERROR_GPU);};

  /** 섬 하나를 떼어 낸다 — 나눠 쓰는 키트 · GLB 것은 남긴다 */
  function release(root:T.Object3D){
    const geometry=new Set<T.BufferGeometry>(), materials=new Set<T.Material>(), textures=new Set<T.Texture>();
    const shared=new Set<T.Material>(kit.materials.values());
    root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){const borrowed=!!o.userData.glbShared;if(!borrowed&&o.geometry!==kit.sphere&&o.geometry!==kit.box&&o.geometry!==kit.cylinder)geometry.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!borrowed&&!shared.has(m)){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}
      if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});root.removeFromParent();
  }
  const dropFish=(m:Swimmer)=>{release(m.root);if(m.glbKey)glb.release("fish",m.glbKey);};
  const dropDecor=(d:Decoration)=>{release(d.root);if(d.glbKey)glb.release("decor",d.glbKey);};
  /** 아직 코드 모델로 보이는 물고기의 key — 갈아 끼운 물고기의 피부 그림은 놓는다 */
  const retainSkins=()=>kit.retainReferences(new Set([...swimmers.values()].filter(m=>!m.glb).map(m=>m.key)));

  // 제작 모델 도착 — 받은 것을 모아 두었다가 한 프레임에 갈아 끼우고 묶음을 한 번만 다시 짓는다.
  // 예전엔 도착할 때마다(물고기 20 + 장식 32 ≈ 50번) 장면 전체를 훑고 묶음을 다시 짓고 한 장을 더 그려서 끊겼다
  const swaps:(()=>void)[]=[];
  function flushSwaps(){
    const jobs=swaps.splice(0);if(!jobs.length)return;
    for(const job of jobs){try{job();}catch(e){skip("제작 모델",e);}}
    batchesDirty=true;retainSkins();
  }
  /** 멈춰 있을 때(꾸미기 · 움직임 줄이기)는 다음 프레임 하나에 갈아 끼우고 한 장 그린다 */
  function requestFlush(){
    if(!active&&!swapFrame&&swaps.length)swapFrame=requestAnimationFrame(()=>{swapFrame=0;if(disposed)return;flushSwaps();if(!active)draw(0);});
  }
  function queueSwap(job:()=>void){swaps.push(job);requestFlush();}
  /** 왕관은 몸의 꼭대기에 — 몸을 갈아 끼우면 새 몸으로 다시 잰다(왕관까지 재면 제작 모델이 작고 높게 앉았다) */
  function placeCrown(m:Swimmer){
    if(!m.crown)return;const box=bodyBounds(m.root),center=box.getCenter(new T.Vector3());
    m.crown.position.set(0,box.max.y,center.z);m.crown.updateMatrix();
  }
  function addFish(f:AquaFish){
    const key=fishArtKey(f);
    const animal=makeAnimal(kit,f.family,key),length=fishLength(fishCm(f),f.family);
    waterLitTree(animal.root,false);normalsFixed+=repairNormals(animal.root);calmSpecular(animal.root);
    // 머리~꼬리 길이로 잰다(anatomy.bodyMeasure) — 키로 재면 엔젤 · 디스커스 같은 키 큰 물고기가 잡은 cm 의 71~90% 로 보였다
    const bounds=new T.Box3().setFromObject(animal.root),size=bounds.getSize(new T.Vector3()),scale=length/Math.max(.001,bodyMeasure(f.family,key,size));
    animal.root.scale.setScalar(scale);animal.root.userData={type:"fish",id:f.id};scene.add(animal.root);
    const m:Swimmer={...animal,key,family:f.family,length,scale,phase:f.id*1.73,glb:false,glbKey:null,fresh:true,crown:null,course:{x:0,y:0,z:0,dx:1,dy:0,dz:0,effort:1,turn:0,amp:1,pulse:0,ground:0,puff:-1,hover:0}};
    if(f.crown){m.crown=makeCrown(Math.max(size.x,size.z)*.2);m.crown.userData.aquaKeep=true;m.root.add(m.crown);placeCrown(m);}
    swimmers.set(f.id,m);
    if(FISH_GLB.has(key)){m.glbKey=key;void glb.load("fish",key).then(src=>{
      if(disposed)return;
      // 못 받았다 — 임시 모델 그대로, 이제 피부 그림을 받는다
      if(!src){if(swimmers.get(f.id)===m)kit.loadDeferred(key);return;}
      queueSwap(()=>{if(swimmers.get(f.id)!==m||m.glb)return;const inner=glb.instance(src);
        // 해파리 GLB 는 갓 축이 +X 로 누워 있다 — 세운 뒤 크기를 잰다. 재질은 종별 표(은빛 광택 · 상어 거친 피부 · 신화종 빛남) — 같은 key 끼리 공유라 같은 값을 다시 넣어도 된다
        inner.rotation.z=glbUpright(f.family,key);applyTweak(inner,f.family,key);normalsFixed+=repairNormals(inner);calmSpecular(inner);
        release(swapBody(m.root,inner,"center",s=>bodyMeasure(f.family,key,s)));
        m.animate=fishMotion(inner,f.family,key);m.glb=true;kit.dropDeferred(key);placeCrown(m);});
    });}
  }
  function addDecor(p:PlacedDecor):Decoration{
    const made=makeDecor(kit,p.key);waterLitTree(made.root,false);
    const d:Decoration={...made,key:p.key,glb:false,glbKey:null,pose:""};d.root.userData={type:"decor",id:p.id};scene.add(d.root);decorations.set(p.id,d);
    if(DECOR_GLB.has(p.key)){d.glbKey=p.key;void glb.load("decor",p.key).then(src=>{if(disposed||!src)return;
      queueSwap(()=>{if(decorations.get(p.id)!==d||d.glb)return;const inner=glb.instance(src);release(swapBody(d.root,inner,"base"));
        // 거품은 몸과 따로 남아 있다(decor-details) — 효과와 부품 움직임을 같이 돌린다
        const fx=d.effects,parts=decorMotion(inner);d.animate=t=>{fx(t);parts(t);};d.glb=true;
        seatDecor(d.root,(x,z)=>habitat?.heightAt(x,z)??WORLD.floor,4.9*wide);refreshObstacles();});
    });}
    return d;
  }
  function refreshObstacles(){
    // 물고기 길은 앞뒤 · 높이를 늘리기 전 좌표에서 계산한다(장식은 늘린 뒤 월드 좌표) — 같은 자리로 되돌려 넣는다(2026-11-11, 깊은 수조에서 장식을 뚫고 지나갔다)
    motion.obstacles=[...decorations.values()].map(d=>{const b=new T.Box3().setFromObject(d.root),o=obstacleFromBox(b.min,b.max);return deep===1&&tall===1?o:{...o,z:o.z/deep,h:o.h/tall};});
    // 터널 · 돔 유리(낮은 물고기는 옆 길 · 둘레로만 — motion.hall) · 바닥 바위(2026-11-11 — 예전엔 바위가 장애물이 아니라 흰동가리 · 우럭이 바위 속을 지났다). 장식이 목록 앞(구경은 장식만)
    const hallObs=tunnel?tunnelObstacles(deep,tall):dome?domeObstacles(tall):[];motion.hall=hallFrom(tunnel?"tunnel":"dome",hallObs[0]);
    for(const o of hallObs)motion.obstacles.push({...o,kind:"hall"});
    if(habitat)motion.obstacles.push(...rockObstacles(habitatTier,wide,deep));
  }
  function applyTweak(inner:T.Object3D,family:string,key:string){
    const t=materialTweak(family,key);
    inner.traverse(o=>{const mat=(o as T.Mesh).material;for(const x of Array.isArray(mat)?mat:mat?[mat]:[]){if(!(x instanceof T.MeshStandardMaterial))continue;
      x.roughness=t.roughness;x.metalness=t.metalness;
      if(t.emissiveIntensity>=0&&(t.emissiveIntensity>0||t.emissiveFromMap)){x.emissiveIntensity=t.emissiveIntensity;if(t.emissiveFromMap&&x.map){x.emissiveMap=x.map;x.emissive.setHex(0xffffff);}else x.emissive.setHex(t.emissive??0);}}});
  }
  function update(next:TankView){
    if(disposed)return;
    state=next;let topologyChanged=false,moved=false;
    const approvedFish=next.aquarium.fish.filter(f=>isFishModelApproved(fishArtKey(f)));
    const ids=new Set(approvedFish.map(f=>f.id));
    if(habitatTier!==next.aquarium.tank){
      if(habitat){habitat.dispose();release(habitat.root);}
      habitat=makeHabitat(next.aquarium.tank,{anisotropy});habitatTier=next.aquarium.tank;
      scene.add(habitat.root);topologyChanged=true;wide=0;
      // 위로 늘린다 — 바닥(WORLD.floor)을 붙잡고 키운다(habitat.heightAt 도 같은 식)
      tall=tankTall(habitatTier);habitat.root.scale.y=tall;habitat.root.position.y=WORLD.floor*(1-tall);
      // 대수족관은 앞뒤로도 깊다(터널이 지나갈 자리) — 바닥 높이 · 물고기 길 · 장식 자리도 같은 배율
      deep=tankDeep(habitatTier);habitat.root.scale.z=deep;habitat.root.updateMatrix();
      if(tunnel){release(tunnel.root);tunnel.dispose();tunnel=null;}
      if(dome){release(dome.root);dome.dispose();dome=null;}
    }
    // ⚠ 넓히면 수조 틀 · LED · 유리 모서리 · 접지 그림자(안 움직이는 묶음)도 다시 올려야 한다 — 예전엔 옛 폭에 남았다
    const nextWide=wideScale(next.aquarium.wide);
    if(nextWide!==wide){wide=nextWide;if(habitat){habitat.root.scale.x=wide;habitat.root.updateMatrix();}topologyChanged=true;}
    schools=schoolsOf(approvedFish);
    for(const[id,m]of swimmers)if(!ids.has(id)){dropFish(m);swimmers.delete(id);topologyChanged=true;}
    for(const f of approvedFish){const key=fishArtKey(f),old=swimmers.get(f.id);if(old?.key===key)continue;
      topologyChanged=true;if(old){dropFish(old);swimmers.delete(f.id);}
      try{addFish(f);}catch(e){skip(`물고기 ${key}`,e);}
    }
    retainSkins();
    // Preview replaces a moved item or adds one temporary item. Never mutates inventory or shared saves.
    const placed=next.preview?[...next.aquarium.placed.filter(p=>p.id!==next.preview!.id),next.preview]:next.aquarium.placed;
    const placedIds=new Set(placed.map(p=>p.id));for(const[id,m]of decorations)if(!placedIds.has(id)){dropDecor(m);decorations.delete(id);topologyChanged=true;}
    for(const p of placed){let m=decorations.get(p.id);
      if(!m||m.key!==p.key){topologyChanged=true;if(m){dropDecor(m);decorations.delete(p.id);}try{m=addDecor(p);}catch(e){skip(`장식 ${p.key}`,e);continue;}}
      // 놓인 자리가 그대로면 다시 앉히지 않는다(앉히기는 장식 전체를 훑는다 — 화면이 다시 그려질 때마다 돌았다)
      const pose=decorPose(p),sig=`${p.x},${p.y},${p.rotation},${pose.scale},${wide},${habitatTier}`;if(m.pose===sig)continue;m.pose=sig;moved=true;
      const pos=decorToWorld(p.x,p.y,wide);pos.z*=deep;
      // 터널 수족관 — 터널 자리(가운데 줄)에 놓인 장식은 터널 밖 옆으로 비켜 앉힌다(저장 자리는 그대로)
      if(habitatTier>=TUNNEL_TIER&&habitatTier<DOME_TIER&&Math.abs(pos.x)<TUNNEL_R+.5&&pos.z>tunnelSpan(deep).back-.5)pos.x=(pos.x<0?-1:1)*(TUNNEL_R+.5);
      // 돔 자리(가운데 둥근 곳)에 놓인 장식은 돔 밖 둘레로 비켜 앉힌다
      if(habitatTier>=DOME_TIER){const rr=Math.hypot(pos.x,pos.z);if(rr<DOME_R+.6){const k=(DOME_R+.6)/Math.max(.001,rr);pos.x=rr<.001?DOME_R+.6:pos.x*k;pos.z=rr<.001?0:pos.z*k;}}m.root.position.set(pos.x,habitat?.heightAt(pos.x,pos.z)??pos.y,pos.z);m.root.rotation.y=p.rotation===undefined?(p.id%7-3)*.12:pose.rotation*Math.PI/180;m.root.scale.setScalar(pose.scale);
      seatDecor(m.root,(x,z)=>habitat?.heightAt(x,z)??WORLD.floor,4.9*(habitat?.root.scale.x??1));
    }
    // 터널 — 대수족관에서만, 넓힌 폭을 따라 길이가 바뀐다
    // 단계별 볼거리 — 정어리 떼 8 · 고래 9 · 터널 10 · 돔 11(tunnel.ts 의 기준값 한곳)
    const wantTunnel=habitatTier>=TUNNEL_TIER&&habitatTier<DOME_TIER,wantDome=habitatTier>=DOME_TIER,wantShoal=habitatTier>=SHOAL_TIER,wantWhale=habitatTier>=WHALE_TIER;
    if(tunnel&&!wantTunnel){release(tunnel.root);tunnel.dispose();tunnel=null;topologyChanged=true;}
    if(wantTunnel&&!tunnel){tunnel=makeTunnel(deep);scene.add(tunnel.root);topologyChanged=true;}
    const domeKey=`${wide},${deep},${tall}`;
    if(dome&&(!wantDome||dome.root.userData.key!==domeKey)){release(dome.root);dome.dispose();dome=null;topologyChanged=true;}
    if(wantDome&&!dome){const th=HABITAT_THEMES[clamp(habitatTier-1,0,HABITAT_THEMES.length-1)];dome=makeDome({front:3*deep,wide,top:tallY(5.6,tall),water:th.water,high:th.top,art:9});dome.root.userData.key=domeKey;scene.add(dome.root);topologyChanged=true;}
    // 정어리 떼 — 대수족관의 배경 손님(한 묶음 320마리). 수조 크기가 바뀌면 새로 짓는다
    const shoalKey=wantShoal?`${wide},${deep},${tall}`:"";
    if(shoal&&shoal.mesh.userData.key!==shoalKey){shoal.dispose();shoal=null;}
    // 빛줄기는 모든 수조에, 고래 그림자는 대수족관에만
    const giantKey=`${wide},${deep},${tall},${wantWhale}`;
    if(giants&&giants.root.userData.key!==giantKey){giants.dispose();giants=null;}
    if(!giants&&habitat){giants=makeGiants({halfX:4.6*wide,backZ:deep>1?-3*deep+1.6:-2.2,glassZ:-3*deep,top:tallY(5.4,tall),whale:wantWhale});giants.root.userData.key=giantKey;scene.add(giants.root);}
    if(wantShoal&&!shoal){shoal=makeShoal(320,{halfX:4.4*wide,halfZ:3*deep-.8,top:tallY(5.2,tall)});shoal.mesh.userData.key=shoalKey;scene.add(shoal.mesh);}
    const nextIn=!!next.tunnel&&!!(tunnel||dome)&&!next.editing;
    if(nextIn!==inTunnel){inTunnel=nextIn;camera.fov=inTunnel?72:44;camera.updateProjectionMatrix();angle=0;pitch=0;}
    inDome=inTunnel&&!!dome;dome?.setInside(inDome);
    if(moved||topologyChanged)refreshObstacles();
    const theme=HABITAT_THEMES[clamp(next.aquarium.tank-1,0,HABITAT_THEMES.length-1)];
    const water=new T.Color(theme.water).lerp(new T.Color(0x3d4c37),clamp((60-next.aquarium.water)/100,0,.55));
    if(scene.fog instanceof T.Fog)scene.fog.color.copy(water);
    WATER_LIGHT.aquaRimColor.value.set(theme.top).lerp(water,.3);
    habitat?.setWater(next.aquarium.water);
    if(topologyChanged){batchesDirty=true;
      const n=Math.max(1,swimmers.size);
      const cap=fishShadows.instanceMatrix.count;if(cap<n||cap>Math.max(4,n*2)){fishShadows.removeFromParent();fishShadows.dispose();fishShadows=makeShadows(Math.max(4,n));}
      if(motion.lengths.length<n){motion.positions=new Float32Array(n*3);motion.heading=new Float32Array(n*3);motion.lengths=new Float32Array(n);motion.pinned=new Float32Array(n);motion.rolls=new Float32Array(n);}
      // 물고기가 바뀌면 순서가 바뀐다 — 겹침 보정은 처음부터 다시(작은 값이라 티가 안 난다)
      motion.offsets=new Float32Array(Math.max(3,n*3));
    }
    // 장식이 옮겨졌다 — 안 움직이는 묶음도 한 번 다시 올린다
    if(moved)for(const b of batches)b.ready=false;
    // 돌아가는 중엔 다음 프레임에 맡긴다 — 화면이 다시 그려질 때마다 한 장 더 그리면서 물고기 방향이 튀었다
    if(!active)draw(0);schedule();
  }
  function draw(dt:number){
    // 크기를 재기 전(300×150) · 셰이더를 다 짓기 전에는 그리지 않는다 — 첫 장에 프로그램 열 개를 메인 스레드에서 짓느라 멈췄다
    if(disposed||!sized||!compiled)return;
    if(batchesDirty){batchesDirty=false;rebuildBatches();}
    // 어항 폭이 화면에 다 들어오는 거리 — 늘린 어항 · 세로 전체 보기에서도 양옆이 잘리지 않는다. 안개도 같이 물러난다
    const half=Math.tan(camera.fov*Math.PI/360),fitW=5*wide/(half*camera.aspect)+3,fitH=5.9*tall/half+3;
    const fit=Math.max(fitW,fitH),camD=clamp(fit/tankDisplay(habitatTier,wide),19,70),reach=(wide-1)*3,camX=clamp(pan,-reach,reach);
    // 깊이 안개 — 수조는 camD±3 에 있다. 예전 camD+1 ~ +19 는 뒤쪽에도 11% 밖에 안 걸려 깊이가 안 보였다
    // 고른 물고기 따라가기(2026-11-10) — 물고기를 누르면 카메라가 천천히 다가가 따라간다. 수조 전체에선 구피가 몇 픽셀이라 무엇을 골랐는지 안 보였다.
    // 멈춘 그리기(draw(0) — 움직임 줄이기 · 숨김)에선 바로 그 자리로
    const sel=state.editing?undefined:swimmers.get(state.selectedFish??-1);
    const goal=sel?1:0;
    focusK=dt>0?focusK+(goal-focusK)*Math.min(1,dt*2.2):goal;
    if(sel){focusGoal.copy(sel.root.position);focusGoal.x=clamp(focusGoal.x,-4.2*wide,4.2*wide);focusGoal.y=clamp(focusGoal.y,WORLD.floor+.8,tallY(4.6,tall));focusGoal.z=clamp(focusGoal.z,-2.4,2.4);focusLen=sel.length;}
    focusLook.lerp(focusGoal,dt>0?Math.min(1,dt*3.5):1);
    const near=Math.min(camD*.65,Math.max(5.5,focusLen*5)),dist=camD+(near-camD)*focusK;
    lookAt.set(camX,tallY(-.1,tall),0).lerp(focusLook,focusK);
    if(scene.fog instanceof T.Fog){scene.fog.near=dist-2;scene.fog.far=dist+9;}
    const scale=dist/camD;
    if(inDome){
      // 돔 안 — 가운데에 서서 천천히 한 바퀴 둘러보고(1바퀴 약 5분), 끌면 그쪽으로 돈다. 물고기를 고르면 그쪽을 본다
      const eye=WORLD.floor+1.7,yaw=domeYaw+elapsed*.021,up=.5+pitch*3.2;
      camera.position.set(0,eye,0);
      lookAt.set(Math.sin(yaw)*10,eye+Math.tan(up)*10,-Math.cos(yaw)*10).lerp(focusLook,focusK*.85);
      if(scene.fog instanceof T.Fog){scene.fog.near=3;scene.fog.far=12+6*deep;}
    }else if(inTunnel){
      // 터널 안 — 천천히 오가며 걷고, 끌면 고개를 돌린다(좌우 · 위아래). 물고기를 고르면 그쪽을 올려다본다
      const span=tunnelSpan(deep),eye=WORLD.floor+1.2,len=span.front-span.back-3.2;
      const walkZ=span.front-1.2-(.5-.5*Math.cos(elapsed*.028))*len;
      const yaw=angle*2.6,up=.58+pitch*3.2;
      camera.position.set(0,eye,walkZ);
      lookAt.set(Math.sin(yaw)*10,eye+Math.tan(up)*10,walkZ-Math.cos(yaw)*10).lerp(focusLook,focusK*.85);
      if(scene.fog instanceof T.Fog){scene.fog.near=3;scene.fog.far=12+6*deep;}
    }else camera.position.set(lookAt.x+Math.sin(angle)*camD*scale, lookAt.y+(1+pitch*10)*scale,lookAt.z+Math.cos(angle)*camD*scale);
    camera.lookAt(lookAt);camera.updateMatrixWorld();
    WATER_LIGHT.aquaTime.value=elapsed;
    // 1) 이번 프레임 길 → 늘리기 → 겹침 밀기 → 모래에 앉히기(fishstep.ts — 테스트와 같은 식)
    motion.feed=motion.feed&&elapsed-motion.feed.t<40?motion.feed:null;
    stepFish(swimmers,schools,id=>swimmers.get(id)?.length,elapsed,dt,{wide,tall,deep,heightAt,obstacles:motion.obstacles,feed:motion.feed,hall:motion.hall},motion);
    // 2) 자리 · 방향 · 그림자
    let i=0;
    for(const m of swimmers.values()){const x=motion.positions[i*3],y=motion.positions[i*3+1],z=motion.positions[i*3+2];m.root.position.set(x,y,z);
      direction.set(motion.heading[i*3],motion.heading[i*3+1],motion.heading[i*3+2]).normalize();side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      // 새로 들어온 물고기만 바로 맞춘다 — 다른 물고기까지 맞추면 모양이 바뀔 때마다 전부 방향이 튀었다
      // 돌 때 안쪽으로 살짝 기운다(최대 10°) · 바닥 물고기는 비탈만큼 옆으로
      targetQuat.multiply(bankQ.setFromAxisAngle(FORWARD,bankAngle(m.course.turn)+(motion.rolls[i]??0)));
      if(dt===0||m.fresh){m.root.quaternion.copy(targetQuat);m.fresh=false;}else m.root.quaternion.slerp(targetQuat,Math.min(1,dt*2.8));
      m.animate(m.phase,1,m.course);
      if(i<fishShadows.instanceMatrix.count){const floorY=habitat?.heightAt(x,z)??WORLD.floor,h=Math.max(0,y-floorY),s=m.length*(.75+h*.06);
        shadowDummy.position.set(x,floorY+.02,z);shadowDummy.rotation.set(0,Math.atan2(-direction.z,direction.x),0);shadowDummy.scale.set(s,1,s*.5);shadowDummy.updateMatrix();fishShadows.setMatrixAt(i,shadowDummy.matrix);
        fishShadows.setColorAt(i,shadowTint.setRGB(0,clamp(1-h*.1,.15,1),0));}
      i++;
    }
    puffs.update(motion.courses,motion.positions,motion.lengths,motion.count,reduced.matches);
    fishShadows.count=Math.min(i,fishShadows.instanceMatrix.count);fishShadows.instanceMatrix.needsUpdate=true;if(fishShadows.instanceColor)fishShadows.instanceColor.needsUpdate=true;
    for(const d of decorations.values())d.animate(elapsed);
    habitat?.animate(elapsed);tunnel?.animate(elapsed);dome?.animate(elapsed);shoal?.animate(elapsed);giants?.animate(elapsed);
    const selected=state.editing?decorations.get(state.preview?.id??state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected;if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=(habitat?.heightAt(halo.position.x,halo.position.z)??WORLD.floor)+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar((selected as Swimmer).length*.65);}}
    scene.updateMatrixWorld();
    for(const b of batches){if(!b.dynamic&&b.ready)continue;b.ready=true;for(let k=0;k<b.originals.length;k++)b.mesh.setMatrixAt(k,b.originals[k].matrixWorld);b.mesh.instanceMatrix.needsUpdate=true;}
    // 초점 — 따라가면 그 물고기(배경이 흐려진다). 따라가지 않을 땐 흐림을 끈다(세기가 작으면 섞이는 양은 몇 % 인데 픽셀마다 12쌍을 읽었다)
    const focusDist=focusK>.05?camera.position.distanceTo(focusLook):inTunnel?10:camera.position.distanceTo(lookAt);
    postNow.render(scene,camera,elapsed,{distance:focusDist,strength:focusK>.02?focusK*(inTunnel?.45:.8):0});
    if(!announced){announced=true;events.ready?.();}
    if(process.env.NODE_ENV!=="production"){
      host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.fish=String(swimmers.size);host.dataset.decor=String(decorations.size);
      host.dataset.time=elapsed.toFixed(2);host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.normalsFixed=String(normalsFixed);host.dataset.textures=String(renderer.info.memory.textures);
    }
  }
  // 개발 전용: 창이 숨겨져 rAF 가 멈춰도 시간을 흘려 움직임을 확인한다(host.__aquaStep(초)) — 배포 빌드엔 없다
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaStep?:(s:number)=>void}).__aquaStep=(sec:number)=>{for(let t=0;t<sec;t+=1/30){elapsed+=1/30;draw(1/30);}};
  /** 점 입자(거품) 크기 — 그리는 버퍼 높이의 절반 */
  const syncPointScale=()=>{WATER_LIGHT.aquaPointScale.value=Math.max(1,canvas.height/2);};
  const tick=(time:number)=>{if(!active||disposed)return;
    const raw=lastRaf?time-lastRaf:0;lastRaf=time;const gap=previous?time-previous:0;
    if(!previous||gap>=MIN_FRAME_MS){
      if(swaps.length&&time-lastFlush>=150){lastFlush=time;flushSwaps();}
      const dt=Math.min(gap/1000,.08);previous=time;elapsed+=dt;draw(dt);const ratio=pacer.feed(gap,raw);if(ratio!==null){renderer.setPixelRatio(ratio);syncPointScale();}
    }else pacer.observe(raw);
    frame=requestAnimationFrame(tick);};
  function schedule(){const run=!disposed&&!lost&&sized&&compiled&&visible&&!document.hidden&&!reduced.matches&&!state.editing;
    host.dataset.paused=String(!run);if(active===run)return;active=run;cancelAnimationFrame(frame);previous=0;lastRaf=0;if(run)frame=requestAnimationFrame(tick);
    else requestFlush();
  }
  // 크기만 바뀌면(주소창이 나타났다 사라질 때 · 전체 보기) 돌아가는 중엔 크기만 고친다 — 한 장 더 그리면 모든 물고기 방향이 튀었다
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);syncPointScale();
    const first=!sized;sized=true;if(first)schedule();if(!active)draw(0);};
  observer=new ResizeObserver(resize);observer.observe(host);
  intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;schedule();});intersection.observe(host);
  on(document,"visibilitychange",schedule);on(reduced,"change",schedule);
  // 연결이 끊기면 멈추고 알린다. 브라우저가 되돌려 주면(restored) three 가 자원을 다시 올린다 — 이어서 돈다
  on(canvas,"webglcontextlost",(e:Event)=>{e.preventDefault();lost=true;schedule();if(events.lost)events.lost();else events.error(ERROR_LOST);});
  on(canvas,"webglcontextrestored",()=>{lost=false;batchesDirty=true;schedule();if(!active)draw(0);events.restored?.();});
  let start:{x:number;y:number;angle:number;pitch:number;pan:number;yaw:number}|null=null;
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,angle,pitch,pan,yaw:domeYaw};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start)return;if(inDome)domeYaw=start.yaw+(e.clientX-start.x)*.006;angle=clamp(start.angle+(e.clientX-start.x)*.003,-.4,.4);pan=clamp(start.pan-(e.clientX-start.x)*.02,-(wide-1)*3,(wide-1)*3);pitch=clamp(start.pitch+(e.clientY-start.y)*.001,-.10,.13);if(!active)draw(0);};
  const cancel=()=>{start=null;};
  const end=(e:PointerEvent)=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(moved>8)return;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
    if(state.editing&&state.placing){const floorHit=habitat?ray.intersectObject(habitat.floor)[0]:null;const point=floorHit?.point??ray.ray.intersectPlane(floorPlane,hitPoint);if(point){const p=worldToDecor(point.x,point.z/deep,wide);events.place(p.x,p.y);}return;}
    const owner=(o:T.Object3D|null)=>{while(o&&!o.userData.type)o=o.parent;return o;};
    if(state.editing){const hit=ray.intersectObjects([...decorations.values()].map(m=>m.root),true)[0],o=hit?owner(hit.object):null;if(o?.userData.type==="decor")events.decor(o.userData.id);return;}
    // 보기 모드는 물고기만 — 장식이 앞에 있으면 장식이 탭을 가로챘다. 치어는 10~14px 이라, 빗나가면 24px 안의 가장 가까운 물고기를 고른다
    const hit=ray.intersectObjects([...swimmers.values()].map(m=>m.root),true)[0],o=hit?owner(hit.object):null;
    if(o?.userData.type==="fish"){events.fish(o.userData.id);return;}
    const px=e.clientX-r.left,py=e.clientY-r.top;let best=-1,bestD=24;
    for(const[id,m]of swimmers){projected.copy(m.root.position).project(camera);if(projected.z>1)continue;const d=Math.hypot((projected.x+1)/2*r.width-px,(1-projected.y)/2*r.height-py);if(d<bestD){bestD=d;best=id;}}
    if(best>=0)events.fish(best);
  };
  on(canvas,"pointerdown",down);on(canvas,"pointermove",move);on(canvas,"pointerup",end);on(canvas,"pointercancel",cancel);
  update(initial);
  // 크기는 바로 한 번 잰다 — ResizeObserver 는 화면이 그려질 때만 와서, 뒤에 숨은 탭에선 첫 크기를 못 받았다(그리기는 셰이더를 다 지은 뒤)
  resize();
  // 셰이더는 그리기 전에 모아서 짓는다(되는 기기는 백그라운드에서) — 첫 장이 메인 스레드를 붙잡지 않게
  void renderer.compileAsync(scene,camera).catch(()=>{}).then(()=>{if(disposed)return;compiled=true;schedule();if(!active)draw(0);});
  return {
    update,
    /** 먹이를 줬다 — 물고기 길 함수가 받는 자리(motion.feed)에 남긴다. atX 는 수조 가로(-4.5 ~ 4.5, 넓힌 만큼) */
    feed(atX){if(disposed)return;motion.feed={t:elapsed,x:clamp(atX??0,-4.5*wide,4.5*wide)};},
    dispose,
  };
  } catch (e) { dispose(); throw e; }
}
