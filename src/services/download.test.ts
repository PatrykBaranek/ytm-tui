import { afterAll, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Download, type AudioSink } from "./download"

// A stand-in for yt-dlp: refuses the visionOS client, and otherwise prints the video id as audio.
const dir = mkdtempSync(join(tmpdir(), "ytm-download-"))
const fakeYtDlp = join(dir, "yt-dlp")
writeFileSync(
  fakeYtDlp,
  `#!/bin/sh
case "$*" in
  *visionos*) echo "ERROR: HTTP Error 403: Forbidden" >&2; exit 1 ;;
  *never*) echo "ERROR: Video unavailable" >&2; exit 1 ;;
esac
for arg; do last="$arg"; done
printf 'audio:%s' "\${last##*v=}"
`,
)
chmodSync(fakeYtDlp, 0o755)
afterAll(() => rmSync(dir, { recursive: true, force: true }))

class MemorySink implements AudioSink {
  data = ""
  ended = false
  write(chunk: Uint8Array) {
    this.data += new TextDecoder().decode(chunk)
  }
  flush() {}
  end() {
    this.ended = true
  }
}

test("falls back to yt-dlp's default clients when the fast one is refused", async () => {
  const download = new Download("abc123", fakeYtDlp)
  await download.settled
  expect(download.error).toBeUndefined()

  // A sink attached after the download finished still gets everything.
  const sink = new MemorySink()
  download.pipeTo(sink)
  expect(sink.data).toBe("audio:abc123")
  expect(sink.ended).toBe(true)
})

test("a sink attached early gets the audio as it arrives", async () => {
  const download = new Download("early", fakeYtDlp)
  const sink = new MemorySink()
  download.pipeTo(sink)
  await download.settled
  expect(sink.data).toBe("audio:early")
  expect(sink.ended).toBe(true)
})

test("reports yt-dlp's last error line when every attempt fails", async () => {
  const download = new Download("never", fakeYtDlp)
  await download.settled
  expect(download.error).toBe("ERROR: Video unavailable")
  expect(download.chunks).toHaveLength(0)
})
