import { Box3, Matrix3, Matrix4, Ray, Vector3 } from 'three';

// glTF stores metres. One nanometre is below the grid resolution by five orders of magnitude.
const contactTolerance = 1e-9;
const axes = ['x', 'y', 'z'];

export function surfaceFromNode(node) {
  const [primitive] = node.getMesh().listPrimitives();
  const positions = primitive.getAttribute('POSITION');
  const normals = primitive.getAttribute('NORMAL');
  const transform = new Matrix4().fromArray(node.getWorldMatrix());
  const normalTransform = new Matrix3().getNormalMatrix(transform);
  const points = [], directions = [], faces = [];
  for (let i = 0; i < positions.getCount(); i++) {
    points.push(new Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(transform));
    directions.push(new Vector3().fromArray(normals.getElement(i, [])).applyMatrix3(normalTransform));
  }
  const indices = primitive.getIndices().getArray();
  for (let i = 0; i < indices.length; i += 3) {
    const ids = Array.from(indices.subarray(i, i + 3));
    const [a, b, c] = ids.map(id => points[id]);
    if (!a || !b || !c) throw new Error(node.getName() + ' invalid indices at triangle ' + i / 3);
    faces.push(triangle(a, b, c, i / 3, ids));
  }
  return { node, name: node.getName(), points, directions, faces, bounds: new Box3().setFromPoints(points) };
}

export function triangle(a, b, c, id, ids) {
  const edges = [b.clone().sub(a), c.clone().sub(b), a.clone().sub(c)];
  return {
    id, ids, a, b, c, edges, normal: edges[0].clone().cross(edges[1]),
    box: new Box3().setFromPoints([a, b, c]).expandByScalar(contactTolerance),
    center: a.clone().add(b).add(c).divideScalar(3),
  };
}

// Median splits are only a broad phase. Every pair with overlapping triangle bounds
// reaches the separating-axis test, including non-adjacent layers and coplanar contacts.
export function faceTree(faces) {
  const box = new Box3();
  for (const face of faces) box.union(face.box);
  if (faces.length <= 8) return { box, faces };
  const size = box.getSize(new Vector3());
  const axis = axes.reduce((best, next) => size[next] > size[best] ? next : best);
  const ordered = [...faces].sort((a, b) => a.center[axis] - b.center[axis]);
  const half = Math.floor(faces.length / 2);
  return { box, children: [faceTree(ordered.slice(0, half)), faceTree(ordered.slice(half))] };
}

function separated(a, b, axis) {
  const a1 = axis.dot(a.a), a2 = axis.dot(a.b), a3 = axis.dot(a.c);
  const b1 = axis.dot(b.a), b2 = axis.dot(b.b), b3 = axis.dot(b.c);
  const epsilon = contactTolerance * axis.length();
  return Math.min(a1, a2, a3) > Math.max(b1, b2, b3) + epsilon ||
    Math.min(b1, b2, b3) > Math.max(a1, a2, a3) + epsilon;
}

function touches(a, b) {
  if (separated(a, b, a.normal) || separated(a, b, b.normal)) return false;
  const axis = new Vector3();
  for (const edge of a.edges) {
    for (const other of b.edges) {
      if (separated(a, b, axis.crossVectors(edge, other))) return false;
    }
  }
  // When both triangles are coplanar the preceding axes all point out of plane.
  for (const face of [a, b]) {
    for (const edge of face.edges) {
      if (separated(a, b, axis.crossVectors(face.normal, edge))) return false;
    }
  }
  return true;
}

export function firstContact(a, b) {
  if (!a.box.intersectsBox(b.box)) return null;
  if (a.children || b.children) {
    const splitA = a.children && (!b.children || a.box.getSize(new Vector3()).lengthSq() >= b.box.getSize(new Vector3()).lengthSq());
    const children = splitA ? a.children : b.children;
    for (const child of children) {
      const contact = splitA ? firstContact(child, b) : firstContact(a, child);
      if (contact) return contact;
    }
    return null;
  }
  for (const f of a.faces) {
    for (const g of b.faces) {
      if (f.box.intersectsBox(g.box) && touches(f, g)) return [f, g];
    }
  }
  return null;
}

export function nearestHit(tree, ray) {
  if (!ray.intersectsBox(tree.box)) return Infinity;
  if (tree.children) return Math.min(nearestHit(tree.children[0], ray), nearestHit(tree.children[1], ray));
  let distance = Infinity;
  const hit = new Vector3();
  for (const f of tree.faces) {
    if (ray.intersectTriangle(f.a, f.b, f.c, false, hit)) distance = Math.min(distance, ray.origin.distanceTo(hit));
  }
  return distance;
}

export function faceRay(mesh, face) {
  const normal = face.ids.reduce((sum, i) => sum.add(mesh.directions[i]), new Vector3()).normalize();
  return new Ray(face.center.clone().addScaledVector(normal, contactTolerance * 2), normal);
}

export function signedVolume(mesh) {
  let sixVolumes = 0;
  for (const face of mesh.faces) sixVolumes += face.a.dot(face.normal);
  return sixVolumes / 6;
}

// Integrate moments uniformly over triangular area. Vertex density alone would bias
// the inferred axis toward densely triangulated regions from marching cubes.
export function longAxis(mesh) {
  const mean = new Vector3();
  let area = 0;
  for (const f of mesh.faces) {
    const weight = f.normal.length();
    mean.addScaledVector(f.center, weight);
    area += weight;
  }
  mean.divideScalar(area);
  const covariance = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  for (const f of mesh.faces) {
    const offsets = [f.a, f.b, f.c].map(v => v.clone().sub(mean));
    const sum = offsets.reduce((s, v) => s.add(v), new Vector3());
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const u = axes[i], v = axes[j];
      covariance.elements[i + 3*j] += f.normal.length() *
        (sum[u]*sum[v] + offsets.reduce((s, p) => s + p[u]*p[v], 0));
    }
  }
  const axis = new Vector3(0, 1, 0);
  for (let i = 0; i < 50; i++) axis.applyMatrix3(covariance).normalize();
  return axis;
}

export function extent(mesh, direction) {
  let lo = Infinity, hi = -Infinity;
  for (const p of mesh.points) {
    const d = p.dot(direction);
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return hi - lo;
}

export function topology(mesh, weldSeams = false) {
  // UV seams, tube seams and normals at sharp creases can split identical positions.
  // Weld at 0.1 micrometres for connectivity only; contact tests use original vertices.
  const pointIds = new Map();
  const welded = mesh.points.map((p, i) => {
    if (!weldSeams) return i;
    const key = p.toArray().map(x => Math.round(x * 1e7)).join(',');
    if (!pointIds.has(key)) pointIds.set(key, pointIds.size);
    return pointIds.get(key);
  });
  const edges = new Map();
  for (const face of mesh.faces) {
    for (let j = 0; j < 3; j++) {
      const a = welded[face.ids[j]], b = welded[face.ids[(j+1)%3]];
      const key = Math.min(a, b) + ',' + Math.max(a, b);
      const edge = edges.get(key) ?? { count: 0, balance: 0, a: face.ids[j], b: face.ids[(j+1)%3], from: a, to: b };
      edge.count++;
      edge.balance += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  const boundary = [], bad = [];
  for (const edge of edges.values()) {
    if (edge.count === 1) boundary.push(edge);
    else if (edge.count !== 2 || edge.balance !== 0) bad.push(edge);
  }
  return { boundary, bad };
}

// The two open tube ends identify head/tail and duct junction without relying on
// the generator's ring order (the compressor may reorder vertices and triangles).
export function endsOfTube(mesh) {
  const { boundary } = topology(mesh, true);
  const links = new Map(), points = new Map();
  for (const { a, b, from, to } of boundary) {
    if (!links.has(from)) links.set(from, []);
    if (!links.has(to)) links.set(to, []);
    links.get(from).push(to);
    links.get(to).push(from);
    points.set(from, mesh.points[a]);
    points.set(to, mesh.points[b]);
  }
  const ends = [], visited = new Set();
  for (const first of links.keys()) {
    if (visited.has(first)) continue;
    const queue = [first], center = new Vector3();
    let count = 0;
    while (queue.length) {
      const id = queue.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      center.add(points.get(id));
      count++;
      queue.push(...links.get(id));
    }
    ends.push(center.divideScalar(count));
  }
  return ends;
}

export function areaSamples(faces, count) {
  const total = faces.reduce((sum, f) => sum + f.normal.length(), 0);
  const samples = [];
  let accumulated = 0;
  for (const face of faces) {
    accumulated += face.normal.length();
    while (samples.length < count && accumulated >= total * (samples.length + 0.5) / count) samples.push(face);
  }
  return samples;
}

// At least one witness per connected triangle component is necessary for containment.
// Splits at UV seams merely add witnesses and cannot hide an exterior component.
export function componentWitnesses(mesh) {
  const labels = Int32Array.from(mesh.faces, (_, i) => i);
  const owners = new Map();
  function root(i) {
    while (i !== labels[i]) {
      labels[i] = labels[labels[i]];
      i = labels[i];
    }
    return i;
  }
  for (const f of mesh.faces) {
    for (let i = 0; i < 3; i++) {
      const a = f.ids[i], b = f.ids[(i+1)%3];
      const edge = Math.min(a, b) * mesh.points.length + Math.max(a, b);
      const other = owners.get(edge);
      if (other === undefined) owners.set(edge, f.id);
      else labels[root(f.id)] = root(other);
    }
  }
  const witnesses = new Map();
  for (const f of mesh.faces) witnesses.set(root(f.id), f);
  return [...witnesses.values()];
}

export function orientedTriangles(primitive) {
  const positions = primitive.getAttribute('POSITION'), normals = primitive.getAttribute('NORMAL');
  const indices = primitive.getIndices().getArray();
  const vertices = Array.from({ length: positions.getCount() }, (_, i) =>
    positions.getElement(i, []).join(',') + '/' + normals.getElement(i, []).join(','));
  // Winding survives meshopt's cyclic index rotation. Canonicalise vertex and face
  // order so lossless repacking can reorder indices without changing the result.
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const v = [vertices[indices[i]], vertices[indices[i+1]], vertices[indices[i+2]]];
    const first = v.indexOf(v.reduce((a, b) => a < b ? a : b));
    triangles.push(v[first] + '|' + v[(first+1)%3] + '|' + v[(first+2)%3]);
  }
  return triangles.sort().join('\n');
}
