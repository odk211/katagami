// Single source for the fixture photos' geometry, shared by make-fixture.mjs
// (which draws them) and drive.mjs (which taps them and derives expected numbers).
// Scale bar 400 px labelled 20 cm → 20 px/cm. Square → 20 × 20 cm. Triangle legs → 15 × 20 cm.
export const GEOMETRY = {
  file: 'pattern-page.png',
  width: 960,
  height: 720,
  scaleBar: { a: [100, 100], b: [500, 100], cm: 20 },
  square: [[100, 200], [500, 200], [500, 600], [100, 600]],
  triangle: [[600, 200], [900, 200], [600, 600]],
}

// 3:4 portrait page, the iPhone camera aspect. `corners` frame the page 20 px inside the
// photo's edges, so tapping them proves the whole photo is on screen.
export const PORTRAIT = {
  file: 'pattern-page-portrait.png',
  width: 720,
  height: 960,
  scaleBar: { a: [100, 100], b: [500, 100], cm: 20 },
  square: [[100, 300], [500, 300], [500, 700], [100, 700]],
  corners: [[20, 20], [700, 20], [700, 940], [20, 940]],
}
