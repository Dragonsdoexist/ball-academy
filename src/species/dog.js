// Worked example from eight adult dogs. The illustrative inclination is not a measured mean.
// +Y is dorsal and +Z cranial. The positive longitudinal pole points caudodorsally.
export default {
  id: 'dog',
  scene: 'scrotal',
  testis: { lengthCm: 3.07, widthCm: 2.23, depthCm: 1.7 },
  leftTestis: { lengthCm: 3.03, widthCm: 2.31, depthCm: 1.64 },
  axis: { pitchDeg: -58 },
  leftLower: false,
  epididymisTail: 'caudal',
  scrotum: { position: 'betweenInguinalRegionAndAnus', pendulous: false },
  cremasterPattern: 'lateralBand',
  refs: ['mpus', 'dyce', 'umn'],
  needsReview: true,
};
