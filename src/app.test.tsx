import { expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import { App } from "./app"
import type { Category, MusicSource, PlaylistInfo, Track } from "./services/music"
import type { Player, PlayerState } from "./services/player"

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

// Records which categories and playlists the UI asked for.
const opened: string[] = []
const fakeMusic: MusicSource = {
  search: async () => searchResults,
  radio: async () => radioResults,
  categories: async () => categories,
  playlists: async (id) => (opened.push(id), id === "rock" ? rockPlaylists : []),
  playlist: async (id) => (opened.push(id), id === "pl-classics" ? classics : []),
}

class FakePlayer implements Player {
  state: PlayerState = { status: "idle", position: 0, duration: 0, volume: 80 }
  played: string[] = []
  private listeners = new Set<() => void>()
  private ended = new Set<() => void>()

  play(t: Track) {
    this.played.push(t.id)
    this.set({ status: "playing", position: 0, duration: t.duration })
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

  // Moods & genres load on start; the group name labels the first row of each group.
  let frame = await setup.waitForFrame((f) => f.includes("Rock"))
  expect(frame).toMatch(/Chill +Moods & moments/)
  expect(frame).toMatch(/Rock +Genres/)

  await act(async () => {
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
