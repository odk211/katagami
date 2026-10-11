// Runs one scenario module against a launched Katagami instance with a Playwright profile
// owned by the run. Invoke through `katagami-verify drive <scenario>`, which sets the env.
//
// A scenario is an ES module: `export default async ({ page, h, flows }) => { ... }`.
// Throwing fails the run (exit 1) after a failure screenshot.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GEOMETRY } from './fixture-geometry.mjs'

const { KATAGAMI_URL, KATAGAMI_RUN_DIR, KATAGAMI_TOOLS, KATAGAMI_SKILL_DIR } = process.env
if (!KATAGAMI_URL || !KATAGAMI_RUN_DIR || !KATAGAMI_TOOLS) {
  console.error('drive.mjs must be started by `katagami-verify drive`')
  process.exit(2)
}
const { chromium } = createRequire(path.join(KATAGAMI_TOOLS, 'package.json'))('playwright')

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

const FIXTURE = { ...GEOMETRY, path: path.join(KATAGAMI_SKILL_DIR, 'fixtures', 'pattern-page.png') }

// IndexedDB lives in the browser profile. Each drive starts empty unless PROFILE=<name>
// names a profile to reuse (e.g. to inspect state a previous drive left behind).
const profileDir = path.join(KATAGAMI_RUN_DIR, 'profile', process.env.PROFILE || `${scenarioName}-${stamp}`)
const context = await chromium.launchPersistentContext(profileDir, {
  headless: process.env.HEADED !== '1',
  ignoreHTTPSErrors: true,
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
})
const page = context.pages()[0] ?? (await context.newPage())

let dialogPolicy = 'accept'
page.on('dialog', async (d) => {
  log(`dialog ${d.type()}: ${JSON.stringify(d.message())} -> ${dialogPolicy}`)
  if (dialogPolicy === 'dismiss') await d.dismiss()
  else await d.accept()
  dialogPolicy = 'accept'
})
page.on('pageerror', (e) => log(`PAGE ERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') log(`console.error: ${m.text()}`)
})

let shotN = 0
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

  /**
   * Tap a photo pixel on the calibration/trace Konva canvas. Assumes the fitted view
   * (the default, or after pressing 全体表示): stage at (0,0), scale = canvas width / photo width.
   */
  async tapPhoto(x, y) {
    const canvas = page.locator('.canvas-container canvas').first()
    await canvas.waitFor()
    const box = await canvas.boundingBox()
    const s = box.width / FIXTURE.width
    await page.mouse.click(box.x + x * s, box.y + y * s)
    await page.waitForTimeout(50)
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
  await run({ page, h, flows, FIXTURE })
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
