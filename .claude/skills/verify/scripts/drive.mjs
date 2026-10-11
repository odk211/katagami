// Runs one scenario module against a launched Katagami instance with a Playwright profile
// owned by the run. Invoke through `katagami-verify drive <scenario>`, which sets the env.
//
// A scenario is an ES module: `export default async ({ page, h, flows }) => { ... }`.
// Throwing fails the run (exit 1) after a failure screenshot.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GEOMETRY, PORTRAIT } from './fixture-geometry.mjs'

const { KATAGAMI_URL, KATAGAMI_RUN_DIR, KATAGAMI_TOOLS, KATAGAMI_SKILL_DIR } = process.env
if (!KATAGAMI_URL || !KATAGAMI_RUN_DIR || !KATAGAMI_TOOLS) {
  console.error('drive.mjs must be started by `katagami-verify drive`')
  process.exit(2)
}
const { chromium, devices } = createRequire(path.join(KATAGAMI_TOOLS, 'package.json'))('playwright')

const scenarioPath = path.resolve(process.argv[2])
const scenarioName = path.basename(scenarioPath, '.mjs')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.join(KATAGAMI_RUN_DIR, 'evidence', `${scenarioName}-${stamp}`)
mkdirSync(outDir, { recursive: true })
const transcript = path.join(outDir, 'transcript.log')
const log = (line) => {
  const msg = `[${new Date().toISOString()}] ${line}`
  appendFileSync(transcript, msg + '\n')
  console.log(msg)
}

const fixture = (g) => ({ ...g, path: path.join(KATAGAMI_SKILL_DIR, 'fixtures', g.file) })
const FIXTURE = fixture(GEOMETRY)
const PORTRAIT_FIXTURE = fixture(PORTRAIT)

// IndexedDB lives in the browser profile. Each drive starts empty unless PROFILE=<name>
// names a profile to reuse (e.g. to inspect state a previous drive left behind).
const profileDir = path.join(KATAGAMI_RUN_DIR, 'profile', process.env.PROFILE || `${scenarioName}-${stamp}`)
// DEVICE=iphone emulates an iPhone 13 (390×664, touch, mobile viewport) in Chromium.
// The default is a 430×932 desktop-input window, which every shipped scenario except
// mobile-trace assumes.
const DEVICES = {
  iphone: () => {
    const { defaultBrowserType: _, ...iphone } = devices['iPhone 13']
    return iphone
  },
  desktop: () => ({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 }),
}
const deviceName = process.env.DEVICE || 'desktop'
if (!DEVICES[deviceName]) {
  console.error(`unknown DEVICE=${deviceName} (known: ${Object.keys(DEVICES).join(', ')})`)
  process.exit(2)
}
const context = await chromium.launchPersistentContext(profileDir, {
  headless: process.env.HEADED !== '1',
  ignoreHTTPSErrors: true,
  locale: 'ja-JP',
  ...DEVICES[deviceName](),
})
const page = context.pages()[0] ?? (await context.newPage())
const cdp = await context.newCDPSession(page)

let dialogPolicy = 'accept'
page.on('dialog', async (d) => {
  log(`dialog ${d.type()}: ${JSON.stringify(d.message())} -> ${dialogPolicy}`)
  if (dialogPolicy === 'dismiss') await d.dismiss()
  else await d.accept()
  dialogPolicy = 'accept'
})
page.on('pageerror', (e) => log(`PAGE ERROR: ${e.message}`))
page.on('load', () => log(`document load ${page.url()}`))
page.on('console', (m) => {
  if (m.type() === 'error') log(`console.error: ${m.text()}`)
})

async function touchEvent(type, touchPoints) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  await page.waitForTimeout(16)
}

let shotN = 0
const failedChecks = []
const h = {
  log,
  step: (label) => log(`STEP ${label}`),

  async goto(route = '/') {
    await page.goto(KATAGAMI_URL + route)
    await page.getByRole('heading', { name: '型紙チェック', level: 1 }).waitFor()
  },

  /** Screenshot + ARIA snapshot of the current screen, numbered in action order. */
  async shot(name) {
    const base = path.join(outDir, `${String(++shotN).padStart(2, '0')}-${name}`)
    // animations:'disabled' finishes CSS transitions (step pills fade colour over 150ms).
    await page.screenshot({ path: `${base}.png`, fullPage: true, animations: 'disabled' })
    writeFileSync(`${base}.aria.yml`, await page.locator('body').ariaSnapshot())
    const current = await page
      .locator('nav[aria-label="作業ステップ"] [aria-current="step"]')
      .allTextContents()
    log(
      `evidence ${path.basename(base)}.png + .aria.yml (url ${page.url()}` +
        (current.length ? `, step ${current[0]})` : ')'),
    )
  },

  /** Absolute path for a file inside this drive's evidence dir (downloads, files to upload). */
  evidencePath(name) {
    return path.join(outDir, name)
  },

  saveJson(name, value) {
    const file = path.join(outDir, `${name}.json`)
    writeFileSync(file, JSON.stringify(value, null, 2))
    log(`evidence ${name}.json`)
    return value
  },

  /** Answer the next window.confirm with Cancel instead of OK. */
  dismissNextDialog() {
    dialogPolicy = 'dismiss'
  },

  /** Wait until text is visible; fails the scenario if it never appears. */
  async see(text, opts = {}) {
    await page.getByText(text, { exact: opts.exact ?? false }).first().waitFor({ timeout: opts.timeout ?? 10_000 })
    log(`saw ${JSON.stringify(text)}`)
  },

  async notSee(text) {
    const n = await page.getByText(text).count()
    if (n !== 0) throw new Error(`expected no ${JSON.stringify(text)} but found ${n}`)
    log(`confirmed absent ${JSON.stringify(text)}`)
  },

  assert(cond, msg) {
    if (!cond) throw new Error(`assertion failed: ${msg}`)
    log(`ok: ${msg}`)
  },

  /** Like assert, but the scenario keeps going; the run still fails at the end. */
  check(cond, msg) {
    if (cond) {
      log(`ok: ${msg}`)
    } else {
      failedChecks.push(msg)
      log(`CHECK FAILED: ${msg}`)
    }
  },

  /**
   * Tap a pixel of `photo` (default FIXTURE) on the calibration/trace Konva canvas, in the
   * fitted view (the default, or after pressing 全体表示). With DEVICE=iphone it is a real
   * touch tap; otherwise a mouse click.
   */
  async tapPhoto(x, y, photo = FIXTURE) {
    const [vx, vy] = await h.photoToViewport(x, y, photo)
    if (deviceName === 'iphone') {
      await h.touch.tap(vx, vy)
    } else {
      await page.mouse.click(vx, vy)
      await page.waitForTimeout(50)
    }
  },

  /**
   * The fitted view of `photo` on the calibration/trace canvas, as the app should draw it:
   * the whole photo, as large as fits, centered. Photo pixel p sits at (x, y) + p * scale
   * in viewport CSS px; `box` is the canvas's bounding box.
   */
  async fitView(photo = FIXTURE) {
    const canvas = page.locator('.canvas-container canvas').first()
    await canvas.waitFor()
    const box = await canvas.boundingBox()
    const scale = Math.min(box.width / photo.width, box.height / photo.height)
    return {
      box,
      scale,
      x: box.x + (box.width - photo.width * scale) / 2,
      y: box.y + (box.height - photo.height * scale) / 2,
    }
  },

  /** Viewport CSS px of a pixel of `photo` on the calibration/trace canvas, in the fitted view. */
  async photoToViewport(x, y, photo = FIXTURE) {
    const view = await h.fitView(photo)
    return [view.x + x * view.scale, view.y + y * view.scale]
  },

  // Real touch input through CDP Input.dispatchTouchEvent (needs DEVICE=iphone or another
  // hasTouch context). Coordinates are viewport CSS px; the browser runs its own
  // scroll/zoom decisions on these, unlike page.mouse.
  touch: {
    async tap(x, y) {
      await touchEvent('touchStart', [{ x, y, id: 0 }])
      await touchEvent('touchEnd', [])
      await page.waitForTimeout(100)
    },

    async drag([x0, y0], [x1, y1], { steps = 12 } = {}) {
      await touchEvent('touchStart', [{ x: x0, y: y0, id: 0 }])
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        await touchEvent('touchMove', [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, id: 0 }])
      }
      await touchEvent('touchEnd', [])
      await page.waitForTimeout(300)
    },

    /** One finger down at from and up at to with no touchMove between, as when iOS stops delivering touchmove once it scrolls natively. */
    async lift([x0, y0], [x1, y1]) {
      await touchEvent('touchStart', [{ x: x0, y: y0, id: 0 }])
      await touchEvent('touchEnd', [{ x: x1, y: y1, id: 0 }])
      await page.waitForTimeout(100)
    },

    /** Two fingers on a horizontal line through center, spread from fromDist to toDist px apart. */
    async pinch([cx, cy], fromDist, toDist, { steps = 12, pan = [0, 0] } = {}) {
      const fingers = (dist, t) => [
        { x: cx - dist / 2 + pan[0] * t, y: cy + pan[1] * t, id: 0 },
        { x: cx + dist / 2 + pan[0] * t, y: cy + pan[1] * t, id: 1 },
      ]
      await touchEvent('touchStart', fingers(fromDist, 0))
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        await touchEvent('touchMove', fingers(fromDist + (toDist - fromDist) * t, t))
      }
      await touchEvent('touchEnd', [])
      await page.waitForTimeout(300)
    },
  },

  /** Read-only dump of the app's IndexedDB ('katagami'), image data URLs truncated. */
  async readDb() {
    return page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('katagami')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result
            const names = [...db.objectStoreNames]
            const tx = db.transaction(names, 'readonly')
            const out = {}
            let left = names.length
            for (const name of names) {
              const r = tx.objectStore(name).getAll()
              r.onsuccess = () => {
                out[name] = r.result.map((row) =>
                  typeof row.imageDataUrl === 'string'
                    ? { ...row, imageDataUrl: row.imageDataUrl.slice(0, 40) + '…' }
                    : row,
                )
                if (--left === 0) {
                  db.close()
                  resolve(out)
                }
              }
            }
            if (names.length === 0) resolve(out)
          }
        }),
    )
  },
}

const { makeFlows } = await import(pathToFileURL(path.join(KATAGAMI_SKILL_DIR, 'scripts', 'flows.mjs')))
const flows = makeFlows({ page, h, FIXTURE })

log(`scenario ${scenarioName} against ${KATAGAMI_URL}; evidence -> ${outDir}`)
let code = 0
try {
  const { default: run } = await import(pathToFileURL(scenarioPath))
  await run({ page, h, flows, FIXTURE, PORTRAIT_FIXTURE })
  if (failedChecks.length) {
    throw new Error(`${failedChecks.length} check(s) failed:\n  - ${failedChecks.join('\n  - ')}`)
  }
  log('RESULT PASS')
} catch (err) {
  code = 1
  log(`RESULT FAIL: ${err.stack ?? err}`)
  try {
    await h.shot('failure')
  } catch {}
} finally {
  await context.close()
}
console.log(`evidence: ${outDir}`)
process.exit(code)
