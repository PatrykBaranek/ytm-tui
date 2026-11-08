import { expect, test } from "bun:test"
import { fit, formatTime, progressBar, wrap } from "./format"

test("formatTime", () => {
  expect(formatTime(0)).toBe("0:00")
  expect(formatTime(65.9)).toBe("1:05")
  expect(formatTime(3707)).toBe("1:01:47")
  expect(formatTime(Number.NaN)).toBe("0:00")
})

test("fit pads and truncates to terminal columns", () => {
  expect(fit("abc", 5)).toBe("abc  ")
  expect(fit("abcdef", 4)).toBe("abc…")
  // Each of these characters is two columns wide.
  expect(fit("日本語の曲", 6)).toBe("日本… ")
  expect(Bun.stringWidth(fit("日本語の曲", 6))).toBe(6)
  expect(fit("anything", 0)).toBe("")
})

test("progressBar", () => {
  expect(progressBar(5, 10, 10)).toBe("━━━━━─────")
  expect(progressBar(0, 0, 4)).toBe("────")
  expect(progressBar(99, 10, 4)).toBe("━━━━")
})

test("wrap breaks at spaces and marks text that doesn't fit", () => {
  expect(wrap("one two three four", 9, 3)).toEqual(["one two", "three", "four"])
  expect(wrap("one two three four five six", 9, 2)).toEqual(["one two", "three fo…"])
  expect(wrap("  spaced   out  ", 20, 2)).toEqual(["spaced out"])
  expect(wrap("unbreakableword next", 5, 2)).toEqual(["unbr…", "next"])
  expect(wrap("", 10, 2)).toEqual([])
  expect(wrap("anything", 0, 2)).toEqual([])
})
