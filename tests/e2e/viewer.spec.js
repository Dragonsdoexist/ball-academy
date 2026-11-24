import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { join } from 'node:path';

test('draws the human specimen and supports camera controls', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Oblique' })).toHaveAttribute('aria-pressed', 'true');
  const touch = info.project.use.hasTouch === true;
  await expect(
    page.getByText(touch ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom'),
  ).toBeVisible();
  await expect(page.locator('#viewport')).toHaveAttribute('aria-busy', 'false');
  const snapshot = await canvas.screenshot();
  const pixels = PNG.sync.read(snapshot);
  let tissuePixels = 0;
  // Count warm tissue pixels across the specimen, excluding labels, controls and backdrop.
  for (let y = Math.floor(pixels.height * 0.34); y < pixels.height * 0.68; y++) {
    for (let x = Math.floor(pixels.width * 0.29); x < pixels.width * 0.71; x++) {
      const at = 4 * (y * pixels.width + x);
      if (pixels.data[at] - pixels.data[at + 2] > 40 && pixels.data[at + 1] < 210) tissuePixels++;
    }
  }
  expect(tissuePixels / (pixels.width * pixels.height)).toBeGreaterThan(0.008);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', info.project.name + '-en.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await expect(page.locator('#current-view')).toHaveText('Side');
  expect((await canvas.screenshot()).equals(snapshot)).toBe(false);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('#zoom-value')).toHaveText('115%');
  await canvas.press('ArrowLeft');
  await expect(page.locator('#current-view')).toHaveText('Free view');
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(page.locator('#current-view')).toHaveText('Top');
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.locator('#zoom-value')).toHaveText('100%');
  await expect(page.locator('#current-view')).toHaveText('Oblique');
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
    await gesture('touchStart', [
      { x: x - 30, y, id: 0 },
      { x: x + 30, y, id: 1 },
    ]);
    await gesture('touchMove', [
      { x: x - 45, y, id: 0 },
      { x: x + 45, y, id: 1 },
    ]);
    await gesture('touchEnd', []);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 45, y, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('#current-view')).toHaveText('Free view');
    await page.mouse.wheel(0, -100);
  }
  await expect(page.locator('#zoom-value')).not.toHaveText('100%');
  expect(errors).toEqual([]);
});

test('localizes the viewer, remembers the choice and honors shared URLs', async ({ page }, info) => {
  await page.goto('./?keep=1');
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page).toHaveURL(/keep=1&lang=zh/);
  await expect(page.getByRole('heading', { name: '人 · 睾丸与精索' })).toBeVisible();
  await expect(page.getByText('为便于观察，各层厚度已放大')).toBeVisible();
  await page.goto('./');
  await expect(page).toHaveTitle(/蛋蛋学院/);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#viewport')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', info.project.name + '-zh.png'),
    fullPage: true,
  });
  await page.goto('./?lang=en');
  await expect(page).toHaveTitle(/Ball Academy/);
  await expect(page.getByRole('heading', { name: 'Human · Testis and cord' })).toBeVisible();
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

test('switches species, peels both specimens, inspects structures and retires old links', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const view = page.locator('#viewport');
  await page.goto('./?lang=en&style=oil&species=dog&layer=skin');
  await expect(page).not.toHaveURL(/style=/);
  await expect(page.locator('[data-style-choice]')).toHaveCount(0);
  await expect(view).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#specimen-title')).toHaveText('Dog · Scrotal skin');
  const skin = await view.screenshot();
  for (const button of ['Human', 'Dog']) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(view).toHaveAttribute('aria-busy', 'false');
    for (const value of await page.locator('#layer option').evaluateAll((opts) => opts.map((o) => o.value))) {
      await page.locator('#layer').selectOption(value);
      await expect(page.locator('#detail')).not.toBeEmpty();
    }
  }
  await expect(page.locator('#structure option')).toHaveCount(3);
  await page.locator('#peel').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#layer')).toHaveValue('skin');
  await page.locator('#structure').selectOption('epididymis');
  await expect(page.locator('#layer')).toHaveValue('testis');
  await expect(page.locator('#detail')).toContainText('head, body and tail');
  expect((await view.screenshot()).equals(skin)).toBe(false);
  await page.locator('#structure').selectOption('testicular_artery');
  // Find an actual warm tissue pixel away from the coloured cord, then pick it.
  const shot = PNG.sync.read(await view.screenshot());
  let hit;
  for (let y = Math.round(0.58 * shot.height); y < shot.height * 0.72 && !hit; y += 2) {
    for (let x = Math.round(0.32 * shot.width); x < shot.width * 0.72; x += 2) {
      const rgb = shot.data.subarray((y * shot.width + x) * 4, (y * shot.width + x) * 4 + 3);
      if (rgb[0] > 170 && rgb[0] - rgb[2] > 45 && rgb[1] > 120 && rgb[1] < 211) {
        hit = { x, y };
        break;
      }
    }
  }
  expect(hit).toBeTruthy();
  await page.locator('canvas').click({ position: hit });
  await expect(page.locator('#structure')).not.toHaveValue('testicular_artery');
  await page.locator('.model-notes summary').click();
  await expect(page.locator('#specimen-note')).toContainText('eight adult dogs');
  await expect(page.locator('#references a').first()).toHaveAttribute('href', /PMC11868414/);
  await page.reload();
  await expect(page.locator('#specimen-title')).toHaveText('Dog · Testis and cord');
  await expect(view).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    path: join(process.env.SCREENSHOT_DIR || 'docs/screenshots', info.project.name + '-dog.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('offers recovery after a model asset fails', async ({ page }) => {
  await page.route('**/models/base/dog.glb', (route) => route.abort());
  await page.goto('./?species=dog');
  await expect(page.locator('#failure')).toContainText('specimen could not be loaded');
  await page.getByRole('button', { name: 'Human', exact: true }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#failure')).toBeHidden();
  await expect(page.locator('#layer')).toBeEnabled();
});
