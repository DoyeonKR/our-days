import * as T from 'three';

/** A replay ghost owns only these material clones, never the GLB textures.
 * Keep the existing face/water shader hooks. Clip swallowed geometry at the
 * real mouth rather than shrinking a healthy fish into a dot. */
export function mealSurface(root:T.Object3D,gulp:boolean){
 const plane=new T.Plane(new T.Vector3(1,0,0),1e6);
 const originals:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
 const copies:{material:T.Material;opacity:number}[]=[];
 const wound={value:new T.Vector3()},radius={value:0},trauma={value:0},localWound=new T.Vector3();
 let marked=false;
 let disposed=false;
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;
  originals.push({mesh:o,material:o.material});
  const copy=(source:T.Material)=>{const m=source.clone();
   m.onBeforeCompile=(shader,renderer)=>{
    source.onBeforeCompile.call(m,shader,renderer);
    shader.uniforms.mealWound=wound;shader.uniforms.mealRadius=radius;shader.uniforms.mealTrauma=trauma;
    shader.vertexShader='varying vec3 vMealWorld;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvMealWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 vMealWorld;uniform vec3 mealWound;uniform float mealRadius;uniform float mealTrauma;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat abrasion=(1.-smoothstep(mealRadius*.35,max(.0001,mealRadius),distance(vMealWorld,mealWound)))*mealTrauma;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.008,.012),abrasion*.65);');
   };m.customProgramCacheKey=()=>source.customProgramCacheKey()+'|meal-surface-v1';
   m.transparent=true;m.depthWrite=false;
   if(gulp)m.clippingPlanes=[...(source.clippingPlanes??[]),plane];
   copies.push({material:m,opacity:source.opacity});return m;};
  o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
 });
 return {
  update(mouth:T.Vector3,forward:T.Vector3,fade:number,damage=0,woundRadius=0,held=false){
   plane.setFromNormalAndCoplanarPoint(forward,mouth);
   if(damage>0&&(!marked||held)){root.updateWorldMatrix(true,false);localWound.copy(mouth);root.worldToLocal(localWound);marked=true;}
   if(marked){wound.value.copy(localWound);root.localToWorld(wound.value);}
   radius.value=woundRadius;trauma.value=damage;
   const alpha=1-Math.max(0,Math.min(1,fade));
   for(const c of copies)c.material.opacity=c.opacity*alpha;
  },
  dispose(){if(disposed)return;disposed=true;for(const o of originals)o.mesh.material=o.material;for(const c of copies)c.material.dispose();},
 };
}
