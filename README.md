# Ball Academy · 蛋蛋学院

[Open the atlas](https://dragonsdoexist.github.io/ball-academy/)

The bilingual Human and Dog base specimens are available in **Little Doodle / 简笔画**. Choose a species and move the dissection control from skin through to the testicular interior. Click a visible structure or use the inspector for its name, description and reference. Open the measurement notes for the source cohorts and schematic conventions. Anatomical specialist review is pending.

Share a specimen and level with `?species=dog&layer=testis&lang=zh`. Previous style links open the Little Doodle atlas. Oil Study, Cyanotype, Cut Paper and Stained Glass are preserved with their source, screenshots and tests in the [runnable prototype archive](https://github.com/Dragonsdoexist/ball-academy/tree/archive/illustration-studies).

Drag to orbit, scroll or pinch to zoom, or choose a preset in the control panel. With the canvas focused, use the arrow keys to orbit and the plus and minus keys to zoom. Select **中文** or open `?lang=zh` for Simplified Chinese.

## Development

Use Node.js 22. Install dependencies with `npm ci`, then run `npm run dev`. The app is served under `/ball-academy/`.

- `npm test` checks the base geometry, language dictionaries, glossary and preference resolution.
- `npm run test:e2e` opens Chromium at desktop and phone viewport sizes and saves both languages to `docs/screenshots/`. Install the test browser with `npx playwright install chromium` if needed. On macOS the suite can also use the standard Google Chrome installation. Set `CHROMIUM_PATH` for a custom executable.
- `npm run meshes` rebuilds the shared geometry in `build/base/` and the meshopt-encoded specimens in `public/models/base/`. Distances in the GLBs are metres. M2 supplies the common base for the later procedural-detail and Blender-baked variants.
- `npm run build` produces the static site in `dist/`.
- Set `BASE_URL` to the deployed URL, including the trailing slash, to run the browser suite against Pages. To keep live screenshots separate, set `SCREENSHOT_DIR`.

Pushes to `main` run unit tests, build the site and deploy the static artifact with GitHub Actions. The repository uses MIT for code and CC BY 4.0 for original educational text. The atlas is for educational use.
