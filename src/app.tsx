import type { ImageRenderProtocol, InputRenderable } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import './components/ambient';
import { BrowsePane } from './components/browse-pane';
import { HelpOverlay } from './components/help-overlay';
import { HomePage } from './components/home-page';
import { LOGO_FADE_MS } from './components/logo';
import { NowPlaying } from './components/now-playing';
import { SearchSuggestions } from './components/search-suggestions';
import { SidePanel, sidePanelRows } from './components/side-panel';
import { Splash } from './components/splash';
import { TopBar } from './components/top-bar';
import { useCoverPalette } from './hooks/use-cover-palette';
import { useDebounced } from './hooks/use-debounced';
import { useLatestState } from './hooks/use-latest-state';
import { isSectioned, useNavigation, type View } from './hooks/use-navigation';
import { recentlyPlayed, usePlayback } from './hooks/use-playback';
import { useSearchSuggestions } from './hooks/use-search-suggestions';
import {
  chooseSubject,
  firstSongRow,
  homeItems,
  homeTabs,
  pageLayout,
  previewOf,
  searchItems,
  switchTab,
  withRecent,
} from './lib/browse';
import { fit } from './lib/format';
import type { Direction } from './lib/page-layout';
import { moveInPage } from './lib/page-layout';
import { clamp, shuffled } from './lib/util';
import type { MusicSource, Track } from './services/music';
import type { Player } from './services/player';
import type { SessionStore } from './services/store';
import { colors } from './theme';

type Focus = 'search' | 'results' | 'queue';
type SplashState = 'on' | 'leaving' | 'off';

// The splash waits for home to load, but stays at least SPLASH_MIN_MS so the logo can
// finish appearing, and at most SPLASH_MAX_MS on a slow network.
const SPLASH_MIN_MS = 1200;
const SPLASH_MAX_MS = 4000;
// Status messages take the key help's place for a few seconds.
const NOTICE_MS = 4000;
// The header and the blank line under it; the blank line above the player, its two rows, and the
// key hints. Everything else belongs to the page.
const CHROME_ROWS = 6;
// The side column only sits beside the page from this width; below it, tab swaps between them.
const SIDE_COLUMN_MIN_WIDTH = 100;
// Holding j shouldn't download every cover it passes.
const COVER_DEBOUNCE_MS = 120;

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
function helpText(focus: Focus, view: View, row: View['items'][number] | undefined, canGoBack: boolean) {
  if (focus === 'search') return 'enter search · ↑↓ suggestions · esc back';
  if (focus === 'queue') return 'enter play · d remove · g artist · b album';
  if (view.kind === 'playlist')
    return 'enter play from here · s shuffle · a queue · A queue all';
  if (view.kind === 'playlists')
    return ['enter open', ...(canGoBack ? ['esc back'] : []), '/ search', 'tab queue'].join(' · ');
  if (row && 'track' in row) return 'enter play · a queue · g artist · b album';
  const across = view.kind === 'home' ? '←→ switch tab' : '←→ next section';
  return ['enter open', ...(canGoBack ? ['esc back'] : []), across, '/ search'].join(' · ');
}

// The song on a browse row, if that row holds one.
function songAt(view: View, index: number): Track | undefined {
  if (view.kind === 'playlist') return view.items[index];
  if (!isSectioned(view)) return undefined;
  const item = view.items[index];
  return item && 'track' in item ? item.track : undefined;
}

// The playing song drives the cover and the glow; without one, or if it has no image of its own
// (an empty string, not undefined), the highlighted row does.
export function coverFor(
  current: Track | null,
  highlighted: View['items'][number] | undefined,
) {
  if (current?.cover) return current.cover;
  if (!highlighted) return undefined;
  // In this order: a song's `album` is its album's name, not an artist page's album row.
  if ('cover' in highlighted) return highlighted.cover || undefined;
  if ('track' in highlighted) return highlighted.track.cover || undefined;
  if ('album' in highlighted) return highlighted.album.cover || undefined;
  if ('artist' in highlighted) return highlighted.artist.cover || undefined;
  return undefined;
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
  const nav = useNavigation(async () => {
    // Home is still useful with only moods & genres, if what's featured can't be fetched.
    const [featured, categories] = await Promise.all([
      music.explore().catch(() => ({ quickPicks: [], albums: [], trending: [] })),
      music.categories(),
    ]);
    return homeItems(recentlyPlayed(playbackRef.current), featured, categories);
  }, notify);
  const suggest = useSearchSuggestions(music, saved?.searches);
  const view = nav.view;
  const rootStatus = nav.stack[0]!.status;

  // Keep Recently played current; the rest of home doesn't change once it has loaded.
  useEffect(() => {
    nav.refreshHome((items) => withRecent(items, recentlyPlayed(playback)));
    // Only the songs played matter here, not every change to the queue.
  }, [playback.current, playback.history, rootStatus]);

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
    let songs = 0;
    const items = await nav.open(
      'search',
      `Search "${q}"`,
      async () => {
        const results = await music.search(q);
        songs = results.songs.length;
        return searchItems(results);
      },
      { firstRow: firstSongRow },
    );
    if (items)
      notify(songs ? `${songs} songs for "${q}"` : `No songs found for "${q}"`);
  }

  async function openArtist(artistId: string) {
    const key = `artist:${artistId}`;
    const items = await nav.open(
      'artist',
      'artist',
      async () => {
        const page = await music.artist(artistId);
        nav.describe(key, page.header);
        return page.items;
      },
      { key },
    );
    if (items?.length === 0) notify('No songs or albums found for this artist');
  }

  async function openAlbum(albumId: string, title: string) {
    const key = `album:${albumId}`;
    const items = await nav.open(
      'playlist',
      title,
      async () => {
        const page = await music.album(albumId);
        nav.describe(key, page.header);
        return page.tracks;
      },
      { key },
    );
    if (items?.length === 0) notify(`No songs found on ${title}`);
  }

  // g and b: open the selected song's artist or album on the page.
  function openFromSong(target: 'artist' | 'album', song: Track | undefined) {
    if (!song) return notify(`Select a song to open its ${target}`);
    const id = target === 'artist' ? song.artistId : song.albumId;
    if (!id) return notify(`No ${target} page for "${song.title}"`);
    setFocus('results');
    void (target === 'artist'
      ? openArtist(id)
      : openAlbum(id, song.album || 'album'));
  }

  // Enter on the main area: open or play what is selected.
  function activate(view: View, index: number) {
    if (view.status === 'error') return nav.retry();
    if (isSectioned(view)) {
      const item = view.items[index];
      if (!item) return;
      if ('track' in item) playNow(item.track);
      else if ('album' in item) void openAlbum(item.album.id, item.album.title);
      else if ('artist' in item) void openArtist(item.artist.id);
      else
        void nav.open('playlists', item.category.title, () =>
          music.playlists(item.category.id),
        );
    } else if (view.kind === 'playlists') {
      const playlist = view.items[index];
      if (playlist)
        void nav.open('playlist', playlist.title, () =>
          music.playlist(playlist.id),
        );
    } else {
      if (!view.items[index]) return;
      playFrom(view.items, index);
      notify(`Playing ${view.title} · ${view.items.length - index - 1} up next`);
    }
  }

  const contentRows = Math.max(1, height - CHROME_ROWS);
  const wide = width >= SIDE_COLUMN_MIN_WIDTH;
  const sideWidth = wide ? clamp(Math.floor(width * 0.3), 30, 44) : width;
  const mainWidth = wide ? width - sideWidth : width;
  // Home has no side column, even while it loads, so the page doesn't jump when it's ready.
  const pageOuterWidth = view.kind === 'home' ? width : mainWidth;
  // A column of padding on each side of the page.
  const pageWidth = Math.max(1, pageOuterWidth - 2);
  const homeView =
    view.kind === 'home' && view.status === 'ready' && view.items.length > 0
      ? view
      : undefined;
  const queueRows = homeView
    ? Math.max(1, contentRows - 1)
    : sidePanelRows(sideWidth, contentRows).queue;
  // The queue shrinks as songs play, so its selection is clamped wherever it is read.
  const queueSelection = clamp(
    queueSelected,
    0,
    Math.max(0, playback.queue.length - 1),
  );

  const highlighted =
    view.items[clamp(view.selected, 0, Math.max(0, view.items.length - 1))];
  // The glow belongs to the song that's playing; the cover beside the list follows the selection.
  const palette = useCoverPalette(coverFor(playback.current, highlighted));
  const homeRow = homeView?.items[clamp(homeView.selected, 0, homeView.items.length - 1)];
  const subject =
    homeRow && focus !== 'queue'
      ? previewOf(homeRow)
      : chooseSubject(
          previewOf(focus === 'queue' ? playback.queue[queueSelection] : highlighted),
          previewOf(playback.current),
        );
  const subjectCover = useDebounced(
    subject?.cover || undefined,
    COVER_DEBOUNCE_MS,
  );

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
    // On a page of sections the arrows follow the screen; left and right only mean anything there.
    const step = (direction: Direction) => {
      if (!inQueue && view.kind === 'home' && (direction === 'left' || direction === 'right'))
        return nav.select(switchTab(view.items, index, direction === 'right' ? 1 : -1));
      if (!inQueue && isSectioned(view))
        return nav.select(
          moveInPage(pageLayout(view, pageWidth).cells, index, direction),
        );
      if (direction === 'up') move(-1);
      if (direction === 'down') move(1);
    };
    // A page's worth of rows, without leaving what's on screen (home's open tab).
    const movePage = (delta: number) => {
      if (inQueue || !isSectioned(view)) return move(delta);
      const { cells } = pageLayout(view, pageWidth);
      const at = cells.findIndex((cell) => cell.item === index);
      const target = cells[clamp(at + delta, 0, cells.length - 1)];
      if (target) nav.select(target.item);
    };
    // The song under the cursor, if the focused list holds songs.
    const track = inQueue ? queue[index] : songAt(view, index);
    // A page that is still loading has no rows yet, so a repeated g or b has nothing to act on.
    const loading = !inQueue && view.status === 'loading';

    switch (key.name) {
      case 'up':
      case 'k':
        return step('up');
      case 'down':
      case 'j':
        return step('down');
      case 'left':
      case 'h':
        return step('left');
      case 'right':
      case 'l':
        return step('right');
      case 'pageup':
        return movePage(-(inQueue ? queueRows : contentRows));
      case 'pagedown':
        return movePage(inQueue ? queueRows : contentRows);
      case 'tab':
        return setFocus(inQueue ? 'results' : 'queue');
      case 'escape':
      case 'backspace':
        return inQueue ? setFocus('results') : nav.back();
      case 'space':
        return togglePause();
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
      case ',':
        return player.seek(-10);
      case '.':
        return player.seek(10);
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
      case 'g':
        return loading ? undefined : openFromSong('artist', track);
      case 'b':
        return loading ? undefined : openFromSong('album', track);
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
          <TopBar
            stack={nav.stack}
            width={width}
            searching={focus === 'search'}
            tabs={
              homeView && homeRow
                ? { names: homeTabs(homeView.items), active: homeRow.section }
                : undefined
            }
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
          </TopBar>

          <box flexDirection="row" height={contentRows} flexShrink={0}>
            {homeView && (
              <box width={width} paddingLeft={1} paddingRight={1} flexShrink={0}>
                <HomePage
                  view={homeView}
                  width={pageWidth}
                  rows={contentRows}
                  listFocused={focus === 'results'}
                  queueFocused={focus === 'queue'}
                  playingId={playback.current?.id}
                  subject={subject}
                  coverSource={subjectCover}
                  coverProtocol={coverProtocol}
                  queue={playback.queue}
                  queueSelection={queueSelection}
                  autoplay={autoplay}
                />
              </box>
            )}
            {!homeView && (view.kind === 'home' || wide || focus !== 'queue') && (
              <box width={pageOuterWidth} paddingLeft={1} paddingRight={1} flexShrink={0}>
                <BrowsePane
                  view={view}
                  focused={focus === 'results'}
                  width={pageWidth}
                  rows={contentRows}
                  playingId={playback.current?.id}
                  coverProtocol={coverProtocol}
                />
              </box>
            )}
            {view.kind !== 'home' && (wide || focus === 'queue') && (
              <SidePanel
                width={sideWidth}
                height={contentRows}
                focused={focus === 'queue'}
                divider={wide}
                subject={subject}
                coverSource={subjectCover}
                coverProtocol={coverProtocol}
                queue={playback.queue}
                queueSelection={queueSelection}
                autoplay={autoplay}
              />
            )}
          </box>
          <box height={1} flexShrink={0} />

          <NowPlaying
            track={playback.current}
            state={playerState}
            autoplay={autoplay}
            width={width}
          />

          <box height={1} paddingLeft={1} flexShrink={0}>
            <text fg={notice ? colors.fg : colors.muted}>
              {fit(
                notice?.text ??
                  helpText(focus, view, highlighted, nav.stack.length > 1),
                Math.max(0, width - 2),
              )}
            </text>
          </box>
          {focus === 'search' && suggest.rows.length > 0 && (
            <SearchSuggestions
              rows={suggest.rows}
              selected={suggest.selected}
              query={suggest.query}
              width={mainWidth}
              top={1}
            />
          )}
          {help && <HelpOverlay width={width} />}
        </>
      )}
    </box>
  );
}
