import * as T from 'three';

/** Model-local colour, before PBR lighting. No texture re-encoding, extra map,
 * post-processing pass, alpha change, or alteration of the water/UI colours. */
export const MODEL_COLOR = { strength: { value: .28 } };
export const COLOR_REVISION = 'model-color-v1';
export const COLOR_FRAGMENT = `#include <color_fragment>
  {
    vec3 aqC = diffuseColor.rgb;
    float aqY = dot(aqC, vec3(0.2126, 0.7152, 0.0722));
    float aqHi = max(aqC.r, max(aqC.g, aqC.b));
    float aqLo = min(aqC.r, min(aqC.g, aqC.b));
    float aqSat = (aqHi - aqLo) / max(aqHi, 0.00001);
    float aqGain = 1.0 + aquaColorStrength * (1.0 - 0.65 * aqSat);
    vec3 aqD = (aqC - vec3(aqY)) * aqGain;
    float aqMin = min(aqD.r, min(aqD.g, aqD.b));
    float aqMax = max(aqD.r, max(aqD.g, aqD.b));
    float aqGamut = min(1.0, min(aqY / max(-aqMin, 0.00001), (1.0 - aqY) / max(aqMax, 0.00001)));
    diffuseColor.rgb = clamp(vec3(aqY) + aqD * aqGamut, 0.0, 1.0);
  }`;

/** CPU equivalent for regression tests and inventory analysis. Linear RGB. */
export function modelColor(c: readonly number[], strength = MODEL_COLOR.strength.value): number[] {
  const y=c[0]*.2126+c[1]*.7152+c[2]*.0722,hi=Math.max(...c),lo=Math.min(...c),s=(hi-lo)/Math.max(hi,.00001);
  const d=c.map(v=>(v-y)*(1+strength*(1-.65*s))),g=Math.min(1,y/Math.max(-Math.min(...d),.00001),(1-y)/Math.max(Math.max(...d),.00001));
  return d.map(v=>Math.max(0,Math.min(1,y+v*g)));
}
export function modelColorMaterial(material:T.Material):void {
  if(!(material instanceof T.MeshStandardMaterial)||material.userData.aquaModelColor)return;
  material.userData.aquaModelColor=COLOR_REVISION;
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.uniforms.aquaColorStrength=MODEL_COLOR.strength;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float aquaColorStrength;').replace('#include <color_fragment>',COLOR_FRAGMENT);
  };
  material.customProgramCacheKey=()=>previousKey.call(material)+'|'+COLOR_REVISION;
  material.needsUpdate=true;
}
export function modelColorTree(root:T.Object3D):void {
  root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])modelColorMaterial(m);});
}
/** Small mobile-safe cap: keep scales and fin markings readable obliquely.
 * No texture upscaling or extra allocations. Call when a model is installed. */
export function modelTextureQuality(root:T.Object3D,deviceMaximum:number):void {
  const quality=Number.isFinite(deviceMaximum)?Math.max(1,Math.min(4,deviceMaximum)):1;
  root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!(m instanceof T.MeshStandardMaterial)||!m.map||m.map.anisotropy===quality)continue;
    m.map.anisotropy=quality;m.map.needsUpdate=true;
  }});
}
