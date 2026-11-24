// Derive the picker thumbnails from the tested front view of each style.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { styles } from '../src/art-directions.js';

await mkdir('public/swatches', { recursive: true });
for (const style of styles) {
  const source = 'docs/screenshots/styles/desktop-' + style + '.png';
  const { width, height } = await sharp(source).metadata();
  const size = Math.round(height * .91);
  await sharp(source)
    .extract({ left: Math.floor((width - size) / 2), top: Math.floor((height - size) / 2), width: size, height: size })
    .resize(160, 160).webp({ quality: 88 }).toFile('public/swatches/' + style + '.webp');
}
