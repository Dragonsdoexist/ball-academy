# Ball Academy · 蛋蛋学院

[Open the atlas](https://dragonsdoexist.github.io/ball-academy/)

Ball Academy is a bilingual 3D atlas project for comparative scrotal, testicular and spermatic cord anatomy. The first release (R0) provides a calibration sphere for testing the viewer. Human and canine anatomy models are planned for R1.

The selected visual direction for the atlas is **Little Doodle / 简笔画**. The prototype gives the practice sphere an ink outline and a little wave. Select **Oil Study**, **Cyanotype**, **Cut Paper**, or **Stained Glass** to compare the same camera angle across media. A style can be shared with `?style=doodle|oil|blueprint|paper|glass`, alongside `lang=en|zh`.

Drag to orbit, scroll or pinch to zoom, or choose a preset in the control panel. With the canvas focused, use the arrow keys to orbit and the plus and minus keys to zoom. Select **中文** or open `?lang=zh` for Simplified Chinese.

## Development

Use Node.js 22. Install dependencies with `npm ci`, then run `npm run dev`. The app is served under `/ball-academy/`.

- `npm test` checks the language dictionaries, glossary and preference resolution.
- `npm run test:e2e` opens Chromium at desktop and phone viewport sizes and saves both languages to `docs/screenshots/`. Install the test browser with `npx playwright install chromium` if needed. On macOS the suite can also use the standard Google Chrome installation. Set `CHROMIUM_PATH` for a custom executable.
- After changing a style, run the browser suite and `node scripts/build-swatches.mjs` to refresh its picker thumbnail.
- `npm run build` produces the static site in `dist/`.
- Set `BASE_URL` to the deployed URL, including the trailing slash, to run the browser suite against Pages. To keep live screenshots separate, set `SCREENSHOT_DIR`.

Pushes to `main` run unit tests, build the site and deploy the static artifact with GitHub Actions. The repository uses MIT for code and CC BY 4.0 for original educational text. The atlas is for educational use.
