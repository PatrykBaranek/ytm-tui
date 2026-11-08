import { expect, test } from "bun:test"
import { layoutBlocks, moveInPage, type Block } from "./page-layout"

const list = (title: string, ...items: number[]): Block => ({ title, items })

// Two columns, the left one shorter, above a full-width shelf.
const page = layoutBlocks([[list("Left", 0, 1), list("Right", 2, 3, 4)], [list("Below", 5, 6)]], 43)
const at = (item: number) => page.cells.find((cell) => cell.item === item)!

test("blocks sit side by side in equal columns, with a blank line under each row", () => {
  expect(at(0)).toEqual({ item: 0, x: 0, y: 1, width: 20, section: 0 })
  expect(at(2)).toEqual({ item: 2, x: 23, y: 1, width: 20, section: 1 })
  expect(at(5)).toEqual({ item: 5, x: 0, y: 6, width: 43, section: 2 })
  expect(page.headings.map(({ text, x, y }) => [text, x, y])).toEqual([
    ["Left", 0, 0],
    ["Right", 23, 0],
    ["Below", 0, 5],
  ])
  expect(page.height).toBe(8)
})

test("down leaves a short column for what is under it, not the column beside it", () => {
  expect(moveInPage(page.cells, 0, "down")).toBe(1)
  expect(moveInPage(page.cells, 1, "down")).toBe(5)
  expect(moveInPage(page.cells, 4, "down")).toBe(5)
  expect(moveInPage(page.cells, 6, "down")).toBe(6)
})

test("up comes back to the nearest row above", () => {
  expect(moveInPage(page.cells, 5, "up")).toBe(4)
  expect(moveInPage(page.cells, 1, "up")).toBe(0)
  expect(moveInPage(page.cells, 0, "up")).toBe(0)
})

test("left and right go across, then to the first row of the next section", () => {
  expect(moveInPage(page.cells, 1, "right")).toBe(3)
  expect(moveInPage(page.cells, 3, "left")).toBe(1)
  // Nothing beside it, so the section after it.
  expect(moveInPage(page.cells, 4, "right")).toBe(5)
  expect(moveInPage(page.cells, 6, "left")).toBe(2)
  expect(moveInPage(page.cells, 0, "left")).toBe(0)
  expect(moveInPage(page.cells, 5, "right")).toBe(5)
})

test("an unknown row moves to the first one", () => {
  expect(moveInPage(page.cells, 99, "down")).toBe(0)
  expect(moveInPage([], 3, "down")).toBe(3)
})
