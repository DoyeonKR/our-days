import {openedCore} from './remodel-hull.mjs';
// A conservative, inscribed round-section carve. Every retained voxel still
// belongs to the original four-mask visual hull; no old geometry is sampled.
// Morphological opening prevents a projected flipper from becoming the full
// depth of a torso. Appendages are restored separately from their silhouettes.
export function roundSectionPrior(views){
 const profiles={};
 for(const name of ['side','top','bottom']){const s=openedCore(views[name],.48),columns=[];for(let x=0;x<256;x++){let best=null,start=-1;for(let y=0;y<=256;y++){if(y<256&&s.mask[y*256+x]){if(start<0)start=y;}else if(start>=0){if(!best||y-start>best[1]-best[0])best=[start,y-1];start=-1;}}columns.push(best);}profiles[name]=columns.map((p,x)=>{if(!p)return null;const near=columns.slice(Math.max(0,x-3),x+4).filter(Boolean),median=k=>near.map(a=>a[k]).sort((a,b)=>a-b)[Math.floor(near.length/2)];return[median(0),median(1)];});}
 return (X,Y,Z)=>{const x=Math.round((512+410*X)/4),s=profiles.side[x],t=profiles.top[x],b=profiles.bottom[x];if(!s||!t||!b)return true;const cy=(512-2*(s[0]+s[1]))/410,ry=Math.max(.006,2*(s[1]-s[0]+1)/410),za=(4*t[0]-512)/410,zb=(4*t[1]-512)/410,ba=(512-4*b[1])/410,bb=(512-4*b[0])/410,z0=Math.max(za,ba),z1=Math.min(zb,bb);if(z1<=z0)return false;const cz=(z0+z1)/2,rz=Math.max(.006,(z1-z0)/2);return((Y-cy)/ry)**2+((Z-cz)/rz)**2<=1.04;};
}
