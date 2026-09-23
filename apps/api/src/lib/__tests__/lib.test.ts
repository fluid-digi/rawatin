import { describe, expect, it } from 'vitest'
import { formatOrderCode, base36, randomSuffix } from '../order-code'
import { sanitizeWhatsapp, waDeepLink, fillTemplate } from '../wa'

describe('order-code', () => {
  it('format kode unik dan tidak berurutan', () => {
    const a = formatOrderCode('RWT', 12)
    const b = formatOrderCode('RWT', 12)
    expect(a).toMatch(/^RWT-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    expect(a).not.toBe(b)
  })
  it('base36 pad 4 digit', () => {
    expect(base36(1)).toBe('0001')
  })
  it('suffix dari alfabet aman QR', () => {
    expect(randomSuffix(4)).toMatch(/^[A-Z2-9]{4}$/)
  })
})

describe('wa deeplink', () => {
  it('normalisasi 0 → 62', () => {
    expect(sanitizeWhatsapp('081234567890')).toBe('6281234567890')
  })
  it('tolak nomor terlalu pendek', () => {
    expect(sanitizeWhatsapp('08123')).toBeNull()
  })
  it('deeplink ter-encode', () => {
    const url = waDeepLink('6281234567890', 'Halo {name}')
    expect(url.startsWith('https://wa.me/6281234567890?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('{name}')
  })
  it('isi template variabel', () => {
    expect(fillTemplate('Halo {name}, kode {code}', { name: 'Rani', code: 'RWT-1' })).toBe('Halo Rani, kode RWT-1')
  })
})
