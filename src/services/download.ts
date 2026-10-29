import type { Subprocess } from "bun"

// yt-dlp normally asks YouTube for a song as several apps and solves a JavaScript challenge
// first, which takes 7-8 seconds. Asking only as the visionOS app takes about 1 second.
// YouTube refuses some apps from time to time, so a failure falls back to yt-dlp's defaults.
const ATTEMPTS = [["--extractor-args", "youtube:player_client=visionos"], []]

// Where downloaded audio goes; mpv's stdin in practice.
export interface AudioSink {
  write(chunk: Uint8Array): unknown
  flush(): unknown
  end(): unknown
}

// One song's audio, downloaded by yt-dlp into memory (a song is a few MB).
export class Download {
  readonly chunks: Uint8Array[] = []
  finished = false
  error?: string
  readonly settled: Promise<void>
  private process?: Subprocess<"ignore", "pipe", "pipe">
  private cancelled = false
  private listeners = new Set<() => void>()

  constructor(
    readonly trackId: string,
    private command = "yt-dlp",
  ) {
    this.settled = this.run()
  }

  // Writes what has arrived so far, then the rest as it comes, and closes the sink at the end.
  pipeTo(sink: AudioSink) {
    let written = 0
    const pump = () => {
      try {
        while (written < this.chunks.length) ignoreRejection(sink.write(this.chunks[written++]!))
        ignoreRejection(sink.flush())
        if (this.finished) {
          this.listeners.delete(pump)
          ignoreRejection(sink.end())
        }
      } catch {
        this.listeners.delete(pump) // the reader is gone (mpv was stopped)
      }
    }
    this.listeners.add(pump)
    pump()
  }

  cancel() {
    this.cancelled = true
    this.process?.kill()
  }

  private async run() {
    for (const extraArgs of ATTEMPTS) {
      this.error = await this.attempt(extraArgs)
      // Retrying after part of the song arrived would start it over, so keep what there is.
      if (!this.error || this.cancelled || this.chunks.length > 0) break
    }
    this.finished = true
    this.notify()
  }

  // Resolves to yt-dlp's last error line, or undefined when it succeeded.
  private async attempt(extraArgs: string[]) {
    const url = `https://music.youtube.com/watch?v=${this.trackId}`
    const process = Bun.spawn(
      [this.command, "--quiet", "--no-warnings", "--no-playlist", "-f", "bestaudio/best", ...extraArgs, "-o", "-", url],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    this.process = process
    // Read stderr alongside stdout so a chatty yt-dlp never blocks on a full pipe.
    const stderr = new Response(process.stderr).text()
    for await (const chunk of process.stdout) {
      this.chunks.push(chunk)
      this.notify()
    }
    const code = await process.exited
    if (code === 0 || this.cancelled) return undefined
    return (await stderr).trim().split("\n").at(-1) || `yt-dlp exited with code ${code}`
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }
}

const ignoreRejection = (result: unknown) => {
  if (result instanceof Promise) result.catch(() => {})
}
