import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { doodle } from './styles/doodle.js';
import { oil } from './styles/oil.js';
import { blueprint } from './styles/blueprint.js';
import { paper } from './styles/paper.js';
import { glass } from './styles/glass.js';

const renderStyles = { doodle, oil, blueprint, paper, glass };

const distance = 4.65;
const directions = {
  front: new THREE.Vector3(0, .22, 1).normalize(),
  side: new THREE.Vector3(1, .22, 0).normalize(),
  top: new THREE.Vector3(0, 1, .001).normalize()
};

export function createViewer(container, onView, onFailure, initialStyle) {
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
  const studies = new Map();
  let active;
  function useStyle(id) {
    if (!studies.has(id)) studies.set(id, renderStyles[id]());
    if (active) scene.remove(active);
    active = studies.get(id);
    scene.background = active.userData.backdrop ?? null;
    scene.add(active);
    render();
  }

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
  useStyle(initialStyle);
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
  return { orient, zoom, useStyle, reset: () => orient('front', distance) };
}
