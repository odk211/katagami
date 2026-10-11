// Feature: features/import-export.md — export a backup, delete everything, import it back (twice), reject a bad file, survive a failed write.
import { readFileSync, writeFileSync } from 'node:fs'

const byId = (rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
const snapshot = (db) => JSON.stringify({ projects: byId(db.projects), photos: byId(db.photos), pieces: byId(db.pieces) })
const counts = (db) => ({ projects: db.projects.length, photos: db.photos.length, pieces: db.pieces.length })

export default async ({ page, h, flows }) => {
  h.step('seed through the UI: pattern with one piece, layout on 50×50 auto-placed')
  await flows.patternWithSquare('バックアップ元', '前身頃')
  await flows.createLayoutProject('バックアップ配置')
  await flows.addPatternToLayout('バックアップ元')
  await h.see('合計 1 パーツ')
  await flows.button('次へ: 生地・配置').click()
  await flows.currentStep('生地・配置').waitFor()
  await page.getByRole('spinbutton', { name: '幅（cm）' }).fill('50')
  await page.getByRole('spinbutton', { name: '高さ（cm）' }).fill('50')
  await flows.button('反映').click()
  await flows.button('残りを自動配置').click()
  await h.see('生地に配置: 1 / 1 パーツ')

  h.step('home: export downloads a backup file')
  await h.goto('/')
  await page.getByRole('heading', { name: 'バックアップ', level: 2 }).waitFor()
  await h.shot('home-before-export')
  const before = h.saveJson('db-before-export', await h.readDb())
  h.assert(JSON.stringify(counts(before)) === JSON.stringify({ projects: 2, photos: 1, pieces: 1 }), `seeded rows ${JSON.stringify(counts(before))}`)
  const downloading = page.waitForEvent('download')
  await flows.button('エクスポート').click()
  const download = await downloading
  h.assert(/^katagami-\d{8}-\d{4}\.json$/.test(download.suggestedFilename()), `file name ${download.suggestedFilename()}`)
  const backupPath = h.evidencePath('backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  h.assert(backup.format === 'katagami-backup' && backup.version === 1, 'file declares katagami-backup v1')
  h.assert(backup.photos[0].imageDataUrl.startsWith('data:image/'), 'file carries the photo image data')
  h.log(`evidence backup.json (${readFileSync(backupPath).length} bytes)`)

  const deleteButtonFor = (name) =>
    page.getByRole('link', { name: new RegExp(name) }).locator('xpath=..').getByRole('button', { name: '削除' })
  const confirmDelete = async (name) => {
    await deleteButtonFor(name).click()
    const dialog = page.getByRole('alertdialog', { name: `「${name}」を削除しますか？` })
    await dialog.getByRole('button', { name: '削除', exact: true }).click()
    await dialog.waitFor({ state: 'detached' })
  }

  h.step('delete both projects through the home list')
  await confirmDelete('バックアップ配置')
  await confirmDelete('バックアップ元')
  await h.see('型紙プロジェクトはまだありません')
  await h.see('配置プロジェクトはまだありません')
  h.assert(await flows.button('エクスポート').isDisabled(), 'エクスポート disabled with no projects')
  await h.shot('home-emptied')
  const emptied = await h.readDb()
  h.assert(emptied.projects.length + emptied.photos.length + emptied.pieces.length === 0, 'DB empty after deletes')

  const importFile = async (file) => {
    const choosing = page.waitForEvent('filechooser')
    await flows.button('インポート').click()
    await (await choosing).setFiles(file)
  }
  const importDialog = page.getByRole('alertdialog', { name: 'バックアップを読み込みますか？' })
  const confirmImport = async (label) => {
    await importDialog.waitFor()
    await h.see('型紙プロジェクト 1件・配置プロジェクト 1件')
    await h.see('同じIDのプロジェクトは上書きされます')
    await h.shot(`${label}-dialog`)
    await importDialog.getByRole('button', { name: '読み込む', exact: true }).click()
    await importDialog.waitFor({ state: 'detached' })
    await page.getByRole('status').getByText('読み込みました').waitFor()
    h.log('saw status "読み込みました"')
  }

  h.step('import the saved file and confirm')
  await importFile(backupPath)
  await confirmImport('import-1')
  await page.getByRole('link', { name: /バックアップ元/ }).waitFor()
  await page.getByRole('link', { name: /バックアップ配置/ }).waitFor()
  await h.shot('home-restored')
  const restored = h.saveJson('db-after-import-1', await h.readDb())
  h.assert(JSON.stringify(counts(restored)) === JSON.stringify(counts(before)), `row counts restored ${JSON.stringify(counts(restored))}`)
  h.assert(snapshot(restored) === snapshot(before), 'every restored row equals its pre-export row')

  h.step('restored layout still fits')
  await page.getByRole('link', { name: /バックアップ配置/ }).click()
  await page.getByRole('heading', { name: '配置: バックアップ配置' }).waitFor()
  await page.getByRole('button', { name: '結果をスキップ表示' }).click()
  await flows.currentStep('結果').waitFor()
  await h.see('生地は足ります')
  await h.see('16.0%')
  await h.see('50 × 50 cm')
  await h.shot('restored-report')

  h.step('import the same file again: state unchanged')
  await h.goto('/')
  await importFile(backupPath)
  await confirmImport('import-2')
  const again = h.saveJson('db-after-import-2', await h.readDb())
  h.assert(JSON.stringify(counts(again)) === JSON.stringify(counts(before)), `row counts unchanged ${JSON.stringify(counts(again))}`)
  h.assert(snapshot(again) === snapshot(restored), 'second import leaves identical rows')
  h.assert((await page.getByRole('link', { name: /バックアップ元/ }).count()) === 1, 'pattern listed once')

  h.step('import a JSON file that is not a backup')
  const badPath = h.evidencePath('not-a-backup.json')
  writeFileSync(badPath, JSON.stringify({ hello: 'world' }))
  await importFile(badPath)
  const alert = page.getByRole('alert')
  await alert.waitFor()
  const alertText = await alert.textContent()
  h.assert(alertText === '型紙チェックのバックアップファイルではありません。', `alert: ${alertText}`)
  h.assert((await importDialog.count()) === 0, 'no import dialog for a bad file')
  await h.shot('import-rejected')
  h.assert(snapshot(await h.readDb()) === snapshot(restored), 'rejected file changed nothing')

  h.step('fault injection: IndexedDB put throws QuotaExceededError during import')
  const beforeFailure = await h.readDb()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    window.__katagamiVerifyIdb = { original, putCalls: 0 }
    IDBObjectStore.prototype.put = function () {
      window.__katagamiVerifyIdb.putCalls++
      throw new DOMException('quota', 'QuotaExceededError')
    }
  })
  try {
    await importFile(backupPath)
    await importDialog.waitFor()
    await importDialog.getByRole('button', { name: '読み込む', exact: true }).click()
    await importDialog.waitFor({ state: 'detached' })
    const failureAlert = page.getByRole('alert')
    await failureAlert.getByText('読み込みに失敗しました。').waitFor()
    const failureText = await failureAlert.textContent()
    h.assert(failureText === '読み込みに失敗しました。端末の空き容量を確認して、もう一度お試しください。', `alert: ${failureText}`)
    await h.notSee('読み込みました')
    const putCalls = await page.evaluate(() => window.__katagamiVerifyIdb.putCalls)
    h.assert(putCalls > 0, `injected IDBObjectStore.put was hit ${putCalls} time(s)`)
    h.assert((await page.getByRole('link', { name: /バックアップ元/ }).count()) === 1, 'pattern still listed')
    h.assert((await page.getByRole('link', { name: /バックアップ配置/ }).count()) === 1, 'layout still listed')
    await h.shot('import-failed')
  } finally {
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = window.__katagamiVerifyIdb.original
    })
  }
  const afterFailure = h.saveJson('db-after-failed-import', await h.readDb())
  h.assert(snapshot(afterFailure) === snapshot(beforeFailure), 'failed import changed no rows')
}
