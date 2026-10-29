import { useEffect, useRef } from 'react';
import { errorMessage } from '../lib/util';
import type { Category, PlaylistInfo, Track } from '../services/music';
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
}

// What the left pane shows: moods & genres, a category's playlists, one playlist, or search results.
export type View =
  | Page<'categories', Category>
  | Page<'playlists', PlaylistInfo>
  | Page<'playlist', Track>
  | Page<'search', Track>;

type ItemOf<Kind extends View['kind']> = Extract<View, { kind: Kind }>['items'][number];

// A stack of views: enter opens one on top, esc goes back to the one below with its selection
// kept. The bottom view, moods & genres from `loadCategories`, starts loading with the app.
// `notify` receives status messages for the status line.
export function useNavigation(
  loadCategories: () => Promise<Category[]>,
  notify: (message: string) => void,
) {
  const nextId = useRef(1);
  const [stack, setStack, stackRef] = useLatestState<View[]>([
    {
      kind: 'categories',
      id: 0,
      title: 'moods & genres',
      items: [],
      selected: 0,
      status: 'loading',
      load: loadCategories,
    },
  ]);

  // Views can close while they load, so updates go by id and skip views that are gone.
  function update(id: number, patch: Partial<Page<string, unknown>>) {
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
      update(view.id, { items, status: 'ready' });
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
  ) {
    const view = {
      kind,
      id: nextId.current++,
      title,
      items: [],
      selected: 0,
      status: 'loading',
      load: loader,
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
    back,
    select,
    retry,
  };
}
