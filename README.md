# ytm-tui

[![CI](https://github.com/PatrykBaranek/ytm-tui/actions/workflows/ci.yml/badge.svg)](https://github.com/PatrykBaranek/ytm-tui/actions/workflows/ci.yml)

A small terminal client for YouTube Music: browse what's new and trending, playlists by mood and
genre, and artist and album pages; search, play, queue, and autoplay similar songs.
Built with [OpenTUI](https://opentui.com) + React on Bun.

![ytm-tui: the splash, browsing Chill playlists, home's tabs with a big cover, a search with suggestions, a song playing with the glow taking its cover's colors, an artist page, and the key help](docs/demo.gif)

## Install

Needs [Bun](https://bun.sh) 1.3.14 or newer, plus `mpv` and `yt-dlp` on your PATH. Linux and macOS.

ytm-tui isn't on npm yet, so run it from a checkout:

```bash
git clone https://github.com/PatrykBaranek/ytm-tui.git
cd ytm-tui
bun install
bun start
bun src/index.tsx --help   # options and environment variables
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
| `pgup` / `pgdn` | Move a page |
| `←/→` or `h/l` | Switch tab on home; on search and artist pages, move to the next section |
| `enter` | Open what's selected; play a song (in a playlist or album, the rest of it becomes up next) |
| `esc` / `backspace` | Back to the previous page |
| `a` | Add the selected song to the up-next queue |
| `A` | Add the whole playlist to the queue |
| `s` | Shuffle the playlist and play it |
| `g` | Open the selected song's artist (on a page or in the queue) |
| `b` | Open the selected song's album (on a page or in the queue) |
| `tab` | Switch between the page and the queue (on home, or below 100 columns, the queue takes over from the list) |
| `d` / `x` / `delete` | Remove from queue |
| `space` | Pause / resume |
| `n` / `p` | Next / previous (previous restarts the song if more than 5s in) |
| `,` / `.` | Seek 10s back / forward |
| `+` / `-` | Volume |
| `r` | Toggle autoplay (YouTube Music radio when the queue runs out) |
| `?` | Show every key |
| `q` / `ctrl+c` | Quit |

Any key skips the splash screen on launch; `YTM_NO_SPLASH=1` turns it off.

## Picking up where you left off

Volume, autoplay, the current song, up next, the last 50 played songs and your last 20 searches are saved to
`~/.local/state/ytm-tui/session.json` (or `$XDG_STATE_HOME/ytm-tui`). On the next start the last
song is back in the player, stopped; space plays it. The songs you played are on home's Recent
tab. Delete the file to start fresh.

## Browse

The app opens on home: one big cover of what's selected, beside one list at a time. `←/→` switches
between its tabs: **Recent**, the songs you played; **Moods** and genres (Chill, Focus, Hip-hop,
Rock...); **For you** (YouTube Music's quick picks); **New** albums and singles; and **Trending**.
A mood or genre lists the playlists YouTube Music's editors made for it; community playlists are
left out. Until you've played something there's no Recent tab, so home opens on Moods. The app isn't
signed in, so For you, New and Trending are YouTube Music's general picks, not based on what you
listen to.

A search lists the closest artists and albums above the songs, and starts on the top song, so enter
still plays it. Status messages show in the bottom line for a few seconds, in place of the key help.

## How it works

- `src/services/music.ts`: search, "up next" radio, moods & genres, playlists, artist and album pages and home's tabs through [youtubei.js](https://github.com/LuanRT/YouTube.js) (YouTube's internal API, no API key).
- `src/services/player.ts`: YouTube's stream URLs return 403 when mpv fetches them directly, so yt-dlp downloads
  the audio into memory (`src/services/download.ts`) and the app feeds it to mpv's stdin. Pause, seek, volume
  and position go over mpv's JSON IPC socket.
- Starting a song: yt-dlp normally takes 7-8 seconds before the first byte, nearly all of it setup. It asks as
  YouTube's visionOS app first, which takes about a second, and falls back to its defaults if YouTube refuses.
  While a song plays, the next one in up next downloads (a few MB), so it starts right away.
- `src/app.tsx`: layout, focus and keys; playback rules live in `src/hooks/use-playback.ts`, the pages you
  browse (a stack that esc pops) in `src/hooks/use-navigation.ts`, what they look like in `src/components/`. `src/index.tsx` makes sure mpv and yt-dlp are killed whenever the app exits.

Extra mpv flags go in `YTM_MPV_ARGS`, e.g. `YTM_MPV_ARGS="--audio-device=pipewire/my-sink" bun start`.

## Ambient glow

The background is a slowly drifting gradient made from the cover's colors (`src/components/ambient.ts`),
fading over to the new song's colors on every track change. `src/lib/palette.ts` shrinks the cover to
32x32 and picks its three most vivid colors; the glow brightness is capped so text stays readable.
It redraws at 10 fps, about 2% CPU. On launch it blooms out from the middle of the screen while the
splash logo (`src/components/logo.ts`) appears behind a glint.

## Cover art

On home, one big cover shows what you've selected; a mood has no cover, so its name is drawn large
instead. On other pages, the column beside the list shows the cover and details of what you've
selected: a song, an album, an artist or a playlist. On a row with no picture of its own, it shows
the song that's playing. OpenTUI picks how to draw covers: real pixels on terminals with kitty graphics
(Ghostty, kitty, WezTerm), colored block characters everywhere else and inside tmux.
If it guesses wrong (some multiplexers hide what the terminal supports), force it:

```bash
YTM_IMAGE_PROTOCOL=kitty bun start    # or sixel, blocks
```

If playback stops working one day, update yt-dlp first; YouTube changes often.

Not affiliated with or endorsed by Google or YouTube. It uses YouTube's unofficial internal API.
