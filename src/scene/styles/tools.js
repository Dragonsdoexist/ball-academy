import * as THREE from 'three';

export function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function texture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

export function matte(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, ...options });
}

export function stroke(points, radius, color) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const line = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(12, points.length * 4), radius, 6, false), matte(color));
  const cap = new THREE.SphereGeometry(radius, 8, 6);
  for (const end of [points[0], points.at(-1)]) {
    const dot = new THREE.Mesh(cap, line.material);
    dot.position.set(...end);
    line.add(dot);
  }
  return line;
}

export function oval(x, y, z, rx, ry, rz, color) {
  const item = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), matte(color));
  item.position.set(x, y, z);
  item.scale.set(rx, ry, rz);
  return item;
}

export function floorMark(color, width, depth, y) {
  const mark = new THREE.Mesh(new THREE.CircleGeometry(1, 80), matte(color, { side: THREE.DoubleSide, depthWrite: false }));
  mark.rotation.x = -Math.PI / 2;
  mark.scale.set(width, depth, 1);
  mark.position.y = y;
  return mark;
}
