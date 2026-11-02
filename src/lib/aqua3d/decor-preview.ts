import * as T from "three";
import { ModelKit } from "./models.ts";
import { makeDecor } from "./decor.ts";

/** A single on-demand viewer, never one WebGL context per shop tile. */
export function createDecorPreview(host: HTMLDivElement, key: string) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const canvas=renderer.domElement;canvas.setAttribute("role","img");canvas.setAttribute("aria-label","장식 3D 모델. 드래그해서 돌려볼 수 있어요.");host.appendChild(canvas);
  const scene=new T.Scene();scene.background=new T.Color(0x10292e);
  scene.add(new T.HemisphereLight(0xc9ece4,0x5b503d,2.3));
  const light=new T.DirectionalLight(0xffedc7,3);light.position.set(-3,5,6);scene.add(light);
  const rim=new T.DirectionalLight(0x6acbd6,2);rim.position.set(4,2,-4);scene.add(rim);
  const kit=new ModelKit(),model=makeDecor(kit,key);scene.add(model.root);
  const bounds=new T.Box3().setFromObject(model.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const radius=Math.max(size.x,size.y,size.z)*1.9;
  const camera=new T.PerspectiveCamera(38,1,.01,100);
  let angle=.45,pitch=.2,frame=0,last=0,disposed=false,start:{x:number;y:number;a:number;p:number}|null=null;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const draw=(time=0)=>{model.animate(reduced.matches?0:time/1000);camera.position.set(center.x+Math.sin(angle)*radius,center.y+Math.sin(pitch)*radius,center.z+Math.cos(angle)*radius);camera.lookAt(center);renderer.render(scene,camera);};
  const resize=()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);draw(last);};
  const tick=(time:number)=>{if(disposed)return;if(time-last>=32&&!document.hidden&&!reduced.matches){last=time;draw(time);}frame=requestAnimationFrame(tick);};
  const down=(e:PointerEvent)=>{if(!e.isPrimary)return;start={x:e.clientX,y:e.clientY,a:angle,p:pitch};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!start)return;angle=start.a+(e.clientX-start.x)*.012;pitch=Math.max(-.35,Math.min(.65,start.p+(e.clientY-start.y)*.006));draw(last);};
  const end=()=>{start=null;};
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
  const observer=new ResizeObserver(resize);observer.observe(host);resize();frame=requestAnimationFrame(tick);
  return {dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",end);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const t of Object.values(m))if(t instanceof T.Texture)textures.add(t);}if(o instanceof T.InstancedMesh)o.dispose();}});
    geometries.add(kit.box);geometries.add(kit.sphere);geometries.add(kit.cylinder);kit.materials.forEach(m=>materials.add(m));
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();if(renderer.extensions.has("WEBGL_lose_context"))renderer.forceContextLoss();canvas.remove();
  }};
}
