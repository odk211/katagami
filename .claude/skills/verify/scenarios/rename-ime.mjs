// Feature: features/project-list.md (list-rename-ime) — Enter/Escape that confirm or cancel an IME
// conversion must not end the name edit. IME input is synthesized over CDP in two key orders:
// Chromium sends keydown(Enter, isComposing) before the commit; Safari commits first, then sends
// keydown(Enter, keyCode 229, isComposing false).
export default async ({ page, h, flows }) => {
  const projectId = await flows.createPatternProject('元の名前')
  const cdp = await page.context().newCDPSession(page)
  const editButton = page.getByRole('button', { name: '型紙プロジェクト名を編集' })
  const input = page.getByRole('textbox', { name: '型紙プロジェクト名' })

  const startEditing = async () => {
    await editButton.click()
    await input.fill('')
    await page.evaluate(() => {
      window.__keys = []
      for (const type of ['keydown', 'compositionend'])
        document.activeElement.addEventListener(
          type,
          (e) => window.__keys.push(`${type}:${e.key ?? ''}:${e.isComposing}:${e.keyCode ?? ''}`),
          true,
        )
    })
  }
  const compose = (text) =>
    cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length })
  const imeKey = (key) =>
    cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: 229 })
  const keyUp = (key, keyCode) =>
    cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: keyCode })
  const expectStillEditing = async (label, value) => {
    await page.waitForTimeout(150)
    h.log(`key events (${label}): ${JSON.stringify(await page.evaluate(() => window.__keys))}`)
    h.assert((await input.count()) === 1, `${label}: still editing after the IME key`)
    h.assert((await input.inputValue()) === value, `${label}: draft is ${JSON.stringify(value)}`)
  }
  const expectSaved = async (name) => {
    await page.getByRole('heading', { name: `型紙: ${name}` }).waitFor()
    const db = await h.readDb()
    h.assert(db.projects.find((p) => p.id === projectId)?.name === name, `name ${name} persisted`)
  }

  h.step('Chromium order: keydown Enter while composing, then commit')
  await startEditing()
  await compose('へんこう')
  await imeKey('Enter')
  await cdp.send('Input.insertText', { text: '変更' })
  await keyUp('Enter', 13)
  await expectStillEditing('chromium enter', '変更')
  await h.shot('chromium-after-ime-enter')
  await input.press('Enter')
  await expectSaved('変更')

  h.step('Safari order: commit, then keydown Enter with keyCode 229')
  await startEditing()
  await compose('さいしょ')
  await cdp.send('Input.insertText', { text: '最初' })
  await imeKey('Enter')
  await keyUp('Enter', 13)
  await expectStillEditing('safari enter', '最初')
  await input.press('Enter')
  await expectSaved('最初')

  h.step('Escape that cancels the conversion keeps the edit open')
  await startEditing()
  await compose('とりけし')
  await imeKey('Escape')
  await compose('')
  await keyUp('Escape', 27)
  await expectStillEditing('ime escape', '')

  h.step('plain Escape still cancels, plain Enter still saves')
  await input.press('Escape')
  await expectSaved('最初')
  await startEditing()
  await input.fill('確定')
  await input.press('Enter')
  await expectSaved('確定')
  await h.shot('plain-enter-saved')
}
