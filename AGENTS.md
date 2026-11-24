# Ball Academy builder rules

1. Work only inside `/Users/air/Desktop/Vibe Projects/Website - Ball Academy/`. That folder is its own git repo. (Folder names in `Vibe Projects` follow `Format - Name` and contain spaces, so always quote paths.)
2. **Never invent anatomy.** Every structure or species fact in the data files carries `refs: [...]` that point to `src/data/references.js`. If you are unsure, set `needsReview: true` and list the item in `docs/fact-check.md`.
3. **No hard-coded user-visible strings.** All text lives in `src/i18n/*.json` or the bilingual data files. Chinese anatomical terms must come from `src/i18n/glossary.json`. Do not free-translate them.
4. **All 3D assets come from scripts and are deterministic:** use a seeded RNG, so the same input gives the same output. Commit the generated `.glb` files under `public/models/`. Never hand-edit GLBs. Never download 3D models or use AI 3D generators.
5. **Variants A and B share the same base geometry, mesh names and structure IDs**, so the UI code works the same for both.
6. Each milestone ends with `npm test`, `npm run test:e2e` and `npm run build` all passing, refreshed screenshots, and a commit named `Mx: <summary>`.
7. Use Little Doodle (简笔画) as the atlas art direction: clean ink contours, restrained colour and a slightly goofy personality. Preserve anatomical landmarks, clinically meaningful colours and legible labels in teaching models. The calibration mascot can have a face. Keep presentations educational and non-sexualised.
8. Read the Blender path from the `BLENDER_PATH` environment variable. The default is **4.0.2** at `/Applications/Blender.app/Contents/MacOS/Blender`. Write scripts against the 4.0 Python API so they also run on newer versions. `run-blender.mjs` records the Blender version it used in `docs/ab-report.md`. Do not switch Blender versions in the middle of a release.
