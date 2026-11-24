import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { calibrationSphere, referenceFloor } from './calibration.js';

const distance = 4.65;
const directions = {
  front: new THREE.Vector3(0, .22, 1).normalize(),
  side: new THREE.Vector3(1, .22, 0).normalize(),
  top: new THREE.Vector3(0, 1, .001).normalize()
};

export function createViewer(container, onView, onFailure) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;

  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.dataset.label = 'canvasLabel';
  container.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = distance / 1.55;
  controls.maxDistance = distance / .7;
  controls.maxPolarAngle = Math.PI * .83;
  controls.rotateSpeed = .75;
  scene.add(calibrationSphere(), referenceFloor());
  scene.add(new THREE.HemisphereLight(0xe9fffa, 0x547a73, 1.35));
  function light(color, power, x, y, z) {
    const lamp = new THREE.DirectionalLight(color, power);
    lamp.position.set(x, y, z);
    scene.add(lamp);
  }
  light(0xfff6e7, 2.4, -3, 5, 4);
  light(0x98e4df, 2.1, 2, 2, -3);

  function render() {
    const direction = camera.position.clone().normalize();
    const angle = Object.keys(directions).find(id => directions[id].dot(direction) > .99999) ?? 'free';
    onView(angle, Math.round(100 * distance / camera.position.length()));
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', render);
  function orient(angle, radius = camera.position.length()) {
    camera.position.copy(directions[angle]).multiplyScalar(radius);
    controls.update();
  }
  function zoom(factor) {
    const radius = THREE.MathUtils.clamp(camera.position.length() / factor, controls.minDistance, controls.maxDistance);
    camera.position.setLength(radius);
    controls.update();
  }
  canvas.addEventListener('keydown', event => {
    const rotations = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
    if (Object.hasOwn(rotations, event.key)) {
      const [azimuth, polar] = rotations[event.key];
      const pose = new THREE.Spherical().setFromVector3(camera.position);
      pose.theta += azimuth;
      pose.phi = THREE.MathUtils.clamp(pose.phi + polar, .001, controls.maxPolarAngle);
      camera.position.setFromSpherical(pose);
      controls.update();
    } else if (['+', '=', '-'].includes(event.key)) {
      zoom(event.key === '-' ? 1 / 1.15 : 1.15);
    } else {
      return;
    }
    event.preventDefault();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    onFailure();
  });

  orient('front', distance);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    // Preserve the specimen margin even on narrow portrait screens.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) / Math.min(1, camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  return { orient, zoom, reset: () => orient('front', distance) };
}
