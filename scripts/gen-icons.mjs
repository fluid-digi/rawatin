// Generate PWA icons (192 & 512) sebagai PNG — tanpa dependency rasterizer.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const px = Buffer.alloc((size * size + size) * 4) // scanline + filter bytes
  const lerp = (a, b, t) => Math.round(a + (b - a) * t)
  const inRoundRect = (x, y, r) => {
    if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if (x >= size - r && y < r) return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r
    if (x < r && y >= size - r) return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r
    if (x >= size - r && y >= size - r) return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r
    return true
  }
  const shield = (x, y) => {
    // perkiraan bentuk perisai
    const nx = x / size
    const ny = y / size
    const top = Math.abs(nx - 0.5) < 0.5 && ny > 0.2
    const widthAt = Math.sin(Math.PI * Math.max(0, Math.min(1, ny))) * 0.32
    return top && ny < 0.86 && Math.abs(nx - 0.5) <= widthAt
  }
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 4)
    px[row] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4
      const inside = inRoundRect(x, y, size * 0.22)
      if (!inside) {
        px[i] = 0
        px[i + 1] = 0
        px[i + 2] = 0
        px[i + 3] = 0
        continue
      }
      const t = y / size
      if (shield(x, y)) {
        // check mark putih
        const u = x / size - 0.36
        const v = y / size - 0.42
        const onStroke = (Math.abs(v - u) < 0.05 && u > 0 && u < 0.12) || (Math.abs(v + u - 0.26) < 0.05 && u > 0.1 && u < 0.24 && v < 0.16)
        if (onStroke) {
          px[i] = 255
          px[i + 1] = 255
          px[i + 2] = 255
          px[i + 3] = 255
          continue
        }
        px[i] = lerp(0x0f, 0x2d, t)
        px[i + 1] = lerp(0x76, 0x74, t)
        px[i + 2] = lerp(0x6e, 0x60, t)
        px[i + 3] = 255
      } else {
        // background gradien teal
        px[i] = lerp(0x0f, 0x134e, t)
        px[i + 1] = lerp(0x76, 0x4a, t)
        px[i + 2] = lerp(0x6e, 0x5e, t)
        px[i + 3] = 255
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(px, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = join(process.cwd(), 'apps', 'web', 'public')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'pwa-192.png'), png(192))
writeFileSync(join(out, 'pwa-512.png'), png(512))
console.log('ikon PWA dibuat: pwa-192.png, pwa-512.png')
