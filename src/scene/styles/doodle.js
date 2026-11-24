import * as THREE from 'three';
import { matte, stroke, oval, floorMark } from './tools.js';

const ink = '#27251f';
function surface(x, y) { return Math.sqrt(Math.max(.01, 1 - x*x - y*y)); }

export function doodle() {
  const scene = new THREE.Group();
  const character = new THREE.Group();
  const body = new THREE.SphereGeometry(1, 96, 60);
  const positions = body.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const wobble = 1 + .014 * Math.sin(5*x + y) * Math.cos(3*y - z) + .016 * x*y;
    positions.setXYZ(i, x*wobble, y*wobble*.95, z*wobble);
    color.set(y + .24*x + .12*z < -.72 ? '#eddfa4' : '#fff4bd');
    colors.push(color.r, color.g, color.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  character.add(new THREE.Mesh(body, matte('#ffffff',{ vertexColors: true })));
  const outline = new THREE.Mesh(body, matte(ink, { side: THREE.BackSide }));
  outline.scale.setScalar(1.022);
  character.add(outline);

  function mark(points, weight = .013) {
    const projected = points.map(([x,y]) => [x,y,surface(x,y)+.03]);
    character.add(stroke(projected, weight, ink));
  }
  // A lopsided expression and two scuff marks belong to the practice sphere.
  character.add(oval(-.21,.18,surface(-.21,.18)+.012,.032,.071,.033,ink));
  character.add(oval(.19,.13,surface(.19,.13)+.015,.032,.062,.033,ink));
  mark([[-.082,.035],[-.048,.006],[.015,.0],[.068,.02]], .012);
  mark([[.125,.295],[.17,.32],[.22,.316]], .012);
  mark([[-.55,.51],[-.49,.57],[-.40,.625]],.012);
  mark([[-.49,.48],[-.44,.53]],.009);
  for (const [x,y] of [[-.35,.049],[.33,.00]]) {
    const cheek = oval(x,y,surface(x,y)+.008,.082,.034,.026,'#f49b87');
    cheek.rotation.z = -.1;
    character.add(cheek);
  }
  character.add(stroke([[-.95,.025,.05],[-1.065,-.07,.13],[-1.15,-.034,.19]],.017,ink));
  character.add(stroke([[.96,.04,.08],[1.11,.14,.16],[1.15,.245,.19]],.017,ink));
  for (const [x,tip] of [[-.35,-.51],[.29,.42]]) {
    character.add(stroke([[x,-.82,.14],[x+.012,-1.01,.18],[x,-1.1,.22],[tip,-1.1,.26]], .022,ink));
  }
  character.scale.setScalar(.93);
  character.rotation.z = -.045;
  character.position.y = .06;
  scene.add(character, floorMark('#d9cfaf', .77, .37, -1.01));
  return scene;
}
