import { Renderable, RGBA, type OptimizedBuffer, type RenderableOptions, type RenderContext } from "@opentui/core"
import { extend } from "@opentui/react"
import { DEFAULT_GLOW, type Rgb } from "../lib/palette"

export interface AmbientOptions extends RenderableOptions<AmbientRenderable> {
  palette?: Rgb[] | null
}

const BASE: Rgb = [12, 12, 17]
// How much each blob adds at its center, and its radius as a fraction of the width.
const STRENGTH = 0.4
const RADIUS = 0.45
// Brightness cap (sRGB luma, 0-255) so white and grey text stays readable on top.
const MAX_LUMA = 58
// Radians per second for each blob's x and y drift; different rates keep the motion from repeating.
const DRIFT: [number, number][] = [
  [0.21, 0.17],
  [0.15, 0.23],
  [0.12, 0.19],
]
const FADE_MS = 1500
// On launch the glow blooms out from the middle of the screen instead of popping in.
const BLOOM_MS = 1800
// The drift is slow, so 10 redraws a second look smooth. A `live` renderable would redraw the
// whole UI at the renderer's 30 fps and flood the terminal with tiny color changes.
const FPS = 10

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const smooth = (t: number) => t * t * (3 - 2 * t)

// A full-screen background of soft color blobs that drift slowly, like Gemini's glow.
// Each blob takes one palette color; a new palette fades in over FADE_MS.
export class AmbientRenderable extends Renderable {
  private from: Rgb[] = DEFAULT_GLOW
  private to: Rgb[] = DEFAULT_GLOW
  private changedAt = 0
  private readonly startedAt = performance.now()
  private readonly cell = RGBA.fromInts(0, 0, 0, 255)
  private readonly ticker = setInterval(() => this.requestRender(), 1000 / FPS)

  constructor(ctx: RenderContext, options: AmbientOptions) {
    super(ctx, options)
    this.ticker.unref() // never keep the process alive on its own
    if (options.palette) this.palette = options.palette
  }

  protected override destroySelf() {
    clearInterval(this.ticker)
    super.destroySelf()
  }

  set palette(next: Rgb[] | null | undefined) {
    const now = performance.now()
    this.from = this.colorsAt(now)
    this.to = next?.length ? next : DEFAULT_GLOW
    this.changedAt = now
  }

  private colorsAt(now: number): Rgb[] {
    const eased = smooth(Math.min(1, (now - this.changedAt) / FADE_MS))
    return this.to.map((color, i) => mix(this.from[i] ?? color, color, eased))
  }

  protected override renderSelf(buffer: OptimizedBuffer) {
    const width = this.width
    const height = this.height
    if (width <= 0 || height <= 0) return

    const now = performance.now()
    const seconds = (now - this.startedAt) / 1000
    // While blooming, the blobs start small, faint and in the middle, then spread out to their paths.
    const bloom = smooth(Math.min(1, (now - this.startedAt) / BLOOM_MS))
    const strength = STRENGTH * bloom
    const radius = RADIUS * (0.3 + 0.7 * bloom)
    // Cells are about twice as tall as wide; measure in width units so blobs stay round.
    const aspect = (height * 2) / width
    const blobs = this.colorsAt(now).map((color, i) => {
      const [sx, sy] = DRIFT[i % DRIFT.length]!
      return {
        color,
        x: 0.5 + 0.42 * bloom * Math.sin(seconds * sx + i * 2.1),
        y: 0.5 + 0.42 * bloom * Math.cos(seconds * sy + i * 1.3),
      }
    })
    const falloff = 1 / (radius * radius)

    // The blobs are huge, so computing every other column is indistinguishable and halves the work.
    for (let y = 0; y < height; y++) {
      const ny = (y + 0.5) / height
      for (let x = 0; x < width; x += 2) {
        const nx = (x + 1) / width
        let [r, g, b] = BASE
        for (const blob of blobs) {
          const dx = nx - blob.x
          const dy = (ny - blob.y) * aspect
          const weight = Math.exp(-(dx * dx + dy * dy) * falloff) * strength
          r += blob.color[0] * weight
          g += blob.color[1] * weight
          b += blob.color[2] * weight
        }
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const scale = luma > MAX_LUMA ? MAX_LUMA / luma : 1
        this.cell.r = (r * scale) / 255
        this.cell.g = (g * scale) / 255
        this.cell.b = (b * scale) / 255
        buffer.fillRect(this.x + x, this.y + y, Math.min(2, width - x), 1, this.cell)
      }
    }
  }
}

extend({ ambient: AmbientRenderable })

declare module "@opentui/react" {
  interface OpenTUIComponents {
    ambient: typeof AmbientRenderable
  }
}
