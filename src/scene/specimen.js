import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { visibleAt } from '../data/structures.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const ink = new THREE.MeshBasicMaterial({ color: 0x44362f, side: THREE.BackSide, toneMapped: false });
export const selectedInk = ink.clone();
selectedInk.color.set('#ad5d13');
export function highlight(model, id) {
  for (const mesh of model.surfaces)
    mesh.children[0].material = mesh.userData.structure === id ? selectedInk : ink;
}
const tones = new THREE.DataTexture(new Uint8Array([124, 180, 222, 249]), 4, 1, THREE.RedFormat);
tones.minFilter = tones.magFilter = THREE.NearestFilter;
tones.needsUpdate = true;

async function loadSpecies(id) {
  const { scene } = await loader.loadAsync(import.meta.env.BASE_URL + 'models/base/' + id + '.glb');
  const surfaces = [];
  scene.traverse((mesh) => {
    if (mesh.isMesh) surfaces.push(mesh);
  });
  const bounds = new THREE.Box3().setFromObject(scene),
    size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.08 / Math.max(size.x, size.y, size.z);
  for (const mesh of surfaces) {
    const original = mesh.material;
    mesh.material = new THREE.MeshToonMaterial({
      color: original.color,
      gradientMap: tones,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    original.dispose();
    const thickness = mesh.userData.layerIndex === 9 ? 0.0017 : 0.007;
    const geometry = mesh.geometry.clone();
    const points = geometry.attributes.position,
      normals = geometry.attributes.normal;
    for (let i = 0; i < points.count; i++) {
      points.setXYZ(
        i,
        points.getX(i) + (normals.getX(i) * thickness) / scale,
        points.getY(i) + (normals.getY(i) * thickness) / scale,
        points.getZ(i) + (normals.getZ(i) * thickness) / scale,
      );
    }
    mesh.add(new THREE.Mesh(geometry, ink));
  }
  scene.scale.setScalar(scale);
  scene.position.copy(center).multiplyScalar(-scale);
  return { scene, surfaces };
}
export function specimen(id) {
  if (!cache.has(id))
    cache.set(
      id,
      loadSpecies(id).catch((error) => {
        cache.delete(id);
        throw error;
      }),
    );
  return cache.get(id);
}
export function peel(model, stage) {
  for (const surface of model.surfaces) surface.visible = visibleAt(surface.userData, stage);
}
