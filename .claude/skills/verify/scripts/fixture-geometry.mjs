// Single source for fixtures/pattern-page.png geometry, shared by make-fixture.mjs
// (which draws it) and drive.mjs (which taps it and derives expected numbers).
// Scale bar 400 px labelled 20 cm → 20 px/cm. Square → 20 × 20 cm. Triangle legs → 15 × 20 cm.
export const GEOMETRY = {
  width: 960,
  height: 720,
  scaleBar: { a: [100, 100], b: [500, 100], cm: 20 },
  square: [[100, 200], [500, 200], [500, 600], [100, 600]],
  triangle: [[600, 200], [900, 200], [600, 600]],
}
