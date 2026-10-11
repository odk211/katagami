// Feature: features/pattern-trace.md (mobile touch). Run with DEVICE=iphone.
// Every gesture is real CDP touch input; the browser decides scrolling and zooming itself.
export default async ({ page, h, flows, FIXTURE }) => {
  h.assert(await page.evaluate(() => navigator.maxTouchPoints > 0), 'touch-capable context (DEVICE=iphone)')

  const scrollY = () => page.evaluate(() => window.scrollY)
  const zoom = () => page.evaluate(() => window.visualViewport?.scale ?? 1)
  const canvas = page.locator('.canvas-container canvas').first()
  const vertexCount = async () =>
    Number((await page.getByText(/^頂点: \d+点/).first().textContent()).match(/頂点: (\d+)点/)[1])

  async function checkInViewport(name) {
    const box = await flows.button(name).boundingBox()
    const vh = page.viewportSize().height
    const onTop = box
      ? await page.evaluate(
          ([x, y, label]) => document.elementFromPoint(x, y)?.closest('button')?.textContent === label,
          [box.x + box.width / 2, box.y + box.height / 2, name],
        )
      : false
    h.check(
      box && box.y >= 0 && box.y + box.height <= vh && onTop,
      `${name} is visible inside the ${vh}px viewport without scrolling (box ${JSON.stringify(box)})`,
    )
  }

  async function checkTapTargets(label, locators) {
    for (const [name, locator] of locators) {
      const n = await locator.count()
      for (let i = 0; i < n; i++) {
        const box = await locator.nth(i).boundingBox()
        h.check(box && box.height >= 44, `${label}: ${name}${n > 1 ? ` #${i + 1}` : ''} is ≥44px tall (got ${box?.height})`)
      }
    }
  }

  h.step('create pattern project and add the fixture photo')
  const projectId = await flows.createPatternProject('モバイル検証')
  await flows.addPhoto()
  await h.shot('calibration-start')
  await checkInViewport('校正を保存')
  await checkTapTargets('calibration', [['校正を保存', flows.button('校正を保存')]])

  h.step('pinch-out 2× around the canvas centre while the midpoint pans, during calibration')
  await canvas.scrollIntoViewIfNeeded()
  const box0 = await canvas.boundingBox()
  const fitScale = box0.width / FIXTURE.width
  const center = [box0.x + box0.width / 2, box0.y + box0.height / 2]
  const anchor = [(center[0] - box0.x) / fitScale, (center[1] - box0.y) / fitScale]
  const pan = [40, 30]
  const yBeforePinch = await scrollY()
  await h.touch.pinch(center, 80, 160, { pan })
  await h.shot('after-pinch')
  h.check((await scrollY()) === yBeforePinch, `pinch does not scroll the page (scrollY ${yBeforePinch} → ${await scrollY()})`)
  h.check((await zoom()) === 1, `pinch does not zoom the page (visualViewport.scale ${await zoom()})`)
  h.check(await page.getByText('選択点: 0 / 2').isVisible(), 'ending the pinch adds no calibration point')

  h.step('tap two points 120 screen px apart, enter 10 cm, save')
  const box1 = await canvas.boundingBox()
  const c1 = [box1.x + box1.width / 2, box1.y + box1.height / 2]
  await h.touch.tap(c1[0] - 60, c1[1])
  await h.touch.tap(c1[0] + 60, c1[1])
  await h.see('選択点: 2 / 2')
  await page.getByRole('spinbutton', { name: '実寸（cm）' }).fill('10')
  await flows.button('校正を保存').tap()
  await flows.currentStep('トレース').waitFor()
  const calibrated = (await h.readDb()).photos[0].calibration
  const expectedPpc = 120 / (fitScale * 2) / 10
  h.check(
    Math.abs(calibrated.pixelsPerCm - expectedPpc) / expectedPpc < 0.03,
    `120 screen px after a 2× pinch is 10 cm at ${expectedPpc.toFixed(2)} px/cm (unzoomed would be ${(expectedPpc * 2).toFixed(2)}; got ${calibrated.pixelsPerCm.toFixed(2)})`,
  )
  const tapMid = [(calibrated.pointA.x + calibrated.pointB.x) / 2, (calibrated.pointA.y + calibrated.pointB.y) / 2]
  const pannedMid = [anchor[0] - pan[0] / (fitScale * 2), anchor[1] - pan[1] / (fitScale * 2)]
  h.check(
    Math.hypot(tapMid[0] - pannedMid[0], tapMid[1] - pannedMid[1]) < 3,
    `the pinch midpoint panned the photo: a tap at the canvas centre lands on photo (${pannedMid.map((v) => v.toFixed(1)).join(', ')}), not the unpanned (${anchor.map((v) => v.toFixed(1)).join(', ')}) (got ${tapMid.map((v) => v.toFixed(1)).join(', ')})`,
  )

  h.step('trace step: bottom bar and tap targets without scrolling')
  await page.evaluate(() => window.scrollTo(0, 0))
  await h.shot('trace-start')
  await checkInViewport('パーツを保存')
  await checkTapTargets('trace', [
    ['← 戻る', page.getByRole('link', { name: '← 戻る' })],
    ['step pill', page.locator('nav[aria-label="作業ステップ"] button')],
    ['＋ 拡大', flows.button('＋ 拡大')],
    ['－ 縮小', flows.button('－ 縮小')],
    ['全体表示', flows.button('全体表示')],
    ['1点戻す', flows.button('1点戻す')],
    ['クリア', flows.button('クリア')],
    ['通常', flows.button('通常')],
    ['折りセンター', flows.button('折りセンター')],
    ['パーツを保存', flows.button('パーツを保存')],
  ])

  h.step('one-finger vertical swipe over the zoomed-in photo scrolls the page')
  await flows.button('＋ 拡大').tap()
  await flows.button('＋ 拡大').tap()
  const photoBefore = await canvas.screenshot()
  const yBeforeSwipe = await scrollY()
  const countBeforeSwipe = await vertexCount()
  const box2 = await canvas.boundingBox()
  const swipeX = box2.x + box2.width / 2
  await h.touch.drag([swipeX, box2.y + box2.height - 30], [swipeX, box2.y + 30])
  const yAfterSwipe = await scrollY()
  await h.shot('after-swipe')
  h.check(yAfterSwipe > yBeforeSwipe + 50, `swipe scrolls the page (scrollY ${yBeforeSwipe} → ${yAfterSwipe})`)
  h.check((await vertexCount()) === countBeforeSwipe, `swipe adds no point (頂点 ${countBeforeSwipe} → ${await vertexCount()})`)
  h.check(Buffer.compare(photoBefore, await canvas.screenshot()) === 0, 'swipe does not pan the photo (canvas pixels unchanged)')

  h.step('a swipe whose touchmoves never arrive adds no point')
  await page.evaluate(() => window.scrollTo(0, 0))
  const box3 = await canvas.boundingBox()
  const liftStart = [box3.x + box3.width / 2, box3.y + box3.height / 2 - 40]
  await h.touch.lift(liftStart, [liftStart[0], liftStart[1] + 80])
  h.check(
    (await vertexCount()) === countBeforeSwipe,
    `touchend 80px from touchstart with no touchmove adds no point (頂点 ${countBeforeSwipe} → ${await vertexCount()})`,
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await flows.button('全体表示').tap()

  h.step('tap the square corners; one tap adds exactly one point')
  for (const [i, [x, y]] of FIXTURE.square.entries()) {
    await h.tapPhoto(x, y)
    h.check((await vertexCount()) === i + 1, `tap ${i + 1} gives ${i + 1} vertices (got ${await vertexCount()})`)
  }

  h.step('bottom-bar パーツを保存 with an empty name focuses パーツ名')
  await page.evaluate(() => window.scrollTo(0, 0))
  await flows.button('パーツを保存').tap({ force: true })
  const nameInput = page.getByRole('textbox', { name: 'パーツ名' })
  const focused = await nameInput.evaluate((el) => el === document.activeElement)
  const nameBox = await nameInput.boundingBox()
  await h.shot('save-with-empty-name')
  h.check(focused, 'パーツ名 is focused after pressing パーツを保存 without a name')
  h.check(
    nameBox && nameBox.y >= 0 && nameBox.y + nameBox.height <= page.viewportSize().height,
    `パーツ名 is scrolled into view (box ${JSON.stringify(nameBox)})`,
  )
  await nameInput.fill('前身頃')
  await flows.button('パーツを保存').tap()
  await page.getByRole('button', { name: /^・前身頃/ }).waitFor()
  const before = (await h.readDb()).pieces.find((p) => p.name === '前身頃')
  h.assert(before?.vertices.length === 4, 'piece 前身頃 saved with 4 vertices')

  h.step('edit 前身頃 and touch-drag its first vertex')
  await page.getByRole('button', { name: '前身頃を編集' }).tap()
  await page.evaluate(() => window.scrollTo(0, 0))
  await canvas.scrollIntoViewIfNeeded()
  const [hx, hy] = await h.photoToViewport(...FIXTURE.square[0])
  const yBeforeHandle = await scrollY()
  await h.touch.drag([hx, hy], [hx + 30, hy + 30])
  await h.shot('after-handle-drag')
  h.check((await scrollY()) === yBeforeHandle, `dragging a vertex does not scroll the page (scrollY ${yBeforeHandle} → ${await scrollY()})`)
  await flows.button('変更を保存').tap()
  await page.getByRole('button', { name: '前身頃を編集' }).waitFor()

  h.step('second view: reload and read the moved vertex')
  await h.goto(`/patterns/${projectId}`)
  const db = h.saveJson('db-after', await h.readDb())
  const after = db.pieces.find((p) => p.id === before.id)
  const moved = [after.vertices[0].x - before.vertices[0].x, after.vertices[0].y - before.vertices[0].y]
  const expectedCm = 30 / fitScale / calibrated.pixelsPerCm
  h.check(
    moved.every((d) => Math.abs(d - expectedCm) < expectedCm * 0.15),
    `vertex 1 moved by ≈${expectedCm.toFixed(2)} cm on both axes (got ${moved.map((d) => d.toFixed(2)).join(', ')})`,
  )
  h.check(
    after.vertices.slice(1).every((v, i) => v.x === before.vertices[i + 1].x && v.y === before.vertices[i + 1].y),
    'the other vertices are unchanged',
  )

  h.step('layout project step pills')
  await flows.createLayoutProject('モバイル配置')
  await h.shot('layout-start')
  await checkTapTargets('layout', [
    ['← 戻る', page.getByRole('link', { name: '← 戻る' })],
    ['step pill', page.locator('nav[aria-label="作業ステップ"] button')],
  ])

  h.step('pinch outside the canvas still zooms the page (accessibility)')
  const heading = await page.getByRole('heading', { name: '配置: モバイル配置' }).boundingBox()
  await h.touch.pinch([195, heading.y + 120], 60, 180)
  h.check((await zoom()) > 1.2, `pinch on page content zooms the page (visualViewport.scale ${await zoom()})`)
}
