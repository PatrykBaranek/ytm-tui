import type { View } from '../hooks/use-navigation';
import { fit } from '../lib/format';
import { colors } from '../theme';
import { ItemList } from './item-list';
import { Pane } from './pane';
import { TrackList } from './track-list';

// "moods & genres › Rock › Classic Rock", dropping the oldest steps when it doesn't fit.
function breadcrumb(stack: View[], width: number) {
  const titles = stack.map((view) => view.title);
  for (let skip = 0; skip < titles.length - 1; skip++) {
    const text = [...(skip ? ['…'] : []), ...titles.slice(skip)].join(' › ');
    if (Bun.stringWidth(text) <= width) return text;
  }
  return fit(titles.at(-1) ?? '', width).trimEnd();
}

const emptyText: Record<View['kind'], string> = {
  categories: 'No moods or genres found.',
  playlists: 'No playlists here.',
  playlist: 'Nothing here yet.',
  search: 'No songs found.',
};

interface BrowsePaneProps {
  stack: View[];
  focused: boolean;
  width: number;
  rows: number;
  playingId?: string;
}

// The left pane: whatever view is on top of the navigation stack.
export function BrowsePane({
  stack,
  focused,
  width,
  rows,
  playingId,
}: BrowsePaneProps) {
  const view = stack.at(-1)!;
  const inner = width - 4;

  return (
    <Pane title={breadcrumb(stack, inner - 2)} width={width} focused={focused}>
      {view.status === 'loading' ? (
        <text fg={colors.muted}>Loading...</text>
      ) : view.status === 'error' ? (
        <text fg={colors.error}>
          Couldn't load {view.title}: {view.error}. Press enter to retry.
        </text>
      ) : view.items.length === 0 ? (
        <text fg={colors.muted}>{emptyText[view.kind]}</text>
      ) : view.kind === 'categories' ? (
        <ItemList
          // The group name ("Moods & moments", "Genres") only labels the first row of its group.
          items={view.items.map((category, i) => ({
            key: category.id,
            label: category.title,
            detail:
              view.items[i - 1]?.group === category.group ? '' : category.group,
          }))}
          selected={view.selected}
          focused={focused}
          rows={rows}
          width={inner}
        />
      ) : view.kind === 'playlists' ? (
        <ItemList
          items={view.items.map((playlist) => ({
            key: playlist.id,
            label: playlist.title,
            detail: playlist.subtitle,
          }))}
          selected={view.selected}
          focused={focused}
          rows={rows}
          width={inner}
        />
      ) : (
        <TrackList
          tracks={view.items}
          selected={view.selected}
          focused={focused}
          rows={rows}
          width={inner}
          playingId={playingId}
          showAlbum={width >= 80}
        />
      )}
    </Pane>
  );
}
