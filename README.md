# ytm-tui

[![CI](https://github.com/PatrykBaranek/ytm-tui/actions/workflows/ci.yml/badge.svg)](https://github.com/PatrykBaranek/ytm-tui/actions/workflows/ci.yml)

A small terminal client for YouTube Music: browse playlists by mood and genre, search, play,
queue, and autoplay similar songs.
Built with [OpenTUI](https://opentui.com) + React on Bun.

![ytm-tui: the splash, browsing Chill playlists, a search with suggestions, a song playing with the glow taking its cover's colors, and the key help](docs/demo.gif)

## Install

Needs [Bun](https://bun.sh) 1.3.14 or newer, plus `mpv` and `yt-dlp` on your PATH. Linux and macOS.

```bash
bun add -g ytm-tui      # or: npm i -g ytm-tui (Bun must still be installed)
ytm                     # or the full name, ytm-tui

bunx ytm-tui            # run once without installing
ytm --help              # options and environment variables
```

## Development

```bash
bun install
bun start
bun test          # UI flow with fake search/player, no network or audio
bun run typecheck
bun run build     # bundles src/ into dist/cli.js, the file the package ships
sh docs/record-demo.sh   # re-records docs/demo.gif (needs vhs and ffmpeg)
```

Release: bump `version` in package.json, then `npm publish`. It type-checks, tests and
builds first (`prepublishOnly`, `prepack`).

## Keys

| Key | Action |
|---|---|
| `/` | Search: suggestions appear as you type, recent searches when the box is empty; `↑/↓` picks one, enter runs it, esc goes back to the list |
| `↑/↓` or `j/k` | Move selection |
| `enter` | Open a mood, genre or playlist; play a song (in a playlist, the rest of it becomes up next) |
| `esc` / `backspace` | Back to the previous list |
| `a` | Add the selected song to the up-next queue |
| `A` | Add the whole playlist to the queue |
| `s` | Shuffle the playlist and play it |
| `tab` | Switch between the list and the queue |
| `d` / `x` / `delete` | Remove from queue |
| `space` | Pause / resume |
| `n` / `p` | Next / previous (previous restarts the song if more than 5s in) |
| `←/→` | Seek 10s |
| `+` / `-` | Volume |
| `r` | Toggle autoplay (YouTube Music radio when the queue runs out) |
| `?` | Show every key |
| `q` / `ctrl+c` | Quit |

Any key skips the splash screen on launch; `YTM_NO_SPLASH=1` turns it off.

## Picking up where you left off

Volume, autoplay, the current song, up next, the last 50 played songs and your last 20 searches are saved to
`~/.local/state/ytm-tui/session.json` (or `$XDG_STATE_HOME/ytm-tui`). On the next start the last
song is back in now playing, stopped; space plays it. The songs you played are under
"Recently played" at the top of browse. Delete the file to start fresh.

## Browse

The app opens on YouTube Music's moods & genres: 12 moods (Chill, Focus, Workout...) and
24 genres (Hip-hop, Rock, Jazz...). Each one lists the playlists YouTube Music's editors made for
it; community playlists are left out. Status messages show in the bottom line for a few seconds,
in place of the key help.

## How it works

- `src/services/music.ts`: search, "up next" radio, moods & genres and playlists through [youtubei.js](https://github.com/LuanRT/YouTube.js) (YouTube's internal API, no API key).
- `src/services/player.ts`: YouTube's stream URLs return 403 when mpv fetches them directly, so yt-dlp downloads
  the audio into memory (`src/services/download.ts`) and the app feeds it to mpv's stdin. Pause, seek, volume
  and position go over mpv's JSON IPC socket.
- Starting a song: yt-dlp normally takes 7-8 seconds before the first byte, nearly all of it setup. It asks as
  YouTube's visionOS app first, which takes about a second, and falls back to its defaults if YouTube refuses.
  While a song plays, the next one in up next downloads (a few MB), so it starts right away.
- `src/app.tsx`: layout, focus and keys; playback rules live in `src/hooks/use-playback.ts`, the list you
  browse (a stack that esc pops) in `src/hooks/use-navigation.ts`, the panels in `src/components/`. `src/index.tsx` makes sure mpv and yt-dlp are killed whenever the app exits.

Extra mpv flags go in `YTM_MPV_ARGS`, e.g. `YTM_MPV_ARGS="--audio-device=pipewire/my-sink" bun start`.

## Ambient glow

The background is a slowly drifting gradient made from the cover's colors (`src/components/ambient.ts`),
fading over to the new song's colors on every track change. `src/lib/palette.ts` shrinks the cover to
32x32 and picks its three most vivid colors; the glow brightness is capped so text stays readable.
It redraws at 10 fps, about 2% CPU. On launch it blooms out from the middle of the screen while the
splash logo (`src/components/logo.ts`) appears behind a glint.

## Cover art

The box above the queue shows the playing song's cover, or the selected song's or playlist's
cover while nothing plays. OpenTUI picks how to draw it: real pixels on terminals with kitty graphics
(Ghostty, kitty, WezTerm), colored block characters everywhere else and inside tmux.
If it guesses wrong (some multiplexers hide what the terminal supports), force it:

```bash
YTM_IMAGE_PROTOCOL=kitty bun start    # or sixel, blocks
```

If playback stops working one day, update yt-dlp first; YouTube changes often.

Not affiliated with or endorsed by Google or YouTube. It uses YouTube's unofficial internal API.
