// Dimensions in cm. Local +X is the subject's left, +Y superior and +Z anterior.
export default {
  id: 'human',
  scene: 'scrotal',
  testis: { lengthCm: 4.57, widthCm: 2.96, depthCm: 2.51 },
  leftTestis: { lengthCm: 4.47, widthCm: 2.88, depthCm: 2.44 },
  axis: { pitchDeg: 0 },
  leftLower: true,
  epididymisTail: 'inferior',
  scrotum: { position: 'betweenThighs', pendulous: true },
  cremasterPattern: 'looped',
  refs: ['eaa', 'grays', 'openstax'],
  needsReview: true,
};
