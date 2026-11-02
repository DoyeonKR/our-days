import * as T from "three";

/** Keep rotated/scaled ornaments inside the glass and seat their modeled base on the substrate. */
export function seatDecor(root:T.Group,heightAt:(x:number,z:number)=>number,halfWidth=4.9) {
  root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(root);
  if(bounds.isEmpty())return;
  const inset=(min:number,max:number,wall:number)=>min < -wall ? -wall-min : max > wall ? wall-max : 0;
  root.position.x+=inset(bounds.min.x,bounds.max.x,halfWidth);
  root.position.z+=inset(bounds.min.z,bounds.max.z,2.9);
  root.position.y+=heightAt(root.position.x,root.position.z)-bounds.min.y;
  root.updateMatrixWorld(true);
}
