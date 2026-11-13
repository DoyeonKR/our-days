/** Static, bounded relief. Animals must never chase an animated floor. */
export function seabedRelief(x:number,z:number,tier:number):number{
 const edge=Math.min(1,Math.abs(x)/4.8),bank=edge*edge;
 const swell=Math.sin(x*.82+z*.31)*Math.cos(z*1.15-x*.17)*(.018+bank*.025);
 const ripple=Math.sin(z*6.2+Math.sin(x*1.25)*.85)*.006;
 const hollow=(cx:number,cz:number)=>Math.exp(-((x-cx)**2/.75+(z-cz)**2/.65));
 return swell+ripple-(hollow(-3.15,-.65)+hollow(3.25,-1.0))*(.035+Math.min(tier,6)*.004);
}

/** The same diagonal triangles as THREE.PlaneGeometry. Analytic heights
 * between vertices float above / cut through the rendered sand on slopes. */
export function sampledBed(height:(x:number,z:number)=>number,nx=96,nz=64){
 const values=new Float32Array((nx+1)*(nz+1));
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)values[j*(nx+1)+i]=height(-5+i*10/nx,-3+j*6/nz);
 const sample=(x:number,z:number)=>{
  const gx=Math.max(0,Math.min(nx,(x+5)/10*nx)),gz=Math.max(0,Math.min(nz,(z+3)/6*nz)),i=Math.min(nx-1,Math.floor(gx)),j=Math.min(nz-1,Math.floor(gz)),u=gx-i,v=gz-j,k=j*(nx+1)+i;
  const a=values[k],b=values[k+nx+1],c=values[k+nx+2],d=values[k+1];
  return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
 };
 return {nx,nz,values,sample};
}
