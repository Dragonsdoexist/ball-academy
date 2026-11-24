import * as THREE from 'three';
import { matte } from './tools.js';

export function blueprint() {
  const assembly = new THREE.Group();
  const globe = new THREE.Group();
  globe.rotation.set(.11, .18, -.27);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(.996,72,44),matte('#0c3b6d'));
  globe.add(shell);
  function circle(points, color) {
    globe.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,toneMapped:false})));
  }
  const steps = Array.from({length:128},(_,i)=>2*Math.PI*i/128);
  for (let band=-5;band<=5;band++) {
    const y=Math.sin(band*Math.PI/12),r=Math.cos(band*Math.PI/12);
    circle(steps.map(a=>new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a))),band===0?'#fffbc8':'#85d7ff');
  }
  for(let i=0;i<12;i++) {
    const angle=i*Math.PI/12;
    circle(steps.map(a=>new THREE.Vector3(Math.cos(a)*Math.sin(angle),Math.sin(a),Math.cos(a)*Math.cos(angle))),'#80ccf4');
  }
  // Registration marks and two drafting circles sit outside the globe.
  for(const [r,colour] of [[1.12,'#95d8f0'],[1.16,'#4d93bf']]) {
    circle(steps.map(a=>new THREE.Vector3(r*Math.cos(a),0,r*Math.sin(a))),colour);
  }
  const ticks=[];
  for(let i=0;i<72;i++) {
    const a=i*Math.PI/36, end=i%6===0?1.225:1.177;
    ticks.push(new THREE.Vector3(1.145*Math.cos(a),0,1.145*Math.sin(a)),new THREE.Vector3(end*Math.cos(a),0,end*Math.sin(a)));
  }
  globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks),new THREE.LineBasicMaterial({color:'#e2e5a2',toneMapped:false})));
  assembly.add(globe);
  return assembly;
}
