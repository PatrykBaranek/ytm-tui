import type { Socket, Subprocess } from "bun"
import { rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Download } from "./download"
import type { Track } from "./music"

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error"

export interface PlayerState {
  status: PlayerStatus
  position: number
  duration: number
  volume: number
  error?: string
}

export interface Player {
  readonly state: PlayerState
  play(track: Track): void
  // The song that will probably play next. It downloads while the current one plays, so it
  // starts right away; undefined cancels that.
  prefetch(track: Track | undefined): void
  togglePause(): void
  seek(seconds: number, mode?: "relative" | "absolute"): void
  setVolume(volume: number): void
  stop(): void
  // Shaped for React's useSyncExternalStore: fires on every state change.
  subscribe: (listener: () => void) => () => void
  // Fires when a track plays to the end on its own, not when it is stopped or replaced.
  onEnded(listener: () => void): () => void
  dispose(): void
}

interface Session {
  download: Download
  mpv: Subprocess<"pipe", "ignore", "ignore">
  socketPath: string
  socket?: Socket
  buffer: string
}

// mpv can't fetch YouTube's stream URLs itself (googlevideo answers 403), so yt-dlp downloads
// the audio into memory and we feed it to mpv's stdin. mpv is driven over its JSON IPC socket.
export class MpvPlayer implements Player {
  state: PlayerState = { status: "idle", position: 0, duration: 0, volume: 80 }
  private listeners = new Set<() => void>()
  private endedListeners = new Set<() => void>()
  private session?: Session
  private generation = 0
  private paused = false
  private upNext?: Track
  private prefetched?: Download

  constructor(
    private extraMpvArgs: string[] = [],
    volume = 80,
  ) {
    this.state = { ...this.state, volume }
  }

  play(track: Track) {
    this.endSession()
    const generation = ++this.generation
    this.paused = false
    this.update({ status: "loading", position: 0, duration: track.duration, error: undefined })

    const socketPath = join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), `ytm-tui-${process.pid}-${generation}.sock`)
    // A prefetch of another song stays: playing something else now doesn't change what's next.
    const prefetched = this.prefetched?.trackId === track.id && !this.prefetched.error ? this.prefetched : undefined
    if (prefetched) this.prefetched = undefined
    const download = prefetched ?? new Download(track.id)
    const mpv = Bun.spawn(
      [
        "mpv",
        "--no-video",
        "--no-terminal",
        `--volume=${this.state.volume}`,
        `--input-ipc-server=${socketPath}`,
        ...this.extraMpvArgs,
        "-",
      ],
      { stdin: "pipe", stdout: "ignore", stderr: "ignore" },
    )
    download.pipeTo(mpv.stdin)
    const session: Session = { download, mpv, socketPath, buffer: "" }
    this.session = session

    void this.connect(session, generation)
    void mpv.exited.then(async (code) => {
      if (generation !== this.generation) return // replaced or stopped on purpose
      this.session = undefined
      session.socket?.end()
      rmSync(socketPath, { force: true })
      if (code === 0) {
        this.update({ status: "idle" })
        for (const listener of this.endedListeners) listener()
        return
      }
      download.cancel()
      await download.settled
      if (generation === this.generation)
        this.update({ status: "error", error: download.error ?? `mpv exited with code ${code}` })
    })
  }

  prefetch(track: Track | undefined) {
    this.upNext = track
    this.startPrefetch()
  }

  togglePause() {
    if (this.state.status === "playing" || this.state.status === "paused") this.send(["cycle", "pause"])
  }

  seek(seconds: number, mode: "relative" | "absolute" = "relative") {
    if (this.state.status === "playing" || this.state.status === "paused") this.send(["seek", seconds, mode])
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)))
    this.update({ volume: clamped })
    this.send(["set_property", "volume", clamped])
  }

  stop() {
    this.endSession()
    this.generation++
    this.update({ status: "idle", position: 0, error: undefined })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onEnded(listener: () => void) {
    this.endedListeners.add(listener)
    return () => this.endedListeners.delete(listener)
  }

  dispose() {
    this.stop()
    this.prefetch(undefined)
    this.listeners.clear()
    this.endedListeners.clear()
  }

  private async connect(session: Session, generation: number) {
    // mpv creates the socket shortly after starting; retry until it accepts connections.
    for (let attempt = 0; attempt < 100 && generation === this.generation; attempt++) {
      try {
        session.socket = await Bun.connect({
          unix: session.socketPath,
          socket: { data: (_socket, chunk) => this.onData(session, generation, chunk.toString()) },
        })
        break
      } catch {
        await Bun.sleep(50)
      }
    }
    if (generation !== this.generation) return session.socket?.end()
    ;["time-pos", "duration", "pause"].forEach((name, i) => this.send(["observe_property", i + 1, name]))
  }

  private onData(session: Session, generation: number, chunk: string) {
    if (generation !== this.generation) return
    session.buffer += chunk
    let newline: number
    while ((newline = session.buffer.indexOf("\n")) >= 0) {
      const line = session.buffer.slice(0, newline)
      session.buffer = session.buffer.slice(newline + 1)
      const message = JSON.parse(line) as { event?: string; name?: string; data?: unknown }
      if (message.event === "property-change") this.onProperty(message.name, message.data)
    }
  }

  private onProperty(name: string | undefined, data: unknown) {
    if (name === "pause" && typeof data === "boolean") {
      this.paused = data
      if (this.state.status !== "loading") this.update({ status: data ? "paused" : "playing" })
    } else if (name === "duration" && typeof data === "number") {
      this.update({ duration: data })
    } else if (name === "time-pos" && typeof data === "number") {
      const status = this.paused ? "paused" : "playing"
      // time-pos fires many times a second; only re-render when the displayed second changes.
      if (Math.floor(data) !== Math.floor(this.state.position) || status !== this.state.status) {
        this.update({ position: data, status })
      }
    }
  }

  private send(command: unknown[]) {
    this.session?.socket?.write(JSON.stringify({ command }) + "\n")
  }

  private endSession() {
    const session = this.session
    if (!session) return
    this.session = undefined
    session.socket?.end()
    session.mpv.kill()
    session.download.cancel()
    rmSync(session.socketPath, { force: true })
  }

  private startPrefetch() {
    if (this.prefetched && this.prefetched.trackId !== this.upNext?.id) {
      this.prefetched.cancel()
      this.prefetched = undefined
    }
    // Wait until the current song plays, so its own download goes first.
    const playing = this.state.status === "playing" || this.state.status === "paused"
    if (this.upNext && !this.prefetched && playing) this.prefetched = new Download(this.upNext.id)
  }

  private update(patch: Partial<PlayerState>) {
    const statusChanged = patch.status !== undefined && patch.status !== this.state.status
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
    if (statusChanged) this.startPrefetch()
  }
}
