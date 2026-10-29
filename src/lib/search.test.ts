import { expect, test } from "bun:test"
import { rememberSearch, suggestionRows } from "./search"

const history = ["Daft Punk", "dream on", "punk rock", "jazz", "punk covers", "old punk"]

test("an empty box lists recent searches", () => {
  expect(suggestionRows("  ", history, ["ignored"]).map((r) => r.text)).toEqual(history)
  expect(suggestionRows("", history, []).every((r) => r.recent)).toBe(true)
})

test("while typing, up to three matching recent searches come before suggestions, without repeats", () => {
  const rows = suggestionRows("punk", history, ["daft punk", "punk 2026", "punk"])
  expect(rows).toEqual([
    { text: "Daft Punk", recent: true },
    { text: "punk rock", recent: true },
    { text: "punk covers", recent: true },
    { text: "punk 2026", recent: false },
    { text: "punk", recent: false },
  ])
})

test("remembering a search moves it to the front once and caps the history", () => {
  expect(rememberSearch(history, "DREAM ON")).toEqual(["DREAM ON", "Daft Punk", "punk rock", "jazz", "punk covers", "old punk"])
  const long = Array.from({ length: 25 }, (_, i) => `q${i}`)
  expect(rememberSearch(long, "new")).toHaveLength(20)
})
