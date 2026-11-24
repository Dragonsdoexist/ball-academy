import * as THREE from 'three';
import { randomSequence, matte } from './tools.js';

export function glass() {
  const group=new THREE.Group();
  const shell=new THREE.IcosahedronGeometry(1,2);
  const p=shell.attributes.position, random=randomSequence(64);
  const colors=[], tint=new THREE.Color();
  const palette=['#af3159','#c85838','#ed9a33','#ffc367','#119784','#337b98','#424b9e','#7a467f','#26b4b3'];
  for(let i=0;i<p.count;i+=3) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const wave=.48*Math.sin(2.8*x+1.7*y)+.52*Math.cos(2.5*y-2*z);
    const blend=THREE.MathUtils.clamp((wave+1)*.5 + (random()-.5)*.23,0,.999);
    tint.set(palette[Math.floor(blend*palette.length)]);
    for(let j=0;j<3;j++) {
      const shade=.82+.27*random();
      colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
    }
  }
  shell.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const barycentric = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) barycentric[i * 3 + i % 3] = 1;
  shell.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
  const panes = matte('#ffffff', { vertexColors: true });
  panes.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n attribute vec3 barycentric; varying vec3 vPane; varying vec3 vBary; varying vec3 vEye;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vPane = position; vBary = barycentric; vEye = normalize(normalMatrix * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n varying vec3 vPane; varying vec3 vBary; varying vec3 vEye;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 p = vPane;
        float grain = sin(32.0*p.y + 5.0*sin(9.0*p.x + 4.0*p.z));
        float ripple = sin(56.0*p.x + 8.0*p.y + 3.0*grain);
        float leadEdge = smoothstep(0.0, .16, min(vBary.x, min(vBary.y,vBary.z)));
        diffuseColor.rgb *= (.59 + .41*leadEdge) * (.98 + .13*grain + .09*ripple);
        vec3 n = normalize(vEye + vec3(.065*ripple, .06*grain, 0.0));
        float glint = pow(max(dot(n, normalize(vec3(-.39,.48,.8))), 0.0), 45.0);
        diffuseColor.rgb += vec3(.72,.57,.36)*glint;
      `);
  };
  group.add(new THREE.Mesh(shell, panes));
  // Give the lead cames actual width so they read at phone resolution.
  const edges = new THREE.EdgesGeometry(shell,.1).attributes.position;
  const seam=new THREE.CylinderGeometry(.0075,.0075,1,5);
  const lead=new THREE.InstancedMesh(seam,matte('#252535'),edges.count/2);
  const up=new THREE.Vector3(0,1,0), a=new THREE.Vector3(), b=new THREE.Vector3(), dir=new THREE.Vector3();
  const midpoint=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  for(let i=0;i<edges.count;i+=2) {
    a.fromBufferAttribute(edges,i);b.fromBufferAttribute(edges,i+1);
    dir.subVectors(b,a);scale.set(1,dir.length(),1);rotation.setFromUnitVectors(up,dir.normalize());
    midpoint.addVectors(a,b).multiplyScalar(.502);
    lead.setMatrixAt(i/2,matrix.compose(midpoint,rotation,scale));
  }
  group.add(lead);
  group.rotation.z=-.12;
  return group;
}
