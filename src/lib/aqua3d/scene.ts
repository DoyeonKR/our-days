import * as T from "three";
import { decorPose, fishArtKey, fishCm, type AquaState, type PlacedDecor } from "../aquarium.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { seatDecor } from "./decor-layout.ts";
import { isFishModelApproved } from "./quality.ts";
import { MIN_FRAME_MS, createPacer } from "./framepace.ts";
import { decorToWorld, schoolCourse, schoolsOf, wideScale, worldToDecor, WORLD, clamp,fishLength } from "./world.ts";
import { makeHabitat, HABITAT_THEMES, type Habitat } from "./habitat.ts";
import { DECOR_GLB, FISH_GLB, GlbLibrary, decorMotion, fishMotion, swapBody } from "./glb.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null; preview?: PlacedDecor | null };
export type TankEvents = { fish: (id: number) => void; decor: (id: number) => void; place: (x: number, y: number) => void; error: (message: string) => void };
/** 낚시터 주인의 왕관 — 금빛 고리 + 뾰족한 다섯 개 */
function makeCrown(r:number):T.Group{const g=new T.Group(),m=new T.MeshStandardMaterial({color:0xf5c542,metalness:.7,roughness:.3,emissive:0x5a3d00});g.add(new T.Mesh(new T.CylinderGeometry(r,r*.92,r*.5,16,1,true),m));for(let i=0;i<5;i++){const a=i/5*Math.PI*2,t=new T.Mesh(new T.ConeGeometry(r*.28,r*.7,6),m);t.position.set(Math.cos(a)*r*.9,r*.55,Math.sin(a)*r*.9);g.add(t);}return g;}
type Swimmer = AnimalModel & { key: string; family: string; length: number; phase: number; scale: number };

/** Three/WebGL2 is loaded only for the open tank. Local textures, no image billboards or state writes. */
export function createTank(host: HTMLDivElement, initial: TankView, events: TankEvents) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  const pacer = createPacer(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setPixelRatio(pacer.ratio());
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement; canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(44, 0.8, 0.1, 65), kit = new ModelKit();
  scene.background = new T.Color(0x07191e); scene.fog = new T.Fog(0x063949, 18, 34);
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 1.8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe3ad, 2.3); sun.position.set(-4,9,6); scene.add(sun);
  const fill = new T.PointLight(0x5ec8df, 20, 24, 2); fill.position.set(3,2,-1); scene.add(fill);
  const swimmers = new Map<number,Swimmer>(), decorations = new Map<number,DecorModel & { key: string }>(), glb = new GlbLibrary();
  let pendingRebuild=false;
  // 제작 모델이 도착하면 임시 몸을 바꾼다 — 갈아 끼운 뒤 묶음 그리기와 장식 자리를 다시 잡는다
  const refresh=()=>{pendingRebuild=true;update(state);};
  let habitat:Habitat|null=null, habitatTier=0, wide=1, pan=0, schools=new Map<number,{leader:number;slot:number}>();
  // Batch repeated eyes, leaves, stems and masonry without losing their original joint hierarchy.
  // Original mesh nodes remain for accurate ray picking; only the batch is drawn.
  const batches: { mesh: T.InstancedMesh; originals: T.Mesh[]; dynamic: boolean; ready: boolean }[] = [];
  // 물고기 · 장식 밑이 아니면 안 움직인다 — 위치를 매 프레임 GPU 로 다시 올리지 않는다
  const moves=(o:T.Object3D)=>{for(let p:T.Object3D|null=o;p;p=p.parent)if(p.userData.type)return true;return false;};
  function rebuildBatches(){
    for(const b of batches){for(const m of b.originals)m.visible=true;b.mesh.removeFromParent();b.mesh.dispose();}batches.length=0;
    const groups=new Map<string,T.Mesh[]>();
    scene.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o instanceof T.SkinnedMesh)&&!Array.isArray(o.material)){
      const key=o.geometry.uuid+o.material.uuid;const list=groups.get(key)??[];list.push(o);groups.set(key,list);
    }});
    for(const originals of groups.values())if(originals.length>=3){const mesh=new T.InstancedMesh(originals[0].geometry,originals[0].material,originals.length);mesh.frustumCulled=false;
      for(const m of originals)m.visible=false;scene.add(mesh);batches.push({mesh,originals,dynamic:originals.some(moves),ready:false});}
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2(), floorPlane = new T.Plane(new T.Vector3(0,1,0),-WORLD.floor), hitPoint = new T.Vector3();
  const basis = new T.Matrix4(), direction = new T.Vector3(), targetQuat = new T.Quaternion(), up = new T.Vector3(0,1,0), side = new T.Vector3(), vertical = new T.Vector3();
  const halo = new T.Mesh(new T.TorusGeometry(.7,.018,8,48),new T.MeshBasicMaterial({color:0xf4e2a0,transparent:true,opacity:.75})); halo.visible=false;scene.add(halo);
  let state = initial, disposed=false, elapsed=0, frame=0, previous=0, visible=true, active=false, angle=0, pitch=0, lost=false;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  renderer.debug.onShaderError=()=>{lost=true;schedule();events.error("이 기기에서 3D 그래픽을 처리하지 못했어요. 하드웨어 가속 설정을 확인한 뒤 다시 시도해 주세요.");};

  function release(root:T.Object3D){
    const geometry=new Set<T.BufferGeometry>(), materials=new Set<T.Material>(), textures=new Set<T.Texture>();
    const shared=new Set<T.Material>(kit.materials.values());
    root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){const borrowed=!!o.userData.glbShared;if(!borrowed&&o.geometry!==kit.sphere&&o.geometry!==kit.box&&o.geometry!==kit.cylinder)geometry.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!borrowed&&!shared.has(m)){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}
      if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});root.removeFromParent();
  }
  function update(next:TankView){
    state=next;let topologyChanged=pendingRebuild;pendingRebuild=false;
    const approvedFish=next.aquarium.fish.filter(f=>isFishModelApproved(fishArtKey(f)));
    const ids=new Set(approvedFish.map(f=>f.id));
    if(habitatTier!==next.aquarium.tank){
      if(habitat){habitat.dispose();release(habitat.root);}
      habitat=makeHabitat(next.aquarium.tank);habitatTier=next.aquarium.tank;
      scene.add(habitat.root);topologyChanged=true;
    }
    wide=wideScale(next.aquarium.wide);if(habitat)habitat.root.scale.x=wide;
    schools=schoolsOf(approvedFish);
    for(const[id,m]of swimmers)if(!ids.has(id)){release(m.root);swimmers.delete(id);topologyChanged=true;}
    for(const f of approvedFish){const key=fishArtKey(f),old=swimmers.get(f.id);if(old?.key===key)continue;
      topologyChanged=true;if(old)release(old.root);const animal=makeAnimal(kit,f.family,key),length=fishLength(fishCm(f));
      const bounds=new T.Box3().setFromObject(animal.root),size=bounds.getSize(new T.Vector3()),scale=length/Math.max(size.x,size.z,size.y*1.25);
      animal.root.scale.setScalar(scale);animal.root.userData={type:"fish",id:f.id};scene.add(animal.root);
      const wear=()=>{if(!f.crown)return;const c=makeCrown(Math.max(size.x,size.z)*.2);c.position.set(0,bounds.max.y,bounds.getCenter(new T.Vector3()).z);swimmers.get(f.id)?.root.add(c);};
      swimmers.set(f.id,{...animal,key,family:f.family,length,scale,phase:f.id*1.73});wear();
      if(FISH_GLB.has(key))void glb.load("fish",key).then(src=>{const m=swimmers.get(f.id);if(disposed||!src||m?.key!==key)return;const inner=glb.instance(src);release(swapBody(m.root,inner,"center"));m.animate=fishMotion(inner,f.family,key);wear();refresh();});
    }
    kit.retainReferences(new Set(approvedFish.map(f=>fishArtKey(f))));
    // Preview replaces a moved item or adds one temporary item. Never mutates inventory or shared saves.
    const placed=next.preview?[...next.aquarium.placed.filter(p=>p.id!==next.preview!.id),next.preview]:next.aquarium.placed;
    const placedIds=new Set(placed.map(p=>p.id));for(const[id,m]of decorations)if(!placedIds.has(id)){release(m.root);decorations.delete(id);topologyChanged=true;}
    for(const p of placed){let m=decorations.get(p.id);if(!m||m.key!==p.key){topologyChanged=true;if(m)release(m.root);m={...makeDecor(kit,p.key),key:p.key};m.root.userData={type:"decor",id:p.id};scene.add(m.root);decorations.set(p.id,m);
        if(DECOR_GLB.has(p.key))void glb.load("decor",p.key).then(src=>{const d=decorations.get(p.id);if(disposed||!src||d?.key!==p.key)return;const inner=glb.instance(src);release(swapBody(d.root,inner,"base"));d.animate=decorMotion(inner);refresh();});}
      const pos=decorToWorld(p.x,p.y,wide),pose=decorPose(p);m.root.position.set(pos.x,habitat?.heightAt(pos.x,pos.z)??pos.y,pos.z);m.root.rotation.y=p.rotation===undefined?(p.id%7-3)*.12:pose.rotation*Math.PI/180;m.root.scale.setScalar(pose.scale);
      seatDecor(m.root,(x,z)=>habitat?.heightAt(x,z)??WORLD.floor,4.9*(habitat?.root.scale.x??1));
    }
    const theme=HABITAT_THEMES[clamp(next.aquarium.tank-1,0,5)].water;
    const water=new T.Color(theme).lerp(new T.Color(0x3d4c37),clamp((60-next.aquarium.water)/100,0,.55));scene.fog=new T.Fog(water,20,38);
    habitat?.setWater(next.aquarium.water);
    if(topologyChanged)rebuildBatches();
    // 돌아가는 중엔 다음 프레임에 맡긴다 — 화면이 다시 그려질 때마다 한 장 더 그리면서 물고기 방향이 튀었다
    if(topologyChanged||!active)draw(0);schedule();
  }
  function draw(dt:number){
    // 어항 폭이 화면에 다 들어오는 거리 — 늘린 어항 · 세로 전체 보기에서도 양옆이 잘리지 않는다. 안개도 같이 물러난다
    const fit=5*wide/(Math.tan(camera.fov*Math.PI/360)*camera.aspect)+3,camD=clamp(fit,19,42),reach=(wide-1)*3,camX=clamp(pan,-reach,reach);if(scene.fog instanceof T.Fog){scene.fog.near=camD+1;scene.fog.far=camD+19;}camera.position.set(Math.sin(angle)*camD+camX, .9+pitch*10,Math.cos(angle)*camD);camera.lookAt(camX,-.1,0);camera.updateMatrixWorld();
    for(const[id,m]of swimmers){const sc=schools.get(id);const c=schoolCourse(sc?.leader??id,sc?.slot??0,id,elapsed,m.length,m.family,wide);m.root.position.set(c.x,c.y,c.z);
      direction.set(c.dx,c.dy,c.dz).normalize();side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      if(dt===0)m.root.quaternion.copy(targetQuat);else m.root.quaternion.slerp(targetQuat,Math.min(1,dt*2.8));
      m.phase+=dt*c.effort;m.animate(m.phase,1);
    }
    for(const d of decorations.values())d.animate(elapsed);
    habitat?.animate(elapsed);
    const selected=state.editing?decorations.get(state.preview?.id??state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected;if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=(habitat?.heightAt(halo.position.x,halo.position.z)??WORLD.floor)+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar((selected as Swimmer).length*.65);}}
    scene.updateMatrixWorld(true);
    for(const b of batches){if(!b.dynamic&&b.ready)continue;b.ready=true;for(let i=0;i<b.originals.length;i++)b.mesh.setMatrixAt(i,b.originals[i].matrixWorld);b.mesh.instanceMatrix.needsUpdate=true;}
    renderer.render(scene,camera);
    if(process.env.NODE_ENV!=="production"){
      host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.fish=String(swimmers.size);host.dataset.decor=String(decorations.size);
      host.dataset.time=elapsed.toFixed(2);host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.textures=String(renderer.info.memory.textures);
    }
  }
  const tick=(time:number)=>{if(!active||disposed)return;const gap=previous?time-previous:0;if(!previous||gap>=MIN_FRAME_MS){const dt=Math.min(gap/1000,.08);previous=time;elapsed+=dt;draw(dt);const ratio=pacer.feed(gap);if(ratio!==null)renderer.setPixelRatio(ratio);}frame=requestAnimationFrame(tick);};
  function schedule(){const run=!disposed&&!lost&&visible&&!document.hidden&&!reduced.matches&&!state.editing;
    host.dataset.paused=String(!run);if(active===run)return;active=run;cancelAnimationFrame(frame);previous=0;if(run)frame=requestAnimationFrame(tick);
  }
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);draw(0);};
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;schedule();});intersection.observe(host);
  document.addEventListener("visibilitychange",schedule);reduced.addEventListener("change",schedule);
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;schedule();events.error("3D 그래픽 연결이 끊어졌어요. 다시 열어 주세요.");};canvas.addEventListener("webglcontextlost",contextLost);
  let start:{x:number;y:number;angle:number;pitch:number;pan:number}|null=null;
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,angle,pitch,pan};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start)return;angle=clamp(start.angle+(e.clientX-start.x)*.003,-.4,.4);pan=clamp(start.pan-(e.clientX-start.x)*.02,-(wide-1)*3,(wide-1)*3);pitch=clamp(start.pitch+(e.clientY-start.y)*.001,-.10,.13);if(!active)draw(0);};
  const cancel=()=>{start=null;};
  const end=(e:PointerEvent)=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(moved>8)return;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
    if(state.editing&&state.placing){const floorHit=habitat?ray.intersectObject(habitat.floor)[0]:null;const point=floorHit?.point??ray.ray.intersectPlane(floorPlane,hitPoint);if(point){const p=worldToDecor(point.x,point.z,wide);events.place(p.x,p.y);}return;}
    const roots=state.editing?[...decorations.values()].map(m=>m.root):[...swimmers.values(),...decorations.values()].map(m=>m.root);
    const hit=ray.intersectObjects(roots,true)[0];if(!hit)return;let o:T.Object3D|null=hit.object;while(o&&!o.userData.type)o=o.parent;
    if(o?.userData.type==="fish"&&!state.editing)events.fish(o.userData.id);else if(o?.userData.type==="decor"&&state.editing)events.decor(o.userData.id);
  };
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",cancel);
  update(initial);resize();
  return {update,dispose(){disposed=true;active=false;cancelAnimationFrame(frame);glb.dispose();observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",schedule);reduced.removeEventListener("change",schedule);
    habitat?.dispose();
    canvas.removeEventListener("webglcontextlost",contextLost);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",cancel);
      const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }};
}
