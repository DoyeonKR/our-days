import { ATTACK_PITCH, blockedBy, clearShot, type Blocker, type ShotPick, huntOf, huntPass, huntPlan, huntShot, mealEndEvent, mouthReach, mealPose, mealReady, replayHunter, replayShot, tailBeat, TEETH_CODE, TEMP_HUNTER_ID, tempHunterGone, type HuntStyle } from "./hunt.ts";
import { isPredator } from "../predation.ts";
import { SIDE_HOLD, SIDE_HOLD_OF, SIDE_SWITCH_OF, SIDE_SWITCH_S, faceSide, limitPitch, sideOnOf } from "./sideon.ts";
import * as T from "three";
import { decorPose, fishArtKey, fishCm, fishMorph, type AquaFish, type AquaNews, type AquaState, type PlacedDecor } from "../aquarium.ts";
import type { Morph } from "../aquamorph.ts";
import { morphMaterials } from "./morphlook.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { makeSandPuffs } from "./sandpuff.ts";
import { planTrick, trickOf, trickSlow, type TrickPlan } from "./breach.ts";
import { makeSplash } from "./splash.ts";
import { bossLookOf } from "./bosslook.ts";
import { turtleGlbMotion } from "./turtle.ts";
import { startleDir, startleDuration, startleKind, startlePose, type StartleKind, type StartlePose } from "./startle.ts";
import { addJaw, type Jaw, calmSpecular, fishShading, makePost, repairNormals, underwaterEnvironment, type Post } from "./post.ts";
import { makeGiants, type Giants } from "./giants.ts";
import { DOME_TIER, TUNNEL_R, TUNNEL_TIER, WHALE_TIER, makeTunnel, tankDeep, tunnelObstacles, tunnelSpan, type Tunnel } from "./tunnel.ts";
import { tankAxes } from "./tiers.ts";
import { DOME_R, domeObstacles, makeDome, type Dome } from "./dome.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { seatDecor } from "./decor-layout.ts";
import { isFishModelApproved } from "./quality.ts";
import { MIN_FRAME_MS, RENDER_RATIO_MAX, createPacer, ratioFloor } from "./framepace.ts";
import { type Course, type Hall, type Obstacle as CourseObstacle } from "./habits.ts";
import { resolveContacts } from "./world.ts";
import { bankAngle, decorToWorld, hallFrom, obstacleFromBox, schoolsOf, tallY, tankDisplay, tankTall, wideScale, deepScale, sinkScale, worldToDecor, WORLD, clamp,fishLength,realLength,sizeUnitFor,sizeUnit,setSizeUnit } from "./world.ts";
import { bodyMeasure, glbUpright } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { makeHabitat, rockObstacles, softShadowTexture, habitatScenery, HABITAT_THEMES, type Habitat } from "./habitat.ts";
import { DECOR_GLB, FISH_GLB, GlbLibrary, bodyBounds, decorMotion, fishMotion, swapBody } from "./glb.ts";
import {disposeFishFace,faceMouth} from './faces.ts';
import {mealSurface} from './meal-surface.ts';
import {mealGrip as makeMealGrip} from './meal-grip.ts';
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";
import {modelTextureQuality} from './color-quality.ts';
import { FOOD_LIFE, makeFood } from "./food.ts";
import { makeMotes, type Motes } from "./murk.ts";
import { decorTints, makeDecorGlow, makeSurfaceFx, type DecorGlow, type SeasonLayer, type SurfaceFx } from "./seasonfx.ts";
import { bubbleStream, type BubbleStream } from "./bubbles.ts";
import { eventDef, swimPaceAt, visitWeight, visitWindow, visitorFor, VISIT_MIN_S, type AquaEventKey } from "../aquaevent.ts";
import { AQUA_LIGHT_BASE, aquaLightOf } from "../aqualight.ts";
import { captureRatio, clampPhotoCam, photoDistance, photoGrade, pinchZoom, type PhotoCam, type PhotoView } from "./photo.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null; preview?: PlacedDecor | null;
  /** 이 기기에서 이미 본 사냥 장면의 소식 번호 — 화면이 기억해 넘긴다(장면은 저장소를 안 만진다) */ mealSeen?: number;
  /** 안에서 보기 — 10단계 터널 · 11단계 돔만. 꾸미는 동안은 밖에서 본다 */ tunnel?: boolean;
  /** 해변 보기(2026-11-18) — 모래사장 쪽으로 다가가 수면 위에서 내려다본다(밖에서 볼 때만) */ beach?: boolean;
  /** 수조 전체 보기(2026-11-21 — 기본) — 수조 가로 · 높이가 화면에 다 들어오는 거리. false 면 예전 '가까이 보기'(가로 일부 + 천천히 흘러가며 둘러보기) */ overview?: boolean;
  /** 계절 수조 행사(2026-11-13, lib/aquaevent) — 지금 열린 행사 · 한정 장식 빛깔(놓인 장식 id → 행사). 그림만 바뀐다 */
  season?: { keys: readonly AquaEventKey[]; tints: Readonly<Record<number, AquaEventKey>>;
    /** 게임 시각(ms, 서버에 맞춘 지금 — islandsync.gameNow) — 계절 헤엄 빠르기 · 손님 물고기 시간표가 본다. 없으면 기기 시계 */ clock?: () => number;
    /** 손님 물고기 시간표의 씨앗 — 두 사람이 같은 값(커플 id). 없으면 날짜 · 시각만 */ seed?: string };
  /** 수조 조명(2026-11-18, lib/aqualight) — 켠 조명 key. 없으면 기본 빛. 빛 색 · 세기만 바뀐다 */
  light?: string | null };
/** lost · restored · ready 가 없으면 예전처럼 error 로 알린다 */
export type TankEvents = { fish: (id: number) => void; decor: (id: number) => void; place: (x: number, y: number) => void; error: (message: string) => void;
  /** WebGL 연결이 끊겼다 — 화면이 다시 보이면 새로 열어 본다(Aquarium3D) */
  lost?: () => void; restored?: () => void;
  /** 첫 장면을 그렸다 */
  ready?: () => void;
  /** 전체 보기에서 수조가 화면에 차지하는 모양(가로 ÷ 세로, 2026-11-21) — 화면이 수조 칸 높이를 맞춰 위아래 빈 곳을 줄인다. 바뀔 때만 */
  shape?: (ratio: number) => void;
  /** 사냥 장면을 다시 그리기 시작했다 — 그 소식 번호(화면이 이 기기에 기억한다) */
  meal?: (n: number) => void;
  /** 사진 모드에서 끌기 · 집기로 카메라가 바뀌었다(2026-11-13) — 화면이 확대 막대 · 이름표를 맞춘다 */
  photoCam?: (cam: PhotoCam) => void };
/** 먹이 — 언제(수조 시계, 초) 어디(가로 x)에 줬나 */
export type FeedEvent = { t: number; x: number };
/** 물고기가 비켜 가야 할 장식 — 바닥의 원(가로 x · 깊이 z · 반지름) + 높이(낮은 장식은 넘어간다) */
export type Obstacle = CourseObstacle;
export type TankHandle = { update: (next: TankView) => void; feed: (atX?: number) => void; replay: (n: number) => "ok" | "busy" | "missing" | "reduced" | "skipped";
  /** 다시 보기를 그만 본다 — 멈춘 것이 있으면 true(실제 사냥 장면은 안 멈춘다) */ stopReplay: () => boolean; dispose: () => void;
  /** 사진 모드(2026-11-13) — 수조 시계를 세우고(물고기 · 장면이 그 자리에 멈춘다) 끌기 · 집기가 카메라만 움직인다. 사냥 장면 중이면 busy */
  photoStart: () => "ok" | "busy" | "skipped";
  /** 사진 모드를 끝낸다 — 들어올 때의 카메라(돌린 각 · 기울기 · 옆 이동 · 돔 둘러보기)로 되돌리고 필터를 끄고 시계를 다시 돌린다 */
  photoEnd: () => void;
  /** 사진 카메라를 바꾸고(범위 안으로) 지금 값을 돌려준다. 인자 없으면 읽기만 */
  photoCamera: (next?: Partial<PhotoCam>) => PhotoCam;
  /** 사진 필터(photo.ts PHOTO_FILTERS id) */
  photoFilter: (id: string) => void;
  /** 화면에 보이는 물고기 자리(캔버스 0~1 · 가까울수록 작은 depth) — 이름표 자리를 잡는다. 임시 사냥꾼 · 유령은 뺀다 */
  photoPoints: () => { id: number; x: number; y: number; depth: number }[];
  /** 지금 장면을 캔버스의 최대 2배로 한 장 그려 2D 캔버스로 돌려준다(그리자마자 같은 일 안에서 옮긴다 — preserveDrawingBuffer 없이). 못 찍으면 null */
  photoCapture: () => HTMLCanvasElement | null };

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
type Swimmer = AnimalModel & { key: string; family: string; length: number; /** 그려지는 몸길이(실제 비율 — realLength). length 는 헤엄 길용(둘 중 큰 쪽) */ shown?: number; /** 고래상어가 플랑크톤을 먹는 입(feedWhaleShark) · 다음 알갱이 때 */ feedJaw?: Jaw; feedNext?: number; phase: number; scale: number;
  /** 행사 손님 물고기(2026-11-18) — 있으면 저장에 없는 잠깐 손님(fishstep.StepFish.visit) */ visit?: { w: number; dw: number };
  /** 색 변이(2026-11-13, morphlook) — 바뀌면 같은 자리에서 갈아 끼운다 */ morph?: Morph | null;
  /** 놀라 부푼 채인가(복어 — 끝나면 원래 크기로 한 번 되돌린다) */ puffed?: boolean;
  /** 산호 여왕(등 위 산호) — 왕관을 작게 머리 쪽에 */ coralQueen?: boolean;
  /** 쥐고 있는 GLB 의 종류(주인 모델은 boss) */ glbKind?: "fish" | "boss";
  /** 제작 모델로 갈아 끼웠나 */ glb: boolean; /** 쥐고 있는 GLB key(놓을 때 돌려준다) */ glbKey: string | null;
  /** 방금 들어왔다 — 첫 프레임은 방향을 바로 맞춘다(다른 물고기는 부드럽게 돈다) */ fresh: boolean; crown: T.Group | null;
  /** 이번 프레임 길 — 매 프레임 새 객체를 안 만들게 물고기마다 하나 들고 쓴다 */ course: Course;
  /** 자라서 갈아 끼운 몸(2026-11-12) — 새 몸(GLB)이 올 때까지 옛 몸(old)을 보이고, 그 뒤 1초에 걸쳐 옛 크기(from = 옛 길이 ÷ 새 길이)에서 키운다 */
  grow?: { old: Swimmer | null; from: number; k: number; wait: number };
  /** 제작 모델을 못 받았다(임시 모델 그대로) — 자란 물고기는 더 기다리지 않고 새 몸을 보인다 */ glbFail?: boolean;
 };
/** 자란 물고기의 크기 · 자리를 잇는 시간(초) · 새 몸을 기다리는 상한(초, 수조 시계) */
const GROW_S = 1, GROW_WAIT = 8, HANDOFF_S = 1;
/** 고른 몸을 가리는 장식의 불투명도 · 모래사장 쉼터를 앞유리 쪽으로 미는 몫(앞뒤 반폭 대비) — 2026-11-17 */
export const OCCLUDE_ALPHA = 0.22, BEACH_REST_FRONT = -0.5, ABOVE_ELEV = 0.42, BEACH_OVER_EL = 0.4;
/** 해변 보기의 내려다보는 각(rad) — 수면 위 모래사장을 위에서 비스듬히 본다 */
export const BEACH_VIEW_ELEV = 0.5, BEACH_VIEW_YAW = 0.5;
/** 지금 보이는 몸길이 — 자라는 동안은 옛 몸 · 키우는 중의 크기(그림자 · 고른 표시 · 따라가기 거리가 한 프레임에 뛰지 않게) */
const shownLength = (m: Swimmer) => { const g = m.grow, v = g?.old ?? m, L = v.shown ?? v.length; return g ? L * (v.root.scale.x / Math.max(1e-6, v.scale)) : L; };
type Decoration = DecorModel & { key: string; glb: boolean; glbKey: string | null; pose: string; /** 한정 장식 빛깔(seasonfx) */ tint: AquaEventKey | null };

/** 안에서 보기 첫 장면(2026-11-11) — 폰(세로 화면)에서 돔에 들어서면 첫 장의 아래 3분의 2 가 수조 둘레의 키 큰 수초(높이 1.5배로 늘어 6 넘게 자란다) · 바위였고
 *  물고기는 위쪽 끝에 작게 걸렸다. 10 · 11단계는 높이 1.5배라 물고기 대부분이 눈높이보다 5~8 위(올려다보는 각 40~60°)에 있다.
 *  돔: 눈 바닥 +1.7 → +1.9(더 올리면 꼭대기 뼈대가 눈앞을 굵게 가린다) · 올려다보는 각 29° → 47° · 시야 72° → 58° — 화면 아래 끝이 수평선 위 18° 라 수초 끝만 걸리고 물고기가 가운데.
 *  터널: 올려다보는 각 33° → 49°(아래 절반이 터널 바닥 · 갈비뼈였다). 실측: 375×520 · DPR 3 헤드리스 크롬 캡처로 0 · 4 · 12초 비교 */
const DOME_EYE = 1.9, DOME_UP = .82, DOME_FOV = 58, TUNNEL_UP = .58;
/** 아래로 끌기 배율 — 기본 각을 올린 만큼 아래로 더 돌게 해서, 끝까지 내리면 예전 바닥(돔 10° · 터널 15° — 터널을 따라 앞을 보는 각)에 닿는다. 위로는 그대로 3.2 */
const DOME_DOWN = 6.4, TUNNEL_DOWN = 3.2;
const ERROR_GPU = "이 기기에서 3D 그래픽을 처리하지 못했어요. 하드웨어 가속 설정을 확인한 뒤 다시 시도해 주세요.";
const ERROR_LOST = "3D 그래픽 연결이 끊어졌어요. 다시 열어 주세요.";
/** 한 마리 · 장식 하나가 못 지어져도 수조 전체를 멈추지 않는다 — 개발 중엔 콘솔에 남긴다 */
const skip = (what: string, e: unknown) => { if (process.env.NODE_ENV !== "production") console.warn(`[aqua3d] ${what} 건너뜀`, e); };

/** Three/WebGL2 is loaded only for the open tank. Local textures, no image billboards or state writes.
 *  2026-11-05 — 짓다가 던지면(모르는 장식 key 등) 붙여 둔 캔버스 · 관찰자 · 리스너 · WebGL 연결을 전부 걷고 다시 던진다.
 *  예전엔 그대로 남아 '다시 시도'를 누를 때마다 캔버스가 하나씩 쌓였다. */
export function createTank(host: HTMLDivElement, initial: TankView, events: TankEvents): TankHandle {
  // 캔버스엔 멀티샘플 · 깊이 · 스텐실을 안 받는다(2026-11-11) — 장면은 후처리 그림(post.ts)에 그리고 캔버스엔 깊이를 안 쓰는 네모 하나만 옮긴다.
  //   antialias 를 켜 두면 쓰지도 않는 4배 색 · 깊이 버퍼를 잡았다(캔버스 562×780 에서 계산 약 15.8MB → 색 1.8MB)
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
  const dpr = window.devicePixelRatio || 1;
  // 해상도 바닥은 기기 배율을 따른다(DPR 2 이상은 CSS 픽셀 1:1) — framepace.ts
  const pacer = createPacer(Math.min(dpr, RENDER_RATIO_MAX), ratioFloor(dpr));
  const canvas = renderer.domElement;
  let disposed = false, lost = false, frame = 0, swapFrame = 0;
  /** 닫힐 때 진행 중인 사냥 장면이 있으면 끝났다고 알린다(장면 변수가 아래 try 안에 있어 거기서 채운다) */
  let closingNotice: (() => void) | null = null;
  let observer: ResizeObserver | null = null, intersection: IntersectionObserver | null = null;
  const unbind: (() => void)[] = [];
  const mealSurfaces=new Map<T.Object3D,ReturnType<typeof mealSurface>>();
  const armGrips=new Map<T.Object3D,ReturnType<typeof makeMealGrip>>();
  const on = (target: HTMLElement | Document | MediaQueryList, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts); unbind.push(() => target.removeEventListener(type, fn as EventListener));
  };
  const scene = new T.Scene(), kit = new ModelKit(), glb = new GlbLibrary();

  function dispose(){
    for(const surface of mealSurfaces.values())surface.dispose();mealSurfaces.clear();armGrips.clear();
    disposeFishFace(scene);
    if(disposed)return;
    // 장면 도중에 닫힌다(탭을 옮김 · 연결이 끊겨 새로 엶) — 끝났다고 알린다(화면이 카드 · 다시 보기를 기다리며 묶이지 않게). 짓다 던져 장면 변수가 아직 없으면 넘어간다
    closingNotice?.();
    disposed=true;active=false;cancelAnimationFrame(frame);cancelAnimationFrame(swapFrame);window.clearTimeout(foodTimer);glb.dispose();
    // 물 맑기는 모든 재질이 보는 값 하나 — 미리보기(decor-preview)가 탁한 채로 남지 않게 되돌린다
    WATER_LIGHT.aquaClarity.value=1;if(observer)observer.disconnect();intersection?.disconnect();
    for(const off of unbind.splice(0))off();
    post?.dispose();envMap?.dispose();habitat?.dispose();tunnel?.dispose();dome?.dispose();giants?.dispose();
    // 나눠 쓰는 GLB 형상 · 재질은 glb 가 센다(다른 수조 · 미리보기가 곧 다시 쓴다) — 여기선 지우지 않는다
    // ⚠ 단, 이 렌더러가 그것들에 단 dispose 리스너(three 내부 — 형상 · 재질 · 텍스처마다 렌더러의 닫힌 함수)는 renderer.dispose 가 안 뗀다.
    //   캐시가 들고 있는 형상이 닫은 렌더러를 끝까지 붙잡아(수조를 오갈 때마다 하나씩) WebGL 상태 · 프로그램이 통째로 남았다(2026-11-11).
    //   dispose 이벤트만 쏴서 리스너가 스스로 떨어지게 한다 — 이벤트일 뿐 캐시의 그림 · 형상은 그대로고, 다른 살아 있는 렌더러(미리보기)는 다음에 쓸 때 다시 올린다
    scene.traverse(collectBorrowed);for(const r of borrowed)r.dispose();borrowed.clear();morphs.dispose();tintReg.dispose();
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();if(o.userData.glbShared)return;geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}}});
    geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }

  // ── 아래는 짓는 도중 던질 수 있다 — catch 가 dispose 로 걷는다
  let post:Post|null=null,envMap:T.Texture|null=null,normalsFixed=0,postLevel=0;
  /** 이 수조가 쓴 나눠 쓰는 GLB 형상 · 재질 · 텍스처 — 닫을 때 이 렌더러의 dispose 리스너를 떼려고 모은다(dispose 참고) */
  const borrowed=new Set<T.BufferGeometry|T.Material|T.Texture>();
  /** 색 변이 재질 — (원본 재질, 변이)마다 하나를 같은 모습 · 같은 변이 물고기끼리 나눠 쓴다. 떼어 낼 때(release) 지우지 않고 닫을 때 한 번에 */
  const morphs=morphMaterials();
  /** 계절 행사 한정 장식 빛깔 — 같은 방식(재질 복제를 장식끼리 나눠 쓴다 · 닫을 때 한 번에) */
  const tintReg=decorTints();
  const collectBorrowed=(o:T.Object3D)=>{const mesh=o as T.Mesh;if(!mesh.isMesh||!o.userData.glbShared)return;borrowed.add(mesh.geometry);
    for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){borrowed.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)borrowed.add(v);}};
  let tunnel:Tunnel|null=null,inTunnel=false,deep=1,deepTier=1,giants:Giants|null=null,dome:Dome|null=null,inDome=false,domeYaw=0;
  let start:{x:number;y:number;angle:number;pitch:number;pan:number;yaw:number}|null=null;
  // 두 손가락 · 휠 당기기 배율 — 0.45 배까지 다가가고 1.5 배까지 물러난다
  const ZOOM_MIN=.45,ZOOM_MAX=1.5;let userZoom=1;
  const XRAY_LAYER=3,XRAY_SKIP=/^(moray|octopus|squid|giant_squid|kraken|jellyfish)$/;
  let shapeSent=0, overK=1, habitat:Habitat|null=null, habitatTier=0, habitatSink=0, wide=1, wideBase=1, tierX=1, tall=1, pan=0, panReach=0, panPerPx=.02, lastTouch=-99, schools=new Map<number,{leader:number;slot:number}>();
  /** 먹이를 한 장면으로 그린 뒤 거두는 타이머(움직임 줄이기) · 물 속 부유물(murk.ts — 수조 크기가 바뀌면 새로) */
  let foodTimer=0,motes:Motes|null=null;
  /** 계절 수조 행사(seasonfx.ts) — 물 위 그림 한 묶음 · 여름 거품 · 명절 장식 빛. 행사 · 수조 크기가 바뀌면 새로 */
  let seasonLayer:SeasonLayer|null=null,heat:BubbleStream|null=null,heatKey="",glow:DecorGlow|null=null,glowKey="";const ICE=new T.Color(0xdff3ff);
  /** 사진 모드(2026-11-13) — 켜져 있으면 시계가 서고(schedule) 끌기가 사진 카메라를 움직인다. 들어올 때의 카메라를 기억해 끝낼 때 그대로 돌려놓는다 */
  let photoOn=false,photoZoom=1,photoSaved:{angle:number;pitch:number;pan:number;yaw:number}|null=null;
  /** 물고기 시계(2026-11-18) — 계절 헤엄 빠르기(pace)만큼 흐른다. paceDev 는 개발 확인용 덮어쓰기(0 이면 날짜대로) */
  let fishT=0,pace=1,paceAt=-1,paceDev=0;const feedShift:FeedEvent={t:0,x:0};
  let state = initial, elapsed=0, previous=0, lastRaf=0, lastFlush=0, visible=true, active=false, angle=0, pitch=0, sized=false, compiled=false, announced=false;
  try {
  renderer.setPixelRatio(pacer.ratio());
  renderer.localClippingEnabled=true;
  // 톤 매핑 — ACES 는 노랑을 주황으로 · 파랑을 청록으로 밀고 어두운 쪽을 눌러 2D 원화(물고기 그림)보다 탁했다.
  // Neutral(Khronos PBR Neutral)은 0.8 아래 색을 거의 그대로 두어 그림의 색과 가장 가깝다. 중간 밝기를 ACES ×1.1 과 맞추려고 노출 1.3
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.3;
  canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const camera = new T.PerspectiveCamera(44, 0.8, 0.1, 110);
  // 장면 행렬은 draw 가 한 번만 계산한다 — 렌더러가 또 계산하면 프레임마다 두 번이었다. 수조 · 장식은 놓을 때만 다시 잰다
  scene.matrixAutoUpdate = false; scene.matrixWorldAutoUpdate = false;
  scene.background = new T.Color(0x07191e); scene.fog = new T.Fog(0x063949, 18, 34);
  // 물속 환경광 — 비늘 · 바위 · 금속 · 유리에 물빛이 비친다(post.ts). 그만큼 하늘빛 조명은 줄였다
  // 반정밀 그림을 못 그리는 기기는 null(환경광 없이 조명만)
  envMap = underwaterEnvironment(renderer); scene.environment = envMap; scene.environmentIntensity = .55;
  // 개발 진단 — 그리기 호출은 장면 + 후처리를 한 프레임으로 센다(자동 초기화면 마지막 render 인 후처리 네모 1 만 남았다)
  renderer.info.autoReset = false;
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 1.35); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe3ad, 2.3); sun.position.set(-4,9,6); scene.add(sun);
  const fill = new T.PointLight(0x5ec8df, 20, 24, 2); fill.position.set(3,2,-1); scene.add(fill);
  // 수조 조명(lib/aqualight) — 세 빛의 색을 갈고 세기 배율(lightK)을 applyWater 가 곱한다. 같은 key 면 다시 안 건드린다
  // 빛만 바꾸면 물빛 그림(배경 · 환경광)에 묻혀 거의 안 보였다 — 마지막 그리기에서 장면 색에 그 조명 빛깔(tint)을 곱한다
  let lightKey:string|null|undefined, lightK:readonly [number,number,number]=[1,1,1], lightTint:readonly [number,number,number]=[1,1,1];
  function applyLight(key:string|null){
    if(key===lightKey)return;lightKey=key;const L=aquaLightOf(key);
    hemi.color.setHex(L?.sky??AQUA_LIGHT_BASE.sky);hemi.groundColor.setHex(L?.ground??AQUA_LIGHT_BASE.ground);
    sun.color.setHex(L?.sun??AQUA_LIGHT_BASE.sun);fill.color.setHex(L?.fill??AQUA_LIGHT_BASE.fill);
    lightK=L?.k??[1,1,1];lightTint=L?.tint??[1,1,1];fill.intensity=20*lightK[2];
  }
  const swimmers = new Map<number,Swimmer>(), decorations = new Map<number,Decoration>();
  // 고른 물고기를 가리는 장식 흐리게(2026-11-17 [사용자: "포유류는 물 위에서 생활하는데 너무 잘 보이지가 않아 선택을해도 주변 조형물에 가려져"]) —
  //   카메라 → 고른 몸 사이 선분이 장식의 경계 구를 지나면 그 장식만 재질을 복제해 반투명(OCCLUDE_ALPHA)으로, 비키면 천천히 되돌린 뒤 원래 재질로
  let aboveK=0,beachK=0;
  const fadeSeg=new T.Vector3(),fadeTo=new T.Vector3(),fadeC=new T.Vector3(),fadeBox=new T.Box3(),fadeSphere=new T.Sphere();
  // 장식의 경계 구 — 장식은 거의 안 움직이니 자리 · 크기가 그대로면 지난 값을 쓴다(2026-11-23 — 물고기를 따라가는 동안 매 프레임 장식마다 Box3.setFromObject 를 돌았다)
  //   묶음(batch)에 들어간 부품도 같은 상자를 쓴다. 결과는 fadeSphere 에
  function decorSphere(root:T.Object3D){
    root.updateWorldMatrix(true,false);
    const ud=root.userData as {fadeSph?:T.Sphere;fadeAt?:Float32Array},e=root.matrixWorld.elements;let at=ud.fadeAt,same=!!(ud.fadeSph&&at);
    if(same)for(let i=0;i<16;i++)if(at![i]!==Math.fround(e[i])){same=false;break;}
    if(!same){fadeBox.setFromObject(root);ud.fadeSph=fadeBox.getBoundingSphere(ud.fadeSph??new T.Sphere());at=ud.fadeAt??new Float32Array(16);for(let i=0;i<16;i++)at[i]=e[i];ud.fadeAt=at;}
    fadeSphere.copy(ud.fadeSph!);
  }
  function fadeOccluders(target:Swimmer|undefined,dt:number){
    if(target){fadeTo.copy(target.root.position);fadeSeg.copy(fadeTo).sub(camera.position);}
    const len2=fadeSeg.lengthSq();
    for(const d of decorations.values()){
      let want=1;
      if(target&&len2>1e-6){decorSphere(d.root);fadeC.copy(fadeSphere.center).sub(camera.position);const t=clamp(fadeC.dot(fadeSeg)/len2,0,1);if(t>.02&&t<.98){fadeC.copy(camera.position).addScaledVector(fadeSeg,t);if(fadeC.distanceTo(fadeSphere.center)<fadeSphere.radius*.85+target.length*.3)want=OCCLUDE_ALPHA;}}
      const now=(d.root.userData.fade as number|undefined)??1;if(want===1&&now>=.999)continue;
      const next=dt>0?now+(want-now)*Math.min(1,dt*4):want;d.root.userData.fade=next;
      d.root.traverse(o=>{if(!(o instanceof T.Mesh))return;const ud=o.userData;
        if(next>=.995){if(ud.fadeOrig){(o.material as T.Material|T.Material[])=ud.fadeOrig;const c=ud.fadeMat as T.Material[]|undefined;c?.forEach(m=>m.dispose());delete ud.fadeOrig;delete ud.fadeMat;batchesDirty=true;}return;}
        if(!ud.fadeOrig){batchesDirty=true;ud.fadeOrig=o.material;const list=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.transparent=true;c.depthWrite=false;return c;});ud.fadeMat=list;o.material=Array.isArray(o.material)?list:list[0];}
        for(const m of ud.fadeMat as T.Material[])m.opacity=next;});
      if(next>=.995)delete d.root.userData.fade;
    }
  }
  // 제작 모델이 피부 그림을 대신한다 — 곧 갈아 끼울 물고기엔 그림을 받지 않는다(models.ts)
  kit.skinless = FISH_GLB;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Batch repeated eyes, leaves, stems and masonry without losing their original joint hierarchy.
  // Original mesh nodes remain for accurate ray picking; only the batch is drawn.
  const batches: { mesh: T.InstancedMesh; originals: T.Mesh[]; dynamic: boolean; ready: boolean }[] = [];
  let batchesDirty = true;
  let xrayLastSec = -1;
  // 물고기 몸 · 흔들리는 장식 부품 밑이 아니면 안 움직인다 — 위치를 매 프레임 GPU 로 다시 올리지 않는다.
  // ⚠ 예전엔 장식 밑이면 전부 '움직인다'로 쳐서 장식 묶음이 매 프레임 다시 올라갔다
  const moves=(o:T.Object3D)=>{for(let p:T.Object3D|null=o;p;p=p.parent)if(p.userData.type==="fish"||p.userData.moving)return true;return false;};
  function rebuildBatches(){
    for(const b of batches){for(const m of b.originals)m.visible=true;b.mesh.removeFromParent();b.mesh.dispose();}batches.length=0;
    const groups=new Map<string,T.Mesh[]>();
    // 셰이더 재질은 묶지 않는다 — instanceMatrix 를 안 읽어서 묶으면 전부 원점에 겹쳐 그려진다(2026-11-10 빛줄기가 수조 가운데 흰 네모가 됐다)
    // 보이는 것만 묶는다 — 자라는 물고기의 숨긴 새 몸(addFish 의 prev)까지 묶으면 묶음이 그 눈 · 지느러미를 그대로 그렸다
    scene.traverseVisible(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o instanceof T.SkinnedMesh)&&!Array.isArray(o.material)&&!(o.material instanceof T.ShaderMaterial)&&o!==halo){
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
  const motion = { shore: undefined as ((y: number) => number) | undefined, beach: undefined as Obstacle | undefined, feed: null as FeedEvent | null, obstacles: [] as Obstacle[], hall: null as Hall | null, positions: new Float32Array(3), lengths: new Float32Array(1), heading: new Float32Array(3), count: 0, rolls: new Float32Array(1),
    /** 겹침 밀기 보정값(x,y,z) · 바닥에 붙어 사는 정도 · 이번 프레임 길 — 물고기 수가 바뀔 때만 다시 잡는다 */
    offsets: new Float32Array(3), pinned: new Float32Array(1), courses: [] as Course[],
    /** 쫓고 달아나기 보정(hunt.ts) · 사냥꾼 표시 — 물고기 순서와 같다 */ flee: new Float32Array(3), preds: new Uint8Array(1),
    /** 겁(먹잇감 0~1) · 살금살금(사냥꾼 0~−1) — 꼬리 치는 박자에 */ fear: new Float32Array(1),
    /** 사냥 장면의 둘(hunt.ts 의 huntPass 가 건너뛴다) */ busy: new Uint8Array(1) };
  /** 사냥 장면(2026-11-11) — 소식의 ate 를 보고 다시 그린다. 먹힌 물고기는 저장에서 이미 빠졌으므로 잠깐 '유령'으로 되살린다(id 는 음수 = 소식 번호) */
  let meal:{n:number;kind:"real"|"replay"|"dev";predId:number;ghostId:number;t0:number;bx:number;by:number;bz:number;bitesDone:number;mx:number;my:number;mz:number;bursts:Burst[];tint:T.Color|null;jaw:Jaw|null;wrap:boolean;style:HuntStyle;lx:number;ly:number;lz:number;ly0:number;wait:number;sucked:boolean;camPick:ShotPick|null;pov:boolean}|null=null;
  /** 사냥 카메라(hunt.ts 의 huntShot) — 카메라 각을 장면 쪽으로 옮긴 정도 · 그 각 */
  let mealK=0,mealAng=0,mealElev=0;const mealFwd=new T.Vector3(),mealBlockers:Blocker[]=[];
  /** 고른 물고기 따라가기의 가리지 않는 자리(2026-11-12) · 그때 사용자가 끈 각 — 끌면 다시 고른다 */
  let followPick:ShotPick|null=null,followBase=0;const huntScare={x:0,y:0,z:0,r:0};
  /** 시선을 가리는 것 — 물고기(skip 은 빼고, 장면의 둘도 빼고)는 구, 장식 · 바위는 기둥. 프레임마다 같은 객체를 다시 쓴다 */
  function fillBlockers(skip:Swimmer|undefined){let n=0;const put=(x:number,y:number,z:number,r:number,top?:number)=>{const b=mealBlockers[n]??(mealBlockers[n]={x:0,y:0,z:0,r:0});b.x=x;b.y=y;b.z=z;b.r=r;b.top=top;n++;};
    let j=0;for(const m of swimmers.values()){if(j<motion.count&&m!==skip&&!motion.busy[j])put(motion.positions[j*3],motion.positions[j*3+1],motion.positions[j*3+2],Math.max(.15,motion.lengths[j]*.5));j++;}
    for(const o of motion.obstacles)if(o.kind!=="hall")put(o.x,WORLD.floor-1,o.z*deep,o.r,WORLD.floor+o.h*tall);
    mealBlockers.length=n;}
  /** 종마다 턱 모양(hunt.ts 의 HUNT) */
  const jawFor=(family:string)=>{const j=huntOf(family).jaw;return{teeth:TEETH_CODE[j.teeth],density:j.density,height:j.height,open:j.open,hinge:j.hinge};};
  /** 두족류(문어 · 오징어 · 크라켄)는 턱이 없다 — 팔로 감싸 몸 밑으로 끌어안고 조인다(머리에 턱을 열면 팔이 찢어진 것처럼 보였다) */
  /** 물빛 붉게(피가 퍼진 정도 0~1, 천천히 가신다) · 화면 흔들림(뜯은 때) · 남은 뼈 */
  let bloodLevel=0,shakeAt=-9;const fogBase=new T.Color(0x063949),BLOOD_FOG=new T.Color(0x4a0710);
  /** 물 맑기(2026-11-12) — 물 0 과 100 이 거의 같아 보였다(안개 색만 (60−물)/100 × .55 로 조금 탁해졌다). 보여 주는 물 값(waterShown)이 목표(waterGoal)를 따라가서
   *  물을 갈면 2~3초에 걸쳐 맑아진다(예전엔 한 프레임에 바뀌었다). 더러워지는 쪽은 바로 — 물은 몇 시간에 걸쳐 조금씩 더러워진다. murkK = 탁함 0~1(물 60 아래에서만) */
  let waterGoal=-1,waterShown=-1,waterHab=-1,murkK=0;const waterTheme=new T.Color(),waterTopC=new T.Color(),ALGAE=new T.Color(0x3d4c37);
  // No instant generic skeleton: the intact replay body loses motion, settles,
  // and fades. This also avoids giving jellyfish/cephalopods fish skeletons.
  let mealSeen=initial.mealSeen??0;
  /** 다시 보기(2026-11-12) [사용자: "잡아먹힌 물고기들은 리플레이 볼 수 있게 … 먹는 고기 시점에서"] — 다음에 여는 사냥 장면을 사냥꾼 시점으로 · 시점 카메라 자리 */
  /** 다시 보기 · 개발 장면이 열 장면(update 가 안 본 소식 대신 이것을 연다) · 장면이 끝나 안 본 소식을 다시 봐야 한다 · 장면이 끝나고 카메라가 물러나길 기다리는 임시 사냥꾼 */
  let openNext:{item:AquaNews;ghostId:number;kind:"replay"|"dev"}|null=null,recheck=false;const leaving:{id:number;t:number}[]=[];
  let povNext=false,replayN=0,povOn=false,povK=0,povR=0,povBack=0,povDist=4,povTurn=0;const povBox=new T.Box3(),povSize=new T.Vector3(),povTarget=new T.Vector3(),povCam=new T.Vector3(),povLook=new T.Vector3(),povSide=new T.Vector3(),povEye=new T.Vector3(),povFwd=new T.Vector3();
  const refreshPreds=()=>{const n=Math.max(1,swimmers.size);if(motion.preds.length<n)motion.preds=new Uint8Array(n);if(motion.flee.length<n*3)motion.flee=new Float32Array(n*3);if(motion.fear.length<n)motion.fear=new Float32Array(n);let j=0;for(const m of swimmers.values())motion.preds[j++]=isPredator(m.family)&&!m.visit?1:0;};
  /** 뜯을 때 터지는 것(2026-11-11 · 2026-11-12 다시 그림) — 피: 짙은 피가 상처에서 뭉게뭉게 번지며 물에 풀리고(안개를 받는다) 천천히 가라앉는다 ·
   *  살점: 살빛 조각이 튀어 나갔다가 빙글 가라앉는다 · 빨아들임(통째로 삼키기): 입 앞의 물 알갱이가 입속으로 빨려 든다.
   *  예전 피는 안개를 안 받고 가장자리가 딱딱한 분홍 점 44개라 물빛 위에 분홍 물방울 무늬로 떠 보였다.
   *  점 묶음 하나씩 · 재질은 종류마다 하나를 장면 동안 나눠 쓴다(장면을 열 때 지어 둬서 첫 뜯기에 셰이더를 짓느라 멈추지 않는다) */
  type BurstKind="blood"|"chunk"|"suck"|"ink"|"sand";
  type Burst={p:T.Points;t0:number;x:number;y:number;z:number;kind:BurstKind};
  const lingeringBursts:Burst[]=[];
  const remains=lingeringBursts; // diagnostic count: residual water effects, not instant bones
  const contact=new T.Vector3(),oralForward=new T.Vector3(),contactShift=new T.Vector3();
  let preyPhase=0;
  const burstMats=new Map<BurstKind,T.ShaderMaterial>();let burstWarm:T.Points|null=null;
  function burstMat(kind:BurstKind){let m=burstMats.get(kind);if(m)return m;
    // 먹물(놀란 두족류) · 모래(놀란 바닥 물고기) — 2026-11-14, 피와 같은 번짐
    const c1=kind==="blood"?new T.Color(.07,0,.004):kind==="chunk"?new T.Color(.36,.02,.035):kind==="ink"?new T.Color(.01,.008,.02):kind==="sand"?new T.Color(.55,.48,.36):new T.Color(.5,.66,.72);
    const c2=kind==="blood"?new T.Color(.3,.008,.02):kind==="chunk"?new T.Color(.74,.22,.2):kind==="ink"?new T.Color(.06,.05,.1):kind==="sand"?new T.Color(.85,.78,.62):new T.Color(.86,.95,1);
    m=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:true,
      uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{scale:{value:1},c1:{value:c1},c2:{value:c2},hard:{value:kind==="chunk"?1:0}}]),
      vertexShader:"#include <fog_pars_vertex>\nattribute float alpha;attribute float size;attribute float tone;uniform float scale;varying float vA;varying float vT;void main(){vA=alpha;vT=tone;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=size*scale/max(.1,-mvPosition.z);\n#include <fog_vertex>\n}",
      // 피 · 빨아들임은 가우스로 부드럽게(겹칠수록 짙어진다), 살점은 가장자리가 또렷한 조각
      fragmentShader:"#include <common>\n#include <fog_pars_fragment>\nvarying float vA;varying float vT;uniform vec3 c1;uniform vec3 c2;uniform float hard;void main(){vec2 d=(gl_PointCoord-.5)*2.;d.x*=1.15;float r=length(d);if(r>1.)discard;float edge=1.-smoothstep(.35,1.,r);float wisps=.76+.24*sin(d.x*12.+sin(d.y*9.+vT*8.));float f=hard>.5?edge:exp(-r*r*4.)*edge*wisps;gl_FragColor=vec4(mix(c1,c2,f*vT*.4),vA*f);\n#include <fog_fragment>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"});
    burstMats.set(kind,m);return m;}
  /** 장면을 열 때 — 재질 셋을 지어 두고 보이지 않는 점 하나로 셰이더를 미리 짓게 한다 */
  function warmBursts(){if(burstWarm)return;const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(new Float32Array(9),3));g.setAttribute("alpha",new T.BufferAttribute(new Float32Array(3),1));g.setAttribute("size",new T.BufferAttribute(new Float32Array(3),1));g.setAttribute("tone",new T.BufferAttribute(new Float32Array(3),1));
    burstWarm=new T.Points(g,burstMat("blood"));burstWarm.frustumCulled=false;burstWarm.raycast=()=>{};scene.add(burstWarm);
    for(const k of["chunk","suck"] as BurstKind[]){const p=new T.Points(g,burstMat(k));p.frustumCulled=false;p.raycast=()=>{};burstWarm.add(p);}}
  function dropBurstMats(){if(burstWarm){burstWarm.removeFromParent();burstWarm.geometry.dispose();burstWarm=null;}for(const m of burstMats.values())m.dispose();burstMats.clear();}
  /** dir(빨아들임만) — 입이 보는 쪽, len — 사냥꾼 몸길이 */
  function makeBurst(x:number,y:number,z:number,size:number,kind:BurstKind,tint:T.Color,t0:number,dir?:{x:number;y:number;z:number},len=1):Burst{
    const N=kind==="blood"||kind==="ink"?24:kind==="sand"?20:kind==="chunk"?6:18;
    const pos=new Float32Array(N*3),alpha=new Float32Array(N),sz=new Float32Array(N),tone=new Float32Array(N),seed=new Float32Array(N*5);
    for(let i=0;i<N;i++){const h1=((i*37)%11)/11,h2=((i*53)%9)/9,h3=((i*29)%7)/7,a=i*2.399+t0*7;
      if(kind==="suck"&&dir){
        // 입 앞 원뿔 — 몸길이의 0.3~1.3배 앞, 옆으로 거리의 35% 안
        const d=(.3+h1)*len,side=(h2-.5)*.7*d,up=(h3-.5)*.5*d,px=-dir.z,pz=dir.x;
        seed.set([dir.x*d+px*side,dir.y*d+up,dir.z*d+pz*side,(.09+h3*.09)*size,h2*.55],i*5);
      }else{const r=.35+h1*.65,el=h2-.5,sp=kind==="blood"?.75:1.6;
        const soft=kind==="blood"||kind==="ink"||kind==="sand";
        seed.set([Math.cos(a)*r*size*sp,el*.6*size*sp+(soft?.04:.25),Math.sin(a)*r*size*.6*sp,(soft?(.22+h3*.5):(.08+h3*.09))*size,soft?(i%10)*.02:0],i*5);}
      tone[i]=.55+h1*.45;pos.set([x,y,z],i*3);}
    // Subtle reference-colour variation, without pink opaque debris.
    if(kind==="chunk")tone.fill(Math.min(.65,.25+tint.r*.15));
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("alpha",new T.BufferAttribute(alpha,1));g.setAttribute("size",new T.BufferAttribute(sz,1));g.setAttribute("tone",new T.BufferAttribute(tone,1));
    const pts=new T.Points(g,burstMat(kind));pts.frustumCulled=false;pts.raycast=()=>{};pts.userData={seed,N};scene.add(pts);return{p:pts,t0,x,y,z,kind};
  }
  function animateBurst(bu:Burst,now:number){
    const g=bu.p.geometry,P=g.getAttribute("position") as T.BufferAttribute,A=g.getAttribute("alpha") as T.BufferAttribute,S=g.getAttribute("size") as T.BufferAttribute,seed=bu.p.userData.seed as Float32Array,N=bu.p.userData.N as number;
    (bu.p.material as T.ShaderMaterial).uniforms.scale.value=renderer.domElement.height*.9;
    const age=now-bu.t0;
    for(let i=0;i<N;i++){const vx=seed[i*5],vy=seed[i*5+1],vz=seed[i*5+2],s0=seed[i*5+3],dl=seed[i*5+4],t=Math.max(0,age-dl);
      // 피 — 처음엔 상처에 짙게 뭉쳤다가 바깥으로 느려지며 번지고, 물살에 조금씩 말리며 아주 천천히 가라앉는다(피는 물보다 조금 무겁다)
      if(bu.kind==="ink"){const spread=1-Math.exp(-t*1.6),curl=Math.sin(t*.9+i*1.7)*.03*t;P.setXYZ(i,bu.x+vx*spread+curl,bu.y+vy*spread+t*.02,bu.z+vz*spread-curl*.6);S.setX(i,s0*(.6+spread*2.4+t*.15));A.setX(i,t<=0?0:Math.min(.8,t*5)*Math.max(0,1-t/4.5));}
      else if(bu.kind==="sand"){const spread=1-Math.exp(-t*2.2);P.setXYZ(i,bu.x+vx*spread,bu.y+Math.max(0,vy)*spread*1.4-t*t*.05,bu.z+vz*spread);S.setX(i,s0*(.5+spread*1.6));A.setX(i,t<=0?0:Math.min(.4,t*4)*Math.max(0,1-t/2.4));}
      else if(bu.kind==="blood"){const spread=1-Math.exp(-t*.8),curl=Math.sin(t*.8+i*1.7)*.025*t;P.setXYZ(i,bu.x+vx*spread+curl+t*.025,bu.y+vy*spread-t*.025,bu.z+vz*spread-curl*.6);S.setX(i,s0*(.45+spread*2+t*.12));A.setX(i,t<=0?0:Math.min(.32,t*2)*Math.max(0,1-t/5));}
      // 살점 — 튀어 나갔다가 물속에서 느려지고 천천히 가라앉는다
      else if(bu.kind==="chunk"){const spread=1-Math.exp(-t*3);P.setXYZ(i,bu.x+vx*spread,bu.y+vy*spread-t*t*.08-t*.15,bu.z+vz*spread);S.setX(i,s0);A.setX(i,t<=0?0:Math.max(0,1-t/4.2));}
      // 빨아들임 — 입 앞에서 점점 빨라지며 입속으로(0.45초), 들어가면 사라진다
      else{const k=Math.min(1,t/.45),e=k*k*k;P.setXYZ(i,bu.x+vx*(1-e),bu.y+vy*(1-e),bu.z+vz*(1-e));S.setX(i,s0*(1-.6*e)*.4);A.setX(i,t<=0||k>=1?0:Math.min(1,k*6)*.22);}}
    P.needsUpdate=true;A.needsUpdate=true;S.needsUpdate=true;
  }
  function dropBurst(bu:Burst){bu.p.removeFromParent();bu.p.geometry.dispose();}
  /** 먹이의 빛깔 — 살점에 쓴다(그림의 평균 색이 없으면 주황빛) */
  function fleshTint(m:Swimmer){let c:T.Color|null=null;m.root.traverse(o=>{const mat=(o as T.Mesh).material as T.MeshStandardMaterial|undefined;if(!c&&mat&&(mat as T.MeshStandardMaterial).color)c=(mat as T.MeshStandardMaterial).color.clone();});return c??new T.Color(.95,.55,.35);}
  const bankQ = new T.Quaternion(), standQ = new T.Quaternion(), SIDE_AXIS = new T.Vector3(0, 0, 1), FORWARD = new T.Vector3(1, 0, 0), viewH = { x: 0, z: -1 }, viewTmp = new T.Vector3();
  const heightAt = (x: number, z: number) => habitat?.heightAt(x, z) ?? WORLD.floor;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  // 모래 먼지 — 바닥 물고기가 내려앉으면(course.puff) 점 60 알을 돌려 쓴다. 움직임 줄이기면 안 그린다
  const puffs=makeSandPuffs(heightAt);scene.add(puffs.points);
  // 만지면 놀란다(startle.ts, 2026-11-14) — 물고기마다 놀란 때 · 종류 · 꺾는 쪽 · 달아나는 방향. 이번 프레임 모습은 startleNow(그리는 고리가 C 자 · 부풀기를 쓴다)
  const startles=new Map<number,{t0:number;kind:StartleKind;side:number;dir:{x:number;y:number;z:number}}>(),startleNow=new Map<Swimmer,StartlePose>();
  // 범고래 뛰어오르기(breach.ts · splash.ts, 2026-11-15) — 누르면 잠수 → 솟구쳐 수면을 박차고 나가 → 포물선 → 다시 들어와 원래 길로. 나갈 때 · 들어올 때 물보라 · 물결 고리 · 거품
  const splash=makeSplash();scene.add(splash.points);scene.add(splash.rings);
  // 2026-11-15 — 범고래만이 아니라 포유류마다 재주 하나(breach.ts 의 planTrick): 물개류 세 번 뛰기 · 물범 머리 내밀기 · 해달 누워 조개 깨기 · 수달 빙글 돌기
  const breaches=new Map<number,{plan:TrickPlan;t0:number;fired:number;trailAt:number;holdPhase:number;last?:number[]}>();
  const waterTop=()=>tallY(5.56,tall);
  // 고래상어 — 34초마다 7초 동안 입을 크게 벌리고 헤엄치며 플랑크톤을 걸러 먹는다(2026-11-19 [사용자: "고래상어는 입 벌리고 플랑크톤을 먹는 애니메이션 기믹"]).
  //   입은 사냥 장면과 같은 턱(addJaw — 이빨 없음, 넓게), 입 앞 원뿔에서 작은 알갱이가 입속으로 빨려 든다("suck" 알갱이를 0.7초마다). 사냥 장면 중 · 움직임 줄이기면 안 한다
  const PLANKTON_CYCLE=34,PLANKTON_OPEN=7,plankFwd=new T.Vector3(),plankTint=new T.Color(0xd8efe6);
  const plankOpen=(m:Swimmer)=>{const ph=((elapsed+m.phase*5.3)%PLANKTON_CYCLE+PLANKTON_CYCLE)%PLANKTON_CYCLE;return ph<PLANKTON_OPEN?Math.pow(Math.sin(Math.PI*ph/PLANKTON_OPEN),.6):0;};
  function feedWhaleSharks(){
    for(const[id,m]of swimmers){
      if(m.family!=="whale_shark")continue;
      const busy=!!meal&&(meal.predId===id||meal.ghostId===id),open=busy||reduced.matches||id<0?0:plankOpen(m);
      if(open<=.02){if(m.feedJaw){m.feedJaw.restore();m.feedJaw=undefined;}continue;}
      if(!m.feedJaw){m.feedJaw=addJaw(m.root,{teeth:TEETH_CODE.none,density:20,height:.42,open:1.25,hinge:.2});m.feedNext=elapsed;}
      m.feedJaw.set(open);
      if(open>.35&&elapsed>=(m.feedNext??0)){m.feedNext=elapsed+.7;const L=shownLength(m),p=m.root.position;plankFwd.set(1,0,0).applyQuaternion(m.root.quaternion);
        warmBursts();lingeringBursts.push(makeBurst(p.x+plankFwd.x*L*.48,p.y+plankFwd.y*L*.48-L*.03,p.z+plankFwd.z*L*.48,Math.max(.5,L*.3),"suck",plankTint,elapsed,{x:plankFwd.x,y:plankFwd.y,z:plankFwd.z},L*.55));}
    }
  }
  const SPOUTERS=/^(orca|minke_whale|gray_whale|humpback_whale|sperm_whale|blue_whale)$/,spouted=new Map<number,number>(),spoutFwd=new T.Vector3(),burstAt=new Map<number,number>();
  function startBreach(id:number,m:Swimmer){
    if(breaches.has(id))return true;
    const p=m.root.position,L=shownLength(m),h=motion.hall,hallTop=h?WORLD.floor+h.h*tall+.4+L*.3:-Infinity;
    const kind=trickOf(m.family);if(!kind)return false;
    // 모래사장 단계 — 재주는 물가 안쪽에서(뛰어올라 모래 경사를 뚫지 않게)
    const halfW=Math.min(5*wide-L*.55,habitat?.shoreX?habitat.shoreX(waterTop()-L*1.2)-L*.6:Infinity);
    const plan=planTrick(kind,{x:p.x,y:p.y,z:p.z,hx:m.course.dx},waterTop(),Math.max(heightAt(Math.min(p.x,halfW),p.z),hallTop),halfW,L,3*deep-L*.5,trickSlow(m.family));
    breaches.set(id,{plan,t0:elapsed,fired:0,trailAt:0,holdPhase:m.phase});startles.delete(id);
    if(!active)draw(0);return true;
  }
  /** 행사 손님 물고기(2026-11-18) — 지금 열린 행사(view.season.keys)의 손님이 시간표(aquaevent.visitWindow — 게임 시각 · 커플 seed)대로 잠깐 들른다.
   *  저장 · 정산 · 물고기 목록과 무관한 그림이다: 음수 id(사냥 장면 유령 −n · 임시 사냥꾼 −800000 대와 안 겹치는 −3000000)라 update 가 지우지 않고 무리에도 안 낀다.
   *  들른 시간은 수조 시계(elapsed)로 잰다 — 사진 · 꾸미기 · 숨은 탭에선 멈췄다가 이어서 나간다. 움직임 줄이기면 오지 않는다(있으면 바로 뺀다) */
  const GUEST_ID=-3_000_000,GUEST_WAIT=5;
  let guest:{key:string;t0:number;dur:number;wait:number}|null=null,guestCheck=-1,guestSlot="";
  const gameClock=()=>{const c=state.season?.clock;const t=c?c():Date.now();return Number.isFinite(t)?t:Date.now();};
  /** 몸 크기 — 들어온 정도(w)가 아니라 실제 자리로 정한다(제 길이 왼쪽 유리 가까이면 w 가 작아도 몸은 이미 유리 안이다).
   *  몸 가운데가 왼쪽 유리(−5·폭)에서 몸길이 0.3 배 바깥이면 0, 0.6 배 안쪽이면 원래 크기 — 유리 밖에 걸친 몸이 거의 안 보인다 */
  const guestSize=(x:number,L:number)=>{const k=clamp((x+5*wide+L*.3)/(L*.9),0,1);return k*k*(3-2*k);};
  function startGuest(key:string,dur:number){
    if(guest)dropGuest();
    try{addFish({id:GUEST_ID,family:key,stage:2,species:key,growH:0,goodH:0,totalH:0} as AquaFish);}catch(e){skip(`손님 ${key}`,e);return false;}
    const m=swimmers.get(GUEST_ID);if(!m)return false;
    // 고를 수 없게 — 탭은 userData.guest 를 건너뛴다. type 은 "fish" 그대로(묶음 그리기의 moves 가 type "fish" 아래를 움직이는 몸으로 보고 정적 묶음에 안 넣는다).
    //   크기는 숨어 있는 동안 원래대로 둔다(제작 모델 갈아 끼우기가 크기 0 인 몸을 거친 적이 없다) — 보이기 시작하면 draw 가 자리로 정한다
    m.root.userData={type:"fish",id:GUEST_ID,guest:true};m.visit={w:0,dw:0};m.root.visible=false;
    guest={key,t0:-1,dur,wait:0};retopo(false);return true;
  }
  function dropGuest(){if(!guest)return;guest=null;dropSwimmer(GUEST_ID);}
  /** 프레임마다 — 들른 손님이면 들어온 정도를 적고(끝나면 뺀다), 아니면 1초마다 시간표를 본다 */
  function guestTick(dt:number){
    if(guest&&(reduced.matches||!swimmers.has(GUEST_ID))){if(swimmers.has(GUEST_ID))dropGuest();else guest=null;}
    if(guest){const m=swimmers.get(GUEST_ID)!;
      // 제작 모델(GLB)이 올 때까지(최대 GUEST_WAIT 초) 기다렸다가 들어온다 — 임시 몸으로 들어왔다 바뀌면 튄다
      if(guest.t0<0){guest.wait+=dt;if(m.glb||!m.glbKey||m.glbFail||guest.wait>GUEST_WAIT){guest.t0=elapsed;m.root.visible=true;batchesDirty=true;}}
      const u=guest.t0<0?0:elapsed-guest.t0;
      if(u>=guest.dur){dropGuest();return;}
      const v=visitWeight(u,guest.dur);m.visit!.w=v.w;m.visit!.dw=v.dw;return;}
    // 사냥 장면 중엔 새로 들이지 않는다(장면 카메라를 가로지르지 않게 — 장면이 끝나면 다음 칸까지 남은 시간이 있으면 온다)
    if(dt<=0||reduced.matches||meal||elapsed-guestCheck<1)return;guestCheck=elapsed;
    const key=visitorFor(state.season?.keys??[]);if(!key)return;
    const now=gameClock(),win=visitWindow(now,state.season?.seed??"");
    // 이미 본 칸은 다시 안 연다. 화면을 늦게 열어 남은 시간이 짧으면 건너뛴다(들어오다 바로 나가지 않게) — 남은 만큼만 머문다
    if(!win||win.slot===guestSlot)return;guestSlot=win.slot;
    const left=(win.end-now)/1000;if(left<VISIT_MIN_S*.6)return;
    startGuest(key,left);
  }
  function startleFish(id:number){
    const m=swimmers.get(id);if(!m||reduced.matches)return;
    // 행사 손님은 눌러도 반응하지 않는다(고를 수 없는 그림)
    if(m.visit)return;
    if(meal&&(id===meal.predId||id===meal.ghostId))return;
    if(breaches.has(id))return;
    // 모래사장 · 바위에서 쉬는 중이면(2026-11-18) 물속 재주 대신 땅에서 통통 튀며 몇 걸음 옮겨 간다(galumph)
    const sw=(m as unknown as StepFish).swim,onLand=!!sw?.haul&&!sw.float&&sw.rest>.5; // 수면에 누워 쉬는 해달은 물 위다(2026-11-20) — 눌러도 땅에서 튀지 않고 물속 재주(누워 조개 깨기)
    if(!onLand&&trickOf(m.family)&&!inTunnel&&!inDome&&startBreach(id,m))return;
    const kind=startleKind(m.family,m.key,onLand),side=Math.random()<.5?-1:1,p=m.root.position;
    const dir=kind==="galumph"?{x:0,y:0,z:side}:startleDir(kind,p.x-camera.position.x,p.z-camera.position.z,m.course.dx,m.course.dz,side);
    startles.set(id,{t0:elapsed,kind,side,dir});
    // 먹물 · 모래 — 놀란 자리에 한 번 피어오른다
    if(kind==="ink"){warmBursts();lingeringBursts.push(makeBurst(p.x,p.y,p.z,Math.max(.7,m.length*1.4),"ink",new T.Color(0,0,0),elapsed));}
    else if(kind==="burrow"||(m.course.ground>.6&&kind!=="roll")){warmBursts();lingeringBursts.push(makeBurst(p.x,heightAt(p.x,p.z)+.05,p.z,Math.max(.4,m.length*.7),"sand",new T.Color(0,0,0),elapsed));}
    if(!active)draw(0);
  }
  // 물속 후처리 — 장면을 HDR 그림에 그린 뒤 일렁임 · 빛 번짐 · 비네트 · 톤 매핑을 한 번에(post.ts)
  const postNow=makePost(renderer,{still:()=>reduced.matches});post=postNow;
  renderer.debug.onShaderError=()=>{lost=true;schedule();events.error(ERROR_GPU);};
  // 먹이 알갱이(food.ts, 2026-11-12) — 먹이를 주면 물고기가 모이는 자리에 뿌린다. 수조를 열 때 지어 두어 셰이더도 미리 짓는다(빈 동안엔 그리기 범위 0)
  const food=makeFood();scene.add(food.points);let foodFeed:FeedEvent|null=null;
  /** 먹이가 내려앉는 높이 — 모래, 터널 · 돔 자리면 그 유리 위(둥근 단면으로 어림) */
  const foodFloor=(x:number,z:number)=>{let y=heightAt(x,z);const h=motion.hall;
    if(h){const d=h.kind==="tunnel"?(z>tunnelSpan(deep).back?Math.abs(x):Infinity):Math.hypot(x,z);if(d<h.r)y=Math.max(y,WORLD.floor+h.h*tall*Math.sqrt(1-(d/h.r)**2));}return y;};
  /** 물 값 → 화면 — 안개 색(거리는 placeCamera) · 물고기 테 · 장식 · 물고기의 일렁임 · 해 · 하늘빛 · 후처리의 탁함 · 부유물 · 배경(habitat.setWater).
   *  탁함은 물 60(정성 표시선) 아래에서만 생기고 0 에서 가장 짙다. habitat.setWater 는 색을 새로 만들므로 0.5 넘게 바뀔 때만 부른다 */
  function applyWater(force:boolean){
    const w=waterShown,m=clamp((60-w)/60,0,1);murkK=m;
    fogBase.copy(waterTheme).lerp(ALGAE,m*.48);if(scene.fog instanceof T.Fog)scene.fog.color.copy(fogBase);
    WATER_LIGHT.aquaRimColor.value.copy(waterTopC).lerp(fogBase,.3+.35*m);
    WATER_LIGHT.aquaClarity.value=1-.75*m;
    sun.intensity=2.3*(1-.4*m)*lightK[1];hemi.intensity=1.35*(1-.18*m)*lightK[0];
    postNow.setWater(m,fogBase);motes?.setMurk(m);postNow.setLight(lightTint[0],lightTint[1],lightTint[2]);
    if(habitat&&(force||Math.abs(w-waterHab)>=.5)){waterHab=w;habitat.setWater(w);}
  }

  /** 섬 하나를 떼어 낸다 — 나눠 쓰는 키트 · GLB 것은 남긴다 */
  function release(root:T.Object3D){
    armGrips.delete(root);
    mealSurfaces.get(root)?.dispose();mealSurfaces.delete(root);
    disposeFishFace(root);
    const geometry=new Set<T.BufferGeometry>(), materials=new Set<T.Material>(), textures=new Set<T.Texture>();
    const shared=new Set<T.Material>(kit.materials.values());
    root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){const borrowed=!!o.userData.glbShared;if(!borrowed&&o.geometry!==kit.sphere&&o.geometry!==kit.box&&o.geometry!==kit.cylinder)geometry.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!borrowed&&!shared.has(m)&&!m.userData.aquaMorph){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}
      if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});root.removeFromParent();
  }
  // 자라는 중이면 들고 있던 옛 몸도 같이 놓는다
  const dropFish=(m:Swimmer):void=>{if(m.grow?.old){dropFish(m.grow.old);m.grow.old=null;}release(m.root);if(m.glbKey)glb.release(m.glbKind??"fish",m.glbKey);};
  const dropDecor=(d:Decoration)=>{release(d.root);if(d.glbKey)glb.release("decor",d.glbKey);};
  /** 아직 코드 모델로 보이는 물고기의 key — 갈아 끼운 물고기의 피부 그림은 놓는다 */
  // 자라는 중인 옛 몸도 아직 보이므로 그 피부 그림을 놓지 않는다
  const retainSkins=()=>kit.retainReferences(new Set([...swimmers.values()].flatMap(m=>m.grow?.old?[m,m.grow.old]:[m]).filter(m=>!m.glb).map(m=>m.key)));

  // 제작 모델 도착 — 받은 것을 모아 두었다가 한 프레임에 갈아 끼우고 묶음을 한 번만 다시 짓는다.
  // 예전엔 도착할 때마다(물고기 20 + 장식 32 ≈ 50번) 장면 전체를 훑고 묶음을 다시 짓고 한 장을 더 그려서 끊겼다
  const swaps:(()=>void)[]=[];
  function flushSwaps(){
    const jobs=swaps.splice(0);if(!jobs.length)return;
    for(const job of jobs){try{job();}catch(e){skip("제작 모델",e);}}
    scene.traverse(collectBorrowed);
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
    // 산호 여왕 — 등 위가 산호라 왕관은 작게, 머리 쪽 어깨에(가운데에 두면 산호를 통째로 가렸다)
    if(m.coralQueen){const top=bodyBounds(m.root);m.crown.scale.setScalar(.6);m.crown.position.set(top.max.x*.55,top.max.y*.55,center.z);m.crown.updateMatrix();return;}
    m.crown.position.set(0,box.max.y,center.z);m.crown.updateMatrix();
  }
  /** prev — 자라서 모습(key)이 바뀐 같은 물고기의 지금 몸. 같은 Map 자리에 새 몸을 넣고 자리 · 방향 · 꼬리 박자를 잇는다 */
  function addFish(f:AquaFish,prev?:Swimmer){
    // 색 변이(2026-11-13) — 지금 상태의 변이 장부에서(임시 사냥꾼 · 유령은 음수 id 라 없다)
    const key=fishArtKey(f),look=bossLookOf(f.crown,key),morph=f.id>=0?fishMorph(state.aquarium,f):null;
    const animal=makeAnimal(kit,f.family,key,look),cm=fishCm(f),drawn=realLength(cm),length=Math.max(fishLength(cm,f.family),drawn);
    waterLitTree(animal.root,false);normalsFixed+=repairNormals(animal.root);calmSpecular(animal.root);fishShading(animal.root);morphs.apply(animal.root,morph);
    // 머리~꼬리 길이로 잰다(anatomy.bodyMeasure) — 키로 재면 엔젤 · 디스커스 같은 키 큰 물고기가 잡은 cm 의 71~90% 로 보였다
    const bounds=new T.Box3().setFromObject(animal.root),size=bounds.getSize(new T.Vector3()),scale=drawn/Math.max(.001,bodyMeasure(f.family,key,size));
    animal.root.scale.setScalar(scale);animal.root.userData={type:"fish",id:f.id};scene.add(animal.root);
    const m:Swimmer={...animal,coralQueen:!!look?.coral,key,morph,family:f.family,length,shown:drawn,scale,phase:f.id*1.73,glb:false,glbKey:null,fresh:true,crown:null,course:{x:0,y:0,z:0,dx:1,dy:0,dz:0,effort:1,turn:0,amp:1,pulse:0,ground:0,puff:-1,hover:0}};
    if(f.crown){m.crown=makeCrown(Math.max(size.x,size.z)*.2);m.crown.userData.aquaKeep=true;m.root.add(m.crown);placeCrown(m);}
    swimmers.set(f.id,m);
    if(prev){
      // 자랐다(치어 → 어린 → 다 큰, 2026-11-12) — 예전엔 지우고 새로 넣어 크기가 한 프레임에 13~21% 뛰고 임시 모델이 잠깐 보였다.
      //   새 몸은 숨겨 두고 옛 몸을 그 자리에서 계속 보이다가(draw 가 옮긴다) 제작 모델이 오면 바꾸고 1초에 걸쳐 키운다.
      //   prev 가 아직 옛 몸을 들고 있으면(연달아 자랐다) 그 옛 몸이 보이는 몸이다 — prev 의 안 보이던 새 몸은 놓는다
      const shown=prev.grow?.old??prev;if(prev.grow?.old){prev.grow.old=null;dropFish(prev);}
      const shownLen=(shown.shown??shown.length)*(shown.root.scale.x/Math.max(1e-6,shown.scale));
      m.phase=prev.phase;Object.assign(m.course,prev.course);m.fresh=false;
      animal.root.position.copy(shown.root.position);animal.root.quaternion.copy(shown.root.quaternion);animal.root.visible=false;
      m.grow={old:shown,from:shownLen/Math.max(1e-6,drawn),k:0,wait:0};
    }
    // 주인 전용 모델(bosslook — 산호 여왕 · 검은 파도)이 있으면 종 모델 대신 그것을
    const gKind=look?.model?"boss" as const:"fish" as const,gKey=look?.model??key;
    if(look?.model||FISH_GLB.has(key)){m.glbKey=gKey;m.glbKind=gKind;void glb.load(gKind,gKey).then(src=>{
      if(disposed)return;
      // 못 받았다 — 임시 모델 그대로, 이제 피부 그림을 받는다
      if(!src){m.glbFail=true;if(swimmers.get(f.id)===m)kit.loadDeferred(key);if(m.grow?.old&&!active)draw(0);return;}
      queueSwap(()=>{if(swimmers.get(f.id)!==m||m.glb)return;const inner=glb.instance(src);
        // 해파리 GLB 는 갓 축이 +X 로 누워 있다 — 세운 뒤 크기를 잰다. 재질은 종별 표(은빛 광택 · 상어 거친 피부 · 신화종 빛남) — 같은 key 끼리 공유라 같은 값을 다시 넣어도 된다
        inner.rotation.z=glbUpright(f.family,key);applyTweak(inner,f.family,key);normalsFixed+=repairNormals(inner);calmSpecular(inner);fishShading(inner);
        release(swapBody(m.root,inner,"center",s=>bodyMeasure(f.family,key,s)));
        // 주인 모델의 거북(산호 여왕)은 거북 헤엄 — 물고기 몸 물결 · 막 떨림이면 등딱지 · 산호가 휘고 떨렸다
        m.animate=look?.model&&f.family==="sea_turtle"?turtleGlbMotion(inner):fishMotion(inner,f.family,key);morphs.apply(inner,m.morph??null);m.glb=true;kit.dropDeferred(key);placeCrown(m);});
    });}
  }
  function addDecor(p:PlacedDecor):Decoration{
    // 한정 장식 빛깔 — 지금 보는 화면 값(update 가 state 를 먼저 바꾼다)
    const tint=state.season?.tints?.[p.id]??null;
    const made=makeDecor(kit,p.key);waterLitTree(made.root,false);tintReg.apply(made.root,tint);
    const d:Decoration={...made,key:p.key,glb:false,glbKey:null,pose:"",tint};d.root.userData={type:"decor",id:p.id};scene.add(d.root);decorations.set(p.id,d);
    if(DECOR_GLB.has(p.key)){d.glbKey=p.key;void glb.load("decor",p.key).then(src=>{if(disposed||!src)return;
      queueSwap(()=>{if(decorations.get(p.id)!==d||d.glb)return;const inner=glb.instance(src);release(swapBody(d.root,inner,"base"));
        modelTextureQuality(inner,anisotropy);
        // 거품은 몸과 따로 남아 있다(decor-details) — 효과와 부품 움직임을 같이 돌린다
        const fx=d.effects,parts=decorMotion(inner);d.animate=t=>{fx(t);parts(t);};d.glb=true;tintReg.apply(inner,d.tint);
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
    modelTextureQuality(inner,anisotropy);
    const t=materialTweak(family,key);
    inner.traverse(o=>{const mat=(o as T.Mesh).material;for(const x of Array.isArray(mat)?mat:mat?[mat]:[]){if(!(x instanceof T.MeshStandardMaterial))continue;
      if(o.userData.aquaGeometry!=="closed-volume-v3"){x.roughness=t.roughness;x.metalness=t.metalness;}
      if(t.emissiveIntensity>=0&&(t.emissiveIntensity>0||t.emissiveFromMap)){x.emissiveIntensity=t.emissiveIntensity;if(t.emissiveFromMap&&x.map){x.emissiveMap=x.map;x.emissive.setHex(0xffffff);}else x.emissive.setHex(t.emissive??0);}}});
  }
  /** 물고기 순서(swimmers 의 Map 순서 = motion 배열 순서)가 바뀌었다 — 겹침 밀기 · 쫓고 달아나기 · 겁 값을 id 로 옮긴다(2026-11-12).
   *  예전엔 전부 0 으로 되돌려, 한 마리가 자라거나 들어올 때마다 다른 물고기가 다 같이 0.08 ~ 0.14 L 튀었다.
   *  handoff — 지난 화면 자리를 남겨 다음 프레임부터 1초에 걸쳐 새 길로 넘어간다(자란 물고기의 길 · 대장이 자라 바뀐 무리의 길). 수조 크기가 바뀌면 안 한다 */
  let motionIds:number[]=[];
  const hand={from:new Float32Array(3),has:new Uint8Array(1),d:new Float32Array(3),left:0,armed:false};
  function relayoutMotion(handoff:boolean){
    const ids=[...swimmers.keys()],n=Math.max(1,ids.length),prev=new Map<number,number>();motionIds.forEach((id,j)=>prev.set(id,j));
    const off=new Float32Array(n*3),fl=new Float32Array(n*3),fe=new Float32Array(n),from=new Float32Array(n*3),has=new Uint8Array(n);
    for(let j=0;j<ids.length;j++){const k=prev.get(ids[j]);if(k===undefined)continue;
      for(let c=0;c<3;c++){off[j*3+c]=motion.offsets[k*3+c]??0;fl[j*3+c]=motion.flee[k*3+c]??0;}fe[j]=motion.fear[k]??0;
      if(handoff&&k<motion.count){for(let c=0;c<3;c++)from[j*3+c]=motion.positions[k*3+c];has[j]=1;}}
    motion.offsets=off;motion.flee=fl;motion.fear=fe;motionIds=ids;
    hand.from=from;hand.has=has;hand.armed=handoff;hand.left=0;if(hand.d.length<n*3)hand.d=new Float32Array(n*3);
  }
  /** 물고기가 들고 났다 — 묶음 · 그림자 칸 · 자리 배열 · 보정값(id 로 옮긴다) · 사냥꾼 표시를 다시 잡는다(update 밖에서 장면의 둘을 넣을 때도) */
  function retopo(handoff:boolean){batchesDirty=true;
      const n=Math.max(1,swimmers.size);
      const cap=fishShadows.instanceMatrix.count;if(cap<n||cap>Math.max(4,n*2)){fishShadows.removeFromParent();fishShadows.dispose();fishShadows=makeShadows(Math.max(4,n));}
      // 물고기가 바뀌면 순서가 바뀐다 — 보정값은 id 로 옮기고 지난 자리에서 1초에 걸쳐 넘어간다(relayoutMotion). 자리 배열을 다시 잡기 전에 부른다(지난 자리를 읽는다)
      relayoutMotion(handoff);
      if(motion.lengths.length<n){motion.positions=new Float32Array(n*3);motion.heading=new Float32Array(n*3);motion.lengths=new Float32Array(n);motion.pinned=new Float32Array(n);motion.rolls=new Float32Array(n);}
      refreshPreds();
  }
  /** 물고기 하나를 장면에서 뺀다(임시 사냥꾼) */
  const dropSwimmer=(id:number)=>{const s=swimmers.get(id);if(!s)return;dropFish(s);swimmers.delete(id);relayoutMotion(false);refreshPreds();batchesDirty=true;};
  /** 사냥 장면 하나를 연다 — 사냥꾼(item.id)이 수조에 있고 먹이 모델이 검수를 통과했을 때만. 열었으면 true */
  function openMeal(item:AquaNews,ghostId:number,kind:"real"|"replay"|"dev"):boolean{
    const ate=item.ate;if(!ate||!swimmers.has(item.id))return false;
    const ghost:AquaFish={id:ghostId,family:ate.family,stage:ate.stage,...(ate.species?{species:ate.species}:{}),growH:0,goodH:0,totalH:0};
    if(!isFishModelApproved(fishArtKey(ghost)))return false;
    try{addFish(ghost);}catch(e){skip("사냥 장면",e);return false;}
    const pm=swimmers.get(item.id)!,style=huntOf(pm.family).style;
    // 임시 사냥꾼은 장면이 열릴 때(두 모델이 다 와서 t0)까지 숨긴다 — 기다리는 동안(최대 5초) 임시 몸으로 수조에 떠 있었다
    if(item.id<=TEMP_HUNTER_ID)pm.root.visible=false;
    meal={n:item.n,kind,predId:item.id,ghostId,t0:-1,bx:0,by:0,bz:0,bitesDone:0,mx:0,my:0,mz:0,bursts:[],tint:null,jaw:null,wrap:style==="wrap",style,lx:0,ly:0,lz:0,ly0:0,wait:0,sucked:false,camPick:null,pov:povNext};
    return true;
  }
  /** 아직 이 기기에서 안 본 잡아먹기 소식(hunt.ts huntPlan) — 가장 새 것 하나만 장면으로 그리고, 나머지 · 그릴 수 없는 것(사냥꾼이 떠났다 · 모델 검수 전 · 움직임 줄이기)은
   *  장면 없이 그 번호로 끝났다고 알린다(그 카드가 바로 뜬다). 물고기를 더했으면 true */
  function huntNews():boolean{
    if(meal)return false;
    // 사진 모드 동안은 시계가 서 있어 장면이 시작도 끝도 못 한다 — 끝낼 때 다시 본다(recheck)
    if(photoOn){recheck=true;return false;}
    const plan=huntPlan(state.aquarium.news??[],mealSeen),last=plan.play;if(!last)return false;
    mealSeen=last.n;events.meal?.(mealSeen);
    // 움직임 줄이기(2026-11-12) — 수조 시계가 서 있어(draw(0) 만) 장면이 시작도 끝도 안 했다: 유령이 멈춘 채 남고 카메라가 사냥 장면에 묶이고 다음 사냥도 막혔다.
    //   장면 없이 본 것으로 치고(위 events.meal) 끝났다고만 알린다 — 같은 렌더에서 화면이 듣기 시작한 뒤에 닿게 조금 늦춘다
    const opened=!reduced.matches&&openMeal(last,-last.n,"real"),done=opened?plan.skip:[...plan.skip,last.n];
    if(done.length)window.setTimeout(()=>{if(!disposed)for(const n of done)window.dispatchEvent(mealEndEvent({n,replay:false}));},250);
    return opened;
  }
  /** 장면을 끝낸다(2026-11-13 draw 밖으로 — 그만 보기 · 다시 보기 바꾸기도 같은 정리를 쓴다). quiet 면 알리지 않는다(바로 다음 다시 보기가 이어진다).
   *  끝 알림에 소식 번호 · 다시 보기인지를 싣고, 장면 동안 들어온 안 본 소식을 다음 그리기에서 다시 본다(recheck — 예전엔 다음 갱신까지 최대 1분 뒤 카드 밑에서 열렸다) */
  closingNotice=()=>{if(meal)window.dispatchEvent(mealEndEvent({n:meal.n,replay:meal.kind!=="real"}));};
  function finishMeal(quiet=false){
    const m=meal;if(!m)return;const pred=swimmers.get(m.predId),ghost=swimmers.get(m.ghostId);
    m.jaw?.restore();
    if(ghost){dropFish(ghost);swimmers.delete(m.ghostId);}
    // 임시 사냥꾼(다시 보기 · 개발 __aquaHunt) — 보인 적 없으면 바로, 보였으면 카메라가 물러날 때까지(최대 1.5초, tempHunterGone) 두었다가 뺀다(코앞에서 툭 사라졌다)
    if(m.predId<=TEMP_HUNTER_ID&&pred){if(pred.root.visible&&!quiet&&!reduced.matches)leaving.push({id:m.predId,t:0});else{dropFish(pred);swimmers.delete(m.predId);}}
    povOn=false;lingeringBursts.push(...m.bursts);meal=null;relayoutMotion(false);refreshPreds();batchesDirty=true;
    recheck=true;if(!quiet){window.dispatchEvent(mealEndEvent({n:m.n,replay:m.kind!=="real"}));}
  }
  function update(next:TankView){
    if(disposed)return;
    // 개발 빌드 전용 — 콘솔에서 sessionStorage['ourdays.dev.aquaTier'] = 9 로 두고 다시 열면 수조 그림만 그 단계로 보인다(저장 · 정산은 그대로). 배포 빌드엔 없다
    if(process.env.NODE_ENV!=="production"&&typeof sessionStorage!=="undefined"){const dev=Number(sessionStorage.getItem("ourdays.dev.aquaTier"));if(dev>=1&&dev<=11)next={...next,aquarium:{...next.aquarium,tank:dev}};}
    state=next;let topologyChanged=false,moved=false;const tierBefore=habitatTier,wideBefore=wide,sinkBefore=habitatSink;
    const approvedFish=next.aquarium.fish.filter(f=>isFishModelApproved(fishArtKey(f)));
    const ids=new Set(approvedFish.map(f=>f.id));
    // 수심(아래로 깊게, 2026-11-20)이 바뀌어도 수조를 새로 짓는다 — 수면 · 빛줄기 · 부유물 · 바닥 높이가 모두 tall 을 따른다
    if(habitatTier!==next.aquarium.tank||habitatSink!==(next.aquarium.sink??0)){
      if(habitat){habitat.dispose();release(habitat.root);}
      habitat=makeHabitat(next.aquarium.tank,{anisotropy});habitatTier=next.aquarium.tank;habitatSink=next.aquarium.sink??0;
      scene.add(habitat.root);topologyChanged=true;wide=0;
      // 위로 늘린다 — 바닥(WORLD.floor)을 붙잡고 키운다(habitat.heightAt 도 같은 식)
      // 단계마다 수조 자체가 커진다(2026-11-14 tiers.ts 의 tankAxes) — 가로 tierX 배 · 위아래 · 앞뒤도 그 일부만큼
      const ax=tankAxes(habitatTier,tankTall(habitatTier),tankDeep(habitatTier));tierX=ax.x;
      tall=ax.tall*sinkScale(habitatSink);habitat.root.scale.y=tall;habitat.root.position.y=WORLD.floor*(1-tall);
      // 대수족관은 앞뒤로도 깊다(터널이 지나갈 자리) — 바닥 높이 · 물고기 길 · 장식 자리도 같은 배율
      deepTier=ax.deep;deep=deepTier*deepScale(next.aquarium.deepen);habitat.root.scale.z=deep;habitat.root.updateMatrix();
      if(tunnel){release(tunnel.root);tunnel.dispose();tunnel=null;}
      if(dome){release(dome.root);dome.dispose();dome=null;}
    }
    // ⚠ 넓히면 수조 틀 · LED · 유리 모서리 · 접지 그림자(안 움직이는 묶음)도 다시 올려야 한다 — 예전엔 옛 폭에 남았다
    wideBase=wideScale(next.aquarium.wide);const nextWide=wideBase*tierX;
    if(nextWide!==wide){wide=nextWide;if(habitat){habitat.root.scale.x=wide;habitat.root.updateMatrix();}topologyChanged=true;}
    // 앞뒤로 늘리기(2026-11-19) — 한 단계마다 깊이 1.5배(world.deepScale). 수조 · 바닥 높이 · 물고기 길 · 장식 자리가 모두 deep 을 따른다
    {const nd=deepTier*deepScale(next.aquarium.deepen);if(nd!==deep){deep=nd;if(habitat){habitat.root.scale.z=deep;habitat.root.updateMatrix();}if(tunnel){release(tunnel.root);tunnel.dispose();tunnel=null;}if(dome){release(dome.root);dome.dispose();dome=null;}topologyChanged=true;}}
    // 실제 크기 비율(2026-11-19) — 가장 큰 개체가 수조 폭의 절반을 넘지 않게 한 칸의 cm 를 정한다. 바뀌면 있는 몸을 모두 같은 비율로
    {const maxCm=approvedFish.reduce((mx,f)=>Math.max(mx,fishCm(f)),0),unit=sizeUnitFor(maxCm,WORLD.width*wide);
     if(Math.abs(unit-sizeUnit())>sizeUnit()*.005){setSizeUnit(unit);for(const f of approvedFish){const s=swimmers.get(f.id);if(!s)continue;const cm=fishCm(f),shown=realLength(cm),k=shown/Math.max(.001,s.shown??s.length);s.length=Math.max(fishLength(cm,f.family),shown);s.shown=shown;s.scale*=k;s.root.scale.setScalar(s.scale);}topologyChanged=true;}}
    schools=schoolsOf(approvedFish);
    for(const[id,m]of swimmers)if(id>=0&&!ids.has(id)){dropFish(m);swimmers.delete(id);topologyChanged=true;}
    for(const f of approvedFish){const key=fishArtKey(f),old=swimmers.get(f.id),morph=fishMorph(next.aquarium,f);if(old?.key===key&&(old.morph??null)===morph)continue;
      topologyChanged=true;
      // 자라서 모습이 바뀌었다 — 지우고 맨 뒤에 새로 넣지 않고 같은 자리(Map 순서)에서 갈아 끼운다(addFish 의 prev). 못 지으면 예전처럼 뺀다
      if(old){try{addFish(f,old);}catch(e){if(swimmers.get(f.id)===old){dropFish(old);swimmers.delete(f.id);}skip(`물고기 ${key}`,e);}continue;}
      try{addFish(f);}catch(e){skip(`물고기 ${key}`,e);}
    }
    // 잡아먹기 소식 — 아직 이 기기에서 안 본 가장 새 것 하나를 다시 그린다(사냥꾼이 아직 수조에 있을 때). 다시 보기 · 개발 장면이면 그 장면을 연다(본 소식 번호는 안 건드린다)
    if(!meal){if(openNext){const o=openNext;openNext=null;if(openMeal(o.item,o.ghostId,o.kind))topologyChanged=true;}else if(huntNews())topologyChanged=true;}
    retainSkins();
    // Preview replaces a moved item or adds one temporary item. Never mutates inventory or shared saves.
    const placed=next.preview?[...next.aquarium.placed.filter(p=>p.id!==next.preview!.id),next.preview]:next.aquarium.placed;
    const placedIds=new Set(placed.map(p=>p.id));for(const[id,m]of decorations)if(!placedIds.has(id)){dropDecor(m);decorations.delete(id);topologyChanged=true;}
    const tints=next.season?.tints??{};
    for(const p of placed){let m=decorations.get(p.id);const tint=tints[p.id]??null;
      if(!m||m.key!==p.key||m.tint!==tint){topologyChanged=true;if(m){dropDecor(m);decorations.delete(p.id);}try{m=addDecor(p);}catch(e){skip(`장식 ${p.key}`,e);continue;}}
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
    // 단계별 볼거리 — 고래 9 · 터널 10 · 돔 11(tunnel.ts 의 기준값 한곳). 정어리 떼(8)는 2026-11-18 걷었다 [사용자: "수조안의 작은 물고기떼 형상도 없애"]
    const wantTunnel=habitatTier>=TUNNEL_TIER&&habitatTier<DOME_TIER,wantDome=habitatTier>=DOME_TIER,wantWhale=habitatTier>=WHALE_TIER;
    if(tunnel&&!wantTunnel){release(tunnel.root);tunnel.dispose();tunnel=null;topologyChanged=true;}
    if(wantTunnel&&!tunnel){tunnel=makeTunnel(deep);scene.add(tunnel.root);topologyChanged=true;}
    const domeKey=`${wide},${deep},${tall}`;
    if(dome&&(!wantDome||dome.root.userData.key!==domeKey)){release(dome.root);dome.dispose();dome=null;topologyChanged=true;}
    if(wantDome&&!dome){const th=HABITAT_THEMES[clamp(habitatTier-1,0,HABITAT_THEMES.length-1)];dome=makeDome({front:3*deep,wide,top:tallY(5.6,tall),water:th.water,high:th.top,art:9,scenery:()=>habitatScenery(habitat)});dome.root.userData.key=domeKey;scene.add(dome.root);topologyChanged=true;}
    // 빛줄기는 모든 수조에, 고래 그림자는 대수족관에만
    const giantKey=`${wide},${deep},${tall},${wantWhale}`;
    if(giants&&giants.root.userData.key!==giantKey){giants.dispose();giants=null;}
    if(!giants&&habitat){giants=makeGiants({halfX:4.6*wide,backZ:deep>1?-3*deep+1.6:-2.2,glassZ:-3*deep,top:tallY(5.4,tall),whale:wantWhale});giants.root.userData.key=giantKey;scene.add(giants.root);}
    const nextIn=!!next.tunnel&&!!(tunnel||dome)&&!next.editing;
    if(nextIn!==inTunnel){inTunnel=nextIn;camera.fov=inTunnel?72:44;camera.updateProjectionMatrix();angle=0;pitch=0;}
    inDome=inTunnel&&!!dome;dome?.setInside(inDome);
    // 터널 · 돔 안에선 위아래 끌기도 고개 돌리기다 — 캔버스의 pan-y(globals.css)면 브라우저가 세로 끌기를 페이지 스크롤로 가져가며 pointercancel 을 쏴서 위아래로 못 둘러봤다(2026-11-11)
    canvas.style.touchAction=inTunnel||photoOn?"none":"";
    {const fov=inDome?DOME_FOV:inTunnel?72:44;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}
    if(moved||topologyChanged)refreshObstacles();
    const rescaled=habitatTier!==tierBefore||wide!==wideBefore||habitatSink!==sinkBefore;
    // 물 속 부유물(murk.ts) — 수조 크기 · 단계마다 한 묶음. 터널 · 돔 안(공기)에는 두지 않는다
    const moteKey=`${wide},${deep},${tall},${habitatTier}`;
    if(motes&&motes.points.userData.key!==moteKey){motes.dispose();motes=null;}
    if(!motes&&habitat){const h=motion.hall,back=tunnelSpan(deep).back,top=h?WORLD.floor+h.h*tall+.2:0;
      motes=makeMotes({halfX:4.5*wide,halfZ:3*deep-.4,bottom:WORLD.floor+.3,top:tallY(4.8,tall)},h?(x,y,z)=>y<top&&(h.kind==="tunnel"?Math.abs(x)<h.r+.2&&z>back-.2:Math.hypot(x,z)<h.r+.2):undefined);
      motes.points.userData.key=moteKey;scene.add(motes.points);}
    const theme=HABITAT_THEMES[clamp(next.aquarium.tank-1,0,HABITAT_THEMES.length-1)];waterTheme.set(theme.water);waterTopC.set(theme.top);
    // 계절 수조 행사(seasonfx.ts) — 물 위 그림 하나(꽃잎 · 빗방울 물결 · 낙엽 · 살얼음 반짝임) · 여름 거품 · 명절 장식 빛 · 겨울 수면 얼음빛
    const evKeys=next.season?.keys??[],evFx=evKeys.map(k=>eventDef(k)?.fx);
    const surf=(["petal","rain","leaf","frost"] as SurfaceFx[]).find(k=>evFx.includes(k))??null;
    const surfKey=surf&&habitat?`${surf}|${moteKey}`:"";
    if(seasonLayer&&seasonLayer.points.userData.key!==surfKey){seasonLayer.dispose();seasonLayer=null;}
    if(!seasonLayer&&surf&&habitat){const h=motion.hall;
      // 돔은 수면 가까이 솟아 있다 — 돔 둘레 안(공기)엔 두지 않는다. 터널은 바닥 가까이라 수면과 안 겹친다
      seasonLayer=makeSurfaceFx(surf,{halfX:4.5*wide,halfZ:3*deep-.4,bottom:WORLD.floor+.3,top:tallY(4.75,tall)},h&&h.kind!=="tunnel"?(x,z)=>Math.hypot(x,z)<h.r+.3:undefined);
      seasonLayer.points.userData.key=surfKey;scene.add(seasonLayer.points);}
    const hk=evFx.includes("heat")&&habitat?moteKey:"";
    if(heat&&heatKey!==hk){heat.points.removeFromParent();heat.points.geometry.dispose();(heat.points.material as T.Material).dispose();heat=null;heatKey="";}
    if(!heat&&hk){const hall=motion.hall,hx=4.2*wide,hz=Math.max(.6,3*deep-.9);
      heat=bubbleStream({count:80,origin:i=>{let x=(((i*.618034)%1)*2-1)*hx,z=(((i*.414214+.13)%1)*2-1)*hz;
        if(hall&&hall.kind!=="tunnel"){const r=Math.hypot(x,z);if(r<hall.r+.4){const k=(hall.r+.4)/Math.max(.01,r);x*=k;z*=k;}}return[x,z] as const;},
        bottom:WORLD.floor+.25,top:tallY(4.75,tall),size:[.1,.22],speed:[.45,1.05],seed:11,opacity:.6});
      heatKey=hk;scene.add(heat.points);}
    const holiday=evKeys.map(k=>eventDef(k)).find(d=>d?.fx==="glow");
    const gk=holiday&&habitat?holiday.key:"";
    if(glow&&glowKey!==gk){glow.dispose();glow=null;glowKey="";}
    if(!glow&&gk&&holiday){glow=makeDecorGlow([holiday.decor.glow??holiday.decor.tint,holiday.decor.tint]);glowKey=gk;scene.add(glow.points);}
    if(glow){const spots:[number,number,number,number][]=[];for(const d of decorations.values()){const s=d.root.scale.x;spots.push([d.root.position.x,d.root.position.y+.9*s,d.root.position.z,5*s]);}glow.setSpots(spots);}
    if(evFx.includes("frost")){waterTopC.lerp(ICE,.45);waterTheme.lerp(ICE,.16);}
    // 물을 갈았다(물 값이 오른다) — 여기선 목표만 두고 draw 가 2~3초에 걸쳐 따라간다. 처음 · 수조가 바뀜 · 더러워지는 쪽 · 움직임 줄이기 · 멈춘 그리기는 바로
    const wGoal=clamp(next.aquarium.water,0,100);
    if(waterShown<0||rescaled||reduced.matches||!active||wGoal<=waterShown)waterShown=wGoal;
    const lightBefore=lightKey;applyLight(next.light??null);
    waterGoal=wGoal;applyWater(rescaled||waterHab<0||lightBefore!==lightKey);
    if(topologyChanged)retopo(!rescaled);
    // 장식이 옮겨졌다 — 안 움직이는 묶음도 한 번 다시 올린다
    if(moved)for(const b of batches)b.ready=false;
    // 돌아가는 중엔 다음 프레임에 맡긴다 — 화면이 다시 그려질 때마다 한 장 더 그리면서 물고기 방향이 튀었다
    if(!active)draw(0);schedule();
  }
  function draw(dt:number){
    // 크기를 재기 전(300×150) · 셰이더를 다 짓기 전에는 그리지 않는다 — 첫 장에 프로그램 열 개를 메인 스레드에서 짓느라 멈췄다
    if(disposed||!sized||!compiled)return;
    // 장면이 끝났다 — 그 동안 들어온 안 본 잡아먹기 소식을 바로 연다(다시 보기 중 실제 사냥이 있었으면 끝나자마자)
    if(recheck&&!meal){recheck=false;if(huntNews())retopo(true);}
    // 장면이 끝난 임시 사냥꾼 — 카메라가 물러난 뒤에 뺀다. 시계가 서 있으면(움직임 줄이기 · 멈춘 그리기) 바로
    for(let r=leaving.length-1;r>=0;r--){const L=leaving[r];L.t+=dt;if(tempHunterGone(L.t,povK,mealK,dt===0||reduced.matches)){leaving.splice(r,1);dropSwimmer(L.id);}}
    // 자란 물고기(addFish 의 prev) — 새 몸(GLB)이 오면(못 받았거나 너무 오래면 임시 몸) 옛 몸을 놓고 새 몸을 보인다.
    //   사냥 장면 중인 둘은 장면이 끝날 때까지 기다린다(턱이 옛 몸 재질에 달려 있다)
    for(const m of swimmers.values()){const g=m.grow;if(!g?.old)continue;g.wait+=dt;const id=m.root.userData.id as number;
      if(meal&&meal.t0>=0&&(meal.predId===id||meal.ghostId===id))continue;
      if(m.glb||!m.glbKey||m.glbFail||g.wait>GROW_WAIT){dropFish(g.old);g.old=null;m.root.visible=true;batchesDirty=true;}}
    if(batchesDirty){batchesDirty=false;rebuildBatches();}
    // 물을 갈았다 — 보여 주는 물 값이 2~3초에 걸쳐 따라 맑아진다. 멈춘 그리기 · 움직임 줄이기는 바로
    if(waterGoal>=0&&waterShown!==waterGoal){waterShown=dt>0&&!reduced.matches?waterShown+(waterGoal-waterShown)*Math.min(1,dt*1.8):waterGoal;if(Math.abs(waterGoal-waterShown)<.3)waterShown=waterGoal;applyWater(waterShown===waterGoal);}
    renderer.info.reset();
    // 카메라는 물고기 자리를 다 옮긴 뒤에 놓는다(2026-11-11) — 예전엔 이 블록이 물고기보다 먼저 돌아 지난 프레임 자리를 따라가서, 따라가기 확대에서 물고기가 한 프레임씩 늦게 떨렸다.
    //   블록은 그대로 두고 함수로 감싸 아래(자리 · 방향 · 그림자 다음)에서 부른다
    // 사냥 장면 동안은 카메라가 먹이를 따라간다(멀리서 작게 지나가지 않게)
    // 모델을 기다리는 동안(t0 < 0)은 장면이 아직 아니다 — 먹이를 코앞에서 따라가지 않는다
    const sel=state.editing?undefined:(meal&&meal.t0>=0?swimmers.get(meal.style==="gulp"&&meal.bitesDone>0?meal.predId:meal.ghostId):undefined)??swimmers.get(state.selectedFish??-1);
    const placeCamera=()=>{
    // 사진 모드의 확대 — 터널 · 돔 안은 시야각으로(걷는 자리 · 고개는 그대로). 밖은 아래에서 거리로(밖의 거리는 시야각에서 다시 재므로 시야각을 바꾸면 상쇄된다)
    {const base=inDome?DOME_FOV:inTunnel?72:44,fov=photoOn&&inTunnel?base*photoZoom:base;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}
    // 어항 폭이 화면에 다 들어오는 거리 — 늘린 어항 · 세로 전체 보기에서도 양옆이 잘리지 않는다. 안개도 같이 물러난다
    // 2026-11-14 — 단계마다 수조가 커져(가로 최대 2.9배 × 넓히기 1.5배) 다 담으면 세로 화면에서 물고기가 점이 된다. 카메라는 가로를 크기의 0.4제곱만큼만 담고(6단계 1.44배 — 물러난 만큼 넓어진 게 보인다)
    //   나머지는 옆으로 끌어 둘러본다(panReach). 가만히 두면 천천히 한쪽 끝에서 다른 끝까지 흘러간다. 높이는 다 담는다(세로 끌기는 페이지 스크롤이라)
    // 수조 전체 보기(2026-11-21 [사용자: "수조 전체뷰를 만들어줘 전체적으로 넓게 볼 수 있는 뷰 그게 메인이어야해"]) — 가로를 다(5·wide) 담는다. 앞유리 앞 3·깊이도 더해 앞모서리가 안 잘리게
    const over=state.overview!==false;
    const half=Math.tan(camera.fov*Math.PI/360),fitW=over?(5*wide*1.04)/(half*camera.aspect)+3*deep:5*wideBase*tierX**.4/(half*camera.aspect)+3,fitH=over?(5.9*tall*1.04)/half+3*deep:5.9*tall/half+3;
    // 자유롭게 보기(2026-11-14) — 두 손가락 · 휠로 당기고 민다(userZoom). 다가간 만큼 옆으로 더 끌 수 있다(panReach 가 camD 로 다시 잰다)
    // 앞유리(z = 3·깊이) 밖에서 본다 — 앞뒤로 늘린 수조에서 카메라가 물속에 들어가지 않게(2026-11-19)
    const camD=Math.max(3*deep+3,(over?clamp(Math.max(fitW,fitH),19,400):clamp(Math.max(fitW,fitH)/tankDisplay(habitatTier,wideBase),19,80))*userZoom);
    // 가까이 보기 거리(전체 보기가 아닐 때의 camD) — 해변 가까이 보기는 이 거리로 다가간다(2026-11-23 — 전체 보기에서 camD 가 400 까지 늘어 해변이 멀리 보였다)
    const closeD=Math.max(3*deep+3,clamp(Math.max(5*wideBase*tierX**.4/(half*camera.aspect)+3,5.9*tall/half+3)/tankDisplay(habitatTier,wideBase),19,80)*userZoom);
    // 멀리 물러나도 수조 뒤까지 그린다(예전 끝면 110 은 큰 수조 전체 보기에서 뒷벽을 잘랐다)
    // 전체 보기의 내려다보기 — 가로로 긴 수조는 세로 화면에서 가는 띠가 되고 위아래가 빈다. 그만큼 위에서 비스듬히 내려다봐 바닥(앞뒤 깊이)까지 보이게(디오라마처럼).
    //   수조가 화면보다 가로로 길수록 더 높이(0.08 ~ 0.55 rad). 작은 수조는 거의 정면 그대로. 터널 · 돔 안 · 가까이 보기는 안 함
    const overEl=over&&!inTunnel&&!inDome?clamp(.5*(1-camera.aspect*(11.8*tall)/(10*wide)),habitat?.beachRest?BEACH_OVER_EL:.08,.55):0; // 모래사장이 있으면 해변 윗면(물 위)이 보이게 조금 더 내려다본다 — 수평에 가까우면 앞 절벽이 쉬는 펭귄 · 물범을 가린다
    overK=dt>0?overK+((over?1:0)-overK)*Math.min(1,dt*2):(over?1:0);
    // 수조 칸의 모양 — 화면 비율과 상관없이 정한다(화면이 이 값으로 칸을 바꾸면 위의 내려다보기 각이 바뀌니 둘이 서로를 흔들지 않게). 0.3 rad 내려다볼 때의 앞모습 + 여유
    if(over&&!inTunnel&&!inDome){const r=(10*wide*1.04)/((11.8*tall*Math.cos(.3)+6*deep*Math.sin(.3))*1.08);if(Math.abs(r-shapeSent)>.02){shapeSent=r;events.shape?.(r);}}
    {const far=Math.max(110,camD+6*deep+40);if(Math.abs(camera.far-far)>1){camera.far=far;camera.updateProjectionMatrix();}}
    panReach=Math.max(0,5*wide+.3-camD*half*camera.aspect*.96);panPerPx=2*camD*half*camera.aspect/Math.max(1,canvas.clientWidth);
    if(dt>0&&!start&&!sel&&!reduced.matches&&panReach>0&&elapsed-lastTouch>8)pan+=(panReach*.9*Math.sin(elapsed*.03)-pan)*Math.min(1,dt*.35);
    pan=clamp(pan,-panReach,panReach);const camX=pan;
    // 깊이 안개 — 수조는 camD±3 에 있다. 예전 camD+1 ~ +19 는 뒤쪽에도 11% 밖에 안 걸려 깊이가 안 보였다
    // 고른 물고기 따라가기(2026-11-10) — 물고기를 누르면 카메라가 천천히 다가가 따라간다. 수조 전체에선 구피가 몇 픽셀이라 무엇을 골랐는지 안 보였다.
    // 멈춘 그리기(draw(0) — 움직임 줄이기 · 숨김)에선 바로 그 자리로
    // 해변 보기(2026-11-18 [사용자: "해변을 사용자가 더 편하게 볼 수 있게"]) — 물고기를 고르지 않았으면 모래사장 물가로 다가가 수면 위에서 내려다본다
    const beachOn=!sel&&!!state.beach&&!state.editing&&!inTunnel&&!inDome&&!!habitat?.beachRest;
    const goal=sel||beachOn?1:0;
    // 깊은 수조(10 · 11단계 깊이 2.4배)는 물고기가 앞뒤 ±6.6 까지 간다 — ±2.4 로 자르면 뒤쪽 물고기 대신 빈 물을 따라갔다. 수조 앞뒤 끝(3·깊이)에서 조금 안쪽까지
    const zReach=3*deep-.6;
    focusK=dt>0?focusK+(goal-focusK)*Math.min(1,dt*2.2):goal;
    const selBreach=sel?breaches.get(sel.root.userData.id):undefined;
    // 2026-11-17 — 바위 · 모래사장(수면 위)에서 쉬는 포유류를 고르면 예전엔 4.6 까지만 봐서 그 아래 물속을 봤다
    if(sel){focusGoal.copy(sel.root.position);const standUp=(sel.course.upright??0)*shownLength(sel)*.38;focusGoal.x=clamp(focusGoal.x,-4.7*wide,4.7*wide);focusGoal.y=clamp(focusGoal.y+standUp,WORLD.floor+.8,selBreach?(selBreach.plan.surface+selBreach.plan.peak)/2:Math.max(tallY(4.6,tall),Math.min(sel.root.position.y+.15+standUp,tallY(5.56,tall)+1.6*tall)));focusGoal.z=clamp(focusGoal.z,-zReach,zReach);focusLen=shownLength(sel);}
    if(beachOn&&habitat?.beachRest){const bz=3*deep*BEACH_REST_FRONT*.75,sx=habitat.shoreX?habitat.shoreX(tallY(5.56,tall),bz):4*wide,rx=habitat.beachRest.x*wide;focusGoal.set(Math.min(4.6*wide,(sx+rx)/2),tallY(5.8,tall),bz);focusLen=closeD*.55/3.4;}
    beachK=dt>0?beachK+((beachOn?1:0)-beachK)*Math.min(1,dt*1.8):beachOn?1:0;
    focusLook.lerp(focusGoal,dt>0?Math.min(1,dt*3.5):1);
    {const up=(sel&&!state.editing&&sel.root.position.y>tallY(4.4,tall))||beachOn?1:0;aboveK=dt>0?aboveK+(up-aboveK)*Math.min(1,dt*1.8):up;}
    // 사냥 장면 — 먹이 한 마리가 아니라 사냥꾼의 입과 먹이의 가운데를, 둘이 다 들어오는 거리에서, 둘을 잇는 선의 옆에서(hunt.ts 의 huntShot)
    let shotAng:number|null=null,shotElev=0;
    if(meal&&meal.t0>=0&&mealPredS&&mealGhost&&!state.editing){const Pp=mealPredS.root.position,G=mealGhost.root.position,r=mealPredS.length*mouthReach(mealPredS.family);mealFwd.set(1,0,0).applyQuaternion(mealPredS.root.quaternion);
      const sh=huntShot(Pp.x+mealFwd.x*r,Pp.y+mealFwd.y*r,Pp.z+mealFwd.z*r,G.x,G.y,G.z,mealPredS.length,mealGhost.length,angle);
      focusGoal.set(clamp(sh.x,-4.2*wide,4.2*wide),clamp(sh.y,WORLD.floor+.8,tallY(4.6,tall)),clamp(sh.z,-zReach,zReach));focusLen=sh.dist/3.4;
      // 가리는 것 비키기 — 장면 둘이 아닌 물고기(구)와 장식 · 바위(기둥) 사이로 시선이 지나는 각을 고른다(예전엔 곁의 대문어 · 난파선이 화면을 통째로 막기도 했다)
      fillBlockers(undefined);
      // 물고 나면 자리를 굳힌다 — 곁을 지나는 물고기 하나에 뜯는 도중 카메라가 반대편으로 넘어갔다
      meal.camPick=meal.bitesDone>0&&meal.camPick?meal.camPick:clearShot(focusGoal.x,focusGoal.y,focusGoal.z,sh.dist,sh.dist*(.07+1/Math.max(1,camD)),sh.angle,meal.camPick,mealBlockers);shotAng=meal.camPick.angle;shotElev=meal.camPick.elev;}
    // 고른 물고기 따라가기도 가리는 것을 비킨다(2026-11-12) — 광어 · 가오리 같은 바닥 물고기는 앞의 대문어 · 바닥 장식에 가려 통째로 안 보였다.
    //   기준은 사용자가 끈 각(angle) — 끌면 그 각에서 다시 고른다(예전 자리를 붙들면 끌어도 안 돌았다). 터널 · 돔은 보는 곳이 정해져 있어 안 한다
    else if(sel&&!state.editing&&!inTunnel&&!inDome){
      const nd=Math.min(camD*.65,Math.max(3.6,focusLen*3.4))*(selBreach?1.55:1);if(Math.abs(angle-followBase)>.02){followPick=null;followBase=angle;}
      fillBlockers(sel);followPick=clearShot(focusGoal.x,focusGoal.y,focusGoal.z,nd,(1+pitch*10)*nd/camD,angle,followPick,mealBlockers);shotAng=followPick.angle;shotElev=followPick.elev;}
    else followPick=null;
    mealK=dt>0?mealK+((shotAng!==null?1:0)-mealK)*Math.min(1,dt*1.6):shotAng!==null?1:0;
    if(shotAng!==null){mealAng=dt>0?mealAng+(shotAng-mealAng)*Math.min(1,dt*2):shotAng;mealElev=dt>0?mealElev+(shotElev-mealElev)*Math.min(1,dt*2):shotElev;}
    // 자유롭게 보기의 끝(2026-11-14) — 많이 돌리고 다가가면 카메라가 앞유리 안 · 옆벽 밖으로 나가 벽 뒷면만 보였다. 시선이 늘 앞유리로 들어오게 각을 묶는다
    //   (앞유리 앞 2 칸에 서고, 옆벽 끝 모서리보다 바깥으로 돌지 않는다). 터널 · 돔은 따로 본다
    if(!inTunnel&&!inDome){const lim=Math.min(1.1,Math.atan((5*wide)/(3*deep))*.92,Math.acos(clamp((3*deep+2)/Math.max(1,camD),-1,1)));angle=clamp(angle,-lim,lim);}
    const camA=angle+(mealAng-angle)*mealK-beachK*BEACH_VIEW_YAW;
    const near=Math.min(camD*.65,Math.max(3.6,focusLen*3.4));let dist=camD+(near-camD)*focusK;
    // 사진 모드 확대(밖) — 앞유리 안으로는 못 들어간다(photo.ts photoDistance). 안개도 이 거리를 따라간다
    if(photoOn&&!inTunnel)dist=photoDistance({dist,zoom:photoZoom,angle:camA,deep,following:focusK>.5});
    lookAt.set(camX,tallY(-.1,tall),0).lerp(focusLook,focusK);
    // 안개 끝은 늘린 깊이만큼 뒤로(2026-11-23) — 앞뒤로 늘린 수조는 뒤쪽 최대 37% 가 안개 색에 묻혀 그쪽 물고기가 사라졌다. 깊이 1 이면 예전 그대로
    if(scene.fog instanceof T.Fog){scene.fog.near=dist-2;scene.fog.far=dist+9+3*Math.max(0,deep-1);}
    const scale=dist/camD;
    if(inDome){
      // 돔 안 — 가운데에 서서 천천히 한 바퀴 둘러보고(1바퀴 약 5분), 끌면 그쪽으로 돈다. 물고기를 고르면 그쪽을 본다
      const eye=WORLD.floor+DOME_EYE,yaw=domeYaw+elapsed*.021,up=DOME_UP+pitch*(pitch<0?DOME_DOWN:3.2);
      camera.position.set(0,eye,0);
      lookAt.set(Math.sin(yaw)*10,eye+Math.tan(up)*10,-Math.cos(yaw)*10).lerp(focusLook,focusK*.85);
      if(scene.fog instanceof T.Fog){scene.fog.near=3;scene.fog.far=12+6*deep;}
    }else if(inTunnel){
      // 터널 안 — 천천히 오가며 걷고, 끌면 고개를 돌린다(좌우 · 위아래). 물고기를 고르면 그쪽을 올려다본다
      const span=tunnelSpan(deep),eye=WORLD.floor+1.2,len=span.front-span.back-3.2;
      const walkZ=span.front-1.2-(.5-.5*Math.cos(elapsed*.028))*len;
      const yaw=angle*2.6,up=TUNNEL_UP+pitch*(pitch<0?TUNNEL_DOWN:3.2);
      camera.position.set(0,eye,walkZ);
      lookAt.set(Math.sin(yaw)*10,eye+Math.tan(up)*10,walkZ-Math.cos(yaw)*10).lerp(focusLook,focusK*.85);
      if(scene.fog instanceof T.Fog){scene.fog.near=3;scene.fog.far=12+6*deep;}
    }else{const el=mealK*mealElev+aboveK*ABOVE_ELEV+beachK*(BEACH_VIEW_ELEV-ABOVE_ELEV)+overK*overEl*(1-focusK)*(1-beachK)*(1-mealK),ce=Math.cos(el);camera.position.set(lookAt.x+Math.sin(camA)*camD*scale*ce, lookAt.y+(1+pitch*10)*scale+(meal&&meal.t0>=0?mealK*dist*.07:0)+Math.sin(el)*dist,lookAt.z+Math.cos(camA)*camD*scale*ce);} // 사냥 장면은 조금 위에서 — 바닥 장식 너머로
    // 사냥꾼 시점(다시 보기) — 사냥꾼 눈 자리(머리 옆)에서 먹이를 본다. 사냥꾼의 주둥이 · 벌어지는 턱이 화면 한쪽에 걸린다
    // 시점으로 들어가고 나올 때 부드럽게(povK) — 예전엔 장면이 끝나는 순간 카메라가 밖으로 툭 튀었다
    // 사냥꾼이 제 길로 돌아가기 시작하면(back) 시점에서 빠진다 — 돌아가는 길이 빨라(초당 10 칸 남짓) 카메라가 못 따라가 빈 물만 보였다
    const povGoal=meal&&meal.pov&&meal.t0>=0&&mealPredS&&!state.editing&&povBack<.05?1:0;
    povK=dt>0?povK+(povGoal-povK)*Math.min(1,dt*2.5):povGoal;
    if(povGoal&&mealPredS){const P=mealPredS.root.position,L=mealPredS.length;povFwd.set(1,0,0).applyQuaternion(mealPredS.root.quaternion);povFwd.y*=.5;povFwd.normalize();
      // 옆 눈 자리 — 머리 옆(아가미 높이)에서 앞을 본다. 위에서 보면 먹이가 주둥이 밑에 가렸다. 옆은 장면을 연 때 카메라가 있던 쪽으로 굳힌다
      if(!povOn){povSide.set(-povFwd.z,0,povFwd.x);if(povSide.lengthSq()<1e-6)povSide.set(1,0,0);if(povSide.dot(camera.position.clone().sub(P))<0)povSide.negate();}
      else{const hl=Math.hypot(povFwd.x,povFwd.z);
        // 거의 곧게 위아래를 보면(수면의 먹이를 덮칠 때) 옆 방향이 0 에 가까워 카메라가 몸속으로 들어갔다 — 그땐 옆 방향을 그대로 둔다
        if(hl>.35){const sd=Math.sign(povSide.x*-povFwd.z+povSide.z*povFwd.x)||1;povSide.set(-povFwd.z*sd/hl,0,povFwd.x*sd/hl);}}
      povSide.normalize();
      // 몸 굵기를 한 번 잰다 — 몸길이로만 띄우면 넓적한 메기 · 문어는 카메라가 몸속에 들어가 아무것도 안 보였다
      if(!povOn){povBox.setFromObject(mealPredS.root);povBox.getSize(povSize);povR=Math.max(povSize.y,Math.min(povSize.x,povSize.z))*.5;}
      // 어깨 너머로 넓게(2026-11-13) — 사냥꾼 몸 · 먹이가 다 들어오는 거리만큼 뒤 · 옆 · 조금 위로 물러난다(hunt.ts replayShot)
      const swallowed=meal!.style==="gulp"&&meal!.bitesDone>0;
      const shotAt=(turn:number)=>{const c=Math.cos(turn),s=Math.sin(turn);return replayShot({p:P,fwd:povFwd,side:{x:povSide.x*c-povSide.z*s,y:0,z:povSide.x*s+povSide.z*c},len:L,r:povR,prey:mealGhost&&!swallowed?mealGhost.root.position:null,fov:camera.fov,aspect:camera.aspect,halfW:5*wide-.35,top:tallY(4.3,tall),floor:WORLD.floor+.6,back:-3*deep+.5,front:inDome?3*deep-.3:undefined});}; // 돔 안 — 앞 바다 그림 벽(3·깊이+0.08) 너머로 나가면 그 판만 보였다
      // 멀리 물러나니 카메라와 장면 사이를 지나는 다른 물고기 · 장식이 화면을 막았다(디스커스가 상어를 통째로 가렸다) — 옆에서 ±30° · ±57° 돌린 자리 중 덜 가린 곳.
      // 물고 나면 자리를 굳히고, 지금 자리보다 한참(0.6) 나을 때만 옮긴다(곁을 지나는 물고기 하나에 넘어가지 않게 — 평소 사냥 카메라 clearShot 과 같은 문턱)
      if(!povOn)povTurn=0;
      if(!(meal!.bitesDone>0)){let best=povTurn,bs=Infinity,cur=Infinity;for(const d of [0,-.5,.5,-1,1]){const t=shotAt(d),sc=blockedBy(t.eye.x,t.eye.y,t.eye.z,t.target.x,t.target.y,t.target.z,mealBlockers)+Math.abs(d)*.15;if(d===povTurn)cur=sc;if(sc<bs-1e-9){bs=sc;best=d;}}if(cur>bs+.6)povTurn=best;}
      const shot=shotAt(povTurn);
      povDist=shot.dist;povEye.set(shot.eye.x,shot.eye.y,shot.eye.z);povTarget.set(shot.target.x,shot.target.y,shot.target.z);
      // 너무 올려다보지 않는다(30° 까지) — 수면 · 뚜껑 유리를 보던 프레임이 있었다
      {const hd=Math.hypot(povTarget.x-povEye.x,povTarget.z-povEye.z);povTarget.y=Math.min(povTarget.y,povEye.y+hd*.58);}
      if(!povOn||dt===0){povCam.copy(povEye);povLook.copy(povTarget);povOn=true;}
      else{povCam.lerp(povEye,Math.min(1,dt*7));povLook.lerp(povTarget,Math.min(1,dt*6));}}
    // 빠져나오는 동안엔 돌아가는 사냥꾼을 눈으로 따라간다 — 멈춘 곳을 계속 보면 빈 물만 지나갔다
    if(!povGoal&&povK>.002&&dt>0&&mealPredS)povLook.lerp(mealPredS.root.position,Math.min(1,dt*5));
    if(povK>.002){camera.position.lerp(povCam,povK);lookAt.lerp(povLook,povK);
      if(scene.fog instanceof T.Fog){scene.fog.near+=(povDist*.35-scene.fog.near)*povK;scene.fog.far+=(povDist+9+4*deep-scene.fog.far)*povK;}} // 안개도 물러난 거리만큼 — 예전 값(0.6 ~ 11)이면 넓게 본 장면 끝이 물빛에 묻혔다
    // 탁한 물 — 안개가 더 가까이서 시작해 더 빨리 짙어진다(멀리 있는 물고기 · 장식이 물빛에 묻힌다). 위 세 갈래(밖 · 돔 · 터널)가 정한 거리를 줄인다
    if(murkK>.001&&scene.fog instanceof T.Fog){const f=scene.fog,span=f.far-f.near;f.near=Math.max(.5,f.near-1.5*murkK);f.far=f.near+span*(1-.45*murkK);}
    // 뜯는 순간 화면이 흔들린다(0.3초) — 움직임 줄이기면 없음
    {const k=Math.max(0,1-(elapsed-shakeAt)/.3);if(k>0&&!reduced.matches){camera.position.x+=Math.sin(elapsed*90)*.09*k;camera.position.y+=Math.cos(elapsed*77)*.07*k;}}
    camera.lookAt(lookAt);camera.updateMatrixWorld();
    // 피가 퍼진 물 — 물빛(안개)이 붉게 물들었다가 천천히 가신다
    bloodLevel=Math.max(0,bloodLevel-dt*.12);
    if(scene.fog instanceof T.Fog)scene.fog.color.copy(fogBase).lerp(BLOOD_FOG,bloodLevel*.045);
    };
    WATER_LIGHT.aquaTime.value=elapsed;
    // 1) 이번 프레임 길 → 늘리기 → 겹침 밀기 → 모래에 앉히기(fishstep.ts — 테스트와 같은 식)
    motion.feed=motion.feed&&elapsed-motion.feed.t<40?motion.feed:null;
    // 계절 헤엄 빠르기(2026-11-18, aquaevent.swimPaceAt) — 물고기 길은 수조 시계(elapsed)가 아니라 물고기 시계(fishT)로 계산한다.
    //   fishT 는 dt × 빠르기를 쌓아 가므로 빠르기가 바뀌어도 자리가 이어진다(elapsed × 빠르기는 바뀌는 순간 길이 통째로 다른 시각으로 뛴다).
    //   사냥 장면 · 놀람 · 뛰어오르기 · 먹이 알갱이는 elapsed 그대로 — 이번 프레임 길이 낸 자리(motion.positions)를 받아 쓰므로 어느 시계든 맞물린다.
    //   빠르기는 30초마다 다시 읽는다(하루에 0.6% 안쪽으로만 바뀐다). 멈춘 그리기(dt 0 — 움직임 줄이기 · 꾸미기 · 사진)는 시계가 서 있다
    if(dt>0){if(paceAt<0||elapsed-paceAt>=30){paceAt=elapsed;pace=paceDev>0?paceDev:swimPaceAt(gameClock());}fishT+=dt*pace;}
    // 먹이는 실제 초로 — 알갱이(food.ts)가 실제 초로 가라앉고 사라지므로, 길 함수가 보는 먹이 시각을 '지금 물고기 시계 − 먹이 준 뒤 실제 초'로 옮긴다(길의 tau = 실제 초)
    const fishFeed=motion.feed?(feedShift.t=fishT-(elapsed-motion.feed.t),feedShift.x=motion.feed.x,feedShift):null;
    guestTick(dt);
    // 모래사장(8단계부터) — 물고기는 물가 안쪽, 포유류는 모래사장에서 쉰다(fishstep 이 buffers 에서 읽는다)
    motion.shore=habitat?.shoreX;motion.beach=habitat?.beachRest?{x:habitat.beachRest.x*wide,z:3*deep*BEACH_REST_FRONT,r:2,h:habitat.beachRest.top-WORLD.floor,kind:"beach"}:undefined;
    stepFish(swimmers,schools,id=>swimmers.get(id)?.length,fishT,dt,{wide,tall,deep,heightAt,obstacles:motion.obstacles,feed:fishFeed,hall:motion.hall},motion);
    // 순서가 바뀐 뒤 첫 프레임 — 지난 화면 자리와 새 길의 차이를 남기고 1초에 걸쳐 줄인다(relayoutMotion). 멈춘 그리기 · 움직임 줄이기는 바로 새 자리
    if(hand.armed){hand.armed=false;hand.left=0;if(dt>0&&!reduced.matches){const n=Math.min(motion.count,hand.has.length);for(let j=0;j<n;j++)for(let c=0;c<3;c++)hand.d[j*3+c]=hand.has[j]?hand.from[j*3+c]-motion.positions[j*3+c]:0;hand.left=1;}}
    if(hand.left>0){hand.left=dt>0?Math.max(0,hand.left-dt/HANDOFF_S):0;const w=hand.left*hand.left*(3-2*hand.left),n=Math.min(motion.count,hand.has.length)*3;for(let j=0;j<n;j++)motion.positions[j]+=hand.d[j]*w;}
    // 사냥꾼 곁의 작은 물고기는 달아나고 사냥꾼은 다가간다(hunt.ts — 길 위의 보정만)
    // 사냥 장면의 둘은 빼고(busy) — 다른 사냥꾼이 장면 속 먹이에 몰려들지 않게
    if(motion.busy.length<motion.count)motion.busy=new Uint8Array(Math.max(1,motion.count));motion.busy.fill(0);
    if(breaches.size){let j=0;for(const id of swimmers.keys()){if(breaches.has(id)&&j<motion.count)motion.busy[j]=1;j++;}}
    if(meal&&meal.t0>=0){let j=0;for(const id of swimmers.keys()){if(id===meal.predId||id===meal.ghostId)motion.busy[j]=1;j++;}}
    // 행사 손님은 쫓지도 쫓기지도 않는다(huntPass 가 busy 를 건너뛴다 — 사냥꾼이 다가가지 않고, 손님 곁 물고기도 달아나지 않는다)
    if(guest){let j=0;for(const id of swimmers.keys()){if(id===GUEST_ID)motion.busy[j]=1;j++;}}
    // 장면이 벌어지는 자리 둘레의 다른 물고기는 비켜난다(물기 전엔 먹이 자리, 문 뒤엔 입 자리 — 지난 프레임 값)
    let scare:{x:number;y:number;z:number;r:number}|undefined;
    if(meal&&meal.t0>=0){const pr=swimmers.get(meal.predId),bit=meal.bitesDone>0;if(pr){huntScare.x=bit?meal.mx:meal.bx;huntScare.y=bit?meal.my:meal.by;huntScare.z=bit?meal.mz:meal.bz;huntScare.r=pr.length*1.2+1.5;scare=huntScare;}}
    if(motion.count>1&&motion.preds.length>=motion.count)huntPass(motion.positions,motion.lengths,motion.preds,motion.flee,motion.count,dt,motion.pinned,motion.fear,motion.busy,scare);
    // 겁에 질린 먹잇감은 꼬리를 빨리 치고, 먹잇감에 다가가는 사냥꾼은 꼬리를 거의 안 흔들고 미끄러진다
    if(motion.fear.length>=motion.count&&dt>0&&!reduced.matches){let j=0;for(const m of swimmers.values()){const f=motion.fear[j++];if(f)m.phase+=dt*m.course.effort*(tailBeat(f)-1);}}
    // 만지면 놀란다 — 길 위의 자리에 달아난 만큼을 더하고(유리 · 모래 · 수면 안), 머리를 달아나는 쪽으로, 꼬리를 세게
    startleNow.clear();
    if(startles.size){let j=0;for(const[id,m]of swimmers){const st=startles.get(id);if(st&&j<motion.count){const t=elapsed-st.t0;
      if(t>=startleDuration(st.kind)||reduced.matches||(meal&&(id===meal.predId||id===meal.ghostId)))startles.delete(id);
      else{const pose=startlePose(st.kind,t,st.side),L=motion.lengths[j],P=motion.positions,H=motion.heading,k=j*3;
        let x=P[k]+st.dir.x*pose.dash*L,y=P[k+1]+st.dir.y*pose.dash*L,z=P[k+2]+st.dir.z*pose.dash*L;
        const mx=5*wide-L*.5,mz=3*deep-L*.4;x=clamp(x,-mx,mx);z=clamp(z,-mz,mz);
        // 땅에서 — 쉬던 높이(땅에서 뜬 만큼)를 지키며 모래 위를 따라가고 통통 튄다. 물가 밖(뭍)에 남는다
        if(st.kind==="galumph"){const lift=P[k+1]-heightAt(P[k],P[k+2]);if(habitat?.shoreX)x=Math.max(x,habitat.shoreX(waterTop(),z)+L*.5);y=heightAt(x,z)+Math.max(0,lift)+pose.hop*L;}
        else y=clamp(y,heightAt(x,z)+L*.06,tallY(4.6,tall));
        P[k]=x;P[k+1]=y;P[k+2]=z;
        if(st.kind!=="ink"&&st.kind!=="pulse"&&pose.rush>0){const w=pose.rush*.85;H[k]=H[k]*(1-w)+st.dir.x*w;H[k+1]=H[k+1]*(1-w)+st.dir.y*w*.5;H[k+2]=H[k+2]*(1-w)+st.dir.z*w;}
        if(dt>0)m.phase+=dt*Math.max(.6,m.course.effort)*(pose.beat-1);
        if(pose.roll)motion.rolls[j]=(motion.rolls[j]??0)+pose.roll;
        startleNow.set(m,pose);}}j++;}
      // 놀라 튀어 나간 몸도 다른 물고기와 닿지 않게(사냥 장면의 둘은 빼고)
      resolveContacts(motion.positions,motion.lengths,motion.count,{heading:motion.heading,pinned:motion.pinned,skip:motion.busy,scale:wide,deep,top:tallY(4.7,tall),iters:2,rocks:motion.obstacles,tall,ground:heightAt});}
    // 범고래 뛰어오르기 — 길 위의 자리와 섞는다(처음 0.25초 · 끝 1.4초), 공중에선 꼬리를 멈추고 몸을 비튼다
    if(breaches.size){let j=0;for(const[id,m]of swimmers){const br=breaches.get(id);if(br&&j<motion.count){const t=elapsed-br.t0,pl=br.plan;
      // 원래 길로 돌아가기(2026-11-20) — 재주 동안에도 길은 계속 갔다(쉼터로 오르는 중일 수도 있다). 예전엔 정해진 시간(약 2초)에 섞어 멀리 간 길로 미끄러져 날아갔다.
      //   이제 마지막 재주 자리에서 길 쪽으로 몸길이 1.3배/초 안의 빠르기로 머리부터 헤엄쳐 가고, 닿으면 끝낸다(멀면 시간을 더 쓴다)
      const P0=motion.positions,k0=j*3,Lb=motion.lengths[j],near=br.last?Math.hypot(P0[k0]-br.last[0],P0[k0+1]-br.last[1],P0[k0+2]-br.last[2]):0;
      if(reduced.matches||(meal&&(id===meal.predId||id===meal.ghostId))||(t>=pl.total&&near<Lb*.05)||t>=pl.total+20)breaches.delete(id);
      else if(br.last&&(t>=pl.total||pl.at(t).phase==="back")){const P=P0,H=motion.heading,k=k0,last=br.last;
        const dx=P[k]-last[0],dy=P[k+1]-last[1],dz=P[k+2]-last[2],d=Math.hypot(dx,dy,dz),step=Lb*1.3*Math.max(0,dt),f=d>step&&d>1e-6?step/d:1;
        const nx=last[0]+dx*f,ny=last[1]+dy*f,nz=last[2]+dz*f,close=clamp(1-d/(Lb*.6),0,1);
        if(d>1e-6){const hx=dx/d,hy=dy/d*.5,hz=dz/d;H[k]=H[k]*close+hx*(1-close);H[k+1]=H[k+1]*close+hy*(1-close);H[k+2]=H[k+2]*close+hz*(1-close);}
        P[k]=nx;P[k+1]=ny;P[k+2]=nz;last[0]=nx;last[1]=ny;last[2]=nz;if(dt>0)m.phase+=dt*Math.max(.6,m.course.effort)*.4;}
      else{const b=pl.at(t),P=motion.positions,H=motion.heading,k=j*3,w=b.w,L=motion.lengths[j];
        P[k]=P[k]*(1-w)+b.x*w;P[k+1]=P[k+1]*(1-w)+b.y*w;P[k+2]=P[k+2]*(1-w)+b.z*w;
        H[k]=H[k]*(1-w)+b.hx*w;H[k+1]=H[k+1]*(1-w)+b.hy*w;H[k+2]=H[k+2]*(1-w)+b.hz*w;
        br.last=[P[k],P[k+1],P[k+2]];
        if(b.air){m.phase=br.holdPhase;}else{if(dt>0)m.phase+=dt*Math.max(.6,m.course.effort)*(b.beat-1);br.holdPhase=m.phase;}
        if(b.roll)motion.rolls[j]=(motion.rolls[j]??0)+b.roll;
        // 물보라 — 계획의 때마다 한 번씩(나갈 때 · 들어올 때 · 해달의 톡톡)
        while(br.fired<pl.splashes.length&&t>=pl.splashes[br.fired].t){const sp=pl.splashes[br.fired++];splash.burst(sp.x,sp.z,pl.surface,L*sp.scale,elapsed,sp.enter,Math.sign(b.hx)||1,sp.amount);}
        // 솟구칠 때 · 들어온 뒤 · 빙글 돌 때 꼬리에서 거품 줄
        if(b.trail&&elapsed>=br.trailAt){br.trailAt=elapsed+.05;splash.trail(P[k]-b.hx*L*.45,P[k+1]-b.hy*L*.45,P[k+2],L,elapsed,pl.surface);}}}j++;}}
    // 고래 숨(2026-11-18 [사용자: "고래들 움직임 특성을 줘야해"]) — 숨 쉬러 수면에 머리가 닿으면 숨구멍에서 물안개 기둥이 솟는다. 고래마다 10초에 한 번까지.
    //   혹등 · 귀신고래는 두 갈래(V 자), 향유고래는 앞 왼쪽으로 비스듬히, 나머지는 곧게. 움직임 줄이기 · 터널 · 돔 안에선 안 한다
    feedWhaleSharks();
    if(dt>0&&!reduced.matches&&!inTunnel&&!inDome){const top=waterTop();for(const[id,m]of swimmers){if(!SPOUTERS.test(m.family))continue;const L=shownLength(m),p=m.root.position;spoutFwd.set(1,0,0).applyQuaternion(m.root.quaternion);
      const hx=p.x+spoutFwd.x*L*.32,hy=p.y+spoutFwd.y*L*.32+L*.08,hz=p.z+spoutFwd.z*L*.32;
      if(hy>top-L*.12&&hy<top+L*.6&&elapsed-(spouted.get(id)??-99)>10){spouted.set(id,elapsed);splash.spout(hx,hz,top,L,elapsed,m.family==="sperm_whale"?-.35:0,m.family==="humpback_whale"||m.family==="gray_whale");}}}
    // 펭귄 질주(2026-11-26 habits 의 burst) — 날개를 세차게 저어 내달리는 동안 깃털 사이 공기가 꼬리 쪽으로 거품 줄을 남긴다. 움직임 줄이기면 안 한다
    if(dt>0&&!reduced.matches){let top=0;for(const[id,m]of swimmers){if((m.course.burst??0)<.4||elapsed<(burstAt.get(id)??0))continue;if(!top)top=waterTop();burstAt.set(id,elapsed+.06);const L=shownLength(m),p=m.root.position;spoutFwd.set(1,0,0).applyQuaternion(m.root.quaternion);splash.trail(p.x-spoutFwd.x*L*.42,p.y-spoutFwd.y*L*.42,p.z-spoutFwd.z*L*.42,L*1.1,elapsed,top);}}
    if(splash.active)splash.step(elapsed,renderer.domElement.height*.9);
    // 먹이 알갱이 — 새 먹이면 물고기가 모이는 자리에 뿌리고, 먹이 쪽으로 온 물고기 입에 닿은 알은 먹힌다(food.ts). 움직임 줄이기면 한 장면
    if(motion.feed&&motion.feed!==foodFeed){foodFeed=motion.feed;food.drop(motion.feed.t,motion.feed.x,{top:tallY(4.75,tall),deep,floorAt:foodFloor});}
    food.step(elapsed,dt,motion,reduced.matches);
    // 쫓기 → 실제 입 접촉 → 점차 힘을 잃음 → 가라앉으며 소멸. 전신 축소 없음.
    let mealGhost:Swimmer|null=null,mealPredS:Swimmer|null=null,mealLock=false,mealGone=0,mealGrip=0,mealSwallow=0,mealVitality=1;
    if(meal){const pred=swimmers.get(meal.predId),ghost=swimmers.get(meal.ghostId);
      // 움직임 줄이기로 바뀌면 장면을 바로 끝낸다 — 시계가 서서 영영 안 끝났다
      if(!pred||!ghost||reduced.matches)finishMeal();
      else{
        // 두 모델(GLB)이 다 온 뒤에 연다 — 임시 모델에 턱을 달면 갈아 끼울 때 턱이 사라지고 첫 1초를 임시 몸으로 놀았다(최대 MEAL_WAIT_MAX 초 기다린다)
        if(meal.t0<0){meal.wait+=dt;if(mealReady(!pred.glbKey||pred.glb,!ghost.glbKey||ghost.glb,meal.wait)){meal.t0=elapsed;preyPhase=ghost.phase;mealSurfaces.set(ghost.root,mealSurface(ghost.root,meal.style==="gulp"));warmBursts();if(!meal.wrap)meal.jaw=addJaw(pred.root,jawFor(pred.family));if(meal.predId<=TEMP_HUNTER_ID&&!pred.root.visible){pred.root.visible=true;batchesDirty=true;}}}
        if(meal.t0>=0){const pose=mealPose(elapsed-meal.t0,meal.style);let pi=-1,gi=-1,j=0;for(const id of swimmers.keys()){if(id===meal.predId)pi=j;if(id===meal.ghostId)gi=j;j++;}
        if(pi>=0&&gi>=0){const P=motion.positions,H=motion.heading,calm=reduced.matches;
          // 쫓기 — 먹이는 제 길(달아나는 중)을 가고 사냥꾼이 따라붙는다
          // 숨어 기다리기(가물치 · 쏘가리 · 아귀) · 튕기기(뱀장어 · 갈치) — 사냥꾼은 그 자리에 멈춰 떠 있고, 먹이가 모르고 그 앞으로 흘러든다
          const lying=meal.style==="ambush"||meal.style==="strike";
          // 숨은 자리가 모래 위(장식 · 바위 틈)면 덮치기 전에 몸을 일으켜 떠오른다 — 그대로 두면 어느 쪽에서 봐도 장식에 가려 장면이 안 보였다(뱀장어 · 쏘가리)
          if(elapsed===meal.t0){meal.lx=P[pi*3];meal.ly0=P[pi*3+1];meal.lz=P[pi*3+2];meal.ly=Math.max(meal.ly0,heightAt(meal.lx,meal.lz)+1.3+pred.length*.1);}
          if(lying&&!pose.bit){
            const k=Math.min(1,(elapsed-meal.t0)/1.3),e=k*k*(3-2*k),ly=meal.ly0+(meal.ly-meal.ly0)*e,fx=P[gi*3]-meal.lx,fy=P[gi*3+1]-ly,fz=P[gi*3+2]-meal.lz,fl=Math.hypot(fx,fy,fz)||1,want=pred.length*1.15;
            // 먹이는 화면 옆쪽에서 흘러든다 — 제 방향 그대로 오면 카메라 쪽으로 와서 덮치는 순간이 정면(머리만)으로 보였다. 지난 프레임 시선(viewH)의 옆, 먹이가 이미 있는 쪽으로
            const rx=-viewH.z,rz=viewH.x,sd=fx*rx+fz*rz<0?-1:1,ddx=rx*sd*.92+fx/fl*.3,ddz=rz*sd*.92+fz/fl*.3,dd=Math.hypot(ddx,ddz)||1;
            const tx=meal.lx+ddx/dd*want,ty=ly+fy/fl*want*.5,tz=meal.lz+ddz/dd*want;
            P[gi*3]+=(tx-P[gi*3])*e;P[gi*3+1]+=(ty-P[gi*3+1])*e;P[gi*3+2]+=(tz-P[gi*3+2])*e;
            P[pi*3]=meal.lx;P[pi*3+1]=ly;P[pi*3+2]=meal.lz;
            if(!calm&&pose.chase===0)pred.phase-=dt*pred.course.effort*.85;}
          if(!pose.bit){meal.bx=P[gi*3];meal.by=P[gi*3+1];meal.bz=P[gi*3+2];if(!calm)ghost.phase+=dt*16*(lying?.3:pose.chase);preyPhase=ghost.phase;}
          const sx=meal.bx,sy=meal.by,sz=meal.bz,px=P[pi*3],py=P[pi*3+1],pz=P[pi*3+2];
          // 덮치는 방향은 위아래 ATTACK_PITCH(약 20°)까지 — 위에서 곧게 내리꽂으면 옆에서 보는 카메라엔 정수리만 보이고 먹이가 머리 밑에 가렸다(모래 위 광어를 위에서 덮칠 때).
          //   먹이가 바로 밑이라 수평 방향이 없으면 사냥꾼이 보던 쪽으로. 두족류는 위에서 덮는다
          let fdx=sx-px,fdz=sz-pz,fl2=Math.hypot(fdx,fdz);if(fl2<1e-3){fdx=H[pi*3]||1;fdz=H[pi*3+2];fl2=Math.hypot(fdx,fdz)||1;}
          const dl3=Math.hypot(sx-px,sy-py,sz-pz)||1,pa=clamp(Math.atan2(sy-py,fl2),-ATTACK_PITCH,ATTACK_PITCH),cp=Math.cos(pa);
          const ux=meal.wrap?(sx-px)/dl3:fdx/fl2*cp,uy=meal.wrap?(sy-py)/dl3:Math.sin(pa),uz=meal.wrap?(sz-pz)/dl3:fdz/fl2*cp,reach=pred.length*mouthReach(pred.family);
          // 숨어 있는 동안도 머리는 먹이를 본다 · 튕기기 전엔 몸을 뒤로 당긴다
          const hold=pose.bit?1-pose.back:pose.chase,aim=lying&&!pose.bit?1:hold;
          // 사냥꾼 — 먹이 앞에 붙어(입 = 몸길이 0.46 배 앞) 머리를 좌우로 세차게 흔든다(물 방향을 수평으로 돌린다)
          // 흔들기 — 좌우(yaw)만 흔들면 옆에서 보는 카메라엔 머리가 앞뒤로 들락거릴 뿐이라, 위아래로 치켜 흔들기(toss)를 같이 섞는다(몸 전체가 가운데를 축으로 돌아서 .5 면 꼬리가 반대로 시소처럼 튀었다 — .28)
          const yaw=calm?0:pose.shake*(meal.wrap?.15:.38),toss=calm||meal.wrap?0:pose.shake*.28,cy=Math.cos(yaw),syw=Math.sin(yaw),hy=uy+toss;
          const hx=ux*cy-uz*syw,hz=ux*syw+uz*cy;
          const ax=sx-ux*reach,ay=sy-uy*reach,az=sz-uz*reach;
          const startX=pose.bit?px:meal.lx,startY=pose.bit?py:lying?meal.ly:meal.ly0,startZ=pose.bit?pz:meal.lz;
          P[pi*3]=startX+(ax-startX)*hold;P[pi*3+1]=Math.max(startY+(ay-startY)*hold,heightAt(P[pi*3],P[pi*3+2])+pred.length*.14);P[pi*3+2]=startZ+(az-startZ)*hold;
          if(pose.crouch>0&&!calm){const c=pose.crouch*pred.length*.28;P[pi*3]-=ux*c;P[pi*3+2]-=uz*c;}
          if(aim>.05){H[pi*3]=H[pi*3]*(1-aim)+hx*aim;H[pi*3+1]=H[pi*3+1]*(1-aim)+hy*aim;H[pi*3+2]=H[pi*3+2]*(1-aim)+hz*aim;}
          if(pose.held&&!calm)pred.phase+=dt*(meal.style==="gulp"?3:14); // 사냥꾼 꼬리도 세차게(삼키는 쪽은 느긋하게)
          // 비틀어 돌기(뱀장어 · 갈치 · 아로와나) — 물고 몸째 돈다
          if(pose.roll&&!calm)motion.rolls[pi]=pose.roll;
          // 입 자리 — 흔드는 머리 끝
          const mx=P[pi*3]+hx*reach,my=P[pi*3+1]+hy*reach-(meal.wrap?pred.length*.22:0),mz=P[pi*3+2]+hz*reach;
          // 통째로 삼키기 — 입이 활짝 열리는 순간 입 앞의 물이 알갱이째 입속으로 빨려 든다(예전엔 먹이만 작아져 무엇이 일어나는지 안 보였다)
          if(meal.style==="gulp"&&!meal.sucked&&!calm&&pose.jaw>.6){meal.sucked=true;meal.bursts.push(makeBurst(mx,my,mz,Math.max(.6,pred.length*.5),"suck",fogBase,elapsed,{x:hx,y:uy,z:hz},Math.max(ghost.length*2,pred.length*.6)));}
          if(pose.held){
            // 입에 물린 먹이 — 머리 흔들기의 반대로 휘둘리고, 몸은 입에 가로로 물려 꼬리를 미친 듯이 퍼덕인다
            const sw=calm?0:-pose.shake*ghost.length*(meal.wrap?.1:.35),nx=-hz,nz=hx;
            if(meal.style==="gulp"){
              // 원래 크기 그대로 머리부터 입의 절단 평면 안으로 이동한다.
              const sk=ghost.length*(.45-pose.swallow*1.1);
              P[gi*3]=mx+hx*sk;P[gi*3+1]=my+uy*sk;P[gi*3+2]=mz+hz*sk;H[gi*3]=H[gi*3]*(1-pose.grip)-hx*pose.grip;H[gi*3+1]=H[gi*3+1]*(1-pose.grip)-uy*pose.grip;H[gi*3+2]=H[gi*3+2]*(1-pose.grip)-hz*pose.grip;
              // A sideways arc prevents an opposing heading blend crossing
              // through a zero vector (instant 180-degree flip at half grip).
              const arc=Math.sin(pose.grip*Math.PI)*.35;H[gi*3]-=hz*arc;H[gi*3+2]+=hx*arc;
              motion.rolls[gi]=calm?0:Math.sin(elapsed*14)*.16*pose.vitality;
            }else{
            // 머리를 입에 박힌 채 몸이 아래로 늘어져 퍼덕인다 — 예전엔 입에 가로로 물려(nx, nz) 옆에서 보는 카메라 쪽을 향해 머리만 보였다.
            //   몸은 머리 흔들기의 반대로 휘둘리고(sw), 꼬리 쪽이 앞뒤로 버둥댄다(flail — 늘 0.24~0.66 이라 몸 방향이 곧게 위로 서지 않는다)
            const hang=ghost.length*.12*pose.grip,flail=calm?0:Math.sin(elapsed*13)*.22*pose.vitality;void nx;void nz;
            P[gi*3]=mx+hx*sw*.4;P[gi*3+2]=mz+hz*sw*.4;P[gi*3+1]=Math.max(my-hang+(calm?0:Math.sin(elapsed*31)*.03),heightAt(P[gi*3],P[gi*3+2])+ghost.length*.1);
            H[gi*3]=hx*(.8+flail);H[gi*3+1]=.25*pose.grip;H[gi*3+2]=hz*(.8+flail);
            motion.rolls[gi]=calm?0:pose.roll+Math.sin(elapsed*13)*.28*pose.vitality;}
            if(!calm)preyPhase+=dt*18*pose.vitality;
            ghost.phase=preyPhase;
            meal.mx=P[gi*3];meal.my=P[gi*3+1];meal.mz=P[gi*3+2];
            // 뜯을 때마다 — 피가 터지고 살점이 흩어진다
            while(meal.bitesDone<pose.bites){meal.bitesDone++;if(!meal.tint)meal.tint=fleshTint(ghost);
              const size=Math.max(.35,ghost.length*.8);
              // 삼키는 쪽은 입가에 피 조금 · 살점 없음(통째로 넘어간다)
              if(meal.style==="gulp"){bloodLevel=Math.min(1,bloodLevel+.12);meal.bursts.push(makeBurst(mx,my,mz,size*.45,"blood",meal.tint,elapsed));continue;}
              shakeAt=elapsed;bloodLevel=Math.min(1,bloodLevel+.4);
              meal.bursts.push(makeBurst(mx,my,mz,size*(meal.bitesDone===1?1:.8),"blood",meal.tint,elapsed),makeBurst(mx,my,mz,size*.22,"chunk",meal.tint,elapsed));}
          }else if(pose.bit&&meal.style!=="gulp"){
            // 놓았다 — 갈가리 찢긴 먹이가 뒤집혀 피 꼬리를 남기며 가라앉는다
            ghost.phase=preyPhase;
            P[gi*3]=meal.mx+pose.sink*.16;P[gi*3+2]=meal.mz+Math.sin(pose.sink*Math.PI)*.06;
            P[gi*3+1]=Math.max(heightAt(P[gi*3],P[gi*3+2])+ghost.length*.12,meal.my-pose.sink*1.6);
            H[gi*3]=hx;H[gi*3+1]=.25*(1-pose.sink);H[gi*3+2]=hz;
            motion.rolls[gi]=Math.PI*.9*pose.sink;
            if(pose.sink<.6&&Math.floor(pose.sink*10)>Math.floor((pose.sink-dt/2.6)*10)&&meal.tint)meal.bursts.push(makeBurst(P[gi*3],P[gi*3+1],P[gi*3+2],Math.max(.2,ghost.length*.35),"blood",meal.tint,elapsed));
          }
          meal.jaw?.set(calm?Math.min(.4,pose.jaw):pose.jaw);
          mealGhost=ghost;mealPredS=pred;mealLock=pose.held&&!calm;povBack=pose.back;mealGone=meal.style==="gulp"?pose.swallow:pose.fade;mealGrip=pose.held?pose.grip:0;mealSwallow=pose.swallow;mealVitality=pose.vitality;
          for(const bu of meal.bursts)animateBurst(bu,elapsed);}
        if(pose.done)finishMeal();}}}
    for(let r=lingeringBursts.length-1;r>=0;r--){const b=lingeringBursts[r];if(elapsed-b.t0>5.3||reduced.matches){dropBurst(b);lingeringBursts.splice(r,1);}else animateBurst(b,elapsed);}
    if(!meal&&!lingeringBursts.length)dropBurstMats();
    // 2) 자리 · 방향 · 그림자
    let i=0;
    // 수평 시선 — 몸을 카메라 쪽으로 덜 돌려 옆모습을 보인다(sideon.ts)
    camera.getWorldDirection(viewTmp);{const l=Math.hypot(viewTmp.x,viewTmp.z)||1;viewH.x=viewTmp.x/l;viewH.z=viewTmp.z/l;}
    for(const m of swimmers.values()){const x=motion.positions[i*3],y=motion.positions[i*3+1],z=motion.positions[i*3+2];m.root.position.set(x,y,z);
      direction.set(motion.heading[i*3],motion.heading[i*3+1],motion.heading[i*3+2]).normalize();{const inMeal=m===mealGhost||m===mealPredS,so=inMeal?0:sideOnOf(m.family)*(breaches.has(m.root.userData.id)?0:1);if(so>0){faceSide(direction,viewH,so,m,dt,SIDE_HOLD_OF[m.family]??SIDE_HOLD,SIDE_SWITCH_OF[m.family]??SIDE_SWITCH_S);limitPitch(direction,viewH);}}side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      // 새로 들어온 물고기만 바로 맞춘다 — 다른 물고기까지 맞추면 모양이 바뀔 때마다 전부 방향이 튀었다
      // 돌 때 안쪽으로 살짝 기운다(최대 10°) · 바닥 물고기는 비탈만큼 옆으로
      // 산갈치가 쉬는 동안 몸을 세운다(habits 의 stand — 머리가 위, 약 80°)
      if(m.course.stand)targetQuat.multiply(standQ.setFromAxisAngle(SIDE_AXIS,m.course.stand*1.4));
      // 바다코끼리가 모래에서 먹이를 찾는 동안 주둥이를 박는다(habits 의 nose — 머리가 아래로, 약 29°)
      if(m.course.nose)targetQuat.multiply(standQ.setFromAxisAngle(SIDE_AXIS,-m.course.nose*.5));
      targetQuat.multiply(bankQ.setFromAxisAngle(FORWARD,bankAngle(m.course.turn)+(motion.rolls[i]??0)));
      // 사냥 장면의 둘은 계산한 몸 방향 그대로 — 옆모습 돌리기(sideon)와 느린 따라 돌기(초당 2.8)가 머리 흔들기를 10% 로 죽이고 입 자리를 옮겨, 먹이가 입 옆에 떠 있었다
      const qk=m===mealGhost||m===mealPredS?(mealLock?1:dt*10):dt*2.8;
      if(dt===0||m.fresh||qk>=1){m.root.quaternion.copy(targetQuat);m.fresh=false;}else m.root.quaternion.slerp(targetQuat,Math.min(1,qk));
      // 뛰어오르는 범고래는 몸이 가는 쪽을 빨리 따른다(솟구침 · 포물선)
      if(dt>0&&breaches.has(m.root.userData.id))m.root.quaternion.slerp(targetQuat,Math.min(1,dt*7));
      const sp=startleNow.get(m);
      if(m!==mealGhost){if(sp&&sp.bend)m.animate(m.phase,1,{...m.course,turn:m.course.turn+sp.bend});else m.animate(m.phase,1,m.course);}
      else if(mealVitality>0)m.animate(m.phase,1,{...m.course,dt:dt*mealVitality,turn:0,speed:mealVitality,effort:mealVitality,amp:mealVitality,hover:0});
      // 자란 물고기 — 새 몸을 기다리는 동안은 옛 몸이 그 자리 · 방향으로 헤엄치고, 바꾼 뒤엔 옛 크기에서 1초에 걸쳐 새 크기로(멈춘 그리기는 바로)
      if(m.grow){const g=m.grow;
        if(g.old){g.old.root.position.copy(m.root.position);g.old.root.quaternion.copy(m.root.quaternion);g.old.animate(m.phase,1,m.course);}
        else{g.k=dt>0?Math.min(1,g.k+dt/GROW_S):1;const e=g.k*g.k*(3-2*g.k);m.root.scale.setScalar(m.scale*(g.from+(1-g.from)*e));if(g.k>=1){m.root.scale.setScalar(m.scale);m.grow=undefined;}}}
      // 놀란 복어는 부푼다(startle.ts — 끝나면 원래 크기)
      else if(sp&&sp.puff!==1){m.root.scale.setScalar(m.scale*sp.puff);m.puffed=true;}
      else if(m.puffed){m.root.scale.setScalar(m.scale);m.puffed=false;}
      // 원래 크기를 유지한다. 소멸은 복제 재질에서만 처리한다.
      if(m===mealGhost)m.root.scale.setScalar(m.scale);
      // 행사 손님 — 유리 밖에서 들어오는 동안 몸이 자란다(w 0.35 까지) · 나갈 땐 거꾸로. 유리 밖에 걸친 몸이 거의 안 보인다
      if(m.visit&&m.root.visible)m.root.scale.setScalar(m.scale*guestSize(x,m.length));
      if(i<fishShadows.instanceMatrix.count){const floorY=habitat?.heightAt(x,z)??WORLD.floor,h=Math.max(0,y-floorY),s=shownLength(m)*(.75+h*.06);
        shadowDummy.position.set(x,floorY+.02,z);shadowDummy.rotation.set(0,Math.atan2(-direction.z,direction.x),0);const visibility=m===mealGhost?1-mealGone:meal&&meal.t0<0&&meal.predId<=TEMP_HUNTER_ID&&m.root.userData.id===meal.predId?0:1;const gv=m.visit?(m.root.visible?guestSize(x,m.length):0):1;shadowDummy.scale.set(s*visibility*gv,1,s*.5*visibility*gv);shadowDummy.updateMatrix();fishShadows.setMatrixAt(i,shadowDummy.matrix);
        fishShadows.setColorAt(i,shadowTint.setRGB(0,clamp(1-h*.1,.15,1),0));}
      i++;
    }
    // Resolve contact AFTER body pose/bones/scale, not from a guessed body length.
    if(meal&&mealPredS&&mealGhost&&meal.t0>=0){
      const pred=mealPredS,ghost=mealGhost;pred.root.updateWorldMatrix(true,true);
      oralForward.set(1,0,0).applyQuaternion(pred.root.quaternion).normalize();
      if(!faceMouth(pred.root,contact))contact.set(pred.length*mouthReach(pred.family)/pred.scale,meal.wrap?-pred.length*.22/pred.scale:0,0).applyMatrix4(pred.root.matrixWorld);
      if(mealGrip>0){
        contactShift.copy(contact).sub(ghost.root.position);
        if(meal.style==="gulp")contactShift.addScaledVector(oralForward,ghost.length*(.45-mealSwallow*1.1));
        else contactShift.y-=ghost.length*.12;
        ghost.root.position.addScaledVector(contactShift,mealGrip);
        meal.mx=ghost.root.position.x;meal.my=ghost.root.position.y;meal.mz=ghost.root.position.z;
      }
      mealSurfaces.get(ghost.root)?.update(contact,oralForward,meal.style==="gulp"?(mealSwallow>=1?1:0):mealGone,meal.bitesDone>0?1:0,ghost.length*.16,mealGrip>0);
      for(const burst of meal.bursts)if(burst.t0===elapsed){const origin=mealLock||burst.kind==="suck"?contact:ghost.root.position;burst.x=origin.x;burst.y=origin.y;burst.z=origin.z;animateBurst(burst,elapsed);}
      if(meal.wrap){let grip=armGrips.get(pred.root);if(!grip){grip=makeMealGrip(pred.root);armGrips.set(pred.root,grip);}grip(ghost.root.position,ghost.length,mealGrip);}
    }
    puffs.update(motion.courses,motion.positions,motion.lengths,motion.count,reduced.matches);
    // 계절 행사 — 거품은 시계로, 빗방울 물결은 움직임 줄이기면 숨긴다(멈춘 물결 고리는 얼룩으로 보인다)
    heat?.update(elapsed);if(seasonLayer)seasonLayer.points.visible=!(seasonLayer.kind==="rain"&&reduced.matches);
    fishShadows.count=Math.min(i,fishShadows.instanceMatrix.count);fishShadows.instanceMatrix.needsUpdate=true;if(fishShadows.instanceColor)fishShadows.instanceColor.needsUpdate=true;
    placeCamera();
    fadeOccluders(sel&&!state.editing&&!photoOn?sel:undefined,dt);
    for(const d of decorations.values())d.animate(elapsed);
    habitat?.animate(elapsed);tunnel?.animate(elapsed);dome?.animate(elapsed);giants?.animate(elapsed);
    const selected=state.editing?decorations.get(state.preview?.id??state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected&&state.editing&&!photoOn; // 물고기를 고르면 둥근 테두리를 안 그린다(2026-11-13 사용자: "물고기 선택했을때 라운드 테두리 없애") — 꾸미기의 장식 표시는 그대로
    if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=(habitat?.heightAt(halo.position.x,halo.position.z)??WORLD.floor)+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar(shownLength(selected as Swimmer)*.65);}}
    scene.updateMatrixWorld();
    for(const b of batches){if(!b.dynamic&&b.ready)continue;b.ready=true;for(let k=0;k<b.originals.length;k++)b.mesh.setMatrixAt(k,b.originals[k].matrixWorld);b.mesh.instanceMatrix.needsUpdate=true;
      // 움직이지 않는 묶음은 올릴 때 경계 구를 다시 재고 화면 밖이면 안 그린다(형상의 경계 구엔 물풀 흔들림 몫이 이미 들어 있다 — glb.ts) · 움직이는 묶음은 그대로 늘 그린다
      if(!b.dynamic){b.mesh.computeBoundingSphere();b.mesh.frustumCulled=true;}}
    // 초점 — 따라가면 그 물고기(배경이 흐려진다). 따라가지 않을 땐 흐림을 끈다(세기가 작으면 섞이는 양은 몇 % 인데 픽셀마다 12쌍을 읽었다)
    // 초점은 자른 자리(focusLook)가 아니라 물고기 몸까지 — 자른 자리와 물고기가 어긋나면 고른 물고기가 흐렸다. 고르기를 풀어 물러나는 동안은 마지막 자리
    const focusDist=focusK>.05?camera.position.distanceTo(mealK>.5?focusLook:sel?sel.root.position:focusLook):inTunnel?10:camera.position.distanceTo(lookAt);
    // 가려진 물고기 윤곽(2026-11-14) [사용자: "물범이 아예 보이지 않아 수초에 가려서 · 이런 문제들은 해결해야해"] — 물고기 몸(뼈 있는 GLB)만 XRAY 레이어에 두면
    //   후처리가 그 깊이를 따로 그려, 수초 · 바위 · 장식 뒤에 있으면 그 자리에 옅은 윤곽을 비춘다. 굴에 숨은 곰치(일부러 숨는다) · 두족류(팔이 셰이더로 움직여 윤곽이 어긋난다)는 뺀다
    // 바뀐 몸만 다시 훑는다(2026-11-23 — 매 프레임 물고기마다 몸 전체를 훑고 정규식 둘을 돌렸다). 켤지 · 자식 수(모델이 갈아 끼워짐)가 그대로면 건너뛴다
    //   1초에 한 번은 모두 다시 훑는다 — 모델이 깊은 곳에서 바뀌어도(자식 수 그대로) 1초 안에 따라온다
    const xraySec=Math.floor(elapsed),xrayAll=xraySec!==xrayLastSec;xrayLastSec=xraySec;
    for(const m of swimmers.values()){const ud=m.root.userData as {xrayOk?:boolean;xrayOn?:boolean;xrayN?:number};if(ud.xrayOk===undefined)ud.xrayOk=!XRAY_SKIP.test(m.family)&&!/jelly/.test(m.key);
      const on=m.root.visible&&ud.xrayOk,n=m.root.children.length;if(!xrayAll&&ud.xrayOn===on&&ud.xrayN===n)continue;ud.xrayOn=on;ud.xrayN=n;
      m.root.traverse(o=>{if((o as T.Mesh).isMesh){if(on)o.layers.enable(XRAY_LAYER);else o.layers.disable(XRAY_LAYER);}});}
    postNow.render(scene,camera,elapsed,{distance:focusDist,strength:focusK>.02?focusK*(inTunnel?.45:.8):0},inTunnel||inDome?undefined:XRAY_LAYER);
    if(!announced){announced=true;events.ready?.();}
    if(process.env.NODE_ENV!=="production"){
      host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.fish=String(swimmers.size);host.dataset.decor=String(decorations.size);
      host.dataset.postBytes=String(postNow.bytes());host.dataset.postLevel=String(postLevel);host.dataset.programs=String(renderer.info.programs?.length??0);
      host.dataset.time=elapsed.toFixed(2);host.dataset.season=[seasonLayer?.kind??"",heat?"heat":"",glow?`glow:${glow.points.geometry.drawRange.count}`:""].filter(Boolean).join(",");host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.normalsFixed=String(normalsFixed);host.dataset.meal=meal?`${meal.predId}>${meal.ghostId}:${meal.bitesDone}${meal.t0<0?":wait":""}`:"";host.dataset.mealSeen=String(mealSeen);host.dataset.pace=pace.toFixed(3);host.dataset.guest=guest?`${guest.key}:${guest.t0<0?"wait":(elapsed-guest.t0).toFixed(1)}/${guest.dur.toFixed(0)}`:"";host.dataset.follow=followPick?JSON.stringify(followPick)+" cam "+camera.position.toArray().map(n=>n.toFixed(1)).join(",")+" look "+focusLook.toArray().map(n=>n.toFixed(1)).join(",")+" nb"+mealBlockers.length:"";host.dataset.shot=meal&&mealPredS&&mealGhost?[mealPredS.root.position,mealGhost.root.position,camera.position].map(v=>v.toArray().map(n=>n.toFixed(2)).join(",")).join(" | ")+" pick "+JSON.stringify(meal.camPick)+" n"+mealBlockers.length:"";host.dataset.jaw=meal?.jaw?String(meal.jaw.count):"-";host.dataset.remains=String(remains.length);host.dataset.textures=String(renderer.info.memory.textures);
    }
  }
  // 개발 전용: 창이 숨겨져 rAF 가 멈춰도 시간을 흘려 움직임을 확인한다(host.__aquaStep(초)) — 배포 빌드엔 없다
  if(process.env.NODE_ENV!=="production"){const dev=new Map<Swimmer,Jaw>();(host as HTMLElement&{__aquaJaw?:(v:number)=>void}).__aquaJaw=(v:number)=>{for(const m of swimmers.values()){if(!isPredator(m.family)||huntOf(m.family).style==="wrap")continue;let j=dev.get(m);if(!j){j=addJaw(m.root,jawFor(m.family));dev.set(m,j);}if(v<=0){j.restore();dev.delete(m);}else j.set(v);}};}
  // 개발 전용: 사냥 장면을 바로 다시 본다(host.__aquaHunt("great_white","goldfish"[, true])) — 임시 사냥꾼(id 900000+)을 넣고 가짜 소식으로 장면을 연다. 셋째 값 true 면 다시 보기 카메라(어깨 너머).
  //   이 기기의 '본 소식 번호'는 안 건드린다. 임시 사냥꾼은 음수 id 라 수조 갱신에 안 지워지고 장면이 끝나면 빠진다. 배포 빌드엔 없다
  if(process.env.NODE_ENV!=="production"){let devN=0;(host as HTMLElement&{__aquaHunt?:(pred:string,prey:string,pov?:boolean)=>string}).__aquaHunt=(pred:string,prey:string,pov=false)=>{
    if(meal)return "busy";devN++;const pid=TEMP_HUNTER_ID-100000-devN,a=state.aquarium;
    const fish=[...a.fish,{id:pid,family:pred,stage:2,growH:0,goodH:0,totalH:0} as AquaFish];
    povNext=pov;povBack=0;povOn=false;openNext={item:{n:1e6+devN,id:pid,family:pred,stage:2,ate:{id:-1,family:prey,stage:1}},ghostId:-(1e6+devN),kind:"dev"};
    try{update({...state,aquarium:{...a,fish}});}finally{openNext=null;state={...state,aquarium:a};povNext=false;}
    if(!meal){dropSwimmer(pid);if(!active)draw(0);}
    return meal?huntOf(pred).style:"skipped";};}
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaTime?:()=>number;__aquaCourse?:()=>unknown}).__aquaTime=()=>elapsed;(host as HTMLElement&{__aquaCourse?:()=>unknown}).__aquaCourse=()=>[...swimmers.values()].map((m)=>({family:m.family,jet:m.course.jet??0,rev:m.course.rev??0,amp:m.course.amp,stand:m.course.stand??0,nose:+(m.course.nose??0).toFixed(2),burst:+(m.course.burst??0).toFixed(2),puff:+(m.course.puff??-1).toFixed(2),pos:m.root.position.toArray().map(v=>+v.toFixed(2)),len:+m.length.toFixed(2)}));if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaRocks?:()=>unknown}).__aquaRocks=()=>motion.obstacles.map(o=>({...o})); // 개발 전용: 지금 수조 시각(장면을 정해진 순간으로 넘겨 찍을 때)
  // 개발 전용: 범고래(등 뛰어오르는 물고기)를 누른 것처럼 — host.__aquaBreach() 는 뛰어오른 물고기 id, 없으면 -1
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaBreach?:(family?:string)=>number}).__aquaBreach=(family?:string)=>{for(const[id,m]of swimmers)if(trickOf(m.family)&&(!family||m.family===family)){startleFish(id);events.fish(id);return id;}return -1;};(host as HTMLElement&{__aquaBreachPlan?:()=>unknown}).__aquaBreachPlan=()=>({tall,wide,deep,plans:[...breaches.values()].map(b=>b.plan)});
  // 개발 빌드 — 그 계열 첫 물고기를 누른 것처럼 놀라게 한다(땅에서 쉬는 중이면 통통 걷기). 돌려주는 값은 놀란 몸짓 종류
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaStartle?:(family:string)=>string}).__aquaStartle=(family:string)=>{for(const[id,m]of swimmers)if(m.family===family){startleFish(id);return startles.get(id)?.kind??(breaches.has(id)?"trick":"none");}return "missing";};
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaCam?:()=>unknown}).__aquaCam=()=>({look:lookAt.toArray(),cam:camera.position.toArray(),focusK,beachK,goal:focusGoal.toArray(),tall,wide,deep,fish:[...swimmers.values()].map(m=>[m.family,m.root.position.toArray().map(v=>+v.toFixed(2)),m.root.visible])});
  // 개발 전용: 행사 손님을 바로 부른다(host.__aquaGuest(key?, 초?)) — key 를 안 주면 지금 행사의 손님. 지금 손님 key(없으면 "none") · 빠르기 확인(host.__aquaPace(배율?) — 0 이면 날짜대로)
  if(process.env.NODE_ENV!=="production"){(host as HTMLElement&{__aquaGuest?:(key?:string,sec?:number)=>string}).__aquaGuest=(key?:string,sec=30)=>{const k=key??visitorFor(state.season?.keys??[]);if(!k||reduced.matches)return "none";if(!startGuest(k,Math.max(4,sec)))return "none";if(!active)draw(0);return k;};
    (host as HTMLElement&{__aquaPace?:(k?:number)=>unknown}).__aquaPace=(k?:number)=>{if(k!==undefined){paceDev=Math.max(0,k);paceAt=-1;}return{pace,fishT,elapsed,dated:swimPaceAt(gameClock()),guest:guest?{key:guest.key,t:guest.t0<0?-1:+(elapsed-guest.t0).toFixed(2),dur:+guest.dur.toFixed(1),w:+(swimmers.get(GUEST_ID)?.visit?.w??0).toFixed(3),pos:swimmers.get(GUEST_ID)?.root.position.toArray().map(v=>+v.toFixed(2)),visible:!!swimmers.get(GUEST_ID)?.root.visible}:null};};}
  if(process.env.NODE_ENV!=="production")(host as HTMLElement&{__aquaStep?:(s:number)=>void}).__aquaStep=(sec:number)=>{if(swaps.length)flushSwaps();for(let t=0;t<sec;t+=1/30){elapsed+=1/30;draw(1/30);}};
  /** 점 입자(거품) 크기 — 그리는 버퍼 높이의 절반 */
  // 점은 장면 그림에 찍힌다 — 계단 3(장면 그림 0.75배)이면 그만큼 작게
  const syncPointScale=()=>{WATER_LIGHT.aquaPointScale.value=Math.max(1,canvas.height*postNow.scale()/2);};
  const tick=(time:number)=>{if(!active||disposed)return;
    const raw=lastRaf?time-lastRaf:0;lastRaf=time;const gap=previous?time-previous:0;
    if(!previous||gap>=MIN_FRAME_MS){
      if(swaps.length&&time-lastFlush>=150){lastFlush=time;flushSwaps();}
      const dt=Math.min(gap/1000,.08);previous=time;elapsed+=dt;draw(dt);const ratio=pacer.feed(gap,raw);if(ratio!==null){renderer.setPixelRatio(ratio);syncPointScale();}
      // 해상도 바닥 아래의 후처리 계단(framepace POST_LEVELS) — 바뀐 다음 프레임부터
      if(pacer.level()!==postLevel){postLevel=pacer.level();postNow.setLevel(postLevel);syncPointScale();}
    }else pacer.observe(raw);
    frame=requestAnimationFrame(tick);};
  // 셰이더는 그리기 전에 모아서 짓는다(되는 기기는 백그라운드에서) — 첫 장이 메인 스레드를 붙잡지 않게.
  // ⚠ 실제로 그릴 그림(후처리의 장면 그림 · 반 크기 그림 · 화면)을 묶고 짓는다(post.compile) — 예전엔 아무것도 안 묶은 채 지어 화면용 프로그램이 나왔고, 첫 장에서 전부 다시 지었다.
  //   묶음(인스턴스) 재질도 다른 프로그램이라 먼저 짓는다
  function precompile(){
    if(disposed)return;
    if(batchesDirty){batchesDirty=false;rebuildBatches();}
    void postNow.compile(scene,camera).catch(()=>{}).then(()=>{if(disposed||lost)return;compiled=true;schedule();if(!active)draw(0);});
  }
  function schedule(){const run=!disposed&&!lost&&sized&&compiled&&visible&&!document.hidden&&!reduced.matches&&!state.editing&&!photoOn;
    host.dataset.paused=String(!run);if(active===run)return;active=run;cancelAnimationFrame(frame);previous=0;lastRaf=0;if(run)frame=requestAnimationFrame(tick);
    else requestFlush();
  }
  // 크기만 바뀌면(주소창이 나타났다 사라질 때 · 전체 보기) 돌아가는 중엔 크기만 고친다 — 한 장 더 그리면 모든 물고기 방향이 튀었다
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);syncPointScale();
    const first=!sized;sized=true;if(first)schedule();if(!active)draw(0);};
  observer=new ResizeObserver(resize);observer.observe(host);
  intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;schedule();});intersection.observe(host);
  on(document,"visibilitychange",schedule);on(reduced,"change",schedule);
  // 움직임 줄이기로 바뀌면 한 장 그린다 — 진행 중인 사냥 장면을 끝내고(draw 의 finishMeal) 먹이 · 물을 멈춘 모습으로
  on(reduced,"change",()=>{if(!active)draw(0);});
  // 연결이 끊기면 멈추고 알린다. 브라우저가 되돌려 주면(restored) three 가 자원을 다시 올린다 — 이어서 돈다
  on(canvas,"webglcontextlost",(e:Event)=>{e.preventDefault();lost=true;schedule();if(events.lost)events.lost();else events.error(ERROR_LOST);});
  // 되돌려 받으면 three 가 형상 · 텍스처 · 그림(렌더 타깃 · 깊이 그림)은 다음에 쓸 때 다시 올린다. 직접 다시 지어야 하는 건 둘이다(2026-11-11):
  //   ① 환경광 — PMREM 은 GPU 에서만 구운 그림이라 다시 올릴 원본이 없어 물고기 · 바위에 비치는 빛이 까맣게 됐다 → 다시 굽는다.
  //      옛 텍스처는 dispose 하지 않는다 — 끊기기 전 연결의 three 내부가 들고 있던 것이라 지우면 '다른 연결의 객체' 경고만 나고, 참조를 놓으면 같이 사라진다
  //   ② 셰이더 — 프로그램도 다 사라졌다. 바로 그리면 첫 장에서 전부 메인 스레드로 다시 지어 멈춘다 → 처음 열 때처럼 모아 지은 뒤 돈다
  on(canvas,"webglcontextrestored",()=>{lost=false;batchesDirty=true;
    envMap=underwaterEnvironment(renderer);scene.environment=envMap;
    compiled=false;schedule();precompile();events.restored?.();});
  // 사진 모드 — 한 손가락은 돌리기 · 기울이기(돔은 둘러보기), 두 손가락은 집어 확대. 물고기를 눌러도 고르지 않는다
  const fingers=new Map<number,{x:number;y:number}>();let photoPinch:{gap:number;zoom:number}|null=null;
  const gapOf=()=>{const [a,b]=[...fingers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  const photoView=():PhotoView=>inDome?"dome":inTunnel?"tunnel":"outside";
  const photoNow=():PhotoCam=>({angle,pitch,zoom:photoZoom,yaw:domeYaw});
  function setPhotoCam(next:Partial<PhotoCam>,tell=false):PhotoCam{
    const c=clampPhotoCam({...photoNow(),...next},photoView());angle=c.angle;pitch=c.pitch;photoZoom=c.zoom;domeYaw=c.yaw;
    if(!active)draw(0);if(tell)events.photoCam?.(c);return c;}
  const photoDown=(e:PointerEvent)=>{fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch{/* 이미 놓은 손가락 */}
    if(fingers.size===2){start=null;photoPinch={gap:gapOf(),zoom:photoZoom};}else if(fingers.size===1)start={x:e.clientX,y:e.clientY,angle,pitch,pan,yaw:domeYaw};};
  const photoMove=(e:PointerEvent)=>{if(!fingers.has(e.pointerId))return;fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(photoPinch&&fingers.size>=2){setPhotoCam({zoom:pinchZoom(photoPinch.zoom,photoPinch.gap,gapOf())},true);return;}
    if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(inDome)setPhotoCam({yaw:start.yaw+dx*.006,pitch:start.pitch+dy*.001},true);
    else{pan=clamp(start.pan-dx*.02,-(wide-1)*3,(wide-1)*3);setPhotoCam({angle:start.angle+dx*.003,pitch:start.pitch+dy*.001},true);}};
  const photoUp=(e:PointerEvent)=>{fingers.delete(e.pointerId);if(fingers.size<2)photoPinch=null;
    // 두 손가락에서 하나를 떼면 남은 손가락으로 이어서 돌린다(튀지 않게 지금 자리에서 새로 잰다)
    const rest=[...fingers.values()][0];start=rest?{x:rest.x,y:rest.y,angle,pitch,pan,yaw:domeYaw}:null;};
  // 보통 보기(main 2026-11-14 자유롭게 보기) — 사진 모드면 위의 사진 손잡이가 받는다
  // start 는 draw(placeCamera)에서도 본다(끌고 있는 동안은 저절로 흘러가지 않는다) — 그래서 함수 위에서 미리 선언한 것을 쓴다
  // 자유롭게 보기(2026-11-14) [사용자: "수조에서 자유롭게 볼 수 있도록"] — 예전엔 좌우 ±0.4 rad · 위아래 조금만 돌았다. 이제 밖에서 볼 땐 좌우 ±1.1 rad(옆유리 쪽까지)
  //   · 위아래 더 크게(전체 보기에선 세로로 끌어도 페이지가 안 움직인다 — CSS touch-action) · 두 손가락으로 벌리면 다가가고 모으면 물러난다 · 휠도 같다. 터널 · 돔은 예전 범위
  const pts=new Map<number,{x:number;y:number}>();let pinch:{d:number;z:number}|null=null;
  const pinchD=()=>{const v=[...pts.values()];return v.length<2?0:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);};
  const down=(e:PointerEvent)=>{if(photoOn){photoDown(e);return;}pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2&&!inTunnel){pinch={d:Math.max(1,pinchD()),z:userZoom};start=null;try{canvas.setPointerCapture(e.pointerId);}catch{}return;}
    if(!e.isPrimary)return;lastTouch=elapsed;start={x:e.clientX,y:e.clientY,angle,pitch,pan,yaw:domeYaw};try{canvas.setPointerCapture(e.pointerId);}catch{/* 이미 끝난 손가락 */}};
  const move=(e:PointerEvent)=>{if(photoOn){photoMove(e);return;}if(pts.has(e.pointerId))pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pts.size>=2){userZoom=clamp(pinch.z*pinch.d/Math.max(1,pinchD()),ZOOM_MIN,ZOOM_MAX);lastTouch=elapsed;if(!active)draw(0);return;}
    if(!start)return;const free=!inTunnel&&!inDome;if(inDome)domeYaw=start.yaw+(e.clientX-start.x)*.006;angle=clamp(start.angle+(e.clientX-start.x)*(free?.004:.003),free?-1.1:-.4,free?1.1:.4);pan=clamp(start.pan-(e.clientX-start.x)*panPerPx,-panReach,panReach);lastTouch=elapsed;pitch=clamp(start.pitch+(e.clientY-start.y)*(free?.0016:.001),free?-.18:-.10,free?.34:.13);if(!active)draw(0);};
  const drop=(e:PointerEvent)=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;};
  const cancel=(e:PointerEvent)=>{if(photoOn){photoUp(e);return;}drop(e);start=null;};
  const wheel=(e:WheelEvent)=>{if(photoOn||inTunnel||!(e.ctrlKey||canvas.closest(".is-full")))return; /* 평소 화면에선 휠이 페이지 스크롤이다 — 전체 보기 · 트랙패드 집기(ctrlKey)만 당기기 */e.preventDefault();userZoom=clamp(userZoom*Math.exp(e.deltaY*.0012),ZOOM_MIN,ZOOM_MAX);lastTouch=elapsed;if(!active)draw(0);};
  const end=(e:PointerEvent)=>{if(photoOn){photoUp(e);return;}drop(e);if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(moved>8)return;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
    if(state.editing&&state.placing){const floorHit=habitat?ray.intersectObject(habitat.floor)[0]:null;const point=floorHit?.point??ray.ray.intersectPlane(floorPlane,hitPoint);if(point){const p=worldToDecor(point.x,point.z/deep,wide);events.place(p.x,p.y);}return;}
    const owner=(o:T.Object3D|null)=>{while(o&&!o.userData.type)o=o.parent;return o;};
    if(state.editing){const hit=ray.intersectObjects([...decorations.values()].map(m=>m.root),true)[0],o=hit?owner(hit.object):null;if(o?.userData.type==="decor")events.decor(o.userData.id);return;}
    // 보기 모드는 물고기만 — 장식이 앞에 있으면 장식이 탭을 가로챘다. 치어는 10~14px 이라, 빗나가면 24px 안의 가장 가까운 물고기를 고른다
    // 고를 수 있는 몸만(2026-11-23) — Raycaster 는 숨긴 몸도 맞혀서, 다시 보기를 기다리며 숨긴 사냥꾼 · 사냥 장면의 유령(음수 id) · 숨어 기다리는 손님이
    //   탭을 가로챘다(고른 물고기가 말없이 풀리고 카메라가 안 보이는 사냥꾼을 따라갔다). 사진 고르기(photoPoints)와 같은 거름
    const pickable=(id:number,m:Swimmer)=>id>0&&!m.visit&&!m.root.userData.guest&&m.root.visible;
    const hit=ray.intersectObjects([...swimmers].filter(([id,m])=>pickable(id,m)).map(([,m])=>m.root),true)[0],o=hit?owner(hit.object):null;
    if(o?.userData.guest)return; // 행사 손님 — 고를 수 없다(물고기 목록 · 카드에 없다)
    if(o?.userData.type==="fish"){startleFish(o.userData.id);events.fish(o.userData.id);return;}
    const px=e.clientX-r.left,py=e.clientY-r.top;let best=-1,bestD=24;
    for(const[id,m]of swimmers){if(!pickable(id,m))continue;projected.copy(m.root.position).project(camera);if(projected.z>1)continue;const d=Math.hypot((projected.x+1)/2*r.width-px,(1-projected.y)/2*r.height-py);if(d<bestD){bestD=d;best=id;}}
    if(best>=0){startleFish(best);events.fish(best);}
  };
  on(canvas,"pointerdown",down);on(canvas,"pointermove",move);on(canvas,"pointerup",end);on(canvas,"pointercancel",cancel);on(canvas,"wheel",wheel,{passive:false});
  update(initial);
  // 크기는 바로 한 번 잰다 — ResizeObserver 는 화면이 그려질 때만 와서, 뒤에 숨은 탭에선 첫 크기를 못 받았다(그리기는 셰이더를 다 지은 뒤)
  resize();
  precompile();
  return {
    update,
    /** 잡아먹기 소식 n 을 사냥꾼 시점으로 다시 본다. 사냥꾼이 수조를 떠났으면 잠깐 불러온다(장면이 끝나면 빠진다). 저장 · 본 소식 번호는 안 건드린다 */
    replay(n:number):"ok"|"busy"|"missing"|"reduced"|"skipped"{
      if(disposed)return "skipped";if(photoOn)return "busy";if(meal&&meal.kind==="real")return "busy";if(reduced.matches)return "reduced";
      const a=state.aquarium,item=(a.news??[]).find(x=>x.n===n&&x.ate);if(!item||!item.ate)return "missing";
      // 내 다시 보기가 나오는 중이면 조용히 끝내고 새로 연다(끝 알림을 쏘면 화면이 다시 보기가 끝난 줄 알고 카드 줄을 연다)
      if(meal)finishMeal(true);
      // 사냥꾼은 소식에 적힌 그때 모습으로(hunt.ts replayHunter) — 수조의 그 물고기가 자랐거나 떠났으면 그때 모습으로 잠깐 불러온다
      replayN++;const pick=replayHunter(item,a.fish,TEMP_HUNTER_ID-replayN,fishArtKey);
      const fish=pick.temp?[...a.fish,{...pick.temp,growH:0,goodH:0,totalH:0} as AquaFish]:a.fish;
      povNext=true;povBack=0;povOn=false;openNext={item:{...item,id:pick.id},ghostId:-(2e6+replayN),kind:"replay"};
      try{update({...state,aquarium:{...a,fish}});}finally{openNext=null;state={...state,aquarium:a};povNext=false;}
      if(meal)return "ok";
      // 장면을 못 열었다(먹이 · 사냥꾼 모델 검수 전 · 짓다 던짐) — 불러온 임시 사냥꾼을 남기지 않는다(음수 id 라 상태 갱신이 안 지운다)
      if(pick.temp)dropSwimmer(pick.id);if(!active)draw(0);
      return "missing";},
    /** 다시 보기를 그만 본다(그만 보기 버튼, 2026-11-13) — 끝까지 본 것과 같은 정리(finishMeal) · 끝 알림. 실제 사냥 장면은 멈추지 않는다 */
    stopReplay():boolean{if(disposed||!meal||meal.kind==="real")return false;finishMeal();if(!active)draw(0);return true;},
    /** 먹이를 줬다 — 물고기 길 함수가 받는 자리(motion.feed)에 남긴다. atX 는 수조 가로(-4.5 ~ 4.5, 넓힌 만큼) */
    feed(atX){if(disposed)return;motion.feed={t:elapsed,x:clamp(atX??0,-4.5*wide,4.5*wide)};
      // 멈춰 있으면(움직임 줄이기 · 숨김) 먹이를 한 장면으로 그리고, 먹이 창이 지나면 한 번 더 그려 거둔다(food.ts 가 벽시계로 잰다)
      if(!active){draw(0);window.clearTimeout(foodTimer);foodTimer=window.setTimeout(()=>{if(!disposed&&!active)draw(0);},FOOD_LIFE*1000+60);}},
    photoStart(){
      if(disposed||lost||!compiled)return "skipped";if(photoOn)return "ok";if(meal)return "busy";
      photoSaved={angle,pitch,pan,yaw:domeYaw};photoOn=true;photoZoom=1;start=null;fingers.clear();pinch=null;
      canvas.style.touchAction="none";schedule();draw(0);return "ok";},
    photoEnd(){
      if(!photoOn)return;photoOn=false;fingers.clear();pinch=null;start=null;
      if(photoSaved){angle=photoSaved.angle;pitch=photoSaved.pitch;pan=photoSaved.pan;domeYaw=photoSaved.yaw;}photoSaved=null;photoZoom=1;
      postNow.setGrade(null);canvas.style.touchAction=inTunnel?"none":"";
      // 시계를 다시 돌린다 — previous 를 0 으로 두고 시작해(schedule) 멈춘 동안의 시간이 한 프레임에 몰리지 않는다
      if(!disposed){schedule();if(!active)draw(0);}},
    photoCamera(next){return next&&photoOn?setPhotoCam(next):photoNow();},
    photoFilter(id){if(disposed)return;postNow.setGrade(photoOn?photoGrade(id):null);if(!active)draw(0);},
    photoPoints(){
      const out:{id:number;x:number;y:number;depth:number}[]=[];if(disposed||!photoOn)return out;
      for(const[id,m]of swimmers){if(id<=0||!m.root.visible)continue;
        projected.copy(m.root.position);projected.y+=shownLength(m)*.12;projected.project(camera);
        if(projected.z>1||projected.z<-1)continue;const x=(projected.x+1)/2,y=(1-projected.y)/2;if(x<0||x>1||y<0||y>1)continue;
        out.push({id,x,y,depth:camera.position.distanceTo(m.root.position)});}
      return out;},
    photoCapture(){
      if(!photoOn||disposed||lost||!sized||!compiled)return null;
      const gl=renderer.getContext();if(gl.isContextLost())return null;
      const r=host.getBoundingClientRect(),cur=renderer.getPixelRatio();
      const dims=gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array|null;
      const maxSize=Math.min(renderer.capabilities.maxTextureSize,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096,dims?Math.min(dims[0],dims[1]):4096);
      const want=captureRatio({cssW:r.width,cssH:r.height,ratio:cur,maxSize});
      // 한 일 안에서: 배율 올리기 → 그리기 → 2D 캔버스로 옮기기. 기다리면(await) 브라우저가 그림판을 비워 빈 사진이 된다
      const shoot=(ratio:number):HTMLCanvasElement|null=>{
        renderer.setPixelRatio(ratio);syncPointScale();draw(0);
        if(gl.isContextLost())return null;
        const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;if(!w||!h)return null;
        const out=document.createElement("canvas");out.width=w;out.height=h;const ctx=out.getContext("2d");if(!ctx)return null;
        ctx.drawImage(canvas,0,0,w,h);return out;};
      try{
        let shot:HTMLCanvasElement|null=null;
        try{shot=shoot(want);}catch{shot=null;}
        // 큰 그림이 안 되면(메모리 · 드라이버) 지금 배율로 한 번 더
        if(!shot&&want>cur){try{shot=shoot(cur);}catch{shot=null;}}
        return shot;
      // 배율은 늘 되돌린다 — 찍는 도중 연결이 끊겨도 브라우저가 되돌려 준 뒤 2배로 계속 돌지 않게. 다시 그리기만 살아 있을 때
      }finally{if(!disposed){renderer.setPixelRatio(cur);syncPointScale();if(!gl.isContextLost())draw(0);}}},
    dispose,
  };
  } catch (e) { dispose(); throw e; }
}
