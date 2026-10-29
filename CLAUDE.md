# ytm-tui

Terminal YouTube Music client: OpenTUI + React on Bun. Search and radio via youtubei.js,
playback by piping yt-dlp into mpv. Use Bun, not Node (`bun install`, `bunx`, `bun test`).

## Commands

- `bun start`: run the app (needs `mpv` and `yt-dlp` on PATH)
- `bun test`: unit tests plus a headless UI flow with a fake music source and player (no network, no audio)
- `bun run typecheck`: `tsc --noEmit`; run it together with the tests after every change
- `bun run build`: bundles to `dist/cli.js` (deps stay external); the npm package ships only `dist/`

## Layout

- `src/index.tsx`: entry; checks dependencies, wires the real services, kills mpv/yt-dlp on exit
- `src/app.tsx`: layout, focus, search and keyboard handling
- `src/services/`: the outside world, no React. `music.ts` (`MusicSource`), `player.ts` (`Player`)
- `src/hooks/`: `use-playback.ts` holds the queue, history and autoplay rules; `use-navigation.ts`
  the stack of lists the left pane shows (moods & genres › playlists › songs, or search results)
- `src/components/`: panels, plus custom renderables registered with `extend()`: `ambient.ts` (the
  glow) and `logo.ts` (the splash logo)
- `src/lib/`: pure helpers (`format`, `palette`, `util`); tests sit next to the file they cover

## Rules learned the hard way

- Key and event handlers read state through refs (`useLatestState`), never values captured by the
  last render. Several keys can arrive in one stdin chunk and React batches them, so a stale
  closure acts on old state. For the same reason the search input is uncontrolled.
- Never let mpv open YouTube URLs itself: googlevideo answers 403. yt-dlp writes to stdout
  (`-o -`) and mpv reads stdin; nothing is written to disk.
- Child processes outlive the app unless killed. Every exit path (`q`, ctrl+c, SIGTERM, SIGHUP)
  must reach `player.dispose()`.
- Nothing may print to stdout/stderr while the TUI runs; youtubei.js logging is silenced for this.
- Panels are transparent so the ambient glow shows through: use `'transparent'` or colors with
  alpha, never opaque backgrounds.
- OpenTUI props are flat (`<box flexGrow={1}>`, no `style` object). `<input onSubmit>` is typed
  `string | SubmitEvent` because its props merge with React DOM's.
- Don't mark renderables `live`: that redraws the whole UI at 30 fps. Animate with a timer that
  calls `requestRender()` (see `ambient.ts`).
- In tests, a lone `pressEscape()` is only reported after a short pause (it could start an escape
  sequence), and timers that fire inside `act()` apply their updates when the callback returns.

## Testing by hand

Run inside tmux so the screen can be captured, and keep audio off:

```bash
tmux new-session -d -s ytm -x 120 -y 40 "YTM_MPV_ARGS=--ao=null YTM_NO_SPLASH=1 bun start"
# The app opens on the browse list: "/" first, sent on its own, then the query.
tmux send-keys -t ytm /; sleep 0.3; tmux send-keys -t ytm "daft punk" Enter
sleep 6; tmux capture-pane -p -t ytm
```

Quit with `q` (not by killing the session first), then check that `pgrep mpv` and
`pgrep yt-dlp` find nothing.
