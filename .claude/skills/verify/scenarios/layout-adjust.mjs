// Feature: features/layout-adjust.md — place one, select, rotate, drag, overflow/overlap, unplace,
// fabric change carry-over, persistence across reload.
// Pieces are the fixture square, 20×20 cm. Konva rotates a placed piece about its (x, y) origin.
const SIDE_CM = 20
const OVERFLOW = '生地からはみ出しているパーツがあります'
const OVERLAP = '生地上で重なっているパーツがあります'

export default async ({ page, h, flows }) => {
  let fabricCm = 50

  async function layoutRow(layoutId) {
    const db = await h.readDb()
    return db.projects.find((p) => p.id === layoutId)
  }

  async function waitForLayout(layoutId, pred, msg) {
    for (let i = 0; i < 50; i++) {
      const row = await layoutRow(layoutId)
      if (row?.layout && pred(row.layout)) {
        h.assert(true, msg)
        return row.layout
      }
      await page.waitForTimeout(100)
    }
    const row = await layoutRow(layoutId)
    h.saveJson('layout-at-failure', row)
    throw new Error(`assertion failed: ${msg}`)
  }

  async function canvasPoint(xCm, yCm) {
    const box = await page.locator('.canvas-container canvas').first().boundingBox()
    const scale = box.width / fabricCm
    return { x: box.x + xCm * scale, y: box.y + yCm * scale }
  }

  function centerCm(placed) {
    const r = (placed.rotation * Math.PI) / 180
    const half = SIDE_CM / 2
    return {
      x: placed.x + half * Math.cos(r) - half * Math.sin(r),
      y: placed.y + half * Math.sin(r) + half * Math.cos(r),
    }
  }

  async function clickPiece(placed) {
    const c = centerCm(placed)
    const p = await canvasPoint(c.x, c.y)
    await page.mouse.click(p.x, p.y)
  }

  async function dragPiece(placed, toCenterCm) {
    const from = centerCm(placed)
    const a = await canvasPoint(from.x, from.y)
    const b = await canvasPoint(toCenterCm.x, toCenterCm.y)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 12 })
    await page.mouse.up()
  }

  const placeFromList = () =>
    page.getByRole('listitem').getByRole('button', { name: '前身頃' }).first().click()

  h.step('seed: pattern with one 20×20 piece, selected twice, fabric 50×50 gap 1')
  await flows.patternWithSquare('調整パターン', '前身頃')
  const layoutId = await flows.createLayoutProject('調整配置')
  await flows.addPatternToLayout('調整パターン')
  await h.see('合計 1 パーツ')
  await flows.addPatternToLayout('調整パターン')
  await h.see('合計 2 パーツ')
  await flows.button('次へ: 生地・配置').click()
  await flows.currentStep('生地・配置').waitFor()
  await page.getByRole('spinbutton', { name: '幅（cm）' }).fill('50')
  await page.getByRole('spinbutton', { name: '高さ（cm）' }).fill('50')
  await page.getByRole('spinbutton', { name: '裁断余白（cm）' }).fill('1')
  await flows.button('反映').click()
  await h.see('未配置（2）')

  h.step('place one piece from 未配置')
  await placeFromList()
  await h.see('生地に配置: 1 / 2 パーツ')
  await h.see('未配置（1）')
  let layout = await waitForLayout(layoutId, (l) => l.placedPieces.length === 1, 'one piece placed in DB')
  const first = layout.placedPieces[0]
  await h.shot('placed-one')

  h.step('select it on the canvas')
  await clickPiece(first)
  await flows.button('＋15°').waitFor()
  await h.see('未配置に戻す')
  await h.shot('selected')

  h.step('＋15°')
  await flows.button('＋15°').click()
  layout = await waitForLayout(
    layoutId,
    (l) => l.placedPieces[0].rotation === (first.rotation + 15) % 360,
    `rotation ${first.rotation} → ${(first.rotation + 15) % 360} in DB`,
  )
  const rotated = layout.placedPieces[0]
  await h.shot('rotated')

  h.step('drag past the right fabric edge')
  await dragPiece(rotated, { x: fabricCm - 5, y: 25 })
  await h.see(OVERFLOW)
  layout = await waitForLayout(
    layoutId,
    (l) => l.placedPieces[0].x !== rotated.x && l.placedPieces[0].y !== rotated.y,
    'dragged piece x/y changed in DB',
  )
  const overflowing = layout.placedPieces[0]
  h.assert(overflowing.rotation === rotated.rotation, 'drag keeps the rotation')
  await h.shot('overflow')

  h.step('place the second piece and drag it onto the first')
  await placeFromList()
  await h.see('生地に配置: 2 / 2 パーツ')
  layout = await waitForLayout(layoutId, (l) => l.placedPieces.length === 2, 'two pieces placed in DB')
  const second = layout.placedPieces[1]
  h.assert(second.instanceKey !== overflowing.instanceKey, 'second placement is the other piece')
  await dragPiece(second, centerCm(overflowing))
  await h.see(OVERLAP)
  layout = await waitForLayout(
    layoutId,
    (l) => l.placedPieces[1].x !== second.x || l.placedPieces[1].y !== second.y,
    'second piece moved in DB',
  )
  const stacked = layout.placedPieces[1]
  await h.shot('overlap')

  h.step('select the top piece and 未配置に戻す')
  await clickPiece(stacked)
  await flows.button('未配置に戻す').click()
  await h.see('未配置（1）')
  await h.see('生地に配置: 1 / 2 パーツ')
  layout = await waitForLayout(
    layoutId,
    (l) => l.placedPieces.length === 1 && l.placedPieces[0].instanceKey === overflowing.instanceKey,
    'unplaced piece left placedPieces',
  )
  await page.waitForFunction((text) => !document.body.innerText.includes(text), OVERLAP)
  await h.see(OVERFLOW)
  await h.shot('unplaced')

  h.step('change fabric to 60×55 and 反映; placements carry over')
  await page.getByRole('spinbutton', { name: '幅（cm）' }).fill('60')
  await page.getByRole('spinbutton', { name: '高さ（cm）' }).fill('55')
  await flows.button('反映').click()
  fabricCm = 60
  layout = await waitForLayout(layoutId, (l) => l.fabricWidthCm === 60 && l.fabricHeightCm === 55, 'layout fabric 60×55 in DB')
  const kept = layout.placedPieces
  h.assert(kept.length === 1, 'one placement carried over')
  h.assert(
    kept[0].instanceKey === overflowing.instanceKey &&
      kept[0].x === overflowing.x &&
      kept[0].y === overflowing.y &&
      kept[0].rotation === overflowing.rotation,
    'carried placement keeps position and rotation',
  )
  await h.see('生地に配置: 1 / 2 パーツ')
  await h.see('未配置（1）')
  await h.notSee(OVERFLOW)
  await h.shot('fabric-changed')

  h.step('second view: reload, open 生地・配置, read IndexedDB')
  await h.goto(`/layouts/${layoutId}`)
  await page.getByRole('heading', { name: '配置: 調整配置' }).waitFor()
  await flows.button('生地・配置').click()
  await flows.currentStep('生地・配置').waitFor()
  await h.see('生地に配置: 1 / 2 パーツ')
  await h.see('未配置（1）')
  await h.shot('after-reload')
  const db = h.saveJson('db-after', await h.readDb())
  const row = db.projects.find((p) => p.id === layoutId)
  h.assert(row.fabricWidthCm === 60 && row.fabricHeightCm === 55, 'fabric 60×55 persisted')
  h.assert(row.layout.placedPieces.length === 1, 'one placement persisted')
  const persisted = row.layout.placedPieces[0]
  h.assert(
    persisted.x === overflowing.x && persisted.y === overflowing.y && persisted.rotation === overflowing.rotation,
    'persisted placement matches the dragged, rotated piece',
  )
}
