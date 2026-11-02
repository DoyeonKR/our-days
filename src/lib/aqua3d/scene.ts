import * as T from "three";
import { familyOf, fishArtKey, type AquaState } from "../aquarium.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { isFishModelApproved } from "./quality.ts";
import { decorToWorld, fishCourse, worldToDecor, WORLD, clamp } from "./world.ts";
import { makeHabitat, HABITAT_THEMES, type Habitat } from "./habitat.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null };
export type TankEvents = { fish: (id: number) => void; decor: (id: number) => void; place: (x: number, y: number) => void; error: (message: string) => void };
type Swimmer = AnimalModel & { key: string; family: string; length: number; phase: number; scale: number };

/** Three/WebGL2 is loaded only for the open tank. Local textures, no image billboards or state writes. */
export function createTank(host: HTMLDivElement, initial: TankView, events: TankEvents) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement; canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(44, 0.8, 0.1, 65), kit = new ModelKit();
  scene.background = new T.Color(0x07191e); scene.fog = new T.Fog(0x063949, 18, 34);
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 1.8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe3ad, 2.3); sun.position.set(-4,9,6); scene.add(sun);
  const fill = new T.PointLight(0x5ec8df, 20, 24, 2); fill.position.set(3,2,-1); scene.add(fill);
  const swimmers = new Map<number,Swimmer>(), decorations = new Map<number,DecorModel & { key: string }>();
  let habitat:Habitat|null=null, habitatTier=0;
  // Batch repeated eyes, leaves, stems and masonry without losing their original joint hierarchy.
  // Original mesh nodes remain for accurate ray picking; only the batch is drawn.
  const batches: { mesh: T.InstancedMesh; originals: T.Mesh[] }[] = [];
  function rebuildBatches(){
    for(const b of batches){for(const m of b.originals)m.visible=true;b.mesh.removeFromParent();b.mesh.dispose();}batches.length=0;
    const groups=new Map<string,T.Mesh[]>();
    scene.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o instanceof T.SkinnedMesh)&&!Array.isArray(o.material)){
      const key=o.geometry.uuid+o.material.uuid;const list=groups.get(key)??[];list.push(o);groups.set(key,list);
    }});
    for(const originals of groups.values())if(originals.length>=3){const mesh=new T.InstancedMesh(originals[0].geometry,originals[0].material,originals.length);mesh.frustumCulled=false;
      for(const m of originals)m.visible=false;scene.add(mesh);batches.push({mesh,originals});}
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
    root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){if(o.geometry!==kit.sphere&&o.geometry!==kit.box&&o.geometry!==kit.cylinder)geometry.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!shared.has(m)){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}
      if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});root.removeFromParent();
  }
  function update(next:TankView){
    state=next;let topologyChanged=false;
    const approvedFish=next.aquarium.fish.filter(f=>isFishModelApproved(fishArtKey(f)));
    const ids=new Set(approvedFish.map(f=>f.id));
    if(habitatTier!==next.aquarium.tank){
      if(habitat){habitat.dispose();release(habitat.root);}
      habitat=makeHabitat(next.aquarium.tank);habitatTier=next.aquarium.tank;
      scene.add(habitat.root);topologyChanged=true;
    }
    for(const[id,m]of swimmers)if(!ids.has(id)){release(m.root);swimmers.delete(id);topologyChanged=true;}
    for(const f of approvedFish){const key=fishArtKey(f),old=swimmers.get(f.id);if(old?.key===key)continue;
      topologyChanged=true;if(old)release(old.root);const animal=makeAnimal(kit,f.family,key),fam=familyOf(f.family),length=(fam?.size??16)*.08*(f.stage===2?1:f.stage===1?.65:.4);
      const bounds=new T.Box3().setFromObject(animal.root),size=bounds.getSize(new T.Vector3()),scale=length/Math.max(size.x,size.z,size.y*1.25);
      animal.root.scale.setScalar(scale);animal.root.userData={type:"fish",id:f.id};scene.add(animal.root);
      swimmers.set(f.id,{...animal,key,family:f.family,length,scale,phase:f.id*1.73});
    }
    kit.retainReferences(new Set(approvedFish.map(f=>fishArtKey(f))));
    const placedIds=new Set(next.aquarium.placed.map(p=>p.id));for(const[id,m]of decorations)if(!placedIds.has(id)){release(m.root);decorations.delete(id);topologyChanged=true;}
    for(const p of next.aquarium.placed){let m=decorations.get(p.id);if(!m||m.key!==p.key){topologyChanged=true;if(m)release(m.root);m={...makeDecor(kit,p.key),key:p.key};m.root.userData={type:"decor",id:p.id};scene.add(m.root);decorations.set(p.id,m);}
      const pos=decorToWorld(p.x,p.y);m.root.position.set(pos.x,habitat?.heightAt(pos.x,pos.z)??pos.y,pos.z);m.root.rotation.y=(p.id%7-3)*.12;
    }
    const theme=HABITAT_THEMES[clamp(next.aquarium.tank-1,0,5)].water;
    const water=new T.Color(theme).lerp(new T.Color(0x3d4c37),clamp((60-next.aquarium.water)/100,0,.55));scene.fog=new T.Fog(water,20,38);
    habitat?.setWater(next.aquarium.water);
    if(topologyChanged)rebuildBatches();draw(0);schedule();
  }
  function draw(dt:number){
    camera.position.set(Math.sin(angle)*19, .9+pitch*10,Math.cos(angle)*19);camera.lookAt(0,-.1,0);camera.updateMatrixWorld();
    for(const[id,m]of swimmers){const c=fishCourse(id,elapsed,m.length,m.family);m.root.position.set(c.x,c.y,c.z);
      direction.set(c.dx,c.dy,c.dz).normalize();side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      if(dt===0)m.root.quaternion.copy(targetQuat);else m.root.quaternion.slerp(targetQuat,Math.min(1,dt*2.8));
      m.phase+=dt*c.effort;m.animate(m.phase,1);
    }
    for(const d of decorations.values())d.animate(elapsed);
    habitat?.animate(elapsed);
    const selected=state.editing?decorations.get(state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected;if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=(habitat?.heightAt(halo.position.x,halo.position.z)??WORLD.floor)+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar((selected as Swimmer).length*.65);}}
    scene.updateMatrixWorld(true);
    for(const b of batches){for(let i=0;i<b.originals.length;i++)b.mesh.setMatrixAt(i,b.originals[i].matrixWorld);b.mesh.instanceMatrix.needsUpdate=true;}
    renderer.render(scene,camera);
    if(process.env.NODE_ENV!=="production"){
      host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.fish=String(swimmers.size);host.dataset.decor=String(decorations.size);
      host.dataset.time=elapsed.toFixed(2);host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.textures=String(renderer.info.memory.textures);
    }
  }
  const tick=(time:number)=>{if(!active||disposed)return;if(time-previous>=1000/30){const dt=previous?Math.min((time-previous)/1000,.08):0;previous=time;elapsed+=dt;draw(dt);}frame=requestAnimationFrame(tick);};
  function schedule(){const run=!disposed&&!lost&&visible&&!document.hidden&&!reduced.matches&&!state.editing;
    host.dataset.paused=String(!run);if(active===run)return;active=run;cancelAnimationFrame(frame);previous=0;if(run)frame=requestAnimationFrame(tick);
  }
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);draw(0);};
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;schedule();});intersection.observe(host);
  document.addEventListener("visibilitychange",schedule);reduced.addEventListener("change",schedule);
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;schedule();events.error("3D 그래픽 연결이 끊어졌어요. 다시 열어 주세요.");};canvas.addEventListener("webglcontextlost",contextLost);
  let start:{x:number;y:number;angle:number;pitch:number}|null=null;
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,angle,pitch};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start||state.editing)return;angle=clamp(start.angle+(e.clientX-start.x)*.003,-.4,.4);pitch=clamp(start.pitch+(e.clientY-start.y)*.001,-.10,.13);if(!active)draw(0);};
  const cancel=()=>{start=null;};
  const end=(e:PointerEvent)=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(moved>8)return;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
    if(state.editing&&state.placing){const floorHit=habitat?ray.intersectObject(habitat.floor)[0]:null;const point=floorHit?.point??ray.ray.intersectPlane(floorPlane,hitPoint);if(point){const p=worldToDecor(point.x,point.z);events.place(p.x,p.y);}return;}
    const roots=state.editing?[...decorations.values()].map(m=>m.root):[...swimmers.values(),...decorations.values()].map(m=>m.root);
    const hit=ray.intersectObjects(roots,true)[0];if(!hit)return;let o:T.Object3D|null=hit.object;while(o&&!o.userData.type)o=o.parent;
    if(o?.userData.type==="fish"&&!state.editing)events.fish(o.userData.id);else if(o?.userData.type==="decor"&&state.editing)events.decor(o.userData.id);
  };
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",cancel);
  update(initial);resize();
  return {update,dispose(){disposed=true;active=false;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",schedule);reduced.removeEventListener("change",schedule);
    habitat?.dispose();
    canvas.removeEventListener("webglcontextlost",contextLost);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",cancel);
      const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.InstancedMesh)o.dispose();}});
    geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }};
}
