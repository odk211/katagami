# Manual layout adjustment

On the 生地・配置 step the user can place pieces one at a time from the 未配置 list, drag them on the fabric canvas, rotate the selected piece in 15° steps, and send it back to 未配置. A red banner warns when a piece sticks out of the fabric or overlaps another piece, with 裁断余白 included.

## Sub-features

- `adjust-place-one` adds one piece to the fabric by tapping its row in `未配置（N）`.
- `adjust-select` selects a piece on the canvas; `－15°`, `＋15°` and `未配置に戻す` appear.
- `adjust-rotate` rotates the selected piece by ±15°.
- `adjust-unplace` returns the selected piece to the 未配置 list.
- `adjust-drag` moves a piece by dragging it on the fabric canvas; the position persists.
- `adjust-warn-overflow` shows `・生地からはみ出しているパーツがあります`.
- `adjust-warn-overlap` shows `・生地上で重なっているパーツがあります（裁断余白込み）`.

## How to get to it (user POV)

- A 配置プロジェクト with patterns selected → `生地・配置` → enter the fabric → `反映`.
- The 未配置 list sits below the canvas. The rotate and unplace buttons appear next to `残りを自動配置` only while a piece is selected.

## Driving it with katagami-verify

Preconditions:

- Seed as in `layout-fit.md` up to `反映` with fabric 50×50 and two pieces 未配置. There is no shipped scenario; write one in the scratchpad.

- **Place one.** Click `page.getByRole('listitem').getByRole('button', { name: '前身頃' }).first()`. `生地に配置: 1 / 2 パーツ（未配置 1）`.
- **Select.** Click the piece on `.canvas-container canvas`. Fabric cm × (canvas width / fabric width cm) gives CSS px; the first piece sits near the top-left. `－15°`, `＋15°` and `未配置に戻す` appear.
- **Rotate.** Click `＋15°`. `h.readDb()` shows that piece's `placedPieces[].rotation` changed by 15.
- **Drag.** Use `page.mouse.move/down/move/up` from the piece centre to a point outside the fabric edge. The overflow banner appears and `x`/`y` change in the DB.
- **Overlap.** Place the second piece and drag it onto the first. The overlap banner appears.
- **Unplace.** Select a piece and click `未配置に戻す`. It returns to `未配置（N）` and leaves `placedPieces`.
- **Proof.** `h.shot` after each step, plus a reload of `/layouts/<id>` (go back to the 生地・配置 pill) and `h.readDb()` to prove the positions persisted.

## Gotchas

- The layout canvas has no DOM handles per piece, so taps and drags are coordinates. Compute them from the fabric size and the canvas box, never from fixed pixels.
- `残りを自動配置` is disabled when nothing is 未配置, and it never moves pieces that are already placed.
- The rotate and unplace buttons exist only while a piece is selected. Select it again after a reload.
- After a reload the page opens on 型紙選択. Click the `生地・配置` pill to see the canvas.
