// Feature: features/project-list.md — create, rename, list, delete (cancel + confirm), cascade.
export default async ({ page, h, flows }) => {
  h.step('create pattern project with a piece, then a layout that uses it')
  const patternId = await flows.patternWithSquare('削除する型紙')
  const layoutId = await flows.createLayoutProject('残る配置')
  await flows.addPatternToLayout('削除する型紙')
  await h.see('合計 1 パーツ')

  h.step('home lists both projects under their sections')
  await page.getByRole('link', { name: '← 戻る' }).click()
  await page.getByRole('heading', { name: '型紙プロジェクト', level: 2 }).waitFor()
  await page.getByRole('link', { name: /削除する型紙/ }).waitFor()
  await page.getByRole('link', { name: /残る配置/ }).waitFor()
  await h.shot('home-listed')

  const deleteButtonFor = (name) =>
    page.getByRole('link', { name: new RegExp(name) }).locator('xpath=..').getByRole('button', { name: '削除' })

  h.step('delete → キャンセル keeps the project')
  await deleteButtonFor('削除する型紙').click()
  const dialog = page.getByRole('alertdialog', { name: '「削除する型紙」を削除しますか？' })
  await dialog.waitFor()
  await h.shot('delete-dialog')
  await dialog.getByRole('button', { name: 'キャンセル' }).click()
  await dialog.waitFor({ state: 'detached' })
  await page.getByRole('link', { name: /削除する型紙/ }).waitFor()

  h.step('delete → 削除 removes it')
  await deleteButtonFor('削除する型紙').click()
  await dialog.getByRole('button', { name: '削除', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  await h.notSee('削除する型紙')
  await h.shot('pattern-deleted')

  h.step('cascade: the layout no longer references the deleted pattern')
  await page.getByRole('link', { name: /残る配置/ }).click()
  await h.see('まだ選択されていません')
  await h.shot('layout-after-cascade')
  const db = h.saveJson('db-after', await h.readDb())
  h.assert(!db.projects.some((p) => p.id === patternId), 'pattern project row deleted')
  h.assert(db.photos.every((p) => p.projectId !== patternId), 'its photos deleted')
  const layout = db.projects.find((p) => p.id === layoutId)
  h.assert(layout && layout.patternProjectIds.length === 0, 'layout patternProjectIds emptied')
}
