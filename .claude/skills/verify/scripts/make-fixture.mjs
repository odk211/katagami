// Generates the fixture photos (fake 型紙 pages) in fixtures/ from fixture-geometry.mjs.
// Usage: node scripts/make-fixture.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { GEOMETRY, PORTRAIT } from './fixture-geometry.mjs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function drawPng(G) {
  const W = G.width
  const H = G.height
  const px = Buffer.alloc(W * H * 3, 0xf5)

  function dot(x, y, rgb, r) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.round(x + dx)
        const yy = Math.round(y + dy)
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const i = (yy * W + xx) * 3
        px[i] = rgb[0]
        px[i + 1] = rgb[1]
        px[i + 2] = rgb[2]
      }
  }

  function line([x0, y0], [x1, y1], rgb, r = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let s = 0; s <= n; s++) dot(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, rgb, r)
  }

  function poly(points, rgb) {
    points.forEach((p, i) => line(p, points[(i + 1) % points.length], rgb))
    points.forEach(([x, y]) => dot(x, y, [220, 38, 38], 5))
  }

  const ink = [40, 40, 40]
  const blue = [37, 99, 235]
  const [ax, ay] = G.scaleBar.a
  const [bx, by] = G.scaleBar.b
  line(G.scaleBar.a, G.scaleBar.b, blue, 3)
  line([ax, ay - 15], [ax, ay + 15], blue, 2)
  line([bx, by - 15], [bx, by + 15], blue, 2)
  for (const shape of [G.square, G.triangle, G.corners]) if (shape) poly(shape, ink)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const here = path.dirname(fileURLToPath(import.meta.url))
for (const G of [GEOMETRY, PORTRAIT]) {
  const out = path.join(here, '..', 'fixtures', G.file)
  writeFileSync(out, drawPng(G))
  console.log(`wrote ${out} (${G.width}x${G.height})`)
}
