# Backup import and export

The home screen's `バックアップ` section writes every project, photo, and piece to one JSON file and reads such a file back. Import asks for confirmation, overwrites projects with the same ID, and replaces the photos and pieces of each 型紙プロジェクト in the file. Importing the same file twice leaves the same data as importing it once. A file that is not a valid backup is rejected with a message and changes nothing.

## Sub-features

- `backup-export` downloads `katagami-YYYYMMDD-HHmm.json` (local time) with format `katagami-backup`, version 1, and all three tables, photo image data included.
- `backup-export-disabled` disables `エクスポート` while there are no projects.
- `backup-import-confirm` opens an `alertdialog` named `バックアップを読み込みますか？` that states `型紙プロジェクト N件・配置プロジェクト M件` and that same-ID projects are overwritten. `読み込む` imports, reloads both lists, and shows `読み込みました` in `role="status"`.
- `backup-import-idempotent` leaves the same rows when the same file is imported again.
- `backup-import-failed` closes the dialog, keeps both lists, and shows `読み込みに失敗しました。端末の空き容量を確認して、もう一度お試しください。` in `role="alert"` when the IndexedDB write fails (for example a full disk). The transaction rolls back, so no rows change.
- `backup-import-reject` shows the reason in `role="alert"` for a file that is not JSON, not a backup, an unsupported version, a malformed record, or a photo or piece whose parent is missing from the file. No dialog opens.

## How to get to it (user POV)

- Open `/` and scroll below 配置プロジェクト to the `バックアップ` heading.
- `エクスポート` starts a download. `インポート` opens the file picker, filtered to JSON.
- After choosing a valid file, the confirmation dialog appears at the bottom of the screen. `キャンセル` closes it without importing.

## Driving it with katagami-verify

Preconditions:

- `$V doctor` is HEALTHY. The drive starts with an empty profile.

- **Seed.** Run `flows.patternWithSquare('バックアップ元', '前身頃')`, then a layout project with that pattern on 50×50 cm fabric, `反映`, and `残りを自動配置` (same steps as `scenarios/layout-fit.mjs`).
- **Export.** On `/`, start `page.waitForEvent('download')`, click `button "エクスポート"`, and `download.saveAs(h.evidencePath('backup.json'))`. `suggestedFilename()` matches `katagami-\d{8}-\d{4}.json`.
- **Delete.** Delete both projects with the card `削除` and the `alertdialog`'s `削除`. `エクスポート` is now disabled.
- **Import.** Start `page.waitForEvent('filechooser')`, click `button "インポート"`, and `setFiles` the saved file. The dialog shows `型紙プロジェクト 1件・配置プロジェクト 1件`. Click `読み込む`, wait for the dialog to detach, and wait for `読み込みました` in `getByRole('status')`.
- **Second view.** `h.readDb()` rows sorted by id equal the dump taken before export. The layout's `結果をスキップ表示` shows `生地は足ります`, `16.0%`, and `50 × 50 cm`.
- **Again.** Import the same file again. The rows are unchanged.
- **Reject.** Write `{"hello":"world"}` to `h.evidencePath('not-a-backup.json')` and import it. `role="alert"` reads `型紙チェックのバックアップファイルではありません。` and the DB is unchanged.
- **Proof.** `$V drive import-export`. Evidence: `01-home-before-export`, `02-home-emptied`, `03-import-1-dialog`, `04-home-restored`, `05-restored-report`, `06-import-2-dialog`, `07-import-rejected`, `08-import-failed`, `backup.json`, `db-before-export.json`, `db-after-import-1.json`, `db-after-import-2.json`, `db-after-failed-import.json`.

## Gotchas

- Start `waitForEvent('download')` or `waitForEvent('filechooser')` before the click, or the event is missed.
- The file input resets after each pick, so the same path can be chosen twice in a row.
- `h.readDb()` truncates `imageDataUrl`, so a row comparison does not prove the image bytes survived. `backup.json` holds the full data URL.
- Import does not delete projects missing from the file. To prove a restore, delete them through the UI first.
- A layout's `patternProjectIds` may name patterns absent from the file. Import accepts that, and the layout page prunes them on open.
- The import dialog reuses the delete `alertdialog`, so its confirm button is red. Its label is `読み込み中…` while running. Wait for the dialog to detach, not for the label.
- The import failure path can't be reached with a real file, so the scenario drives it by fault injection. Dexie's `bulkPut` calls `IDBObjectStore.prototype.put`, so patching `put` in the page makes the import transaction fail and roll back.
