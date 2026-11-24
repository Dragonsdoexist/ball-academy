import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import human from '../src/species/human.js';
import dog from '../src/species/dog.js';
import { anatomyFrame, sampleFields, makeCore, smoothUnion, k } from '../src/geometry/fields.js';
import { sampleGrid, extract, gridInfo } from '../src/geometry/marching.js';
import { deepStructures } from '../src/geometry/details.js';
import { colors, skins, organs } from '../src/geometry/layers.js';

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await Promise.all([
  mkdir('build/base', { recursive: true }),
  mkdir('public/models/base', { recursive: true }),
]);
for (const species of [human, dog]) {
  const doc = new Document(),
    buffer = doc.createBuffer(),
    scene = doc.createScene(species.id);
  scene.setExtras({
    species: species.id,
    units: 'metres',
    grid: gridInfo,
    refs: species.refs,
    needsReview: true,
  });
  const frames = ['L', 'R'].map((side) => anatomyFrame(species, side)),
    halves = [];
  function add(id, side, geometry, layerIndex) {
    geometry.scale(...Array(3).fill(species.testis.lengthCm / 100));
    const name = id + '__' + side;
    const attr = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const index = geometry.getIndex().array;
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', attr('VEC3', geometry.attributes.position.array))
      .setAttribute('NORMAL', attr('VEC3', geometry.attributes.normal.array))
      .setIndices(
        attr(
          'SCALAR',
          geometry.attributes.position.count < 65536 ? new Uint16Array(index) : new Uint32Array(index),
        ),
      );
    const color = new THREE.Color(colors[id]);
    prim.setMaterial(
      doc
        .createMaterial(name)
        .setBaseColorFactor([color.r, color.g, color.b, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.9)
        .setDoubleSided(true),
    );
    scene.addChild(
      doc
        .createNode(name)
        .setMesh(doc.createMesh(name).addPrimitive(prim))
        .setExtras({ structure: id, layerIndex, side, refs: species.refs }),
    );
  }
  for (const [sideIndex, side] of ['L', 'R'].entries()) {
    const f = frames[sideIndex],
      evalCore = makeCore(f);
    const testis = sampleGrid((x, y, z) => sampleFields(f, x, y, z));
    const core = sampleGrid((x, y, z, i) => evalCore(x, y, z, testis[i]));
    halves.push(core);
    for (const [index, [id, field, iso]] of skins.entries()) {
      if (field === 'envelope') continue;
      let include;
      if (id.startsWith('tv_'))
        include = (x, y, z) => {
          const [u, v, w] = f.local([x, y, z]);
          return (
            !(f.back * w > 0.055 && Math.abs(u) < 0.082 && Math.abs(v) < 0.5) && y < (f.dog ? 0.49 : 0.62)
          );
        };
      if (id === 'cremaster')
        include = (x, y, z) => {
          const [u, v, w] = f.local([x, y, z]);
          if (f.dog) return f.sign * u > 0.038 && Math.abs(w - 0.1) < 0.112;
          return (
            Math.cos(26 * (v + 0.15 * Math.cos(2 * Math.atan2(w, u)))) > 0.26 ||
            (Math.abs(w) < 0.085 && v > 0.05)
          );
        };
      add(
        id,
        side,
        extract(field === 'testis' ? testis : core, iso * k, include, id.startsWith('tv_')),
        index,
      );
    }
    for (const [id, geometry] of Object.entries(deepStructures(f)))
      add(id, side, geometry, organs.includes(id) ? 8 : 9);
  }
  const envelope = sampleGrid((x, y, z, i) => {
    const pair = smoothUnion(halves[0][i], halves[1][i], 0.36);
    const bridge =
      Math.hypot(x / 0.47, (y + 0.005) / (species.id === 'dog' ? 0.35 : 0.47), z / 0.255) * 0.255 - 0.255;
    return smoothUnion(pair, bridge, 0.12);
  });
  const wallTop = species.id === 'dog' ? 0.47 : 0.58;
  for (const [index, [id, , iso]] of skins.slice(0, 2).entries())
    add(
      id,
      'M',
      extract(envelope, iso * k, (x, y) => y < wallTop),
      index,
    );
  const septum = new THREE.SphereGeometry(1, 40, 32);
  septum.scale(0.013, species.id === 'dog' ? 0.38 : 0.48, 0.25);
  add('scrotal_septum', 'M', septum, 1);
  const bytes = await io.writeBinary(doc);
  await writeFile('build/base/' + species.id + '.glb', bytes);
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  await writeFile('public/models/base/' + species.id + '.glb', await io.writeBinary(doc));
  console.log(species.id, doc.getRoot().listNodes().length, 'nodes,', bytes.length, 'bytes');
}
