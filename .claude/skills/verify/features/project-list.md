# Project list

The home screen lists 型紙プロジェクト and 配置プロジェクト in two sections. The user creates either kind, opens one, renames it from its page header, and deletes it through a confirmation dialog. Deleting a 型紙プロジェクト also removes its photos and pieces and drops it from every 配置プロジェクト that used it.

## Sub-features

- `list-create-pattern` creates a 型紙プロジェクト named `型紙 <date>` and opens `/patterns/<id>`.
- `list-create-layout` creates a 配置プロジェクト named `配置 <date>` and opens `/layouts/<id>`.
- `list-rename` renames a project from its page header; the list shows the new name.
- `list-delete-cancel` closes the confirmation with キャンセル and keeps the project.
- `list-delete-confirm` deletes the project after confirmation.
- `list-delete-cascade` removes a deleted pattern from the layouts that referenced it.
- `list-empty` shows `型紙プロジェクトはまだありません` / `配置プロジェクトはまだありません`.

## How to get to it (user POV)

- Open `/`. Buttons `型紙プロジェクトを作成` and `配置プロジェクトを作成` sit under their section headings.
- Each project card is a link to its page, with a `削除` button beside it.
- `← 戻る` in the header returns home from a project page.
- On a project page, the pencil heading (`button "型紙プロジェクト名を編集"` / `"配置プロジェクト名を編集"`) opens the name editor. Enter saves, Escape cancels, and blur saves.

## Driving it with katagami-verify

Preconditions:

- `$V doctor` is HEALTHY. The drive starts with an empty profile.

- **Empty state.** Run `h.goto('/')` then `h.see('型紙プロジェクトはまだありません')`. Both empty messages are visible.
- **Create and rename.** Run `flows.createPatternProject('削除する型紙')`. The URL matches `/patterns/<id>`, the `写真` step is current, and the heading reads `型紙: 削除する型紙`.
- **Layout referencing it.** Run `flows.patternWithSquare(...)`, `flows.createLayoutProject('残る配置')` and `flows.addPatternToLayout('削除する型紙')`. The page shows `合計 1 パーツ`.
- **Listed.** Click `link "← 戻る"`. Both cards are visible as links named after the projects.
- **Delete, then cancel.** Click the `削除` beside the card (`link → xpath=.. → button "削除"`). An `alertdialog` named `「削除する型紙」を削除しますか？` appears. Click its `キャンセル`. The dialog detaches and the card remains.
- **Delete, then confirm.** Repeat and click the dialog's `削除` (exact). The card is gone.
- **Cascade.** Open `残る配置`. It shows `まだ選択されていません`. `h.readDb()` shows no pattern row and no photos for it, and the layout's `patternProjectIds` is empty.
- **Proof.** `$V drive project-list`. Evidence: `01-home-listed`, `02-delete-dialog`, `03-pattern-deleted`, `04-layout-after-cascade`, `db-after.json`.

## Gotchas

- Default names include only the date, so two projects created on the same day share a name. Rename before you locate a card by text.
- There are two `削除` buttons in play once the dialog is open (the card's and the dialog's). Scope to the `alertdialog`.
- The dialog's confirm label changes to `削除中…` while deleting. Wait for the dialog to detach, not for the label.
- `/projects/<id>` is a legacy route that redirects to `/`. Don't mistake it for a failure.
