import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {sampledBed,seabedRelief} from './seabed.ts';
import {makeHabitat} from './habitat.ts';
import {WORLD} from './world.ts';

test('seabed relief is bounded, deterministic and has no sharp crawling ledges',()=>{
 for(let tier=1;tier<=11;tier++)for(let x=-5;x<=5;x+=.2)for(let z=-3;z<=3;z+=.2){const h=seabedRelief(x,z,tier);assert.ok(Number.isFinite(h)&&Math.abs(h)<.13);assert.equal(h,seabedRelief(x,z,tier));assert.ok(Math.abs(seabedRelief(x+.01,z,tier)-h)<.004);}
});

test('bed sampler uses the actual rendered diagonal, including clamped edges',()=>{
 const b=sampledBed((x,z)=>x*z,2,2);
 for(const [x,z]of[[-5,-3],[5,3],[-2.5,-1.5],[2.5,1.5]])assert.ok(Number.isFinite(b.sample(x,z)));
 assert.equal(b.sample(-100,-100),b.sample(-5,-3));assert.equal(b.sample(100,100),b.sample(5,3));
});

test('ground height matches floor raycasts throughout all eleven enlarged habitats',()=>{
 for(let tier=1;tier<=11;tier++){
  const h=makeHabitat(tier);h.root.scale.set(1.7,1.3,1.6);h.root.position.y=WORLD.floor*(1-1.3);h.root.updateMatrix();h.root.updateMatrixWorld(true);
  for(let n=0;n<40;n++){const x=Math.sin(n*2.399)*7.5,z=Math.cos(n*1.17)*4.5,ray=new T.Raycaster(new T.Vector3(x,4,z),new T.Vector3(0,-1,0)),hit=ray.intersectObject(h.floor)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-h.heightAt(x,z))<2e-5,`${tier}: exact terrain contact`);}
  const shadow=h.root.getObjectByName('soft-contact-shadow') as T.Mesh;assert.ok(shadow.geometry.attributes.position.count>100,'shadows conform to terrain instead of floating cards');h.dispose();
 }
});
