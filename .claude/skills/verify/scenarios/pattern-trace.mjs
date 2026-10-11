// Feature: features/pattern-trace.md — photo → calibration → trace, copy, mirror, delete.
// Expected numbers come from the fixture: 20 px/cm, square 20×20 cm.
export default async ({ page, h, flows, FIXTURE }) => {
  h.step('create pattern project')
  const projectId = await flows.createPatternProject('検証ブラウス')
  await h.shot('pattern-created')

  h.step('add photo via 写真を選択')
  await flows.addPhoto()
  await h.shot('calibration-start')

  h.step('calibrate on the 20 cm scale bar')
  await flows.calibrate()
  await h.shot('trace-start')

  h.step('trace the square as 前身頃')
  await flows.tracePiece('前身頃', FIXTURE.square)
  await h.see('パーツ 1 件登録済み')
  await h.shot('piece-saved')

  h.step('select 前身頃, 鏡像コピー')
  await page.getByRole('button', { name: /^・前身頃/ }).click()
  await flows.button('鏡像コピー').click()
  await page.getByRole('button', { name: /^・前身頃（反）\[反\]/ }).waitFor()
  await h.see('パーツ 2 件登録済み')
  await h.shot('mirror-copied')

  h.step('delete the mirror copy (confirm dialog accepted)')
  await flows.button('選択したパーツを削除').click()
  await h.see('パーツ 1 件登録済み')
  await h.notSee('前身頃（反）')
  await h.shot('mirror-deleted')

  h.step('second view: reload and read IndexedDB')
  await h.goto(`/patterns/${projectId}`)
  await page.getByRole('heading', { name: '型紙: 検証ブラウス' }).waitFor()
  const db = h.saveJson('db-after', await h.readDb())
  const photo = db.photos.find((p) => p.projectId === projectId)
  h.assert(photo && photo.width === FIXTURE.width && photo.height === FIXTURE.height, 'photo stored at original 960x720')
  const ppc = photo.calibration?.pixelsPerCm
  h.assert(Math.abs(ppc - 20) < 0.3, `calibration ≈ 20 px/cm (got ${ppc})`)
  const pieces = db.pieces.filter((p) => p.photoId === photo.id)
  h.assert(pieces.length === 1 && pieces[0].name === '前身頃', 'exactly one piece 前身頃 persisted')
  const xs = pieces[0].vertices.map((v) => v.x)
  const ys = pieces[0].vertices.map((v) => v.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const hgt = Math.max(...ys) - Math.min(...ys)
  h.assert(Math.abs(w - 20) < 0.5 && Math.abs(hgt - 20) < 0.5, `piece is ≈20×20 cm (got ${w.toFixed(2)}×${hgt.toFixed(2)})`)
  await h.see('校正済')
  await h.shot('reloaded-photos-step')
}
