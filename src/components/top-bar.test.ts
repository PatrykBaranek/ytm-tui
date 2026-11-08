import { expect, test } from "bun:test"
import { tabStrip } from "./top-bar"

const tabs = ["For you", "New", "Trending"]

test("every tab shows when they fit, with the underline under the open one", () => {
  expect(tabStrip(tabs, "For you", 40)).toMatchObject({ shown: tabs, underlineAt: 0, underlineWidth: 7 })
  expect(tabStrip(tabs, "Trending", 40)).toMatchObject({ shown: tabs, underlineAt: 16, underlineWidth: 8 })
})

test("when they don't fit, only the open tab shows, between arrows", () => {
  expect(tabStrip(tabs, "New", 10)).toMatchObject({ start: "‹ ", shown: ["New"], end: " ›", underlineAt: 2, underlineWidth: 3 })
})

test("a tab too long for even that is cut to fit", () => {
  const { shown, underlineWidth } = tabStrip(tabs, "Trending", 8)
  expect(shown).toEqual(["Tre…"])
  expect(underlineWidth).toBe(4)
})
