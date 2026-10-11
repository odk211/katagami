# Layout fit check

Inside a 配置プロジェクト the user picks one or more 型紙プロジェクト (the same one can be picked more than once, which adds another set), enters the fabric size and 裁断余白, auto-places the pieces, and reads a report. The report shows whether the fabric is enough (`生地は足ります` / `生地が足りません`), the 使用率, the fabric size, the reasons it fails, an estimate of the extra width or height needed, and a drawing of the layout.

## Sub-features

- `fit-select` uses `追加` per pattern card; the total updates as `合計 N パーツ`.
- `fit-select-remove` uses `削除` on a selected row, which also clears the existing layout.
- `fit-fabric` uses `幅（cm）`, `高さ（cm）` and `裁断余白（cm）` (default 1), then `反映`.
- `fit-autonest` uses `残りを自動配置`, which places every unplaced piece without moving placed ones.
- `fit-report-ok` shows `生地は足ります` and the 使用率.
- `fit-report-short` shows `生地が足りません`, the reasons, and `不足量の目安` (`幅を約 +X cm 拡大` / `高さを約 +Y cm 拡大`).
- `fit-skip` uses `結果をスキップ表示` to jump to the report once a layout exists.

## How to get to it (user POV)

- Home → `配置プロジェクトを作成`, or open an existing layout card.
- Step pills `型紙選択` / `生地・配置` / `結果`. `次へ: 生地・配置` is enabled once there is at least one piece, and `結果を確認` sits under the canvas.
- `結果をスキップ表示` sits at the bottom of the 型紙選択 and 生地・配置 steps once a fabric and a layout exist.

## Driving it with katagami-verify

Preconditions:

- `$V doctor` is HEALTHY. A pattern with pieces is seeded through `flows.patternWithSquare('検証パターン', '前身頃')` (one 20×20 cm piece).

- **Select twice.** Run `flows.createLayoutProject('検証配置')`, then `flows.addPatternToLayout('検証パターン')` twice. The page shows `合計 2 パーツ` and two rows.
- **Fabric.** Click `次へ: 生地・配置` and fill the spinbuttons with `50`, `50` and `1`, then click `反映`. `未配置（2）` lists two `前身頃`.
- **Auto place.** Click `残りを自動配置`. The page shows `生地に配置: 2 / 2 パーツ` and no overflow or overlap warning.
- **Fits.** Click `結果を確認`. The report shows `生地は足ります`, `32.0%` and `50 × 50 cm`.
- **Shortage.** Click the `生地・配置` pill, set 30 × 30, `反映`, then `結果を確認`. The report shows `生地が足りません`, `・パーツが生地からはみ出しています`, and `不足量の目安` with `+12.1 cm` for both width and height.
- **Second view.** Run `h.goto('/layouts/<id>')` and `h.readDb()`. The project has `patternProjectIds.length === 2`, fabric 30×30, and 2 `placedPieces`.
- **Proof.** `$V drive layout-fit`. Evidence: `01-patterns-selected` … `06-report-shortage`, `db-after.json`.

## Gotchas

- On 2026-10-11, `残りを自動配置` placed only 1 of 2 pieces once in about 12 runs: `生地に配置: 1 / 2`, with the button enabled again. It did not reproduce on immediate reruns or cold restarts. If it shows up, keep that run's evidence and report it as a possible app bug. Don't rerun until it passes.
- `反映` is disabled when the inputs equal the applied fabric. Change a value before expecting it to enable.
- Shrinking the fabric keeps existing placements. An overflowing piece is left out of the 配置図 drawing, and 使用率 counts only the pieces fully on the fabric (44.4% for one 400 cm² piece on 30×30).
- Removing a selected pattern (`削除` on its row) sets `layout` to null. The next visit to 生地・配置 starts with everything 未配置.
- Pattern card names are not unique. Rename the seeded pattern project before using `addPatternToLayout`.
- Expanded pieces of the same pattern share a name. The legend tells sets apart as `<pattern> (1)` and `<pattern> (2)`.
