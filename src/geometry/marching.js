import { triTable } from 'three/addons/objects/MarchingCubes.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

const n = 196,
  step = 0.0116,
  origin = [-1.13, -1.003, -0.99];
export const gridInfo = { resolution: n, spacing: step, origin };
const offsets = [0, 1, n + 1, n, n * n, n * n + 1, n * n + n + 1, n * n + n];
const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const edges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
export function sampleGrid(evaluate) {
  const field = new Float32Array(n ** 3);
  let i = 0;
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        field[i] = evaluate(x * step + origin[0], y * step + origin[1], z * step + origin[2], i);
        i++;
      }
  return field;
}
function largestSheet(indices, vertexCount) {
  const count = indices.length / 3;
  const parent = Int32Array.from({ length: count }, (_, i) => i);
  const size = new Uint32Array(count).fill(1),
    edgeOwner = new Map();
  function root(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  for (let i = 0; i < count; i++)
    for (let j = 0; j < 3; j++) {
      const a = indices[3 * i + j],
        b = indices[3 * i + ((j + 1) % 3)];
      const edge = Math.min(a, b) * vertexCount + Math.max(a, b);
      if (!edgeOwner.has(edge)) {
        edgeOwner.set(edge, i);
        continue;
      }
      let left = root(i),
        right = root(edgeOwner.get(edge));
      if (left === right) continue;
      if (size[right] > size[left]) [left, right] = [right, left];
      parent[right] = left;
      size[left] += size[right];
    }
  let largest = 0;
  for (let i = 1; i < count; i++) if (size[root(i)] > size[root(largest)]) largest = i;
  const keep = root(largest);
  return indices.filter((_, i) => root(Math.floor(i / 3)) === keep);
}
export function extract(field, iso, include, singleSheet = false) {
  const positions = [],
    indices = [],
    cache = new Map();
  for (let z = 0; z < n - 1; z++)
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const base = (z * n + y) * n + x;
        // Most rows never reach the surface; this bound exceeds the local field change per cell.
        if (Math.abs(field[base] - iso) > step * 2.2) continue;
        let bits = 0;
        for (let i = 0; i < 8; i++) if (field[base + offsets[i]] < iso) bits |= 1 << i;
        if (bits === 0 || bits === 255) continue;
        const px = x * step + origin[0],
          py = y * step + origin[1],
          pz = z * step + origin[2];
        if (include && !include(px + step / 2, py + step / 2, pz + step / 2)) continue;
        function vertex(edge) {
          const [a, b] = edges[edge];
          const ia = base + offsets[a],
            ib = base + offsets[b];
          const axis = ia === ib + 1 || ib === ia + 1 ? 0 : Math.abs(ia - ib) === n ? 1 : 2;
          let t = (iso - field[ia]) / (field[ib] - field[ia]);
          let key = Math.min(ia, ib) * 3 + axis;
          // A crossing within 0.3% of a voxel corner shares the corner vertex across all edges.
          // This avoids micrometre slivers before boundary-preserving simplification.
          if (t < 0.003 || t > 0.997) {
            t = t < 0.5 ? 0 : 1;
            key = -(1 + (t === 0 ? ia : ib));
          }
          if (cache.has(key)) return cache.get(key);
          const index = positions.length / 3;
          const ca = corners[a],
            cb = corners[b];
          positions.push(
            px + step * (ca[0] + t * (cb[0] - ca[0])),
            py + step * (ca[1] + t * (cb[1] - ca[1])),
            pz + step * (ca[2] + t * (cb[2] - ca[2])),
          );
          cache.set(key, index);
          return index;
        }
        for (let j = bits * 16; triTable[j] >= 0; j += 3) {
          const a = vertex(triTable[j]),
            b = vertex(triTable[j + 2]),
            c = vertex(triTable[j + 1]);
          if (a !== b && b !== c && c !== a) indices.push(a, b, c);
        }
      }
  const pos = new Float32Array(positions);
  // Interpolate the sampled SDF gradients, independent of the irregular simplified triangles.
  const gradients = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const grid = [0, 1, 2].map((j) => (pos[i + j] - origin[j]) / step);
    const [x, y, z] = grid.map(Math.floor);
    const frac = grid.map((q) => q - Math.floor(q));
    const g = [0, 0, 0];
    for (const [dx, dy, dz] of corners) {
      const at = ((z + dz) * n + y + dy) * n + x + dx;
      const weight =
        (dx ? frac[0] : 1 - frac[0]) * (dy ? frac[1] : 1 - frac[1]) * (dz ? frac[2] : 1 - frac[2]);
      for (const [j, stride] of [1, n, n * n].entries())
        g[j] += weight * (field[at + stride] - field[at - stride]);
    }
    const length = Math.hypot(...g) || 1;
    for (let j = 0; j < 3; j++) gradients[i + j] = g[j] / length;
  }
  const raw = new Uint32Array(indices);
  const locked = new Uint8Array(pos.length / 3);
  let simplified;
  for (let attempt = 0; attempt < 5; attempt++) {
    [simplified] = MeshoptSimplifier.simplifyWithAttributes(
      raw,
      pos,
      3,
      gradients,
      3,
      [0.012, 0.012, 0.012],
      locked,
      Math.max(600, Math.floor((indices.length * 0.026) / 3) * 3),
      0.002,
      include ? ['LockBorder', 'PreserveFolds'] : ['PreserveFolds'],
    );
    const folds = [];
    for (let i = 0; i < simplified.length; i += 3) {
      const a = 3 * simplified[i],
        b = 3 * simplified[i + 1],
        c = 3 * simplified[i + 2];
      const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      const v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      let orientation = 0;
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3,
          l = (j + 2) % 3;
        orientation += (u[k] * v[l] - u[l] * v[k]) * (gradients[a + j] + gradients[b + j] + gradients[c + j]);
      }
      if (orientation <= 0) {
        const center = [0, 1, 2].map((j) => (pos[a + j] + pos[b + j] + pos[c + j]) / 3);
        const radius = Math.max(Math.hypot(...u), Math.hypot(...v)) + (2 + attempt) * step;
        folds.push({ center, radius });
      }
    }
    if (!folds.length) break;
    // Retain the original local surface wherever decimation folds a thin triangle.
    for (const { center, radius } of folds)
      for (let i = 0; i < pos.length; i += 3) {
        const dx = pos[i] - center[0],
          dy = pos[i + 1] - center[1],
          dz = pos[i + 2] - center[2];
        if (dx * dx + dy * dy + dz * dz < radius * radius) locked[i / 3] = 1;
      }
  }
  if (singleSheet) simplified = largestSheet(simplified, pos.length / 3);
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const compact = new Float32Array(count * 3);
  for (let i = 0; i < remap.length; i++)
    if (remap[i] !== 0xffffffff) {
      compact.set(pos.subarray(i * 3, i * 3 + 3), remap[i] * 3);
    }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(compact, 3));
  geom.setIndex(new Uint32BufferAttribute(simplified, 1));
  const normals = new Float32Array(compact.length);
  for (let i = 0; i < remap.length; i++)
    if (remap[i] !== 0xffffffff) {
      normals.set(gradients.subarray(i * 3, i * 3 + 3), remap[i] * 3);
    }
  // At a tight concavity, a voxel-averaged gradient can point across the actual facet.
  // Use the incident facets to constrain shading normals at those vertices only.
  const a = new Float64Array(3),
    b = new Float64Array(3),
    face = new Float64Array(3);
  for (let pass = 0; pass < 6; pass++) {
    let adjusted = false;
    for (let i = 0; i < simplified.length; i += 3) {
      const pa = 3 * simplified[i],
        pb = 3 * simplified[i + 1],
        pc = 3 * simplified[i + 2];
      for (let j = 0; j < 3; j++) {
        a[j] = compact[pb + j] - compact[pa + j];
        b[j] = compact[pc + j] - compact[pa + j];
      }
      for (let j = 0; j < 3; j++) face[j] = a[(j + 1) % 3] * b[(j + 2) % 3] - a[(j + 2) % 3] * b[(j + 1) % 3];
      const len = Math.hypot(...face);
      if (!len) continue;
      for (let j = 0; j < 3; j++) face[j] /= len;
      for (const index of [pa, pb, pc]) {
        const dot = face[0] * normals[index] + face[1] * normals[index + 1] + face[2] * normals[index + 2];
        if (dot >= 0.025) continue;
        for (let j = 0; j < 3; j++) normals[index + j] += (0.05 - dot) * face[j];
        const magnitude = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
        for (let j = 0; j < 3; j++) normals[index + j] /= magnitude;
        adjusted = true;
      }
    }
    if (!adjusted) break;
  }
  geom.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geom;
}
