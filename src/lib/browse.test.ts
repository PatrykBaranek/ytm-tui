import { expect, test } from "bun:test"
import type { BrowseItem, Category, Explore, PlaylistInfo, Track } from "../services/music"
import {
  chooseSubject,
  firstSongRow,
  homeItems,
  homeTabs,
  itemKey,
  pageLayout,
  previewOf,
  searchItems,
  switchTab,
  withRecent,
} from "./browse"

const song = (id: string): Track => ({ id, title: `Song ${id}`, artists: "A", album: "B", duration: 60, cover: "" })
const album = (id: string): PlaylistInfo => ({ id, title: `Album ${id}`, subtitle: "2013", cover: `${id}.jpg` })
const mood: Category = { id: "chill", title: "Chill", group: "Moods" }
const songs = (n: number) => Array.from({ length: n }, (_, i) => song(`s${i}`))
const sectionsOf = (items: BrowseItem[]) => [...new Set(items.map((item) => item.section))]
const featured = (parts: Partial<Explore> = {}): Explore => ({ quickPicks: [], albums: [], trending: [], ...parts })

test("home's tabs come in a fixed order, and empty ones are left out", () => {
  const items = homeItems(songs(2), featured({ quickPicks: [song("q")], trending: songs(1) }), [mood])
  expect(homeTabs(items)).toEqual(["Recent", "Moods", "For you", "Trending"])
})

test("withRecent replaces only the Recent tab, which stays first", () => {
  const items = homeItems(songs(1), featured({ albums: [album("a")] }), [mood])
  const next = withRecent(items, [song("new"), song("s0")])
  expect(next.map(itemKey)).toEqual(["Recent:new", "Recent:s0", "Moods:chill", "New:a"])
})

test("the same song on two tabs has two keys", () => {
  const items = homeItems([song("x")], featured({ trending: [song("x")] }), [])
  expect(new Set(items.map(itemKey)).size).toBe(2)
})

test("switching tabs lands on the next tab's first row, and stops at the ends", () => {
  // The rows: chill s0 s1 s2 a
  const items = homeItems([], featured({ quickPicks: songs(3), albums: [album("a")] }), [mood])
  expect(switchTab(items, 0, 1)).toBe(1)
  expect(switchTab(items, 2, 1)).toBe(4)
  expect(switchTab(items, 4, -1)).toBe(1)
  expect(switchTab(items, 4, 1)).toBe(4)
  expect(switchTab(items, 0, -1)).toBe(0)
})

test("search lists a few artists and albums above every song, and starts on the songs", () => {
  const artists = [1, 2, 3, 4].map((n) => ({ id: `UC${n}`, name: `Artist ${n}`, subtitle: "", cover: "" }))
  const items = searchItems({ songs: songs(5), artists, albums: [album("a")] })
  expect(sectionsOf(items)).toEqual(["Artists", "Albums", "Songs"])
  expect(items.filter((item) => item.section === "Artists")).toHaveLength(3)
  expect(items.filter((item) => item.section === "Songs")).toHaveLength(5)
  expect(firstSongRow(items)).toBe(4)
  expect(firstSongRow(searchItems({ songs: [], artists, albums: [] }))).toBe(0)
})

test("home lays out only the open tab, as one list with no headings", () => {
  const items = homeItems([], featured({ quickPicks: songs(2), albums: [album("a")] }), [])
  const first = pageLayout({ kind: "home", items, selected: 1 }, 50)
  expect(first.cells.map(({ item, y }) => [item, y])).toEqual([
    [0, 0],
    [1, 1],
  ])
  expect(first.headings).toEqual([])
  expect(first.height).toBe(2)
  expect(pageLayout({ kind: "home", items, selected: 2 }, 50).cells.map((cell) => cell.item)).toEqual([2])
})

test("search always gives songs the full width, even with only one other group", () => {
  const items = searchItems({ songs: songs(1), artists: [], albums: [album("a")] })
  const { cells } = pageLayout({ kind: "search", items, selected: 0 }, 100)
  expect(cells.map((cell) => cell.width)).toEqual([100, 100])
  expect(cells[1]!.y).toBeGreaterThan(cells[0]!.y)
})

test("narrow pages stack every block", () => {
  const artists = [{ id: "UC1", name: "Artist", subtitle: "", cover: "" }]
  const items = searchItems({ songs: [], artists, albums: [album("a")] })
  const { cells } = pageLayout({ kind: "search", items, selected: 0 }, 50)
  expect(cells.map((cell) => cell.x)).toEqual([0, 0])
})

test("the subject is a row with a cover, or else what is playing", () => {
  const playing = previewOf(song("p"))
  const albumRow: BrowseItem = { section: "Albums", album: album("a") }
  expect(chooseSubject(previewOf(albumRow), playing)?.title).toBe("Album a")
  const moodRow: BrowseItem = { section: "Moods", category: mood }
  expect(previewOf(moodRow)).toEqual({ title: "Chill", subtitle: "Moods", cover: "" })
  expect(chooseSubject(previewOf(moodRow), playing)?.title).toBe("Song p")
  // A coverless row gives way to the song playing, but still shows when nothing is.
  const coverless: BrowseItem = { section: "Songs", track: song("c") }
  expect(chooseSubject(previewOf(coverless), playing)?.title).toBe("Song p")
  expect(chooseSubject(previewOf(coverless), undefined)?.title).toBe("Song c")
})
