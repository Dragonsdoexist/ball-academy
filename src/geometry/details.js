import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function oval(f, center, scale) {
  const g = new THREE.SphereGeometry(1, 24, 18);
  g.scale(...scale);
  g.translate(...center);
  g.rotateX(Math.atan2(f.s, f.c));
  return g.translate(f.cx, f.cy, 0);
}
function tube(points, radius, sides = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segments = Math.max(24, points.length * 3);
  const geom = new THREE.TubeGeometry(curve, segments, 1, sides, false);
  const position = geom.attributes.position,
    normal = geom.attributes.normal;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = curve.getPointAt(t),
      r = typeof radius === 'number' ? radius : radius(t);
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      position.setXYZ(k, p.x + normal.getX(k) * r, p.y + normal.getY(k) * r, p.z + normal.getZ(k) * r);
    }
  }
  return geom;
}
export function deepStructures(f) {
  const points = (count, fn) => Array.from({ length: count }, (_, i) => fn(i / (count - 1)));
  const epi = tube(
    points(19, f.epididymis),
    (t) =>
      0.038 + 0.041 * Math.exp(-((t - 0.05) ** 2) / 0.016) + 0.028 * Math.exp(-((t - 0.94) ** 2) / 0.022),
    16,
  );
  const cord = new THREE.CatmullRomCurve3(f.cord.map((p) => new THREE.Vector3(...p)));
  const vascularPath = (t, r, phase, turns) => {
    const p = cord.getPoint(t),
      a = t * Math.PI * 2 * turns + phase;
    return [p.x + r * Math.cos(a), p.y, p.z + r * Math.sin(a)];
  };
  const veins = Array.from({ length: 5 }, (_, j) =>
    tube(
      points(36, (t) => vascularPath(t, 0.049, (j * 2 * Math.PI) / 5, 1.35)),
      0.0105,
      7,
    ),
  );
  const artery = tube(
    points(40, (t) => vascularPath(t, 0.019, 0.4, 2.1)),
    0.015,
    9,
  );
  const duct = [f.epididymis(1)];
  const route = f.dog ? [0.85, 0.65, 0.42, 0.27] : [0.87, 0.68, 0.42, 0.15, 0.03];
  for (const t of route) {
    const p = f.epididymis(t);
    p[0] -= f.sign * 0.065;
    duct.push(p);
  }
  // Round the turn from the canine caudal pole into the rising cord.
  if (f.dog) {
    const last = duct.at(-1);
    const next = f.cord[1];
    duct.pop();
    const prev = duct.at(-1);
    duct.push(last.map((v, j) => 0.35 * prev[j] + 0.65 * v));
    duct.push(last.map((v, j) => 0.7 * v + 0.3 * (j === 0 ? next[j] - f.sign * 0.059 : next[j])));
  }
  for (const p of f.cord.slice(1)) duct.push([p[0] - f.sign * 0.059, p[1], p[2]]);
  const centralZ = f.dog ? 0 : -f.rz * 0.59;
  const mediastinum = oval(f, [0, 0, centralZ], [0.026, 0.33, 0.03]);
  const nets = [];
  for (let j = -1; j <= 1; j++) {
    nets.push(
      tube(
        points(18, (t) =>
          f.world([0.011 * Math.sin(t * 16 + j) + j * 0.01, t * 0.56 - 0.28, centralZ + 0.026]),
        ),
        0.0045,
        6,
      ),
    );
  }
  for (let i = 0; i < 5; i++)
    nets.push(
      tube(
        [
          f.world([-0.022, i * 0.09 - 0.18, centralZ + 0.025]),
          f.world([0.022, i * 0.09 - 0.16, centralZ + 0.025]),
        ],
        0.0035,
        6,
      ),
    );
  // A few representative compartments radiate from the mediastinum; their count is schematic.
  const lobules = [];
  for (const level of [-0.19, 0.0, 0.19])
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        z = f.rz * 0.65 * Math.sin(a),
        x = f.rx * 0.66 * Math.cos(a);
      const start = f.world([0, level * 0.78, centralZ]),
        end = f.world([x, level, z]);
      const length = new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end));
      const wedge = new THREE.ConeGeometry(0.043, length, 7);
      const outward = new THREE.Vector3(...start).sub(new THREE.Vector3(...end)).normalize();
      wedge.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward));
      wedge.translate(...start.map((v, j) => (v + end[j]) / 2));
      lobules.push(wedge);
    }
  return {
    epididymis: epi,
    ductus_deferens: tube(duct, 0.018),
    testicular_artery: artery,
    pampiniform_plexus: mergeGeometries(veins),
    mediastinum_testis: mediastinum,
    rete_testis: mergeGeometries(nets),
    lobule: mergeGeometries(lobules),
  };
}
