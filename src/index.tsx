#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { createYouTubeMusic } from "./services/music"
import { MpvPlayer } from "./services/player"

const missing = ["mpv", "yt-dlp"].filter((bin) => !Bun.which(bin))
if (missing.length > 0) {
  console.error(`ytm-tui needs ${missing.join(" and ")} on your PATH.`)
  process.exit(1)
}

// YTM_MPV_ARGS passes extra flags to mpv, e.g. "--audio-device=pipewire/..." or "--ao=null".
const player = new MpvPlayer(process.env.YTM_MPV_ARGS?.split(/\s+/).filter(Boolean))
// YTM_IMAGE_PROTOCOL forces how covers are drawn (kitty, sixel or blocks) if auto-detection guesses wrong.
const protocols = ["auto", "kitty", "sixel", "blocks"] as const
const coverProtocol = protocols.find((p) => p === process.env.YTM_IMAGE_PROTOCOL) ?? "auto"
const renderer = await createCliRenderer({ exitOnCtrlC: false })
// YTM_NO_SPLASH=1 skips the launch animation.
const splash = !process.env.YTM_NO_SPLASH

function quit() {
  player.dispose()
  renderer.destroy()
  process.exit(0)
}

// Child processes don't die with us; make sure mpv and yt-dlp never keep playing after exit.
process.on("exit", () => player.dispose())
process.on("SIGTERM", quit)
process.on("SIGHUP", quit)

createRoot(renderer).render(
  <App music={createYouTubeMusic()} player={player} onQuit={quit} coverProtocol={coverProtocol} splash={splash} />,
)
