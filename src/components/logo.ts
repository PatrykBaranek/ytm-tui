import { Renderable, RGBA, type OptimizedBuffer, type RenderableOptions, type RenderContext } from "@opentui/core"
import { extend } from "@opentui/react"
import type { Rgb } from "../lib/palette"

export interface LogoOptions extends RenderableOptions<LogoRenderable> {
  compact?: boolean
  leaving?: boolean
}

// "ytm-tui" in figlet's ANSI Shadow style: full blocks for the letters, box-drawing lines for their shadow.
const BIG = [
  "██╗   ██╗████████╗███╗   ███╗      ████████╗██╗   ██╗██╗",
  "╚██╗ ██╔╝╚══██╔══╝████╗ ████║      ╚══██╔══╝██║   ██║██║",
  " ╚████╔╝    ██║   ██╔████╔██║█████╗   ██║   ██║   ██║██║",
  "  ╚██╔╝     ██║   ██║╚██╔╝██║╚════╝   ██║   ██║   ██║██║",
  "   ██║      ██║   ██║ ╚═╝ ██║         ██║   ╚██████╔╝██║",
  "   ╚═╝      ╚═╝   ╚═╝     ╚═╝         ╚═╝    ╚═════╝ ╚═╝",
]
const COMPACT = ["y t m - t u i"]

// Left to right: the accent pink, then the default glow's violet and blue.
const GRADIENT: Rgb[] = [
  [247, 118, 142],
  [178, 132, 232],
  [96, 156, 255],
]
const WHITE: Rgb = [255, 255, 255]
// How much of the letter color the shadow lines keep.
const SHADOW = 0.5
// The logo appears left to right behind a bright edge, then a glint passes over it now and then.
const REVEAL_DELAY_MS = 150
const REVEAL_MS = 800
const GLINT_SWEEP_MS = 900
const GLINT_EVERY_MS = 2200
const GLINT_WIDTH = 0.08
export const LOGO_FADE_MS = 250
// Unlike the ambient glow, the reveal moves fast enough to need the renderer's full 30 fps.
// The splash only lasts a second or two.
const FPS = 30

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

function gradientAt(t: number): Rgb {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (GRADIENT.length - 1)
  const i = Math.floor(scaled)
  return mix(GRADIENT[i]!, GRADIENT[i + 1]!, scaled - i)
}

// The splash screen's animated logo. Draws only the letters, so the ambient glow shows around them.
export class LogoRenderable extends Renderable {
  private readonly lines: string[][]
  private readonly startedAt = performance.now()
  private leftAt = 0
  private readonly fg = RGBA.fromInts(0, 0, 0, 255)
  private readonly clear = RGBA.fromInts(0, 0, 0, 0)
  private readonly ticker = setInterval(() => this.requestRender(), 1000 / FPS)

  constructor(ctx: RenderContext, options: LogoOptions) {
    const lines = (options.compact ? COMPACT : BIG).map((line) => [...line])
    super(ctx, { ...options, width: lines[0]!.length, height: lines.length })
    this.lines = lines
    this.ticker.unref() // never keep the process alive on its own
    if (options.leaving) this.leaving = true
  }

  protected override destroySelf() {
    clearInterval(this.ticker)
    super.destroySelf()
  }

  // Fades the logo out over LOGO_FADE_MS.
  set leaving(value: boolean | undefined) {
    if (value && !this.leftAt) this.leftAt = performance.now()
  }

  protected override renderSelf(buffer: OptimizedBuffer) {
    const now = performance.now()
    const elapsed = now - this.startedAt
    const columns = this.lines[0]!.length
    // The reveal edge runs a little past both ends so the first and last columns ease in too.
    const edge = -0.1 + 1.2 * ((elapsed - REVEAL_DELAY_MS) / REVEAL_MS)
    const sinceReveal = elapsed - REVEAL_DELAY_MS - REVEAL_MS
    const glint = sinceReveal < 0 ? edge : -0.2 + 1.4 * ((sinceReveal % GLINT_EVERY_MS) / GLINT_SWEEP_MS)
    const fade = this.leftAt ? 1 - Math.min(1, (now - this.leftAt) / LOGO_FADE_MS) : 1

    this.lines.forEach((line, y) => {
      line.forEach((char, x) => {
        if (char === " ") return
        const nx = columns > 1 ? x / (columns - 1) : 0
        const shown = smooth((edge - nx) / 0.06) * fade
        if (shown <= 0) return
        const base = gradientAt(nx)
        const color = mix(char === "█" ? base : mix([0, 0, 0], base, SHADOW), WHITE, 0.7 * Math.exp(-(((nx - glint) / GLINT_WIDTH) ** 2)))
        this.fg.r = color[0] / 255
        this.fg.g = color[1] / 255
        this.fg.b = color[2] / 255
        this.fg.a = shown
        buffer.setCellWithAlphaBlending(this.x + x, this.y + y, char, this.fg, this.clear)
      })
    })
  }
}

extend({ logo: LogoRenderable })

declare module "@opentui/react" {
  interface OpenTUIComponents {
    logo: typeof LogoRenderable
  }
}
