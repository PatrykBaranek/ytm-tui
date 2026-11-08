import { useEffect, useRef } from 'react';
import { itemKey } from '../lib/browse';
import { errorMessage } from '../lib/util';
import type { BrowseItem, PageHeader, PlaylistInfo, Track } from '../services/music';
import { useLatestState } from './use-latest-state';

interface Page<Kind extends string, Item> {
  kind: Kind;
  id: number;
  title: string;
  items: Item[];
  selected: number;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  load: () => Promise<Item[]>;
  // Identifies an artist or album page, so a repeated key doesn't stack the same page twice.
  key?: string;
  // The row to start on, once the items are in. The first one if not given.
  firstRow?: (items: Item[]) => number;
  // The name, description and image of an artist or album page.
  header?: PageHeader;
}

// What the main area shows: home, a mood or genre's playlists, one playlist or album, an artist's
// page, or search results.
export type View =
  | Page<'home', BrowseItem>
  | Page<'playlists', PlaylistInfo>
  | Page<'playlist', Track>
  | Page<'artist', BrowseItem>
  | Page<'search', BrowseItem>;

// The pages laid out in named sections, as opposed to one plain list.
export type SectionedView = Extract<View, { items: BrowseItem[] }>;

export const isSectioned = (view: View): view is SectionedView =>
  view.kind === 'home' || view.kind === 'artist' || view.kind === 'search';

type ItemOf<Kind extends View['kind']> = Extract<View, { kind: Kind }>['items'][number];

// A stack of views: enter opens one on top, esc goes back to the one below with its selection
// kept. The bottom view, home from `loadHome`, starts loading with the app.
// `notify` receives status messages for the status line.
export function useNavigation(
  loadHome: () => Promise<BrowseItem[]>,
  notify: (message: string) => void,
) {
  const nextId = useRef(1);
  const [stack, setStack, stackRef] = useLatestState<View[]>([
    {
      kind: 'home',
      id: 0,
      title: 'Home',
      items: [],
      selected: 0,
      status: 'loading',
      load: loadHome,
    },
  ]);

  // Views can close while they load, so updates go by id and skip views that are gone.
  function update(id: number, patch: Partial<Omit<View, 'firstRow' | 'load'>>) {
    setStack(
      stackRef.current.map((view) =>
        view.id === id ? ({ ...view, ...patch } as View) : view,
      ),
    );
  }

  // Resolves to the items, or null if loading failed or the view closed meanwhile.
  async function load(view: View) {
    if (view.status !== 'loading')
      update(view.id, { status: 'loading', error: undefined });
    try {
      const items = await view.load();
      const firstRow = view.firstRow as ((rows: unknown[]) => number) | undefined;
      update(view.id, {
        items,
        status: 'ready',
        ...(firstRow && view.selected === 0 ? { selected: firstRow(items) } : {}),
      } as Partial<View>);
      return stackRef.current.some((v) => v.id === view.id) ? items : null;
    } catch (err) {
      update(view.id, { status: 'error', error: errorMessage(err) });
      notify(`Couldn't load ${view.title}: ${errorMessage(err)}`);
      return null;
    }
  }

  function open<Kind extends View['kind']>(
    kind: Kind,
    title: string,
    loader: () => Promise<ItemOf<Kind>[]>,
    { key, firstRow }: { key?: string; firstRow?: (items: ItemOf<Kind>[]) => number } = {},
  ) {
    if (key && stackRef.current.at(-1)?.key === key)
      return Promise.resolve(null);
    const view = {
      kind,
      id: nextId.current++,
      title,
      items: [],
      selected: 0,
      status: 'loading',
      load: loader,
      key,
      firstRow,
    } as unknown as View;
    // A new search replaces the previous results instead of stacking on top of them.
    const below = stackRef.current;
    const base =
      kind === 'search' && below.at(-1)?.kind === 'search'
        ? below.slice(0, -1)
        : below;
    setStack([...base, view]);
    return load(view) as Promise<ItemOf<Kind>[] | null>;
  }

  // For pages described only once they load, like an artist's.
  function describe(key: string, header: PageHeader) {
    // The newest match: the same artist can be open further down the stack.
    const view = stackRef.current.findLast((v) => v.key === key);
    if (!view) return;
    const title = header.title || view.title;
    update(view.id, { title, header: { ...header, title } });
  }

  // Changes the home page's rows in place, keeping the selection on the same row.
  function refreshHome(transform: (items: BrowseItem[]) => BrowseItem[]) {
    const home = stackRef.current[0];
    if (home?.kind !== 'home' || home.status !== 'ready') return;
    const selected = home.items[home.selected];
    const items = transform(home.items);
    const index = selected
      ? items.findIndex((item) => itemKey(item) === itemKey(selected))
      : -1;
    update(home.id, { items, selected: Math.max(0, index) } as Partial<View>);
  }

  function back() {
    if (stackRef.current.length > 1) setStack(stackRef.current.slice(0, -1));
  }

  function select(index: number) {
    const top = stackRef.current.at(-1);
    if (top) update(top.id, { selected: index });
  }

  function retry() {
    const top = stackRef.current.at(-1);
    if (top?.status === 'error') void load(top);
  }

  useEffect(() => {
    void load(stackRef.current[0]!);
  }, []);

  return {
    stack,
    stackRef,
    view: stack.at(-1)!,
    open,
    describe,
    refreshHome,
    back,
    select,
    retry,
  };
}
