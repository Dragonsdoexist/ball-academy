import * as THREE from 'three';
import { matte, floorMark } from './tools.js';

export function paper() {
  const scene = new THREE.Group(), stack = new THREE.Group();
  const strips = ['#13585b','#267d79','#77aaa0','#d4d7a4','#f8dfa5','#f7b577','#ed9267','#df6b57','#c24b49','#9d3a46','#713345','#442e43'];
  const count=18, step=2/count;
  for(let i=0;i<count;i++) {
    const low=-1+i*step+.005, high=low+step*.88;
    const radiusAt = y=>Math.sqrt(Math.max(.006,1-y*y));
    const tint=strips[Math.min(strips.length-1,Math.floor(i/count*strips.length))];
    const wall=matte(new THREE.Color(tint).multiplyScalar(.73));
    const cap=matte(tint);
    const slice=new THREE.Mesh(new THREE.CylinderGeometry(radiusAt(high),radiusAt(low),high-low,64),[wall,cap,cap]);
    slice.position.set(.012*Math.sin(i*2), (low+high)/2, .008*Math.cos(i));
    stack.add(slice);
  }
  stack.rotation.set(.63,.04,-.48);
  const shadow=floorMark('#c58370',1.15,.60,-1.10);
  shadow.position.x=.26;
  scene.add(stack,shadow);
  return scene;
}
