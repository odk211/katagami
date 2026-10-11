# Pattern capture, calibration and trace

Inside a 型紙プロジェクト the user moves through three steps: 写真 (add a photo of a pattern page), 校正 (tap both ends of an edge of known length and enter its cm), and トレース (tap outline vertices to register named pieces). Saved pieces can be edited, copied, mirror-copied, or deleted. A piece cut as 折りセンター stores half its outline; points 1–2 form the 折り線.

## Sub-features

- `trace-photo-file` adds a photo through `写真を選択` (file chooser) and jumps to 校正.
- `trace-photo-camera` adds a photo through `カメラで撮影` (`capture="environment"` input).
- `trace-calibrate` saves a calibration from two taps and a cm length.
- `trace-recalibrate` uses `校正をやり直す` → `校正を更新`, which rescales that photo's pieces.
- `trace-piece-normal` saves a piece with 3+ vertices and a name.
- `trace-piece-fold` saves a `折りセンター` piece and shows a green expansion preview.
- `trace-copy` and `trace-mirror` create `<name>（コピー）` and `<name>（反）` with an `[反]` badge.
- `trace-edit` uses `編集` → drag vertices → `変更を保存`, or `キャンセル` with a discard confirmation.
- `trace-delete` uses `選択したパーツを削除` with a confirmation. Deleting a source also deletes its mirror copies.
- `trace-multi-photo` uses `別の写真を追加`, then the photo thumbnails switch the active photo.

## How to get to it (user POV)

- Home → `型紙プロジェクトを作成`, or open an existing pattern card.
- Step pills `写真` / `校正` / `トレース` are free to click at any time.
- On the 写真 step, after a photo exists, `次へ: 校正` appears and thumbnails labelled `校正済` / `未校正` jump to トレース or 校正.
- On a calibrated photo, the 校正 step shows `次へ: トレース` and `校正をやり直す`.

## Driving it with katagami-verify

Preconditions:

- `$V doctor` is HEALTHY. The fixture is `fixtures/pattern-page.png`.

- **Photo.** Run `flows.createPatternProject('検証ブラウス')`, then `flows.addPhoto()`. The `校正` pill becomes current and the canvas shows the fixture.
- **Calibrate.** Run `flows.calibrate()`, which taps (100,100) and (500,100), enters `20`, and presses `校正を保存`. `選択点: 2 / 2` is shown before saving, then `トレース` becomes current. In the DB, `photos[].calibration.pixelsPerCm` ≈ 20.
- **Trace.** Run `flows.tracePiece('前身頃', FIXTURE.square)`. The list shows `・前身頃` and the page shows `パーツ 1 件登録済み`. The stored vertices span 20×20 cm.
- **Fold center.** Run `flows.tracePiece('後ろ身頃', FIXTURE.triangle, { foldCenter: true })`. The badge `[折]` is shown. Points 1–2, (600,200)→(900,200), are the 折り線.
- **Mirror copy.** Click `button /^・前身頃/` to select it, then `鏡像コピー`. `・前身頃（反）[反]` appears and the count rises to 2.
- **Delete.** With the copy selected, click `選択したパーツを削除`. The confirm dialog is logged and the count drops back.
- **Edit.** Click `button "前身頃を編集"`, drag a vertex with `page.mouse`, then `変更を保存`. The DB vertices change. Use `h.dismissNextDialog()` to test the cancel path.
- **Second view.** Run `h.goto('/patterns/<id>')`. The 写真 step shows the thumbnail labelled `校正済`. `h.readDb()` holds the photo at 960×720 and the pieces.
- **Proof.** `$V drive pattern-trace` covers photo, calibration, trace, mirror copy, delete, and the second view. Fold center, edit, recalibration, and camera input need a custom scenario.

## Gotchas

- Canvas taps assume the fitted view. After `＋ 拡大` or a drag-pan, press `全体表示` before `h.tapPhoto`.
- A tap within a vertex handle's radius selects that handle instead of adding a point. Keep vertices well apart.
- Background taps only register on the image or stage. A drag over 10 px pans instead of tapping.
- `パーツを保存` stays disabled until the polygon is valid and the name is non-empty. While editing, it stays disabled until something changes.
- `カメラで撮影` opens the same kind of file input with `capture`. Headless Chromium has no camera, so drive it with the file chooser too, and say the camera itself is unverified.
- Recalibrating rescales the stored cm vertices of that photo's pieces. Assert the piece size again after `校正を更新`.
- The 写真 step stays current after a reload even for calibrated projects. Navigate with the pills.
