import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { Track } from "./music"

// What survives a restart.
export interface SavedSession {
  volume: number
  autoplay: boolean
  current: Track | null
  queue: Track[]
  history: Track[]
  searches: string[] // newest first
}

export interface SessionStore {
  // The session saved last time, or null on the first run or if the file was unreadable.
  readonly saved: SavedSession | null
  save(session: SavedSession): void
}

// Changes come in bursts (a volume key held down, a queue being built), so writes are batched.
const SAVE_DELAY_MS = 1000

const defaultPath = () =>
  join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "ytm-tui", "session.json")

// Keeps the session in $XDG_STATE_HOME/ytm-tui/session.json (~/.local/state/ytm-tui by default).
export class FileSessionStore implements SessionStore {
  readonly saved: SavedSession | null
  private pending?: SavedSession
  private timer?: ReturnType<typeof setTimeout>

  constructor(readonly path = defaultPath()) {
    this.saved = read(path)
  }

  save(session: SavedSession) {
    this.pending = session
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS)
    this.timer.unref() // never keep the process alive on its own
  }

  // Writes a pending save right away; called on exit.
  flush() {
    clearTimeout(this.timer)
    this.timer = undefined
    const session = this.pending
    this.pending = undefined
    if (!session) return
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      // Write a temporary file and rename it over the old one, so a crash never leaves half a file.
      const temporary = `${this.path}.${process.pid}.tmp`
      writeFileSync(temporary, JSON.stringify({ version: 1, ...session }))
      renameSync(temporary, this.path)
    } catch {
      // Saving is best effort, and nothing may print while the TUI runs.
    }
  }
}

const isTrack = (value: unknown): value is Track => {
  const t = value as Track | null
  return (
    typeof t === "object" &&
    t !== null &&
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.artists === "string" &&
    typeof t.album === "string" &&
    typeof t.duration === "number" &&
    typeof t.cover === "string"
  )
}

const tracks = (value: unknown) => (Array.isArray(value) ? value.filter(isTrack) : [])

function read(path: string): SavedSession | null {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"))
    if (data?.version !== 1) return null
    return {
      volume: typeof data.volume === "number" ? Math.max(0, Math.min(100, data.volume)) : 80,
      autoplay: data.autoplay !== false,
      current: isTrack(data.current) ? data.current : null,
      queue: tracks(data.queue),
      history: tracks(data.history),
      searches: Array.isArray(data.searches)
        ? data.searches.filter((search: unknown): search is string => typeof search === "string")
        : [],
    }
  } catch {
    return null
  }
}
