import * as THREE from 'three';

// An asymmetric calibration pattern makes small rotations visible on a sphere.
export function calibrationSphere() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#b2d7cd';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#a7cec3';
  ctx.fillRect(0, height / 2, width, height / 2);

  for (let x = 0; x < width; x += width / 12) {
    ctx.fillStyle = '#83b0a6';
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += height / 6) {
    ctx.fillStyle = '#80aaa0';
    ctx.fillRect(0, y, width, 1.5);
  }
  ctx.fillStyle = '#709e93';
  ctx.fillRect(0, 247, width, 3);
  ctx.fillRect(0, 250, width, 13);
  ctx.fillStyle = '#cae6dc';
  ctx.fillRect(0, 263, width, 2);
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(i * width / 120, 254, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 8 : 4);
  }

  // Repeat the small fiducials around the equator for all three preset views.
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * width / 6;
    ctx.strokeStyle = '#5e8e82';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, height * .38, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#628c81';
    ctx.fillRect(x - 1, height * .38 - 2, 2, 4);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const material = new THREE.MeshPhysicalMaterial({ map, roughness: .46, metalness: .08, clearcoat: .18, clearcoatRoughness: .42 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
  sphere.rotation.set(.18, -.24, -.24);
  return sphere;
}

export function referenceFloor() {
  const floor = new THREE.Group();
  const grid = new THREE.GridHelper(13, 52, 0x67918d, 0x67918d);
  grid.material.transparent = true;
  grid.material.opacity = .12;
  grid.material.depthWrite = false;
  floor.add(grid);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.34, 1.348, 128),
    new THREE.MeshBasicMaterial({ color: 0x8bc7b8, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .002;
  floor.add(ring);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0, 16, 20, .9)');
  gradient.addColorStop(.55, 'rgba(0, 16, 20, .38)');
  gradient.addColorStop(1, 'rgba(0, 16, 20, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .005;
  floor.add(shadow);
  floor.position.y = -1.09;
  return floor;
}
