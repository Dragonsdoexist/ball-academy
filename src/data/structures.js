import glossary from '../i18n/glossary.json' with { type: 'json' };
import { skins } from '../geometry/layers.js';
const anatomyRefs = ['grays', 'dyce', 'umn'];
const entries = [
  [
    'skin',
    'Scrotal skin',
    'The outer skin covers the scrotum. The two testes sit on opposite sides of the midline.',
    '阴囊皮肤包覆阴囊，两侧睾丸分居中线两侧。',
  ],
  [
    'dartos',
    'Dartos',
    'Smooth muscle within this connective tissue wrinkles the scrotal skin.',
    '肉膜位于阴囊皮肤下，内含平滑肌，收缩时使皮肤起皱。',
  ],
  [
    'external_sf',
    'External spermatic fascia',
    'This outer layer of connective tissue wraps the spermatic cord and testis.',
    '精索外筋膜包绕精索和睾丸。',
  ],
  [
    'cremaster',
    'Cremaster muscle',
    'Contraction draws the testis closer to the body. Follow the muscle along the cord.',
    '提睾肌收缩时将睾丸拉近身体。可沿精索观察肌束走向。',
  ],
  [
    'internal_sf',
    'Internal spermatic fascia',
    'This deep fascial sleeve lies outside the tunica vaginalis.',
    '精索内筋膜位于睾丸鞘膜外侧，形成一层较深的筋膜。',
  ],
  [
    'tv_parietal',
    'Tunica vaginalis, parietal layer',
    'A thin film of fluid separates this outer sheet from the inner sheet on the testis.',
    '睾丸鞘膜壁层与脏层相对，两层之间有少量液体。',
  ],
  [
    'tv_visceral',
    'Tunica vaginalis, visceral layer',
    'The inner sheet lies directly on much of the testis and epididymis.',
    '睾丸鞘膜脏层紧贴睾丸和附睾的大部分表面。',
  ],
  [
    'tunica_albuginea',
    'Tunica albuginea',
    'This tough fibrous capsule encloses the testicular tissue.',
    '白膜是包裹睾丸组织的坚韧纤维被膜。',
  ],
  [
    'testis',
    'Testis',
    'The paired testes produce sperm and testosterone. Rotate the specimen to follow the attached epididymis.',
    '两侧睾丸产生精子并分泌睾酮。转动模型可观察与睾丸相连的附睾。',
  ],
  [
    'epididymis',
    'Epididymis',
    'The epididymis has a head, body and tail. Sperm mature as they travel along its coiled duct.',
    '附睾由高度盘曲的管道组成，分头、体、尾。精子经过附睾时逐渐成熟。',
  ],
  [
    'ductus_deferens',
    'Ductus deferens',
    'This duct continues from the tail of the epididymis and carries sperm into the pelvis.',
    '输精管起于附睾尾，将精子输送至盆腔。',
  ],
  [
    'testicular_artery',
    'Testicular artery',
    'The testicular artery carries blood toward the testis within the spermatic cord.',
    '睾丸动脉行于精索内，向睾丸供血。',
  ],
  [
    'pampiniform_plexus',
    'Pampiniform plexus',
    'These veins surround the testicular artery and help cool incoming arterial blood through heat exchange.',
    '蔓状静脉丛环绕睾丸动脉，通过逆流热交换帮助冷却流入的动脉血。',
  ],
  [
    'scrotal_septum',
    'Scrotal septum',
    'This partition separates the two scrotal compartments.',
    '阴囊中隔将阴囊分为左右两腔。',
  ],
  [
    'lobule',
    'Testicular lobules',
    'These schematic compartments represent the lobules that contain seminiferous tubules.',
    '这些示意分区代表含有生精小管的睾丸小叶。',
  ],
  [
    'mediastinum_testis',
    'Mediastinum testis',
    'This region of connective tissue houses the rete testis.',
    '睾丸纵隔是容纳睾丸网的结缔组织区域。',
  ],
  [
    'rete_testis',
    'Rete testis',
    'A network of channels collects fluid and sperm on their way toward the epididymis.',
    '睾丸网汇集液体和精子，并将它们导向附睾。',
  ],
];
export const structures = Object.fromEntries(
  entries.map(([id, en, desc, zh]) => [
    id,
    {
      name: { en, zh: glossary[id] },
      simple: { en: desc, zh },
      refs: anatomyRefs,
    },
  ]),
);
export const stageIds = [...skins.map(([id]) => id), 'internal'];
export function visibleAt(extras, stage) {
  return stage === 9 ? extras.layerIndex === 9 : extras.layerIndex >= stage && extras.layerIndex <= 8;
}
