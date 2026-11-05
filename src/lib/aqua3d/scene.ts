import * as T from "three";
import { decorPose, fishArtKey, fishCm, type AquaFish, type AquaState, type PlacedDecor } from "../aquarium.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { starCourse } from "./invertebrates.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { seatDecor } from "./decor-layout.ts";
import { isFishModelApproved } from "./quality.ts";
import { MIN_FRAME_MS, createPacer, ratioFloor } from "./framepace.ts";
import { habitKey, type Course, type Obstacle as CourseObstacle } from "./habits.ts";
import { bankAngle, decorToWorld, floorPose, obstacleFromBox, schoolCourse, schoolsOf, separate, wideScale, worldToDecor, WORLD, clamp,fishLength } from "./world.ts";
import { bodyMeasure, glbUpright } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { makeHabitat, softShadowTexture, HABITAT_THEMES, type Habitat } from "./habitat.ts";
import { DECOR_GLB, FISH_GLB, GlbLibrary, bodyBounds, decorMotion, fishMotion, swapBody } from "./glb.ts";
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null; preview?: PlacedDecor | null };
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
function makeCrown(r:number):T.Group{const g=new T.Group(),m=new T.MeshStandardMaterial({color:0xf5c542,metalness:.7,roughness:.3,emissive:0x5a3d00});g.add(new T.Mesh(new T.CylinderGeometry(r,r*.92,r*.5,16,1,true),m));for(let i=0;i<5;i++){const a=i/5*Math.PI*2,t=new T.Mesh(new T.ConeGeometry(r*.28,r*.7,6),m);t.position.set(Math.cos(a)*r*.9,r*.55,Math.sin(a)*r*.9);g.add(t);}return g;}
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
    habitat?.dispose();
    // 나눠 쓰는 GLB 형상 · 재질은 glb 가 센다(다른 수조 · 미리보기가 곧 다시 쓴다) — 여기선 지우지 않는다
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();if(o.userData.glbShared)return;geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}}});
    geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }

  // ── 아래는 짓는 도중 던질 수 있다 — catch 가 dispose 로 걷는다
  let habitat:Habitat|null=null, habitatTier=0, wide=1, pan=0, schools=new Map<number,{leader:number;slot:number}>();
  let state = initial, elapsed=0, previous=0, lastRaf=0, lastFlush=0, visible=true, active=false, angle=0, pitch=0, sized=false, compiled=false, announced=false;
  try {
  renderer.setPixelRatio(pacer.ratio());
  // 톤 매핑 — ACES 는 노랑을 주황으로 · 파랑을 청록으로 밀고 어두운 쪽을 눌러 2D 원화(물고기 그림)보다 탁했다.
  // Neutral(Khronos PBR Neutral)은 0.8 아래 색을 거의 그대로 두어 그림의 색과 가장 가깝다. 중간 밝기를 ACES ×1.1 과 맞추려고 노출 1.3
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.3;
  canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const camera = new T.PerspectiveCamera(44, 0.8, 0.1, 65);
  // 장면 행렬은 draw 가 한 번만 계산한다 — 렌더러가 또 계산하면 프레임마다 두 번이었다. 수조 · 장식은 놓을 때만 다시 잰다
  scene.matrixAutoUpdate = false; scene.matrixWorldAutoUpdate = false;
  scene.background = new T.Color(0x07191e); scene.fog = new T.Fog(0x063949, 18, 34);
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 1.8); scene.add(hemi);
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
    scene.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o instanceof T.SkinnedMesh)&&!Array.isArray(o.material)&&o!==halo){
      const key=o.geometry.uuid+o.material.uuid;const list=groups.get(key)??[];list.push(o);groups.set(key,list);
    }});
    for(const originals of groups.values())if(originals.length>=3){const mesh=new T.InstancedMesh(originals[0].geometry,originals[0].material,originals.length);mesh.frustumCulled=false;mesh.raycast=()=>{};
      for(const m of originals)m.visible=false;scene.add(mesh);batches.push({mesh,originals,dynamic:originals.some(moves),ready:false});}
  }
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
  const motion = { feed: null as FeedEvent | null, obstacles: [] as Obstacle[], positions: new Float32Array(3), lengths: new Float32Array(1), heading: new Float32Array(3), count: 0,
    /** 겹침 밀기 보정값(x,y,z) · 바닥에 붙어 사는 정도 · 이번 프레임 길 — 물고기 수가 바뀔 때만 다시 잡는다 */
    offsets: new Float32Array(3), pinned: new Float32Array(1), courses: [] as Course[] };
  const fp = { pitch: 0, roll: 0, slope: 0, ground: 0 }, bankQ = new T.Quaternion(), FORWARD = new T.Vector3(1, 0, 0);
  let rolls = new Float32Array(1);
  const heightAt = (x: number, z: number) => habitat?.heightAt(x, z) ?? WORLD.floor;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
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
    waterLitTree(animal.root,false);
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
        inner.rotation.z=glbUpright(f.family,key);applyTweak(inner,f.family,key);
        release(swapBody(m.root,inner,"center"));
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
    motion.obstacles=[...decorations.values()].map(d=>{const b=new T.Box3().setFromObject(d.root);return obstacleFromBox(b.min,b.max);});
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
      const pos=decorToWorld(p.x,p.y,wide);m.root.position.set(pos.x,habitat?.heightAt(pos.x,pos.z)??pos.y,pos.z);m.root.rotation.y=p.rotation===undefined?(p.id%7-3)*.12:pose.rotation*Math.PI/180;m.root.scale.setScalar(pose.scale);
      seatDecor(m.root,(x,z)=>habitat?.heightAt(x,z)??WORLD.floor,4.9*(habitat?.root.scale.x??1));
    }
    if(moved||topologyChanged)refreshObstacles();
    const theme=HABITAT_THEMES[clamp(next.aquarium.tank-1,0,5)];
    const water=new T.Color(theme.water).lerp(new T.Color(0x3d4c37),clamp((60-next.aquarium.water)/100,0,.55));
    if(scene.fog instanceof T.Fog)scene.fog.color.copy(water);
    WATER_LIGHT.aquaRimColor.value.set(theme.top).lerp(water,.3);
    habitat?.setWater(next.aquarium.water);
    if(topologyChanged){batchesDirty=true;
      const n=Math.max(1,swimmers.size);
      const cap=fishShadows.instanceMatrix.count;if(cap<n||cap>Math.max(4,n*2)){fishShadows.removeFromParent();fishShadows.dispose();fishShadows=makeShadows(Math.max(4,n));}
      if(motion.lengths.length<n){motion.positions=new Float32Array(n*3);motion.heading=new Float32Array(n*3);motion.lengths=new Float32Array(n);motion.pinned=new Float32Array(n);rolls=new Float32Array(n);}
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
    const fit=5*wide/(Math.tan(camera.fov*Math.PI/360)*camera.aspect)+3,camD=clamp(fit,19,42),reach=(wide-1)*3,camX=clamp(pan,-reach,reach);
    // 깊이 안개 — 수조는 camD±3 에 있다. 예전 camD+1 ~ +19 는 뒤쪽에도 11% 밖에 안 걸려 깊이가 안 보였다
    if(scene.fog instanceof T.Fog){scene.fog.near=camD-2;scene.fog.far=camD+9;}
    camera.position.set(Math.sin(angle)*camD+camX, .9+pitch*10,Math.cos(angle)*camD);camera.lookAt(camX,-.1,0);camera.updateMatrixWorld();
    WATER_LIGHT.aquaTime.value=elapsed;
    // 1) 이번 프레임 길 — 모두의 자리를 먼저 채운다
    let n=0;motion.feed=motion.feed&&elapsed-motion.feed.t<40?motion.feed:null;
    for(const[id,m]of swimmers){const sc=schools.get(id),hk=habitKey(m.family,m.key);
      // 길 — 장식을 피하고(obstacles) 먹이에 모인다(feed). 무리는 대장 몸으로 길을 계산해야 같은 길을 따라간다
      if(m.family==='starfish'){const s=starCourse(id,elapsed,m.length,wide),c=m.course;c.x=s.x;c.y=s.y;c.z=s.z;c.dx=s.dx;c.dy=s.dy;c.dz=s.dz;c.effort=s.effort;c.turn=0;c.amp=1;c.pulse=0;c.ground=1;c.puff=-1;c.hover=0;}
      else schoolCourse(sc?.leader??id,sc?.slot??0,id,elapsed,m.length,hk,wide,{obstacles:motion.obstacles,feed:motion.feed,leaderLength:swimmers.get(sc?.leader??id)?.length,out:m.course});
      const c=m.course;motion.courses[n]=c;
      motion.positions[n*3]=c.x;motion.positions[n*3+1]=c.y;motion.positions[n*3+2]=c.z;motion.heading[n*3]=c.dx;motion.heading[n*3+1]=c.dy;motion.heading[n*3+2]=c.dz;motion.lengths[n]=m.length;motion.pinned[n]=c.ground;
      m.phase+=dt*c.effort;n++;
    }
    motion.count=n;
    // 물고기끼리 깊이 겹치지 않게 — 보정값이 천천히 따라간다(떨림 없음, world.separate)
    if(motion.offsets.length>=n*3)separate(motion.positions,motion.lengths,motion.offsets,dt,{n,pinned:motion.pinned,scale:wide});
    for(let k=0;k<n;k++){const c=motion.courses[k],o=motion.offsets.length>=n*3?motion.offsets:null;
      const x=c.x+(o?o[k*3]:0),z=c.z+(o?o[k*3+2]:0);let y=c.y+(o?o[k*3+1]:0),dy=c.dy;fp.roll=0;
      // 바닥 물고기 — 머리 · 꼬리 · 양옆의 모래 높이로 앉고 기운다(비탈에서 몸 끝이 묻히지 않게). 쉬는 거북도 ground 동안
      if(c.ground>0){floorPose(heightAt,x,z,c.dx,c.dz,motion.lengths[k],fp);y+=c.ground*(fp.ground-WORLD.floor);dy+=c.ground*fp.slope*Math.hypot(c.dx,c.dz);fp.roll*=c.ground;}
      motion.positions[k*3]=x;motion.positions[k*3+1]=y;motion.positions[k*3+2]=z;motion.heading[k*3+1]=dy;rolls[k]=fp.roll;
    }
    // 2) 자리 · 방향 · 그림자
    let i=0;
    for(const m of swimmers.values()){const x=motion.positions[i*3],y=motion.positions[i*3+1],z=motion.positions[i*3+2];m.root.position.set(x,y,z);
      direction.set(motion.heading[i*3],motion.heading[i*3+1],motion.heading[i*3+2]).normalize();side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      // 새로 들어온 물고기만 바로 맞춘다 — 다른 물고기까지 맞추면 모양이 바뀔 때마다 전부 방향이 튀었다
      // 돌 때 안쪽으로 살짝 기운다(최대 10°) · 바닥 물고기는 비탈만큼 옆으로
      targetQuat.multiply(bankQ.setFromAxisAngle(FORWARD,bankAngle(m.course.turn)+(rolls[i]??0)));
      if(dt===0||m.fresh){m.root.quaternion.copy(targetQuat);m.fresh=false;}else m.root.quaternion.slerp(targetQuat,Math.min(1,dt*2.8));
      m.animate(m.phase,1,m.course);
      if(i<fishShadows.instanceMatrix.count){const floorY=habitat?.heightAt(x,z)??WORLD.floor,h=Math.max(0,y-floorY),s=m.length*(.75+h*.06);
        shadowDummy.position.set(x,floorY+.02,z);shadowDummy.rotation.set(0,Math.atan2(-direction.z,direction.x),0);shadowDummy.scale.set(s,1,s*.5);shadowDummy.updateMatrix();fishShadows.setMatrixAt(i,shadowDummy.matrix);
        fishShadows.setColorAt(i,shadowTint.setRGB(0,clamp(1-h*.1,.15,1),0));}
      i++;
    }
    fishShadows.count=Math.min(i,fishShadows.instanceMatrix.count);fishShadows.instanceMatrix.needsUpdate=true;if(fishShadows.instanceColor)fishShadows.instanceColor.needsUpdate=true;
    for(const d of decorations.values())d.animate(elapsed);
    habitat?.animate(elapsed);
    const selected=state.editing?decorations.get(state.preview?.id??state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected;if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=(habitat?.heightAt(halo.position.x,halo.position.z)??WORLD.floor)+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar((selected as Swimmer).length*.65);}}
    scene.updateMatrixWorld();
    for(const b of batches){if(!b.dynamic&&b.ready)continue;b.ready=true;for(let k=0;k<b.originals.length;k++)b.mesh.setMatrixAt(k,b.originals[k].matrixWorld);b.mesh.instanceMatrix.needsUpdate=true;}
    renderer.render(scene,camera);
    if(!announced){announced=true;events.ready?.();}
    if(process.env.NODE_ENV!=="production"){
      host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.fish=String(swimmers.size);host.dataset.decor=String(decorations.size);
      host.dataset.time=elapsed.toFixed(2);host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.textures=String(renderer.info.memory.textures);
    }
  }
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
  let start:{x:number;y:number;angle:number;pitch:number;pan:number}|null=null;
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,angle,pitch,pan};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start)return;angle=clamp(start.angle+(e.clientX-start.x)*.003,-.4,.4);pan=clamp(start.pan-(e.clientX-start.x)*.02,-(wide-1)*3,(wide-1)*3);pitch=clamp(start.pitch+(e.clientY-start.y)*.001,-.10,.13);if(!active)draw(0);};
  const cancel=()=>{start=null;};
  const end=(e:PointerEvent)=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(moved>8)return;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
    if(state.editing&&state.placing){const floorHit=habitat?ray.intersectObject(habitat.floor)[0]:null;const point=floorHit?.point??ray.ray.intersectPlane(floorPlane,hitPoint);if(point){const p=worldToDecor(point.x,point.z,wide);events.place(p.x,p.y);}return;}
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
