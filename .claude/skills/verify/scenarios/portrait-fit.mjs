// Feature: features/pattern-trace.md (fitted view). Run with DEVICE=iphone, whose 65%-of-window
// canvas cap is shorter than a 3:4 portrait photo scaled to the canvas width.
// The fitted view must show the whole photo: at the harness's contain-fit positions the canvas
// must draw PORTRAIT_FIXTURE's red corner marks, and taps there must save those photo pixels.
// The canvas is taller than the space between the header and the fixed bottom bar, so each
// tap first scrolls its target to the middle of the window.
export default async ({ page, h, flows, PORTRAIT_FIXTURE: P }) => {
  const [tl, tr, br, bl] = P.corners

  async function checkCornerMarksDrawn(label) {
    const view = await h.fitView(P)
    for (const [x, y] of P.corners) {
      const [vx, vy] = await h.photoToViewport(x, y, P)
      const rgb = await page
        .locator('.canvas-container canvas')
        .first()
        .evaluate((el, [cx, cy]) => {
          const k = el.width / el.clientWidth
          return [...el.getContext('2d').getImageData(Math.round(cx * k), Math.round(cy * k), 1, 1).data].slice(0, 3)
        }, [vx - view.box.x, vy - view.box.y])
      h.check(
        rgb[0] > 180 && rgb[1] < 90 && rgb[2] < 90,
        `${label}: the red corner mark at photo (${x}, ${y}) is drawn on the canvas (pixel rgb ${rgb})`,
      )
    }
    return view
  }

  async function tapCorner([x, y]) {
    const [, vy] = await h.photoToViewport(x, y, P)
    await page.evaluate((dy) => window.scrollBy(0, dy), vy - page.viewportSize().height / 2)
    await h.tapPhoto(x, y, P)
  }

  function checkNear(label, got, [x, y]) {
    h.check(
      Math.hypot(got.x - x, got.y - y) < 3,
      `${label}: saved point is photo (${x}, ${y}) (got ${got.x.toFixed(1)}, ${got.y.toFixed(1)})`,
    )
  }

  h.step('create pattern project and add the portrait photo')
  const projectId = await flows.createPatternProject('縦長写真')
  await flows.addPhoto(P.path)
  await page.evaluate(() => window.scrollTo(0, 0))
  await h.shot('calibration-first-display')
  const first = await checkCornerMarksDrawn('calibration first display')
  h.assert(
    first.box.height < (first.box.width * P.height) / P.width - 1,
    `canvas ${first.box.width}×${first.box.height} is shorter than the photo at canvas width, so only a contain fit shows it whole`,
  )

  h.step('calibration first display: tap the top-left and bottom-right corner marks')
  await tapCorner(tl)
  await tapCorner(br)
  await h.see('選択点: 2 / 2')
  await page.getByRole('spinbutton', { name: '実寸（cm）' }).fill('10')
  await flows.button('校正を保存').tap()
  await flows.currentStep('トレース').waitFor()
  const { calibration } = (await h.readDb()).photos[0]
  checkNear('calibration point A', calibration.pointA, tl)
  checkNear('calibration point B', calibration.pointB, br)

  h.step('trace step: zoom in twice, then 全体表示 shows the whole photo again')
  await page.evaluate(() => window.scrollTo(0, 0))
  await flows.button('＋ 拡大').tap()
  await flows.button('＋ 拡大').tap()
  await flows.button('全体表示').tap()
  await page.evaluate(() => window.scrollTo(0, 0))
  await h.shot('trace-after-fit-button')
  await checkCornerMarksDrawn('after 全体表示')
  for (const corner of P.corners) await tapCorner(corner)
  await page.getByRole('textbox', { name: 'パーツ名' }).fill('外枠')
  await flows.button('パーツを保存').tap()
  await page.getByRole('button', { name: /^・外枠/ }).waitFor()

  h.step('second view: reload and read the traced corners in photo pixels')
  await h.goto(`/patterns/${projectId}`)
  const db = h.saveJson('db-after', await h.readDb())
  const photo = db.photos[0]
  h.assert(photo.width === P.width && photo.height === P.height, `photo stored at ${P.width}×${P.height}`)
  const piece = db.pieces.find((p) => p.name === '外枠')
  h.assert(piece?.vertices.length === 4, 'piece 外枠 saved with 4 vertices')
  const ppc = photo.calibration.pixelsPerCm
  piece.vertices.forEach((v, i) =>
    checkNear(`after 全体表示 vertex ${i + 1}`, { x: v.x * ppc, y: v.y * ppc }, [tl, tr, br, bl][i]),
  )
}
