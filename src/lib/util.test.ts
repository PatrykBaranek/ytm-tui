import { expect, test } from "bun:test"
import { scrollStart, shuffled } from "./util"

test("scrollStart keeps the selection centered without scrolling past either end", () => {
  expect(scrollStart(0, 10, 100)).toBe(0)
  expect(scrollStart(50, 10, 100)).toBe(45)
  expect(scrollStart(99, 10, 100)).toBe(90)
  expect(scrollStart(3, 10, 5)).toBe(0)
})

test("shuffled returns the same items without touching the input", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8]
  const result = shuffled(items)
  expect(result.toSorted()).toEqual(items)
  expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
})
