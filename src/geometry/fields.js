// Build in reference lengths, then convert the finished mesh to glTF metres.
export const k = 0.025;
export function smoothUnion(a, b, blend) {
  const h = Math.max(blend - Math.abs(a - b), 0);
  return Math.min(a, b) - (h * h) / (4 * blend);
}
export function anatomyFrame(species, side) {
  const d = side === 'L' ? species.leftTestis : species.testis;
  const length = species.testis.lengthCm;
  const rx = d.widthCm / (2 * length),
    ry = d.lengthCm / (2 * length),
    rz = d.depthCm / (2 * length);
  const sign = side === 'L' ? 1 : -1;
  const cx = sign * (Math.max(species.testis.widthCm, species.leftTestis.widthCm) / (2 * length) + 0.15);
  const cy = side === 'L' && species.leftLower ? -0.087 : 0;
  const angle = (species.axis.pitchDeg * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const dog = species.id === 'dog',
    back = dog ? 1 : -1;
  const world = ([x, y, z]) => [cx + x, cy + y * c - z * s, y * s + z * c];
  const local = ([x, y, z]) => [x - cx, (y - cy) * c + z * s, -(y - cy) * s + z * c];
  // Parameter increases from the epididymal head to its tail on each species.
  const epididymis = (t) => {
    const a = 0.19 + t * (Math.PI - 0.38);
    return world([
      sign * 0.09 * Math.sin(a),
      (dog ? -1 : 1) * ry * Math.cos(a),
      back * rz * (Math.sin(a) + 0.12),
    ]);
  };
  const at = (t) => epididymis(t);
  const entry = at(dog ? 0.27 : 0.03);
  const top = [cx * 0.81, 0.97, dog ? 0.29 : -0.09];
  const cord = [0, 1 / 3, 2 / 3, 1].map((t) => [
    entry[0] + (top[0] - entry[0]) * t * t,
    entry[1] + (top[1] - entry[1]) * t,
    entry[2] + (top[2] - entry[2]) * t,
  ]);
  return { rx, ry, rz, cx, cy, sign, c, s, dog, back, world, local, epididymis, cord };
}
function segment(a, b, r) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2],
    denom = dx * dx + dy * dy + dz * dz;
  return (x, y, z) => {
    const px = x - a[0],
      py = y - a[1],
      pz = z - a[2];
    const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / denom));
    return Math.sqrt((px - t * dx) ** 2 + (py - t * dy) ** 2 + (pz - t * dz) ** 2) - r;
  };
}
export function sampleFields(f, x, y, z) {
  const dx = x - f.cx,
    dy = y - f.cy;
  const v = dy * f.c + z * f.s,
    w = -dy * f.s + z * f.c;
  return (Math.sqrt((dx / f.rx) ** 2 + (v / f.ry) ** 2 + (w / f.rz) ** 2) - 1) * Math.min(f.rx, f.rz);
}
export function makeCore(f) {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const r =
      0.04 + 0.042 * (Math.exp(-((t - 0.05) ** 2) / 0.015) + 0.72 * Math.exp(-((t - 0.95) ** 2) / 0.022));
    parts.push(segment(f.epididymis(i / 8), f.epididymis((i + 1) / 8), r + 0.008));
  }
  for (let i = 1; i < f.cord.length; i++) parts.push(segment(f.cord[i - 1], f.cord[i], 0.081));
  return (x, y, z, testis) => {
    let auxiliary = Infinity;
    for (const field of parts) auxiliary = Math.min(auxiliary, field(x, y, z));
    return smoothUnion(testis, auxiliary, 0.057);
  };
}
