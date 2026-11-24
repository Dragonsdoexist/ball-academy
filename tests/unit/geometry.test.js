import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Ray, Vector3 } from 'three';
import { references } from '../../src/data/references.js';
import {
  areaSamples, componentWitnesses, endsOfTube, extent, faceRay, faceTree, firstContact, longAxis, nearestHit, orientedTriangles,
  signedVolume, surfaceFromNode, topology, triangle,
} from './geometry-helper.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ids = ['human', 'dog'], sides = ['L', 'R'];
// Independent transcriptions in mm, ordered length / width / height. The canine
// entries are sonographic means in eight dogs, not population reference limits.
// Human: https://doi.org/10.1111/andr.12951 (Table 2)
// Dog: https://pmc.ncbi.nlm.nih.gov/articles/PMC11868414/#Tab1 (Table 1, cm × 10)
const means = {
  human: { R: [45.7, 29.6, 25.1], L: [44.7, 28.8, 24.4] },
  dog: { R: [30.7, 22.3, 17.0], L: [30.3, 23.1, 16.4] },
};
// The dog's -58° is the worked model's illustrative pitch, not a clinical mean.
const pitch = { human: 0, dog: -58 };
const shellIds = ['skin', 'dartos', 'external_sf', 'cremaster', 'internal_sf', 'tv_parietal', 'tv_visceral', 'tunica_albuginea', 'testis'];
const cordIds = ['epididymis', 'ductus_deferens', 'testicular_artery', 'pampiniform_plexus'];
const internalIds = ['lobule', 'mediastinum_testis', 'rete_testis'];
const documents = {}, models = {};
const xAxis = new Vector3(1, 0, 0);
const key = (id, side) => id + '__' + side;
const pointMM = p => '(' + p.toArray().map(v => (1000*v).toFixed(2)).join(', ') + ') mm';
const sameSide = (mesh, side) => ['M', side].includes(mesh.node.getExtras().side);
const center = mesh => mesh.bounds.getCenter(new Vector3());
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

beforeAll(async () => {
  await MeshoptDecoder.ready;
  for (const id of ids) {
    const doc = await io.read(join(root, 'public/models/base', id + '.glb'));
    documents[id] = doc;
    models[id] = new Map(doc.getRoot().listNodes().map(node => {
      const mesh = surfaceFromNode(node);
      mesh.tree = faceTree(mesh.faces);
      return [mesh.name, mesh];
    }));
  }
});

it('detects crossings, edge contact and coplanar overlap while rejecting separated triangles with overlapping bounds', () => {
  const tree = (...points) => faceTree([triangle(...points.map(p => new Vector3(...p)))]);
  const plane = tree([0,0,0], [.01,0,0], [0,.01,0]);
  for (const other of [
    tree([.002,.002,.01], [.002,.002,-.01], [.008,.002,.01]),
    tree([.005,0,0], [.008,-.004,0], [.002,-.004,0]),
    tree([.002,.002,0], [.003,.002,0], [.002,.003,0]),
  ]) expect(firstContact(plane, other)).toBeTruthy();
  expect(firstContact(plane, tree([.008,.008,0], [.009,.008,0], [.008,.009,0]))).toBeNull();
});

describe.each(ids)('%s public geometry', species => {
  const get = (id, side) => models[species].get(key(id, side));
  const shells = () => [...models[species].values()].filter(m => shellIds.includes(m.node.getExtras().structure));

  it('ships every pickable structure with scene metadata, side, peel stage and linked sources', () => {
    const docRoot = documents[species].getRoot();
    const [scene] = docRoot.listScenes();
    expect(docRoot.listExtensionsRequired().map(ext => ext.extensionName)).toContain('EXT_meshopt_compression');
    expect(scene.getName()).toBe(species);
    const { refs, grid } = scene.getExtras();
    expect(scene.getExtras()).toMatchObject({ species, units: 'metres' });
    expect(refs).toContain(species === 'human' ? 'eaa' : 'mpus');
    expect(grid.resolution).toBeGreaterThanOrEqual(160);
    expect(grid.spacing).toBeGreaterThan(0);
    expect(grid.spacing).toBeLessThan(.5 * .025);
    const expected = new Map();
    shellIds.forEach((id, stage) => {
      for (const side of stage < 2 ? ['M'] : sides) expected.set(key(id, side), stage);
    });
    expected.set('scrotal_septum__M', 1);
    for (const side of sides) {
      for (const id of cordIds) expected.set(key(id, side), 8);
      for (const id of internalIds) expected.set(key(id, side), 9);
    }
    const rendered = [];
    scene.traverse(node => { if (node.getMesh()) rendered.push(node.getName()); });
    expect(rendered.sort()).toEqual([...expected.keys()].sort());
    for (const [name, stage] of expected) {
      const { node } = models[species].get(name);
      const [structure, side] = name.split('__');
      expect(node.getExtras(), name).toMatchObject({ structure, side, layerIndex: stage });
      expect(node.getExtras().refs?.length, name).toBeGreaterThan(0);
      for (const ref of [...node.getExtras().refs, ...refs]) expect(references[ref]?.url, name + ' reference ' + ref).toMatch(/^https:\/\//);
      expect(node.getMesh().getName(), name).toBe(name);
      const primitives = node.getMesh().listPrimitives();
      expect(primitives, name).toHaveLength(1);
      expect(primitives[0].getMode(), name + ' triangle primitive').toBe(4);
    }
  });

  it.each(sides)('%s has the sourced diameters in metres and the correct three-dimensional axis', side => {
    const capsule = get('tunica_albuginea', side), testis = get('testis', side);
    const angle = pitch[species] * Math.PI / 180;
    const axis = new Vector3(0, Math.cos(angle), Math.sin(angle));
    const depth = xAxis.clone().cross(axis);
    for (const organ of [capsule, testis]) {
      const angleError = longAxis(organ).angleTo(axis) * 180 / Math.PI;
      expect(Math.min(angleError, 180-angleError), organ.name + ' longitudinal-axis error in degrees').toBeLessThanOrEqual(10);
      for (const [i, direction] of [axis, xAxis, depth].entries()) {
        const mm = 1000 * extent(organ, direction), wanted = means[species][side][i];
        // The capsule is the measured external contour. The peelable parenchyma is inset.
        const allowed = organ === capsule ? .35 : .03 * wanted;
        expect(Math.abs(mm-wanted), organ.name + ' ' + ['length','width','height'][i] + ': ' + mm.toFixed(2) + ' mm, study mean ' + wanted + ' mm').toBeLessThanOrEqual(allowed);
      }
    }
  });

  it('keeps every paired mesh on its anatomical side and places the septum between the testes', () => {
    for (const mesh of models[species].values()) {
      const side = mesh.node.getExtras().side;
      if (side === 'L') expect(mesh.bounds.min.x, mesh.name + ' crosses midline').toBeGreaterThan(0);
      if (side === 'R') expect(mesh.bounds.max.x, mesh.name + ' crosses midline').toBeLessThan(0);
    }
    const septum = get('scrotal_septum', 'M');
    expect(septum.bounds.min.x).toBeLessThan(0);
    expect(septum.bounds.max.x).toBeGreaterThan(0);
    expect(septum.bounds.min.x).toBeGreaterThan(get('testis', 'R').bounds.max.x);
    expect(septum.bounds.max.x).toBeLessThan(get('testis', 'L').bounds.min.x);
    if (species === 'human') expect(center(get('testis', 'L')).y).toBeLessThan(center(get('testis', 'R')).y);
  });

  it.each(sides)('%s joins the duct to the correct epididymal pole', side => {
    const ep = endsOfTube(get('epididymis', side));
    const duct = endsOfTube(get('ductus_deferens', side));
    expect(ep, 'epididymal end rings').toHaveLength(2);
    expect(duct, 'duct end rings').toHaveLength(2);
    const junctionDistance = p => Math.min(...duct.map(end => p.distanceTo(end)));
    const [tail, head] = ep.sort((a, b) => junctionDistance(a)-junctionDistance(b));
    expect(junctionDistance(tail), 'duct-to-tail distance in metres').toBeLessThan(.0005);
    if (species === 'human') expect(tail.y, 'tail must be inferior').toBeLessThan(head.y);
    else {
      expect(tail.z, 'tail must be caudal').toBeLessThan(head.z);
      expect(tail.y, 'tail must be dorsal').toBeGreaterThan(head.y);
    }
  });

  it('has finite unit normals, nondegenerate triangles and matching surface winding', () => {
    const errors = [];
    for (const mesh of models[species].values()) {
      const badVertex = mesh.directions.findIndex((n, i) =>
        !Number.isFinite(mesh.points[i].lengthSq()) || !(Math.abs(n.length()-1) < .001));
      if (badVertex !== -1) errors.push(mesh.name + ' invalid position or unit normal at vertex ' + badVertex);
      const bad = mesh.faces.filter(f => {
        const normals = f.ids.reduce((v, i) => v.add(mesh.directions[i]), new Vector3());
        return !(f.normal.dot(normals) > 0);
      });
      if (bad.length) errors.push(mesh.name + ' has ' + bad.length + ' degenerate or reversed faces; first triangle ' + bad[0].id + ' at ' + pointMM(bad[0].center));
    }
    expect(errors).toEqual([]);
  });

  it('has closed outward-wound capsules and fasciae, with openings confined to their intended regions', () => {
    const errors = [];
    for (const mesh of shells()) {
      const { structure: id, side } = mesh.node.getExtras();
      const { bad, boundary } = topology(mesh);
      if (bad.length) errors.push(mesh.name + ' has ' + bad.length + ' non-manifold or inconsistently wound edges');
      if (id !== 'cremaster' || species !== 'human') {
        const components = componentWitnesses(mesh);
        if (components.length !== 1) errors.push(mesh.name + ' contains ' + components.length + ' disconnected patches near ' + components.map(f => pointMM(f.center)).join(', '));
      }
      const open = ['skin','dartos','tv_parietal','tv_visceral','cremaster'].includes(id);
      if (!open) {
        if (boundary.length) errors.push(mesh.name + ' has ' + boundary.length + ' open edges; first at ' + pointMM(mesh.points[boundary[0].a]));
        if (!(signedVolume(mesh) > 0)) errors.push(mesh.name + ' encloses no positive volume (check winding)');
        continue;
      }
      if (!boundary.length) errors.push(mesh.name + ' lost its anatomical opening');
      const pts = boundary.flatMap(e => [mesh.points[e.a], mesh.points[e.b]]);
      if (id === 'skin' || id === 'dartos') {
        const misplaced = pts.find(p => mesh.bounds.max.y-p.y > .001);
        if (misplaced) errors.push(mesh.name + ' open away from superior neck at ' + pointMM(misplaced));
      } else {
        const capsule = get('tunica_albuginea', side), origin = center(capsule);
        const length = means[species][side][0] / 1000;
        if (id === 'cremaster') {
          const sign = side === 'L' ? 1 : -1;
          const offsets = mesh.points.map(p => sign*(p.x-origin.x)/length);
          if (species === 'dog') expect(Math.min(...offsets), mesh.name + ' should be lateral').toBeGreaterThan(0);
          else {
            expect(Math.min(...offsets), mesh.name + ' should wrap medially').toBeLessThan(-.15);
            expect(Math.max(...offsets), mesh.name + ' should wrap laterally').toBeGreaterThan(.15);
          }
        } else {
          const back = xAxis.clone().cross(longAxis(capsule)).multiplyScalar(species === 'human' ? -1 : 1);
          const atNeck = p => mesh.bounds.max.y - p.y < .04*length;
          const atAttachment = p => Math.abs(p.x-origin.x) < .14*length && p.clone().sub(origin).dot(back) > 0;
          if (!pts.some(p => !atNeck(p) && atAttachment(p))) errors.push(mesh.name + ' lost its attachment-border opening');
          const misplaced = pts.find(p => !atNeck(p) && !atAttachment(p));
          if (misplaced) errors.push(mesh.name + ' unexpected open edge at ' + pointMM(misplaced));
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('keeps every pair of peel surfaces disjoint and contains the deep structures in their compartments', () => {
    const errors = [];
    const check = (a, b) => {
      const pair = firstContact(a.tree, b.tree);
      if (pair) errors.push(a.name + ' triangle ' + pair[0].id + ' near ' + pointMM(pair[0].center) + ' touches ' + b.name + ' triangle ' + pair[1].id);
    };
    const layers = shells();
    for (const [i, a] of layers.entries()) for (const b of layers.slice(i+1)) check(a, b);
    for (const side of sides) {
      for (const [shell, parts] of [['testis', internalIds], ['internal_sf', cordIds]]) {
        const outer = get(shell, side);
        for (const id of parts) {
          const part = get(id, side);
          check(outer, part);
          // A point on each connected part must also be inside. With no surface
          // crossings, odd exit parity distinguishes containment from two disjoint meshes.
          for (const p of part.points) {
            if (!outer.bounds.containsPoint(p)) {
              errors.push(part.name + ' vertex outside ' + outer.name + ' bounds at ' + pointMM(p));
              break;
            }
          }
          const dir = new Vector3(.991, .107, .079).normalize();
          for (const f of componentWitnesses(part)) {
            const ray = new Ray(f.center.clone(), dir);
            let hits = 0, distance;
            while (Number.isFinite(distance = nearestHit(outer.tree, ray))) {
              hits++;
              ray.origin.addScaledVector(dir, distance + 1e-8);
            }
            if (hits % 2 !== 1) {
              errors.push(part.name + ' outside ' + outer.name + ' at ' + pointMM(f.center));
              break;
            }
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it.each(sides)('%s outward normal rays meet the next covering layer first', side => {
    const origin = center(get('tunica_albuginea', side)), length = means[species][side][0] / 1000;
    const sign = side === 'L' ? 1 : -1;
    const layers = shells(), outward = [...shellIds].reverse();
    for (let i = 0; i < outward.length-1; i++) {
      const id = outward[i], next = outward[i+1];
      const mesh = get(id, ['skin','dartos'].includes(id) ? 'M' : side);
      // Sample the lateral organ surface, away from the cord outlet, midline septum
      // and both tunics' attachment slit. The cremaster still has deliberate gaps
      // on this surface. All other peel layers cover this belt.
      const belt = mesh.faces.filter(f => sign*(f.center.x-origin.x) > .10*length &&
        Math.abs(f.center.y-origin.y) < .27*length && sign*f.normal.x > .25*f.normal.length());
      const samples = areaSamples(belt, 64);
      expect(new Set(samples).size, mesh.name + ' distinct sampled triangles').toBeGreaterThan(16);
      const found = new Set();
      for (const f of samples) {
        const ray = faceRay(mesh, f);
        let nearest = null, closest = Infinity;
        for (const other of layers) {
          if (other === mesh) continue;
          const distance = nearestHit(other.tree, ray);
          if (distance < closest) { closest = distance; nearest = other; }
        }
        const hit = nearest?.node.getExtras().structure;
        found.add(hit);
        const allowed = next === 'cremaster' ? ['cremaster', 'external_sf'] : [next];
        expect(nearest && sameSide(nearest, side) && allowed.includes(hit),
          mesh.name + ' triangle ' + f.id + ' at ' + pointMM(f.center) + ' should hit ' + allowed.join(' / ') + ', got ' + (nearest?.name ?? 'no hit')).toBeTruthy();
      }
      if (next === 'cremaster') expect([...found].sort(), 'sample both muscle and its gaps').toEqual(['cremaster','external_sf']);
    }
  });
});

it('regenerates byte-identical uncompressed and packed bases twice, including the public assets', async () => {
  // The generator resolves input modules from its script path and output files from cwd.
  // A unique ignored workspace also lets simultaneous test runs coexist.
  const build = join(root, 'build');
  await mkdir(build, { recursive: true });
  const scratch = await mkdtemp(join(build, 'geometry-test-'));
  try {
    const first = new Map();
    for (const pass of ['first', 'second']) {
      const cwd = join(scratch, pass);
      await mkdir(cwd);
      await promisify(execFile)(process.execPath, [join(root, 'scripts/build-meshes.mjs')], { cwd, timeout: 150_000 });
      for (const id of ids) {
        if (pass === 'first') {
          const raw = await io.read(join(cwd, 'build/base', id + '.glb'));
          const originals = raw.getRoot().listNodes();
          expect(originals.map(n => n.getName()).sort()).toEqual([...models[id].keys()].sort());
          for (const n of originals) {
            const packed = models[id].get(n.getName()).node;
            expect(packed.getExtras(), n.getName()).toEqual(n.getExtras());
            expect(packed.getWorldMatrix(), n.getName()).toEqual(n.getWorldMatrix());
            const faces = node => sha(orientedTriangles(node.getMesh().listPrimitives()[0]));
            expect(faces(packed), id + ' ' + n.getName() + ' lost positions, normals or oriented triangles in packing').toBe(faces(n));
          }
        }
        for (const dir of ['build/base', 'public/models/base']) {
          const relative = join(dir, id + '.glb');
          const hash = sha(await readFile(join(cwd, relative)));
          if (pass === 'first') first.set(relative, hash);
          else expect(hash, relative + ' changed between independent builds').toBe(first.get(relative));
          if (dir === 'public/models/base') expect(hash, relative + ' is stale; regenerate public meshes').toBe(sha(await readFile(join(root, relative))));
        }
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}, 320_000);
