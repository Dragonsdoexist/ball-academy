import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { specimen, peel, highlight } from './specimen.js';

const distance = 4.65;
const directions = {
  study: new THREE.Vector3(0.6, 0.33, -1).normalize(),
  front: new THREE.Vector3(0, 0.22, 1).normalize(),
  side: new THREE.Vector3(1, 0.22, 0).normalize(),
  top: new THREE.Vector3(0, 1, 0.001).normalize(),
};

export function createViewer(container, onView, onFailure, onPick) {
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
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = distance / 1.55;
  controls.maxDistance = distance / 0.7;
  controls.maxPolarAngle = Math.PI * 0.83;
  controls.rotateSpeed = 0.75;
  scene.add(new THREE.AmbientLight(0xfff9ee, 1.35));
  const lamp = new THREE.DirectionalLight(0xffffff, 1.75);
  lamp.position.set(-3, 5, 4);
  scene.add(lamp);
  let current,
    requested = 0,
    stage = 8;
  async function setSpecies(id) {
    const ticket = ++requested;
    if (current) current.scene.visible = false;
    render();
    const model = await specimen(id);
    if (ticket !== requested) return false;
    if (current) scene.remove(current.scene);
    current = model;
    scene.add(model.scene);
    peel(model, stage);
    highlight(model, null);
    model.scene.visible = true;
    const wasStudy = directions.study.dot(camera.position.clone().normalize()) > 0.99999;
    directions.study.set(0.6, id === 'dog' ? 0.84 : 0.33, id === 'dog' ? 1 : -1).normalize();
    if (wasStudy) orient('study');
    render();
    return true;
  }
  function setStage(value) {
    stage = value;
    if (current) {
      peel(current, stage);
      render();
    }
  }
  const ray = new THREE.Raycaster();
  let start;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.isPrimary) start = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointercancel', () => {
    start = null;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!start || !e.isPrimary) return;
    const movement = Math.hypot(e.clientX - start[0], e.clientY - start[1]);
    start = null;
    if (movement > 5 || !current?.scene.visible) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2 },
      camera,
    );
    const hit = ray.intersectObjects(
      current.surfaces.filter((m) => m.visible),
      false,
    )[0];
    if (hit) onPick(hit.object.userData.structure);
  });
  function render() {
    const direction = camera.position.clone().normalize();
    const angle = Object.keys(directions).find((id) => directions[id].dot(direction) > 0.99999) ?? 'free';
    onView(angle, Math.round((100 * distance) / camera.position.length()));
    renderer.render(scene, camera);
  }
  controls.addEventListener('change', render);
  function orient(angle, radius = camera.position.length()) {
    camera.position.copy(directions[angle]).multiplyScalar(radius);
    controls.update();
  }
  function zoom(factor) {
    const radius = THREE.MathUtils.clamp(
      camera.position.length() / factor,
      controls.minDistance,
      controls.maxDistance,
    );
    camera.position.setLength(radius);
    controls.update();
  }
  canvas.addEventListener('keydown', (event) => {
    const rotations = {
      ArrowLeft: [-0.12, 0],
      ArrowRight: [0.12, 0],
      ArrowUp: [0, -0.12],
      ArrowDown: [0, 0.12],
    };
    if (Object.hasOwn(rotations, event.key)) {
      const [azimuth, polar] = rotations[event.key];
      const pose = new THREE.Spherical().setFromVector3(camera.position);
      pose.theta += azimuth;
      pose.phi = THREE.MathUtils.clamp(pose.phi + polar, 0.001, controls.maxPolarAngle);
      camera.position.setFromSpherical(pose);
      controls.update();
    } else if (['+', '=', '-'].includes(event.key)) {
      zoom(event.key === '-' ? 1 / 1.15 : 1.15);
    } else {
      return;
    }
    event.preventDefault();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    onFailure();
  });

  orient('study', distance);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    // Preserve the specimen margin even on narrow portrait screens.
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) / Math.min(1, camera.aspect)),
    );
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  return {
    orient,
    zoom,
    setSpecies,
    setStage,
    highlight(id) {
      if (current) {
        highlight(current, id);
        render();
      }
    },
    reset: () => orient('study', distance),
  };
}
