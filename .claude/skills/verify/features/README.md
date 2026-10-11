# 型紙チェック verification map

This directory is the maintained source for verifying the user-facing behavior of 型紙チェック. Read the index before driving the app, then use the matching feature file as the recipe. Domain terms (型紙プロジェクト, 配置プロジェクト, 校正, 折りセンター, 鏡像コピー, 裁断余白, 使用率, 不足) follow `CONTEXT.md` at the repo root.

## Baseline preconditions

- `V=.claude/skills/verify/scripts/katagami-verify` from the repo root; `$V setup` done once.
- `$V launch` started an instance for this run and `$V doctor` reports HEALTHY.
- Each `$V drive` starts from an empty IndexedDB (fresh profile). Seed state through `flows.*`, which uses only the UI.
- Never drive an instance this run did not launch.

## Driving conventions

- Prefer accessible names (`getByRole('button', { name: '…', exact: true })`) and visible text; the UI has no `data-testid`.
- Canvas taps go through `h.tapPhoto(x, y)` in fixture-photo pixels, in the fitted view.
- `window.confirm` dialogs are auto-accepted and logged; call `h.dismissNextDialog()` to test the cancel path.
- Treat button names as literal, including full-width characters (`＋ 拡大`, `－15°`, `（cm）`).

## Proof and skip reporting

- UI proof is a numbered PNG plus ARIA snapshot from `h.shot`, taken after the action it proves.
- Mutation proof is a reload of the route plus `h.readDb()` saved with `h.saveJson`.
- Report the evidence directory printed by `drive`; it survives `$V cleanup`.
- Report a path you could not drive (e.g. the camera input on headless Chromium) as unverified, with the reason. Don't count it as verified through another path.

## Feature entry contract

Each feature file has an H1, a one-paragraph description, then exactly four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with katagami-verify`, `Gotchas`.

## Features

- [Project list](./project-list.md): create, open, rename, and delete pattern and layout projects, including the cascade from a deleted pattern. Scenario `project-list`.
- [Pattern capture, calibration and trace](./pattern-trace.md): add a photo, calibrate, trace normal and fold-center pieces, edit, copy, mirror-copy, and delete them. Scenarios `pattern-trace` and, with `DEVICE=iphone`, `mobile-trace` (touch scroll, pinch, handle drag, bottom bar, tap targets).
- [Layout fit check](./layout-fit.md): choose patterns, enter fabric, auto-place, and read the fit or shortage report. Scenario `layout-fit`.
- [Manual layout adjustment](./layout-adjust.md): add one piece from 未配置, drag, rotate, return it to 未配置, and see overlap and overflow warnings. Scenario `layout-adjust`.
- [Backup import and export](./import-export.md): export every project to a JSON file, import it back with confirmation, re-import without duplicates, and reject invalid files. Scenario `import-export`.
