// Command-line arguments. With none the app starts; --help and --version print and exit.
export type Command = { kind: "run" } | { kind: "help" } | { kind: "version" } | { kind: "error"; message: string }

export function parseArgs(args: string[]): Command {
  let command: Command = { kind: "run" }
  for (const arg of args) {
    if (arg === "-h" || arg === "--help") return { kind: "help" } // help wins over everything else
    if (arg === "-v" || arg === "--version") command = { kind: "version" }
    else return { kind: "error", message: `unknown option: ${arg}` }
  }
  return command
}

export const helpText = (version: string) => `ytm-tui ${version}: YouTube Music in your terminal

Usage: ytm [options]    (or ytm-tui)

Options:
  -h, --help       Show this help
  -v, --version    Show the version

Environment:
  YTM_NO_SPLASH=1           Skip the launch animation
  YTM_MPV_ARGS="..."        Extra flags for mpv, e.g. --audio-device=pipewire/my-sink
  YTM_IMAGE_PROTOCOL=...    How to draw cover art: auto, kitty, sixel or blocks

Needs mpv and yt-dlp on your PATH. Inside the app, press ? for every key.`
