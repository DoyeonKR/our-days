import * as T from "three";
import { familyOf, fishArtKey, type AquaState } from "../aquarium.ts";
import { makeAnimal, ModelKit, type AnimalModel } from "./models.ts";
import { makeDecor, type DecorModel } from "./decor.ts";
import { isFishModelApproved } from "./quality.ts";
import { decorToWorld, fishCourse, worldToDecor, WORLD, clamp } from "./world.ts";

export type TankView = { aquarium: AquaState; editing: boolean; placing: boolean; selectedFish: number | null; selectedDecor: number | null };
export type TankEvents = { fish: (id: number) => void; decor: (id: number) => void; place: (x: number, y: number) => void; error: (message: string) => void };
type Swimmer = AnimalModel & { key: string; family: string; length: number; phase: number; scale: number };

/** Three/WebGL2 is loaded only for the open tank. Local textures, no image billboards or state writes. */
export function createTank(host: HTMLDivElement, initial: TankView, events: TankEvents) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement; canvas.setAttribute("aria-label", "3D 수조. 좌우로 드래그하면 시점을 돌리고, 물고기를 누르면 선택합니다."); canvas.setAttribute("role", "img"); host.appendChild(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 0.8, 0.1, 65), kit = new ModelKit();
  scene.background = new T.Color(0x063949); scene.fog = new T.Fog(0x063949, 18, 34);
  const hemi = new T.HemisphereLight(0xb7e4ed, 0x656442, 2.1); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe3ad, 3.2); sun.position.set(-4,9,6); scene.add(sun);
  const fill = new T.PointLight(0x5ec8df, 35, 24, 2); fill.position.set(3,2,-1); scene.add(fill);
  const room = new T.Group(); scene.add(room);
  const sand = new T.ShaderMaterial({ uniforms: { time: { value: 0 }, tint: { value: new T.Color(0xa6a182) } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv; uniform float time; uniform vec3 tint;
      void main(){vec2 p=vUv*30.;float a=sin(p.x+sin(p.y*1.4+time*.25)*1.9);float b=sin(p.y*.8+cos(p.x*1.2-time*.18)*2.);
      float c=pow(1.-abs(a*b),12.);float grain=fract(sin(dot(p*79.,vec2(12.9898,78.233)))*43758.5453);
      gl_FragColor=vec4(tint*(.56+grain*.12)+vec3(.30,.38,.32)*c,1.);}` });
  const floor = new T.Mesh(new T.PlaneGeometry(10,6,1,1),sand); floor.rotation.x = -Math.PI/2; floor.position.y = WORLD.floor; room.add(floor);
  const back = kit.mesh(room,"box",0x0e4e57,[0,0,-3.18],[10.1,11.7,.12]);
  const pebbles = new T.InstancedMesh(new T.IcosahedronGeometry(1,1),kit.material(0x89917c),120), dummy = new T.Object3D();
  for(let i=0;i<120;i++){dummy.position.set(Math.sin(i*81.31)*4.8,WORLD.floor+.025,Math.cos(i*37.19)*2.8);const s=.025+(i%7)*.009;dummy.scale.set(s*1.5,s*.6,s);dummy.rotation.set(i,i*.7,i*.1);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}room.add(pebbles);
  const glassMaterial = new T.MeshStandardMaterial({color:0xa5e7e2,transparent:true,opacity:.07,roughness:.2,side:T.DoubleSide,depthWrite:false});
  for(const sign of[-1,1]){const glass=new T.Mesh(new T.PlaneGeometry(6,11.7),glassMaterial);glass.rotation.y=Math.PI/2;glass.position.set(sign*5,.35,0);room.add(glass);}
  const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(10,11.7,6)),new T.LineBasicMaterial({color:0x7ac1c6,transparent:true,opacity:.28}));edge.position.y=.35;room.add(edge);
  const bubbles = new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:0xc3eff0,transparent:true,opacity:.35,roughness:.18}),22);scene.add(bubbles);
  const swimmers = new Map<number,Swimmer>(), decorations = new Map<number,DecorModel & { key: string }>();
  let backdrop:DecorModel|null=null, backdropTier=0;
  // Batch repeated eyes, leaves, stems and masonry without losing their original joint hierarchy.
  // Original mesh nodes remain for accurate ray picking; only the batch is drawn.
  const batches: { mesh: T.InstancedMesh; originals: T.Mesh[] }[] = [];
  function rebuildBatches(){
    for(const b of batches){for(const m of b.originals)m.visible=true;b.mesh.removeFromParent();b.mesh.dispose();}batches.length=0;
    const groups=new Map<string,T.Mesh[]>();
    scene.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&[kit.sphere,kit.box,kit.cylinder].includes(o.geometry)&&!Array.isArray(o.material)){
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
    root.traverse(o=>{if(o instanceof T.Mesh){if(o.geometry!==kit.sphere&&o.geometry!==kit.box&&o.geometry!==kit.cylinder)geometry.add(o.geometry);
      for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!shared.has(m)){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}
      if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});root.removeFromParent();
  }
  function update(next:TankView){
    state=next;let topologyChanged=false;
    const approvedFish=next.aquarium.fish.filter(f=>isFishModelApproved(fishArtKey(f)));
    const ids=new Set(approvedFish.map(f=>f.id));
    if(backdropTier!==next.aquarium.tank){
      if(backdrop)release(backdrop.root);
      const themes=["pebbles","stone_arch","driftwood","stone_arch","glow_kelp","dragon_palace"];
      backdrop=makeDecor(kit,themes[clamp(next.aquarium.tank-1,0,5)]);backdropTier=next.aquarium.tank;
      backdrop.root.position.set(next.aquarium.tank===6?0:-3.4,WORLD.floor,-2.55);
      backdrop.root.scale.setScalar(next.aquarium.tank===6?2.1:1.5);scene.add(backdrop.root);topologyChanged=true;
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
      const pos=decorToWorld(p.x,p.y);m.root.position.set(pos.x,pos.y,pos.z);m.root.rotation.y=(p.id%7-3)*.12;
    }
    const theme=[0x126073,0x105564,0x0c5260,0x09465b,0x07374e,0x172b50][clamp(next.aquarium.tank-1,0,5)];
    const water=new T.Color(theme).lerp(new T.Color(0x3d4c37),clamp((60-next.aquarium.water)/100,0,.55));scene.background=water;scene.fog=new T.Fog(water,17,32);(back.material as T.MeshStandardMaterial).color.copy(water).multiplyScalar(1.35);
    if(topologyChanged)rebuildBatches();draw(0);schedule();
  }
  function draw(dt:number){
    camera.position.set(Math.sin(angle)*17.5, .9+pitch*10,Math.cos(angle)*17.5);camera.lookAt(0,-.1,0);camera.updateMatrixWorld();
    for(const[id,m]of swimmers){const c=fishCourse(id,elapsed,m.length,m.family);m.root.position.set(c.x,c.y,c.z);
      direction.set(c.dx,c.dy,c.dz).normalize();side.crossVectors(direction,up).normalize();vertical.crossVectors(side,direction).normalize();basis.makeBasis(direction,vertical,side);targetQuat.setFromRotationMatrix(basis);
      if(dt===0)m.root.quaternion.copy(targetQuat);else m.root.quaternion.slerp(targetQuat,Math.min(1,dt*2.8));
      m.phase+=dt*c.effort;m.animate(m.phase,1);
    }
    for(const d of decorations.values())d.animate(elapsed);
    backdrop?.animate(elapsed);
    for(let i=0;i<22;i++){dummy.position.set(Math.sin(i*21.7)*4.4+Math.sin(elapsed*.4+i)*.08,WORLD.floor+((elapsed*(.35+i%3*.10)+i*.71)%11),Math.cos(i*12.4)*2.5);dummy.scale.setScalar(.022+(i%4)*.012);dummy.rotation.set(0,0,0);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);}bubbles.instanceMatrix.needsUpdate=true;
    sand.uniforms.time.value=elapsed;
    const selected=state.editing?decorations.get(state.selectedDecor??-1):swimmers.get(state.selectedFish??-1);
    halo.visible=!!selected;if(selected){halo.position.copy(selected.root.position);if(state.editing){halo.position.y=WORLD.floor+.025;halo.rotation.set(-Math.PI/2,0,0);halo.scale.setScalar(1.1);}else{halo.quaternion.copy(camera.quaternion);halo.scale.setScalar((selected as Swimmer).length*.65);}}
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
    if(state.editing&&state.placing){if(ray.ray.intersectPlane(floorPlane,hitPoint)){const p=worldToDecor(hitPoint.x,hitPoint.z);events.place(p.x,p.y);}return;}
    const roots=state.editing?[...decorations.values()].map(m=>m.root):[...swimmers.values(),...decorations.values()].map(m=>m.root);
    const hit=ray.intersectObjects(roots,true)[0];if(!hit)return;let o:T.Object3D|null=hit.object;while(o&&!o.userData.type)o=o.parent;
    if(o?.userData.type==="fish"&&!state.editing)events.fish(o.userData.id);else if(o?.userData.type==="decor"&&state.editing)events.decor(o.userData.id);
  };
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",cancel);
  update(initial);resize();
  return {update,dispose(){disposed=true;active=false;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",schedule);reduced.removeEventListener("change",schedule);
    canvas.removeEventListener("webglcontextlost",contextLost);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",cancel);
      const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material])){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}});
    batches.forEach(b=>b.mesh.dispose());bubbles.dispose();geometries.add(kit.sphere);geometries.add(kit.box);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{if(![...kit.referenceTextures.values()].includes(t))t.dispose();});kit.disposeReferences();renderer.dispose();if(!lost&&renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }};
}
