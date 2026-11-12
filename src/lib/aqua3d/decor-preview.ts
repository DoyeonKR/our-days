import * as T from "three";
import { ModelKit } from "./models.ts";
import { makeDecor } from "./decor.ts";
import { DECOR_GLB, GlbLibrary, decorMotion, swapBody } from "./glb.ts";
import { WATER_LIGHT } from "./waterlight.ts";
import {modelColorTree,modelTextureQuality} from './color-quality.ts';

/** A single on-demand viewer, never one WebGL context per shop tile. */
export function createDecorPreview(host: HTMLDivElement, key: string) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  // 수조와 같은 톤 매핑(Neutral) — 상점에서 본 색과 수조에 놓은 색이 같아야 한다(scene.ts)
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.35;
  const canvas=renderer.domElement;canvas.setAttribute("role","img");canvas.setAttribute("aria-label","장식 3D 모델. 드래그해서 돌려볼 수 있어요.");host.appendChild(canvas);
  const scene=new T.Scene();scene.background=new T.Color(0x10292e);
  scene.add(new T.HemisphereLight(0xc9ece4,0x5b503d,2.3));
  const light=new T.DirectionalLight(0xffedc7,3);light.position.set(-3,5,6);scene.add(light);
  const rim=new T.DirectionalLight(0x6acbd6,2);rim.position.set(4,2,-4);scene.add(rim);
  const kit=new ModelKit(),model=makeDecor(kit,key);modelColorTree(model.root);scene.add(model.root);
  let animate=model.animate;
  const bounds=new T.Box3().setFromObject(model.root),center=bounds.getCenter(new T.Vector3());
  let size=bounds.getSize(new T.Vector3()),radius=Math.max(size.x,size.y,size.z)*1.9;
  const glb=new GlbLibrary();
  const camera=new T.PerspectiveCamera(38,1,.01,100);
  let angle=.45,pitch=.2,frame=0,last=0,disposed=false,shown=true,start:{x:number;y:number;a:number;p:number}|null=null;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const draw=(time=0)=>{const t=reduced.matches?0:time/1000;WATER_LIGHT.aquaTime.value=t;WATER_LIGHT.aquaPointScale.value=Math.max(1,canvas.height/2);animate(t);camera.position.set(center.x+Math.sin(angle)*radius,center.y+Math.sin(pitch)*radius,center.z+Math.cos(angle)*radius);camera.lookAt(center);renderer.render(scene,camera);};
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);draw(last);};
  // 화면 밖(스크롤 · 가려짐) · 탭이 숨으면 멈춘다 — 예전엔 안 보여도 초당 30장을 그렸다
  const tick=(time:number)=>{if(disposed)return;if(time-last>=32&&!document.hidden&&!reduced.matches){last=time;draw(time);}frame=shown?requestAnimationFrame(tick):0;};
  const intersection=new IntersectionObserver(entries=>{const next=entries[0]?.isIntersecting??true;if(next===shown)return;shown=next;cancelAnimationFrame(frame);frame=shown&&!disposed?requestAnimationFrame(tick):0;});intersection.observe(host);
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,a:angle,p:pitch};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start)return;angle=start.a+(e.clientX-start.x)*.012;pitch=Math.max(-.35,Math.min(.65,start.p+(e.clientY-start.y)*.006));draw(last);};
  const end=()=>{start=null;};
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
  const observer=new ResizeObserver(resize);observer.observe(host);resize();frame=requestAnimationFrame(tick);
  // 거품은 몸과 따로 남는다(userData.aquaKeep) — 효과와 부품 움직임을 같이 돌린다
  if(DECOR_GLB.has(key))void glb.load("decor",key).then(src=>{if(disposed||!src)return;const inner=glb.instance(src);const old=swapBody(model.root,inner,"base");old.traverse(o=>{if(o instanceof T.Mesh&&!o.userData.glbShared&&o.geometry!==kit.box&&o.geometry!==kit.sphere&&o.geometry!==kit.cylinder)o.geometry.dispose();});
    modelTextureQuality(inner,renderer.capabilities.getMaxAnisotropy());const parts=decorMotion(inner),fx=model.effects;animate=t=>{fx(t);parts(t);};const b=new T.Box3().setFromObject(model.root);b.getCenter(center);size=b.getSize(new T.Vector3());radius=Math.max(size.x,size.y,size.z)*1.9;draw(last);});
  return {dispose(){disposed=true;glb.dispose();cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",end);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    // 나눠 쓰는 GLB 형상 · 재질은 glb 가 센다(수조가 곧 다시 쓴다) — 여기선 지우지 않는다
    scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){if(o instanceof T.InstancedMesh)o.dispose();if(o.userData.glbShared)return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const t of Object.values(m))if(t instanceof T.Texture)textures.add(t);}}});
    geometries.add(kit.box);geometries.add(kit.sphere);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();if(renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }};
}
