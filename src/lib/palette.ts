import { NativeImage } from "@opentui/core"

export type Rgb = [r: number, g: number, b: number]

export const PALETTE_SIZE = 3

// Shown when there is no cover: soft blue, violet and pink.
export const DEFAULT_GLOW: Rgb[] = [
  [66, 133, 244],
  [155, 114, 203],
  [217, 101, 112],
]

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// Picks the most prominent colors of an RGBA image. Vivid pixels count far more than dark or
// grey ones, so a mostly black cover with a red logo yields red rather than black.
export function extractPalette(data: Uint8Array, width: number, height: number, stride = width * 4): Rgb[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; score: number }>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * 4
      const [r = 0, g = 0, b = 0, a = 0] = data.subarray(i, i + 4)
      if (a < 128) continue
      const max = Math.max(r, g, b)
      const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max
      const darkness = max < 40 ? 0.1 : 1
      // 8 levels per channel, so similar shades land in the same bucket.
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, score: 0 }
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.n++
      bucket.score += (0.15 + saturation) * darkness
      buckets.set(key, bucket)
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .map((b): Rgb => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)])

  const picked: Rgb[] = []
  for (const color of ranked) {
    if (picked.every((p) => distance(p, color) > 60)) picked.push(color)
    if (picked.length === PALETTE_SIZE) break
  }
  // Covers with one or two colors still drive three blobs.
  for (let i = 0; picked.length > 0 && picked.length < PALETTE_SIZE; i++) picked.push(picked[i]!)
  return picked.map(toGlow)
}

// Normalizes a cover color into something that glows: mid lightness, and a bit more
// saturation for muted colors. Greys stay grey.
export function toGlow([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const lightness = (max + min) / 2
  const chroma = max - min
  if (chroma < 0.06) return [140, 140, 150]

  const saturation = chroma / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === r / 255) hue = ((g - b) / 255 / chroma + 6) % 6
  else if (max === g / 255) hue = (b - r) / 255 / chroma + 2
  else hue = (r - g) / 255 / chroma + 4

  return hslToRgb(hue * 60, Math.min(0.85, Math.max(0.45, saturation)), 0.55)
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - c / 2
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const cache = new Map<string, Promise<Rgb[]>>()

// Downloads a cover, shrinks it to 32x32 and extracts its glow colors. Cached per URL.
export function loadPalette(url: string): Promise<Rgb[]> {
  const cached = cache.get(url)
  if (cached) return cached

  const palette = NativeImage.load(url).then((image) => {
    const small = image.resize({ width: 32, height: 32 })
    try {
      const raw = small.raw("rgba8")
      return extractPalette(raw.data, raw.width, raw.height, raw.stride)
    } finally {
      small.dispose()
      image.dispose()
    }
  })
  palette.catch(() => cache.delete(url)) // retry next time instead of caching the failure
  if (cache.size > 200) cache.clear()
  cache.set(url, palette)
  return palette
}
