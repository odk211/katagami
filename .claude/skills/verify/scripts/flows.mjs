// User-path recipes shared by scenarios. Every step goes through visible UI controls;
// none of them write IndexedDB directly.
export function makeFlows({ page, h, FIXTURE }) {
  const button = (name) => page.getByRole('button', { name, exact: true })
  const currentStep = (label) =>
    page.locator('nav[aria-label="作業ステップ"] [aria-current="step"]', { hasText: label })

  return {
    button,
    currentStep,

    /** Home → 型紙プロジェクトを作成; optionally rename. Returns the project id from the URL. */
    async createPatternProject(name) {
      await h.goto('/')
      await button('型紙プロジェクトを作成').click()
      await page.waitForURL(/\/patterns\/[^/]+$/)
      await currentStep('写真').waitFor()
      if (name) await this.rename('型紙', name)
      return page.url().split('/').pop()
    },

    /** Home → 配置プロジェクトを作成; optionally rename. Returns the project id. */
    async createLayoutProject(name) {
      await h.goto('/')
      await button('配置プロジェクトを作成').click()
      await page.waitForURL(/\/layouts\/[^/]+$/)
      await currentStep('型紙選択').waitFor()
      if (name) await this.rename('配置', name)
      return page.url().split('/').pop()
    },

    async rename(prefix, name) {
      await page.getByRole('button', { name: `${prefix}プロジェクト名を編集` }).click()
      const input = page.getByRole('textbox', { name: `${prefix}プロジェクト名` })
      await input.fill(name)
      await input.press('Enter')
      await page.getByRole('heading', { name: `${prefix}: ${name}` }).waitFor()
    },

    /** 写真 step → 写真を選択 → file chooser. Lands on 校正. */
    async addPhoto(file = FIXTURE.path) {
      const chooser = page.waitForEvent('filechooser')
      await button('写真を選択').click()
      await (await chooser).setFiles(file)
      await currentStep('校正').waitFor()
      await page.locator('.canvas-container canvas').first().waitFor()
    },

    /** 校正 step: tap both ends of the scale bar, enter cm, save. Lands on トレース. */
    async calibrate(bar = FIXTURE.scaleBar) {
      await h.tapPhoto(...bar.a)
      await h.tapPhoto(...bar.b)
      await h.see('選択点: 2 / 2')
      await page.getByRole('spinbutton', { name: '実寸（cm）' }).fill(String(bar.cm))
      await button('校正を保存').click()
      await currentStep('トレース').waitFor()
    },

    /** トレース step: tap vertices, name it, pick 裁断タイプ, save. */
    async tracePiece(name, points, { foldCenter = false } = {}) {
      for (const [x, y] of points) await h.tapPhoto(x, y)
      await page.getByRole('textbox', { name: 'パーツ名' }).fill(name)
      if (foldCenter) await button('折りセンター').click()
      await button('パーツを保存').click()
      await page.getByRole('button', { name: new RegExp(`^・${name}`) }).waitFor()
    },

    /** 型紙選択 step: press 追加 on the card for the named pattern project. */
    async addPatternToLayout(patternName) {
      await page
        .locator('div')
        .filter({ has: page.getByText(patternName, { exact: true }) })
        .filter({ has: button('追加') })
        .last()
        .getByRole('button', { name: '追加', exact: true })
        .click()
    },

    /** Full pattern setup through the UI: project, photo, calibration, square piece. */
    async patternWithSquare(projectName, pieceName = '正方形') {
      const id = await this.createPatternProject(projectName)
      await this.addPhoto()
      await this.calibrate()
      await this.tracePiece(pieceName, FIXTURE.square)
      return id
    },
  }
}
