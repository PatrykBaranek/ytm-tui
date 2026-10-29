import { afterAll, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Track } from "./music"
import { FileSessionStore, type SavedSession } from "./store"

const dir = mkdtempSync(join(tmpdir(), "ytm-store-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const song: Track = { id: "s1", title: "Song", artists: "Artist", album: "Album", duration: 180, cover: "" }
const session: SavedSession = {
  volume: 55,
  autoplay: false,
  current: song,
  queue: [song],
  history: [],
  searches: ["daft punk", "dream on"],
}

test("a flushed session is there on the next start, in a folder created for it", () => {
  const path = join(dir, "nested", "ytm-tui", "session.json")
  const store = new FileSessionStore(path)
  expect(store.saved).toBeNull()
  store.save(session)
  store.flush()
  expect(new FileSessionStore(path).saved).toEqual(session)
})

test("an unreadable or foreign file starts fresh, and bad tracks are dropped", () => {
  const path = join(dir, "broken", "session.json")
  mkdirSync(join(dir, "broken"))
  writeFileSync(path, "{ not json")
  expect(new FileSessionStore(path).saved).toBeNull()

  writeFileSync(path, JSON.stringify({ version: 2, volume: 10 }))
  expect(new FileSessionStore(path).saved).toBeNull()

  writeFileSync(
    path,
    JSON.stringify({ version: 1, volume: 300, queue: [song, { id: 1 }], current: "x", searches: ["ok", 3] }),
  )
  expect(new FileSessionStore(path).saved).toEqual({
    volume: 100,
    autoplay: true,
    current: null,
    queue: [song],
    history: [],
    searches: ["ok"],
  })
})
