import type { ImageRenderProtocol, InputRenderable } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import './components/ambient';
import { BrowsePane } from './components/browse-pane';
import { Cover } from './components/cover';
import { HelpOverlay } from './components/help-overlay';
import { LOGO_FADE_MS } from './components/logo';
import { NowPlaying } from './components/now-playing';
import { SearchSuggestions } from './components/search-suggestions';
import { Pane } from './components/pane';
import { Splash } from './components/splash';
import { TrackList } from './components/track-list';
import { useCoverPalette } from './hooks/use-cover-palette';
import { useLatestState } from './hooks/use-latest-state';
import { useNavigation, type View } from './hooks/use-navigation';
import { recentlyPlayed, usePlayback } from './hooks/use-playback';
import { useSearchSuggestions } from './hooks/use-search-suggestions';
import { fit } from './lib/format';
import { clamp, shuffled } from './lib/util';
import type { Category, MusicSource } from './services/music';
import type { Player } from './services/player';
import type { SessionStore } from './services/store';
import { colors } from './theme';

type Focus = 'search' | 'results' | 'queue';
type SplashState = 'on' | 'leaving' | 'off';

// The splash waits for moods & genres to load, but stays at least SPLASH_MIN_MS so the logo can
// finish appearing, and at most SPLASH_MAX_MS on a slow network.
const SPLASH_MIN_MS = 1200;
const SPLASH_MAX_MS = 4000;
// Status messages take the key help's place for a few seconds.
const NOTICE_MS = 4000;
// Listed above YouTube Music's moods & genres.
const RECENT: Category = {
  id: 'recent',
  title: 'Recently played',
  group: 'Your music',
};

interface AppProps {
  music: MusicSource;
  player: Player;
  onQuit: () => void;
  coverProtocol?: ImageRenderProtocol;
  splash?: boolean;
  // Remembers volume, autoplay, the queue and what played across restarts.
  store?: SessionStore;
}

// The few keys that matter most right now; `?` shows the rest.
function helpText(focus: Focus, view: View, canGoBack: boolean) {
  if (focus === 'search') return 'enter search · ↑↓ suggestions · esc back';
  if (focus === 'queue')
    return 'enter play · d remove · tab browse · space pause · n/p next/prev';
  const back = canGoBack ? ' · esc back' : '';
  switch (view.kind) {
    case 'categories':
    case 'playlists':
      return `enter open${back} · / search · tab queue · space pause · n/p next/prev`;
    case 'playlist':
      return `enter play from here · s shuffle · a queue · A queue all${back} · / search`;
    case 'search':
      return `enter play · a queue${back} · / search · tab queue · space pause`;
  }
}

export function App({
  music,
  player,
  onQuit,
  coverProtocol,
  splash = false,
  store,
}: AppProps) {
  const { width, height } = useTerminalDimensions();
  const playerState = useSyncExternalStore(
    player.subscribe,
    () => player.state,
  );

  const [focus, setFocus, focusRef] = useLatestState<Focus>('results');
  const [queueSelected, setQueueSelected, queueSelectedRef] = useLatestState(0);
  // `at` makes a repeated message restart the timer.
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(
    null,
  );
  const notify = (text: string) => setNotice({ text, at: performance.now() });
  const [splashState, setSplashState, splashRef] = useLatestState<SplashState>(
    splash ? 'on' : 'off',
  );
  const [help, setHelp, helpRef] = useLatestState(false);
  const startedAt = useRef(performance.now());
  const searchRef = useRef<InputRenderable>(null);
  const saved = store?.saved;
  const resumed = useRef(saved?.current ?? null);

  const {
    playback,
    playbackRef,
    autoplay,
    playNow,
    playFrom,
    enqueue,
    enqueueAll,
    removeFromQueue,
    next,
    previous,
    togglePause,
    toggleAutoplay,
  } = usePlayback(
    player,
    music,
    notify,
    saved
      ? {
          playback: {
            current: saved.current,
            queue: saved.queue,
            history: saved.history,
          },
          autoplay: saved.autoplay,
        }
      : undefined,
  );
  const nav = useNavigation(
    async () => [RECENT, ...(await music.categories())],
    notify,
  );
  const suggest = useSearchSuggestions(music, saved?.searches);
  const view = nav.view;
  const rootStatus = nav.stack[0]!.status;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The store batches writes, so saving on every change is cheap.
  useEffect(() => {
    store?.save({
      volume: playerState.volume,
      autoplay,
      ...playback,
      searches: suggest.history,
    });
  }, [store, playback, autoplay, playerState.volume, suggest.history]);

  // Once the splash is gone, say that the last session is back.
  useEffect(() => {
    if (splashState !== 'off' || !resumed.current) return;
    notify(
      `Picked up where you left off · space plays ${resumed.current.title}`,
    );
    resumed.current = null;
  }, [splashState]);

  useEffect(() => {
    if (splashState === 'off') return;
    const shown = performance.now() - startedAt.current;
    const [nextState, wait] =
      splashState === 'leaving'
        ? (['off', LOGO_FADE_MS] as const)
        : rootStatus === 'loading'
          ? (['leaving', SPLASH_MAX_MS - shown] as const)
          : (['leaving', SPLASH_MIN_MS - shown] as const);
    const timer = setTimeout(() => setSplashState(nextState), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [splashState, rootStatus]);

  async function search(query: string) {
    const q = query.trim();
    if (!q) return;
    suggest.remember(q);
    setFocus('results');
    notify(`Searching for "${q}"...`);
    const tracks = await nav.open('search', `"${q}"`, () => music.search(q));
    if (tracks)
      notify(
        tracks.length
          ? `${tracks.length} songs for "${q}"`
          : `No songs found for "${q}"`,
      );
  }

  // Enter on the left pane: open a mood, genre or playlist, or play a song.
  function activate(view: View, index: number) {
    if (view.status === 'error') return nav.retry();
    if (view.kind === 'categories') {
      const category = view.items[index];
      if (category?.id === RECENT.id)
        void nav.open('playlist', category.title, async () =>
          recentlyPlayed(playbackRef.current),
        );
      else if (category)
        void nav.open('playlists', category.title, () =>
          music.playlists(category.id),
        );
    } else if (view.kind === 'playlists') {
      const playlist = view.items[index];
      if (playlist)
        void nav.open('playlist', playlist.title, () =>
          music.playlist(playlist.id),
        );
    } else if (view.kind === 'playlist') {
      if (!view.items[index]) return;
      playFrom(view.items, index);
      notify(`Playing ${view.title} · ${view.items.length - index - 1} up next`);
    } else {
      const track = view.items[index];
      if (track) playNow(track);
    }
  }

  // Layout: search 3 + panes (rows + 2 borders) + now playing 4 + status line 1.
  const listRows = Math.max(3, height - 10);
  const queueWidth = clamp(Math.floor(width * 0.34), 24, 48);
  const resultsWidth = width - queueWidth;
  // The cover sits above the queue. Terminal cells are about twice as tall as they are wide,
  // so a square cover filling the column needs about half as many rows as columns.
  const panesHeight = listRows + 2;
  const coverHeight = Math.min(
    Math.floor((queueWidth - 2) / 2) + 2,
    Math.floor(panesHeight * 0.6),
  );
  const showCover = coverHeight >= 6;
  const queueHeight = panesHeight - (showCover ? coverHeight : 0);
  const queueRows = queueHeight - 2;
  // The queue shrinks as songs play, so its selection is clamped wherever it is read.
  const queueSelection = clamp(
    queueSelected,
    0,
    Math.max(0, playback.queue.length - 1),
  );

  // The playing song drives the cover and the glow; while nothing plays, the selected song or
  // playlist does.
  const highlighted =
    view.items[clamp(view.selected, 0, Math.max(0, view.items.length - 1))];
  const coverSource =
    playback.current?.cover ??
    (highlighted && 'cover' in highlighted ? highlighted.cover : undefined);
  const palette = useCoverPalette(coverSource);

  useKeyboard((key) => {
    if (key.ctrl && key.name === 'c') return onQuit();
    if (splashRef.current !== 'off') return setSplashState('off'); // any key skips the splash
    if (helpRef.current) return setHelp(false); // and any key closes the key help
    if (focusRef.current === 'search') {
      if (key.name === 'escape' || key.name === 'tab') setFocus('results');
      else if (key.name === 'up') suggest.move(-1);
      else if (key.name === 'down') suggest.move(1);
      return; // everything else is typing
    }

    const inQueue = focusRef.current === 'queue';
    const view = nav.stackRef.current.at(-1)!;
    const queue = playbackRef.current.queue;
    const lastIndex = Math.max(
      0,
      (inQueue ? queue.length : view.items.length) - 1,
    );
    const index = clamp(
      inQueue ? queueSelectedRef.current : view.selected,
      0,
      lastIndex,
    );
    const setIndex = inQueue ? setQueueSelected : nav.select;
    const move = (delta: number) =>
      setIndex(clamp(index + delta, 0, lastIndex));
    // The song under the cursor, if the focused list holds songs.
    const track = inQueue
      ? queue[index]
      : view.kind === 'playlist' || view.kind === 'search'
        ? view.items[index]
        : undefined;

    switch (key.name) {
      case 'up':
      case 'k':
        return move(-1);
      case 'down':
      case 'j':
        return move(1);
      case 'pageup':
        return move(-(inQueue ? queueRows : listRows));
      case 'pagedown':
        return move(inQueue ? queueRows : listRows);
      case 'tab':
        return setFocus(inQueue ? 'results' : 'queue');
      case 'escape':
      case 'backspace':
        return inQueue ? setFocus('results') : nav.back();
      case 'space':
        return togglePause();
      case 'left':
        return player.seek(-10);
      case 'right':
        return player.seek(10);
      case 'return':
        if (!inQueue) return activate(view, index);
        if (!track) return;
        removeFromQueue(index);
        return playNow(track);
      case 'delete':
        return inQueue ? removeFromQueue(index) : undefined;
    }

    switch (key.sequence) {
      case '?':
        return setHelp(true);
      case '/':
        setFocus('search');
        return searchRef.current?.selectAll?.();
      case 'a':
        return !inQueue && track ? enqueue(track) : undefined;
      case 'A':
        return !inQueue && view.kind === 'playlist' && view.items.length
          ? enqueueAll(view.items)
          : undefined;
      case 's':
        if (inQueue || view.kind !== 'playlist' || !view.items.length) return;
        playFrom(shuffled(view.items), 0);
        return notify(`Shuffling ${view.title}`);
      case 'd':
      case 'x':
        return inQueue ? removeFromQueue(index) : undefined;
      case 'n':
        return void next();
      case 'p':
        return previous();
      case '+':
      case '=':
        return player.setVolume(player.state.volume + 5);
      case '-':
        return player.setVolume(player.state.volume - 5);
      case 'r':
        return toggleAutoplay();
      case 'q':
        return onQuit();
    }
  });

  const autoplayLabel = `autoplay ${autoplay ? 'on' : 'off'}`;
  const keysLabel = '? keys · ';

  return (
    <box width="100%" height="100%" flexDirection="column">
      {/* Painted first, so everything else draws on top of the drifting glow. */}
      <ambient
        position="absolute"
        left={0}
        top={0}
        width="100%"
        height="100%"
        palette={palette}
      />
      {splashState !== 'off' ? (
        <Splash
          width={width}
          height={height}
          leaving={splashState === 'leaving'}
          status={
            rootStatus === 'loading'
              ? 'connecting to YouTube Music...'
              : rootStatus === 'error'
                ? "couldn't reach YouTube Music"
                : 'ready'
          }
        />
      ) : (
        <>
          <box
            title="search"
            height={3}
            border
            borderColor={
              focus === 'search' ? colors.borderFocused : colors.border
            }
            paddingLeft={1}
          >
            <input
              ref={searchRef}
              focused={focus === 'search'}
              placeholder="Songs, artists, albums..."
              // OpenTUI's input props are merged with React DOM's, so these are typed string | Event.
              onInput={(value) => {
                if (typeof value === 'string') suggest.onInput(value);
              }}
              onSubmit={(value) => {
                if (typeof value !== 'string') return;
                // Enter on a highlighted suggestion searches it, and shows it in the box.
                const query = suggest.take(value);
                if (searchRef.current && query !== value)
                  searchRef.current.value = query;
                void search(query);
              }}
            />
          </box>

          <box flexDirection="row" height={listRows + 2}>
            <BrowsePane
              stack={nav.stack}
              focused={focus === 'results'}
              width={resultsWidth}
              rows={listRows}
              playingId={playback.current?.id}
            />
            <box flexDirection="column" width={queueWidth}>
              {showCover && (
                <Cover
                  source={coverSource}
                  height={coverHeight}
                  protocol={coverProtocol}
                />
              )}
              <Pane
                title={`up next · ${playback.queue.length}`}
                width={queueWidth}
                height={queueHeight}
                focused={focus === 'queue'}
              >
                {playback.queue.length === 0 ? (
                  <text fg={colors.muted}>
                    {autoplay
                      ? 'Empty. Press a to queue a song; autoplay picks similar ones.'
                      : 'Empty. Press a to queue a song.'}
                  </text>
                ) : (
                  <TrackList
                    tracks={playback.queue}
                    selected={queueSelection}
                    focused={focus === 'queue'}
                    rows={queueRows}
                    width={queueWidth - 4}
                    numbered
                  />
                )}
              </Pane>
            </box>
          </box>

          <NowPlaying
            track={playback.current}
            state={playerState}
            width={width}
          />

          <box flexDirection="row" justifyContent="space-between">
            <text fg={notice ? colors.fg : colors.muted} paddingLeft={1}>
              {fit(
                notice?.text ?? helpText(focus, view, nav.stack.length > 1),
                width - keysLabel.length - autoplayLabel.length - 3,
              )}
            </text>
            <text>
              <span fg={colors.muted}>{keysLabel}</span>
              <span fg={autoplay ? colors.playing : colors.muted}>
                {autoplayLabel}
              </span>
            </text>
          </box>
          {focus === 'search' && suggest.rows.length > 0 && (
            <SearchSuggestions
              rows={suggest.rows}
              selected={suggest.selected}
              query={suggest.query}
              width={resultsWidth}
              top={3}
            />
          )}
          {help && <HelpOverlay width={width} />}
        </>
      )}
    </box>
  );
}
