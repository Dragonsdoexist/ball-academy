import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { join } from 'node:path';

test('draws the calibration model and supports camera controls', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Front' })).toHaveAttribute('aria-pressed', 'true');
  const touch = info.project.use.hasTouch === true;
  await expect(page.getByText(touch ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom')).toBeVisible();
  const snapshot = await canvas.screenshot();
  const pixels = PNG.sync.read(snapshot);
  let inkPixels = 0;
  // Count marks inside the practice character, clear of captions and border.
  for (let y = Math.floor(pixels.height * .39); y < pixels.height * .68; y++) {
    for (let x = Math.floor(pixels.width * .42); x < pixels.width * .58; x++) {
      const at = 4 * (y * pixels.width + x);
      if (Math.max(...pixels.data.subarray(at, at + 3)) < 90) inkPixels++;
    }
  }
  expect(inkPixels).toBeGreaterThan(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', info.project.name + '-en.png'), fullPage: true });
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await expect(page.locator('#current-view')).toHaveText('Side');
  expect((await canvas.screenshot()).equals(snapshot)).toBe(false);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('output')).toHaveText('115%');
  await canvas.press('ArrowLeft');
  await expect(page.locator('#current-view')).toHaveText('Free view');
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(page.locator('#current-view')).toHaveText('Top');
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.locator('output')).toHaveText('100%');
  await expect(page.locator('#current-view')).toHaveText('Front');
  const box = await canvas.boundingBox();
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const gesture = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    await gesture('touchStart', [{ x, y }]);
    await gesture('touchMove', [{ x: x + 45, y }]);
    await gesture('touchEnd', []);
    await expect(page.locator('#current-view')).toHaveText('Free view');
    await gesture('touchStart', [{ x: x - 30, y, id: 0 }, { x: x + 30, y, id: 1 }]);
    await gesture('touchMove', [{ x: x - 45, y, id: 0 }, { x: x + 45, y, id: 1 }]);
    await gesture('touchEnd', []);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 45, y, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('#current-view')).toHaveText('Free view');
    await page.mouse.wheel(0, -100);
  }
  await expect(page.locator('output')).not.toHaveText('100%');
  expect(errors).toEqual([]);
});

test('localizes the viewer, remembers the choice and honors shared URLs', async ({ page }, info) => {
  await page.goto('./?keep=1');
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page).toHaveURL(/keep=1&lang=zh/);
  await expect(page.getByRole('heading', { name: '校准球' })).toBeVisible();
  await expect(page.getByText('为便于观察，各层厚度已放大')).toBeVisible();
  await page.goto('./');
  await expect(page).toHaveTitle(/蛋蛋学院/);
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', info.project.name + '-zh.png'), fullPage: true });
  await page.goto('./?lang=en');
  await expect(page).toHaveTitle(/Ball Academy/);
  await expect(page.getByRole('heading', { name: 'Calibration sphere' })).toBeVisible();
});

test('gives a localized recovery path when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('./?lang=zh');
  await expect(page.getByRole('button', { name: '重新加载查看器' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重置视图' })).toBeDisabled();
});

test('renders all five illustration styles and keeps the camera and language', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('./?lang=zh&keep=1');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'doodle');
  await expect(page.locator('[data-style-choice="doodle"]')).toHaveText('简笔画');
  const models = [];
  for (const style of ['oil', 'blueprint', 'paper', 'glass', 'doodle']) {
    const button = page.locator('[data-style-choice="' + style + '"]');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(new RegExp('keep=1&style=' + style));
    const image = await page.locator('#viewport').screenshot();
    // Distinguish the rendered surfaces using the central patch, away from the stage backdrop.
    const pixels = PNG.sync.read(image);
    const sample = [];
    for (const y of [.46,.48,.5,.52,.54]) {
      for (const x of [.48,.49,.5,.51,.52]) {
        const offset = 4 * (Math.floor(y*pixels.height) * pixels.width + Math.floor(x*pixels.width));
        sample.push(...pixels.data.subarray(offset, offset+3));
      }
    }
    for (const other of models) {
      const delta = sample.reduce((sum, value, i) => sum + Math.abs(value-other[i]), 0) / sample.length;
      expect(delta).toBeGreaterThan(10);
    }
    models.push(sample);
    await page.locator('.stage').screenshot({
      path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', 'styles', info.project.name + '-' + style + '.png')
    });
  }
  await page.getByRole('button', { name: '侧面', exact: true }).click();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.locator('[data-style-choice="oil"]').click();
  await expect(page.locator('#current-view')).toHaveText('侧面');
  await expect(page.locator('output')).toHaveText('115%');
  await page.reload();
  await expect(page.locator('[data-style-choice="oil"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang','zh-Hans');
  expect(errors).toEqual([]);
});
