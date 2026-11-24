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
  const luminance = (x, y) => {
    const i = 4 * (Math.floor(y * pixels.height) * pixels.width + Math.floor(x * pixels.width));
    return (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
  };
  expect(luminance(.5, .46) - luminance(.12, .4)).toBeGreaterThan(45);
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
