import { expect, test } from "bun:test"
import { extractPalette, toGlow, type Rgb } from "./palette"

// Builds a width x height RGBA image from horizontal bands of [color, rows].
function image(width: number, bands: [Rgb, number][]) {
  const rows = bands.flatMap(([color, n]) => Array<Rgb>(n).fill(color))
  const data = new Uint8Array(width * rows.length * 4)
  rows.forEach(([r, g, b], y) => {
    for (let x = 0; x < width; x++) data.set([r, g, b, 255], (y * width + x) * 4)
  })
  return { data, width, height: rows.length }
}

const hue = ([r, g, b]: Rgb) => (r >= g && r >= b ? "red" : g >= b ? "green" : "blue")

test("vivid colors beat a mostly black cover", () => {
  const { data, width, height } = image(8, [
    [[5, 5, 5], 20],
    [[200, 30, 40], 3],
    [[30, 60, 210], 2],
  ])
  const palette = extractPalette(data, width, height)
  expect(palette).toHaveLength(3)
  expect(palette.slice(0, 2).map(hue)).toEqual(["red", "blue"])
})

test("a single-color cover still yields three blobs", () => {
  const { data, width, height } = image(4, [[[40, 180, 90], 4]])
  const palette = extractPalette(data, width, height)
  expect(palette).toHaveLength(3)
  expect(new Set(palette.map(hue))).toEqual(new Set(["green"]))
})

test("transparent images give no palette", () => {
  expect(extractPalette(new Uint8Array(16 * 4), 4, 4)).toEqual([])
})

test("toGlow keeps hue, lifts dark colors and leaves greys grey", () => {
  const glow = toGlow([60, 10, 15])
  expect(hue(glow)).toBe("red")
  expect(Math.max(...glow)).toBeGreaterThan(150)
  expect(toGlow([30, 30, 32])).toEqual([140, 140, 150])
})
