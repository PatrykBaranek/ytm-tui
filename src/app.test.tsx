import { expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import { App, coverFor } from "./app"
import type { ArtistPage, Category, MusicSource, PlaylistInfo, Track } from "./services/music"
import type { Player, PlayerState } from "./services/player"
import type { SavedSession, SessionStore } from "./services/store"

const track = (id: string, title: string): Track => ({
  id,
  title,
  artists: "Test Artist",
  album: "Test Album",
  duration: 200,
  cover: "",
})

const searchResults = [track("a1", "Morning Static"), track("a2", "Paper Lanterns"), track("a3", "Slow Orbit")]
const radioResults = [track("a1", "Morning Static"), track("r1", "Radio Pick One"), track("r2", "Radio Pick Two")]

const categories: Category[] = [
  { id: "chill", title: "Chill", group: "Moods & moments" },
  { id: "focus", title: "Focus", group: "Moods & moments" },
  { id: "rock", title: "Rock", group: "Genres" },
]
const rockPlaylists: PlaylistInfo[] = [
  { id: "pl-classics", title: "Rock Classics", subtitle: "Band One, Band Two", cover: "" },
  { id: "pl-today", title: "Rock Today", subtitle: "Band Three", cover: "" },
]
const classics = [track("c1", "First Riff"), track("c2", "Second Riff"), track("c3", "Third Riff"), track("c4", "Fourth Riff")]

// Records which categories, playlists and searches the UI asked for.
const opened: string[] = []
const searched: string[] = []
const fakeMusic: MusicSource = {
  search: async (query) => (searched.push(query), searchResults),
  suggestions: async (query) => [`${query} live`, `${query} remix`],
  radio: async () => radioResults,
  categories: async () => categories,
  playlists: async (id) => (opened.push(id), id === "rock" ? rockPlaylists : []),
  playlist: async (id) => (opened.push(id), id === "pl-classics" ? classics : []),
  artist: async (id) => {
    artistCalls.push(id)
    if (id === "UC-broken") throw new Error("YouTube said no")
    return id === "UC-empty" ? { name: "Nobody", items: [] } : bandPage
  },
  album: async (id) => {
    albumCalls.push(id)
    if (id === "MPR-empty") return []
    return albumTracks
  },
}

// Songs that link to an artist and an album, as search results do.
const linked = (id: string, title: string, artistId?: string, albumId?: string): Track => ({
  ...track(id, title),
  artistId,
  albumId,
})
const artistCalls: string[] = []
const albumCalls: string[] = []
const bandPage: ArtistPage = {
  name: "The Band",
  items: [
    { section: "Top songs", track: linked("t1", "Top Hit", "UC-band") },
    { section: "Top songs", track: linked("t2", "Second Hit", "UC-band") },
    { section: "Albums", album: { id: "MPR-first", title: "First Album", subtitle: "2013", cover: "" } },
  ],
}
const albumTracks = [
  linked("al1", "Album Opener", "UC-band", "MPR-first"),
  linked("al2", "Album Closer", "UC-band", "MPR-first"),
]
const pressEscapeIn = (keys: { pressEscape(): void }) => act(async () => (keys.pressEscape(), Bun.sleep(50)))

async function searchFor(
  setup: Awaited<ReturnType<typeof testRender>>,
  music: MusicSource,
  title: string,
) {
  await setup.waitForFrame((f) => f.includes("Chill"))
  await act(async () => setup.mockInput.pressKey("/"))
  await act(async () => {
    await setup.mockInput.typeText("query")
    setup.mockInput.pressEnter()
  })
  await setup.waitForFrame((f) => f.includes(title))
  artistCalls.length = 0
  albumCalls.length = 0
  return music
}

const withSongs = (songs: Track[]): MusicSource => ({ ...fakeMusic, search: async () => songs })

class FakePlayer implements Player {
  state: PlayerState = { status: "idle", position: 0, duration: 0, volume: 80 }
  played: string[] = []
  prefetched?: string
  private listeners = new Set<() => void>()
  private ended = new Set<() => void>()

  play(t: Track) {
    this.played.push(t.id)
    this.set({ status: "playing", position: 0, duration: t.duration })
  }
  prefetch(t: Track | undefined) {
    this.prefetched = t?.id
  }
  togglePause() {
    this.set({ status: this.state.status === "paused" ? "playing" : "paused" })
  }
  seek() {}
  setVolume(volume: number) {
    this.set({ volume })
  }
  stop() {
    this.set({ status: "idle" })
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  onEnded(listener: () => void) {
    this.ended.add(listener)
    return () => this.ended.delete(listener)
  }
  dispose() {}
  finishTrack() {
    for (const listener of this.ended) listener()
  }
  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}

test("search, play, queue, then autoplay from radio", async () => {
  const player = new FakePlayer()
  await using setup = await testRender(<App music={fakeMusic} player={player} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput

  await setup.renderOnce()
  expect(setup.captureCharFrame()).toContain("Nothing playing")
  // The cover box sits above the queue; fake tracks have no cover image.
  expect(setup.captureCharFrame()).toMatch(/cover[\s\S]*no cover[\s\S]*up next/)

  // The app opens on moods & genres; "/" moves to the search box and search lands on the results.
  await setup.waitForFrame((f) => f.includes("Chill"))
  await act(async () => keys.pressKey("/"))
  await act(async () => {
    await keys.typeText("test query")
    keys.pressEnter()
  })
  let frame = await setup.waitForFrame((f) => f.includes("Slow Orbit"))
  expect(frame).toContain('3 songs for "test query"')

  // Enter plays the selected song; "a" queues the next one.
  await act(async () => {
    keys.pressEnter()
    keys.pressArrow("down")
    keys.pressKey("a")
  })
  frame = await setup.waitForFrame((f) => f.includes("up next · 1"))
  expect(player.played).toEqual(["a1"])
  expect(frame).toContain("▶ Morning Static")
  // The queued song downloads ahead of time.
  expect(player.prefetched).toBe("a2")

  // When the track ends, the queued song plays next.
  await act(async () => player.finishTrack())
  frame = await setup.waitForFrame((f) => f.includes("up next · 0"))
  expect(player.played).toEqual(["a1", "a2"])

  // With the queue empty, autoplay pulls similar songs and skips ones already played.
  await act(async () => player.finishTrack())
  frame = await setup.waitForFrame((f) => f.includes("Autoplay queued 2 similar songs"))
  expect(player.played).toEqual(["a1", "a2", "r1"])
  expect(frame).toContain("up next · 1")
  expect(frame).toContain("1 Radio Pick Two")
  expect(player.prefetched).toBe("r2")

  // Space pauses; "p" right at the start of a track goes back to the previous one.
  await act(async () => {
    keys.pressKey(" ")
    keys.pressKey("p")
  })
  expect(player.played).toEqual(["a1", "a2", "r1", "a2"])
})

test("browse a genre, play a playlist from the middle, then go back", async () => {
  const player = new FakePlayer()
  opened.length = 0
  await using setup = await testRender(<App music={fakeMusic} player={player} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput

  // Moods & genres load on start, under "Recently played"; the group name labels the first row
  // of each group.
  let frame = await setup.waitForFrame((f) => f.includes("Rock"))
  expect(frame).toMatch(/Recently played +Your music/)
  expect(frame).toMatch(/Chill +Moods & moments/)
  expect(frame).toMatch(/Rock +Genres/)

  await act(async () => {
    keys.pressArrow("down")
    keys.pressArrow("down")
    keys.pressArrow("down")
    keys.pressEnter()
  })
  frame = await setup.waitForFrame((f) => f.includes("Rock Classics"))
  expect(frame).toContain("moods & genres › Rock")
  expect(frame).toContain("Band One, Band Two")

  await act(async () => keys.pressEnter())
  frame = await setup.waitForFrame((f) => f.includes("Fourth Riff"))
  expect(frame).toContain("moods & genres › Rock › Rock Classics")

  // Enter plays from the selected song; the rest of the playlist becomes up next.
  await act(async () => {
    keys.pressArrow("down")
    keys.pressEnter()
  })
  frame = await setup.waitForFrame((f) => f.includes("up next · 2"))
  expect(player.played).toEqual(["c2"])
  expect(frame).toContain("1 Third Riff")
  expect(frame).toContain("Playing Rock Classics · 2 up next")

  // "A" adds the whole playlist after what is already queued.
  await act(async () => keys.pressKey("A"))
  frame = await setup.waitForFrame((f) => f.includes("up next · 6"))

  // Esc goes back one level at a time, keeping the selection: enter reopens Rock.
  // A lone escape byte is only reported once no escape sequence follows it, hence the pause.
  const pressEscape = () => act(async () => (keys.pressEscape(), Bun.sleep(50)))
  await pressEscape()
  await setup.waitForFrame((f) => f.includes("Rock Today"))
  await pressEscape()
  frame = await setup.waitForFrame((f) => f.includes("Chill"))
  expect(frame).not.toContain("›")
  await act(async () => keys.pressEnter())
  await setup.waitForFrame((f) => f.includes("Rock Classics"))
  expect(opened).toEqual(["rock", "pl-classics", "rock"])
})

test("splash shows until the lists load, and any key skips it", async () => {
  const props = { music: fakeMusic, player: new FakePlayer(), onQuit: () => {} }
  {
    await using setup = await testRender(<App {...props} splash />, { width: 100, height: 30 })
      await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("now playing")
    await act(async () => setup.mockInput.pressKey("x"))
    await setup.waitForFrame((f) => f.includes("now playing"))
  }
  {
    // Lists load instantly here, so it leaves after its minimum time plus the fade.
    await using setup = await testRender(<App {...props} splash />, { width: 100, height: 30 })
    await act(async () => Bun.sleep(1000))
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("██")
    // Inside act() React applies the timer's update only when the callback returns, so the
    // fade-out starts after the first sleep and needs a second one.
    await act(async () => Bun.sleep(400))
    await act(async () => Bun.sleep(400))
    await setup.waitForFrame((f) => f.includes("now playing"))
  }
})

test("? shows every key, and any key closes it", async () => {
  await using setup = await testRender(<App music={fakeMusic} player={new FakePlayer()} onQuit={() => {}} />, {
    width: 130,
    height: 34,
  })
  await setup.waitForFrame((f) => f.includes("? keys"))
  await act(async () => setup.mockInput.pressKey("?"))
  const frame = await setup.waitForFrame((f) => f.includes("pause / resume"))
  // Wide enough for both columns side by side.
  expect(frame).toMatch(/Browse +Playback/)
  await act(async () => setup.mockInput.pressKey("x"))
  await setup.waitForFrame((f) => !f.includes("pause / resume"))
})

test("picks up the last session, saves changes, and lists recently played songs", async () => {
  const player = new FakePlayer()
  const saves: SavedSession[] = []
  const store: SessionStore = {
    saved: {
      volume: 55,
      autoplay: false,
      current: track("s1", "Saved Song"),
      queue: [track("s2", "Saved Next")],
      history: [track("h1", "Older Song"), track("h2", "Old Song")],
      searches: ["old query"],
    },
    save: (session) => saves.push(session),
  }
  await using setup = await testRender(<App music={fakeMusic} player={player} onQuit={() => {}} store={store} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput

  // The saved song shows as current but waits for space; nothing plays on its own.
  let frame = await setup.waitForFrame((f) => f.includes("Picked up where you left off"))
  expect(frame).toContain("■ Saved Song")
  expect(frame).toContain("up next · 1")
  expect(frame).toContain("autoplay off")
  expect(player.played).toEqual([])

  await act(async () => keys.pressKey(" "))
  expect(player.played).toEqual(["s1"])

  // Recently played: newest first, from the saved history.
  await act(async () => keys.pressEnter())
  frame = await setup.waitForFrame((f) => f.includes("Older Song"))
  expect(frame).toContain("moods & genres › Recently played")
  expect(frame).toMatch(/Saved Song[\s\S]*Old Song[\s\S]*Older Song/)

  // "r" turns autoplay on, and the change is saved.
  await act(async () => keys.pressKey("r"))
  await setup.waitForFrame((f) => f.includes("autoplay on"))
  expect(saves.at(-1)).toMatchObject({ autoplay: true, current: { id: "s1" }, queue: [{ id: "s2" }] })

  // The search box opens on the saved recent searches.
  await act(async () => keys.pressKey("/"))
  frame = await setup.waitForFrame((f) => f.includes("recent searches"))
  expect(frame).toContain("↺ old query")
})

test("search suggests completions, and remembers what was searched", async () => {
  const saves: SavedSession[] = []
  const store: SessionStore = { saved: null, save: (session) => saves.push(session) }
  await using setup = await testRender(
    <App music={fakeMusic} player={new FakePlayer()} onQuit={() => {}} store={store} />,
    { width: 100, height: 30 },
  )
  const keys = setup.mockInput
  await setup.waitForFrame((f) => f.includes("Chill"))
  searched.length = 0

  // Suggestions are asked for once typing pauses.
  await act(async () => keys.pressKey("/"))
  await act(async () => keys.typeText("mor"))
  await act(() => Bun.sleep(200))
  let frame = await setup.waitForFrame((f) => f.includes("mor remix"))
  expect(frame).toContain("suggestions")
  expect(frame).toContain("mor live")

  // ↓ highlights the first suggestion; enter searches it instead of the typed text.
  await act(async () => {
    keys.pressArrow("down")
    keys.pressEnter()
  })
  await setup.waitForFrame((f) => f.includes('3 songs for "mor live"'))
  expect(searched).toEqual(["mor live"])
  expect(saves.at(-1)?.searches).toEqual(["mor live"])

  // Back in the box, it is listed as a recent search.
  await act(async () => keys.pressKey("/"))
  frame = await setup.waitForFrame((f) => f.includes("↺ mor live"))
})

test("g opens a song's artist: songs play and queue, albums open, esc goes back", async () => {
  const player = new FakePlayer()
  const music = withSongs([linked("s1", "Linked Song", "UC-band", "MPR-first")])
  await using setup = await testRender(<App music={music} player={player} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput
  await searchFor(setup, music, "Linked Song")

  await act(async () => keys.pressKey("g"))
  let frame = await setup.waitForFrame((f) => f.includes("Top Hit"))
  expect(artistCalls).toEqual(["UC-band"])
  expect(frame).toContain("The Band")
  expect(frame).toMatch(/Top Hit +Top songs/)
  expect(frame).toMatch(/First Album +Albums · 2013/)

  // Enter plays a song, "a" queues the next one.
  await act(async () => {
    keys.pressEnter()
    keys.pressArrow("down")
    keys.pressKey("a")
  })
  frame = await setup.waitForFrame((f) => f.includes("up next · 1"))
  expect(player.played).toEqual(["t1"])
  expect(frame).toContain("1 Second Hit")

  // Enter on an album opens its tracks, which play like a playlist.
  await act(async () => {
    keys.pressArrow("down")
    keys.pressEnter()
  })
  frame = await setup.waitForFrame((f) => f.includes("Album Closer"))
  expect(albumCalls).toEqual(["MPR-first"])
  expect(frame).toContain("The Band › First Album")
  await act(async () => keys.pressEnter())
  await setup.waitForFrame((f) => f.includes("Playing First Album · 1 up next"))
  expect(player.played).toEqual(["t1", "al1"])

  // The same artist opened again further up the stack gets its name too.
  await act(async () => keys.pressKey("g"))
  frame = await setup.waitForFrame((f) => f.includes("Top Hit"))
  expect(frame).toContain("The Band › First Album › The Band")
  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Album Closer"))

  // Esc goes back one page at a time, with the album row still selected.
  await pressEscapeIn(keys)
  frame = await setup.waitForFrame((f) => f.includes("First Album") && !f.includes("› First Album"))
  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Linked Song") && !f.includes("The Band"))
})

test("b opens a song's album, from the list and from the queue", async () => {
  const player = new FakePlayer()
  const music = withSongs([
    linked("s1", "Linked Song", "UC-band", "MPR-first"),
    linked("s2", "Queued Song", "UC-band", "MPR-second"),
  ])
  await using setup = await testRender(<App music={music} player={player} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput
  await searchFor(setup, music, "Queued Song")

  await act(async () => keys.pressKey("b"))
  let frame = await setup.waitForFrame((f) => f.includes("Album Opener"))
  expect(albumCalls).toEqual(["MPR-first"])
  expect(frame).toContain("Test Album")

  // From the queue the page opens on the left, and the list takes focus.
  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Queued Song"))
  await act(async () => {
    keys.pressEnter() // plays the first song
    keys.pressArrow("down")
    keys.pressKey("a")
    keys.pressKey("\t")
  })
  await setup.waitForFrame((f) => f.includes("1 Queued Song"))
  await act(async () => keys.pressKey("b"))
  await setup.waitForFrame((f) => f.includes("Album Closer"))
  expect(albumCalls).toEqual(["MPR-first", "MPR-second"])
  await act(async () => keys.pressEnter())
  expect(player.played).toEqual(["s1", "al1"])
})

test("songs without links say so in the status line, and saved sessions without ids still work", async () => {
  const store: SessionStore = {
    saved: {
      volume: 55,
      autoplay: false,
      current: null,
      queue: [],
      history: [track("old", "Old Saved Song")], // no artistId or albumId, like older session files
      searches: [],
    },
    save: () => {},
  }
  artistCalls.length = 0
  albumCalls.length = 0
  await using setup = await testRender(<App music={fakeMusic} player={new FakePlayer()} onQuit={() => {}} store={store} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput
  await setup.waitForFrame((f) => f.includes("Recently played"))

  // Moods & genres hold no songs.
  await act(async () => keys.pressKey("g"))
  await setup.waitForFrame((f) => f.includes("Select a song to open its artist"))

  await act(async () => keys.pressEnter())
  await setup.waitForFrame((f) => f.includes("Old Saved Song"))
  await act(async () => keys.pressKey("g"))
  await setup.waitForFrame((f) => f.includes('No artist page for "Old Saved Song"'))
  await act(async () => keys.pressKey("b"))
  await setup.waitForFrame((f) => f.includes('No album page for "Old Saved Song"'))
  expect(artistCalls).toEqual([])
  expect(albumCalls).toEqual([])
})

test("errors and empty pages show in the status line, and enter retries", async () => {
  const music = withSongs([
    linked("s1", "Broken Artist", "UC-broken", "MPR-empty"),
    linked("s2", "Empty Artist", "UC-empty"),
  ])
  await using setup = await testRender(<App music={music} player={new FakePlayer()} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput
  await searchFor(setup, music, "Empty Artist")

  await act(async () => keys.pressKey("g"))
  let frame = await setup.waitForFrame((f) => f.includes("Couldn't load artist: YouTube said no"))
  expect(frame).toContain("Press enter to retry")
  await act(async () => keys.pressEnter())
  await setup.waitForFrame((f) => artistCalls.length === 2 && f.includes("Couldn't load artist"))

  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Empty Artist"))
  await act(async () => keys.pressKey("b"))
  await setup.waitForFrame((f) => f.includes("No songs found on Test Album"))

  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Empty Artist"))
  await act(async () => {
    keys.pressArrow("down")
    keys.pressKey("g")
  })
  frame = await setup.waitForFrame((f) => f.includes("No songs or albums found for this artist"))
  expect(frame).toContain("Nobody")
})

test("repeated keys in one chunk open a page only once", async () => {
  const music = withSongs([linked("s1", "Linked Song", "UC-band", "MPR-first")])
  await using setup = await testRender(<App music={music} player={new FakePlayer()} onQuit={() => {}} />, {
    width: 100,
    height: 30,
  })
  const keys = setup.mockInput
  await searchFor(setup, music, "Linked Song")

  await act(async () => {
    keys.pressKey("g")
    keys.pressKey("g")
    keys.pressKey("b")
  })
  await setup.waitForFrame((f) => f.includes("Top Hit"))
  expect(artistCalls).toEqual(["UC-band"])
  expect(albumCalls).toEqual([])

  // Pressed again once loaded, on a song by the same artist, it stays on the same page.
  await act(async () => keys.pressKey("g"))
  await setup.renderOnce()
  expect(artistCalls).toEqual(["UC-band"])

  await pressEscapeIn(keys)
  await setup.waitForFrame((f) => f.includes("Linked Song") && !f.includes("Top Hit"))
})

test("artist and album pages keep working in very small terminals", async () => {
  // Small but usable: the rows are cut short and the status line still reports problems.
  {
    const music = withSongs([linked("s1", "A Song With A Rather Long Title", "UC-band")])
    await using setup = await testRender(<App music={music} player={new FakePlayer()} onQuit={() => {}} />, {
      width: 40,
      height: 13,
    })
    const keys = setup.mockInput
    await searchFor(setup, music, "songs for")
    await act(async () => keys.pressKey("b"))
    await setup.waitForFrame((f) => f.includes("No album page"))
    await act(async () => keys.pressKey("g"))
    await setup.waitForFrame((f) => f.includes("Top H"))
    await act(async () => {
      keys.pressArrow("down")
      keys.pressArrow("down")
      keys.pressEnter()
    })
    await act(() => Bun.sleep(20))
    expect(albumCalls).toEqual(["MPR-first"])
  }
  // Too small to show the list at all: nothing throws, and the keys still act.
  {
    const music = withSongs([linked("s1", "Tiny", "UC-band", "MPR-first")])
    await using setup = await testRender(<App music={music} player={new FakePlayer()} onQuit={() => {}} />, {
      width: 20,
      height: 6,
    })
    const keys = setup.mockInput
    await act(() => Bun.sleep(20))
    await act(async () => keys.pressKey("/"))
    await act(async () => {
      await keys.typeText("query")
      keys.pressEnter()
    })
    await act(() => Bun.sleep(20))
    artistCalls.length = 0
    await act(async () => keys.pressKey("g"))
    await act(() => Bun.sleep(20))
    await setup.renderOnce()
    expect(artistCalls).toEqual(["UC-band"])
    expect(setup.captureCharFrame()).not.toContain("Invalid width")
  }
})

test("the cover falls back to the highlighted row when the song has no image", () => {
  const withCover = (cover: string) => ({ ...track("x", "X"), cover })
  expect(coverFor(withCover("playing.jpg"), undefined)).toBe("playing.jpg")
  expect(coverFor(withCover(""), withCover("row.jpg"))).toBe("row.jpg")
  expect(coverFor(null, { section: "Top songs", track: withCover("song.jpg") })).toBe("song.jpg")
  expect(coverFor(withCover(""), { section: "Albums", album: { id: "a", title: "A", subtitle: "", cover: "album.jpg" } })).toBe(
    "album.jpg",
  )
  expect(coverFor(withCover(""), withCover(""))).toBeUndefined()
  expect(coverFor(null, undefined)).toBeUndefined()
})
