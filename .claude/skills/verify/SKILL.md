---
name: verify
description: Launch and drive 型紙チェック (Katagami), the client-only React/Konva PWA in this repo, in an isolated headless Chromium, the way a phone user would — create projects, upload a pattern photo, calibrate, trace pieces, lay them on fabric, read the fit report — and capture screenshots, ARIA snapshots, and IndexedDB dumps as proof. Use to verify any UI or behavior change in this repo before calling it done, or to reproduce a bug in the real app.
---

# Verify 型紙チェック

The app is a browser-only PWA: Vite dev server (HTTPS, self-signed), React UI, Konva canvases, all data in the browser's IndexedDB (`katagami`, stores `projects` / `photos` / `pieces`). There is no backend, so "side effects" means IndexedDB rows. Every command below goes through one helper:

```bash
V=.claude/skills/verify/scripts/katagami-verify   # run from the repo root
```

## Isolation

- Each `launch` starts its **own** Vite on a free port from 5190 up (never 5173, which the user's own `npm run dev` / `preview` uses) and records it in a run dir: `${TMPDIR}/katagami-verify/<run-id>/` (override with `KATAGAMI_VERIFY_HOME`).
- Each `drive` opens a **fresh Chromium profile** under the run dir, so IndexedDB starts empty and runs never touch the user's browser data. Set `PROFILE=<name>` to reuse a named profile across drives (two drives on the same `PROFILE` cannot run concurrently; Chromium locks it).
- Never drive a URL you did not launch. If `doctor` says the port is not ours, stop.

## Setup (once per machine)

```bash
$V setup   # npm install in repo if needed; playwright@1.61.1 + chromium into ~/.cache/katagami-verify-tools
```

Playwright is deliberately **not** a repo dependency; the tools dir keeps `package.json` untouched.

## Launch

```bash
$V launch
# ready: run=20261011-103201-71988 url=https://127.0.0.1:5190 pid=72008
# evidence dir: .../katagami-verify/<run-id>/evidence
```

Ready means `https://127.0.0.1:<port>/` served `<title>型紙チェック</title>`. The run becomes `latest`; every other command takes an optional run id and defaults to it. The dev server serves the working tree live (HMR), so edits show up without relaunching. Logs: `<run-dir>/vite.log`.

`vite.config.ts` reads `certs/dev.pem` and `certs/dev-key.pem` (gitignored) unconditionally. If they are missing, `launch` generates throwaway self-signed ones, says so, and `cleanup` deletes them. Real certs are never touched.

## Doctor

```bash
$V doctor    # exit 0 = HEALTHY
```

Checks: vite pid alive, the port's listener **is that pid**, the URL serves the app title, the playwright tools are installed; prints the launch git rev vs HEAD. Run it first, and again whenever anything looks off.

## Drive

```bash
$V drive <scenario>            # name from scenarios/, or a path to any .mjs
$V drive layout-fit
HEADED=1 $V drive pattern-trace    # watch it
```

Shipped scenarios (one per feature in `features/`): `pattern-trace`, `layout-fit`, `project-list`, `import-export`. To prove a new change, write a scenario in the scratchpad (or add it to `scenarios/` if it belongs in the map) with this shape:

```js
export default async ({ page, h, flows, FIXTURE }) => {
  await flows.patternWithSquare('試験')            // project + photo + calibration + 20×20 cm piece, via UI
  await page.getByRole('button', { name: '…' }).click()
  await h.see('expected text')                     // waits, fails the run if never visible
  await h.shot('after-click')                      // NN-after-click.png + .aria.yml
  const db = h.saveJson('db', await h.readDb())    // read-only IndexedDB dump
  h.assert(db.pieces.length === 1, 'one piece')
}
```

Toolkit (`scripts/drive.mjs`, `scripts/flows.mjs`):

| Helper | Does |
|---|---|
| `h.goto(route)` | load `/`, `/patterns/<id>`, `/layouts/<id>` and wait for the header |
| `h.see(text)` / `h.notSee(text)` / `h.assert(cond, msg)` | assertions that land in the transcript |
| `h.shot(name)` | full-page PNG (transitions finished) + ARIA snapshot + current step logged |
| `h.readDb()` / `h.saveJson(name, v)` | dump IndexedDB (image data URLs truncated) / write JSON evidence |
| `h.evidencePath(name)` | absolute path inside this drive's evidence dir, for saved downloads and files to upload |
| `h.tapPhoto(x, y)` | tap a **photo pixel** on the calibration/trace canvas (fitted view) |
| `h.dismissNextDialog()` | next `window.confirm` gets Cancel (default: OK; every dialog is logged) |
| `flows.createPatternProject(name)` / `createLayoutProject(name)` / `rename(prefix, name)` | home buttons + name editor; return id |
| `flows.addPhoto()` / `calibrate()` / `tracePiece(name, pts, {foldCenter})` | pattern steps with the fixture |
| `flows.addPatternToLayout(name)` / `patternWithSquare(name)` | layout selection / full pattern seed |
| `flows.button(name)` / `flows.currentStep(label)` | exact-name button / `aria-current="step"` pill |

Handles: buttons and inputs have Japanese accessible names (`型紙プロジェクトを作成`, `写真を選択`, `実寸（cm）` is a spinbutton, `パーツ名` a textbox, `幅（cm）` / `高さ（cm）` / `裁断余白（cm）`). The step pills live in `nav[aria-label="作業ステップ"]`; the active one has `aria-current="step"`. The project-name editor is `button "<型紙|配置>プロジェクト名を編集"`. Konva canvases have no DOM handles: use `h.tapPhoto` with photo coordinates; layout-canvas drags need `page.mouse` on `.canvas-container canvas` (see `features/layout-adjust.md`).

**Fixture** `fixtures/pattern-page.png` (960×720, regenerate with `node .claude/skills/verify/scripts/make-fixture.mjs`): blue scale bar (100,100)→(500,100) = 20 cm → 20 px/cm; square (100,200)-(500,600) = 20×20 cm; right triangle (600,200),(900,200),(600,600) = 15×20 cm. So expected numbers are exact: calibration 20 px/cm, square area 400 cm².

## Evidence

Each drive writes `<run-dir>/evidence/<scenario>-<timestamp>/`: `transcript.log` (steps, assertions, dialogs, console errors, page errors, PASS/FAIL), numbered `NN-name.png` + `NN-name.aria.yml`, JSON dumps, and `failure.png` on failure. The command prints the path last. Exit code 0 = PASS.

Proof standards:
- Drive the real user path: buttons, file chooser, canvas taps. Never write IndexedDB or call store setters to set up state; seed through `flows`.
- Capture the action and the result: a shot before and after the change, not only the end screen.
- Check side effects with a second view: reload the route (`h.goto`) and `h.readDb()`; assert the rows, not just the toast-like text.
- Look at the PNGs you cite. The ARIA snapshot doesn't show `aria-current`, so step state comes from the `step …` part of the shot log line.
- `npm test` (vitest) proves geometry functions, not the app. It doesn't replace a drive.

## Cleanup

```bash
$V cleanup [run-id]   # kills only the recorded vite pid, deletes browser profiles and scaffold certs
$V runs               # list runs, running/stopped, evidence paths
```

Evidence is **kept** at `<run-dir>/evidence/` after cleanup; cite that path in reports. Never `pkill node`/`vite`: the user may have their own dev server on 5173.

## Feature map

`features/README.md` indexes the user-facing features, each with entry points, a driving recipe, and gotchas. A change to one entry point is verified when every entry point the map lists for it is driven. Keep the map honest with `/maintain-verification-skill`.
