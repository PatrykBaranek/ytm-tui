import { expect, test } from "bun:test"
import { spotlightSize } from "./home-page"

test("the spotlight is square on screen, and takes about two fifths of the width", () => {
  expect(spotlightSize(118, 34)).toEqual({ width: 46, cover: 23 })
})

test("a short terminal limits the cover by its height", () => {
  expect(spotlightSize(118, 18)).toEqual({ width: 28, cover: 14 })
})

test("small terminals leave the room to the list", () => {
  expect(spotlightSize(63, 30)).toEqual({ width: 0, cover: 0 })
  expect(spotlightSize(118, 11)).toEqual({ width: 0, cover: 0 })
})
