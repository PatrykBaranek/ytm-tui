# ytm-tui

A small terminal client for YouTube Music: browse playlists by mood and genre, search, play,
queue, and autoplay similar songs.
Built with [OpenTUI](https://opentui.com) + React on Bun.

## Install

Needs [Bun](https://bun.sh) 1.3.14 or newer, plus `mpv` and `yt-dlp` on your PATH. Linux and macOS.

```bash
bun add -g ytm-tui      # or: npm i -g ytm-tui (Bun must still be installed)
ytm-tui

bunx ytm-tui            # run once without installing
```

## Development

```bash
bun install
bun start
bun test          # UI flow with fake search/player, no network or audio
bun run typecheck
bun run build     # bundles src/ into dist/cli.js, the file the package ships
```

Release: bump `version` in package.json, then `npm publish`. It type-checks, tests and
builds first (`prepublishOnly`, `prepack`).

## Keys

| Key | Action |
|---|---|
| `/` | Search (enter to run, esc back to the list) |
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
| `q` / `ctrl+c` | Quit |

Any key skips the splash screen on launch; `YTM_NO_SPLASH=1` turns it off.

## Browse

The app opens on YouTube Music's moods & genres: 12 moods (Chill, Focus, Workout...) and
24 genres (Hip-hop, Rock, Jazz...). Each one lists the playlists YouTube Music's editors made for
it; community playlists are left out. Status messages show in the bottom line for a few seconds,
in place of the key help.

## How it works

- `src/services/music.ts`: search, "up next" radio, moods & genres and playlists through [youtubei.js](https://github.com/LuanRT/YouTube.js) (YouTube's internal API, no API key).
- `src/services/player.ts`: YouTube's stream URLs return 403 when mpv fetches them directly, so yt-dlp downloads
  the audio and pipes it into mpv. Pause, seek, volume and position go over mpv's JSON IPC socket.
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
