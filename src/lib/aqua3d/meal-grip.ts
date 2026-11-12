import * as T from 'three';

/** Bounded CCD on authored independent arm chains, after their normal pose.
 * No generated arms, geometry mutation, or shared-skeleton modifications. */
export function mealGrip(root:T.Object3D){
 const chains=Array.from({length:10},(_,i)=>[0,1,2].map(j=>root.getObjectByName(`arm_${i}_${j}`))).filter(c=>c.every(Boolean)) as T.Object3D[][];
 const legacy=[0,1,2,3].map(i=>root.getObjectByName(`spine_${i}`));
 const anchor=new T.Vector3(),after=new T.Vector3(),axis=new T.Vector3(0,0,1);
 const joint=new T.Vector3(),tip=new T.Vector3(),goal=new T.Vector3(),from=new T.Vector3(),to=new T.Vector3(),inverse=new T.Quaternion(),delta=new T.Quaternion(),identity=new T.Quaternion();
 return (target:T.Vector3,radius:number,strength:number)=>{
  if(strength<=0)return;
  // Existing GLBs share three arm-region spine joints, rather than separate
  // arm chains. Flex that region only and pin the mantle, never invent bones.
  if(!chains.length&&legacy.every(Boolean)){
   const base=legacy[0]!,mantle=legacy[3]!;if(!base.parent)return;
   mantle.getWorldPosition(anchor);
   for(let j=0;j<3;j++)legacy[j]!.quaternion.multiply(delta.setFromAxisAngle(axis,(.16+j*.07)*strength));
   root.updateWorldMatrix(true,true);mantle.getWorldPosition(after);
   base.parent.worldToLocal(anchor);base.parent.worldToLocal(after);base.position.add(anchor.sub(after));
   return;
  }
  for(let i=0;i<chains.length;i++){
   const chain=chains[i],a=i/chains.length*Math.PI*2;
   goal.copy(target);goal.y+=Math.cos(a)*radius*.3;goal.z+=Math.sin(a)*radius*.3;
   for(let j=1;j>=0;j--){const b=chain[j];root.updateWorldMatrix(true,true);
    b.getWorldPosition(joint);chain[2].getWorldPosition(tip);
    from.copy(tip).sub(joint);to.copy(goal).sub(joint);
    if(from.lengthSq()<1e-8||to.lengthSq()<1e-8||!b.parent)continue;
    b.parent.getWorldQuaternion(inverse).invert();from.applyQuaternion(inverse).normalize();to.applyQuaternion(inverse).normalize();
    delta.setFromUnitVectors(from,to);const angle=identity.angleTo(delta);
    delta.slerp(identity,1-Math.min(1,.55/Math.max(angle,1e-6))*strength);
    b.quaternion.premultiply(delta);
   }
  }
 };
}
